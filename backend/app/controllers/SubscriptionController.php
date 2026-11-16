<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Plans and payments for employers (Employer plans) and clients (Service Buyer Pass).
 * The payment rules themselves live in libraries/Payments.php.
 *
 *   GET  /api/subscriptions/current                 plan, usage and limits, renewal date, scheduled change
 *   GET  /api/subscriptions/plans                   the plans for this account type, with comparison
 *   POST /api/subscriptions/checkout                { plan_id, billing_cycle }  new / upgrade / renew → PayMongo;
 *                                                   downgrade → scheduled for the end of the current plan
 *   POST /api/subscriptions/verify                  { reference }  after returning from PayMongo (asks PayMongo)
 *   POST /api/subscriptions/payments/{id}/retry     try a failed / expired / pending payment again
 *   POST /api/subscriptions/payments/{id}/cancel    cancel a pending payment
 *   POST /api/subscriptions/abandon                 { reference }  the person left the PayMongo page
 *   GET  /api/subscriptions/payments/{id}/receipt   receipt of a paid payment
 *   POST /api/subscriptions/cancel                  stop the plan at its end date
 *   POST /api/subscriptions/resume                  undo cancel / scheduled downgrade
 *   GET  /api/subscriptions/history                 payments + plan timeline
 *   POST /api/subscriptions/webhook                 PayMongo webhook (signature checked)
 *   GET  /api/admin/payments                        every payment, filters and revenue summary
 *   POST /api/admin/payments/{id}/refund            { amount, reason }
 *   POST /api/admin/payments/reconcile              ask PayMongo about every pending payment now
 *   GET  /api/cron/payments?key=                    reconcile + plan end dates + renewal reminders
 */
