<?php
/**
 * Migration 006: Skills passport entries — worker skill/cert records.
 */
class Create_skills_passport_table
{
    private $_lava;

    public function __construct()
    {
        $this->_lava = lava_instance();
        $this->_lava->call->dbforge();
    }

    public function up()
    {
        if ($this->_lava->dbforge->table_exists('skills_passport')) return;

        $this->_lava->dbforge
            ->add_field([
                'id'          => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'auto_increment' => TRUE, 'null' => FALSE],
                'user_id'     => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'null' => FALSE],
                'skill_name'  => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => FALSE],
                'category'    => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => TRUE, 'default' => NULL],
                'level'       => ['type' => "ENUM('beginner','intermediate','advanced','expert')", 'null' => TRUE, 'default' => NULL],
                'source'      => ['type' => "ENUM('self','tesda','employer','training','other')", 'null' => FALSE, 'default' => 'self'],
                'certificate' => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => TRUE, 'default' => NULL],
                'verified'    => ['type' => 'TINYINT', 'constraint' => 1, 'unsigned' => TRUE, 'null' => FALSE, 'default' => 0],
                'created_at'  => ['type' => 'DATETIME', 'null' => FALSE, 'default' => 'CURRENT_TIMESTAMP'],
            ])
            ->add_key('id', primary: TRUE)
            ->add_key('user_id', name: 'user_id_idx')
            ->create_table('skills_passport');

        // Training courses
        if (!$this->_lava->dbforge->table_exists('training_courses')) {
            $this->_lava->dbforge
                ->add_field([
                    'id'          => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'auto_increment' => TRUE, 'null' => FALSE],
                    'title'       => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => FALSE],
                    'provider'    => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => TRUE, 'default' => NULL],
                    'location'    => ['type' => 'VARCHAR', 'constraint' => 150, 'null' => TRUE, 'default' => NULL],
                    'duration'    => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => TRUE, 'default' => NULL],
                    'cost'        => ['type' => 'DECIMAL', 'constraint' => '12,2', 'null' => TRUE, 'default' => NULL],
                    'is_free'     => ['type' => 'TINYINT', 'constraint' => 1, 'unsigned' => TRUE, 'null' => FALSE, 'default' => 0],
                    'category'    => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => TRUE, 'default' => NULL],
                    'url'         => ['type' => 'VARCHAR', 'constraint' => 500, 'null' => TRUE, 'default' => NULL],
                    'status'      => ['type' => "ENUM('active','inactive')", 'null' => FALSE, 'default' => 'active'],
                    'created_at'  => ['type' => 'DATETIME', 'null' => FALSE, 'default' => 'CURRENT_TIMESTAMP'],
                ])
                ->add_key('id', primary: TRUE)
                ->add_key('location', name: 'training_loc_idx')
                ->create_table('training_courses');
        }

        // Messages
        if (!$this->_lava->dbforge->table_exists('messages')) {
            $this->_lava->dbforge
                ->add_field([
                    'id'          => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'auto_increment' => TRUE, 'null' => FALSE],
                    'sender_id'   => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'null' => FALSE],
                    'receiver_id' => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'null' => FALSE],
                    'job_id'      => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'null' => TRUE, 'default' => NULL],
                    'body'        => ['type' => 'TEXT', 'null' => FALSE],
                    'read_at'     => ['type' => 'DATETIME', 'null' => TRUE, 'default' => NULL],
                    'created_at'  => ['type' => 'DATETIME', 'null' => FALSE, 'default' => 'CURRENT_TIMESTAMP'],
                ])
                ->add_key('id', primary: TRUE)
                ->add_key('sender_id', name: 'msg_sender_idx')
                ->add_key('receiver_id', name: 'msg_receiver_idx')
                ->create_table('messages');
        }

        // Notifications
        if (!$this->_lava->dbforge->table_exists('notifications')) {
            $this->_lava->dbforge
                ->add_field([
                    'id'          => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'auto_increment' => TRUE, 'null' => FALSE],
                    'user_id'     => ['type' => 'INT', 'constraint' => 11, 'unsigned' => TRUE, 'null' => FALSE],
                    'type'        => ['type' => 'VARCHAR', 'constraint' => 80, 'null' => FALSE],
                    'title'       => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => FALSE],
                    'body'        => ['type' => 'TEXT', 'null' => TRUE, 'default' => NULL],
                    'link'        => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => TRUE, 'default' => NULL],
                    'read_at'     => ['type' => 'DATETIME', 'null' => TRUE, 'default' => NULL],
                    'created_at'  => ['type' => 'DATETIME', 'null' => FALSE, 'default' => 'CURRENT_TIMESTAMP'],
                ])
                ->add_key('id', primary: TRUE)
                ->add_key('user_id', name: 'notif_user_idx')
                ->create_table('notifications');
        }
    }

    public function down()
    {
        $this->_lava->dbforge->drop_table('skills_passport');
        $this->_lava->dbforge->drop_table('training_courses');
        $this->_lava->dbforge->drop_table('messages');
        $this->_lava->dbforge->drop_table('notifications');
    }
}
