<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Two-way star ratings between the two sides of a completed hire.
 *   employer_reviews (migration 017)  the worker rates the employer / client who hired them
 *   worker_reviews   (migration 018)  the employer / client rates the worker they hired
 * Both need a hired application, one review per application, editable afterwards.
 *
 *   POST  /api/reviews                    { application_id, rating 1-5, comment }  worker rates the employer
 *   POST  /api/reviews/worker             { application_id, rating 1-5, comment }  employer rates the worker
 *   GET   /api/reviews/pending            who I can rate right now, both directions
 *   GET   /api/employers/{id}/reviews     public: average, stars, latest reviews
 *   GET   /api/workers/{id}/reviews       public: the same, about a worker
 *   GET   /api/admin/reviews?filter=&type= admin: latest reviews to moderate (all | hidden | low)
 *   PATCH /api/admin/reviews/{id}?type=   admin: { hidden: bool }
 */
class ReviewController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->library('schema_info');
        $this->call->model('User_model', 'user_model');
        $this->call->model('Application_model', 'application_model');
    }

    private function enabled(): bool
    {
        return $this->schema_info->has_table('employer_reviews');
    }

    /** The worker side arrives with migration 018; everything degrades quietly without it. */
    private function worker_enabled(): bool
    {
        return $this->schema_info->has_table('worker_reviews');
    }

    /** ['employer_reviews', 'employer_id'] or ['worker_reviews', 'worker_id'] */
    private function table_for(string $about): array
    {
        return $about === 'worker' ? ['worker_reviews', 'worker_id'] : ['employer_reviews', 'employer_id'];
    }

    /** "Maria Santos" → "Maria S." (reviews are public: no full names) */
    private function short_name(?string $name): string
    {
        $parts = preg_split('/\s+/', trim((string) $name)) ?: [];
        if (!$parts || $parts[0] === '' || $name === 'Deleted User') return 'A worker';
        $last = count($parts) > 1 ? ' ' . mb_strtoupper(mb_substr(end($parts), 0, 1)) . '.' : '';
        return $parts[0] . $last;
    }

    public function save()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $uid = (int) $payload['sub'];
        if (!$this->enabled()) $this->api->respond_error('Reviews are not switched on yet. Please try again later.', 503);
        $this->api->rate_limit('review_' . $uid, 20, 3600);

        $b = $this->api->body();
        $appId = (int) ($b['application_id'] ?? 0);
        $rating = (int) ($b['rating'] ?? 0);
        if ($rating < 1 || $rating > 5) $this->api->respond_error('Choose from 1 to 5 stars.', 422);
        $comment = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string) ($b['comment'] ?? '')));
        $comment = $comment === '' ? null : mb_substr($comment, 0, 1000);

        $app = $this->application_model->find_by_id($appId);
        if (!$app || (int) $app['worker_id'] !== $uid) $this->api->respond_error('Application not found.', 404);
        if ($app['status'] !== 'hired') $this->api->respond_error('You can rate an employer once they have hired you.', 409);
        $job = $this->db->table('jobs')->where('id', (int) $app['job_id'])->get();
        if (!$job) $this->api->respond_error('This job no longer exists.', 404);

        $now = date('Y-m-d H:i:s');
        $existing = $this->db->table('employer_reviews')->where('application_id', $appId)->get();
        if ($existing) {
            $this->db->table('employer_reviews')->where('id', (int) $existing['id'])->update(['rating' => $rating, 'comment' => $comment, 'updated_at' => $now]);
        } else {
            $this->db->table('employer_reviews')->insert([
                'application_id' => $appId, 'employer_id' => (int) $job['employer_id'], 'worker_id' => $uid,
                'job_id' => (int) $job['id'], 'rating' => $rating, 'comment' => $comment, 'created_at' => $now,
            ]);
            $worker = $this->user_model->find_by_id($uid);
            $this->application_model->create_notification(
                (int) $job['employer_id'],
                'review',
                "New review: {$rating} of 5 stars",
                $this->short_name($worker['full_name'] ?? '') . " rated working with you {$rating} out of 5 for \"{$job['title']}\"."
                    . ($comment ? "\n\n\"" . mb_substr($comment, 0, 300) . '"' : '')
                    . "\n\nReviews from workers you hired appear on your job posts.",
                "/jobs/{$job['id']}",
                false
            );
        }
        $this->api->respond(['success' => true, 'review' => ['rating' => $rating, 'comment' => $comment]], $existing ? 200 : 201);
    }

    public function employer($id)
    {
        $this->public_reviews('employer', (int) $id);
    }

    // GET /api/workers/{id}/reviews — what employers said about this worker
    public function worker($id)
    {
        $this->public_reviews('worker', (int) $id);
    }

    /** Average, stars and the latest comments about one account. */
    private function public_reviews(string $about, int $uid): void
    {
        $this->api->require_method('GET');
        $empty = ['success' => true, 'enabled' => false, 'summary' => ['count' => 0, 'average' => null, 'stars' => [5 => 0, 4 => 0, 3 => 0, 2 => 0, 1 => 0]], 'reviews' => []];
        [$table, $col] = $this->table_for($about);
        if ($about === 'worker' ? !$this->worker_enabled() : !$this->enabled()) $this->api->respond($empty);
        $this->api->rate_limit('reviews_' . $this->api->client_ip(), 120, 600);
        $authorCol = $about === 'worker' ? 'employer_id' : 'worker_id';

        $stars = [5 => 0, 4 => 0, 3 => 0, 2 => 0, 1 => 0];
        foreach ($this->db->raw("SELECT rating, COUNT(*) AS n FROM {$table} WHERE {$col} = ? AND is_hidden = 0 GROUP BY rating", [$uid])->fetchAll(\PDO::FETCH_ASSOC) ?: [] as $r) {
            $stars[(int) $r['rating']] = (int) $r['n'];
        }
        $count = array_sum($stars);
        $avg = $count ? round(array_sum(array_map(fn($s, $n) => $s * $n, array_keys($stars), $stars)) / $count, 1) : null;

        $rows = $this->db->raw(
            "SELECT r.rating, r.comment, r.created_at, u.full_name, j.title AS job_title
             FROM {$table} r LEFT JOIN users u ON u.id = r.{$authorCol} LEFT JOIN jobs j ON j.id = r.job_id
             WHERE r.{$col} = ? AND r.is_hidden = 0 ORDER BY r.created_at DESC LIMIT 20",
            [$uid]
        )->fetchAll(\PDO::FETCH_ASSOC) ?: [];
        $reviews = array_map(fn($r) => [
            'rating' => (int) $r['rating'], 'comment' => $r['comment'], 'created_at' => $r['created_at'],
            'by' => $this->short_name($r['full_name']), 'job_title' => $r['job_title'],
        ], $rows);

        $this->api->respond(['success' => true, 'enabled' => true, 'about' => $about, 'summary' => ['count' => $count, 'average' => $avg, 'stars' => $stars], 'reviews' => $reviews]);
    }

    /**
     * POST /api/reviews/worker — the employer or client rates the worker they hired.
     * Mirror of save(): same rules, opposite direction.
     */
    public function save_worker()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $uid = (int) $payload['sub'];
        if (!$this->worker_enabled()) $this->api->respond_error('Worker ratings are not switched on yet. Please try again later.', 503);
        $this->api->rate_limit('review_w_' . $uid, 30, 3600);

        $b = $this->api->body();
        $appId = (int) ($b['application_id'] ?? 0);
        $rating = (int) ($b['rating'] ?? 0);
        if ($rating < 1 || $rating > 5) $this->api->respond_error('Choose from 1 to 5 stars.', 422);
        $comment = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string) ($b['comment'] ?? '')));
        $comment = $comment === '' ? null : mb_substr($comment, 0, 1000);

        $app = $this->application_model->find_by_id($appId);
        if (!$app) $this->api->respond_error('Application not found.', 404);
        $job = $this->db->table('jobs')->where('id', (int) $app['job_id'])->get();
        if (!$job || (int) $job['employer_id'] !== $uid) $this->api->respond_error('Application not found.', 404);
        if ($app['status'] !== 'hired') $this->api->respond_error('You can rate a worker once you have hired them.', 409);

        $now = date('Y-m-d H:i:s');
        $workerId = (int) $app['worker_id'];
        $existing = $this->db->table('worker_reviews')->where('application_id', $appId)->get();
        if ($existing) {
            $this->db->table('worker_reviews')->where('id', (int) $existing['id'])->update(['rating' => $rating, 'comment' => $comment, 'updated_at' => $now]);
        } else {
            $this->db->table('worker_reviews')->insert([
                'application_id' => $appId, 'employer_id' => $uid, 'worker_id' => $workerId,
                'job_id' => (int) $job['id'], 'rating' => $rating, 'comment' => $comment, 'created_at' => $now,
            ]);
            $employer = $this->user_model->find_by_id($uid);
            $who = $job['company'] ?: ($employer['full_name'] ?? 'An employer');
            $this->application_model->create_notification(
                $workerId,
                'review',
                "New rating: {$rating} of 5 stars",
                "{$who} rated your work {$rating} out of 5 for \"{$job['title']}\"."
                    . ($comment ? "\n\n\"" . mb_substr($comment, 0, 300) . '"' : '')
                    . "\n\nRatings from employers who hired you show on your public profile and next to your applications.",
                '/dashboard/profile',
                false
            );
        }
        $this->api->respond(['success' => true, 'review' => ['rating' => $rating, 'comment' => $comment]], $existing ? 200 : 201);
    }

    /**
     * GET /api/reviews/pending — the hires this account can still rate, and the ones it
     * already rated (so the page shows "edit" instead of "rate").
     */
    public function pending()
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $uid = (int) $payload['sub'];
        $me = $this->user_model->find_by_id($uid);
        if (!$me) $this->api->respond_error('Unauthorized', 401);
        $isWorker = ($me['account_type'] ?? '') === 'worker';

        $items = [];
        if ($isWorker && $this->enabled()) {
            $rows = $this->db->raw(
                "SELECT a.id AS application_id, a.updated_at, j.id AS job_id, j.title AS job_title, j.company,
                        j.employer_id AS other_id, u.full_name AS other_name, u.picture AS other_picture,
                        r.rating, r.comment
                 FROM applications a
                 JOIN jobs j ON j.id = a.job_id
                 LEFT JOIN users u ON u.id = j.employer_id
                 LEFT JOIN employer_reviews r ON r.application_id = a.id
                 WHERE a.worker_id = ? AND a.status = 'hired'
                 ORDER BY a.updated_at DESC LIMIT 50", [$uid]
            )->fetchAll(\PDO::FETCH_ASSOC) ?: [];
            foreach ($rows as $r) $items[] = $r + ['direction' => 'employer'];
        } elseif (!$isWorker && $this->worker_enabled()) {
            $rows = $this->db->raw(
                "SELECT a.id AS application_id, a.updated_at, j.id AS job_id, j.title AS job_title, j.company,
                        a.worker_id AS other_id, u.full_name AS other_name, u.picture AS other_picture,
                        r.rating, r.comment
                 FROM applications a
                 JOIN jobs j ON j.id = a.job_id
                 LEFT JOIN users u ON u.id = a.worker_id
                 LEFT JOIN worker_reviews r ON r.application_id = a.id
                 WHERE j.employer_id = ? AND a.status = 'hired'
                 ORDER BY a.updated_at DESC LIMIT 50", [$uid]
            )->fetchAll(\PDO::FETCH_ASSOC) ?: [];
            foreach ($rows as $r) $items[] = $r + ['direction' => 'worker'];
        }

        foreach ($items as &$i) {
            $i['application_id'] = (int) $i['application_id'];
            $i['other_id'] = (int) $i['other_id'];
            $i['rating'] = $i['rating'] !== null ? (int) $i['rating'] : null;
        }
        unset($i);

        $this->api->respond([
            'success' => true,
            'enabled' => $isWorker ? $this->enabled() : $this->worker_enabled(),
            'rate'    => $isWorker ? 'employer' : 'worker',
            'items'   => array_values($items),
            'to_rate' => count(array_filter($items, fn($i) => $i['rating'] === null)),
        ]);
    }

    private function require_admin(): void
    {
        $payload = $this->api->require_jwt();
        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user || $user['role'] !== 'admin') $this->api->respond_error('Admin only.', 403);
    }

    public function admin_index()
    {
        $this->api->require_method('GET');
        $this->require_admin();
        $about = ($_GET['type'] ?? '') === 'worker' ? 'worker' : 'employer';
        $on = $about === 'worker' ? $this->worker_enabled() : $this->enabled();
        if (!$on) $this->api->respond(['success' => true, 'enabled' => false, 'about' => $about, 'reviews' => []]);
        [$table] = $this->table_for($about);
        $filter = (string) ($_GET['filter'] ?? 'all');
        $where = $filter === 'hidden' ? 'WHERE r.is_hidden = 1' : ($filter === 'low' ? 'WHERE r.rating <= 2' : '');
        $rows = $this->db->raw(
            "SELECT r.id, r.rating, r.comment, r.is_hidden, r.created_at, r.updated_at, r.employer_id, r.worker_id, r.job_id,
                    w.full_name AS worker_name, e.full_name AS employer_name, j.title AS job_title, j.company
             FROM {$table} r
             LEFT JOIN users w ON w.id = r.worker_id LEFT JOIN users e ON e.id = r.employer_id LEFT JOIN jobs j ON j.id = r.job_id
             {$where} ORDER BY r.created_at DESC LIMIT 100"
        )->fetchAll(\PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) { $r['rating'] = (int) $r['rating']; $r['is_hidden'] = (int) $r['is_hidden'] === 1; $r['about'] = $about; }
        unset($r);
        $this->api->respond(['success' => true, 'enabled' => true, 'about' => $about, 'reviews' => $rows]);
    }

    public function admin_update($id)
    {
        $this->api->require_method('PATCH');
        $this->require_admin();
        $b = $this->api->body();
        $about = (($_GET['type'] ?? $b['type'] ?? '') === 'worker') ? 'worker' : 'employer';
        $on = $about === 'worker' ? $this->worker_enabled() : $this->enabled();
        if (!$on) $this->api->respond_error('Reviews are not switched on yet.', 503);
        [$table] = $this->table_for($about);
        $row = $this->db->table($table)->where('id', (int) $id)->get();
        if (!$row) $this->api->respond_error('Review not found.', 404);
        $hidden = !empty($b['hidden']) ? 1 : 0;
        $this->db->table($table)->where('id', (int) $id)->update(['is_hidden' => $hidden]);
        $this->api->respond(['success' => true, 'id' => (int) $id, 'is_hidden' => (bool) $hidden]);
    }
}
