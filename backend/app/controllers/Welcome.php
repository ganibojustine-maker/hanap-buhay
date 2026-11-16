<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * GET /  — the API's front door. The website is the React app; this only says what the
 * server is and where its health check lives (no framework page, no version numbers).
 */
class Welcome extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
    }

    public function index()
    {
        $this->api->respond(['success' => true, 'service' => 'hanapbuhay API', 'health' => '/api/health']);
    }
}
