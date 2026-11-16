<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * /api/portfolio — the worker's work gallery (table work_samples, migration 018).
 *
 * A photo of real work with a short description, optionally tied to a skill in the
 * Skills Passport. Unlike a certificate this proves nothing on its own, so it is never
 * marked verified — it is evidence an employer can look at.
 *
 *   GET    /api/portfolio                 my gallery (metadata only)
 *   GET    /api/portfolio/user/{id}       someone's public gallery
 *   GET    /api/portfolio/{id}/file       the image itself (public: the gallery is public)
 *   POST   /api/portfolio                 multipart: file + title + description + skill_name
 *   PATCH  /api/portfolio/{id}            edit the title / description / skill
 *   DELETE /api/portfolio/{id}
 */
class PortfolioController extends Controller
{
    private const MAX_BYTES = 3 * 1024 * 1024; // 3MB per photo
    private const MAX_ITEMS = 24;

    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->library('schema_info');
        $this->call->model('User_model', 'user_model');
    }

    private const COLUMNS = 'id, user_id, title, description, skill_name, kind, taken_on, file_mime, file_size, created_at';

    private function ready(): bool
    {
        return $this->schema_info->has_table('work_samples');
    }

    private function uid(): int
    {
        $payload = $this->api->require_jwt();
        return (int) $payload['sub'];
    }

    private function text($raw, int $max): ?string
    {
        $s = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string) $raw));
        $s = preg_replace("/\n{3,}/", "\n\n", $s) ?? '';
        return $s === '' ? null : mb_substr($s, 0, $max);
    }

    /** A real image, decided by the bytes, not by what the browser called the file. */
    private function read_image(): array
    {
        $file = $_FILES['file'] ?? $_FILES['photo'] ?? null;
        if (!$file || empty($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            $this->api->respond_error('Choose a photo of your work.', 422);
        }
        if ((int) $file['size'] > self::MAX_BYTES) {
            $this->api->respond_error('That photo is too large. Maximum size is 3MB.', 422);
        }
        $bytes = (string) file_get_contents($file['tmp_name']);
        $info = @getimagesizefromstring($bytes);
        $types = [IMAGETYPE_JPEG => 'image/jpeg', IMAGETYPE_PNG => 'image/png', IMAGETYPE_WEBP => 'image/webp'];
        if (!$info || !isset($types[$info[2]])) {
            $this->api->respond_error('Upload a photo (JPG, PNG or WEBP). Videos and other files are not accepted here.', 422);
        }
        return ['mime' => $types[$info[2]], 'bytes' => $bytes];
    }

    // GET /api/portfolio
    public function index()
    {
        $this->api->require_method('GET');
        $uid = $this->uid();
        if (!$this->ready()) $this->api->respond(['success' => true, 'setup_needed' => true, 'items' => []]);
        $this->api->respond(['success' => true, 'items' => $this->rows_for($uid)]);
    }

    // GET /api/portfolio/user/{id}
    public function user($id)
    {
        $this->api->require_method('GET');
        if (!$this->ready()) $this->api->respond(['success' => true, 'items' => []]);
        $owner = $this->user_model->find_by_id((int) $id);
        if (!$owner || (int) $owner['is_active'] !== 1) $this->api->respond_error('Profile not found.', 404);
        $this->api->respond(['success' => true, 'items' => $this->rows_for((int) $id)]);
    }

    private function rows_for(int $uid): array
    {
        $cols = self::COLUMNS;
        $rows = $this->db->raw("SELECT {$cols} FROM work_samples WHERE user_id = ? ORDER BY created_at DESC LIMIT " . self::MAX_ITEMS, [$uid])
            ->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) {
            $r['id'] = (int) $r['id'];
            $r['user_id'] = (int) $r['user_id'];
            $r['file_size'] = (int) $r['file_size'];
            $r['url'] = '/api/portfolio/' . $r['id'] . '/file';
        }
        return $rows;
    }

    /**
     * GET /api/portfolio/{id}/file — the image itself.
     *
     * This is what an <img src> points at, so it must answer with the picture, not with
     * JSON describing it. The row stores a data: URL, so the base64 is decoded back to
     * bytes here. No token: a browser cannot put an Authorization header on an <img>,
     * and the gallery is public anyway (it shows on the worker's public profile).
     */
    public function file($id)
    {
        $this->api->require_method('GET');
        if (!$this->ready()) $this->api->respond_error('Photo not found.', 404);
        $row = $this->db->raw('SELECT file_mime, file_data FROM work_samples WHERE id = ?', [(int) $id])->fetch(PDO::FETCH_ASSOC);
        if (!$row) $this->api->respond_error('Photo not found.', 404);

        $data = (string) $row['file_data'];
        $bytes = str_contains($data, ';base64,')
            ? base64_decode(substr($data, strpos($data, ';base64,') + 8), true)
            : false;
        if ($bytes === false || $bytes === '') $this->api->respond_error('Photo not found.', 404);

        $mime = in_array($row['file_mime'], ['image/jpeg', 'image/png', 'image/webp'], true) ? $row['file_mime'] : 'application/octet-stream';
        if (!headers_sent()) {
            header('Content-Type: ' . $mime);
            header('Content-Length: ' . strlen($bytes));
            header('Cache-Control: public, max-age=86400');   // the bytes never change
            header('X-Content-Type-Options: nosniff');
            header('Content-Disposition: inline; filename="work-' . (int) $id . '"');
            // The API answers every other request with Cross-Origin-Resource-Policy:
            // same-origin, which would stop the browser rendering this in an <img> when
            // the site and the API are on different hosts (they are, in production).
            header('Cross-Origin-Resource-Policy: cross-origin');
            header("Content-Security-Policy: default-src 'none'; img-src 'self' data:; sandbox");
        }
        echo $bytes;
        exit;
    }

    // POST /api/portfolio  (multipart)
    public function create()
    {
        $this->api->require_method('POST');
        $uid = $this->uid();
        if (!$this->ready()) $this->api->respond_error('The work gallery is not switched on yet. Please try again later.', 503);
        $this->api->rate_limit('portfolio_' . $uid, 30, 3600);

        $count = (int) $this->db->raw('SELECT COUNT(*) FROM work_samples WHERE user_id = ?', [$uid])->fetchColumn();
        if ($count >= self::MAX_ITEMS) {
            $this->api->respond_error('Your gallery is full (' . self::MAX_ITEMS . ' photos). Remove one first.', 422);
        }

        $img = $this->read_image();
        $b = $this->api->body();
        $title = $this->text($b['title'] ?? '', 150);
        if ($title === null || mb_strlen($title) < 2) $this->api->respond_error('Give the photo a short title, e.g. "House rewiring in Calapan".', 422);
        $description = $this->text($b['description'] ?? '', 1000);
        if ($description === null || mb_strlen($description) < 10) {
            $this->api->respond_error('Describe what you did in this photo (at least 10 characters). Employers read this.', 422);
        }
        $kind = in_array($b['kind'] ?? '', ['work', 'certificate', 'other'], true) ? $b['kind'] : 'work';
        $takenOn = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($b['taken_on'] ?? '')) ? $b['taken_on'] : null;

        $this->db->table('work_samples')->insert([
            'user_id'     => $uid,
            'title'       => $title,
            'description' => $description,
            'skill_name'  => $this->text($b['skill_name'] ?? '', 150),
            'kind'        => $kind,
            'taken_on'    => $takenOn,
            'file_mime'   => $img['mime'],
            'file_size'   => strlen($img['bytes']),
            'file_data'   => 'data:' . $img['mime'] . ';base64,' . base64_encode($img['bytes']),
            'created_at'  => date('Y-m-d H:i:s'),
        ]);
        $newId = (int) $this->db->last_id();
        $cols = self::COLUMNS;
        $row = $this->db->raw("SELECT {$cols} FROM work_samples WHERE id = ?", [$newId])->fetch(PDO::FETCH_ASSOC);
        if ($row) { $row['id'] = (int) $row['id']; $row['url'] = "/api/portfolio/{$newId}/file"; }

        $this->api->respond(['success' => true, 'item' => $row], 201);
    }

    // PATCH /api/portfolio/{id}
    public function update($id)
    {
        $this->api->require_method('PATCH');
        $uid = $this->uid();
        if (!$this->ready()) $this->api->respond_error('Photo not found.', 404);
        $row = $this->db->raw('SELECT id FROM work_samples WHERE id = ? AND user_id = ?', [(int) $id, $uid])->fetch(PDO::FETCH_ASSOC);
        if (!$row) $this->api->respond_error('Photo not found.', 404);

        $b = $this->api->body();
        $data = [];
        if (array_key_exists('title', $b)) {
            $t = $this->text($b['title'], 150);
            if ($t === null || mb_strlen($t) < 2) $this->api->respond_error('Give the photo a short title.', 422);
            $data['title'] = $t;
        }
        if (array_key_exists('description', $b)) {
            $d = $this->text($b['description'], 1000);
            if ($d === null || mb_strlen($d) < 10) $this->api->respond_error('Describe what you did in this photo (at least 10 characters).', 422);
            $data['description'] = $d;
        }
        if (array_key_exists('skill_name', $b)) $data['skill_name'] = $this->text($b['skill_name'], 150);
        if (!$data) $this->api->respond_error('Nothing to change.', 422);

        $this->db->table('work_samples')->where('id', (int) $id)->update($data);
        $this->api->respond(['success' => true, 'item' => array_merge(['id' => (int) $id], $data)]);
    }

    // DELETE /api/portfolio/{id}
    public function destroy($id)
    {
        $this->api->require_method('DELETE');
        $uid = $this->uid();
        if (!$this->ready()) $this->api->respond_error('Photo not found.', 404);
        $this->db->raw('DELETE FROM work_samples WHERE id = ? AND user_id = ?', [(int) $id, $uid]);
        $this->api->respond(['success' => true]);
    }
}
