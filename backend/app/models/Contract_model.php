<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * Contract Model
 * ------------------------------------------------------------------
 * Gig work between a client and a worker, and everything that belongs to it:
 *   contracts            the agreement (price, due date, status, payment state)
 *   contract_milestones  paid parts of the work
 *   contract_events      the timeline (every step, with an optional photo or PDF)
 *   disputes             a problem an admin decides
 *   contract_reviews     ratings both ways once the work is complete
 *
 * Status: offered | active | delivered | revision_requested | completed | cancelled | disputed
 */
class Contract_model extends Model
{
    protected $table = 'contracts';
    protected $primary_key = 'id';
    protected $fillable = ['gig_id', 'proposal_id', 'service_id', 'client_id', 'worker_id', 'title', 'scope', 'agreed_amount',
                           'due_date', 'status', 'payment_status', 'payment_method', 'payment_note', 'paid_marked_at',
                           'paid_confirmed_at', 'revisions_used', 'revisions_allowed', 'cancel_reason', 'cancelled_by',
                           'package_name', 'started_at', 'delivered_at', 'completed_at', 'updated_at'];

    private static function now(): string
    {
        return date('Y-m-d H:i:s');
    }

    /* ── contracts ─────────────────────────────────────────── */

    public function find_contract(int $id)
    {
        return $this->db->table($this->table)->where('id', $id)->get() ?: null;
    }

    public function create(array $data): int
    {
        $data += ['started_at' => self::now(), 'updated_at' => self::now()];
        $this->db->table($this->table)->insert($data);
        return (int) $this->db->last_id();
    }

    /** Change the status (and any other columns) of a contract. */
    public function set_status(int $id, string $status, array $extra = []): void
    {
        $this->db->table($this->table)->where('id', $id)
            ->update(['status' => $status, 'updated_at' => self::now()] + $extra);
    }

    public function update_contract(int $id, array $data): void
    {
        $this->db->table($this->table)->where('id', $id)->update($data + ['updated_at' => self::now()]);
    }

    public function count_for_gig(int $gigId): int
    {
        return count($this->db->table($this->table)->select('id')->where('gig_id', $gigId)->get_all() ?: []);
    }

