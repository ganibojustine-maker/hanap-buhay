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
        'status', 'is_featured', 'views', 'created_at', 'updated_at'
    ];

    private function apply_filters($db, string $query, string $location, array $validTypes)
    {
        if ($query !== '') {
            $db->grouped(function($d) use ($query) {
                $d->like('j.title', $query)
                  ->or_like('j.description', $query)
                  ->or_like('j.skills_needed', $query)
                  ->or_like('j.company', $query);
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

    public function get_active_jobs(string $query, string $location, array $validTypes, int $limit, int $offset): array
    {
        $db = $this->db->table('jobs j')
            ->select('j.*, u.full_name AS employer_name, u.location AS employer_location')
            ->join('users u', 'u.id = j.employer_id', 'LEFT')
            ->where('j.status', 'active');

        $this->apply_filters($db, $query, $location, $validTypes);

        $rows = $db->order_by('j.is_featured DESC, j.created_at DESC')
                   ->limit($limit, $offset)
                   ->get_all();

        return $rows ?: [];
    }

    public function count_active_jobs(string $query, string $location, array $validTypes): int
    {
        $db = $this->db->table('jobs j')
            ->where('j.status', 'active');

        $this->apply_filters($db, $query, $location, $validTypes);

        return (int) $db->count_all_results();
    }

    public function find_job_with_employer(int $id)
    {
        return $this->db->table('jobs j')
            ->select('j.*, u.full_name AS employer_name, u.email AS employer_email, u.location AS employer_location, u.bio AS employer_bio')
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

    public function get_employer_jobs(int $employer_id): array
    {
        $rows = $this->db->table($this->table)
            ->where('employer_id', $employer_id)
            ->where('status !=', 'archived')
            ->order_by('created_at DESC')
            ->get_all();

        return $rows ?: [];
    }

    public function get_featured_jobs(int $limit = 8): array
    {
        $rows = $this->db->table('jobs j')
            ->select('j.*, u.full_name AS employer_name, u.picture AS employer_picture, u.is_verified AS employer_verified')
            ->join('users u', 'u.id = j.employer_id', 'LEFT')
            ->where('j.status', 'active')
            ->order_by('j.is_featured DESC, j.created_at DESC')
            ->limit($limit)
            ->get_all();

        return $this->attach_applicant_counts($rows ?: []);
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
                    "SELECT job_id, COUNT(*) AS c FROM applications WHERE job_id IN ({$placeholders}) GROUP BY job_id",
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
