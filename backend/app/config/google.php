<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/*
|--------------------------------------------------------------------------
| Google OAuth Library Configuration
|--------------------------------------------------------------------------
| Library-specific configuration for Google_client.
| Access settings via config_item('google_client_id') or Config class.
|
*/
$config['google_client_id']     = getenv('GOOGLE_CLIENT_ID') ?: '251811791555-mvl6ocpp50plffnudmqk8lnr5fnj106l.apps.googleusercontent.com';
$config['google_tokeninfo_url'] = 'https://oauth2.googleapis.com/tokeninfo';
$config['google_userinfo_url']  = 'https://www.googleapis.com/oauth2/v3/userinfo';
