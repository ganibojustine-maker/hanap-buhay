<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/** Philippine mobile numbers: one place that tidies them. */
class Phone
{
    /** "0917 123 4567", "+63 917-123-4567", "639171234567" → "09171234567"; anything else → null */
    public static function normalize(?string $number): ?string
    {
        $d = preg_replace('/\D+/', '', (string) $number);
        if (preg_match('/^639\d{9}$/', $d)) $d = '0' . substr($d, 2);
        elseif (preg_match('/^9\d{9}$/', $d)) $d = '0' . $d;
        return preg_match('/^09\d{9}$/', $d) ? $d : null;
    }
}
