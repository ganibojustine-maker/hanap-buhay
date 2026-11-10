<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * Subscription Model
 * ------------------------------------------------------------------
 * Manages differentiated subscription plans, credits, and transactions
 * for Employers & MSMEs (JobStreet corporate hiring style) and
 * Clients & Service Buyers (Street Job on-demand service pass style).
 */
class Subscription_model extends Model
{
    protected $table = 'subscriptions';
    protected $primary_key = 'id';
    protected $fillable = [
        'user_id', 'account_type', 'plan_id', 'plan_name', 'billing_cycle',
        'price', 'payment_method', 'payment_reference', 'contact_credits',
        'featured_credits', 'status', 'starts_at', 'expires_at', 'created_at'
    ];

    /**
     * Get predefined plan definitions tailored for Employers and Service Buyers.
     */
    public function get_plans_catalog(): array
    {
        return [
            // ─────────────────────────────────────────────────────────────
            // 1. Employers & MSMEs (JobStreet / Corporate Recruitment Style)
            // ─────────────────────────────────────────────────────────────
            'employer' => [
                'style_name'  => 'JobStreet Partner Talent Solutions',
                'description' => 'Designed for SMEs, contractors, retail, resorts, and businesses across Oriental Mindoro looking to recruit skilled staff.',
                'plans' => [
                    [
                        'id'            => 'employer_starter',
                        'name'          => 'Starter Libre',
                        'badge'         => 'Free Trial',
                        'tagline'       => 'Pangunahing pag-post para sa maliliit na negosyo',
                        'price_monthly' => 0,
                        'price_quarter' => 0,
                        'job_posts'     => 1,
                        'featured_slots'=> 0,
                        'contact_credits'=> 5,
                        'popular'       => false,
                        'features'      => [
                            '1 Active Standard Job Post',
                            '5 Candidate Resume & Contact Unlocks',
                            'Standard Mindoro Job Board Listing',
                            'Basic Applicant Review & Status Tracking',
                            'Email Alerts on New Applications',
                            'Standard Community Support'
                        ]
                    ],
                    [
                        'id'            => 'employer_growth',
                        'name'          => 'Negosyo Pro / MSME Growth',
                        'badge'         => 'Most Popular • Street Job Best Pick',
                        'tagline'       => 'Kumpletong hiring suite para sa lumalagong negosyo sa Mindoro',
                        'price_monthly' => 499,
                        'price_quarter' => 1199, // ~20% off
                        'job_posts'     => 5,
                        'featured_slots'=> 2,
                        'contact_credits'=> 30,
                        'popular'       => true,
                        'features'      => [
                            'Up to 5 Active Job Postings simultaneously',
                            '2 Featured & "Urgent Hiring" Badges (Top of Search)',
                            '30 Direct Worker Scout & Skills Passport Unlocks',
                            'Automated Interview Scheduler & Applicant Notes',
                            'Verified Business Trust Gold Shield Badge',
                            'Direct SMS & WhatsApp Candidate Alerts',
                            'Smart AI Skills Match Scoring',
                            'Priority Admin Queue Endorsement'
                        ]
                    ],
                    [
                        'id'            => 'employer_enterprise',
                        'name'          => 'Corporate Enterprise Unlimited',
                        'badge'         => 'Maximum Hiring Power',
                        'tagline'       => 'Walang limitasyong pag-hire para sa malalaking kumpanya at hotel resorts',
                        'price_monthly' => 1499,
                        'price_quarter' => 3599, // ~20% off
                        'job_posts'     => -1, // Unlimited
                        'featured_slots'=> 10,
                        'contact_credits'=> 9999, // Unlimited
                        'popular'       => false,
                        'features'      => [
                            'Unlimited Active Job Posts & Openings',
                            '10 Featured Urgent Badges + Social Media Job Blast',
                            'Unlimited Worker Scouting & Direct Contact Unlocks',
                            'Top Ranked Placement in Mindoro Job Searches',
                            'Instant PESO & TESDA Certified Worker Recommendations',
                            'Dedicated HanapBuhay Account Specialist',
                            'Custom Company Hiring Banner on Homepage',
                            'VIP 24/7 Priority Assistance'
                        ]
                    ]
                ]
            ],

            // ─────────────────────────────────────────────────────────────
            // 2. Clients & Service Buyers (Street Job / On-Demand Service Gigs Style)
            // ─────────────────────────────────────────────────────────────
            'hirer' => [
                'style_name'  => 'Street Job On-Demand Service Pass',
                'description' => 'Fast, direct booking pass para sa mga may-ari ng bahay, opisina, at project clients na nangangailangan agad ng serbisyo.',
                'plans' => [
                    [
                        'id'            => 'hirer_free',
                        'name'          => 'Libreng Buyer',
                        'badge'         => 'Pay-As-You-Go',
                        'tagline'       => 'Pang-minsanang paghahanap ng serbisyo',
                        'price_monthly' => 0,
                        'price_quarter' => 0,
                        'active_gigs'   => 1,
                        'contact_credits'=> 3,
                        'popular'       => false,
                        'features'      => [
                            '1 Active Service Request or Gig',
                            '3 Direct Worker Contact Unlocks',
                            'Standard Worker Response (< 24 oras)',
                            'HanapBuhay In-App Chat Messaging',
                            'Community Verified Worker Ratings'
                        ]
                    ],
                    [
                        'id'            => 'hirer_service_pass',
                        'name'          => 'Home & Office Service Pass',
                        'badge'         => 'Household Favorite',
                        'tagline'       => 'Direktang tawag at urgent booking para sa bahay o pwesto',
                        'price_monthly' => 249,
                        'price_quarter' => 599,
                        'active_gigs'   => 5,
                        'contact_credits'=> 15,
                        'popular'       => true,
                        'features'      => [
                            '15 Instant Phone & Contact Unlocks (Tawag Agad)',
                            'Up to 5 Active Service Requests sabay-sabay',
                            'Urgent Service Broadcast Tag (Push Alert sa local workers)',
                            'Fast Same-Day Response (< 2 oras)',
                            'TESDA-Certified Craftsman Priority Matching',
                            'HanapBuhay Service Buyer Dispute Protection Guarantee'
                        ]
                    ],
                    [
                        'id'            => 'hirer_vip_pass',
                        'name'          => 'VIP Buyer Pass Unlimited',
                        'badge'         => 'VIP Instant Dispatch',
                        'tagline'       => 'Unli-access sa pinakamahuhusay na service pros sa Mindoro',
                        'price_monthly' => 599,
                        'price_quarter' => 1499,
                        'active_gigs'   => -1, // Unlimited
                        'contact_credits'=> 9999, // Unlimited
                        'popular'       => false,
                        'features'      => [
                            'Unlimited Direct Phone, SMS & WhatsApp Unlocks',
                            'Unlimited Active Service Gigs & Projects',
                            'Priority Same-Day Dispatch (< 30 minutong tugon)',
                            'Multi-Bid Instant Quotes (Hanggang 10 biddings bawat gig)',
                            'Guaranteed TESDA National Certificate (NC II/III) Pros',
                            'VIP Hotline Booking Concierge Assistant',
                            '100% Service Satisfaction Coverage'
                        ]
                    ]
                ]
            ]
        ];
    }

