<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/*
|--------------------------------------------------------------------------
| Resume Parser Library Configuration
|--------------------------------------------------------------------------
| Library-specific configuration for Resume_parser.
| Access settings via config_item('resume_max_size') or Config class.
|
*/
$config['resume_max_size']     = 10485760; // 10MB
$config['resume_allowed_exts'] = ['pdf', 'doc', 'docx', 'txt', 'rtf'];
