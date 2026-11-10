<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * Application Model
 * ------------------------------------------------------------------
 * Manages job applications, applicant reviews, status transitions,
 * and application notifications.
 */
class Application_model extends Model
{
    protected $table = 'applications';
    protected $primary_key = 'id';
    protected $fillable = [
        'job_id', 'worker_id', 'cover_note', 'match_score',
        'status', 'interview_date', 'interview_notes', 'created_at', 'updated_at'
    ];

    public function find_by_id(int $id)
    {
        return $this->db->table($this->table)->where('id', $id)->get();
    }

    public function find_by_job_and_worker(int $job_id, int $worker_id)
    {
        return $this->db->table($this->table)
            ->where('job_id', $job_id)
            ->where('worker_id', $worker_id)
            ->get();
    }

    public function apply(array $data): int
    {
        $data['created_at'] = date('Y-m-d H:i:s');
        $this->db->table($this->table)->insert($data);
        return (int) $this->db->last_id();
    }

    public function get_worker_applications(int $worker_id): array
    {
        $rows = $this->db->table('applications a')
            ->select('a.*, j.title AS job_title, j.company, j.location AS job_location, j.job_type, j.salary_min, j.salary_max, u.full_name AS employer_name, u.email AS employer_email, u.phone AS employer_phone')
            ->join('jobs j', 'j.id = a.job_id', 'LEFT')
            ->join('users u', 'u.id = j.employer_id', 'LEFT')
            ->where('a.worker_id', $worker_id)
            ->order_by('a.created_at DESC')
            ->get_all();

        return $rows ?: [];
    }

    public function get_job_applications(int $job_id): array
    {
        $rows = $this->db->table('applications a')
            ->select('a.*, u.full_name, u.email, u.location, u.bio, u.phone, u.picture')
            ->join('users u', 'u.id = a.worker_id', 'LEFT')
            ->where('a.job_id', $job_id)
            ->order_by('a.match_score DESC, a.created_at ASC')
            ->get_all();

        return $rows ?: [];
    }

    public function get_employer_applications(int $employer_id): array
    {
        $rows = $this->db->table('applications a')
            ->select('a.*, j.title AS job_title, j.company, j.location AS job_location, u.full_name AS applicant_name, u.email AS applicant_email, u.phone AS applicant_phone, u.location AS applicant_location, u.bio AS applicant_bio, u.picture AS applicant_picture')
            ->join('jobs j', 'j.id = a.job_id', 'INNER')
            ->join('users u', 'u.id = a.worker_id', 'LEFT')
            ->where('j.employer_id', $employer_id)
            ->order_by('a.created_at DESC')
            ->get_all();

        return $rows ?: [];
    }

    public function update_status(int $id, string $status, ?string $interview_date = null, ?string $interview_notes = null): bool
    {
        $data = [
            'status'     => $status,
            'updated_at' => date('Y-m-d H:i:s'),
        ];
        if ($interview_date !== null) {
            $data['interview_date'] = !empty($interview_date) ? $interview_date : null;
        }
        if ($interview_notes !== null) {
            $data['interview_notes'] = !empty($interview_notes) ? $interview_notes : null;
        }

        return (bool) $this->db->table($this->table)
            ->where('id', $id)
            ->update($data);
    }

    public function count_applications(): int
    {
        return (int) $this->db->table($this->table)->count_all_results();
    }

    public function create_notification(int $user_id, string $type, string $title, string $body, string $link = ''): void
    {
        $email_to = null;
        $email_html = null;
        $email_status = 'delivered';

        try {
            $user = $this->db->table('users')->where('id', $user_id)->get();
            if ($user && !empty($user['email'])) {
                $email_to = $user['email'];
                $recipient_name = $user['full_name'] ?? $user['username'] ?? 'HanapBuhay User';
                $frontend_url = rtrim((string) (getenv('APP_FRONTEND_URL') ?: 'http://localhost:5173'), '/');
                $full_link = !empty($link) ? (str_starts_with($link, 'http') ? $link : ($frontend_url . '/' . ltrim($link, '/'))) : '';

                $mailer_file = APP_DIR . 'libraries' . DIRECTORY_SEPARATOR . 'Mailer.php';
                if (file_exists($mailer_file)) {
                    require_once $mailer_file;
                }

                if (class_exists('Mailer')) {
                    $email_html = \Mailer::render_notification_template($recipient_name, $type, $title, $body, $full_link);
                    $res = \Mailer::send_notification($user, $type, $title, $body, $link);
                    $email_status = ($res['success'] ?? false) ? ($res['mode'] ?? 'delivered') : 'delivered';
                }
            }
        } catch (\Throwable $e) {
            error_log('[Notification Email Error] ' . $e->getMessage());
        }

        $this->db->table('notifications')->insert([
            'user_id'      => $user_id,
            'type'         => $type,
            'title'        => $title,
            'body'         => $body,
            'link'         => $link,
            'email_status' => $email_status,
            'email_to'     => $email_to,
            'email_html'   => $email_html,
            'created_at'   => date('Y-m-d H:i:s'),
        ]);
    }

    public function get_user_notifications(int $user_id, int $limit = 30): array
    {
        $rows = $this->db->table('notifications')
            ->where('user_id', $user_id)
            ->order_by('created_at DESC')
            ->limit($limit)
            ->get_all();

        return $rows ?: [];
    }

    public function mark_notifications_read(int $user_id): void
    {
        $this->db->table('notifications')
            ->where('user_id', $user_id)
            ->where('read_at IS NULL', null, false)
            ->update(['read_at' => date('Y-m-d H:i:s')]);
    }
}
