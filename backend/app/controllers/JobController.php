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
        $this->call->model('Subscription_model', 'subscription_model');
        $this->call->library('schema_info');
        $this->call->helper('format');
        require_once APP_DIR . 'libraries' . DIRECTORY_SEPARATOR . 'Job_matcher.php';
    }

    /**
     * The signed-in user, when there is one. Public endpoints use this to add a match
     * score and a saved-state to each job without forcing anyone to sign in.
     */
    private function viewer(): ?array
    {
        $token = $this->api->get_bearer_token();
        if (!$token) return null;
        $payload = $this->api->validate_jwt($token);
        if (!$payload) return null;
        $u = $this->user_model->find_by_id((int) $payload['sub']);
        return $u && (int) ($u['is_active'] ?? 1) === 1 ? $u : null;
    }

    /**
     * Score a list of jobs for one worker with the same Job_matcher the Job Matches page,
     * the employer's applicant list and the saved match score all use, so one worker and
     * one job always produce the same number wherever it is shown.
     *
     * Also marks which jobs they already applied to and which they bookmarked.
     */
    private function decorate_for_worker(array $jobs, ?array $user): array
    {
        if (!$user || ($user['account_type'] ?? '') !== 'worker' || !$jobs) return $jobs;
        $uid = (int) $user['id'];

        $this->call->model('Skill_model', 'skill_model');
        $this->call->library('job_matcher');
        $skills = $this->skill_model->get_skills_for_matching($uid);

        $applied = [];
        foreach ($this->db->raw("SELECT job_id FROM applications WHERE worker_id = ? AND status <> 'withdrawn'", [$uid])->fetchAll(PDO::FETCH_COLUMN) ?: [] as $jid) {
            $applied[(int) $jid] = true;
        }
        $saved = [];
        $this->call->library('schema_info');
        if ($this->schema_info->has_table('saved_jobs')) {
            foreach ($this->db->raw('SELECT job_id FROM saved_jobs WHERE user_id = ?', [$uid])->fetchAll(PDO::FETCH_COLUMN) ?: [] as $jid) {
                $saved[(int) $jid] = true;
            }
        }

        foreach ($jobs as &$j) {
            $m = $this->job_matcher->score($user, $skills, $j);
            $j['match'] = $m;
            $j['match_pct'] = $m['score'];
            $j['applied'] = isset($applied[(int) $j['id']]);
            $j['saved'] = isset($saved[(int) $j['id']]);
        }
        unset($j);
        return $jobs;
    }

    // ---------- list / search ----------
    public function index()
    {
        $this->api->require_method('GET');
        $this->job_model->expire_featured();
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

        $sort = in_array($_GET['sort'] ?? '', ['relevant', 'recent', 'salary', 'pay_low', 'match'], true) ? $_GET['sort'] : 'relevant';
        $more = [
            'post_type' => in_array($_GET['post_type'] ?? '', ['job', 'gig'], true) ? $_GET['post_type'] : '',
            'category'  => isset(Job_model::CATEGORIES[$_GET['category'] ?? '']) ? $_GET['category'] : '',
        ];

        $total = $this->job_model->count_active_jobs($q, $validLocation, $validTypes, $more);
        // "match" is worked out here, after scoring, so the database still sorts by newest
        $rows  = $this->job_model->get_active_jobs($q, $validLocation, $validTypes, $limit, $offset, $sort === 'match' ? 'relevant' : $sort, true, $more);

        $user = $this->viewer();
        if (!$user) $rows = array_map([$this, 'public_fields'], $rows ?: []);
        $rows = $this->decorate_for_worker(array_values($rows ?: []), $user);

        // Without an explicit sort, a signed-in worker gets the jobs that fit them first:
        // this is the same ranking as Job Matches, so the two pages agree.
        $isWorker = $user && ($user['account_type'] ?? '') === 'worker';
        if ($isWorker && ($sort === 'match' || $sort === 'relevant')) {
            usort($rows, fn($a, $b) => [(int) ($b['is_featured'] ?? 0) && $sort === 'relevant', $b['match_pct'] ?? 0, $b['created_at']]
                                   <=> [(int) ($a['is_featured'] ?? 0) && $sort === 'relevant', $a['match_pct'] ?? 0, $a['created_at']]);
        }

        $this->api->respond([
            'success'  => true,
            'categories' => Job_model::CATEGORIES,
            'total'    => $total,
            'page'     => $page,
            'limit'    => $limit,
            'sort'     => $sort,
            'scored'   => $isWorker,
            'my_town'  => $user['location'] ?? null,
            'jobs'     => $rows,
        ]);
    }

    /** Max alert emails per new job (Brevo free plan: 300 emails a day for the whole site). */
    private const ALERT_EMAIL_CAP = 50;

    /**
     * Tell workers about a new job when it fits the alert settings they chose in Settings:
     * towns (default: their own town), job types, minimum monthly pay, and optionally only
     * jobs that match their skills. In-app always; email only if they asked for it.
     */
    private function send_job_alerts(array $job): void
    {
        try {
            $this->call->model('Skill_model', 'skill_model');
            $this->call->library('job_matcher');
            $jobTown = $this->job_matcher->town($job['location'] ?? null);
            $pay = (float) ($job['salary_max'] ?: $job['salary_min'] ?: 0);
            $emails = 0;

            $workers = $this->db->raw(
                "SELECT id, full_name, email, location, is_verified, notification_prefs FROM users
                 WHERE account_type = 'worker' AND is_active = 1 AND role <> 'admin' LIMIT 5000"
            )->fetchAll(PDO::FETCH_ASSOC) ?: [];

            foreach ($workers as $w) {
                $p = json_decode((string) ($w['notification_prefs'] ?? ''), true);
                if (!is_array($p)) $p = [];
                if (array_key_exists('job_alerts', $p) && !$p['job_alerts']) continue;

                $towns = array_values(array_filter((array) ($p['alert_towns'] ?? [])));
                if (!$towns && !empty($w['location'])) $towns = [$w['location']];
                if ($jobTown && $towns && !in_array($jobTown, $towns, true)) continue;

                $types = (array) ($p['alert_types'] ?? []);
                if ($types && !in_array($job['job_type'], $types, true)) continue;

                $min = (float) ($p['alert_min_salary'] ?? 0);
                if ($min > 0 && $pay > 0 && $pay < $min) continue; // jobs without a posted salary still alert

                if (!empty($p['alert_skills_only'])) {
                    $m = $this->job_matcher->score($w, $this->skill_model->get_skills_for_matching((int) $w['id']), $job);
                    if ($this->job_matcher->needs($job['skills_needed'] ?? '') && !$m['matched']) continue;
                }

                $wantsEmail = !empty($p['alert_email']) && ($p['email'] ?? true) !== false && $emails < self::ALERT_EMAIL_CAP;
                if ($wantsEmail) $emails++;
                $this->application_model->create_notification(
                    (int) $w['id'],
                    'job_match',
                    "New Job Match: {$job['title']}",
                    ($job['company'] ? "{$job['company']} posted " : 'A new job was posted: ') . "{$job['title']} in " . ($job['location'] ?: 'Oriental Mindoro') . '.',
                    "/jobs/{$job['id']}",
                    $wantsEmail
                );
            }
        } catch (\Throwable $e) {
            error_log('[Job Match Alert Error] ' . $e->getMessage());
        }
    }

    // ---------- matches for the signed-in worker ----------
    // GET /api/jobs/matches — every active job scored with Job_matcher, plus the skill gaps
    // of the best-fitting jobs (what they ask for that the worker doesn't have yet)
    public function matches()
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $uid = (int) $payload['sub'];
        $user = $this->user_model->find_by_id($uid);
        if (!$user) $this->api->respond_error('Unauthorized', 401);
        if ($user['account_type'] !== 'worker') $this->api->respond_error('Job matches are for workers.', 403);

        $this->call->model('Skill_model', 'skill_model');
        $this->call->library('job_matcher');
        $skills = $this->skill_model->get_skills_for_matching($uid);
        $jobs = $this->job_model->get_active_jobs('', '', [], 300, 0, 'relevant', true) ?: [];

        // scores, applied and saved state in one pass (same helper as the public job list)
        $out = $this->decorate_for_worker(array_values($jobs), $user);

        // Best fit first. A featured post only wins against a job with the same score,
        // so paid promotion never pushes a poor match above a good one.
        usort($out, fn($a, $b) => [$b['match']['score'], (int) ($b['is_featured'] ?? 0), $b['created_at']]
                              <=> [$a['match']['score'], (int) ($a['is_featured'] ?? 0), $a['created_at']]);

        // gaps: what the best-fitting jobs still ask for, most requested first. Only jobs where
        // the worker already has at least one of the skills count (they are "almost qualified");
        // with too few of those (e.g. no skills yet) the 20 best jobs overall are used instead.
        $close = array_values(array_filter($out, fn($j) => $j['match']['matched']));
        $source = count($close) >= 3 ? array_slice($close, 0, 20) : array_slice($out, 0, 20);
        $gaps = [];
        foreach ($source as $j) {
            foreach ($j['match']['missing'] as $need) {
                $k = mb_strtolower($need);
                $gaps[$k] ??= ['skill' => $need, 'jobs' => 0, 'job_titles' => []];
                $gaps[$k]['jobs']++;
                // different posts can share a title: list each title once
                if (count($gaps[$k]['job_titles']) < 3 && !in_array($j['title'], $gaps[$k]['job_titles'], true)) $gaps[$k]['job_titles'][] = $j['title'];
            }
        }
        usort($gaps, fn($a, $b) => $b['jobs'] <=> $a['jobs']);

        $this->api->respond([
            'success' => true,
            'jobs'    => array_slice($out, 0, 100),
            'gaps'    => array_slice(array_values($gaps), 0, 20), // the page shows TESDA-learnable ones first
            'summary' => [
                'total'  => count($out),
                'strong' => count(array_filter($out, fn($j) => $j['match']['score'] >= 70)),
                'good'   => count(array_filter($out, fn($j) => $j['match']['score'] >= 50)),
                'nearby' => count(array_filter($out, fn($j) => $j['match']['distance_km'] !== null && $j['match']['distance_km'] <= 30)),
                'skills' => count($skills),
                'town'   => $user['location'] ?: null,
                'applied'=> count(array_filter($out, fn($j) => !empty($j['applied']))),
            ],
        ]);
    }

    // ---------- single ----------
    public function show($id)
    {
        $this->api->require_method('GET');
        $job = $this->job_model->find_job_with_employer((int) $id);

        if (!$job) $this->api->respond_error('We could not find that post. It may have been removed.', 404);
        $viewer = $this->viewer();
        $isOwner = $viewer && ((int) $viewer['id'] === (int) $job['employer_id'] || ($viewer['role'] ?? '') === 'admin');
        if (($job['moderation_status'] ?? 'approved') !== 'approved' && !$isOwner) {
            $this->api->respond_error('This post is not available.', 404);
        }
        $job['is_open'] = $job['status'] === 'active' && (empty($job['expires_at']) || strtotime((string) $job['expires_at']) > time());
        if (!$viewer) $job = $this->public_fields($job);

        // increment views
        $this->job_model->increment_views((int) $id);

        // star rating from workers this employer hired (migration 017), shown next to the company
        $this->call->library('schema_info');
        if ($this->schema_info->has_table('employer_reviews')) {
            $r = $this->db->raw('SELECT COUNT(*) AS n, AVG(rating) AS avg FROM employer_reviews WHERE employer_id = ? AND is_hidden = 0', [(int) $job['employer_id']])->fetch(PDO::FETCH_ASSOC);
            $job['employer_rating'] = ['count' => (int) ($r['n'] ?? 0), 'average' => !empty($r['n']) ? round((float) $r['avg'], 1) : null];
        }
        $job['applicants'] = (int) $this->db->raw("SELECT COUNT(*) FROM applications WHERE job_id = ? AND status <> 'withdrawn'", [(int) $id])->fetchColumn();

        // The match analysis: the same server-side score the employer sees on the
        // application, with every required skill marked as held or missing.
        $user = $this->viewer();
        $one = $this->decorate_for_worker([$job], $user);
        $job = $one[0];

        // open jobs like this one, nearest first — shown under the posting
        $job['similar'] = $this->similar_jobs($job, $user);

        $this->api->respond(['success' => true, 'job' => $job]);
    }

    /** Up to 4 other open jobs with the same kind of work, the worker's town first. */
    private function similar_jobs(array $job, ?array $user): array
    {
        $words = array_values(array_filter(preg_split('/[\s,;\/]+/', mb_strtolower((string) $job['title'])), fn($w) => mb_strlen($w) >= 4));
        $town = (string) ($user['location'] ?? $job['location'] ?? '');

        $where = "j.status = 'active' AND j.id <> ?";
        $args = [(int) $job['id']];
        if ($words) {
            $like = [];
            foreach (array_slice($words, 0, 3) as $w) {
                $like[] = '(j.title LIKE ? OR j.skills_needed LIKE ?)';
                $args[] = '%' . addcslashes($w, '%_\\') . '%';
                $args[] = '%' . addcslashes($w, '%_\\') . '%';
            }
            $where .= ' AND (' . implode(' OR ', $like) . ' OR j.job_type = ?)';
            $args[] = (string) $job['job_type'];
        }
        $order = 'j.created_at DESC';
        if ($town !== '') { $order = 'CASE WHEN j.location = ? THEN 0 ELSE 1 END, j.is_featured DESC, j.created_at DESC'; $args[] = $town; }

        $rows = $this->db->raw(
            "SELECT j.id, j.title, j.company, j.location, j.job_type, j.salary_min, j.salary_max, j.skills_needed, j.created_at,
                    u.full_name AS employer_name, u.picture AS employer_picture, u.is_verified AS employer_verified
             FROM jobs j LEFT JOIN users u ON u.id = j.employer_id
             WHERE {$where} ORDER BY {$order} LIMIT 4", $args
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return $this->decorate_for_worker($rows, $user);
    }

    private const PAY_BASIS  = ['month', 'day', 'hour', 'fixed'];
    private const EXPERIENCE = ['none', '1', '2-3', '4+'];
    private const BENEFITS   = ['SSS', 'PhilHealth', 'Pag-IBIG', '13th month pay', 'Free meals', 'Free accommodation',
                                'Transportation allowance', 'Overtime pay', 'Paid leave', 'Health card (HMO)', 'Performance bonus', 'Uniform provided'];

    /**
     * The extra post details (migration 020), validated. Only keys that were sent are returned,
     * and only for columns this database has, so an update never blanks a field by accident.
     */
    private function detail_fields(array $b): array
    {
        $out = [];
        $has = fn($c) => $this->schema_info->has_column('jobs', $c);
        if (array_key_exists('pay_basis', $b) && $has('pay_basis')) {
            if (!in_array($b['pay_basis'], self::PAY_BASIS, true)) $this->api->respond_error('Choose how the pay is counted.', 422);
            $out['pay_basis'] = $b['pay_basis'];
        }
        if (array_key_exists('openings', $b) && $has('openings')) {
            $n = $b['openings'] === '' || $b['openings'] === null ? null : (int) $b['openings'];
            if ($n !== null && ($n < 1 || $n > 999)) $this->api->respond_error('Openings must be between 1 and 999.', 422);
            $out['openings'] = $n;
        }
        if (array_key_exists('experience', $b) && $has('experience')) {
            $e = (string) ($b['experience'] ?? '');
            if ($e !== '' && !in_array($e, self::EXPERIENCE, true)) $this->api->respond_error('Choose the experience needed.', 422);
            $out['experience'] = $e ?: null;
        }
        if (array_key_exists('benefits', $b) && $has('benefits')) {
            $list = is_array($b['benefits']) ? $b['benefits'] : explode(',', (string) $b['benefits']);
            $list = array_values(array_intersect(self::BENEFITS, array_map('trim', $list)));
            $out['benefits'] = $list ? implode(', ', $list) : null;
        }
        if (array_key_exists('needed_by', $b) && $has('needed_by')) {
            $d = trim((string) ($b['needed_by'] ?? ''));
            if ($d !== '' && (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) || !strtotime($d))) $this->api->respond_error('Enter a valid date for when you need it.', 422);
            if ($d !== '' && strtotime($d) < strtotime(date('Y-m-d'))) $this->api->respond_error('The date you need it cannot be in the past.', 422);
            $out['needed_by'] = $d ?: null;
        }
        if (array_key_exists('is_urgent', $b) && $has('is_urgent')) $out['is_urgent'] = filter_var($b['is_urgent'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
        foreach (['schedule' => 120, 'duration' => 60, 'address' => 255] as $k => $max) {
            if (array_key_exists($k, $b) && $has($k)) $out[$k] = mb_substr(trim((string) ($b[$k] ?? '')), 0, $max) ?: null;
        }
        // migration 021
        if (array_key_exists('education_level', $b) && $has('education_level')) {
            $e = (string) ($b['education_level'] ?? '');
            if ($e !== '' && !isset(\Job_matcher::EDUCATION[$e])) $this->api->respond_error('Choose the minimum education.', 422);
            $out['education_level'] = $e ?: null;
        }
        if (array_key_exists('category', $b) && $has('category')) {
            $c = (string) ($b['category'] ?? '');
            if ($c !== '' && !isset(Job_model::CATEGORIES[$c])) $this->api->respond_error('Choose the kind of work.', 422);
            $out['category'] = $c ?: null;
        }
        if (array_key_exists('barangay', $b) && $has('barangay')) {
            $brgy = trim((string) ($b['barangay'] ?? ''));
            $town = (string) ($b['location'] ?? '');
            if ($brgy !== '') {
                $all = require APP_DIR . 'config' . DIRECTORY_SEPARATOR . 'barangays.php';
                if ($town === '' || !in_array($brgy, $all[$town] ?? [], true)) $this->api->respond_error('Choose a barangay in the town you picked.', 422);
            }
            $out['barangay'] = $brgy ?: null;
        }
        return $out;
    }

    /** End date for a post: 15, 30, 60 or 90 days from today (default by post type). */
    private function expiry_from(array $b, string $postType): string
    {
        $days = (int) ($b['expires_in_days'] ?? 0);
        if (!in_array($days, [15, 30, 60, 90], true)) $days = Job_model::DEFAULT_DAYS[$postType] ?? 60;
        return date('Y-m-d H:i:s', time() + $days * 86400);
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

        $this->api->rate_limit('job_create_' . $payload['sub'], 10, 3600);
        $b = $this->api->body();
        $title = trim((string) ($b['title'] ?? ''));
        if (mb_strlen($title) < 3) $this->api->respond_error('Enter a job title.', 422);

        // Plan limits (admins are exempt)
        $want_featured = filter_var($b['is_featured'] ?? false, FILTER_VALIDATE_BOOLEAN);
        if ($user['role'] !== 'admin') {
            $limit = $this->subscription_model->job_post_limit($user);
            if ($limit >= 0) {
                $active = $this->job_model->count_employer_active_jobs((int) $user['id']);
                if ($active >= $limit) {
                    $this->api->respond_error("Your current plan allows {$limit} active job post" . ($limit === 1 ? '' : 's') . ". Close an existing post or upgrade your plan to post more.", 402);
                }
            }
            if ($want_featured && (int) ($user['featured_credits'] ?? 0) <= 0) {
                $this->api->respond_error('You have no featured job credits left. Upgrade your plan to feature this post.', 402);
            }
        }
        $type = (string) ($b['job_type'] ?? 'full-time');
        if (!in_array($type, self::TYPES, true)) $this->api->respond_error('Choose the type of work.', 422);
        $loc = trim((string) ($b['location'] ?? ''));
        if ($loc === '' || !in_array($loc, self::TOWNS, true)) $this->api->respond_error('Choose a town in Oriental Mindoro.', 422);

        // A client's request is a gig (proposals and a contract); an employer's is a job (applications)
        $postType = ($user['account_type'] ?? '') === 'hirer' ? 'gig' : 'job';
        if ($postType === 'gig' && !is_numeric($b['salary_min'] ?? '') && !is_numeric($b['salary_max'] ?? '')) {
            $this->api->respond_error('Enter your budget in pesos so workers can send fair proposals.', 422);
        }
        // Posts from verified accounts go live at once; others wait for a quick admin check
        $verified = (int) ($user['is_verified'] ?? 0) === 1 || $user['role'] === 'admin';
        $mod = [];
        if ($this->job_model->has_column('post_type')) {
            $mod = [
                'post_type'         => $postType,
                'expires_at'        => $this->expiry_from($b, $postType),
                'moderation_status' => $verified ? 'approved' : 'pending',
            ];
        }
        $liveNow = !$mod || $verified;

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
            'status'        => $liveNow ? 'active' : 'draft',
            'is_featured'   => $want_featured ? 1 : 0,
        ] + $mod + $this->detail_fields($b) + ($want_featured && $this->job_model->has_featured_until()
            ? ['featured_until' => date('Y-m-d H:i:s', time() + Subscription_model::FEATURE_DAYS * 86400)] : []));

        if ($want_featured && $user['role'] !== 'admin') {
            $this->user_model->update_user((int) $user['id'], ['featured_credits' => max(0, (int) $user['featured_credits'] - 1)]);
        }

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

            $employer_name = $user['full_name'] ?: 'there';
            $noun = $postType === 'gig' ? 'gig' : 'job post';
            $who = $postType === 'gig' ? 'proposals' : 'applications';
            $until = !empty($mod['expires_at']) ? ' It stays up until ' . date('F j, Y', strtotime($mod['expires_at'])) . ', and you can renew it any time.' : '';
            $this->application_model->create_notification(
                (int) $user['id'],
                'job_posted',
                $liveNow ? "Your {$noun} is live: {$job['title']}" : "Your {$noun} is waiting for review: {$job['title']}",
                $liveNow
                    ? "Hi {$employer_name}! \"{$job['title']}\"{$company_str}{$loc_str} is now live on hanapbuhay.{$salary_str}{$until}\n\nWe will email you for every new {$who}."
                    : "Hi {$employer_name}! We received \"{$job['title']}\"{$company_str}{$loc_str}. Because your account is not verified yet, our team checks new posts first, usually within one working day. Verify your account to post instantly next time.",
                $postType === 'gig' ? '/dashboard/gigs' : '/dashboard/jobs'
            );
            if (!$liveNow) {
                foreach ($this->db->table('users')->where('role', 'admin')->get_all() ?: [] as $adm) {
                    $this->application_model->create_notification((int) $adm['id'], 'system', "New {$noun} to review",
                        ($user['full_name'] ?? 'An account') . " posted \"{$job['title']}\"{$loc_str}. Approve it or send it back in Job Moderation.", '/dashboard/jobs', false);
                }
            }
        } catch (\Throwable $e) {
            error_log('[Job Post Confirmation Email Error] ' . $e->getMessage());
        }

        if ($liveNow && $postType === 'job') $this->send_job_alerts($job);

        $this->api->respond(['success' => true, 'job' => $job, 'live' => $liveNow,
            'message' => $liveNow ? 'Your post is live.' : 'Thanks! Your post will go live after a quick check by our team.'], 201);
    }

    /** What a visitor (not signed in) may see of a post: no street address or poster contacts. */
    private function public_fields(array $j): array
    {
        unset($j['address'], $j['employer_email'], $j['employer_phone']);
        return $j;
    }

    /**
     * POST /api/jobs/{id}/renew  { days: 15 | 30 | 60 | 90 } — the owner puts an ended post back up.
     */
    public function renew($id)
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $job = $this->job_model->find_by_id((int) $id);
        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$job || !$user || ((int) $job['employer_id'] !== (int) $user['id'] && $user['role'] !== 'admin')) $this->api->respond_error('We could not find that post.', 404);
        if (!$this->job_model->has_column('expires_at')) $this->api->respond_error('Renewing is not available yet.', 503);
        if (($job['moderation_status'] ?? 'approved') !== 'approved') $this->api->respond_error('Only approved posts can be renewed.', 409);
        if ($job['status'] !== 'active' && $user['role'] !== 'admin') {
            $limit = $this->subscription_model->job_post_limit($user);
            if ($limit >= 0 && $this->job_model->count_employer_active_jobs((int) $user['id']) >= $limit) {
                $this->api->respond_error("Your current plan allows {$limit} open post" . ($limit === 1 ? '' : 's') . '. Close another post or upgrade your plan to renew this one.', 402);
            }
        }
        $expires = $this->expiry_from($this->api->body(), $job['post_type'] ?? 'job');
        $this->job_model->update_job((int) $id, ['expires_at' => $expires, 'status' => 'active', 'updated_at' => date('Y-m-d H:i:s')]);
        $this->api->respond(['success' => true, 'expires_at' => $expires,
            'message' => 'Renewed. Your post stays up until ' . date('F j, Y', strtotime($expires)) . '.']);
    }

    /**
     * PATCH /api/admin/jobs/{id}/moderate  { action: approve | reject | take_down, note }
     * Approve puts a waiting post live; reject sends it back with a reason the poster can fix.
     */
    public function moderate($id)
    {
        $this->api->require_method('PATCH');
        $payload = $this->api->require_jwt();
        $admin = $this->user_model->find_by_id((int) $payload['sub']);
        if (($admin['role'] ?? '') !== 'admin') $this->api->respond_error('Only administrators can do this.', 403);
        $job = $this->job_model->find_by_id((int) $id);
        if (!$job) $this->api->respond_error('We could not find that post.', 404);
        $b = $this->api->body();
        $action = (string) ($b['action'] ?? '');
        $note = mb_substr(trim((string) ($b['note'] ?? '')), 0, 500) ?: null;
        if (!in_array($action, ['approve', 'reject', 'take_down'], true)) $this->api->respond_error('Choose approve, reject or take down.', 422);
        if ($action !== 'approve' && !$note) $this->api->respond_error('Write the reason, so the poster knows what to fix.', 422);

        $noun = ($job['post_type'] ?? 'job') === 'gig' ? 'gig' : 'job post';
        $link = ($job['post_type'] ?? 'job') === 'gig' ? '/dashboard/gigs' : '/dashboard/jobs';
        if ($action === 'approve') {
            $upd = ['moderation_status' => 'approved', 'moderation_note' => null, 'status' => 'active'];
            if (empty($job['expires_at']) || strtotime((string) $job['expires_at']) < time()) $upd['expires_at'] = $this->expiry_from([], $job['post_type'] ?? 'job');
            $this->job_model->update_job((int) $id, $upd);
            $this->application_model->create_notification((int) $job['employer_id'], 'job_posted', "Your {$noun} is live: {$job['title']}",
                "Good news! Our team approved \"{$job['title']}\" and it is now visible to workers across Oriental Mindoro.", $link);
            if (($job['post_type'] ?? 'job') === 'job') $this->send_job_alerts($this->job_model->find_by_id((int) $id));
        } else {
            $this->job_model->update_job((int) $id, ['moderation_status' => 'rejected', 'moderation_note' => $note, 'status' => 'closed']);
            $this->application_model->create_notification((int) $job['employer_id'], 'system',
                $action === 'reject' ? "Your {$noun} needs changes: {$job['title']}" : "Your {$noun} was taken down: {$job['title']}",
                "Our team could not publish \"{$job['title']}\". Reason: {$note}\n\nEdit the post to fix this and it will be checked again.", $link);
        }
        $this->api->respond(['success' => true, 'job' => $this->job_model->find_by_id((int) $id)]);
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
        $data += $this->detail_fields($b);
        if (empty($data)) $this->api->respond_error('No fields to update.', 422);

        if (isset($data['title']) && mb_strlen(trim((string) $data['title'])) < 3) $this->api->respond_error('Enter a job title.', 422);
        if (isset($data['job_type']) && !in_array($data['job_type'], self::TYPES, true)) $this->api->respond_error('Invalid job type.', 422);
        if (!empty($data['location']) && !in_array($data['location'], self::TOWNS, true)) $this->api->respond_error('Choose a town in Oriental Mindoro.', 422);
        if (isset($data['status']) && !in_array($data['status'], ['active', 'closed', 'draft'], true)) $this->api->respond_error('Invalid status.', 422);
        foreach (['salary_min', 'salary_max'] as $sf) {
            if (array_key_exists($sf, $data)) $data[$sf] = is_numeric($data[$sf]) ? (float) $data[$sf] : null;
        }
        foreach (['title' => 255, 'company' => 255, 'description' => 10000, 'requirements' => 5000, 'skills_needed' => 2000] as $tf => $max) {
            if (isset($data[$tf])) $data[$tf] = substr(trim((string) $data[$tf]), 0, $max) ?: null;
        }
        // A post waiting for review, or one that was not approved, cannot be opened by its owner
        if (($data['status'] ?? '') === 'active' && $job['status'] !== 'active' && $user['role'] !== 'admin') {
            $modStatus = $job['moderation_status'] ?? 'approved';
            if ($modStatus === 'pending') $this->api->respond_error('This post is still waiting for review. It goes live once our team approves it.', 409);
            if ($modStatus === 'rejected') $this->api->respond_error('This post was not approved. Edit it to fix the reason we gave, and it will be checked again.', 409);
            if (!empty($job['expires_at']) && strtotime((string) $job['expires_at']) < time()) {
                $this->api->respond_error('This post has ended. Use Renew to put it back up.', 409);
            }
        }
        // Editing a post that was sent back puts it in the review queue again
        if (($job['moderation_status'] ?? '') === 'rejected' && $user['role'] !== 'admin') {
            $data['moderation_status'] = 'pending';
            $data['moderation_note'] = null;
            $data['status'] = 'draft';
        }
        // Re-activating a closed post counts against the plan limit
        if (($data['status'] ?? '') === 'active' && $job['status'] !== 'active' && $user['role'] !== 'admin') {
            $limit = $this->subscription_model->job_post_limit($user);
            if ($limit >= 0 && $this->job_model->count_employer_active_jobs((int) $user['id']) >= $limit) {
                $this->api->respond_error("Your current plan allows {$limit} active job post" . ($limit === 1 ? '' : 's') . ". Upgrade your plan to reopen this post.", 402);
            }
        }

        $this->job_model->update_job((int) $id, $data);
        $this->api->respond(['success' => true, 'job' => $this->job_model->find_by_id((int) $id)]);
    }

    // ---------- the job's own photo (migration 020) ----------
    /**
     * POST /api/jobs/{id}/image — the poster's photo for this job (JPG/PNG/WEBP, up to 3 MB).
     * DELETE removes it. Workers then see the photo on every card and on the job page.
     */
    public function image_upload($id)
    {
        $payload = $this->api->require_jwt();
        $job = $this->job_model->find_by_id((int) $id);
        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$job || !$user) $this->api->respond_error('Job not found.', 404);
        if ((int) $job['employer_id'] !== (int) $user['id'] && ($user['role'] ?? '') !== 'admin') $this->api->respond_error('Forbidden', 403);
        if (!$this->schema_info->has_table('job_images')) $this->api->respond_error('Job photos are not available yet. Please try again later.', 503);

        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'DELETE') {
            $this->db->raw('DELETE FROM job_images WHERE job_id = ?', [(int) $id]);
            $this->job_model->update_job((int) $id, ['image_v' => 0]);
            $this->api->respond(['success' => true, 'image_v' => 0]);
        }
        $this->api->require_method('POST');
        $this->api->rate_limit('job_image_' . (int) $user['id'], 30, 3600);
        $f = $_FILES['image'] ?? $_FILES['file'] ?? null;
        if (!$f || empty($f['tmp_name']) || !is_uploaded_file($f['tmp_name'])) $this->api->respond_error('Choose a photo to upload.', 422);
        if ((int) $f['size'] > 3 * 1024 * 1024) $this->api->respond_error('The photo is too large. The limit is 3 MB.', 422);
        $bytes = (string) file_get_contents($f['tmp_name']);
        $info = @getimagesizefromstring($bytes);
        $types = [IMAGETYPE_JPEG => 'image/jpeg', IMAGETYPE_PNG => 'image/png', IMAGETYPE_WEBP => 'image/webp'];
        if (!$info || !isset($types[$info[2]])) $this->api->respond_error('Upload a photo (JPG, PNG or WEBP). Videos and documents are not accepted.', 422);
        $mime = $types[$info[2]];
        $this->db->raw(
            'INSERT INTO job_images (job_id, file_mime, file_size, file_data, updated_at) VALUES (?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE file_mime = VALUES(file_mime), file_size = VALUES(file_size), file_data = VALUES(file_data), updated_at = NOW()',
            [(int) $id, $mime, strlen($bytes), 'data:' . $mime . ';base64,' . base64_encode($bytes)]
        );
        $v = (int) ($job['image_v'] ?? 0) + 1;
        $this->job_model->update_job((int) $id, ['image_v' => $v]);
        $this->api->respond(['success' => true, 'image_v' => $v]);
    }

    /** GET /api/jobs/{id}/image — the photo itself, for an <img src> (public, like the job). */
    public function image($id)
    {
        $this->api->require_method('GET');
        if (!$this->schema_info->has_table('job_images')) $this->api->respond_error('Photo not found.', 404);
        $row = $this->db->raw('SELECT file_mime, file_data FROM job_images WHERE job_id = ?', [(int) $id])->fetch(PDO::FETCH_ASSOC);
        if (!$row) $this->api->respond_error('Photo not found.', 404);
        $data = (string) $row['file_data'];
        $bytes = str_contains($data, ';base64,') ? base64_decode(substr($data, strpos($data, ';base64,') + 8), true) : false;
        if ($bytes === false || $bytes === '') $this->api->respond_error('Photo not found.', 404);
        $mime = in_array($row['file_mime'], ['image/jpeg', 'image/png', 'image/webp'], true) ? $row['file_mime'] : 'application/octet-stream';
        if (!headers_sent()) {
            header('Content-Type: ' . $mime);
            header('Content-Length: ' . strlen($bytes));
            header('Cache-Control: public, max-age=604800');   // the URL carries ?v=, so a new photo is a new URL
            header('X-Content-Type-Options: nosniff');
            header('Cross-Origin-Resource-Policy: cross-origin');
            header("Content-Security-Policy: default-src 'none'; img-src 'self' data:; sandbox");
        }
        echo $bytes;
        exit;
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

    // ---------- report a job (any signed-in user) ----------
    public function report($id)
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $this->api->rate_limit('report_' . $payload['sub'], 10, 3600);

        $job = $this->job_model->find_by_id((int) $id);
        if (!$job) $this->api->respond_error('Job not found.', 404);

        $b = $this->api->body();
        $reason = substr(trim((string) ($b['reason'] ?? '')), 0, 1000);
        if (mb_strlen($reason) < 5) $this->api->respond_error('Please describe the problem (at least 5 characters).', 422);

        // job_reports comes from migration 012; without it the admins still get the notification below
        $this->call->library('schema_info');
        $stored = $this->schema_info->has_table('job_reports');
        $existing = $stored ? $this->db->table('job_reports')->where('job_id', (int) $id)->where('reporter_id', (int) $payload['sub'])->get() : null;
        if ($existing) $this->api->respond(['success' => true, 'message' => 'You already reported this job. Our team will review it.']);

        if ($stored) $this->db->table('job_reports')->insert([
            'job_id'      => (int) $id,
            'reporter_id' => (int) $payload['sub'],
            'reason'      => $reason,
            'status'      => 'open',
            'created_at'  => date('Y-m-d H:i:s'),
        ]);

        try {
            $admins = $this->db->table('users')->where('role', 'admin')->where('is_active', 1)->get_all() ?: [];
            foreach ($admins as $adm) {
                $this->application_model->create_notification(
                    (int) $adm['id'],
                    'system',
                    "Job reported: {$job['title']}",
                    "A user reported job #{$id} \"{$job['title']}\".\n\nReason: {$reason}",
                    "/jobs/{$id}",
                    false
                );
            }
        } catch (\Throwable $e) {
            error_log('[Job Report Notify Error] ' . $e->getMessage());
        }

        $this->api->respond(['success' => true, 'message' => 'Thank you. Our team will review this job post.']);
    }

    // ---------- my jobs (employer) ----------
    public function my_jobs()
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $rows = $this->job_model->get_employer_jobs((int) $payload['sub']);
        $user = $this->user_model->find_by_id((int) $payload['sub']);
        $plan = $user ? $this->subscription_model->current_plan($user) : null;
        $this->api->respond([
            'success' => true,
            'jobs'    => $rows ?: [],
            'usage'   => $user ? [
                'plan'          => $plan['name'] ?? 'Free',
                'plan_id'       => $plan['id'] ?? null,
                'active'        => count(array_filter($rows, fn($j) => ($j['status'] ?? '') === 'active')),
                'limit'         => $this->subscription_model->job_post_limit($user),
                'featured_left' => max(0, (int) ($user['featured_credits'] ?? 0)),
                'contact_left'  => max(0, (int) ($user['contact_credits'] ?? 0)),
                'contact_unlimited' => $this->subscription_model->contact_unlimited($user),
                'expires_at'    => $this->subscription_model->has_active_paid_plan($user) ? $user['subscription_expires_at'] : null,
                'feature_days'  => Subscription_model::FEATURE_DAYS,
            ] : null,
        ]);
    }

    /**
     * POST /api/jobs/{id}/feature — feature one of your open posts for FEATURE_DAYS days,
     * using one featured credit from the plan. Featured posts come first in search and on
     * workers' home pages. The credit is only taken once the post is actually featured.
     */
    public function feature($id)
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $uid = (int) $payload['sub'];
        $job = $this->job_model->find_by_id((int) $id);
        if (!$job || (int) $job['employer_id'] !== $uid) $this->api->respond_error('Job not found.', 404);
        if (($job['status'] ?? '') !== 'active') $this->api->respond_error('Reopen this post before featuring it.', 422);
        if (!$this->job_model->has_featured_until()) $this->api->respond_error('Featuring is not available yet. Please try again later.', 503);
        $this->job_model->expire_featured();
        $fresh = $this->job_model->find_by_id((int) $id);
        if ((int) ($fresh['is_featured'] ?? 0) === 1) {
            $this->api->respond_error('This post is already featured until ' . date('F j', strtotime((string) $fresh['featured_until'])) . '.', 409);
        }

        // take the credit first, atomically, so two clicks cannot feature twice on one credit
        $st = $this->db->raw('UPDATE users SET featured_credits = featured_credits - 1 WHERE id = ? AND featured_credits > 0', [$uid]);
        if ($st->rowCount() < 1) {
            $this->api->respond(['error' => 'You have no featured credits left. Business Pro includes 2 featured posts, Enterprise includes 10.', 'status' => 402, 'code' => 'no_credits'], 402);
        }
        $until = date('Y-m-d H:i:s', time() + Subscription_model::FEATURE_DAYS * 86400);
        $this->job_model->update_job((int) $id, ['is_featured' => 1, 'featured_until' => $until]);
        $user = $this->user_model->find_by_id($uid);
        $this->api->respond([
            'success' => true,
            'job' => $this->job_model->find_by_id((int) $id),
            'featured_left' => max(0, (int) ($user['featured_credits'] ?? 0)),
        ]);
    }

    // ---------- featured / home ----------
    /**
     * GET /api/jobs/featured — the jobs shown on the dashboard and the landing page.
     * Signed in, the list is built around where the person is: their own town first, then
     * any town they said they would work in, then the rest of Oriental Mindoro. Workers
     * also get a match score on every card.
     */
    /**
     * GET /api/jobs/towns — open jobs in each of the 15 towns, plus the total.
     * Public and read-only: it feeds the map on the landing page. Locations written
     * freely ("Brgy. Ilaya, Calapan") are folded into their town.
     */
    public function towns()
    {
        $this->api->require_method('GET');
        $this->call->library('job_matcher');
        $counts = array_fill_keys(self::TOWNS, 0);
        $total = 0;
        foreach ($this->job_model->count_active_by_location() as $row) {
            $n = (int) $row['n'];
            $total += $n;
            $town = in_array($row['location'], self::TOWNS, true) ? $row['location'] : $this->job_matcher->town($row['location']);
            if ($town) $counts[$town] += $n;
        }
        header('Cache-Control: public, max-age=120');
        $this->api->respond(['towns' => $counts, 'total' => $total]);
    }

    public function featured()
    {
        $this->api->require_method('GET');
        $this->job_model->expire_featured();
        $limit = min(max((int) ($_GET['limit'] ?? 8), 1), 24);
        $user  = $this->viewer();

        $town = trim((string) ($_GET['location'] ?? ($user['location'] ?? '')));
        if ($town !== '' && !in_array($town, self::TOWNS, true)) {
            $this->call->library('job_matcher');
            $town = (string) ($this->job_matcher->town($town) ?? '');
        }

        $rows = $this->job_model->get_featured_jobs($limit * 3, $town);
        $rows = $this->decorate_for_worker(array_values($rows), $user);

        // preferred towns come straight after the home town
        $prefs = array_values(array_filter(array_map('trim', explode(',', (string) ($user['preferred_towns'] ?? '')))));
        if ($town !== '' || $prefs) {
            $rank = function (array $j) use ($town, $prefs) {
                $loc = (string) ($j['location'] ?? '');
                if ($town !== '' && $loc === $town) return 0;
                if (in_array($loc, $prefs, true)) return 1;
                return 2;
            };
            usort($rows, fn($a, $b) => [$rank($a), -(int) ($a['is_featured'] ?? 0), -(int) ($a['match_pct'] ?? 0)]
                                   <=> [$rank($b), -(int) ($b['is_featured'] ?? 0), -(int) ($b['match_pct'] ?? 0)]);
        }

        $this->api->respond([
            'success' => true,
            'town'    => $town ?: null,
            'scored'  => $user && ($user['account_type'] ?? '') === 'worker',
            'jobs'    => array_slice($rows, 0, $limit),
        ]);
    }
}
