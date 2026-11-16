<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * /api/admin — Admin-only endpoints.
 */
class AdminController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->model('User_model', 'user_model');
        $this->call->model('Job_model', 'job_model');
        $this->call->model('Application_model', 'application_model');
        $this->call->model('Skill_model', 'skill_model');
        $this->call->library('firebase_db');
    }

    /* Help & Support lives in Firebase (see SupportController). These counts never fail a page:
       they return null/0 when Firebase isn't configured or can't be reached. */

    /** Requests waiting for the team, or null when support isn't available. */
    private function support_waiting(): ?int
    {
        if (!Firebase_db::is_configured()) return null;
        try {
            $open = Firebase_db::get('support/open', ['shallow' => 'true']);
            return is_array($open) ? count($open) : 0;
        } catch (Throwable $e) {
            error_log('[Support count] ' . $e->getMessage());
            return null;
        }
    }

    /** This user's requests with a reply they haven't read. */
    private function support_unread(int $uid): int
    {
        // a reply or resolve always leaves a 'support' notification, so most users skip the Firebase call
        $any = (int) $this->db->raw("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND type = 'support'", [$uid])->fetchColumn();
        if (!$any || !Firebase_db::is_configured()) return 0;
        try {
            $mine = Firebase_db::get("support/users/{$uid}") ?: [];
            return count(array_filter($mine, fn($t) => is_array($t) && !empty($t['userUnread'])));
        } catch (Throwable $e) {
            error_log('[Support count] ' . $e->getMessage());
            return 0;
        }
    }

    private function require_admin(): array
    {
        $payload = $this->api->require_jwt();
        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user || $user['role'] !== 'admin') $this->api->respond_error('Admin only.', 403);
        return $user;
    }

    // GET /api/admin/reports?status=open|reviewed|dismissed|all
    public function reports()
    {
        $this->api->require_method('GET');
        $this->require_admin();

        // job_reports comes from migration 012; until then reports arrive as admin notifications only
        $this->call->library('schema_info');
        if (!$this->schema_info->has_table('job_reports')) {
            $this->api->respond(['success' => true, 'enabled' => false, 'reports' => [], 'counts' => ['open' => 0, 'reviewed' => 0, 'dismissed' => 0]]);
        }

        $status = (string) ($_GET['status'] ?? 'open');
        $allowed = ['open', 'reviewed', 'dismissed', 'all'];
        if (!in_array($status, $allowed, true)) $status = 'open';

        $q = $this->db->table('job_reports r')
            ->select('r.id, r.job_id, r.reason, r.status, r.created_at, '
                . 'j.title AS job_title, j.company AS job_company, j.status AS job_status, j.employer_id, '
                . 'u.full_name AS reporter_name, u.email AS reporter_email, e.full_name AS employer_name')
            ->join('jobs j', 'j.id = r.job_id', 'LEFT')
            ->join('users u', 'u.id = r.reporter_id', 'LEFT')
            ->join('users e', 'e.id = j.employer_id', 'LEFT');
        if ($status !== 'all') $q->where('r.status', $status);
        $rows = $q->order_by('r.created_at DESC')->limit(200)->get_all() ?: [];

        $counts = ['open' => 0, 'reviewed' => 0, 'dismissed' => 0];
        foreach ($this->db->raw('SELECT status, COUNT(*) AS c FROM job_reports GROUP BY status')->fetchAll(\PDO::FETCH_ASSOC) as $r) {
            if (isset($counts[$r['status']])) $counts[$r['status']] = (int) $r['c'];
        }

        $this->api->respond(['success' => true, 'reports' => $rows, 'counts' => $counts]);
    }

    // PATCH /api/admin/reports/{id}  { status: reviewed|dismissed|open, action: none|archive_job }
    public function update_report($id)
    {
        $this->api->require_method('PATCH');
        $admin = $this->require_admin();
        $this->call->library('schema_info');
        if (!$this->schema_info->has_table('job_reports')) $this->api->respond_error('Report not found.', 404);

        $report = $this->db->table('job_reports')->where('id', (int) $id)->get();
        if (!$report) $this->api->respond_error('Report not found.', 404);

        $b = $this->api->body();
        $status = (string) ($b['status'] ?? 'reviewed');
        $action = (string) ($b['action'] ?? 'none');
        if (!in_array($status, ['open', 'reviewed', 'dismissed'], true)) $this->api->respond_error('Invalid status.', 422);
        if (!in_array($action, ['none', 'archive_job'], true)) $this->api->respond_error('Invalid action.', 422);

        $job = $this->job_model->find_by_id((int) $report['job_id']);
        if ($action === 'archive_job') {
            if (!$job) $this->api->respond_error('The job no longer exists.', 404);
            $this->job_model->archive_job((int) $job['id']);

            // Tell the employer in-app (no email) so they know why the post disappeared
            try {
                $this->application_model->create_notification(
                    (int) $job['employer_id'],
                    'system',
                    "Job post removed: {$job['title']}",
                    "Your job post \"{$job['title']}\" was removed after a review by the hanapbuhay team. If you think this is a mistake, send a request in Help & Support.",
                    '/dashboard/jobs',
                    false
                );
            } catch (\Throwable $e) {
                error_log('[Report Action Notify Error] ' . $e->getMessage());
            }
        }

        $this->db->table('job_reports')->where('job_id', (int) $report['job_id'])->update(['status' => $status]);
        // A job-level action resolves every open report on the same job
        if ($action === 'archive_job') {
            $this->db->table('job_reports')->where('job_id', (int) $report['job_id'])->update(['status' => 'reviewed']);
        }

        $this->api->respond(['success' => true, 'reviewed_by' => (int) $admin['id']]);
    }

    // GET /api/admin/stats
    public function stats()
    {
        $this->api->require_method('GET');
        $this->require_admin();

        $totalUsers    = $this->user_model->count_users();
        $activeUsers   = $this->user_model->count_active_users();
        $inactiveUsers = $this->user_model->count_inactive_users();
        $byLocation    = $this->user_model->count_by_location();
        $recentRegs    = $this->user_model->registrations_last_30_days();

        // workers / employers / hirers are account types; "role" is only admin vs user
        $roleMap = $this->user_model->count_by_account_type();

        // Revenue and Subscription metrics
        $subRows = $this->db->table('subscriptions')
            ->select('price, status, created_at')
            ->get_all() ?: [];
        $total_rev = 0;
        $active_subs = 0;
        foreach ($subRows as $s) {
            if ($s['status'] === 'active' || $s['status'] === 'paid' || $s['status'] === 'superseded') {
                $total_rev += (float) ($s['price'] ?? 0);
            }
            if ($s['status'] === 'active') {
                $active_subs++;
            }
        }

        $this->api->respond([
            'success'        => true,
            'users'          => $totalUsers,
            'active_users'   => $activeUsers,
            'inactive_users' => $inactiveUsers,
            'users_by_role'  => $roleMap,
            'users_by_location' => $byLocation,
            'registrations_30d' => $recentRegs,
            'jobs'           => $this->job_model->count_active(),
            'applications'   => $this->application_model->count_applications(),
            'total_revenue'      => $total_rev,
            'active_subscribers' => $active_subs,
        ]);
    }

    /** One count query with an optional "created since" bound. */
    private function count_rows(string $sql, array $args = []): int
    {
        return (int) ($this->db->raw($sql, $args)->fetchColumn() ?: 0);
    }

    /**
     * Count for a table that may not exist yet (e.g. skill_certificates before
     * migration 015 runs): null instead of a database error page.
     */
    private function count_optional(string $table, string $sql, array $args = []): ?int
    {
        // (raw() shows an error page and exits on SQL errors, so check first instead of catching)
        $exists = $this->count_rows(
            'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
            [$table]
        );
        return $exists ? $this->count_rows($sql, $args) : null;
    }

    /** Rows per calendar day since $since, with every day present (zeros filled in). */
    private function daily_counts(string $table, string $since, int $days, string $extraWhere = ''): array
    {
        $rows = $this->db->raw(
            "SELECT DATE(created_at) AS d, COUNT(*) AS c FROM {$table} WHERE created_at >= ? {$extraWhere} GROUP BY DATE(created_at)",
            [$since]
        )->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];
        $out = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $d = date('Y-m-d', strtotime("-{$i} days"));
            $out[$d] = (int) ($rows[$d] ?? 0);
        }
        return $out;
    }

    // GET /api/admin/overview?days=7|30|90 — everything the admin home page shows, in one call
    public function overview()
    {
        $this->api->require_method('GET');
        $this->require_admin();

        $days = (int) ($_GET['days'] ?? 30);
        if (!in_array($days, [7, 30, 90], true)) $days = 30;
        // start of the first day in the range, in the same clock the app writes created_at with
        $since = date('Y-m-d 00:00:00', strtotime('-' . ($days - 1) . ' days'));
        $paid  = "status IN ('active','paid','superseded')"; // same rule as the Payments page

        $totals = [
            'users'              => $this->count_rows("SELECT COUNT(*) FROM users WHERE role <> 'admin'"),
            'users_new'          => $this->count_rows("SELECT COUNT(*) FROM users WHERE role <> 'admin' AND created_at >= ?", [$since]),
            'active_jobs'        => $this->count_rows("SELECT COUNT(*) FROM jobs WHERE status = 'active'"),
            'jobs_new'           => $this->count_rows("SELECT COUNT(*) FROM jobs WHERE created_at >= ?", [$since]),
            'applications'       => $this->count_rows('SELECT COUNT(*) FROM applications'),
            'applications_new'   => $this->count_rows('SELECT COUNT(*) FROM applications WHERE created_at >= ?', [$since]),
            'hired'              => $this->count_rows("SELECT COUNT(*) FROM applications WHERE status = 'hired'"),
            'hired_new'          => $this->count_rows("SELECT COUNT(*) FROM applications WHERE status = 'hired' AND COALESCE(updated_at, created_at) >= ?", [$since]),
            'revenue'            => (float) ($this->db->raw("SELECT COALESCE(SUM(price), 0) FROM subscriptions WHERE {$paid}")->fetchColumn() ?: 0),
            'revenue_new'        => (float) ($this->db->raw("SELECT COALESCE(SUM(price), 0) FROM subscriptions WHERE {$paid} AND created_at >= ?", [$since])->fetchColumn() ?: 0),
            'active_subscribers' => $this->count_rows("SELECT COUNT(*) FROM subscriptions WHERE status = 'active'"),
        ];

        // Things an admin should act on, each with the page that handles it
        $attention = [
            'support_waiting'      => $this->support_waiting(),
            'open_reports'         => $this->count_optional('job_reports', "SELECT COUNT(*) FROM job_reports WHERE status = 'open'"),
            'unverified_workers'   => $this->count_rows("SELECT COUNT(*) FROM users WHERE role <> 'admin' AND is_active = 1 AND account_type = 'worker' AND COALESCE(is_verified, 0) = 0"),
            'unverified_employers' => $this->count_rows("SELECT COUNT(*) FROM users WHERE role <> 'admin' AND is_active = 1 AND account_type IN ('employer','hirer') AND COALESCE(is_verified, 0) = 0"),
            'pending_certificates' => $this->count_optional('skill_certificates', "SELECT COUNT(*) FROM skill_certificates WHERE status = 'pending'"),
            'pending_payments'     => $this->count_rows("SELECT COUNT(*) FROM subscriptions WHERE status = 'pending'"),
            'inactive_users'       => $this->count_rows('SELECT COUNT(*) FROM users WHERE is_active = 0'),
        ];

        $byType = $this->user_model->count_by_account_type();
        $towns = $this->db->raw(
            "SELECT location AS town, COUNT(*) AS count FROM users
             WHERE role <> 'admin' AND location IS NOT NULL AND location <> ''
             GROUP BY location ORDER BY count DESC, location ASC LIMIT 8"
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $usersDaily = $this->daily_counts('users', $since, $days, "AND role <> 'admin'");
        $appsDaily  = $this->daily_counts('applications', $since, $days);
        $daily = [];
        foreach ($usersDaily as $d => $n) $daily[] = ['date' => $d, 'users' => $n, 'applications' => $appsDaily[$d] ?? 0];

        $recentUsers = $this->db->raw(
            "SELECT id, full_name, email, account_type, location, is_active, COALESCE(is_verified, 0) AS is_verified, created_at
             FROM users WHERE role <> 'admin' ORDER BY created_at DESC LIMIT 6"
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $recentJobs = $this->db->raw(
            "SELECT j.id, j.title, j.company, j.location, j.status, j.created_at, u.full_name AS employer_name,
                    (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applicants
             FROM jobs j LEFT JOIN users u ON u.id = j.employer_id
             ORDER BY j.created_at DESC LIMIT 6"
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $this->api->respond([
            'success'       => true,
            'days'          => $days,
            'since'         => substr($since, 0, 10),
            'totals'        => $totals,
            'attention'     => $attention,
            'users_by_type' => $byType,
            'users_by_town' => array_map(fn($r) => ['town' => $r['town'], 'count' => (int) $r['count']], $towns),
            'daily'         => $daily,
            'recent_users'  => $recentUsers,
            'recent_jobs'   => $recentJobs,
        ]);
    }

    // GET /api/admin/users
    public function users()
    {
        $this->api->require_method('GET');
        $this->require_admin();
        $q      = trim((string) ($_GET['q'] ?? ''));
        $role   = trim((string) ($_GET['role'] ?? ''));
        $status = trim((string) ($_GET['status'] ?? ''));
        $limit  = min((int) ($_GET['limit'] ?? 100), 500);
        $rows   = $this->user_model->search_users($q, $role, $limit, $status);
        $this->api->respond(['success' => true, 'users' => $rows ?: []]);
    }

    // GET /api/admin/users/:id
    public function user_detail($id)
    {
        $this->api->require_method('GET');
        $this->require_admin();
        $user = $this->user_model->get_user_detail((int) $id);
        if (!$user) $this->api->respond_error('User not found.', 404);

        // Fetch the user's jobs if employer
        $jobs = [];
        if ($user['role'] === 'employer' || $user['account_type'] === 'employer') {
            $jobs = $this->job_model->get_employer_jobs((int) $id);
        }

        // Fetch recent applications if worker
        $applications = [];
        $skills = [];
        if ($user['role'] !== 'admin' && $user['account_type'] !== 'employer') {
            try {
                $applications = $this->application_model->get_user_applications((int) $id) ?: [];
            } catch (\Exception $e) {
                $applications = [];
            }
            try {
                $skills = $this->skill_model->get_user_skills((int) $id) ?: [];
            } catch (\Exception $e) {
                $skills = [];
            }
        }

        $this->api->respond([
            'success'      => true,
            'user'         => $user,
            'jobs'         => $jobs,
            'applications' => $applications,
            'skills'       => $skills,
        ]);
    }

    // PATCH /api/admin/users/:id/verify
    public function verify_user($id)
    {
        $this->api->require_method('PATCH');
        $this->require_admin();
        $user = $this->user_model->find_by_id((int) $id);
        if (!$user) $this->api->respond_error('User not found.', 404);

        $data = $this->api->body() ?: [];
        $new_verified = isset($data['is_verified']) ? ($data['is_verified'] ? 1 : 0) : ((int)($user['is_verified'] ?? 0) === 1 ? 0 : 1);

        $admin = $this->require_admin();
        $reason = mb_substr(trim((string) ($data['reason'] ?? '')), 0, 500) ?: null;
        if ($new_verified === 0 && !$reason) $this->api->respond_error('Write the reason for removing the badge. The person will see it.', 422);
        require_once APP_DIR . 'libraries' . DIRECTORY_SEPARATOR . 'Verification_log.php';
        \Verification_log::record((int) $id, null, $new_verified ? 'approved' : 'revoked', $user['verification_status'] ?? null,
            $new_verified ? 'verified' : 'unverified', $reason ?? 'Verified directly by an administrator', (int) $admin['id']);

        $this->application_model->create_notification(
            (int) $id,
            'system',
            $new_verified ? 'Your account is verified' : 'Your verified badge was removed',
            $new_verified
                ? 'Our team verified your account. Your profile now shows the Verified badge.'
                : "Our team removed your verified badge. Reason: {$reason} Contact support if you think this is a mistake.",
            '/dashboard/verification'
        );

        $this->api->respond([
            'success'     => true,
            'is_verified' => $new_verified,
            'message'     => $new_verified === 1 ? 'Account verified.' : 'Verified badge removed.'
        ]);
    }

    // GET /api/admin/certificates?status=pending|verified|rejected|all — the review queue
    public function certificates()
    {
        $this->api->require_method('GET');
        $this->require_admin();
        $status = (string) ($_GET['status'] ?? 'pending');
        if (!in_array($status, ['pending', 'verified', 'rejected', 'all'], true)) $status = 'pending';

        $exists = (int) $this->db->raw("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'skill_certificates'")->fetchColumn();
        if (!$exists) $this->api->respond(['success' => true, 'certificates' => [], 'counts' => ['pending' => 0, 'verified' => 0, 'rejected' => 0]]);
        $hasReview = (int) $this->db->raw("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'skill_certificates' AND column_name = 'review_note'")->fetchColumn();

        $sql = 'SELECT c.id, c.user_id, c.title, c.issuer, c.nc_level, c.cert_number, c.holder_name, c.issued_on, c.valid_until,
                       c.file_name, c.file_mime, c.status, c.created_at' . ($hasReview ? ', c.review_note, c.reviewed_at' : '') . ',
                       u.full_name, u.email, u.location, COALESCE(u.is_verified, 0) AS user_verified
                FROM skill_certificates c JOIN users u ON u.id = c.user_id'
            . ($status === 'all' ? '' : ' WHERE c.status = ?')
            . ' ORDER BY ' . ($status === 'pending' ? 'c.created_at ASC' : 'c.created_at DESC') . ' LIMIT 300';
        $rows = $this->db->raw($sql, $status === 'all' ? [] : [$status])->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $counts = ['pending' => 0, 'verified' => 0, 'rejected' => 0];
        foreach ($this->db->raw('SELECT status, COUNT(*) AS c FROM skill_certificates GROUP BY status')->fetchAll(PDO::FETCH_ASSOC) as $r) {
            if (isset($counts[$r['status']])) $counts[$r['status']] = (int) $r['c'];
        }
        $this->api->respond(['success' => true, 'certificates' => $rows, 'counts' => $counts]);
    }

    // PATCH /api/admin/certificates/:id { status: verified|rejected|pending, note }
    public function review_certificate($id)
    {
        $this->api->require_method('PATCH');
        $admin = $this->require_admin();
        $cert = $this->skill_model->find_certificate((int) $id);
        if (!$cert) $this->api->respond_error('Certificate not found.', 404);

        $b = $this->api->body();
        $status = (string) ($b['status'] ?? '');
        if (!in_array($status, ['verified', 'rejected', 'pending'], true)) $this->api->respond_error('Choose verified, rejected or pending.', 422);
        $note = mb_substr(trim((string) ($b['note'] ?? '')), 0, 500);
        if ($status === 'rejected' && mb_strlen($note) < 5) $this->api->respond_error('Tell the worker why the certificate was rejected.', 422);

        $data = ['status' => $status];
        $hasReview = (int) $this->db->raw("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'skill_certificates' AND column_name = 'review_note'")->fetchColumn();
        if ($hasReview) $data += ['review_note' => $note ?: null, 'reviewed_at' => date('Y-m-d H:i:s'), 'reviewed_by' => (int) $admin['id']];
        $this->db->table('skill_certificates')->where('id', (int) $id)->update($data);
        // the skill(s) proven by this certificate become "verified" only while it is approved
        $this->db->table('skills_passport')->where('certificate_id', (int) $id)->update(['verified' => $status === 'verified' ? 1 : 0]);

        if ($status !== 'pending') {
            try {
                $this->application_model->create_notification(
                    (int) $cert['user_id'],
                    'certificate',
                    $status === 'verified' ? "Certificate verified: {$cert['title']}" : "Certificate not accepted: {$cert['title']}",
                    $status === 'verified'
                        ? "Your certificate for \"{$cert['title']}\" was checked by the hanapbuhay team. The skill now shows as Verified to employers and counts more in your job matches."
                        : "Your certificate for \"{$cert['title']}\" could not be verified.\n\nReason: {$note}\n\nYou can upload a clearer photo or a different certificate in your Skills Passport.",
                    '/dashboard/passport'
                );
            } catch (\Throwable $e) {
                error_log('[review_certificate notify] ' . $e->getMessage());
            }
        }
        $this->api->respond(['success' => true, 'certificate' => $this->skill_model->find_certificate((int) $id)]);
    }

    // PATCH /api/admin/users/:id/toggle
    public function toggle_user($id)
    {
        $this->api->require_method('PATCH');
        $this->require_admin();
        $new_status = $this->user_model->toggle_status((int) $id);
        if ($new_status === null) $this->api->respond_error('User not found.', 404);
        $this->api->respond(['success' => true, 'is_active' => $new_status]);
    }

    // DELETE /api/admin/users/:id (soft delete — sets is_active = 0)
    public function delete_user($id)
    {
        $this->api->require_method('DELETE');
        $admin = $this->require_admin();
        if ((int) $id === (int) $admin['id']) {
            $this->api->respond_error('You cannot delete your own admin account.', 403);
        }
        $user = $this->user_model->find_by_id((int) $id);
        if (!$user) $this->api->respond_error('User not found.', 404);
        $this->user_model->update_user((int) $id, ['is_active' => 0]);
        $this->api->respond(['success' => true, 'message' => 'User account deactivated.']);
    }

    // GET /api/admin/jobs
    public function jobs()
    {
        $this->api->require_method('GET');
        $this->require_admin();
        $rows = $this->job_model->get_all_admin_jobs(200);
        $this->api->respond(['success' => true, 'jobs' => $rows ?: []]);
    }

    // GET /api/admin/analytics
    public function analytics()
    {
        $this->api->require_method('GET');
        $this->require_admin();

        $recentRegs    = $this->user_model->registrations_last_30_days();
        $byLocation    = $this->user_model->count_by_location();

        // workers / employers / hirers are account types; "role" is only admin vs user
        $roleMap = $this->user_model->count_by_account_type();

        $this->api->respond([
            'success'           => true,
            'registrations_30d' => $recentRegs,
            'users_by_role'     => $roleMap,
            'users_by_location' => $byLocation,
            'total_users'       => $this->user_model->count_users(),
            'active_users'      => $this->user_model->count_active_users(),
            'inactive_users'    => $this->user_model->count_inactive_users(),
            'total_jobs'        => $this->job_model->count_active(),
            'total_apps'        => $this->application_model->count_applications(),
        ]);
    }

    // GET /api/notifications
    public function notifications()
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $uid = (int) $payload['sub'];
        // due interview reminders ride on this poll (does real work at most every 10 minutes)
        require_once APP_DIR . 'libraries' . DIRECTORY_SEPARATOR . 'Reminders.php';
        try { \Reminders::run(); } catch (\Throwable $e) { error_log('[Reminders] ' . $e->getMessage()); }
        $rows = $this->application_model->get_user_notifications($uid, 30);

        if (isset($_GET['mark_read']) && $_GET['mark_read'] === '1') {
            $this->application_model->mark_notifications_read($uid);
        }

        // Help & Support badge in the sidebar (rides on this 30-second poll, no extra request):
        // admins: requests waiting for the team; users: requests with a reply they haven't read
        $me = $this->user_model->find_by_id($uid);
        $support = ($me['role'] ?? '') === 'admin' ? $this->support_waiting() : $this->support_unread($uid);

        $this->api->respond(['success' => true, 'notifications' => $rows ?: [], 'support_unread' => (int) $support]);
    }

    // POST /api/notifications/mark-read
    public function mark_notifications_read()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $uid = (int) $payload['sub'];
        $this->application_model->mark_notifications_read($uid);
        $this->api->respond(['success' => true]);
    }

    // GET /api/admin/payments
    public function payments()
    {
        $this->api->require_method('GET');
        $this->require_admin();

        $rows = $this->db->table('subscriptions s')
            ->select('s.*, u.full_name, u.email, u.phone, u.picture, u.role, u.account_type AS user_account_type')
            ->join('users u', 'u.id = s.user_id', 'LEFT')
            ->order_by('s.created_at DESC')
            ->get_all();

        $rows = $rows ?: [];

        $total_revenue = 0;
        $total_active = 0;
        $paymongo_count = 0;
        $month_revenue = 0;
        $current_month = date('Y-m');

        foreach ($rows as $r) {
            $price = (float) ($r['price'] ?? 0);
            if ($r['status'] === 'active' || $r['status'] === 'paid' || $r['status'] === 'superseded') {
                $total_revenue += $price;
                if (str_starts_with($r['created_at'], $current_month)) {
                    $month_revenue += $price;
                }
            }
            if ($r['status'] === 'active') {
                $total_active++;
            }
            if (str_contains(strtolower($r['payment_method'] ?? ''), 'paymongo') || str_contains(strtolower($r['payment_reference'] ?? ''), 'cs_')) {
                $paymongo_count++;
            }
        }

        $this->api->respond([
            'success'  => true,
            'summary'  => [
                'total_revenue'         => $total_revenue,
                'month_revenue'         => $month_revenue,
                'total_transactions'    => count($rows),
                'active_subscriptions'  => $total_active,
                'paymongo_transactions' => $paymongo_count,
            ],
            'payments' => $rows
        ]);
    }

    /**
     * GET /api/admin/applications?status= — monitor every job application across employers:
     * where each one stands in the hiring pipeline, and how long it has been there.
     */
    public function applications()
    {
        $this->api->require_method('GET');
        $this->require_admin();
        $status = (string) ($_GET['status'] ?? '');
        $valid = ['pending', 'reviewed', 'shortlisted', 'for_interview', 'interviewed', 'offer', 'hired', 'rejected', 'withdrawn'];
        $where = in_array($status, $valid, true) ? 'WHERE a.status = ?' : '';
        $rows = $this->db->raw(
            "SELECT a.id, a.status, a.match_score, a.created_at, a.updated_at, a.interview_date, j.id AS job_id, j.title AS job_title,
                    e.full_name AS employer_name, w.full_name AS worker_name, w.id AS worker_id, e.id AS employer_id,
                    DATEDIFF(NOW(), COALESCE(a.updated_at, a.created_at)) AS days_in_step
             FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users e ON e.id = j.employer_id JOIN users w ON w.id = a.worker_id
             {$where} ORDER BY COALESCE(a.updated_at, a.created_at) DESC LIMIT 300", $where ? [$status] : []
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $counts = [];
        foreach ($this->db->raw('SELECT status, COUNT(*) n FROM applications GROUP BY status')->fetchAll(PDO::FETCH_ASSOC) ?: [] as $c) $counts[$c['status']] = (int) $c['n'];
        $stale = (int) $this->db->raw("SELECT COUNT(*) FROM applications WHERE status IN ('pending','reviewed') AND COALESCE(updated_at, created_at) < DATE_SUB(NOW(), INTERVAL 14 DAY)")->fetchColumn();
        $this->api->respond(['success' => true, 'applications' => $rows, 'counts' => $counts, 'stale' => $stale]);
    }
}
