/**
 * photos.js: post photos (jobs, gigs, service listings), shared by every form and page.
 *
 * The API returns photo URLs as "/api/…"; apiUrl() puts the API host in front so the
 * browser can load them in production, where the site and the API are on different hosts.
 */
import { BASE } from '../api.js'

export const apiUrl = u => (!u ? null : /^https?:|^data:|^blob:/.test(u) ? u : `${BASE}${u}`)

/** Shrink a photo to JPEG (longest side 1600px) before upload: small, and still sharp on a phone. */
export async function shrinkPhoto(file, maxSide = 1600) {
  if (!file.type.startsWith('image/')) throw new Error('Only photos (JPG, PNG, WEBP) can be added. Videos and documents are not accepted.')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('This image could not be opened. Try a JPG or PNG photo.'))
      i.src = url
    })
    const k = Math.min(1, maxSide / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.84))
    if (!blob) throw new Error('This image could not be processed.')
    if (blob.size > 3 * 1024 * 1024) throw new Error('That photo is too large even after resizing. Try another one.')
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' })
  } finally { URL.revokeObjectURL(url) }
}

/** Upload photos picked before the post existed. Returns how many failed (the post is kept either way). */
export async function uploadPhotos(call, type, id, files = []) {
  let failed = 0
  for (const f of files) {
    const fd = new FormData()
    fd.append('image', f)
    try { await call(`/photos/${type}/${id}`, { method: 'POST', body: fd }) } catch { failed++ }
  }
  return failed
}
