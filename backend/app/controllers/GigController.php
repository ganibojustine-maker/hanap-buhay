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
 * This controller checks who is asking and what they sent; the data lives in
 * Proposal_model, Contract_model, Service_model and Photo_model.
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
        $this->call->library('job_matcher');
        $this->call->model('User_model', 'user_model');
        $this->call->model('Job_model', 'job_model');
        $this->call->model('Skill_model', 'skill_model');
        $this->call->model('Application_model', 'application_model');
        $this->call->model('Proposal_model', 'proposal_model');
        $this->call->model('Contract_model', 'contract_model');
        $this->call->model('Service_model', 'service_model');
        $this->call->model('Photo_model', 'photo_model');
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

    private function admin(): array
    {
        $u = $this->me();
        if (($u['role'] ?? '') !== 'admin') $this->api->respond_error('Only administrators can do this.', 403);
        return $u;
    }

    /** A text field from the request, trimmed and cut to $max characters; at least $min long. */
    private function text(string $key, int $max, int $min = 0, string $msg = ''): string
    {
        $v = mb_substr(trim((string) ($this->api->body()[$key] ?? '')), 0, $max);
        if (mb_strlen($v) < $min) $this->api->respond_error($msg ?: 'Please fill in this field.', 422);
        return $v;
    }

    /** A YYYY-MM-DD date from the request that is today or later, or null. */
    private function future_date(string $key): ?string
    {
        $d = (string) ($this->api->body()[$key] ?? '');
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) && strtotime($d) >= strtotime(date('Y-m-d')) ? $d : null;
    }

    private static function peso($n): string
    {
        return "\u{20B1}" . number_format((float) $n, 2);
    }

    private function notify(int $uid, string $title, string $body, string $link, bool $email = true): void
    {
        $this->application_model->create_notification($uid, 'gig', $title, $body, $link, $email);
    }

    private function gig(int $id): array
    {
        $g = $this->job_model->find_by_id($id);
        if (!$g || ($g['post_type'] ?? 'job') !== 'gig' || $g['status'] === 'archived') $this->api->respond_error('We could not find that gig.', 404);
        return $g;
    }

    /** A contract the signed-in person is part of (or any contract, for an admin). */
    private function contract(int $id, array $u): array
    {
        $c = $this->contract_model->find_contract($id);
        $isAdmin = ($u['role'] ?? '') === 'admin';
        if (!$c || (!$isAdmin && (int) $c['client_id'] !== (int) $u['id'] && (int) $c['worker_id'] !== (int) $u['id'])) {
            $this->api->respond_error('We could not find that contract.', 404);
        }
        return $c;
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

    private function require_phone(array $u, string $what): void
    {
        if ($this->schema_info->has_column('users', 'phone_verified_at') && empty($u['phone_verified_at'])) {
            $this->api->respond_error("To keep gigs safe from scams, confirm your mobile number before you {$what}. Open Verification to do it in a minute.", 422);
        }
    }

    /** Optional delivery file (photo or PDF, up to 5 MB). The real content is checked, not the name. */
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

    /* ── worker: proposals ─────────────────────────────────── */

    // POST /api/gigs/{id}/proposals  { bid_amount, delivery_days, cover_letter, work_ids, available_from }
    public function propose($id)
    {
        $this->api->require_method('POST');
        $u = $this->as_worker();
        $this->api->rate_limit('proposal_' . (int) $u['id'], 30, 3600);
        $g = $this->gig((int) $id);
        if ($g['status'] !== 'active') $this->api->respond_error('This gig is no longer taking proposals.', 409);
        $skills = $this->skill_model->get_skills_for_matching((int) $u['id']);
        $missing = $this->job_matcher->missing_profile($u, $skills);
        if ($missing) {
            $this->api->respond(['success' => false, 'code' => 'profile_incomplete', 'missing' => $missing,
                'error' => 'Please complete your profile before sending proposals: ' . implode(', ', array_column($missing, 'label')) . '.'], 422);
        }
        $this->require_phone($u, 'send proposals');

        $b = $this->api->body();
        $bid = (float) ($b['bid_amount'] ?? 0);
        if ($bid < 100 || $bid > 1000000) $this->api->respond_error('Enter your price in pesos (at least 100).', 422);
        $days = (int) ($b['delivery_days'] ?? 0);
        if ($days < 1 || $days > 365) $this->api->respond_error('Enter how many days you need (1 to 365).', 422);
        $cover = $this->text('cover_letter', 2000, 30, 'Tell the client how you will do the work (at least a few sentences).');
        $work = $this->proposal_model->own_work_ids((int) $u['id'], (array) ($b['work_ids'] ?? []));

        $existing = $this->proposal_model->for_gig_and_worker((int) $id, (int) $u['id']);
        if ($existing && $existing['status'] !== 'withdrawn') $this->api->respond_error('You already sent a proposal for this gig.', 409);
        $score = $this->job_matcher->score($u, $skills, $g)['score'];
        $data = ['bid_amount' => $bid, 'delivery_days' => $days, 'cover_letter' => $cover, 'match_score' => $score,
                 'work_ids' => $work ? implode(',', $work) : null, 'available_from' => $this->future_date('available_from')];
        if ($existing) {
            // sending again after withdrawing: the same row starts over
            $pid = (int) $existing['id'];
            $this->proposal_model->update_proposal($pid, $data + ['status' => 'submitted', 'client_note' => null, 'created_at' => date('Y-m-d H:i:s')]);
        } else {
            $pid = $this->proposal_model->create($data + ['gig_id' => (int) $id, 'worker_id' => (int) $u['id'], 'client_id' => (int) $g['employer_id']]);
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
        $rows = $this->proposal_model->for_worker((int) $u['id']);
        foreach ($rows as &$r) $r['status_text'] = self::PROPOSAL_TEXT[$r['status']] ?? $r['status'];
        unset($r);
        $this->api->respond(['success' => true, 'proposals' => $rows]);
    }

    // POST /api/proposals/{id}/withdraw
    public function withdraw($id)
    {
        $this->api->require_method('POST');
        $u = $this->as_worker();
        $p = $this->proposal_model->find_proposal((int) $id, ['worker_id' => (int) $u['id']]);
        if (!$p) $this->api->respond_error('We could not find that proposal.', 404);
        if ($this->proposal_model->claim((int) $id, 'withdrawn') < 1) $this->api->respond_error('This proposal can no longer be withdrawn.', 409);
        $this->api->respond(['success' => true, 'message' => 'Proposal withdrawn.']);
    }

    /* ── client: gigs and proposals ────────────────────────── */

    // GET /api/gigs/mine
    public function my_gigs()
    {
        $this->api->require_method('GET');
        $u = $this->as_client();
        $this->job_model->close_expired();
        $rows = $this->proposal_model->client_gigs((int) $u['id']);
        foreach ($rows as &$r) foreach (['proposals', 'new_proposals', 'contracts', 'views'] as $k) $r[$k] = (int) ($r[$k] ?? 0);
        unset($r);
        $this->api->respond(['success' => true, 'gigs' => $rows]);
    }

    // GET /api/gigs/{id}/proposals  (also /api/proposals/received for every gig)
    public function gig_proposals($id = null)
    {
        $this->api->require_method('GET');
        $u = $this->as_client();
        if ($id) {
            $g = $this->gig((int) $id);
            if ((int) $g['employer_id'] !== (int) $u['id']) $this->api->respond_error('We could not find that gig.', 404);
        }
        $rows = $this->proposal_model->for_client((int) $u['id'], $id ? (int) $id : null);
        foreach ($rows as &$r) {
            $r['worker'] = $this->contract_model->person((int) $r['worker_id']);
            $r['bid_amount'] = (float) $r['bid_amount'];
            $r['match_score'] = (int) $r['match_score'];
            $r['work'] = $this->proposal_model->work_for($r);
        }
        unset($r);
        $this->api->respond(['success' => true, 'proposals' => $rows]);
    }

    // PATCH /api/proposals/{id}  { action: shortlist | decline, note }
    public function decide($id)
    {
        $this->api->require_method('PATCH');
        $u = $this->as_client();
        $p = $this->proposal_model->for_client_with_gig((int) $id, (int) $u['id']);
        if (!$p) $this->api->respond_error('We could not find that proposal.', 404);
        $action = (string) ($this->api->body()['action'] ?? '');
        if (!in_array($action, ['shortlist', 'decline'], true)) $this->api->respond_error('Choose shortlist or decline.', 422);
        if (!in_array($p['status'], Proposal_model::OPEN, true)) $this->api->respond_error('This proposal was already decided.', 409);
        $to = $action === 'shortlist' ? 'shortlisted' : 'declined';
        $note = $this->text('note', 500);
        $this->proposal_model->update_proposal((int) $id, ['status' => $to, 'client_note' => $note ?: null]);
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

    // POST /api/proposals/{id}/hire  { agreed_amount?, due_date?, scope?, revisions_allowed?, milestones? }
    public function hire($id)
    {
        $this->api->require_method('POST');
        $u = $this->as_client();
        $this->require_phone($u, 'hire');
        $p = $this->proposal_model->find_proposal((int) $id, ['client_id' => (int) $u['id']]);
        if (!$p) $this->api->respond_error('We could not find that proposal.', 404);
        if (!in_array($p['status'], Proposal_model::OPEN, true)) $this->api->respond_error('This proposal can no longer be accepted.', 409);
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

        // only one request can move the proposal to "hired"
        if ($this->proposal_model->claim((int) $id, 'hired') < 1) $this->api->respond_error('This proposal was already accepted.', 409);
        $cid = $this->contract_model->create([
            'gig_id' => (int) $g['id'], 'proposal_id' => (int) $id, 'client_id' => (int) $u['id'], 'worker_id' => (int) $p['worker_id'],
            'title' => $g['title'], 'scope' => $scope, 'agreed_amount' => $amount, 'due_date' => $due, 'status' => 'active', 'revisions_allowed' => $rev,
        ]);
        $this->contract_model->add_milestones($cid, $ms);
        $this->contract_model->log($cid, (int) $u['id'], 'started', 'Contract started for ' . self::peso($amount) . ', due ' . date('F j, Y', strtotime($due)));

        // a gig with one opening closes; the other proposals are told kindly
        if ($this->contract_model->count_for_gig((int) $g['id']) >= max(1, (int) ($g['openings'] ?? 1))) {
            $this->job_model->update_job((int) $g['id'], ['status' => 'closed']);
            foreach ($this->proposal_model->open_for_gig((int) $g['id']) as $o) {
                $this->proposal_model->update_proposal((int) $o['id'], ['status' => 'not_selected']);
                $this->notify((int) $o['worker_id'], "Gig filled: {$g['title']}", "The client hired another worker for \"{$g['title']}\". Thank you for your proposal. New gigs are posted every day.", '/dashboard/gigs', false);
            }
        }
        $this->notify((int) $p['worker_id'], "You're hired: {$g['title']}",
            "{$u['full_name']} accepted your proposal. Agreed price: " . self::peso($amount) . ". Due: " . date('F j, Y', strtotime($due)) . ".\n\nOpen the contract to see the details and milestones, and message the client to agree on the start.",
            '/dashboard/gigs/contracts/' . $cid);
        $this->api->respond(['success' => true, 'contract_id' => $cid, 'message' => 'Contract started. The worker has been told.'], 201);
    }

    /* ── contracts ─────────────────────────────────────────── */

    // GET /api/contracts
    public function contracts()
    {
        $this->api->require_method('GET');
        $u = $this->me();
        $rows = $this->contract_model->for_user((int) $u['id'], ($u['account_type'] ?? '') === 'hirer' ? 'client' : 'worker');
        foreach ($rows as &$r) $r['status_text'] = self::CONTRACT_TEXT[$r['status']] ?? $r['status'];
        unset($r);
        $this->api->respond(['success' => true, 'contracts' => $rows]);
    }

    // GET /api/contracts/{id}
    public function contract_detail($id)
    {
        $this->api->require_method('GET');
        $u = $this->me();
        $c = $this->contract((int) $id, $u);
        $dispute = $this->contract_model->latest_dispute((int) $id);
        if ($dispute) $dispute['reason_text'] = self::DISPUTE_REASONS[$dispute['reason']] ?? $dispute['reason'];
        $reviews = $this->contract_model->reviews((int) $id);
        $role = (int) $c['client_id'] === (int) $u['id'] ? 'client' : ((int) $c['worker_id'] === (int) $u['id'] ? 'worker' : 'admin');
        $mine = array_values(array_filter($reviews, fn($r) => (int) $r['reviewer_id'] === (int) $u['id']));
        $c['status_text'] = self::CONTRACT_TEXT[$c['status']] ?? $c['status'];
        $c['agreed_amount'] = (float) $c['agreed_amount'];
        $this->api->respond([
            'success' => true, 'contract' => $c, 'role' => $role,
            'client' => $this->contract_model->person((int) $c['client_id']), 'worker' => $this->contract_model->person((int) $c['worker_id']),
            'milestones' => $this->contract_model->milestones((int) $id), 'events' => $this->contract_model->events((int) $id),
            'dispute' => $dispute, 'reviews' => $reviews, 'my_review' => $mine[0] ?? null,
            'pay_methods' => self::PAY_METHODS, 'dispute_reasons' => self::DISPUTE_REASONS,
        ]);
    }

    // GET /api/contracts/{id}/files/{eventId}
    public function event_file($id, $eventId)
    {
        $this->api->require_method('GET');
        $u = $this->me();
        $this->contract((int) $id, $u);
        $e = $this->contract_model->event_file((int) $eventId, (int) $id);
        if (!$e || !$e['file_data']) $this->api->respond_error('We could not find that file.', 404);
        $this->api->respond(['success' => true, 'file_name' => $e['file_name'], 'file_mime' => $e['file_mime'], 'data_url' => $e['file_data']]);
    }

    // POST /api/contracts/{id}/respond  { action: accept | decline }  (worker, for a direct service booking)
    public function respond_offer($id)
    {
        $this->api->require_method('POST');
        $u = $this->as_worker();
        $c = $this->contract((int) $id, $u);
        $this->only($c, $u, 'worker');
        if ($c['status'] !== 'offered') $this->api->respond_error('This booking was already answered.', 409);
        $accept = ($this->api->body()['action'] ?? '') === 'accept';
        if ($accept) $this->require_phone($u, 'accept bookings');
        $this->contract_model->set_status((int) $c['id'], $accept ? 'active' : 'cancelled', $accept
            ? ['started_at' => date('Y-m-d H:i:s')]
            : ['cancel_reason' => 'The worker declined the booking', 'cancelled_by' => (int) $u['id']]);
        $this->contract_model->log((int) $c['id'], (int) $u['id'], $accept ? 'accepted' : 'declined');
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
        $ms[0]['position'] = $this->contract_model->next_position((int) $id);
        $this->contract_model->add_milestones((int) $id, $ms);
        $this->contract_model->update_contract((int) $id, ['agreed_amount' => (float) $c['agreed_amount'] + $ms[0]['amount']]);
        $this->contract_model->log((int) $id, (int) $u['id'], 'milestone_added', "{$ms[0]['title']} (" . self::peso($ms[0]['amount']) . ')');
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
        $now = date('Y-m-d H:i:s');
        if ($mid) {
            $m = $this->contract_model->find_milestone($mid, (int) $id, ['pending', 'in_progress', 'revision']);
            if (!$m) $this->api->respond_error('That milestone cannot be delivered now.', 409);
            $this->contract_model->move_milestones((int) $id, $m['status'], 'submitted', $mid, ['submitted_at' => $now]);
            $this->contract_model->log((int) $id, (int) $u['id'], 'milestone_submitted', "{$m['title']}: {$note}", $file);
            if ($this->contract_model->unfinished_milestones((int) $id) === 0) $this->contract_model->set_status((int) $id, 'delivered', ['delivered_at' => $now]);
        } else {
            $this->contract_model->set_status((int) $id, 'delivered', ['delivered_at' => $now]);
            $this->contract_model->log((int) $id, (int) $u['id'], 'delivered', $note, $file);
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
        $m = $this->contract_model->find_milestone((int) $mid, (int) $id, ['submitted']);
        if (!$m || $this->contract_model->move_milestones((int) $id, 'submitted', 'approved', (int) $mid, ['approved_at' => date('Y-m-d H:i:s')]) < 1) {
            $this->api->respond_error('Only a delivered milestone can be approved.', 409);
        }
        $this->contract_model->log((int) $id, (int) $u['id'], 'milestone_approved', "{$m['title']} (" . self::peso($m['amount']) . ')');
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
        $this->contract_model->set_status((int) $id, 'revision_requested', ['revisions_used' => (int) $c['revisions_used'] + 1]);
        $this->contract_model->move_milestones((int) $id, 'submitted', 'revision');
        $this->contract_model->log((int) $id, (int) $u['id'], 'revision_requested', $note);
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
        $now = date('Y-m-d H:i:s');
        $this->contract_model->move_milestones((int) $id, 'submitted', 'approved', null, ['approved_at' => $now]);
        $this->contract_model->set_status((int) $id, 'completed', ['completed_at' => $now]);
        $this->contract_model->log((int) $id, (int) $u['id'], 'completed');
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
        $this->contract_model->update_contract((int) $id, ['payment_status' => 'sent', 'payment_method' => $method, 'payment_note' => $note ?: null, 'paid_marked_at' => date('Y-m-d H:i:s')]);
        $this->contract_model->log((int) $id, (int) $u['id'], 'payment_sent', self::PAY_METHODS[$method] . ' ' . self::peso($c['agreed_amount']) . ($note ? ": {$note}" : ''));
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
        $this->contract_model->update_contract((int) $id, ['payment_status' => 'confirmed', 'paid_confirmed_at' => date('Y-m-d H:i:s')]);
        $this->contract_model->log((int) $id, (int) $u['id'], 'payment_confirmed', 'Payment received');
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
        $this->contract_model->set_status((int) $id, 'cancelled', ['cancel_reason' => $reason, 'cancelled_by' => (int) $u['id']]);
        $this->contract_model->log((int) $id, (int) $u['id'], 'cancelled', $reason);
        $other = (int) $c['client_id'] === (int) $u['id'] ? (int) $c['worker_id'] : (int) $c['client_id'];
        $this->notify($other, "Contract cancelled: {$c['title']}", "{$u['full_name']} cancelled the contract. Reason: {$reason}", $this->link($c, $other === (int) $c['client_id'] ? 'client' : 'worker'));
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
        $this->contract_model->open_dispute((int) $id, (int) $u['id'], $reason, $details);
        // remember where the contract was, so an admin can let it continue from there
        $before = 'status before dispute: ' . $c['status'];
        $this->contract_model->set_status((int) $id, 'disputed', ['payment_note' => mb_substr(trim(($c['payment_note'] ? $c['payment_note'] . ' | ' : '') . $before), 0, 255)]);
        $this->contract_model->log((int) $id, (int) $u['id'], 'dispute_opened', self::DISPUTE_REASONS[$reason] . ": {$details}");
        $other = (int) $c['client_id'] === (int) $u['id'] ? (int) $c['worker_id'] : (int) $c['client_id'];
        $this->notify($other, "A dispute was opened: {$c['title']}", "{$u['full_name']} asked our team to review this contract (" . self::DISPUTE_REASONS[$reason] . "). We may message you for your side. Please keep all messages in hanapbuhay.",
            $this->link($c, $other === (int) $c['client_id'] ? 'client' : 'worker'));
        foreach ($this->user_model->admins() as $adm) {
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
        $this->contract_model->save_review((int) $id, (int) $u['id'], $reviewee, $rating, $comment ?: null);
        $this->contract_model->log((int) $id, (int) $u['id'], 'reviewed', "{$rating} star" . ($rating === 1 ? '' : 's'));
        $this->notify($reviewee, "New review: {$c['title']}", "{$u['full_name']} gave you {$rating} star" . ($rating === 1 ? '' : 's') . '.', $this->link($c, $isClient ? 'worker' : 'client'), false);
        $this->api->respond(['success' => true, 'message' => 'Thanks for your review.']);
    }

    /* ── invites: a client asks a worker to send a proposal ─── */

    // POST /api/gigs/{id}/invite  { worker_id, message }
    public function invite($id)
    {
        $this->api->require_method('POST');
        $u = $this->as_client();
        $this->api->rate_limit('gig_invite_' . (int) $u['id'], 60, 86400);
        $g = $this->gig((int) $id);
        if ((int) $g['employer_id'] !== (int) $u['id']) $this->api->respond_error('Choose one of your own gigs.', 422);
        if ($g['status'] !== 'active') $this->api->respond_error('That gig is not open. Reopen it before inviting workers.', 409);
        $wid = (int) ($this->api->body()['worker_id'] ?? 0);
        $w = $this->user_model->find_by_id($wid);
        if (!$w || ($w['account_type'] ?? '') !== 'worker' || (int) ($w['is_active'] ?? 1) !== 1) $this->api->respond_error('We could not find that worker.', 404);
        if ($this->proposal_model->invited((int) $id, $wid)) $this->api->respond_error('You already invited this worker to that gig.', 409);
        if ($this->proposal_model->has_active((int) $id, $wid)) $this->api->respond_error('This worker already sent a proposal for that gig.', 409);
        $msg = $this->text('message', 500) ?: null;
        $this->proposal_model->invite((int) $id, (int) $u['id'], $wid, $msg);
        $this->notify($wid, "{$u['full_name']} invited you to a gig: {$g['title']}",
            "{$u['full_name']} saw your profile and would like a proposal from you for \"{$g['title']}\"" . (!empty($g['location']) ? " in {$g['location']}" : '') . '.'
            . ($msg ? "\n\nTheir message: \"{$msg}\"" : '') . "\n\nOpen the gig to read the details and send your price.", '/dashboard/browse/' . (int) $id);
        $this->api->respond(['success' => true, 'message' => "Invitation sent. We'll tell you when {$w['full_name']} sends a proposal."]);
    }

    // GET /api/gigs/invites: the open gigs a worker was invited to
    public function my_invites()
    {
        $this->api->require_method('GET');
        $u = $this->as_worker();
        $this->api->respond(['success' => true, 'invites' => $this->proposal_model->invites_for((int) $u['id'])]);
    }

    /* ── worker service listings ───────────────────────────── */

    /** packages: [{name, price, days, includes}], up to 3, each with a price of at least 100. Cheapest first. */
    private function packages_from(array $b): array
    {
        $out = [];
        foreach (array_slice((array) ($b['packages'] ?? []), 0, 3) as $p) {
            $name = mb_substr(trim((string) ($p['name'] ?? '')), 0, 40);
            $price = (float) ($p['price'] ?? 0);
            if ($name === '' && $price <= 0) continue;
            if ($name === '' || $price < 100 || $price > 1000000) $this->api->respond_error('Each package needs a name and a price of at least 100 pesos.', 422);
            $out[] = ['name' => $name, 'price' => $price, 'days' => max(1, min(60, (int) ($p['days'] ?? 1))),
                      'includes' => mb_substr(trim((string) ($p['includes'] ?? '')), 0, 500)];
        }
        usort($out, fn($a, $c) => $a['price'] <=> $c['price']);
        return $out;
    }

    /** Decode packages and add photos, the cover and booking counts to service rows. */
    private function decorate_services(array $rows): array
    {
        if (!$rows) return $rows;
        $ids = array_map(fn($r) => (int) $r['id'], $rows);
        $photos = $this->photo_model->lists_for_services($ids);
        $stats = $this->contract_model->service_stats($ids);
        foreach ($rows as &$r) {
            $id = (int) $r['id'];
            $r['id'] = $id;
            $r['price'] = (float) $r['price'];
            $r['packages'] = json_decode((string) ($r['packages'] ?? ''), true) ?: [];
            $r['photos'] = $photos[$id] ?? [];
            $r['cover'] = $r['photos'][0]['url'] ?? null;
            $r['bookings'] = $stats[$id]['bookings'] ?? 0;
            $r['completed'] = $stats[$id]['completed'] ?? 0;
            $r['views'] = (int) ($r['views'] ?? 0);
        }
        unset($r);
        return $rows;
    }

    // GET /api/services/mine
    public function my_services()
    {
        $this->api->require_method('GET');
        $u = $this->as_worker();
        $this->api->respond(['success' => true, 'services' => $this->decorate_services($this->service_model->for_worker((int) $u['id'])), 'categories' => Job_model::CATEGORIES]);
    }

    // POST /api/services  |  PUT /api/services/{id}
    public function save_service($id = null)
    {
        $u = $this->as_worker();
        $b = $this->api->body();
        $title = $this->text('title', 150, 4, 'Give your service a short name, like "Aircon cleaning".');
        $packages = $this->packages_from($b);
        $price = $packages ? min(array_column($packages, 'price')) : (float) ($b['price'] ?? 0);
        if ($price < 100 || $price > 1000000) $this->api->respond_error('Enter your price in pesos (at least 100).', 422);
        $towns = array_values(array_intersect(array_keys(Job_matcher::TOWN_COORDS),
            array_map('trim', is_array($b['service_area'] ?? null) ? $b['service_area'] : explode(',', (string) ($b['service_area'] ?? '')))));
        $data = [
            'title'         => $title,
            'description'   => $this->text('description', 2000) ?: null,
            'category'      => isset(Job_model::CATEGORIES[$b['category'] ?? '']) ? $b['category'] : 'other',
            'price'         => $price,
            'price_unit'    => in_array($b['price_unit'] ?? '', ['job', 'hour', 'day'], true) ? $b['price_unit'] : 'job',
            'delivery_days' => $packages ? (int) $packages[0]['days'] : max(1, min(60, (int) ($b['delivery_days'] ?? 1))),
            'service_area'  => implode(', ', $towns) ?: null,
            'status'        => ($b['status'] ?? 'active') === 'paused' ? 'paused' : 'active',
            'packages'      => $packages ? json_encode($packages, JSON_UNESCAPED_UNICODE) : null,
            'requirements'  => $this->text('requirements', 1000) ?: null,
            'revisions'     => max(0, min(5, (int) ($b['revisions'] ?? 1))),
        ];
        if ($id) {
            if (!$this->service_model->find_service((int) $id, (int) $u['id'])) $this->api->respond_error('We could not find that service.', 404);
            $this->service_model->update_service((int) $id, $data);
            $sid = (int) $id;
        } else {
            if ($this->service_model->count_for_worker((int) $u['id']) >= Service_model::MAX_PER_WORKER) {
                $this->api->respond_error('You can list up to ' . Service_model::MAX_PER_WORKER . ' services.', 409);
            }
            $sid = $this->service_model->create($data + ['worker_id' => (int) $u['id']]);
        }
        $this->api->respond(['success' => true, 'id' => $sid, 'message' => 'Service saved.']);
    }

    // DELETE /api/services/{id}
    public function delete_service($id)
    {
        $this->api->require_method('DELETE');
        $u = $this->as_worker();
        $this->service_model->remove((int) $id, (int) $u['id']);
        $this->api->respond(['success' => true]);
    }

    // GET /api/services?q=&category=&location=&worker=&max_price=  (clients browse; workers see them too)
    public function services()
    {
        $this->api->require_method('GET');
        $u = $this->me();
        $town = (string) ($_GET['location'] ?? '');
        $rows = $this->decorate_services($this->service_model->search([
            'q'         => trim((string) ($_GET['q'] ?? '')),
            'category'  => isset(Job_model::CATEGORIES[$_GET['category'] ?? '']) ? $_GET['category'] : '',
            'town'      => isset(Job_matcher::TOWN_COORDS[$town]) ? $town : '',
            'worker'    => max(0, (int) ($_GET['worker'] ?? 0)),
            'max_price' => max(0, (float) ($_GET['max_price'] ?? 0)),
        ]));
        $people = [];
        foreach ($rows as &$r) { $wid = (int) $r['worker_id']; $r['worker'] = $people[$wid] ??= $this->contract_model->person($wid); }
        unset($r);
        $this->api->respond(['success' => true, 'services' => $rows, 'categories' => Job_model::CATEGORIES, 'viewer' => $u['account_type'] ?? null]);
    }

    // GET /api/services/{id}: one service with photos, packages, the worker, their reviews and other services
    public function service_detail($id)
    {
        $this->api->require_method('GET');
        $u = $this->me();
        $s = $this->service_model->find_with_worker((int) $id);
        $mine = $s && (int) $s['worker_id'] === (int) $u['id'];
        $open = $s && $s['status'] === 'active' && (int) $s['worker_active'] === 1;
        if (!$s || (!$mine && !$open && ($u['role'] ?? '') !== 'admin')) $this->api->respond_error('This service is not available right now.', 404);
        if (!$mine) $this->service_model->add_view((int) $id);
        $s = $this->decorate_services([$s])[0];
        $wid = (int) $s['worker_id'];
        $skills = array_values(array_unique(array_filter(array_map(fn($k) => (string) ($k['skill_name'] ?? ''), $this->skill_model->get_skills_for_matching($wid) ?: []))));
        $this->api->respond(['success' => true, 'service' => $s,
            'worker' => $this->contract_model->person($wid) + ['skills' => array_slice($skills, 0, 12)],
            'reviews' => $this->contract_model->reviews_of($wid, (int) $id),
            'others' => $this->decorate_services($this->service_model->for_worker($wid, true, (int) $id, 6)),
            'mine' => $mine, 'viewer' => $u['account_type'] ?? null]);
    }

    // POST /api/services/{id}/book  { note, due_date, package }  (client books a worker's service)
    public function book($id)
    {
        $this->api->require_method('POST');
        $u = $this->as_client();
        $this->require_phone($u, 'book a service');
        $s = $this->service_model->find_with_worker((int) $id);
        if (!$s || $s['status'] !== 'active') $this->api->respond_error('This service is not available right now.', 404);
        if ((int) $s['worker_id'] === (int) $u['id']) $this->api->respond_error('You cannot book your own service.', 422);
        $note = $this->text('note', 2000, 10, 'Describe the job: what, where and when.');
        // the package the client chose (Basic / Standard / Premium), or the listing's one price
        $pkgs = json_decode((string) ($s['packages'] ?? ''), true) ?: [];
        $pi = $this->api->body()['package'] ?? null;
        $pkg = ($pi !== null && $pi !== '' && isset($pkgs[(int) $pi])) ? $pkgs[(int) $pi] : null;
        $amount = $pkg ? (float) $pkg['price'] : (float) $s['price'];
        $days = $pkg ? (int) $pkg['days'] : (int) $s['delivery_days'];
        $due = $this->future_date('due_date') ?? date('Y-m-d', time() + max(1, $days) * 86400);
        $cid = $this->contract_model->create([
            'service_id' => (int) $id, 'client_id' => (int) $u['id'], 'worker_id' => (int) $s['worker_id'],
            'title' => $s['title'] . ($pkg ? " ({$pkg['name']})" : ''),
            'scope' => $note . ($pkg ? "\n\nPackage: {$pkg['name']}" . (!empty($pkg['includes']) ? " ({$pkg['includes']})" : '') : ''),
            'agreed_amount' => $amount, 'due_date' => $due, 'status' => 'offered',
            'revisions_allowed' => (int) ($s['revisions'] ?? 1), 'package_name' => $pkg['name'] ?? null,
        ]);
        $this->contract_model->log($cid, (int) $u['id'], 'booked', $note);
        $this->notify((int) $s['worker_id'], "New booking: {$s['title']}", "{$u['full_name']} wants to book \"{$s['title']}\" for " . self::peso($amount) . ", due " . date('F j, Y', strtotime($due)) . ".\n\n\"{$note}\"\n\nAccept or decline the booking.", '/dashboard/gigs/contracts/' . $cid);
        $this->api->respond(['success' => true, 'contract_id' => $cid, 'message' => "Booking sent. We'll tell you when {$s['worker_name']} accepts."], 201);
    }

    /* ── admin ─────────────────────────────────────────────── */

    // GET /api/admin/contracts?status=
    public function admin_contracts()
    {
        $this->api->require_method('GET');
        $this->admin();
        $status = (string) ($_GET['status'] ?? '');
        $rows = $this->contract_model->all_for_admin(isset(self::CONTRACT_TEXT[$status]) ? $status : null);
        foreach ($rows as &$r) $r['status_text'] = self::CONTRACT_TEXT[$r['status']] ?? $r['status'];
        unset($r);
        $this->api->respond(['success' => true, 'contracts' => $rows, 'counts' => $this->contract_model->status_counts(),
            'proposals' => $this->proposal_model->counts()]);
    }

    // GET /api/admin/disputes?status=open|resolved
    public function admin_disputes()
    {
        $this->api->require_method('GET');
        $this->admin();
        $rows = $this->contract_model->disputes(($_GET['status'] ?? 'open') === 'resolved' ? 'resolved' : 'open');
        foreach ($rows as &$r) $r['reason_text'] = self::DISPUTE_REASONS[$r['reason']] ?? $r['reason'];
        unset($r);
        $this->api->respond(['success' => true, 'disputes' => $rows]);
    }

    // PATCH /api/admin/disputes/{id}  { resolution: complete | cancel | resume, note }
    public function admin_resolve($id)
    {
        $this->api->require_method('PATCH');
        $admin = $this->admin();
        $d = $this->contract_model->find_open_dispute((int) $id);
        if (!$d) $this->api->respond_error('This dispute was already resolved.', 409);
        $c = $this->contract_model->find_contract((int) $d['contract_id']);
        $res = (string) ($this->api->body()['resolution'] ?? '');
        $map = ['complete' => 'completed', 'cancel' => 'cancelled', 'resume' => 'active'];
        if (!isset($map[$res])) $this->api->respond_error('Choose how to resolve the dispute.', 422);
        $note = $this->text('note', 1000, 10, 'Explain the decision. Both people will see it.');
        $this->contract_model->resolve_dispute((int) $id, $res, $note, (int) $admin['id']);
        $extra = $res === 'complete' ? ['completed_at' => date('Y-m-d H:i:s')]
            : ($res === 'cancel' ? ['cancel_reason' => 'Closed by our team after a dispute', 'cancelled_by' => (int) $admin['id']] : []);
        $this->contract_model->set_status((int) $c['id'], $map[$res], $extra);
        $this->contract_model->log((int) $c['id'], (int) $admin['id'], 'dispute_resolved', $note);
        $text = ['complete' => 'The contract is marked complete.', 'cancel' => 'The contract is cancelled.', 'resume' => 'The contract continues.'][$res];
        foreach (['client' => (int) $c['client_id'], 'worker' => (int) $c['worker_id']] as $side => $uid) {
            $this->notify($uid, "Dispute resolved: {$c['title']}", "Our team reviewed the dispute. {$text}\n\nDecision: {$note}", $this->link($c, $side));
        }
        $this->api->respond(['success' => true]);
    }
}
