<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * Payments — the one place a payment's outcome is decided
 * ------------------------------------------------------------------
 * Every screen (the person's billing history, their notifications, the admin
 * payments page) reads the `payments` table this class writes, so the numbers
 * always agree.
 *
 * Status of a payment:
 *   pending    checkout started, waiting for PayMongo to confirm
 *   paid       PayMongo confirmed it; the plan is active; a receipt exists
 *   failed     PayMongo reported a failed try; the plan did not change
 *   cancelled  the person left checkout or cancelled it
 *   expired    the checkout link / QR code timed out (24 hours)
 *   refunded   the money was returned in full (refund_status tracks partial refunds)
 *
 * Rules
 *   - A plan only changes when PayMongo says a payment is paid (webhook, or our own
 *     look-up). Coming back from the payment page proves nothing by itself.
 *   - PayMongo does not resend a webhook it could not deliver, so reconcile() asks
 *     PayMongo directly about every pending payment (cron + whenever billing is opened).
 *   - A payment is counted once: the status change is a conditional UPDATE that only
 *     one request can win, and paymongo_payment_id is UNIQUE.
 */
class Payments
{
    /** How long an unpaid checkout stays usable before we treat it as expired. */
    public const CHECKOUT_HOURS = 24;

    public const STATUS_TEXT = [
        'pending'   => 'Waiting for payment',
        'paid'      => 'Paid',
        'failed'    => "Payment didn't go through",
        'cancelled' => 'Cancelled',
        'expired'   => 'Payment window expired',
        'refunded'  => 'Refunded',
    ];

    private $db;
    private $paymongo;
    private $subs;
    private $notify;

    public function __construct()
    {
        $lava = lava_instance();
        $lava->call->database();
        $lava->call->model('Subscription_model', 'subscription_model');
        $lava->call->model('Application_model', 'application_model');
        require_once __DIR__ . DIRECTORY_SEPARATOR . 'Paymongo.php';
        $this->db = $lava->db;
        $this->paymongo = new Paymongo();
        $this->subs = $lava->subscription_model;
        $this->notify = $lava->application_model;
    }

    public function paymongo(): Paymongo { return $this->paymongo; }

    public static function ready(): bool
    {
        static $ok = null;
        if ($ok === null) {
            try { $ok = (bool) lava_instance()->db->raw("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'payments'")->fetchColumn(); }
            catch (\Throwable $e) { $ok = false; }
        }
        return $ok;
    }

    public function find(int $id): ?array
    {
        return $this->db->raw('SELECT * FROM payments WHERE id = ?', [$id])->fetch(\PDO::FETCH_ASSOC) ?: null;
    }

    public function find_by_reference(string $ref): ?array
    {
        return $this->db->raw('SELECT * FROM payments WHERE reference = ? OR paymongo_session_id = ? LIMIT 1', [$ref, $ref])->fetch(\PDO::FETCH_ASSOC) ?: null;
    }

    private function user(int $id): ?array
    {
        return $this->db->raw('SELECT * FROM users WHERE id = ?', [$id])->fetch(\PDO::FETCH_ASSOC) ?: null;
    }

    private static function peso(float $n): string
    {
        return "\u{20B1}" . number_format($n, 2);
    }

    /* ── plan changes ──────────────────────────────────────── */

    /** new | renewal | upgrade | downgrade — compared with the plan the person is on now. */
    public function change_type(array $user, array $plan): string
    {
        $cur = $this->subs->current_plan($user);
        $paidNow = $this->subs->has_active_paid_plan($user);
        if (!$paidNow) return 'new';
        if (($cur['id'] ?? '') === $plan['id']) return 'renewal';
        return (float) $plan['price_monthly'] > (float) ($cur['price_monthly'] ?? 0) ? 'upgrade' : 'downgrade';
    }

    /** Features gained and lost going from one plan to another. */
    public function feature_diff(?array $from, ?array $to): array
    {
        $a = $from['features'] ?? []; $b = $to['features'] ?? [];
        return ['unlocked' => array_values(array_diff($b, $a)), 'locked' => array_values(array_diff($a, $b))];
    }

