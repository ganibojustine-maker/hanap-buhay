import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Dialog from './Dialog.jsx'
import {
  IconCheck, IconShield, IconSpark, IconBuilding, IconWrench,
  IconBriefcase, IconPhone, IconClock, IconStar, IconX,
  IconArrow, IconCalendar, IconAlert
} from './icons.jsx'

// ── Official GCash Vector & Image Components ─────────────────
export function GCashIcon({ size = 32, style = {} }) {
  const rx = Math.round(size * 0.22)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        flexShrink: 0,
        display: 'inline-block',
        verticalAlign: 'middle',
        borderRadius: rx,
        ...style
      }}
    >
      {/* Official GCash Blue Background */}
      <rect width="100" height="100" rx="22" fill="#007DFE" />

      {/* Outer Dark Navy C-Ring */}
      <path
        d="M 70.5 25 A 35 35 0 1 0 70.5 75"
        fill="none"
        stroke="#0035A0"
        strokeWidth="8"
        strokeLinecap="round"
      />

      {/* Center Bold White G */}
      <path
        d="M 58 32 A 21.5 21.5 0 1 0 66 57 L 66 50 L 48 50"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Inner Sky Blue Signal Wave */}
      <path
        d="M 73 33 A 32 32 0 0 1 73 67"
        fill="none"
        stroke="#50C4FF"
        strokeWidth="6.5"
        strokeLinecap="round"
      />

      {/* Outer Sky Blue Signal Wave */}
      <path
        d="M 83 26 A 44 44 0 0 1 83 74"
        fill="none"
        stroke="#50C4FF"
        strokeWidth="6.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function GCashLogo({ height = 32, light = false }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, verticalAlign: 'middle', userSelect: 'none' }}>
      <GCashIcon size={height} />
      <span style={{
        fontFamily: "'Inter Tight', system-ui, -apple-system, sans-serif",
        fontWeight: 800,
        fontSize: height * 0.78,
        letterSpacing: '-0.035em',
        color: light ? '#FFFFFF' : '#007DFE',
        lineHeight: 1
      }}>
        GCash
      </span>
    </div>
  )
}

/* ── Plan catalog shown on this page ────────────────────────────
   Only features the app really delivers are listed here, and every number is enforced by
   the server: active posts (JobController::create), featured posts (JobController::feature),
   contact unlocks (TalentController::unlock). Keep in step with Subscription_model. */
const PLAN_SETS = {
  employer: [
    {
      id: 'employer_starter', name: 'Starter', free: true,
      tagline: 'Try hanapbuhay hiring with a single vacancy.',
      intro: null,
      features: [
        '1 active job post',
        '5 worker contact unlocks to start',
        'Find Workers: search every Skills Passport',
        'Applicant tracking, interviews and match scores',
        'Email alerts for new applications',
      ],
    },
    {
      id: 'employer_growth', name: 'Business Pro', popular: true,
      tagline: 'For growing businesses that hire regularly.',
      monthly: 499, quarterly: 1199,
      intro: 'Everything in Starter, plus:',
      features: [
        'Up to 5 active job posts',
        '2 featured posts (30 days each, shown first)',
        '30 worker contact unlocks',
        'Unused credits carry over when you renew',
      ],
      checkout: { id: 'employer_growth', name: 'Business Pro (MSME Growth)', price_monthly: 499, price_quarter: 1199, job_posts: 5, featured_slots: 2, contact_credits: 30 },
    },
    {
      id: 'employer_enterprise', name: 'Enterprise',
      tagline: 'For resorts, construction firms, and retail chains.',
      monthly: 1499, quarterly: 3599,
      intro: 'Everything in Business Pro, plus:',
      features: [
        'Unlimited active job posts',
        '10 featured posts (30 days each)',
        'Unlimited worker contact unlocks',
        'Best for high-volume and seasonal hiring',
      ],
      checkout: { id: 'employer_enterprise', name: 'Corporate Enterprise Unlimited', price_monthly: 1499, price_quarter: 3599, job_posts: -1, featured_slots: 10, contact_credits: 9999 },
    },
  ],
  hirer: [
    {
      id: 'hirer_free', name: 'Free Buyer', free: true,
      tagline: 'For occasional service requests and simple repairs.',
      intro: null,
      features: [
        '1 active service request',
        '3 worker contact unlocks to start',
        'Find Workers: search every Skills Passport',
        'In-app chat with workers',
      ],
    },
    {
      id: 'hirer_service_pass', name: 'Service Pass', popular: true,
      tagline: 'For homes, offices, and regular project needs.',
      monthly: 249, quarterly: 599,
      intro: 'Everything in Free Buyer, plus:',
      features: [
        'Up to 5 active service requests',
        '1 featured request (30 days, shown first)',
        '15 worker contact unlocks',
        'Unused credits carry over when you renew',
      ],
      checkout: { id: 'hirer_service_pass', name: 'Home & Office Service Pass', price_monthly: 249, price_quarter: 599, active_gigs: 5, contact_credits: 15 },
    },
    {
      id: 'hirer_vip_pass', name: 'VIP Buyer',
      tagline: 'For frequent hirers with no limits.',
      monthly: 599, quarterly: 1499,
      intro: 'Everything in Service Pass, plus:',
      features: [
        'Unlimited active service requests',
        '3 featured requests (30 days each)',
        'Unlimited worker contact unlocks',
      ],
      checkout: { id: 'hirer_vip_pass', name: 'VIP Buyer Pass Unlimited', price_monthly: 599, price_quarter: 1499, active_gigs: -1, contact_credits: 9999 },
    },
  ],
}
const FREE_TIERS = ['free', 'employer_starter', 'hirer_free']
const peso = (n) => '₱' + Number(n).toLocaleString('en-PH')

