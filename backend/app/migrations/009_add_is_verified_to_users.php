<?php
/**
 * Migration 009: Add is_verified column to users table for employer/worker verification.
 */
class Add_is_verified_to_users
{
    private $_lava;

    public function __construct()
    {
        $this->_lava = lava_instance();
        $this->_lava->call->dbforge();
    }

    public function up()
    {
        if (!$this->_lava->dbforge->column_exists('users', 'is_verified')) {
            $this->_lava->dbforge->add_column('users', [
                'is_verified' => [
                    'type'       => 'TINYINT',
                    'constraint' => 1,
                    'unsigned'   => TRUE,
                    'default'    => 0,
                    'after'      => 'is_active'
                ]
            ]);
        }
    }

    public function down()
    {
        if ($this->_lava->dbforge->column_exists('users', 'is_verified')) {
            $this->_lava->dbforge->drop_column('users', 'is_verified');
        }
    }
}
