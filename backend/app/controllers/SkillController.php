<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * /api/skills — Worker skills passport & training.
 */
class SkillController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->model('Skill_model', 'skill_model');
        $this->call->model('User_model', 'user_model');
    }

    // GET /api/skills/my — worker's skills (Read)
    public function my_skills()
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $rows = $this->skill_model->get_user_skills((int) $payload['sub']);
        $this->api->respond(['success' => true, 'skills' => $rows ?: []]);
    }

    // POST /api/skills — add skill (Create)
    public function add_skill()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user || $user['account_type'] !== 'worker') $this->api->respond_error('Only workers can manage skills.', 403);

        $b = $this->api->body();
        $name = trim((string) ($b['skill_name'] ?? ''));
        if (mb_strlen($name) < 2) $this->api->respond_error('Enter a skill name.', 422);

        $skill = $this->skill_model->add_skill([
            'user_id'     => (int) $payload['sub'],
            'skill_name'  => substr($name, 0, 255),
            'category'    => substr(trim((string) ($b['category'] ?? '')), 0, 100) ?: null,
            'level'       => in_array($b['level'] ?? '', ['beginner','intermediate','advanced','expert'], true) ? $b['level'] : null,
            'source'      => in_array($b['source'] ?? '', ['self','tesda','employer','training','other'], true) ? $b['source'] : 'self',
            'certificate' => substr(trim((string) ($b['certificate'] ?? '')), 0, 255) ?: null,
        ]);

        $this->api->respond(['success' => true, 'skill' => $skill], 201);
    }

    // PUT /api/skills/:id — update skill (Update)
    public function update_skill($id)
    {
        $payload = $this->api->require_jwt();
        $skill = $this->skill_model->find_skill((int) $id);
        if (!$skill) $this->api->respond_error('Skill not found.', 404);
        if ((int) $skill['user_id'] !== (int) $payload['sub']) $this->api->respond_error('Forbidden', 403);

        $b = $this->api->body();
        $data = [];
        if (isset($b['skill_name']) && mb_strlen(trim((string) $b['skill_name'])) >= 2) {
            $data['skill_name'] = substr(trim((string) $b['skill_name']), 0, 255);
        }
        if (array_key_exists('category', $b)) {
            $data['category'] = substr(trim((string) ($b['category'] ?? '')), 0, 100) ?: null;
        }
        if (isset($b['level']) && in_array($b['level'], ['beginner','intermediate','advanced','expert'], true)) {
            $data['level'] = $b['level'];
        }
        if (isset($b['source']) && in_array($b['source'], ['self','tesda','employer','training','other'], true)) {
            $data['source'] = $b['source'];
        }
        if (array_key_exists('certificate', $b)) {
            $data['certificate'] = substr(trim((string) ($b['certificate'] ?? '')), 0, 255) ?: null;
        }

        if (empty($data)) $this->api->respond_error('No valid fields to update.', 422);

        $this->skill_model->update_skill((int) $id, $data);
        $this->api->respond(['success' => true, 'skill' => $this->skill_model->find_skill((int) $id)]);
    }

    // DELETE /api/skills/:id — delete skill (Delete)
    public function delete_skill($id)
    {
        $this->api->require_method('DELETE');
        $payload = $this->api->require_jwt();
        $skill = $this->skill_model->find_skill((int) $id);
        if (!$skill) $this->api->respond_error('Skill not found.', 404);
        if ((int) $skill['user_id'] !== (int) $payload['sub']) $this->api->respond_error('Forbidden', 403);

        $this->skill_model->delete_skill((int) $id);
        $this->api->respond(['success' => true]);
    }

    // GET /api/skills/passport-score — completion percentage
    public function passport_score()
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);

        $skills = $this->skill_model->get_user_skills((int) $payload['sub']);
        $count  = count($skills ?: []);

        $score = 0;
        if (!empty($user['full_name']))    $score += 15;
        if (!empty($user['location']))     $score += 10;
        if (!empty($user['phone']))        $score += 10;
        if (!empty($user['bio']))          $score += 15;
        if ($count >= 1)  $score += 20;
        if ($count >= 3)  $score += 15;
        if ($count >= 5)  $score += 10;
        $verified = array_filter($skills ?: [], fn($s) => (int) $s['verified'] === 1);
        if (count($verified) >= 1) $score += 5;

        $this->api->respond(['success' => true, 'score' => min(100, $score), 'skills_count' => $count]);
    }

    // GET /api/training — training courses (public)
    public function training()
    {
        $this->api->require_method('GET');
        $loc = trim((string) ($_GET['location'] ?? ''));
        $cat = trim((string) ($_GET['category'] ?? ''));

        $rows = $this->skill_model->get_active_training_courses($loc, $cat, 20);
        $this->api->respond(['success' => true, 'courses' => $rows ?: []]);
    }
}
