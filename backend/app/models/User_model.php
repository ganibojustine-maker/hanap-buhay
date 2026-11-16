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

    /** Every active administrator (they are told about new disputes and reports). */
    public function admins(): array
    {
        return $this->db->table($this->table)->select('id, full_name, email')->where('role', 'admin')->where('is_active', 1)->get_all() ?: [];
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
            // this query builder has grouped(), not group_start()/group_end() (searching crashed),
            // and like() needs the % itself
            $q = '%' . addcslashes($query, '%_\\') . '%';
            $db->grouped(function ($d) use ($q) {
                $d->like('full_name', $q)
                  ->or_like('email', $q)
                  ->or_like('location', $q);
            });
        }

        // "role" here is what the admin filters by: admin is a role, the rest are account types
        if ($role === 'admin') {
            $db->where('role', 'admin');
        } elseif (in_array($role, ['worker', 'employer', 'hirer'], true)) {
            $db->where('account_type', $role);
            $db->where('role', '<>', 'admin');
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

    // raw() returns a PDOStatement, so each of these must fetch the rows
    // (returning the statement itself sent `{"queryString": …}` to the admin charts).
    public function count_by_role(): array
    {
        return $this->db->raw(
            'SELECT role, COUNT(*) as count FROM users GROUP BY role'
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /** Users per account type; admins counted as "admin", people who haven't picked a type as "none". */
    public function count_by_account_type(): array
    {
        $rows = $this->db->raw(
            "SELECT CASE WHEN role = 'admin' THEN 'admin' ELSE COALESCE(account_type, 'none') END AS type, COUNT(*) AS count
             FROM users GROUP BY type"
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $map = ['worker' => 0, 'employer' => 0, 'hirer' => 0, 'admin' => 0, 'none' => 0];
        foreach ($rows as $r) $map[$r['type']] = (int) $r['count'];
        return $map;
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
        return $this->db->raw(
            "SELECT DATE(created_at) as reg_date, COUNT(*) as count
             FROM users
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             GROUP BY DATE(created_at)
             ORDER BY reg_date ASC"
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function count_by_location(): array
    {
        return $this->db->raw(
            "SELECT location, COUNT(*) as count
             FROM users
             WHERE location IS NOT NULL AND location != ''
             GROUP BY location
             ORDER BY count DESC
             LIMIT 10"
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
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
