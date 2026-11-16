import { useCallback, useEffect, useState } from 'react'
import { IconEye, IconCheck, IconX, IconShield } from './icons.jsx'
import BrandLoader from './BrandLoader.jsx'

// Admin: approve or reject the skill certificates workers upload.
// Approving marks the linked skill "Verified" (it counts more in job matches and
// employers see the badge); rejecting needs a reason, which the worker is shown.
// API: GET /api/admin/certificates?status=…, PATCH /api/admin/certificates/:id

const TABS = [['pending', 'To check'], ['verified', 'Verified'], ['rejected', 'Rejected'], ['all', 'All']]

export default function CertificateReview({ call }) {
  const [tab, setTab] = useState('pending')
  const [rows, setRows] = useState(null)
  const [counts, setCounts] = useState({ pending: 0, verified: 0, rejected: 0 })
  const [busy, setBusy] = useState(null)
  const [rejecting, setRejecting] = useState(null) // { id, note }
  const [msg, setMsg] = useState(null)

  const load = useCallback(() => {
    call(`/admin/certificates?status=${tab}`)
      .then(r => { setRows(r.certificates || []); setCounts(r.counts || {}) })
      .catch(e => { setRows([]); setMsg({ ok: false, text: e?.message || 'Could not load certificates.' }) })
  }, [call, tab])
  useEffect(() => { setRows(null); load() }, [load])

  async function view(c) {
    const win = window.open('', '_blank')
    try {
      const r = await call(`/skills/certificates/${c.id}/file`)
      const url = URL.createObjectURL(await (await fetch(r.data_url)).blob())
      if (win) win.location.href = url; else window.location.href = url
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (e) {
      win?.close()
      setMsg({ ok: false, text: e?.message || 'Could not open the file.' })
    }
  }

  async function review(c, status, note = '') {
    setBusy(c.id); setMsg(null)
    try {
      await call(`/admin/certificates/${c.id}`, { method: 'PATCH', body: { status, note } })
      setMsg({ ok: true, text: status === 'verified' ? `Verified "${c.title}" for ${c.full_name}. They were notified.` : `Rejected "${c.title}". ${c.full_name} was told why.` })
      setRejecting(null)
      load()
    } catch (e) {
      setMsg({ ok: false, text: e?.message || 'Could not save the review.' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="panel cr" style={{ marginBottom: 20 }} aria-labelledby="cr-title">
      <div className="panel-hd" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 id="cr-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconShield size={18} /> Skill certificates</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Open the file, compare the name and certificate number, then approve or reject. Approved skills show as Verified to employers.</p>
        </div>
      </div>
      <div className="cr-tabs" role="group" aria-label="Certificate status">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}{id !== 'all' ? ` (${counts[id] || 0})` : ''}
          </button>
        ))}
      </div>

      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`cr-msg ${msg.ok ? 'ok' : ''}`}>{msg.text}</p>}

      {rows === null ? <BrandLoader compact label="Loading certificates…" />
        : rows.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 14, padding: '12px 0' }}>{tab === 'pending' ? 'No certificates waiting. All caught up.' : 'Nothing here yet.'}</p>
        : (
          <ul className="cr-list">
            {rows.map(c => {
              const nameMismatch = c.holder_name && c.full_name && !c.holder_name.toLowerCase().split(/\s+/).some(w => w.length > 2 && c.full_name.toLowerCase().includes(w))
              return (
                <li key={c.id}>
                  <div className="cr-main">
                    <b>{c.title}</b>
                    <span>{[c.issuer, c.nc_level && `NC ${c.nc_level}`, c.cert_number && `No. ${c.cert_number}`, c.valid_until && `Valid until ${c.valid_until}`].filter(Boolean).join(' · ') || 'No details read from the certificate'}</span>
                    <span>Worker: <strong>{c.full_name}</strong>{c.location ? ` · ${c.location}` : ''} · uploaded {new Date(c.created_at.replace(' ', 'T')).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
                    {c.holder_name && <span className={nameMismatch ? 'cr-warn' : ''}>Name on certificate: {c.holder_name}{nameMismatch ? ' (does not match the account name)' : ''}</span>}
                    {c.status === 'rejected' && c.review_note && <span className="cr-warn">Reason given: {c.review_note}</span>}
                  </div>
                  <div className="cr-actions">
                    <button type="button" className="btn btn-light btn-sm" onClick={() => view(c)}><IconEye size={14} /> View file</button>
                    {c.status !== 'verified' && (
                      <button type="button" className="btn btn-sm cr-approve" disabled={busy === c.id} onClick={() => review(c, 'verified')}>
                        {busy === c.id ? <span className="spin" /> : <><IconCheck size={14} /> Approve</>}
                      </button>
                    )}
                    {c.status !== 'rejected' && rejecting?.id !== c.id && (
                      <button type="button" className="btn btn-light btn-sm" style={{ color: 'var(--red)' }} onClick={() => setRejecting({ id: c.id, note: '' })}><IconX size={14} /> Reject</button>
                    )}
                  </div>
                  {rejecting?.id === c.id && (
                    <form className="cr-reject" onSubmit={e => { e.preventDefault(); review(c, 'rejected', rejecting.note) }}>
                      <label>
                        <span>Reason the worker will see</span>
                        <input value={rejecting.note} onChange={e => setRejecting({ id: c.id, note: e.target.value })} maxLength={500}
                          placeholder="e.g. The photo is blurry; the certificate number can't be read" autoFocus />
                      </label>
                      <button type="submit" className="btn btn-sm" style={{ background: 'var(--red)', color: '#fff' }} disabled={busy === c.id || rejecting.note.trim().length < 5}>Reject</button>
                      <button type="button" className="btn btn-light btn-sm" onClick={() => setRejecting(null)}>Cancel</button>
                    </form>
                  )}
                </li>
              )
            })}
          </ul>
        )}
    </section>
  )
}
