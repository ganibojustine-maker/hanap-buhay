<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * Google Client Library
 * ------------------------------------------------------------------
 * Custom external integration library placed in app/libraries.
 * Handles Google OAuth ID token verification and profile fetching.
 */
class Google_client
{
    /**
     * Retrieve configured Google Client ID.
     *
     * @return string
     */
    public function get_client_id(): string
    {
        return (string) (config_item('google_client_id') ?? (getenv('GOOGLE_CLIENT_ID') ?: ''));
    }

    /**
     * Verify an access token or fetch user info from Google.
     *
     * @param string $access_token
     * @return array|null
     */
    public function get_userinfo(string $access_token): ?array
    {
        $url = config_item('google_userinfo_url') ?: 'https://www.googleapis.com/oauth2/v3/userinfo';
        return $this->http_get($url, [
            "Authorization: Bearer {$access_token}"
        ]);
    }

    /**
     * Verify a Google ID token with tokeninfo endpoint.
     *
     * @param string $id_token
     * @return array|null
     */
    public function verify_id_token(string $id_token): ?array
    {
        $base = config_item('google_tokeninfo_url') ?: 'https://oauth2.googleapis.com/tokeninfo';
        return $this->http_get($base . '?id_token=' . urlencode($id_token));
    }

    /**
     * Reusable HTTP GET JSON helper using cURL.
     *
     * @param string $url
     * @param array $headers
     * @return array|null
     */
    public function http_get(string $url, array $headers = []): ?array
    {
        $env = function_exists('config_item') ? config_item('environment') : (getenv('APP_ENV') ?: 'production');
        $verifySsl = $env !== 'development';

        if (!function_exists('curl_init')) {
            return null;
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_SSL_VERIFYPEER => $verifySsl,
            CURLOPT_SSL_VERIFYHOST => $verifySsl ? 2 : 0,
        ]);

        $raw  = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($raw === false || $code !== 200) {
            return null;
        }

        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : null;
    }
}
