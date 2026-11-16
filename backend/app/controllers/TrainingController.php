<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * /api/training — bookmarks, enrolments and popularity for the Training & Courses page.
 *
 * The course catalogue itself is the TESDA list that ships with the app (and anything added
 * to training_courses), so a course is identified by its slug, e.g. "welding-smaw-nc-ii" or
 * "db:4" for a row in training_courses. This controller only stores what a person did with it.
 *
 *   GET    /api/training/stats                     enrolment counts for every course + my bookmarks and enrolments
 *   POST   /api/training/saved      { course_id, title }
 *   DELETE /api/training/saved/{id}
 *   POST   /api/training/enroll     { course_id, title, provider }
 *   PATCH  /api/training/enrollments/{id}  { status: completed, certificate_id }
 *   DELETE /api/training/enrollments/{id}
 */
class TrainingController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->library('schema_info');
        $this->call->model('User_model', 'user_model');
        $this->call->model('Skill_model', 'skill_model');
    }

    private function uid(): int
    {
        $payload = $this->api->require_jwt();
        return (int) $payload['sub'];
    }

    private function ready(): bool
    {
        return $this->schema_info->has_table('course_enrollments') && $this->schema_info->has_table('saved_courses');
    }

    private function require_ready(): void
    {
        if (!$this->ready()) $this->api->respond_error('Course bookmarks are not switched on yet. Please try again later.', 503);
    }

    /** Course ids are slugs the app controls; keep them short and harmless. */
    private function course_id($raw): string
    {
        $id = strtolower(trim((string) $raw));
        $id = preg_replace('/[^a-z0-9:_-]+/', '-', $id) ?? '';
        return trim(mb_substr($id, 0, 120), '-');
    }

    private function text($raw, int $max): ?string
    {
        $s = trim(preg_replace('/\s+/', ' ', (string) $raw));
        return $s === '' ? null : mb_substr($s, 0, $max);
    }

    // GET /api/training/stats
    public function stats()
    {
        $this->api->require_method('GET');
        $uid = $this->uid();
        if (!$this->ready()) {
            $this->api->respond(['success' => true, 'setup_needed' => true, 'enrollments' => [], 'saved' => [], 'mine' => []]);
        }

        $counts = [];
        foreach ($this->db->raw('SELECT course_id, COUNT(*) AS n FROM course_enrollments GROUP BY course_id')->fetchAll(PDO::FETCH_ASSOC) ?: [] as $r) {
            $counts[(string) $r['course_id']] = (int) $r['n'];
        }
        $saved = $this->db->raw('SELECT course_id FROM saved_courses WHERE user_id = ? ORDER BY created_at DESC', [$uid])->fetchAll(PDO::FETCH_COLUMN) ?: [];
        $mine = $this->db->raw(
            'SELECT id, course_id, title, provider, status, certificate_id, completed_at, created_at
             FROM course_enrollments WHERE user_id = ? ORDER BY created_at DESC', [$uid]
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($mine as &$m) { $m['id'] = (int) $m['id']; $m['certificate_id'] = $m['certificate_id'] !== null ? (int) $m['certificate_id'] : null; }
        unset($m);

        $this->api->respond([
            'success'     => true,
            'enrollments' => (object) $counts,
            'saved'       => array_values(array_map('strval', $saved)),
            'mine'        => $mine,
        ]);
    }

    // POST /api/training/saved { course_id, title }
    public function save_course()
    {
        $this->api->require_method('POST');
        $uid = $this->uid();
        $this->require_ready();
        $b = $this->api->body();
        $id = $this->course_id($b['course_id'] ?? '');
        if ($id === '') $this->api->respond_error('Which course?', 422);
        $this->db->raw(
            'INSERT INTO saved_courses (user_id, course_id, title, created_at) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE title = VALUES(title)',
            [$uid, $id, $this->text($b['title'] ?? null, 255), date('Y-m-d H:i:s')]
        );
        $this->api->respond(['success' => true, 'saved' => true, 'course_id' => $id], 201);
    }

    // DELETE /api/training/saved/{course_id}
    public function unsave_course($courseId)
    {
        $this->api->require_method('DELETE');
        $uid = $this->uid();
        $this->require_ready();
        $this->db->raw('DELETE FROM saved_courses WHERE user_id = ? AND course_id = ?', [$uid, $this->course_id($courseId)]);
        $this->api->respond(['success' => true, 'saved' => false]);
    }

    // POST /api/training/enroll { course_id, title, provider }
    public function enroll()
    {
        $this->api->require_method('POST');
        $uid = $this->uid();
        $this->require_ready();
        $this->api->rate_limit('enroll_' . $uid, 60, 3600);

        $b = $this->api->body();
        $id = $this->course_id($b['course_id'] ?? '');
        if ($id === '') $this->api->respond_error('Which course?', 422);
        $now = date('Y-m-d H:i:s');

        $existing = $this->db->raw('SELECT id, status FROM course_enrollments WHERE user_id = ? AND course_id = ?', [$uid, $id])->fetch(PDO::FETCH_ASSOC);
        if (!$existing) {
            $this->db->table('course_enrollments')->insert([
                'user_id'   => $uid,
                'course_id' => $id,
                'title'     => $this->text($b['title'] ?? null, 255),
                'provider'  => $this->text($b['provider'] ?? null, 150) ?: 'TESDA-registered school',
                'status'    => 'enrolled',
                'created_at'=> $now,
            ]);
            $existing = ['id' => (int) $this->db->last_id(), 'status' => 'enrolled'];
        }

        $this->api->respond([
            'success'    => true,
            'enrollment' => ['id' => (int) $existing['id'], 'course_id' => $id, 'status' => $existing['status']],
        ], 201);
    }

    // PATCH /api/training/enrollments/{id} { status, certificate_id }
    public function update_enrollment($id)
    {
        $this->api->require_method('PATCH');
        $uid = $this->uid();
        $this->require_ready();
        $row = $this->db->raw('SELECT * FROM course_enrollments WHERE id = ? AND user_id = ?', [(int) $id, $uid])->fetch(PDO::FETCH_ASSOC);
        if (!$row) $this->api->respond_error('Enrolment not found.', 404);

        $b = $this->api->body();
        $data = ['updated_at' => date('Y-m-d H:i:s')];
        $status = (string) ($b['status'] ?? '');
        if (in_array($status, ['enrolled', 'completed'], true)) {
            $data['status'] = $status;
            $data['completed_at'] = $status === 'completed' ? date('Y-m-d H:i:s') : null;
        }
        if (array_key_exists('certificate_id', $b)) {
            $cid = (int) $b['certificate_id'];
            if ($cid) {
                $cert = $this->skill_model->find_certificate($cid);
                if (!$cert || (int) $cert['user_id'] !== $uid) $this->api->respond_error('Certificate not found.', 404);
            }
            $data['certificate_id'] = $cid ?: null;
        }
        $this->db->table('course_enrollments')->where('id', (int) $id)->update($data);
        $this->api->respond(['success' => true, 'enrollment' => array_merge($row, $data)]);
    }

    // DELETE /api/training/enrollments/{id}
    public function delete_enrollment($id)
    {
        $this->api->require_method('DELETE');
        $uid = $this->uid();
        $this->require_ready();
        $this->db->raw('DELETE FROM course_enrollments WHERE id = ? AND user_id = ?', [(int) $id, $uid]);
        $this->api->respond(['success' => true]);
    }
}
