<?php
/**
 * Migration 008: Add interview status, interview schedule, and tracking details to applications table.
 */
class Add_interview_status_and_tracking_to_applications
{
    private $_lava;

    public function __construct()
    {
        $this->_lava = lava_instance();
        $this->_lava->call->dbforge();
    }

    public function up()
    {
        // Modify status to VARCHAR(40) to accommodate 'for_interview', 'reviewed', 'shortlisted', 'hired', 'rejected', etc.
        $this->_lava->dbforge->modify_column('applications', [
            'status' => [
                'type'       => 'VARCHAR',
                'constraint' => 40,
                'null'       => FALSE,
                'default'    => 'pending'
            ]
        ]);

        if (!$this->_lava->dbforge->column_exists('applications', 'interview_date')) {
            $this->_lava->dbforge->add_column('applications', [
                'interview_date' => [
                    'type'    => 'DATETIME',
                    'null'    => TRUE,
                    'default' => NULL,
                    'after'   => 'status'
                ]
            ]);
        }

        if (!$this->_lava->dbforge->column_exists('applications', 'interview_notes')) {
            $this->_lava->dbforge->add_column('applications', [
                'interview_notes' => [
                    'type'    => 'TEXT',
                    'null'    => TRUE,
                    'default' => NULL,
                    'after'   => 'interview_date'
                ]
            ]);
        }
    }

    public function down()
    {
        if ($this->_lava->dbforge->column_exists('applications', 'interview_notes')) {
            $this->_lava->dbforge->drop_column('applications', 'interview_notes');
        }
        if ($this->_lava->dbforge->column_exists('applications', 'interview_date')) {
            $this->_lava->dbforge->drop_column('applications', 'interview_date');
        }
    }
}

