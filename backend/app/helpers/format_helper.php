<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * Format Helper
 * ------------------------------------------------------------------
 * Custom helper functions for formatting currency, relative time,
 * and Oriental Mindoro geographic entities.
 */

if (!function_exists('format_peso')) {
    /**
     * Format a numeric amount into Philippine Peso representation.
     *
     * @param float|int|string|null $amount
     * @return string
     */
    function format_peso($amount): string
    {
        if ($amount === null || $amount === '') {
            return 'Negotiable';
        }
        return '₱' . number_format((float) $amount, 2);
    }
}

if (!function_exists('time_ago')) {
    /**
     * Return human-readable relative time string.
     *
     * @param string|int $datetime
     * @return string
     */
    function time_ago($datetime): string
    {
        $timestamp = is_numeric($datetime) ? (int) $datetime : strtotime($datetime);
        $diff = time() - $timestamp;

        if ($diff < 60) {
            return 'just now';
        }
        if ($diff < 3600) {
            $mins = floor($diff / 60);
            return $mins . 'm ago';
        }
        if ($diff < 86400) {
            $hours = floor($diff / 3600);
            return $hours . 'h ago';
        }
        $days = floor($diff / 86400);
        return $days . 'd ago';
    }
}

if (!function_exists('mindoro_towns')) {
    /**
     * Get the 15 municipalities and city of Oriental Mindoro.
     *
     * @return array
     */
    function mindoro_towns(): array
    {
        return [
            'Baco', 'Bansud', 'Bongabong', 'Bulalacao', 'Calapan City',
            'Gloria', 'Mansalay', 'Naujan', 'Pinamalayan', 'Pola',
            'Puerto Galera', 'Roxas', 'San Teodoro', 'Socorro', 'Victoria'
        ];
    }
}
