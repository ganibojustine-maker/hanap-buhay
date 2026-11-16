<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * /api/support — Help & Support (customer service) between users and the admin team.
 *
 * A worker, employer or client opens a help request (ticket). It reaches every admin
 * in their Support inbox (in-app + email), any admin can answer it, and the reply
 * comes back to the user in-app and by email. Separate from Messages (worker ↔
 * employer chat).
 *
 * Storage: Firebase Realtime Database (no MySQL tables, no migration). The API talks
 * to Firebase with the service account (Firebase_db), so browsers never read these
 * paths directly and every access check happens here.
 *
 *   support/tickets/{id}        summary: uid, cat, subject, status, unread flags, times, preview
 *   support/messages/{id}/{mid} the conversation: fromAdmin, sender, body, at, shots[] (screenshots)
 *   support/users/{uid}/{id}    copy of the summary, so a user's list is one small read
 *   support/open/{id}           true while the request waits for the team (admin badge)
 *
 *   status  open      waiting for the hanapbuhay team
 *           answered  the team replied, waiting for the user
 *           resolved  closed (a new reply from either side opens it again)
 */
class SupportController extends Controller
{
    public const CATEGORIES = [
        'account'      => 'Account & Login',
        'jobs'         => 'Jobs & Applications',
        'payment'      => 'Payments & Packages',
        'verification' => 'Verification & Certificates',
        'report'       => 'Report a problem or user',
        'other'        => 'Other',
    ];
    private const MAX_UNRESOLVED = 5;
    private const ID_RE = '/^\d{6}-[A-Z0-9]{4}$/';
    /** summary fields kept identical in support/tickets and support/users */
    private const SUMMARY = ['uid', 'cat', 'subject', 'status', 'userUnread', 'adminUnread', 'createdAt', 'lastAt', 'resolvedAt', 'preview', 'lastFromAdmin', 'count'];

    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->library('firebase_db');
        $this->call->model('User_model', 'user_model');
        $this->call->model('Application_model', 'application_model');
    }

    /* ── helpers ─────────────────────────────────────────────── */

    private function me(): array
    {
        $payload = $this->api->require_jwt();
        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user || (int) ($user['is_active'] ?? 1) !== 1) $this->api->respond_error('Unauthorized', 401);
        return $user;
    }

    private function is_admin(array $u): bool
    {
        return ($u['role'] ?? '') === 'admin';
    }

    private function require_firebase(): void
    {
        if (!\Firebase_db::is_configured()) {
            $this->api->respond_error('Help & Support is being set up. Please try again later.', 503);
        }
    }

    /** Run a Firebase call; answer 503 (not a crash) if Firebase can't be reached. */
    private function fb(callable $fn)
    {
        try {
            return $fn();
        } catch (\Firebase_db_error $e) {
            error_log('[Support/Firebase] ' . $e->getMessage());
            $this->api->respond_error('Help & Support is temporarily unavailable. Please try again in a few minutes.', 503);
        }
    }

    private function ms(): int
    {
        return (int) floor(microtime(true) * 1000);
    }

    private function iso($ms): ?string
    {
        return $ms ? date('c', (int) floor(((int) $ms) / 1000)) : null;
    }

    private function rand36(int $len): string
    {
        $s = '';
        while (strlen($s) < $len) $s .= strtoupper(base_convert((string) random_int(0, 35), 10, 36));
        return $s;
    }

    private function clean_text($s, int $max): string
    {
        $s = str_replace(["\r\n", "\r"], "\n", (string) $s);
        $s = preg_replace('/[^\P{C}\n\t]/u', '', $s) ?? '';   // drop control characters, keep new lines
        $s = preg_replace("/\n{3,}/", "\n\n", trim($s)) ?? '';
        return mb_substr($s, 0, $max);
    }

    /** At most 3 screenshots per message, each a real image, each under 700 KB encoded. */
    private const MAX_SHOTS = 3;
    private const MAX_SHOT_BYTES = 700 * 1024;

    /**
     * Screenshots arrive as data URLs the browser already resized and re-encoded, so they
     * are small enough to live beside the message. Anything that is not a genuine JPEG,
     * PNG or WEBP image is dropped rather than stored.
     *
     * @return array<int, array{data: string, name: string}>
     */
    private function clean_shots($raw): array
    {
        if (!is_array($raw)) return [];
        $out = [];
        foreach (array_slice($raw, 0, self::MAX_SHOTS) as $item) {
            $url  = is_array($item) ? (string) ($item['data'] ?? '') : (string) $item;
            $name = is_array($item) ? (string) ($item['name'] ?? '') : '';
            if (!preg_match('#^data:image/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$#', $url, $m)) continue;
            if (strlen($url) > self::MAX_SHOT_BYTES) {
                $this->api->respond_error('That screenshot is too large even after resizing. Try a smaller crop.', 422);
            }
            $bytes = base64_decode(preg_replace('/\s+/', '', $m[2]), true);
            if ($bytes === false || strlen($bytes) < 64) continue;
            $info = @getimagesizefromstring($bytes);
            $types = [IMAGETYPE_JPEG => 'image/jpeg', IMAGETYPE_PNG => 'image/png', IMAGETYPE_WEBP => 'image/webp'];
            if (!$info || !isset($types[$info[2]])) continue; // not actually an image
            $out[] = [
                'data' => 'data:' . $types[$info[2]] . ';base64,' . base64_encode($bytes),
                'name' => mb_substr(preg_replace('/[^A-Za-z0-9._\- ]/', '', $name) ?: 'screenshot', 0, 60),
            ];
        }
        return $out;
    }

    private function excerpt(string $s, int $len = 140): string
    {
        $s = trim(preg_replace('/\s+/', ' ', $s));
        return mb_strlen($s) > $len ? rtrim(mb_substr($s, 0, $len - 1)) . '…' : $s;
    }

    private function role_label(?string $type): string
    {
        return ['worker' => 'Worker', 'employer' => 'Employer', 'hirer' => 'Client'][$type ?? ''] ?? 'User';
    }

    /** Paths that set the same summary fields on the ticket and on the owner's copy. */
    private function summary_paths(string $id, int $uid, array $fields): array
    {
        $p = [];
        foreach ($fields as $k => $v) {
            $p["support/tickets/{$id}/{$k}"] = $v;
            $p["support/users/{$uid}/{$id}/{$k}"] = $v;
        }
        if (array_key_exists('status', $fields)) $p["support/open/{$id}"] = $fields['status'] === 'open' ? true : null;
        return $p;
    }

    /** The ticket summary, if this user may see it (its owner or any admin). */
    private function ticket_for(array $me, string $id): array
    {
        if (!preg_match(self::ID_RE, $id)) $this->api->respond_error('Help request not found.', 404);
        $t = $this->fb(fn() => \Firebase_db::get("support/tickets/{$id}"));
        if (!is_array($t) || ((int) ($t['uid'] ?? 0) !== (int) $me['id'] && !$this->is_admin($me))) {
            $this->api->respond_error('Help request not found.', 404);
        }
        $t['id'] = $id;
        return $t;
    }

    /** Whether this request acts as the support team (an admin answering someone else's ticket). */
    private function as_team(array $me, array $t): bool
    {
        return $this->is_admin($me) && (int) $t['uid'] !== (int) $me['id'];
    }

    /** id => users row (id, full_name, email, account_type) for a set of ids, one query. */
    private function users_by_id(array $ids): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
        if (!$ids) return [];
        $rows = $this->db->raw(
            'SELECT id, full_name, email, account_type FROM users WHERE id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')', $ids
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $out = [];
        foreach ($rows as $r) $out[(int) $r['id']] = $r;
        return $out;
    }

    private function admin_ids(): array
    {
        $rows = $this->db->raw("SELECT id FROM users WHERE role = 'admin' AND is_active = 1")->fetchAll(PDO::FETCH_COLUMN) ?: [];
        return array_map('intval', $rows);
    }

    private function notify(int $userId, string $title, string $body, string $link, bool $email): void
    {
        try {
            $this->application_model->create_notification($userId, 'support', $title, $body, $link, $email);
        } catch (\Throwable $e) {
            error_log('[Support notify] ' . $e->getMessage());
        }
    }

    /** Summary row for lists (users see their own; admins see everyone's). */
    private function row(string $id, array $t, array $users = []): array
    {
        $u = $users[(int) ($t['uid'] ?? 0)] ?? null;
        return [
            'id'              => $id,
            'user_id'         => (int) ($t['uid'] ?? 0),
            'subject'         => (string) ($t['subject'] ?? ''),
            'category'        => $t['cat'] ?? 'other',
            'category_label'  => self::CATEGORIES[$t['cat'] ?? ''] ?? 'Other',
            'status'          => $t['status'] ?? 'open',
            'user_unread'     => !empty($t['userUnread']),
            'admin_unread'    => !empty($t['adminUnread']),
            'created_at'      => $this->iso($t['createdAt'] ?? null),
            'last_message_at' => $this->iso($t['lastAt'] ?? ($t['createdAt'] ?? null)),
            'resolved_at'     => $this->iso($t['resolvedAt'] ?? null),
            'preview'         => (string) ($t['preview'] ?? ''),
            'last_from_admin' => !empty($t['lastFromAdmin']),
            'message_count'   => (int) ($t['count'] ?? 0),
            'user_name'       => $u['full_name'] ?? null,
            'user_email'      => $u['email'] ?? null,
            'role_label'      => $this->role_label($u['account_type'] ?? null),
            '_last'           => (int) ($t['lastAt'] ?? ($t['createdAt'] ?? 0)),
        ];
    }

    /** Ticket + conversation, shaped for whoever is looking. */
    private function detail(array $t, array $me): array
    {
        $id = $t['id'];
        $team = $this->as_team($me, $t);
        $raw = $this->fb(fn() => \Firebase_db::get("support/messages/{$id}")) ?: [];
        ksort($raw, SORT_STRING); // message keys start with the time, so this is oldest first

        $people = $this->users_by_id(array_merge([(int) $t['uid']], array_map(fn($m) => (int) ($m['sender'] ?? 0), $raw)));
        $messages = [];
        foreach ($raw as $mid => $m) {
            $fromAdmin = !empty($m['fromAdmin']);
            $name = $people[(int) ($m['sender'] ?? 0)]['full_name'] ?? null;
            $shots = [];
            foreach ((array) ($m['shots'] ?? []) as $sh) {
                if (is_array($sh) && !empty($sh['data'])) $shots[] = ['data' => (string) $sh['data'], 'name' => (string) ($sh['name'] ?? 'screenshot')];
            }
            $messages[] = [
                'id'         => (string) $mid,
                'from_admin' => $fromAdmin,
                'body'       => (string) ($m['body'] ?? ''),
                'shots'      => $shots,
                'created_at' => $this->iso($m['at'] ?? null),
                // users see "hanapbuhay Support"; admins see which teammate answered
                'author'     => $fromAdmin ? ($team ? 'Support · ' . ($name ?: 'Admin') : 'hanapbuhay Support') : ($name ?: 'User'),
            ];
        }

        $out = [
            'id'              => $id,
            'subject'         => (string) ($t['subject'] ?? ''),
            'category'        => $t['cat'] ?? 'other',
            'category_label'  => self::CATEGORIES[$t['cat'] ?? ''] ?? 'Other',
            'status'          => $t['status'] ?? 'open',
            'created_at'      => $this->iso($t['createdAt'] ?? null),
            'last_message_at' => $this->iso($t['lastAt'] ?? null),
            'resolved_at'     => $this->iso($t['resolvedAt'] ?? null),
            'messages'        => $messages,
        ];

        if ($team) {
            $u = $this->user_model->find_by_id((int) $t['uid']);
            $out['user'] = $u ? [
                'id'           => (int) $u['id'],
                'full_name'    => $u['full_name'],
                'email'        => $u['email'],
                'phone'        => $u['phone'] ?? null,
                'account_type' => $u['account_type'],
                'role_label'   => $this->role_label($u['account_type'] ?? null),
                'location'     => $u['location'] ?? null,
                'is_verified'  => (int) ($u['is_verified'] ?? 0) === 1,
                'is_active'    => (int) ($u['is_active'] ?? 1) === 1,
                'joined'       => $u['created_at'] ?? null,
            ] : null;
        }
        return $out;
    }

    /** Read a ticket again after a write (summary only; the write already succeeded). */
    private function reload(string $id): array
    {
        $t = $this->fb(fn() => \Firebase_db::get("support/tickets/{$id}")) ?: [];
        $t['id'] = $id;
        return $t;
    }

    /* ── user + admin endpoints ──────────────────────────────── */

    // GET /api/support/tickets — my help requests
    public function index()
    {
        $this->api->require_method('GET');
        $me = $this->me();
        $this->require_firebase();
        $mine = $this->fb(fn() => \Firebase_db::get('support/users/' . (int) $me['id'])) ?: [];
        $rows = [];
        foreach ($mine as $id => $t) if (is_array($t)) $rows[] = $this->row((string) $id, $t);
        usort($rows, fn($a, $b) => $b['_last'] <=> $a['_last']);
        foreach ($rows as &$r) unset($r['_last']);
        $this->api->respond(['success' => true, 'tickets' => $rows, 'categories' => self::CATEGORIES]);
    }

    // POST /api/support/tickets { category, subject, message }
    public function create()
    {
        $this->api->require_method('POST');
        $me = $this->me();
        $this->require_firebase();
        $this->api->rate_limit('support_new_' . (int) $me['id'], 5, 3600);

        $b = $this->api->body();
        $category = (string) ($b['category'] ?? 'other');
        if (!isset(self::CATEGORIES[$category])) $category = 'other';
        $subject = $this->clean_text(str_replace("\n", ' ', (string) ($b['subject'] ?? '')), 150);
        $message = $this->clean_text($b['message'] ?? '', 3000);
        $shots = $this->clean_shots($b['shots'] ?? $b['screenshots'] ?? null);
        if (mb_strlen($message) < 10) $this->api->respond_error('Tell us a bit more about the problem (at least 10 characters).', 422);
        // the subject is optional: without one, the start of the message names the request
        if ($subject === '') $subject = $this->excerpt($message, 80);

        $uid = (int) $me['id'];
        $mine = $this->fb(fn() => \Firebase_db::get("support/users/{$uid}")) ?: [];
        $open = count(array_filter($mine, fn($t) => is_array($t) && ($t['status'] ?? '') !== 'resolved'));
        if ($open >= self::MAX_UNRESOLVED) {
            $this->api->respond_error('You already have ' . self::MAX_UNRESOLVED . ' open help requests. Please add to one of them, or mark solved ones as resolved.', 429);
        }

        // short readable id, e.g. 261114-K3F9 (date + 4 random characters)
        $id = null;
        for ($i = 0; $i < 4 && !$id; $i++) {
            $try = date('ymd') . '-' . $this->rand36(4);
            if ($this->fb(fn() => \Firebase_db::get("support/tickets/{$try}/uid")) === null) $id = $try;
        }
        if (!$id) $this->api->respond_error('Please try again.', 503);

        $now = $this->ms();
        $mid = sprintf('m%013d%s', $now, $this->rand36(3));
        $summary = [
            'uid' => $uid, 'cat' => $category, 'subject' => $subject, 'status' => 'open',
            'userUnread' => false, 'adminUnread' => true, 'createdAt' => $now, 'lastAt' => $now, 'resolvedAt' => null,
            'preview' => $this->excerpt($message) . ($shots ? ' 📎 ' . count($shots) . ' screenshot' . (count($shots) === 1 ? '' : 's') : ''),
            'lastFromAdmin' => false, 'count' => 1,
        ];
        $this->fb(fn() => \Firebase_db::update([
            "support/tickets/{$id}"        => $summary,
            "support/users/{$uid}/{$id}"   => $summary,
            "support/open/{$id}"           => true,
            "support/messages/{$id}/{$mid}" => ['fromAdmin' => false, 'sender' => $uid, 'body' => $message, 'at' => $now] + ($shots ? ['shots' => $shots] : []),
        ]));

        // every admin sees it in their Support inbox; a new request is also emailed
        $who = ($me['full_name'] ?: 'A user') . ' (' . $this->role_label($me['account_type'] ?? null) . ')';
        foreach ($this->admin_ids() as $aid) {
            if ($aid === $uid) continue;
            $this->notify($aid, "New help request #{$id}: {$subject}",
                "{$who} · " . self::CATEGORIES[$category] . "\n\n" . $this->excerpt($message, 400),
                "/dashboard/support?t={$id}", true);
        }

        $t = $summary + ['id' => $id];
        $this->api->respond(['success' => true, 'ticket' => $this->detail($t, $me)], 201);
    }

    // GET /api/support/tickets/{id} — the conversation (also marks it read)
    public function show($id)
    {
        $this->api->require_method('GET');
        $me = $this->me();
        $this->require_firebase();
        $t = $this->ticket_for($me, (string) $id);
        $flag = $this->as_team($me, $t) ? 'adminUnread' : 'userUnread';
        if (!empty($t[$flag])) {
            $this->fb(fn() => \Firebase_db::update($this->summary_paths($t['id'], (int) $t['uid'], [$flag => false])));
            $t[$flag] = false;
        }
        $this->api->respond(['success' => true, 'ticket' => $this->detail($t, $me)]);
    }

    // POST /api/support/tickets/{id}/reply { message }
    public function reply($id)
    {
        $this->api->require_method('POST');
        $me = $this->me();
        $this->require_firebase();
        $this->api->rate_limit('support_reply_' . (int) $me['id'], 40, 600);
        $t = $this->ticket_for($me, (string) $id);
        $team = $this->as_team($me, $t);

        $body = $this->api->body();
        $message = $this->clean_text($body['message'] ?? '', 3000);
        $shots = $this->clean_shots($body['shots'] ?? $body['screenshots'] ?? null);
        if (mb_strlen($message) < 2 && !$shots) $this->api->respond_error('Write a message first.', 422);
        if ($message === '') $message = $shots ? '(screenshot)' : $message;

        $now = $this->ms();
        $mid = sprintf('m%013d%s', $now, $this->rand36(3));
        $fields = [
            'status' => $team ? 'answered' : 'open',
            'userUnread' => $team, 'adminUnread' => !$team,
            'lastAt' => $now, 'resolvedAt' => null,
            'preview' => $this->excerpt($message) . ($shots ? ' 📎 ' . count($shots) : ''), 'lastFromAdmin' => $team,
            'count' => (int) ($t['count'] ?? 0) + 1,
        ];
        $this->fb(fn() => \Firebase_db::update($this->summary_paths($t['id'], (int) $t['uid'], $fields) + [
            "support/messages/{$t['id']}/{$mid}" => ['fromAdmin' => $team, 'sender' => (int) $me['id'], 'body' => $message, 'at' => $now] + ($shots ? ['shots' => $shots] : []),
        ]));

        if ($team) {
            // the answer the user is waiting for: in-app + email
            $this->notify((int) $t['uid'], "hanapbuhay Support replied: {$t['subject']}",
                $this->excerpt($message, 600) . "\n\nOpen Help & Support to read the full reply or answer back.",
                "/dashboard/support?t={$t['id']}", true);
        } else {
            // a follow-up from the user: in-app only, so the admins' inbox isn't flooded with email
            $who = $me['full_name'] ?: 'The user';
            foreach ($this->admin_ids() as $aid) {
                if ($aid === (int) $me['id']) continue;
                $this->notify($aid, "New reply on help request #{$t['id']}", "{$who}: " . $this->excerpt($message, 200), "/dashboard/support?t={$t['id']}", false);
            }
        }

        $this->api->respond(['success' => true, 'ticket' => $this->detail($this->reload($t['id']), $me)]);
    }

    // POST /api/support/tickets/{id}/status { status: resolved|open }
    public function status($id)
    {
        $this->api->require_method('POST');
        $me = $this->me();
        $this->require_firebase();
        $t = $this->ticket_for($me, (string) $id);
        $team = $this->as_team($me, $t);

        $status = (string) ($this->api->body()['status'] ?? '');
        if (!in_array($status, ['resolved', 'open'], true)) $this->api->respond_error('Choose resolved or open.', 422);
        if ($status === ($t['status'] ?? '')) $this->api->respond(['success' => true, 'ticket' => $this->detail($t, $me)]);

        $fields = $status === 'resolved'
            ? ['status' => 'resolved', 'resolvedAt' => $this->ms(), 'adminUnread' => false]
            : ['status' => 'open', 'resolvedAt' => null, 'adminUnread' => !$team];
        if ($team && $status === 'resolved') $fields['userUnread'] = true;
        $this->fb(fn() => \Firebase_db::update($this->summary_paths($t['id'], (int) $t['uid'], $fields)));

        if ($team && $status === 'resolved') {
            $this->notify((int) $t['uid'], "Help request resolved: {$t['subject']}",
                'The hanapbuhay team marked your help request as resolved. If you still need help, just reply and it opens again.',
                "/dashboard/support?t={$t['id']}", false);
        }
        $this->api->respond(['success' => true, 'ticket' => $this->detail($this->reload($t['id']), $me)]);
    }

    /* ── admin inbox ─────────────────────────────────────────── */

    // GET /api/admin/support?status=open|answered|resolved|all&q=
    public function admin_index()
    {
        $this->api->require_method('GET');
        $me = $this->me();
        if (!$this->is_admin($me)) $this->api->respond_error('Admin only.', 403);
        $this->require_firebase();

        $status = (string) ($_GET['status'] ?? 'open');
        if (!in_array($status, ['open', 'answered', 'resolved', 'all'], true)) $status = 'open';
        $q = mb_strtolower(trim(mb_substr((string) ($_GET['q'] ?? ''), 0, 80)));

        $all = $this->fb(fn() => \Firebase_db::get('support/tickets')) ?: [];
        $all = array_filter($all, 'is_array');
        $users = $this->users_by_id(array_map(fn($t) => (int) ($t['uid'] ?? 0), $all));

        $counts = ['open' => 0, 'answered' => 0, 'resolved' => 0];
        $rows = [];
        foreach ($all as $id => $t) {
            $st = $t['status'] ?? 'open';
            if (isset($counts[$st])) $counts[$st]++;
            if ($status !== 'all' && $st !== $status) continue;
            $r = $this->row((string) $id, $t, $users);
            if ($q !== '') {
                $hay = mb_strtolower(implode(' ', [$r['subject'], $r['user_name'], $r['user_email'], $r['id'], '#' . $r['id']]));
                if (!str_contains($hay, ltrim($q, '#')) && !str_contains($hay, $q)) continue;
            }
            $rows[] = $r;
        }
        // waiting longest first while open; newest activity first otherwise
        usort($rows, $status === 'open' ? fn($a, $b) => $a['_last'] <=> $b['_last'] : fn($a, $b) => $b['_last'] <=> $a['_last']);
        $rows = array_slice($rows, 0, 200);
        foreach ($rows as &$r) unset($r['_last']);

        $this->api->respond(['success' => true, 'tickets' => $rows, 'counts' => $counts, 'categories' => self::CATEGORIES]);
    }
}
