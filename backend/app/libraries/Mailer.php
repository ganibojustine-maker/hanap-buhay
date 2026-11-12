<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * HanapBuhay Mailer Library
 * ------------------------------------------------------------------
 * Handles transactional email notifications via the Brevo (Sendinblue)
 * HTTP API.  Falls back to file logging in development mode when no
 * BREVO_API_KEY is configured.
 *
 * Required env vars for production:
 *   BREVO_API_KEY        – Brevo v3 API key
 *   MAIL_FROM_ADDRESS    – verified sender (default: noreply@hanapbuhay.ph)
 *   MAIL_FROM_NAME       – sender display name
 */
class Mailer
{
    /** Brevo transactional email endpoint */
    private const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

    /**
     * Send an email via the Brevo API (or fallback to mail.log).
     *
     * @param string $to_email  Recipient email address
     * @param string $to_name   Recipient display name
     * @param string $subject   Email subject line
     * @param string $html_body HTML formatted body
     * @param string $text_body Plain-text fallback (optional)
     * @return array  Result summary with status and mode
     */
    public static function send(string $to_email, string $to_name, string $subject, string $html_body, string $text_body = ''): array
    {
        $to_email = trim($to_email);
        if (empty($to_email) || !filter_var($to_email, FILTER_VALIDATE_EMAIL)) {
            return ['success' => false, 'mode' => 'failed', 'error' => 'Invalid recipient email address.'];
        }

        $api_key      = trim(self::get_env('BREVO_API_KEY', ''));
        $from_address = trim(self::get_env('MAIL_FROM_ADDRESS', 'noreply@hanapbuhay.ph'));
        $from_name    = trim(self::get_env('MAIL_FROM_NAME', 'HanapBuhay Oriental Mindoro'));

        // Fallback to log mode when no API key is set
        if (empty($api_key)) {
            self::log_email($to_email, $to_name, $subject, $html_body, 'Dev/Logged mode (BREVO_API_KEY not configured)');
            return [
                'success' => true,
                'mode'    => 'logged',
                'message' => 'Email logged to runtime/logs/mail.log (BREVO_API_KEY not configured).'
            ];
        }

        // Build Brevo API payload
        $payload = [
            'sender'      => ['name' => $from_name, 'email' => $from_address],
            'to'          => [['email' => $to_email, 'name' => $to_name ?: $to_email]],
            'subject'     => $subject,
            'htmlContent' => $html_body,
        ];

        if (!empty($text_body)) {
            $payload['textContent'] = $text_body;
        }

        // cURL POST to Brevo
        $ch = curl_init(self::BREVO_URL);
        $curl_opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            CURLOPT_HTTPHEADER     => [
                'accept: application/json',
                'content-type: application/json',
                'api-key: ' . $api_key,
            ],
        ];
        // Windows/Laragon PHP usually has no CA bundle configured (curl.cainfo empty),
        // which makes every HTTPS call fail with "unable to get local issuer certificate".
        $ca_bundle = self::find_ca_bundle();
        if ($ca_bundle !== null) {
            $curl_opts[CURLOPT_CAINFO] = $ca_bundle;
        }
        curl_setopt_array($ch, $curl_opts);

        $raw  = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($raw === false || !empty($err)) {
            $error_msg = 'Brevo cURL error: ' . ($err ?: 'no response');
            error_log('[Mailer Error] ' . $error_msg);
            self::log_email($to_email, $to_name, $subject, $html_body, 'FAILED: ' . $error_msg);
            return ['success' => false, 'mode' => 'failed', 'error' => $error_msg];
        }

        $result = json_decode($raw, true);

        // Brevo returns 201 on success
        if ($code === 201 || $code === 200) {
            $msg_id = $result['messageId'] ?? 'unknown';
            self::log_email($to_email, $to_name, $subject, $html_body, "Brevo Sent OK (messageId: {$msg_id})");
            return [
                'success'    => true,
                'mode'       => 'brevo',
                'message'    => 'Email sent successfully via Brevo API.',
                'message_id' => $msg_id,
            ];
        }

        // Error response from Brevo
        $brevo_error = $result['message'] ?? ($result['code'] ?? "HTTP {$code}");
        $brevo_code  = (string) ($result['code'] ?? '');
        $hint = '';
        if ($code === 401 || $brevo_code === 'unauthorized') {
            $hint = ' (Check BREVO_API_KEY - it must be a Brevo v3 API key, not an SMTP key.)';
        } elseif (stripos($brevo_error, 'sender') !== false || stripos($brevo_error, 'not valid') !== false) {
            $hint = " (The sender {$from_address} is not verified in Brevo. Set MAIL_FROM_ADDRESS to an email you verified under Brevo > Senders & IP.)";
        } elseif ($code === 402 || stripos($brevo_error, 'credit') !== false) {
            $hint = ' (Brevo account has no sending credits left or is not yet activated.)';
        }
        error_log("[Mailer Error] Brevo API {$code}: {$brevo_error}{$hint}");
        self::log_email($to_email, $to_name, $subject, $html_body, "Brevo FAILED ({$code}): {$brevo_error}{$hint}");

