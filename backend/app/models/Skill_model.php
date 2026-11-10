<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * Skill Model
 * ------------------------------------------------------------------
 * Manages worker skills passport records, certifications, and
 * vocational/TESDA training courses in Oriental Mindoro.
 */
class Skill_model extends Model
{
    protected $table = 'skills_passport';
    protected $primary_key = 'id';
    protected $fillable = [
        'user_id', 'skill_name', 'category', 'level',
        'source', 'certificate', 'verified', 'created_at'
    ];

    public function get_user_skills(int $user_id): array
    {
        $rows = $this->db->table($this->table)
            ->where('user_id', $user_id)
            ->order_by('created_at DESC')
            ->get_all();

        return $rows ?: [];
    }

    public function find_skill(int $id)
    {
        return $this->db->table($this->table)->where('id', $id)->get();
    }

    public function add_skill(array $data): ?array
    {
        $data['created_at'] = date('Y-m-d H:i:s');
        $this->db->table($this->table)->insert($data);
        $id = $this->db->last_id();
        return $id ? $this->find_skill((int) $id) : null;
    }

    public function update_skill(int $id, array $data): bool
    {
        return (bool) $this->db->table($this->table)->where('id', $id)->update($data);
    }

    public function delete_skill(int $id): bool
    {
        return (bool) $this->db->table($this->table)->where('id', $id)->delete();
    }

    public function get_active_training_courses(string $location = '', string $category = '', int $limit = 20): array
    {
        $db = $this->db->table('training_courses')->where('status', 'active');

        if ($location !== '') {
            $db->where('location', $location);
        }

        if ($category !== '') {
            $db->like('category', $category);
        }

        $rows = $db->order_by('is_free DESC, created_at DESC')->limit($limit)->get_all();
        return $rows ?: [];
    }
}
