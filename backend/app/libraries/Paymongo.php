<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * HanapBuhay PayMongo Gateway Library
 * ------------------------------------------------------------------
 * Integrates PayMongo Checkout Sessions API for GCash, Maya, and Card
 * payments for Employers, MSMEs, and Service Buyers.
 */
class Paymongo
{
    private static string $api_url = 'https://api.paymongo.com/v1';
    private string $secret_key;
    private string $public_key;

    public function __construct()
    {
        $this->secret_key = self::get_env('PAYMONGO_SECRET_KEY', '');
        $this->public_key = self::get_env('PAYMONGO_PUBLIC_KEY', '');
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

    /**
     * Get the public key for client-side use.
     */
    public function get_public_key(): string
    {
        return $this->public_key;
    }

    /**
     * Create a PayMongo Checkout Session for a subscription plan.
     *
     * @param array $options [
     *   'name'         => Plan name,
     *   'description'  => Plan description,
     *   'amount'       => Price in PHP (e.g. 499),
     *   'user'         => User details array (name, email, phone),
     *   'metadata'     => Custom metadata (user_id, plan_id, billing_cycle),
     *   'success_url'  => Redirect after successful payment,
     *   'cancel_url'   => Redirect after cancellation
     * ]
     * @return array [success => bool, checkout_url => string, session_id => string, raw => array]
     */
    public function create_checkout_session(array $options): array
    {
        $amount_cents = (int) round(((float) $options['amount']) * 100);
        if ($amount_cents < 10000) { // PayMongo minimum is ₱100.00
            $amount_cents = 10000;
        }

        $user = $options['user'] ?? [];
        $billing_name = trim($user['full_name'] ?? $user['name'] ?? 'HanapBuhay Customer');
        $billing_email = trim($user['email'] ?? 'customer@hanapbuhay.ph');
        $billing_phone = trim($user['phone'] ?? '09171234567');

        $body = [
            'data' => [
                'attributes' => [
                    'billing' => [
                        'name'  => $billing_name ?: 'HanapBuhay Customer',
                        'email' => $billing_email ?: 'customer@hanapbuhay.ph',
                        'phone' => $billing_phone ?: '09171234567',
                    ],
                    'send_email_receipt' => true,
                    'show_description'   => true,
                    'show_line_items'     => true,
                    'description'        => $options['description'] ?? 'HanapBuhay Subscription',
                    'line_items'         => [
                        [
                            'currency'    => 'PHP',
                            'amount'      => $amount_cents,
                            'name'        => $options['name'] ?? 'HanapBuhay Plan',
                            'quantity'    => 1,
                            'description' => $options['description'] ?? 'HanapBuhay Subscription',
                        ]
                    ],
                    // Prominently accept GCash, Maya, and Cards via PayMongo
                    'payment_method_types' => [
                        'gcash',
                        'paymaya',
                        'card',
                        'grab_pay'
                    ],
                    'success_url' => $options['success_url'],
                    'cancel_url'  => $options['cancel_url']
                ]
            ]
        ];

        // PayMongo metadata must be a non-empty object if included
        $meta = !empty($options['metadata']) && (is_array($options['metadata']) || is_object($options['metadata']))
            ? (array) $options['metadata']
            : ['source' => 'hanapbuhay_portal'];
        $body['data']['attributes']['metadata'] = (object) $meta;

        $res = $this->request('POST', '/checkout_sessions', $body);

        if (!$res['success']) {
            return $res;
        }

        $data = $res['data']['data'] ?? [];
        $attributes = $data['attributes'] ?? [];

        return [
            'success'      => true,
            'session_id'   => $data['id'] ?? '',
            'checkout_url' => $attributes['checkout_url'] ?? '',
            'reference'    => $data['id'] ?? ('PAYMONGO-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8))),
            'raw'          => $res['data']
        ];
    }

    /**
     * Retrieve a PayMongo Checkout Session to verify payment status.
     *
     * @param string $session_id
     * @return array [success => bool, is_paid => bool, status => string, payment => array, raw => array]
     */
    public function get_checkout_session(string $session_id): array
    {
        $session_id = trim($session_id);
        if (empty($session_id)) {
            return ['success' => false, 'error' => 'Missing PayMongo session ID.'];
        }

        $res = $this->request('GET', '/checkout_sessions/' . urlencode($session_id));

        if (!$res['success']) {
            return $res;
        }

        $data = $res['data']['data'] ?? [];
        $attributes = $data['attributes'] ?? [];
        $payments = $attributes['payments'] ?? [];

        $is_paid = false;
        $payment_details = null;

        // Check if session itself is paid or has a paid payment record
        if (($attributes['status'] ?? '') === 'paid') {
            $is_paid = true;
        }

        foreach ($payments as $p) {
            $p_attr = $p['attributes'] ?? [];
            if (($p_attr['status'] ?? '') === 'paid') {
                $is_paid = true;
                $payment_details = [
                    'payment_id'   => $p['id'] ?? '',
                    'amount'       => ($p_attr['amount'] ?? 0) / 100,
                    'fee'          => ($p_attr['fee'] ?? 0) / 100,
                    'net_amount'   => ($p_attr['net_amount'] ?? 0) / 100,
                    'currency'     => $p_attr['currency'] ?? 'PHP',
                    'method'       => $p_attr['source']['type'] ?? 'gcash',
                    'paid_at'      => isset($p_attr['paid_at']) ? date('Y-m-d H:i:s', $p_attr['paid_at']) : date('Y-m-d H:i:s'),
                ];
                break;
            }
        }

        return [
            'success'    => true,
            'is_paid'    => $is_paid,
            'status'     => $attributes['status'] ?? 'unknown',
            'session_id' => $data['id'] ?? $session_id,
            'payment'    => $payment_details,
            'metadata'   => $attributes['metadata'] ?? [],
            'raw'        => $res['data']
        ];
    }

    /**
     * Send HTTP request to PayMongo REST API.
     */
    private function request(string $method, string $endpoint, ?array $body = null): array
    {
        $url = self::$api_url . $endpoint;
        $ch = curl_init();

        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_USERPWD, $this->secret_key . ':');
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Accept: application/json',
            'User-Agent: HanapBuhay/1.0'
        ]);

