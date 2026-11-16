<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * Service Model
 * ------------------------------------------------------------------
 * A worker's service listing a client can book directly ("Aircon cleaning, from ₱600"):
 * worker_services, with up to three packages stored as JSON (migration 022).
 * A removed service is kept with status "deleted", so past bookings still point at it.
 */
class Service_model extends Model
{
    protected $table = 'worker_services';
    protected $primary_key = 'id';
    protected $fillable = ['worker_id', 'title', 'description', 'category', 'price', 'price_unit', 'delivery_days',
                           'service_area', 'status', 'packages', 'requirements', 'revisions', 'views', 'created_at', 'updated_at'];

    public const MAX_PER_WORKER = 10;

    /** One service (not deleted), optionally only if it belongs to this worker. */
    public function find_service(int $id, ?int $workerId = null)
    {
        $q = $this->db->table($this->table)->where('id', $id)->where('status', '<>', 'deleted');
        if ($workerId !== null) $q->where('worker_id', $workerId);
        return $q->get() ?: null;
    }

    /** One service with the worker's name and account state. */
    public function find_with_worker(int $id)
    {
        return $this->db->table($this->table . ' s')
            ->select('s.*, w.full_name AS worker_name, w.is_active AS worker_active')
            ->join('users w', 'w.id = s.worker_id')
            ->where('s.id', $id)->where('s.status', '<>', 'deleted')
            ->get() ?: null;
    }

    public function for_worker(int $workerId, bool $activeOnly = false, int $exceptId = 0, int $limit = 50): array
    {
        $q = $this->db->table($this->table)->where('worker_id', $workerId);
        $activeOnly ? $q->where('status', 'active') : $q->where('status', '<>', 'deleted');
        if ($exceptId) $q->where('id', '<>', $exceptId);
        return $q->order_by('created_at', 'DESC')->limit($limit)->get_all() ?: [];
    }

    public function count_for_worker(int $workerId): int
    {
        return count($this->db->table($this->table)->select('id')
            ->where('worker_id', $workerId)->where('status', '<>', 'deleted')->get_all() ?: []);
    }

    /**
     * Bookable services for Find Talent. Filters: q (title or description), category,
     * town (the worker's town or a town they serve), worker, max_price.
     */
    public function search(array $f): array
    {
        $q = $this->db->table($this->table . ' s')
            ->select('s.*, w.full_name AS worker_name, w.picture AS worker_picture, w.location AS worker_location, w.is_verified AS worker_verified, w.avatar_color')
            ->join('users w', 'w.id = s.worker_id')
            ->where('s.status', 'active')->where('w.is_active', 1);
        if (($f['q'] ?? '') !== '') {
            $like = '%' . addcslashes($f['q'], '%_\\') . '%';
            $q->grouped(fn($g) => $g->like('s.title', $like)->or_like('s.description', $like));
        }
        if (!empty($f['category'])) $q->where('s.category', $f['category']);
        if (!empty($f['town'])) {
            $town = $f['town'];
            $q->grouped(fn($g) => $g->where('w.location', $town)->or_like('s.service_area', '%' . $town . '%'));
        }
        if (!empty($f['worker'])) $q->where('s.worker_id', (int) $f['worker']);
        if (!empty($f['max_price'])) $q->where('s.price', '<=', (float) $f['max_price']);
        return $q->order_by('w.is_verified DESC, s.created_at DESC')->limit(60)->get_all() ?: [];
    }

    public function create(array $data): int
    {
        $data['created_at'] = date('Y-m-d H:i:s');
        $this->db->table($this->table)->insert($data);
        return (int) $this->db->last_id();
    }

    public function update_service(int $id, array $data): void
    {
        $data['updated_at'] = date('Y-m-d H:i:s');
        $this->db->table($this->table)->where('id', $id)->update($data);
    }

    /** Soft delete: the listing disappears, past bookings keep their link to it. */
    public function remove(int $id, int $workerId): void
    {
        $this->db->table($this->table)->where('id', $id)->where('worker_id', $workerId)->update(['status' => 'deleted']);
    }

    public function add_view(int $id): void
    {
        $this->db->table($this->table)->where('id', $id)->increment('views', 1);
    }
}
