<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * /api/resume — the worker's free Resume Builder draft.
 * The draft is only the form data; the PDF itself is generated in the browser.
 */
class ResumeController extends Controller
{
    /** Sections and their fields, with max lengths. Anything else is dropped. */
    private const LIST_FIELDS = [
        'skills'         => ['max' => 40, 'fields' => ['name' => 120, 'level' => 20]],
        'certifications' => ['max' => 20, 'fields' => ['title' => 200, 'issuer' => 150, 'number' => 80, 'year' => 10]],
        'experience'     => ['max' => 15, 'fields' => ['position' => 150, 'employer' => 150, 'place' => 150, 'start' => 20, 'end' => 20, 'details' => 1500]],
        'education'      => ['max' => 10, 'fields' => ['school' => 200, 'level' => 150, 'year' => 20]],
    ];
    private const TEXT_FIELDS = [
        'full_name' => 150, 'email' => 255, 'phone' => 32, 'town' => 150, 'address' => 255,
        'about' => 2000, 'birthdate' => 20, 'languages' => 200, 'theme' => 20,
    ];

    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->model('Skill_model', 'skill_model');
        $this->call->model('User_model', 'user_model');
    }

    private function require_worker(): int
    {
        $payload = $this->api->require_jwt();
        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);
        if ($user['account_type'] !== 'worker') $this->api->respond_error('The Resume Builder is for workers.', 403);
        return (int) $user['id'];
    }

    // GET /api/resume
    public function show()
    {
        $this->api->require_method('GET');
        $uid = $this->require_worker();
        $this->api->respond(['success' => true, 'resume' => $this->skill_model->get_resume($uid)]);
    }

    // PUT /api/resume
    public function save()
    {
        $method = $_SERVER['REQUEST_METHOD'] ?? '';
        if ($method !== 'PUT' && $method !== 'POST') $this->api->respond_error('Method Not Allowed', 405);
        $uid = $this->require_worker();
        $b = $this->api->body();

        $clean = ['v' => 1];
        foreach (self::TEXT_FIELDS as $k => $max) {
            $clean[$k] = is_scalar($b[$k] ?? null) ? mb_substr(trim((string) $b[$k]), 0, $max) : '';
        }
        $clean['show_photo'] = !empty($b['show_photo']);

        foreach (self::LIST_FIELDS as $section => $spec) {
            $rows = [];
            foreach (array_slice(is_array($b[$section] ?? null) ? $b[$section] : [], 0, $spec['max']) as $row) {
                if (!is_array($row)) continue;
                $item = [];
                foreach ($spec['fields'] as $f => $max) {
                    $item[$f] = is_scalar($row[$f] ?? null) ? mb_substr(trim((string) $row[$f]), 0, $max) : '';
                }
                if (implode('', $item) !== '') $rows[] = $item;
            }
            $clean[$section] = $rows;
        }

        if (!$this->skill_model->resume_ready()) {
            // migration 015 not run: nowhere to keep it (the PDF can still be made in the browser)
            $this->api->respond_error('Saving your resume is not available yet. You can still download it as a PDF.', 503);
        }
        $this->skill_model->save_resume($uid, $clean);
        $this->api->respond(['success' => true, 'resume' => $clean]);
    }
}
