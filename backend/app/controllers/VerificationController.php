<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Account verification for workers, employers and clients (migration 021).
 *
 * Hybrid approach: the system checks everything a computer can check reliably (email link,
 * a valid mobile number, profile completeness, file type and size, an ID number already
 * used by another account, the name on the ID vs. the account name). An admin then looks at
 * the ID or business document itself, which a computer cannot judge reliably. See
 * docs/VERIFICATION.md.
 *
 * Status (users.verification_status):
 *   unverified  nothing sent yet
 *   pending     document sent, waiting for an admin
 *   verified    approved: badge shown, extra features unlocked
 *   rejected    not approved; the reason is shown and the person may send a new document
 *   resubmit    the admin asked for a clearer or different document
 *
 * Employers send a business permit through BusinessController (same statuses and history).
 *
 *   GET   /api/verification                     my checklist, status, history
 *   POST  /api/verification/id                  multipart: id_type, id_number, name_on_id, file, selfie?
 *   GET   /api/verification/requests/{id}/file  the ID image (owner or admin)
 *   GET   /api/admin/verification?status=       admin queue (workers and clients)
 *   PATCH /api/admin/verification/{id}          { action: approve | reject | resubmit, reason }
 *   GET   /api/admin/verification/history/{uid} decisions for one account
 */
