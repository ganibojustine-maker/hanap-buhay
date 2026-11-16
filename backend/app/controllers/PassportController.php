<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * GET /api/passport/{token} — a worker's Skills Passport, public, for the link / QR code
 * the worker chose to share (AuthController::share). No phone, email, address or birthday:
 * employers contact the worker through hanapbuhay. The worker can turn the link off or
 * replace it at any time, which makes the old one return 404.
 */
class PassportController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->library('schema_info');
        $this->call->model('Skill_model', 'skill_model');
        $this->call->library('availability');
    }

    public function show($token)
    {
        $this->api->require_method('GET');
        $this->api->rate_limit('passport_' . $this->api->client_ip(), 120, 600);
        $token = (string) $token;
        if (!preg_match('/^[A-Za-z0-9_-]{12}$/', $token) || !$this->schema_info->has_column('users', 'share_token')) {
            $this->api->respond_error('This Skills Passport link is not active.', 404);
        }
        $u = $this->db->table('users')->where('share_token', $token)->get();
        if (!$u || (int) $u['is_active'] !== 1 || $u['account_type'] !== 'worker') {
            $this->api->respond_error('This Skills Passport link is not active.', 404);
        }
        $uid = (int) $u['id'];

        $skills = $this->db->table('skills_passport')
            ->select('skill_name, category, level, source, certificate_id, verified')
            ->where('user_id', $uid)->order_by('created_at DESC')->get_all() ?: [];
        $certs = [];
        if ($this->schema_info->has_table('skill_certificates')) {
            $rows = $this->db->table('skill_certificates')
                ->select('id, title, issuer, nc_level, issued_on, valid_until, status')
                ->where('user_id', $uid)->where('status', 'verified')->order_by('created_at DESC')->get_all() ?: [];
            $verifiedIds = array_map('intval', array_column($rows, 'id'));
            foreach ($rows as $c) {
                $certs[] = ['title' => $c['title'], 'issuer' => $c['issuer'], 'nc_level' => $c['nc_level'],
                            'issued_on' => $c['issued_on'], 'valid_until' => $c['valid_until']];
            }
            foreach ($skills as &$s) {
                $s['verified'] = (int) $s['verified'] === 1 || in_array((int) $s['certificate_id'], $verifiedIds, true);
            }
            unset($s);
        }
        $skills = array_map(fn($s) => [
            'name' => $s['skill_name'], 'category' => $s['category'], 'level' => $s['level'],
            'source' => $s['source'], 'verified' => (bool) $s['verified'],
        ], $skills);

        // work history and schooling from the Resume Builder, without contact details
        $resume = $this->skill_model->get_resume($uid) ?: [];
        $experience = array_map(fn($e) => [
            'position' => $e['position'] ?? '', 'employer' => $e['employer'] ?? '', 'place' => $e['place'] ?? '',
            'start' => $e['start'] ?? '', 'end' => $e['end'] ?? '', 'details' => mb_substr((string) ($e['details'] ?? ''), 0, 400),
        ], array_slice((array) ($resume['experience'] ?? []), 0, 8));
        $education = array_map(fn($e) => [
            'school' => $e['school'] ?? '', 'level' => $e['level'] ?? '', 'year' => $e['year'] ?? '',
        ], array_slice((array) ($resume['education'] ?? []), 0, 5));

        // photos of the worker's own work (Skills Passport → Work photos, migration 018).
        // Only the description travels here; the picture is /api/portfolio/{id}/file.
        $work = [];
        if ($this->schema_info->has_table('work_samples')) {
            $work = $this->db->raw('SELECT id, title, description, skill_name, taken_on FROM work_samples WHERE user_id = ? ORDER BY created_at DESC LIMIT 24', [$uid])
                ->fetchAll(\PDO::FETCH_ASSOC) ?: [];
            foreach ($work as &$w) { $w['id'] = (int) $w['id']; $w['url'] = '/api/portfolio/' . $w['id'] . '/file'; }
            unset($w);
        }

        $hired = (int) $this->db->raw("SELECT COUNT(*) FROM applications WHERE worker_id = ? AND status = 'hired'", [$uid])->fetchColumn();

        $availability = \Availability::from_row($u);
        if ($availability) unset($availability['expected_rate'], $availability['rate_unit']); // pay is between the worker and the employer

        $this->api->respond([
            'success' => true,
            'passport' => [
                'id'           => $uid,
                'full_name'    => $u['full_name'],
                'picture'      => $u['picture'] ?? null,
                'location'     => $u['location'],
                'bio'          => $u['bio'] ? mb_substr((string) $u['bio'], 0, 1200) : null,
                'is_verified'  => (int) ($u['is_verified'] ?? 0) === 1,
                'member_since' => $u['created_at'] ?? null,
                'hired_count'  => $hired,
                'languages'    => mb_substr((string) ($resume['languages'] ?? ''), 0, 200) ?: null,
                'availability' => $availability,
                'skills'       => $skills,
                'certificates' => $certs,
                'experience'   => $experience,
                'education'    => $education,
                'work'         => $work,
            ],
        ]);
    }
}