    /** A person's contracts (as client or as worker), the ones that need action first. */
    public function for_user(int $userId, string $side): array
    {
        $col = $side === 'client' ? 'k.client_id' : 'k.worker_id';
        return $this->db->raw(
            "SELECT k.*, c.full_name AS client_name, c.is_verified AS client_verified, w.full_name AS worker_name, w.is_verified AS worker_verified, w.picture AS worker_picture,
                    (SELECT COUNT(*) FROM contract_milestones m WHERE m.contract_id = k.id) AS milestones,
                    (SELECT COUNT(*) FROM contract_milestones m WHERE m.contract_id = k.id AND m.status = 'approved') AS milestones_done
             FROM contracts k JOIN users c ON c.id = k.client_id JOIN users w ON w.id = k.worker_id
             WHERE {$col} = ? ORDER BY FIELD(k.status, 'offered', 'delivered', 'revision_requested', 'active', 'disputed', 'completed', 'cancelled'), k.updated_at DESC", [$userId]
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /** Every contract for the admin monitor, newest first. */
    public function all_for_admin(?string $status): array
    {
        $q = $this->db->table($this->table . ' k')
            ->select('k.*, c.full_name AS client_name, w.full_name AS worker_name')
            ->join('users c', 'c.id = k.client_id')->join('users w', 'w.id = k.worker_id');
        if ($status) $q->where('k.status', $status);
        return $q->order_by('k.updated_at', 'DESC')->limit(300)->get_all() ?: [];
    }

    public function status_counts(): array
    {
        $out = [];
        foreach ($this->db->table($this->table)->select('status')->get_all() ?: [] as $r) $out[$r['status']] = ($out[$r['status']] ?? 0) + 1;
        return $out;
    }

    /** Bookings and completed bookings per service: [service id => ['bookings' => n, 'completed' => n]]. */
    public function service_stats(array $serviceIds): array
    {
        $ids = array_values(array_filter(array_map('intval', $serviceIds)));
        if (!$ids) return [];
        $out = [];
        foreach ($this->db->table($this->table)->select('service_id, status')->in('service_id', $ids)->get_all() ?: [] as $r) {
            $sid = (int) $r['service_id'];
            $out[$sid]['bookings'] = ($out[$sid]['bookings'] ?? 0) + 1;
            $out[$sid]['completed'] = ($out[$sid]['completed'] ?? 0) + ($r['status'] === 'completed' ? 1 : 0);
        }
        return $out;
    }

    /** Name, photo, town, verified badge, rating and completed gigs: what both sides see of each other. */
    public function person(int $id): array
    {
        $u = $this->db->table('users')->select('id, full_name, picture, location, is_verified, account_type, avatar_color')->where('id', $id)->get() ?: [];
        if (!$u) return [];
        $ratings = $this->db->table('contract_reviews')->select('rating')->where('reviewee_id', $id)->where('is_hidden', 0)->get_all() ?: [];
        $n = count($ratings);
        $u['rating'] = ['count' => $n, 'average' => $n ? round(array_sum(array_column($ratings, 'rating')) / $n, 1) : null];
        $u['completed_gigs'] = count($this->db->table($this->table)->select('id')->where('status', 'completed')
            ->grouped(fn($g) => $g->where('worker_id', $id)->or_where('client_id', $id))->get_all() ?: []);
        return $u;
    }

    /* ── milestones ────────────────────────────────────────── */

    public function milestones(int $contractId): array
    {
        return $this->db->table('contract_milestones')->where('contract_id', $contractId)->order_by('position, id')->get_all() ?: [];
    }

    public function add_milestones(int $contractId, array $milestones): void
    {
        foreach ($milestones as $m) {
            $this->db->table('contract_milestones')->insert([
                'contract_id' => $contractId, 'title' => $m['title'], 'amount' => $m['amount'], 'due_date' => $m['due_date'],
                'status' => 'pending', 'position' => $m['position'], 'created_at' => self::now(),
            ]);
        }
    }

    public function next_position(int $contractId): int
    {
        $last = $this->db->table('contract_milestones')->select('position')->where('contract_id', $contractId)
            ->order_by('position', 'DESC')->limit(1)->get();
        return $last ? (int) $last['position'] + 1 : 0;
    }

    public function find_milestone(int $id, int $contractId, array $statuses = [])
    {
        $q = $this->db->table('contract_milestones')->where('id', $id)->where('contract_id', $contractId);
        if ($statuses) $q->in('status', $statuses);
        return $q->get() ?: null;
    }

    /** Change milestones of a contract from one status to another. Returns rows changed. */
    public function move_milestones(int $contractId, string $from, string $to, ?int $onlyId = null, array $extra = []): int
    {
        $q = $this->db->table('contract_milestones')->where('contract_id', $contractId)->where('status', $from);
        if ($onlyId) $q->where('id', $onlyId);
        return (int) $q->update(['status' => $to] + $extra);
    }

    public function unfinished_milestones(int $contractId): int
    {
        return count($this->db->table('contract_milestones')->select('id')->where('contract_id', $contractId)
            ->not_in('status', ['approved', 'submitted'])->get_all() ?: []);
    }

    /* ── timeline, disputes, reviews ───────────────────────── */

    public function log(int $contractId, ?int $actorId, string $event, ?string $note = null, ?array $file = null): void
    {
        $this->db->table('contract_events')->insert([
            'contract_id' => $contractId, 'actor_id' => $actorId, 'event' => $event, 'note' => $note,
            'file_name' => $file['name'] ?? null, 'file_mime' => $file['mime'] ?? null, 'file_data' => $file['data'] ?? null,
            'created_at' => self::now(),
        ]);
    }

    public function events(int $contractId): array
    {
        return $this->db->table('contract_events e')
            ->select('e.id, e.actor_id, e.event, e.note, e.file_name, e.file_mime, e.created_at, u.full_name AS actor_name')
            ->left_join('users u', 'u.id = e.actor_id')
            ->where('e.contract_id', $contractId)->order_by('e.created_at, e.id')->get_all() ?: [];
    }

    public function event_file(int $eventId, int $contractId)
    {
        return $this->db->table('contract_events')->select('file_name, file_mime, file_data')
            ->where('id', $eventId)->where('contract_id', $contractId)->get() ?: null;
    }

    public function latest_dispute(int $contractId)
    {
        return $this->db->table('disputes')->where('contract_id', $contractId)->order_by('id', 'DESC')->limit(1)->get() ?: null;
    }

    public function open_dispute(int $contractId, int $openedBy, string $reason, string $details): void
    {
        $this->db->table('disputes')->insert([
            'contract_id' => $contractId, 'opened_by' => $openedBy, 'reason' => $reason, 'details' => $details,
            'status' => 'open', 'created_at' => self::now(),
        ]);
    }

    public function find_open_dispute(int $id)
    {
        return $this->db->table('disputes')->where('id', $id)->where('status', 'open')->get() ?: null;
    }

    public function resolve_dispute(int $id, string $resolution, string $note, int $adminId): void
    {
        $this->db->table('disputes')->where('id', $id)->update([
            'status' => 'resolved', 'resolution' => $resolution, 'resolution_note' => $note,
            'resolved_by' => $adminId, 'resolved_at' => self::now(),
        ]);
    }

    /** Disputes for the admin page with both people and the contract. */
    public function disputes(string $status): array
    {
        return $this->db->table('disputes d')
            ->select('d.*, k.title, k.agreed_amount, k.payment_status, k.client_id, k.worker_id, c.full_name AS client_name, w.full_name AS worker_name, o.full_name AS opened_by_name')
            ->join('contracts k', 'k.id = d.contract_id')->join('users c', 'c.id = k.client_id')
            ->join('users w', 'w.id = k.worker_id')->join('users o', 'o.id = d.opened_by')
            ->where('d.status', $status)->order_by('d.created_at', $status === 'open' ? 'ASC' : 'DESC')->limit(200)->get_all() ?: [];
    }

    public function reviews(int $contractId): array
    {
        return $this->db->table('contract_reviews')->select('reviewer_id, reviewee_id, rating, comment, created_at')
            ->where('contract_id', $contractId)->get_all() ?: [];
    }

    /** One review per person per contract; leaving it again changes it. */
    public function save_review(int $contractId, int $reviewerId, int $revieweeId, int $rating, ?string $comment): void
    {
        $where = ['contract_id' => $contractId, 'reviewer_id' => $reviewerId];
        $mine = $this->db->table('contract_reviews')->select('id')->where($where)->get();
        if ($mine) {
            $this->db->table('contract_reviews')->where($where)->update(['rating' => $rating, 'comment' => $comment]);
        } else {
            $this->db->table('contract_reviews')->insert($where + ['reviewee_id' => $revieweeId, 'rating' => $rating, 'comment' => $comment, 'created_at' => self::now()]);
        }
    }

    /** Reviews a worker received, the ones from this service first. */
    public function reviews_of(int $workerId, int $serviceId = 0, int $limit = 12): array
    {
        return $this->db->raw(
            "SELECT r.rating, r.comment, r.created_at, u.full_name AS reviewer_name, k.title AS contract_title
             FROM contract_reviews r JOIN users u ON u.id = r.reviewer_id JOIN contracts k ON k.id = r.contract_id
             WHERE r.reviewee_id = ? AND r.is_hidden = 0 ORDER BY (k.service_id = ?) DESC, r.created_at DESC LIMIT " . max(1, min(50, $limit)), [$workerId, $serviceId]
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }
}
