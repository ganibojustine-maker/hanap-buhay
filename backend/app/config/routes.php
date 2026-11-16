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
$router->get('/api/jobs/towns', 'JobController::towns'); // before /api/jobs/{id}
$router->get('/api/jobs/my', 'JobController::my_jobs');
$router->get('/api/jobs/matches', 'JobController::matches'); // before /api/jobs/{id}
$router->post('/api/jobs/{id}/renew', 'JobController::renew');
$router->get('/api/jobs/{id}', 'JobController::show');
$router->post('/api/jobs', 'JobController::create');
$router->put('/api/jobs/{id}', 'JobController::update');
$router->delete('/api/jobs/{id}', 'JobController::destroy');
$router->post('/api/jobs/{id}/feature', 'JobController::feature');
$router->get('/api/jobs/{id}/image', 'JobController::image');
$router->post('/api/jobs/{id}/image', 'JobController::image_upload');
$router->delete('/api/jobs/{id}/image', 'JobController::image_upload');

// Find Workers — employers and clients search Skills Passports (migration 019)
$router->get('/api/talent', 'TalentController::index');
$router->get('/api/talent/saved', 'TalentController::saved'); // before /api/talent/{id}
$router->get('/api/talent/{id}', 'TalentController::show');
$router->post('/api/talent/{id}/unlock', 'TalentController::unlock');
$router->post('/api/talent/{id}/save', 'TalentController::save');
$router->delete('/api/talent/{id}/save', 'TalentController::save');
$router->post('/api/talent/{id}/invite', 'TalentController::invite');
$router->get('/api/invites/mine', 'TalentController::mine');

// Business verification (migration 020): employers/clients upload a permit, admins check it
$router->get('/api/business/verification', 'BusinessController::mine');
$router->post('/api/business/verification', 'BusinessController::upload');
$router->get('/api/business/verification/{uid}/file', 'BusinessController::file');
$router->get('/api/admin/business-docs', 'BusinessController::admin_list');
$router->patch('/api/admin/business-docs/{uid}', 'BusinessController::admin_review');

// Applications
$router->post('/api/applications', 'ApplicationController::apply');
$router->get('/api/applications/my', 'ApplicationController::my_applications');
$router->get('/api/applications/next-steps', 'ApplicationController::next_steps');
$router->get('/api/applications/employer', 'ApplicationController::employer_applications');
$router->get('/api/applications/job/{job_id}', 'ApplicationController::job_applications');
$router->patch('/api/applications/{id}/status', 'ApplicationController::update_status');
$router->post('/api/applications/{id}/withdraw', 'ApplicationController::withdraw');
$router->get('/api/applications/{id}/profile', 'ApplicationController::applicant_profile');
$router->post('/api/applications/{id}/offer', 'ApplicationController::respond_offer');
$router->get('/api/applications/{id}/history', 'ApplicationController::history');

// Skills Passport & Training
$router->get('/api/skills/my', 'SkillController::my_skills');
$router->post('/api/skills', 'SkillController::add_skill');
$router->put('/api/skills/{id}', 'SkillController::update_skill');
$router->patch('/api/skills/{id}', 'SkillController::update_skill');
$router->delete('/api/skills/{id}', 'SkillController::delete_skill');
$router->get('/api/skills/passport-score', 'SkillController::passport_score');
$router->post('/api/skills/certificate/scan', 'SkillController::scan_certificate');
$router->get('/api/skills/certificates', 'SkillController::my_certificates');
$router->post('/api/skills/certificates', 'SkillController::upload_certificate');
$router->get('/api/skills/certificates/{id}/file', 'SkillController::certificate_file');
$router->delete('/api/skills/certificates/{id}', 'SkillController::delete_certificate');

// Free Resume Builder (workers): draft is stored, the PDF is made in the browser
$router->get('/api/resume', 'ResumeController::show');
$router->put('/api/resume', 'ResumeController::save');
$router->get('/api/training', 'SkillController::training');

// Messages: chat lives in Firebase Realtime Database (never stored in MySQL).
// The API only issues a Firebase sign-in token and sends content-free notifications.
$router->post('/api/messages/notify', 'MessageController::notify');
$router->get('/api/users/{id}', 'MessageController::profile');
$router->post('/api/auth/firebase-token', 'AuthController::firebase_token');
// Subscriptions (Employers & MSMEs, Clients & Service Buyers) via PayMongo
$router->get('/api/subscriptions/current', 'SubscriptionController::current');
$router->get('/api/subscriptions/plans', 'SubscriptionController::plans');
$router->post('/api/subscriptions/checkout', 'SubscriptionController::checkout');
$router->post('/api/subscriptions/verify', 'SubscriptionController::verify');
$router->post('/api/subscriptions/subscribe', 'SubscriptionController::subscribe');
$router->post('/api/subscriptions/cancel', 'SubscriptionController::cancel');
$router->post('/api/subscriptions/resume', 'SubscriptionController::resume');
$router->post('/api/subscriptions/abandon', 'SubscriptionController::abandon');
$router->post('/api/subscriptions/payments/{id}/retry', 'SubscriptionController::retry');
$router->post('/api/subscriptions/payments/{id}/cancel', 'SubscriptionController::cancel_payment');
$router->get('/api/subscriptions/payments/{id}/receipt', 'SubscriptionController::receipt');
$router->get('/api/subscriptions/history', 'SubscriptionController::history');

