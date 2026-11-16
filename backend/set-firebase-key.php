<?php
/**
 * One-time helper: copies the Firebase service account key into backend/.env.
 *
 *   php set-firebase-key.php "C:\path\to\hanapbuhay-45527-firebase-adminsdk-xxxx.json"
 *
 * It writes FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (newlines escaped as \n)
 * and prints only whether it worked, never the key itself.
 * Run it from the backend folder. Delete the downloaded JSON afterwards.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$json_path = $argv[1] ?? '';
$env_path  = $argv[2] ?? (__DIR__ . DIRECTORY_SEPARATOR . '.env');

if ($json_path === '' || !is_file($json_path)) {
    fwrite(STDERR, "Usage: php set-firebase-key.php \"path\\to\\service-account.json\"\n");
    exit(1);
}
$key = json_decode((string) file_get_contents($json_path), true);
if (!is_array($key) || empty($key['client_email']) || empty($key['private_key']) || ($key['type'] ?? '') !== 'service_account') {
    fwrite(STDERR, "That file is not a Firebase service account key (needs type, client_email, private_key).\n");
    exit(1);
}
if (!is_file($env_path)) {
    fwrite(STDERR, ".env not found at $env_path\n");
    exit(1);
}

$email = $key['client_email'];
$pk    = str_replace(["\r\n", "\n"], '\n', trim($key['private_key']));

$lines = file($env_path, FILE_IGNORE_NEW_LINES);
$lines = array_values(array_filter($lines, fn($l) => !preg_match('/^\s*FIREBASE_(CLIENT_EMAIL|PRIVATE_KEY)\s*=/', $l)));
$lines[] = '';
$lines[] = '# Firebase service account (chat sign-in). Never commit this file.';
$lines[] = 'FIREBASE_CLIENT_EMAIL=' . $email;
$lines[] = 'FIREBASE_PRIVATE_KEY="' . $pk . '"';
file_put_contents($env_path, implode("\n", $lines) . "\n");

echo "OK: wrote FIREBASE_CLIENT_EMAIL ({$email}) and FIREBASE_PRIVATE_KEY to $env_path\n";
echo "Project: " . ($key['project_id'] ?? '?') . "\n";
echo "Now delete the downloaded JSON file and restart the backend.\n";