    /**
     * Get active subscription or default free profile for a user.
     */
    public function get_user_subscription(int $user_id, array $user): array
    {
        $sub = $this->db->table($this->table)
            ->where('user_id', $user_id)
            ->where('status', 'active')
            ->order_by('created_at DESC')
            ->get();

        $account_type = $user['account_type'] ?: 'employer';
        $catalog = $this->get_plans_catalog()[$account_type] ?? $this->get_plans_catalog()['employer'];

        $tier = $user['subscription_tier'] ?: 'free';
        $status = $user['subscription_status'] ?: 'active';
        $expires = $user['subscription_expires_at'] ?? null;

        // Check if expired
        $is_expired = false;
        if (!empty($expires) && strtotime($expires) < time()) {
            $is_expired = true;
            $tier = 'free';
            $status = 'expired';
        }

        // Find matched plan metadata from catalog
        $current_plan_meta = null;
        foreach ($catalog['plans'] as $p) {
            if ($p['id'] === $tier || strpos($p['id'], $tier) !== false) {
                $current_plan_meta = $p;
                break;
            }
        }
        if (!$current_plan_meta) {
            $current_plan_meta = $catalog['plans'][0];
        }

        return [
            'is_subscribed'   => ($tier !== 'free' && $tier !== 'employer_starter' && $tier !== 'hirer_free' && !$is_expired),
            'tier'            => $tier,
            'status'          => $status,
            'expires_at'      => $expires,
            'contact_credits' => (int) ($user['contact_credits'] ?? 5),
            'featured_credits'=> (int) ($user['featured_credits'] ?? 0),
            'active_sub'      => $sub ?: null,
            'plan_details'    => $current_plan_meta,
            'account_type'    => $account_type,
            'catalog'         => $catalog
        ];
    }