    /** One line in the subscription timeline. */
    public function event(int $uid, string $event, ?string $fromPlan, ?string $toPlan, ?int $subId = null, ?int $paymentId = null, ?string $note = null): void
    {
        try {
            $diff = $this->feature_diff($fromPlan ? $this->subs->find_plan($fromPlan) : null, $toPlan ? $this->subs->find_plan($toPlan) : null);
            if (in_array($event, ['payment_failed', 'payment_pending', 'cancel_requested', 'resumed', 'downgrade_scheduled', 'refund_pending'], true)) $diff = ['unlocked' => [], 'locked' => []];
            $this->db->raw(
                'INSERT INTO subscription_events (user_id, subscription_id, payment_id, event, from_plan, to_plan, unlocked, locked, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
                [$uid, $subId, $paymentId, $event, $fromPlan, $toPlan, json_encode($diff['unlocked']), json_encode($diff['locked']), $note]
            );
        } catch (\Throwable $e) { error_log('[payments] event: ' . $e->getMessage()); }
    }

    /* ── checkout ──────────────────────────────────────────── */

    /**
     * Start a PayMongo checkout for a plan. Returns ['payment' => row, 'checkout_url' => url]
     * or ['error' => plain message].
     */
    public function start_checkout(array $user, array $plan, string $cycle): array
    {
        $price = $cycle === 'quarterly' ? (float) ($plan['price_quarter'] ?? $plan['price_monthly'] * 3) : (float) $plan['price_monthly'];
        if ($price < 100) return ['error' => 'This plan cannot be paid online.'];
        if (!$this->paymongo->configured()) return ['error' => 'Online payment is not set up yet. Please contact support.'];

        $change = $this->change_type($user, $plan);
        $ref = 'HB-' . date('ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
        $front = rtrim(Paymongo::get_env('APP_FRONTEND_URL', 'http://localhost:5173'), '/');
        $who = ($user['account_type'] ?? '') === 'hirer' ? 'Service Buyer Pass' : 'Employer plan';

        $res = $this->paymongo->create_checkout_session([
            'name'        => $plan['name'] . ($cycle === 'quarterly' ? ' (3 months)' : ' (1 month)'),
            'description' => "hanapbuhay {$who}: {$plan['name']}",
            'amount'      => $price,
            'user'        => $user,
            'metadata'    => ['reference' => $ref, 'user_id' => (string) $user['id'], 'plan_id' => $plan['id'], 'billing_cycle' => $cycle, 'change_type' => $change],
            'success_url' => "{$front}/dashboard/subscription?ref={$ref}&return=success",
            'cancel_url'  => "{$front}/dashboard/subscription?ref={$ref}&return=cancelled",
        ]);
        if (!$res['success']) return ['error' => "We couldn't open the payment page right now. Please try again in a moment."];

        // the plan row this payment is for; it becomes the active plan only once paid
        $this->db->table('subscriptions')->insert([
            'user_id' => (int) $user['id'], 'account_type' => $user['account_type'], 'plan_id' => $plan['id'], 'plan_name' => $plan['name'],
            'billing_cycle' => $cycle, 'price' => $price, 'payment_method' => 'paymongo', 'payment_reference' => $ref,
            'paymongo_session_id' => $res['session_id'], 'contact_credits' => (int) ($plan['contact_credits'] ?? 0),
            'featured_credits' => (int) ($plan['featured_slots'] ?? 0), 'status' => 'pending',
            'starts_at' => date('Y-m-d H:i:s'), 'expires_at' => date('Y-m-d H:i:s', time() + 30 * 86400), 'created_at' => date('Y-m-d H:i:s'),
        ]);
        $subId = (int) $this->db->last_id();

        $this->db->raw(
            "INSERT INTO payments (user_id, subscription_id, reference, purpose, plan_id, plan_name, billing_cycle, change_type, amount, currency, status,
                paymongo_session_id, checkout_url, is_test, expires_at, created_at, updated_at)
             VALUES (?, ?, ?, 'subscription', ?, ?, ?, ?, ?, 'PHP', 'pending', ?, ?, ?, DATE_ADD(NOW(), INTERVAL " . self::CHECKOUT_HOURS . " HOUR), NOW(), NOW())",
            [(int) $user['id'], $subId, $ref, $plan['id'], $plan['name'], $cycle, $change, $price, $res['session_id'], $res['checkout_url'], $this->paymongo->is_test() ? 1 : 0]
        );
        $payment = $this->find_by_reference($ref);
        $this->event((int) $user['id'], 'payment_pending', null, $plan['id'], $subId, (int) $payment['id'], 'Checkout started for ' . self::peso($price));
        return ['payment' => $payment, 'checkout_url' => $res['checkout_url']];
    }

