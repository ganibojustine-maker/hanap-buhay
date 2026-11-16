<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * SMS via Semaphore (Philippine SMS gateway) — https://semaphore.co/docs
 * ------------------------------------------------------------------
 * Only for the few updates a worker must not miss (hired, interview invite,
 * interview reminder), because every text costs a credit.
 *
 *   SEMAPHORE_API_KEY      empty = texts are only written to runtime/logs/sms.log
 *   SEMAPHORE_SENDER_NAME  optional; Semaphore uses the account's registered sender name
 *   SMS_DAILY_CAP          optional; most texts sent per day (default 100) so a bug can't drain credits
 *
 * Workers can turn texts off in Settings (notification_prefs.sms = false).
 */
class Sms
{
    private const URL = 'https://api.semaphore.co/api/v4/messages';
    private const SEGMENT = 160;

    /** "0917 123 4567", "+63 917-123-4567", "639171234567" → "09171234567"; anything else → null */
    public static function normalize(?string $number): ?string
    {
        $d = preg_replace('/\D+/', '', (string) $number);
        if (preg_match('/^639\d{9}$/', $d)) $d = '0' . substr($d, 2);
        elseif (preg_match('/^9\d{9}$/', $d)) $d = '0' . $d;
        return preg_match('/^09\d{9}$/', $d) ? $d : null;
    }

    /** Did this user leave texts on (default: on) and give a mobile number? */
    public static function wants(array $user): bool
    {
        if (self::normalize($user['phone'] ?? null) === null) return false;
        $p = $user['notification_prefs'] ?? null;
        $p = is_array($p) ? $p : json_decode((string) $p, true);
        return !is_array($p) || !array_key_exists('sms', $p) || (bool) $p['sms'];
    }

    /** Text a user if they want texts. Never throws. */
    public static function notify(array $user, string $text): array
    {
        try {
            if (!self::wants($user)) return ['success' => false, 'mode' => 'skipped', 'error' => 'No mobile number or SMS turned off.'];
            return self::send((string) $user['phone'], $text);
        } catch (\Throwable $e) {
            error_log('[Sms] ' . $e->getMessage());
            return ['success' => false, 'mode' => 'failed', 'error' => $e->getMessage()];
        }
    }

    public static function send(string $number, string $text): array
    {
        $to = self::normalize($number);
        if ($to === null) return ['success' => false, 'mode' => 'failed', 'error' => 'Invalid Philippine mobile number.'];

        // plain ASCII keeps one text at 160 characters (an emoji or "ñ" would cut it to 70)
        $text = trim(preg_replace('/\s+/', ' ', strtr($text, ['ñ' => 'n', 'Ñ' => 'N', '₱' => 'P', '–' => '-', '—' => '-', '’' => "'", '“' => '"', '”' => '"', '…' => '...'])));
        $text = preg_replace('/[^\x20-\x7E]/', '', $text);
        if (stripos($text, 'test') === 0) $text = 'hanapbuhay: ' . $text; // Semaphore silently drops texts starting with "TEST"
        if (strlen($text) > self::SEGMENT * 2) $text = substr($text, 0, self::SEGMENT * 2 - 3) . '...';

        $key = trim(self::env('SEMAPHORE_API_KEY'));
        if ($key === '') {
            self::log($to, $text, 'Logged (SEMAPHORE_API_KEY not set)');
            return ['success' => true, 'mode' => 'logged'];
        }
        if (!self::take_daily_slot()) {
            self::log($to, $text, 'Skipped: daily SMS cap reached');
            return ['success' => false, 'mode' => 'skipped', 'error' => 'Daily SMS cap reached.'];
        }

        $fields = ['apikey' => $key, 'number' => $to, 'message' => $text];
        $sender = trim(self::env('SEMAPHORE_SENDER_NAME'));
        if ($sender !== '') $fields['sendername'] = $sender;

        $ch = curl_init(self::URL);
        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 12,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query($fields),
        ];
        $ca = self::ca_bundle();
        if ($ca !== null) $opts[CURLOPT_CAINFO] = $ca;
        curl_setopt_array($ch, $opts);
        $raw  = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($raw === false || $err !== '') {
            self::log($to, $text, 'FAILED: ' . ($err ?: 'no response'));
            return ['success' => false, 'mode' => 'failed', 'error' => 'SMS gateway unreachable.'];
        }
        // success = a list with one message object per number; errors aren't documented, so anything else fails
        $res = json_decode((string) $raw, true);
        if ($code >= 200 && $code < 300 && is_array($res) && isset($res[0]['message_id'])) {
            self::log($to, $text, "Sent (message_id {$res[0]['message_id']}, " . ($res[0]['status'] ?? '?') . ')');
            return ['success' => true, 'mode' => 'semaphore', 'message_id' => $res[0]['message_id']];
        }
        $why = mb_substr(is_string($raw) ? $raw : '', 0, 300);
        self::log($to, $text, "FAILED (HTTP {$code}): {$why}");
        return ['success' => false, 'mode' => 'failed', 'error' => "Semaphore HTTP {$code}"];
    }

    /** Counts today's texts in runtime/cache; false once SMS_DAILY_CAP is reached. */
    private static function take_daily_slot(): bool
    {
        $cap = (int) (self::env('SMS_DAILY_CAP') ?: 100);
        $dir = ROOT_DIR . 'runtime' . DIRECTORY_SEPARATOR . 'cache';
        if (!is_dir($dir)) @mkdir($dir, 0777, true);
        $fh = @fopen($dir . DIRECTORY_SEPARATOR . 'sms_count_' . date('Ymd') . '.txt', 'c+');
        if (!$fh) return true; // can't count: don't block an important text
        flock($fh, LOCK_EX);
        $n = (int) stream_get_contents($fh);
        $ok = $n < $cap;
        if ($ok) { ftruncate($fh, 0); rewind($fh); fwrite($fh, (string) ($n + 1)); }
        flock($fh, LOCK_UN);
        fclose($fh);
        return $ok;
    }

    private static function log(string $to, string $text, string $status): void
    {
        $dir = ROOT_DIR . 'runtime' . DIRECTORY_SEPARATOR . 'logs';
        if (!is_dir($dir)) @mkdir($dir, 0777, true);
        $masked = substr($to, 0, 4) . '****' . substr($to, -3);
        @file_put_contents($dir . DIRECTORY_SEPARATOR . 'sms.log', '[' . date('Y-m-d H:i:s') . "] {$status} TO {$masked}: {$text}\n", FILE_APPEND | LOCK_EX);
    }

    /** Same lookup as Mailer: Windows/Laragon PHP often has no CA bundle configured. */
    private static function ca_bundle(): ?string
    {
        $override = trim(self::env('MAIL_CA_BUNDLE'));
        if ($override !== '' && is_file($override)) return $override;
        if (ini_get('curl.cainfo') || ini_get('openssl.cafile')) return null;
        foreach ([ROOT_DIR . 'certs' . DIRECTORY_SEPARATOR . 'cacert.pem', 'C:\\laragon\\etc\\ssl\\cacert.pem', '/etc/ssl/certs/ca-certificates.crt'] as $p) {
            if (is_file($p)) return $p;
        }
        return null;
    }

    private static function env(string $key): string
    {
        $v = getenv($key);
        if ($v !== false && $v !== '') return (string) $v;
        return (string) ($_ENV[$key] ?? $_SERVER[$key] ?? '');
    }
}
