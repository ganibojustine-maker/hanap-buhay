/**
 * BusinessVerification — the employer's / client's side of the Verified business badge.
 * Upload one government registration (DTI, SEC, CDA, Mayor's permit or BIR 2303); an admin
 * checks it (components/BusinessReview.jsx) and approving it turns on the badge that workers
 * see on every job post. Shown on the Business / Client Profile page.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { IconShield, IconCheck, IconAlert, IconClock, IconFile, IconEye } from './icons.jsx'
import Dialog from './Dialog.jsx'
import BrandLoader from './BrandLoader.jsx'

const MAX = 5 * 1024 * 1024

export default function BusinessVerification({ call, user, updateUser }) {
  const [data, setData] = useState(null)
  const [form, setForm] = useState({ doc_type: 'dti', business_name: '', registration_no: '' })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState(null)
  const input = useRef(null)

  const load = useCallback(() => {
    call('/business/verification').then(r => {
      setData(r)
      if (r.document) setForm({ doc_type: r.document.doc_type, business_name: r.document.business_name || '', registration_no: r.document.registration_no || '' })
      else setForm(f => ({ ...f, business_name: user?.company || user?.full_name || '' }))
      if (r.is_verified !== !!user?.is_verified) updateUser?.({ is_verified: r.is_verified ? 1 : 0 })
    }).catch(() => setData({ enabled: false }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call])
  useEffect(() => { load() }, [load])

  const close = () => setDialog(null)
  function pick(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const ok = f.type === 'application/pdf' || /\.pdf$/i.test(f.name) || f.type.startsWith('image/')
    if (!ok) { setDialog({ tone: 'error', title: 'This file type is not accepted', body: <p>Upload a photo (JPG, PNG, WEBP) or a PDF of the document.</p>, actions: [{ label: 'OK', primary: true, onClick: close }] }); return }
    if (f.size > MAX) { setDialog({ tone: 'error', title: 'The file is too large', body: <p>The limit is 5 MB. Take a photo instead of a full-resolution scan.</p>, actions: [{ label: 'OK', primary: true, onClick: close }] }); return }
    setFile(f)
  }

  async function submit(e) {
    e.preventDefault()
    if (!file) return
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      await call('/business/verification', { method: 'POST', body: fd })
      setFile(null); setOpen(false); load()
      setDialog({ tone: 'success', title: 'Sent for checking', body: <p>hanapbuhay checks business documents within 1–2 working days. You will get a notification, and the Verified business badge appears on all your posts once approved.</p>,
        actions: [{ label: 'Done', primary: true, onClick: close }] })
    } catch (err) {
      setDialog({ tone: 'error', title: 'Not sent', body: <p>{err?.message || 'Please try again.'}</p>, actions: [{ label: 'OK', primary: true, onClick: close }] })
    } finally { setBusy(false) }
  }

  async function view() {
    const win = window.open('', '_blank')
    try {
      const r = await call(`/business/verification/${user.id}/file`)
      const blob = await (await fetch(r.data_url)).blob()
      const url = URL.createObjectURL(blob)
      if (win) win.location.href = url; else window.location.href = url
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch { win?.close() }
  }

  if (!data) return <section className="panel"><BrandLoader compact label="Loading verification…" /></section>
  if (data.enabled === false) return null

  const doc = data.document
  const status = data.is_verified ? 'verified' : doc?.status || 'none'
  const types = data.doc_types || {}
  const showForm = open || status === 'none' || status === 'rejected'

  return (
    <section className={`panel bv ${status}`}>
      {dialog && <Dialog tone={dialog.tone} title={dialog.title} actions={dialog.actions} onClose={close} busy={busy}>{dialog.body}</Dialog>}
      <div className="bv-hd">
        <span className="bv-ic">{status === 'verified' ? <IconCheck size={20} /> : status === 'pending' ? <IconClock size={20} /> : status === 'rejected' ? <IconAlert size={20} /> : <IconShield size={20} />}</span>
        <div>
          <h2>{status === 'verified' ? 'Verified business' : status === 'pending' ? 'Verification in progress' : status === 'rejected' ? 'Document not accepted' : 'Get the Verified business badge'}</h2>
          <p>{status === 'verified' ? 'Workers see the badge on every post you make. It tells them your business is real and registered.'
            : status === 'pending' ? `We are checking your ${doc?.doc_label || 'document'}. This usually takes 1–2 working days.`
            : status === 'rejected' ? (doc?.review_note || 'Please upload a clearer or correct document.')
            : 'Verified employers get more applicants: workers trust a post with the badge. Upload one registration document.'}</p>
        </div>
      </div>

      {doc && !showForm && (
        <div className="bv-doc">
          <IconFile size={16} />
          <span><b>{doc.doc_label}</b>{doc.business_name ? ` · ${doc.business_name}` : ''}{doc.registration_no ? ` · No. ${doc.registration_no}` : ''}</span>
          <button type="button" className="btn btn-light btn-sm" onClick={view}><IconEye size={14} /> View</button>
          {status !== 'verified' && <button type="button" className="btn btn-light btn-sm" onClick={() => setOpen(true)}>Replace</button>}
        </div>
      )}

      {showForm && status !== 'verified' && (
        <form className="bv-form" onSubmit={submit}>
          <div className="bv-grid">
            <label className="field"><span>Document</span>
              <div className="in no-icon">
                <select value={form.doc_type} onChange={e => setForm(f => ({ ...f, doc_type: e.target.value }))}>
                  {Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </label>
            <label className="field"><span>Business name (as printed) *</span>
              <div className="in no-icon"><input required minLength={2} maxLength={255} value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))} /></div>
            </label>
            <label className="field"><span>Registration / permit no. <em>optional</em></span>
              <div className="in no-icon"><input maxLength={80} value={form.registration_no} onChange={e => setForm(f => ({ ...f, registration_no: e.target.value }))} /></div>
            </label>
          </div>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display: 'none' }} onChange={pick} />
          <div className="bv-actions">
            <button type="button" className="btn btn-light" onClick={() => input.current?.click()}><IconFile size={15} /> {file ? file.name : 'Choose photo or PDF'}</button>
            <button type="submit" className="btn btn-primary" disabled={!file || busy}>{busy ? <span className="spin" /> : 'Send for verification'}</button>
          </div>
          <p className="bv-note">Only hanapbuhay admins see this document. It is never shown to workers.</p>
        </form>
      )}
    </section>
  )
}
