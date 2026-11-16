<?php
/**
 * Migration 021: the public-ready platform.
 *
 * Matching (documented weighted formula, see docs/MATCHING.md)
 *   users.education_level, users.experience_years, users.barangay
 *   jobs.education_level, jobs.category, jobs.barangay
 *
 * Posts that are live, approved and not expired
 *   jobs.post_type        job | gig   (gig = a client's service request, handled as a freelance contract)
 *   jobs.expires_at       a post stops showing after this date (employer can renew)
 *   jobs.moderation_status approved | pending | rejected (+ moderation_note)
 *
 * Hiring pipeline (employer)
 *   applications: offer_*, low_match_ack, decided_at
 *   application_status_history : every status change, who made it, and a note
 *
 * Verification (worker, employer, client)
 *   users.verification_status unverified | pending | verified | rejected | resubmit
 *   users.phone_verified_at
 *   verification_requests, verification_history, phone_otps
 *
 * Terms and privacy consent
 *   users.terms_version, terms_accepted_at, privacy_version, privacy_accepted_at
 *
 * Payments (PayMongo)
 *   payments              one row per checkout attempt, with its PayMongo status
 *   subscription_events   timeline of every plan change, with what was unlocked or locked
 *   paymongo_events       webhook events already handled (so one is never counted twice)
 *   subscriptions.scheduled_plan_id / cancel_at_period_end
 *
 * Gigs (client ↔ worker freelance flow)
 *   proposals, contracts, contract_milestones, contract_events, disputes, contract_reviews,
 *   worker_services (a worker's own service listing a client can book directly)
 *
 * Existing data is carried over (payments from subscriptions, gig flags from client posts).
 */
class Public_ready_platform
{
    private $_lava;

    private const USER_COLUMNS = [
        'verification_status' => "VARCHAR(16) NOT NULL DEFAULT 'unverified'",
        'phone_verified_at'   => 'DATETIME NULL DEFAULT NULL',
        'terms_version'       => 'VARCHAR(20) NULL DEFAULT NULL',
        'terms_accepted_at'   => 'DATETIME NULL DEFAULT NULL',
        'privacy_version'     => 'VARCHAR(20) NULL DEFAULT NULL',
        'privacy_accepted_at' => 'DATETIME NULL DEFAULT NULL',
        'barangay'            => 'VARCHAR(80) NULL DEFAULT NULL',
        'education_level'     => 'VARCHAR(20) NULL DEFAULT NULL',
        'experience_years'    => 'TINYINT UNSIGNED NULL DEFAULT NULL',
    ];

    private const JOB_COLUMNS = [
        'post_type'         => "VARCHAR(8) NOT NULL DEFAULT 'job'",
        'expires_at'        => 'DATETIME NULL DEFAULT NULL',
        'moderation_status' => "VARCHAR(12) NOT NULL DEFAULT 'approved'",
        'moderation_note'   => 'VARCHAR(500) NULL DEFAULT NULL',
        'barangay'          => 'VARCHAR(80) NULL DEFAULT NULL',
        'education_level'   => 'VARCHAR(20) NULL DEFAULT NULL',
        'category'          => 'VARCHAR(40) NULL DEFAULT NULL',
    ];

    private const APPLICATION_COLUMNS = [
        'low_match_ack'  => 'TINYINT(1) NOT NULL DEFAULT 0',
        'offer_salary'   => 'DECIMAL(10,2) NULL DEFAULT NULL',
        'offer_start'    => 'DATE NULL DEFAULT NULL',
        'offer_details'  => 'VARCHAR(1000) NULL DEFAULT NULL',
        'decided_at'     => 'DATETIME NULL DEFAULT NULL',
    ];

    private const SUBSCRIPTION_COLUMNS = [
        'scheduled_plan_id'    => 'VARCHAR(50) NULL DEFAULT NULL',
        'cancel_at_period_end' => 'TINYINT(1) NOT NULL DEFAULT 0',
        'renewal_reminded_at'  => 'DATETIME NULL DEFAULT NULL',
    ];

