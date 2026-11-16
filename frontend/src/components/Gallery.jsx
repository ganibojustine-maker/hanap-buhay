/**
 * Gallery: a post's photos. A large picture, thumbnails under it, and a full-screen
 * viewer (arrow keys, Escape) when a photo is tapped.
 *   <Gallery photos={['https://…', …]} alt="Aircon cleaning" />
 */
import { useEffect, useState } from 'react'
import { IconX, IconArrow, IconBack } from './icons.jsx'

export default function Gallery({ photos = [], alt = '', ratio = '16 / 10', fallback }) {
  const list = photos.filter(Boolean)
  const [i, setI] = useState(0)
  const [open, setOpen] = useState(false)
  const n = list.length
  useEffect(() => { if (i >= n) setI(0) }, [n, i])
  useEffect(() => {
    if (!open) return
    const onKey = e => {
      if (e.key === 'Escape') setOpen(false)
      if (e.key === 'ArrowRight') setI(x => (x + 1) % n)
      if (e.key === 'ArrowLeft') setI(x => (x - 1 + n) % n)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, n])

  if (!n) return fallback ? <div className="gal-main" style={{ aspectRatio: ratio }}><img src={fallback} alt="" /></div> : null
  return (
    <div className="gal">
      <button type="button" className="gal-main" style={{ aspectRatio: ratio }} onClick={() => setOpen(true)} aria-label="Open the photo full screen">
        <img src={list[i]} alt={alt} />
        {n > 1 && <span className="gal-count">{i + 1} / {n}</span>}
      </button>
      {n > 1 && (
        <div className="gal-thumbs" role="list">
          {list.map((src, k) => (
            <button key={src} type="button" role="listitem" className={`gal-thumb${k === i ? ' on' : ''}`} onClick={() => setI(k)} aria-label={`Photo ${k + 1}`}>
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="gal-box" role="dialog" aria-modal="true" aria-label="Photo viewer" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}>
          <img src={list[i]} alt={alt} />
          <button type="button" className="gal-btn x" onClick={() => setOpen(false)} aria-label="Close"><IconX size={18} /></button>
          {n > 1 && <>
            <button type="button" className="gal-btn prev" onClick={() => setI(x => (x - 1 + n) % n)} aria-label="Previous photo"><IconBack size={18} /></button>
            <button type="button" className="gal-btn next" onClick={() => setI(x => (x + 1) % n)} aria-label="Next photo"><IconArrow size={18} /></button>
            <span className="gal-count big">{i + 1} / {n}</span>
          </>}
        </div>
      )}
    </div>
  )
}
