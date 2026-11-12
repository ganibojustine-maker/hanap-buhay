<?php
/**
 * Migration 011: Add email delivery tracking columns to notifications.
 *
 * email_status : sent | logged | skipped | failed
 * email_to     : recipient address the Brevo email was addressed to
 * email_html   : rendered HTML body (for audit / resend)
 * email_error  : Brevo / mailer error message when delivery failed
 */
class Add_email_tracking_to_notifications
{
    private $_lava;

    public function __construct()
    {
        $this->_lava = lava_instance();
        $this->_lava->call->dbforge();
    }

    public function up()
    {
        $columns = [
            'email_status' => ['type' => 'VARCHAR', 'constraint' => 20,  'null' => TRUE, 'default' => NULL, 'after' => 'link'],
            'email_to'     => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => TRUE, 'default' => NULL, 'after' => 'email_status'],
            'email_html'   => ['type' => 'LONGTEXT', 'null' => TRUE, 'default' => NULL, 'after' => 'email_to'],
            'email_error'  => ['type' => 'VARCHAR', 'constraint' => 500, 'null' => TRUE, 'default' => NULL, 'after' => 'email_html'],
        ];

        foreach ($columns as $name => $def) {
            if (!$this->_lava->dbforge->column_exists('notifications', $name)) {
                $this->_lava->dbforge->add_column('notifications', [$name => $def]);
            }
        }
    }

    public function down()
    {
        foreach (['email_error', 'email_html', 'email_to', 'email_status'] as $name) {
            if ($this->_lava->dbforge->column_exists('notifications', $name)) {
                $this->_lava->dbforge->drop_column('notifications', $name);
            }
        }
    }
}