// Help & Support: customer-service tickets answered by the admin team (not Messages)
$router->get('/api/support/tickets', 'SupportController::index');
$router->post('/api/support/tickets', 'SupportController::create');
$router->get('/api/support/tickets/{id}', 'SupportController::show');
$router->post('/api/support/tickets/{id}/reply', 'SupportController::reply');
$router->post('/api/support/tickets/{id}/status', 'SupportController::status');
$router->get('/api/admin/support', 'SupportController::admin_index');

// Admin & Notifications
$router->get('/api/admin/stats', 'AdminController::stats');
$router->get('/api/admin/overview', 'AdminController::overview');
$router->get('/api/admin/analytics', 'AdminController::analytics');
$router->get('/api/admin/payments', 'SubscriptionController::admin_index');
$router->post('/api/admin/payments/reconcile', 'SubscriptionController::admin_reconcile'); // before {id}
$router->post('/api/admin/payments/{id}/refund', 'SubscriptionController::admin_refund');
$router->get('/api/cron/payments', 'SubscriptionController::cron');
$router->patch('/api/admin/jobs/{id}/moderate', 'JobController::moderate');

// Verification (workers, clients; employers use /api/business/verification)
$router->get('/api/verification', 'VerificationController::status');
$router->post('/api/verification/id', 'VerificationController::submit_id');
$router->get('/api/verification/requests/{id}/file', 'VerificationController::file');
$router->get('/api/admin/verification', 'VerificationController::admin_index');
$router->get('/api/admin/verification/log', 'VerificationController::admin_log'); // before {id}
$router->get('/api/admin/verification/history/{uid}', 'VerificationController::admin_history');
$router->patch('/api/admin/verification/{id}', 'VerificationController::admin_decide');

// Gigs: proposals, contracts, service listings
$router->get('/api/gigs/mine', 'GigController::my_gigs');
$router->get('/api/gigs/invites', 'GigController::my_invites');
$router->post('/api/gigs/{id}/invite', 'GigController::invite');
$router->get('/api/gigs/{id}/proposals', 'GigController::gig_proposals');
$router->post('/api/gigs/{id}/proposals', 'GigController::propose');
$router->get('/api/proposals/mine', 'GigController::my_proposals');
$router->get('/api/proposals/received', 'GigController::gig_proposals');
$router->post('/api/proposals/{id}/withdraw', 'GigController::withdraw');
$router->post('/api/proposals/{id}/hire', 'GigController::hire');
$router->patch('/api/proposals/{id}', 'GigController::decide');
$router->get('/api/contracts', 'GigController::contracts');
$router->get('/api/contracts/{id}', 'GigController::contract_detail');
$router->get('/api/contracts/{id}/files/{eventId}', 'GigController::event_file');
$router->post('/api/contracts/{id}/respond', 'GigController::respond_offer');
$router->post('/api/contracts/{id}/milestones', 'GigController::add_milestone');
$router->post('/api/contracts/{id}/milestones/{mid}/approve', 'GigController::approve_milestone');
$router->post('/api/contracts/{id}/deliver', 'GigController::deliver');
$router->post('/api/contracts/{id}/revision', 'GigController::request_revision');
$router->post('/api/contracts/{id}/complete', 'GigController::complete');
$router->post('/api/contracts/{id}/paid', 'GigController::mark_paid');
$router->post('/api/contracts/{id}/confirm-payment', 'GigController::confirm_payment');
$router->post('/api/contracts/{id}/cancel', 'GigController::cancel');
$router->post('/api/contracts/{id}/dispute', 'GigController::dispute');
$router->post('/api/contracts/{id}/review', 'GigController::review');
$router->get('/api/services/mine', 'GigController::my_services');
$router->get('/api/services', 'GigController::services');
$router->get('/api/services/{id}', 'GigController::service_detail');
$router->post('/api/services', 'GigController::save_service');
$router->put('/api/services/{id}', 'GigController::save_service');
$router->delete('/api/services/{id}', 'GigController::delete_service');
$router->post('/api/services/{id}/book', 'GigController::book');
// Photos for jobs, gigs and service listings (up to 6 each)
$router->get('/api/photos/{type}/{id}', 'PhotoController::index');
$router->post('/api/photos/{type}/{id}', 'PhotoController::store');
$router->delete('/api/photos/{type}/{id}/{slot}', 'PhotoController::destroy');
$router->get('/api/photos/{type}/{id}/{slot}/file', 'PhotoController::file');
$router->get('/api/admin/contracts', 'GigController::admin_contracts');
$router->get('/api/admin/disputes', 'GigController::admin_disputes');
$router->patch('/api/admin/disputes/{id}', 'GigController::admin_resolve');
$router->get('/api/admin/users', 'AdminController::users');
$router->get('/api/admin/users/{id}', 'AdminController::user_detail');
$router->patch('/api/admin/users/{id}/verify', 'AdminController::verify_user');
$router->get('/api/admin/certificates', 'AdminController::certificates');
$router->patch('/api/admin/certificates/{id}', 'AdminController::review_certificate');
$router->patch('/api/admin/users/{id}/toggle', 'AdminController::toggle_user');
$router->delete('/api/admin/users/{id}', 'AdminController::delete_user');
$router->get('/api/admin/jobs', 'AdminController::jobs');
$router->get('/api/admin/applications', 'AdminController::applications');
$router->get('/api/admin/reports', 'AdminController::reports');
$router->patch('/api/admin/reports/{id}', 'AdminController::update_report');
$router->get('/api/notifications', 'AdminController::notifications');
$router->post('/api/notifications/mark-read', 'AdminController::mark_notifications_read');
$router->post('/api/notifications/test-email', 'AuthController::test_notification_email');

