/**
 * ShotPicker — attach screenshots to a help request.
 *
 * "It doesn't work" is hard to act on; a screenshot of the actual error is not. The
 * picker takes up to three images, shrinks each one in the browser to ~1400px JPEG
 * (a phone screenshot is often 4 MB; this lands near 150 KB), and hands back data URLs
 * that the API stores beside the message.
 *
 * Paste works too: Ctrl+V / ⌘V with a screenshot on the clipboard drops it straight in,
 * which is how people actually take screenshots on a laptop.
 */
import { useEffect, useRef, useState } from 'react'
import { IconPlus, IconX, IconAlert } from './icons.jsx'
import { tr } from '../lang/dash.js'

export const MAX_SHOTS = 3
const TARGET_SIDE = 1400
const MAX_DATAURL = 650 * 1024

async function toDataUrl(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((res, rej) => {
      const im = new Image()
      im.onload = () => res(im)
      im.onerror = () => rej(new Error(tr('That image could not be opened.')))
      im.src = url
    })
    const scale = Math.min(1, TARGET_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(img.naturalWidth * scale))
    c.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0, c.width, c.height)
    // drop the quality a step at a time until it fits what the API accepts
    for (const q of [0.82, 0.7, 0.58, 0.45]) {
      const data = c.toDataURL('image/jpeg', q)
      if (data.length <= MAX_DATAURL) return data
    }
    throw new Error(tr('That screenshot is too big. Crop it to the part that matters and try again.'))
  } finally { URL.revokeObjectURL(url) }
}

export default function ShotPicker({ shots, onChange, disabled, label }) {
  const inputRef = useRef(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const add = async (files) => {
    const room = MAX_SHOTS - shots.length
    if (room <= 0) { setErr(tr('You can attach up to {n} screenshots.', { n: MAX_SHOTS })); return }
    setBusy(true); setErr('')
    const next = []
    for (const f of Array.from(files).slice(0, room)) {
      if (!f.type?.startsWith('image/')) { setErr(tr('Only images can be attached — a screenshot or a photo of the screen.')); continue }
      try { next.push({ data: await toDataUrl(f), name: f.name || 'screenshot.jpg' }) }
      catch (e) { setErr(e.message) }
    }
    if (next.length) onChange([...shots, ...next])
    setBusy(false)
  }

  // paste a screenshot straight into the form
  useEffect(() => {
    if (disabled) return
    const onPaste = e => {
      const files = [...(e.clipboardData?.items || [])]
        .filter(i => i.kind === 'file' && i.type.startsWith('image/'))
        .map(i => i.getAsFile())
        .filter(Boolean)
      if (files.length) { e.preventDefault(); add(files) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shots, disabled])

  return (
    <div className="shot-picker">
      <div className="shot-row">
        <button type="button" className="btn btn-light btn-sm" disabled={disabled || busy || shots.length >= MAX_SHOTS}
          onClick={() => inputRef.current?.click()}>
          {busy ? <span className="spin" /> : <IconPlus size={14} />} {label || tr('Attach a screenshot')}
        </button>
        <small>{tr('Up to {n} images. You can also paste one with Ctrl+V.', { n: MAX_SHOTS })}</small>
      </div>

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
        onChange={e => { const f = e.target.files; e.target.value = ''; if (f?.length) add(f) }} />

      {err && <p className="shot-err"><IconAlert size={13} /> {err}</p>}

      {shots.length > 0 && (
        <ul className="shot-list">
          {shots.map((s, i) => (
            <li key={i}>
              <img src={s.data} alt={s.name || tr('Screenshot')} />
              <button type="button" onClick={() => onChange(shots.filter((_, n) => n !== i))}
                aria-label={tr('Remove this screenshot')} disabled={disabled}>
                <IconX size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The screenshots on a message that has already been sent. */
export function ShotStrip({ shots = [] }) {
  const [open, setOpen] = useState(null)
  if (!shots.length) return null
  return (
    <>
      <ul className="shot-strip">
        {shots.map((s, i) => (
          <li key={i}>
            <button type="button" onClick={() => setOpen(s)} aria-label={s.name || tr('Open screenshot')}>
              <img src={s.data} alt={s.name || tr('Screenshot')} loading="lazy" />
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <div className="pf-lightbox" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <figure onClick={e => e.stopPropagation()}>
            <img src={open.data} alt={open.name || tr('Screenshot')} />
            <figcaption>
              <b>{open.name || tr('Screenshot')}</b>
              <button type="button" className="btn btn-light btn-sm" onClick={() => setOpen(null)}>{tr('Close')}</button>
            </figcaption>
          </figure>
        </div>
      )}
    </>
  )
}