    /* ── deciding the outcome ──────────────────────────────── */

    /**
     * Ask PayMongo about one payment and record what it says. Safe to call any number of
     * times, from any request: each outcome is recorded once.
     */
    public function sync(array $p): array
    {
        if (in_array($p['status'], ['paid', 'refunded', 'cancelled'], true)) return $p;
        if (empty($p['paymongo_session_id'])) return $p;

        $chk = $this->paymongo->get_checkout_session((string) $p['paymongo_session_id']);
        $this->db->raw('UPDATE payments SET last_checked_at = NOW() WHERE id = ?', [(int) $p['id']]);
        if (!$chk['success']) return $p; // PayMongo unreachable: try again later, change nothing

        if (!empty($chk['is_paid'])) {
            $this->mark_paid($p, $chk['payment'] ?? []);
        } elseif (!empty($chk['expired']) || (!empty($p['expires_at']) && strtotime((string) $p['expires_at']) < time())) {
            $this->mark_closed($p, 'expired', null);
        } elseif (!empty($chk['failure']) && $p['status'] === 'pending') {
            $this->mark_failed($p, $chk['failure']);
        }
        return $this->find((int) $p['id']) ?? $p;
    }

    /** PayMongo confirmed the money: activate the plan, issue a receipt, tell the person. */
    public function mark_paid(array $p, array $pay): bool
    {
        $pmId = (string) ($pay['payment_id'] ?? '');
        // a PayMongo payment can only ever belong to one row
        if ($pmId !== '') {
            $other = $this->db->raw('SELECT id FROM payments WHERE paymongo_payment_id = ? AND id <> ?', [$pmId, (int) $p['id']])->fetchColumn();
            if ($other) return false;
        }
        // claim it: only one request can move it out of pending/failed/expired
        $claim = $this->db->raw("UPDATE payments SET status = 'paid', paymongo_payment_id = ?, method = ?, fee = ?, net_amount = ?, paid_at = ?, failure_reason = NULL, updated_at = NOW()
                                 WHERE id = ? AND status IN ('pending','failed','expired')",
            [$pmId ?: null, $pay['method'] ?? null, $pay['fee'] ?? null, $pay['net_amount'] ?? null, $pay['paid_at'] ?? date('Y-m-d H:i:s'), (int) $p['id']]);
        if ($claim->rowCount() < 1) return false;

        $receipt = 'HB-OR-' . date('Y') . '-' . str_pad((string) $p['id'], 6, '0', STR_PAD_LEFT);
        $this->db->raw('UPDATE payments SET receipt_no = ? WHERE id = ?', [$receipt, (int) $p['id']]);

        $user = $this->user((int) $p['user_id']);
        if (!$user) return true;

        // Older code switched the plan on in a second subscriptions row with the same reference.
        // If that already happened, this payment is just catching up: record it, never activate twice.
        if (!empty($p['reference'])) {
            $done = $this->db->raw("SELECT id, starts_at FROM subscriptions WHERE payment_reference = ? AND user_id = ? AND id <> ?
                                    AND status IN ('active','superseded','expired','cancelled','refunded') ORDER BY id DESC LIMIT 1",
                [$p['reference'], (int) $p['user_id'], (int) $p['subscription_id']])->fetch(\PDO::FETCH_ASSOC);
            if ($done) {
                $this->db->raw("UPDATE payments SET subscription_id = ?, paid_at = COALESCE(?, paid_at) WHERE id = ?",
                    [(int) $done['id'], $done['starts_at'] ?? null, (int) $p['id']]);
                $this->db->raw("UPDATE subscriptions SET status = 'superseded' WHERE id = ? AND status = 'pending'", [(int) $p['subscription_id']]);
                return true;
            }
        }
        $from = $this->subs->current_plan($user)['id'] ?? null;

        $res = $this->subs->subscribe((int) $user['id'], $user, [
            'sub_id' => (int) $p['subscription_id'], 'plan_id' => $p['plan_id'], 'billing_cycle' => $p['billing_cycle'],
            'payment_method' => 'paymongo_' . ($pay['method'] ?? 'checkout'), 'payment_reference' => $p['reference'],
            'paymongo_session_id' => $p['paymongo_session_id'],
        ]);
        if (!($res['success'] ?? false)) {
            error_log('[payments] paid but plan not activated: ' . $p['reference']);
            $this->notify->create_notification((int) $user['id'], 'system', 'We received your payment',
                "We received your payment of " . self::peso((float) $p['amount']) . " (reference {$p['reference']}), but your plan did not switch on yet. Our team has been told and will fix it shortly.", '/dashboard/subscription');
            return true;
        }
        $event = ['new' => 'subscribed', 'renewal' => 'renewed', 'upgrade' => 'upgraded', 'downgrade' => 'downgraded'][$p['change_type'] ?? 'new'] ?? 'subscribed';
        $this->event((int) $user['id'], $event, $from, $p['plan_id'], (int) $p['subscription_id'], (int) $p['id'],
            'Paid ' . self::peso((float) $p['amount']) . ' with ' . Paymongo::method_label($pay['method'] ?? null) . ". Receipt {$receipt}");
        try { $this->db->raw('UPDATE subscriptions SET scheduled_plan_id = NULL, cancel_at_period_end = 0 WHERE id = ?', [(int) $p['subscription_id']]); } catch (\Throwable $e) {}

        $until = !empty($res['expires_at']) ? date('F j, Y', strtotime($res['expires_at'])) : '';
        $this->notify->create_notification((int) $user['id'], 'payment',
            "Payment received: {$p['plan_name']} is active",
            "Thank you! We received " . self::peso((float) $p['amount']) . " through " . Paymongo::method_label($pay['method'] ?? null) . ".\n\nYour {$p['plan_name']} is active until {$until}.\nReceipt no.: {$receipt}\nReference: {$p['reference']}"
                . ((int) $p['is_test'] && Paymongo::show_test_labels() ?"\n\n(This was a test payment. No real money was charged.)" : ''),
            '/dashboard/subscription');
        foreach ($this->db->table('users')->where('role', 'admin')->get_all() ?: [] as $adm) {
            $this->notify->create_notification((int) $adm['id'], 'system', 'Payment received: ' . self::peso((float) $p['amount']),
                ($user['full_name'] ?? 'An account') . " paid for {$p['plan_name']} (reference {$p['reference']}).", '/dashboard/payments', false);
        }
        return true;
    }

