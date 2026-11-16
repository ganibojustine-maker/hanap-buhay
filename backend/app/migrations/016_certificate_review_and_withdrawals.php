<?php
/**
 * Migration 016: admin review of skill certificates, and withdrawn applications.
 *
 * skill_certificates.review_note / reviewed_at / reviewed_by : who approved or rejected
 *                     a certificate, when, and the reason shown to the worker.
 * applications.withdrawn_at : set when the worker withdraws (status "withdrawn";
 *                     status is already a VARCHAR since migration 008).
 */
class Certificate_review_and_withdrawals
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
        if ($this->_lava->dbforge->table_exists('skill_certificates')) {
            $cols = [
                'review_note' => 'VARCHAR(500) NULL DEFAULT NULL',
                'reviewed_at' => 'DATETIME NULL DEFAULT NULL',
                'reviewed_by' => 'INT UNSIGNED NULL DEFAULT NULL',
            ];
            foreach ($cols as $name => $def) {
                if (!$this->_lava->dbforge->column_exists('skill_certificates', $name)) {
                    $this->_lava->db->raw("ALTER TABLE `skill_certificates` ADD COLUMN `{$name}` {$def}");
                }
            }
        }
        if (!$this->_lava->dbforge->column_exists('applications', 'withdrawn_at')) {
            $this->_lava->db->raw('ALTER TABLE `applications` ADD COLUMN `withdrawn_at` DATETIME NULL DEFAULT NULL');
        }
    }

    public function down()
    {
        foreach (['review_note', 'reviewed_at', 'reviewed_by'] as $c) {
            if ($this->_lava->dbforge->table_exists('skill_certificates') && $this->_lava->dbforge->column_exists('skill_certificates', $c)) {
                $this->_lava->dbforge->drop_column('skill_certificates', $c);
            }
        }
        if ($this->_lava->dbforge->column_exists('applications', 'withdrawn_at')) {
            $this->_lava->dbforge->drop_column('applications', 'withdrawn_at');
        }
    }
}