class SubscriptionController extends Controller
{
    /** @var Payments */

    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->library('schema_info');
        $this->call->model('User_model', 'user_model');
        $this->call->model('Subscription_model', 'subscription_model');
        $this->call->model('Application_model', 'application_model');
        $this->call->model('Job_model', 'job_model');
        $this->call->library('payments');
    }

    private function me(): array
    {
        $payload = $this->api->require_jwt();
        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user) $this->api->respond_error('Please sign in again.', 401);
        return $user;
    }

    private function buyer(): array
    {
        $u = $this->me();
        if (!in_array($u['account_type'] ?? '', ['employer', 'hirer'], true)) {
            $this->api->respond_error('Plans are for employer and client accounts.', 403);
        }
        return $u;
    }

    private function user_fields(?array $u): array
    {
        return [
            'subscription_tier'       => $u['subscription_tier'] ?? 'free',
            'subscription_status'     => $u['subscription_status'] ?? 'active',
            'subscription_expires_at' => $u['subscription_expires_at'] ?? null,
            'contact_credits'         => (int) ($u['contact_credits'] ?? 0),
            'featured_credits'        => (int) ($u['featured_credits'] ?? 0),
        ];
    }

    private function active_sub(int $uid): ?array
    {
        return $this->db->raw("SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", [$uid])->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    /** Plan, usage, limits and renewal, as one block every subscription screen reads. */
    private function summary(array $u): array
    {
        $plan = $this->subscription_model->current_plan($u);
        $paid = $this->subscription_model->has_active_paid_plan($u);
        $sub = $this->active_sub((int) $u['id']);
        $openPosts = $this->job_model->count_employer_active_jobs((int) $u['id']);
        $limit = (int) ($plan['job_posts'] ?? 1);
        $scheduled = !empty($sub['scheduled_plan_id']) ? $this->subscription_model->find_plan($sub['scheduled_plan_id']) : null;
        $expires = $paid ? ($u['subscription_expires_at'] ?? null) : null;
        $days = $expires ? max(0, (int) ceil((strtotime($expires) - time()) / 86400)) : null;

        return [
            'plan'          => $plan,
            'is_paid'       => $paid,
            'status'        => $paid ? (!empty($sub['cancel_at_period_end']) ? 'ending' : 'active') : (($u['subscription_status'] ?? '') === 'expired' ? 'expired' : 'free'),
            'expires_at'    => $expires,
            'days_left'     => $days,
            'billing_cycle' => $sub['billing_cycle'] ?? null,
            'cancel_at_period_end' => !empty($sub['cancel_at_period_end']),
            'scheduled_plan'=> $scheduled,
            'usage'         => [
                'posts'    => ['used' => $openPosts, 'limit' => $limit],
                'featured' => ['left' => (int) ($u['featured_credits'] ?? 0), 'per_period' => (int) ($plan['featured_slots'] ?? 0)],
                'contacts' => ['left' => (int) ($u['contact_credits'] ?? 0), 'per_period' => (int) ($plan['contact_credits'] ?? 0),
                               'unlimited' => (int) ($plan['contact_credits'] ?? 0) >= 9999],
            ],
            'methods'       => array_map(fn($m) => ['id' => $m, 'label' => Paymongo::method_label($m)], Paymongo::methods()),
            'test_mode'     => $this->payments->paymongo()->is_test() && Paymongo::show_test_labels(),
            'online_ready'  => $this->payments->paymongo()->configured() && Payments::ready(),
        ];
    }

    // GET /api/subscriptions/current
    public function current()
    {
        $this->api->require_method('GET');
        $u = $this->buyer();
        // pick up anything PayMongo confirmed while no webhook reached us, and end a plan whose date passed
        if (Payments::ready()) {
            $this->payments->reconcile((int) $u['id'], 10);
            if (!empty($u['subscription_expires_at']) && strtotime((string) $u['subscription_expires_at']) < time()) $this->payments->run_lifecycle();
            $u = $this->user_model->find_by_id((int) $u['id']);
        }
        $type = $u['account_type'] === 'hirer' ? 'hirer' : 'employer';
        $this->api->respond([
            'success'      => true,
            'summary'      => $this->summary($u),
            'catalog'      => $this->subscription_model->get_plans_catalog()[$type],
            'user'         => $this->user_fields($u),
            // older screens read this
            'subscription' => $this->subscription_model->get_user_subscription((int) $u['id'], $u),
        ]);
    }

    // GET /api/subscriptions/plans
    public function plans()
    {
        $this->api->require_method('GET');
        $this->api->respond(['success' => true, 'catalog' => $this->subscription_model->get_plans_catalog()]);
    }

    private function find_plan_for(array $u, string $id): ?array
    {
        foreach ($this->subscription_model->plans_for($u) as $p) if ($p['id'] === $id) return $p;
        return null;
    }

    // POST /api/subscriptions/checkout
    public function checkout()
    {
        $this->api->require_method('POST');
        $u = $this->buyer();
        $this->api->rate_limit('checkout_' . (int) $u['id'], 12, 3600);
        $b = $this->api->body() ?: [];
        $plan = $this->find_plan_for($u, trim((string) ($b['plan_id'] ?? '')));
        if (!$plan) $this->api->respond_error('Choose one of the plans shown.', 422);
        $cycle = ($b['billing_cycle'] ?? '') === 'quarterly' ? 'quarterly' : 'monthly';
        $cur = $this->subscription_model->current_plan($u);
        $paidNow = $this->subscription_model->has_active_paid_plan($u);

        // Free plan or a cheaper plan while a paid one runs: switch when the current plan ends,
        // so nobody loses days they already paid for.
        $cheaper = (float) $plan['price_monthly'] < (float) ($cur['price_monthly'] ?? 0);
        if ($paidNow && ($cheaper || (float) $plan['price_monthly'] <= 0)) {
            $sub = $this->active_sub((int) $u['id']);
            if ($sub) $this->db->raw('UPDATE subscriptions SET scheduled_plan_id = ?, cancel_at_period_end = 0 WHERE id = ?', [$plan['id'], (int) $sub['id']]);
            $this->payments->event((int) $u['id'], 'downgrade_scheduled', $cur['id'], $plan['id'], $sub ? (int) $sub['id'] : null, null,
                'Switches on ' . date('F j, Y', strtotime((string) $u['subscription_expires_at'])));
            $this->application_model->create_notification((int) $u['id'], 'payment', "Plan change saved: {$plan['name']}",
                "You will keep {$cur['name']} until " . date('F j, Y', strtotime((string) $u['subscription_expires_at'])) . ", then move to {$plan['name']}."
                    . ((float) $plan['price_monthly'] > 0 ? " We'll remind you to pay for it then." : ''), '/dashboard/subscription', false);
            $this->api->respond(['success' => true, 'scheduled' => true,
                'message' => "Saved. You keep {$cur['name']} until " . date('F j, Y', strtotime((string) $u['subscription_expires_at'])) . ", then switch to {$plan['name']}.",
                'summary' => $this->summary($this->user_model->find_by_id((int) $u['id']))]);
        }
        if ((float) $plan['price_monthly'] <= 0) {
            $res = $this->subscription_model->subscribe((int) $u['id'], $u, ['plan_id' => $plan['id'], 'billing_cycle' => 'monthly', 'payment_method' => 'free_tier', 'payment_reference' => 'FREE-' . strtoupper(bin2hex(random_bytes(3)))]);
            if (!($res['success'] ?? false)) $this->api->respond_error("We couldn't change your plan. Please try again.", 500);
            $this->payments->event((int) $u['id'], 'subscribed', $cur['id'] ?? null, $plan['id'], (int) $res['sub_id'], null, 'Free plan');
            $this->api->respond(['success' => true, 'is_free' => true, 'message' => "You're on the {$plan['name']} plan.",
                'user' => $this->user_fields($this->user_model->find_by_id((int) $u['id']))]);
        }
        if (!Payments::ready()) $this->api->respond_error('Online payment is being set up. Please try again later.', 503);

        $out = $this->payments->start_checkout($u, $plan, $cycle);
        if (isset($out['error'])) $this->api->respond_error($out['error'], 502);
        $this->api->respond([
            'success'      => true,
            'checkout_url' => $out['checkout_url'],
            'payment'      => $this->payments->present($out['payment']),
            'change_type'  => $out['payment']['change_type'],
        ]);
    }

    private function own_payment(array $u, $idOrRef): array
    {
        $p = is_numeric($idOrRef) ? $this->payments->find((int) $idOrRef) : $this->payments->find_by_reference((string) $idOrRef);
        if (!$p || (int) $p['user_id'] !== (int) $u['id']) $this->api->respond_error('We could not find that payment.', 404);
        return $p;
    }

    // POST /api/subscriptions/verify  { reference }
    public function verify()
    {
        $this->api->require_method('POST');
        $u = $this->buyer();
        $ref = trim((string) ($this->api->body()['reference'] ?? $this->api->body()['ref'] ?? ''));
        if ($ref === '' || !Payments::ready()) $this->api->respond_error('We could not find that payment.', 404);
        $p = $this->payments->sync($this->own_payment($u, $ref));
        $fresh = $this->user_model->find_by_id((int) $u['id']);
        $messages = [
            'paid'      => "Payment received. Your {$p['plan_name']} is active.",
            'pending'   => "We're waiting for PayMongo to confirm your payment. This page updates by itself. Your plan changes only after the payment is confirmed.",
            'failed'    => "Your payment didn't go through. Your plan was not changed. You can try again or use another payment method.",
            'expired'   => 'The payment window timed out before a payment was made. Nothing was charged.',
            'cancelled' => 'You left the payment page, so nothing was charged. Your plan did not change.',
            'refunded'  => 'This payment was refunded.',
        ];
        $this->api->respond([
            'success' => true,
            'is_paid' => $p['status'] === 'paid',
            'payment' => $this->payments->present($p),
            'message' => $messages[$p['status']] ?? '',
            'user'    => $this->user_fields($fresh),
            'summary' => $this->summary($fresh),
        ]);
    }

    // POST /api/subscriptions/abandon  { reference } — back from PayMongo's "cancel" link
    public function abandon()
    {
        $this->api->require_method('POST');
        $u = $this->buyer();
        $p = $this->own_payment($u, trim((string) ($this->api->body()['reference'] ?? '')));
        $p = $this->payments->sync($p); // it might have been paid after all
        if (in_array($p['status'], ['pending', 'failed'], true)) {
            if (!empty($p['paymongo_session_id'])) $this->payments->paymongo()->expire_checkout_session((string) $p['paymongo_session_id']);
            $this->payments->mark_closed($p, 'cancelled', (int) $u['id']);
            $p = $this->payments->find((int) $p['id']);
        }
        $this->api->respond(['success' => true, 'payment' => $this->payments->present($p),
            'message' => $p['status'] === 'paid' ? "Payment received. Your {$p['plan_name']} is active." : 'You left the payment page, so nothing was charged. Your plan did not change.']);
    }

    // POST /api/subscriptions/payments/{id}/retry
    public function retry($id)
    {
        $this->api->require_method('POST');
        $u = $this->buyer();
        $p = $this->payments->sync($this->own_payment($u, $id));
        if ($p['status'] === 'paid') $this->api->respond(['success' => true, 'already_paid' => true, 'message' => 'This payment is already paid.']);
        if (!in_array($p['status'], ['pending', 'failed', 'expired', 'cancelled'], true)) $this->api->respond_error('This payment cannot be tried again.', 409);
        $present = $this->payments->present($p);
        if ($present['can_continue'] && $p['status'] === 'pending') {
            $this->api->respond(['success' => true, 'checkout_url' => $p['checkout_url'], 'payment' => $present]);
        }
        $plan = $this->find_plan_for($u, (string) $p['plan_id']);
        if (!$plan) $this->api->respond_error('That plan is no longer offered. Choose a plan on this page.', 409);
        if (in_array($p['status'], ['pending', 'failed'], true)) {
            if (!empty($p['paymongo_session_id'])) $this->payments->paymongo()->expire_checkout_session((string) $p['paymongo_session_id']);
            $this->payments->mark_closed($p, 'cancelled', (int) $u['id']);
        }
        $out = $this->payments->start_checkout($u, $plan, (string) $p['billing_cycle']);
        if (isset($out['error'])) $this->api->respond_error($out['error'], 502);
        $this->api->respond(['success' => true, 'checkout_url' => $out['checkout_url'], 'payment' => $this->payments->present($out['payment'])]);
    }

    // POST /api/subscriptions/payments/{id}/cancel
    public function cancel_payment($id)
    {
        $this->api->require_method('POST');
        $u = $this->buyer();
        $p = $this->payments->sync($this->own_payment($u, $id));
        if (!in_array($p['status'], ['pending', 'failed'], true)) $this->api->respond_error('Only a payment that is still waiting can be cancelled.', 409);
        if (!empty($p['paymongo_session_id'])) $this->payments->paymongo()->expire_checkout_session((string) $p['paymongo_session_id']);
        $this->payments->mark_closed($p, 'cancelled', (int) $u['id']);
        $this->api->respond(['success' => true, 'payment' => $this->payments->present($this->payments->find((int) $p['id'])), 'message' => 'Payment cancelled. Nothing was charged.']);
    }

    // GET /api/subscriptions/payments/{id}/receipt
    public function receipt($id)
    {
        $this->api->require_method('GET');
        $u = $this->me();
        $p = $this->payments->find((int) $id);
        if (!$p || ((int) $p['user_id'] !== (int) $u['id'] && ($u['role'] ?? '') !== 'admin')) $this->api->respond_error('We could not find that receipt.', 404);
        if (!in_array($p['status'], ['paid', 'refunded'], true)) $this->api->respond_error('A receipt is only available for paid payments.', 409);
        $owner = (int) $p['user_id'] === (int) $u['id'] ? $u : $this->user_model->find_by_id((int) $p['user_id']);
        $this->api->respond(['success' => true, 'receipt' => [
            'receipt_no' => $p['receipt_no'], 'reference' => $p['reference'], 'paid_at' => $p['paid_at'],
            'billed_to' => ['name' => $owner['full_name'] ?? '', 'email' => $owner['email'] ?? '', 'location' => $owner['location'] ?? ''],
            'item' => $p['plan_name'] . ($p['billing_cycle'] === 'quarterly' ? ' (3 months)' : ' (1 month)'),
            'amount' => (float) $p['amount'], 'currency' => 'PHP', 'method' => Paymongo::method_label($p['method']),
            'paymongo_payment_id' => $p['paymongo_payment_id'], 'is_test' => (bool) $p['is_test'] && Paymongo::show_test_labels(),
            'refund_status' => $p['refund_status'], 'refunded_amount' => $p['refunded_amount'] !== null ? (float) $p['refunded_amount'] : null,
            'note' => 'This is an acknowledgement receipt for an online payment processed by PayMongo. It is not an official BIR receipt.',
        ]]);
    }

    // POST /api/subscriptions/cancel — stop at the end date (plans never charge by themselves)
    public function cancel()
    {
        $this->api->require_method('POST');
        $u = $this->buyer();
        if (!$this->subscription_model->has_active_paid_plan($u)) $this->api->respond_error("You're on the free plan, so there is nothing to cancel.", 409);
        $sub = $this->active_sub((int) $u['id']);
        if ($sub && $this->schema_info->has_column('subscriptions', 'cancel_at_period_end')) {
            $this->db->raw('UPDATE subscriptions SET cancel_at_period_end = 1, scheduled_plan_id = NULL WHERE id = ?', [(int) $sub['id']]);
        }
        $reason = mb_substr(trim((string) ($this->api->body()['reason'] ?? '')), 0, 300) ?: null;
        $until = date('F j, Y', strtotime((string) $u['subscription_expires_at']));
        $this->payments->event((int) $u['id'], 'cancel_requested', $u['subscription_tier'], null, $sub ? (int) $sub['id'] : null, null, "Ends {$until}" . ($reason ? ". Reason: {$reason}" : ''));
        $this->application_model->create_notification((int) $u['id'], 'payment', 'Your plan will end',
            "Your plan stays active until {$until}, then your account moves to the free plan. We won't remind you to renew. You can undo this any time before then.", '/dashboard/subscription', false);
        $this->api->respond(['success' => true, 'message' => "Done. Your plan stays active until {$until}, then moves to the free plan. You will not be charged."]);
    }

    // POST /api/subscriptions/resume
    public function resume()
    {
        $this->api->require_method('POST');
        $u = $this->buyer();
        $sub = $this->active_sub((int) $u['id']);
        if (!$sub) $this->api->respond_error('There is no plan change to undo.', 409);
        $this->db->raw('UPDATE subscriptions SET cancel_at_period_end = 0, scheduled_plan_id = NULL WHERE id = ?', [(int) $sub['id']]);
        $this->payments->event((int) $u['id'], 'resumed', null, $u['subscription_tier'], (int) $sub['id'], null, 'Plan change undone');
        $this->api->respond(['success' => true, 'message' => 'Done. Your plan continues as before.']);
    }

    // GET /api/subscriptions/history
    public function history()
    {
        $this->api->require_method('GET');
        $u = $this->buyer();
        $this->api->respond(['success' => true, 'payments' => $this->payments->history((int) $u['id']),
            'timeline' => $this->payments->timeline((int) $u['id']),
            // older screens read this
            'history' => $this->subscription_model->get_history((int) $u['id'])]);
    }

    /**
     * POST /api/subscriptions/subscribe — kept for older app versions: free plans only.
     */
    public function subscribe()
    {
        $this->checkout();
    }

    /**
     * POST /api/subscriptions/webhook — PayMongo events. Authenticated by signature; each event
     * is handled once (paymongo_events), and every status change is conditional (Payments).
     */
    public function webhook()
    {
        $this->api->require_method('POST');
        $raw = (string) file_get_contents('php://input');
        $sig = (string) ($_SERVER['HTTP_PAYMONGO_SIGNATURE'] ?? '');
        if (!$this->payments->paymongo()->verify_webhook_signature($raw, $sig)) $this->api->respond_error('Invalid signature.', 401);
        if (!Payments::ready()) $this->api->respond(['success' => true, 'ignored' => 'not_ready']);

        $event = json_decode($raw, true) ?: [];
        $eventId = (string) ($event['data']['id'] ?? '');
        $type = (string) ($event['data']['attributes']['type'] ?? '');
        $res = $event['data']['attributes']['data'] ?? [];
        if ($eventId !== '') {
            $ins = $this->db->raw('INSERT IGNORE INTO paymongo_events (event_id, type, received_at) VALUES (?, ?, NOW())', [$eventId, $type]);
            if ($ins->rowCount() < 1) $this->api->respond(['success' => true, 'duplicate' => true]);
        }

        if ($type === 'checkout_session.payment.paid') {
            $attr = $res['attributes'] ?? [];
            $p = $this->payments->find_by_reference((string) ($attr['metadata']['reference'] ?? '')) ?: $this->payments->find_by_reference((string) ($res['id'] ?? ''));
            if ($p) {
                $after = $this->payments->sync($p);
                if ($after['status'] !== 'paid') {
                    // PayMongo's API could not be reached: the signed event itself is proof of payment
                    foreach ($attr['payments'] ?? [] as $pm) {
                        $pa = $pm['attributes'] ?? [];
                        if (($pa['status'] ?? '') === 'paid') {
                            $this->payments->mark_paid($p, ['payment_id' => $pm['id'] ?? '', 'method' => $pa['source']['type'] ?? null,
                                'fee' => ($pa['fee'] ?? 0) / 100, 'net_amount' => ($pa['net_amount'] ?? 0) / 100,
                                'paid_at' => isset($pa['paid_at']) ? date('Y-m-d H:i:s', (int) $pa['paid_at']) : null]);
                            break;
                        }
                    }
                }
            }
        } elseif ($type === 'payment.failed') {
            $ref = (string) ($res['attributes']['metadata']['reference'] ?? '');
            $p = $ref !== '' ? $this->payments->find_by_reference($ref) : null;
            if ($p) $this->payments->mark_failed($p, ['message' => $res['attributes']['failed_message'] ?? null, 'code' => $res['attributes']['failed_code'] ?? null, 'method' => $res['attributes']['source']['type'] ?? null]);
            else $this->payments->reconcile(null, 20);
        } elseif (in_array($type, ['payment.refunded', 'payment.refund.updated'], true)) {
            $pmId = (string) ($type === 'payment.refunded' ? ($res['id'] ?? '') : ($res['attributes']['payment_id'] ?? ''));
            $p = $pmId !== '' ? $this->db->raw('SELECT * FROM payments WHERE paymongo_payment_id = ?', [$pmId])->fetch(PDO::FETCH_ASSOC) : null;
            if ($p) {
                $status = $type === 'payment.refunded' ? 'succeeded' : (string) ($res['attributes']['status'] ?? 'pending');
                if ($p['refund_status'] === null) {
                    $amt = $type === 'payment.refunded' ? ((int) ($res['attributes']['amount_refunded'] ?? $res['attributes']['amount'] ?? 0)) / 100 : ((int) ($res['attributes']['amount'] ?? 0)) / 100;
                    $this->db->raw("UPDATE payments SET refund_status = 'pending', refunded_amount = ? WHERE id = ?", [$amt ?: $p['amount'], (int) $p['id']]);
                    $p = $this->payments->find((int) $p['id']);
                }
                if (in_array($status, ['succeeded', 'failed'], true)) $this->payments->refund_settled($p, $status);
            }
        }
        $this->api->respond(['success' => true]);
    }

    /* ── admin ─────────────────────────────────────────────── */

    private function admin(): array
    {
        $u = $this->me();
        if (($u['role'] ?? '') !== 'admin') $this->api->respond_error('Only administrators can do this.', 403);
        return $u;
    }

    // GET /api/admin/payments?status=&q=&from=&to=
    public function admin_index()
    {
        $this->api->require_method('GET');
        $this->admin();
        if (!Payments::ready()) $this->api->respond(['success' => true, 'enabled' => false, 'payments' => [], 'summary' => []]);

        $where = ['1=1']; $args = [];
        $status = (string) ($_GET['status'] ?? '');
        if (in_array($status, ['pending', 'paid', 'failed', 'cancelled', 'expired', 'refunded'], true)) { $where[] = 'p.status = ?'; $args[] = $status; }
        if ($status === 'refunds') $where[] = 'p.refund_status IS NOT NULL';
        $q = trim((string) ($_GET['q'] ?? ''));
        if ($q !== '') { $where[] = '(p.reference LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR p.receipt_no LIKE ?)'; $like = '%' . addcslashes($q, '%_\\') . '%'; array_push($args, $like, $like, $like, $like); }
        foreach (['from' => '>=', 'to' => '<='] as $k => $op) {
            $d = (string) ($_GET[$k] ?? '');
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) { $where[] = "DATE(p.created_at) {$op} ?"; $args[] = $d; }
        }
        $test = (string) ($_GET['mode'] ?? '');
        if ($test === 'test') $where[] = 'p.is_test = 1';
        if ($test === 'live') $where[] = 'p.is_test = 0';
        $w = implode(' AND ', $where);

        $rows = $this->db->raw("SELECT p.*, u.full_name, u.email, u.account_type FROM payments p JOIN users u ON u.id = p.user_id WHERE {$w} ORDER BY p.created_at DESC LIMIT 300", $args)->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $list = array_map(fn($r) => $this->payments->present($r) + ['user_id' => (int) $r['user_id'], 'full_name' => $r['full_name'], 'email' => $r['email'],
            'account_type' => $r['account_type'], 'paymongo_payment_id' => $r['paymongo_payment_id'], 'refund_reason' => $r['refund_reason'], 'fee' => $r['fee'] !== null ? (float) $r['fee'] : null], $rows);

        $one = fn($sql, $a = []) => $this->db->raw($sql, $a)->fetch(PDO::FETCH_ASSOC) ?: [];
        $paid = $one("SELECT COUNT(*) n, COALESCE(SUM(amount),0) gross, COALESCE(SUM(fee),0) fees FROM payments WHERE status IN ('paid','refunded')");
        $month = $one("SELECT COALESCE(SUM(amount),0) gross FROM payments WHERE status IN ('paid','refunded') AND paid_at >= DATE_FORMAT(NOW(), '%Y-%m-01')");
        $refunded = $one("SELECT COUNT(*) n, COALESCE(SUM(refunded_amount),0) amt FROM payments WHERE refund_status = 'succeeded'");
        $counts = [];
        foreach ($this->db->raw('SELECT status, COUNT(*) n FROM payments GROUP BY status')->fetchAll(PDO::FETCH_ASSOC) ?: [] as $c) $counts[$c['status']] = (int) $c['n'];
        $byPlan = $this->db->raw("SELECT plan_name, COUNT(*) n, SUM(amount) total FROM payments WHERE status = 'paid' GROUP BY plan_name ORDER BY total DESC")->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $byMethod = $this->db->raw("SELECT COALESCE(method, 'unknown') method, COUNT(*) n, SUM(amount) total FROM payments WHERE status = 'paid' GROUP BY method ORDER BY total DESC")->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($byMethod as &$m) $m['label'] = Paymongo::method_label($m['method']);
        unset($m);
        $daily = $this->db->raw("SELECT DATE(paid_at) d, SUM(amount) total FROM payments WHERE status IN ('paid','refunded') AND paid_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) GROUP BY DATE(paid_at) ORDER BY d")->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $this->api->respond([
            'success' => true, 'enabled' => true,
            'test_mode' => $this->payments->paymongo()->is_test() && Paymongo::show_test_labels(),
            'summary' => [
                'gross'       => (float) ($paid['gross'] ?? 0),
                'fees'        => (float) ($paid['fees'] ?? 0),
                'refunded'    => (float) ($refunded['amt'] ?? 0),
                'net'         => (float) ($paid['gross'] ?? 0) - (float) ($paid['fees'] ?? 0) - (float) ($refunded['amt'] ?? 0),
                'this_month'  => (float) ($month['gross'] ?? 0),
                'paid_count'  => (int) ($paid['n'] ?? 0),
                'counts'      => $counts,
                'by_plan'     => $byPlan,
                'by_method'   => $byMethod,
                'daily'       => $daily,
                'active_paid_plans' => (int) $this->db->raw("SELECT COUNT(*) FROM users WHERE subscription_expires_at > NOW() AND subscription_tier NOT IN ('employer_starter','hirer_free','free')")->fetchColumn(),
            ],
            'payments' => $list,
        ]);
    }

    // POST /api/admin/payments/{id}/refund  { amount, reason }
    public function admin_refund($id)
    {
        $this->api->require_method('POST');
        $admin = $this->admin();
        $p = $this->payments->find((int) $id);
        if (!$p) $this->api->respond_error('We could not find that payment.', 404);
        $b = $this->api->body();
        $reason = mb_substr(trim((string) ($b['reason'] ?? '')), 0, 255);
        if ($reason === '') $this->api->respond_error('Write the reason for the refund.', 422);
        $amount = isset($b['amount']) && $b['amount'] !== '' ? (float) $b['amount'] : (float) $p['amount'];
        $out = $this->payments->refund($p, $amount, $reason, (int) $admin['id']);
        if (isset($out['error'])) $this->api->respond_error($out['error'], 422);
        $this->api->respond(['success' => true, 'payment' => $this->payments->present($out['payment']), 'message' => 'Refund started.']);
    }

    // POST /api/admin/payments/reconcile
    public function admin_reconcile()
    {
        $this->api->require_method('POST');
        $this->admin();
        $r = $this->payments->reconcile(null, 100);
        $l = $this->payments->run_lifecycle();
        $this->api->respond(['success' => true] + $r + $l + ['message' => "Checked {$r['checked']} payments with PayMongo; {$r['changed']} updated."]);
    }

    // GET /api/cron/payments?key=CRON_SECRET
    public function cron()
    {
        $this->api->require_method('GET');
        $secret = (string) config_item('cron_secret');
        $key = (string) ($_GET['key'] ?? ($_SERVER['HTTP_X_CRON_KEY'] ?? ''));
        if (strlen($secret) < 16 || !hash_equals($secret, $key)) $this->api->respond_error('Not found.', 404);
        $this->api->respond(['success' => true] + $this->payments->reconcile(null, 100) + $this->payments->run_lifecycle());
    }
}
