<?php
/**
 * Migration 022: the gig marketplace, finished.
 *
 * post_photos       up to 6 photos for a worker's service, and up to 5 extra photos for a
 *                   job or gig (its cover stays in job_images, so every existing card works).
 * worker_services   + packages (Basic / Standard / Premium as JSON), what the client must
 *                   prepare, how many changes are included, and a view counter.
 * proposals         + the work photos a worker attaches as proof, and when they can start.
 * contracts         + the package a client booked.
 * gig_invites       a client asks a worker to send a proposal for one of their gigs.
 *
 * Every column is added only when missing, so this is safe to run again.
 */
class Gig_marketplace // must match the file name after "022_"
{
    private $_lava;

    private const SERVICE_COLUMNS = [
        'packages'     => 'TEXT NULL DEFAULT NULL',
        'requirements' => 'VARCHAR(1000) NULL DEFAULT NULL',
        'revisions'    => 'TINYINT UNSIGNED NOT NULL DEFAULT 1',
        'views'        => 'INT UNSIGNED NOT NULL DEFAULT 0',
    ];
    private const PROPOSAL_COLUMNS = [
        'work_ids'       => 'VARCHAR(255) NULL DEFAULT NULL',
        'available_from' => 'DATE NULL DEFAULT NULL',
    ];
    private const CONTRACT_COLUMNS = [
        'package_name' => 'VARCHAR(40) NULL DEFAULT NULL',
    ];

    public function __construct()
    {
        $this->_lava = lava_instance();
        $this->_lava->call->dbforge();
        $this->_lava->call->database();
    }

    private function add_columns(string $table, array $cols): void
    {
        foreach ($cols as $col => $def) {
            if (!$this->_lava->dbforge->column_exists($table, $col)) {
                $this->_lava->db->raw("ALTER TABLE `{$table}` ADD COLUMN `{$col}` {$def}");
            }
        }
    }

    private function drop_columns(string $table, array $cols): void
    {
        foreach (array_keys($cols) as $col) {
            if ($this->_lava->dbforge->column_exists($table, $col)) {
                $this->_lava->db->raw("ALTER TABLE `{$table}` DROP COLUMN `{$col}`");
            }
        }
    }

    public function up()
    {
        $db = $this->_lava->db;
        $this->add_columns('worker_services', self::SERVICE_COLUMNS);
        $this->add_columns('proposals', self::PROPOSAL_COLUMNS);
        $this->add_columns('contracts', self::CONTRACT_COLUMNS);

        $db->raw("CREATE TABLE IF NOT EXISTS `post_photos` (
            `owner_type` VARCHAR(10) NOT NULL,
            `owner_id` INT UNSIGNED NOT NULL,
            `slot` TINYINT UNSIGNED NOT NULL,
            `file_mime` VARCHAR(40) NOT NULL,
            `file_size` INT UNSIGNED NOT NULL DEFAULT 0,
            `file_data` MEDIUMTEXT NOT NULL,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`owner_type`, `owner_id`, `slot`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->raw("CREATE TABLE IF NOT EXISTS `gig_invites` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `gig_id` INT UNSIGNED NOT NULL,
            `client_id` INT UNSIGNED NOT NULL,
            `worker_id` INT UNSIGNED NOT NULL,
            `message` VARCHAR(500) NULL DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `gi_gig_worker_uq` (`gig_id`, `worker_id`),
            KEY `gi_worker_idx` (`worker_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    public function down()
    {
        foreach (['gig_invites', 'post_photos'] as $t) $this->_lava->db->raw("DROP TABLE IF EXISTS `{$t}`");
        $this->drop_columns('contracts', self::CONTRACT_COLUMNS);
        $this->drop_columns('proposals', self::PROPOSAL_COLUMNS);
        $this->drop_columns('worker_services', self::SERVICE_COLUMNS);
    }
}
