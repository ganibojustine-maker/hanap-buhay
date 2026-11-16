<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * /api/skills — Worker skills passport & training.
 */
class SkillController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->model('Skill_model', 'skill_model');
        $this->call->model('User_model', 'user_model');
        $this->call->library('schema_info');
    }

    /** skill_certificates comes from migration 015; until then certificates are listed empty and uploads say so. */
    private function certs_ready(): bool
    {
        return $this->schema_info->has_table('skill_certificates');
    }

    // GET /api/skills/my — worker's skills (Read)
    public function my_skills()
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $rows = $this->skill_model->get_user_skills((int) $payload['sub']);
        $this->api->respond(['success' => true, 'skills' => $rows ?: []]);
    }

    // POST /api/skills — add skill (Create)
    public function add_skill()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user || $user['account_type'] !== 'worker') $this->api->respond_error('Only workers can manage skills.', 403);

        $b = $this->api->body();
        $name = trim((string) ($b['skill_name'] ?? ''));
        if (mb_strlen($name) < 2) $this->api->respond_error('Enter a skill name.', 422);

        [$skill, $created] = $this->upsert_skill((int) $payload['sub'], [
            'skill_name'  => mb_substr($name, 0, 255),
            'category'    => mb_substr(trim((string) ($b['category'] ?? '')), 0, 100) ?: null,
            'level'       => in_array($b['level'] ?? '', self::LEVELS, true) ? $b['level'] : null,
            'source'      => in_array($b['source'] ?? '', self::SOURCES, true) ? $b['source'] : 'self',
            'certificate' => mb_substr(trim((string) ($b['certificate'] ?? '')), 0, 255) ?: null,
        ]);

        $this->api->respond(['success' => true, 'skill' => $skill, 'created' => $created], $created ? 201 : 200);
    }

    private const LEVELS  = ['beginner', 'intermediate', 'advanced', 'expert'];
    private const SOURCES = ['self', 'tesda', 'employer', 'training', 'other'];

    /** Max certificate file size (images are shrunk in the browser first). */
    private const CERT_MAX_BYTES = 3 * 1024 * 1024;

    /**
     * Adds a skill, or updates the worker's existing skill with the same name,
     * so scanning the same resume or certificate twice never creates duplicates.
     * Existing details are only overwritten by non-empty values; a "self" source
     * never downgrades a TESDA/training one.
     *
     * @return array{0: ?array, 1: bool} [skill, created]
     */
    private function upsert_skill(int $user_id, array $data): array
    {
        $existing = $this->skill_model->find_user_skill_by_name($user_id, $data['skill_name']);
        if (!$existing) {
            return [$this->skill_model->add_skill(['user_id' => $user_id] + $data), true];
        }

        $update = [];
        foreach (['category', 'level', 'certificate', 'certificate_id'] as $k) {
            if (!empty($data[$k])) $update[$k] = $data[$k];
        }
        if (!empty($data['source']) && $data['source'] !== 'self') $update['source'] = $data['source'];
        if ($update) $this->skill_model->update_skill((int) $existing['id'], $update);

        return [$this->skill_model->find_skill((int) $existing['id']), false];
    }

    private function require_worker(array $payload): array
    {
        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);
        if ($user['account_type'] !== 'worker') $this->api->respond_error('Only workers can manage skills.', 403);
        return $user;
    }

    /**
     * Reads an uploaded certificate and checks it by content, not by the
     * extension or MIME type the browser sent.
     *
     * @return array{mime:string, bytes:string, name:string}
     */
    private function read_certificate_upload(): array
    {
        $file = $_FILES['file'] ?? $_FILES['certificate'] ?? null;
        if (!$file || empty($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            $this->api->respond_error('No certificate file uploaded.', 422);
        }
        if ((int) $file['size'] > self::CERT_MAX_BYTES) {
            $this->api->respond_error('Certificate file is too large. Maximum size is 3MB.', 422);
        }
        $bytes = (string) file_get_contents($file['tmp_name']);
        $mime = null;
        if (str_starts_with($bytes, '%PDF-')) {
            $mime = 'application/pdf';
        } else {
            $info = @getimagesizefromstring($bytes);
            $types = [IMAGETYPE_JPEG => 'image/jpeg', IMAGETYPE_PNG => 'image/png', IMAGETYPE_WEBP => 'image/webp'];
            if ($info && isset($types[$info[2]])) $mime = $types[$info[2]];
        }
        if (!$mime) $this->api->respond_error('Upload a photo (JPG, PNG, WEBP) or a PDF of your certificate.', 422);

        $name = preg_replace('/[^A-Za-z0-9._\- ]/', '', basename((string) ($file['name'] ?? 'certificate')));
        return ['mime' => $mime, 'bytes' => $bytes, 'name' => mb_substr($name ?: 'certificate', 0, 255)];
    }

    private function certificate_text(?array $upload, string $ocr): string
    {
        $text = mb_substr($ocr, 0, 20000);
        if ($upload && $upload['mime'] === 'application/pdf') {
            $this->call->library('resume_parser');
            $text = trim($this->resume_parser->pdf_text($upload['bytes']) . "\n" . $text);
        }
        return $text;
    }

    // POST /api/skills/certificate/scan — read a certificate, return the skill it proves (nothing saved)
    public function scan_certificate()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $this->require_worker($payload);
        $this->api->rate_limit('cert_scan_' . (int) $payload['sub'], 40, 3600);

        $b = $this->api->body();
        $upload = !empty($_FILES['file']['tmp_name']) ? $this->read_certificate_upload() : null;
        $text = $this->certificate_text($upload, (string) ($b['ocr_text'] ?? ''));

        $this->call->library('certificate_parser');
        $parsed = $this->certificate_parser->parse($text);
        $check = $this->certificate_parser->assess($text);
        $check['name_matches'] = $this->name_matches($parsed['holder_name'] ?? null, (int) $payload['sub']);
        $check['duplicate'] = $this->duplicate_certificate($parsed['cert_number'] ?? null, (int) $payload['sub']);

        $this->api->respond([
            'success'  => true,
            'parsed'   => $parsed,
            'check'    => $check,
            'has_text' => trim($text) !== '',
        ]);
    }

    /**
     * Does the name printed on the certificate look like this worker's name?
     * null when no name could be read; otherwise true when at least one real word of the
     * printed name (3+ letters) is part of the profile name.
     */
    private function name_matches(?string $holder, int $uid): ?bool
    {
        $holder = trim((string) $holder);
        if ($holder === '') return null;
        $u = $this->user_model->find_by_id($uid);
        $mine = strtolower((string) ($u['full_name'] ?? ''));
        if ($mine === '') return null;
        foreach (preg_split('/[\s.,]+/', strtolower($holder)) as $w) {
            if (strlen($w) >= 3 && str_contains($mine, $w)) return true;
        }
        return false;
    }

    /**
     * Is this certificate number already on file?
     *   'mine'   this worker uploaded it before
     *   'other'  it is on another account — one certificate belongs to one person
     *   null     not seen before, or no number
     */
    private function duplicate_certificate(?string $number, int $uid): ?string
    {
        $number = preg_replace('/\s+/', '', (string) $number);
        if ($number === '' || strlen($number) < 6 || !$this->certs_ready()) return null;
        $row = $this->db->raw("SELECT user_id FROM skill_certificates WHERE REPLACE(cert_number, ' ', '') = ? AND status <> 'rejected' ORDER BY user_id = ? DESC LIMIT 1", [$number, $uid])
            ->fetch(PDO::FETCH_ASSOC);
        if (!$row) return null;
        return (int) $row['user_id'] === $uid ? 'mine' : 'other';
    }

    // GET /api/skills/certificates — the worker's uploaded certificates (no file data)
    public function my_certificates()
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        if (!$this->certs_ready()) $this->api->respond(['success' => true, 'enabled' => false, 'certificates' => []]);
        $this->api->respond(['success' => true, 'certificates' => $this->skill_model->get_user_certificates((int) $payload['sub'])]);
    }

    // POST /api/skills/certificates — store the certificate and add/update its skill
    public function upload_certificate()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $this->require_worker($payload);
        if (!$this->certs_ready()) $this->api->respond_error('Uploading certificates is not available yet. Please try again later, or add the skill by hand for now.', 503);
        $this->api->rate_limit('cert_upload_' . (int) $payload['sub'], 20, 3600);
        $uid = (int) $payload['sub'];

        $upload = $this->read_certificate_upload();
        $b = $this->api->body();
        $str = fn($k, $max = 255) => mb_substr(trim((string) ($b[$k] ?? '')), 0, $max) ?: null;
        $date = function ($k) use ($b) {
            $v = trim((string) ($b[$k] ?? ''));
            return preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) && strtotime($v) ? $v : null;
        };

        $title = $str('title');
        if ($title === null || mb_strlen($title) < 2) $this->api->respond_error('Enter the skill or qualification on the certificate.', 422);

        // the same check the scan ran, on the file actually being saved: a resume, an ID,
        // a receipt or an unreadable photo is not stored as a certificate
        $this->call->library('certificate_parser');
        $check = $this->certificate_parser->assess($this->certificate_text($upload, (string) ($b['ocr_text'] ?? '')));
        if ($check['verdict'] === 'unreadable') {
            $this->api->respond(['error' => 'We could not read any words on this file. Take a clear photo of the whole certificate, flat and in good light, and upload it again.', 'status' => 422, 'code' => 'unreadable'], 422);
        }
        if ($check['verdict'] === 'not_certificate') {
            $this->api->respond(['error' => 'This file does not look like a certificate, so it was not saved.', 'status' => 422, 'code' => 'not_certificate', 'kind' => $check['kind']], 422);
        }

        $nc = in_array($b['nc_level'] ?? '', ['I', 'II', 'III', 'IV'], true) ? $b['nc_level'] : null;
        $source = in_array($b['source'] ?? '', self::SOURCES, true) ? $b['source'] : ($nc ? 'tesda' : 'training');
        $certNo = $str('cert_number', 80);
        $dup = $this->duplicate_certificate($certNo, $uid);
        if ($dup === 'mine') $this->api->respond(['error' => 'You already uploaded this certificate (same certificate number).', 'status' => 409, 'code' => 'duplicate_mine'], 409);
        if ($dup === 'other') $this->api->respond(['error' => 'This certificate number is already on another hanapbuhay account. A certificate belongs to one person. If it is yours, contact Help & Support.', 'status' => 409, 'code' => 'duplicate_other'], 409);

        $cert = $this->skill_model->add_certificate([
            'user_id'     => $uid,
            'title'       => $title,
            'issuer'      => $str('issuer', 150) ?? ($source === 'tesda' ? 'TESDA' : null),
            'nc_level'    => $nc,
            'cert_number' => $certNo,
            'holder_name' => $str('holder_name', 150),
            'issued_on'   => $date('issued_on'),
            'valid_until' => $date('valid_until'),
            'file_name'   => $upload['name'],
            'file_mime'   => $upload['mime'],
            'file_size'   => strlen($upload['bytes']),
            'file_data'   => 'data:' . $upload['mime'] . ';base64,' . base64_encode($upload['bytes']),
            'ocr_text'    => $str('ocr_text', 20000),
            'status'      => 'pending',
        ]);
        if (!$cert) $this->api->respond_error('Could not save the certificate. Please try again.', 500);

        [$skill, $created] = $this->upsert_skill($uid, [
            'skill_name'     => $title,
            'category'       => $str('category', 100),
            'level'          => in_array($b['level'] ?? '', self::LEVELS, true) ? $b['level'] : null,
            'source'         => $source,
            'certificate'    => $certNo ?? ($source === 'tesda' ? 'TESDA' . ($nc ? " NC $nc" : '') : mb_substr((string) ($str('issuer', 150) ?? 'Certificate'), 0, 255)),
            'certificate_id' => (int) $cert['id'],
        ]);

        $this->api->respond(['success' => true, 'certificate' => $cert, 'skill' => $skill, 'created' => $created], 201);
    }

    // GET /api/skills/certificates/:id/file — owner or admin
    public function certificate_file($id)
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        if (!$this->certs_ready()) $this->api->respond_error('Certificate not found.', 404);
        $cert = $this->skill_model->find_certificate((int) $id, true);
        if (!$cert) $this->api->respond_error('Certificate not found.', 404);

        if ((int) $cert['user_id'] !== (int) $payload['sub']) {
            $viewer = $this->user_model->find_by_id((int) $payload['sub']);
            // admins, and employers this worker applied to (not withdrawn), may open the file
            $isEmployerOfApplicant = $viewer && (bool) $this->db->raw(
                "SELECT COUNT(*) FROM applications a JOIN jobs j ON j.id = a.job_id
                 WHERE a.worker_id = ? AND j.employer_id = ? AND a.status <> 'withdrawn'",
                [(int) $cert['user_id'], (int) $viewer['id']]
            )->fetchColumn();
            if (!$viewer || ($viewer['role'] !== 'admin' && !$isEmployerOfApplicant)) $this->api->respond_error('Forbidden', 403);
        }
        $this->api->respond([
            'success'   => true,
            'file_name' => $cert['file_name'],
            'file_mime' => $cert['file_mime'],
            'data_url'  => $cert['file_data'],
        ]);
    }

    // DELETE /api/skills/certificates/:id
    public function delete_certificate($id)
    {
        $this->api->require_method('DELETE');
        $payload = $this->api->require_jwt();
        if (!$this->certs_ready()) $this->api->respond_error('Certificate not found.', 404);
        $cert = $this->skill_model->find_certificate((int) $id);
        if (!$cert) $this->api->respond_error('Certificate not found.', 404);
        if ((int) $cert['user_id'] !== (int) $payload['sub']) $this->api->respond_error('Forbidden', 403);

        $this->skill_model->delete_certificate((int) $id);
        $this->api->respond(['success' => true]);
    }

    // PUT /api/skills/:id — update skill (Update)
    public function update_skill($id)
    {
        $payload = $this->api->require_jwt();
        $skill = $this->skill_model->find_skill((int) $id);
        if (!$skill) $this->api->respond_error('Skill not found.', 404);
        if ((int) $skill['user_id'] !== (int) $payload['sub']) $this->api->respond_error('Forbidden', 403);

        $b = $this->api->body();
        $data = [];
        if (isset($b['skill_name']) && mb_strlen(trim((string) $b['skill_name'])) >= 2) {
            $data['skill_name'] = substr(trim((string) $b['skill_name']), 0, 255);
        }
        if (array_key_exists('category', $b)) {
            $data['category'] = substr(trim((string) ($b['category'] ?? '')), 0, 100) ?: null;
        }
        if (isset($b['level']) && in_array($b['level'], ['beginner','intermediate','advanced','expert'], true)) {
            $data['level'] = $b['level'];
        }
        if (isset($b['source']) && in_array($b['source'], ['self','tesda','employer','training','other'], true)) {
            $data['source'] = $b['source'];
        }
        if (array_key_exists('certificate', $b)) {
            $data['certificate'] = substr(trim((string) ($b['certificate'] ?? '')), 0, 255) ?: null;
        }

        if (empty($data)) $this->api->respond_error('No valid fields to update.', 422);

        $this->skill_model->update_skill((int) $id, $data);
        $this->api->respond(['success' => true, 'skill' => $this->skill_model->find_skill((int) $id)]);
    }

    // DELETE /api/skills/:id — delete skill (Delete)
    public function delete_skill($id)
    {
        $this->api->require_method('DELETE');
        $payload = $this->api->require_jwt();
        $skill = $this->skill_model->find_skill((int) $id);
        if (!$skill) $this->api->respond_error('Skill not found.', 404);
        if ((int) $skill['user_id'] !== (int) $payload['sub']) $this->api->respond_error('Forbidden', 403);

        $this->skill_model->delete_skill((int) $id);
        $this->api->respond(['success' => true]);
    }

    // GET /api/skills/passport-score — completion percentage
    public function passport_score()
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);

        $skills = $this->skill_model->get_user_skills((int) $payload['sub']);
        $count  = count($skills ?: []);

        $score = 0;
        if (!empty($user['full_name']))    $score += 15;
        if (!empty($user['location']))     $score += 10;
        if (!empty($user['phone']))        $score += 10;
        if (!empty($user['bio']))          $score += 15;
        if ($count >= 1)  $score += 20;
        if ($count >= 3)  $score += 15;
        if ($count >= 5)  $score += 10;
        $verified = array_filter($skills ?: [], fn($s) => (int) $s['verified'] === 1);
        if (count($verified) >= 1) $score += 5;

        $this->api->respond(['success' => true, 'score' => min(100, $score), 'skills_count' => $count]);
    }

    // GET /api/training — training courses (public)
    public function training()
    {
        $this->api->require_method('GET');
        $loc = trim((string) ($_GET['location'] ?? ''));
        $cat = trim((string) ($_GET['category'] ?? ''));

        $rows = $this->skill_model->get_active_training_courses($loc, $cat, 20);
        $this->api->respond(['success' => true, 'courses' => $rows ?: []]);
    }
}
