<?php
/**
 * Migration 004: Jobs table — job listings posted by employers/hirers.
 * Oriental Mindoro focused with municipality location support.
 */
class Create_jobs_table
{
    private $_lava;

    public function __construct()
    {
        $this->_lava = lava_instance();
        $this->_lava->call->dbforge();
    }

    public function up()
    {
        if ($this->_lava->dbforge->table_exists('jobs')) return;

        $this->_lava->dbforge
            ->add_field([
                'id'           => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'auto_increment' => TRUE, 'null' => FALSE],
                'employer_id'  => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'null' => FALSE],
                'title'        => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => FALSE],
                'company'      => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => TRUE, 'default' => NULL],
                'description'  => ['type' => 'TEXT', 'null' => TRUE, 'default' => NULL],
                'requirements' => ['type' => 'TEXT', 'null' => TRUE, 'default' => NULL],
                'location'     => ['type' => 'VARCHAR', 'constraint' => 150, 'null' => TRUE, 'default' => NULL],
                'job_type'     => ['type' => "ENUM('full-time','part-time','contractual','freelance','gig')", 'null' => FALSE, 'default' => 'full-time'],
                'salary_min'   => ['type' => 'DECIMAL', 'constraint' => '12,2', 'null' => TRUE, 'default' => NULL],
                'salary_max'   => ['type' => 'DECIMAL', 'constraint' => '12,2', 'null' => TRUE, 'default' => NULL],
                'skills_needed'=> ['type' => 'TEXT', 'null' => TRUE, 'default' => NULL],
                'status'       => ['type' => "ENUM('draft','active','closed','archived')", 'null' => FALSE, 'default' => 'active'],
                'is_featured'  => ['type' => 'TINYINT', 'constraint' => 1, 'unsigned' => TRUE, 'null' => FALSE, 'default' => 0],
                'views'        => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'null' => FALSE, 'default' => 0],
                'created_at'   => ['type' => 'DATETIME', 'null' => FALSE, 'default' => 'CURRENT_TIMESTAMP'],
                'updated_at'   => ['type' => 'DATETIME', 'null' => TRUE, 'default' => NULL],
            ])
            ->add_key('id', primary: TRUE)
            ->add_key('employer_id', name: 'employer_id_idx')
            ->add_key('location', name: 'location_idx')
            ->add_key('status', name: 'status_idx')
            ->create_table('jobs');
    }

    public function down()
    {
        $this->_lava->dbforge->drop_table('jobs');
    }
}
