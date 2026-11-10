<?php
/**
 * Migration 007: Add notification preferences column to users table.
 */
class Add_notification_prefs_to_users {

    private $_lava;

    public function __construct()
    {
        $this->_lava = lava_instance();
        $this->_lava->call->dbforge();
    }

    public function up()
    {
        if (!$this->_lava->dbforge->column_exists('users', 'notification_prefs')) {
            $this->_lava->dbforge->add_column('users', [
                'notification_prefs' => [
                    'type'    => 'TEXT',
                    'null'    => TRUE,
                    'default' => NULL,
                    'after'   => 'bio'
                ]
            ]);
        }
    }

    public function down()
    {
        if ($this->_lava->dbforge->column_exists('users', 'notification_prefs')) {
            $this->_lava->dbforge->drop_column('users', 'notification_prefs');
        }
    }
}