    /** PayMongo reported a failed try. The plan stays as it was. */
    public function mark_failed(array $p, array $failure): void
    {
        $reason = mb_substr((string) ($failure['message'] ?? $failure['code'] ?? 'The bank or e-wallet declined the payment.'), 0, 255);
        $upd = $this->db->raw("UPDATE payments SET status = 'failed', failure_reason = ?, method = COALESCE(?, method), updated_at = NOW() WHERE id = ? AND status = 'pending'",
            [$reason, $failure['method'] ?? null, (int) $p['id']]);
        if ($upd->rowCount() < 1) return;
        $this->event((int) $p['user_id'], 'payment_failed', null, $p['plan_id'], (int) $p['subscription_id'], (int) $p['id'], $reason);
        $this->notify->create_notification((int) $p['user_id'], 'payment', "Your payment didn't go through",
            "Your payment of " . self::peso((float) $p['amount']) . " for {$p['plan_name']} didn't go through. Your plan was not changed.\n\nYou can try again or use another payment method from your billing page. Reference: {$p['reference']}",
            '/dashboard/subscription');
    }

    /** Checkout closed without payment: the person left (cancelled) or the link timed out (expired). */
    public function mark_closed(array $p, string $as, ?int $actor): void
    {
        $upd = $this->db->raw("UPDATE payments SET status = ?, updated_at = NOW() WHERE id = ? AND status IN ('pending','failed')", [$as, (int) $p['id']]);
        if ($upd->rowCount() < 1) return;
        $this->db->raw("UPDATE subscriptions SET status = 'abandoned' WHERE id = ? AND status = 'pending'", [(int) $p['subscription_id']]);
        if ($as === 'expired') {
            $this->notify->create_notification((int) $p['user_id'], 'payment', 'Your payment window expired',
                "The payment page for {$p['plan_name']} (" . self::peso((float) $p['amount']) . ") timed out before a payment was made. Nothing was charged and your plan did not change. You can start a new payment any time.",
                '/dashboard/subscription', false);
        }
    }

