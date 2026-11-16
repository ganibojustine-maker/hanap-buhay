<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Chat itself lives in Firebase Realtime Database and never touches MySQL.
 * This controller only provides what Firebase cannot:
 *   POST /api/messages/notify  content-free "new message" notification
 *   GET  /api/users/{id}       minimal public profile for a chat partner
 */
class MessageController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->model('User_model', 'user_model');
        $this->call->model('Application_model', 'application_model');
    }

    // POST /api/messages/notify  { receiver_id }
    // Stores NO message text: only "X sent you a message", at most once per 10 minutes per sender.
    public function notify()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $me = (int) $payload['sub'];
        $this->api->rate_limit('msg_notify_' . $me, 60, 300);

        $b  = $this->api->body();
        $to = (int) ($b['receiver_id'] ?? 0);
        if (!$to || $to === $me) $this->api->respond_error('Invalid recipient.', 422);

        $receiver = $this->user_model->find_by_id($to);
        $sender   = $this->user_model->find_by_id($me);
        if (!$receiver || (int) $receiver['is_active'] !== 1 || !$sender) {
            $this->api->respond_error('Recipient not found.', 404);
        }

        $name  = $sender['full_name'] ?: 'Someone';
        $title = "New message from {$name}";

        $recent = $this->db->raw(
            "SELECT id FROM notifications WHERE user_id = ? AND type = 'message' AND title = ? AND created_at > ? LIMIT 1",
            [$to, $title, date('Y-m-d H:i:s', time() - 600)]
        );
        $already = $recent ? $recent->fetch(\PDO::FETCH_ASSOC) : false;

        if (!$already) {
            $this->application_model->create_notification(
                $to,
                'message',
                $title,
                'Open Messages to read and reply.',
                '/dashboard/messages',
                false // in-app only, never email for chat
            );
        }

        $this->api->respond(['success' => true]);
    }

    // GET /api/users/{id} — name, type, location and photo only (no email, no phone)
    public function profile($id)
    {
        $this->api->require_method('GET');
        $this->api->require_jwt();
        $u = $this->user_model->find_by_id((int) $id);
        if (!$u || (int) $u['is_active'] !== 1) $this->api->respond_error('User not found.', 404);

        $this->call->model('Social_model', 'social_model');
        $this->api->respond(['success' => true, 'user' => [
            'id'           => (int) $u['id'],
            'full_name'    => $u['full_name'],
            'account_type' => $u['account_type'],
            'location'     => $u['location'],
            'picture'      => $u['picture'] ?? null,
            'avatar_color' => isset($u['avatar_color']) ? (int) $u['avatar_color'] : ((int) $u['id'] % 8),
            'is_verified'  => (int) ($u['is_verified'] ?? 0) === 1,
            'rating'       => $this->social_model->rating_for((int) $u['id'], $u['account_type'] ?? null),
        ]]);
    }
}
