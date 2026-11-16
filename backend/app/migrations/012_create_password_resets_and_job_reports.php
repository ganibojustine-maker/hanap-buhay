<?php
/**
 * Migration 012: Password reset tokens, job reports, and inline avatar storage.
 *
 * password_resets : one-time, hashed reset tokens (1 hour expiry)
 * job_reports     : user reports on job posts for admin moderation
 * users.picture   : widened to MEDIUMTEXT so avatars can be stored inline
 *                   (the Render free tier has no persistent disk)
 */
class Create_password_resets_and_job_reports
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
        if (!$this->_lava->dbforge->table_exists('password_resets')) {
            $this->_lava->dbforge->add_field([
                'id'         => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'auto_increment' => TRUE, 'null' => FALSE],
                'user_id'    => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'null' => FALSE],
                'token_hash' => ['type' => 'VARCHAR', 'constraint' => 64, 'null' => FALSE],
                'expires_at' => ['type' => 'DATETIME', 'null' => FALSE],
                'created_at' => ['type' => 'DATETIME', 'null' => FALSE, 'default' => 'CURRENT_TIMESTAMP'],
            ]);
            $this->_lava->dbforge->add_key('id', TRUE);
            $this->_lava->dbforge->add_key('token_hash');
            $this->_lava->dbforge->add_key('user_id');
            $this->_lava->dbforge->create_table('password_resets', TRUE);
        }

        if (!$this->_lava->dbforge->table_exists('job_reports')) {
            $this->_lava->dbforge->add_field([
                'id'          => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'auto_increment' => TRUE, 'null' => FALSE],
                'job_id'      => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'null' => FALSE],
                'reporter_id' => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'null' => FALSE],
                'reason'      => ['type' => 'TEXT', 'null' => TRUE, 'default' => NULL],
                'status'      => ['type' => "ENUM('open','reviewed','dismissed')", 'null' => FALSE, 'default' => 'open'],
                'created_at'  => ['type' => 'DATETIME', 'null' => FALSE, 'default' => 'CURRENT_TIMESTAMP'],
            ]);
            $this->_lava->dbforge->add_key('id', TRUE);
            $this->_lava->dbforge->add_key('job_id');
            $this->_lava->dbforge->create_table('job_reports', TRUE);
        }

        // Avatars are now stored as data URLs in users.picture.
        try {
            // a fresh database has no picture column yet (earlier installs added it by hand)
            $has = $this->_lava->db->raw("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'picture'")->fetchColumn();
            $this->_lava->db->raw($has
                ? 'ALTER TABLE `users` MODIFY `picture` MEDIUMTEXT NULL DEFAULT NULL'
                : 'ALTER TABLE `users` ADD COLUMN `picture` MEDIUMTEXT NULL DEFAULT NULL');
        } catch (\Throwable $e) {
            error_log('[Migration 012] picture column widen skipped: ' . $e->getMessage());
        }
    }

    public function down()
    {
        if ($this->_lava->dbforge->table_exists('job_reports')) {
            $this->_lava->dbforge->drop_table('job_reports', TRUE);
        }
        if ($this->_lava->dbforge->table_exists('password_resets')) {
            $this->_lava->dbforge->drop_table('password_resets', TRUE);
        }
    }
}
