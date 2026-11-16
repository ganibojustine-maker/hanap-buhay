<?php
/**
 * seed_demo.php — sample data for the panel demo, covering every screen and every status.
 *
 *   php seed_demo.php           add the demo data (skips if it is already there)
 *   php seed_demo.php --reset   remove the demo data, then add it again
 *   php seed_demo.php --remove  remove the demo data only
 *
 * Everything it creates uses emails ending in @demo.hanapbuhay.test, so it is easy to find
 * and remove. All demo accounts share the password printed at the end.
 *
 * It writes to the database in backend/.env. Run it on a test or demo database, not on
 * the live site.
 *
 * What you get:
 *   1 admin, 3 employers, 3 clients, 8 workers across the province
 *   jobs and gigs (live, waiting for review, sent back, ended), with categories and barangays
 *   applications at every hiring step, with history
 *   gig proposals, contracts (in progress, delivered, completed and paid, cancelled, disputed)
 *   worker service listings, ID verification requests (pending, approved, asked to resend)
 *   PayMongo test payments in every status (paid, pending, failed, expired, cancelled, refunded)
 *   and the matching plan timeline.
 */

$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || strpos($line, '=') === false) continue;
        [$k, $v] = explode('=', $line, 2);
        $_ENV[trim($k)] = trim($v, " \t\n\r\0\x0B\"'");
    }
}
$opts = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC];
if (filter_var($_ENV['DB_SSL'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
    $ca = $_ENV['DB_SSL_CA'] ?? '';
    if ($ca !== '' && !str_starts_with($ca, '/') && !preg_match('/^[A-Za-z]:/', $ca)) $ca = __DIR__ . '/' . $ca;
    if ($ca && is_file($ca)) $opts[PDO::MYSQL_ATTR_SSL_CA] = $ca;
    $opts[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
}
$pdo = new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_NAME'] ?? ''),
    $_ENV['DB_USER'] ?? '', $_ENV['DB_PASSWORD'] ?? '', $opts);

$need = $pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'contracts'")->fetchColumn();
if (!$need) { fwrite(STDERR, "Run the database migrations first (php public/index.php migrate).\n"); exit(1); }

const DOMAIN = '@demo.hanapbuhay.test';
const PASSWORD = 'Demo-Mindoro-2026';

function q(PDO $pdo, string $sql, array $a = []) { $s = $pdo->prepare($sql); $s->execute($a); return $s; }
function ins(PDO $pdo, string $table, array $row): int
{
    q($pdo, "INSERT INTO `$table` (" . implode(',', array_map(fn($k) => "`$k`", array_keys($row))) . ') VALUES (' . implode(',', array_fill(0, count($row), '?')) . ')', array_values($row));
    return (int) $pdo->lastInsertId();
}
function ago(int $days, int $hours = 0): string { return date('Y-m-d H:i:s', time() - $days * 86400 - $hours * 3600); }
function ahead(int $days): string { return date('Y-m-d H:i:s', time() + $days * 86400); }

function remove_demo(PDO $pdo): void
{
    $ids = q($pdo, 'SELECT id FROM users WHERE email LIKE ?', ['%' . DOMAIN])->fetchAll(PDO::FETCH_COLUMN);
    if (!$ids) return;
    $in = implode(',', array_map('intval', $ids));
    $jobs = q($pdo, "SELECT id FROM jobs WHERE employer_id IN ($in)")->fetchAll(PDO::FETCH_COLUMN);
    $jin = $jobs ? implode(',', array_map('intval', $jobs)) : '0';
    $contracts = q($pdo, "SELECT id FROM contracts WHERE client_id IN ($in) OR worker_id IN ($in)")->fetchAll(PDO::FETCH_COLUMN);
    $cin = $contracts ? implode(',', array_map('intval', $contracts)) : '0';
    $apps = q($pdo, "SELECT id FROM applications WHERE job_id IN ($jin) OR worker_id IN ($in)")->fetchAll(PDO::FETCH_COLUMN);
    $ain = $apps ? implode(',', array_map('intval', $apps)) : '0';
    foreach ([
        "DELETE FROM application_status_history WHERE application_id IN ($ain)",
        "DELETE FROM applications WHERE id IN ($ain)",
        "DELETE FROM contract_events WHERE contract_id IN ($cin)", "DELETE FROM contract_milestones WHERE contract_id IN ($cin)",
        "DELETE FROM disputes WHERE contract_id IN ($cin)", "DELETE FROM contract_reviews WHERE contract_id IN ($cin)",
        "DELETE FROM contracts WHERE id IN ($cin)", "DELETE FROM proposals WHERE gig_id IN ($jin) OR worker_id IN ($in)",
        "DELETE FROM jobs WHERE id IN ($jin)", "DELETE FROM worker_services WHERE worker_id IN ($in)",
        "DELETE FROM skills_passport WHERE user_id IN ($in)", "DELETE FROM skill_certificates WHERE user_id IN ($in)",
        "DELETE FROM verification_requests WHERE user_id IN ($in)", "DELETE FROM verification_history WHERE user_id IN ($in)",
        "DELETE FROM payments WHERE user_id IN ($in)", "DELETE FROM subscription_events WHERE user_id IN ($in)",
        "DELETE FROM subscriptions WHERE user_id IN ($in)", "DELETE FROM notifications WHERE user_id IN ($in)",
        "DELETE FROM users WHERE id IN ($in)",
    ] as $sql) $pdo->exec($sql);
    echo "Removed the demo data.\n";
}

$arg = $argv[1] ?? '';
if ($arg === '--remove' || $arg === '--reset') remove_demo($pdo);
if ($arg === '--remove') exit(0);
if (q($pdo, 'SELECT COUNT(*) FROM users WHERE email LIKE ?', ['%' . DOMAIN])->fetchColumn()) {
    echo "Demo data is already there. Use --reset to add it again.\n"; exit(0);
}

$hash = password_hash(PASSWORD, PASSWORD_DEFAULT);
$terms = '2026-11-16';
function user(PDO $pdo, string $hash, string $terms, array $u): int
{
    static $n = 0; $n++;
    return ins($pdo, 'users', $u + [
        'username' => 'demo' . $n . bin2hex(random_bytes(2)), 'password' => $hash, 'role' => 'user', 'is_active' => 1,
        'email_verified_at' => ago(30), 'terms_version' => $terms, 'terms_accepted_at' => ago(30), 'privacy_version' => $terms, 'privacy_accepted_at' => ago(30),
        'created_at' => ago(40), 'avatar_color' => $n % 8,
    ]);
}

/* ── people ─────────────────────────────────────────────── */
$admin = user($pdo, $hash, $terms, ['email' => 'admin' . DOMAIN, 'full_name' => 'Demo Admin', 'role' => 'admin', 'location' => 'Calapan City', 'phone' => '09170000100']);

$emp = [];
foreach ([
    ['resort', 'Tamaraw Bay Resort', 'Puerto Galera', 'Sabang', 'verified', 'employer_growth'],
    ['build', 'Calapan Builders Corp.', 'Calapan City', 'Lalud', 'verified', 'employer_starter'],
    ['agri', 'Naujan Agri Supply', 'Naujan', 'Poblacion II', 'pending', 'employer_starter'],
] as [$k, $name, $town, $brgy, $vs, $tier]) {
    $emp[$k] = user($pdo, $hash, $terms, ['email' => "employer.$k" . DOMAIN, 'full_name' => $name, 'account_type' => 'employer', 'location' => $town, 'barangay' => $brgy,
        'phone' => '0917' . random_int(1000000, 9999999), 'phone_verified_at' => ago(20), 'verification_status' => $vs, 'is_verified' => $vs === 'verified' ? 1 : 0,
        'subscription_tier' => $tier, 'subscription_expires_at' => $tier === 'employer_growth' ? ahead(18) : null, 'contact_credits' => $tier === 'employer_growth' ? 27 : 5, 'featured_credits' => $tier === 'employer_growth' ? 1 : 0,
        'bio' => "$name hires in $town, Oriental Mindoro."]);
}
$cli = [];
foreach ([
    ['maria', 'Maria Santos', 'Calapan City', 'San Vicente Central (Pob.)', 'verified', 'hirer_service_pass'],
    ['jose', 'Jose Mercado', 'Pinamalayan', 'Zone I (Pob.)', 'pending', 'hirer_free'],
    ['ana', 'Ana Villareal', 'Roxas', 'Bagumbayan (Pob.)', 'unverified', 'hirer_free'],
] as [$k, $name, $town, $brgy, $vs, $tier]) {
    $cli[$k] = user($pdo, $hash, $terms, ['email' => "client.$k" . DOMAIN, 'full_name' => $name, 'account_type' => 'hirer', 'location' => $town, 'barangay' => $brgy,
        'phone' => '0918' . random_int(1000000, 9999999), 'phone_verified_at' => $vs !== 'unverified' ? ago(15) : null, 'verification_status' => $vs, 'is_verified' => $vs === 'verified' ? 1 : 0,
        'subscription_tier' => $tier, 'subscription_expires_at' => $tier === 'hirer_service_pass' ? ahead(2) : null, 'contact_credits' => $tier === 'hirer_service_pass' ? 12 : 3, 'featured_credits' => 0]);
}
$wk = [];
$skillsFor = [
    'rey'    => ['Rey Dimaculangan', 'Calapan City', 'Bayanan I', 'vocational', 6, [['Welding', 'advanced', 'tesda', 'Shielded Metal Arc Welding (SMAW) NC II', true], ['Safety Training', 'intermediate', 'training', '', false]]],
    'liza'   => ['Liza Panganiban', 'Puerto Galera', 'Sabang', 'college', 3, [['Front Office Services', 'advanced', 'tesda', 'Front Office Services NC II', true], ['Housekeeping', 'intermediate', 'self', '', false], ['Customer Service', 'advanced', 'self', '', false]]],
    'mark'   => ['Mark Alcantara', 'Naujan', 'Poblacion I', 'senior_high', 2, [['Electrical Installation and Maintenance', 'intermediate', 'tesda', 'EIM NC II', false], ['Aircon Servicing', 'intermediate', 'self', '', false]]],
    'joy'    => ['Joy Macaraig', 'Victoria', 'Poblacion I', 'high_school', 1, [['Housekeeping', 'beginner', 'self', '', false], ['Caregiving', 'intermediate', 'self', '', false]]],
    'ben'    => ['Ben Tolentino', 'Socorro', 'Zone I (Pob.)', 'high_school', 4, [['Plumbing', 'advanced', 'self', '', false], ['Carpentry', 'intermediate', 'self', '', false]]],
    'grace'  => ['Grace Ilagan', 'Pinamalayan', 'Zone IV (Pob.)', 'college', 2, [['Bookkeeping', 'intermediate', 'tesda', 'Bookkeeping NC III', true], ['Cashiering', 'advanced', 'self', '', false]]],
    'paolo'  => ['Paolo Garing', 'Roxas', 'Odiong', 'senior_high', 0, [['Driving', 'intermediate', 'self', '', false]]],
    'nina'   => ['Nina Delos Reyes', 'Bongabong', 'Poblacion', 'vocational', 3, [['Cookery', 'advanced', 'tesda', 'Cookery NC II', true], ['Food and Beverage Services', 'intermediate', 'self', '', false]]],
];
$vstate = ['rey' => 'verified', 'liza' => 'verified', 'mark' => 'pending', 'joy' => 'resubmit', 'ben' => 'verified', 'grace' => 'unverified', 'paolo' => 'unverified', 'nina' => 'verified'];
foreach ($skillsFor as $k => [$name, $town, $brgy, $edu, $yrs, $skills]) {
    $id = user($pdo, $hash, $terms, ['email' => "worker.$k" . DOMAIN, 'full_name' => $name, 'account_type' => 'worker', 'location' => $town, 'barangay' => $brgy,
        'education_level' => $edu, 'experience_years' => $yrs, 'phone' => '0927' . random_int(1000000, 9999999),
        'phone_verified_at' => $vstate[$k] === 'unverified' ? null : ago(12), 'verification_status' => $vstate[$k], 'is_verified' => $vstate[$k] === 'verified' ? 1 : 0,
        'open_to_work' => 1, 'bio' => "Skilled worker from $town."]);
    $wk[$k] = $id;
    foreach ($skills as [$s, $lvl, $src, $cert, $ver]) {
        $certId = null;
        if ($cert) {
            $certId = ins($pdo, 'skill_certificates', ['user_id' => $id, 'title' => $cert, 'issuer' => 'TESDA', 'nc_level' => preg_match('/NC (I{1,3}|IV)/', $cert, $m) ? $m[1] : null,
                'holder_name' => $name, 'issued_on' => date('Y-m-d', time() - 400 * 86400), 'file_name' => 'certificate.jpg', 'file_mime' => 'image/jpeg', 'file_size' => 0,
                'file_data' => '', 'status' => $ver ? 'verified' : 'pending', 'created_at' => ago(60)]);
        }
        ins($pdo, 'skills_passport', ['user_id' => $id, 'skill_name' => $s, 'category' => 'General', 'level' => $lvl, 'source' => $src, 'certificate' => $cert ?: null,
            'certificate_id' => $certId, 'verified' => $ver ? 1 : 0, 'created_at' => ago(50)]);
    }
}

/* ── verification requests and history ──────────────────── */
$pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
foreach (['rey' => 'verified', 'liza' => 'verified', 'mark' => 'pending', 'joy' => 'resubmit', 'ben' => 'verified', 'nina' => 'verified'] as $k => $st) {
    $rid = ins($pdo, 'verification_requests', ['user_id' => $wk[$k], 'account_type' => 'worker', 'id_type' => $k === 'mark' ? 'philsys' : 'drivers', 'id_number' => 'DEMO-' . strtoupper($k) . '-1234',
        'name_on_id' => $skillsFor[$k][0], 'file_name' => 'id.png', 'file_mime' => 'image/png', 'file_size' => 68, 'file_data' => $pixel,
        'checks' => json_encode(['id_unique' => true, 'name_match' => $k !== 'joy', 'email_confirmed' => true, 'phone_confirmed' => true, 'has_selfie' => false]),
        'status' => $st, 'reason' => $st === 'resubmit' ? 'The photo is blurry. Please retake it in good light so the name and number can be read.' : null,
        'reviewed_by' => $st === 'pending' ? null : $admin, 'reviewed_at' => $st === 'pending' ? null : ago(5), 'created_at' => ago(8)]);
    ins($pdo, 'verification_history', ['user_id' => $wk[$k], 'request_id' => $rid, 'action' => 'submitted', 'to_status' => 'pending', 'actor_id' => $wk[$k], 'created_at' => ago(8)]);
    if ($st !== 'pending') ins($pdo, 'verification_history', ['user_id' => $wk[$k], 'request_id' => $rid, 'action' => $st === 'verified' ? 'approved' : 'resubmission_requested',
        'to_status' => $st, 'reason' => $st === 'resubmit' ? 'The photo is blurry. Please retake it in good light.' : null, 'actor_id' => $admin, 'created_at' => ago(5)]);
}
$rid = ins($pdo, 'verification_requests', ['user_id' => $cli['jose'], 'account_type' => 'hirer', 'id_type' => 'umid', 'id_number' => 'DEMO-JOSE-5678', 'name_on_id' => 'Jose Mercado',
    'file_name' => 'id.png', 'file_mime' => 'image/png', 'file_size' => 68, 'file_data' => $pixel, 'checks' => json_encode(['id_unique' => true, 'name_match' => true, 'email_confirmed' => true, 'phone_confirmed' => true, 'has_selfie' => false]),
    'status' => 'pending', 'created_at' => ago(1)]);
ins($pdo, 'verification_history', ['user_id' => $cli['jose'], 'request_id' => $rid, 'action' => 'submitted', 'to_status' => 'pending', 'actor_id' => $cli['jose'], 'created_at' => ago(1)]);

/* ── jobs (employers) ───────────────────────────────────── */
function job(PDO $pdo, array $j): int
{
    return ins($pdo, 'jobs', $j + ['status' => 'active', 'moderation_status' => 'approved', 'post_type' => 'job', 'job_type' => 'full-time', 'pay_basis' => 'month',
        'created_at' => ago(5), 'expires_at' => ahead(45), 'views' => random_int(20, 200), 'is_featured' => 0]);
}
$J = [];
$J['welder']  = job($pdo, ['employer_id' => $emp['build'], 'title' => 'Welder (SMAW)', 'company' => 'Calapan Builders Corp.', 'location' => 'Calapan City', 'barangay' => 'Lalud', 'category' => 'construction',
    'description' => 'Fabricate and repair steel structures for residential and commercial projects.', 'skills_needed' => 'Welding NC II, Safety Training', 'experience' => '2-3', 'education_level' => 'senior_high',
    'salary_min' => 16000, 'salary_max' => 19000, 'openings' => 3, 'benefits' => 'SSS, PhilHealth, Pag-IBIG, 13th month pay', 'is_featured' => 1, 'featured_until' => ahead(20)]);
$J['frontdesk'] = job($pdo, ['employer_id' => $emp['resort'], 'title' => 'Front Desk Officer', 'company' => 'Tamaraw Bay Resort', 'location' => 'Puerto Galera', 'barangay' => 'Sabang', 'category' => 'hospitality',
    'description' => 'Welcome guests, handle check-in and check-out, and answer calls.', 'skills_needed' => 'Front Office Services NC II, Customer Service', 'experience' => '1', 'education_level' => 'college',
    'salary_min' => 15000, 'salary_max' => 17000, 'openings' => 2, 'benefits' => 'Free meals, Free accommodation, SSS, PhilHealth', 'created_at' => ago(9)]);
$J['house'] = job($pdo, ['employer_id' => $emp['resort'], 'title' => 'Room Attendant', 'company' => 'Tamaraw Bay Resort', 'location' => 'Puerto Galera', 'barangay' => 'Sabang', 'category' => 'hospitality',
    'description' => 'Clean and prepare guest rooms to resort standards.', 'skills_needed' => 'Housekeeping', 'experience' => 'none', 'salary_min' => 12500, 'salary_max' => 13500, 'openings' => 4, 'created_at' => ago(3)]);
$J['electric'] = job($pdo, ['employer_id' => $emp['build'], 'title' => 'Electrician', 'company' => 'Calapan Builders Corp.', 'location' => 'Calapan City', 'barangay' => 'Ibaba East (Pob.)', 'category' => 'electrical',
    'description' => 'Install and maintain electrical systems on building sites.', 'skills_needed' => 'Electrical Installation and Maintenance NC II', 'experience' => '1', 'salary_min' => 15500, 'salary_max' => 18000, 'created_at' => ago(12)]);
$J['agri'] = job($pdo, ['employer_id' => $emp['agri'], 'title' => 'Store Cashier', 'company' => 'Naujan Agri Supply', 'location' => 'Naujan', 'barangay' => 'Poblacion II', 'category' => 'office',
    'description' => 'Handle payments and keep the daily sales record.', 'skills_needed' => 'Cashiering, Bookkeeping', 'experience' => '1', 'salary_min' => 12000, 'salary_max' => 13000,
    'status' => 'draft', 'moderation_status' => 'pending', 'created_at' => ago(0, 5)]);
$J['bad'] = job($pdo, ['employer_id' => $emp['agri'], 'title' => 'Sales Agent (with registration fee)', 'company' => 'Naujan Agri Supply', 'location' => 'Naujan', 'category' => 'office',
    'description' => 'Pay a registration fee to start.', 'skills_needed' => 'Sales', 'status' => 'closed', 'moderation_status' => 'rejected',
    'moderation_note' => 'Job posts must not ask workers to pay any fee. Remove the registration fee and we will check it again.', 'created_at' => ago(4)]);
$J['ended'] = job($pdo, ['employer_id' => $emp['resort'], 'title' => 'Dive Shop Assistant', 'company' => 'Tamaraw Bay Resort', 'location' => 'Puerto Galera', 'category' => 'hospitality',
    'description' => 'Help with dive gear and guest bookings.', 'skills_needed' => 'Customer Service', 'status' => 'closed', 'created_at' => ago(70), 'expires_at' => ago(10)]);
$J['cook'] = job($pdo, ['employer_id' => $emp['resort'], 'title' => 'Line Cook', 'company' => 'Tamaraw Bay Resort', 'location' => 'Puerto Galera', 'category' => 'food',
    'description' => 'Prepare breakfast and lunch for resort guests.', 'skills_needed' => 'Cookery NC II', 'experience' => '1', 'salary_min' => 14000, 'salary_max' => 16000, 'created_at' => ago(2)]);

/* applications at every step, with history */
function app(PDO $pdo, int $job, int $worker, string $status, int $score, array $steps, array $extra = []): int
{
    $id = ins($pdo, 'applications', ['job_id' => $job, 'worker_id' => $worker, 'cover_note' => 'Good day! I would like to apply for this position.', 'match_score' => $score, 'status' => $status,
        'created_at' => ago(count($steps) + 2), 'updated_at' => ago(1)] + $extra);
    $prev = null; $d = count($steps) + 2;
    foreach (array_merge(['pending'], $steps) as $s) { ins($pdo, 'application_status_history', ['application_id' => $id, 'from_status' => $prev, 'to_status' => $s, 'created_at' => ago($d--)]); $prev = $s; }
    return $id;
}
app($pdo, $J['welder'], $wk['rey'], 'offer', 92, ['reviewed', 'shortlisted', 'for_interview', 'interviewed', 'offer'],
    ['interview_date' => ago(2), 'offer_salary' => 18000, 'offer_start' => date('Y-m-d', time() + 7 * 86400), 'offer_details' => 'Mon to Sat, 8 AM to 5 PM. Bring your NC II and valid ID on day one.']);
app($pdo, $J['welder'], $wk['ben'], 'for_interview', 48, ['reviewed', 'shortlisted', 'for_interview'], ['interview_date' => date('Y-m-d 09:00:00', time() + 3 * 86400), 'interview_notes' => 'Calapan Builders office, Brgy. Lalud. Bring a valid ID.', 'low_match_ack' => 1]);
app($pdo, $J['frontdesk'], $wk['liza'], 'hired', 95, ['reviewed', 'shortlisted', 'for_interview', 'interviewed', 'offer', 'hired'], ['decided_at' => ago(1)]);
app($pdo, $J['house'], $wk['joy'], 'shortlisted', 71, ['reviewed', 'shortlisted']);
app($pdo, $J['house'], $wk['grace'], 'pending', 38, [], ['low_match_ack' => 1]);
app($pdo, $J['electric'], $wk['mark'], 'reviewed', 64, ['reviewed']);
app($pdo, $J['electric'], $wk['paolo'], 'rejected', 22, ['reviewed', 'rejected'], ['interview_notes' => 'We need an NC II holder for this role. Thank you for applying.', 'decided_at' => ago(2)]);
app($pdo, $J['cook'], $wk['nina'], 'interviewed', 88, ['reviewed', 'shortlisted', 'for_interview', 'interviewed'], ['interview_date' => ago(1)]);
app($pdo, $J['frontdesk'], $wk['grace'], 'withdrawn', 55, ['withdrawn'], ['withdrawn_at' => ago(3)]);

/* ── gigs (clients), proposals and contracts ────────────── */
function gig(PDO $pdo, array $j): int
{
    return job($pdo, $j + ['post_type' => 'gig', 'job_type' => 'gig', 'pay_basis' => 'fixed', 'expires_at' => ahead(20), 'openings' => 1]);
}
$G = [];
$G['sink'] = gig($pdo, ['employer_id' => $cli['maria'], 'title' => 'Fix leaking kitchen sink', 'company' => 'Maria Santos', 'location' => 'Calapan City', 'barangay' => 'San Vicente Central (Pob.)', 'category' => 'construction',
    'description' => 'The pipe under the sink leaks. Parts can be bought nearby.', 'skills_needed' => 'Plumbing', 'salary_min' => 800, 'salary_max' => 1500, 'duration' => 'A few hours', 'is_urgent' => 1, 'created_at' => ago(6), 'status' => 'closed']);
$G['aircon'] = gig($pdo, ['employer_id' => $cli['maria'], 'title' => 'Clean two split-type aircons', 'company' => 'Maria Santos', 'location' => 'Calapan City', 'barangay' => 'San Vicente Central (Pob.)', 'category' => 'electrical',
    'description' => 'Two 1.5 HP split-type units, second floor.', 'skills_needed' => 'Aircon Servicing', 'salary_min' => 1500, 'salary_max' => 2000, 'duration' => '1 day', 'created_at' => ago(2)]);
$G['cater'] = gig($pdo, ['employer_id' => $cli['jose'], 'title' => 'Cook for a 50-guest birthday', 'company' => 'Jose Mercado', 'location' => 'Pinamalayan', 'barangay' => 'Zone I (Pob.)', 'category' => 'food',
    'description' => 'Filipino menu for 50 guests on a Saturday. Ingredients provided.', 'skills_needed' => 'Cookery NC II', 'salary_min' => 4000, 'salary_max' => 6000, 'needed_by' => date('Y-m-d', time() + 10 * 86400), 'created_at' => ago(1),
    'status' => 'draft', 'moderation_status' => 'pending']);
$G['paint'] = gig($pdo, ['employer_id' => $cli['ana'], 'title' => 'Repaint the front gate', 'company' => 'Ana Villareal', 'location' => 'Roxas', 'barangay' => 'Bagumbayan (Pob.)', 'category' => 'construction',
    'description' => 'Steel gate, about 3 meters wide. Paint provided.', 'skills_needed' => 'Painting', 'salary_min' => 1000, 'salary_max' => 1800, 'created_at' => ago(8), 'status' => 'closed']);
$G['books'] = gig($pdo, ['employer_id' => $cli['maria'], 'title' => 'Set up bookkeeping for a sari-sari store', 'company' => 'Maria Santos', 'location' => 'Calapan City', 'category' => 'office',
    'description' => 'Simple sales and expense records in a notebook and spreadsheet.', 'skills_needed' => 'Bookkeeping', 'salary_min' => 2500, 'salary_max' => 3500, 'created_at' => ago(15), 'status' => 'closed']);

function proposal(PDO $pdo, int $gig, int $worker, int $client, float $bid, int $days, string $status, int $score): int
{
    return ins($pdo, 'proposals', ['gig_id' => $gig, 'worker_id' => $worker, 'client_id' => $client, 'bid_amount' => $bid, 'delivery_days' => $days,
        'cover_letter' => 'I have done this kind of work many times and can bring my own tools. I can start tomorrow morning.', 'match_score' => $score, 'status' => $status, 'created_at' => ago(4)]);
}
$pSink = proposal($pdo, $G['sink'], $wk['ben'], $cli['maria'], 1200, 1, 'hired', 90);
proposal($pdo, $G['sink'], $wk['mark'], $cli['maria'], 1000, 1, 'not_selected', 35);
proposal($pdo, $G['aircon'], $wk['mark'], $cli['maria'], 1800, 1, 'shortlisted', 78);
proposal($pdo, $G['aircon'], $wk['rey'], $cli['maria'], 1600, 2, 'submitted', 41);
$pPaint = proposal($pdo, $G['paint'], $wk['ben'], $cli['ana'], 1500, 2, 'hired', 52);
$pBooks = proposal($pdo, $G['books'], $wk['grace'], $cli['maria'], 3000, 5, 'hired', 93);

function contract(PDO $pdo, array $c, array $events, array $ms = []): int
{
    $id = ins($pdo, 'contracts', $c + ['revisions_allowed' => 2, 'started_at' => ago(5), 'updated_at' => ago(0, 3)]);
    foreach ($events as $i => [$actor, $event, $note]) ins($pdo, 'contract_events', ['contract_id' => $id, 'actor_id' => $actor, 'event' => $event, 'note' => $note, 'created_at' => ago(count($events) - $i)]);
    foreach ($ms as $i => [$t, $a, $st]) ins($pdo, 'contract_milestones', ['contract_id' => $id, 'title' => $t, 'amount' => $a, 'status' => $st, 'position' => $i, 'created_at' => ago(5)]);
    return $id;
}
// completed and paid, reviewed both ways
$k1 = contract($pdo, ['gig_id' => $G['sink'], 'proposal_id' => $pSink, 'client_id' => $cli['maria'], 'worker_id' => $wk['ben'], 'title' => 'Fix leaking kitchen sink', 'scope' => 'Replace the leaking trap and hose under the kitchen sink.',
    'agreed_amount' => 1200, 'due_date' => date('Y-m-d', time() - 3 * 86400), 'status' => 'completed', 'payment_status' => 'confirmed', 'payment_method' => 'gcash',
    'paid_marked_at' => ago(2), 'paid_confirmed_at' => ago(2), 'delivered_at' => ago(3), 'completed_at' => ago(2)],
    [[$cli['maria'], 'started', 'Contract started for 1,200 pesos'], [$wk['ben'], 'delivered', 'Replaced the trap and the hose. No more leaks.'], [$cli['maria'], 'completed', null],
     [$cli['maria'], 'payment_sent', 'GCash 1,200 pesos'], [$wk['ben'], 'payment_confirmed', 'Payment received'], [$cli['maria'], 'reviewed', '5 stars']]);
ins($pdo, 'contract_reviews', ['contract_id' => $k1, 'reviewer_id' => $cli['maria'], 'reviewee_id' => $wk['ben'], 'rating' => 5, 'comment' => 'Fast and clean work. Will hire again.', 'created_at' => ago(2)]);
ins($pdo, 'contract_reviews', ['contract_id' => $k1, 'reviewer_id' => $wk['ben'], 'reviewee_id' => $cli['maria'], 'rating' => 5, 'comment' => 'Clear instructions and paid on time.', 'created_at' => ago(2)]);
// delivered, waiting for the client (with milestones)
contract($pdo, ['gig_id' => $G['books'], 'proposal_id' => $pBooks, 'client_id' => $cli['maria'], 'worker_id' => $wk['grace'], 'title' => 'Set up bookkeeping for a sari-sari store',
    'scope' => 'Sales and expense records, plus a one-hour lesson.', 'agreed_amount' => 3000, 'due_date' => date('Y-m-d', time() + 2 * 86400), 'status' => 'delivered', 'payment_status' => 'unpaid', 'delivered_at' => ago(0, 6), 'revisions_used' => 1],
    [[$cli['maria'], 'started', 'Contract started for 3,000 pesos'], [$wk['grace'], 'milestone_submitted', 'Record book set up'], [$cli['maria'], 'milestone_approved', 'Record book set up'],
     [$wk['grace'], 'delivered', 'Spreadsheet done and lesson finished.'], [$cli['maria'], 'revision_requested', 'Please add a column for credit (utang).'], [$wk['grace'], 'delivered', 'Added the credit column.']],
    [['Record book set up', 1200, 'approved'], ['Spreadsheet and lesson', 1800, 'submitted']]);
// disputed
$k3 = contract($pdo, ['gig_id' => $G['paint'], 'proposal_id' => $pPaint, 'client_id' => $cli['ana'], 'worker_id' => $wk['ben'], 'title' => 'Repaint the front gate', 'agreed_amount' => 1500,
    'due_date' => date('Y-m-d', time() - 1 * 86400), 'status' => 'disputed', 'payment_status' => 'unpaid', 'delivered_at' => ago(1)],
    [[$cli['ana'], 'started', null], [$wk['ben'], 'delivered', 'Gate repainted with two coats.'], [$cli['ana'], 'dispute_opened', 'The work does not match what was agreed: only one coat on the back side.']]);
ins($pdo, 'disputes', ['contract_id' => $k3, 'opened_by' => $cli['ana'], 'reason' => 'quality', 'details' => 'Only one coat was applied on the back side of the gate, and paint dripped on the wall.', 'status' => 'open', 'created_at' => ago(0, 20)]);
// a service booking waiting for the worker, and a cancelled one
$svc = ins($pdo, 'worker_services', ['worker_id' => $wk['mark'], 'title' => 'Aircon cleaning (window or split type)', 'description' => 'Full cleaning with pressure washer. Per unit.', 'category' => 'electrical',
    'price' => 800, 'price_unit' => 'job', 'delivery_days' => 1, 'service_area' => 'Naujan, Calapan City, Victoria', 'status' => 'active', 'created_at' => ago(20)]);
ins($pdo, 'worker_services', ['worker_id' => $wk['ben'], 'title' => 'Plumbing repairs', 'description' => 'Leaks, clogged drains, faucet and toilet repairs.', 'category' => 'construction',
    'price' => 600, 'price_unit' => 'job', 'delivery_days' => 1, 'service_area' => 'Socorro, Pinamalayan, Pola', 'status' => 'active', 'created_at' => ago(25)]);
ins($pdo, 'worker_services', ['worker_id' => $wk['nina'], 'title' => 'Party cooking (up to 50 guests)', 'description' => 'Filipino party menu. You provide ingredients.', 'category' => 'food',
    'price' => 3500, 'price_unit' => 'job', 'delivery_days' => 1, 'service_area' => 'Bongabong, Roxas, Bansud', 'status' => 'active', 'created_at' => ago(10)]);
contract($pdo, ['service_id' => $svc, 'client_id' => $cli['maria'], 'worker_id' => $wk['mark'], 'title' => 'Aircon cleaning (window or split type)', 'scope' => 'One window-type unit in the store.',
    'agreed_amount' => 800, 'due_date' => date('Y-m-d', time() + 3 * 86400), 'status' => 'offered', 'revisions_allowed' => 1], [[$cli['maria'], 'booked', 'One window-type unit in the store.']]);
contract($pdo, ['service_id' => $svc, 'client_id' => $cli['jose'], 'worker_id' => $wk['mark'], 'title' => 'Aircon cleaning (window or split type)', 'agreed_amount' => 800,
    'due_date' => date('Y-m-d', time() - 5 * 86400), 'status' => 'cancelled', 'cancel_reason' => 'The schedule no longer works for me.', 'cancelled_by' => $cli['jose']],
    [[$cli['jose'], 'booked', null], [$wk['mark'], 'accepted', null], [$cli['jose'], 'cancelled', 'The schedule no longer works for me.']]);

/* ── PayMongo test payments in every status, with the plan timeline ── */
function pay(PDO $pdo, int $uid, string $type, string $plan, string $name, float $amt, string $status, array $x = []): int
{
    static $n = 0; $n++;
    $sub = ins($pdo, 'subscriptions', ['user_id' => $uid, 'account_type' => $type, 'plan_id' => $plan, 'plan_name' => $name, 'billing_cycle' => 'monthly', 'price' => $amt,
        'payment_method' => 'paymongo', 'payment_reference' => "HB-DEMO-$n", 'paymongo_session_id' => "cs_test_demo_$n", 'contact_credits' => 0, 'featured_credits' => 0,
        'status' => $x['sub_status'] ?? ($status === 'paid' ? 'active' : ($status === 'pending' ? 'pending' : 'abandoned')), 'starts_at' => $x['created_at'] ?? ago(1),
        'expires_at' => $x['expires'] ?? ahead(30), 'created_at' => $x['created_at'] ?? ago(1)]);
    unset($x['sub_status'], $x['expires']);
    return ins($pdo, 'payments', $x + ['user_id' => $uid, 'subscription_id' => $sub, 'reference' => "HB-DEMO-$n", 'plan_id' => $plan, 'plan_name' => $name, 'billing_cycle' => 'monthly',
        'change_type' => 'new', 'amount' => $amt, 'status' => $status, 'paymongo_session_id' => "cs_test_demo_$n", 'is_test' => 1, 'created_at' => ago(1), 'updated_at' => ago(1)]);
}
$p = pay($pdo, $emp['resort'], 'employer', 'employer_growth', 'Business', 499, 'paid', ['method' => 'gcash', 'fee' => 12.48, 'net_amount' => 486.52, 'paymongo_payment_id' => 'pay_test_demo_1',
    'receipt_no' => 'HB-OR-2026-DEMO01', 'paid_at' => ago(12), 'created_at' => ago(12), 'expires' => ahead(18)]);
ins($pdo, 'subscription_events', ['user_id' => $emp['resort'], 'payment_id' => $p, 'event' => 'subscribed', 'from_plan' => 'employer_starter', 'to_plan' => 'employer_growth',
    'unlocked' => json_encode(['Up to 5 open job posts', '2 featured posts (shown first for 30 days)', '30 worker contact unlocks']), 'locked' => '[]', 'note' => 'Paid 499 pesos with GCash. Receipt HB-OR-2026-DEMO01', 'created_at' => ago(12)]);
pay($pdo, $emp['resort'], 'employer', 'employer_enterprise', 'Business Plus', 1499, 'failed', ['method' => 'card', 'failure_reason' => 'The card was declined by the bank.', 'change_type' => 'upgrade', 'created_at' => ago(3)]);
ins($pdo, 'subscription_events', ['user_id' => $emp['resort'], 'event' => 'payment_failed', 'to_plan' => 'employer_enterprise', 'unlocked' => '[]', 'locked' => '[]', 'note' => 'The card was declined by the bank.', 'created_at' => ago(3)]);
pay($pdo, $emp['build'], 'employer', 'employer_growth', 'Business', 499, 'pending', ['checkout_url' => 'https://checkout.paymongo.com/', 'expires_at' => ahead(1), 'created_at' => ago(0, 2)]);
pay($pdo, $emp['build'], 'employer', 'employer_growth', 'Business', 499, 'expired', ['created_at' => ago(6), 'expires_at' => ago(5)]);
pay($pdo, $emp['agri'], 'employer', 'employer_growth', 'Business', 499, 'cancelled', ['created_at' => ago(2)]);
$p = pay($pdo, $cli['maria'], 'hirer', 'hirer_service_pass', 'Service Buyer Pass', 249, 'paid', ['method' => 'paymaya', 'fee' => 6.23, 'net_amount' => 242.77, 'paymongo_payment_id' => 'pay_test_demo_2',
    'receipt_no' => 'HB-OR-2026-DEMO02', 'paid_at' => ago(28), 'created_at' => ago(28), 'expires' => ahead(2)]);
ins($pdo, 'subscription_events', ['user_id' => $cli['maria'], 'payment_id' => $p, 'event' => 'subscribed', 'from_plan' => 'hirer_free', 'to_plan' => 'hirer_service_pass',
    'unlocked' => json_encode(['Up to 5 open gigs', '1 featured gig (shown first for 30 days)', '15 worker contact unlocks']), 'locked' => '[]', 'note' => 'Paid 249 pesos with Maya.', 'created_at' => ago(28)]);
pay($pdo, $cli['jose'], 'hirer', 'hirer_service_pass', 'Service Buyer Pass', 249, 'refunded', ['method' => 'gcash', 'paymongo_payment_id' => 'pay_test_demo_3', 'receipt_no' => 'HB-OR-2026-DEMO03',
    'paid_at' => ago(9), 'refund_status' => 'succeeded', 'refunded_amount' => 249, 'refund_reason' => 'Charged twice by mistake', 'created_at' => ago(9), 'sub_status' => 'refunded']);
ins($pdo, 'subscription_events', ['user_id' => $cli['jose'], 'event' => 'refunded', 'from_plan' => 'hirer_service_pass', 'to_plan' => 'hirer_free', 'unlocked' => '[]',
    'locked' => json_encode(['Up to 5 open gigs', '1 featured gig (shown first for 30 days)', '15 worker contact unlocks']), 'note' => 'Plan ended because the payment was refunded', 'created_at' => ago(7)]);

echo "\nDemo data added. Every account's password: " . PASSWORD . "\n\n";
foreach (q($pdo, 'SELECT email, full_name, COALESCE(role, ""), COALESCE(account_type, "admin") t, verification_status FROM users WHERE email LIKE ? ORDER BY id', ['%' . DOMAIN])->fetchAll() as $u) {
    printf("  %-38s %-26s %-8s %s\n", $u['email'], $u['full_name'], $u['t'] === 'hirer' ? 'client' : $u['t'], $u['verification_status']);
}
echo "\nRemove it any time with: php seed_demo.php --remove\n";
