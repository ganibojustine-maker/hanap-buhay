<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * /api/social — following, connections and public profiles.
 *
 *   POST   /api/social/follow        { user_id }   follow someone
 *   DELETE /api/social/follow/{id}                 unfollow
 *   GET    /api/social/network?kind= following | followers | connections
 *   GET    /api/social/suggestions                 people worth following / messaging, with the reason why
 *   GET    /api/social/profile/{id}                public profile: counts, rating, portfolio, open jobs
 *
 * A mutual follow is a connection. Connections are the people offered first in Messages,
 * which is what fills the "who do I even message?" gap on an empty inbox.
 */
class SocialController extends Controller
{
    private const KINDS = ['following', 'followers', 'connections'];

    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->library('schema_info');
        $this->call->model('User_model', 'user_model');
        $this->call->model('Social_model', 'social_model');
        $this->call->model('Application_model', 'application_model');
    }

    private function me(): array
    {
        $payload = $this->api->require_jwt();
        $u = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$u || (int) ($u['is_active'] ?? 1) !== 1) $this->api->respond_error('Unauthorized', 401);
        return $u;
    }

    private function require_ready(): void
    {
        if (!$this->social_model->ready()) {
            $this->api->respond_error('Following is not switched on yet. Please try again later.', 503);
        }
    }

    /** One person as the app shows them in a list. */
    private function card(array $r, array $ratings = []): array
    {
        $id = (int) $r['id'];
        return [
            'id'           => $id,
            'full_name'    => $r['full_name'] ?? '',
            'account_type' => $r['account_type'] ?? '',
            'location'     => $r['location'] ?? '',
            'picture'      => $r['picture'] ?? null,
            'avatar_color' => isset($r['avatar_color']) ? (int) $r['avatar_color'] : ($id % 8),
            'bio'          => isset($r['bio']) ? mb_substr((string) $r['bio'], 0, 160) : null,
            'is_verified'  => (int) ($r['is_verified'] ?? 0) === 1,
            'i_follow'     => !empty($r['i_follow']),
            'follows_me'   => !empty($r['follows_me']),
            'reason'       => $r['reason'] ?? null,
            'rating'       => $ratings[$id] ?? null,
        ];
    }

    /** Add rating summaries to a list of cards, one query per account type. */
    private function with_ratings(array $rows): array
    {
        $byType = [];
        foreach ($rows as $r) $byType[$r['account_type'] ?? ''][] = (int) $r['id'];
        $ratings = [];
        foreach ($byType as $type => $ids) {
            foreach ($this->social_model->ratings_for_many($ids, $type ?: null) as $uid => $v) $ratings[$uid] = $v;
        }
        return array_map(fn($r) => $this->card($r, $ratings), $rows);
    }

    // POST /api/social/follow { user_id }
    public function follow()
    {
        $this->api->require_method('POST');
        $me = $this->me();
        $this->require_ready();
        $this->api->rate_limit('follow_' . (int) $me['id'], 120, 3600);

        $b = $this->api->body();
        $target = (int) ($b['user_id'] ?? 0);
        if (!$target || $target === (int) $me['id']) $this->api->respond_error('Choose someone else to follow.', 422);

        $other = $this->user_model->find_by_id($target);
        if (!$other || (int) $other['is_active'] !== 1) $this->api->respond_error('That account is not available.', 404);

        $already = $this->social_model->is_following((int) $me['id'], $target);
        $this->social_model->follow((int) $me['id'], $target);
        $mutual = $this->social_model->is_following($target, (int) $me['id']);

        if (!$already) {
            $name = $me['full_name'] ?: 'Someone';
            $this->application_model->create_notification(
                $target,
                'follow',
                $mutual ? "You and {$name} are now connected" : "{$name} started following you",
                $mutual
                    ? "You both follow each other, so you can message each other any time from your dashboard."
                    : "{$name} will see your new job posts and updates. Follow back to be able to message each other.",
                '/dashboard/network',
                false
            );
        }

        $this->api->respond([
            'success' => true,
            'following' => true,
            'connected' => $mutual,
            'counts' => $this->social_model->counts((int) $me['id']),
        ], $already ? 200 : 201);
    }

    // DELETE /api/social/follow/{id}
    public function unfollow($id)
    {
        $this->api->require_method('DELETE');
        $me = $this->me();
        $this->require_ready();
        $this->social_model->unfollow((int) $me['id'], (int) $id);
        $this->api->respond(['success' => true, 'following' => false, 'counts' => $this->social_model->counts((int) $me['id'])]);
    }

    // GET /api/social/network?kind=following|followers|connections
    public function network()
    {
        $this->api->require_method('GET');
        $me = $this->me();
        if (!$this->social_model->ready()) {
            $this->api->respond(['success' => true, 'setup_needed' => true, 'people' => [], 'counts' => ['following' => 0, 'followers' => 0, 'connections' => 0]]);
        }
        $kind = (string) ($_GET['kind'] ?? 'connections');
        if (!in_array($kind, self::KINDS, true)) $kind = 'connections';

        $rows = $this->social_model->people((int) $me['id'], $kind, 150);
        if ($kind === 'following' || $kind === 'connections') {
            foreach ($rows as &$r) $r['follows_me'] = $kind === 'connections';
            unset($r);
        }
        $this->api->respond([
            'success' => true,
            'kind'    => $kind,
            'people'  => $this->with_ratings($rows),
            'counts'  => $this->social_model->counts((int) $me['id']),
        ]);
    }

    /**
     * GET /api/social/suggestions — who this person actually has a reason to talk to.
     * Workers: the employers they applied to, then employers hiring in their town.
     * Employers/clients: the people who applied to their jobs, then workers in their town.
     * Everyone: people who already follow them (follow back = connection).
     */
    public function suggestions()
    {
        $this->api->require_method('GET');
        $me = $this->me();
        $uid = (int) $me['id'];
        $isWorker = ($me['account_type'] ?? '') === 'worker' && ($me['role'] ?? '') !== 'admin';
        $town = (string) ($me['location'] ?? '');
        $q = trim((string) ($_GET['q'] ?? ''));

        $following = array_flip($this->social_model->following_ids($uid));
        $picked = [];
        $out = [];
        $add = function (array $rows, string $reason) use (&$out, &$picked, $uid, $following) {
            foreach ($rows as $r) {
                $id = (int) $r['id'];
                if (!$id || $id === $uid || isset($picked[$id])) continue;
                $picked[$id] = true;
                $r['reason'] = $reason;
                $r['i_follow'] = isset($following[$id]);
                $out[] = $r;
            }
        };

        $cols = 'u.id, u.full_name, u.account_type, u.location, u.picture, u.bio, u.is_verified';
        $colsAvatar = $this->schema_info->has_column('users', 'avatar_color') ? ', u.avatar_color' : '';
        $cols .= $colsAvatar;

        // 1. people who already follow me — following back makes a connection
        if ($this->social_model->ready()) {
            $add($this->db->raw(
                "SELECT {$cols}, 1 AS follows_me FROM follows f JOIN users u ON u.id = f.follower_id
                 WHERE f.following_id = ? AND u.is_active = 1 ORDER BY f.created_at DESC LIMIT 20", [$uid]
            )->fetchAll(PDO::FETCH_ASSOC) ?: [], 'Follows you');
        }

        // 2. people I have a hiring history with, in either direction
        if ($isWorker) {
            $add($this->db->raw(
                "SELECT {$cols} FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = j.employer_id
                 WHERE a.worker_id = ? AND u.is_active = 1 GROUP BY u.id ORDER BY MAX(a.created_at) DESC LIMIT 20", [$uid]
            )->fetchAll(PDO::FETCH_ASSOC) ?: [], 'You applied here');
        } else {
            $add($this->db->raw(
                "SELECT {$cols} FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = a.worker_id
                 WHERE j.employer_id = ? AND a.status <> 'withdrawn' AND u.is_active = 1 GROUP BY u.id ORDER BY MAX(a.created_at) DESC LIMIT 25", [$uid]
            )->fetchAll(PDO::FETCH_ASSOC) ?: [], 'Applied to your job');
        }

        // 3. the other side of the market, nearest town first
        $wantType = $isWorker ? "u.account_type IN ('employer','hirer')" : "u.account_type = 'worker'";
        $args = [];
        $where = "u.is_active = 1 AND u.id <> ? AND {$wantType} AND u.role <> 'admin'";
        $args[] = $uid;
        if ($q !== '') {
            $where .= ' AND (u.full_name LIKE ? OR u.location LIKE ?)';
            $like = '%' . addcslashes($q, '%_\\') . '%';
            $args[] = $like; $args[] = $like;
        }
        $order = $town !== '' ? 'CASE WHEN u.location = ? THEN 0 ELSE 1 END, u.is_verified DESC, u.created_at DESC' : 'u.is_verified DESC, u.created_at DESC';
        if ($town !== '') $args[] = $town;
        $add($this->db->raw(
            "SELECT {$cols} FROM users u WHERE {$where} ORDER BY {$order} LIMIT 30", $args
        )->fetchAll(PDO::FETCH_ASSOC) ?: [], $isWorker ? 'Hiring near you' : 'Worker near you');

        // 4. anyone else, so search always has an answer
        if ($q !== '' || count($out) < 6) {
            $args2 = [$uid];
            $w2 = 'u.is_active = 1 AND u.id <> ?';
            if ($q !== '') {
                $w2 .= ' AND (u.full_name LIKE ? OR u.location LIKE ?)';
                $like = '%' . addcslashes($q, '%_\\') . '%';
                $args2[] = $like; $args2[] = $like;
            }
            $add($this->db->raw(
                "SELECT {$cols} FROM users u WHERE {$w2} ORDER BY u.created_at DESC LIMIT 25", $args2
            )->fetchAll(PDO::FETCH_ASSOC) ?: [], 'On hanapbuhay');
        }

        $this->api->respond([
            'success' => true,
            'people'  => $this->with_ratings(array_slice($out, 0, 40)),
            'counts'  => $this->social_model->counts($uid),
        ]);
    }

    /**
     * GET /api/social/profile/{id} — the public page behind every name in the app.
     * Workers show skills, portfolio and their rating from employers; employers show
     * their open jobs and their rating from workers.
     */
    public function profile($id)
    {
        $this->api->require_method('GET');
        $viewer = null;
        $token = $this->api->get_bearer_token();
        if ($token) {
            $payload = $this->api->validate_jwt($token);
            if ($payload) $viewer = $this->user_model->find_by_id((int) $payload['sub']);
        }

        $u = $this->user_model->find_by_id((int) $id);
        if (!$u || (int) $u['is_active'] !== 1) $this->api->respond_error('Profile not found.', 404);
        $uid = (int) $u['id'];
        $type = $u['account_type'] ?? '';

        $out = [
            'id'           => $uid,
            'full_name'    => $u['full_name'],
            'account_type' => $type,
            'location'     => $u['location'] ?? null,
            'bio'          => $u['bio'] ?? null,
            'picture'      => $u['picture'] ?? null,
            'avatar_color' => isset($u['avatar_color']) ? (int) $u['avatar_color'] : ($uid % 8),
            'is_verified'  => (int) ($u['is_verified'] ?? 0) === 1,
            'joined'       => $u['created_at'] ?? null,
            'counts'       => $this->social_model->counts($uid),
            'rating'       => $this->social_model->rating_for($uid, $type),
            'is_me'        => $viewer && (int) $viewer['id'] === $uid,
            'i_follow'     => $viewer ? $this->social_model->is_following((int) $viewer['id'], $uid) : false,
            'follows_me'   => $viewer ? $this->social_model->is_following($uid, (int) $viewer['id']) : false,
        ];
        $out['connected'] = $out['i_follow'] && $out['follows_me'];

        if ($type === 'worker') {
            $out['skills'] = $this->db->raw(
                'SELECT skill_name, level, source, verified FROM skills_passport WHERE user_id = ? ORDER BY verified DESC, created_at DESC LIMIT 30', [$uid]
            )->fetchAll(PDO::FETCH_ASSOC) ?: [];
            if ($this->schema_info->has_table('work_samples')) {
                $out['portfolio'] = $this->db->raw(
                    'SELECT id, title, description, skill_name, kind, taken_on, created_at FROM work_samples WHERE user_id = ? ORDER BY created_at DESC LIMIT 12', [$uid]
                )->fetchAll(PDO::FETCH_ASSOC) ?: [];
            }
            $out['hired_count'] = (int) $this->db->raw(
                "SELECT COUNT(*) FROM applications WHERE worker_id = ? AND status = 'hired'", [$uid]
            )->fetchColumn();
        } else {
            $out['jobs'] = $this->db->raw(
                "SELECT id, title, company, location, job_type, salary_min, salary_max, created_at
                 FROM jobs WHERE employer_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 10", [$uid]
            )->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $out['hires_count'] = (int) $this->db->raw(
                "SELECT COUNT(*) FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.employer_id = ? AND a.status = 'hired'", [$uid]
            )->fetchColumn();
        }

        $out['reviews'] = $this->recent_reviews($uid, $type);
        $this->api->respond(['success' => true, 'profile' => $out]);
    }

    /** The latest visible reviews about this account, whichever direction they came from. */
    private function recent_reviews(int $uid, ?string $type): array
    {
        $table = $this->social_model->rating_table($type);
        if (!$table) return [];
        $isWorker = $table === 'worker_reviews';
        $col = $isWorker ? 'worker_id' : 'employer_id';
        $author = $isWorker ? 'employer_id' : 'worker_id';
        $rows = $this->db->raw(
            "SELECT r.rating, r.comment, r.created_at, a.full_name AS author, j.title AS job_title
             FROM {$table} r LEFT JOIN users a ON a.id = r.{$author} LEFT JOIN jobs j ON j.id = r.job_id
             WHERE r.{$col} = ? AND r.is_hidden = 0 ORDER BY r.created_at DESC LIMIT 10", [$uid]
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        return array_map(fn($r) => [
            'rating'     => (int) $r['rating'],
            'comment'    => $r['comment'],
            'created_at' => $r['created_at'],
            'by'         => $this->short_name($r['author']),
            'job_title'  => $r['job_title'],
        ], $rows);
    }

    /** "Maria Santos" → "Maria S." (reviews are public: no full names) */
    private function short_name(?string $name): string
    {
        $parts = preg_split('/\s+/', trim((string) $name)) ?: [];
        if (!$parts || $parts[0] === '') return 'A hanapbuhay user';
        $last = count($parts) > 1 ? ' ' . mb_strtoupper(mb_substr(end($parts), 0, 1)) . '.' : '';
        return $parts[0] . $last;
    }
}