        return ['success' => false, 'mode' => 'failed', 'http_code' => $code, 'error' => "Brevo: {$brevo_error}{$hint}"];
    }

    /**
     * Notification types that are always emailed, even if the recipient turned
     * off optional email alerts in Settings. These are transactional events the
     * worker must not miss (e.g. being hired).
     */
    public const ALWAYS_EMAIL_TYPES = ['hired', 'for_interview', 'test'];

    /**
     * Send a notification email if the recipient has email notifications enabled.
     *
     * @param array  $recipient  User row from database
     * @param string $type       Notification type (e.g. application, hired, message, test)
     * @param string $title      Notification title
     * @param string $message    Detailed message or body
     * @param string $link       Optional link relative to frontend URL
     * @param string $cta_label  Optional Call-to-action button label
     * @return array
     */
    public static function send_notification(array $recipient, string $type, string $title, string $message, string $link = '', string $cta_label = 'View on HanapBuhay'): array
    {
        $prefs = $recipient['notification_prefs'] ?? null;
        if (!empty($prefs) && !in_array($type, self::ALWAYS_EMAIL_TYPES, true)) {
            $parsed = is_array($prefs) ? $prefs : json_decode($prefs, true);
            if (is_array($parsed) && isset($parsed['email']) && !$parsed['email']) {
                return [
                    'success' => false,
                    'mode'    => 'skipped',
                    'skipped' => true,
                    'error'   => 'Recipient has disabled email notifications in Settings.',
                    'reason'  => 'Recipient has disabled email notifications in Settings.'
                ];
            }
        }

        $email = $recipient['email'] ?? '';
        $name  = $recipient['full_name'] ?? $recipient['username'] ?? 'HanapBuhay User';

        if (empty($email)) {
            return ['success' => false, 'mode' => 'failed', 'error' => 'Recipient has no email address.'];
        }

        $frontend_url = rtrim((string) (getenv('APP_FRONTEND_URL') ?: 'http://localhost:5173'), '/');
        $full_link = '';
        if (!empty($link)) {
            $full_link = str_starts_with($link, 'http') ? $link : ($frontend_url . '/' . ltrim($link, '/'));
        }

        $html = self::render_notification_template($name, $type, $title, $message, $full_link, $cta_label);

        return self::send($email, $name, "[HanapBuhay] " . $title, $html);
    }

    /**
     * Generate modern, responsive HTML email template for HanapBuhay.
     */
    public static function render_notification_template(string $recipient_name, string $type, string $title, string $message, string $cta_url = '', string $cta_label = 'View on HanapBuhay'): string
    {
        $type_labels = [
            'application'        => 'Job Application',
            'application_status' => 'Application Update',
            'job_match'          => 'Job Match Alert',
            'job_posted'         => 'Job Posting Confirmation',
            'hired'              => 'Job Offer / Hired 🎉',
            'message'            => 'New Message',
            'test'               => 'Test Notification',
        ];

        $badge = $type_labels[$type] ?? 'Notification';
        $badge_style = 'background: #ecfdf5; color: #065f46;';
        if ($type === 'hired') {
            $badge_style = 'background: #fef3c7; color: #92400e; font-weight: 800; border: 1px solid #fde68a;';
        } elseif ($type === 'job_posted') {
            $badge_style = 'background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe;';
        }
        $safe_name = htmlspecialchars($recipient_name, ENT_QUOTES, 'UTF-8');
        $safe_title = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
        $safe_message = nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8'));
        $safe_cta = htmlspecialchars($cta_label, ENT_QUOTES, 'UTF-8');
        $year = date('Y');

        $frontend_url = rtrim((string) (getenv('APP_FRONTEND_URL') ?: 'http://localhost:5173'), '/');
        $settings_url = htmlspecialchars($frontend_url . '/dashboard/settings', ENT_QUOTES, 'UTF-8');

        $button_html = '';
        if (!empty($cta_url)) {
            $safe_url = htmlspecialchars($cta_url, ENT_QUOTES, 'UTF-8');
            $button_html = <<<HTML
            <div style="margin: 28px 0 16px 0; text-align: left;">
                <a href="{$safe_url}" style="display: inline-block; background-color: #047857; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(4,120,87,0.2);">
                    {$safe_cta} &rarr;
                </a>
            </div>
HTML;
        }

        return <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{$safe_title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
    <div style="max-width: 580px; margin: 32px auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #064e3b 0%, #047857 100%); padding: 24px 32px; color: #ffffff;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                    <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">HanapBuhay</h1>
                    <p style="margin: 2px 0 0 0; font-size: 12px; color: #a7f3d0;">Oriental Mindoro Employment &amp; Skills Portal</p>
                </div>
            </div>
        </div>

        <!-- Content -->
        <div style="padding: 32px;">
            <div style="display: inline-block; {$badge_style} font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 12px; border-radius: 9999px; margin-bottom: 16px;">
                {$badge}
            </div>

            <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #0f172a;">
                {$safe_title}
            </h2>

            <p style="font-size: 14px; color: #475569; margin: 0 0 16px 0;">
                Hello <strong>{$safe_name}</strong>,
            </p>

            <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 14px 16px; border-radius: 0 8px 8px 0; font-size: 14px; color: #334155; margin: 16px 0;">
                {$safe_message}
            </div>

            {$button_html}

            <p style="font-size: 12px; color: #94a3b8; margin: 24px 0 0 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
                If you did not request this notification or have questions, you can manage your alert preferences in your <a href="{$settings_url}" style="color: #047857; text-decoration: underline;">Account Settings</a>.
            </p>
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b;">
            &copy; {$year} HanapBuhay Phase 1 &middot; Provincial Government of Oriental Mindoro
        </div>
    </div>
</body>
</html>
HTML;
    }

    /**
     * Locate a CA bundle for cURL when PHP has none configured.
     * Order: MAIL_CA_BUNDLE env → php.ini curl.cainfo/openssl.cafile (return null, PHP handles it)
     *        → backend/certs/cacert.pem → Laragon's bundled cacert.pem.
     */
    private static function find_ca_bundle(): ?string
    {
        $override = trim(self::get_env('MAIL_CA_BUNDLE', ''));
        if ($override !== '' && is_file($override)) {
            return $override;
        }

        if (ini_get('curl.cainfo') || ini_get('openssl.cafile')) {
            return null; // PHP already knows where its CA bundle is
        }

        $root = defined('ROOT_DIR') ? ROOT_DIR : dirname(__DIR__, 2) . DIRECTORY_SEPARATOR;
        $candidates = [
            $root . 'certs' . DIRECTORY_SEPARATOR . 'cacert.pem',
            'C:\\laragon\\etc\\ssl\\cacert.pem',
            '/etc/ssl/certs/ca-certificates.crt', // Debian/Ubuntu (Docker image)
        ];
        foreach ($candidates as $path) {
            if (is_file($path)) {
                return $path;
            }
        }
        return null;
    }

    /**
     * Log email to runtime/logs/mail.log for tracking and local development.
     */
    private static function log_email(string $to_email, string $to_name, string $subject, string $html_body, string $status = 'Logged'): void
    {
        $log_dir = ROOT_DIR . 'runtime' . DIRECTORY_SEPARATOR . 'logs';
        if (!is_dir($log_dir)) {
            @mkdir($log_dir, 0777, true);
        }

        $log_file = $log_dir . DIRECTORY_SEPARATOR . 'mail.log';
        $timestamp = date('Y-m-d H:i:s');
        $snippet = strip_tags(substr($html_body, 0, 500));

        $entry = "========================================================\n"
               . "[{$timestamp}] Status: {$status}\n"
               . "TO: {$to_name} <{$to_email}>\n"
               . "SUBJECT: {$subject}\n"
               . "PREVIEW: {$snippet}\n"
               . "========================================================\n\n";

        @file_put_contents($log_file, $entry, FILE_APPEND | LOCK_EX);
    }

    /**
     * Safely read an environment variable with fallbacks to $_ENV, $_SERVER, and direct .env file.
     */
    private static function get_env(string $key, string $default = ''): string
    {
        $val = getenv($key);
        if ($val !== false && $val !== '') return trim((string) $val);

        if (isset($_ENV[$key]) && $_ENV[$key] !== '') return trim((string) $_ENV[$key]);
        if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') return trim((string) $_SERVER[$key]);

        static $cached_env = null;
        if ($cached_env === null) {
            $cached_env = [];
            $env_file = defined('ROOT_DIR') ? ROOT_DIR . '.env' : dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env';
            if (file_exists($env_file)) {
                $lines = file($env_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                if (is_array($lines)) {
                    foreach ($lines as $line) {
                        $line = trim($line);
                        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) continue;
                        [$k, $v] = explode('=', $line, 2);
                        $k = trim($k);
                        $v = trim($v);
                        if (strlen($v) >= 2 && in_array($v[0], ['"', "'"], true) && $v[-1] === $v[0]) {
                            $v = substr($v, 1, -1);
                        }
                        $cached_env[$k] = $v;
                    }
                }
            }
        }

        return (string) ($cached_env[$key] ?? $default);
    }
}
