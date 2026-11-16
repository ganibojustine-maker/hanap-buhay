<?php
/**
 * Migration 013: retire the legacy MySQL `messages` table.
 *
 * Chat now lives only in Firebase Realtime Database, so the app no longer reads or writes
 * `messages`. An empty table is dropped. A table that still has rows is renamed to
 * `messages_archive` instead, so old chats are never lost (this migration runs on its own
 * at deploy time, see docker-start.sh). down() puts the table back.
 */
class Drop_messages_table
{
    private $_lava;

    public function __construct()
    {
        $this->_lava = lava_instance();
        $this->_lava->call->dbforge();
        $this->_lava->call->database();
    }

    public function up()
    {
        if (!$this->_lava->dbforge->table_exists('messages')) return;
        $rows = (int) $this->_lava->db->raw('SELECT COUNT(*) FROM `messages`')->fetchColumn();
        if ($rows === 0) {
            $this->_lava->dbforge->drop_table('messages', TRUE);
        } elseif (!$this->_lava->dbforge->table_exists('messages_archive')) {
            $this->_lava->db->raw('RENAME TABLE `messages` TO `messages_archive`');
        }
        // (rows, and an archive already there: leave both alone rather than risk either)
    }

    public function down()
    {
        if ($this->_lava->dbforge->table_exists('messages')) return;
        if ($this->_lava->dbforge->table_exists('messages_archive')) {
            $this->_lava->db->raw('RENAME TABLE `messages_archive` TO `messages`');
            return;
        }
        $this->_lava->dbforge
            ->add_field([
                'id'          => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'auto_increment' => TRUE, 'null' => FALSE],
                'sender_id'   => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'null' => FALSE],
                'receiver_id' => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'null' => FALSE],
                'job_id'      => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'null' => TRUE, 'default' => NULL],
                'body'        => ['type' => 'TEXT', 'null' => FALSE],
                'read_at'     => ['type' => 'DATETIME', 'null' => TRUE, 'default' => NULL],
                'created_at'  => ['type' => 'DATETIME', 'null' => FALSE, 'default' => 'CURRENT_TIMESTAMP'],
            ])
            ->add_key('id', primary: TRUE)
            ->create_table('messages');
    }
}
