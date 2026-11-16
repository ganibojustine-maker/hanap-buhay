<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
/*
|--------------------------------------------------------------------------
| Mail (Brevo) Library Configuration
|--------------------------------------------------------------------------
| Library-specific configuration for Mailer. Loaded through
| $autoload['configs'] (app/config/autoload.php); read with config_item('key').
|
| Secrets never live in this file: they come from the environment
| (backend/.env locally, the service's Environment settings on Render).
|
*/

$config['brevo_api_key']     = trim((string) getenv('BREVO_API_KEY'));
$config['mail_from_address'] = trim((string) getenv('MAIL_FROM_ADDRESS')) ?: 'noreply@hanapbuhay.ph';
$config['mail_from_name']    = trim((string) getenv('MAIL_FROM_NAME')) ?: 'hanapbuhay Oriental Mindoro';
// optional CA bundle for outgoing HTTPS (Mailer and Sms); certs/cacert.pem is used when empty
$config['mail_ca_bundle']    = trim((string) getenv('MAIL_CA_BUNDLE'));