    /**
     * Ask PayMongo about pending payments (all of them, or one person's). Returns how many
     * changed. Called by the cron, when billing is opened, and from the admin page.
     */
    public function reconcile(?int $userId = null, int $limit = 40): array
    {
        if (!self::ready()) return ['checked' => 0, 'changed' => 0];
        $sql = "SELECT * FROM payments WHERE status IN ('pending','failed') AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
                AND (last_checked_at IS NULL OR last_checked_at < DATE_SUB(NOW(), INTERVAL 1 MINUTE))";
        $args = [];
        if ($userId) { $sql .= ' AND user_id = ?'; $args[] = $userId; }
        $rows = $this->db->raw($sql . ' ORDER BY created_at ASC LIMIT ' . max(1, min(100, $limit)), $args)->fetchAll(\PDO::FETCH_ASSOC) ?: [];
        $changed = 0;
        foreach ($rows as $p) {
            $after = $this->sync($p);
            if (($after['status'] ?? '') !== $p['status']) $changed++;
        }
        // refunds still waiting at PayMongo
        $refunds = $this->db->raw("SELECT * FROM payments WHERE refund_status = 'pending' AND paymongo_refund_id IS NOT NULL" . ($userId ? ' AND user_id = ?' : '') . ' LIMIT 20', $userId ? [$userId] : [])->fetchAll(\PDO::FETCH_ASSOC) ?: [];
        foreach ($refunds as $p) {
            $r = $this->paymongo->get_refund((string) $p['paymongo_refund_id']);
            if (($r['success'] ?? false) && in_array($r['status'], ['succeeded', 'failed'], true)) { $this->refund_settled($p, $r['status']); $changed++; }
        }
        return ['checked' => count($rows) + count($refunds), 'changed' => $changed];
    }

    /* ── refunds ───────────────────────────────────────────── */

    /** Admin refunds a paid payment through PayMongo. */
    public function refund(array $p, float $amount, string $reason, int $adminId): array
    {
        if ($p['status'] !== 'paid') return ['error' => 'Only paid payments can be refunded.'];
        if (!empty($p['refund_status']) && $p['refund_status'] !== 'failed') return ['error' => 'A refund was already started for this payment.'];
        if ($amount <= 0 || $amount > (float) $p['amount']) return ['error' => 'Enter an amount up to ' . self::peso((float) $p['amount']) . '.'];
        if (empty($p['paymongo_payment_id'])) return ['error' => 'This payment has no PayMongo payment ID, so it cannot be refunded online.'];

        $r = $this->paymongo->create_refund((string) $p['paymongo_payment_id'], $amount, 'requested_by_customer', $reason);
        if (!$r['success']) return ['error' => "PayMongo did not accept the refund. Check the payment in your PayMongo dashboard."];
        $this->db->raw('UPDATE payments SET refund_status = ?, refunded_amount = ?, paymongo_refund_id = ?, refund_reason = ?, updated_at = NOW() WHERE id = ?',
            [$r['status'] === 'succeeded' ? 'pending' : 'pending', $amount, $r['refund_id'], mb_substr($reason, 0, 255), (int) $p['id']]);
        $this->event((int) $p['user_id'], 'refund_pending', $p['plan_id'], null, (int) $p['subscription_id'], (int) $p['id'], 'Refund of ' . self::peso($amount) . ' started');
        $this->notify->create_notification((int) $p['user_id'], 'payment', 'Your refund is being processed',
            "We started a refund of " . self::peso($amount) . " for {$p['plan_name']} (reference {$p['reference']}). It usually reaches your card or e-wallet in 5 to 10 banking days.",
            '/dashboard/subscription');
        if ($r['status'] === 'succeeded') $this->refund_settled($this->find((int) $p['id']), 'succeeded');
        return ['success' => true, 'payment' => $this->find((int) $p['id'])];
    }

