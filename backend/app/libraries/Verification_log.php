<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Sets an account's verification status and writes one line of verification history.
 * Used by VerificationController (IDs, phone) and BusinessController (business documents),
 * so every decision lands in the same history the admin and the account owner see.
 */
class Verification_log
{
    public static function record(int $uid, ?int $requestId, string $action, ?string $from, ?string $to, ?string $reason, ?int $actor): void
    {
        $db = lava_instance()->db;
        try {
            if ($to !== null) $db->raw('UPDATE users SET verification_status = ?, is_verified = ? WHERE id = ?', [$to, $to === 'verified' ? 1 : 0, $uid]);
            $db->raw('INSERT INTO verification_history (user_id, request_id, action, from_status, to_status, reason, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
                [$uid, $requestId, $action, $from, $to, $reason, $actor]);
        } catch (\Throwable $e) {
            // before migration 021: keep the old badge working
            if ($to !== null) { try { $db->raw('UPDATE users SET is_verified = ? WHERE id = ?', [$to === 'verified' ? 1 : 0, $uid]); } catch (\Throwable $e2) {} }
        }
    }
}
