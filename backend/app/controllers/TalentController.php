<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Find Workers — the employer's side of the Skills Passport (migration 019).
 *
 *   GET    /api/talent                 search workers (skill or name, town, verified, work type, for_job)
 *   GET    /api/talent/saved           the employer's saved workers
 *   GET    /api/talent/{id}            one worker's full passport, as an employer sees it
 *   POST   /api/talent/{id}/unlock     spend one contact credit to see phone and email
 *   POST   /api/talent/{id}/save       save to the talent pool (optional private note)
 *   DELETE /api/talent/{id}/save       remove from the talent pool
 *   POST   /api/talent/{id}/invite     invite the worker to apply to one of your open jobs
 *
 * Only employers, clients (hirers) and admins can use it. Workers appear only while their
 * availability says "open to work". Phone and email are never in a search result: they show
 * once unlocked (one credit, once per worker, free on unlimited plans) or when the worker has
 * already applied to one of this employer's jobs.
 */
class TalentController extends Controller
{
    private const PER_PAGE = 20;
    private const TOWNS = ['Puerto Galera', 'San Teodoro', 'Baco', 'Calapan City', 'Naujan', 'Victoria', 'Socorro',
        'Pola', 'Pinamalayan', 'Gloria', 'Bansud', 'Bongabong', 'Roxas', 'Mansalay', 'Bulalacao'];
    private const TYPES = ['full-time', 'part-time', 'contractual', 'freelance', 'gig'];

    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->library('schema_info');
        $this->call->library('availability');
        $this->call->model('User_model', 'user_model');
        $this->call->model('Skill_model', 'skill_model');
        $this->call->model('Social_model', 'social_model');
        $this->call->model('Subscription_model', 'subscription_model');
        $this->call->model('Application_model', 'application_model');
        $this->call->model('Job_model', 'job_model');
    }

    /** The signed-in employer, client or admin. */
    private function hirer(): array
    {
        $payload = $this->api->require_jwt();
        $u = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$u || (int) ($u['is_active'] ?? 1) !== 1) $this->api->respond_error('Unauthorized', 401);
        $ok = ($u['role'] ?? '') === 'admin' || in_array($u['account_type'] ?? '', ['employer', 'hirer'], true);
        if (!$ok) $this->api->respond_error('Find Workers is for employers and clients.', 403);
        return $u;
    }

    private function ready(): bool
    {
        return $this->schema_info->has_table('talent_unlocks');
    }

    /** A worker who exists, is active, and is searchable. */
    private function worker(int $id): array
    {
        $w = $this->user_model->find_by_id($id);
        if (!$w || ($w['account_type'] ?? '') !== 'worker' || (int) ($w['is_active'] ?? 1) !== 1) {
            $this->api->respond_error('This worker is not available.', 404);
        }
        return $w;
    }

    /** Workers who applied to any of this employer's jobs (contact is free for them). */
    private function applied_ids(int $employerId): array
    {
        $rows = $this->db->raw(
            "SELECT DISTINCT a.worker_id FROM applications a JOIN jobs j ON j.id = a.job_id
             WHERE j.employer_id = ? AND a.status <> 'withdrawn'", [$employerId]
        )->fetchAll(PDO::FETCH_COLUMN) ?: [];
        // a client's gig: workers who sent a proposal or have a contract are free to contact too
        if ($this->schema_info->has_table('proposals')) {
            $more = $this->db->raw(
                "SELECT worker_id FROM proposals WHERE client_id = ? AND status <> 'withdrawn'
                 UNION SELECT worker_id FROM contracts WHERE client_id = ?", [$employerId, $employerId]
            )->fetchAll(PDO::FETCH_COLUMN) ?: [];
            $rows = array_merge($rows, $more);
        }
        return array_values(array_unique(array_map('intval', $rows)));
    }

    private function id_set(string $table, int $employerId): array
    {
        if (!$this->schema_info->has_table($table)) return [];
        $rows = $this->db->raw("SELECT worker_id FROM {$table} WHERE employer_id = ?", [$employerId])->fetchAll(PDO::FETCH_COLUMN) ?: [];
        return array_flip(array_map('intval', $rows));
    }

    /** Skills of many workers at once: id => [ [name, verified], … ] */
    private function skills_for(array $ids): array
    {
        if (!$ids) return [];
        $in = implode(',', array_fill(0, count($ids), '?'));
        $hasCerts = $this->schema_info->has_table('skill_certificates') && $this->schema_info->has_column('skills_passport', 'certificate_id');
        $sql = $hasCerts
            ? "SELECT s.user_id, s.skill_name, (s.verified = 1 OR c.status = 'verified') AS v
               FROM skills_passport s LEFT JOIN skill_certificates c ON c.id = s.certificate_id
               WHERE s.user_id IN ({$in}) ORDER BY v DESC, s.created_at DESC"
            : "SELECT user_id, skill_name, verified AS v FROM skills_passport WHERE user_id IN ({$in}) ORDER BY verified DESC, created_at DESC";
        $out = [];
        foreach ($this->db->raw($sql, $ids)->fetchAll(PDO::FETCH_ASSOC) ?: [] as $r) {
            $out[(int) $r['user_id']][] = ['name' => $r['skill_name'], 'verified' => (bool) $r['v']];
        }
        return $out;
    }

    /** The plan's contact credits: [left, unlimited] */
    private function credits(array $u): array
    {
        if (($u['role'] ?? '') === 'admin') return [0, true];
        return [max(0, (int) ($u['contact_credits'] ?? 0)), $this->subscription_model->contact_unlimited($u)];
    }

    private function card(array $u, array $skills, array $ratings, array $saved, array $unlocked, array $applied): array
    {
        $id = (int) $u['id'];
        $list = $skills[$id] ?? [];
        return [
            'id'            => $id,
            'full_name'     => $u['full_name'],
            'picture'       => $u['picture'] ?? null,
            'avatar_color'  => isset($u['avatar_color']) ? (int) $u['avatar_color'] : $id % 8,
            'location'      => $u['location'] ?? null,
            'bio'           => isset($u['bio']) ? mb_substr((string) $u['bio'], 0, 180) : null,
            'is_verified'   => (int) ($u['is_verified'] ?? 0) === 1,
            'availability'  => \Availability::from_row($u),
            'skills'        => array_slice($list, 0, 6),
            'skills_count'  => count($list),
            'verified_count'=> count(array_filter($list, fn($s) => $s['verified'])),
            'rating'        => $ratings[$id] ?? null,
            'saved'         => isset($saved[$id]),
            'unlocked'      => isset($unlocked[$id]) || in_array($id, $applied, true),
            'applied'       => in_array($id, $applied, true),
            'member_since'  => $u['created_at'] ?? null,
        ];
    }

    // ── GET /api/talent ─────────────────────────────────────
    public function index()
    {
        $this->api->require_method('GET');
        $me = $this->hirer();
        $mid = (int) $me['id'];

        $q      = trim((string) ($_GET['q'] ?? ''));
        $town   = trim((string) ($_GET['town'] ?? ''));
        $type   = trim((string) ($_GET['type'] ?? ''));
        $verOnly= filter_var($_GET['verified'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $forJob = (int) ($_GET['for_job'] ?? 0);
        $page   = max(1, (int) ($_GET['page'] ?? 1));

        $where = ["u.account_type = 'worker'", 'u.is_active = 1', "u.role <> 'admin'"];
        $args = [];
        $hasAvail = $this->schema_info->has_column('users', 'open_to_work');
        if ($hasAvail) $where[] = 'u.open_to_work = 1';
        if ($q !== '') {
            $like = '%' . addcslashes($q, '%_\\') . '%';
            $where[] = '(u.full_name LIKE ? OR u.bio LIKE ? OR EXISTS (SELECT 1 FROM skills_passport sp WHERE sp.user_id = u.id AND sp.skill_name LIKE ?))';
            array_push($args, $like, $like, $like);
        }
        if ($town !== '' && in_array($town, self::TOWNS, true)) {
            if ($hasAvail) { $where[] = '(u.location = ? OR FIND_IN_SET(?, REPLACE(u.preferred_towns, \', \', \',\')) > 0)'; array_push($args, $town, $town); }
            else { $where[] = 'u.location = ?'; $args[] = $town; }
        }
        if ($type !== '' && in_array($type, self::TYPES, true) && $hasAvail) {
            $where[] = '(u.work_types IS NULL OR u.work_types = \'\' OR FIND_IN_SET(?, REPLACE(u.work_types, \', \', \',\')) > 0)';
            $args[] = $type;
        }
        if ($verOnly) {
            $where[] = $this->schema_info->has_table('skill_certificates')
                ? "(u.is_verified = 1 OR EXISTS (SELECT 1 FROM skill_certificates c WHERE c.user_id = u.id AND c.status = 'verified'))"
                : 'u.is_verified = 1';
        }
        $cols = 'u.*';
        $whereSql = implode(' AND ', $where);

        $job = null;
        if ($forJob) {
            $job = $this->job_model->find_by_id($forJob);
            if (!$job || ((int) $job['employer_id'] !== $mid && ($me['role'] ?? '') !== 'admin')) $this->api->respond_error('Job not found.', 404);
        }

        if ($job) {
            // rank the best 200 candidates by the same matcher the workers see
            $rows = $this->db->raw("SELECT {$cols} FROM users u WHERE {$whereSql} ORDER BY u.is_verified DESC, u.created_at DESC LIMIT 200", $args)->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $this->call->library('job_matcher');
            foreach ($rows as &$r) {
                $r['_match'] = $this->job_matcher->score($r, $this->skill_model->get_skills_for_matching((int) $r['id']), $job);
            }
            unset($r);
            usort($rows, fn($a, $b) => [$b['_match']['score'], (int) $b['is_verified']] <=> [$a['_match']['score'], (int) $a['is_verified']]);
            $total = count($rows);
            $rows = array_slice($rows, ($page - 1) * self::PER_PAGE, self::PER_PAGE);
        } else {
            $total = (int) $this->db->raw("SELECT COUNT(*) FROM users u WHERE {$whereSql}", $args)->fetchColumn();
            $order = $town !== '' && in_array($town, self::TOWNS, true) ? 'CASE WHEN u.location = ? THEN 0 ELSE 1 END, ' : '';
            $orderArgs = $order ? [$town] : [];
            $offset = ($page - 1) * self::PER_PAGE;
            $rows = $this->db->raw(
                "SELECT {$cols} FROM users u WHERE {$whereSql}
                 ORDER BY {$order}u.is_verified DESC, (SELECT COUNT(*) FROM skills_passport sp WHERE sp.user_id = u.id) DESC, u.created_at DESC
                 LIMIT " . self::PER_PAGE . " OFFSET {$offset}", array_merge($args, $orderArgs)
            )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        }

        $ids = array_map(fn($r) => (int) $r['id'], $rows);
        $skills = $this->skills_for($ids);
        $ratings = $this->social_model->ratings_for_many($ids, 'worker');
        $saved = $this->id_set('talent_saved', $mid);
        $unlocked = $this->id_set('talent_unlocks', $mid);
        $applied = $this->applied_ids($mid);

        $out = [];
        foreach ($rows as $r) {
            $c = $this->card($r, $skills, $ratings, $saved, $unlocked, $applied);
            if (isset($r['_match'])) $c['match'] = ['score' => $r['_match']['score'], 'matched' => $r['_match']['matched'], 'missing' => $r['_match']['missing']];
            $out[] = $c;
        }
        [$left, $unlimited] = $this->credits($me);
        $this->api->respond([
            'success' => true,
            'workers' => $out,
            'total'   => $total,
            'page'    => $page,
            'pages'   => max(1, (int) ceil($total / self::PER_PAGE)),
            'per_page' => self::PER_PAGE,
            'credits' => ['left' => $left, 'unlimited' => $unlimited],
            'enabled' => $this->ready(),
            'job'     => $job ? ['id' => (int) $job['id'], 'title' => $job['title']] : null,
        ]);
    }

    // ── GET /api/talent/saved ───────────────────────────────
    public function saved()
    {
        $this->api->require_method('GET');
        $me = $this->hirer();
        $mid = (int) $me['id'];
        if (!$this->schema_info->has_table('talent_saved')) $this->api->respond(['success' => true, 'workers' => [], 'enabled' => false]);

        $rows = $this->db->raw(
            "SELECT u.*, ts.note AS _note, ts.created_at AS _saved_at FROM talent_saved ts JOIN users u ON u.id = ts.worker_id
             WHERE ts.employer_id = ? AND u.is_active = 1 ORDER BY ts.created_at DESC LIMIT 200", [$mid]
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $ids = array_map(fn($r) => (int) $r['id'], $rows);
        $skills = $this->skills_for($ids);
        $ratings = $this->social_model->ratings_for_many($ids, 'worker');
        $saved = array_flip($ids);
        $unlocked = $this->id_set('talent_unlocks', $mid);
        $applied = $this->applied_ids($mid);
        $out = array_map(function ($r) use ($skills, $ratings, $saved, $unlocked, $applied) {
            $c = $this->card($r, $skills, $ratings, $saved, $unlocked, $applied);
            $c['note'] = $r['_note'];
            $c['saved_at'] = $r['_saved_at'];
            return $c;
        }, $rows);
        [$left, $unlimited] = $this->credits($me);
        $this->api->respond(['success' => true, 'workers' => $out, 'credits' => ['left' => $left, 'unlimited' => $unlimited], 'enabled' => true]);
    }

    // ── GET /api/talent/{id} ────────────────────────────────
    public function show($id)
    {
        $this->api->require_method('GET');
        $me = $this->hirer();
        $mid = (int) $me['id'];
        $w = $this->worker((int) $id);
        $wid = (int) $w['id'];

        $applied = $this->applied_ids($mid);
        $unlocked = $this->id_set('talent_unlocks', $mid);
        $saved = $this->id_set('talent_saved', $mid);
        $skills = $this->skills_for([$wid]);
        $ratings = $this->social_model->ratings_for_many([$wid], 'worker');
        $card = $this->card($w, $skills, $ratings, $saved, $unlocked, $applied);
        $card['skills'] = $skills[$wid] ?? [];
        $card['bio'] = $w['bio'] ?? null;

        // certificates: the ones hanapbuhay checked, and the ones waiting (marked as such)
        $certs = [];
        if ($this->schema_info->has_table('skill_certificates')) {
            foreach ($this->skill_model->get_user_certificates($wid) as $c) {
                if (($c['status'] ?? '') === 'rejected') continue;
                $certs[] = ['title' => $c['title'], 'issuer' => $c['issuer'] ?? null, 'nc_level' => $c['nc_level'] ?? null,
                            'issued_on' => $c['issued_on'] ?? null, 'valid_until' => $c['valid_until'] ?? null, 'status' => $c['status'] ?? 'pending'];
            }
        }
        $work = [];
        if ($this->schema_info->has_table('work_samples')) {
            $work = $this->db->raw('SELECT id, title, description, skill_name, taken_on FROM work_samples WHERE user_id = ? ORDER BY created_at DESC LIMIT 24', [$wid])->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($work as &$x) { $x['id'] = (int) $x['id']; }
            unset($x);
        }
        $resume = $this->skill_model->get_resume($wid) ?: [];
        $reviews = [];
        if ($this->schema_info->has_table('worker_reviews')) {
            $reviews = $this->db->raw(
                "SELECT r.rating, r.comment, r.created_at, u.full_name AS employer_name FROM worker_reviews r JOIN users u ON u.id = r.employer_id
                 WHERE r.worker_id = ? AND r.is_hidden = 0 ORDER BY r.created_at DESC LIMIT 10", [$wid]
            )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        }
        $hired = (int) $this->db->raw("SELECT COUNT(*) FROM applications WHERE worker_id = ? AND status = 'hired'", [$wid])->fetchColumn();

        // contact: only once unlocked, or when they applied to you
        $contact = $card['unlocked'] ? ['phone' => $w['phone'] ?? null, 'email' => $w['email'] ?? null] : null;

        // your open jobs, and the ones this worker was already invited to
        $jobs = $this->db->raw("SELECT id, title FROM jobs WHERE employer_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 50", [$mid])->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $invited = [];
        if ($this->schema_info->has_table('talent_invites')) {
            $invited = array_map('intval', $this->db->raw('SELECT job_id FROM talent_invites WHERE employer_id = ? AND worker_id = ?', [$mid, $wid])->fetchAll(PDO::FETCH_COLUMN) ?: []);
        }

        [$left, $unlimited] = $this->credits($me);
        $this->api->respond([
            'success'      => true,
            'worker'       => $card + [
                'certificates' => $certs,
                'work'         => $work,
                'experience'   => array_slice((array) ($resume['experience'] ?? []), 0, 8),
                'education'    => array_slice((array) ($resume['education'] ?? []), 0, 5),
                'languages'    => $resume['languages'] ?? null,
                'reviews'      => $reviews,
                'hired_count'  => $hired,
                'contact'      => $contact,
            ],
            'jobs'         => array_map(fn($j) => ['id' => (int) $j['id'], 'title' => $j['title'], 'invited' => in_array((int) $j['id'], $invited, true)], $jobs),
            'credits'      => ['left' => $left, 'unlimited' => $unlimited],
            'enabled'      => $this->ready(),
        ]);
    }

    // ── POST /api/talent/{id}/unlock ────────────────────────
    public function unlock($id)
    {
        $this->api->require_method('POST');
        $me = $this->hirer();
        $mid = (int) $me['id'];
        if (!$this->ready()) $this->api->respond_error('Contact unlocks are not available yet. Please try again later.', 503);
        $w = $this->worker((int) $id);
        $wid = (int) $w['id'];
        $this->api->rate_limit('talent_unlock_' . $mid, 60, 3600);

        $contact = ['phone' => $w['phone'] ?? null, 'email' => $w['email'] ?? null];
        $already = (bool) $this->db->raw('SELECT 1 FROM talent_unlocks WHERE employer_id = ? AND worker_id = ?', [$mid, $wid])->fetchColumn();
        if ($already || in_array($wid, $this->applied_ids($mid), true)) {
            [$left, $unlimited] = $this->credits($me);
            $this->api->respond(['success' => true, 'contact' => $contact, 'charged' => false, 'credits' => ['left' => $left, 'unlimited' => $unlimited]]);
        }

        [$left, $unlimited] = $this->credits($me);
        $charged = false;
        if (!$unlimited) {
            // take the credit and record the unlock together, so a double click is charged once
            $this->db->raw('START TRANSACTION');
            $st = $this->db->raw('UPDATE users SET contact_credits = contact_credits - 1 WHERE id = ? AND contact_credits > 0', [$mid]);
            if ($st->rowCount() < 1) {
                $this->db->raw('ROLLBACK');
                $this->api->respond(['error' => 'You have no contact credits left. Upgrade your plan to unlock more workers. Workers who apply to your jobs are always free to contact.', 'status' => 402, 'code' => 'no_credits'], 402);
            }
            $this->db->raw('INSERT IGNORE INTO talent_unlocks (employer_id, worker_id, created_at) VALUES (?, ?, NOW())', [$mid, $wid]);
            $this->db->raw('COMMIT');
            $charged = true;
            $left--;
        } else {
            $this->db->raw('INSERT IGNORE INTO talent_unlocks (employer_id, worker_id, created_at) VALUES (?, ?, NOW())', [$mid, $wid]);
        }
        $this->api->respond(['success' => true, 'contact' => $contact, 'charged' => $charged, 'credits' => ['left' => max(0, $left), 'unlimited' => $unlimited]]);
    }

    // ── POST / DELETE /api/talent/{id}/save ─────────────────
    public function save($id)
    {
        $me = $this->hirer();
        $mid = (int) $me['id'];
        if (!$this->schema_info->has_table('talent_saved')) $this->api->respond_error('Saving workers is not available yet.', 503);
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        if ($method === 'DELETE') {
            $this->db->raw('DELETE FROM talent_saved WHERE employer_id = ? AND worker_id = ?', [$mid, (int) $id]);
            $this->api->respond(['success' => true, 'saved' => false]);
        }
        $this->api->require_method('POST');
        $w = $this->worker((int) $id);
        $b = $this->api->body();
        $note = mb_substr(trim((string) ($b['note'] ?? '')), 0, 500) ?: null;
        $this->db->raw(
            'INSERT INTO talent_saved (employer_id, worker_id, note, created_at) VALUES (?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE note = COALESCE(VALUES(note), note)', [$mid, (int) $w['id'], $note]
        );
        $this->api->respond(['success' => true, 'saved' => true, 'note' => $note]);
    }

    // ── GET /api/invites/mine (worker) ──────────────────────
    /** Invitations to apply that a worker received and has not acted on yet. */
    public function mine()
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        if (!$this->schema_info->has_table('talent_invites')) $this->api->respond(['success' => true, 'invites' => []]);
        $rows = $this->db->raw(
            "SELECT i.id, i.job_id, i.message, i.created_at, j.title, j.company, j.location, u.full_name AS employer_name
             FROM talent_invites i JOIN jobs j ON j.id = i.job_id JOIN users u ON u.id = i.employer_id
             WHERE i.worker_id = ? AND j.status = 'active'
               AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.job_id = i.job_id AND a.worker_id = i.worker_id AND a.status <> 'withdrawn')
             ORDER BY i.created_at DESC LIMIT 10", [(int) $payload['sub']]
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) { $r['id'] = (int) $r['id']; $r['job_id'] = (int) $r['job_id']; }
        unset($r);
        $this->api->respond(['success' => true, 'invites' => $rows]);
    }

    // ── POST /api/talent/{id}/invite ────────────────────────
    public function invite($id)
    {
        $this->api->require_method('POST');
        $me = $this->hirer();
        $mid = (int) $me['id'];
        if (!$this->schema_info->has_table('talent_invites')) $this->api->respond_error('Invitations are not available yet.', 503);
        $this->api->rate_limit('talent_invite_' . $mid, 40, 86400);
        $w = $this->worker((int) $id);
        $b = $this->api->body();
        $jobId = (int) ($b['job_id'] ?? 0);
        $job = $this->job_model->find_by_id($jobId);
        if (!$job || (int) $job['employer_id'] !== $mid) $this->api->respond_error('Choose one of your job posts.', 422);
        if (($job['status'] ?? '') !== 'active') $this->api->respond_error('That job post is closed. Reopen it before inviting workers.', 422);

        $already = $this->db->raw('SELECT 1 FROM talent_invites WHERE job_id = ? AND worker_id = ?', [$jobId, (int) $w['id']])->fetchColumn();
        if ($already) $this->api->respond_error('You already invited this worker to that job.', 409);
        $appliedHere = $this->db->raw("SELECT 1 FROM applications WHERE job_id = ? AND worker_id = ? AND status <> 'withdrawn'", [$jobId, (int) $w['id']])->fetchColumn();
        if ($appliedHere) $this->api->respond_error('This worker already applied to that job.', 409);

        $msg = mb_substr(trim((string) ($b['message'] ?? '')), 0, 500) ?: null;
        $this->db->raw('INSERT INTO talent_invites (employer_id, worker_id, job_id, message, created_at) VALUES (?, ?, ?, ?, NOW())', [$mid, (int) $w['id'], $jobId, $msg]);

        $from = trim((string) ($job['company'] ?? '')) ?: ($me['full_name'] ?? 'An employer');
        $this->application_model->create_notification(
            (int) $w['id'],
            'invite',
            "{$from} invited you to apply: {$job['title']}",
            "{$from} saw your Skills Passport and invited you to apply for \"{$job['title']}\""
                . (!empty($job['location']) ? " in {$job['location']}" : '') . '.'
                . ($msg ? "\n\nTheir message: \"{$msg}\"" : '')
                . "\n\nOpen the job to read the details and apply.",
            '/dashboard/browse/' . $jobId
        );
        $this->api->respond(['success' => true]);
    }
}
