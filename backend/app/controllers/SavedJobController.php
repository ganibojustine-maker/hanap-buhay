<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Bookmarked jobs, stored per account (table saved_jobs).
 *   GET    /api/saved-jobs            ids saved by the signed-in user
 *   POST   /api/saved-jobs            { job_id }   save one job
 *   POST   /api/saved-jobs/sync       { job_ids }  import bookmarks made before accounts stored them
 *   DELETE /api/saved-jobs/{id}       remove one
 */
class SavedJobController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->library('schema_info');
    }

    /**
     * The saved_jobs table comes from migration 014. Until it has been run, a query on it
     * makes the framework print an HTML error page (the app only saw "Something went wrong"),
     * so check first and answer in JSON.
     */
    private function ready(): bool
    {
        return $this->schema_info->has_table('saved_jobs');
    }

    private function require_ready(): void
    {
        if (!$this->ready()) $this->api->respond_error('Saving jobs is not switched on yet. Please try again later.', 503);
    }

    public function index()
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $uid = (int) $payload['sub'];
        // bookmark buttons and the Saved Jobs page show "almost ready" instead of an error
        if (!$this->ready()) $this->api->respond(['success' => true, 'setup_needed' => true, 'job_ids' => [], 'jobs' => []]);
        $ids = $this->db->raw('SELECT job_id FROM saved_jobs WHERE user_id = ? ORDER BY created_at DESC', [$uid])
            ->fetchAll(\PDO::FETCH_COLUMN);
        if (empty($_GET['full'])) $this->api->respond(['success' => true, 'job_ids' => array_map('intval', $ids)]);

        // ?full=1 — the Saved Jobs page: each job with whether it still takes applications,
        // the worker's application status, and (for workers) the match score
        $rows = $this->db->raw(
            "SELECT j.id, j.title, j.company, j.location, j.job_type, j.salary_min, j.salary_max, j.status, j.skills_needed,
                    j.created_at, j.employer_id, u.full_name AS employer_name, u.is_verified AS employer_verified,
                    s.created_at AS saved_at, a.status AS application_status
             FROM saved_jobs s
             JOIN jobs j ON j.id = s.job_id
             LEFT JOIN users u ON u.id = j.employer_id
             LEFT JOIN applications a ON a.job_id = j.id AND a.worker_id = s.user_id AND a.status <> 'withdrawn'
             WHERE s.user_id = ?
             ORDER BY s.created_at DESC LIMIT 200",
            [$uid]
        )->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        $this->call->model('User_model', 'user_model');
        $me = $this->user_model->find_by_id($uid);
        $scorer = null;
        if ($me && $me['account_type'] === 'worker' && $rows) {
            $this->call->model('Skill_model', 'skill_model');
            $this->call->library('job_matcher');
            $skills = $this->skill_model->get_skills_for_matching($uid);
            $scorer = fn($j) => $this->job_matcher->score($me, $skills, $j)['score'];
        }
        $jobs = array_map(function ($j) use ($scorer) {
            $j['id'] = (int) $j['id'];
            $j['is_open'] = $j['status'] === 'active';
            $j['match_score'] = $scorer && $j['is_open'] ? $scorer($j) : null;
            unset($j['skills_needed']);
            return $j;
        }, $rows);
        $this->api->respond(['success' => true, 'job_ids' => array_map('intval', $ids), 'jobs' => $jobs]);
    }

    public function save()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $uid = (int) $payload['sub'];
        $this->require_ready();
        $this->api->rate_limit('save_job_' . $uid, 120, 600);

        $b = $this->api->body();
        $jobId = (int) ($b['job_id'] ?? 0);
        if ($jobId <= 0) $this->api->respond_error('Job ID is required.', 422);

        $job = $this->db->table('jobs')->where('id', $jobId)->get();
        if (!$job || $job['status'] === 'archived') $this->api->respond_error('Job not found.', 404);

        $this->db->raw('INSERT IGNORE INTO saved_jobs (user_id, job_id, created_at) VALUES (?, ?, NOW())', [$uid, $jobId]);
        $this->api->respond(['success' => true, 'job_id' => $jobId, 'saved' => true]);
    }

    public function sync()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $uid = (int) $payload['sub'];
        $this->require_ready();
        $this->api->rate_limit('sync_job_' . $uid, 10, 600);

        $b = $this->api->body();
        $ids = array_slice(array_values(array_unique(array_filter(array_map('intval', (array) ($b['job_ids'] ?? []))))), 0, 100);
        $imported = 0;
        foreach ($ids as $jobId) {
            $job = $this->db->table('jobs')->where('id', $jobId)->get();
            if (!$job || $job['status'] === 'archived') continue;
            $this->db->raw('INSERT IGNORE INTO saved_jobs (user_id, job_id, created_at) VALUES (?, ?, NOW())', [$uid, $jobId]);
            $imported++;
        }
        $this->api->respond(['success' => true, 'imported' => $imported]);
    }

    public function unsave($id)
    {
        $this->api->require_method('DELETE');
        $payload = $this->api->require_jwt();
        $this->require_ready();
        $this->db->raw('DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?', [(int) $payload['sub'], (int) $id]);
        $this->api->respond(['success' => true, 'job_id' => (int) $id, 'saved' => false]);
    }
}
