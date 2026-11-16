<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * The gig (freelance) workflow between a client and a worker. Separate from the employer's
 * hiring pipeline: a gig is short, priced work, so there is no interview shortlist.
 *
 *   post gig → proposals → compare → hire → contract (+ milestones) → delivery
 *            → revision (up to the agreed number) → completed → payment confirmed → reviews
 *   Any time before delivery: cancelled. Any time after hiring: disputed (an admin decides).
 *
 * Or: a client books a worker's service listing directly → the worker accepts → contract.
 *
 * Money: the client pays the worker directly (cash, GCash, Maya or bank transfer) and both
 * confirm it here. hanapbuhay does not hold the money (that needs a licensed escrow), see
 * docs/GIGS.md.
 *
 * Contract status:  offered | active | delivered | revision_requested | completed | cancelled | disputed
 * Proposal status:  submitted | shortlisted | declined | withdrawn | hired | not_selected
 * Payment status:   unpaid | sent (client says paid) | confirmed (worker says received)
 */
class GigController extends Controller
{
    public const CONTRACT_TEXT = [
        'offered'            => 'Waiting for the worker to accept',
        'active'             => 'In progress',
        'delivered'          => 'Delivered: waiting for the client to approve',
        'revision_requested' => 'Changes requested',
        'completed'          => 'Completed',
        'cancelled'          => 'Cancelled',
        'disputed'           => 'In dispute: our team is reviewing',
    ];
    public const PROPOSAL_TEXT = [
        'submitted'    => 'Sent: the client has not decided yet',
        'shortlisted'  => 'Shortlisted: the client is comparing a few proposals',
        'declined'     => 'Declined by the client',
        'withdrawn'    => 'You withdrew this proposal',
        'hired'        => 'Hired: a contract was started',
        'not_selected' => 'The client hired someone else',
    ];
    private const PAY_METHODS = ['cash' => 'Cash', 'gcash' => 'GCash', 'maya' => 'Maya', 'bank' => 'Bank transfer', 'other' => 'Other'];
    private const DISPUTE_REASONS = [
        'not_delivered' => 'The work was not delivered', 'quality' => 'The work does not match what was agreed',
        'not_paid' => 'I was not paid', 'no_show' => 'The other person stopped responding',
        'scam' => 'I think this is a scam', 'other' => 'Something else',
    ];

    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->library('schema_info');
        $this->call->model('User_model', 'user_model');
        $this->call->model('Job_model', 'job_model');
        $this->call->model('Skill_model', 'skill_model');
        $this->call->model('Application_model', 'application_model');
        $this->call->library('job_matcher');
    }

    /* ── helpers ───────────────────────────────────────────── */

    private function me(): array
    {
        $payload = $this->api->require_jwt();
        $u = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$u || (int) ($u['is_active'] ?? 1) !== 1) $this->api->respond_error('Please sign in again.', 401);
        if (!$this->schema_info->has_table('contracts')) $this->api->respond_error('Gigs are being set up. Please try again later.', 503);
        return $u;
    }

    private function as_worker(): array
    {
        $u = $this->me();
        if (($u['account_type'] ?? '') !== 'worker') $this->api->respond_error('Only workers can do this.', 403);
        return $u;
    }

    private function as_client(): array
    {
        $u = $this->me();
        if (($u['account_type'] ?? '') !== 'hirer') $this->api->respond_error('Only client accounts can do this.', 403);
        return $u;
    }

    private function text(string $key, int $max, int $min = 0, string $msg = ''): string
    {
        $v = mb_substr(trim((string) ($this->api->body()[$key] ?? '')), 0, $max);
        if (mb_strlen($v) < $min) $this->api->respond_error($msg ?: 'Please fill in this field.', 422);
        return $v;
    }

    private static function peso($n): string
    {
        return "\u{20B1}" . number_format((float) $n, 2);
    }

    private function notify(int $uid, string $title, string $body, string $link, bool $email = true): void
    {
        $this->application_model->create_notification($uid, 'gig', $title, $body, $link, $email);
    }

    private function log(int $cid, ?int $actor, string $event, ?string $note = null, ?array $file = null): void
    {
        $this->db->raw('INSERT INTO contract_events (contract_id, actor_id, event, note, file_name, file_mime, file_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
            [$cid, $actor, $event, $note, $file['name'] ?? null, $file['mime'] ?? null, $file['data'] ?? null]);
    }

    private function gig(int $id): array
    {
        $g = $this->job_model->find_by_id($id);
        if (!$g || ($g['post_type'] ?? 'job') !== 'gig' || $g['status'] === 'archived') $this->api->respond_error('We could not find that gig.', 404);
        return $g;
    }

    private function contract(int $id, array $u): array
    {
        $c = $this->db->raw('SELECT * FROM contracts WHERE id = ?', [$id])->fetch(PDO::FETCH_ASSOC);
        $isAdmin = ($u['role'] ?? '') === 'admin';
        if (!$c || (!$isAdmin && (int) $c['client_id'] !== (int) $u['id'] && (int) $c['worker_id'] !== (int) $u['id'])) {
            $this->api->respond_error('We could not find that contract.', 404);
        }
        return $c;
    }

    private function require_phone(array $u, string $what): void
    {
        if ($this->schema_info->has_column('users', 'phone_verified_at') && empty($u['phone_verified_at'])) {
            $this->api->respond_error("To keep gigs safe from scams, confirm your mobile number before you {$what}. Open Verification to do it in a minute.", 422);
        }
    }

    /** Optional delivery file (photo or PDF, up to 5 MB). */
    private function upload(): ?array
    {
        $f = $_FILES['file'] ?? null;
        if (!$f || empty($f['tmp_name']) || !is_uploaded_file($f['tmp_name'])) return null;
        if ((int) $f['size'] > 5 * 1024 * 1024) $this->api->respond_error('The file is too large. The limit is 5 MB.', 422);
        $bytes = (string) file_get_contents($f['tmp_name']);
        $mime = str_starts_with($bytes, '%PDF-') ? 'application/pdf' : null;
        if (!$mime) {
            $info = @getimagesizefromstring($bytes);
            $types = [IMAGETYPE_JPEG => 'image/jpeg', IMAGETYPE_PNG => 'image/png', IMAGETYPE_WEBP => 'image/webp'];
            $mime = $info && isset($types[$info[2]]) ? $types[$info[2]] : null;
        }
        if (!$mime) $this->api->respond_error('Attach a photo (JPG, PNG, WEBP) or a PDF.', 422);
        return ['name' => mb_substr(preg_replace('/[^A-Za-z0-9._\- ]/', '', basename((string) $f['name'])) ?: 'file', 0, 255),
                'mime' => $mime, 'data' => 'data:' . $mime . ';base64,' . base64_encode($bytes)];
    }

    private function person(int $id): array
    {
        $u = $this->db->raw('SELECT id, full_name, picture, location, is_verified, account_type, avatar_color FROM users WHERE id = ?', [$id])->fetch(PDO::FETCH_ASSOC) ?: [];
        if ($u) {
            $r = $this->db->raw('SELECT COUNT(*) n, AVG(rating) a FROM contract_reviews WHERE reviewee_id = ? AND is_hidden = 0', [$id])->fetch(PDO::FETCH_ASSOC);
            $u['rating'] = ['count' => (int) $r['n'], 'average' => $r['n'] ? round((float) $r['a'], 1) : null];
            $u['completed_gigs'] = (int) $this->db->raw("SELECT COUNT(*) FROM contracts WHERE (worker_id = ? OR client_id = ?) AND status = 'completed'", [$id, $id])->fetchColumn();
        }
        return $u;
    }

    /* ── worker: proposals ─────────────────────────────────── */

    // POST /api/gigs/{id}/proposals  { bid_amount, delivery_days, cover_letter }
    public function propose($id)
    {
        $this->api->require_method('POST');
        $u = $this->as_worker();
        $this->api->rate_limit('proposal_' . (int) $u['id'], 30, 3600);
        $g = $this->gig((int) $id);
        if ($g['status'] !== 'active') $this->api->respond_error('This gig is no longer taking proposals.', 409);
        $missing = $this->job_matcher->missing_profile($u, $skills = $this->skill_model->get_skills_for_matching((int) $u['id']));
        if ($missing) {
            $this->api->respond(['success' => false, 'code' => 'profile_incomplete', 'missing' => $missing,
                'error' => 'Please complete your profile before sending proposals: ' . implode(', ', array_column($missing, 'label')) . '.'], 422);
        }
        $this->require_phone($u, 'send proposals');

        $bid = (float) ($this->api->body()['bid_amount'] ?? 0);
        if ($bid < 100 || $bid > 1000000) $this->api->respond_error('Enter your price in pesos (at least 100).', 422);
        $days = (int) ($this->api->body()['delivery_days'] ?? 0);
        if ($days < 1 || $days > 365) $this->api->respond_error('Enter how many days you need (1 to 365).', 422);
        $cover = $this->text('cover_letter', 2000, 30, 'Tell the client how you will do the work (at least a few sentences).');

        $existing = $this->db->raw('SELECT id, status FROM proposals WHERE gig_id = ? AND worker_id = ?', [(int) $id, (int) $u['id']])->fetch(PDO::FETCH_ASSOC);
        if ($existing && $existing['status'] !== 'withdrawn') $this->api->respond_error('You already sent a proposal for this gig.', 409);
        $score = $this->job_matcher->score($u, $skills, $g)['score'];
        if ($existing) {
            $this->db->raw("UPDATE proposals SET bid_amount = ?, delivery_days = ?, cover_letter = ?, match_score = ?, status = 'submitted', client_note = NULL, created_at = NOW(), updated_at = NOW() WHERE id = ?",
                [$bid, $days, $cover, $score, (int) $existing['id']]);
            $pid = (int) $existing['id'];
        } else {
            $this->db->raw("INSERT INTO proposals (gig_id, worker_id, client_id, bid_amount, delivery_days, cover_letter, match_score, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', NOW())",
                [(int) $id, (int) $u['id'], (int) $g['employer_id'], $bid, $days, $cover, $score]);
            $pid = (int) $this->db->last_id();
        }
        $this->notify((int) $g['employer_id'], "New proposal for {$g['title']}",
            "{$u['full_name']} offers to do \"{$g['title']}\" for " . self::peso($bid) . " in {$days} day" . ($days === 1 ? '' : 's') . ". Match score: {$score}%.", '/dashboard/proposals?gig=' . (int) $id);
        $this->api->respond(['success' => true, 'proposal_id' => $pid, 'message' => 'Proposal sent. We will tell you when the client answers.'], 201);
    }

    // GET /api/proposals/mine
    public function my_proposals()
    {
        $this->api->require_method('GET');
        $u = $this->as_worker();
        $rows = $this->db->raw(
            "SELECT p.*, j.title AS gig_title, j.location AS gig_location, j.salary_min, j.salary_max, j.status AS gig_status,
                    c.full_name AS client_name, c.is_verified AS client_verified, k.id AS contract_id
             FROM proposals p JOIN jobs j ON j.id = p.gig_id JOIN users c ON c.id = p.client_id
             LEFT JOIN contracts k ON k.proposal_id = p.id
             WHERE p.worker_id = ? ORDER BY p.updated_at DESC, p.created_at DESC", [(int) $u['id']]
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) $r['status_text'] = self::PROPOSAL_TEXT[$r['status']] ?? $r['status'];
        $this->api->respond(['success' => true, 'proposals' => $rows]);
    }

    // POST /api/proposals/{id}/withdraw
    public function withdraw($id)
    {
        $this->api->require_method('POST');
        $u = $this->as_worker();
        $p = $this->db->raw('SELECT * FROM proposals WHERE id = ? AND worker_id = ?', [(int) $id, (int) $u['id']])->fetch(PDO::FETCH_ASSOC);
        if (!$p) $this->api->respond_error('We could not find that proposal.', 404);
        if (!in_array($p['status'], ['submitted', 'shortlisted'], true)) $this->api->respond_error('This proposal can no longer be withdrawn.', 409);
        $this->db->raw("UPDATE proposals SET status = 'withdrawn', updated_at = NOW() WHERE id = ?", [(int) $id]);
        $this->api->respond(['success' => true, 'message' => 'Proposal withdrawn.']);
    }

    /* ── client: gigs and proposals ────────────────────────── */

    // GET /api/gigs/mine
    public function my_gigs()
    {
        $this->api->require_method('GET');
        $u = $this->as_client();
        $this->job_model->close_expired();
        $rows = $this->db->raw(
            "SELECT j.*,
               (SELECT COUNT(*) FROM proposals p WHERE p.gig_id = j.id AND p.status <> 'withdrawn') AS proposals,
               (SELECT COUNT(*) FROM proposals p WHERE p.gig_id = j.id AND p.status = 'submitted') AS new_proposals,
               (SELECT COUNT(*) FROM contracts k WHERE k.gig_id = j.id) AS contracts
             FROM jobs j WHERE j.employer_id = ? AND j.status <> 'archived' ORDER BY j.created_at DESC", [(int) $u['id']]
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) foreach (['proposals', 'new_proposals', 'contracts', 'views'] as $k) $r[$k] = (int) ($r[$k] ?? 0);
        $this->api->respond(['success' => true, 'gigs' => $rows]);
    }

    // GET /api/gigs/{id}/proposals  (also /api/proposals/received for every gig)
    public function gig_proposals($id = null)
    {
        $this->api->require_method('GET');
        $u = $this->as_client();
        $args = [(int) $u['id']];
        $where = 'p.client_id = ?';
        if ($id) { $g = $this->gig((int) $id); if ((int) $g['employer_id'] !== (int) $u['id']) $this->api->respond_error('We could not find that gig.', 404); $where .= ' AND p.gig_id = ?'; $args[] = (int) $id; }
        $rows = $this->db->raw(
            "SELECT p.*, j.title AS gig_title, j.salary_min, j.salary_max, w.full_name AS worker_name, w.picture AS worker_picture, w.location AS worker_location,
                    w.is_verified AS worker_verified, w.avatar_color, k.id AS contract_id
             FROM proposals p JOIN jobs j ON j.id = p.gig_id JOIN users w ON w.id = p.worker_id LEFT JOIN contracts k ON k.proposal_id = p.id
             WHERE {$where} AND p.status <> 'withdrawn' ORDER BY FIELD(p.status, 'submitted', 'shortlisted', 'hired', 'declined', 'not_selected'), p.match_score DESC, p.created_at DESC", $args
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) {
            $r['worker'] = $this->person((int) $r['worker_id']);
            $r['bid_amount'] = (float) $r['bid_amount'];
            $r['match_score'] = (int) $r['match_score'];
        }
        $this->api->respond(['success' => true, 'proposals' => $rows]);
    }

    // PATCH /api/proposals/{id}  { action: shortlist | decline, note }
    public function decide($id)
    {
        $this->api->require_method('PATCH');
        $u = $this->as_client();
        $p = $this->db->raw('SELECT p.*, j.title FROM proposals p JOIN jobs j ON j.id = p.gig_id WHERE p.id = ? AND p.client_id = ?', [(int) $id, (int) $u['id']])->fetch(PDO::FETCH_ASSOC);
        if (!$p) $this->api->respond_error('We could not find that proposal.', 404);
        $action = (string) ($this->api->body()['action'] ?? '');
        if (!in_array($action, ['shortlist', 'decline'], true)) $this->api->respond_error('Choose shortlist or decline.', 422);
        if (!in_array($p['status'], ['submitted', 'shortlisted'], true)) $this->api->respond_error('This proposal was already decided.', 409);
        $to = $action === 'shortlist' ? 'shortlisted' : 'declined';
        $note = $this->text('note', 500);
        $this->db->raw('UPDATE proposals SET status = ?, client_note = ?, updated_at = NOW() WHERE id = ?', [$to, $note ?: null, (int) $id]);
        $this->notify((int) $p['worker_id'], $to === 'shortlisted' ? "Shortlisted: {$p['title']}" : "Proposal update: {$p['title']}",
            $to === 'shortlisted' ? "The client is considering your proposal for \"{$p['title']}\". They may message you with questions."
                : "The client chose not to go ahead with your proposal for \"{$p['title']}\"." . ($note ? " Note: {$note}" : ''), '/dashboard/gigs/proposals', $to === 'shortlisted');
        $this->api->respond(['success' => true, 'status' => $to]);
    }

    /** Milestones from the request body: [{title, amount, due_date}], amounts adding up to the total. */
    private function milestones_from(array $b, float $total): array
    {
        $out = [];
        foreach (array_slice((array) ($b['milestones'] ?? []), 0, 10) as $i => $m) {
            $t = mb_substr(trim((string) ($m['title'] ?? '')), 0, 150);
            $a = (float) ($m['amount'] ?? 0);
            if ($t === '' && $a <= 0) continue;
            if (mb_strlen($t) < 2 || $a <= 0) $this->api->respond_error('Each milestone needs a short name and an amount.', 422);
            $d = (string) ($m['due_date'] ?? '');
            $out[] = ['title' => $t, 'amount' => $a, 'due_date' => preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) ? $d : null, 'position' => $i];
        }
        if ($out && abs(array_sum(array_column($out, 'amount')) - $total) > 0.01) {
            $this->api->respond_error('The milestone amounts must add up to the contract price of ' . self::peso($total) . '.', 422);
        }
        return $out;
    }

    private function insert_milestones(int $cid, array $ms): void
    {
        foreach ($ms as $m) {
            $this->db->raw("INSERT INTO contract_milestones (contract_id, title, amount, due_date, status, position, created_at) VALUES (?, ?, ?, ?, 'pending', ?, NOW())",
                [$cid, $m['title'], $m['amount'], $m['due_date'], $m['position']]);
        }
    }

    // POST /api/proposals/{id}/hire  { agreed_amount?, due_date?, scope?, revisions_allowed?, milestones? }
    public function hire($id)
    {
        $this->api->require_method('POST');
        $u = $this->as_client();
        $this->require_phone($u, 'hire');
        $p = $this->db->raw('SELECT * FROM proposals WHERE id = ? AND client_id = ?', [(int) $id, (int) $u['id']])->fetch(PDO::FETCH_ASSOC);
        if (!$p) $this->api->respond_error('We could not find that proposal.', 404);
        if (!in_array($p['status'], ['submitted', 'shortlisted'], true)) $this->api->respond_error('This proposal can no longer be accepted.', 409);
        $g = $this->gig((int) $p['gig_id']);
        $b = $this->api->body();
        $amount = isset($b['agreed_amount']) && $b['agreed_amount'] !== '' ? (float) $b['agreed_amount'] : (float) $p['bid_amount'];
        if ($amount < 100) $this->api->respond_error('Enter the agreed price in pesos.', 422);
        $due = (string) ($b['due_date'] ?? '');
        $due = preg_match('/^\d{4}-\d{2}-\d{2}$/', $due) ? $due : date('Y-m-d', time() + (int) $p['delivery_days'] * 86400);
        if (strtotime($due) < strtotime(date('Y-m-d'))) $this->api->respond_error('The due date cannot be in the past.', 422);
        $rev = max(0, min(5, (int) ($b['revisions_allowed'] ?? 2)));
        $ms = $this->milestones_from($b, $amount);
        $scope = mb_substr(trim((string) ($b['scope'] ?? '')), 0, 2000) ?: ($g['description'] ?? null);

        $claim = $this->db->raw("UPDATE proposals SET status = 'hired', updated_at = NOW() WHERE id = ? AND status IN ('submitted','shortlisted')", [(int) $id]);
        if ($claim->rowCount() < 1) $this->api->respond_error('This proposal was already accepted.', 409);
        $this->db->raw("INSERT INTO contracts (gig_id, proposal_id, client_id, worker_id, title, scope, agreed_amount, due_date, status, revisions_allowed, started_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW(), NOW())",
            [(int) $g['id'], (int) $id, (int) $u['id'], (int) $p['worker_id'], $g['title'], $scope, $amount, $due, $rev]);
        $cid = (int) $this->db->last_id();
        $this->insert_milestones($cid, $ms);
        $this->log($cid, (int) $u['id'], 'started', 'Contract started for ' . self::peso($amount) . ', due ' . date('F j, Y', strtotime($due)));

        // a gig with one opening closes; the other proposals are told kindly
        $openings = max(1, (int) ($g['openings'] ?? 1));
        $hired = (int) $this->db->raw('SELECT COUNT(*) FROM contracts WHERE gig_id = ?', [(int) $g['id']])->fetchColumn();
        if ($hired >= $openings) {
            $this->job_model->update_job((int) $g['id'], ['status' => 'closed']);
            $others = $this->db->raw("SELECT id, worker_id FROM proposals WHERE gig_id = ? AND status IN ('submitted','shortlisted')", [(int) $g['id']])->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($others as $o) {
                $this->db->raw("UPDATE proposals SET status = 'not_selected', updated_at = NOW() WHERE id = ?", [(int) $o['id']]);
                $this->notify((int) $o['worker_id'], "Gig filled: {$g['title']}", "The client hired another worker for \"{$g['title']}\". Thank you for your proposal. New gigs are posted every day.", '/dashboard/gigs', false);
            }
        }
        $this->notify((int) $p['worker_id'], "You're hired: {$g['title']}",
            "{$u['full_name']} accepted your proposal. Agreed price: " . self::peso($amount) . ". Due: " . date('F j, Y', strtotime($due)) . ".\n\nOpen the contract to see the details and milestones, and message the client to agree on the start.",
            '/dashboard/gigs/contracts/' . $cid);
        $this->api->respond(['success' => true, 'contract_id' => $cid, 'message' => 'Contract started. The worker has been told.'], 201);
    }

    /* ── contracts ─────────────────────────────────────────── */

    // GET /api/contracts?status=
    public function contracts()
    {
        $this->api->require_method('GET');
        $u = $this->me();
        $col = ($u['account_type'] ?? '') === 'hirer' ? 'k.client_id' : 'k.worker_id';
        $rows = $this->db->raw(
            "SELECT k.*, c.full_name AS client_name, c.is_verified AS client_verified, w.full_name AS worker_name, w.is_verified AS worker_verified, w.picture AS worker_picture,
                    (SELECT COUNT(*) FROM contract_milestones m WHERE m.contract_id = k.id) AS milestones,
                    (SELECT COUNT(*) FROM contract_milestones m WHERE m.contract_id = k.id AND m.status = 'approved') AS milestones_done
             FROM contracts k JOIN users c ON c.id = k.client_id JOIN users w ON w.id = k.worker_id
             WHERE {$col} = ? ORDER BY FIELD(k.status, 'offered', 'delivered', 'revision_requested', 'active', 'disputed', 'completed', 'cancelled'), k.updated_at DESC", [(int) $u['id']]
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) $r['status_text'] = self::CONTRACT_TEXT[$r['status']] ?? $r['status'];
        $this->api->respond(['success' => true, 'contracts' => $rows]);
    }

    // GET /api/contracts/{id}
    public function contract_detail($id)
    {
        $this->api->require_method('GET');
        $u = $this->me();
        $c = $this->contract((int) $id, $u);
        $ms = $this->db->raw('SELECT * FROM contract_milestones WHERE contract_id = ? ORDER BY position, id', [(int) $id])->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $ev = $this->db->raw('SELECT e.id, e.actor_id, e.event, e.note, e.file_name, e.file_mime, e.created_at, u.full_name AS actor_name
                              FROM contract_events e LEFT JOIN users u ON u.id = e.actor_id WHERE e.contract_id = ? ORDER BY e.created_at, e.id', [(int) $id])->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $dispute = $this->db->raw('SELECT * FROM disputes WHERE contract_id = ? ORDER BY id DESC LIMIT 1', [(int) $id])->fetch(PDO::FETCH_ASSOC) ?: null;
        if ($dispute) $dispute['reason_text'] = self::DISPUTE_REASONS[$dispute['reason']] ?? $dispute['reason'];
        $reviews = $this->db->raw('SELECT reviewer_id, reviewee_id, rating, comment, created_at FROM contract_reviews WHERE contract_id = ?', [(int) $id])->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $role = (int) $c['client_id'] === (int) $u['id'] ? 'client' : ((int) $c['worker_id'] === (int) $u['id'] ? 'worker' : 'admin');
        $mine = array_values(array_filter($reviews, fn($r) => (int) $r['reviewer_id'] === (int) $u['id']));
        $c['status_text'] = self::CONTRACT_TEXT[$c['status']] ?? $c['status'];
        $c['agreed_amount'] = (float) $c['agreed_amount'];
        $this->api->respond([
            'success' => true, 'contract' => $c, 'role' => $role,
            'client' => $this->person((int) $c['client_id']), 'worker' => $this->person((int) $c['worker_id']),
            'milestones' => $ms, 'events' => $ev, 'dispute' => $dispute, 'reviews' => $reviews,
            'my_review' => $mine[0] ?? null,
            'pay_methods' => self::PAY_METHODS, 'dispute_reasons' => self::DISPUTE_REASONS,
        ]);
    }

    // GET /api/contracts/{id}/files/{eventId}
    public function event_file($id, $eventId)
    {
        $this->api->require_method('GET');
        $u = $this->me();
        $this->contract((int) $id, $u);
        $e = $this->db->raw('SELECT file_name, file_mime, file_data FROM contract_events WHERE id = ? AND contract_id = ?', [(int) $eventId, (int) $id])->fetch(PDO::FETCH_ASSOC);
        if (!$e || !$e['file_data']) $this->api->respond_error('We could not find that file.', 404);
        $this->api->respond(['success' => true, 'file_name' => $e['file_name'], 'file_mime' => $e['file_mime'], 'data_url' => $e['file_data']]);
    }

    private function set_status(array $c, string $to, array $extra = []): void
    {
        $sets = ['status = ?', 'updated_at = NOW()']; $args = [$to];
        foreach ($extra as $k => $v) { $sets[] = "{$k} = ?"; $args[] = $v; }
        $args[] = (int) $c['id'];
        $this->db->raw('UPDATE contracts SET ' . implode(', ', $sets) . ' WHERE id = ?', $args);
    }

    private function only(array $c, array $u, string $side): void
    {
        $col = $side === 'client' ? 'client_id' : 'worker_id';
        if ((int) $c[$col] !== (int) $u['id']) $this->api->respond_error($side === 'client' ? 'Only the client can do this.' : 'Only the worker can do this.', 403);
    }

    private function link(array $c, string $forSide): string
    {
        return ($forSide === 'client' ? '/dashboard/contracts/' : '/dashboard/gigs/contracts/') . (int) $c['id'];
    }

    // POST /api/contracts/{id}/accept | decline  (worker, for a direct service booking)
    public function respond_offer($id)
    {
        $this->api->require_method('POST');
        $u = $this->as_worker();
        $c = $this->contract((int) $id, $u);
        $this->only($c, $u, 'worker');
        if ($c['status'] !== 'offered') $this->api->respond_error('This booking was already answered.', 409);
        $accept = ($this->api->body()['action'] ?? '') === 'accept';
        if ($accept) $this->require_phone($u, 'accept bookings');
        $this->set_status($c, $accept ? 'active' : 'cancelled', $accept ? ['started_at' => date('Y-m-d H:i:s')] : ['cancel_reason' => 'The worker declined the booking', 'cancelled_by' => (int) $u['id']]);
        $this->log((int) $c['id'], (int) $u['id'], $accept ? 'accepted' : 'declined');
        $this->notify((int) $c['client_id'], $accept ? "Booking accepted: {$c['title']}" : "Booking declined: {$c['title']}",
            $accept ? "{$u['full_name']} accepted your booking. Message them to agree on the schedule." : "{$u['full_name']} cannot take this booking. You can book another worker in Find Talent.",
            $this->link($c, 'client'));
        $this->api->respond(['success' => true, 'status' => $accept ? 'active' : 'cancelled']);
    }

    // POST /api/contracts/{id}/milestones  { title, amount, due_date }  (client, adds work)
    public function add_milestone($id)
    {
        $this->api->require_method('POST');
        $u = $this->as_client();
        $c = $this->contract((int) $id, $u);
        $this->only($c, $u, 'client');
        if (!in_array($c['status'], ['active', 'revision_requested', 'delivered'], true)) $this->api->respond_error('Milestones can only be added while the contract is in progress.', 409);
        $ms = $this->milestones_from(['milestones' => [$this->api->body()]], (float) ($this->api->body()['amount'] ?? 0));
        if (!$ms) $this->api->respond_error('Give the milestone a name and an amount.', 422);
        $pos = (int) $this->db->raw('SELECT COALESCE(MAX(position), -1) + 1 FROM contract_milestones WHERE contract_id = ?', [(int) $id])->fetchColumn();
        $ms[0]['position'] = $pos;
        $this->insert_milestones((int) $id, $ms);
        $this->db->raw('UPDATE contracts SET agreed_amount = agreed_amount + ?, updated_at = NOW() WHERE id = ?', [$ms[0]['amount'], (int) $id]);
        $this->log((int) $id, (int) $u['id'], 'milestone_added', "{$ms[0]['title']} (" . self::peso($ms[0]['amount']) . ')');
        $this->notify((int) $c['worker_id'], "New milestone: {$c['title']}", "The client added \"{$ms[0]['title']}\" for " . self::peso($ms[0]['amount']) . '.', $this->link($c, 'worker'), false);
        $this->api->respond(['success' => true]);
    }

    // POST /api/contracts/{id}/deliver  multipart { note, milestone_id?, file? }  (worker)
    public function deliver($id)
    {
        $this->api->require_method('POST');
        $u = $this->as_worker();
        $c = $this->contract((int) $id, $u);
        $this->only($c, $u, 'worker');
        if (!in_array($c['status'], ['active', 'revision_requested'], true)) $this->api->respond_error('You can deliver while the contract is in progress or changes were requested.', 409);
        $note = $this->text('note', 2000, 10, 'Describe what you delivered (a sentence or two).');
        $file = $this->upload();
        $mid = (int) ($this->api->body()['milestone_id'] ?? 0);
        if ($mid) {
            $m = $this->db->raw("SELECT id, title FROM contract_milestones WHERE id = ? AND contract_id = ? AND status IN ('pending','in_progress','revision')", [$mid, (int) $id])->fetch(PDO::FETCH_ASSOC);
            if (!$m) $this->api->respond_error('That milestone cannot be delivered now.', 409);
            $this->db->raw("UPDATE contract_milestones SET status = 'submitted', submitted_at = NOW() WHERE id = ?", [$mid]);
            $this->log((int) $id, (int) $u['id'], 'milestone_submitted', "{$m['title']}: {$note}", $file);
            $open = (int) $this->db->raw("SELECT COUNT(*) FROM contract_milestones WHERE contract_id = ? AND status <> 'approved' AND status <> 'submitted'", [(int) $id])->fetchColumn();
            if ($open === 0) $this->set_status($c, 'delivered', ['delivered_at' => date('Y-m-d H:i:s')]);
        } else {
            $this->set_status($c, 'delivered', ['delivered_at' => date('Y-m-d H:i:s')]);
            $this->log((int) $id, (int) $u['id'], 'delivered', $note, $file);
        }
        $this->notify((int) $c['client_id'], "Work delivered: {$c['title']}", "{$u['full_name']} delivered" . ($mid ? ' a milestone' : ' the work') . ". Check it, then approve it or ask for changes.\n\n\"{$note}\"", $this->link($c, 'client'));
        $this->api->respond(['success' => true, 'message' => 'Delivered. The client has been told.']);
    }

    // POST /api/contracts/{id}/milestones/{mid}/approve  (client)
    public function approve_milestone($id, $mid)
    {
        $this->api->require_method('POST');
        $u = $this->as_client();
        $c = $this->contract((int) $id, $u);
        $this->only($c, $u, 'client');
        $upd = $this->db->raw("UPDATE contract_milestones SET status = 'approved', approved_at = NOW() WHERE id = ? AND contract_id = ? AND status = 'submitted'", [(int) $mid, (int) $id]);
        if ($upd->rowCount() < 1) $this->api->respond_error('Only a delivered milestone can be approved.', 409);
        $m = $this->db->raw('SELECT title, amount FROM contract_milestones WHERE id = ?', [(int) $mid])->fetch(PDO::FETCH_ASSOC);
        $this->log((int) $id, (int) $u['id'], 'milestone_approved', "{$m['title']} (" . self::peso($m['amount']) . ')');
        $this->notify((int) $c['worker_id'], "Milestone approved: {$m['title']}", "The client approved \"{$m['title']}\". Agree with them on payment of " . self::peso($m['amount']) . '.', $this->link($c, 'worker'), false);
        $this->api->respond(['success' => true]);
    }

    // POST /api/contracts/{id}/revision  { note }  (client)
    public function request_revision($id)
    {
        $this->api->require_method('POST');
        $u = $this->as_client();
        $c = $this->contract((int) $id, $u);
        $this->only($c, $u, 'client');
        if ($c['status'] !== 'delivered') $this->api->respond_error('You can ask for changes after the worker delivers.', 409);
        if ((int) $c['revisions_used'] >= (int) $c['revisions_allowed']) {
            $n = (int) $c['revisions_allowed'];
            $this->api->respond_error("You've used the " . ($n === 1 ? 'one round' : "{$n} rounds") . " of changes included in this contract. Approve the work, add a paid milestone for more changes, or open a dispute if the work doesn't match what was agreed.", 409);
        }
        $note = $this->text('note', 2000, 10, 'Say what should be changed.');
        $this->set_status($c, 'revision_requested', ['revisions_used' => (int) $c['revisions_used'] + 1]);
        $this->db->raw("UPDATE contract_milestones SET status = 'revision' WHERE contract_id = ? AND status = 'submitted'", [(int) $id]);
        $this->log((int) $id, (int) $u['id'], 'revision_requested', $note);
        $left = (int) $c['revisions_allowed'] - (int) $c['revisions_used'] - 1;
        $this->notify((int) $c['worker_id'], "Changes requested: {$c['title']}", "The client asked for changes ({$left} round" . ($left === 1 ? '' : 's') . " left):\n\n\"{$note}\"", $this->link($c, 'worker'));
        $this->api->respond(['success' => true, 'revisions_left' => $left]);
    }

    // POST /api/contracts/{id}/complete  (client approves the whole contract)
    public function complete($id)
    {
        $this->api->require_method('POST');
        $u = $this->as_client();
        $c = $this->contract((int) $id, $u);
        $this->only($c, $u, 'client');
        if ($c['status'] !== 'delivered') $this->api->respond_error('You can mark the contract complete after the worker delivers the work.', 409);
        $this->db->raw("UPDATE contract_milestones SET status = 'approved', approved_at = COALESCE(approved_at, NOW()) WHERE contract_id = ? AND status = 'submitted'", [(int) $id]);
        $this->set_status($c, 'completed', ['completed_at' => date('Y-m-d H:i:s')]);
        $this->log((int) $id, (int) $u['id'], 'completed');
        $this->notify((int) $c['worker_id'], "Contract complete: {$c['title']}", "The client approved your work. " . ($c['payment_status'] === 'unpaid' ? 'They will now pay you ' . self::peso($c['agreed_amount']) . '. ' : '') . 'Leave a review for the client when you are ready.', $this->link($c, 'worker'));
        $this->api->respond(['success' => true, 'message' => 'Contract complete. Next: pay the worker and leave a review.']);
    }

    // POST /api/contracts/{id}/paid  { method, note }  (client says they paid)
    public function mark_paid($id)
    {
        $this->api->require_method('POST');
        $u = $this->as_client();
        $c = $this->contract((int) $id, $u);
        $this->only($c, $u, 'client');
        if (in_array($c['status'], ['cancelled', 'offered'], true)) $this->api->respond_error('There is nothing to pay on this contract.', 409);
        if ($c['payment_status'] !== 'unpaid') $this->api->respond_error('You already marked this contract as paid.', 409);
        $method = (string) ($this->api->body()['method'] ?? '');
        if (!isset(self::PAY_METHODS[$method])) $this->api->respond_error('Choose how you paid.', 422);
        $note = $this->text('note', 255);
        $this->set_status($c, $c['status'], ['payment_status' => 'sent', 'payment_method' => $method, 'payment_note' => $note ?: null, 'paid_marked_at' => date('Y-m-d H:i:s')]);
        $this->log((int) $id, (int) $u['id'], 'payment_sent', self::PAY_METHODS[$method] . ' ' . self::peso($c['agreed_amount']) . ($note ? ": {$note}" : ''));
        $this->notify((int) $c['worker_id'], "Payment sent: {$c['title']}", "The client says they paid you " . self::peso($c['agreed_amount']) . ' by ' . self::PAY_METHODS[$method] . '. Please confirm once you have received it.', $this->link($c, 'worker'));
        $this->api->respond(['success' => true, 'message' => 'Thanks. We asked the worker to confirm they received it.']);
    }

    // POST /api/contracts/{id}/confirm-payment  (worker received the money)
    public function confirm_payment($id)
    {
        $this->api->require_method('POST');
        $u = $this->as_worker();
        $c = $this->contract((int) $id, $u);
        $this->only($c, $u, 'worker');
        if ($c['payment_status'] === 'confirmed') $this->api->respond_error('You already confirmed this payment.', 409);
        $this->set_status($c, $c['status'], ['payment_status' => 'confirmed', 'paid_confirmed_at' => date('Y-m-d H:i:s')]);
        $this->log((int) $id, (int) $u['id'], 'payment_confirmed', 'Payment received');
        $this->notify((int) $c['client_id'], "Payment confirmed: {$c['title']}", "{$u['full_name']} confirmed they received your payment. Thank you!", $this->link($c, 'client'), false);
        $this->api->respond(['success' => true]);
    }

    // POST /api/contracts/{id}/cancel  { reason }  (either side, before delivery)
    public function cancel($id)
    {
        $this->api->require_method('POST');
        $u = $this->me();
        $c = $this->contract((int) $id, $u);
        if ((int) $c['client_id'] !== (int) $u['id'] && (int) $c['worker_id'] !== (int) $u['id']) $this->api->respond_error('We could not find that contract.', 404);
        if (!in_array($c['status'], ['offered', 'active'], true)) {
            $this->api->respond_error('Work was already delivered, so this contract can no longer be cancelled. If something is wrong, open a dispute and our team will help.', 409);
        }
        $reason = $this->text('reason', 500, 5, 'Say briefly why you are cancelling.');
        $this->set_status($c, 'cancelled', ['cancel_reason' => $reason, 'cancelled_by' => (int) $u['id']]);
        $this->log((int) $id, (int) $u['id'], 'cancelled', $reason);
        $other = (int) $c['client_id'] === (int) $u['id'] ? (int) $c['worker_id'] : (int) $c['client_id'];
        $side = $other === (int) $c['client_id'] ? 'client' : 'worker';
        $this->notify($other, "Contract cancelled: {$c['title']}", "{$u['full_name']} cancelled the contract. Reason: {$reason}", $this->link($c, $side));
        $this->api->respond(['success' => true, 'message' => 'Contract cancelled.']);
    }

    // POST /api/contracts/{id}/dispute  { reason, details }
    public function dispute($id)
    {
        $this->api->require_method('POST');
        $u = $this->me();
        $c = $this->contract((int) $id, $u);
        if ((int) $c['client_id'] !== (int) $u['id'] && (int) $c['worker_id'] !== (int) $u['id']) $this->api->respond_error('We could not find that contract.', 404);
        if (in_array($c['status'], ['offered', 'cancelled', 'disputed'], true)) $this->api->respond_error($c['status'] === 'disputed' ? 'A dispute is already open. Our team is reviewing it.' : 'A dispute can only be opened on a started contract.', 409);
        $reason = (string) ($this->api->body()['reason'] ?? '');
        if (!isset(self::DISPUTE_REASONS[$reason])) $this->api->respond_error('Choose what went wrong.', 422);
        $details = $this->text('details', 2000, 20, 'Tell us what happened (a few sentences), so our team can help.');
        $this->db->raw("INSERT INTO disputes (contract_id, opened_by, reason, details, status, created_at) VALUES (?, ?, ?, ?, 'open', NOW())", [(int) $id, (int) $u['id'], $reason, $details]);
        $this->db->raw("UPDATE contracts SET payment_note = CONCAT_WS(' | ', payment_note, ?) WHERE id = ?", ['status before dispute: ' . $c['status'], (int) $id]);
        $this->set_status($c, 'disputed');
        $this->log((int) $id, (int) $u['id'], 'dispute_opened', self::DISPUTE_REASONS[$reason] . ": {$details}");
        $other = (int) $c['client_id'] === (int) $u['id'] ? (int) $c['worker_id'] : (int) $c['client_id'];
        $this->notify($other, "A dispute was opened: {$c['title']}", "{$u['full_name']} asked our team to review this contract (" . self::DISPUTE_REASONS[$reason] . "). We may message you for your side. Please keep all messages in hanapbuhay.",
            $this->link($c, $other === (int) $c['client_id'] ? 'client' : 'worker'));
        foreach ($this->db->table('users')->where('role', 'admin')->get_all() ?: [] as $adm) {
            $this->notify((int) $adm['id'], 'New dispute to review', "Contract \"{$c['title']}\": " . self::DISPUTE_REASONS[$reason] . '.', '/dashboard/disputes', false);
        }
        $this->api->respond(['success' => true, 'message' => 'Dispute opened. Our team will review it within 2 working days.']);
    }

    // POST /api/contracts/{id}/review  { rating, comment }
    public function review($id)
    {
        $this->api->require_method('POST');
        $u = $this->me();
        $c = $this->contract((int) $id, $u);
        if ($c['status'] !== 'completed') $this->api->respond_error('You can leave a review once the contract is complete.', 409);
        $isClient = (int) $c['client_id'] === (int) $u['id'];
        if (!$isClient && (int) $c['worker_id'] !== (int) $u['id']) $this->api->respond_error('We could not find that contract.', 404);
        $rating = (int) ($this->api->body()['rating'] ?? 0);
        if ($rating < 1 || $rating > 5) $this->api->respond_error('Choose 1 to 5 stars.', 422);
        $comment = $this->text('comment', 1000);
        $reviewee = $isClient ? (int) $c['worker_id'] : (int) $c['client_id'];
        $this->db->raw('INSERT INTO contract_reviews (contract_id, reviewer_id, reviewee_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, NOW())
                        ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment)', [(int) $id, (int) $u['id'], $reviewee, $rating, $comment ?: null]);
        $this->log((int) $id, (int) $u['id'], 'reviewed', "{$rating} star" . ($rating === 1 ? '' : 's'));
        $this->notify($reviewee, "New review: {$c['title']}", "{$u['full_name']} gave you {$rating} star" . ($rating === 1 ? '' : 's') . '.', $this->link($c, $isClient ? 'worker' : 'client'), false);
        $this->api->respond(['success' => true, 'message' => 'Thanks for your review.']);
    }

    /* ── worker service listings ───────────────────────────── */

    // GET /api/services/mine
    public function my_services()
    {
        $this->api->require_method('GET');
        $u = $this->as_worker();
        $rows = $this->db->raw("SELECT * FROM worker_services WHERE worker_id = ? AND status <> 'deleted' ORDER BY created_at DESC", [(int) $u['id']])->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $this->api->respond(['success' => true, 'services' => $rows, 'categories' => Job_model::CATEGORIES]);
    }

    // POST /api/services  |  PUT /api/services/{id}
    public function save_service($id = null)
    {
        $u = $this->as_worker();
        $b = $this->api->body();
        $title = $this->text('title', 150, 4, 'Give your service a short name, like "Aircon cleaning".');
        $price = (float) ($b['price'] ?? 0);
        if ($price < 100 || $price > 1000000) $this->api->respond_error('Enter your price in pesos (at least 100).', 422);
        $unit = in_array($b['price_unit'] ?? '', ['job', 'hour', 'day'], true) ? $b['price_unit'] : 'job';
        $cat = isset(Job_model::CATEGORIES[$b['category'] ?? '']) ? $b['category'] : 'other';
        $days = max(1, min(60, (int) ($b['delivery_days'] ?? 1)));
        $towns = array_values(array_intersect(array_keys(Job_matcher::TOWN_COORDS), array_map('trim', is_array($b['service_area'] ?? null) ? $b['service_area'] : explode(',', (string) ($b['service_area'] ?? '')))));
        $desc = $this->text('description', 2000);
        $status = ($b['status'] ?? 'active') === 'paused' ? 'paused' : 'active';
        if ($id) {
            $own = $this->db->raw('SELECT id FROM worker_services WHERE id = ? AND worker_id = ?', [(int) $id, (int) $u['id']])->fetchColumn();
            if (!$own) $this->api->respond_error('We could not find that service.', 404);
            $this->db->raw('UPDATE worker_services SET title = ?, description = ?, category = ?, price = ?, price_unit = ?, delivery_days = ?, service_area = ?, status = ?, updated_at = NOW() WHERE id = ?',
                [$title, $desc ?: null, $cat, $price, $unit, $days, implode(', ', $towns) ?: null, $status, (int) $id]);
        } else {
            $n = (int) $this->db->raw("SELECT COUNT(*) FROM worker_services WHERE worker_id = ? AND status <> 'deleted'", [(int) $u['id']])->fetchColumn();
            if ($n >= 10) $this->api->respond_error('You can list up to 10 services.', 409);
            $this->db->raw("INSERT INTO worker_services (worker_id, title, description, category, price, price_unit, delivery_days, service_area, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
                [(int) $u['id'], $title, $desc ?: null, $cat, $price, $unit, $days, implode(', ', $towns) ?: null, $status]);
        }
        $this->api->respond(['success' => true, 'message' => 'Service saved.']);
    }

    // DELETE /api/services/{id}
    public function delete_service($id)
    {
        $u = $this->as_worker();
        $this->db->raw("UPDATE worker_services SET status = 'deleted' WHERE id = ? AND worker_id = ?", [(int) $id, (int) $u['id']]);
        $this->api->respond(['success' => true]);
    }

    // GET /api/services?q=&category=&location=  (clients browse; also shown to signed-in workers)
    public function services()
    {
        $this->api->require_method('GET');
        $u = $this->me();
        $where = ["s.status = 'active'", 'w.is_active = 1']; $args = [];
        $q = trim((string) ($_GET['q'] ?? ''));
        if ($q !== '') { $where[] = '(s.title LIKE ? OR s.description LIKE ?)'; $like = '%' . addcslashes($q, '%_\\') . '%'; array_push($args, $like, $like); }
        if (isset(Job_model::CATEGORIES[$_GET['category'] ?? ''])) { $where[] = 's.category = ?'; $args[] = $_GET['category']; }
        $town = (string) ($_GET['location'] ?? '');
        if (isset(Job_matcher::TOWN_COORDS[$town])) { $where[] = '(w.location = ? OR s.service_area LIKE ?)'; array_push($args, $town, '%' . $town . '%'); }
        $rows = $this->db->raw(
            'SELECT s.*, w.full_name AS worker_name, w.picture AS worker_picture, w.location AS worker_location, w.is_verified AS worker_verified, w.avatar_color
             FROM worker_services s JOIN users w ON w.id = s.worker_id WHERE ' . implode(' AND ', $where) . ' ORDER BY w.is_verified DESC, s.created_at DESC LIMIT 60', $args
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) { $r['price'] = (float) $r['price']; $r['worker'] = $this->person((int) $r['worker_id']); }
        $this->api->respond(['success' => true, 'services' => $rows, 'categories' => Job_model::CATEGORIES, 'viewer' => $u['account_type'] ?? null]);
    }

    // POST /api/services/{id}/book  { note, due_date }  (client books a worker's service)
    public function book($id)
    {
        $this->api->require_method('POST');
        $u = $this->as_client();
        $this->require_phone($u, 'book a service');
        $s = $this->db->raw("SELECT s.*, w.full_name AS worker_name FROM worker_services s JOIN users w ON w.id = s.worker_id WHERE s.id = ? AND s.status = 'active'", [(int) $id])->fetch(PDO::FETCH_ASSOC);
        if (!$s) $this->api->respond_error('This service is not available right now.', 404);
        $note = $this->text('note', 2000, 10, 'Describe the job: what, where and when.');
        $due = (string) ($this->api->body()['due_date'] ?? '');
        $due = preg_match('/^\d{4}-\d{2}-\d{2}$/', $due) && strtotime($due) >= strtotime(date('Y-m-d')) ? $due : date('Y-m-d', time() + (int) $s['delivery_days'] * 86400);
        $this->db->raw("INSERT INTO contracts (service_id, client_id, worker_id, title, scope, agreed_amount, due_date, status, revisions_allowed, started_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 'offered', 1, NOW(), NOW())",
            [(int) $id, (int) $u['id'], (int) $s['worker_id'], $s['title'], $note, $s['price'], $due]);
        $cid = (int) $this->db->last_id();
        $this->log($cid, (int) $u['id'], 'booked', $note);
        $this->notify((int) $s['worker_id'], "New booking: {$s['title']}", "{$u['full_name']} wants to book \"{$s['title']}\" for " . self::peso($s['price']) . ", due " . date('F j, Y', strtotime($due)) . ".\n\n\"{$note}\"\n\nAccept or decline the booking.", '/dashboard/gigs/contracts/' . $cid);
        $this->api->respond(['success' => true, 'contract_id' => $cid, 'message' => "Booking sent. We'll tell you when {$s['worker_name']} accepts."], 201);
    }

    /* ── admin ─────────────────────────────────────────────── */

    private function admin(): array
    {
        $u = $this->me();
        if (($u['role'] ?? '') !== 'admin') $this->api->respond_error('Only administrators can do this.', 403);
        return $u;
    }

    // GET /api/admin/contracts?status=
    public function admin_contracts()
    {
        $this->api->require_method('GET');
        $this->admin();
        $status = (string) ($_GET['status'] ?? '');
        $where = isset(self::CONTRACT_TEXT[$status]) ? 'WHERE k.status = ?' : '';
        $rows = $this->db->raw("SELECT k.*, c.full_name AS client_name, w.full_name AS worker_name FROM contracts k JOIN users c ON c.id = k.client_id JOIN users w ON w.id = k.worker_id {$where} ORDER BY k.updated_at DESC LIMIT 300", $where ? [$status] : [])->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) $r['status_text'] = self::CONTRACT_TEXT[$r['status']] ?? $r['status'];
        $counts = [];
        foreach ($this->db->raw('SELECT status, COUNT(*) n FROM contracts GROUP BY status')->fetchAll(PDO::FETCH_ASSOC) ?: [] as $c) $counts[$c['status']] = (int) $c['n'];
        $stats = $this->db->raw("SELECT COUNT(*) proposals, SUM(status = 'hired') hired FROM proposals")->fetch(PDO::FETCH_ASSOC);
        $this->api->respond(['success' => true, 'contracts' => $rows, 'counts' => $counts,
            'proposals' => ['total' => (int) $stats['proposals'], 'hired' => (int) $stats['hired']]]);
    }

    // GET /api/admin/disputes?status=open|resolved
    public function admin_disputes()
    {
        $this->api->require_method('GET');
        $this->admin();
        $status = ($_GET['status'] ?? 'open') === 'resolved' ? 'resolved' : 'open';
        $rows = $this->db->raw(
            "SELECT d.*, k.title, k.agreed_amount, k.payment_status, k.client_id, k.worker_id, c.full_name AS client_name, w.full_name AS worker_name, o.full_name AS opened_by_name
             FROM disputes d JOIN contracts k ON k.id = d.contract_id JOIN users c ON c.id = k.client_id JOIN users w ON w.id = k.worker_id JOIN users o ON o.id = d.opened_by
             WHERE d.status = ? ORDER BY d.created_at " . ($status === 'open' ? 'ASC' : 'DESC') . ' LIMIT 200', [$status]
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) $r['reason_text'] = self::DISPUTE_REASONS[$r['reason']] ?? $r['reason'];
        $this->api->respond(['success' => true, 'disputes' => $rows]);
    }

    // PATCH /api/admin/disputes/{id}  { resolution: complete | cancel | resume, note }
    public function admin_resolve($id)
    {
        $this->api->require_method('PATCH');
        $admin = $this->admin();
        $d = $this->db->raw("SELECT * FROM disputes WHERE id = ? AND status = 'open'", [(int) $id])->fetch(PDO::FETCH_ASSOC);
        if (!$d) $this->api->respond_error('This dispute was already resolved.', 409);
        $c = $this->db->raw('SELECT * FROM contracts WHERE id = ?', [(int) $d['contract_id']])->fetch(PDO::FETCH_ASSOC);
        $res = (string) ($this->api->body()['resolution'] ?? '');
        $map = ['complete' => 'completed', 'cancel' => 'cancelled', 'resume' => 'active'];
        if (!isset($map[$res])) $this->api->respond_error('Choose how to resolve the dispute.', 422);
        $note = $this->text('note', 1000, 10, 'Explain the decision. Both people will see it.');
        $this->db->raw("UPDATE disputes SET status = 'resolved', resolution = ?, resolution_note = ?, resolved_by = ?, resolved_at = NOW() WHERE id = ?", [$res, $note, (int) $admin['id'], (int) $id]);
        $extra = $res === 'complete' ? ['completed_at' => date('Y-m-d H:i:s')] : ($res === 'cancel' ? ['cancel_reason' => 'Closed by our team after a dispute', 'cancelled_by' => (int) $admin['id']] : []);
        $this->set_status($c, $map[$res], $extra);
        $this->log((int) $c['id'], (int) $admin['id'], 'dispute_resolved', $note);
        $text = ['complete' => 'The contract is marked complete.', 'cancel' => 'The contract is cancelled.', 'resume' => 'The contract continues.'][$res];
        foreach (['client' => (int) $c['client_id'], 'worker' => (int) $c['worker_id']] as $side => $uid) {
            $this->notify($uid, "Dispute resolved: {$c['title']}", "Our team reviewed the dispute. {$text}\n\nDecision: {$note}", $this->link($c, $side));
        }
        $this->api->respond(['success' => true]);
    }
}
