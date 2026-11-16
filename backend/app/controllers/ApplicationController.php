<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * /api/applications — apply to jobs, manage applications.
 */
class ApplicationController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->model('Application_model', 'application_model');
        $this->call->model('Job_model', 'job_model');
        $this->call->model('User_model', 'user_model');
        $this->call->model('Skill_model', 'skill_model');
        $this->call->library('schema_info');
        $this->call->library('availability');
    }

    // Worker: apply to a job
    public function apply()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user || $user['account_type'] !== 'worker') $this->api->respond_error('Only workers can apply for jobs.', 403);
        $this->api->rate_limit('apply_' . $payload['sub'], 30, 3600);

        $b = $this->api->body();
        $job_id = (int) ($b['job_id'] ?? 0);
        if (!$job_id) $this->api->respond_error('Job ID is required.', 422);

        $job = $this->job_model->find_by_id($job_id);
        if (!$job || $job['status'] !== 'active') $this->api->respond_error('This job is no longer open for applications.', 404);
        if (($job['post_type'] ?? 'job') === 'gig') $this->api->respond_error('This is a gig. Send a proposal instead of an application.', 409);
        if (!empty($job['expires_at']) && strtotime((string) $job['expires_at']) < time()) $this->api->respond_error('This job post has ended and no longer takes applications.', 410);
        if (($job['moderation_status'] ?? 'approved') !== 'approved') $this->api->respond_error('This job is not open for applications yet.', 409);

        // One application per job; a withdrawn one can be sent again (the same row is reused)
        $existing = $this->application_model->find_by_job_and_worker($job_id, (int) $payload['sub']);
        if ($existing && $existing['status'] !== 'withdrawn') $this->api->respond_error('You have already applied for this job.', 409);

        // What every job board asks for before you can apply (Job_matcher::missing_profile)
        $this->call->library('job_matcher');
        $skills = $this->skill_model->get_skills_for_matching((int) $user['id']);
        $missing = $this->job_matcher->missing_profile($user, $skills);
        if ($missing) {
            $this->api->respond([
                'success' => false, 'code' => 'profile_incomplete', 'missing' => $missing,
                'error' => 'Please complete your profile before applying: ' . implode(', ', array_column($missing, 'label')) . '.',
            ], 422);
        }

        // A low match asks once, then the worker may apply anyway
        $match = $this->job_matcher->score($user, $skills, $job);
        $match_score = $match['score'];
        $ack = !empty($b['acknowledge_gap']);
        if ($match['level'] === 'low' && !$ack) {
            $this->api->respond([
                'success' => false, 'code' => 'low_match', 'match' => $match,
                'error' => 'This job asks for things your profile does not show yet.',
            ], 409);
        }
        $cover = mb_substr(trim((string) ($b['cover_note'] ?? '')), 0, 2000) ?: null;
        $extra = $this->schema_info->has_column('applications', 'low_match_ack') ? ['low_match_ack' => $ack && $match['level'] === 'low' ? 1 : 0] : [];

        if ($existing) {
            $app_id = (int) $existing['id'];
            $reset = [
                'cover_note' => $cover, 'match_score' => $match_score, 'status' => 'pending',
                'interview_date' => null, 'interview_notes' => null, 'withdrawn_at' => null,
                'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s'),
            ] + $extra;
            if (array_key_exists('interview_reminded_at', $existing)) $reset['interview_reminded_at'] = null;
            $this->db->table('applications')->where('id', $app_id)->update($reset);
        } else {
            $app_id = $this->application_model->apply([
                'job_id'      => $job_id,
                'worker_id'   => (int) $payload['sub'],
                'cover_note'  => $cover,
                'match_score' => $match_score,
                'status'      => 'pending',
            ] + $extra);
        }
        \Hiring_status::log((int) $app_id, $existing ? 'withdrawn' : null, 'pending', (int) $user['id'],
            $extra['low_match_ack'] ?? 0 ? 'Applied after seeing the skill-gap notice' : null);

        // 1. Notify employer (in-app + email)
        $company_label = !empty($job['company']) ? " at {$job['company']}" : '';
        $this->application_model->create_notification(
            (int) $job['employer_id'],
            'application',
            "New application for {$job['title']}",
            "{$user['full_name']} applied for your job post \"{$job['title']}\"." . (!empty($b['cover_note']) ? "\n\nApplicant Note: " . trim($b['cover_note']) : '') . "\nMatch Score: {$match_score}%\nLocation: " . ($user['location'] ?: 'Oriental Mindoro'),
            '/dashboard/applicants'
        );

        // 2. Notify applicant / worker (in-app + email confirmation)
        $this->application_model->create_notification(
            (int) $payload['sub'],
            'application_status',
            "Application Submitted: {$job['title']}",
            "Hello {$user['full_name']}! Your application for \"{$job['title']}\"{$company_label} was submitted successfully.\n\nThe employer has been notified by email about your application. You will also receive an email update when the employer reviews your application, schedules an interview, or hires you.",
            '/dashboard/applied'
        );

        $this->api->respond(['success' => true, 'application_id' => $app_id, 'match_score' => $match_score], 201);
    }

    /** Same formula as Job Matches (Job_matcher), so the % the employer sees is the one the worker saw. */
    private function _calc_match(array $user, array $job): int
    {
        $this->call->library('job_matcher');
        return $this->job_matcher->score($user, $this->skill_model->get_skills_for_matching((int) $user['id']), $job)['score'];
    }

    /** The employer who owns the job (or an admin) — otherwise 403. Returns [application, job]. */
    private function require_employer_of(int $app_id, int $viewer_id): array
    {
        $app = $this->application_model->find_by_id($app_id);
        if (!$app) $this->api->respond_error('Application not found.', 404);
        $job = $this->job_model->find_by_id((int) $app['job_id']);
        $viewer = $this->user_model->find_by_id($viewer_id);
        if (!$viewer) $this->api->respond_error('Unauthorized', 401);
        if ((!$job || (int) $job['employer_id'] !== $viewer_id) && $viewer['role'] !== 'admin') $this->api->respond_error('Forbidden', 403);
        return [$app, $job];
    }

    // POST /api/applications/:id/withdraw — the worker takes back an application
    public function withdraw($id)
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $app = $this->application_model->find_by_id((int) $id);
        if (!$app || (int) $app['worker_id'] !== (int) $payload['sub']) $this->api->respond_error('Application not found.', 404);
        if (in_array($app['status'], ['hired', 'rejected', 'withdrawn'], true)) {
            $this->api->respond_error($app['status'] === 'withdrawn' ? 'This application was already withdrawn.' : 'This application is already decided and can no longer be withdrawn.', 409);
        }

        $now = date('Y-m-d H:i:s');
        $this->db->table('applications')->where('id', (int) $id)->update(['status' => 'withdrawn', 'withdrawn_at' => $now, 'updated_at' => $now]);
        \Hiring_status::log((int) $id, $app['status'], 'withdrawn', (int) $payload['sub'], mb_substr(trim((string) ($this->api->body()['reason'] ?? '')), 0, 500) ?: null);

        $job = $this->job_model->find_by_id((int) $app['job_id']);
        $worker = $this->user_model->find_by_id((int) $payload['sub']);
        if ($job) {
            $this->application_model->create_notification(
                (int) $job['employer_id'],
                'application',
                "Application withdrawn: {$job['title']}",
                ($worker['full_name'] ?? 'An applicant') . " withdrew their application for \"{$job['title']}\".",
                '/dashboard/applicants',
                false
            );
        }
        $this->api->respond(['success' => true, 'status' => 'withdrawn']);
    }

    // GET /api/applications/:id/profile — the applicant's full profile, for the job's employer
    public function applicant_profile($id)
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        [$app, $job] = $this->require_employer_of((int) $id, (int) $payload['sub']);

        $w = $this->user_model->find_by_id((int) $app['worker_id']);
        if (!$w) $this->api->respond_error('This applicant closed their account.', 404);

        // The employer opening a new application moves it to Under Review, like real job boards
        // ("Viewed by employer"), so the applicant knows someone looked.
        if ($app['status'] === 'pending' && $job && (int) $job['employer_id'] === (int) $payload['sub']) {
            $this->application_model->update_status((int) $app['id'], 'reviewed');
            \Hiring_status::log((int) $app['id'], 'pending', 'reviewed', (int) $payload['sub']);
            $this->application_model->create_notification((int) $app['worker_id'], 'application_status',
                "Under review: {$job['title']}", \Hiring_status::FOR_WORKER['reviewed'], '/dashboard/applied', false);
            $app['status'] = 'reviewed';
        }

        // certificate_id comes from migration 015
        $skillCols = 'id, skill_name, category, level, source, certificate, verified'
            . ($this->schema_info->has_column('skills_passport', 'certificate_id') ? ', certificate_id' : '');
        $skills = $this->db->table('skills_passport')
            ->select($skillCols)
            ->where('user_id', (int) $w['id'])->order_by('created_at DESC')->get_all() ?: [];
        $certs = [];
        $hasCerts = (bool) $this->db->raw("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'skill_certificates'")->fetchColumn();
        if ($hasCerts) {
            $certs = $this->skill_model->get_user_certificates((int) $w['id']);
            $byId = array_column($certs, 'status', 'id');
            foreach ($skills as &$s) {
                $s['verified'] = (int) $s['verified'] === 1 || (($byId[(int) $s['certificate_id']] ?? '') === 'verified');
            }
            unset($s);
        }
        // photos of the worker's own work (Skills Passport → Work photos, migration 018).
        // Only the description travels here; the picture is /api/portfolio/{id}/file.
        $work = [];
        if ($this->schema_info->has_table('work_samples')) {
            $work = $this->db->raw('SELECT id, title, description, skill_name, taken_on FROM work_samples WHERE user_id = ? ORDER BY created_at DESC LIMIT 24', [(int) $w['id']])
                ->fetchAll(\PDO::FETCH_ASSOC) ?: [];
            foreach ($work as &$ws) { $ws['id'] = (int) $ws['id']; $ws['url'] = '/api/portfolio/' . $ws['id'] . '/file'; }
            unset($ws);
        }

        $resume = $this->skill_model->get_resume((int) $w['id']);
        $this->call->library('job_matcher');
        $match = $job ? $this->job_matcher->score($w, $this->skill_model->get_skills_for_matching((int) $w['id']), $job) : null;

        $this->api->respond([
            'success' => true,
            'application' => [
                'id' => (int) $app['id'], 'status' => $app['status'], 'cover_note' => $app['cover_note'],
                'created_at' => $app['created_at'], 'job_id' => (int) $app['job_id'], 'job_title' => $job['title'] ?? null,
                'interview_date' => $app['interview_date'] ?? null, 'interview_notes' => $app['interview_notes'] ?? null,
                'offer_salary' => $app['offer_salary'] ?? null, 'offer_start' => $app['offer_start'] ?? null, 'offer_details' => $app['offer_details'] ?? null,
                'low_match_ack' => (int) ($app['low_match_ack'] ?? 0),
                'history' => \Hiring_status::history((int) $app['id']),
            ],
            'worker' => [
                'id' => (int) $w['id'], 'full_name' => $w['full_name'], 'email' => $w['email'], 'phone' => $w['phone'],
                'location' => $w['location'], 'bio' => $w['bio'] ?? null, 'picture' => $w['picture'] ?? null,
                'is_verified' => (int) ($w['is_verified'] ?? 0), 'member_since' => $w['created_at'] ?? null,
                'availability' => \Availability::from_row($w), // null until migration 017
            ],
            'skills' => $skills,
            'certificates' => $certs,
            'resume' => $resume,
            'work' => $work,
            'match' => $match,
        ]);
    }

    // Worker: my applications
    public function my_applications()
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $uid = (int) $payload['sub'];
        $rows = $this->application_model->get_worker_applications($uid) ?: [];

        // the worker's own rating of each employer who hired them (migration 017)
        $reviews = $this->schema_info->has_table('employer_reviews');
        if ($reviews && $rows) {
            $mine = [];
            foreach ($this->db->raw('SELECT application_id, rating, comment FROM employer_reviews WHERE worker_id = ?', [$uid])->fetchAll(\PDO::FETCH_ASSOC) ?: [] as $r) {
                $mine[(int) $r['application_id']] = ['rating' => (int) $r['rating'], 'comment' => $r['comment']];
            }
            foreach ($rows as &$row) $row['my_review'] = $mine[(int) $row['id']] ?? null;
            unset($row);
        }
        $this->api->respond(['success' => true, 'applications' => $rows, 'reviews_enabled' => $reviews]);
    }

    /**
     * GET /api/applications/next-steps — for the worker's latest "not selected" applications:
     * the skills that job asked for that they lack (with TESDA courses on the page), and
     * up to 3 open jobs like it (shared skills or a similar title), best match first.
     * Returns { steps: { <application id>: { gaps: [...], similar: [...] } } }
     */
    public function next_steps()
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $uid = (int) $payload['sub'];
        $user = $this->user_model->find_by_id($uid);
        if (!$user || $user['account_type'] !== 'worker') $this->api->respond_error('Only for workers.', 403);

        $rejected = $this->db->raw(
            "SELECT id, job_id FROM applications WHERE worker_id = ? AND status = 'rejected' ORDER BY updated_at DESC, id DESC LIMIT 5",
            [$uid]
        )->fetchAll(\PDO::FETCH_ASSOC) ?: [];
        if (!$rejected) $this->api->respond(['success' => true, 'steps' => new \stdClass()]);

        $this->call->library('job_matcher');
        $skills = $this->skill_model->get_skills_for_matching($uid);
        $applied = array_map('intval', $this->db->raw("SELECT job_id FROM applications WHERE worker_id = ? AND status <> 'withdrawn'", [$uid])->fetchAll(\PDO::FETCH_COLUMN) ?: []);

        // every open job the worker hasn't applied to, scored once
        $open = [];
        foreach ($this->job_model->get_active_jobs('', '', [], 300, 0) ?: [] as $j) {
            if (in_array((int) $j['id'], $applied, true)) continue;
            $open[] = ['job' => $j, 'needs' => $this->job_matcher->needs($j['skills_needed'] ?? ''), 'score' => $this->job_matcher->score($user, $skills, $j)['score']];
        }

        $steps = [];
        foreach ($rejected as $r) {
            $job = $this->job_model->find_by_id((int) $r['job_id']);
            if (!$job) continue;
            $needs = $this->job_matcher->needs($job['skills_needed'] ?? '');
            $picks = [];
            foreach ($open as $o) {
                if ((int) $o['job']['id'] === (int) $job['id']) continue;
                $sim = 0;
                foreach ($needs as $n1) {
                    foreach ($o['needs'] as $n2) {
                        if ($this->job_matcher->skill_matches($n1, $n2)) { $sim += 2; break; }
                    }
                }
                if ($this->job_matcher->skill_matches($job['title'], $o['job']['title'])) $sim += 3;
                if ($sim >= 2) $picks[] = $o + ['sim' => $sim];
            }
            usort($picks, fn($a, $b) => [$b['sim'], $b['score']] <=> [$a['sim'], $a['score']]);
            $picks = array_slice($picks, 0, 3);
            if (count($picks) < 3) { // not enough look-alikes: add the best overall matches
                $have = array_map(fn($p) => (int) $p['job']['id'], $picks);
                $best = array_filter($open, fn($o) => $o['score'] >= 50 && (int) $o['job']['id'] !== (int) $job['id'] && !in_array((int) $o['job']['id'], $have, true));
                usort($best, fn($a, $b) => $b['score'] <=> $a['score']);
                $picks = array_merge($picks, array_slice($best, 0, 3 - count($picks)));
            }
            $steps[(int) $r['id']] = [
                'gaps' => $this->job_matcher->score($user, $skills, $job)['missing'],
                'similar' => array_map(fn($p) => [
                    'id' => (int) $p['job']['id'], 'title' => $p['job']['title'],
                    'company' => $p['job']['company'] ?: ($p['job']['employer_name'] ?? null),
                    'location' => $p['job']['location'], 'job_type' => $p['job']['job_type'],
                    'salary_min' => $p['job']['salary_min'], 'salary_max' => $p['job']['salary_max'],
                    'score' => $p['score'],
                ], $picks),
            ];
        }
        $this->api->respond(['success' => true, 'steps' => $steps ?: new \stdClass()]);
    }

    // Employer: applications for a job
    /**
     * Add the two rating facts an employer needs next to an applicant:
     *   my_rating / my_review  what this employer already said about them (so the button
     *                          offers "edit" instead of writing a second review)
     *   worker_rating          their average from every employer who hired them
     * Both are skipped quietly on a database where migration 018 has not run.
     */
    private function attach_worker_ratings(array $rows, int $employerId): array
    {
        if (!$rows) return $rows;
        $this->call->library('schema_info');
        if (!$this->schema_info->has_table('worker_reviews')) return $rows;

        $appIds = array_values(array_filter(array_map(fn($r) => (int) ($r['id'] ?? 0), $rows)));
        $workerIds = array_values(array_unique(array_filter(array_map(fn($r) => (int) ($r['worker_id'] ?? 0), $rows))));

        $mine = [];
        if ($appIds) {
            $in = implode(',', array_fill(0, count($appIds), '?'));
            foreach ($this->db->raw(
                "SELECT application_id, rating, comment FROM worker_reviews WHERE employer_id = ? AND application_id IN ({$in})",
                array_merge([$employerId], $appIds)
            )->fetchAll(PDO::FETCH_ASSOC) ?: [] as $r) {
                $mine[(int) $r['application_id']] = $r;
            }
        }

        $avg = [];
        if ($workerIds) {
            $in = implode(',', array_fill(0, count($workerIds), '?'));
            foreach ($this->db->raw(
                "SELECT worker_id, COUNT(*) AS n, AVG(rating) AS a FROM worker_reviews
                 WHERE is_hidden = 0 AND worker_id IN ({$in}) GROUP BY worker_id", $workerIds
            )->fetchAll(PDO::FETCH_ASSOC) ?: [] as $r) {
                $avg[(int) $r['worker_id']] = ['count' => (int) $r['n'], 'average' => round((float) $r['a'], 1)];
            }
        }

        foreach ($rows as &$r) {
            $m = $mine[(int) ($r['id'] ?? 0)] ?? null;
            $r['my_rating'] = $m ? (int) $m['rating'] : null;
            $r['my_review'] = $m['comment'] ?? null;
            $r['worker_rating'] = $avg[(int) ($r['worker_id'] ?? 0)] ?? null;
        }
        unset($r);
        return $rows;
    }

    public function job_applications($job_id)
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $job = $this->job_model->find_by_id((int) $job_id);
        if (!$job) $this->api->respond_error('Job not found.', 404);

        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);
        if ((int) $job['employer_id'] !== (int) $payload['sub'] && $user['role'] !== 'admin') {
            $this->api->respond_error('Forbidden', 403);
        }

        $rows = $this->attach_worker_ratings($this->application_model->get_job_applications((int) $job_id) ?: [], (int) $job['employer_id']);
        $this->api->respond(['success' => true, 'applications' => $rows]);
    }

    // Employer: all applicants across all jobs
    public function employer_applications()
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);

        $rows = $this->attach_worker_ratings($this->application_model->get_employer_applications((int) $user['id']) ?: [], (int) $user['id']);
        $this->api->respond(['success' => true, 'applications' => $rows]);
    }

    /**
     * PATCH /api/applications/{id}/status — the employer moves an applicant along the pipeline.
     * Body: { status, interview_date?, interview_notes?, offer_salary?, offer_start?, offer_details?, note? }
     * Allowed moves: Hiring_status::can_move (forward only; "rejected" from any open step).
     */
    public function update_status($id)
    {
        $this->api->require_method('PATCH');
        $payload = $this->api->require_jwt();
        $app = $this->application_model->find_by_id((int) $id);
        if (!$app) $this->api->respond_error('We could not find that application.', 404);

        $job = $this->job_model->find_by_id((int) $app['job_id']);
        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user) $this->api->respond_error('Please sign in again.', 401);
        if ($job && (int) $job['employer_id'] !== (int) $payload['sub'] && $user['role'] !== 'admin') {
            $this->api->respond_error('Only the employer who posted this job can update its applicants.', 403);
        }
        if ($app['status'] === 'withdrawn') $this->api->respond_error('The applicant withdrew this application.', 409);

        $b = $this->api->body();
        $status = (string) ($b['status'] ?? '');
        if (!isset(\Hiring_status::LABELS[$status]) || $status === 'withdrawn' || $status === 'pending') {
            $this->api->respond_error('Choose a hiring step.', 422);
        }
        if ($status !== $app['status'] || $status === 'for_interview') {
            if (!\Hiring_status::can_move($app['status'], $status)) {
                $this->api->respond_error('This applicant is already at "' . \Hiring_status::label($app['status'])
                    . '". You can only move them forward, or mark them as not selected.', 409);
            }
        }

        $interview_date  = isset($b['interview_date']) && $b['interview_date'] !== '' ? str_replace('T', ' ', (string) $b['interview_date']) : null;
        $interview_notes = isset($b['interview_notes']) ? mb_substr(trim((string) $b['interview_notes']), 0, 2000) : null;
        if ($status === 'for_interview') {
            if (!$interview_date || strtotime($interview_date) === false) $this->api->respond_error('Choose the interview date and time.', 422);
            if (strtotime($interview_date) < time() - 300) $this->api->respond_error('The interview date has already passed. Choose a later date.', 422);
        }

        $this->application_model->update_status((int) $id, $status, $interview_date, $interview_notes);

        // job offer details
        $extra = [];
        if ($status === 'offer' && $this->schema_info->has_column('applications', 'offer_details')) {
            $salary = isset($b['offer_salary']) && $b['offer_salary'] !== '' ? (float) $b['offer_salary'] : null;
            if ($salary !== null && ($salary < 0 || $salary > 10000000)) $this->api->respond_error('Enter the offered pay in pesos.', 422);
            $start = (string) ($b['offer_start'] ?? '');
            $extra = [
                'offer_salary'  => $salary,
                'offer_start'   => $start !== '' && strtotime($start) ? date('Y-m-d', strtotime($start)) : null,
                'offer_details' => mb_substr(trim((string) ($b['offer_details'] ?? '')), 0, 1000) ?: null,
            ];
        }
        if (in_array($status, ['hired', 'rejected'], true) && $this->schema_info->has_column('applications', 'decided_at')) {
            $extra['decided_at'] = date('Y-m-d H:i:s');
        }
        if ($extra) $this->db->table('applications')->where('id', (int) $id)->update($extra);

        $note = mb_substr(trim((string) ($b['note'] ?? $interview_notes ?? '')), 0, 1000) ?: null;
        \Hiring_status::log((int) $id, $app['status'], $status, (int) $payload['sub'], $note);

        $email = null;
        if ($job) {
            $worker = $this->user_model->find_by_id((int) $app['worker_id']);
            $name = !empty($worker['full_name']) ? $worker['full_name'] : 'there';
            $company = !empty($job['company']) ? $job['company'] : 'The employer';
            $when = $interview_date ? date('l, F j, Y \a\t g:i A', strtotime($interview_date)) : '';
            $basis = ['month' => 'a month', 'day' => 'a day', 'hour' => 'an hour', 'fixed' => 'in total'][$job['pay_basis'] ?? 'month'] ?? 'a month';

            $titles = [
                'reviewed'      => "Under review: {$job['title']}",
                'shortlisted'   => "You're shortlisted for {$job['title']}",
                'for_interview' => "Interview invitation: {$job['title']}",
                'interviewed'   => "Interview done: {$job['title']}",
                'offer'         => "Job offer: {$job['title']}",
                'hired'         => "You're hired: {$job['title']}",
                'rejected'      => "Update on your application: {$job['title']}",
            ];
            $msgs = [
                'reviewed'      => "Hi {$name}, {$company} is looking at your application for \"{$job['title']}\".",
                'shortlisted'   => "Good news, {$name}! {$company} added you to the shortlist for \"{$job['title']}\". They may invite you to an interview soon.",
                'for_interview' => "Hi {$name}, {$company} invited you to an interview for \"{$job['title']}\".\n\nWhen: {$when}"
                    . ($interview_notes ? "\nPlace and notes: {$interview_notes}" : '') . "\n\nIf you can't make it, message the employer in hanapbuhay.",
                'interviewed'   => "Hi {$name}, thank you for interviewing for \"{$job['title']}\". {$company} is now making a decision.",
                'offer'         => "Congratulations, {$name}! {$company} is offering you the job \"{$job['title']}\"."
                    . (!empty($extra['offer_salary']) ? "\nPay: ₱" . number_format((float) $extra['offer_salary'], 2) . " {$basis}" : '')
                    . (!empty($extra['offer_start']) ? "\nStart date: " . date('F j, Y', strtotime($extra['offer_start'])) : '')
                    . (!empty($extra['offer_details']) ? "\n" . $extra['offer_details'] : '')
                    . "\n\nOpen My Applications to accept or decline the offer.",
                'hired'         => "Congratulations, {$name}! {$company} hired you for \"{$job['title']}\". They will contact you about your start date and requirements."
                    . ($interview_notes ? "\n\nNext steps from the employer: {$interview_notes}" : ''),
                'rejected'      => "Hi {$name}, thank you for applying for \"{$job['title']}\". {$company} chose another applicant this time."
                    . ($note ? "\n\nFeedback from the employer: {$note}" : '')
                    . "\n\nOpen My Applications to see similar open jobs and training for the skills this job asked for.",
            ];

            $email = $this->application_model->create_notification(
                (int) $app['worker_id'],
                $status === 'hired' ? 'hired' : 'application_status',
                $titles[$status] ?? "Update: {$job['title']}",
                $msgs[$status] ?? \Hiring_status::FOR_WORKER[$status],
                '/dashboard/applied',
                $status !== 'reviewed'
            );

            // a text for the updates a worker must not miss, only when something actually changed
            $norm = fn($d) => substr((string) $d, 0, 16);
            $isNew = $app['status'] !== $status || $norm($interview_date) !== $norm($app['interview_date'] ?? '');
            if ($status === 'for_interview' && $isNew && array_key_exists('interview_reminded_at', $app)) {
                $this->db->table('applications')->where('id', (int) $id)->update(['interview_reminded_at' => null]);
            }
            if ($worker && $isNew && in_array($status, ['hired', 'for_interview', 'offer'], true)) {
                $t = mb_substr($job['title'], 0, 40);
                $c = mb_substr($company, 0, 35);
                if ($status === 'hired') $sms = "hanapbuhay: {$c} hired you for {$t}. Open the app for the next steps.";
                elseif ($status === 'offer') $sms = "hanapbuhay: {$c} sent you a job offer for {$t}. Open the app to accept or decline.";
                else $sms = "hanapbuhay: {$c} invited you to an interview for {$t}" . ($interview_date ? ' on ' . date('M j, g:i A', strtotime($interview_date)) : '') . '. Details in the app.';
                \Sms::notify($worker, $sms);
            }
        }

        $this->api->respond([
            'success' => true,
            'status'  => $status,
            'label'   => \Hiring_status::label($status),
            'email'   => $email ?? ['success' => false, 'mode' => 'failed', 'to' => null],
        ]);
    }

    /**
     * POST /api/applications/{id}/offer — the applicant answers a job offer.
     * Body: { action: accept | decline, reason? }. Accepting marks the application Hired.
     */
    public function respond_offer($id)
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $app = $this->application_model->find_by_id((int) $id);
        if (!$app || (int) $app['worker_id'] !== (int) $payload['sub']) $this->api->respond_error('We could not find that application.', 404);
        if ($app['status'] !== 'offer') $this->api->respond_error('There is no open job offer on this application.', 409);
        $b = $this->api->body();
        $action = (string) ($b['action'] ?? '');
        if (!in_array($action, ['accept', 'decline'], true)) $this->api->respond_error('Choose accept or decline.', 422);
        $reason = mb_substr(trim((string) ($b['reason'] ?? '')), 0, 500) ?: null;

        $now = date('Y-m-d H:i:s');
        $to = $action === 'accept' ? 'hired' : 'withdrawn';
        $upd = ['status' => $to, 'updated_at' => $now];
        if ($to === 'withdrawn') $upd['withdrawn_at'] = $now;
        if ($this->schema_info->has_column('applications', 'decided_at')) $upd['decided_at'] = $now;
        $this->db->table('applications')->where('id', (int) $id)->update($upd);
        \Hiring_status::log((int) $id, 'offer', $to, (int) $payload['sub'],
            $action === 'accept' ? 'Accepted the job offer' : ('Declined the job offer' . ($reason ? ": {$reason}" : '')));

        $job = $this->job_model->find_by_id((int) $app['job_id']);
        $worker = $this->user_model->find_by_id((int) $payload['sub']);
        if ($job) {
            $this->application_model->create_notification(
                (int) $job['employer_id'], 'application',
                $action === 'accept' ? "Offer accepted: {$job['title']}" : "Offer declined: {$job['title']}",
                ($worker['full_name'] ?? 'The applicant') . ($action === 'accept'
                    ? " accepted your job offer for \"{$job['title']}\". They are now marked as hired."
                    : " declined your job offer for \"{$job['title']}\"." . ($reason ? " Reason: {$reason}" : '')),
                '/dashboard/applicants'
            );
        }
        $this->api->respond(['success' => true, 'status' => $to, 'label' => \Hiring_status::label($to)]);
    }

    /** GET /api/applications/{id}/history — every step, for the applicant, the employer or an admin. */
    public function history($id)
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $app = $this->application_model->find_by_id((int) $id);
        if (!$app) $this->api->respond_error('We could not find that application.', 404);
        $viewer = $this->user_model->find_by_id((int) $payload['sub']);
        $job = $this->job_model->find_by_id((int) $app['job_id']);
        $allowed = (int) $app['worker_id'] === (int) $payload['sub']
            || ($job && (int) $job['employer_id'] === (int) $payload['sub'])
            || ($viewer['role'] ?? '') === 'admin';
        if (!$allowed) $this->api->respond_error('We could not find that application.', 404);
        $this->api->respond(['success' => true, 'history' => \Hiring_status::history((int) $id)]);
    }
}
