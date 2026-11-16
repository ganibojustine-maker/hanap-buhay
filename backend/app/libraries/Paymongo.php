<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * hanapbuhay PayMongo gateway
 * ------------------------------------------------------------------
 * PayMongo Checkout Sessions, refunds and payment look-ups for employer plans
 * and the client Service Buyer Pass.
 *
 * Payment methods shown at checkout come from PAYMONGO_METHODS (comma list),
 * default "card,gcash,paymaya,grab_pay,qrph". Only list methods that are turned
 * on for your PayMongo account, or checkout will fail to start.
 *
 * Test mode: any sk_test_ key. Test payments are marked is_test = 1 everywhere.
 */
class Paymongo
{
    private static string $api_url = 'https://api.paymongo.com/v1';
    private string $secret_key;
    private string $public_key;

    public const METHOD_LABELS = [
        'card' => 'Credit or debit card', 'gcash' => 'GCash', 'paymaya' => 'Maya', 'grab_pay' => 'GrabPay',
        'qrph' => 'QR Ph (any bank or e-wallet app)', 'dob' => 'Online banking (BPI)', 'dob_ubp' => 'Online banking (UnionBank)',
        'billease' => 'BillEase (pay later)', 'brankas_bdo' => 'BDO online banking', 'brankas_landbank' => 'Landbank online banking',
        'brankas_metrobank' => 'Metrobank online banking', 'shopee_pay' => 'ShopeePay',
    ];

    public function __construct()
    {
        $this->secret_key = self::get_env('PAYMONGO_SECRET_KEY', '');
        $this->public_key = self::get_env('PAYMONGO_PUBLIC_KEY', '');
        // Sandbox only: a live key (real money) is ignored unless PAYMONGO_ALLOW_LIVE=true is set
        // on purpose. Checkout then says online payment is not set up, instead of charging anyone.
        if (str_starts_with($this->secret_key, 'sk_live_') && strtolower(self::get_env('PAYMONGO_ALLOW_LIVE', 'false')) !== 'true') {
            error_log('[PayMongo] live key ignored: this deployment is sandbox only (set PAYMONGO_ALLOW_LIVE=true to allow real payments)');
            $this->secret_key = '';
            $this->public_key = '';
        }
    }

