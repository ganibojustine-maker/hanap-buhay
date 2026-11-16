<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * Proposal Model
 * ------------------------------------------------------------------
 * A worker's price and plan for a client's gig (proposals), the work photos attached to
 * it as proof (work_samples ids), and a client's invitation to send one (gig_invites).
 *
 * Status: submitted | shortlisted | declined | withdrawn | hired | not_selected
 */
class Proposal_model extends Model
{
    protected $table = 'proposals';
    protected $primary_key = 'id';
    protected $fillable = ['gig_id', 'worker_id', 'client_id', 'bid_amount', 'delivery_days', 'cover_letter', 'match_score',
                           'status', 'client_note', 'work_ids', 'available_from', 'created_at', 'updated_at'];

    public const OPEN = ['submitted', 'shortlisted'];

    public function find_proposal(int $id, array $owner = [])
    {
        $q = $this->db->table($this->table)->where('id', $id);
        foreach ($owner as $col => $val) $q->where($col, $val);
        return $q->get() ?: null;
    }

    /** The worker's proposal for a gig, in any status. */
    public function for_gig_and_worker(int $gigId, int $workerId)
    {
        return $this->db->table($this->table)->where('gig_id', $gigId)->where('worker_id', $workerId)->get() ?: null;
    }

    public function has_active(int $gigId, int $workerId): bool
    {
        return (bool) $this->db->table($this->table)->select('id')
            ->where('gig_id', $gigId)->where('worker_id', $workerId)->where('status', '<>', 'withdrawn')->get();
    }

    public function create(array $data): int
    {
        $data += ['status' => 'submitted', 'created_at' => date('Y-m-d H:i:s')];
        $this->db->table($this->table)->insert($data);
        return (int) $this->db->last_id();
    }

    public function update_proposal(int $id, array $data): int
    {
        $data['updated_at'] = date('Y-m-d H:i:s');
        return (int) $this->db->table($this->table)->where('id', $id)->update($data);
    }

    /** Move a proposal on only if it is still open, so two clicks can never hire twice. Returns rows changed. */
    public function claim(int $id, string $to): int
    {
        return (int) $this->db->table($this->table)->where('id', $id)->in('status', self::OPEN)
            ->update(['status' => $to, 'updated_at' => date('Y-m-d H:i:s')]);
    }

    /** The open proposals left on a gig (told kindly when the gig is filled). */
    public function open_for_gig(int $gigId): array
    {
        return $this->db->table($this->table)->select('id, worker_id')
            ->where('gig_id', $gigId)->in('status', self::OPEN)->get_all() ?: [];
    }

    /** A worker's proposals, with the gig, the client and the contract it became. */
    public function for_worker(int $workerId): array
    {
        return $this->db->table($this->table . ' p')
            ->select('p.*, j.title AS gig_title, j.location AS gig_location, j.salary_min, j.salary_max, j.status AS gig_status, c.full_name AS client_name, c.is_verified AS client_verified, k.id AS contract_id')
            ->join('jobs j', 'j.id = p.gig_id')
            ->join('users c', 'c.id = p.client_id')
            ->left_join('contracts k', 'k.proposal_id = p.id')
            ->where('p.worker_id', $workerId)
            ->order_by('p.updated_at DESC, p.created_at DESC')->get_all() ?: [];
    }

