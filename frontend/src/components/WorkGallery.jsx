/**
 * WorkGallery — photos of real work, with the worker's own description.
 *
 * A certificate proves you were trained. This proves you have done the thing: the panel
 * you wired, the cabinet you built, the event you catered. Each photo carries a title, a
 * description in the worker's own words, and optionally the Skills Passport entry it backs
 * up, so an employer reading an application can see the work instead of taking it on faith.
 *
 * Photos are never marked "verified" — they are evidence, not a credential, and the page
 * says so plainly rather than implying the site checked them.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { IconPlus, IconTrash, IconX, IconCheck, IconAlert, IconEdit, IconFile } from './icons.jsx'
import { tr } from '../lang/dash.js'
import Dialog from './Dialog.jsx'
import { fileUrl } from '../api.js'
import '../styles/social.css'

const MAX_BYTES = 3 * 1024 * 1024
const MAX_ITEMS = 24

/** Re-encode to JPEG under ~1600px: small enough to store inline, still clear on a phone. */
async function shrink(file, maxSide = 1600) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((res, rej) => {
      const im = new Image()
      im.onload = () => res(im)
      im.onerror = () => rej(new Error(tr('That image could not be opened. Try a JPG or PNG photo.')))
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
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82))
    if (!blob) throw new Error(tr('That image could not be processed.'))
    return new File([blob], (file.name || 'work').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } finally { URL.revokeObjectURL(url) }
}

