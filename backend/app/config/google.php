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
$config['google_client_id']     = getenv('GOOGLE_CLIENT_ID') ?: '202897350032-iomn9ihif7p5g74gsvqfj6j8c64i71bq.apps.googleusercontent.com';
$config['google_tokeninfo_url'] = 'https://oauth2.googleapis.com/tokeninfo';
$config['google_userinfo_url']  = 'https://www.googleapis.com/oauth2/v3/userinfo';