class VerificationController extends Controller
{
    public const ID_TYPES = [
        'philsys'   => 'PhilSys National ID / ePhilID',
        'drivers'   => "Driver's License (LTO)",
        'umid'      => 'UMID',
        'sss'       => 'SSS ID',
        'passport'  => 'Philippine Passport',
        'prc'       => 'PRC ID',
        'postal'    => 'Postal ID',
        'voters'    => "Voter's ID / Certificate",
        'philhealth'=> 'PhilHealth ID',
        'tin'       => 'TIN ID',
        'senior'    => 'Senior Citizen ID',
        'pwd'       => 'PWD ID',
        'school'    => 'School ID (students)',
        'barangay'  => 'Barangay Clearance / ID',
    ];
    private const MAX_BYTES = 5 * 1024 * 1024;

    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->library('schema_info');
        $this->call->model('User_model', 'user_model');
        $this->call->model('Skill_model', 'skill_model');
        $this->call->model('Application_model', 'application_model');
    }

    private function me(): array
    {
        $payload = $this->api->require_jwt();
        $u = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$u || (int) ($u['is_active'] ?? 1) !== 1) $this->api->respond_error('Please sign in again.', 401);
        return $u;
    }

    private function ready(): bool
    {
        return $this->schema_info->has_table('verification_requests');
    }

    private function require_admin(): array
    {
        $u = $this->me();
        if (($u['role'] ?? '') !== 'admin') $this->api->respond_error('Only administrators can do this.', 403);
        return $u;
    }

    /** What verification unlocks, per role (shown on the page and enforced in the controllers). */
    public static function unlocks(string $type): array
    {
        return match ($type) {
            'employer' => [
                'Verified business badge on every job post and in messages',
                'New job posts go live right away (no waiting for review)',
                'Higher placement in job search results',
            ],
            'hirer' => [
                'Verified client badge on your gigs, proposals and messages',
                'New gigs go live right away (no waiting for review)',
                'Workers see you as a trusted client when they send proposals',
            ],
            default => [
                'Verified badge on your applications, proposals and Skills Passport',
                'Shown first to employers and clients in Find Workers',
                'Employers can trust your identity when they review your application',
            ],
        };
    }

    /** The checklist one account must complete. Automatic checks are marked done by the system. */
    private function checklist(array $u): array
    {
        $type = $u['account_type'] ?? 'worker';
        $items = [];
        $items[] = ['key' => 'email', 'label' => 'Confirm your email address', 'done' => !empty($u['email_verified_at']), 'auto' => true,
            'help' => 'Open the link we emailed you when you signed up.'];
        $items[] = ['key' => 'phone', 'label' => 'Add your mobile number', 'done' => \Phone::normalize($u['phone'] ?? null) !== null, 'auto' => true,
            'help' => 'Add it in your profile. Only our team and people you hire or work with see it.'];
        if ($type === 'worker') {
            $this->call->library('job_matcher');
            $missing = $this->job_matcher->missing_profile($u, $this->skill_model->get_skills_for_matching((int) $u['id']));
            $items[] = ['key' => 'profile', 'label' => 'Complete your profile and Skills Passport', 'done' => !$missing, 'auto' => true,
                'help' => $missing ? 'Still needed: ' . implode(', ', array_column($missing, 'label')) . '.' : 'Name, mobile number, town, education, experience and at least one skill.'];
        } else {
            $ok = mb_strlen(trim((string) $u['full_name'])) >= 2 && !empty($u['location']);
            $items[] = ['key' => 'profile', 'label' => $type === 'employer' ? 'Complete your business profile' : 'Complete your profile', 'done' => $ok, 'auto' => true,
                'help' => 'Your name' . ($type === 'employer' ? ' or business name' : '') . ' and town.'];
        }
        $status = $u['verification_status'] ?? (((int) ($u['is_verified'] ?? 0)) ? 'verified' : 'unverified');
        $items[] = ['key' => 'document',
            'label' => $type === 'employer' ? 'Send a business permit or registration' : 'Send a valid government ID',
            'done' => $status === 'verified', 'auto' => false,
            'help' => $type === 'employer' ? "DTI, SEC, CDA, Mayor's permit or BIR 2303. Our team checks it within 1 to 2 working days."
                : 'A clear photo of the front of your ID. Our team checks it within 1 to 2 working days.'];
        return $items;
    }

    // GET /api/verification
    public function status()
    {
        $this->api->require_method('GET');
        $u = $this->me();
        if (($u['role'] ?? '') === 'admin') $this->api->respond_error('Administrator accounts do not need verification.', 403);
        $status = $u['verification_status'] ?? (((int) ($u['is_verified'] ?? 0)) ? 'verified' : 'unverified');

        $latest = null; $history = [];
        if ($this->ready()) {
            $latest = $this->db->raw('SELECT id, id_type, id_number, name_on_id, file_name, checks, status, reason, reviewed_at, created_at FROM verification_requests WHERE user_id = ? ORDER BY id DESC LIMIT 1', [(int) $u['id']])->fetch(PDO::FETCH_ASSOC) ?: null;
            if ($latest) {
                $latest['id'] = (int) $latest['id'];
                $latest['id_label'] = self::ID_TYPES[$latest['id_type']] ?? $latest['id_type'];
                $latest['checks'] = json_decode((string) $latest['checks'], true) ?: [];
                // show only the last 4 characters of the ID number
                $latest['id_number'] = $latest['id_number'] ? str_repeat('•', max(0, mb_strlen($latest['id_number']) - 4)) . mb_substr($latest['id_number'], -4) : null;
            }
            $history = $this->db->raw('SELECT action, to_status, reason, created_at FROM verification_history WHERE user_id = ? ORDER BY id DESC LIMIT 20', [(int) $u['id']])->fetchAll(PDO::FETCH_ASSOC) ?: [];
        }

        $this->api->respond([
            'success'   => true,
            'enabled'   => $this->ready(),
            'status'    => $status,
            'checklist' => $this->checklist($u),
            'unlocks'   => self::unlocks($u['account_type'] ?? 'worker'),
            'request'   => $latest,
            'history'   => $history,
            'id_types'  => self::ID_TYPES,
            'phone'     => $u['phone'] ?? null,
        ]);
    }

    /** Read one uploaded image or PDF, or stop with a plain message. */
    private function read_file(string $field, bool $required, bool $imagesOnly = false): ?array
    {
        $f = $_FILES[$field] ?? null;
        if (!$f || empty($f['tmp_name']) || !is_uploaded_file($f['tmp_name'])) {
            if ($required) $this->api->respond_error('Attach a clear photo of your ID.', 422);
            return null;
        }
        if ((int) $f['size'] > self::MAX_BYTES) $this->api->respond_error('The photo is too large. The limit is 5 MB.', 422);
        $bytes = (string) file_get_contents($f['tmp_name']);
        $mime = null;
        if (!$imagesOnly && str_starts_with($bytes, '%PDF-')) $mime = 'application/pdf';
        else {
            $info = @getimagesizefromstring($bytes);
            $types = [IMAGETYPE_JPEG => 'image/jpeg', IMAGETYPE_PNG => 'image/png', IMAGETYPE_WEBP => 'image/webp'];
            if ($info && isset($types[$info[2]])) {
                $mime = $types[$info[2]];
                if ($info[0] < 400 || $info[1] < 250) $this->api->respond_error('The photo is too small to read. Take a closer, clearer photo.', 422);
            }
        }
        if (!$mime) $this->api->respond_error($imagesOnly ? 'Upload a photo (JPG, PNG or WEBP).' : 'Upload a photo (JPG, PNG, WEBP) or a PDF.', 422);
        return ['name' => mb_substr(preg_replace('/[^A-Za-z0-9._\- ]/', '', basename((string) ($f['name'] ?? 'id'))) ?: 'id', 0, 255),
                'mime' => $mime, 'size' => strlen($bytes), 'data' => 'data:' . $mime . ';base64,' . base64_encode($bytes)];
    }

    private function name_tokens(string $s): array
    {
        $s = strtolower(preg_replace('/[^a-z ]/i', ' ', iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s) ?: $s));
        return array_values(array_filter(explode(' ', $s), fn($w) => strlen($w) >= 2));
    }

    // POST /api/verification/id
    public function submit_id()
    {
        $this->api->require_method('POST');
        $u = $this->me();
        if (!in_array($u['account_type'] ?? '', ['worker', 'hirer'], true)) {
            $this->api->respond_error('Employers verify with a business document in Business Profile.', 403);
        }
        if (!$this->ready()) $this->api->respond_error('Verification is not available yet. Please try again later.', 503);
        $status = $u['verification_status'] ?? 'unverified';
        if ($status === 'verified') $this->api->respond_error('Your account is already verified.', 409);
        if ($status === 'pending') $this->api->respond_error('We already have your ID and are checking it. You will get a notice when it is done.', 409);
        if (empty($u['email_verified_at'])) $this->api->respond_error('Confirm your email address first. Open the link we emailed you.', 422);
        if (\Phone::normalize($u['phone'] ?? null) === null) $this->api->respond_error('Add your mobile number first.', 422);
        $this->api->rate_limit('verify_id_' . (int) $u['id'], 6, 86400);

        $b = $this->api->body();
        $type = (string) ($b['id_type'] ?? '');
        if (!isset(self::ID_TYPES[$type])) $this->api->respond_error('Choose the kind of ID you are sending.', 422);
        $number = mb_substr(strtoupper(preg_replace('/\s+/', '', (string) ($b['id_number'] ?? ''))), 0, 60);
        if (mb_strlen($number) < 4) $this->api->respond_error('Enter the ID number exactly as printed on the ID.', 422);
        $nameOnId = mb_substr(trim((string) ($b['name_on_id'] ?? '')), 0, 150);
        if (mb_strlen($nameOnId) < 4) $this->api->respond_error('Enter your full name as printed on the ID.', 422);
        $file = $this->read_file('file', true);
        $selfie = $this->read_file('selfie', false, true);

        // automatic checks the admin sees next to the document
        $checks = [];
        $dup = $this->db->raw("SELECT user_id FROM verification_requests WHERE id_type = ? AND id_number = ? AND user_id <> ? AND status IN ('pending','verified') LIMIT 1",
            [$type, $number, (int) $u['id']])->fetchColumn();
        $checks['id_unique'] = !$dup;
        $a = $this->name_tokens($nameOnId); $bn = $this->name_tokens((string) $u['full_name']);
        $checks['name_match'] = $a && $bn && count(array_intersect($a, $bn)) >= min(2, count($bn));
        $checks['email_confirmed'] = true;
        $checks['phone_confirmed'] = true;
        $checks['has_selfie'] = (bool) $selfie;
        if ($dup) $this->api->respond_error('This ID number is already used by another account. If this is a mistake, contact support.', 409);

        $this->db->raw(
            "INSERT INTO verification_requests (user_id, account_type, id_type, id_number, name_on_id, file_name, file_mime, file_size, file_data, selfie_mime, selfie_data, checks, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())",
            [(int) $u['id'], $u['account_type'], $type, $number, $nameOnId, $file['name'], $file['mime'], $file['size'], $file['data'],
             $selfie['mime'] ?? null, $selfie['data'] ?? null, json_encode($checks)]
        );
        $rid = (int) $this->db->last_id();
        \Verification_log::record((int) $u['id'], $rid, 'submitted', $status, 'pending', null, (int) $u['id']);

        foreach ($this->db->table('users')->where('role', 'admin')->get_all() ?: [] as $adm) {
            $this->application_model->create_notification((int) $adm['id'], 'system', 'ID to review',
                ($u['full_name'] ?? 'An account') . ' sent a ' . self::ID_TYPES[$type] . ' for verification.' . (!$checks['name_match'] ? ' The name on the ID may not match the account name.' : ''),
                '/dashboard/verify', false);
        }
        $this->application_model->create_notification((int) $u['id'], 'system', 'We received your ID',
            'Thanks! Our team will check your ' . self::ID_TYPES[$type] . ' within 1 to 2 working days. We will let you know here and by email.', '/dashboard/verification', false);
        $this->api->respond(['success' => true, 'status' => 'pending', 'message' => 'Thanks! We will check your ID within 1 to 2 working days.'], 201);
    }

    // GET /api/verification/requests/{id}/file?part=id|selfie
    public function file($id)
    {
        $this->api->require_method('GET');
        $u = $this->me();
        if (!$this->ready()) $this->api->respond_error('We could not find that file.', 404);
        $r = $this->db->raw('SELECT user_id, file_name, file_mime, file_data, selfie_mime, selfie_data FROM verification_requests WHERE id = ?', [(int) $id])->fetch(PDO::FETCH_ASSOC);
        if (!$r || ((int) $r['user_id'] !== (int) $u['id'] && ($u['role'] ?? '') !== 'admin')) $this->api->respond_error('We could not find that file.', 404);
        $selfie = ($_GET['part'] ?? '') === 'selfie';
        if ($selfie && !$r['selfie_data']) $this->api->respond_error('No selfie was sent.', 404);
        $this->api->respond(['success' => true, 'file_name' => $selfie ? 'selfie' : $r['file_name'],
            'file_mime' => $selfie ? $r['selfie_mime'] : $r['file_mime'], 'data_url' => $selfie ? $r['selfie_data'] : $r['file_data']]);
    }

    // GET /api/admin/verification?status=pending|verified|rejected|resubmit|all
    public function admin_index()
    {
        $this->api->require_method('GET');
        $this->require_admin();
        if (!$this->ready()) $this->api->respond(['success' => true, 'enabled' => false, 'requests' => [], 'counts' => []]);
        $status = (string) ($_GET['status'] ?? 'pending');
        $where = in_array($status, ['pending', 'verified', 'rejected', 'resubmit'], true) ? 'WHERE r.status = ?' : '';
        $rows = $this->db->raw(
            "SELECT r.id, r.user_id, r.account_type, r.id_type, r.id_number, r.name_on_id, r.file_mime, r.checks, r.status, r.reason, r.reviewed_at, r.created_at,
                    (r.selfie_data IS NOT NULL) AS has_selfie,
                    u.full_name, u.email, u.phone, u.location, u.verification_status, u.email_verified_at, u.phone_verified_at, u.created_at AS member_since,
                    a.full_name AS reviewer_name
             FROM verification_requests r JOIN users u ON u.id = r.user_id LEFT JOIN users a ON a.id = r.reviewed_by
             {$where} ORDER BY r.created_at " . ($status === 'pending' ? 'ASC' : 'DESC') . ' LIMIT 200',
            $where ? [$status] : []
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) {
            $r['id'] = (int) $r['id']; $r['user_id'] = (int) $r['user_id']; $r['has_selfie'] = (bool) $r['has_selfie'];
            $r['id_label'] = self::ID_TYPES[$r['id_type']] ?? $r['id_type'];
            $r['checks'] = json_decode((string) $r['checks'], true) ?: [];
        }
        unset($r);
        $counts = [];
        foreach ($this->db->raw('SELECT status, COUNT(*) n FROM verification_requests GROUP BY status')->fetchAll(PDO::FETCH_ASSOC) ?: [] as $c) $counts[$c['status']] = (int) $c['n'];
        $this->api->respond(['success' => true, 'enabled' => true, 'requests' => $rows, 'counts' => $counts]);
    }

    // PATCH /api/admin/verification/{id}
    public function admin_decide($id)
    {
        $this->api->require_method('PATCH');
        $admin = $this->require_admin();
        if (!$this->ready()) $this->api->respond_error('Verification is not available yet.', 503);
        $r = $this->db->raw('SELECT id, user_id, id_type, status FROM verification_requests WHERE id = ?', [(int) $id])->fetch(PDO::FETCH_ASSOC);
        if (!$r) $this->api->respond_error('We could not find that request.', 404);
        $b = $this->api->body();
        $action = (string) ($b['action'] ?? '');
        $reason = mb_substr(trim((string) ($b['reason'] ?? '')), 0, 500) ?: null;
        if (!in_array($action, ['approve', 'reject', 'resubmit', 'revoke'], true)) $this->api->respond_error('Choose approve, reject or ask for a new document.', 422);
        if ($action !== 'approve' && !$reason) $this->api->respond_error('Write the reason. The person will see it.', 422);
        if ($action !== 'revoke' && $r['status'] !== 'pending') $this->api->respond_error('This request was already decided.', 409);

        $to = ['approve' => 'verified', 'reject' => 'rejected', 'resubmit' => 'resubmit', 'revoke' => 'unverified'][$action];
        $this->db->raw('UPDATE verification_requests SET status = ?, reason = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
            [$action === 'revoke' ? 'rejected' : $to, $reason, (int) $admin['id'], (int) $id]);
        $user = $this->user_model->find_by_id((int) $r['user_id']);
        \Verification_log::record((int) $r['user_id'], (int) $id, $action === 'approve' ? 'approved' : ($action === 'resubmit' ? 'resubmission_requested' : ($action === 'revoke' ? 'revoked' : 'rejected')),
            $user['verification_status'] ?? null, $to, $reason, (int) $admin['id']);

        $label = self::ID_TYPES[$r['id_type']] ?? 'ID';
        [$title, $body] = match ($action) {
            'approve'  => ['Your account is verified', "We checked your {$label}. Your profile now shows the Verified badge."],
            'reject'   => ['We could not verify your account', "We could not accept your {$label}. Reason: {$reason} You can send a different valid ID from the Verification page."],
            'resubmit' => ['Please send your ID again', "We need a new photo of your ID. Reason: {$reason} Open the Verification page to send it."],
            'revoke'   => ['Your verified badge was removed', "Our team removed your verified badge. Reason: {$reason} Contact support if you think this is a mistake."],
        };
        $this->application_model->create_notification((int) $r['user_id'], 'system', $title, $body, '/dashboard/verification');
        $this->api->respond(['success' => true, 'status' => $to]);
    }

    // GET /api/admin/verification/history/{uid}
    public function admin_history($uid)
    {
        $this->api->require_method('GET');
        $this->require_admin();
        if (!$this->ready()) $this->api->respond(['success' => true, 'history' => []]);
        $rows = $this->db->raw(
            'SELECT h.action, h.from_status, h.to_status, h.reason, h.created_at, a.full_name AS actor_name, a.role AS actor_role
             FROM verification_history h LEFT JOIN users a ON a.id = h.actor_id WHERE h.user_id = ? ORDER BY h.id DESC LIMIT 100', [(int) $uid]
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $this->api->respond(['success' => true, 'history' => $rows]);
    }

    // GET /api/admin/verification/log — the latest decisions across all accounts
    public function admin_log()
    {
        $this->api->require_method('GET');
        $this->require_admin();
        if (!$this->ready()) $this->api->respond(['success' => true, 'history' => []]);
        $rows = $this->db->raw(
            "SELECT h.user_id, h.action, h.to_status, h.reason, h.created_at, u.full_name, u.account_type, a.full_name AS actor_name
             FROM verification_history h JOIN users u ON u.id = h.user_id LEFT JOIN users a ON a.id = h.actor_id
             WHERE h.action IN ('approved','rejected','resubmission_requested','revoked','submitted')
             ORDER BY h.id DESC LIMIT 100"
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $this->api->respond(['success' => true, 'history' => $rows]);
    }
}
