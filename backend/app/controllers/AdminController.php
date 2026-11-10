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
        $this->call->model('Message_model', 'message_model');
        $this->call->model('Skill_model', 'skill_model');
    }

    private function require_admin(): array
    {
        $payload = $this->api->require_jwt();
        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user || $user['role'] !== 'admin') $this->api->respond_error('Admin only.', 403);
        return $user;
    }

    // GET /api/admin/stats
    public function stats()
    {
        $this->api->require_method('GET');
        $this->require_admin();

        $totalUsers    = $this->user_model->count_users();
        $activeUsers   = $this->user_model->count_active_users();
        $inactiveUsers = $this->user_model->count_inactive_users();
        $byRole        = $this->user_model->count_by_role();
        $byLocation    = $this->user_model->count_by_location();
        $recentRegs    = $this->user_model->registrations_last_30_days();

        // Role breakdown into a keyed map
        $roleMap = ['worker' => 0, 'employer' => 0, 'admin' => 0];
        foreach ($byRole as $r) {
            $roleMap[$r['role']] = (int) $r['count'];
        }

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
            'messages'       => $this->message_model->count_messages(),
            'total_revenue'      => $total_rev,
            'active_subscribers' => $active_subs,
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

        $this->user_model->set_verified((int) $id, $new_verified);

        // Send notification to the user about verification status change
        $isEmployer = ($user['account_type'] === 'employer' || $user['role'] === 'employer');
        if ($new_verified === 1) {
            $title = $isEmployer ? 'Business Verified!' : 'Skills & Profile Endorsed!';
            $body = $isEmployer
                ? 'Congratulations! HanapBuhay Admin has verified your business profile. You now have the Verified Business badge.'
                : 'Congratulations! HanapBuhay Admin has officially verified and endorsed your worker profile and Skills Passport.';
            $this->application_model->create_notification(
                (int) $id,
                'system',
                $title,
                $body,
                '/dashboard'
            );
        } else {
            $title = 'Verification Status Updated';
            $body = 'Your HanapBuhay verification status has been set to pending review by Admin.';
            $this->application_model->create_notification(
                (int) $id,
                'system',
                $title,
                $body,
                '/dashboard'
            );
        }

        $this->api->respond([
            'success'     => true,
            'is_verified' => $new_verified,
            'message'     => $new_verified === 1 ? 'User has been verified successfully.' : 'User verification status has been revoked.'
        ]);
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
        $byRole        = $this->user_model->count_by_role();
        $byLocation    = $this->user_model->count_by_location();

        $roleMap = ['worker' => 0, 'employer' => 0, 'admin' => 0];
        foreach ($byRole as $r) {
            $roleMap[$r['role']] = (int) $r['count'];
        }

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
        $rows = $this->application_model->get_user_notifications($uid, 30);

        if (isset($_GET['mark_read']) && $_GET['mark_read'] === '1') {
            $this->application_model->mark_notifications_read($uid);
        }

        $this->api->respond(['success' => true, 'notifications' => $rows ?: []]);
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
}
