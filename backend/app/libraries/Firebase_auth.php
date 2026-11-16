<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Mints Firebase Auth custom tokens so the browser can sign in to Firebase
 * as the same user it is signed in as on hanapbuhay. Chat security rules then
 * use auth.uid to decide who may read or write which conversation.
 *
 * Required env (from Firebase Console → Project settings → Service accounts →
 * "Generate new private key"):
 *   FIREBASE_CLIENT_EMAIL   client_email from the JSON key
 *   FIREBASE_PRIVATE_KEY    private_key from the JSON key (newlines may be written as \n)
 */
class Firebase_auth
{
    private const AUDIENCE = 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';

    private static function env(string $key): string
    {
        $v = getenv($key);
        if ($v === false || $v === '') $v = $_ENV[$key] ?? $_SERVER[$key] ?? '';
        return trim((string) $v);
    }

    public static function is_configured(): bool
    {
        return self::env('FIREBASE_CLIENT_EMAIL') !== '' && self::env('FIREBASE_PRIVATE_KEY') !== '';
    }

    private static function b64url(string $raw): string
    {
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }

    /** @return string|null signed custom token, or null when not configured / signing fails */
    public static function create_custom_token(string $uid, array $claims = []): ?string
    {
        if (!self::is_configured()) return null;

        $email = self::env('FIREBASE_CLIENT_EMAIL');
        $key   = str_replace('\\n', "\n", self::env('FIREBASE_PRIVATE_KEY'));
        $now   = time();

        $header  = ['alg' => 'RS256', 'typ' => 'JWT'];
        $payload = [
            'iss' => $email,
            'sub' => $email,
            'aud' => self::AUDIENCE,
            'iat' => $now,
            'exp' => $now + 3600,
            'uid' => $uid,
        ];
        if ($claims) $payload['claims'] = $claims;

        $unsigned = self::b64url(json_encode($header)) . '.' . self::b64url(json_encode($payload));
        $signature = '';
        $pk = @openssl_pkey_get_private($key);
        if (!$pk || !openssl_sign($unsigned, $signature, $pk, OPENSSL_ALGO_SHA256)) {
            error_log('[Firebase_auth] could not sign custom token: check FIREBASE_PRIVATE_KEY');
            return null;
        }
        return $unsigned . '.' . self::b64url($signature);
    }
}