    /** keyword → category, used once to fill jobs.category for existing posts */
    private const CATEGORY_WORDS = [
        'construction' => ['mason', 'carpent', 'construction', 'welder', 'welding', 'plumb', 'laborer', 'foreman', 'tile', 'painter', 'steel'],
        'electrical'   => ['electric', 'wiring', 'solar', 'aircon', 'refrigeration'],
        'automotive'   => ['mechanic', 'driver', 'automotive', 'motor', 'tricycle', 'vulcaniz'],
        'food'         => ['cook', 'kitchen', 'baker', 'barista', 'food', 'waiter', 'service crew', 'restaurant', 'bartend'],
        'hospitality'  => ['housekeep', 'front desk', 'resort', 'hotel', 'tour', 'dive', 'room attendant'],
        'agriculture'  => ['farm', 'agri', 'harvest', 'fish', 'livestock', 'coconut', 'rice', 'calamansi'],
        'care'         => ['caregiver', 'nanny', 'yaya', 'helper', 'household', 'laundry', 'cleaner', 'cleaning'],
        'office'       => ['clerk', 'admin', 'secretary', 'encoder', 'cashier', 'bookkeep', 'account', 'sales', 'customer service'],
        'tech'         => ['computer', 'it ', 'developer', 'programmer', 'technician', 'cctv', 'graphic', 'design', 'video', 'social media'],
        'health'       => ['nurse', 'midwife', 'pharma', 'medical', 'health', 'massage', 'therapist'],
        'beauty'       => ['beauty', 'barber', 'salon', 'nail', 'hairdress', 'makeup'],
        'education'    => ['teacher', 'tutor', 'instructor', 'trainer'],
    ];

    public function __construct()
    {
        $this->_lava = lava_instance();
        $this->_lava->call->dbforge();
        $this->_lava->call->database();
    }

    private function add_columns(string $table, array $cols): void
    {
        foreach ($cols as $col => $def) {
            if (!$this->_lava->dbforge->column_exists($table, $col)) {
                $this->_lava->db->raw("ALTER TABLE `{$table}` ADD COLUMN `{$col}` {$def}");
            }
        }
    }

    private function drop_columns(string $table, array $cols): void
    {
        foreach (array_keys($cols) as $col) {
            if ($this->_lava->dbforge->column_exists($table, $col)) $this->_lava->dbforge->drop_column($table, $col);
        }
    }

