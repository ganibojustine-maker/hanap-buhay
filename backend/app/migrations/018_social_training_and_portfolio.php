<?php
/**
 * Migration 018: the social, training and portfolio layer.
 *
 * follows            : who follows whom. A mutual follow is a "connection" — the pair can
 *                      find each other in Messages and both appear on each other's profile.
 * worker_reviews     : the other half of employer_reviews (017). An employer or client rates
 *                      the worker they hired; the average shows on the worker's public profile
 *                      and next to their application.
 * saved_courses      : bookmarked training courses (TESDA catalog id, or db:<id> for a course
 *                      added in training_courses).
 * course_enrollments : "I enrolled" / "I finished". Drives the enrollee counts on the Training
 *                      page and the prompt to upload the certificate once a course is finished.
 * work_samples       : portfolio photos — a picture of real work with a description, optionally
 *                      tied to a skill. Shown in the Skills Passport gallery and public profile.
 * users.avatar_color : which of the generated avatar colours this account was given, so the
 *                      default photo looks the same everywhere (and in emails).
 *
 * Every feature checks for its table first (Schema_info), so the app keeps working before this runs.
 */
class Social_training_and_portfolio // must match the file name after "018_" (Migration::get_class_name_from_file)
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
        $this->_lava->db->raw("CREATE TABLE IF NOT EXISTS `follows` (
            `follower_id` INT UNSIGNED NOT NULL,
            `following_id` INT UNSIGNED NOT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`follower_id`, `following_id`),
            KEY `fl_following_idx` (`following_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $this->_lava->db->raw("CREATE TABLE IF NOT EXISTS `worker_reviews` (
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
            UNIQUE KEY `wr_application_uq` (`application_id`),
            KEY `wr_worker_idx` (`worker_id`, `is_hidden`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $this->_lava->db->raw("CREATE TABLE IF NOT EXISTS `saved_courses` (
            `user_id` INT UNSIGNED NOT NULL,
            `course_id` VARCHAR(120) NOT NULL,
            `title` VARCHAR(255) NULL DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`user_id`, `course_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $this->_lava->db->raw("CREATE TABLE IF NOT EXISTS `course_enrollments` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `user_id` INT UNSIGNED NOT NULL,
            `course_id` VARCHAR(120) NOT NULL,
            `title` VARCHAR(255) NULL DEFAULT NULL,
            `provider` VARCHAR(150) NULL DEFAULT NULL,
            `status` ENUM('enrolled','completed') NOT NULL DEFAULT 'enrolled',
            `certificate_id` INT UNSIGNED NULL DEFAULT NULL,
            `completed_at` DATETIME NULL DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            UNIQUE KEY `ce_user_course_uq` (`user_id`, `course_id`),
            KEY `ce_course_idx` (`course_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $this->_lava->db->raw("CREATE TABLE IF NOT EXISTS `work_samples` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `user_id` INT UNSIGNED NOT NULL,
            `title` VARCHAR(150) NOT NULL,
            `description` VARCHAR(1000) NULL DEFAULT NULL,
            `skill_name` VARCHAR(150) NULL DEFAULT NULL,
            `kind` ENUM('work','certificate','other') NOT NULL DEFAULT 'work',
            `taken_on` DATE NULL DEFAULT NULL,
            `file_mime` VARCHAR(80) NOT NULL,
            `file_size` INT UNSIGNED NOT NULL DEFAULT 0,
            `file_data` MEDIUMTEXT NOT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `ws_user_idx` (`user_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        if (!$this->_lava->dbforge->column_exists('users', 'avatar_color')) {
            $this->_lava->db->raw('ALTER TABLE `users` ADD COLUMN `avatar_color` TINYINT UNSIGNED NULL DEFAULT NULL');
        }
        // one stable colour per account, derived from the id so it never changes
        $this->_lava->db->raw('UPDATE `users` SET `avatar_color` = (`id` % 8) WHERE `avatar_color` IS NULL');
    }

    public function down()
    {
        foreach (['work_samples', 'course_enrollments', 'saved_courses', 'worker_reviews', 'follows'] as $t) {
            $this->_lava->db->raw("DROP TABLE IF EXISTS `{$t}`");
        }
        if ($this->_lava->dbforge->column_exists('users', 'avatar_color')) {
            $this->_lava->dbforge->drop_column('users', 'avatar_color');
        }
    }
}
