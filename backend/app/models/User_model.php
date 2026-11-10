<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * User Model
 * ------------------------------------------------------------------
 * Handles user persistence, authentication records, and administrative
 * user queries using LavaLust's Query Builder and Model methods.
 */
class User_model extends Model
{
    protected $table = 'users';
    protected $primary_key = 'id';
    protected $fillable = [
        'username', 'full_name', 'email', 'password', 'role',
        'account_type', 'location', 'phone', 'bio', 'picture',
        'google_sub', 'is_active', 'is_verified', 'subscription_tier',
        'subscription_status', 'subscription_expires_at', 'contact_credits',
        'featured_credits', 'notification_prefs', 'created_at', 'updated_at'
    ];

    public function find_by_id(int $id)
    {
        return $this->db->table($this->table)->where('id', $id)->get();
    }

    public function find_by(string $column, $value)
    {
        return $this->db->table($this->table)->where($column, $value)->get();
    }

    public function create_user(array $data): ?array
    {
        $this->db->table($this->table)->insert($data);
        $id = $this->db->last_id();
        return $id ? $this->find_by_id((int) $id) : null;
    }

    public function update_user(int $id, array $data): bool
    {
        $data['updated_at'] = date('Y-m-d H:i:s');
        return (bool) $this->db->table($this->table)->where('id', $id)->update($data);
    }

    public function toggle_status(int $id): ?int
    {
        $user = $this->find_by_id($id);
        if (!$user) {
            return null;
        }
        $newStatus = (int) $user['is_active'] === 1 ? 0 : 1;
        $this->update_user($id, ['is_active' => $newStatus]);
        return $newStatus;
    }

    public function search_users(string $query = '', string $role = '', int $limit = 100, string $status = ''): array
    {
        $db = $this->db->table($this->table)
            ->select('id, full_name, email, role, account_type, location, phone, bio, picture, is_active, is_verified, subscription_tier, subscription_status, subscription_expires_at, contact_credits, featured_credits, created_at, updated_at');

        if ($query !== '') {
            $db->group_start()
               ->like('full_name', $query)
               ->or_like('email', $query)
               ->or_like('location', $query)
               ->group_end();
        }

        if ($role !== '' && $role !== 'all') {
            $db->where('role', $role);
        }

        if ($status === 'active') {
            $db->where('is_active', 1);
        } elseif ($status === 'inactive') {
            $db->where('is_active', 0);
        }

        $rows = $db->order_by('created_at DESC')->limit($limit)->get_all();
        return $rows ?: [];
    }

    public function count_users(): int
    {
        return (int) $this->db->table($this->table)->count_all_results();
    }

    public function count_by_role(): array
    {
        $rows = $this->db->raw(
            'SELECT role, COUNT(*) as count FROM users GROUP BY role'
        );
        return $rows ?: [];
    }

    public function count_active_users(): int
    {
        return (int) $this->db->table($this->table)->where('is_active', 1)->count_all_results();
    }

    public function count_inactive_users(): int
    {
        return (int) $this->db->table($this->table)->where('is_active', 0)->count_all_results();
    }

    public function registrations_last_30_days(): array
    {
        $rows = $this->db->raw(
            "SELECT DATE(created_at) as reg_date, COUNT(*) as count
             FROM users
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             GROUP BY DATE(created_at)
             ORDER BY reg_date ASC"
        );
        return $rows ?: [];
    }

    public function count_by_location(): array
    {
        $rows = $this->db->raw(
            "SELECT location, COUNT(*) as count
             FROM users
             WHERE location IS NOT NULL AND location != ''
             GROUP BY location
             ORDER BY count DESC
             LIMIT 10"
        );
        return $rows ?: [];
    }

    public function recent_users(int $limit = 10): array
    {
        $rows = $this->db->table($this->table)
            ->select('id, full_name, email, role, account_type, location, is_active, is_verified, picture, created_at')
            ->order_by('created_at DESC')
            ->limit($limit)
            ->get_all();
        return $rows ?: [];
    }

    public function get_user_detail(int $id): ?array
    {
        return $this->db->table($this->table)
            ->select('id, full_name, email, role, account_type, location, phone, bio, picture, is_active, is_verified, subscription_tier, subscription_status, subscription_expires_at, contact_credits, featured_credits, created_at, updated_at')
            ->where('id', $id)
            ->get();
    }

    public function set_verified(int $id, int $verified): bool
    {
        return $this->update_user($id, ['is_verified' => $verified ? 1 : 0]);
    }
}
