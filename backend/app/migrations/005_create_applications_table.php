<?php
/**
 * Migration 005: Applications table — job applications from workers.
 */
class Create_applications_table
{
    private $_lava;

    public function __construct()
    {
        $this->_lava = lava_instance();
        $this->_lava->call->dbforge();
    }

    public function up()
    {
        if ($this->_lava->dbforge->table_exists('applications')) return;

        $this->_lava->dbforge
            ->add_field([
                'id'          => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'auto_increment' => TRUE, 'null' => FALSE],
                'job_id'      => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'null' => FALSE],
                'worker_id'   => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'null' => FALSE],
                'cover_note'  => ['type' => 'TEXT', 'null' => TRUE, 'default' => NULL],
                'match_score' => ['type' => 'TINYINT', 'constraint' => 3, 'unsigned' => TRUE, 'null' => TRUE, 'default' => NULL],
                'status'      => ['type' => "ENUM('pending','reviewed','shortlisted','rejected','hired')", 'null' => FALSE, 'default' => 'pending'],
                'created_at'  => ['type' => 'DATETIME', 'null' => FALSE, 'default' => 'CURRENT_TIMESTAMP'],
                'updated_at'  => ['type' => 'DATETIME', 'null' => TRUE, 'default' => NULL],
            ])
            ->add_key('id', primary: TRUE)
            ->add_key('job_id', name: 'job_id_idx')
            ->add_key('worker_id', name: 'worker_id_idx')
            ->add_key('status', name: 'app_status_idx')
            ->create_table('applications');
    }

    public function down()
    {
        $this->_lava->dbforge->drop_table('applications');
    }
}