function PlanCard({ plan, cycle, isCurrent, onPaidPlan, onChoose }) {
  const quarterly = cycle === 'quarterly'
  const price = plan.free ? 0 : (quarterly ? plan.quarterly : plan.monthly)
  const perMonth = !plan.free && quarterly ? Math.round(plan.quarterly / 3) : null
  return (
    <article className={`sub-card${plan.popular ? ' pop' : ''}${isCurrent ? ' cur' : ''}`}>
      <div className="sub-card-top">
        <h3>{plan.name}</h3>
        {isCurrent ? <span className="sub-tag cur">Your plan</span> : plan.popular ? <span className="sub-tag">Most popular</span> : null}
      </div>
      <p className="sub-tagline">{plan.tagline}</p>

      <div className="sub-price">
        <span className="amt">{peso(price)}</span>
        <span className="per">
          {plan.free ? <>PHP<br />free forever</> : quarterly ? <>PHP / 3 months<br />about {peso(perMonth)} a month</> : <>PHP / month<br />billed monthly</>}
        </span>
      </div>

      {plan.free ? (
        <button className="sub-btn ghost" disabled>{isCurrent ? 'Your current plan' : onPaidPlan ? 'Starts when your plan ends' : 'Included with every account'}</button>
      ) : isCurrent ? (
        <button className="sub-btn dark" onClick={() => onChoose(plan.checkout)}>
          Renew · adds {quarterly ? '90' : '30'} days
        </button>
      ) : (
        <button className={`sub-btn ${plan.popular ? 'dark' : 'line'}`} onClick={() => onChoose(plan.checkout)}>
          Get {plan.name}
        </button>
      )}

      <div className="sub-feats">
        {plan.intro && <p className="sub-intro">{plan.intro}</p>}
        <ul>
          {plan.features.map(f => (
            <li key={f}><IconCheck size={15} /><span>{f}</span></li>
          ))}
        </ul>
      </div>
    </article>
  )
}

