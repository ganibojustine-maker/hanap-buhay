<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Photos for posts: a job, a gig, or a worker's service listing (migration 022).
 *
 *   GET    /api/photos/{type}/{id}               the photo list: [{slot, v, url}]
 *   POST   /api/photos/{type}/{id}               add one (multipart "image"; JPG/PNG/WEBP, 3 MB)
 *   DELETE /api/photos/{type}/{id}/{slot}        remove one
 *   GET    /api/photos/{type}/{id}/{slot}/file   the picture itself, for an <img src>
 *
 * type = job (jobs and gigs) | service. Storage rules are in Photo_model.
 *
 * Uploads are checked by their real content (getimagesizefromstring), not by the file
 * name or the Content-Type the browser sent; only JPG, PNG and WEBP up to 3 MB are kept.
 */
class PhotoController extends Controller
{
    private const TYPES = [IMAGETYPE_JPEG => 'image/jpeg', IMAGETYPE_PNG => 'image/png', IMAGETYPE_WEBP => 'image/webp'];
    private const MAX_BYTES = 3 * 1024 * 1024;

    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->model('User_model', 'user_model');
        $this->call->model('Job_model', 'job_model');
        $this->call->model('Service_model', 'service_model');
        $this->call->model('Photo_model', 'photo_model');
    }

    private function type(string $t): string
    {
        if (!isset(Photo_model::MAX[$t])) $this->api->respond_error('Unknown kind of photo.', 404);
        return $t;
    }

    /** The post, after checking the signed-in person may change its photos (owner or admin). */
    private function owned(string $type, int $id): array
    {
        $payload = $this->api->require_jwt();
        $u = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$u || (int) ($u['is_active'] ?? 1) !== 1) $this->api->respond_error('Please sign in again.', 401);
        $isAdmin = ($u['role'] ?? '') === 'admin';
        if ($type === 'job') {
            $row = $this->job_model->find_by_id($id);
            if (!$row || (!$isAdmin && (int) $row['employer_id'] !== (int) $u['id'])) $this->api->respond_error('We could not find that post.', 404);
        } else {
            $row = $this->service_model->find_service($id);
            if (!$row || (!$isAdmin && (int) $row['worker_id'] !== (int) $u['id'])) $this->api->respond_error('We could not find that service.', 404);
        }
        $this->api->rate_limit('post_photo_' . (int) $u['id'], 80, 3600);
        return $row;
    }

    /** Answer with the post's current photo list. */
    private function reply(string $type, int $id): void
    {
        $v = 0;
        if ($type === 'job') {
            $job = $this->job_model->find_by_id($id);
            if (!$job) $this->api->respond_error('We could not find that post.', 404);
            $v = (int) ($job['image_v'] ?? 0);
        }
        $this->api->respond(['success' => true, 'photos' => $this->photo_model->list_for($type, $id, $v), 'max' => Photo_model::MAX[$type]]);
    }

    /** Send stored image bytes to the browser (an <img src> cannot carry a token, so this is public). */
    private function send_image(?array $row): void
    {
        $data = (string) ($row['file_data'] ?? '');
        $bytes = str_contains($data, ';base64,') ? base64_decode(substr($data, strpos($data, ';base64,') + 8), true) : false;
        if ($bytes === false || $bytes === '') $this->api->respond_error('Photo not found.', 404);
        $mime = in_array($row['file_mime'], self::TYPES, true) ? $row['file_mime'] : 'application/octet-stream';
        if (!headers_sent()) {
            header('Content-Type: ' . $mime);
            header('Content-Length: ' . strlen($bytes));
            header('Cache-Control: public, max-age=604800');   // the URL carries ?v=, so a new photo is a new URL
            header('X-Content-Type-Options: nosniff');
            header('Cross-Origin-Resource-Policy: cross-origin');
            header("Content-Security-Policy: default-src 'none'; img-src 'self' data:; sandbox");
        }
        echo $bytes;
        exit;
    }

    // GET /api/photos/{type}/{id}
    public function index($type, $id)
    {
        $this->api->require_method('GET');
        $this->reply($this->type((string) $type), (int) $id);
    }

    // POST /api/photos/{type}/{id}   (multipart: image; extra=1 keeps a job's cover as it is)
    public function store($type, $id)
    {
        $this->api->require_method('POST');
        $type = $this->type((string) $type);
        $id = (int) $id;
        $row = $this->owned($type, $id);

        $f = $_FILES['image'] ?? $_FILES['file'] ?? null;
        if (!$f || empty($f['tmp_name']) || !is_uploaded_file($f['tmp_name'])) $this->api->respond_error('Choose a photo to upload.', 422);
        if ((int) $f['size'] > self::MAX_BYTES) $this->api->respond_error('The photo is too large. The limit is 3 MB.', 422);
        $bytes = (string) file_get_contents($f['tmp_name']);
        $info = @getimagesizefromstring($bytes);
        if (!$info || !isset(self::TYPES[$info[2]])) $this->api->respond_error('Upload a photo (JPG, PNG or WEBP). Videos and documents are not accepted.', 422);
        $mime = self::TYPES[$info[2]];
        $data = 'data:' . $mime . ';base64,' . base64_encode($bytes);

        $hasCover = $type === 'job' && (int) ($row['image_v'] ?? 0) > 0;
        $used = $this->photo_model->used_slots($type, $id);
        if (count($used) + ($hasCover ? 1 : 0) >= Photo_model::MAX[$type]) {
            $this->api->respond_error('You can add up to ' . Photo_model::MAX[$type] . ' photos. Remove one to add another.', 409);
        }

        if ($type === 'job' && !$hasCover && empty($_POST['extra'])) {
            // a job without a cover: this photo becomes the cover every card reads
            $this->photo_model->save_cover($id, $mime, strlen($bytes), $data);
            $this->job_model->update_job($id, ['image_v' => (int) ($row['image_v'] ?? 0) + 1]);
        } else {
            $slot = $type === 'job' ? 1 : 0;
            while (in_array($slot, $used, true)) $slot++;
            $this->photo_model->add($type, $id, $slot, $mime, strlen($bytes), $data);
        }
        $this->reply($type, $id);
    }

    // DELETE /api/photos/{type}/{id}/{slot}
    public function destroy($type, $id, $slot)
    {
        $this->api->require_method('DELETE');
        $type = $this->type((string) $type);
        $id = (int) $id;
        $row = $this->owned($type, $id);
        if ($type === 'job' && (int) $slot === 0) {
            // removing a job's cover: the next photo takes its place, so the post keeps a picture
            $next = $this->photo_model->first_extra('job', $id);
            if ($next) {
                $this->photo_model->save_cover($id, $next['file_mime'], (int) $next['file_size'], $next['file_data']);
                $this->photo_model->remove('job', $id, (int) $next['slot']);
                $this->job_model->update_job($id, ['image_v' => (int) ($row['image_v'] ?? 0) + 1]);
            } else {
                $this->photo_model->remove_cover($id);
                $this->job_model->update_job($id, ['image_v' => 0]);
            }
        } else {
            $this->photo_model->remove($type, $id, (int) $slot);
        }
        $this->reply($type, $id);
    }

    // GET /api/photos/{type}/{id}/{slot}/file
    public function file($type, $id, $slot)
    {
        $this->api->require_method('GET');
        $row = $this->photo_model->find($this->type((string) $type), (int) $id, (int) $slot);
        if (!$row) $this->api->respond_error('Photo not found.', 404);
        $this->send_image($row);
    }
}
