/**
 * Verification, one page per role (backend VerificationController, docs/VERIFICATION.md).
 *
 * Hybrid: the system checks email, phone (a texted code), profile completeness, the file,
 * duplicate ID numbers and the name on the ID; an admin then looks at the document itself.
 *   Worker and client: valid government ID.   Employer: business permit or registration.
 * Status: Unverified → Pending → Verified, or Rejected (with reason) / Resubmission requested.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BrandLoader from '../../components/BrandLoader.jsx'
import BusinessVerification from '../../components/BusinessVerification.jsx'
import { IconCheck, IconBadge, IconPhone, IconShield } from '../../components/icons.jsx'
import { phDateTime, phPhone } from '../../utils/format.js'
import '../../styles/platform.css'

export const VERIFY_STATUS = {
  unverified: { label: 'Not verified', tone: '', text: 'Finish the steps below to get the Verified badge.' },
  pending:    { label: 'Pending review', tone: 'gold', text: 'We have your document. Our team checks it within 1 to 2 working days.' },
  verified:   { label: 'Verified', tone: 'green', text: 'Your account is verified. The badge shows on your profile.' },
  rejected:   { label: 'Not approved', tone: 'red', text: 'We could not accept your document. See the reason below and send another one.' },
  resubmit:   { label: 'Send again', tone: 'gold', text: 'Our team asked for a new photo of your document. See the reason below.' },
}
const ACTION_TEXT = {
  submitted: 'Document sent', approved: 'Approved', rejected: 'Not approved', resubmission_requested: 'Asked to send again',
  revoked: 'Verified badge removed', phone_confirmed: 'Mobile number confirmed',
}

function PhoneStep({ call, phone, onDone }) {
  const [num, setNum] = useState(phone || '')
  const [sent, setSent] = useState(null)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  async function send() {
    setBusy(true); setMsg(null)
    try { const r = await call('/verification/phone/send', { method: 'POST', body: { phone: num } }); setSent(r); setMsg({ text: r.message }) }
    catch (e) { setMsg({ bad: true, text: e.message }) } finally { setBusy(false) }
  }
  async function confirm() {
    setBusy(true); setMsg(null)
    try { await call('/verification/phone/confirm', { method: 'POST', body: { code } }); onDone() }
    catch (e) { setMsg({ bad: true, text: e.message }) } finally { setBusy(false) }
  }
  return (
    <div style={{ marginTop: 10 }}>
      {msg && <div className={`pf-note ${msg.bad ? 'bad' : 'info'}`} role="status" style={{ marginBottom: 10 }}>{msg.text}{sent?.test_code && <> Code: <b>{sent.test_code}</b></>}</div>}
      {!sent ? (
        <div className="pf-row">
          <div className="in no-icon" style={{ maxWidth: 220 }}><input inputMode="tel" value={num} onChange={e => setNum(e.target.value)} placeholder="0917 123 4567" aria-label="Mobile number" /></div>
          <button type="button" className="btn btn-navy btn-sm" disabled={busy} onClick={send}><IconPhone size={13} /> Text me a code</button>
        </div>
      ) : (
        <div className="pf-row">
          <div className="in no-icon"><input className="pf-otp" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="______" aria-label="6-digit code" /></div>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || code.length !== 6} onClick={confirm}>Confirm</button>
          <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={() => { setSent(null); setCode('') }}>Use another number</button>
        </div>
      )}
    </div>
  )
}

function IdStep({ call, idTypes, user, onDone }) {
  const [type, setType] = useState('')
  const [num, setNum] = useState('')
  const [name, setName] = useState(user.full_name || '')
  const [file, setFile] = useState(null)
  const [selfie, setSelfie] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  async function send(e) {
    e.preventDefault(); setMsg(null)
    if (!file) { setMsg({ bad: true, text: 'Attach a clear photo of the front of your ID.' }); return }
    const fd = new FormData()
    fd.append('id_type', type); fd.append('id_number', num); fd.append('name_on_id', name); fd.append('file', file)
    if (selfie) fd.append('selfie', selfie)
    setBusy(true)
    try { await call('/verification/id', { method: 'POST', body: fd }); onDone() }
    catch (e2) { setMsg({ bad: true, text: e2.message || 'We couldn’t send your ID. Please try again.' }) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={send} style={{ marginTop: 10 }}>
      {msg && <div className="pf-note bad" role="alert" style={{ marginBottom: 10 }}>{msg.text}</div>}
      <div className="pf-grid2">
        <label className="field"><span>Kind of ID *</span><div className="in no-icon"><select required value={type} onChange={e => setType(e.target.value)}>
          <option value="">Choose your ID</option>{Object.entries(idTypes || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div></label>
        <label className="field"><span>ID number *</span><div className="in no-icon"><input required minLength={4} maxLength={60} value={num} onChange={e => setNum(e.target.value)} placeholder="As printed on the ID" /></div></label>
      </div>
      <label className="field"><span>Your name as printed on the ID *</span><div className="in no-icon"><input required minLength={4} value={name} onChange={e => setName(e.target.value)} /></div></label>
      <div className="pf-grid2">
        <label className="field"><span>Photo of the front of the ID *</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
        <label className="field"><span>Selfie holding the ID <em>optional, makes checking faster</em></span><input type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={e => setSelfie(e.target.files?.[0] || null)} /></label>
      </div>
      <p className="pf-small">Your ID is only seen by our verification team and is kept as the Privacy Policy explains. You can cover the ID number’s middle digits except the last four.</p>
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send for checking'}</button>
    </form>
  )
}

function VerificationPage({ call, user, updateUser, role }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  const load = useCallback(() => {
    call('/verification').then(r => { setData(r); if (updateUser && r.status !== user.verification_status) updateUser({ verification_status: r.status, is_verified: r.status === 'verified' ? 1 : 0 }) })
      .catch(e => { setError(e.message || 'We couldn’t load your verification. Please try again.'); setData({}) })
  }, [call]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])
  if (!data) return <div className="page-inner"><BrandLoader compact label="Loading your verification…" /></div>
  if (error) return <div className="page-inner"><div className="pf-note bad">{error}</div></div>
  const st = VERIFY_STATUS[data.status] || VERIFY_STATUS.unverified
  const items = data.checklist || []
  const phoneDone = items.find(i => i.key === 'phone')?.done
  const emailDone = items.find(i => i.key === 'email')?.done
  const docOpen = ['unverified', 'rejected', 'resubmit'].includes(data.status)

  return (
    <div className="page-inner">
      {flash && <div className="pf-note ok" role="status" style={{ marginBottom: 14 }}>{flash}</div>}
      <div className="pf-side">
        <div className="pf-stack">
          <section className="panel">
            <div className="pf-between"><h2 className="pf-h">Your status</h2><span className={`chip ${st.tone}`} style={{ fontSize: 13 }}><IconBadge size={13} /> {st.label}</span></div>
            <p className="pf-muted" style={{ margin: '6px 0 0' }}>{st.text}</p>
            {data.request?.reason && ['rejected', 'resubmit'].includes(data.status) && <div className="pf-note warn" style={{ marginTop: 10 }}><b>Reason from our team:</b> {data.request.reason}</div>}
          </section>
          <section className="panel">
            <h2 className="pf-h">Steps</h2>
            <ul className="pf-check">
              {items.map(i => (
                <li key={i.key} className={i.done ? 'done' : ''}>
                  <span className="dot">{i.done ? <IconCheck size={13} /> : null}</span>
                  <div style={{ flex: 1 }}>
                    <b>{i.label}</b><small>{i.done ? (i.key === 'phone' && data.phone ? `Confirmed: ${phPhone(data.phone)}` : 'Done') : i.help}</small>
                    {!i.done && i.key === 'phone' && <PhoneStep call={call} phone={data.phone} onDone={() => { setFlash('Your mobile number is confirmed.'); load() }} />}
                    {!i.done && i.key === 'email' && <p className="pf-small" style={{ margin: '4px 0 0' }}>Can’t find the email? Open Settings to send it again.</p>}
                    {!i.done && i.key === 'profile' && <Link to={role === 'worker' && /skill/i.test(i.help) ? '/dashboard/passport' : '/dashboard/profile'} className="btn btn-light btn-sm" style={{ marginTop: 6 }}>Complete it</Link>}
                    {i.key === 'document' && !i.done && role !== 'employer' && docOpen && (emailDone && phoneDone
                      ? <IdStep call={call} idTypes={data.id_types} user={user} onDone={() => { setFlash('Thanks! We’ll check your ID within 1 to 2 working days.'); load() }} />
                      : <p className="pf-small" style={{ margin: '4px 0 0' }}>Confirm your email and mobile number first.</p>)}
                    {i.key === 'document' && data.status === 'pending' && data.request && <p className="pf-small" style={{ margin: '4px 0 0' }}>Sent {phDateTime(data.request.created_at)}: {data.request.id_label} ending in {data.request.id_number?.slice(-4)}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
          {role === 'employer' && (
            <section className="panel">
              <h2 className="pf-h">Business document</h2>
              <p className="pf-sub">DTI, SEC, CDA, Mayor’s permit or BIR 2303. Our team checks the name and number against the document.</p>
              <BusinessVerification call={call} user={user} updateUser={updateUser} />
            </section>
          )}
        </div>
        <aside className="pf-stack">
          <section className="panel">
            <h2 className="pf-h"><IconShield size={16} /> What you get</h2>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, fontSize: 14 }}>{(data.unlocks || []).map(u => <li key={u}>{u}</li>)}</ul>
          </section>
          <section className="panel">
            <h2 className="pf-h">History</h2>
            {(data.history || []).length === 0 ? <p className="pf-muted">Nothing yet.</p> : (
              <ol className="pf-timeline">{data.history.map((h, i) => (
                <li key={i} className={h.action === 'approved' || h.action === 'phone_confirmed' ? 'good' : ['rejected', 'revoked'].includes(h.action) ? 'bad' : h.action === 'resubmission_requested' ? 'warn' : ''}>
                  <b>{ACTION_TEXT[h.action] || h.action}</b><small>{phDateTime(h.created_at)}</small>{h.reason && <p>{h.reason}</p>}</li>
              ))}</ol>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

export const WorkerVerification = props => <VerificationPage {...props} role="worker" />
export const ClientVerification = props => <VerificationPage {...props} role="hirer" />
export const EmployerVerification = props => <VerificationPage {...props} role="employer" />
