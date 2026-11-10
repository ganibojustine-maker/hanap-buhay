<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * /api/jobs  — public job listing + employer management.
 * GET  /api/jobs          list (search, filters, pagination)
 * GET  /api/jobs/:id      single job detail
 * POST /api/jobs          create (employer/hirer only)
 * PUT  /api/jobs/:id      update (owner or admin)
 * DELETE /api/jobs/:id    soft-delete (owner or admin)
 */
class JobController extends Controller
{
    private const TOWNS = ['Baco','Bansud','Bongabong','Bulalacao','Calapan City','Gloria','Mansalay','Naujan','Pinamalayan','Pola','Puerto Galera','Roxas','San Teodoro','Socorro','Victoria'];
    private const TYPES = ['full-time','part-time','contractual','freelance','gig'];

    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->model('Job_model', 'job_model');
        $this->call->model('User_model', 'user_model');
        $this->call->model('Application_model', 'application_model');
        $this->call->helper('format');
    }

    // ---------- list / search ----------
    public function index()
    {
        $this->api->require_method('GET');
        $q       = trim((string) ($_GET['q'] ?? ''));
        $loc     = trim((string) ($_GET['location'] ?? ''));
        $type    = trim((string) ($_GET['job_type'] ?? ''));
        $limit   = min((int) ($_GET['limit'] ?? 20), 50);
        $page    = max((int) ($_GET['page'] ?? 1), 1);
        $offset  = ($page - 1) * $limit;

        $validLocation = ($loc !== '' && in_array($loc, self::TOWNS, true)) ? $loc : '';
        $validTypes    = [];
        if ($type !== '') {
            $types = array_filter(explode(',', $type));
            $validTypes = array_values(array_intersect($types, self::TYPES));
        }

        $total = $this->job_model->count_active_jobs($q, $validLocation, $validTypes);
        $rows  = $this->job_model->get_active_jobs($q, $validLocation, $validTypes, $limit, $offset);

        $this->api->respond([
            'success' => true,
            'total'   => $total,
            'page'    => $page,
            'limit'   => $limit,
            'jobs'    => array_values($rows ?: []),
        ]);
    }

    // ---------- single ----------
    public function show($id)
    {
        $this->api->require_method('GET');
        $job = $this->job_model->find_job_with_employer((int) $id);

        if (!$job) $this->api->respond_error('Job not found.', 404);

        // increment views
        $this->job_model->increment_views((int) $id);

        $this->api->respond(['success' => true, 'job' => $job]);
    }

    // ---------- create ----------
    public function create()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $user    = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);
        if (!in_array($user['account_type'], ['employer', 'hirer'], true) && $user['role'] !== 'admin') {
            $this->api->respond_error('Only employers and hirers can post jobs.', 403);
        }

        $b = $this->api->body();
        $title = trim((string) ($b['title'] ?? ''));
        if (mb_strlen($title) < 3) $this->api->respond_error('Enter a job title.', 422);
        $type = (string) ($b['job_type'] ?? 'full-time');
        if (!in_array($type, self::TYPES, true)) $this->api->respond_error('Invalid job type.', 422);
        $loc = trim((string) ($b['location'] ?? ''));
        if ($loc !== '' && !in_array($loc, self::TOWNS, true)) $this->api->respond_error('Choose a town in Oriental Mindoro.', 422);

        $job = $this->job_model->create_job([
            'employer_id'   => (int) $payload['sub'],
            'title'         => $title,
            'company'       => substr(trim((string) ($b['company'] ?? '')), 0, 255) ?: null,
            'description'   => substr(trim((string) ($b['description'] ?? '')), 0, 10000) ?: null,
            'requirements'  => substr(trim((string) ($b['requirements'] ?? '')), 0, 5000) ?: null,
            'location'      => $loc ?: null,
            'job_type'      => $type,
            'salary_min'    => is_numeric($b['salary_min'] ?? '') ? (float) $b['salary_min'] : null,
            'salary_max'    => is_numeric($b['salary_max'] ?? '') ? (float) $b['salary_max'] : null,
            'skills_needed' => substr(trim((string) ($b['skills_needed'] ?? '')), 0, 2000) ?: null,
            'status'        => 'active',
        ]);

        // Send Job Posting Confirmation Email & Notification to the logged-in Employer
        try {
            $company_str = !empty($job['company']) ? " ({$job['company']})" : '';
            $loc_str = !empty($job['location']) ? " in {$job['location']}" : ' in Oriental Mindoro';
            $salary_str = '';
            if (!empty($job['salary_min']) && !empty($job['salary_max'])) {
                $salary_str = "\nOffered Salary: ₱" . number_format($job['salary_min']) . " - ₱" . number_format($job['salary_max']);
            } elseif (!empty($job['salary_min'])) {
                $salary_str = "\nOffered Salary: ₱" . number_format($job['salary_min']);
            }

            $employer_name = $user['full_name'] ?: 'Employer';
            $this->application_model->create_notification(
                (int) $user['id'],
                'job_posted',
                "Job Posted Successfully: {$job['title']}",
                "Mabuhay {$employer_name}! Matagumpay na nai-post ang iyong trabaho na \"{$job['title']}\"{$company_str}{$loc_str} sa HanapBuhay Oriental Mindoro.{$salary_str}\n\nAktibo na ang listing at makikita na ito ng mga kwalipikadong aplikante sa Mindoro. Makakatanggap ka ng email notification sa bawat bagong aplikasyong matatanggap.",
                "/dashboard/jobs"
            );
        } catch (\Throwable $e) {
            error_log('[Job Post Confirmation Email Error] ' . $e->getMessage());
        }

        // Send Job Match alerts to workers who have job alerts enabled
        try {
            $workers = $this->db->table('users')
                ->where('account_type', 'worker')
                ->where('is_active', 1)
                ->limit(50)
                ->get_all();

            foreach ($workers ?: [] as $w) {
                $prefs = !empty($w['notification_prefs']) ? (is_array($w['notification_prefs']) ? $w['notification_prefs'] : json_decode((string)$w['notification_prefs'], true)) : ['job_alerts' => true, 'email' => true];
                if (isset($prefs['job_alerts']) && !$prefs['job_alerts']) {
                    continue;
                }

                $loc_match = !empty($job['location']) && !empty($w['location']) && (strtolower($job['location']) === strtolower($w['location']));
                if ($loc_match || empty($job['location'])) {
                    $this->application_model->create_notification(
                        (int) $w['id'],
                        'job_match',
                        "New Job Match: {$job['title']}",
                        ($job['company'] ? "{$job['company']} posted " : "A new job was posted: ") . "{$job['title']} in " . ($job['location'] ?: 'Oriental Mindoro') . ".",
                        "/jobs/{$job['id']}"
                    );
                }
            }
        } catch (\Throwable $e) {
            error_log('[Job Match Alert Error] ' . $e->getMessage());
        }

        $this->api->respond([
            'success' => true,
            'job'     => $job,
            '_debug'  => [
                'message'      => 'Job created successfully ✅',
                'job_id'       => $job['id'] ?? null,
                'posted_by'    => [
                    'user_id'      => $user['id'],
                    'full_name'    => $user['full_name'],
                    'account_type' => $user['account_type'],
                ],
                'received_body' => $b,
                'saved_data'    => [
                    'title'         => $job['title'] ?? null,
                    'company'       => $job['company'] ?? null,
                    'location'      => $job['location'] ?? null,
                    'job_type'      => $job['job_type'] ?? null,
                    'salary_min'    => $job['salary_min'] ?? null,
                    'salary_max'    => $job['salary_max'] ?? null,
                    'skills_needed' => $job['skills_needed'] ?? null,
                    'status'        => $job['status'] ?? null,
                    'created_at'    => $job['created_at'] ?? null,
                ],
                'server_time'  => date('Y-m-d H:i:s'),
            ],
        ], 201);
    }

    // ---------- update ----------
    public function update($id)
    {
        $this->api->require_method('PUT');
        $payload = $this->api->require_jwt();
        $job = $this->job_model->find_by_id((int) $id);
        if (!$job) $this->api->respond_error('Job not found.', 404);

        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);
        if ((int) $job['employer_id'] !== (int) $payload['sub'] && $user['role'] !== 'admin') {
            $this->api->respond_error('Forbidden', 403);
        }

        $b = $this->api->body();
        $data = [];
        foreach (['title','company','description','requirements','location','job_type','salary_min','salary_max','skills_needed','status'] as $f) {
            if (array_key_exists($f, $b)) $data[$f] = $b[$f] ?? null;
        }
        if (empty($data)) $this->api->respond_error('No fields to update.', 422);

        $this->job_model->update_job((int) $id, $data);
        $this->api->respond(['success' => true, 'job' => $this->job_model->find_by_id((int) $id)]);
    }

    // ---------- delete (soft) ----------
    public function destroy($id)
    {
        $this->api->require_method('DELETE');
        $payload = $this->api->require_jwt();
        $job = $this->job_model->find_by_id((int) $id);
        if (!$job) $this->api->respond_error('Job not found.', 404);

        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);
        if ((int) $job['employer_id'] !== (int) $payload['sub'] && $user['role'] !== 'admin') {
            $this->api->respond_error('Forbidden', 403);
        }

        $this->job_model->archive_job((int) $id);
        $this->api->respond(['success' => true]);
    }

    // ---------- my jobs (employer) ----------
    public function my_jobs()
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $rows = $this->job_model->get_employer_jobs((int) $payload['sub']);
        $this->api->respond(['success' => true, 'jobs' => $rows ?: []]);
    }

    // ---------- featured / home ----------
    public function featured()
    {
        $this->api->require_method('GET');
        $rows = $this->job_model->get_featured_jobs(8);
        $this->api->respond(['success' => true, 'jobs' => $rows ?: []]);
    }
}
