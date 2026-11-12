<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * /api/applications — apply to jobs, manage applications.
 */
class ApplicationController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        $this->call->database();
        $this->call->model('Application_model', 'application_model');
        $this->call->model('Job_model', 'job_model');
        $this->call->model('User_model', 'user_model');
        $this->call->model('Skill_model', 'skill_model');
    }

    // Worker: apply to a job
    public function apply()
    {
        $this->api->require_method('POST');
        $payload = $this->api->require_jwt();
        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user || $user['account_type'] !== 'worker') $this->api->respond_error('Only workers can apply for jobs.', 403);

        $b = $this->api->body();
        $job_id = (int) ($b['job_id'] ?? 0);
        if (!$job_id) $this->api->respond_error('Job ID is required.', 422);

        $job = $this->job_model->find_by_id($job_id);
        if (!$job || $job['status'] !== 'active') $this->api->respond_error('Job not found or no longer active.', 404);

        // Check for duplicate application
        $existing = $this->application_model->find_by_job_and_worker($job_id, (int) $payload['sub']);
        if ($existing) $this->api->respond_error('You have already applied for this job.', 409);

        // Simple match score: count matching skills
        $match_score = $this->_calc_match($user, $job);

        $app_id = $this->application_model->apply([
            'job_id'      => $job_id,
            'worker_id'   => (int) $payload['sub'],
            'cover_note'  => substr(trim((string) ($b['cover_note'] ?? '')), 0, 2000) ?: null,
            'match_score' => $match_score,
            'status'      => 'pending',
        ]);

        // 1. Notify employer (in-app + email)
        $company_label = !empty($job['company']) ? " sa {$job['company']}" : '';
        $this->application_model->create_notification(
            (int) $job['employer_id'],
            'application',
            "New application for {$job['title']}",
            "{$user['full_name']} applied for your job post \"{$job['title']}\"." . (!empty($b['cover_note']) ? "\n\nApplicant Note: " . trim($b['cover_note']) : '') . "\nMatch Score: {$match_score}%\nLocation: " . ($user['location'] ?: 'Oriental Mindoro'),
            '/dashboard/applicants'
        );

        // 2. Notify applicant / worker (in-app + email confirmation)
        $this->application_model->create_notification(
            (int) $payload['sub'],
            'application_status',
            "Application Submitted: {$job['title']}",
            "Mabuhay {$user['full_name']}! Matagumpay na naisumite ang iyong aplikasyon para sa \"{$job['title']}\"{$company_label}.\n\nNakatanggap na ng email notification ang employer tungkol sa iyong aplikasyon. Makakatanggap ka rin ng email update sa oras na i-review, i-schedule para sa interview, o i-hire ka ng employer.",
            '/dashboard/applied'
        );

        $this->api->respond(['success' => true, 'application_id' => $app_id, 'match_score' => $match_score], 201);
    }

    private function _calc_match(array $user, array $job): int
    {
        if (empty($job['skills_needed'])) return rand(60, 85);
        $needed = array_map('trim', explode(',', strtolower($job['skills_needed'])));
        $passport = $this->skill_model->get_user_skills((int) $user['id']);
        $worker_skills = array_map(fn($s) => strtolower($s['skill_name']), $passport ?: []);
        if (empty($needed)) return 50;
        $matched = count(array_filter($needed, fn($n) => in_array($n, $worker_skills, true)));
        $base = (int) (($matched / count($needed)) * 100);
        // Location bonus
        if ($user['location'] && $job['location'] && strtolower($user['location']) === strtolower($job['location'])) $base = min(100, $base + 10);
        return max(10, $base);
    }

    // Worker: my applications
    public function my_applications()
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $rows = $this->application_model->get_worker_applications((int) $payload['sub']);
        $this->api->respond(['success' => true, 'applications' => $rows ?: []]);
    }

    // Employer: applications for a job
    public function job_applications($job_id)
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $job = $this->job_model->find_by_id((int) $job_id);
        if (!$job) $this->api->respond_error('Job not found.', 404);

        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);
        if ((int) $job['employer_id'] !== (int) $payload['sub'] && $user['role'] !== 'admin') {
            $this->api->respond_error('Forbidden', 403);
        }

        $rows = $this->application_model->get_job_applications((int) $job_id);
        $this->api->respond(['success' => true, 'applications' => $rows ?: []]);
    }

    // Employer: all applicants across all jobs
    public function employer_applications()
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();
        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);

        $rows = $this->application_model->get_employer_applications((int) $user['id']);
        $this->api->respond(['success' => true, 'applications' => $rows ?: []]);
    }

    // Employer: update application status
    public function update_status($id)
    {
        $this->api->require_method('PATCH');
        $payload = $this->api->require_jwt();
        $app = $this->application_model->find_by_id((int) $id);
        if (!$app) $this->api->respond_error('Application not found.', 404);

        $job = $this->job_model->find_by_id((int) $app['job_id']);
        $user = $this->user_model->find_by_id((int) $payload['sub']);
        if (!$user) $this->api->respond_error('Unauthorized', 401);
        if ($job && (int) $job['employer_id'] !== (int) $payload['sub'] && $user['role'] !== 'admin') {
            $this->api->respond_error('Forbidden', 403);
        }

        $b = $this->api->body();
        $status = (string) ($b['status'] ?? '');
        $allowed = ['pending','reviewed','shortlisted','for_interview','rejected','hired'];
        if (!in_array($status, $allowed, true)) $this->api->respond_error('Invalid status.', 422);

        $interview_date = isset($b['interview_date']) ? (string) $b['interview_date'] : null;
        $interview_notes = isset($b['interview_notes']) ? (string) $b['interview_notes'] : null;

        $this->application_model->update_status((int) $id, $status, $interview_date, $interview_notes);

        // Notify worker about application status update (in-app + email)
        if ($job) {
            $worker = $this->user_model->find_by_id((int) $app['worker_id']);
            $worker_name = !empty($worker['full_name']) ? $worker['full_name'] : 'Applicant';
            $company_name = !empty($job['company']) ? $job['company'] : 'Employer';

            $notif_type = ($status === 'hired') ? 'hired' : 'application_status';

            $titles = [
                'pending'       => "Application Pending: {$job['title']}",
                'reviewed'      => "Application Reviewed: {$job['title']}",
                'shortlisted'   => "⭐ Shortlisted: {$job['title']}",
                'for_interview' => "📅 Interview Schedule: {$job['title']}",
                'hired'         => "🎉 Congratulations! You are HIRED for {$job['title']}!",
                'rejected'      => "Application Update: {$job['title']}",
            ];

            $msgs = [
                'pending'       => "Kumusta {$worker_name}! Ang iyong aplikasyon para sa \"{$job['title']}\" sa {$company_name} ay kasalukuyang nakalagay bilang Pending Review.",
                'reviewed'      => "Magandang araw {$worker_name}! Ang iyong aplikasyon at credentials para sa \"{$job['title']}\" ay sinuri na ng {$company_name}.",
                'shortlisted'   => "Magandang balita, {$worker_name}! Ikaw ay opisyal nang na-shortlist ng {$company_name} para sa posisyong \"{$job['title']}\"." . (!empty($interview_notes) ? "\n\nNote mula sa employer: {$interview_notes}" : ''),
                'for_interview' => "Binabati ka namin, {$worker_name}! Ikaw ay naimbitahan ng {$company_name} para sa isang interview para sa \"{$job['title']}\"." . (!empty($interview_date) ? "\n\n📅 Schedule ng Interview: " . date('F d, Y h:i A', strtotime($interview_date)) : '') . (!empty($interview_notes) ? "\n\n📝 Important Notes / Venue: {$interview_notes}" : '') . "\n\nI-check ang iyong messages o dashboard para sa karagdagang detalye.",
                'hired'         => "🎉 MALUGOD KANG BINABATI, {$worker_name}!\n\nIkaw ay OPISYAL NANG HIRED para sa trabahong \"{$job['title']}\" sa {$company_name} sa pamamagitan ng HanapBuhay Oriental Mindoro!\n\nIpinagmamalaki ka ng HanapBuhay. Makikipag-ugnayan ang employer sa iyo para sa iyong requirements at simula ng trabaho." . (!empty($interview_notes) ? "\n\n📌 Onboarding Instructions: {$interview_notes}" : '') . "\n\nPumunta sa iyong dashboard para sa buong detalye.",
                'rejected'      => "Salamat sa iyong interes at pag-apply sa \"{$job['title']}\" sa {$company_name}. Ikinalulungkot naming ipabatid na sa pagkakataong ito ay may ibang kandidatong napili." . (!empty($interview_notes) ? "\n\nFeedback mula sa employer: {$interview_notes}" : '') . "\n\nHuwag mawalan ng pag-asa! Marami pang bakanteng trabaho sa Oriental Mindoro ang naghihintay para sa iyo sa HanapBuhay.",
            ];

            $title = $titles[$status] ?? "Application Update: {$job['title']}";
            $bodyText = $msgs[$status] ?? "Your application status for \"{$job['title']}\" was updated to: " . strtoupper($status);

            $email = $this->application_model->create_notification(
                (int) $app['worker_id'],
                $notif_type,
                $title,
                $bodyText,
                '/dashboard/applied'
            );
        }

        // Report the worker email outcome so the employer UI can show whether
        // the Gmail notification actually went out (Brevo) or why it did not.
        $this->api->respond([
            'success' => true,
            'status'  => $status,
            'email'   => $email ?? ['success' => false, 'mode' => 'failed', 'to' => null, 'error' => 'Job not found.'],
        ]);
    }
}
