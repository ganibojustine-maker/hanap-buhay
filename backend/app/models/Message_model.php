<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * Message Model
 * ------------------------------------------------------------------
 * Handles user-to-user messaging, chat threads, unread counters,
 * and conversation history.
 */
class Message_model extends Model
{
    protected $table = 'messages';
    protected $primary_key = 'id';
    protected $fillable = [
        'sender_id', 'receiver_id', 'job_id', 'body',
        'read_at', 'created_at'
    ];

    public function find_by_id(int $id)
    {
        return $this->db->table($this->table)->where('id', $id)->get();
    }

    public function get_threads(int $user_id): array
    {
        $rows = $this->db->raw(
            "SELECT m.*, 
                    CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END AS partner_id,
                    u.full_name AS partner_name, u.account_type AS partner_type, u.location AS partner_location, u.picture AS partner_avatar,
                    (SELECT COUNT(*) FROM messages m2 WHERE m2.receiver_id = ? AND m2.sender_id = partner_id AND m2.read_at IS NULL) AS unread
             FROM messages m
             JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
             WHERE m.id IN (
                 SELECT MAX(id) FROM messages WHERE sender_id = ? OR receiver_id = ? GROUP BY
                 CASE WHEN sender_id < receiver_id THEN CONCAT(sender_id,'_',receiver_id) ELSE CONCAT(receiver_id,'_',sender_id) END
             )
             ORDER BY m.created_at DESC",
            [$user_id, $user_id, $user_id, $user_id, $user_id]
        )->fetchAll(\PDO::FETCH_ASSOC);

        return $rows ?: [];
    }

    public function get_conversation(int $user_id, int $partner_id): array
    {
        $rows = $this->db->raw(
            "SELECT * FROM messages 
             WHERE (sender_id = ? AND receiver_id = ?) 
                OR (sender_id = ? AND receiver_id = ?) 
             ORDER BY created_at ASC",
            [$user_id, $partner_id, $partner_id, $user_id]
        )->fetchAll(\PDO::FETCH_ASSOC);

        return $rows ?: [];
    }

    public function mark_as_read(int $user_id, int $partner_id): void
    {
        $this->db->raw(
            "UPDATE messages SET read_at = ? WHERE receiver_id = ? AND sender_id = ? AND read_at IS NULL",
            [date('Y-m-d H:i:s'), $user_id, $partner_id]
        );
    }

    public function send_message(array $data): ?array
    {
        $data['created_at'] = date('Y-m-d H:i:s');
        $this->db->table($this->table)->insert($data);
        $id = $this->db->last_id();
        return $id ? $this->find_by_id((int) $id) : null;
    }

    public function get_unread_count(int $user_id): int
    {
        return (int) $this->db->table($this->table)
            ->where('receiver_id', $user_id)
            ->where('read_at IS NULL', null, false)
            ->count_all_results();
    }

    public function count_messages(): int
    {
        return (int) $this->db->table($this->table)->count_all_results();
    }
}