    public function up()
    {
        $db = $this->_lava->db;

        $this->add_columns('users', self::USER_COLUMNS);
        $this->add_columns('jobs', self::JOB_COLUMNS);
        $this->add_columns('applications', self::APPLICATION_COLUMNS);
        $this->add_columns('subscriptions', self::SUBSCRIPTION_COLUMNS);

        /* ── hiring pipeline history ─────────────────────────── */
        $db->raw("CREATE TABLE IF NOT EXISTS `application_status_history` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `application_id` INT UNSIGNED NOT NULL,
            `from_status` VARCHAR(40) NULL DEFAULT NULL,
            `to_status` VARCHAR(40) NOT NULL,
            `note` VARCHAR(1000) NULL DEFAULT NULL,
            `changed_by` INT UNSIGNED NULL DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `ash_app_idx` (`application_id`, `created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        /* ── verification ────────────────────────────────────── */
        $db->raw("CREATE TABLE IF NOT EXISTS `verification_requests` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `user_id` INT UNSIGNED NOT NULL,
            `account_type` VARCHAR(12) NOT NULL,
            `id_type` VARCHAR(30) NOT NULL,
            `id_number` VARCHAR(60) NULL DEFAULT NULL,
            `name_on_id` VARCHAR(150) NULL DEFAULT NULL,
            `file_name` VARCHAR(255) NULL DEFAULT NULL,
            `file_mime` VARCHAR(80) NOT NULL,
            `file_size` INT UNSIGNED NOT NULL DEFAULT 0,
            `file_data` MEDIUMTEXT NOT NULL,
            `selfie_mime` VARCHAR(80) NULL DEFAULT NULL,
            `selfie_data` MEDIUMTEXT NULL,
            `checks` VARCHAR(1000) NULL DEFAULT NULL,
            `status` VARCHAR(12) NOT NULL DEFAULT 'pending',
            `reason` VARCHAR(500) NULL DEFAULT NULL,
            `reviewed_by` INT UNSIGNED NULL DEFAULT NULL,
            `reviewed_at` DATETIME NULL DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `vr_user_idx` (`user_id`, `created_at`),
            KEY `vr_status_idx` (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->raw("CREATE TABLE IF NOT EXISTS `verification_history` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `user_id` INT UNSIGNED NOT NULL,
            `request_id` INT UNSIGNED NULL DEFAULT NULL,
            `action` VARCHAR(30) NOT NULL,
            `from_status` VARCHAR(16) NULL DEFAULT NULL,
            `to_status` VARCHAR(16) NULL DEFAULT NULL,
            `reason` VARCHAR(500) NULL DEFAULT NULL,
            `actor_id` INT UNSIGNED NULL DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `vh_user_idx` (`user_id`, `created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->raw("CREATE TABLE IF NOT EXISTS `phone_otps` (
            `user_id` INT UNSIGNED NOT NULL,
            `phone` VARCHAR(20) NOT NULL,
            `code_hash` VARCHAR(255) NOT NULL,
            `attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
            `expires_at` DATETIME NOT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`user_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        /* ── payments ────────────────────────────────────────── */
        $db->raw("CREATE TABLE IF NOT EXISTS `payments` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `user_id` INT UNSIGNED NOT NULL,
            `subscription_id` INT UNSIGNED NULL DEFAULT NULL,
            `reference` VARCHAR(40) NOT NULL,
            `purpose` VARCHAR(20) NOT NULL DEFAULT 'subscription',
            `plan_id` VARCHAR(50) NULL DEFAULT NULL,
            `plan_name` VARCHAR(100) NULL DEFAULT NULL,
            `billing_cycle` VARCHAR(20) NULL DEFAULT NULL,
            `change_type` VARCHAR(12) NULL DEFAULT NULL,
            `amount` DECIMAL(10,2) NOT NULL DEFAULT 0,
            `fee` DECIMAL(10,2) NULL DEFAULT NULL,
            `net_amount` DECIMAL(10,2) NULL DEFAULT NULL,
            `currency` CHAR(3) NOT NULL DEFAULT 'PHP',
            `method` VARCHAR(30) NULL DEFAULT NULL,
            `status` VARCHAR(12) NOT NULL DEFAULT 'pending',
            `failure_reason` VARCHAR(255) NULL DEFAULT NULL,
            `paymongo_session_id` VARCHAR(100) NULL DEFAULT NULL,
            `paymongo_payment_id` VARCHAR(100) NULL DEFAULT NULL,
            `checkout_url` VARCHAR(500) NULL DEFAULT NULL,
            `refund_status` VARCHAR(12) NULL DEFAULT NULL,
            `refunded_amount` DECIMAL(10,2) NULL DEFAULT NULL,
            `paymongo_refund_id` VARCHAR(100) NULL DEFAULT NULL,
            `refund_reason` VARCHAR(255) NULL DEFAULT NULL,
            `receipt_no` VARCHAR(40) NULL DEFAULT NULL,
            `is_test` TINYINT(1) NOT NULL DEFAULT 1,
            `paid_at` DATETIME NULL DEFAULT NULL,
            `expires_at` DATETIME NULL DEFAULT NULL,
            `last_checked_at` DATETIME NULL DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            UNIQUE KEY `pay_reference_uq` (`reference`),
            UNIQUE KEY `pay_pm_payment_uq` (`paymongo_payment_id`),
            KEY `pay_session_idx` (`paymongo_session_id`),
            KEY `pay_user_idx` (`user_id`, `created_at`),
            KEY `pay_status_idx` (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->raw("CREATE TABLE IF NOT EXISTS `subscription_events` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `user_id` INT UNSIGNED NOT NULL,
            `subscription_id` INT UNSIGNED NULL DEFAULT NULL,
            `payment_id` INT UNSIGNED NULL DEFAULT NULL,
            `event` VARCHAR(20) NOT NULL,
            `from_plan` VARCHAR(50) NULL DEFAULT NULL,
            `to_plan` VARCHAR(50) NULL DEFAULT NULL,
            `unlocked` VARCHAR(1000) NULL DEFAULT NULL,
            `locked` VARCHAR(1000) NULL DEFAULT NULL,
            `note` VARCHAR(500) NULL DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `se_user_idx` (`user_id`, `created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->raw("CREATE TABLE IF NOT EXISTS `paymongo_events` (
            `event_id` VARCHAR(100) NOT NULL,
            `type` VARCHAR(60) NOT NULL,
            `received_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`event_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        /* ── gigs: proposals → contract → milestones → delivery → completion → review ── */
        $db->raw("CREATE TABLE IF NOT EXISTS `proposals` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `gig_id` INT UNSIGNED NOT NULL,
            `worker_id` INT UNSIGNED NOT NULL,
            `client_id` INT UNSIGNED NOT NULL,
            `bid_amount` DECIMAL(10,2) NOT NULL,
            `delivery_days` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
            `cover_letter` VARCHAR(2000) NOT NULL,
            `match_score` TINYINT UNSIGNED NULL DEFAULT NULL,
            `status` VARCHAR(12) NOT NULL DEFAULT 'submitted',
            `client_note` VARCHAR(500) NULL DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            UNIQUE KEY `pr_gig_worker_uq` (`gig_id`, `worker_id`),
            KEY `pr_worker_idx` (`worker_id`),
            KEY `pr_client_idx` (`client_id`, `status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->raw("CREATE TABLE IF NOT EXISTS `contracts` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `gig_id` INT UNSIGNED NULL DEFAULT NULL,
            `proposal_id` INT UNSIGNED NULL DEFAULT NULL,
            `service_id` INT UNSIGNED NULL DEFAULT NULL,
            `client_id` INT UNSIGNED NOT NULL,
            `worker_id` INT UNSIGNED NOT NULL,
            `title` VARCHAR(255) NOT NULL,
            `scope` VARCHAR(2000) NULL DEFAULT NULL,
            `agreed_amount` DECIMAL(10,2) NOT NULL,
            `due_date` DATE NULL DEFAULT NULL,
            `status` VARCHAR(20) NOT NULL DEFAULT 'active',
            `payment_status` VARCHAR(12) NOT NULL DEFAULT 'unpaid',
            `payment_method` VARCHAR(20) NULL DEFAULT NULL,
            `payment_note` VARCHAR(255) NULL DEFAULT NULL,
            `paid_marked_at` DATETIME NULL DEFAULT NULL,
            `paid_confirmed_at` DATETIME NULL DEFAULT NULL,
            `revisions_used` TINYINT UNSIGNED NOT NULL DEFAULT 0,
            `revisions_allowed` TINYINT UNSIGNED NOT NULL DEFAULT 2,
            `cancel_reason` VARCHAR(500) NULL DEFAULT NULL,
            `cancelled_by` INT UNSIGNED NULL DEFAULT NULL,
            `started_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `delivered_at` DATETIME NULL DEFAULT NULL,
            `completed_at` DATETIME NULL DEFAULT NULL,
            `updated_at` DATETIME NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            UNIQUE KEY `ct_proposal_uq` (`proposal_id`),
            KEY `ct_client_idx` (`client_id`, `status`),
            KEY `ct_worker_idx` (`worker_id`, `status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // a worker's own service listing ("Aircon cleaning, P800, Calapan"); a client can book it directly
        $db->raw("CREATE TABLE IF NOT EXISTS `worker_services` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `worker_id` INT UNSIGNED NOT NULL,
            `title` VARCHAR(150) NOT NULL,
            `description` VARCHAR(2000) NULL DEFAULT NULL,
            `category` VARCHAR(40) NULL DEFAULT NULL,
            `price` DECIMAL(10,2) NOT NULL,
            `price_unit` VARCHAR(10) NOT NULL DEFAULT 'job',
            `delivery_days` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
            `service_area` VARCHAR(500) NULL DEFAULT NULL,
            `status` VARCHAR(10) NOT NULL DEFAULT 'active',
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `wsv_worker_idx` (`worker_id`, `status`),
            KEY `wsv_category_idx` (`category`, `status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->raw("CREATE TABLE IF NOT EXISTS `contract_milestones` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `contract_id` INT UNSIGNED NOT NULL,
            `title` VARCHAR(150) NOT NULL,
            `amount` DECIMAL(10,2) NOT NULL DEFAULT 0,
            `due_date` DATE NULL DEFAULT NULL,
            `status` VARCHAR(12) NOT NULL DEFAULT 'pending',
            `position` TINYINT UNSIGNED NOT NULL DEFAULT 0,
            `submitted_at` DATETIME NULL DEFAULT NULL,
            `approved_at` DATETIME NULL DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `cm_contract_idx` (`contract_id`, `position`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->raw("CREATE TABLE IF NOT EXISTS `contract_events` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `contract_id` INT UNSIGNED NOT NULL,
            `actor_id` INT UNSIGNED NULL DEFAULT NULL,
            `event` VARCHAR(30) NOT NULL,
            `note` VARCHAR(2000) NULL DEFAULT NULL,
            `file_name` VARCHAR(255) NULL DEFAULT NULL,
            `file_mime` VARCHAR(80) NULL DEFAULT NULL,
            `file_data` MEDIUMTEXT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `ce_contract_idx` (`contract_id`, `created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->raw("CREATE TABLE IF NOT EXISTS `disputes` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `contract_id` INT UNSIGNED NOT NULL,
            `opened_by` INT UNSIGNED NOT NULL,
            `reason` VARCHAR(40) NOT NULL,
            `details` VARCHAR(2000) NOT NULL,
            `status` VARCHAR(12) NOT NULL DEFAULT 'open',
            `resolution` VARCHAR(20) NULL DEFAULT NULL,
            `resolution_note` VARCHAR(1000) NULL DEFAULT NULL,
            `resolved_by` INT UNSIGNED NULL DEFAULT NULL,
            `resolved_at` DATETIME NULL DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `dp_contract_idx` (`contract_id`),
            KEY `dp_status_idx` (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->raw("CREATE TABLE IF NOT EXISTS `contract_reviews` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `contract_id` INT UNSIGNED NOT NULL,
            `reviewer_id` INT UNSIGNED NOT NULL,
            `reviewee_id` INT UNSIGNED NOT NULL,
            `rating` TINYINT UNSIGNED NOT NULL,
            `comment` VARCHAR(1000) NULL DEFAULT NULL,
            `is_hidden` TINYINT(1) NOT NULL DEFAULT 0,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `cr_contract_reviewer_uq` (`contract_id`, `reviewer_id`),
            KEY `cr_reviewee_idx` (`reviewee_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        /* ── carry existing data over ────────────────────────── */
        // client posts are gigs
        $db->raw("UPDATE jobs j JOIN users u ON u.id = j.employer_id SET j.post_type = 'gig' WHERE u.account_type = 'hirer'");
        // every open post gets an end date (60 days for jobs, 30 for gigs), never earlier than 30 days from today
        $db->raw("UPDATE jobs SET expires_at = GREATEST(DATE_ADD(created_at, INTERVAL IF(post_type = 'gig', 30, 60) DAY), DATE_ADD(NOW(), INTERVAL 30 DAY)) WHERE expires_at IS NULL");
        // an account already checked by an admin is verified
        $db->raw("UPDATE users SET verification_status = 'verified' WHERE is_verified = 1 AND verification_status = 'unverified'");
        // existing accounts accepted the terms that were shown at sign-up
        $db->raw("UPDATE users SET terms_version = '2026-11-13', privacy_version = '2026-11-13', terms_accepted_at = created_at, privacy_accepted_at = created_at WHERE terms_version IS NULL");

        // categories for existing posts
        $jobs = $db->raw("SELECT id, title, skills_needed FROM jobs WHERE category IS NULL")->fetchAll(\PDO::FETCH_ASSOC) ?: [];
        foreach ($jobs as $j) {
            $text = ' ' . strtolower($j['title'] . ' ' . $j['skills_needed']) . ' ';
            $cat = 'other';
            foreach (self::CATEGORY_WORDS as $c => $words) {
                foreach ($words as $w) { if (str_contains($text, $w)) { $cat = $c; break 2; } }
            }
            $db->raw('UPDATE jobs SET category = ? WHERE id = ?', [$cat, (int) $j['id']]);
        }

        // payments from the subscription history (paid plans only)
        $subs = $db->raw("SELECT * FROM subscriptions WHERE price > 0 AND id NOT IN (SELECT subscription_id FROM payments WHERE subscription_id IS NOT NULL)")->fetchAll(\PDO::FETCH_ASSOC) ?: [];
        foreach ($subs as $s) {
            $status = in_array($s['status'], ['active', 'superseded', 'expired', 'cancelled'], true) ? 'paid'
                : ($s['status'] === 'pending' ? 'pending' : 'cancelled');
            $ref = $s['payment_reference'] ?: ('HB-SUB-' . $s['id']);
            $db->raw(
                "INSERT IGNORE INTO payments (user_id, subscription_id, reference, plan_id, plan_name, billing_cycle, change_type, amount, method, status,
                    paymongo_session_id, receipt_no, is_test, paid_at, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, 1, ?, ?, NOW())",
                [(int) $s['user_id'], (int) $s['id'], $ref, $s['plan_id'], $s['plan_name'], $s['billing_cycle'], $s['price'],
                 str_replace('paymongo_', '', (string) $s['payment_method']), $status, $s['paymongo_session_id'] ?? null,
                 $status === 'paid' ? 'OR-' . str_pad((string) $s['id'], 6, '0', STR_PAD_LEFT) : null,
                 $status === 'paid' ? $s['starts_at'] : null, $s['created_at']]
            );
            if ($status === 'paid') {
                $db->raw("INSERT INTO subscription_events (user_id, subscription_id, event, to_plan, note, created_at) VALUES (?, ?, 'subscribed', ?, 'Carried over from earlier records', ?)",
                    [(int) $s['user_id'], (int) $s['id'], $s['plan_id'], $s['starts_at']]);
            }
        }
        // older code activated a plan in a second row that reused the pending row's reference;
        // the payment row came from the pending one, so mark it as the paid one it really was
        $db->raw("UPDATE payments p JOIN subscriptions s ON s.payment_reference = p.reference AND s.user_id = p.user_id
                     AND s.id <> p.subscription_id AND s.status IN ('active','superseded','expired','cancelled')
                  SET p.status = 'paid', p.subscription_id = s.id, p.paid_at = s.starts_at,
                      p.receipt_no = COALESCE(p.receipt_no, CONCAT('OR-', LPAD(s.id, 6, '0')))
                  WHERE p.status = 'pending'");
    }

    public function down()
    {
        foreach (['contract_reviews', 'disputes', 'contract_events', 'contract_milestones', 'worker_services', 'contracts', 'proposals',
                  'paymongo_events', 'subscription_events', 'payments', 'phone_otps', 'verification_history',
                  'verification_requests', 'application_status_history'] as $t) {
            $this->_lava->db->raw("DROP TABLE IF EXISTS `{$t}`");
        }
        $this->drop_columns('subscriptions', self::SUBSCRIPTION_COLUMNS);
        $this->drop_columns('applications', self::APPLICATION_COLUMNS);
        $this->drop_columns('jobs', self::JOB_COLUMNS);
        $this->drop_columns('users', self::USER_COLUMNS);
    }
}
