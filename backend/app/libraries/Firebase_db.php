<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Server-side access to Firebase Realtime Database over its REST API.
 *
 * Signs in as the Firebase service account (the same key Firebase_auth uses for
 * chat sign-in), so it reads and writes with admin rights: no client can reach
 * these paths, and the database rules don't need to change. Access control is
 * done in PHP by the controller before every call.
 *
 * Env:
 *   FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY   service account (already used for chat)
 *   FIREBASE_DATABASE_URL                         e.g. https://<project>-default-rtdb.firebaseio.com
 *                                                 (if unset: derived from the service account's project)
 *   FIREBASE_TOKEN_URI                            optional, defaults to Google's OAuth endpoint
 */
class Firebase_db_error extends RuntimeException {}

class Firebase_db
{
    private const SCOPE = 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email';
    private const TOKEN_URI = 'https://oauth2.googleapis.com/token';

    private static ?string $token = null;
    private static int $tokenExp = 0;

    private static function env(string $key): string
    {
        $v = getenv($key);
        if ($v === false || $v === '') $v = $_ENV[$key] ?? $_SERVER[$key] ?? '';
        return trim((string) $v);
    }

    public static function database_url(): string
    {
        $url = self::env('FIREBASE_DATABASE_URL') ?: self::env('VITE_FIREBASE_DATABASE_URL');
        if ($url === '' && preg_match('/@([a-z0-9-]+)\.iam\.gserviceaccount\.com$/', self::env('FIREBASE_CLIENT_EMAIL'), $m)) {
            $url = "https://{$m[1]}-default-rtdb.firebaseio.com"; // the default database of the project
        }
        return rtrim($url, '/');
    }

    public static function is_configured(): bool
    {
        return self::env('FIREBASE_CLIENT_EMAIL') !== '' && self::env('FIREBASE_PRIVATE_KEY') !== '' && self::database_url() !== '';
    }

    private static function b64url(string $raw): string
    {
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }

    /** Same CA lookup as Mailer: Laragon's PHP ships without a CA bundle. */
    private static function ca_bundle(): ?string
    {
        if (ini_get('curl.cainfo') || ini_get('openssl.cafile')) return null;
        $root = defined('ROOT_DIR') ? ROOT_DIR : dirname(__DIR__, 2) . DIRECTORY_SEPARATOR;
        foreach ([$root . 'certs' . DIRECTORY_SEPARATOR . 'cacert.pem', 'C:\\laragon\\etc\\ssl\\cacert.pem', '/etc/ssl/certs/ca-certificates.crt'] as $p) {
            if (is_file($p)) return $p;
        }
        return null;
    }

    private static function http(string $method, string $url, array $headers, ?string $body, int $timeout = 12): array
    {
        $ch = curl_init($url);
        $opts = [
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_CONNECTTIMEOUT => 6,
            CURLOPT_TIMEOUT        => $timeout,
        ];
        if ($body !== null) $opts[CURLOPT_POSTFIELDS] = $body;
        if ($ca = self::ca_bundle()) $opts[CURLOPT_CAINFO] = $ca;
        curl_setopt_array($ch, $opts);
        $out = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($out === false) throw new Firebase_db_error('Firebase request failed: ' . $err);
        return [$status, (string) $out];
    }

    private static function cache_file(): string
    {
        return rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'hb-firebase-' . md5(self::env('FIREBASE_CLIENT_EMAIL') . self::database_url()) . '.json';
    }

    /** OAuth access token for the service account, cached (memory + temp file) until 5 minutes before it expires. */
    private static function access_token(): string
    {
        $now = time();
        if (self::$token && self::$tokenExp - 300 > $now) return self::$token;

        $file = self::cache_file();
        if (is_file($file)) {
            $c = json_decode((string) @file_get_contents($file), true);
            if (is_array($c) && !empty($c['token']) && (int) ($c['exp'] ?? 0) - 300 > $now) {
                self::$token = $c['token']; self::$tokenExp = (int) $c['exp'];
                return self::$token;
            }
        }

        $email = self::env('FIREBASE_CLIENT_EMAIL');
        $key = @openssl_pkey_get_private(str_replace('\\n', "\n", self::env('FIREBASE_PRIVATE_KEY')));
        if (!$key) throw new Firebase_db_error('FIREBASE_PRIVATE_KEY could not be read.');
        $uri = self::env('FIREBASE_TOKEN_URI') ?: self::TOKEN_URI;
        $unsigned = self::b64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT'])) . '.'
            . self::b64url(json_encode(['iss' => $email, 'scope' => self::SCOPE, 'aud' => $uri, 'iat' => $now, 'exp' => $now + 3600]));
        if (!openssl_sign($unsigned, $sig, $key, OPENSSL_ALGO_SHA256)) throw new Firebase_db_error('Could not sign the Firebase token request.');

        [$status, $out] = self::http('POST', $uri, ['Content-Type: application/x-www-form-urlencoded'],
            http_build_query(['grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => $unsigned . '.' . self::b64url($sig)]));
        $j = json_decode($out, true);
        if ($status !== 200 || empty($j['access_token'])) {
            throw new Firebase_db_error('Firebase sign-in failed (' . $status . '): ' . substr($out, 0, 200));
        }
        self::$token = (string) $j['access_token'];
        self::$tokenExp = $now + (int) ($j['expires_in'] ?? 3600);
        @file_put_contents($file, json_encode(['token' => self::$token, 'exp' => self::$tokenExp]), LOCK_EX);
        @chmod($file, 0600);
        return self::$token;
    }

    /** One REST call; retries once with a fresh token if the cached one was rejected. */
    private static function request(string $method, string $path, $data = null, array $query = [])
    {
        if (!self::is_configured()) throw new Firebase_db_error('Firebase is not configured on the server.');
        $path = trim($path, '/');
        $url = self::database_url() . '/' . ($path === '' ? '' : $path) . '.json' . ($query ? '?' . http_build_query($query) : '');
        $body = $data === null ? null : json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        for ($try = 0; $try < 2; $try++) {
            $headers = ['Authorization: Bearer ' . self::access_token(), 'Content-Type: application/json'];
            [$status, $out] = self::http($method, $url, $headers, $body);
            if ($status === 401 && $try === 0) { self::$token = null; self::$tokenExp = 0; @unlink(self::cache_file()); continue; }
            if ($status < 200 || $status >= 300) {
                throw new Firebase_db_error("Firebase {$method} /{$path} failed ({$status}): " . substr($out, 0, 200));
            }
            return json_decode($out, true);
        }
        throw new Firebase_db_error('Firebase rejected the service account token.');
    }

    /** Value at a path (null when nothing is there). $query e.g. ['shallow' => 'true']. */
    public static function get(string $path, array $query = [])
    {
        return self::request('GET', $path, null, $query);
    }

    /**
     * Atomic multi-path update from the database root: ['a/b' => 1, 'c/d' => null].
     * A null value deletes that path.
     */
    public static function update(array $paths): void
    {
        if ($paths) self::request('PATCH', '', $paths);
    }
}
