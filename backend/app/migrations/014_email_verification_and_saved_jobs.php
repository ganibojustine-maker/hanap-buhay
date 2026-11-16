<?php
/**
 * Migration 014: email verification and server-side saved jobs.
 *
 * users.email_verified_at : set once the person proves they own the address.
 *                           Existing accounts are marked verified so nobody is locked out.
 * email_verifications     : one-time hashed links (24 hours), same pattern as password_resets.
 * saved_jobs              : bookmarks stored on the server, so they follow the account to any device.
 */
class Email_verification_and_saved_jobs // must match the file name after "014_" (Migration::get_class_name_from_file)
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
        if (!$this->_lava->dbforge->column_exists('users', 'email_verified_at')) {
            $this->_lava->dbforge->add_column('users', [
                'email_verified_at' => ['type' => 'DATETIME', 'null' => TRUE, 'default' => NULL],
            ]);
        }
        // Grandfather existing accounts: they were created before verification existed
        $this->_lava->db->raw('UPDATE `users` SET `email_verified_at` = `created_at` WHERE `email_verified_at` IS NULL');

        $this->_lava->db->raw("CREATE TABLE IF NOT EXISTS `email_verifications` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `user_id` INT UNSIGNED NOT NULL,
            `token_hash` VARCHAR(64) NOT NULL,
            `expires_at` DATETIME NOT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `ev_token_idx` (`token_hash`),
            KEY `ev_user_idx` (`user_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $this->_lava->db->raw("CREATE TABLE IF NOT EXISTS `saved_jobs` (
            `user_id` INT UNSIGNED NOT NULL,
            `job_id` INT UNSIGNED NOT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`user_id`, `job_id`),
            KEY `sj_job_idx` (`job_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    public function down()
    {
        $this->_lava->db->raw('DROP TABLE IF EXISTS `saved_jobs`');
        $this->_lava->db->raw('DROP TABLE IF EXISTS `email_verifications`');
        if ($this->_lava->dbforge->column_exists('users', 'email_verified_at')) {
            $this->_lava->dbforge->drop_column('users', 'email_verified_at');
        }
    }
}
