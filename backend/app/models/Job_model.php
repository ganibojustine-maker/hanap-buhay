<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * Job Model
 * ------------------------------------------------------------------
 * Encapsulates all database operations, query builder searches, and
 * CRUD manipulation for job listings in Oriental Mindoro.
 */
class Job_model extends Model
{
    protected $table = 'jobs';
    protected $primary_key = 'id';
    protected $fillable = [
        'employer_id', 'title', 'company', 'description', 'requirements',
        'location', 'job_type', 'salary_min', 'salary_max', 'skills_needed',
        'status', 'is_featured', 'featured_until', 'views', 'created_at', 'updated_at',
        'pay_basis', 'openings', 'schedule', 'benefits', 'experience', 'needed_by', 'is_urgent', 'duration', 'address', 'image_v',
        'post_type', 'expires_at', 'moderation_status', 'moderation_note', 'barangay', 'education_level', 'category'
    ];

    /** Kinds of work, for filters and the post form (same list: frontend src/utils/categories.js). */
    public const CATEGORIES = [
        'construction' => 'Construction & building', 'electrical' => 'Electrical & aircon', 'automotive' => 'Driving & automotive',
        'food' => 'Food & restaurant', 'hospitality' => 'Hotel, resort & tourism', 'agriculture' => 'Farming & fishing',
        'care' => 'Household & caregiving', 'office' => 'Office, sales & cashier', 'tech' => 'Computer & design',
        'health' => 'Health & wellness', 'beauty' => 'Beauty & grooming', 'education' => 'Teaching & tutoring', 'other' => 'Other work',
    ];

    /** How long a post stays up when nobody chooses (days). Employers and clients can renew. */
    public const DEFAULT_DAYS = ['job' => 60, 'gig' => 30];

    /**
     * Posts whose end date passed close by themselves, like on every job board. Cheap; it runs
     * once per request before any list is read. A closed post can be renewed by its owner.
     */
    public function close_expired(): void
    {
        // warm the column cache now: running it later, in the middle of building a query,
        // would reset the query builder
        $this->has_column('post_type');
        static $done = false;
        if ($done) return;
        $done = true;
        try {
            $this->db->raw("UPDATE jobs SET status = 'closed', updated_at = NOW() WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < NOW()");
        } catch (\Throwable $e) { /* before migration 021 */ }
    }

    public function has_column(string $c): bool
    {
        static $cols = null;
        if ($cols === null) {
            $cols = array_map('strtolower', $this->db->raw("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jobs'")->fetchAll(PDO::FETCH_COLUMN) ?: []);
        }
        return in_array($c, $cols, true);
    }

    private function apply_filters($db, string $query, string $location, array $validTypes, array $more = [])
    {
        if (!empty($more['post_type']) && $this->has_column('post_type')) $db->where('j.post_type', $more['post_type']);
        if (!empty($more['category']) && $this->has_column('category')) $db->where('j.category', $more['category']);

        if ($query !== '') {
            // like() binds the value as given: without % only an exact full title matched ("weld" found nothing)
            $q = '%' . addcslashes($query, '%_\\') . '%';
            $db->grouped(function($d) use ($q) {
                $d->like('j.title', $q)
                  ->or_like('j.description', $q)
                  ->or_like('j.skills_needed', $q)
                  ->or_like('j.company', $q);
            });
        }

        if ($location !== '') {
            $db->where('j.location', $location);
        }

        if (count($validTypes) === 1) {
            $db->where('j.job_type', $validTypes[0]);
        } elseif (count($validTypes) > 1) {
            $db->grouped(function($d) use ($validTypes) {
                foreach ($validTypes as $idx => $vt) {
                    if ($idx === 0) {
                        $d->where('j.job_type', $vt);
                    } else {
                        $d->or_where('j.job_type', $vt);
                    }
                }
            });
        }
    }

    /** How a job list can be ordered. "relevant" keeps featured posts first, then newest. */
    private const SORTS = [
        'relevant' => 'j.is_featured DESC, j.created_at DESC',
        'recent'   => 'j.created_at DESC',
        'salary'   => 'COALESCE(j.salary_max, j.salary_min, 0) DESC, j.created_at DESC',
        'pay_low'  => 'COALESCE(j.salary_min, j.salary_max, 999999) ASC, j.created_at DESC',
    ];

    public function get_active_jobs(string $query, string $location, array $validTypes, int $limit, int $offset, string $sort = 'relevant', bool $with_counts = false, array $more = []): array
    {
        $this->close_expired();
        $db = $this->db->table('jobs j')
            ->select('j.*, u.full_name AS employer_name, u.location AS employer_location, u.picture AS employer_picture, u.is_verified AS employer_verified')
            ->join('users u', 'u.id = j.employer_id', 'LEFT')
            ->where('j.status', 'active');

        $this->apply_filters($db, $query, $location, $validTypes, $more);

        $rows = $db->order_by(self::SORTS[$sort] ?? self::SORTS['relevant'])
                   ->limit($limit, $offset)
                   ->get_all();

        $rows = $rows ?: [];
        return $with_counts ? $this->attach_applicant_counts($rows) : $rows;
    }

    public function count_active_jobs(string $query, string $location, array $validTypes, array $more = []): int
    {
        $this->close_expired();
        $db = $this->db->table('jobs j')
            ->where('j.status', 'active');

        $this->apply_filters($db, $query, $location, $validTypes, $more);

        return (int) $db->count_all_results();
    }

    public function find_job_with_employer(int $id)
    {
        return $this->db->table('jobs j')
            ->select('j.*, u.full_name AS employer_name, u.location AS employer_location, u.bio AS employer_bio, u.is_verified AS employer_verified, u.picture AS employer_picture')
            ->join('users u', 'u.id = j.employer_id', 'LEFT')
            ->where('j.id', $id)
            ->where('j.status !=', 'archived')
            ->get();
    }

