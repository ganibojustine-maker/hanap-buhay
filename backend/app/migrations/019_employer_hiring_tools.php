<?php
/**
 * Migration 019: the employer's hiring tools.
 *
 * talent_unlocks  : an employer (or client) spent one contact credit to see a worker's phone
 *                   and email from Find Workers. One row per pair, so a worker is only ever
 *                   paid for once. Workers who applied to the employer's own jobs are free.
 * talent_saved    : the employer's saved workers ("talent pool"), with a private note.
 * talent_invites  : "invite to apply" — one invite per worker per job, so a worker cannot be
 *                   spammed about the same post.
 * jobs.featured_until : when a featured post stops being featured. Featuring now lasts for a
 *                   set time (it used to be forever, even after the plan had ended).
 *
 * Every feature checks for its table first (Schema_info), so the app keeps working before this runs.
 */
class Employer_hiring_tools // must match the file name after "019_" (Migration::get_class_name_from_file)
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
        $this->_lava->db->raw("CREATE TABLE IF NOT EXISTS `talent_unlocks` (
            `employer_id` INT UNSIGNED NOT NULL,
            `worker_id` INT UNSIGNED NOT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`employer_id`, `worker_id`),
            KEY `tu_worker_idx` (`worker_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $this->_lava->db->raw("CREATE TABLE IF NOT EXISTS `talent_saved` (
            `employer_id` INT UNSIGNED NOT NULL,
            `worker_id` INT UNSIGNED NOT NULL,
            `note` VARCHAR(500) NULL DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`employer_id`, `worker_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $this->_lava->db->raw("CREATE TABLE IF NOT EXISTS `talent_invites` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `employer_id` INT UNSIGNED NOT NULL,
            `worker_id` INT UNSIGNED NOT NULL,
            `job_id` INT UNSIGNED NOT NULL,
            `message` VARCHAR(500) NULL DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `ti_job_worker_uq` (`job_id`, `worker_id`),
            KEY `ti_worker_idx` (`worker_id`),
            KEY `ti_employer_idx` (`employer_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // checkout stores the PayMongo session here (it was only ever added by hand)
        if ($this->_lava->dbforge->table_exists('subscriptions') && !$this->_lava->dbforge->column_exists('subscriptions', 'paymongo_session_id')) {
            $this->_lava->db->raw('ALTER TABLE `subscriptions` ADD COLUMN `paymongo_session_id` VARCHAR(100) NULL DEFAULT NULL AFTER `payment_reference`');
        }

        if (!$this->_lava->dbforge->column_exists('jobs', 'featured_until')) {
            $this->_lava->db->raw('ALTER TABLE `jobs` ADD COLUMN `featured_until` DATETIME NULL DEFAULT NULL');
        }
        // posts that were featured before this existed get 30 days from now, then end
        $this->_lava->db->raw("UPDATE `jobs` SET `featured_until` = DATE_ADD(NOW(), INTERVAL 30 DAY) WHERE `is_featured` = 1 AND `featured_until` IS NULL");
    }

    public function down()
    {
        foreach (['talent_invites', 'talent_saved', 'talent_unlocks'] as $t) {
            $this->_lava->db->raw("DROP TABLE IF EXISTS `{$t}`");
        }
        if ($this->_lava->dbforge->column_exists('jobs', 'featured_until')) {
            $this->_lava->dbforge->drop_column('jobs', 'featured_until');
        }
    }
}