    /** A refund finished at PayMongo. A full refund ends the plan it paid for. */
    public function refund_settled(array $p, string $result): void
    {
        $upd = $this->db->raw("UPDATE payments SET refund_status = ?, updated_at = NOW() WHERE id = ? AND refund_status = 'pending'",
            [$result === 'succeeded' ? 'succeeded' : 'failed', (int) $p['id']]);
        if ($upd->rowCount() < 1) return;
        if ($result !== 'succeeded') {
            $this->notify->create_notification((int) $p['user_id'], 'payment', 'Your refund could not be completed',
                "The refund for {$p['plan_name']} (reference {$p['reference']}) did not go through. Our team will contact you to send it another way.", '/dashboard/subscription');
            return;
        }
        $full = (float) $p['refunded_amount'] >= (float) $p['amount'] - 0.009;
        if ($full) {
            $this->db->raw("UPDATE payments SET status = 'refunded' WHERE id = ?", [(int) $p['id']]);
            $user = $this->user((int) $p['user_id']);
            if ($user && ($user['subscription_tier'] ?? '') === $p['plan_id']) {
                $this->end_plan($user, 'refunded', 'Plan ended because the payment was refunded');
            }
        }
        $this->notify->create_notification((int) $p['user_id'], 'payment', 'Your refund is complete',
            "We refunded " . self::peso((float) $p['refunded_amount']) . " for {$p['plan_name']} (reference {$p['reference']})." . ($full ? ' The plan it paid for has ended.' : ''),
            '/dashboard/subscription');
    }

    /* ── plan end, reminders ───────────────────────────────── */

    /** Move an account back to its free plan and record what was locked. */
    public function end_plan(array $user, string $event, string $note): void
    {
        $from = (string) ($user['subscription_tier'] ?? '');
        $free = ($user['account_type'] ?? '') === 'hirer' ? 'hirer_free' : 'employer_starter';
        if ($from === '' || $from === $free) return;
        $this->db->raw("UPDATE users SET subscription_tier = ?, subscription_status = ?, subscription_expires_at = NULL,
                        featured_credits = 0, contact_credits = LEAST(contact_credits, ?) WHERE id = ?",
            [$free, $event === 'refunded' ? 'refunded' : 'expired', (int) ($this->subs->find_plan($free)['contact_credits'] ?? 3), (int) $user['id']]);
        $this->db->raw("UPDATE subscriptions SET status = ? WHERE user_id = ? AND status = 'active'", [$event === 'refunded' ? 'refunded' : 'expired', (int) $user['id']]);
        $this->event((int) $user['id'], $event, $from, $free, null, null, $note);
    }

