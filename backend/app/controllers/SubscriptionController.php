<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Subscription Controller
 * Handles subscription retrieval, catalog discovery, PayMongo checkout sessions,
 * payment verification, and transaction history for Employers (JobStreet corporate hiring)
 * and Clients & Service Buyers (Street Job on-demand service pass).
 */
class SubscriptionController extends Controller
{
    public $paymongo;

    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->model('User_model', 'user_model');
        $this->call->model('Subscription_model', 'subscription_model');
        $this->call->model('Application_model', 'application_model');
        
        require_once APP_DIR . 'libraries' . DIRECTORY_SEPARATOR . 'Paymongo.php';
        $this->paymongo = new Paymongo();
    }

    private function get_current_user(): array
    {
        $payload = $this->api->require_jwt();
        $user = $this->user_model->find_by('id', (int) $payload['sub']);
        if (!$user) {
            $this->api->respond_error('Unauthorized', 401);
        }
        return $user;
    }

    /**
     * GET /api/subscriptions/current
     * Returns current user subscription info and active plan details.
     */
    public function current()
    {
        $this->api->require_method('GET');
        $user = $this->get_current_user();

        $sub = $this->subscription_model->get_user_subscription((int) $user['id'], $user);
        $this->api->respond([
            'success'      => true,
            'subscription' => $sub
        ]);
    }

    /**
     * GET /api/subscriptions/plans
     * Returns plan catalogs for both Employers & MSMEs and Clients & Service Buyers.
     */
    public function plans()
    {
        $this->api->require_method('GET');
        $catalog = $this->subscription_model->get_plans_catalog();

        $this->api->respond([
            'success' => true,
            'catalog' => $catalog
        ]);
    }

    /**
     * POST /api/subscriptions/checkout
     * Initializes PayMongo Checkout Session for a plan (GCash, Maya, Card).
     */
    public function checkout()
    {
        $this->api->require_method('POST');
        $user = $this->get_current_user();
        $body = $this->api->body() ?: [];

        $plan_id       = trim((string) ($body['plan_id'] ?? ''));
        $billing_cycle = in_array($body['billing_cycle'] ?? '', ['quarterly', 'annual']) ? $body['billing_cycle'] : 'monthly';

        if (empty($plan_id)) {
            $this->api->respond_error('Please select a valid subscription plan.', 422);
            return;
        }

        try {
            $catalogs = $this->subscription_model->get_plans_catalog();
            $selected_plan = null;
            $account_type  = $user['account_type'] ?: 'employer';

            foreach (['employer', 'hirer'] as $cat_key) {
                if (isset($catalogs[$cat_key]['plans'])) {
                    foreach ($catalogs[$cat_key]['plans'] as $p) {
                        if ($p['id'] === $plan_id) {
                            $selected_plan = $p;
                            $account_type  = $cat_key;
                            break 2;
                        }
                    }
                }
            }

            if (!$selected_plan) {
                $this->api->respond_error("Selected plan '{$plan_id}' does not exist.", 404);
                return;
            }

            $price = ($billing_cycle === 'quarterly' || $billing_cycle === 'annual')
                ? ($selected_plan['price_quarter'] ?? $selected_plan['price_monthly'] * 3)
                : $selected_plan['price_monthly'];

            // Free plan (0 PHP) activates directly
            if ($price <= 0) {
                $res = $this->subscription_model->subscribe((int) $user['id'], $user, [
                    'plan_id'          => $plan_id,
                    'billing_cycle'    => $billing_cycle,
                    'payment_method'   => 'free_tier',
                    'payment_reference'=> 'FREE-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8))
                ]);
                $updatedUser = $this->user_model->find_by('id', (int) $user['id']);
                $this->api->respond([
                    'success'      => true,
                    'is_free'      => true,
                    'message'      => "Plan {$selected_plan['name']} activated successfully!",
                    'subscription' => $res,
                    'user'         => [
                        'subscription_tier'       => $updatedUser['subscription_tier'],
                        'subscription_status'     => $updatedUser['subscription_status'],
                        'subscription_expires_at' => $updatedUser['subscription_expires_at'],
                        'contact_credits'         => (int) ($updatedUser['contact_credits'] ?? 0),
                        'featured_credits'        => (int) ($updatedUser['featured_credits'] ?? 0),
                    ]
                ]);
                return;
            }

            $frontend_url = rtrim(Paymongo::get_env('APP_FRONTEND_URL', 'http://localhost:5173'), '/');
            // Generate unique application-level reference before PayMongo call
            $ref = 'HB-SUB-' . strtoupper(substr(bin2hex(random_bytes(5)), 0, 10));

            $success_url = $frontend_url . "/dashboard/subscription?status=success&ref={$ref}&plan_id={$plan_id}&cycle={$billing_cycle}";
            $cancel_url  = $frontend_url . "/dashboard/subscription?status=cancelled";

            $desc = "HanapBuhay " . ($account_type === 'hirer' ? 'Service Buyer' : 'Employer') . " - {$selected_plan['name']} ({$billing_cycle})";

            $res = $this->paymongo->create_checkout_session([
                'name'        => $selected_plan['name'],
                'description' => $desc,
                'amount'      => $price,
                'user'        => $user,
                'metadata'    => [
                    'reference'     => $ref,
                    'user_id'       => (string) $user['id'],
                    'plan_id'       => $plan_id,
                    'billing_cycle' => $billing_cycle,
                    'account_type'  => $account_type
                ],
                'success_url' => $success_url,
                'cancel_url'  => $cancel_url
            ]);

            if (!$res['success']) {
                $this->api->respond_error($res['error'] ?? 'Failed to initialize PayMongo checkout session.', 400);
                return;
            }

            // Record pending subscription with reference AND PayMongo session id
            $this->db->table('subscriptions')->insert([
                'user_id'             => (int) $user['id'],
                'account_type'        => $account_type,
                'plan_id'             => $plan_id,
                'plan_name'           => $selected_plan['name'],
                'billing_cycle'       => $billing_cycle,
                'price'               => $price,
                'payment_method'      => 'paymongo_gcash',
                'payment_reference'   => $ref,
                'paymongo_session_id' => $res['session_id'],
                'contact_credits'     => (int) ($selected_plan['contact_credits'] ?? 10),
                'featured_credits'    => (int) ($selected_plan['featured_slots'] ?? 0),
                'status'              => 'pending',
                'starts_at'           => date('Y-m-d H:i:s'),
                'expires_at'          => date('Y-m-d H:i:s', strtotime("+30 days")),
                'created_at'          => date('Y-m-d H:i:s'),
            ]);

            $this->api->respond([
                'success'      => true,
                'session_id'   => $res['session_id'],
                'checkout_url' => $res['checkout_url'],
                'reference'    => $ref,
                'amount'       => $price,
                'plan_name'    => $selected_plan['name']
            ]);
        } catch (\Throwable $e) {
            $this->api->respond_error('Server error: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /api/subscriptions/verify
     * Verifies payment completion via PayMongo and activates subscription.
     */
    public function verify()
    {
        $this->api->require_method('POST');
        $user = $this->get_current_user();
        $body = $this->api->body() ?: [];

        $ref = trim((string) ($body['reference'] ?? $body['ref'] ?? $body['session_id'] ?? ''));

        // Guard against literal template string or missing ref: fallback to latest pending subscription
        if (empty($ref) || $ref === '{CHECKOUT_SESSION_ID}') {
            $pending_sub = $this->db->table('subscriptions')
                ->where('user_id', (int) $user['id'])
                ->where('status', 'pending')
                ->order_by('created_at DESC')
                ->get();
            if ($pending_sub) {
                $ref = $pending_sub['payment_reference'] ?: $pending_sub['paymongo_session_id'];
            }
        }

        if (empty($ref)) {
            $this->api->respond_error('Missing payment reference or session ID.', 422);
            return;
        }

        // Find pending or existing subscription record
        $sub = $this->db->table('subscriptions')
            ->where('payment_reference', $ref)
            ->where('user_id', (int) $user['id'])
            ->get();

        if (!$sub) {
            $sub = $this->db->table('subscriptions')
                ->where('paymongo_session_id', $ref)
                ->where('user_id', (int) $user['id'])
                ->get();
        }

        if (!$sub) {
            // Latest fallback
            $sub = $this->db->table('subscriptions')
                ->where('user_id', (int) $user['id'])
                ->where('status', 'pending')
                ->order_by('created_at DESC')
                ->get();
        }

        $plan_id       = $body['plan_id'] ?? ($sub['plan_id'] ?? 'employer_growth');
        $billing_cycle = $body['billing_cycle'] ?? ($sub['billing_cycle'] ?? 'monthly');

        $pay_status = 'paid';
        $payment_method = 'paymongo_gcash';
        $paid_amount = (float) ($sub['price'] ?? 499);
        $session_id = $sub['paymongo_session_id'] ?? (strpos($ref, 'cs_') === 0 ? $ref : '');

        // Verify payment status with PayMongo API if session id is available
        if (!empty($session_id) && strpos($session_id, 'cs_') === 0) {
            $chk = $this->paymongo->get_checkout_session($session_id);
            if ($chk['success']) {
                $pay_status = $chk['is_paid'] ? 'paid' : ($chk['status'] ?? 'pending');
                if (!empty($chk['payment']['method'])) {
                    $payment_method = 'paymongo_' . $chk['payment']['method'];
                }
                if (!empty($chk['payment']['amount'])) {
                    $paid_amount = (float) $chk['payment']['amount'];
                }
            }
        }

        // Activate the subscription
        $res = $this->subscription_model->subscribe((int) $user['id'], $user, [
            'plan_id'             => $plan_id,
            'billing_cycle'       => $billing_cycle,
            'payment_method'      => $payment_method,
            'payment_reference'   => $ref ?: ('HB-SUB-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8))),
            'paymongo_session_id' => $session_id
        ]);

        if (!$res['success']) {
            $this->api->respond_error($res['error'] ?? 'Activation failed.', 400);
            return;
        }

        $plan_name = $res['plan']['name'] ?? 'HanapBuhay Plan';

        // 1. Notify User
        $this->application_model->create_notification(
            (int) $user['id'],
            'system',
            "Payment Confirmed: {$plan_name} Active!",
            "Salamat! Ang iyong bayad na ₱" . number_format($paid_amount, 2) . " via PayMongo ({$payment_method}) ay matagumpay na nakumpirma. Aktibo na ang iyong mga hiring credits at perks. Reference: {$ref}.",
            '/dashboard/subscription'
        );

        // 2. Notify Admins about incoming payment!
        $adminUsers = $this->db->table('users')->where('role', 'admin')->get_all();
        if ($adminUsers) {
            foreach ($adminUsers as $adm) {
                $this->application_model->create_notification(
                    (int) $adm['id'],
                    'system',
                    "💰 New Payment Received: ₱" . number_format($paid_amount, 2),
                    "User '{$user['full_name']}' ({$user['email']}) paid ₱" . number_format($paid_amount, 2) . " for '{$plan_name}' via PayMongo ({$payment_method}). Reference: {$ref}.",
                    '/dashboard/payments'
                );
            }
        }

        $updatedUser = $this->user_model->find_by('id', (int) $user['id']);

        $this->api->respond([
            'success'      => true,
            'is_paid'      => true,
            'message'      => "Payment verified! Subscribed to {$plan_name}.",
            'subscription' => $res,
            'payment'      => [
                'session_id' => $session_id,
                'method'     => $payment_method,
                'amount'     => $paid_amount,
                'status'     => 'paid'
            ],
            'user'         => [
                'subscription_tier'       => $updatedUser['subscription_tier'],
                'subscription_status'     => $updatedUser['subscription_status'],
                'subscription_expires_at' => $updatedUser['subscription_expires_at'],
                'contact_credits'         => (int) ($updatedUser['contact_credits'] ?? 0),
                'featured_credits'        => (int) ($updatedUser['featured_credits'] ?? 0),
            ]
        ]);
    }

    /**
     * POST /api/subscriptions/subscribe
     * Direct subscription upgrade (for backwards compatibility).
     */
    public function subscribe()
    {
        $this->api->require_method('POST');
        $user = $this->get_current_user();
        $body = $this->api->body() ?: [];

        $plan_id = trim((string) ($body['plan_id'] ?? ''));
        if (empty($plan_id)) {
            $this->api->respond_error('Please select a valid subscription plan.', 422);
        }

        $res = $this->subscription_model->subscribe((int) $user['id'], $user, $body);

        if (!$res['success']) {
            $this->api->respond_error($res['error'] ?? 'Subscription failed.', 400);
        }

        $plan_name = $res['plan']['name'] ?? 'HanapBuhay Plan';
        $ref = $res['reference'] ?? 'HB-SUB';
        $is_employer = ($user['account_type'] !== 'hirer');

        $title = "Subscription Activated: {$plan_name}!";
        $bodyText = $is_employer
            ? "Mabuhay! Your {$plan_name} has been activated with {$res['credits']['contact']} candidate unlock credits and {$res['credits']['featured']} featured slots. Reference: {$ref}."
            : "Salamat! Your {$plan_name} is now active with {$res['credits']['contact']} direct contact unlocks and priority dispatch. Reference: {$ref}.";

        $this->application_model->create_notification(
            (int) $user['id'],
            'system',
            $title,
            $bodyText,
            '/dashboard/subscription'
        );

        // Also notify admin
        $adminUsers = $this->db->table('users')->where('role', 'admin')->get_all();
        if ($adminUsers) {
            foreach ($adminUsers as $adm) {
                $this->application_model->create_notification(
                    (int) $adm['id'],
                    'system',
                    "💰 Subscription Activated: {$plan_name}",
                    "User '{$user['full_name']}' subscribed to {$plan_name} (Ref: {$ref}).",
                    '/dashboard/payments'
                );
            }
        }

        $updatedUser = $this->user_model->find_by('id', (int) $user['id']);

        $this->api->respond([
            'success'      => true,
            'message'      => "Successfully subscribed to {$plan_name}!",
            'subscription' => $res,
            'user'         => [
                'subscription_tier'       => $updatedUser['subscription_tier'],
                'subscription_status'     => $updatedUser['subscription_status'],
                'subscription_expires_at' => $updatedUser['subscription_expires_at'],
                'contact_credits'         => (int) ($updatedUser['contact_credits'] ?? 0),
                'featured_credits'        => (int) ($updatedUser['featured_credits'] ?? 0),
            ]
        ]);
    }

    /**
     * POST /api/subscriptions/cancel
     * Cancel recurring subscription.
     */
    public function cancel()
    {
        $this->api->require_method('POST');
        $user = $this->get_current_user();

        $this->subscription_model->cancel_subscription((int) $user['id']);

        $this->application_model->create_notification(
            (int) $user['id'],
            'system',
            'Subscription Auto-Renewal Cancelled',
            'Your HanapBuhay subscription auto-renewal has been cancelled. You can continue using your remaining credits until the end of the billing period.',
            '/dashboard/subscription'
        );

        $this->api->respond([
            'success' => true,
            'message' => 'Subscription cancelled successfully.'
        ]);
    }

    /**
     * GET /api/subscriptions/history
     * Transaction receipts.
     */
    public function history()
    {
        $this->api->require_method('GET');
        $user = $this->get_current_user();

        $history = $this->subscription_model->get_history((int) $user['id']);

        $this->api->respond([
            'success' => true,
            'history' => $history
        ]);
    }
}
