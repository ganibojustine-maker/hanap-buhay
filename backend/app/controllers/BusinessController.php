<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Business verification (migration 020).
 *
 * An employer or client uploads one registration document; an admin checks it against the
 * business name and number, and approving it turns on the "Verified business" badge that
 * workers see on every job post (users.is_verified). Workers trust a verified employer more,
 * and it keeps fake job posts out.
 *
 *   GET   /api/business/verification             my document's status (no file)
 *   POST  /api/business/verification             upload / replace (multipart: file, doc_type, business_name, registration_no)
 *   GET   /api/business/verification/{uid}/file  the file — the owner or an admin
 *   GET   /api/admin/business-docs?status=        admin queue
 *   PATCH /api/admin/business-docs/{uid}         admin: { action: approve | reject, note }
 */
class BusinessController extends Controller
{
    private const DOC_TYPES = [
        'dti'   => 'DTI Business Name Registration',
        'sec'   => 'SEC Certificate of Registration',
        'cda'   => 'CDA Certificate (cooperative)',
        'mayor' => "Mayor's / Business Permit",
        'bir'   => 'BIR Certificate of Registration (Form 2303)',
        'other' => 'Other government registration',
    ];
    private const MAX_BYTES = 5 * 1024 * 1024;

    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->library('schema_info');
        $this->call->model('User_model', 'user_model');
        $this->call->model('Application_model', 'application_model');
    }

    private function me(): array
    {
        $payload = $this->api->require_jwt();
        $u = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$u || (int) ($u['is_active'] ?? 1) !== 1) $this->api->respond_error('Unauthorized', 401);
        return $u;
    }

    private function ready(): bool
    {
        return $this->schema_info->has_table('business_documents');
    }

    private function row(int $uid): ?array
    {
        $r = $this->db->raw(
            'SELECT user_id, doc_type, business_name, registration_no, file_name, file_mime, file_size, status, review_note, reviewed_at, created_at
             FROM business_documents WHERE user_id = ?', [$uid]
        )->fetch(PDO::FETCH_ASSOC);
        if (!$r) return null;
        $r['user_id'] = (int) $r['user_id'];
        $r['file_size'] = (int) $r['file_size'];
        $r['doc_label'] = self::DOC_TYPES[$r['doc_type']] ?? $r['doc_type'];
        return $r;
    }

    // GET /api/business/verification
    public function mine()
    {
        $this->api->require_method('GET');
        $u = $this->me();
        $this->api->respond([
            'success'     => true,
            'enabled'     => $this->ready(),
            'is_verified' => (int) ($u['is_verified'] ?? 0) === 1,
            'document'    => $this->ready() ? $this->row((int) $u['id']) : null,
            'doc_types'   => self::DOC_TYPES,
        ]);
    }

    // POST /api/business/verification
    public function upload()
    {
        $this->api->require_method('POST');
        $u = $this->me();
        if (!in_array($u['account_type'] ?? '', ['employer', 'hirer'], true)) $this->api->respond_error('Business verification is for employer and client accounts.', 403);
        if (!$this->ready()) $this->api->respond_error('Business verification is not available yet. Please try again later.', 503);
        $this->api->rate_limit('biz_doc_' . (int) $u['id'], 10, 3600);

        $b = $this->api->body();
        $type = (string) ($b['doc_type'] ?? '');
        if (!isset(self::DOC_TYPES[$type])) $this->api->respond_error('Choose the kind of document you are uploading.', 422);
        $name = mb_substr(trim((string) ($b['business_name'] ?? '')), 0, 255);
        if (mb_strlen($name) < 2) $this->api->respond_error('Enter the business name exactly as it appears on the document.', 422);
        $regNo = mb_substr(trim((string) ($b['registration_no'] ?? '')), 0, 80) ?: null;

        $f = $_FILES['file'] ?? null;
        if (!$f || empty($f['tmp_name']) || !is_uploaded_file($f['tmp_name'])) $this->api->respond_error('Attach a photo or PDF of the document.', 422);
        if ((int) $f['size'] > self::MAX_BYTES) $this->api->respond_error('The file is too large. The limit is 5 MB.', 422);
        $bytes = (string) file_get_contents($f['tmp_name']);
        $mime = null;
        if (str_starts_with($bytes, '%PDF-')) $mime = 'application/pdf';
        else {
            $info = @getimagesizefromstring($bytes);
            $types = [IMAGETYPE_JPEG => 'image/jpeg', IMAGETYPE_PNG => 'image/png', IMAGETYPE_WEBP => 'image/webp'];
            if ($info && isset($types[$info[2]])) $mime = $types[$info[2]];
        }
        if (!$mime) $this->api->respond_error('Upload a photo (JPG, PNG, WEBP) or a PDF of the document.', 422);
        $fileName = mb_substr(preg_replace('/[^A-Za-z0-9._\- ]/', '', basename((string) ($f['name'] ?? 'document'))) ?: 'document', 0, 255);

        $this->db->raw(
            "INSERT INTO business_documents (user_id, doc_type, business_name, registration_no, file_name, file_mime, file_size, file_data, status, review_note, reviewed_by, reviewed_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, NOW())
             ON DUPLICATE KEY UPDATE doc_type = VALUES(doc_type), business_name = VALUES(business_name), registration_no = VALUES(registration_no),
               file_name = VALUES(file_name), file_mime = VALUES(file_mime), file_size = VALUES(file_size), file_data = VALUES(file_data),
               status = 'pending', review_note = NULL, reviewed_by = NULL, reviewed_at = NULL, created_at = NOW()",
            [(int) $u['id'], $type, $name, $regNo, $fileName, $mime, strlen($bytes), 'data:' . $mime . ';base64,' . base64_encode($bytes)]
        );

        \Verification_log::record((int) $u['id'], null, 'submitted', $u['verification_status'] ?? null, 'pending', self::DOC_TYPES[$type], (int) $u['id']);

        foreach ($this->db->table('users')->where('role', 'admin')->get_all() ?: [] as $adm) {
            $this->application_model->create_notification(
                (int) $adm['id'], 'system', 'Business document to review',
                "{$name} (" . ($u['full_name'] ?? 'an account') . ") uploaded a " . self::DOC_TYPES[$type] . ' for verification.',
                '/dashboard/verify', false
            );
        }
        $this->api->respond(['success' => true, 'document' => $this->row((int) $u['id'])], 201);
    }

    // GET /api/business/verification/{uid}/file
    public function file($uid)
    {
        $this->api->require_method('GET');
        $u = $this->me();
        if ((int) $u['id'] !== (int) $uid && ($u['role'] ?? '') !== 'admin') $this->api->respond_error('Forbidden', 403);
        if (!$this->ready()) $this->api->respond_error('Document not found.', 404);
        $r = $this->db->raw('SELECT file_name, file_mime, file_data FROM business_documents WHERE user_id = ?', [(int) $uid])->fetch(PDO::FETCH_ASSOC);
        if (!$r) $this->api->respond_error('Document not found.', 404);
        $this->api->respond(['success' => true, 'file_name' => $r['file_name'], 'file_mime' => $r['file_mime'], 'data_url' => $r['file_data']]);
    }

    // GET /api/admin/business-docs?status=pending|verified|rejected|all
    public function admin_list()
    {
        $this->api->require_method('GET');
        $u = $this->me();
        if (($u['role'] ?? '') !== 'admin') $this->api->respond_error('Forbidden', 403);
        if (!$this->ready()) $this->api->respond(['success' => true, 'enabled' => false, 'documents' => [], 'counts' => []]);
        $status = (string) ($_GET['status'] ?? 'pending');
        $where = in_array($status, ['pending', 'verified', 'rejected'], true) ? 'WHERE d.status = ?' : '';
        $rows = $this->db->raw(
            "SELECT d.user_id, d.doc_type, d.business_name, d.registration_no, d.file_name, d.file_mime, d.file_size, d.status, d.review_note,
                    d.reviewed_at, d.created_at, u.full_name, u.email, u.account_type, u.location, u.is_verified
             FROM business_documents d JOIN users u ON u.id = d.user_id {$where} ORDER BY d.created_at DESC LIMIT 200",
            $where ? [$status] : []
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) { $r['user_id'] = (int) $r['user_id']; $r['doc_label'] = self::DOC_TYPES[$r['doc_type']] ?? $r['doc_type']; }
        unset($r);
        $counts = [];
        foreach ($this->db->raw('SELECT status, COUNT(*) n FROM business_documents GROUP BY status')->fetchAll(PDO::FETCH_ASSOC) ?: [] as $c) $counts[$c['status']] = (int) $c['n'];
        $this->api->respond(['success' => true, 'enabled' => true, 'documents' => $rows, 'counts' => $counts]);
    }

    // PATCH /api/admin/business-docs/{uid}
    public function admin_review($uid)
    {
        $this->api->require_method('PATCH');
        $admin = $this->me();
        if (($admin['role'] ?? '') !== 'admin') $this->api->respond_error('Forbidden', 403);
        if (!$this->ready()) $this->api->respond_error('Not available yet.', 503);
        $doc = $this->row((int) $uid);
        if (!$doc) $this->api->respond_error('Document not found.', 404);
        $b = $this->api->body();
        $action = (string) ($b['action'] ?? '');
        $note = mb_substr(trim((string) ($b['note'] ?? '')), 0, 500) ?: null;
        if (!in_array($action, ['approve', 'reject', 'resubmit'], true)) $this->api->respond_error('Choose approve, reject or ask for a new document.', 422);
        if ($action !== 'approve' && !$note) $this->api->respond_error('Say why it was not accepted, so the business can fix it.', 422);

        $status = ['approve' => 'verified', 'reject' => 'rejected', 'resubmit' => 'resubmit'][$action];
        $this->db->raw('UPDATE business_documents SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE user_id = ?',
            [$status === 'resubmit' ? 'rejected' : $status, $note, (int) $admin['id'], (int) $uid]);
        $owner = $this->user_model->find_by_id((int) $uid);
        \Verification_log::record((int) $uid, null, $action === 'approve' ? 'approved' : ($action === 'resubmit' ? 'resubmission_requested' : 'rejected'),
            $owner['verification_status'] ?? null, $status, $note, (int) $admin['id']);

        $this->application_model->create_notification(
            (int) $uid, 'system',
            $action === 'approve' ? 'Your business is verified' : ($action === 'resubmit' ? 'Please send your business document again' : 'Business document not accepted'),
            $action === 'approve'
                ? "We checked your {$doc['doc_label']} for {$doc['business_name']}. Your posts now show the Verified business badge and go live right away."
                : "We could not verify {$doc['business_name']}. Reason: {$note} Please upload a clearer or correct document on your Verification page.",
            '/dashboard/verification'
        );
        $this->api->respond(['success' => true, 'status' => $status]);
    }
}
