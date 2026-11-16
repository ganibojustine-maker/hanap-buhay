<?php
/**
 * Migration 015: uploaded skill certificates (TESDA NC, COC, trainings) and
 * the worker's Resume Builder draft.
 *
 * skill_certificates         : one row per uploaded certificate. The file is kept
 *                              inline as a data URL (Render free tier has no disk),
 *                              same approach as users.picture.
 * skills_passport.certificate_id : links a skill to the certificate it came from.
 * users.resume_data          : JSON draft of the Resume Builder form.
 */
class Create_skill_certificates_and_resume
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
        $this->_lava->db->raw("CREATE TABLE IF NOT EXISTS `skill_certificates` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `user_id` INT UNSIGNED NOT NULL,
            `title` VARCHAR(255) NOT NULL,
            `issuer` VARCHAR(150) NULL DEFAULT NULL,
            `nc_level` VARCHAR(10) NULL DEFAULT NULL,
            `cert_number` VARCHAR(80) NULL DEFAULT NULL,
            `holder_name` VARCHAR(150) NULL DEFAULT NULL,
            `issued_on` DATE NULL DEFAULT NULL,
            `valid_until` DATE NULL DEFAULT NULL,
            `file_name` VARCHAR(255) NULL DEFAULT NULL,
            `file_mime` VARCHAR(80) NOT NULL,
            `file_size` INT UNSIGNED NOT NULL DEFAULT 0,
            `file_data` MEDIUMTEXT NOT NULL,
            `ocr_text` TEXT NULL,
            `status` ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `sc_user_idx` (`user_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        if (!$this->_lava->dbforge->column_exists('skills_passport', 'certificate_id')) {
            $this->_lava->db->raw('ALTER TABLE `skills_passport` ADD COLUMN `certificate_id` INT UNSIGNED NULL DEFAULT NULL AFTER `certificate`');
        }
        if (!$this->_lava->dbforge->column_exists('users', 'resume_data')) {
            $this->_lava->db->raw('ALTER TABLE `users` ADD COLUMN `resume_data` MEDIUMTEXT NULL');
        }
    }

    public function down()
    {
        $this->_lava->db->raw('DROP TABLE IF EXISTS `skill_certificates`');
        if ($this->_lava->dbforge->column_exists('skills_passport', 'certificate_id')) {
            $this->_lava->dbforge->drop_column('skills_passport', 'certificate_id');
        }
        if ($this->_lava->dbforge->column_exists('users', 'resume_data')) {
            $this->_lava->dbforge->drop_column('users', 'resume_data');
        }
    }
}
