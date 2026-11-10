<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * /api/messages — simple messaging between users.
 */
class MessageController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->model('Message_model', 'message_model');
        $this->call->model('User_model', 'user_model');
    }

    // GET /api/messages/threads — conversation list
    public function threads()
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $uid = (int) $payload['sub'];

        $rows = $this->message_model->get_threads($uid);
        $this->api->respond(['success' => true, 'threads' => $rows ?: []]);
    }

    // GET /api/messages/:partner_id — conversation with partner
    public function conversation($partner_id)
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $uid  = (int) $payload['sub'];
        $pid  = (int) $partner_id;

        $rows = $this->message_model->get_conversation($uid, $pid);

        // Mark received messages as read
        $this->message_model->mark_as_read($uid, $pid);

        $partner = $this->user_model->find_by_id($pid);
        $partnerData = null;
        if ($partner) {
            $partnerData = [
                'id'           => (int) $partner['id'],
                'full_name'    => $partner['full_name'],
                'email'        => $partner['email'],
                'account_type' => $partner['account_type'],
                'location'     => $partner['location'],
                'picture'      => $partner['picture'] ?? null
            ];
        }

        $this->api->respond(['success' => true, 'messages' => $rows ?: [], 'partner' => $partnerData]);
    }

    // POST /api/messages — send a message
    public function send()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $b = $this->api->body();

        $to   = (int) ($b['receiver_id'] ?? 0);
        $body = trim((string) ($b['body'] ?? ''));
        if (!$to || mb_strlen($body) < 1) $this->api->respond_error('Receiver and message body are required.', 422);
        if ($to === (int) $payload['sub']) $this->api->respond_error('Cannot message yourself.', 422);

        $receiver = $this->user_model->find_by_id($to);
        if (!$receiver) $this->api->respond_error('Recipient not found.', 404);

        $msg = $this->message_model->send_message([
            'sender_id'   => (int) $payload['sub'],
            'receiver_id' => $to,
            'job_id'      => is_numeric($b['job_id'] ?? '') ? (int) $b['job_id'] : null,
            'body'        => substr($body, 0, 5000),
        ]);

        try {
            $sender = $this->user_model->find_by_id((int) $payload['sub']);
            $sender_name = $sender ? ($sender['full_name'] ?: 'Someone') : 'Someone';
            $this->call->model('Application_model', 'application_model');
            $this->application_model->create_notification(
                $to,
                'message',
                "New message from {$sender_name}",
                substr($body, 0, 120),
                '/dashboard/messages'
            );
        } catch (\Throwable $t) {
            error_log('[Message Notification Error] ' . $t->getMessage());
        }

        $this->api->respond(['success' => true, 'message' => $msg], 201);
    }

    // GET /api/messages/unread-count
    public function unread_count()
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $count = $this->message_model->get_unread_count((int) $payload['sub']);
        $this->api->respond(['success' => true, 'count' => (int) $count]);
    }
}
