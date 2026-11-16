/**
 * Client Service Buyer Pass: the client's own copy of the billing page (team rule: each role
 * has its own pages). Current pass, usage and limits, comparison, PayMongo checkout, billing
 * history with every outcome, receipts, retry, and the pass timeline.
 *
 * A plan changes only after PayMongo confirms the payment (backend libraries/Payments.php).
 * Coming back from the payment page only asks the server to check with PayMongo.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import BrandLoader from '../../../components/BrandLoader.jsx'
import Dialog from '../../../components/Dialog.jsx'
import { IconCheck, IconCard, IconClock, IconPrinter, IconAlert, IconArrow } from '../../../components/icons.jsx'
import { peso, phDate, phDateTime } from '../../../utils/format.js'
import '../../../styles/platform.css'

const COPY = {
  title: 'Service Buyer Pass',
  who: 'client',
  postWord: 'open gigs',
  featuredWord: 'featured gigs',
  contactWord: 'worker contact unlocks',
  freeName: 'Free',
  intro: 'Hire for more gigs and reach workers faster. Pay once per period with GCash, Maya, card or QR Ph. Passes never renew or charge you by themselves.',
  faqs: [
    ['Do I pay workers through the pass?', 'No. The pass is for posting gigs and contacting workers. You pay each worker directly for their work, then mark the contract as paid.'],
    ['When does my pass change?', 'Only after PayMongo confirms your payment. If you close the payment page early, nothing is charged and your pass stays the same.'],
    ['Does it renew automatically?', 'No. We remind you 3 days before your pass ends. Renewing early adds the new days on top of the days you have left.'],
    ['Can I get a refund?', 'If you were charged by mistake or charged twice, contact support within 7 days. Approved refunds go back to the card or e-wallet you used.'],
  ],
}

const EVENT = {
  subscribed: ['Plan started', 'good'], renewed: ['Plan renewed', 'good'], upgraded: ['Upgraded', 'good'], downgraded: ['Switched plan', 'good'],
  payment_pending: ['Checkout started', ''], payment_failed: ['Payment didn’t go through', 'bad'], cancel_requested: ['Set to end on its date', 'warn'],
  resumed: ['Plan change undone', ''], downgrade_scheduled: ['Plan change scheduled', 'warn'], expired: ['Plan ended', 'bad'],
  refunded: ['Refunded: plan ended', 'bad'], refund_pending: ['Refund started', 'warn'],
}
const PAY_TONE = { paid: 'green', pending: 'gold', failed: 'red', cancelled: '', expired: '', refunded: 'blue' }

export function ClientPass({ call, updateUser }) {
  const [params, setParams] = useSearchParams()
  const [cur, setCur] = useState(null)
  const [hist, setHist] = useState(null)
  const [cycle, setCycle] = useState('monthly')
  const [choose, setChoose] = useState(null)
  const [banner, setBanner] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const polling = useRef(null)

  const load = useCallback(() => {
    call('/subscriptions/current').then(r => { setCur(r); if (r.user) updateUser?.(r.user) }).catch(e => setError(e.message || 'We couldn’t load your pass. Please try again.'))
    call('/subscriptions/history').then(setHist).catch(() => setHist({ payments: [], timeline: [] }))
  }, [call]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  // Back from PayMongo: ask the server to check. It decides; this page only shows the answer.
  useEffect(() => {
    const ref = params.get('ref'), ret = params.get('return')
    if (!ref) return
    const clear = () => setParams({}, { replace: true })
    if (ret === 'cancelled') {
      call('/subscriptions/abandon', { method: 'POST', body: { reference: ref } })
        .then(r => setBanner({ tone: r.payment?.status === 'paid' ? 'ok' : 'info', text: r.message })).catch(() => {}).finally(() => { clear(); load() })
      return
    }
    let tries = 0
    const check = () => call('/subscriptions/verify', { method: 'POST', body: { reference: ref } }).then(r => {
      const s = r.payment?.status
      setBanner({ tone: s === 'paid' ? 'ok' : s === 'pending' ? 'info' : 'bad', text: r.message, payment: r.payment })
      if (s === 'pending' && ++tries < 30) polling.current = setTimeout(check, 4000)
      else { clear(); load() }
    }).catch(e => { setBanner({ tone: 'bad', text: e.message || 'We couldn’t check your payment yet. Refresh this page in a minute.' }); clear() })
    setBanner({ tone: 'info', text: 'Checking your payment with PayMongo…' })
    check()
    return () => clearTimeout(polling.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function startCheckout(plan) {
    setBusy(true); setError('')
    try {
      const r = await call('/subscriptions/checkout', { method: 'POST', body: { plan_id: plan.id, billing_cycle: cycle } })
      if (r.checkout_url) { window.location.href = r.checkout_url; return }
      setChoose(null); setBanner({ tone: 'ok', text: r.message }); load()
    } catch (e) { setError(e.message || 'We couldn’t open the payment page. Please try again.'); setChoose(null) } finally { setBusy(false) }
  }
  async function payAction(p, kind) {
    setBusy(true)
    try {
      const r = await call(`/subscriptions/payments/${p.id}/${kind}`, { method: 'POST' })
      if (r.checkout_url) { window.location.href = r.checkout_url; return }
      setBanner({ tone: 'ok', text: r.message || 'Done.' }); load()
    } catch (e) { setBanner({ tone: 'bad', text: e.message }) } finally { setBusy(false); setConfirm(null) }
  }
  async function planAction(kind) {
    setBusy(true)
    try { const r = await call(`/subscriptions/${kind}`, { method: 'POST' }); setBanner({ tone: 'ok', text: r.message }); load() }
    catch (e) { setBanner({ tone: 'bad', text: e.message }) } finally { setBusy(false); setConfirm(null) }
  }
  async function openReceipt(p) {
    try { const r = await call(`/subscriptions/payments/${p.id}/receipt`); setReceipt(r.receipt) } catch (e) { setBanner({ tone: 'bad', text: e.message }) }
  }

  if (!cur) return <div className="page-inner">{error ? <div className="pf-note bad">{error}</div> : <BrandLoader compact label="Loading your plan…" />}</div>
  const s = cur.summary || {}, plans = cur.catalog?.plans || [], curPlan = s.plan || {}
  const price = p => (cycle === 'quarterly' ? p.price_quarter : p.price_monthly)
  const buttonFor = p => {
    if (p.id === curPlan.id) return s.is_paid ? { label: 'Renew', kind: 'renewal' } : { label: 'Current pass', disabled: true }
    if (Number(p.price_monthly) > Number(curPlan.price_monthly || 0)) return { label: s.is_paid ? 'Upgrade' : 'Choose', kind: s.is_paid ? 'upgrade' : 'new' }
    return { label: Number(p.price_monthly) === 0 ? 'Switch to free' : 'Switch at end of plan', kind: 'downgrade' }
  }
  const pending = (hist?.payments || []).find(p => p.status === 'pending')

  return (
    <div className="page-inner pf-stack">
      {choose && (
        <Dialog tone="info" title={`${choose.btn.label}: ${choose.plan.name}`} onClose={() => setChoose(null)} busy={busy}
          actions={[{ label: busy ? 'Opening…' : choose.btn.kind === 'downgrade' ? 'Confirm' : `Pay ${peso(price(choose.plan))}`, primary: true, onClick: () => startCheckout(choose.plan) }, { label: 'Cancel', onClick: () => setChoose(null) }]}>
          {choose.btn.kind === 'downgrade' ? (
            <p>You keep <b>{curPlan.name}</b> until {phDate(s.expires_at)}. After that your account moves to <b>{choose.plan.name}</b>. Nothing is charged today.</p>
          ) : (
            <>
              <p><b>{choose.plan.name}</b>, {cycle === 'quarterly' ? '3 months' : '1 month'}: <b>{peso(price(choose.plan))}</b>.
                {choose.btn.kind === 'renewal' ? ' The new days are added on top of the days you have left.' : choose.btn.kind === 'upgrade' ? ' It starts as soon as your payment is confirmed, and your unused credits carry over.' : ''}</p>
              <p className="pf-small">You’ll pay on PayMongo’s secure page with:</p>
              <div className="pf-methods">{(s.methods || []).map(m => <span key={m.id}>{m.label}</span>)}</div>
              <p className="pf-small" style={{ marginTop: 10 }}>Your pass changes only after PayMongo confirms the payment. The payment page stays open for 24 hours.</p>
              {s.test_mode && <p className="pf-note warn" style={{ marginTop: 8 }}><span className="pf-test">Test mode</span> No real money is charged. Use PayMongo’s test cards or test e-wallet to finish.</p>}
            </>
          )}
        </Dialog>
      )}
      {confirm && (
        <Dialog tone={confirm.tone || 'warn'} title={confirm.title} onClose={() => setConfirm(null)} busy={busy}
          actions={[{ label: confirm.label, primary: true, onClick: confirm.run }, { label: 'Keep it', onClick: () => setConfirm(null) }]}><p>{confirm.body}</p></Dialog>
      )}
      {receipt && (
        <Dialog tone="success" title="Receipt" onClose={() => setReceipt(null)}
          actions={[{ label: 'Print', primary: true, onClick: () => window.print() }, { label: 'Close', onClick: () => setReceipt(null) }]}>
          <div className="pf-receipt pf-print">
            <p style={{ margin: 0 }}><b>hanapbuhay Oriental Mindoro</b></p>
            <p className="pf-small" style={{ margin: 0 }}>Acknowledgement receipt {receipt.is_test && <span className="pf-test">Test payment</span>}</p>
            <hr />
            <dl className="pf-kv">
              <dt>Receipt no.</dt><dd>{receipt.receipt_no}</dd><dt>Reference</dt><dd>{receipt.reference}</dd>
              <dt>Date paid</dt><dd>{phDateTime(receipt.paid_at)}</dd><dt>Billed to</dt><dd>{receipt.billed_to?.name}<br /><span className="pf-small">{receipt.billed_to?.email}</span></dd>
              <dt>Item</dt><dd>{receipt.item}</dd><dt>Paid with</dt><dd>{receipt.method}</dd><dt>Amount</dt><dd>{peso(receipt.amount)}</dd>
              {receipt.refund_status && <><dt>Refund</dt><dd>{receipt.refund_status === 'succeeded' ? `Refunded ${peso(receipt.refunded_amount)}` : receipt.refund_status === 'pending' ? 'Being processed' : 'Not completed'}</dd></>}
            </dl>
            <hr /><p className="pf-small">{receipt.note}</p>
          </div>
        </Dialog>
      )}

      {banner && <div className={`pf-note ${banner.tone}`} role="status">{banner.text}
        {banner.payment?.can_retry && banner.payment.status !== 'pending' && <button type="button" className="btn btn-light btn-sm" style={{ marginLeft: 10 }} onClick={() => payAction(banner.payment, 'retry')}>Try payment again</button>}</div>}
      {error && <div className="pf-note bad" role="alert">{error}</div>}
      {s.test_mode && <div className="pf-note warn"><span className="pf-test">Test mode</span> Payments use PayMongo test mode. No real money is charged.</div>}
      {pending && !banner && (
        <div className="pf-note info pf-between"><span><b>Waiting for payment:</b> {pending.plan_name}, {peso(pending.amount)}. Your pass changes once PayMongo confirms it.</span>
          <span className="pf-row">{pending.can_continue && <button type="button" className="btn btn-navy btn-sm" onClick={() => payAction(pending, 'retry')}>Continue payment</button>}
            <button type="button" className="btn btn-light btn-sm" onClick={() => payAction(pending, 'cancel')}>Cancel it</button></span></div>
      )}

      <section className="panel">
        <div className="pf-between">
          <div><p className="pf-small" style={{ margin: 0 }}>Your pass</p><h2 className="pf-h" style={{ fontSize: 22 }}>{curPlan.name}</h2></div>
          <span className={`chip ${s.status === 'active' ? 'green' : s.status === 'ending' ? 'gold' : s.status === 'expired' ? 'red' : ''}`} style={{ fontSize: 13 }}>
            {{ active: 'Active', ending: 'Ends on its date', free: 'Free plan', expired: 'Ended' }[s.status]}</span>
        </div>
        <p className="pf-muted">{s.is_paid
          ? <>Active until <b>{phDate(s.expires_at)}</b> ({s.days_left} day{s.days_left === 1 ? '' : 's'} left). {s.cancel_at_period_end ? 'It will not be renewed and moves to the free plan after that.' : 'We’ll remind you 3 days before it ends.'}</>
          : s.status === 'expired' ? 'Your pass ended, so you are on the free plan. Renew to get your credits and features back.' : COPY.intro}</p>
        {s.scheduled_plan && <p className="pf-note warn">Switches to <b>{s.scheduled_plan.name}</b> on {phDate(s.expires_at)}.</p>}
        <div className="pf-usage" style={{ marginTop: 12 }}>
          <div><span className="pf-small">{COPY.postWord}</span><b>{s.usage?.posts?.used} of {s.usage?.posts?.limit < 0 ? 'unlimited' : s.usage?.posts?.limit}</b></div>
          <div><span className="pf-small">{COPY.featuredWord} left</span><b>{s.usage?.featured?.left}</b></div>
          <div><span className="pf-small">{COPY.contactWord} left</span><b>{s.usage?.contacts?.unlimited ? 'Unlimited' : s.usage?.contacts?.left}</b></div>
        </div>
        {s.is_paid && (
          <div className="pf-actions">
            {s.cancel_at_period_end || s.scheduled_plan
              ? <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={() => planAction('resume')}>Keep my pass</button>
              : <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={() => setConfirm({ title: 'End your pass on its date?', label: 'Yes, end it', body: `You keep ${curPlan.name} until ${phDate(s.expires_at)}, then move to the free ${COPY.freeName} plan. Nothing more is charged. You can undo this before then.`, run: () => planAction('cancel') })}>Cancel pass</button>}
          </div>
        )}
      </section>

      <section>
        <div className="pf-between" style={{ marginBottom: 12 }}>
          <h2 className="pf-h">Compare passes</h2>
          <div className="mc-chips" role="group" aria-label="Billing period">
            {[['monthly', '1 month'], ['quarterly', '3 months (save about 20%)']].map(([id, l]) => <button key={id} type="button" aria-pressed={cycle === id} onClick={() => setCycle(id)}>{l}</button>)}
          </div>
        </div>
        <div className="pf-plans">
          {plans.map(p => {
            const btn = buttonFor(p)
            return (
              <article key={p.id} className={`pf-plan${p.popular ? ' popular' : ''}${p.id === curPlan.id ? ' current' : ''}`}>
                {p.popular && <span className="pf-ribbon">{p.badge}</span>}
                <h3>{p.name}</h3>
                <p className="pf-small" style={{ margin: 0 }}>{p.tagline}</p>
                <div className="pf-amount">{Number(price(p)) ? peso(price(p), { cents: false }) : 'Free'}{Number(price(p)) ? <small> / {cycle === 'quarterly' ? '3 months' : 'month'}</small> : null}</div>
                <ul>{p.features.map(f => <li key={f}><IconCheck size={14} /> {f}</li>)}</ul>
                <button type="button" className={`btn ${p.popular ? 'btn-primary' : 'btn-navy'}`} disabled={btn.disabled || busy || (!s.online_ready && Number(price(p)) > 0 && btn.kind !== 'downgrade')}
                  onClick={() => setChoose({ plan: p, btn })}>{btn.label}</button>
                {!s.online_ready && Number(price(p)) > 0 && btn.kind !== 'downgrade' && <p className="pf-small" style={{ margin: 0 }}>Online payment isn’t available right now. Please try again later.</p>}
              </article>
            )
          })}
        </div>
      </section>

      <div className="pf-grid2">
        <section className="panel">
          <h2 className="pf-h"><IconCard size={16} /> Billing history</h2>
          {!hist ? <BrandLoader compact label="Loading payments…" /> : (hist.payments || []).length === 0 ? <p className="pf-muted">No payments yet. Your receipts will appear here.</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="pf-table">
                <thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Status</th><th></th></tr></thead>
                <tbody>{hist.payments.map(p => (
                  <tr key={p.id}>
                    <td>{phDate(p.paid_at || p.created_at)}<div className="pf-small">{p.reference}</div></td>
                    <td>{p.plan_name}<div className="pf-small">{p.method_label || ''}{p.is_test ? <> <span className="pf-test">Test</span></> : null}</div></td>
                    <td>{peso(p.amount)}</td>
                    <td><span className={`chip ${PAY_TONE[p.status] || ''}`}>{p.status_text}</span>
                      {p.status === 'failed' && <div className="pf-small" style={{ maxWidth: 200 }}>Your pass was not changed.{p.failure_reason ? ` ${p.failure_reason}` : ''}</div>}
                      {p.refund_status && <div className="pf-small">Refund: {p.refund_status === 'succeeded' ? `done (${peso(p.refunded_amount)})` : p.refund_status === 'pending' ? 'being processed' : 'not completed'}</div>}</td>
                    <td><div className="pf-row" style={{ flexWrap: 'nowrap' }}>
                      {['paid', 'refunded'].includes(p.status) && <button type="button" className="btn btn-light btn-sm" onClick={() => openReceipt(p)}><IconPrinter size={13} /> Receipt</button>}
                      {p.can_retry && <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={() => payAction(p, 'retry')}>{p.can_continue ? 'Continue' : 'Try again'}</button>}
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
        <section className="panel">
          <h2 className="pf-h"><IconClock size={16} /> Pass timeline</h2>
          {(hist?.timeline || []).length === 0 ? <p className="pf-muted">Every pass change will be listed here, with what was unlocked or locked.</p> : (
            <ol className="pf-timeline">{hist.timeline.map((t, i) => {
              const [label, tone] = EVENT[t.event] || [t.event, '']
              return (
                <li key={i} className={tone}>
                  <b>{label}{t.to_name && !['payment_failed', 'payment_pending'].includes(t.event) ? `: ${t.to_name}` : t.to_name ? ` (${t.to_name})` : ''}</b>
                  <small>{phDateTime(t.created_at)}{t.from_name && t.to_name && t.from_name !== t.to_name ? ` · from ${t.from_name}` : ''}</small>
                  {t.note && <p>{t.note}</p>}
                  {(t.unlocked.length > 0 || t.locked.length > 0) && <div className="pf-tags">
                    {t.unlocked.map(f => <span key={'u' + f} className="chip green">+ {f}</span>)}{t.locked.map(f => <span key={'l' + f} className="chip red">− {f}</span>)}</div>}
                </li>
              )
            })}</ol>
          )}
        </section>
      </div>

      <section className="panel pf-faq">
        <h2 className="pf-h">Questions about the pass</h2>
        {COPY.faqs.map(([q, a]) => <details key={q}><summary>{q}</summary><div>{a}</div></details>)}
        <p className="pf-small"><IconAlert size={12} /> Payments are processed by PayMongo. We never see or store your card number or e-wallet PIN. <a href="/terms#payments">Payment terms <IconArrow size={11} /></a></p>
      </section>
    </div>
  )
}
