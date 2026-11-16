<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * Interview reminders: "your interview is tomorrow / today"
 * ------------------------------------------------------------------
 * There is no scheduler on Render's web service, so the check rides on traffic:
 * the 30-second notification poll calls Reminders::run(), which does real work
 * at most once every 10 minutes. GET /api/cron/reminders?key=CRON_SECRET runs it
 * on demand, for a free pinger (cron-job.org etc.) that also keeps the server awake.
 *
 * A reminder goes out once per interview, 24 hours before at the earliest (in-app,
 * email). Moving the interview clears applications.interview_reminded_at,
 * so the new time gets its own reminder. Needs migration 017.
 */
class Reminders
{
    private const EVERY_SECONDS = 600;
    private const TZ = 'Asia/Manila'; // employers enter interview times in Philippine time

    public static function run(bool $force = false): array
    {
        $lava = lava_instance();

        // at most one run per 10 minutes, across all requests (checked before any query:
        // this is called on every notification poll)
        $dir = ROOT_DIR . 'runtime' . DIRECTORY_SEPARATOR . 'cache';
        if (!is_dir($dir)) @mkdir($dir, 0777, true);
        $stamp = $dir . DIRECTORY_SEPARATOR . 'interview_reminders.last';
        $fh = @fopen($stamp, 'c+');
        if (!$fh) return ['ran' => false, 'reason' => 'Cache folder not writable.'];
        if (!flock($fh, LOCK_EX | LOCK_NB)) { fclose($fh); return ['ran' => false, 'reason' => 'Already running.']; }
        $last = (int) stream_get_contents($fh);
        if (!$force && time() - $last < self::EVERY_SECONDS) {
            flock($fh, LOCK_UN); fclose($fh);
            return ['ran' => false, 'reason' => 'Ran recently.'];
        }
        ftruncate($fh, 0); rewind($fh); fwrite($fh, (string) time());
        flock($fh, LOCK_UN); fclose($fh);

        $lava->call->library('schema_info');
        if (!$lava->schema_info->has_column('applications', 'interview_reminded_at')) {
            return ['ran' => false, 'reason' => 'Run migration 017 first.'];
        }

        $sent = 0;
        try {
            $tz  = new \DateTimeZone(self::TZ);
            $now = new \DateTime('now', $tz);
            $until = (clone $now)->modify('+24 hours');
            $rows = $lava->db->raw(
                "SELECT a.id, a.worker_id, a.interview_date, a.interview_notes, j.title, j.company, j.location
                 FROM applications a JOIN jobs j ON j.id = a.job_id
                 WHERE a.status = 'for_interview' AND a.interview_reminded_at IS NULL
                   AND a.interview_date > ? AND a.interview_date <= ?
                   AND (a.updated_at IS NULL OR a.updated_at <= ?)
                 ORDER BY a.interview_date ASC LIMIT 50",
                // updated_at is written with the server clock: wait an hour after the invite itself
                [$now->format('Y-m-d H:i:s'), $until->format('Y-m-d H:i:s'), date('Y-m-d H:i:s', time() - 3600)]
            )->fetchAll(\PDO::FETCH_ASSOC) ?: [];
            if (!$rows) return ['ran' => true, 'sent' => 0];

            $lava->call->model('Application_model', 'application_model');

            foreach ($rows as $r) {
                // claim it first, so two overlapping runs never send twice
                $claimed = $lava->db->raw(
                    'UPDATE applications SET interview_reminded_at = ? WHERE id = ? AND interview_reminded_at IS NULL',
                    [date('Y-m-d H:i:s'), (int) $r['id']]
                )->rowCount();
                if ($claimed !== 1) continue;

                $worker = $lava->db->table('users')->where('id', (int) $r['worker_id'])->get();
                if (!$worker || (int) ($worker['is_active'] ?? 1) !== 1) continue;

                $at = new \DateTime($r['interview_date'], $tz);
                $when = ($at->format('Y-m-d') === $now->format('Y-m-d') ? 'today' : 'tomorrow, ' . $at->format('D M j'))
                      . ' at ' . $at->format('g:i A');
                $company = $r['company'] ?: 'the employer';
                $name = trim(explode(' ', (string) $worker['full_name'])[0]) ?: 'there';

                $lava->application_model->create_notification(
                    (int) $worker['id'],
                    'interview_reminder',
                    "⏰ Interview reminder: {$r['title']}",
                    "Hello {$name}! Your interview for \"{$r['title']}\" with {$company} is {$when}."
                        . (!empty($r['interview_notes']) ? "\n\n📝 Venue / notes from the employer: {$r['interview_notes']}" : '')
                        . "\n\nBring a valid ID and copies of your certificates. Good luck!",
                    '/dashboard/applied'
                );
                $sent++;
            }
        } catch (\Throwable $e) {
            error_log('[Reminders] ' . $e->getMessage());
            return ['ran' => true, 'sent' => $sent, 'error' => 'Reminder run failed; see the PHP error log.'];
        }
        return ['ran' => true, 'sent' => $sent];
    }
}
