<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
/*
|--------------------------------------------------------------------------
| PayMongo Library Configuration
|--------------------------------------------------------------------------
| Library-specific configuration for Paymongo and Payments. Loaded through
| $autoload['configs'] (app/config/autoload.php); read with config_item('key').
|
| Secrets never live in this file: they come from the environment
| (backend/.env locally, the service's Environment settings on Render).
|
*/

$config['paymongo_secret_key']        = trim((string) getenv('PAYMONGO_SECRET_KEY'));
$config['paymongo_public_key']        = trim((string) getenv('PAYMONGO_PUBLIC_KEY'));
$config['paymongo_webhook_secret']    = trim((string) getenv('PAYMONGO_WEBHOOK_SECRET'));
// checkout methods turned on for the PayMongo account (comma list)
$config['paymongo_methods']           = trim((string) getenv('PAYMONGO_METHODS')) ?: 'card,gcash,paymaya,grab_pay,qrph';
// sandbox only: a live key (sk_live_) is ignored unless this is set to true on purpose
$config['paymongo_allow_live']        = filter_var(getenv('PAYMONGO_ALLOW_LIVE'), FILTER_VALIDATE_BOOLEAN);
// show "Test" labels on receipts and the admin page (off: payments look like a real system)
$config['paymongo_show_test_labels']  = filter_var(getenv('PAYMONGO_SHOW_TEST_LABELS'), FILTER_VALIDATE_BOOLEAN);
