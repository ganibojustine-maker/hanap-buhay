<?php
/**
 * Migration 010: Create subscriptions table and add subscription fields to users table.
 */
class Create_subscriptions_and_plans
{
    private $_lava;

    public function __construct()
    {
        $this->_lava = lava_instance();
        $this->_lava->call->dbforge();
    }

    public function up()
    {
        // 1. Add subscription columns to users table if they don't exist
        if (!$this->_lava->dbforge->column_exists('users', 'subscription_tier')) {
            $this->_lava->dbforge->add_column('users', [
                'subscription_tier' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 50,
                    'null'       => FALSE,
                    'default'    => 'free',
                    'after'      => 'is_verified'
                ]
            ]);
        }

        if (!$this->_lava->dbforge->column_exists('users', 'subscription_status')) {
            $this->_lava->dbforge->add_column('users', [
                'subscription_status' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 20,
                    'null'       => FALSE,
                    'default'    => 'active',
                    'after'      => 'subscription_tier'
                ]
            ]);
        }

        if (!$this->_lava->dbforge->column_exists('users', 'subscription_expires_at')) {
            $this->_lava->dbforge->add_column('users', [
                'subscription_expires_at' => [
                    'type'    => 'DATETIME',
                    'null'    => TRUE,
                    'default' => NULL,
                    'after'   => 'subscription_status'
                ]
            ]);
        }

        if (!$this->_lava->dbforge->column_exists('users', 'contact_credits')) {
            $this->_lava->dbforge->add_column('users', [
                'contact_credits' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'null'       => FALSE,
                    'default'    => 5,
                    'after'      => 'subscription_expires_at'
                ]
            ]);
        }

        if (!$this->_lava->dbforge->column_exists('users', 'featured_credits')) {
            $this->_lava->dbforge->add_column('users', [
                'featured_credits' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'null'       => FALSE,
                    'default'    => 0,
                    'after'      => 'contact_credits'
                ]
            ]);
        }

        // 2. Create subscriptions table for transaction and plan history
        if (!$this->_lava->dbforge->table_exists('subscriptions')) {
            $this->_lava->dbforge->add_field([
                'id' => [
                    'type'           => 'INT',
                    'constraint'     => 11,
                    'unsigned'       => TRUE,
                    'auto_increment' => TRUE,
                    'null'           => FALSE,
                ],
                'user_id' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => TRUE,
                    'null'       => FALSE,
                ],
                'account_type' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 30,
                    'null'       => FALSE,
                    'default'    => 'employer',
                ],
                'plan_id' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 50,
                    'null'       => FALSE,
                ],
                'plan_name' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 100,
                    'null'       => FALSE,
                ],
                'billing_cycle' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 20,
                    'null'       => FALSE,
                    'default'    => 'monthly',
                ],
                'price' => [
                    'type'       => 'DECIMAL',
                    'constraint' => '10,2',
                    'null'       => FALSE,
                    'default'    => '0.00',
                ],
                'payment_method' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 50,
                    'null'       => FALSE,
                    'default'    => 'gcash',
                ],
                'payment_reference' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 100,
                    'null'       => TRUE,
                    'default'    => NULL,
                ],
                'contact_credits' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'null'       => FALSE,
                    'default'    => 0,
                ],
                'featured_credits' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'null'       => FALSE,
                    'default'    => 0,
                ],
                'status' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 20,
                    'null'       => FALSE,
                    'default'    => 'active',
                ],
                'starts_at' => [
                    'type'    => 'DATETIME',
                    'null'    => FALSE,
                ],
                'expires_at' => [
                    'type'    => 'DATETIME',
                    'null'    => FALSE,
                ],
                'created_at' => [
                    'type'    => 'DATETIME',
                    'null'    => FALSE,
                ],
            ]);

            $this->_lava->dbforge->add_key('id', TRUE);
            $this->_lava->dbforge->create_table('subscriptions');
        }
    }

    public function down()
    {
        if ($this->_lava->dbforge->table_exists('subscriptions')) {
            $this->_lava->dbforge->drop_table('subscriptions');
        }

        $cols = ['featured_credits', 'contact_credits', 'subscription_expires_at', 'subscription_status', 'subscription_tier'];
        foreach ($cols as $col) {
            if ($this->_lava->dbforge->column_exists('users', $col)) {
                $this->_lava->dbforge->drop_column('users', $col);
            }
        }
    }
}

