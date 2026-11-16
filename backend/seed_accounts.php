<?php
/**
 * seed_accounts.php — test accounts for the roles you cannot get by signing up as a worker.
 *
 *   php seed_accounts.php
 *       Creates (or resets) three email + password accounts and prints their passwords:
 *         employer@hanapbuhay.test   Employer   (posts jobs, reviews applicants)
 *         client@hanapbuhay.test     Client     (hirer: posts service requests)
 *         admin@hanapbuhay.test      Admin      (moderation, users, payments)
 *       Running it again gives each account a NEW password (the old one stops working).
 *
 *   php seed_accounts.php promote you@gmail.com admin|employer|hirer|worker
 *       Turns an account that already exists (for example one created by signing in with
 *       Google) into that role. Sign out and back in afterwards so the app picks it up.
 *
 * Uses the database in backend/.env, the same one the API uses.
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

$dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_NAME'] ?? '');
$pdo = new PDO($dsn, $_ENV['DB_USER'] ?? '', $_ENV['DB_PASSWORD'] ?? '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT => false,
]);

// only write the columns this database actually has (older installs lack some)
$cols = array_column($pdo->query('SHOW COLUMNS FROM users')->fetchAll(), 'Field');
$has = fn($c) => in_array($c, $cols, true);

// ── promote an existing account ─────────────────────────────
if (($argv[1] ?? '') === 'promote') {
    $email = strtolower(trim($argv[2] ?? ''));
    $role  = $argv[3] ?? '';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !in_array($role, ['admin', 'employer', 'hirer', 'worker'], true)) {
        fwrite(STDERR, "Usage: php seed_accounts.php promote you@gmail.com admin|employer|hirer|worker\n");
        exit(1);
    }
    $u = $pdo->prepare('SELECT id, full_name FROM users WHERE LOWER(email) = ?');
    $u->execute([$email]);
    $row = $u->fetch();
    if (!$row) {
        fwrite(STDERR, "No account with $email. Sign in with it once (Google or sign-up), then run this again.\n");
        exit(1);
    }
    $set = $role === 'admin'
        ? ['role' => 'admin']
        : ['role' => 'user', 'account_type' => $role];
    if ($has('is_verified')) $set['is_verified'] = 1;
    $sql = 'UPDATE users SET ' . implode(', ', array_map(fn($k) => "`$k` = ?", array_keys($set))) . ' WHERE id = ?';
    $pdo->prepare($sql)->execute([...array_values($set), $row['id']]);
    echo "{$row['full_name']} <$email> is now: " . ($role === 'admin' ? 'Admin' : ucfirst($role)) . ". Sign out and back in.\n";
    exit(0);
}

// ── create / reset the three test accounts ──────────────────
function new_password(): string
{
    // easy to type, meets the sign-up rule (8+ characters, letters and a number)
    $words = ['Mindoro', 'Calapan', 'Naujan', 'Tamaraw', 'Baco', 'Pola', 'Roxas', 'Gloria'];
    return $words[random_int(0, count($words) - 1)] . '-' . random_int(1000, 9999) . '-' . bin2hex(random_bytes(2));
}

$accounts = [
    ['email' => 'employer@hanapbuhay.test', 'full_name' => 'Mindoro Test Employer', 'role' => 'user', 'account_type' => 'employer',
     'location' => 'Calapan City', 'phone' => '09170000001', 'bio' => 'Test employer account for reviewing HanapBuhay.'],
    ['email' => 'client@hanapbuhay.test', 'full_name' => 'Mindoro Test Client', 'role' => 'user', 'account_type' => 'hirer',
     'location' => 'Naujan', 'phone' => '09170000002', 'bio' => 'Test client account: hires workers for one-off jobs.'],
    ['email' => 'admin@hanapbuhay.test', 'full_name' => 'HanapBuhay Admin', 'role' => 'admin', 'account_type' => null,
     'location' => 'Calapan City', 'phone' => '09170000003', 'bio' => null],
];

$out = [];
foreach ($accounts as $a) {
    $pass = new_password();
    $data = [
        'full_name'    => $a['full_name'],
        'password'     => password_hash($pass, PASSWORD_DEFAULT),
        'role'         => $a['role'],
        'account_type' => $a['account_type'],
        'location'     => $a['location'],
        'phone'        => $a['phone'],
        'bio'          => $a['bio'],
        'is_active'    => 1,
    ];
    if ($has('is_verified')) $data['is_verified'] = 1;
    $data = array_filter($data, fn($k) => $has($k), ARRAY_FILTER_USE_KEY);

    $find = $pdo->prepare('SELECT id FROM users WHERE LOWER(email) = ?');
    $find->execute([$a['email']]);
    $id = $find->fetchColumn();

    if ($id) {
        $sql = 'UPDATE users SET ' . implode(', ', array_map(fn($k) => "`$k` = ?", array_keys($data))) . ' WHERE id = ?';
        $pdo->prepare($sql)->execute([...array_values($data), $id]);
        $what = 'reset';
    } else {
        $data['email'] = $a['email'];
        if ($has('username')) {
            $base = explode('@', $a['email'])[0] . '_test';
            $data['username'] = $base;
            $n = 1;
            $chk = $pdo->prepare('SELECT COUNT(*) FROM users WHERE username = ?');
            while (true) { $chk->execute([$data['username']]); if (!$chk->fetchColumn()) break; $data['username'] = $base . (++$n); }
        }
        $sql = 'INSERT INTO users (' . implode(', ', array_map(fn($k) => "`$k`", array_keys($data))) . ') VALUES (' . implode(', ', array_fill(0, count($data), '?')) . ')';
        $pdo->prepare($sql)->execute(array_values($data));
        $id = $pdo->lastInsertId();
        $what = 'created';
    }
    // a seeded address can't receive the verification email, so count it as verified
    if ($has('email_verified_at')) $pdo->prepare('UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?')->execute([$id]);

    $out[] = [$a['role'] === 'admin' ? 'Admin' : ($a['account_type'] === 'hirer' ? 'Client (hirer)' : 'Employer'), $a['email'], $pass, $what, $id];
}

echo "\nHanapBuhay test accounts (sign in with email + password)\n";
echo str_repeat('-', 78) . "\n";
foreach ($out as [$label, $email, $pass, $what, $id]) {
    printf("%-15s %-27s %-22s %s (id %s)\n", $label, $email, $pass, $what, $id);
}
echo str_repeat('-', 78) . "\n";
echo "Running this again gives new passwords. Keep these out of the git repository.\n";
