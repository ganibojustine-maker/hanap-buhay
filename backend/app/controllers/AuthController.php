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

    /**
     * The versions of the Terms of Service and Privacy Policy now in force. Change a date when
     * the text changes (frontend: src/data/legal.js) and everyone is asked to accept again.
     */
    public const TERMS_VERSION = '2026-11-16';
    public const PRIVACY_VERSION = '2026-11-16';
    private const EDUCATION = ['none', 'elementary', 'high_school', 'senior_high', 'vocational', 'college', 'postgraduate'];

    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->model('User_model', 'user_model');
        $this->call->model('Application_model', 'application_model');
        $this->call->library('resume_parser');
        $this->call->library('google_client');
        $this->call->library('firebase_auth');
        $this->call->library('availability');
        $this->call->library('schema_info');
    }

    /** Tables from migrations 012/014 (password_resets, email_verifications) may not exist on an older database. */
    private function has_table(string $t): bool
    {
        return $this->schema_info->has_table($t);
    }

    // ---------- helpers ----------
    private function public_user(array $u): array
    {
        $prefs = null;
        if (!empty($u['notification_prefs'])) {
            $prefs = is_array($u['notification_prefs']) ? $u['notification_prefs'] : json_decode((string)$u['notification_prefs'], true);
        }
        if (!is_array($prefs)) {
            $prefs = ['email' => true, 'job_alerts' => true];
        }

        $out = [
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
        // migration 017: present only once the columns exist, so the app hides these until then
        if (array_key_exists('open_to_work', $u)) $out['availability'] = \Availability::from_row($u);
        if (array_key_exists('share_token', $u)) $out['share_token'] = $u['share_token'] ?: null;
        // migration 021: verification, consent and the matching fields
        if (array_key_exists('verification_status', $u)) {
            $out['verification_status'] = $u['verification_status'] ?: ((int) ($u['is_verified'] ?? 0) ? 'verified' : 'unverified');
            $out['phone_verified']      = !empty($u['phone_verified_at']);
            $out['barangay']            = $u['barangay'] ?? null;
            $out['education_level']     = $u['education_level'] ?? null;
            $out['experience_years']    = isset($u['experience_years']) ? (int) $u['experience_years'] : null;
            $out['terms_version']       = $u['terms_version'] ?? null;
            $out['needs_terms']         = ($u['role'] ?? '') !== 'admin'
                && (($u['terms_version'] ?? '') !== self::TERMS_VERSION || ($u['privacy_version'] ?? '') !== self::PRIVACY_VERSION);
        }
        $out['email_verified'] = !empty($u['email_verified_at']);
        // which generated avatar this account gets when it has no photo (migration 018)
        $out['avatar_color'] = isset($u['avatar_color']) && $u['avatar_color'] !== null ? (int) $u['avatar_color'] : ((int) $u['id'] % 8);
        return $out;
    }

    private const RATE_UNITS = ['month', 'day', 'hour', 'project'];

    /** Validates PATCH /auth/me { availability: {...} } into users columns. */
    private function clean_availability($val): array
    {
        $a = is_array($val) ? $val : [];
        $data = [];
        if (array_key_exists('open_to_work', $a)) $data['open_to_work'] = !empty($a['open_to_work']) ? 1 : 0;
        if (array_key_exists('work_types', $a)) {
            $data['work_types'] = implode(',', array_values(array_intersect(self::JOB_TYPES, (array) $a['work_types']))) ?: null;
        }
        if (array_key_exists('expected_rate', $a)) {
            $r = (int) $a['expected_rate'];
            $data['expected_rate'] = $r > 0 ? min($r, 1000000) : null;
        }
        if (array_key_exists('rate_unit', $a)) {
            $data['rate_unit'] = in_array($a['rate_unit'], self::RATE_UNITS, true) ? $a['rate_unit'] : null;
        }
        if (array_key_exists('preferred_towns', $a)) {
            $data['preferred_towns'] = implode(',', array_values(array_intersect(self::TOWNS, (array) $a['preferred_towns']))) ?: null;
        }
        return $data;
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

    /** Store that this account accepted the current Terms and Privacy Policy (migration 021). */
    private function record_consent(array $user): array
    {
        if (!$this->schema_info->has_column('users', 'terms_version')) return $user;
        $now = date('Y-m-d H:i:s');
        $this->user_model->update_user((int) $user['id'], [
            'terms_version' => self::TERMS_VERSION, 'terms_accepted_at' => $now,
            'privacy_version' => self::PRIVACY_VERSION, 'privacy_accepted_at' => $now,
        ]);
        return $this->find_by('id', (int) $user['id']) ?: $user;
    }

    // POST /api/auth/accept-terms — accept the current versions (asked again when they change)
    public function accept_terms()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $user = $this->find_by('id', (int) $payload['sub']);
        if (!$user) $this->api->respond_error('Please sign in again.', 401);
        if (!filter_var($this->api->body()['accept'] ?? false, FILTER_VALIDATE_BOOLEAN)) $this->api->respond_error('Tick the box to agree, or sign out.', 422);
        $user = $this->record_consent($user);
        $this->api->respond(['success' => true, 'user' => $this->public_user($user)]);
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
        $this->api->rate_limit('register_' . $this->api->client_ip(), 10, 600);
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
        if (!filter_var($b['accept_terms'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $this->api->respond_error('Please agree to the Terms of Service and Privacy Policy to create your account.', 422);
        }
        $phone = trim((string) ($b['phone'] ?? ''));
        if ($phone !== '') {
            $phone = \Phone::normalize($phone);
            if (!$phone) $this->api->respond_error('Enter a Philippine mobile number, like 0917 123 4567.', 422);
        }

        $user = $this->create_user([
            'full_name'    => $name,
            'email'        => $email,
            'password'     => $pass,
            'account_type' => $type,
            'location'     => $loc !== '' ? $loc : null,
            'phone'        => $phone ?: null,
        ]);
        $user = $this->record_consent($user);
        $this->session_response($user, 201);
    }

    public function login()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit('login_' . $this->api->client_ip(), 15, 300);
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
        $this->api->rate_limit('google_' . $this->api->client_ip(), 20, 300);
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
                // a Google account's email is already confirmed by Google
                $this->db->raw('UPDATE users SET email_verified_at = NOW() WHERE id = ?', [(int) $user['id']]);
                if (filter_var($b['accept_terms'] ?? false, FILTER_VALIDATE_BOOLEAN)) $user = $this->record_consent($user);
                $user = $this->find_by('id', (int) $user['id']) ?: $user;
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
                    $pic = (string) $b['picture'];
                    if ($pic === '') {
                        $data['picture'] = null;
                    } elseif (str_starts_with($pic, 'data:')) {
                        $data['picture'] = $this->validate_image_data_uri($pic); // responds 422 on failure
                    } elseif (preg_match('#^https?://#i', $pic) && strlen($pic) <= 500 && filter_var($pic, FILTER_VALIDATE_URL)) {
                        $data['picture'] = $pic;
                    } else {
                        $this->api->respond_error('Invalid profile picture.', 422);
                    }
                } elseif ($field === 'notification_prefs') {
                    $data['notification_prefs'] = json_encode($this->clean_prefs($b['notification_prefs'], $user));
                } else {
                    $maxLen = ($field === 'bio') ? 5000 : 255;
                    $data[$field] = substr(trim((string) $b[$field]), 0, $maxLen);
                }
            }
        }

        if (isset($data['location']) && $data['location'] !== '' && !in_array($data['location'], self::TOWNS, true)) {
            $this->api->respond_error('Choose a town in Oriental Mindoro.', 422);
        }
        if (array_key_exists('phone', $data) && $data['phone'] !== '') {
            $norm = \Phone::normalize($data['phone']);
            if (!$norm) $this->api->respond_error('Enter a Philippine mobile number, like 0917 123 4567.', 422);
            $data['phone'] = $norm;
        }
        if ($this->schema_info->has_column('users', 'barangay')) {
            if (array_key_exists('barangay', $b)) {
                $brgy = trim((string) $b['barangay']);
                $town = (string) ($data['location'] ?? $user['location'] ?? '');
                if ($brgy !== '') {
                    $all = require APP_DIR . 'config' . DIRECTORY_SEPARATOR . 'barangays.php';
                    if (!in_array($brgy, $all[$town] ?? [], true)) $this->api->respond_error('Choose a barangay in your town.', 422);
                }
                $data['barangay'] = $brgy ?: null;
            } elseif (isset($data['location']) && $data['location'] !== ($user['location'] ?? '')) {
                $data['barangay'] = null; // moved town: the old barangay no longer applies
            }
            if (array_key_exists('education_level', $b)) {
                $e = (string) $b['education_level'];
                if ($e !== '' && !in_array($e, self::EDUCATION, true)) $this->api->respond_error('Choose your highest education.', 422);
                $data['education_level'] = $e ?: null;
            }
            if (array_key_exists('experience_years', $b)) {
                $y = $b['experience_years'];
                if ($y === '' || $y === null) $data['experience_years'] = null;
                elseif (!is_numeric($y) || (int) $y < 0 || (int) $y > 60) $this->api->respond_error('Enter your years of experience (0 to 60).', 422);
                else $data['experience_years'] = (int) $y;
            }
        }

        if (array_key_exists('availability', $b)) {
            if ($user['account_type'] !== 'worker') $this->api->respond_error('Availability is part of a worker profile.', 422);
            if (!array_key_exists('open_to_work', $user)) {
                $this->api->respond_error('Availability is not switched on yet. Please try again later.', 503);
            }
            $data += $this->clean_availability($b['availability']);
        }

        if (!empty($data)) {
            $this->user_model->update_user((int) $user['id'], $data);
        }

        $updated = $this->find_by('id', (int) $user['id']);
        $this->api->respond(['success' => true, 'user' => $this->public_user($updated)]);
    }

    private const JOB_TYPES = ['full-time', 'part-time', 'contractual', 'freelance', 'gig'];

    /**
     * Notification settings: only known keys with valid values are stored.
     * Job alerts (used by JobController::send_job_alerts): towns (empty = own town),
     * job types (empty = any), minimum monthly pay, skills-only, and email on/off.
     */
    private function clean_prefs($val, array $user): array
    {
        $p = is_string($val) ? json_decode($val, true) : $val;
        if (!is_array($p)) $p = [];
        $old = json_decode((string) ($user['notification_prefs'] ?? ''), true);
        $old = is_array($old) ? $old : [];
        $get = fn($k, $def) => array_key_exists($k, $p) ? $p[$k] : ($old[$k] ?? $def);
        return [
            'email'             => (bool) $get('email', true),
            'job_alerts'        => (bool) $get('job_alerts', true),
            'alert_towns'       => array_values(array_intersect(self::TOWNS, (array) $get('alert_towns', []))),
            'alert_types'       => array_values(array_intersect(self::JOB_TYPES, (array) $get('alert_types', []))),
            'alert_min_salary'  => max(0, min(1000000, (int) $get('alert_min_salary', 0))),
            'alert_skills_only' => (bool) $get('alert_skills_only', false),
            'alert_email'       => (bool) $get('alert_email', false),
            // texts for hired / interview invite / interview reminder (on unless turned off; needs a mobile number)
                        // one switch per kind of email (Mailer::TYPE_PREF); all on unless turned off
            'email_applications' => (bool) $get('email_applications', true),
            'email_updates'      => (bool) $get('email_updates', true),
            'email_invites'      => (bool) $get('email_invites', true),
            'email_messages'     => (bool) $get('email_messages', true),
            'email_reviews'      => (bool) $get('email_reviews', true),
            'email_social'       => (bool) $get('email_social', true),
            'email_posts'        => (bool) $get('email_posts', true),
        ];
    }

    // POST /api/auth/share { enabled: bool, rotate?: bool } — public Skills Passport link (/p/{token})
    public function share()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $user = $this->find_by('id', (int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);
        if ($user['account_type'] !== 'worker') $this->api->respond_error('Only workers have a Skills Passport to share.', 403);
        if (!array_key_exists('share_token', $user)) $this->api->respond_error('Sharing is not switched on yet. Please try again later.', 503);
        $this->api->rate_limit('share_' . (int) $user['id'], 20, 3600);

        $b = $this->api->body();
        $token = $user['share_token'] ?: null;
        if (empty($b['enabled'])) {
            $token = null; // the old link stops working
        } elseif (!$token || !empty($b['rotate'])) {
            $token = null;
            for ($i = 0; $i < 5 && !$token; $i++) {
                $t = rtrim(strtr(base64_encode(random_bytes(9)), '+/', '-_'), '='); // 12 characters, 72 random bits
                if (!$this->find_by('share_token', $t)) $token = $t;
            }
            if (!$token) $this->api->respond_error('Could not create a link. Please try again.', 500);
        }
        $this->user_model->update_user((int) $user['id'], ['share_token' => $token]);
        $this->api->respond(['success' => true, 'user' => $this->public_user($this->find_by('id', (int) $user['id']))]);
    }

    /** Max decoded image size accepted for avatars. */
    private const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

    /**
     * Validate raw image bytes by content and return a normalised data URL.
     * Extension / MIME supplied by the client is ignored on purpose.
     */
    private function image_to_data_url(string $binary): string
    {
        if ($binary === '' || strlen($binary) > self::AVATAR_MAX_BYTES) {
            $this->api->respond_error('Image too large. Maximum size is 2MB.', 422);
        }
        $info = @getimagesizefromstring($binary);
        $allowed = [
            IMAGETYPE_JPEG => 'image/jpeg',
            IMAGETYPE_PNG  => 'image/png',
            IMAGETYPE_WEBP => 'image/webp',
            IMAGETYPE_GIF  => 'image/gif',
        ];
        if (!$info || !isset($allowed[$info[2]])) {
            $this->api->respond_error('Invalid image. Supported: JPG, PNG, WEBP, GIF.', 422);
        }
        if ($info[0] > 4096 || $info[1] > 4096) {
            $this->api->respond_error('Image dimensions too large (max 4096px).', 422);
        }
        return 'data:' . $allowed[$info[2]] . ';base64,' . base64_encode($binary);
    }

    private function validate_image_data_uri(string $dataUri): string
    {
        if (!preg_match('#^data:image/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/=\r\n]+)$#', $dataUri, $m)) {
            $this->api->respond_error('Invalid image data.', 422);
        }
        $binary = base64_decode($m[1], true);
        if ($binary === false) {
            $this->api->respond_error('Invalid image data.', 422);
        }
        return $this->image_to_data_url($binary);
    }

    public function upload_avatar()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $user = $this->find_by('id', (int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);

        $pictureUrl = null;

        // 1. Multipart file upload
        $file = $_FILES['avatar'] ?? $_FILES['picture'] ?? null;
        if ($file && !empty($file['tmp_name']) && is_uploaded_file($file['tmp_name'])) {
            if ((int) $file['size'] > self::AVATAR_MAX_BYTES) {
                $this->api->respond_error('Image too large. Maximum size is 2MB.', 422);
            }
            $pictureUrl = $this->image_to_data_url((string) file_get_contents($file['tmp_name']));
        }

        // 2. Base64 data URI (from the in-app cropper)
        if (!$pictureUrl) {
            $b = $this->api->body();
            $dataUri = (string) ($b['picture'] ?? $b['avatar'] ?? '');
            if ($dataUri !== '' && str_starts_with($dataUri, 'data:')) {
                $pictureUrl = $this->validate_image_data_uri($dataUri);
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
            $this->api->respond_error('Unsupported file type. Upload your resume as a PDF, DOCX, DOC, RTF or TXT document — not a video, photo or ZIP.', 422);
        }

        // What the file really is, read from its first bytes: the name and the browser's
        // content type can both be wrong, and a renamed .mp4 must never reach the parser.
        $kind = $this->resume_parser->sniff($file['tmp_name']);
        if (isset(\Resume_parser::REJECT_KINDS[$kind])) {
            $this->api->respond_error(\Resume_parser::REJECT_KINDS[$kind], 422);
        }
        $expected = ['pdf' => 'pdf', 'docx' => 'docx', 'doc' => 'doc', 'rtf' => 'rtf', 'txt' => 'txt'];
        if ($kind === 'unknown' || (isset($expected[$ext]) && $kind !== $expected[$ext] && !($ext === 'doc' && $kind === 'txt') && !($ext === 'txt' && $kind === 'rtf'))) {
            $this->api->respond_error('That file is not a readable resume document. Upload a PDF, DOCX or TXT file, or build one free with the Resume Builder.', 422);
        }

        // A resume made with the hanapbuhay Resume Builder carries its own data: exact fill
        if ($kind === 'pdf') {
            $embedded = $this->resume_parser->read_embedded($file['tmp_name']);
            if ($embedded) {
                $this->api->respond(['success' => true, 'parsed' => $embedded, 'verified' => ['ok' => true, 'source' => 'resume_builder']]);
            }
        }

        // Delegate to custom Resume_parser library
        $text = $this->resume_parser->extract_text($file['tmp_name'], $file['type'] ?? '', $ext);
        if (empty(trim($text))) {
            $this->api->respond_error('Could not read any text from this file (a scanned or image-only PDF has none). Try a DOCX or TXT file, or create one with the free Resume Builder.', 422);
        }

        // Does the text read like a resume at all? Keeps receipts, contracts and random
        // downloads from overwriting someone's profile with nonsense.
        $check = $this->resume_parser->looks_like_resume($text);
        if (!$check['ok']) {
            $this->api->respond_error($check['reason'], 422);
        }

        $parsed = $this->resume_parser->parse($text, $file['name']);

        $this->api->respond([
            'success' => true,
            'parsed'  => $parsed,
            'verified' => ['ok' => true, 'source' => 'parsed', 'signals' => $check['signals'], 'confidence' => min(100, $check['score'] * 9)],
            'text_preview' => mb_substr(trim($text), 0, 500),
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

    // POST /api/auth/firebase-token — lets the browser sign in to Firebase as this user
    public function firebase_token()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $this->api->rate_limit('fbtoken_' . $payload['sub'], 30, 600);
        $user = $this->find_by('id', (int) $payload['sub']);
        if (!$user || (int) $user['is_active'] !== 1) $this->api->respond_error('Unauthorized', 401);

        if (!\Firebase_auth::is_configured()) {
            $this->api->respond_error('Firebase sign-in is not configured on the server.', 503);
        }
        $token = \Firebase_auth::create_custom_token((string) $user['id']);
        if (!$token) $this->api->respond_error('Could not create a Firebase token.', 500);

        $this->api->respond(['success' => true, 'token' => $token]);
    }

    /** Create a 24-hour verification link and email it. */
    private function send_verification_email(array $user): void
    {
        if (!$this->has_table('email_verifications')) return; // migration 014 not run: nothing to store the link in
        $token = bin2hex(random_bytes(32));
        $this->db->table('email_verifications')->where('user_id', (int) $user['id'])->delete();
        $this->db->table('email_verifications')->insert([
            'user_id'    => (int) $user['id'],
            'token_hash' => hash('sha256', $token),
            'expires_at' => date('Y-m-d H:i:s', time() + 86400),
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        $frontend = (string) config_item('frontend_url');
        \Mailer::send_notification(
            $user,
            'email_verify',
            'Verify your hanapbuhay email',
            "Welcome to hanapbuhay! Confirm this email address to activate your account.\n\nThe link expires in 24 hours. If you did not create an account, you can ignore this email.",
            $frontend . '/verify-email?token=' . $token,
            'Verify my email'
        );
    }

    // POST /api/auth/verify-email  { token }  — marks the address verified and signs the user in
    public function verify_email()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit('verify_' . $this->api->client_ip(), 20, 900);
        $b = $this->api->body();
        $token = trim((string) ($b['token'] ?? ''));
        if (!preg_match('/^[a-f0-9]{64}$/', $token) || !$this->has_table('email_verifications')) $this->api->respond_error('This verification link is invalid or has expired.', 400);

        $row = $this->db->table('email_verifications')->where('token_hash', hash('sha256', $token))->get();
        if (!$row || strtotime((string) $row['expires_at']) < time()) {
            $this->api->respond_error('This verification link is invalid or has expired.', 400);
        }

        $uid = (int) $row['user_id'];
        $this->db->raw('UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?', [$uid]);
        $this->db->table('email_verifications')->where('user_id', $uid)->delete();

        $user = $this->find_by('id', $uid);
        if (!$user || (int) $user['is_active'] !== 1) $this->api->respond_error('This account is disabled. Contact support.', 403);
        $this->session_response($user);
    }

    // POST /api/auth/resend-verification  { email }  — always answers the same way
    public function resend_verification()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit('resend_verify_' . $this->api->client_ip(), 5, 900);
        $b = $this->api->body();
        $email = strtolower(trim((string) ($b['email'] ?? '')));
        $generic = ['success' => true, 'message' => 'If that account still needs verification, a new link has been sent.'];

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $this->api->respond($generic);
        $user = $this->find_by('email', $email);
        if ($user && empty($user['email_verified_at']) && (int) $user['is_active'] === 1) {
            $this->send_verification_email($user);
        }
        $this->api->respond($generic);
    }

    // POST /api/auth/forgot-password — always answers the same way (no account enumeration)
    public function forgot_password()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit('forgot_' . $this->api->client_ip(), 5, 900);
        $b = $this->api->body();
        $email = strtolower(trim((string) ($b['email'] ?? '')));
        $generic = ['success' => true, 'message' => 'If an account exists for that email, a reset link has been sent.'];
        // migration 012 not run yet: say so (the same answer for every email, so nothing is revealed)
        if (!$this->has_table('password_resets')) $this->api->respond_error('Resetting a password by email is not available yet. Please try again later.', 503);

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $this->api->respond($generic);
        $user = $this->find_by('email', $email);
        if (!$user || (int) $user['is_active'] !== 1) $this->api->respond($generic);

        $token = bin2hex(random_bytes(32));
        $this->db->table('password_resets')->where('user_id', (int) $user['id'])->delete();
        $this->db->table('password_resets')->insert([
            'user_id'    => (int) $user['id'],
            'token_hash' => hash('sha256', $token),
            'expires_at' => date('Y-m-d H:i:s', time() + 3600),
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        $frontend = (string) config_item('frontend_url');
        \Mailer::send_notification(
            $user,
            'password_reset',
            'Reset your hanapbuhay password',
            "We received a request to reset the password for your hanapbuhay account.\n\nClick the button below to choose a new password. The link expires in 1 hour.\n\nIf you did not request this, you can safely ignore this email. Your password will not change.",
            $frontend . '/reset-password?token=' . $token,
            'Reset Password'
        );

        $this->api->respond($generic);
    }

    // POST /api/auth/reset-password
    public function reset_password()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit('reset_' . $this->api->client_ip(), 10, 900);
        $b = $this->api->body();
        $token = trim((string) ($b['token'] ?? ''));
        $pass  = (string) ($b['password'] ?? '');

        if (!preg_match('/^[a-f0-9]{64}$/', $token) || !$this->has_table('password_resets')) $this->api->respond_error('This reset link is invalid or has expired.', 400);
        if (!$this->valid_password($pass)) $this->api->respond_error('Password needs 8+ characters with at least one letter and one number.', 422);

        $row = $this->db->table('password_resets')->where('token_hash', hash('sha256', $token))->get();
        if (!$row || strtotime((string) $row['expires_at']) < time()) {
            $this->api->respond_error('This reset link is invalid or has expired.', 400);
        }

        $uid = (int) $row['user_id'];
        $this->user_model->update_user($uid, ['password' => password_hash($pass, PASSWORD_DEFAULT)]);
        $this->db->table('password_resets')->where('user_id', $uid)->delete();
        $this->db->raw('DELETE FROM refresh_tokens WHERE user_id = ?', [$uid]); // sign out everywhere

        $this->api->respond(['success' => true, 'message' => 'Password updated. You can now sign in.']);
    }

    // POST /api/auth/change-password { current_password, new_password } — signed in
    public function change_password()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $uid = (int) $payload['sub'];
        // few tries: a stolen session must not be able to guess the current password
        $this->api->rate_limit('change_pw_' . $uid, 5, 900);
        $user = $this->find_by('id', $uid);
        if (!$user || (int) $user['is_active'] !== 1) $this->api->respond_error('Unauthorized', 401);

        $b = $this->api->body();
        $current = (string) ($b['current_password'] ?? '');
        $new     = (string) ($b['new_password'] ?? '');

        // 422 (not 401) for a wrong password: the app treats 401 as "session expired" and signs out
        if ($current === '' || !password_verify($current, (string) $user['password'])) {
            $this->api->respond_error('Your current password is incorrect.', 422);
        }
        if (!$this->valid_password($new)) {
            $this->api->respond_error('New password needs 8+ characters with at least one letter and one number.', 422);
        }
        if (password_verify($new, (string) $user['password'])) {
            $this->api->respond_error('Choose a new password that is different from your current one.', 422);
        }

        $this->user_model->update_user($uid, ['password' => password_hash($new, PASSWORD_DEFAULT)]);
        // old reset links stop working (table from migration 012; changing the password must not depend on it)
        if ($this->has_table('password_resets')) $this->db->table('password_resets')->where('user_id', $uid)->delete();
        // sign out every other device; this one gets fresh tokens below
        $this->db->raw('DELETE FROM refresh_tokens WHERE user_id = ?', [$uid]);

        try {
            $frontend = (string) config_item('frontend_url');
            \Mailer::send_notification(
                $user,
                'password_changed',
                'Your hanapbuhay password was changed',
                "The password for your hanapbuhay account was just changed, and you were signed out on your other devices.\n\nIf you did this, no action is needed.\n\nIf you did NOT change it, reset your password right away and contact support.",
                $frontend . '/forgot-password',
                'Reset Password'
            );
        } catch (\Throwable $e) {
            error_log('[change_password] notice email failed: ' . $e->getMessage());
        }

        $this->session_response($this->find_by('id', $uid), 200, ['message' => 'Password changed. You were signed out on your other devices.']);
    }

    // DELETE /api/auth/me — anonymise personal data and close the account
    public function delete_account()
    {
        $this->api->require_method('DELETE');
        $payload = $this->api->require_jwt();
        $user = $this->find_by('id', (int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);
        if ($user['role'] === 'admin') $this->api->respond_error('Admin accounts cannot be deleted from here.', 403);

        $b = $this->api->body();
        if ((string) ($b['confirm'] ?? '') !== 'DELETE') $this->api->respond_error('Type DELETE to confirm.', 422);
        // Accounts with a real password must confirm it; Google-only accounts have a random one.
        if (empty($user['google_sub']) && !password_verify((string) ($b['password'] ?? ''), (string) $user['password'])) {
            $this->api->respond_error('Password is incorrect.', 401);
        }

        $id  = (int) $user['id'];
        $now = date('Y-m-d H:i:s');
        $this->user_model->update_user($id, [
            'full_name'          => 'Deleted User',
            'username'           => 'deleted' . $id,
            'email'              => "deleted-{$id}@deleted.hanapbuhay.invalid",
            'password'           => password_hash(bin2hex(random_bytes(24)), PASSWORD_DEFAULT),
            'phone'              => null,
            'bio'                => null,
            'picture'            => null,
            'location'           => null,
            'google_sub'         => null,
            'notification_prefs' => json_encode(['email' => false, 'job_alerts' => false]),
            'is_active'          => 0,
        ]);
        // a shared Skills Passport link must stop working too
        if (array_key_exists('share_token', $user)) $this->user_model->update_user($id, ['share_token' => null]);
        $this->db->table('jobs')->where('employer_id', $id)->update(['status' => 'archived', 'updated_at' => $now]);
        if (($user['account_type'] ?? '') === 'worker') {
            // open applications are withdrawn, and the Skills Passport goes with the account
            $this->db->raw("UPDATE applications SET status = 'withdrawn' WHERE worker_id = ? AND status NOT IN ('hired', 'rejected', 'withdrawn')", [$id]);
            $this->db->raw('DELETE FROM skills_passport WHERE user_id = ?', [$id]);
            foreach (['skill_certificates', 'work_samples', 'talent_saved', 'talent_invites'] as $t) {
                if (!$this->has_table($t)) continue;
                $col = in_array($t, ['talent_saved', 'talent_invites'], true) ? 'worker_id' : 'user_id';
                $this->db->raw("DELETE FROM {$t} WHERE {$col} = ?", [$id]);
            }
            if (array_key_exists('open_to_work', $user)) $this->db->raw('UPDATE users SET open_to_work = 0 WHERE id = ?', [$id]);
        }
        $this->db->raw('DELETE FROM refresh_tokens WHERE user_id = ?', [$id]);
        if ($this->has_table('password_resets')) $this->db->table('password_resets')->where('user_id', $id)->delete();

        $this->api->respond(['success' => true, 'message' => 'Your account has been deleted.']);
    }

    public function test_notification_email()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $user = $this->find_by('id', (int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);
        // Diagnostic for admins only (removed from Settings): every email uses the Brevo daily quota
        if ($user['role'] !== 'admin') $this->api->respond_error('Admin only.', 403);
        $this->api->rate_limit('test_email_' . (int) $user['id'], 5, 3600);

        if (empty($user['email'])) {
            $this->api->respond_error('No email address associated with this account.', 422);
        }

        $title = 'Test Notification from hanapbuhay';
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
            'account_type' => $r['account_type'] ?? '',
            'location'     => $r['location'] ?? '',
            'picture'      => $r['picture'] ?? '',
            'avatar_color' => isset($r['avatar_color']) ? (int) $r['avatar_color'] : ((int) $r['id'] % 8),
            'is_verified'  => (int) ($r['is_verified'] ?? 0) === 1,
        ], $rows), fn($u) => $u['id'] !== $me));

        $this->api->respond(['success' => true, 'users' => $users]);
    }
}

