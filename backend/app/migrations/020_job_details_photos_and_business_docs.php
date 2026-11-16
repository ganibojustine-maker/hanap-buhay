<?php
/**
 * Migration 020: richer job posts, job photos, and business verification.
 *
 * jobs (new columns) — what an employer's long-term post and a client's quick gig each need:
 *   pay_basis   month | day | hour | fixed   (how the pay is counted; was always "per month")
 *   openings    how many people the employer will hire for this post
 *   schedule    e.g. "Mon–Sat, 8 AM – 5 PM"
 *   benefits    comma list: SSS, PhilHealth, Pag-IBIG, 13th month pay, free meals…
 *   experience  none | 1 | 2-3 | 4+ (years)
 *   needed_by   the date a client needs the work done (gigs)
 *   is_urgent   "needed as soon as possible" (gigs)
 *   duration    how long the gig takes, e.g. "1 day", "2–3 days", "1 week"
 *   address     barangay / street, so a worker knows where exactly
 *   image_v     version of the job's own photo (0 = none); the photo is in job_images
 *
 * job_images         : one photo per job, kept out of the jobs table so job lists stay small.
 * business_documents : a business permit (DTI / SEC / Mayor's / BIR 2303) an employer or client
 *                      uploads; an admin checks it and sets the Verified business badge.
 *
 * Every feature checks for its column/table first, so the app keeps working before this runs.
 */
class Job_details_photos_and_business_docs // must match the file name after "020_"
{
    private $_lava;

    private const JOB_COLUMNS = [
        'pay_basis'  => "VARCHAR(10) NOT NULL DEFAULT 'month'",
        'openings'   => 'SMALLINT UNSIGNED NULL DEFAULT NULL',
        'schedule'   => 'VARCHAR(120) NULL DEFAULT NULL',
        'benefits'   => 'VARCHAR(500) NULL DEFAULT NULL',
        'experience' => 'VARCHAR(10) NULL DEFAULT NULL',
        'needed_by'  => 'DATE NULL DEFAULT NULL',
        'is_urgent'  => 'TINYINT(1) NOT NULL DEFAULT 0',
        'duration'   => 'VARCHAR(60) NULL DEFAULT NULL',
        'address'    => 'VARCHAR(255) NULL DEFAULT NULL',
        'image_v'    => 'INT UNSIGNED NOT NULL DEFAULT 0',
    ];

    public function __construct()
    {
        $this->_lava = lava_instance();
        $this->_lava->call->dbforge();
        $this->_lava->call->database();
    }

    public function up()
    {
        foreach (self::JOB_COLUMNS as $col => $def) {
            if (!$this->_lava->dbforge->column_exists('jobs', $col)) {
                $this->_lava->db->raw("ALTER TABLE `jobs` ADD COLUMN `{$col}` {$def}");
            }
        }

        $this->_lava->db->raw("CREATE TABLE IF NOT EXISTS `job_images` (
            `job_id` INT UNSIGNED NOT NULL,
            `file_mime` VARCHAR(40) NOT NULL,
            `file_size` INT UNSIGNED NOT NULL DEFAULT 0,
            `file_data` MEDIUMTEXT NOT NULL,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`job_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $this->_lava->db->raw("CREATE TABLE IF NOT EXISTS `business_documents` (
            `user_id` INT UNSIGNED NOT NULL,
            `doc_type` VARCHAR(20) NOT NULL,
            `business_name` VARCHAR(255) NULL DEFAULT NULL,
            `registration_no` VARCHAR(80) NULL DEFAULT NULL,
            `file_name` VARCHAR(255) NULL DEFAULT NULL,
            `file_mime` VARCHAR(80) NOT NULL,
            `file_size` INT UNSIGNED NOT NULL DEFAULT 0,
            `file_data` MEDIUMTEXT NOT NULL,
            `status` VARCHAR(12) NOT NULL DEFAULT 'pending',
            `review_note` VARCHAR(500) NULL DEFAULT NULL,
            `reviewed_by` INT UNSIGNED NULL DEFAULT NULL,
            `reviewed_at` DATETIME NULL DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`user_id`),
            KEY `bd_status_idx` (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    public function down()
    {
        $this->_lava->db->raw('DROP TABLE IF EXISTS `business_documents`');
        $this->_lava->db->raw('DROP TABLE IF EXISTS `job_images`');
        foreach (array_keys(self::JOB_COLUMNS) as $col) {
            if ($this->_lava->dbforge->column_exists('jobs', $col)) {
                $this->_lava->dbforge->drop_column('jobs', $col);
            }
        }
    }
}
