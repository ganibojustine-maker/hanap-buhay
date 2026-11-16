import { useCallback, useEffect, useRef, useState } from 'react'
import { IconFile, IconShield, IconCheck, IconTrash, IconEye, IconAlert, IconSpark, IconPlus } from './icons.jsx'
import Dialog from './Dialog.jsx'
import '../styles/resume.css'
import { tr } from '../lang/dash.js'

// Skills certificate upload for the worker's Skills Passport.
// Photo → shrink → OCR in the browser (tesseract.js, loaded only when needed);
// PDF → text is read on the server. The server finds the TESDA qualification,
// NC level and certificate number, the form is filled, and the worker confirms.
//
// Before any of that the server checks the file IS a certificate (Certificate_parser::assess):
// a resume, an ID, a receipt or an unreadable photo is turned away with a pop-up that says
// what it looked like and what to upload instead. The same check runs again when saving,
// and a certificate number already on file (yours or someone else's) is refused.

/* what the uploaded file looked like, when it was not a certificate */
const KIND_TEXT = {
  resume: 'It looks like a resume. Your resume goes in Skills Passport → Resume.',
  id: 'It looks like an ID card. IDs are not needed here.',
  receipt: 'It looks like a receipt or invoice.',
  payslip: 'It looks like a payslip.',
  school_record: 'It looks like a school record (transcript or report card), not a skills certificate.',
  clearance: 'It looks like a clearance (barangay, police or NBI), not a skills certificate.',
}
const STATUS = {
  verified: ['green', 'Verified'],
  rejected: ['red', 'Not accepted'],
  pending: ['gold', 'Waiting for review'],
}

const NC_LEVEL = { I: 'beginner', II: 'intermediate', III: 'advanced', IV: 'expert' }
const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert']
const SOURCES = [['tesda', 'TESDA'], ['training', 'Training / Seminar'], ['employer', 'Employer'], ['other', 'Other']]
const MAX_BYTES = 3 * 1024 * 1024

const EMPTY = { title: '', nc_level: '', level: '', source: 'tesda', cert_number: '', issuer: '', issued_on: '', valid_until: '', category: '', holder_name: '' }

/** Re-encode a photo as JPEG (max 1800px): smaller upload, and enough detail for OCR. */
async function shrinkImage(file, maxSide = 1800) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image()
      im.onload = () => resolve(im)
      im.onerror = () => reject(new Error('This image could not be opened. Try a JPG or PNG photo.'))
      im.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * scale)
    c.height = Math.round(img.naturalHeight * scale)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0, c.width, c.height)
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85))
    if (!blob) throw new Error('This image could not be processed.')
    return new File([blob], (file.name || 'certificate').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function ocrImage(file, onProgress) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: m => { if (m.status === 'recognizing text') onProgress(Math.round((m.progress || 0) * 100)) },
  })
  try {
    const { data } = await worker.recognize(file)
    return data?.text || ''
  } finally {
    await worker.terminate()
  }
}

