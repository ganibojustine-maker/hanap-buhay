<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

/**
 * ------------------------------------------------------------------
 * HanapBuhay Mailer Library
 * ------------------------------------------------------------------
 * Handles transactional email notifications via PHPMailer & SMTP,
 * with graceful fallback to file logging in local/development mode
 * when SMTP credentials are not yet set.
 */
class Mailer
{
    /**
     * Send an email using SMTP (or fallback to mail.log in development).
     *
     * @param string $to_email Recipient email address
     * @param string $to_name Recipient display name
     * @param string $subject Email subject line
     * @param string $html_body HTML formatted body
     * @param string $text_body Plain-text fallback (optional)
     * @return array Result summary with status and mode
     */
    public static function send(string $to_email, string $to_name, string $subject, string $html_body, string $text_body = ''): array
    {
        $to_email = trim($to_email);
        if (empty($to_email) || !filter_var($to_email, FILTER_VALIDATE_EMAIL)) {
            return ['success' => false, 'error' => 'Invalid recipient email address.'];
        }

        $mailer_driver = strtolower(trim(self::get_env('MAIL_MAILER', self::get_env('MAIL_DRIVER', 'smtp'))));
        $host          = trim(self::get_env('MAIL_HOST', ''));
        $port          = (int) self::get_env('MAIL_PORT', '587');
        $username      = trim(self::get_env('MAIL_USERNAME', ''));
        $password      = trim(self::get_env('MAIL_PASSWORD', ''));
        $encryption    = strtolower(trim(self::get_env('MAIL_ENCRYPTION', '')));
        $from_address  = trim(self::get_env('MAIL_FROM_ADDRESS', 'noreply@hanapbuhay.ph'));
        $from_name     = trim(self::get_env('MAIL_FROM_NAME', 'HanapBuhay Oriental Mindoro'));

        // Detect local mail catcher (Mailpit, MailHog, etc.) — no credentials or TLS needed
        $is_local = in_array($host, ['127.0.0.1', 'localhost', '::1'], true);

        // If using Gmail App Password, strip any accidental spaces (e.g. "abcd efgh ijkl mnop")
        if (str_contains($host, 'gmail') && !empty($password)) {
            $password = str_replace(' ', '', $password);
        }

        // If using Gmail SMTP and default placeholder sender, use authenticated username to avoid 550 relay errors
        if (str_contains($host, 'gmail') && ($from_address === 'noreply@hanapbuhay.ph' || empty($from_address))) {
            $from_address = $username;
        }

        // Fallback to log mode only when NOT local and credentials are missing
        if ($mailer_driver === 'log' || (empty($host)) || (!$is_local && (empty($username) || empty($password)))) {
            self::log_email($to_email, $to_name, $subject, $html_body, 'Dev/Logged mode (no SMTP credentials configured)');
            return [
                'success' => true,
                'mode'    => 'logged',
                'message' => 'Email logged to runtime/logs/mail.log (SMTP credentials not configured).'
            ];
        }

        $mail = new PHPMailer(true);

        try {
            $mail->isSMTP();
            $mail->Host    = $host;
            $mail->Port    = $port;
            $mail->CharSet = 'UTF-8';
            $mail->Timeout = 10;

            if ($is_local) {
                // Local mail catcher: no auth, no TLS
                $mail->SMTPAuth   = false;
                $mail->SMTPSecure = '';
                $mail->SMTPAutoTLS = false;
            } else {
                $mail->SMTPAuth = true;
                $mail->Username = $username;
                $mail->Password = $password;
                if ($encryption === 'ssl' || $port === 465) {
                    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
                } else {
                    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
                }
            }

            // Sender & Recipient
            $mail->setFrom($from_address, $from_name);
            $mail->addAddress($to_email, $to_name ?: $to_email);

            // Content
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body    = $html_body;
            $mail->AltBody = $text_body ?: strip_tags(str_replace(['<br>', '<br/>', '<p>', '</p>'], ["\n", "\n", "\n", "\n\n"], $html_body));

            $mail->send();

            self::log_email($to_email, $to_name, $subject, $html_body, 'SMTP Sent successfully via ' . $host . ':' . $port);

            return [
                'success' => true,
                'mode'    => 'smtp',
                'message' => 'Email sent successfully via SMTP.'
            ];
        } catch (Exception $e) {
            $err = $mail->ErrorInfo ?: $e->getMessage();
            error_log('[Mailer Error] ' . $err);
            self::log_email($to_email, $to_name, $subject, $html_body, 'SMTP Failed: ' . $err);

            return [
                'success' => false,
                'mode'    => 'failed',
                'error'   => $err
            ];
        }
    }

    /**
     * Send a notification email if the recipient has email notifications enabled.
     *
     * @param array $recipient User row from database
     * @param string $type Notification type (e.g. application, application_status, job_match, message, test)
     * @param string $title Notification title
     * @param string $message Detailed message or body
     * @param string $link Optional link relative to frontend URL
     * @param string $cta_label Optional Call-to-action button label
     * @return array
     */
    public static function send_notification(array $recipient, string $type, string $title, string $message, string $link = '', string $cta_label = 'View on HanapBuhay'): array
    {
        $prefs = $recipient['notification_prefs'] ?? null;
        if (!empty($prefs)) {
            $parsed = is_array($prefs) ? $prefs : json_decode($prefs, true);
            if (is_array($parsed) && isset($parsed['email']) && !$parsed['email']) {
                return [
                    'success' => false,
                    'skipped' => true,
                    'reason'  => 'Recipient has disabled email notifications in Settings.'
                ];
            }
        }

        $email = $recipient['email'] ?? '';
        $name  = $recipient['full_name'] ?? $recipient['username'] ?? 'HanapBuhay User';

        if (empty($email)) {
            return ['success' => false, 'error' => 'Recipient has no email address.'];
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
                    <p style="margin: 2px 0 0 0; font-size: 12px; color: #a7f3d0;">Oriental Mindoro Employment & Skills Portal</p>
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
                If you did not request this notification or have questions, you can manage your alert preferences in your <a href="http://localhost:5173/dashboard/settings" style="color: #047857; text-decoration: underline;">Account Settings</a>.
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
