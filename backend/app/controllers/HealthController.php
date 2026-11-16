<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * GET /api/health  -> confirms API, CORS and database are alive.
 */
class HealthController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
    }

    public function index()
    {
        $db_ok = false;
        try {
            $this->call->database();
            $this->db->raw('SELECT 1');
            $db_ok = true;
        } catch (Throwable $e) {
            $db_ok = false;
        }

        $this->api->respond([
            'success'  => true,
            'data'     => [
                'app'      => config_item('app_name') ?: 'hanapbuhay',
                'env'      => config_item('environment'),
                'database' => $db_ok ? 'connected' : 'unavailable',
                'time'     => gmdate('c'),
            ],
        ], $db_ok ? 200 : 503);
    }
}