// Account recovery, deletion, moderation, payment webhook
$router->post('/api/auth/forgot-password', 'AuthController::forgot_password');
$router->post('/api/auth/reset-password', 'AuthController::reset_password');
$router->post('/api/auth/change-password', 'AuthController::change_password');
$router->delete('/api/auth/me', 'AuthController::delete_account');
$router->post('/api/auth/verify-email', 'AuthController::verify_email');
$router->post('/api/auth/accept-terms', 'AuthController::accept_terms');
$router->post('/api/auth/resend-verification', 'AuthController::resend_verification');

// Saved jobs (server-side bookmarks)
$router->get('/api/saved-jobs', 'SavedJobController::index');
$router->post('/api/saved-jobs', 'SavedJobController::save');
$router->post('/api/saved-jobs/sync', 'SavedJobController::sync');
$router->delete('/api/saved-jobs/{id}', 'SavedJobController::unsave');
$router->post('/api/jobs/{id}/report', 'JobController::report');
$router->post('/api/subscriptions/webhook', 'SubscriptionController::webhook');

// Worker tools (migration 017): share passport, employer reviews, interview reminders
$router->post('/api/auth/share', 'AuthController::share');
$router->get('/api/passport/{token}', 'PassportController::show');
$router->post('/api/reviews/worker', 'ReviewController::save_worker'); // before /api/reviews
$router->get('/api/reviews/pending', 'ReviewController::pending');
$router->post('/api/reviews', 'ReviewController::save');
$router->get('/api/employers/{id}/reviews', 'ReviewController::employer');
$router->get('/api/workers/{id}/reviews', 'ReviewController::worker');
$router->get('/api/admin/reviews', 'ReviewController::admin_index');
$router->patch('/api/admin/reviews/{id}', 'ReviewController::admin_update');
$router->get('/api/cron/reminders', 'CronController::reminders');

// Social graph (migration 018): follow, connections, public profiles
$router->post('/api/social/follow', 'SocialController::follow');
$router->delete('/api/social/follow/{id}', 'SocialController::unfollow');
$router->get('/api/social/network', 'SocialController::network');
$router->get('/api/social/suggestions', 'SocialController::suggestions');
$router->get('/api/social/profile/{id}', 'SocialController::profile');

// Training: bookmarks, enrolments and how many people enrolled in each course
$router->get('/api/training/stats', 'TrainingController::stats');
$router->post('/api/training/saved', 'TrainingController::save_course');
$router->delete('/api/training/saved/{id}', 'TrainingController::unsave_course');
$router->post('/api/training/enroll', 'TrainingController::enroll');
$router->patch('/api/training/enrollments/{id}', 'TrainingController::update_enrollment');
$router->delete('/api/training/enrollments/{id}', 'TrainingController::delete_enrollment');

// Work gallery: photos of real work with a description (Skills Passport → Portfolio)
$router->get('/api/portfolio', 'PortfolioController::index');
$router->post('/api/portfolio', 'PortfolioController::create');
$router->get('/api/portfolio/user/{id}', 'PortfolioController::user');
$router->get('/api/portfolio/{id}/file', 'PortfolioController::file');
$router->patch('/api/portfolio/{id}', 'PortfolioController::update');
$router->delete('/api/portfolio/{id}', 'PortfolioController::destroy');

// CORS preflight: the Api library answers it in the constructor (204) before the method runs
$router->options('/api/{a}', 'HealthController::index');
$router->options('/api/{a}/{b}', 'HealthController::index');
$router->options('/api/{a}/{b}/{c}', 'HealthController::index');
$router->options('/api/{a}/{b}/{c}/{d}', 'HealthController::index');
$router->options('/api/{a}/{b}/{c}/{d}/{e}', 'HealthController::index');

// Migration routes (CLI only, enforced in MigrationController)
$router->get('create-migration/{migration_class}', 'MigrationController::create_migration');
$router->get('migrate', 'MigrationController::migrate');
$router->get('rollback', 'MigrationController::rollback');
$router->get('rollback-all', 'MigrationController::rollback_all');
$router->get('refresh', 'MigrationController::refresh');
$router->get('status', 'MigrationController::status');