    /**
     * Daily housekeeping: end plans whose date passed, and remind people 3 days before.
     * Plans never charge by themselves, so a reminder is the "renewal".
     */
    public function run_lifecycle(): array
    {
        $ended = 0; $reminded = 0;
        $rows = $this->db->raw("SELECT * FROM users WHERE subscription_expires_at IS NOT NULL AND subscription_expires_at < NOW()
                                AND subscription_tier NOT IN ('employer_starter','hirer_free','free') LIMIT 200")->fetchAll(\PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as $u) {
            $sub = $this->db->raw("SELECT scheduled_plan_id FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", [(int) $u['id']])->fetch(\PDO::FETCH_ASSOC);
            $plan = $this->subs->find_plan((string) $u['subscription_tier']);
            $this->end_plan($u, 'expired', 'Plan reached its end date');
            $next = !empty($sub['scheduled_plan_id']) ? $this->subs->find_plan($sub['scheduled_plan_id']) : null;
            $this->notify->create_notification((int) $u['id'], 'payment', 'Your plan has ended',
                "Your " . ($plan['name'] ?? 'plan') . " ended today, so your account is back on the free plan. " . (($this->feature_diff($plan, $this->subs->find_plan((string) (($u['account_type'] ?? '') === 'hirer' ? 'hirer_free' : 'employer_starter'))))['locked'] ? 'Some features are now locked. ' : '')
                    . ($next && (float) $next['price_monthly'] > 0 ? "You chose to switch to {$next['name']}: pay for it on your billing page to start it." : 'Renew any time from your billing page.'),
                '/dashboard/subscription');
            $ended++;
        }
        try {
            $soon = $this->db->raw("SELECT s.id, s.user_id, s.plan_name, s.cancel_at_period_end, u.subscription_expires_at
                                    FROM subscriptions s JOIN users u ON u.id = s.user_id
                                    WHERE s.status = 'active' AND s.price > 0 AND s.renewal_reminded_at IS NULL AND s.cancel_at_period_end = 0
                                      AND u.subscription_expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 3 DAY) LIMIT 200")->fetchAll(\PDO::FETCH_ASSOC) ?: [];
            foreach ($soon as $s) {
                $this->db->raw('UPDATE subscriptions SET renewal_reminded_at = NOW() WHERE id = ?', [(int) $s['id']]);
                $this->notify->create_notification((int) $s['user_id'], 'payment', 'Your plan ends soon',
                    "Your {$s['plan_name']} ends on " . date('F j, Y', strtotime($s['subscription_expires_at'])) . ". Plans do not renew by themselves, so renew from your billing page to keep your credits and features. Renewing early adds the new days on top.",
                    '/dashboard/subscription');
                $reminded++;
            }
        } catch (\Throwable $e) { /* before migration 021 */ }
        return ['ended' => $ended, 'reminded' => $reminded];
    }

    /* ── reading ───────────────────────────────────────────── */

    public function present(array $p): array
    {
        return [
            'id' => (int) $p['id'], 'reference' => $p['reference'], 'plan_id' => $p['plan_id'], 'plan_name' => $p['plan_name'],
            'billing_cycle' => $p['billing_cycle'], 'change_type' => $p['change_type'], 'amount' => (float) $p['amount'],
            'method' => $p['method'], 'method_label' => $p['method'] ? Paymongo::method_label($p['method']) : null,
            'status' => $p['status'], 'status_text' => self::STATUS_TEXT[$p['status']] ?? $p['status'],
            'failure_reason' => $p['failure_reason'], 'receipt_no' => $p['receipt_no'], 'is_test' => (bool) $p['is_test'] && Paymongo::show_test_labels(),
            'refund_status' => $p['refund_status'], 'refunded_amount' => $p['refunded_amount'] !== null ? (float) $p['refunded_amount'] : null,
            'paid_at' => $p['paid_at'], 'created_at' => $p['created_at'], 'expires_at' => $p['expires_at'],
            'can_retry' => in_array($p['status'], ['pending', 'failed', 'expired', 'cancelled'], true),
            'can_continue' => $p['status'] === 'pending' && !empty($p['checkout_url']) && (!empty($p['expires_at']) && strtotime((string) $p['expires_at']) > time()),
        ];
    }

    public function history(int $uid): array
    {
        if (!self::ready()) return [];
        $rows = $this->db->raw('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100', [$uid])->fetchAll(\PDO::FETCH_ASSOC) ?: [];
        return array_map([$this, 'present'], $rows);
    }

    public function timeline(int $uid): array
    {
        if (!self::ready()) return [];
        $rows = $this->db->raw('SELECT event, from_plan, to_plan, unlocked, locked, note, created_at FROM subscription_events WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100', [$uid])->fetchAll(\PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) {
            $r['unlocked'] = json_decode((string) $r['unlocked'], true) ?: [];
            $r['locked'] = json_decode((string) $r['locked'], true) ?: [];
            $r['from_name'] = $r['from_plan'] ? ($this->subs->find_plan($r['from_plan'])['name'] ?? $r['from_plan']) : null;
            $r['to_name'] = $r['to_plan'] ? ($this->subs->find_plan($r['to_plan'])['name'] ?? $r['to_plan']) : null;
        }
        return $rows;
    }
}
