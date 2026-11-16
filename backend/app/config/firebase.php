<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
/*
|--------------------------------------------------------------------------
| Firebase Library Configuration
|--------------------------------------------------------------------------
| Library-specific configuration for Firebase_db and Firebase_auth. Loaded through
| $autoload['configs'] (app/config/autoload.php); read with config_item('key').
|
| Secrets never live in this file: they come from the environment
| (backend/.env locally, the service's Environment settings on Render).
|
*/

// the service account the API uses for chat sign-in tokens and Help & Support
$config['firebase_client_email'] = trim((string) getenv('FIREBASE_CLIENT_EMAIL'));
$config['firebase_private_key']  = trim((string) getenv('FIREBASE_PRIVATE_KEY'));   // "\n" escapes become new lines in the library
$config['firebase_database_url'] = trim((string) (getenv('FIREBASE_DATABASE_URL') ?: getenv('VITE_FIREBASE_DATABASE_URL')));
$config['firebase_token_uri']    = trim((string) getenv('FIREBASE_TOKEN_URI')) ?: 'https://oauth2.googleapis.com/token';
