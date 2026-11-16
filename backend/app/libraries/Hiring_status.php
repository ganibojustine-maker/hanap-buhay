<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * The employer hiring pipeline, in one place (frontend copy: src/utils/hiringStatus.js).
 *
 *   Submitted → Under Review → Shortlisted → Interview Scheduled → Interviewed → Offer → Hired
 *                                           ↘ Not selected (any open step)    Withdrawn (by the applicant)
 *
 * Stored values keep their old names so existing rows stay valid:
 *   pending = Submitted, reviewed = Under Review, for_interview = Interview Scheduled, rejected = Not selected.
 */
class Hiring_status
{
    public const ORDER = ['pending', 'reviewed', 'shortlisted', 'for_interview', 'interviewed', 'offer', 'hired'];
    public const FINAL = ['hired', 'rejected', 'withdrawn'];

    public const LABELS = [
        'pending'       => 'Submitted',
        'reviewed'      => 'Under Review',
        'shortlisted'   => 'Shortlisted',
        'for_interview' => 'Interview Scheduled',
        'interviewed'   => 'Interviewed',
        'offer'         => 'Job Offer',
        'hired'         => 'Hired',
        'rejected'      => 'Not Selected',
        'withdrawn'     => 'Withdrawn',
    ];

    /** What the status means, for the applicant. */
    public const FOR_WORKER = [
        'pending'       => 'Your application was sent. The employer has not opened it yet.',
        'reviewed'      => 'The employer is looking at your application.',
        'shortlisted'   => 'You made the shortlist. The employer may invite you to an interview.',
        'for_interview' => 'You are invited to an interview. Check the date, time and place.',
        'interviewed'   => 'Your interview is done. The employer is making a decision.',
        'offer'         => 'The employer is offering you the job. Accept or decline the offer.',
        'hired'         => 'You got the job. The employer will contact you about your start date.',
        'rejected'      => 'The employer chose another applicant this time.',
        'withdrawn'     => 'You took back this application.',
    ];

    /** Which moves an employer may make from each step. Any open step can also end in "rejected". */
    public static function can_move(string $from, string $to): bool
    {
        if (in_array($from, self::FINAL, true)) return false;
        if ($to === 'rejected') return true;
        if ($to === 'for_interview' && $from === 'for_interview') return true; // reschedule
        $a = array_search($from, self::ORDER, true);
        $b = array_search($to, self::ORDER, true);
        if ($a === false || $b === false) return false;
        // forward only; an employer can hire from an offer, an interview, or the shortlist
        return $b > $a;
    }

    public static function label(string $s): string
    {
        return self::LABELS[$s] ?? ucfirst(str_replace('_', ' ', $s));
    }

    /** Record a change in application_status_history (no-op before migration 021). */
    public static function log(int $appId, ?string $from, string $to, ?int $actor, ?string $note = null): void
    {
        try {
            lava_instance()->db->raw(
                'INSERT INTO application_status_history (application_id, from_status, to_status, note, changed_by, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
                [$appId, $from, $to, $note !== null ? mb_substr($note, 0, 1000) : null, $actor]
            );
        } catch (\Throwable $e) { /* table not there yet */ }
    }

    /** History of one application, oldest first. */
    public static function history(int $appId): array
    {
        try {
            $rows = lava_instance()->db->raw(
                'SELECT from_status, to_status, note, created_at FROM application_status_history WHERE application_id = ? ORDER BY created_at, id',
                [$appId]
            )->fetchAll(\PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $e) { return []; }
        foreach ($rows as &$r) $r['label'] = self::label($r['to_status']);
        return $rows;
    }
}