    /**
     * Helper to read environment variables reliably.
     */
    public static function get_env(string $key, string $default = ''): string
    {
        $val = getenv($key);
        if ($val !== false && $val !== '') return trim((string) $val);

        if (isset($_ENV[$key]) && $_ENV[$key] !== '') return trim((string) $_ENV[$key]);
        if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') return trim((string) $_SERVER[$key]);

        // Attempt reading backend/.env
        static $env_cache = null;
        if ($env_cache === null) {
            $env_cache = [];
            $env_path = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env';
            if (file_exists($env_path)) {
                $lines = file($env_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                foreach ($lines as $line) {
                    $line = trim($line);
                    if ($line === '' || str_starts_with($line, '#')) continue;
                    if (str_contains($line, '=')) {
                        [$k, $v] = explode('=', $line, 2);
                        $env_cache[trim($k)] = trim(trim($v), '"\'');
                    }
                }
            }
        }

        return $env_cache[$key] ?? $default;
    }

    /** Methods turned on for checkout (PAYMONGO_METHODS). */
    public static function methods(): array
    {
        $list = array_values(array_filter(array_map('trim', explode(',', self::get_env('PAYMONGO_METHODS', 'card,gcash,paymaya,grab_pay,qrph')))));
        $list = array_values(array_intersect($list, array_keys(self::METHOD_LABELS)));
        return $list ?: ['card', 'gcash', 'paymaya'];
    }

    public static function method_label(?string $m): string
    {
        $m = str_replace('paymongo_', '', (string) $m);
        return self::METHOD_LABELS[$m] ?? ($m !== '' ? ucwords(str_replace('_', ' ', $m)) : 'PayMongo');
    }

    /** True while the secret key is a test key (or no key is set). */
    public function is_test(): bool
    {
        return $this->secret_key === '' || str_starts_with($this->secret_key, 'sk_test_');
    }

    /**
     * Show "Test" labels on screen? Off by default: the sandbox is shown exactly like a real
     * payment system. The database still records every test payment (payments.is_test), so
     * reports can tell them apart. Set PAYMONGO_SHOW_TEST_LABELS=true to show the labels.
     */
    public static function show_test_labels(): bool
    {
        return strtolower(self::get_env('PAYMONGO_SHOW_TEST_LABELS', 'false')) === 'true';
    }

    public function configured(): bool
    {
        return $this->secret_key !== '';
    }

    public function get_public_key(): string
    {
        return $this->public_key;
    }

    /**
     * Create a PayMongo Checkout Session.
     *
     * @param array $options name, description, amount (PHP), user (full_name, email, phone),
     *                       metadata, success_url, cancel_url
     * @return array success, checkout_url, session_id
     */
    public function create_checkout_session(array $options): array
    {
        $amount_cents = (int) round(((float) $options['amount']) * 100);
        if ($amount_cents < 10000) { // PayMongo's minimum is PHP 100.00; never charge more than the price
            return ['success' => false, 'error' => 'amount below minimum'];
        }

        $user = $options['user'] ?? [];
        $billing = array_filter([
            'name'  => trim((string) ($user['full_name'] ?? $user['name'] ?? '')),
            'email' => trim((string) ($user['email'] ?? '')),
            'phone' => trim((string) ($user['phone'] ?? '')),
        ]);

        $attributes = [
            'send_email_receipt'   => true,
            'show_description'     => true,
            'show_line_items'      => true,
            'description'          => $options['description'] ?? 'hanapbuhay plan',
            'line_items'           => [[
                'currency'    => 'PHP',
                'amount'      => $amount_cents,
                'name'        => $options['name'] ?? 'hanapbuhay plan',
                'quantity'    => 1,
                'description' => $options['description'] ?? 'hanapbuhay plan',
            ]],
            'payment_method_types' => self::methods(),
            'success_url'          => $options['success_url'],
            'cancel_url'           => $options['cancel_url'],
            'reference_number'     => $options['metadata']['reference'] ?? null,
        ];
        if ($billing) $attributes['billing'] = $billing;
        $attributes = array_filter($attributes, fn($v) => $v !== null);

        // PayMongo metadata must be a non-empty object if included
        $meta = !empty($options['metadata']) && is_array($options['metadata']) ? $options['metadata'] : ['source' => 'hanapbuhay'];
        $attributes['metadata'] = (object) $meta;

        $res = $this->request('POST', '/checkout_sessions', ['data' => ['attributes' => $attributes]]);
        if (!$res['success']) return $res;

        $data = $res['data']['data'] ?? [];
        return [
            'success'      => true,
            'session_id'   => $data['id'] ?? '',
            'checkout_url' => $data['attributes']['checkout_url'] ?? '',
            'raw'          => $res['data'],
        ];
    }

    /**
     * Read a Checkout Session: is it paid, did a try fail, has it expired.
     *
     * @return array success, is_paid, failure (method, message, code) | null, expired, status, payment
     */
    public function get_checkout_session(string $session_id): array
    {
        $session_id = trim($session_id);
        if ($session_id === '') return ['success' => false, 'error' => 'missing session id'];

        $res = $this->request('GET', '/checkout_sessions/' . urlencode($session_id));
        if (!$res['success']) return $res;

        $data = $res['data']['data'] ?? [];
        $attributes = $data['attributes'] ?? [];
        $is_paid = ($attributes['status'] ?? '') === 'paid';
        $payment = null;
        $failure = null;

        foreach ($attributes['payments'] ?? [] as $p) {
            $pa = $p['attributes'] ?? [];
            if (($pa['status'] ?? '') === 'failed') {
                $failure = ['payment_id' => $p['id'] ?? null, 'method' => $pa['source']['type'] ?? null,
                            'message' => $pa['failed_message'] ?? null, 'code' => $pa['failed_code'] ?? null];
            }
            if (($pa['status'] ?? '') === 'paid') {
                $is_paid = true;
                $payment = [
                    'payment_id' => $p['id'] ?? '',
                    'amount'     => ($pa['amount'] ?? 0) / 100,
                    'fee'        => ($pa['fee'] ?? 0) / 100,
                    'net_amount' => ($pa['net_amount'] ?? 0) / 100,
                    'currency'   => $pa['currency'] ?? 'PHP',
                    'method'     => $pa['source']['type'] ?? ($attributes['payment_method_used'] ?? null),
                    'paid_at'    => isset($pa['paid_at']) ? date('Y-m-d H:i:s', (int) $pa['paid_at']) : date('Y-m-d H:i:s'),
                    'refunds'    => $pa['refunds'] ?? [],
                ];
                break;
            }
        }

        $intent = $attributes['payment_intent']['attributes'] ?? [];
        if (!$failure && !empty($intent['last_payment_error'])) {
            $err = $intent['last_payment_error'];
            $failure = ['payment_id' => $err['payment_id'] ?? null, 'method' => $err['payment_method_type'] ?? null,
                        'message' => $err['failed_message'] ?? ($err['detail'] ?? null), 'code' => $err['failed_code'] ?? ($err['code'] ?? null)];
        }

        return [
            'success'       => true,
            'is_paid'       => $is_paid,
            'failure'       => $is_paid ? null : $failure,
            'expired'       => ($attributes['status'] ?? '') === 'expired',
            'intent_status' => $intent['status'] ?? null,
            'status'        => $attributes['status'] ?? 'unknown',
            'session_id'    => $data['id'] ?? $session_id,
            'payment'       => $payment,
            'metadata'      => $attributes['metadata'] ?? [],
        ];
    }

    /**
     * Refund a paid payment (full or partial). Amount in pesos.
     * reason: duplicate | fraudulent | requested_by_customer | others
     */
    public function create_refund(string $payment_id, float $amount, string $reason = 'requested_by_customer', string $notes = ''): array
    {
        $reason = in_array($reason, ['duplicate', 'fraudulent', 'requested_by_customer', 'others'], true) ? $reason : 'others';
        $attrs = ['amount' => (int) round($amount * 100), 'payment_id' => $payment_id, 'reason' => $reason];
        if ($notes !== '') $attrs['notes'] = mb_substr($notes, 0, 255);
        $res = $this->request('POST', '/refunds', ['data' => ['attributes' => $attrs]]);
        if (!$res['success']) return $res;
        $d = $res['data']['data'] ?? [];
        return ['success' => true, 'refund_id' => $d['id'] ?? '', 'status' => $d['attributes']['status'] ?? 'pending',
                'amount' => ((int) ($d['attributes']['amount'] ?? 0)) / 100];
    }

    /** A refund's status: pending | succeeded | failed. */
    public function get_refund(string $refund_id): array
    {
        $res = $this->request('GET', '/refunds/' . urlencode($refund_id));
        if (!$res['success']) return $res;
        $d = $res['data']['data'] ?? [];
        return ['success' => true, 'status' => $d['attributes']['status'] ?? 'pending', 'amount' => ((int) ($d['attributes']['amount'] ?? 0)) / 100];
    }

    /** Close an unpaid checkout so its link can no longer be used. */
    public function expire_checkout_session(string $session_id): array
    {
        return $this->request('POST', '/checkout_sessions/' . urlencode($session_id) . '/expire', []);
    }

    /**
     * Verify a PayMongo webhook signature header.
     * Header format: t=<timestamp>,te=<test-sig>,li=<live-sig>
     * Signature = HMAC-SHA256("<t>.<raw body>", webhook secret)
     */
    public function verify_webhook_signature(string $raw_body, string $header): bool
    {
        $secret = self::get_env('PAYMONGO_WEBHOOK_SECRET', '');
        if ($secret === '' || $header === '' || $raw_body === '') return false;

        $parts = [];
        foreach (explode(',', $header) as $kv) {
            [$k, $v] = array_pad(explode('=', trim($kv), 2), 2, '');
            $parts[trim($k)] = trim($v);
        }
        $t = $parts['t'] ?? '';
        if ($t === '' || !ctype_digit($t) || abs(time() - (int) $t) > 300) return false; // 5-minute replay window

        $expected = hash_hmac('sha256', $t . '.' . $raw_body, $secret);
        foreach (['li', 'te'] as $key) {
            if (!empty($parts[$key]) && hash_equals($expected, $parts[$key])) return true;
        }
        return false;
    }

    /**
     * Send an HTTP request to the PayMongo REST API. Errors are for the server log only;
     * people always see a plain message from the controller.
     */
    private function request(string $method, string $endpoint, ?array $body = null): array
    {
        if ($this->secret_key === '') return ['success' => false, 'error' => 'PAYMONGO_SECRET_KEY not set', 'not_configured' => true];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, self::$api_url . $endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_USERPWD, $this->secret_key . ':');
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        if (!ini_get('curl.cainfo') && !ini_get('openssl.cafile')) {
            $root = defined('ROOT_DIR') ? ROOT_DIR : dirname(__DIR__, 2) . DIRECTORY_SEPARATOR;
            foreach ([$root . 'certs' . DIRECTORY_SEPARATOR . 'cacert.pem', '/etc/ssl/certs/ca-certificates.crt'] as $ca) {
                if (is_file($ca)) { curl_setopt($ch, CURLOPT_CAINFO, $ca); break; }
            }
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'Accept: application/json', 'User-Agent: hanapbuhay/1.0']);

        if (strtoupper($method) === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body ? json_encode($body) : '{}');
        } else {
            curl_setopt($ch, CURLOPT_HTTPGET, true);
        }

        $raw = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errno = curl_errno($ch);
        $err = curl_error($ch);
        curl_close($ch);

        if ($raw === false || $errno !== 0) {
            error_log("[PayMongo] {$method} {$endpoint} unreachable: {$err}");
            return ['success' => false, 'error' => 'unreachable', 'is_network_error' => true];
        }
        $data = json_decode((string) $raw, true);
        if ($code >= 400) {
            $msg = $data['errors'][0]['detail'] ?? $data['errors'][0]['code'] ?? "HTTP {$code}";
            error_log("[PayMongo] {$method} {$endpoint} HTTP {$code}: {$msg}");
            return ['success' => false, 'error' => $msg, 'http_code' => $code, 'data' => $data];
        }
        return ['success' => true, 'data' => $data];
    }
}