    /** Proposals a client received (all gigs, or one), open ones first and best match first. */
    public function for_client(int $clientId, ?int $gigId = null): array
    {
        $sql = "SELECT p.*, j.title AS gig_title, j.salary_min, j.salary_max, w.full_name AS worker_name, w.picture AS worker_picture,
                       w.location AS worker_location, w.is_verified AS worker_verified, w.avatar_color, k.id AS contract_id
                FROM proposals p JOIN jobs j ON j.id = p.gig_id JOIN users w ON w.id = p.worker_id LEFT JOIN contracts k ON k.proposal_id = p.id
                WHERE p.client_id = ? AND p.status <> 'withdrawn'" . ($gigId ? ' AND p.gig_id = ?' : '') . "
                ORDER BY FIELD(p.status, 'submitted', 'shortlisted', 'hired', 'declined', 'not_selected'), p.match_score DESC, p.created_at DESC";
        return $this->db->raw($sql, $gigId ? [$clientId, $gigId] : [$clientId])->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /** One proposal with its gig title, only if it was sent to this client. */
    public function for_client_with_gig(int $id, int $clientId)
    {
        return $this->db->table($this->table . ' p')->select('p.*, j.title')
            ->join('jobs j', 'j.id = p.gig_id')
            ->where('p.id', $id)->where('p.client_id', $clientId)->get() ?: null;
    }

    /** A client's gigs with how many proposals each one has. */
    public function client_gigs(int $clientId): array
    {
        return $this->db->raw(
            "SELECT j.*,
               (SELECT COUNT(*) FROM proposals p WHERE p.gig_id = j.id AND p.status <> 'withdrawn') AS proposals,
               (SELECT COUNT(*) FROM proposals p WHERE p.gig_id = j.id AND p.status = 'submitted') AS new_proposals,
               (SELECT COUNT(*) FROM contracts k WHERE k.gig_id = j.id) AS contracts
             FROM jobs j WHERE j.employer_id = ? AND j.status <> 'archived' ORDER BY j.created_at DESC", [$clientId]
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function counts(): array
    {
        $rows = $this->db->table($this->table)->select('status')->get_all() ?: [];
        return ['total' => count($rows), 'hired' => count(array_filter($rows, fn($r) => $r['status'] === 'hired'))];
    }

    /* ── work photos attached to a proposal ────────────────── */

    /** Keep only the work photo ids that belong to this worker (up to 4). */
    public function own_work_ids(int $workerId, array $ids): array
    {
        $ids = array_slice(array_values(array_unique(array_filter(array_map('intval', $ids)))), 0, 4);
        if (!$ids) return [];
        $rows = $this->db->table('work_samples')->select('id')->where('user_id', $workerId)->in('id', $ids)->get_all() ?: [];
        return array_map(fn($r) => (int) $r['id'], $rows);
    }

    /** [{id, title, url}] of the work photos attached to a proposal. */
    public function work_for(array $proposal): array
    {
        $ids = array_values(array_filter(array_map('intval', explode(',', (string) ($proposal['work_ids'] ?? '')))));
        if (!$ids) return [];
        $rows = $this->db->table('work_samples')->select('id, title')
            ->where('user_id', (int) $proposal['worker_id'])->in('id', $ids)->get_all() ?: [];
        return array_map(fn($w) => ['id' => (int) $w['id'], 'title' => $w['title'], 'url' => '/api/portfolio/' . (int) $w['id'] . '/file'], $rows);
    }

    /* ── invitations ───────────────────────────────────────── */

    public function invited(int $gigId, int $workerId): bool
    {
        return (bool) $this->db->table('gig_invites')->select('id')->where('gig_id', $gigId)->where('worker_id', $workerId)->get();
    }

    public function invite(int $gigId, int $clientId, int $workerId, ?string $message): void
    {
        $this->db->table('gig_invites')->insert([
            'gig_id' => $gigId, 'client_id' => $clientId, 'worker_id' => $workerId,
            'message' => $message, 'created_at' => date('Y-m-d H:i:s'),
        ]);
    }

    /** The open gigs a worker was invited to, and whether they already sent a proposal. */
    public function invites_for(int $workerId): array
    {
        return $this->db->raw(
            "SELECT i.id, i.gig_id, i.message, i.created_at, j.title, j.location, j.barangay, j.salary_min, j.salary_max, j.pay_basis, j.needed_by, j.image_v, j.category,
                    c.id AS client_id, c.full_name AS client_name, c.is_verified AS client_verified,
                    (SELECT p.status FROM proposals p WHERE p.gig_id = i.gig_id AND p.worker_id = i.worker_id AND p.status <> 'withdrawn' LIMIT 1) AS proposal_status
             FROM gig_invites i JOIN jobs j ON j.id = i.gig_id JOIN users c ON c.id = i.client_id
             WHERE i.worker_id = ? AND j.status = 'active' ORDER BY i.created_at DESC LIMIT 20", [$workerId]
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }
}