    public function find_by_id(int $id)
    {
        return $this->db->table($this->table)->where('id', $id)->get();
    }

    public function increment_views(int $id): void
    {
        $this->db->raw('UPDATE jobs SET views = views + 1 WHERE id = ?', [$id]);
    }

    public function create_job(array $data): ?array
    {
        $data['created_at'] = date('Y-m-d H:i:s');
        $this->db->table($this->table)->insert($data);
        $id = $this->db->last_id();
        return $id ? $this->find_by_id((int) $id) : null;
    }

    public function update_job(int $id, array $data): bool
    {
        $data['updated_at'] = date('Y-m-d H:i:s');
        return (bool) $this->db->table($this->table)->where('id', $id)->update($data);
    }

    public function archive_job(int $id): bool
    {
        return $this->update_job($id, ['status' => 'archived']);
    }

    /**
     * The employer's posts (not deleted), each with how many people applied, how many are
     * still waiting for a first look, and how many were hired.
     */
    public function get_employer_jobs(int $employer_id): array
    {
        $this->expire_featured();
        $this->close_expired();
        $rows = $this->db->raw(
            "SELECT j.*,
                    (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.status <> 'withdrawn') AS applicants,
                    (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.status = 'pending') AS new_applicants,
                    (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.status = 'hired') AS hired
             FROM jobs j WHERE j.employer_id = ? AND j.status <> 'archived' ORDER BY j.created_at DESC", [$employer_id]
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) {
            foreach (['applicants', 'new_applicants', 'hired', 'views'] as $k) $r[$k] = (int) ($r[$k] ?? 0);
        }
        return $rows;
    }

    /** Open jobs per location, for the landing page map: [['location' => 'Baco', 'n' => 4], ...]. */
    public function count_active_by_location(): array
    {
        $this->close_expired();
        return $this->db->raw(
            "SELECT location, COUNT(*) AS n FROM jobs WHERE status = 'active' GROUP BY location"
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /** Featured posts stop being featured on their end date (migration 019). Cheap; run on reads. */
    public function expire_featured(): void
    {
        static $done = false, $has = null;
        if ($done) return;
        $done = true;
        if ($has === null) {
            $has = (bool) $this->db->raw("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'jobs' AND column_name = 'featured_until'")->fetchColumn();
        }
        if ($has) $this->db->raw('UPDATE jobs SET is_featured = 0 WHERE is_featured = 1 AND featured_until IS NOT NULL AND featured_until < NOW()');
    }

    public function has_featured_until(): bool
    {
        static $has = null;
        if ($has === null) {
            $has = (bool) $this->db->raw("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'jobs' AND column_name = 'featured_until'")->fetchColumn();
        }
        return $has;
    }

    public function count_employer_active_jobs(int $employer_id): int
    {
        return (int) $this->db->table($this->table)
            ->where('employer_id', $employer_id)
            ->where('status', 'active')
            ->count_all_results();
    }

    /**
     * Featured jobs. With a town, posts in that town come first, then the rest of the
     * province, so a signed-in person sees work near them at the top of every page.
     */
    public function get_featured_jobs(int $limit = 8, string $town = ''): array
    {
        $this->close_expired();
        $order = $town !== ''
            ? 'CASE WHEN j.location = ? THEN 0 ELSE 1 END, j.is_featured DESC, j.created_at DESC'
            : 'j.is_featured DESC, j.created_at DESC';

        // raw() so the town can be bound inside the ORDER BY expression
        $sql = "SELECT j.*, u.full_name AS employer_name, u.picture AS employer_picture, u.is_verified AS employer_verified
                FROM jobs j LEFT JOIN users u ON u.id = j.employer_id
                WHERE j.status = 'active'
                ORDER BY {$order}
                LIMIT " . max(1, min(50, $limit));
        $rows = $this->db->raw($sql, $town !== '' ? [$town] : [])->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        return $this->attach_applicant_counts($rows);
    }

    /**
     * Add an `applicants` count to each job row (used by job cards:
     * "Be an early applicant" / "12 applicants").
     */
    private function attach_applicant_counts(array $rows): array
    {
        $ids = array_values(array_unique(array_map(fn($r) => (int) ($r['id'] ?? 0), $rows)));
        $ids = array_filter($ids);
        $counts = [];

        if (!empty($ids)) {
            try {
                $placeholders = implode(',', array_fill(0, count($ids), '?'));
                $stmt = $this->db->raw(
                    "SELECT job_id, COUNT(*) AS c FROM applications WHERE job_id IN ({$placeholders}) AND status <> 'withdrawn' GROUP BY job_id",
                    array_values($ids)
                );
                if ($stmt) {
                    foreach ($stmt->fetchAll(\PDO::FETCH_ASSOC) as $c) {
                        $counts[(int) $c['job_id']] = (int) $c['c'];
                    }
                }
            } catch (\Throwable $e) {
                error_log('[Job_model] applicant count failed: ' . $e->getMessage());
            }
        }

        foreach ($rows as &$r) {
            $r['applicants'] = $counts[(int) ($r['id'] ?? 0)] ?? 0;
        }
        unset($r);

        return $rows;
    }

    public function get_all_admin_jobs(int $limit = 100): array
    {
        $rows = $this->db->table('jobs j')
            ->select('j.*, u.full_name AS employer_name')
            ->join('users u', 'u.id = j.employer_id', 'LEFT')
            ->order_by('j.created_at DESC')
            ->limit($limit)
            ->get_all();

        return $rows ?: [];
    }

    public function count_active(): int
    {
        return (int) $this->db->table($this->table)->where('status', 'active')->count_all_results();
    }
}
