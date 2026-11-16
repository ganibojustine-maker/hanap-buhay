<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * Subscription Model
 * ------------------------------------------------------------------
 * Plans, credits and plan changes for employers (Employer plans) and
 * clients (Service Buyer Pass). Payments themselves live in libraries/Payments.php.
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
        // Plan ids stay the same as before so existing subscriptions keep working.
        // Every feature listed here is enforced in code (post limits, featured slots, contact unlocks).
        return [
            'employer' => [
                'style_name'  => 'Employer plans',
                'description' => 'For businesses, resorts, contractors and shops in Oriental Mindoro hiring staff.',
                'plans' => [
                    [
                        'id'             => 'employer_starter',
                        'name'           => 'Starter',
                        'badge'          => 'Free',
                        'tagline'        => 'Post your first job and hire',
                        'price_monthly'  => 0,
                        'price_quarter'  => 0,
                        'job_posts'      => 1,
                        'featured_slots' => 0,
                        'contact_credits'=> 5,
                        'popular'        => false,
                        'features'       => [
                            '1 open job post at a time',
                            '5 worker contact unlocks',
                            'Applicant tracking with match scores',
                            'Interview scheduling and job offers',
                            'Find Workers search',
                        ],
                    ],
                    [
                        'id'             => 'employer_growth',
                        'name'           => 'Business',
                        'badge'          => 'Most popular',
                        'tagline'        => 'For small businesses that hire often',
                        'price_monthly'  => 499,
                        'price_quarter'  => 1199,
                        'job_posts'      => 5,
                        'featured_slots' => 2,
                        'contact_credits'=> 30,
                        'popular'        => true,
                        'features'       => [
                            'Up to 5 open job posts',
                            '2 featured posts (shown first for 30 days)',
                            '30 worker contact unlocks',
                            'Unused credits carry over when you renew',
                            'Applicant tracking with match scores',
                            'Interview scheduling and job offers',
                            'Find Workers search',
                        ],
                    ],
                    [
                        'id'             => 'employer_enterprise',
                        'name'           => 'Business Plus',
                        'badge'          => 'Unlimited',
                        'tagline'        => 'For resorts, hotels and large employers',
                        'price_monthly'  => 1499,
                        'price_quarter'  => 3599,
                        'job_posts'      => -1,
                        'featured_slots' => 10,
                        'contact_credits'=> 9999,
                        'popular'        => false,
                        'features'       => [
                            'Unlimited open job posts',
                            '10 featured posts (shown first for 30 days)',
                            'Unlimited worker contact unlocks',
                            'Unused credits carry over when you renew',
                            'Applicant tracking with match scores',
                            'Interview scheduling and job offers',
                            'Find Workers search',
                        ],
                    ],
                ],
            ],
            'hirer' => [
                'style_name'  => 'Service Buyer Pass',
                'description' => 'For households, offices and project owners who hire workers for gigs and services.',
                'plans' => [
                    [
                        'id'             => 'hirer_free',
                        'name'           => 'Free',
                        'badge'          => 'Free',
                        'tagline'        => 'For an occasional gig',
                        'price_monthly'  => 0,
                        'price_quarter'  => 0,
                        'active_gigs'    => 1,
                        'job_posts'      => 1,
                        'featured_slots' => 0,
                        'contact_credits'=> 3,
                        'popular'        => false,
                        'features'       => [
                            '1 open gig at a time',
                            '3 worker contact unlocks',
                            'Proposals, contracts and milestones',
                            'Browse workers and services',
                        ],
                    ],
                    [
                        'id'             => 'hirer_service_pass',
                        'name'           => 'Service Buyer Pass',
                        'badge'          => 'Most popular',
                        'tagline'        => 'For homes and shops that need help often',
                        'price_monthly'  => 249,
                        'price_quarter'  => 599,
                        'active_gigs'    => 5,
                        'job_posts'      => 5,
                        'featured_slots' => 1,
                        'contact_credits'=> 15,
                        'popular'        => true,
                        'features'       => [
                            'Up to 5 open gigs',
                            '1 featured gig (shown first for 30 days)',
                            '15 worker contact unlocks',
                            'Unused credits carry over when you renew',
                            'Proposals, contracts and milestones',
                            'Browse workers and services',
                        ],
                    ],
                    [
                        'id'             => 'hirer_vip_pass',
                        'name'           => 'Service Buyer Pass Plus',
                        'badge'          => 'Unlimited',
                        'tagline'        => 'For property managers and frequent projects',
                        'price_monthly'  => 599,
                        'price_quarter'  => 1499,
                        'active_gigs'    => -1,
                        'job_posts'      => -1,
                        'featured_slots' => 3,
                        'contact_credits'=> 9999,
                        'popular'        => false,
                        'features'       => [
                            'Unlimited open gigs',
                            '3 featured gigs (shown first for 30 days)',
                            'Unlimited worker contact unlocks',
                            'Unused credits carry over when you renew',
                            'Proposals, contracts and milestones',
                            'Browse workers and services',
                        ],
                    ],
                ],
            ],
        ];
    }

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
    /** Find a plan definition by id across both catalogs. */
    public function find_plan(string $plan_id): ?array
    {
        foreach ($this->get_plans_catalog() as $cat) {
            foreach ($cat['plans'] ?? [] as $p) {
                if (($p['id'] ?? '') === $plan_id) return $p;
            }
        }
        return null;
    }

    /**
     * Active job posts allowed for this user's current plan.
     * -1 = unlimited. Expired paid plans fall back to the free tier.
     */
    public function job_post_limit(array $user): int
    {
        $tier = (string) ($user['subscription_tier'] ?? '');
        $expires = (string) ($user['subscription_expires_at'] ?? '');
        $expired = $expires !== '' && strtotime($expires) < time();
        $plan = ($tier !== '' && !$expired) ? $this->find_plan($tier) : null;
        if (!$plan) {
            $plan = $this->find_plan(($user['account_type'] ?? '') === 'hirer' ? 'hirer_free' : 'employer_starter');
        }
        $limit = $plan['job_posts'] ?? $plan['active_gigs'] ?? 1;
        return (int) $limit;
    }

    /** The plan this user is on right now (an expired paid plan counts as the free one). */
    public function current_plan(array $user): array
    {
        $tier = (string) ($user['subscription_tier'] ?? '');
        $expires = (string) ($user['subscription_expires_at'] ?? '');
        $expired = $expires !== '' && strtotime($expires) < time();
        $plan = ($tier !== '' && !$expired) ? $this->find_plan($tier) : null;
        return $plan ?: $this->find_plan(($user['account_type'] ?? '') === 'hirer' ? 'hirer_free' : 'employer_starter');
    }

    /** Is the current plan a paid one that has not ended? */
    public function has_active_paid_plan(array $user): bool
    {
        $plan = $this->current_plan($user);
        return (float) ($plan['price_monthly'] ?? 0) > 0;
    }

    /** Unlimited contact unlocks (Enterprise, VIP) while the plan is active. */
    public function contact_unlimited(array $user): bool
    {
        return (int) ($this->current_plan($user)['contact_credits'] ?? 0) >= 9999;
    }

    /** The plans this account type may buy: employers buy employer plans, clients buy client plans. */
    public function plans_for(array $user): array
    {
        $type = ($user['account_type'] ?? '') === 'hirer' ? 'hirer' : 'employer';
        return $this->get_plans_catalog()[$type]['plans'] ?? [];
    }

    /** How long one featured post stays featured. */
    public const FEATURE_DAYS = 30;

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

        // Renewing the SAME plan early adds the new days on top of the days left, so paying
        // early never loses time. Switching to a different paid plan starts it today.
        $cur_tier    = (string) ($user['subscription_tier'] ?? '');
        $cur_expires = (string) ($user['subscription_expires_at'] ?? '');
        $still_on    = $cur_expires !== '' && strtotime($cur_expires) > time();
        $from        = ($still_on && $cur_tier === $plan_id) ? strtotime($cur_expires) : time();
        $expires     = date('Y-m-d H:i:s', $from + $duration_days * 86400);

        // Unused credits from a plan that is still running carry over into the new one.
        $plan_contact  = (int) ($selected_plan['contact_credits'] ?? 10);
        $plan_featured = (int) ($selected_plan['featured_slots'] ?? 0);
        $carry_contact  = $still_on ? max(0, (int) ($user['contact_credits'] ?? 0)) : 0;
        $carry_featured = $still_on ? max(0, (int) ($user['featured_credits'] ?? 0)) : 0;
        $new_contact_credits  = $plan_contact >= 9999 ? 9999 : min(9999, $plan_contact + ($price > 0 ? $carry_contact : 0));
        $new_featured_credits = $plan_featured + ($price > 0 ? $carry_featured : 0);
        if ($price <= 0) {
            // the free plan: keep whatever credits are left, never top them back up
            $new_contact_credits  = max(0, (int) ($user['contact_credits'] ?? $plan_contact));
            $new_featured_credits = max(0, (int) ($user['featured_credits'] ?? 0));
            $expires = null;
        }

        // The checkout row being paid for (if any) becomes the active row itself, so one
        // payment is one row in the history — never a "pending" twin left behind.
        $own_id = (int) ($params['sub_id'] ?? 0);

        // Retire the previous active plan and any other unpaid checkouts
        $this->db->raw("UPDATE {$this->table} SET status = 'superseded' WHERE user_id = ? AND status = 'active' AND id <> ?", [$user_id, $own_id]);
        $this->db->raw("UPDATE {$this->table} SET status = 'abandoned' WHERE user_id = ? AND status = 'pending' AND id <> ?", [$user_id, $own_id]);

        $row = [
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
            'expires_at'          => $expires ?? $now,
        ];
        if ($own_id) {
            $this->db->table($this->table)->where('id', $own_id)->update($row);
            $sub_id = $own_id;
        } else {
            $this->db->table($this->table)->insert($row + ['user_id' => $user_id, 'created_at' => $now]);
            $sub_id = $this->db->last_id();
        }

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

