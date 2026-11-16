<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * GET /api/cron/reminders?key=CRON_SECRET — send due interview reminders, re-check pending
 * PayMongo payments, end plans past their date and send renewal reminders.
 * For a free external pinger (e.g. cron-job.org every 15–30 minutes); without one,
 * reminders still go out whenever someone has the app open (see Reminders).
 * Disabled (404) until CRON_SECRET is set.
 */
class CronController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
    }

    public function reminders()
    {
        $this->api->require_method('GET');
        $secret = (string) (getenv('CRON_SECRET') ?: '');
        $key = (string) ($_GET['key'] ?? ($_SERVER['HTTP_X_CRON_KEY'] ?? ''));
        if (strlen($secret) < 16 || !hash_equals($secret, $key)) $this->api->respond_error('Not found.', 404);

        require_once APP_DIR . 'libraries' . DIRECTORY_SEPARATOR . 'Reminders.php';
        $out = ['success' => true] + \Reminders::run(true);
        // the same pinger keeps payments right: PayMongo does not resend webhooks it could not
        // deliver, so pending payments are re-checked here; plans past their date end here too
        require_once APP_DIR . 'libraries' . DIRECTORY_SEPARATOR . 'Payments.php';
        if (\Payments::ready()) {
            $p = new \Payments();
            $out['payments'] = $p->reconcile(null, 50) + $p->run_lifecycle();
        }
        $this->api->respond($out);
    }
}
