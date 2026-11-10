<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * /api/auth/*  - register, login, Google sign-in, session helpers.
 * Public registration can NEVER create admin/moderator accounts.
 */
class AuthController extends Controller
{
    private const TYPES = ['worker', 'employer', 'hirer'];
    // Oriental Mindoro: 14 municipalities + Calapan City
    private const TOWNS = ['Baco','Bansud','Bongabong','Bulalacao','Calapan City','Gloria','Mansalay','Naujan','Pinamalayan','Pola','Puerto Galera','Roxas','San Teodoro','Socorro','Victoria'];

    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->model('User_model', 'user_model');
        $this->call->model('Application_model', 'application_model');
        $this->call->library('resume_parser');
        $this->call->library('google_client');
    }

    // ---------- helpers ----------
    private function public_user(array $u): array
    {
        $prefs = null;
        if (!empty($u['notification_prefs'])) {
            $prefs = is_array($u['notification_prefs']) ? $u['notification_prefs'] : json_decode((string)$u['notification_prefs'], true);
        }
        if (!is_array($prefs)) {
            $prefs = ['email' => true, 'sms' => false, 'job_alerts' => true];
        }

        return [
            'id'                      => (int) $u['id'],
            'full_name'               => $u['full_name'],
            'email'                   => $u['email'],
            'role'                    => $u['role'],
            'account_type'            => $u['account_type'],
            'location'                => $u['location'],
            'phone'                   => $u['phone'],
            'bio'                     => $u['bio'] ?? null,
            'picture'                 => $u['picture'] ?? null,
            'is_verified'             => (int) ($u['is_verified'] ?? 0),
            'subscription_tier'       => $u['subscription_tier'] ?? 'free',
            'subscription_status'     => $u['subscription_status'] ?? 'active',
            'subscription_expires_at' => $u['subscription_expires_at'] ?? null,
            'contact_credits'         => (int) ($u['contact_credits'] ?? 5),
            'featured_credits'        => (int) ($u['featured_credits'] ?? 0),
            'has_google'              => !empty($u['google_sub']),
            'notification_prefs'      => $prefs,
        ];
    }

    private function find_by(string $col, $val)
    {
        return $this->user_model->find_by($col, $val);
    }

    private function unique_username(string $seed): string
    {
        $base = strtolower(preg_replace('/[^a-z0-9]/i', '', $seed));
        $base = substr($base !== '' ? $base : 'user', 0, 20);
        do {
            $name = $base . substr(bin2hex(random_bytes(3)), 0, 5);
        } while ($this->find_by('username', $name));
        return $name;
    }

    private function create_user(array $f): array
    {
        $username = $this->unique_username(explode('@', $f['email'])[0]);
        return $this->user_model->create_user([
            'username'     => $username,
            'full_name'    => $f['full_name'],
            'email'        => $f['email'],
            'password'     => password_hash($f['password'] ?? bin2hex(random_bytes(24)), PASSWORD_DEFAULT),
            'role'         => 'user',
            'account_type' => $f['account_type'] ?? null,
            'location'     => $f['location'] ?? null,
            'phone'        => $f['phone'] ?? null,
            'google_sub'   => $f['google_sub'] ?? null,
            'is_active'    => 1,
        ]);
    }

    private function session_response(array $user, int $code = 200, array $extra = [])
    {
        $tokens = $this->api->issue_tokens([
            'id'   => $user['id'],
            'role' => $user['role'],
        ]);
        $this->api->respond(array_merge([
            'success' => true,
            'user'    => $this->public_user($user),
            'tokens'  => $tokens,
        ], $extra), $code);
    }

    private function valid_password(string $p): bool
    {
        return strlen($p) >= 8 && preg_match('/[A-Za-z]/', $p) && preg_match('/\d/', $p);
    }

    // ---------- endpoints ----------
    public function register()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit('register_' . ($_SERVER['REMOTE_ADDR'] ?? 'x'), 10, 600);
        $b = $this->api->body();

        $name  = trim((string) ($b['full_name'] ?? ''));
        $email = strtolower(trim((string) ($b['email'] ?? '')));
        $pass  = (string) ($b['password'] ?? '');
        $type  = (string) ($b['account_type'] ?? '');

        if (mb_strlen($name) < 2 || mb_strlen($name) > 150) $this->api->respond_error('Enter your full name.', 422);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 255) $this->api->respond_error('Enter a valid email address.', 422);
        if (!$this->valid_password($pass)) $this->api->respond_error('Password needs 8+ characters with at least one letter and one number.', 422);
        if (!in_array($type, self::TYPES, true)) $this->api->respond_error('Choose an account type.', 422);
        $loc = trim((string) ($b['location'] ?? ''));
        if ($loc !== '' && !in_array($loc, self::TOWNS, true)) $this->api->respond_error('Choose a town in Oriental Mindoro.', 422);
        if ($this->find_by('email', $email)) $this->api->respond_error('That email is already registered. Try signing in.', 409);

        $user = $this->create_user([
            'full_name'    => $name,
            'email'        => $email,
            'password'     => $pass,
            'account_type' => $type,
            'location'     => $loc !== '' ? $loc : null,
            'phone'        => ($b['phone'] ?? '') !== '' ? substr((string) $b['phone'], 0, 32) : null,
        ]);
        $this->session_response($user, 201);
    }

    public function login()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit('login_' . ($_SERVER['REMOTE_ADDR'] ?? 'x'), 15, 300);
        $b = $this->api->body();

        $email = strtolower(trim((string) ($b['email'] ?? '')));
        $pass  = (string) ($b['password'] ?? '');
        if ($email === '' || $pass === '') $this->api->respond_error('Enter your email and password.', 422);

        $user = $this->find_by('email', $email);
        if (!$user || !password_verify($pass, (string) $user['password'])) {
            $this->api->respond_error('Email or password is incorrect.', 401);
        }
        if ((int) $user['is_active'] !== 1) $this->api->respond_error('This account is disabled. Contact support.', 403);
        $this->session_response($user);
    }

    public function google()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit('google_' . ($_SERVER['REMOTE_ADDR'] ?? 'x'), 20, 300);
        $b = $this->api->body();

        $client_id = $this->google_client->get_client_id();
        $token     = (string) ($b['access_token'] ?? '');
        if ($client_id === '') $this->api->respond_error('Google sign-in is not configured on the server.', 500);
        if ($token === '') $this->api->respond_error('Missing Google token.', 422);

        // 1) verify token audience
        $tokeninfoUrl = config_item('google_tokeninfo_url') ?: 'https://oauth2.googleapis.com/tokeninfo';
        $info = $this->google_client->http_get($tokeninfoUrl . '?access_token=' . urlencode($token));
        $aud  = $info['aud'] ?? ($info['azp'] ?? '');
        if (!$info || !hash_equals($client_id, (string) $aud)) {
            $this->api->respond_error('Google sign-in could not be verified.', 401);
        }

        // 2) profile
        $g = $this->google_client->get_userinfo($token);
        if (!$g || empty($g['sub']) || empty($g['email'])) $this->api->respond_error('Could not read your Google profile.', 401);
        if (!filter_var($g['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $this->api->respond_error('Your Google email is not verified.', 403);
        }

        $email = strtolower($g['email']);
        $type  = in_array($b['account_type'] ?? '', self::TYPES, true) ? $b['account_type'] : null;
        $is_new = false;

        $user = $this->find_by('google_sub', $g['sub']);
        if (!$user) {
            $user = $this->find_by('email', $email);
            if ($user) {
                $this->user_model->update_user((int) $user['id'], ['google_sub' => $g['sub']]);
                $user['google_sub'] = $g['sub'];
            } else {
                $user = $this->create_user([
                    'full_name'    => substr((string) ($g['name'] ?? explode('@', $email)[0]), 0, 150),
                    'email'        => $email,
                    'account_type' => $type,
                    'google_sub'   => $g['sub'],
                ]);
                $is_new = true;
            }
        }
        if ((int) $user['is_active'] !== 1) $this->api->respond_error('This account is disabled. Contact support.', 403);

        $this->session_response($user, $is_new ? 201 : 200, ['is_new' => $is_new]);
    }

    public function me()
    {
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

        if ($method === 'PATCH' || $method === 'PUT') {
            $this->update_profile();
            return;
        }

        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $user = $this->find_by('id', (int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);
        $this->api->respond(['success' => true, 'user' => $this->public_user($user)]);
    }

    public function update_profile()
    {
        $payload = $this->api->require_jwt();
        $user = $this->find_by('id', (int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);

        $b = $this->api->body();
        $allowed = ['full_name', 'phone', 'location', 'bio', 'picture', 'notification_prefs'];
        $data = [];

        foreach ($allowed as $field) {
            if (array_key_exists($field, $b)) {
                if ($field === 'picture') {
                    $data['picture'] = (string) $b['picture'];
                } elseif ($field === 'notification_prefs') {
                    $val = $b['notification_prefs'];
                    $data['notification_prefs'] = is_string($val) ? $val : json_encode($val);
                } else {
                    $maxLen = ($field === 'bio') ? 5000 : 255;
                    $data[$field] = substr(trim((string) $b[$field]), 0, $maxLen);
                }
            }
        }

        if (!empty($data)) {
            $this->user_model->update_user((int) $user['id'], $data);
        }

        $updated = $this->find_by('id', (int) $user['id']);
        $this->api->respond(['success' => true, 'user' => $this->public_user($updated)]);
    }

    public function upload_avatar()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $user = $this->find_by('id', (int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);

        $uploadDir = ROOT_DIR . 'public' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'avatars';
        if (!is_dir($uploadDir)) {
            @mkdir($uploadDir, 0777, true);
        }

        $pictureUrl = null;

        // 1. Standard file upload
        $file = $_FILES['avatar'] ?? $_FILES['picture'] ?? null;
        if ($file && !empty($file['tmp_name']) && is_uploaded_file($file['tmp_name'])) {
            $allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            if (!in_array($ext, $allowedExts, true)) {
                $this->api->respond_error('Invalid image type. Supported: JPG, PNG, WEBP, GIF.', 422);
            }
            if ($file['size'] > 5 * 1024 * 1024) {
                $this->api->respond_error('Image too large. Maximum size is 5MB.', 422);
            }

            $fileName = 'avatar_' . $user['id'] . '_' . time() . '.' . $ext;
            $targetPath = $uploadDir . DIRECTORY_SEPARATOR . $fileName;

            if (move_uploaded_file($file['tmp_name'], $targetPath)) {
                $pictureUrl = '/uploads/avatars/' . $fileName;
            }
        }

        // 2. Base64 Data URI upload
        if (!$pictureUrl) {
            $b = $this->api->body();
            $dataUri = $b['picture'] ?? $b['avatar'] ?? null;
            if ($dataUri && preg_match('#^data:image/([a-zA-Z0-9.+]+);base64,(.+)$#', $dataUri, $m)) {
                $ext = strtolower($m[1]);
                if ($ext === 'jpeg') $ext = 'jpg';
                $decoded = base64_decode($m[2]);
                if ($decoded) {
                    $fileName = 'avatar_' . $user['id'] . '_' . time() . '.' . $ext;
                    $targetPath = $uploadDir . DIRECTORY_SEPARATOR . $fileName;
                    if (@file_put_contents($targetPath, $decoded)) {
                        $pictureUrl = '/uploads/avatars/' . $fileName;
                    }
                }
            } else if ($dataUri && filter_var($dataUri, FILTER_VALIDATE_URL)) {
                $pictureUrl = $dataUri;
            }
        }

        if (!$pictureUrl) {
            $this->api->respond_error('No valid image provided for upload.', 422);
        }

        $this->user_model->update_user((int) $user['id'], ['picture' => $pictureUrl]);

        $updated = $this->find_by('id', (int) $user['id']);
        $this->api->respond([
            'success' => true,
            'picture' => $pictureUrl,
            'user'    => $this->public_user($updated)
        ]);
    }

    public function parse_resume()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $user = $this->find_by('id', (int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);

        $file = $_FILES['resume'] ?? null;
        if (!$file || empty($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            $this->api->respond_error('No resume file uploaded.', 422);
        }

        $maxSize = config_item('resume_max_size') ?: (10 * 1024 * 1024); // 10MB
        if ($file['size'] > $maxSize) {
            $this->api->respond_error('Resume file too large. Maximum size is 10MB.', 422);
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowedExts = config_item('resume_allowed_exts') ?: ['pdf', 'doc', 'docx', 'txt', 'rtf'];
        if (!in_array($ext, $allowedExts, true)) {
            $this->api->respond_error('Unsupported file type. Please upload PDF, DOCX, DOC, or TXT.', 422);
        }

        // Delegate to custom Resume_parser library
        $text = $this->resume_parser->extract_text($file['tmp_name'], $file['type'] ?? '');
        if (empty(trim($text))) {
            $this->api->respond_error('Could not extract text from the resume. Please try a TXT or DOCX format.', 422);
        }

        $parsed = $this->resume_parser->parse($text, $file['name']);

        $this->api->respond([
            'success' => true,
            'parsed'  => $parsed,
            'text_preview' => substr(trim($text), 0, 500),
        ]);
    }

    public function account_type()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $b = $this->api->body();
        $type = (string) ($b['account_type'] ?? '');
        if (!in_array($type, self::TYPES, true)) $this->api->respond_error('Choose an account type.', 422);

        $user = $this->find_by('id', (int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);
        if (!empty($user['account_type'])) $this->api->respond_error('Account type is already set.', 409);

        $this->user_model->update_user((int) $user['id'], ['account_type' => $type]);
        $user['account_type'] = $type;
        $this->api->respond(['success' => true, 'user' => $this->public_user($user)]);
    }

    public function refresh()
    {
        $this->api->require_method('POST');
        $b = $this->api->body();
        $this->api->refresh_access_token((string) ($b['refresh_token'] ?? ''));
    }

    public function logout()
    {
        $this->api->require_method('POST');
        $b = $this->api->body();
        if (!empty($b['refresh_token'])) $this->api->revoke_refresh_token((string) $b['refresh_token']);
        $this->api->respond(['success' => true]);
    }

    public function test_notification_email()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $user = $this->find_by('id', (int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);

        if (empty($user['email'])) {
            $this->api->respond_error('No email address associated with this account.', 422);
        }

        $title = 'Test Notification from HanapBuhay';
        $body = "This is a test notification confirming that email alerts are working properly for your account.\n\nTime sent: " . date('Y-m-d H:i:s') . "\nStatus: Functional ✅";
        $link = '/dashboard/settings';

        $this->application_model->create_notification(
            (int) $user['id'],
            'test',
            $title,
            $body,
            $link
        );

        $res = \Mailer::send_notification(
            $user,
            'test',
            $title,
            $body,
            $link,
            'Manage Notification Preferences'
        );

        $this->api->respond([
            'success' => true,
            'result'  => $res,
            'email'   => $user['email']
        ]);
    }

    // GET /api/auth/search-users?q=keyword — search users by name/email for new chat
    public function search_users()
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $me = (int) $payload['sub'];

        $q = trim((string) ($_GET['q'] ?? ''));

        $rows = $this->user_model->search_users($q, '', 20, 'active');

        $users = array_values(array_filter(array_map(fn($r) => [
            'id'           => (int) $r['id'],
            'full_name'    => $r['full_name'] ?? '',
            'email'        => $r['email'] ?? '',
            'account_type' => $r['account_type'] ?? '',
            'location'     => $r['location'] ?? '',
            'picture'      => $r['picture'] ?? '',
        ], $rows), fn($u) => $u['id'] !== $me));

        $this->api->respond(['success' => true, 'users' => $users]);
    }
}