    /**
     * Subscribe user to a plan.
     */
    public function subscribe(int $user_id, array $user, array $params): array
    {
        $plan_id       = trim((string) ($params['plan_id'] ?? ''));
        $billing_cycle = in_array($params['billing_cycle'] ?? '', ['quarterly', 'annual']) ? $params['billing_cycle'] : 'monthly';
        $payment_method= trim((string) ($params['payment_method'] ?? 'gcash'));
        $reference     = trim((string) ($params['payment_reference'] ?? 'HB-SUB-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8))));

        $account_type = $user['account_type'] ?: 'employer';
        $catalog = $this->get_plans_catalog()[$account_type] ?? $this->get_plans_catalog()['employer'];

        $selected_plan = null;
        foreach ($catalog['plans'] as $p) {
            if ($p['id'] === $plan_id) {
                $selected_plan = $p;
                break;
            }
        }

        if (!$selected_plan) {
            return ['success' => false, 'error' => 'Invalid plan selected.'];
        }

        $price = ($billing_cycle === 'quarterly' || $billing_cycle === 'annual')
            ? ($selected_plan['price_quarter'] ?? $selected_plan['price_monthly'] * 3)
            : $selected_plan['price_monthly'];

        $duration_days = ($billing_cycle === 'quarterly' || $billing_cycle === 'annual') ? 90 : 30;
        $now = date('Y-m-d H:i:s');
        $expires = date('Y-m-d H:i:s', strtotime("+{$duration_days} days"));

        $new_contact_credits = (int) ($selected_plan['contact_credits'] ?? 10);
        $new_featured_credits = (int) ($selected_plan['featured_slots'] ?? 0);

        // Deactivate previous active or pending subscriptions
        $this->db->table($this->table)
            ->where('user_id', $user_id)
            ->where('status', 'active')
            ->update(['status' => 'superseded']);

        $this->db->table($this->table)
            ->where('user_id', $user_id)
            ->where('status', 'pending')
            ->where('payment_reference !=', $reference)
            ->update(['status' => 'abandoned']);

        // Insert new active subscription record
        $this->db->table($this->table)->insert([
            'user_id'             => $user_id,
            'account_type'        => $account_type,
            'plan_id'             => $plan_id,
            'plan_name'           => $selected_plan['name'],
            'billing_cycle'       => $billing_cycle,
            'price'               => $price,
            'payment_method'      => $payment_method,
            'payment_reference'   => $reference,
            'paymongo_session_id' => $params['paymongo_session_id'] ?? null,
            'contact_credits'     => $new_contact_credits,
            'featured_credits'    => $new_featured_credits,
            'status'              => 'active',
            'starts_at'           => $now,
            'expires_at'          => $expires,
            'created_at'          => $now,
        ]);
        $sub_id = $this->db->last_id();

        // Update user record
        $this->db->table('users')->where('id', $user_id)->update([
            'subscription_tier'       => $plan_id,
            'subscription_status'     => 'active',
            'subscription_expires_at' => $expires,
            'contact_credits'         => $new_contact_credits,
            'featured_credits'        => $new_featured_credits,
            'updated_at'              => $now,
        ]);

        return [
            'success'      => true,
            'sub_id'       => $sub_id,
            'plan'         => $selected_plan,
            'reference'    => $reference,
            'expires_at'   => $expires,
            'credits'      => [
                'contact'  => $new_contact_credits,
                'featured' => $new_featured_credits
            ]
        ];
    }

    /**
     * Cancel an active subscription.
     */
    public function cancel_subscription(int $user_id): bool
    {
        $this->db->table($this->table)
            ->where('user_id', $user_id)
            ->where('status', 'active')
            ->update(['status' => 'cancelled']);

        $this->db->table('users')
            ->where('id', $user_id)
            ->update([
                'subscription_status' => 'cancelled',
                'updated_at'          => date('Y-m-d H:i:s'),
            ]);

        return true;
    }

    /**
     * Get transaction history for a user.
     */
    public function get_history(int $user_id): array
    {
        $rows = $this->db->table($this->table)
            ->where('user_id', $user_id)
            ->order_by('created_at DESC')
            ->get_all();

        return $rows ?: [];
    }
}