        if (strtoupper($method) === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($body !== null) {
                $json = json_encode($body);
                curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
            }
        } elseif (strtoupper($method) === 'GET') {
            curl_setopt($ch, CURLOPT_HTTPGET, true);
        }

        $raw_response = curl_exec($ch);
        $http_code    = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curl_err     = curl_error($ch);
        $curl_errno   = curl_errno($ch);
        curl_close($ch);

        // Network / connection failure
        if ($raw_response === false || $curl_errno !== 0) {
            return [
                'success'          => false,
                'error'            => 'PayMongo API unreachable: ' . ($curl_err ?: "cURL errno $curl_errno"),
                'is_network_error' => true
            ];
        }

        // Empty response (should not happen with PayMongo)
        if (empty($raw_response)) {
            return [
                'success'          => false,
                'error'            => 'Empty response from PayMongo (HTTP ' . $http_code . ')',
                'is_network_error' => ($http_code === 0)
            ];
        }

        $data = json_decode($raw_response, true);

        if ($http_code >= 400) {
            $err_msg = 'PayMongo error (HTTP ' . $http_code . ')';
            if (isset($data['errors']) && is_array($data['errors']) && count($data['errors']) > 0) {
                $first = $data['errors'][0];
                $err_msg = $first['detail'] ?? $first['code'] ?? $err_msg;
            }
            return [
                'success'   => false,
                'error'     => $err_msg,
                'http_code' => $http_code,
                'data'      => $data
            ];
        }

        return [
            'success' => true,
            'data'    => $data
        ];
    }
}

