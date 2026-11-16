<?php
/**
 * Migration 017: worker tools.
 *
 * users.open_to_work / work_types / expected_rate / rate_unit / preferred_towns
 *          : availability shown to employers and used by job matching (nearest preferred town).
 * users.share_token : public Skills Passport link (/p/{token}); NULL = not shared.
 * applications.interview_reminded_at : when the "interview tomorrow" reminder went out
 *          (cleared again when the employer moves the interview).
 * employer_reviews : a hired worker's rating (1-5) and comment about the employer, one per application.
 *
 * Every feature checks for these columns/tables first, so the app keeps working before this runs.
 */
class Worker_tools // must match the file name after "017_" (Migration::get_class_name_from_file)
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
        $users = [
            'open_to_work'    => 'TINYINT(1) NOT NULL DEFAULT 1',
            'work_types'      => 'VARCHAR(120) NULL DEFAULT NULL',
            'expected_rate'   => 'INT UNSIGNED NULL DEFAULT NULL',
            'rate_unit'       => 'VARCHAR(10) NULL DEFAULT NULL',
            'preferred_towns' => 'VARCHAR(400) NULL DEFAULT NULL',
            'share_token'     => 'VARCHAR(24) NULL DEFAULT NULL',
        ];
        foreach ($users as $name => $def) {
            if (!$this->_lava->dbforge->column_exists('users', $name)) {
                $this->_lava->db->raw("ALTER TABLE `users` ADD COLUMN `{$name}` {$def}");
            }
        }
        $hasIdx = (int) $this->_lava->db->raw(
            "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'users_share_token_uq'"
        )->fetchColumn();
        if (!$hasIdx) $this->_lava->db->raw('ALTER TABLE `users` ADD UNIQUE KEY `users_share_token_uq` (`share_token`)');

        if (!$this->_lava->dbforge->column_exists('applications', 'interview_reminded_at')) {
            $this->_lava->db->raw('ALTER TABLE `applications` ADD COLUMN `interview_reminded_at` DATETIME NULL DEFAULT NULL');
        }

        $this->_lava->db->raw("CREATE TABLE IF NOT EXISTS `employer_reviews` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `application_id` INT UNSIGNED NOT NULL,
            `employer_id` INT UNSIGNED NOT NULL,
            `worker_id` INT UNSIGNED NOT NULL,
            `job_id` INT UNSIGNED NULL DEFAULT NULL,
            `rating` TINYINT UNSIGNED NOT NULL,
            `comment` VARCHAR(1000) NULL DEFAULT NULL,
            `is_hidden` TINYINT(1) NOT NULL DEFAULT 0,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            UNIQUE KEY `er_application_uq` (`application_id`),
            KEY `er_employer_idx` (`employer_id`, `is_hidden`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    public function down()
    {
        $this->_lava->db->raw('DROP TABLE IF EXISTS `employer_reviews`');
        if ($this->_lava->dbforge->column_exists('applications', 'interview_reminded_at')) {
            $this->_lava->dbforge->drop_column('applications', 'interview_reminded_at');
        }
        foreach (['share_token', 'preferred_towns', 'rate_unit', 'expected_rate', 'work_types', 'open_to_work'] as $c) {
            if ($this->_lava->dbforge->column_exists('users', $c)) {
                $this->_lava->db->raw("ALTER TABLE `users` DROP COLUMN `{$c}`");
            }
        }
    }
}
