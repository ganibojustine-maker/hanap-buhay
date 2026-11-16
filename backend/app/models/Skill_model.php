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
        'source', 'certificate', 'certificate_id', 'verified', 'created_at'
    ];

    /** Certificate columns returned in lists (never the file itself). */
    private const CERT_COLUMNS = 'id, user_id, title, issuer, nc_level, cert_number, holder_name, issued_on, valid_until, file_name, file_mime, file_size, status, created_at';

    /** Review details added by migration 016 (only selected once those columns exist). */
    private function cert_columns(): string
    {
        static $hasReview = null;
        if ($hasReview === null) {
            $hasReview = (bool) $this->db->raw(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'skill_certificates' AND column_name = 'review_note'"
            )->fetchColumn();
        }
        return self::CERT_COLUMNS . ($hasReview ? ', review_note, reviewed_at' : '');
    }

    /** Same skill name for the same worker, ignoring case and extra spaces. */
    public function find_user_skill_by_name(int $user_id, string $name)
    {
        $norm = mb_strtolower(preg_replace('/\s+/', ' ', trim($name)));
        $rows = $this->db->table($this->table)->where('user_id', $user_id)->get_all() ?: [];
        foreach ($rows as $r) {
            if (mb_strtolower(preg_replace('/\s+/', ' ', trim((string) $r['skill_name']))) === $norm) return $r;
        }
        return null;
    }

    public function add_certificate(array $data): ?array
    {
        $data['created_at'] = date('Y-m-d H:i:s');
        $this->db->table('skill_certificates')->insert($data);
        $id = $this->db->last_id();
        return $id ? $this->find_certificate((int) $id) : null;
    }

    // (columns are worked out BEFORE table(): cert_columns() may run raw(), which resets the builder)
    public function find_certificate(int $id, bool $with_file = false)
    {
        $cols = $with_file ? '*' : $this->cert_columns();
        return $this->db->table('skill_certificates')
            ->select($cols)
            ->where('id', $id)
            ->get();
    }

    public function get_user_certificates(int $user_id): array
    {
        $cols = $this->cert_columns();
        return $this->db->table('skill_certificates')
            ->select($cols)
            ->where('user_id', $user_id)
            ->order_by('created_at DESC')
            ->get_all() ?: [];
    }

    public function delete_certificate(int $id): bool
    {
        $this->db->table($this->table)->where('certificate_id', $id)->update(['certificate_id' => null, 'certificate' => null]);
        return (bool) $this->db->table('skill_certificates')->where('id', $id)->delete();
    }

    public function get_user_skills(int $user_id): array
    {
        $rows = $this->db->table($this->table)
            ->where('user_id', $user_id)
            ->order_by('created_at DESC')
            ->get_all();

        return $rows ?: [];
    }

    /**
     * Skills with "verified" resolved for matching: verified by an admin directly, or
     * linked to a certificate an admin approved. Works before migration 015 too.
     */
    public function get_skills_for_matching(int $user_id): array
    {
        static $hasCerts = null;
        if ($hasCerts === null) {
            $hasCerts = (bool) $this->db->raw(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'skill_certificates'"
            )->fetchColumn();
        }
        $sql = $hasCerts
            ? "SELECT s.skill_name, s.level, s.source, s.certificate, s.certificate_id,
                      (s.verified = 1 OR c.status = 'verified') AS verified
               FROM skills_passport s LEFT JOIN skill_certificates c ON c.id = s.certificate_id
               WHERE s.user_id = ?"
            : 'SELECT skill_name, level, source, certificate, NULL AS certificate_id, verified FROM skills_passport WHERE user_id = ?';
        $rows = $this->db->raw($sql, [$user_id])->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) $r['verified'] = (bool) (int) $r['verified'];
        return $rows;
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

    /** Resume Builder draft (JSON) kept on the user row. */
    /** users.resume_data comes from migration 015. */
    public function resume_ready(): bool
    {
        static $ok = null;
        if ($ok === null) {
            $ok = (bool) $this->db->raw(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'resume_data'"
            )->fetchColumn();
        }
        return $ok;
    }

    public function get_resume(int $user_id): ?array
    {
        if (!$this->resume_ready()) return null;
        $row = $this->db->table('users')->select('resume_data')->where('id', $user_id)->get();
        $data = $row && !empty($row['resume_data']) ? json_decode((string) $row['resume_data'], true) : null;
        return is_array($data) ? $data : null;
    }

    public function save_resume(int $user_id, array $data): bool
    {
        if (!$this->resume_ready()) return false;
        return (bool) $this->db->table('users')->where('id', $user_id)
            ->update(['resume_data' => json_encode($data, JSON_UNESCAPED_UNICODE)]);
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
