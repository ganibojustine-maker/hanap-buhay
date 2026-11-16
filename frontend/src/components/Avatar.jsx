/**
 * Avatar — the one place a person's picture is drawn.
 *
 * Nobody starts with a photo, so instead of showing the same stock face to everyone
 * (the old /images/avatar.jpg) each account gets its own generated avatar: their initials
 * on a colour picked from their account id, so it is the same on every screen, every
 * device and in every list. A real uploaded photo always wins; if that photo fails to
 * load, the generated one is still underneath.
 *
 *   <UserAvatar user={user} size={40} />
 *   <UserAvatar name="Juan Dela Cruz" id={12} size={28} />
 *   avatarDataUrl(user)   → a data: URL of the same avatar (for <img src>, emails, canvas)
 */

/* Eight pairs that all pass contrast against white text, in the hanapbuhay palette. */
export const AVATAR_COLORS = [
  { bg: '#0D1B3E', fg: '#FFD27A' }, // navy
  { bg: '#047857', fg: '#D1FAE5' }, // green
  { bg: '#B45309', fg: '#FEF3C7' }, // amber
  { bg: '#1D4ED8', fg: '#DBEAFE' }, // blue
  { bg: '#7C2D12', fg: '#FFEDD5' }, // clay
  { bg: '#6D28D9', fg: '#EDE9FE' }, // violet
  { bg: '#0F766E', fg: '#CCFBF1' }, // teal
  { bg: '#9F1239', fg: '#FFE4E6' }, // rose
]

/** Stable index for an account: the server's avatar_color, else the id, else the name. */
export function avatarIndex({ avatar_color, id, name } = {}) {
  if (Number.isFinite(Number(avatar_color))) return ((Number(avatar_color) % AVATAR_COLORS.length) + AVATAR_COLORS.length) % AVATAR_COLORS.length
  const n = Number(id)
  if (Number.isFinite(n) && n > 0) return n % AVATAR_COLORS.length
  const s = String(name || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % AVATAR_COLORS.length
}

/** "Juan Dela Cruz" → "JC" · "Calapan Construction Corp" → "CC" · "" → "?" */
export function initials(name, email) {
  const clean = String(name || '').replace(/[^\p{L}\p{N}\s.'-]/gu, ' ').trim()
  const parts = clean.split(/\s+/).filter(w => w && !/^(jr|sr|ii|iii|iv|inc|corp|ltd)\.?$/i.test(w))
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  const e = String(email || '').trim()
  return e ? e[0].toUpperCase() : '?'
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * The same avatar as an SVG data URL — for places that need a plain `src`
 * (email templates, canvas, the map, a PDF).
 */
export function avatarDataUrl(user = {}, size = 96) {
  const name = user.full_name || user.name || ''
  const { bg, fg } = AVATAR_COLORS[avatarIndex({ avatar_color: user.avatar_color, id: user.id, name })]
  const text = initials(name, user.email)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 96" role="img" aria-label="${esc(name || 'User')}">` +
    `<rect width="96" height="96" rx="48" fill="${bg}"/>` +
    `<text x="48" y="49" dy=".35em" text-anchor="middle" fill="${fg}" ` +
    `font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="${text.length > 1 ? 36 : 44}" font-weight="700" letter-spacing="1">${esc(text)}</text>` +
    `</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * props
 *   user      { id, full_name, email, picture, avatar_color }  — or pass the pieces
 *   size      pixels (default 40)
 *   rounded   'full' (default) | 'rounded'  — squircle for company logos
 *   ring      show a thin outline (used on dark backgrounds)
 *   title     tooltip; defaults to the name
 */
export default function UserAvatar({
  user, id, name, email, picture, avatar_color,
  size = 40, rounded = 'full', ring = false, className = '', style = {}, title, alt,
}) {
  const u = user || {}
  const fullName = name ?? u.full_name ?? u.name ?? ''
  const mail = email ?? u.email ?? ''
  const photo = picture ?? u.picture ?? null
  const idx = avatarIndex({ avatar_color: avatar_color ?? u.avatar_color, id: id ?? u.id, name: fullName })
  const { bg, fg } = AVATAR_COLORS[idx]
  const text = initials(fullName, mail)
  const label = alt ?? (fullName || 'User')

  return (
    <span
      className={`hb-avatar ${className}`}
      title={title ?? fullName ?? undefined}
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: rounded === 'full' ? '50%' : Math.max(6, Math.round(size * 0.26)),
        background: bg,
        color: fg,
        display: 'inline-grid',
        placeItems: 'center',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
        fontWeight: 800,
        fontSize: Math.max(10, Math.round(size * (text.length > 1 ? 0.38 : 0.46))),
        lineHeight: 1,
        letterSpacing: '.02em',
        fontFamily: 'var(--display, inherit)',
        userSelect: 'none',
        boxShadow: ring ? '0 0 0 2px rgba(255,255,255,.25)' : undefined,
        ...style,
      }}
    >
      <span aria-hidden={photo ? 'true' : undefined}>{text}</span>
      {photo && (
        <img
          src={photo}
          alt={label}
          loading="lazy"
          onError={e => { e.currentTarget.style.display = 'none' }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      {!photo && <span className="sr-only">{label}</span>}
    </span>
  )
}
