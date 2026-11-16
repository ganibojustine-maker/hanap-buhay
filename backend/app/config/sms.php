<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
/*
|--------------------------------------------------------------------------
| SMS (Semaphore) Library Configuration
|--------------------------------------------------------------------------
| Library-specific configuration for Sms. Loaded through
| $autoload['configs'] (app/config/autoload.php); read with config_item('key').
|
| Secrets never live in this file: they come from the environment
| (backend/.env locally, the service's Environment settings on Render).
|
*/

$config['semaphore_api_key']     = trim((string) getenv('SEMAPHORE_API_KEY'));
$config['semaphore_sender_name'] = trim((string) getenv('SEMAPHORE_SENDER_NAME'));
// most text messages sent in one day (protects the SMS credits)
$config['sms_daily_cap']         = (int) (getenv('SMS_DAILY_CAP') ?: 0);
