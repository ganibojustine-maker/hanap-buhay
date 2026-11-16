// BASE is empty in dev so Vite proxies /api/* → the PHP backend.
// In production set VITE_API_URL to your backend root (e.g. https://api.hanapbuhay.gov.ph).
export const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

/**
 * A URL the browser fetches on its own — an <img src>, a download link.
 * Those cannot carry an Authorization header, so the endpoint behind one must be public;
 * they also need the API host in front in production, where the site and the API are on
 * different origins. api() builds the same prefix for fetch() calls.
 */
export const fileUrl = path => `${BASE}/api${path}`

// Requests in flight, announced so <TopProgress/> can show the bar at the top of the screen.
let inflight = 0
const announce = d => {
  inflight = Math.max(0, inflight + d)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('hb:net', { detail: inflight }))
}

// Plain JSON fetch. Turns network failures into a message people can act on.
export async function api(path, opts = {}) {
  announce(1)
  try { return await request(path, opts) } finally { announce(-1) }
}

async function request(path, { method = 'GET', body, token } = {}) {
  let res
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: isForm ? body : (body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined),
    })
  } catch {
    throw Object.assign(
      new Error("Can't reach the server. Check that the backend is running and try again."),
      { network: true }
    )
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw Object.assign(new Error(data.error || data.message || 'Something went wrong.'), {
      status: res.status,
      data,
    })
  }
  return data
}
