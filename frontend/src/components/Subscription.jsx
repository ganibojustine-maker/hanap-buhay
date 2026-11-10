import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
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

export default function Subscription({ user, call, updateUser }) {
  const [searchParams, setSearchParams] = useSearchParams()
  // Determine default mode based on user account_type ('employer' or 'hirer')
  const defaultMode = user?.account_type === 'hirer' ? 'hirer' : 'employer'
  const [viewMode, setViewMode] = useState(defaultMode)
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
            planName: res.subscription?.plan?.name || 'HanapBuhay Plan',
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
          alert(res?.error || 'Failed to verify PayMongo payment.')
        }
      }).catch(err => {
        alert(err?.data?.error || err?.data?.message || err?.message || 'Error verifying PayMongo payment.')
      }).finally(() => {
        setProcessing(false)
      })
    } else if (status === 'cancelled') {
      alert('Payment was cancelled. You can try again whenever you are ready.')
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
        console.log('[PayMongo] Redirecting to PayMongo website:', res.checkout_url)
        // Direct redirect to PayMongo official hosted checkout page
        window.location.href = res.checkout_url
        return
      }

      console.error('[PayMongo] Unexpected response:', res)
      alert(res?.error || res?.message || 'Subscription checkout failed.')
    } catch (err) {
      console.error('[PayMongo] Checkout error:', err)
      const msg = err?.data?.error || err?.data?.message || err?.message || 'Error processing payment with PayMongo.'
      alert(msg)
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
    <div className="page-inner" style={{ maxWidth: 1180, margin: '0 auto', paddingBottom: 60 }}>
      {/* ── Top Bar / Mode Switcher ────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
        <div>
          <span className="eyebrow" style={{ color: 'var(--navy)', fontWeight: 700, letterSpacing: '.06em' }}>
            HANAPBUHAY PREMIUM MEMBERSHIP
          </span>
          <h1 style={{ fontSize: 28, margin: '4px 0 0', color: 'var(--navy-d)', fontWeight: 800 }}>
            Subscription Plans &amp; Packages
          </h1>
        </div>

        {/* View Switcher: Employer JobStreet style vs Service Buyer Street Job style */}
        <div style={{ display: 'inline-flex', background: '#e2e8f0', padding: 4, borderRadius: 12, border: '1px solid #cbd5e1' }}>
          <button
            onClick={() => setViewMode('employer')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              border: 0,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
              background: viewMode === 'employer' ? '#1e3a8a' : 'transparent',
              color: viewMode === 'employer' ? '#fff' : '#475569',
              boxShadow: viewMode === 'employer' ? '0 2px 8px rgba(30, 58, 138, 0.25)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <IconBuilding size={16} /> Employers &amp; MSMEs (JobStreet Style)
          </button>
          <button
            onClick={() => setViewMode('hirer')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              border: 0,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
              background: viewMode === 'hirer' ? '#047857' : 'transparent',
              color: viewMode === 'hirer' ? '#fff' : '#475569',
              boxShadow: viewMode === 'hirer' ? '0 2px 8px rgba(4, 120, 87, 0.25)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <IconWrench size={16} /> Clients &amp; Service Buyers (Street Job Gigs)
          </button>
        </div>
      </div>

      {/* ── Active Subscription Status Card ───────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        color: '#fff',
        borderRadius: 16,
        padding: '20px 26px',
        marginBottom: 28,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
        boxShadow: '0 10px 30px rgba(15,23,42,0.12)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <IconSpark size={24} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>
              Kasalukuyang Subscription Plan
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span>
                {activeTier === 'employer_growth' ? 'MSME Growth / Negosyo Pro' :
                 activeTier === 'employer_enterprise' ? 'Corporate Enterprise Unlimited' :
                 activeTier === 'hirer_service_pass' ? 'Home & Office Service Pass' :
                 activeTier === 'hirer_vip_pass' ? 'VIP Buyer Pass Unlimited' :
                 'Libre / Starter Free Tier'}
              </span>
              <span className={`chip ${activeTier !== 'free' && activeTier !== 'employer_starter' && activeTier !== 'hirer_free' ? 'green' : 'gold'}`} style={{ fontSize: 11, fontWeight: 700 }}>
                {activeTier !== 'free' && activeTier !== 'employer_starter' && activeTier !== 'hirer_free' ? 'Active Pro' : 'Free Member'}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
              {expiresAt ? `Valid until ${new Date(expiresAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}` : 'Walang expiration ang basic free access.'}
            </div>
          </div>
        </div>

        {/* Credit Badges */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(255,255,255,0.08)', padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Worker Contact Unlocks</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#38bdf8' }}>{contactCredits} <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>left</span></div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.08)', padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Featured Job Badges</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24' }}>{featuredCredits} <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>slots</span></div>
          </div>

          <button
            onClick={openHistory}
            className="btn btn-xs"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', padding: '8px 14px', fontSize: 12 }}
          >
            <IconCalendar size={13} /> Payment Receipts
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          STYLE 1: EMPLOYERS & MSMEs (JobStreet / Corporate Style)
          ───────────────────────────────────────────────────────────── */}
      {viewMode === 'employer' && (
        <div className="employer-subscription-view" style={{ animation: 'fadeIn 0.25s ease' }}>
          {/* JobStreet-Inspired Header */}
          <div style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
            color: '#fff',
            borderRadius: 16,
            padding: '36px 32px',
            marginBottom: 32,
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ maxWidth: 680, position: 'relative', zIndex: 2 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f59e0b', color: '#1e3a8a', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 14 }}>
                <IconShield size={13} /> JobStreet Partner Hiring Solutions for Mindoro MSMEs
              </div>
              <h2 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 10px', lineHeight: 1.2, color: '#fff' }}>
                Hire Faster, Screen Verified Local Talent in Oriental Mindoro
              </h2>
              <p style={{ fontSize: 15, color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
                Itaas ang inyong job postings sa unahan ng search results, mag-access ng 1,000+ verified TESDA Skills Passports, at makipag-ugnayan agad sa mga karapat-dapat na aplikante gamit ang JobStreet corporate hiring tools.
              </p>
            </div>

            {/* Decorative background logo */}
            <div style={{ position: 'absolute', right: -20, bottom: -40, opacity: 0.08, pointerEvents: 'none' }}>
              <IconBuilding size={320} />
            </div>
          </div>

          {/* Billing Cycle Picker */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 30 }}>
            <span style={{ fontSize: 14, fontWeight: billingCycle === 'monthly' ? 700 : 500, color: billingCycle === 'monthly' ? 'var(--navy-d)' : 'var(--muted)' }}>
              Monthly Billing
            </span>
            <button
              onClick={() => setBillingCycle(prev => prev === 'monthly' ? 'quarterly' : 'monthly')}
              style={{
                width: 52,
                height: 28,
                borderRadius: 20,
                background: billingCycle === 'quarterly' ? '#1e3a8a' : '#cbd5e1',
                position: 'relative',
                border: 0,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
            >
              <div style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: '#fff',
                position: 'absolute',
                top: 3,
                left: billingCycle === 'quarterly' ? 26 : 4,
                transition: 'left 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }} />
            </button>
            <span style={{ fontSize: 14, fontWeight: billingCycle === 'quarterly' ? 700 : 500, color: billingCycle === 'quarterly' ? 'var(--navy-d)' : 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              Quarterly Saver (3 Months)
              <span className="chip gold" style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px' }}>SAVE 20%</span>
            </span>
          </div>

          {/* 3 JobStreet-style Pricing Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 24, alignItems: 'stretch' }}>
            {/* 1. Starter Libre */}
            <div style={{
              background: '#fff',
              borderRadius: 16,
              border: '1px solid var(--line)',
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <span className="chip gray" style={{ fontSize: 11, fontWeight: 700 }}>FREE TRIAL</span>
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy-d)', margin: '0 0 6px' }}>Starter Libre</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', minHeight: 38, margin: '0 0 18px' }}>
                Pangunahing pag-post ng 1 bakante para sa maliliit na negosyo at tindahan.
              </p>

              <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--navy-d)' }}>
                  ₱0 <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted)' }}>/ habambuhay</span>
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                {[
                  '1 Active Standard Job Post',
                  '5 Candidate Resume & Contact Unlocks',
                  'Standard Mindoro Job Board Listing',
                  'Basic Applicant Review & Status Tracking',
                  'Standard Email Notification',
                  'Community Support'
                ].map((feat, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink)' }}>
                    <span style={{ color: '#16a34a', flexShrink: 0 }}><IconCheck size={16} /></span>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              <button
                disabled
                className="btn btn-light"
                style={{ width: '100%', justifyContent: 'center', fontWeight: 700, padding: 12 }}
              >
                Kasalukuyang Default Plan
              </button>
            </div>

            {/* 2. Negosyo Pro (Most Popular / JobStreet Best Choice) */}
            <div style={{
              background: '#fff',
              borderRadius: 16,
              border: '2px solid #1e3a8a',
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 12px 36px rgba(30, 58, 138, 0.12)',
              position: 'relative',
              transform: 'scale(1.02)'
            }}>
              <div style={{
                position: 'absolute',
                top: -14,
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#1e3a8a',
                color: '#fff',
                padding: '4px 16px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '.04em',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}>
                <IconStar size={12} color="#fbbf24" /> MOST POPULAR • JOBSTREET BEST PICK
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <span className="chip gold" style={{ fontSize: 11, fontWeight: 700 }}>MSME GROWTH</span>
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy-d)', margin: '0 0 6px' }}>Negosyo Pro</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', minHeight: 38, margin: '0 0 18px' }}>
                Kumpletong hiring suite para sa lumalawak na kumpanya at negosyo sa Mindoro.
              </p>

              <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#1e3a8a' }}>
                  ₱{billingCycle === 'quarterly' ? '1,199' : '499'}
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted)' }}>
                    {billingCycle === 'quarterly' ? ' / 3 buwan (Save 20%)' : ' / buwan'}
                  </span>
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                {[
                  'Up to 5 Active Job Postings sabay-sabay',
                  '2 Featured & "Urgent Hiring" Badges (Nangunguna sa Search)',
                  '30 Direct Worker Scout & Skills Passport Unlocks',
                  'Automated Interview Scheduler & Applicant Notes',
                  'Verified Business Trust Gold Shield Badge',
                  'Direct SMS & WhatsApp Candidate Alerts',
                  'Smart AI Match Scoring sa mga aplikante',
                  'Priority Admin Verification Queue'
                ].map((feat, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink)' }}>
                    <span style={{ color: '#1e3a8a', flexShrink: 0 }}><IconCheck size={16} /></span>
                    <span style={{ fontWeight: i < 3 ? 600 : 400 }}>{feat}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setCheckoutPlan({
                  id: 'employer_growth',
                  name: 'Negosyo Pro (MSME Growth)',
                  price_monthly: 499,
                  price_quarter: 1199,
                  job_posts: 5,
                  featured_slots: 2,
                  contact_credits: 30
                })}
                className="btn btn-navy"
                style={{ width: '100%', justifyContent: 'center', fontWeight: 800, padding: 12, fontSize: 14 }}
              >
                Piliin ang Negosyo Pro <IconArrow size={16} />
              </button>
            </div>

            {/* 3. Corporate Enterprise */}
            <div style={{
              background: '#fff',
              borderRadius: 16,
              border: '1px solid var(--line)',
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <span className="chip navy" style={{ fontSize: 11, fontWeight: 700 }}>ENTERPRISE UNLIMITED</span>
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy-d)', margin: '0 0 6px' }}>Corporate Enterprise</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', minHeight: 38, margin: '0 0 18px' }}>
                Para sa malalaking resort hotels, construction firms, at retail chains.
              </p>

              <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--navy-d)' }}>
                  ₱{billingCycle === 'quarterly' ? '3,599' : '1,499'}
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted)' }}>
                    {billingCycle === 'quarterly' ? ' / 3 buwan (Save 20%)' : ' / buwan'}
                  </span>
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                {[
                  'Walang limitasyong Active Job Posts',
                  '10 Featured Urgent Badges + Social Media Job Blast',
                  'Unlimited Worker Scouting & Direct Contact Unlocks',
                  'Top Ranked Placement sa Mindoro Job Searches',
                  'Instant PESO & TESDA Certified Worker Recommendations',
                  'Dedicated HanapBuhay Account Specialist',
                  'Custom Company Hiring Banner sa Homepage',
                  'VIP 24/7 Priority Assistance'
                ].map((feat, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink)' }}>
                    <span style={{ color: '#16a34a', flexShrink: 0 }}><IconCheck size={16} /></span>
                    <span style={{ fontWeight: i < 3 ? 600 : 400 }}>{feat}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setCheckoutPlan({
                  id: 'employer_enterprise',
                  name: 'Corporate Enterprise Unlimited',
                  price_monthly: 1499,
                  price_quarter: 3599,
                  job_posts: -1,
                  featured_slots: 10,
                  contact_credits: 9999
                })}
                className="btn btn-light"
                style={{ width: '100%', justifyContent: 'center', fontWeight: 700, padding: 12 }}
              >
                Mag-upgrade sa Enterprise <IconArrow size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STYLE 2: CLIENTS & SERVICE BUYERS (Street Job On-Demand Gigs Style)
          ───────────────────────────────────────────────────────────── */}
      {viewMode === 'hirer' && (
        <div className="hirer-subscription-view" style={{ animation: 'fadeIn 0.25s ease' }}>
          {/* Street Job On-Demand Hero */}
          <div style={{
            background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
            color: '#fff',
            borderRadius: 16,
            padding: '36px 32px',
            marginBottom: 32,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 12px 30px rgba(4, 120, 87, 0.2)'
          }}>
            <div style={{ maxWidth: 680, position: 'relative', zIndex: 2 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fef08a', color: '#14532d', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 14 }}>
                <IconSpark size={13} /> Street Job On-Demand Service Pass
              </div>
              <h2 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 10px', lineHeight: 1.2, color: '#fff' }}>
                Direktang Tawag at Mabilisang Gawa sa Oriental Mindoro!
              </h2>
              <p style={{ fontSize: 15, color: '#d1fae5', lineHeight: 1.6, margin: '0 0 20px' }}>
                Kailangan mo ba agad ng karpintero, tubero, electrician, driver, masahista, o home service repair? Kunin ang Street Job Service Pass para ma-unlock agad ang totoong numero ng telepono at makatanggap ng multiple quotes sa loob lamang ng ilang minuto!
              </p>

              {/* 3 Quick Value Badges */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
                  <IconPhone size={14} color="#fef08a" /> Instant Tawag &amp; SMS
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
                  <IconShield size={14} color="#fef08a" /> 100% TESDA Certified Workers
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
                  <IconClock size={14} color="#fef08a" /> Same-Day Urgent Dispatch
                </div>
              </div>
            </div>

            {/* Decorative background logo */}
            <div style={{ position: 'absolute', right: -20, bottom: -40, opacity: 0.1, pointerEvents: 'none' }}>
              <IconWrench size={320} />
            </div>
          </div>

          {/* Billing Cycle Picker */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 30 }}>
            <span style={{ fontSize: 14, fontWeight: billingCycle === 'monthly' ? 700 : 500, color: billingCycle === 'monthly' ? '#064e3b' : 'var(--muted)' }}>
              1 Month Pass
            </span>
            <button
              onClick={() => setBillingCycle(prev => prev === 'monthly' ? 'quarterly' : 'monthly')}
              style={{
                width: 52,
                height: 28,
                borderRadius: 20,
                background: billingCycle === 'quarterly' ? '#047857' : '#cbd5e1',
                position: 'relative',
                border: 0,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
            >
              <div style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: '#fff',
                position: 'absolute',
                top: 3,
                left: billingCycle === 'quarterly' ? 26 : 4,
                transition: 'left 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }} />
            </button>
            <span style={{ fontSize: 14, fontWeight: billingCycle === 'quarterly' ? 700 : 500, color: billingCycle === 'quarterly' ? '#064e3b' : 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              3-Month Season Pass
              <span className="chip green" style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px' }}>SAVE 20%</span>
            </span>
          </div>

          {/* 3 Street Job On-Demand Service Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 24, alignItems: 'stretch' }}>
            {/* 1. Pay As You Go */}
            <div style={{
              background: '#fff',
              borderRadius: 16,
              border: '1px solid var(--line)',
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <span className="chip gray" style={{ fontSize: 11, fontWeight: 700 }}>BASIC HIRER</span>
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: '#064e3b', margin: '0 0 6px' }}>Libreng Buyer</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', minHeight: 38, margin: '0 0 18px' }}>
                Pang-minsanang paghahanap ng serbisyo at simpleng pagkukumpuni.
              </p>

              <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#064e3b' }}>
                  ₱0 <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted)' }}>/ habambuhay</span>
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                {[
                  '1 Active Service Request or Gig',
                  '3 Direct Worker Contact Unlocks',
                  'Standard Worker Response (< 24 oras)',
                  'HanapBuhay In-App Chat Messaging',
                  'Community Verified Worker Ratings'
                ].map((feat, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink)' }}>
                    <span style={{ color: '#16a34a', flexShrink: 0 }}><IconCheck size={16} /></span>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              <button
                disabled
                className="btn btn-light"
                style={{ width: '100%', justifyContent: 'center', fontWeight: 700, padding: 12 }}
              >
                Kasalukuyang Default Plan
              </button>
            </div>

            {/* 2. Service Pass (Household Favorite) */}
            <div style={{
              background: '#fff',
              borderRadius: 16,
              border: '2px solid #047857',
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 12px 36px rgba(4, 120, 87, 0.12)',
              position: 'relative',
              transform: 'scale(1.02)'
            }}>
              <div style={{
                position: 'absolute',
                top: -14,
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#047857',
                color: '#fff',
                padding: '4px 16px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '.04em',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}>
                <IconSpark size={12} color="#fef08a" /> HOUSEHOLD FAVORITE • STREET JOB PASS
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <span className="chip green" style={{ fontSize: 11, fontWeight: 700 }}>HOME &amp; BIZ PASS</span>
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: '#064e3b', margin: '0 0 6px' }}>Service Pass Pro</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', minHeight: 38, margin: '0 0 18px' }}>
                Direktang tawagan ang mga karpintero, tubero, electrician, at helpers nang walang delay!
              </p>

              <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#047857' }}>
                  ₱{billingCycle === 'quarterly' ? '599' : '249'}
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted)' }}>
                    {billingCycle === 'quarterly' ? ' / 3 buwan (Save 20%)' : ' / buwan'}
                  </span>
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                {[
                  '15 Instant Phone & Contact Unlocks (Tawag Agad)',
                  'Up to 5 Active Service Requests sabay-sabay',
                  'Urgent Service Broadcast Tag (Push alert sa local pros)',
                  'Mabilisang Same-Day Response (< 2 oras)',
                  'TESDA-Certified Craftsman Priority Matching',
                  'HanapBuhay Service Buyer Dispute Protection Guarantee'
                ].map((feat, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink)' }}>
                    <span style={{ color: '#047857', flexShrink: 0 }}><IconCheck size={16} /></span>
                    <span style={{ fontWeight: i < 3 ? 600 : 400 }}>{feat}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setCheckoutPlan({
                  id: 'hirer_service_pass',
                  name: 'Home & Office Service Pass Pro',
                  price_monthly: 249,
                  price_quarter: 599,
                  active_gigs: 5,
                  contact_credits: 15
                })}
                className="btn"
                style={{ width: '100%', justifyContent: 'center', fontWeight: 800, padding: 12, fontSize: 14, background: '#047857', color: '#fff' }}
              >
                Kumuha ng Service Pass <IconArrow size={16} />
              </button>
            </div>

            {/* 3. VIP Buyer Pass */}
            <div style={{
              background: '#fff',
              borderRadius: 16,
              border: '1px solid var(--line)',
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <span className="chip gold" style={{ fontSize: 11, fontWeight: 700 }}>VIP INSTANT DISPATCH</span>
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: '#064e3b', margin: '0 0 6px' }}>VIP Buyer Pass</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', minHeight: 38, margin: '0 0 18px' }}>
                Para sa mga property managers, events, at madalas mag-hire ng mga technician.
              </p>

              <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#064e3b' }}>
                  ₱{billingCycle === 'quarterly' ? '1,499' : '599'}
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted)' }}>
                    {billingCycle === 'quarterly' ? ' / 3 buwan (Save 20%)' : ' / buwan'}
                  </span>
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                {[
                  'Unlimited Direct Phone, SMS & WhatsApp Unlocks',
                  'Unlimited Active Service Gigs & Projects',
                  'Priority Same-Day Dispatch (< 30 minutong tugon)',
                  'Multi-Bid Instant Quotes (Hanggang 10 biddings bawat gig)',
                  'Guaranteed TESDA National Certificate (NC II/III) Pros',
                  'VIP Hotline Booking Concierge Assistant',
                  '100% Service Quality & Satisfaction Coverage'
                ].map((feat, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink)' }}>
                    <span style={{ color: '#16a34a', flexShrink: 0 }}><IconCheck size={16} /></span>
                    <span style={{ fontWeight: i < 3 ? 600 : 400 }}>{feat}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setCheckoutPlan({
                  id: 'hirer_vip_pass',
                  name: 'VIP Buyer Pass Unlimited',
                  price_monthly: 599,
                  price_quarter: 1499,
                  active_gigs: -1,
                  contact_credits: 9999
                })}
                className="btn btn-light"
                style={{ width: '100%', justifyContent: 'center', fontWeight: 700, padding: 12 }}
              >
                Mag-upgrade sa VIP Buyer <IconArrow size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

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
              background: viewMode === 'employer' ? '#1e3a8a' : '#047857',
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
                  <strong style={{ fontSize: 26, color: viewMode === 'employer' ? '#1e3a8a' : '#047857', fontWeight: 900 }}>
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
              Maraming salamat! Aktibo na ang iyong <strong>{successReceipt.planName}</strong> membership via GCash.
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

