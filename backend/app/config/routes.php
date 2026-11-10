<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
/**
 * ------------------------------------------------------------------
 * LavaLust - an opensource lightweight PHP MVC Framework
 * ------------------------------------------------------------------
 *
 * MIT License
 *
 * Copyright (c) 2020 Ronald M. Marasigan
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * @package LavaLust
 * @author Ronald M. Marasigan <ronald.marasigan@yahoo.com>
 * @since Version 1
 * @link https://github.com/ronmarasigan/LavaLust
 * @license https://opensource.org/licenses/MIT MIT License
 */

/*
| -------------------------------------------------------------------
| URI ROUTING
| -------------------------------------------------------------------
| Here is where you can register web routes for your application.
|
|
*/
/** @var object $router **/

$router->get('/', 'Welcome::index');

// ---- API ----
$router->get('/api/health', 'HealthController::index');
$router->post('/api/auth/register', 'AuthController::register');
$router->post('/api/auth/login', 'AuthController::login');
$router->post('/api/auth/google', 'AuthController::google');
$router->post('/api/auth/refresh', 'AuthController::refresh');
$router->post('/api/auth/logout', 'AuthController::logout');
$router->post('/api/auth/account-type', 'AuthController::account_type');
$router->get('/api/auth/me', 'AuthController::me');
$router->patch('/api/auth/me', 'AuthController::update_profile');
$router->put('/api/auth/me', 'AuthController::update_profile');
$router->post('/api/auth/avatar', 'AuthController::upload_avatar');
$router->post('/api/auth/resume-parse', 'AuthController::parse_resume');
$router->get('/api/auth/search-users', 'AuthController::search_users');

// Jobs
$router->get('/api/jobs', 'JobController::index');
$router->get('/api/jobs/featured', 'JobController::featured');
$router->get('/api/jobs/my', 'JobController::my_jobs');
$router->get('/api/jobs/{id}', 'JobController::show');
$router->post('/api/jobs', 'JobController::create');
$router->put('/api/jobs/{id}', 'JobController::update');
$router->delete('/api/jobs/{id}', 'JobController::destroy');

// Applications
$router->post('/api/applications', 'ApplicationController::apply');
$router->get('/api/applications/my', 'ApplicationController::my_applications');
$router->get('/api/applications/employer', 'ApplicationController::employer_applications');
$router->get('/api/applications/job/{job_id}', 'ApplicationController::job_applications');
$router->patch('/api/applications/{id}/status', 'ApplicationController::update_status');

// Skills Passport & Training
$router->get('/api/skills/my', 'SkillController::my_skills');
$router->post('/api/skills', 'SkillController::add_skill');
$router->put('/api/skills/{id}', 'SkillController::update_skill');
$router->patch('/api/skills/{id}', 'SkillController::update_skill');
$router->delete('/api/skills/{id}', 'SkillController::delete_skill');
$router->get('/api/skills/passport-score', 'SkillController::passport_score');
$router->get('/api/training', 'SkillController::training');

// Messages
$router->get('/api/messages/threads', 'MessageController::threads');
$router->get('/api/messages/unread-count', 'MessageController::unread_count');
$router->get('/api/messages/{partner_id}', 'MessageController::conversation');
$router->post('/api/messages', 'MessageController::send');

// Subscriptions (Employers & MSMEs, Clients & Service Buyers) via PayMongo
$router->get('/api/subscriptions/current', 'SubscriptionController::current');
$router->get('/api/subscriptions/plans', 'SubscriptionController::plans');
$router->post('/api/subscriptions/checkout', 'SubscriptionController::checkout');
$router->post('/api/subscriptions/verify', 'SubscriptionController::verify');
$router->post('/api/subscriptions/subscribe', 'SubscriptionController::subscribe');
$router->post('/api/subscriptions/cancel', 'SubscriptionController::cancel');
$router->get('/api/subscriptions/history', 'SubscriptionController::history');

// Admin & Notifications
$router->get('/api/admin/stats', 'AdminController::stats');
$router->get('/api/admin/analytics', 'AdminController::analytics');
$router->get('/api/admin/payments', 'AdminController::payments');
$router->get('/api/admin/users', 'AdminController::users');
$router->get('/api/admin/users/{id}', 'AdminController::user_detail');
$router->patch('/api/admin/users/{id}/verify', 'AdminController::verify_user');
$router->patch('/api/admin/users/{id}/toggle', 'AdminController::toggle_user');
$router->delete('/api/admin/users/{id}', 'AdminController::delete_user');
$router->get('/api/admin/jobs', 'AdminController::jobs');
$router->get('/api/notifications', 'AdminController::notifications');
$router->post('/api/notifications/mark-read', 'AdminController::mark_notifications_read');
$router->post('/api/notifications/test-email', 'AuthController::test_notification_email');

// CORS preflight: the Api library answers it in the constructor (204) before the method runs
$router->options('/api/{a}', 'HealthController::index');
$router->options('/api/{a}/{b}', 'HealthController::index');
$router->options('/api/{a}/{b}/{c}', 'HealthController::index');
$router->options('/api/{a}/{b}/{c}/{d}', 'HealthController::index');

// Migration routes (CLI only, enforced in MigrationController)
$router->get('create-migration/{migration_class}', 'MigrationController::create_migration');
$router->get('migrate', 'MigrationController::migrate');
$router->get('rollback', 'MigrationController::rollback');
$router->get('rollback-all', 'MigrationController::rollback_all');
$router->get('refresh', 'MigrationController::refresh');
$router->get('status', 'MigrationController::status');
