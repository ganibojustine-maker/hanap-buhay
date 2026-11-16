<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * A worker's availability (migration 017 columns on users), in the shape the app uses:
 * own profile (AuthController), the employer's applicant view and the public passport.
 */
class Availability
{
    /** null when the users row has no availability columns yet (migration 017 not run). */
    public static function from_row(array $u): ?array
    {
        if (!array_key_exists('open_to_work', $u)) return null;
        $csv = fn($v) => array_values(array_filter(array_map('trim', explode(',', (string) $v))));
        return [
            'open_to_work'    => (int) ($u['open_to_work'] ?? 1) === 1,
            'work_types'      => $csv($u['work_types'] ?? ''),
            'expected_rate'   => isset($u['expected_rate']) ? (int) $u['expected_rate'] : null,
            'rate_unit'       => ($u['rate_unit'] ?? '') ?: null,
            'preferred_towns' => $csv($u['preferred_towns'] ?? ''),
        ];
    }
}