export default function WorkGallery({ call, tokens, skills = [], onChanged }) {
  const fileRef = useRef(null)
  const [items, setItems] = useState([])
  const [enabled, setEnabled] = useState(true)
  const [draft, setDraft] = useState(null)   // { file, preview, title, description, skill_name }
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [open, setOpen] = useState(null)     // lightbox
  const [editing, setEditing] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)

  const load = useCallback(() => {
    call('/portfolio')
      .then(r => { setItems(r.items || []); setEnabled(!r.setup_needed) })
      .catch(() => setEnabled(false))
  }, [call])
  useEffect(() => { load() }, [load])
  useEffect(() => () => { if (draft?.preview) URL.revokeObjectURL(draft.preview) }, [draft?.preview])

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMsg(null)
    if (!file.type.startsWith('image/')) {
      setMsg({ bad: true, text: tr('Only photos here (JPG, PNG, WEBP). Videos and documents are not accepted.') })
      return
    }
    try {
      const small = file.size > 900 * 1024 ? await shrink(file) : file
      if (small.size > MAX_BYTES) { setMsg({ bad: true, text: tr('That photo is too large even after resizing. Try a smaller crop.') }); return }
      setDraft({ file: small, preview: URL.createObjectURL(small), title: '', description: '', skill_name: '' })
    } catch (err) {
      setMsg({ bad: true, text: err.message })
    }
  }

  async function save(e) {
    e.preventDefault()
    if (!draft) return
    if (draft.title.trim().length < 2) { setMsg({ bad: true, text: tr('Give the photo a short title.') }); return }
    if (draft.description.trim().length < 10) { setMsg({ bad: true, text: tr('Describe what you did in this photo — at least a sentence. Employers read this.') }); return }
    setBusy(true); setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', draft.file)
      fd.append('title', draft.title.trim())
      fd.append('description', draft.description.trim())
      if (draft.skill_name) fd.append('skill_name', draft.skill_name)
      await call('/portfolio', { method: 'POST', body: fd })
      setDraft(null)
      setMsg({ text: tr('Photo added to your work gallery.') })
      load(); onChanged?.()
    } catch (err) {
      setMsg({ bad: true, text: err?.message || tr('Could not save the photo.') })
    } finally { setBusy(false) }
  }

  function remove(item) {
    setConfirmDel(item)
  }
  async function doRemove() {
    const item = confirmDel
    setBusy(true)
    try {
      await call(`/portfolio/${item.id}`, { method: 'DELETE' })
      setConfirmDel(null); load(); onChanged?.()
    } catch (err) {
      setConfirmDel(null)
      setMsg({ bad: true, text: err?.message || tr('Could not remove the photo.') })
    } finally { setBusy(false) }
  }

  async function saveEdit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await call(`/portfolio/${editing.id}`, {
        method: 'PATCH',
        body: { title: editing.title, description: editing.description, skill_name: editing.skill_name || null },
      })
      setEditing(null); load()
    } catch (err) {
      setMsg({ bad: true, text: err?.message || tr('Could not save the changes.') })
    } finally { setBusy(false) }
  }

  if (!enabled) {
    return (
      <div className="panel">
        <div className="panel-hd"><h2>{tr('Work photos')}</h2></div>
        <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: 0 }}>
          {tr('Work photos switch on once the site update finishes. Your certificates and skills keep working.')}
        </p>
      </div>
    )
  }

  return (
    <section className="panel wg">
      {confirmDel && (
        <Dialog tone="danger" title={tr('Remove this photo?')} busy={busy} onClose={() => setConfirmDel(null)}
          actions={[{ label: tr('Remove'), primary: true, onClick: doRemove }, { label: tr('Cancel'), onClick: () => setConfirmDel(null) }]}>
          <p>{tr('“{title}” will be removed from your work photos. Employers will no longer see it.', { title: confirmDel.title })}</p>
        </Dialog>
      )}
      <div className="panel-hd">
        <div>
          <h2>{tr('Work photos')}</h2>
          <p className="wg-sub">{tr('Photos of jobs you have done, in your own words. They back up your skills when an employer reads your application.')}</p>
        </div>
        <div className="wg-hd-right">
          <span className="chip navy">{items.length} / {MAX_ITEMS}</span>
          <button type="button" className="btn btn-primary btn-sm" disabled={items.length >= MAX_ITEMS} onClick={() => fileRef.current?.click()}>
            <IconPlus size={15} /> {tr('Add a photo')}
          </button>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={pick} />

      {msg && (
        <p role="status" className={`wg-msg${msg.bad ? ' bad' : ''}`}>
          {msg.bad ? <IconAlert size={15} /> : <IconCheck size={15} />} {msg.text}
        </p>
      )}

      {/* new photo */}
      {draft && (
        <form className="wg-draft" onSubmit={save}>
          <img src={draft.preview} alt={tr('Photo you are adding')} />
          <div>
            <label className="field">
              <span>{tr('What is this? *')}</span>
              <div className="in no-icon">
                <input value={draft.title} maxLength={150} required
                  onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                  placeholder={tr('e.g. House rewiring in Calapan')} />
              </div>
            </label>
            <label className="field">
              <span>{tr('What did you do? *')}</span>
              <div className="in no-icon">
                <textarea rows={3} value={draft.description} maxLength={1000} required
                  onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                  placeholder={tr('e.g. I installed the panel board and the wiring for a two-storey house, including the outlets and lights. Took one week with one helper.')} />
              </div>
            </label>
            <label className="field">
              <span>{tr('Which of your skills does this show?')} <em>{tr('Optional')}</em></span>
              <div className="in no-icon">
                <select value={draft.skill_name} onChange={e => setDraft(d => ({ ...d, skill_name: e.target.value }))}>
                  <option value="">{tr('Not linked to a skill')}</option>
                  {skills.map(s => <option key={s.id} value={s.skill_name}>{s.skill_name}</option>)}
                </select>
              </div>
            </label>
            <div className="wg-draft-actions">
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                {busy ? <span className="spin" /> : <><IconCheck size={15} /> {tr('Add to gallery')}</>}
              </button>
              <button type="button" className="btn btn-light btn-sm" onClick={() => setDraft(null)} disabled={busy}>{tr('Cancel')}</button>
            </div>
          </div>
        </form>
      )}

      {items.length === 0 && !draft ? (
        <div className="wg-empty">
          <IconFile size={34} />
          <p><b>{tr('No work photos yet.')}</b> {tr('A photo of a finished job says more than a line on a form.')}</p>
          <button type="button" className="btn btn-navy btn-sm" onClick={() => fileRef.current?.click()}><IconPlus size={15} /> {tr('Add your first photo')}</button>
        </div>
      ) : (
        <ul className="pf-grid">
          {items.map(w => (
            <li key={w.id}>
              <button type="button" onClick={() => setOpen(w)} aria-label={w.title}>
                <img src={fileUrl(`/portfolio/${w.id}/file`)} alt={w.title} loading="lazy" />
              </button>
              <b>{w.title}</b>
              {w.skill_name && <span className="chip navy" style={{ fontSize: 10, width: 'fit-content' }}>{w.skill_name}</span>}
              <p>{w.description}</p>
              <div className="pf-tools">
                <button type="button" className="btn btn-light btn-xs" onClick={() => setEditing({ ...w })} aria-label={tr('Edit')}><IconEdit size={13} /></button>
                <button type="button" className="btn btn-light btn-xs" style={{ color: 'var(--red)' }} onClick={() => remove(w)} aria-label={tr('Remove')}><IconTrash size={13} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* edit */}
      {editing && (
        <div className="pf-lightbox" onClick={() => setEditing(null)}>
          <form className="wg-edit" onClick={e => e.stopPropagation()} onSubmit={saveEdit}>
            <h3>{tr('Edit photo details')}</h3>
            <label className="field">
              <span>{tr('Title')}</span>
              <div className="in no-icon"><input value={editing.title} maxLength={150} onChange={e => setEditing(x => ({ ...x, title: e.target.value }))} /></div>
            </label>
            <label className="field">
              <span>{tr('Description')}</span>
              <div className="in no-icon"><textarea rows={4} value={editing.description || ''} maxLength={1000} onChange={e => setEditing(x => ({ ...x, description: e.target.value }))} /></div>
            </label>
            <label className="field">
              <span>{tr('Skill')}</span>
              <div className="in no-icon">
                <select value={editing.skill_name || ''} onChange={e => setEditing(x => ({ ...x, skill_name: e.target.value }))}>
                  <option value="">{tr('Not linked to a skill')}</option>
                  {skills.map(s => <option key={s.id} value={s.skill_name}>{s.skill_name}</option>)}
                </select>
              </div>
            </label>
            <div className="wg-draft-actions">
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{tr('Save')}</button>
              <button type="button" className="btn btn-light btn-sm" onClick={() => setEditing(null)}>{tr('Cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {/* lightbox */}
      {open && (
        <div className="pf-lightbox" onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-label={open.title}>
          <figure onClick={e => e.stopPropagation()}>
            <img src={fileUrl(`/portfolio/${open.id}/file`)} alt={open.title} />
            <figcaption>
              <b>{open.title}</b>
              <p>{open.description}</p>
              <button type="button" className="btn btn-light btn-sm" onClick={() => setOpen(null)}><IconX size={14} /> {tr('Close')}</button>
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  )
}
