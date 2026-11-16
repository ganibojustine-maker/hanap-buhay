/**
 * Verification, one page per role (backend VerificationController, docs/VERIFICATION.md).
 * Each role reads its own title, reason, document and tips (ROLE_PAGE below); the steps come
 * from the server and differ per role too.
 *
 * Hybrid: the system checks email, phone number, profile completeness, the file,
 * duplicate ID numbers and the name on the ID; an admin then looks at the document itself.
 *   Worker and client: valid government ID.   Employer: business permit or registration.
 * Status: Unverified → Pending → Verified, or Rejected (with reason) / Resubmission requested.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SkeletonCards } from '../../components/Skeleton.jsx'
import BusinessVerification from '../../components/BusinessVerification.jsx'
import { IconCheck, IconBadge, IconShield } from '../../components/icons.jsx'
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

/* What each role reads on its own verification page. The steps themselves come from the
   server (VerificationController::status), which also differs per role. */
const ID_TIPS = ['Use a valid government ID (PhilSys, driver’s license, UMID, passport).', 'Good light, all four corners visible.', 'The name must match your profile.']
const ROLE_PAGE = {
  worker: {
    title: 'Verify your account',
    intro: 'Employers and clients hire verified workers first.',
    verifiedText: 'The Verified badge shows on your applications and Skills Passport.',
    docTitle: 'Send a government ID',
    docHelp: 'Checked within 1 to 2 working days.',
    tips: ID_TIPS,
    privacy: 'Only our team sees your ID.',
  },
  hirer: {
    title: 'Verify your account',
    intro: 'Workers trust verified clients, and your gigs go live right away.',
    verifiedText: 'The Verified badge shows on your gigs and messages.',
    docTitle: 'Send a government ID',
    docHelp: 'Checked within 1 to 2 working days.',
    tips: ID_TIPS,
    privacy: 'Only our team sees your ID.',
  },
  employer: {
    title: 'Verify your business',
    intro: 'Verified businesses post jobs that go live right away.',
    verifiedText: 'The Verified business badge shows on your job posts.',
    docTitle: 'Upload your business document',
    docHelp: 'DTI, SEC, CDA, Mayor’s permit or BIR 2303. Checked within 1 to 2 working days.',
    tips: ['The business name must match your profile.', 'A PDF or clear photo, up to 5 MB.', 'The permit must not be expired.'],
    privacy: 'Only our team sees your documents.',
  },
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
  if (!data) return <div className="page-inner"><SkeletonCards count={3} kind="row" label="Loading your verification" /></div>
  if (error) return <div className="page-inner"><div className="pf-note bad">{error}</div></div>

  const page = ROLE_PAGE[role] || ROLE_PAGE.worker
  const st = VERIFY_STATUS[data.status] || VERIFY_STATUS.unverified
  const items = data.checklist || []
  const doneCount = items.filter(i => i.done).length
  const phoneDone = items.find(i => i.key === 'phone')?.done
  const emailDone = items.find(i => i.key === 'email')?.done
  const docOpen = ['unverified', 'rejected', 'resubmit'].includes(data.status)
  const current = items.find(i => !i.done)?.key   // the step to do next is the one that opens

  return (
    <div className="page-inner">
      {flash && <div className="pf-note ok" role="status" style={{ marginBottom: 14 }}>{flash}</div>}
      <section className={`vf-hero ${st.tone || 'none'}`}>
        <span className="vf-hero-ic" aria-hidden="true"><IconBadge size={26} /></span>
        <div style={{ minWidth: 0 }}>
          <h2>{{ verified: 'Your account is verified', pending: 'We’re checking your document', rejected: 'Your document was not approved', resubmit: 'Please send your document again' }[data.status] || page.title}</h2>
          <p>{data.status === 'verified' ? page.verifiedText : data.status === 'unverified' || !data.status ? page.intro : st.text}</p>
        </div>
        <span className={`chip ${st.tone}`} style={{ fontSize: 13 }}>{st.label}</span>
      </section>
      {data.request?.reason && ['rejected', 'resubmit'].includes(data.status) && (
        <div className="pf-note warn" style={{ marginBottom: 14 }}><b>Message from our team:</b> {data.request.reason}</div>
      )}

      <div className="pf-side">
        <div className="pf-stack">
          <section className="panel">
            <div className="pf-between" style={{ marginBottom: 12 }}>
              <h2 className="pf-h" style={{ margin: 0 }}>Steps</h2>
              <span className="pf-small"><b>{doneCount}</b> of {items.length} done</span>
            </div>
            <div className="vf-bar" aria-hidden="true"><i style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }} /></div>
            <ol className="vf-steps">
              {items.map((i, n) => {
                const isDoc = i.key === 'document'
                const label = isDoc ? page.docTitle : i.label
                return (
                  <li key={i.key} className={i.done ? 'done' : current === i.key ? 'now' : ''}>
                    <span className="vf-num" aria-hidden="true">{i.done ? <IconCheck size={14} /> : n + 1}</span>
                    <div className="vf-body">
                      <b>{label}</b>
                      <small>
                        {i.done ? (i.key === 'phone' && data.phone ? `Added: ${phPhone(data.phone)}` : 'Done')
                          : isDoc ? page.docHelp : i.help}
                      </small>
                      {!i.done && i.key === 'phone' && <Link to="/dashboard/profile" className="btn btn-light btn-sm" style={{ marginTop: 8 }}>Add my number</Link>}
                      {!i.done && i.key === 'email' && <p className="pf-small" style={{ margin: '6px 0 0' }}>Can’t find the email? Check your spam folder, or open <Link to="/dashboard/settings">Settings</Link> to send it again.</p>}
                      {!i.done && i.key === 'profile' && <Link to={role === 'worker' && /skill/i.test(i.help || '') ? '/dashboard/passport' : '/dashboard/profile'} className="btn btn-light btn-sm" style={{ marginTop: 8 }}>{role === 'employer' ? 'Complete business profile' : 'Complete my profile'}</Link>}
                      {isDoc && !i.done && docOpen && (
                        !(emailDone && phoneDone)
                          ? <p className="pf-small" style={{ margin: '6px 0 0' }}>Confirm your email and add your mobile number first.</p>
                          : role === 'employer'
                            ? <div style={{ marginTop: 10 }}><BusinessVerification call={call} user={user} updateUser={updateUser} /></div>
                            : <IdStep call={call} idTypes={data.id_types} user={user} onDone={() => { setFlash('Thanks! We’ll check your ID within 1 to 2 working days.'); load() }} />
                      )}
                      {isDoc && data.status === 'pending' && data.request && <p className="pf-small" style={{ margin: '6px 0 0' }}>Sent {phDateTime(data.request.created_at)}: {data.request.id_label} ending in {data.request.id_number?.slice(-4)}. We’re checking it.</p>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        </div>
        <aside className="pf-stack">
          <section className="panel">
            <h2 className="pf-h"><IconShield size={16} /> What you get</h2>
            <ul className="vf-list">{(data.unlocks || []).map(u => <li key={u}><IconCheck size={13} /> {u}</li>)}</ul>
          </section>
          {data.status !== 'verified' && <section className="panel">
            <h2 className="pf-h">Before you send</h2>
            <ul className="vf-tips">{page.tips.map(t => <li key={t}>{t}</li>)}</ul>
            <p className="pf-small" style={{ margin: '10px 0 0' }}><IconShield size={12} /> {page.privacy}</p>
          </section>}
          {(data.history || []).length > 0 && (
            <section className="panel">
              <h2 className="pf-h">History</h2>
              <ol className="pf-timeline">{data.history.map((h, i) => (
                <li key={i} className={h.action === 'approved' || h.action === 'phone_confirmed' ? 'good' : ['rejected', 'revoked'].includes(h.action) ? 'bad' : h.action === 'resubmission_requested' ? 'warn' : ''}>
                  <b>{ACTION_TEXT[h.action] || h.action}</b><small>{phDateTime(h.created_at)}</small>{h.reason && <p>{h.reason}</p>}</li>
              ))}</ol>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

export const WorkerVerification = props => <VerificationPage {...props} role="worker" />
export const ClientVerification = props => <VerificationPage {...props} role="hirer" />
export const EmployerVerification = props => <VerificationPage {...props} role="employer" />
