<?php
/**
 * Mirrors what is already applied on the Aiven database (migration 3):
 * full_name, account_type, location, phone, bio, google_sub on users.
 * Safe to re-run: every column is checked first.
 */
class Add_profile_fields_to_users {

    private $_lava;

    public function __construct()
    {
        $this->_lava = lava_instance();
    }

    private function has_column($name)
    {
        $stmt = $this->_lava->db->raw("SHOW COLUMNS FROM users LIKE ?", [$name]);
        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function up()
    {
        $cols = [
            'full_name'    => "VARCHAR(150) NULL DEFAULT NULL AFTER username",
            'account_type' => "ENUM('worker','employer','hirer') NULL DEFAULT NULL AFTER role",
            'location'     => "VARCHAR(150) NULL DEFAULT NULL AFTER account_type",
            'phone'        => "VARCHAR(32) NULL DEFAULT NULL AFTER location",
            'bio'          => "TEXT NULL AFTER phone",
            'google_sub'   => "VARCHAR(255) NULL DEFAULT NULL AFTER bio",
        ];
        foreach ($cols as $name => $def) {
            if (!$this->has_column($name)) {
                $this->_lava->db->raw("ALTER TABLE users ADD COLUMN {$name} {$def}");
            }
        }
        $this->_lava->db->raw("ALTER TABLE users MODIFY role ENUM('admin','moderator','user') NOT NULL DEFAULT 'user'");
        $idx = $this->_lava->db->raw("SHOW INDEX FROM users WHERE Key_name = 'google_sub_unique'")->fetch(PDO::FETCH_ASSOC);
        if (!$idx) {
            $this->_lava->db->raw("ALTER TABLE users ADD UNIQUE INDEX google_sub_unique (google_sub)");
        }
    }

    public function down()
    {
        // Intentionally left non-destructive.
    }
}