export default function Subscription({ user, call, updateUser }) {
  const [searchParams, setSearchParams] = useSearchParams()
  // Determine default mode based on user account_type ('employer' or 'hirer')
  const defaultMode = user?.account_type === 'hirer' ? 'hirer' : 'employer'
  const [viewMode, setViewMode] = useState(defaultMode)
  const isAdmin = user?.role === 'admin'
  const canBuy = !isAdmin && ['employer', 'hirer'].includes(user?.account_type)
  const [notice, setNotice] = useState(null)     // { tone, title, text }
  const [usage, setUsage] = useState(null)
  useEffect(() => { if (canBuy) call('/jobs/my').then(r => setUsage(r.usage || null)).catch(() => {}) }, [call, canBuy])
  const [billingCycle, setBillingCycle] = useState('monthly') // 'monthly' | 'quarterly'
  const [subData, setSubData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checkoutPlan, setCheckoutPlan] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [successReceipt, setSuccessReceipt] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyList, setHistoryList] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Listen for return from PayMongo Checkout Session
  useEffect(() => {
    const status = searchParams.get('status')
    const rawRef = searchParams.get('ref') || searchParams.get('session_id') || ''
    const cleanRef = rawRef === '{CHECKOUT_SESSION_ID}' ? '' : rawRef
    const planId = searchParams.get('plan_id')
    const cycle = searchParams.get('cycle') || 'monthly'

    if (status === 'success') {
      setProcessing(true)
      call('/subscriptions/verify', {
        method: 'POST',
        body: {
          reference: cleanRef,
          session_id: cleanRef,
          plan_id: planId,
          billing_cycle: cycle
        }
      }).then(res => {
        if (res?.success) {
          if (updateUser && res.user) {
            updateUser(res.user)
          }
          setSuccessReceipt({
            planName: res.subscription?.plan?.name || 'hanapbuhay Plan',
            reference: res.subscription?.reference || res.payment?.session_id || cleanRef || 'PAID',
            amount: res.payment?.amount || res.subscription?.price || 0,
            method: 'PayMongo (GCash / Maya / Card)',
            date: new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
            expiresAt: res.subscription?.expires_at
          })
          setSearchParams({})
          call('/subscriptions/current').then(r => {
            if (r?.subscription) setSubData(r.subscription)
          }).catch(() => {})
        } else {
          setNotice({ tone: 'warn', title: 'Payment not confirmed yet', text: res?.message || res?.error || 'If you already paid, wait a moment and refresh this page.' })
        }
      }).catch(err => {
        setNotice({ tone: err?.status === 402 ? 'warn' : 'error', title: err?.status === 402 ? 'Payment not completed' : 'Could not confirm the payment',
          text: err?.data?.message || err?.data?.error || err?.message || 'Please refresh in a moment. If money was taken, contact Help & Support with your reference.' })
      }).finally(() => {
        setProcessing(false)
      })
    } else if (status === 'cancelled') {
      setNotice({ tone: 'info', title: 'Payment cancelled', text: 'Nothing was charged. You can try again whenever you are ready.' })
      setSearchParams({})
    }
  }, [searchParams, call, updateUser, setSearchParams])

  // Load current user subscription and catalog
  useEffect(() => {
    setLoading(true)
    call('/subscriptions/current')
      .then(res => {
        if (res?.subscription) {
          setSubData(res.subscription)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [call])

  const openHistory = () => {
    setHistoryOpen(true)
    setLoadingHistory(true)
    call('/subscriptions/history')
      .then(res => setHistoryList(res?.history || []))
      .catch(() => setHistoryList([]))
      .finally(() => setLoadingHistory(false))
  }

  // PayMongo Official Checkout submission
  const handleSubscribeSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!checkoutPlan) return
    setProcessing(true)

    try {
      const res = await call('/subscriptions/checkout', {
        method: 'POST',
        body: {
          plan_id: checkoutPlan.id,
          billing_cycle: billingCycle
        }
      })

      if (res?.is_free) {
        if (updateUser && res.user) {
          updateUser(res.user)
        }
        setSuccessReceipt({
          planName: checkoutPlan.name,
          reference: res.subscription?.reference || 'FREE-TRIAL',
          amount: 0,
          method: 'Free Starter Trial',
          date: new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
          expiresAt: res.subscription?.expires_at
        })
        setCheckoutPlan(null)
        call('/subscriptions/current').then(r => {
          if (r?.subscription) setSubData(r.subscription)
        }).catch(() => {})
        return
      }

      if (res?.success && res?.checkout_url) {
        // Direct redirect to PayMongo official hosted checkout page
        window.location.href = res.checkout_url
        return
      }

      console.error('[PayMongo] Unexpected response:', res)
      setNotice({ tone: 'error', title: 'Checkout did not start', text: res?.error || res?.message || 'Please try again.' })
    } catch (err) {
      console.error('[PayMongo] Checkout error:', err)
      const msg = err?.data?.error || err?.data?.message || err?.message || 'Error processing payment with PayMongo.'
      setNotice({ tone: 'error', title: 'Checkout did not start', text: msg })
      setCheckoutPlan(null)
    } finally {
      setProcessing(false)
    }
  }

  // Active user plan details
  const activeTier = user?.subscription_tier || subData?.tier || 'free'
  const contactCredits = user?.contact_credits ?? subData?.contact_credits ?? 5
  const featuredCredits = user?.featured_credits ?? subData?.featured_credits ?? 0
  const expiresAt = user?.subscription_expires_at || subData?.expires_at

  return (
    <div className="page-inner sub-page">
      {notice && <Dialog tone={notice.tone} title={notice.title} onClose={() => setNotice(null)} actions={[{ label: 'OK', primary: true, onClick: () => setNotice(null) }]}><p>{notice.text}</p></Dialog>}
      <div className="sub-paper">
        <header className="sub-hero">
          <h1>Plans that grow with your hiring</h1>
          <p>Post jobs, reach local talent across Oriental Mindoro, and upgrade only when you need more room.</p>

          {isAdmin && <div className="sub-seg" role="tablist" aria-label="Account type">
            <button role="tab" aria-selected={viewMode === 'employer'} className={viewMode === 'employer' ? 'on' : ''} onClick={() => setViewMode('employer')}>
              <IconBuilding size={15} /> Employers &amp; MSMEs
            </button>
            <button role="tab" aria-selected={viewMode === 'hirer'} className={viewMode === 'hirer' ? 'on' : ''} onClick={() => setViewMode('hirer')}>
              <IconWrench size={15} /> Service buyers
            </button>
          </div>}

          <div className="sub-seg small" role="tablist" aria-label="Billing period">
            <button role="tab" aria-selected={billingCycle === 'monthly'} className={billingCycle === 'monthly' ? 'on' : ''} onClick={() => setBillingCycle('monthly')}>Monthly</button>
            <button role="tab" aria-selected={billingCycle === 'quarterly'} className={billingCycle === 'quarterly' ? 'on' : ''} onClick={() => setBillingCycle('quarterly')}>
              Quarterly <em>Save 20%</em>
            </button>
          </div>
        </header>

        <div className="sub-grid">
          {PLAN_SETS[viewMode].map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              cycle={billingCycle}
              isCurrent={plan.free ? FREE_TIERS.includes(activeTier) : activeTier === plan.id}
              onPaidPlan={!FREE_TIERS.includes(activeTier)}
              onChoose={canBuy ? setCheckoutPlan : () => setNotice({ tone: 'info', title: 'Plans are for hiring accounts', text: 'Hiring plans are bought from an employer or client account.' })}
            />
          ))}
        </div>

        <div className="sub-status">
          <div>
            <b>{loading ? 'Loading your plan…' : (FREE_TIERS.includes(activeTier) ? 'You are on the free plan' : 'Your plan is active')}</b>
            <span>
              {expiresAt && !FREE_TIERS.includes(activeTier)
                ? `Valid until ${new Date(expiresAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}. Plans do not renew automatically.`
                : 'The free plan never expires.'}
            </span>
            {usage && (
              <span className="sub-usage">
                <b>{usage.active}{usage.limit >= 0 ? ` of ${usage.limit}` : ''}</b> active posts ·
                <b> {featuredCredits}</b> featured left ·
                <b> {usage.contact_unlimited ? 'Unlimited' : contactCredits}</b> contact unlocks
              </span>
            )}
          </div>
          <button className="sub-link" onClick={openHistory}><IconCalendar size={14} /> Payment receipts</button>
        </div>

        <p className="sub-foot">
          <GCashIcon size={16} />
          Prices are in Philippine pesos. Pay securely with GCash, Maya, or card through PayMongo.
        </p>
      </div>
      {/* ── Checkout / GCash / Maya Modal ─────────────────── */}
      {checkoutPlan && (
        <div
          onClick={() => setCheckoutPlan(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            backdropFilter: 'blur(3px)'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              width: 520,
              maxWidth: '100%',
              boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--line)',
              background: '#1f1e1d',
              color: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  Complete Your Subscription
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.85 }}>
                  {checkoutPlan.name} • {billingCycle === 'quarterly' ? 'Quarterly (3 Months)' : 'Monthly'}
                </p>
              </div>
              <button
                onClick={() => setCheckoutPlan(null)}
                style={{ background: 'none', border: 0, color: '#fff', cursor: 'pointer', padding: 4 }}
              >
                <IconX size={20} />
              </button>
            </div>

            {/* Modal Body — One-click PayMongo Checkout */}
            <div style={{ padding: 24 }}>
              {/* Order Summary Box */}
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid var(--line)', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 13, color: 'var(--muted)' }}>
                  <span>Package:</span>
                  <strong style={{ color: 'var(--navy-d)' }}>{checkoutPlan.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 13, color: 'var(--muted)' }}>
                  <span>Billing:</span>
                  <span style={{ color: 'var(--navy-d)', fontWeight: 600 }}>{billingCycle === 'quarterly' ? '90 Days (Quarterly)' : '30 Days (Monthly)'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--navy-d)', fontSize: 15 }}>Total:</span>
                  <strong style={{ fontSize: 26, color: '#1f1e1d', fontWeight: 900 }}>
                    ₱{billingCycle === 'quarterly' ? Number(checkoutPlan.price_quarter).toLocaleString() : Number(checkoutPlan.price_monthly).toLocaleString()}
                  </strong>
                </div>
              </div>

              {/* GCash via PayMongo — Big CTA Button */}
              <button
                type="button"
                onClick={handleSubscribeSubmit}
                disabled={processing}
                style={{
                  width: '100%',
                  background: processing ? '#93c5fd' : 'linear-gradient(135deg, #007DFE 0%, #005CE6 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 14,
                  padding: '18px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 14,
                  cursor: processing ? 'not-allowed' : 'pointer',
                  boxShadow: processing ? 'none' : '0 8px 28px rgba(0, 125, 254, 0.38)',
                  transition: 'all 0.2s',
                  marginBottom: 14
                }}
              >
                <GCashIcon size={40} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: '-0.02em' }}>
                    {processing ? 'Connecting to PayMongo…' : 'Pay with GCash'}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.9, marginTop: 1 }}>
                    {processing ? 'Please wait…' : 'GCash · Maya · Credit Card via PayMongo'}
                  </div>
                </div>
                {!processing && (
                  <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.22)', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                    POWERED BY PAYMONGO
                  </span>
                )}
              </button>

              {/* Security note */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: 8, marginBottom: 18 }}>
                <IconShield size={15} color="#16a34a" />
                <span style={{ fontSize: 11.5, color: '#166534', fontWeight: 500 }}>
                  Secured by <strong>PayMongo</strong> · BSP-licensed · Admin-tracked in real time
                </span>
              </div>

              {/* Footer buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setCheckoutPlan(null)}
                  className="btn btn-light"
                  style={{ fontWeight: 600, fontSize: 13, minWidth: 140 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Success Modal ──────────────────────────── */}
      {successReceipt && (
        <div
          onClick={() => setSuccessReceipt(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            backdropFilter: 'blur(3px)'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              width: 480,
              maxWidth: '100%',
              padding: 32,
              textAlign: 'center',
              boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: '#ecfdf5',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              border: '2px solid #bbf7d0'
            }}>
              <IconCheck size={32} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <GCashLogo height={32} />
            </div>

            <h3 style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy-d)', margin: '0 0 6px' }}>
              Subscription Activated!
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: '0 0 24px' }}>
              Thank you! Your <strong>{successReceipt.planName}</strong> membership is now active via GCash.
            </p>

            <div style={{ background: '#f8fafc', padding: 18, borderRadius: 12, border: '1px solid var(--line)', textAlign: 'left', marginBottom: 24, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--muted)' }}>Official Reference:</span>
                <strong style={{ color: 'var(--navy-d)' }}>{successReceipt.reference}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                <span style={{ color: 'var(--muted)' }}>Payment Channel:</span>
                <span style={{ fontWeight: 700, color: '#007DFE', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <GCashIcon size={16} /> GCash e-Wallet (Official Partner)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--muted)' }}>Amount Paid:</span>
                <strong style={{ color: '#16a34a' }}>₱{Number(successReceipt.amount).toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Valid Through:</span>
                <span style={{ fontWeight: 600 }}>{successReceipt.expiresAt ? new Date(successReceipt.expiresAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '30 Days'}</span>
              </div>
            </div>

            <button
              onClick={() => setSuccessReceipt(null)}
              className="btn btn-navy btn-block"
              style={{ padding: 12, fontWeight: 800 }}
            >
              Done &amp; Return to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* ── Payment History Modal ─────────────────────────── */}
      {historyOpen && (
        <div
          onClick={() => setHistoryOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            backdropFilter: 'blur(3px)'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              width: 640,
              maxWidth: '100%',
              boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--navy-d)' }}>
                Subscription Payment History
              </h3>
              <button onClick={() => setHistoryOpen(false)} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--muted)' }}>
                <IconX size={20} />
              </button>
            </div>

            <div style={{ padding: 24, maxHeight: '60vh', overflowY: 'auto' }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Loading records…</div>
              ) : historyList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>No subscription payment records found yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {historyList.map(h => (
                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid var(--line)' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--navy-d)' }}>{h.plan_name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>Ref: {h.payment_reference || 'N/A'}</span>
                          <span>•</span>
                          <span style={{ color: '#007DFE', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <GCashIcon size={13} /> GCash
                          </span>
                          <span>•</span>
                          <span style={{ textTransform: 'capitalize' }}>{h.billing_cycle}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: '#16a34a', fontSize: 14 }}>₱{Number(h.price).toLocaleString()}</div>
                        <span className="chip green" style={{ fontSize: 10, marginTop: 4 }}>Completed</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--line)', background: '#f8fafc', textAlign: 'right' }}>
              <button onClick={() => setHistoryOpen(false)} className="btn btn-light btn-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

