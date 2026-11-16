/** Philippine formats: peso amounts, Philippine time, local mobile numbers. */
const TZ = 'Asia/Manila'

export const peso = (n, { cents = true } = {}) =>
  '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })

// The API sends "YYYY-MM-DD HH:MM:SS" in Philippine time
const parse = s => (s instanceof Date ? s : new Date(String(s).replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(s)) || String(s).length <= 10 ? '' : '+08:00')))

export const phDate = s => (s ? parse(s).toLocaleDateString('en-PH', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' }) : '')
export const phDateTime = s => (s ? parse(s).toLocaleString('en-PH', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

/** "09171234567" → "0917 123 4567" */
export const phPhone = p => {
  const d = String(p || '').replace(/\D/g, '').replace(/^63/, '0')
  return /^09\d{9}$/.test(d) ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : (p || '')
}
export const validPhMobile = p => /^(\+?63|0)9\d{9}$/.test(String(p || '').replace(/[\s-]/g, ''))

/** Days from now until a date (negative once it has passed). */
export const daysUntil = s => (s ? Math.ceil((parse(s) - Date.now()) / 86400000) : null)
