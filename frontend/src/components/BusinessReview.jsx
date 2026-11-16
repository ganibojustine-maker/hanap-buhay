/**
 * BusinessReview — the admin's queue of business registration documents
 * (BusinessController). Approve turns on the Verified business badge; reject needs a
 * reason, which the business sees so it can upload the right document.
 */
import { useCallback, useEffect, useState } from 'react'
import { IconBuilding, IconEye, IconCheck, IconX } from './icons.jsx'
import BrandLoader from './BrandLoader.jsx'
import Dialog from './Dialog.jsx'

const TABS = [['pending', 'Waiting'], ['verified', 'Verified'], ['rejected', 'Not accepted']]

export default function BusinessReview({ call }) {
  const [tab, setTab] = useState('pending')
  const [data, setData] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const load = useCallback(() => {
    setData(null)
    call(`/admin/business-docs?status=${tab}`).then(setData).catch(() => setData({ enabled: false, documents: [] }))
  }, [call, tab])
  useEffect(() => { load() }, [load])

  async function view(d) {
    const win = window.open('', '_blank')
    try {
      const r = await call(`/business/verification/${d.user_id}/file`)
      const blob = await (await fetch(r.data_url)).blob()
      const url = URL.createObjectURL(blob)
      if (win) win.location.href = url; else window.location.href = url
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch { win?.close() }
  }

  async function decide(d, action, why) {
    setBusy(true)
    try {
      await call(`/admin/business-docs/${d.user_id}`, { method: 'PATCH', body: { action, note: why } })
      setDialog(null); setNote(''); load()
    } catch (e) {
      setDialog({ tone: 'error', title: 'Not saved', body: <p>{e?.message || 'Please try again.'}</p>, actions: [{ label: 'OK', primary: true, onClick: () => setDialog(null) }] })
    } finally { setBusy(false) }
  }

  if (data && data.enabled === false) return null
  const counts = data?.counts || {}

  return (
    <section className="panel br">
      {dialog && <Dialog tone={dialog.tone} title={dialog.title} actions={dialog.actions} onClose={() => { setDialog(null); setNote('') }} busy={busy}>{dialog.body}</Dialog>}
      <div className="panel-hd">
        <div>
          <h2><IconBuilding size={17} /> Business verification</h2>
          <p className="br-sub">Check the name and number on the document against the account. Approving shows the Verified business badge on all their posts.</p>
        </div>
      </div>
      <div className="mc-chips" role="group" aria-label="Status">
        {TABS.map(([id, label]) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{label} <span>{counts[id] || 0}</span></button>)}
      </div>
      {!data ? <BrandLoader compact label="Loading documents…" />
        : data.documents.length === 0 ? <p className="br-empty">Nothing here.</p>
        : (
          <ul className="br-list">
            {data.documents.map(d => (
              <li key={d.user_id}>
                <div className="br-main">
                  <b>{d.business_name}</b>
                  <small>{d.doc_label}{d.registration_no ? ` · No. ${d.registration_no}` : ''}</small>
                  <small>Account: {d.full_name} · {d.email} · {d.account_type === 'hirer' ? 'Client' : 'Employer'}{d.location ? ` · ${d.location}` : ''}</small>
                  {d.review_note && <small className="br-note">Note: {d.review_note}</small>}
                </div>
                <div className="br-actions">
                  <button type="button" className="btn btn-light btn-sm" onClick={() => view(d)}><IconEye size={14} /> View</button>
                  {d.status !== 'verified' && (
                    <button type="button" className="btn btn-sm" style={{ background: 'var(--green)', color: '#fff' }} disabled={busy}
                      onClick={() => setDialog({ tone: 'success', title: `Verify ${d.business_name}?`, body: <p>The Verified business badge appears on all of {d.full_name}’s posts, and they are notified.</p>,
                        actions: [{ label: 'Verify', primary: true, onClick: () => decide(d, 'approve', null) }, { label: 'Cancel', onClick: () => setDialog(null) }] })}>
                      <IconCheck size={14} /> Verify
                    </button>
                  )}
                  {d.status !== 'rejected' && (
                    <button type="button" className="btn btn-light btn-sm" style={{ color: 'var(--red)' }} disabled={busy}
                      onClick={() => setDialog({ tone: 'danger', title: 'Not accept this document?', body: (
                        <>
                          <p>Tell {d.full_name} what is wrong, so they can upload the right one.</p>
                          <textarea className="br-reason" rows={3} maxLength={500} defaultValue="" onChange={e => setNote(e.target.value)}
                            placeholder="e.g. The name on the permit does not match the business name." />
                        </>
                      ), actions: [{ label: 'Not accept', primary: true, onClick: () => decide(d, 'reject', document.querySelector('.br-reason')?.value || note) }, { label: 'Cancel', onClick: () => setDialog(null) }] })}>
                      <IconX size={14} /> {d.status === 'verified' ? 'Remove badge' : 'Not accept'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
    </section>
  )
}