export default function CertificateUpload({ call, user, onSaved }) {
  const inputRef = useRef(null)
  const [certs, setCerts] = useState([])
  const [phase, setPhase] = useState('idle') // idle | reading | review | saving
  const [progress, setProgress] = useState(0)
  const [step, setStep] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [ocrText, setOcrText] = useState('')
  const [found, setFound] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [enabled, setEnabled] = useState(true) // false until the server has the certificates table (migration 015)
  const [check, setCheck] = useState(null)     // the server's "is this a certificate?" answer
  const [dialog, setDialog] = useState(null)   // { tone, title, body, actions }
  const [deleting, setDeleting] = useState(null)

  const loadCerts = useCallback(() => {
    call('/skills/certificates').then(r => { setEnabled(r.enabled !== false); setCerts(r.certificates || []) }).catch(() => {})
  }, [call])
  useEffect(() => { loadCerts() }, [loadCerts])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  function reset() {
    setPhase('idle'); setFile(null); setPreview(null); setForm(EMPTY); setOcrText(''); setProgress(0); setStep(''); setFound(false); setCheck(null)
  }
  const pickFile = () => { setDialog(null); inputRef.current?.click() }
  const close = () => setDialog(null)

  /** A pop-up that turns the file away, saying why and what to do instead. */
  function refuse(kind, extra) {
    reset()
    if (kind === 'unreadable') {
      setDialog({ tone: 'warn', title: tr('We could not read this file'), body: (
        <>
          <p>{tr('No words could be read from it, so we cannot tell whether it is a certificate.')}</p>
          <ul>
            <li>{tr('Lay the certificate flat, in daylight or a bright room.')}</li>
            <li>{tr('Fit the whole certificate in the photo, straight on.')}</li>
            <li>{tr('Avoid glare, shadows and blur. A scanned PDF works best.')}</li>
          </ul>
        </>
      ), actions: [{ label: tr('Choose another file'), primary: true, onClick: pickFile }, { label: tr('Close'), onClick: close }] })
    } else if (kind === 'ocr_failed') {
      setDialog({ tone: 'warn', title: tr('The certificate reader could not start'), body: (
        <p>{tr('This usually means the internet connection dropped. Check your connection and try again, or upload a PDF instead of a photo.')}</p>
      ), actions: [{ label: tr('Try again'), primary: true, onClick: pickFile }, { label: tr('Close'), onClick: close }] })
    } else if (kind === 'duplicate_mine') {
      setDialog({ tone: 'warn', title: tr('You already uploaded this certificate'), body: (
        <p>{tr('A certificate with the same number is already in your Skills Passport. You do not need to upload it again.')}</p>
      ), actions: [{ label: tr('OK'), primary: true, onClick: close }] })
    } else if (kind === 'duplicate_other') {
      setDialog({ tone: 'error', title: tr('This certificate is on another account'), body: (
        <p>{tr('Its certificate number is already registered to another hanapbuhay account. A certificate belongs to one person. If this certificate is yours, contact Help & Support and we will look into it.')}</p>
      ), actions: [{ label: tr('OK'), primary: true, onClick: close }] })
    } else {
      setDialog({ tone: 'error', title: tr('This is not a certificate'), body: (
        <>
          <p>{tr(KIND_TEXT[extra] || 'We could not find the words a certificate has, so it was not added.')}</p>
          <div className="dlg-box">
            <b>{tr('What you can upload here')}</b>
            <ul>
              <li>{tr('TESDA National Certificate (NC I–IV) or Certificate of Competency')}</li>
              <li>{tr('Certificates of training, completion or seminar attendance')}</li>
              <li>{tr('Licenses for a trade, like a professional driver or electrician license')}</li>
            </ul>
          </div>
        </>
      ), actions: [{ label: tr('Choose another file'), primary: true, onClick: pickFile }, { label: tr('Close'), onClick: close }] })
    }
  }

  async function handleFile(e) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    setMsg({ type: '', text: '' })

    const isPdf = picked.type === 'application/pdf' || /\.pdf$/i.test(picked.name)
    const isImage = picked.type.startsWith('image/')
    const bad = (title, text) => setDialog({ tone: 'error', title, body: <p>{text}</p>, actions: [{ label: tr('Choose another file'), primary: true, onClick: pickFile }, { label: tr('Close'), onClick: close }] })
    if (!isPdf && !isImage) { bad(tr('This file type is not accepted'), tr('Upload a photo (JPG, PNG, WEBP) or a PDF of your certificate. Videos, Word files and other documents are not accepted.')); return }
    if (isPdf && picked.size > MAX_BYTES) { bad(tr('This PDF is too large'), tr('The limit is 3MB. Scan it again at a lower quality, or upload a photo instead.')); return }

    setPhase('reading'); setProgress(0)
    try {
      let upload = picked
      let text = ''
      if (isImage) {
        setStep(tr('Preparing photo…'))
        upload = await shrinkImage(picked)
        if (upload.size > MAX_BYTES) throw new Error('Photo is too large even after resizing. Try a smaller photo.')
        setPreview(URL.createObjectURL(upload))
        setStep(tr('Reading the certificate text…'))
        try { text = await ocrImage(upload, setProgress) } catch { refuse('ocr_failed'); return }
      } else {
        setStep(tr('Reading the PDF…'))
      }
      setFile(upload)
      setOcrText(text)

      const fd = new FormData()
      if (isPdf) fd.append('file', upload)
      fd.append('ocr_text', text)
      setStep(tr('Checking that it is a certificate…'))
      const res = await call('/skills/certificate/scan', { method: 'POST', body: fd })
      const p = res?.parsed || {}
      const c = res?.check || null
      if (c?.verdict === 'unreadable') { refuse('unreadable'); return }
      if (c?.verdict === 'not_certificate') { refuse('not_certificate', c.kind); return }
      if (c?.duplicate) { refuse(`duplicate_${c.duplicate}`); return }
      setCheck(c)
      setFound(!!p.title)
      setForm({
        ...EMPTY,
        title: p.title || '',
        nc_level: p.nc_level || '',
        level: p.level || '',
        source: p.is_tesda ? 'tesda' : (p.source || 'training'),
        cert_number: p.cert_number || '',
        issuer: p.issuer || '',
        issued_on: p.issued_on || '',
        valid_until: p.valid_until || '',
        category: p.category || '',
        holder_name: p.holder_name || '',
      })
      setPhase('review')
    } catch (err) {
      reset()
      setDialog({ tone: 'error', title: tr('Could not check this file'), body: <p>{tr(err?.message || 'Could not read this certificate. Please try again.')}</p>,
        actions: [{ label: tr('Try again'), primary: true, onClick: pickFile }, { label: tr('Close'), onClick: close }] })
    }
  }

  function setNc(nc) {
    setForm(f => ({
      ...f,
      nc_level: nc,
      level: NC_LEVEL[nc] || f.level,
      source: nc ? 'tesda' : f.source,
      title: f.title ? f.title.replace(/\s*\bNC\s*(IV|III|II|I)\b\s*$/i, '') + (nc ? ` NC ${nc}` : '') : f.title,
    }))
  }

  async function save(e) {
    e.preventDefault()
    if (!file || form.title.trim().length < 2) return
    setPhase('saving')
    try {
      const fd = new FormData()
      fd.append('file', file)
      Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ''))
      fd.append('ocr_text', ocrText)
      const res = await call('/skills/certificates', { method: 'POST', body: fd })
      reset()
      const skill = res.skill?.skill_name || form.title
      setDialog({ tone: 'success', title: tr('Certificate saved'), body: (
        <>
          <p>{res?.created
            ? <>{tr('“{skill}” was added to your Skills Passport.', { skill })}</>
            : <>{tr('The certificate was attached to your skill “{skill}”.', { skill })}</>}</p>
          <div className="dlg-box">
            <b>{tr('Status: Waiting for review')}</b><br />
            {tr('It already counts in your job matches. hanapbuhay checks it within 1–2 working days, then employers see the skill as Verified.')}
          </div>
        </>
      ), actions: [{ label: tr('Done'), primary: true, onClick: close }, { label: tr('Upload another'), onClick: pickFile }] })
      loadCerts()
      onSaved?.()
    } catch (err) {
      const code = err?.data?.code
      if (code === 'not_certificate' || code === 'unreadable' || code === 'duplicate_mine' || code === 'duplicate_other') {
        refuse(code, err?.data?.kind)
        return
      }
      setPhase('review')
      setDialog({ tone: 'error', title: tr('The certificate was not saved'), body: <p>{tr(err?.message || 'Could not save the certificate. Please try again.')}</p>,
        actions: [{ label: tr('OK'), primary: true, onClick: close }] })
    }
  }

  async function view(cert) {
    const win = window.open('', '_blank')
    try {
      const r = await call(`/skills/certificates/${cert.id}/file`)
      const blob = await (await fetch(r.data_url)).blob()
      const url = URL.createObjectURL(blob)
      if (win) win.location.href = url
      else window.location.href = url
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch {
      win?.close()
      setMsg({ type: 'error', text: tr('Could not open the certificate file.') })
    }
  }

  function remove(cert) {
    setDialog({ tone: 'danger', title: tr('Delete this certificate?'), body: (
      <p>{tr('“{title}” will be removed. The skill stays in your passport, without the certificate behind it.', { title: cert.title })}</p>
    ), actions: [
      { label: tr('Delete'), primary: true, onClick: async () => {
        setDeleting(cert.id)
        try {
          await call(`/skills/certificates/${cert.id}`, { method: 'DELETE' })
          setDialog(null); loadCerts(); onSaved?.()
        } catch (err) {
          setDialog({ tone: 'error', title: tr('Could not delete'), body: <p>{tr(err?.message || 'Could not delete the certificate.')}</p>, actions: [{ label: tr('OK'), primary: true, onClick: close }] })
        } finally { setDeleting(null) }
      } },
      { label: tr('Cancel'), onClick: close },
    ] })
  }

  const nameMismatch = check?.name_matches === false || (check?.name_matches == null && form.holder_name && user?.full_name &&
    !form.holder_name.toLowerCase().split(/\s+/).some(w => w.length > 2 && user.full_name.toLowerCase().includes(w)))
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="panel rise cu" style={{ marginBottom: 20 }}>
      {dialog && <Dialog tone={dialog.tone} title={dialog.title} actions={dialog.actions} onClose={close} busy={deleting !== null}>{dialog.body}</Dialog>}

      <div className="panel-hd">
        <div>
          <h2>{tr('Certificates')}</h2>
          <p className="cu-sub">{tr('Upload a photo or PDF. We read it, check that it is a real certificate, and add the skill for you.')}</p>
        </div>
        {enabled && phase === 'idle' && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => inputRef.current?.click()}>
            <IconPlus size={15} /> {tr('Upload certificate')}
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display: 'none' }} onChange={handleFile} />

      {!enabled && (
        <p role="status" style={{ margin: 0, padding: '12px 14px', borderRadius: 10, background: 'var(--gold-l)', color: 'var(--text)', fontSize: 13, lineHeight: 1.5 }}>
          {tr('Certificate upload is almost ready. For now, add the skill in the Skills tab.')}
        </p>
      )}

      {enabled && phase === 'idle' && certs.length === 0 && (
        <button type="button" className="cu-drop cu-drop-btn" onClick={() => inputRef.current?.click()}>
          <span className="cu-cert-ic" style={{ width: 48, height: 48 }}><IconFile size={24} /></span>
          <span style={{ flex: 1, minWidth: 200, textAlign: 'left' }}>
            <b style={{ display: 'block', color: 'var(--ink)', fontSize: 14 }}>{tr('Upload your first certificate')}</b>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{tr('TESDA NC, Certificate of Competency, or a training certificate. Clear photo or PDF, up to 3MB.')}</span>
          </span>
          <span className="btn btn-primary btn-sm"><IconSpark size={15} /> {tr('Upload & scan')}</span>
        </button>
      )}

      {enabled && phase === 'idle' && (
        <ul className="cu-rules">
          <li className="ok"><IconCheck size={13} /> {tr('TESDA NC I–IV, Certificate of Competency, training and seminar certificates, trade licenses')}</li>
          <li className="no"><IconAlert size={13} /> {tr('Not accepted: resumes, IDs, receipts, school records, selfies')}</li>
        </ul>
      )}

      {phase === 'reading' && (
        <div className="cu-drop busy" role="status" aria-live="polite">
          <span className="spin" />
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 14 }}>{step}</p>
            <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{tr("This can take up to a minute on phones. Keep this page open.")}</p>
            {progress > 0 && <div className="cu-progress"><i style={{ '--w': `${progress}%` }} /></div>}
          </div>
        </div>
      )}

      {(phase === 'review' || phase === 'saving') && (
        <form onSubmit={save}>
          <div className={`rb-check ${check?.verdict === 'certificate' && !nameMismatch ? 'ok' : 'warn'}`} style={{ marginBottom: 0 }}>
            {check?.verdict === 'certificate' && !nameMismatch ? <IconShield size={18} /> : <IconAlert size={18} />}
            <div>
              {check?.verdict === 'certificate'
                ? <><b>{tr('This looks like a real certificate.')}</b> {tr('We found: {list}.', { list: (check.found || []).slice(0, 4).join(', ') })}</>
                : <><b>{tr('We found only a few certificate details.')}</b> {tr('You can save it. It stays “Waiting for review” until hanapbuhay checks it by hand.')}</>}
              <div style={{ marginTop: 4 }}>
                {found
                  ? tr('Check the details below, fix anything read wrongly, then save.')
                  : tr('We could not read the qualification. Type it below.')}
              </div>
              {nameMismatch && <div style={{ marginTop: 4 }}>{tr('Name on certificate:')} <b>{form.holder_name}</b>{tr('. This does not match your profile name, so the reviewer will check it closely.')}</div>}
            </div>
          </div>

          <div className="cu-review">
            {preview
              ? <img className="cu-thumb" src={preview} alt={tr("Uploaded certificate")} />
              : <div className="cu-thumb pdf"><div style={{ textAlign: 'center' }}><IconFile size={34} /><div>{tr("PDF")}</div></div></div>}

            <div>
              <label className="field">
                <span>{tr("Skill / Qualification *")}</span>
                <div className="in no-icon"><input value={form.title} onChange={set('title')} required minLength={2} maxLength={255} placeholder={tr("e.g. Shielded Metal Arc Welding (SMAW) NC II")} /></div>
              </label>
              <div className="rb-3">
                <label className="field">
                  <span>{tr("NC Level")}</span>
                  <div className="in no-icon">
                    <select value={form.nc_level} onChange={e => setNc(e.target.value)}>
                      <option value="">{tr("None")}</option>
                      {['I', 'II', 'III', 'IV'].map(n => <option key={n} value={n}>{tr("NC")} {n}</option>)}
                    </select>
                  </div>
                </label>
                <label className="field">
                  <span>{tr("Skill Level")}</span>
                  <div className="in no-icon">
                    <select value={form.level} onChange={set('level')}>
                      <option value="">{tr("Select level")}</option>
                      {LEVELS.map(l => <option key={l} value={l}>{tr(l[0].toUpperCase() + l.slice(1))}</option>)}
                    </select>
                  </div>
                </label>
                <label className="field">
                  <span>{tr("Type")}</span>
                  <div className="in no-icon">
                    <select value={form.source} onChange={set('source')}>
                      {SOURCES.map(([v, l]) => <option key={v} value={v}>{tr(l)}</option>)}
                    </select>
                  </div>
                </label>
              </div>
              <div className="rb-2">
                <label className="field">
                  <span>{tr("Certificate No.")} <em>{tr("Optional")}</em></span>
                  <div className="in no-icon"><input value={form.cert_number} onChange={set('cert_number')} maxLength={80} placeholder={tr("e.g. 21040502012345")} /></div>
                </label>
                <label className="field">
                  <span>{tr("Issued by")} <em>{tr("Optional")}</em></span>
                  <div className="in no-icon"><input value={form.issuer} onChange={set('issuer')} maxLength={150} placeholder={tr("e.g. TESDA")} /></div>
                </label>
                <label className="field">
                  <span>{tr("Date Issued")} <em>{tr("Optional")}</em></span>
                  <div className="in no-icon"><input type="date" value={form.issued_on} onChange={set('issued_on')} /></div>
                </label>
                <label className="field">
                  <span>{tr("Valid Until")} <em>{tr("Optional")}</em></span>
                  <div className="in no-icon"><input type="date" value={form.valid_until} onChange={set('valid_until')} /></div>
                </label>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="submit" className="btn btn-primary" disabled={phase === 'saving' || form.title.trim().length < 2}>
                  {phase === 'saving' ? <span className="spin" /> : <><IconCheck size={16} /> {tr("Save to Skills Passport")}</>}
                </button>
                <button type="button" className="btn btn-light" onClick={reset} disabled={phase === 'saving'}>{tr("Cancel")}</button>
              </div>
            </div>
          </div>
        </form>
      )}

      {msg.text && (
        <p role="status" style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: msg.type === 'error' ? 'var(--red-l)' : 'var(--green-l)', color: msg.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
          {msg.text}
        </p>
      )}

      {certs.length > 0 && (
        <div className="cu-list">
          {certs.map(c => (
            <div key={c.id} className="cu-cert">
              <div className="cu-cert-ic"><IconShield size={20} /></div>
              <div style={{ minWidth: 0 }}>
                <h4>{c.title}</h4>
                <p>
                  {[c.issuer, c.cert_number && `No. ${c.cert_number}`, c.valid_until && `Valid until ${c.valid_until}`].filter(Boolean).join(' · ') || tr("Certificate")}
                </p>
                {c.status === 'rejected' && c.review_note && (
                  <p style={{ color: 'var(--red)', fontWeight: 600, marginTop: 2 }}>{tr("Not accepted:")} {c.review_note}{tr(". Upload a clearer photo to try again.")}</p>
                )}
                {c.status === 'verified' && <p style={{ color: 'var(--green)', fontWeight: 600, marginTop: 2 }}>{tr("Checked by hanapbuhay. Employers see this skill as Verified.")}</p>}
                {(!c.status || c.status === 'pending') && <p style={{ color: 'var(--muted)', marginTop: 2 }}>{tr('Counts in your matches now. Shown as Verified once checked.')}</p>}
              </div>
              <div className="cu-actions">
                <span className={`chip ${(STATUS[c.status] || STATUS.pending)[0]}`} style={{ alignSelf: 'center', fontSize: 11 }}>
                  {tr((STATUS[c.status] || STATUS.pending)[1])}
                </span>
                <button type="button" className="btn btn-light btn-sm" onClick={() => view(c)} aria-label={tr('View {title}', { title: c.title })}><IconEye size={15} /></button>
                <button type="button" className="btn btn-light btn-sm" onClick={() => remove(c)} aria-label={tr('Delete {title}', { title: c.title })} style={{ color: 'var(--red)' }}><IconTrash size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
