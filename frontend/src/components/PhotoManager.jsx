/**
 * PhotoManager: the photo strip on every posting form (job, gig, service).
 *
 *   <PhotoManager type="service" id={id} call={call} />            saved post: uploads and removes right away
 *   <PhotoManager type="job" pending={files} onPending={setFiles} /> new post: keeps the files until it is saved,
 *                                                                    then the form calls uploadPhotos()
 *
 * The first photo is the cover: it is the picture on every card and at the top of the page.
 * Photos are shrunk on the phone before they go up, so a 10 MB camera shot uploads quickly.
 */
import askConfirm from './askConfirm.jsx'
import { useEffect, useRef, useState } from 'react'
import { IconPlus, IconTrash } from './icons.jsx'
import { apiUrl, shrinkPhoto } from '../utils/photos.js'

export default function PhotoManager({ type, id, call, max = 6, pending, onPending, extraOnly = false, onChange, hint }) {
  const [photos, setPhotos] = useState(null)   // saved: [{slot, url}]
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const input = useRef(null)
  const live = Boolean(id && call)

  useEffect(() => {
    if (!live) { setPhotos([]); return }
    call(`/photos/${type}/${id}`).then(r => setPhotos(r.photos || [])).catch(() => setPhotos([]))
  }, [live, type, id, call])

  // previews for files picked before the post was saved
  const [previews, setPreviews] = useState([])
  useEffect(() => {
    const urls = (pending || []).map(f => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach(u => URL.revokeObjectURL(u))
  }, [pending])

  const saved = (photos || []).filter(p => !extraOnly || p.slot > 0)
  const count = live ? saved.length : (pending || []).length
  const room = max - count

  async function pick(e) {
    const files = Array.from(e.target.files || []).slice(0, Math.max(0, room))
    e.target.value = ''
    if (!files.length) return
    setErr(''); setBusy(true)
    try {
      const small = []
      for (const f of files) small.push(await shrinkPhoto(f))
      if (!live) { onPending?.([...(pending || []), ...small]); return }
      let list = photos
      for (const f of small) {
        const fd = new FormData(); fd.append('image', f)
        if (extraOnly) fd.append('extra', '1')
        const r = await call(`/photos/${type}/${id}`, { method: 'POST', body: fd })
        list = r.photos || list
      }
      setPhotos(list); onChange?.(list)
    } catch (e2) { setErr(e2.message || 'We couldn’t add that photo. Please try again.') }
    finally { setBusy(false) }
  }

  async function remove(i) {
    setErr('')
    if (!live) { onPending?.((pending || []).filter((_, k) => k !== i)); return }
    const p = saved[i]
    if (!(await askConfirm({ tone: 'danger', title: 'Remove this photo?', yes: 'Remove' }))) return
    setBusy(true)
    try { const r = await call(`/photos/${type}/${id}/${p.slot}`, { method: 'DELETE' }); setPhotos(r.photos || []); onChange?.(r.photos || []) }
    catch (e2) { setErr(e2.message || 'We couldn’t remove that photo.') } finally { setBusy(false) }
  }

  const items = live ? saved.map(p => apiUrl(p.url)) : previews
  return (
    <div className="phm">
      {hint && <p className="pf-small" style={{ margin: '0 0 10px' }}>{hint}</p>}
      {err && <div className="pf-note bad" role="alert" style={{ marginBottom: 10 }}>{err}</div>}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }} onChange={pick} />
      <div className="phm-grid">
        {items.map((src, i) => (
          <figure key={src} className="phm-item">
            <img src={src} alt="" />
            {i === 0 && !extraOnly && <span className="phm-cover">Cover</span>}
            <button type="button" className="phm-x" onClick={() => remove(i)} disabled={busy} aria-label={`Remove photo ${i + 1}`}><IconTrash size={13} /></button>
          </figure>
        ))}
        {room > 0 && (
          <button type="button" className="phm-add" onClick={() => input.current?.click()} disabled={busy || photos === null}>
            {busy ? <span className="spin" /> : <IconPlus size={18} />}
            <span>{busy ? 'Adding…' : count ? 'Add more' : 'Add photos'}</span>
            <small>{count}/{max}</small>
          </button>
        )}
      </div>
    </div>
  )
}
