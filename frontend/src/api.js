// BASE is empty in dev so Vite proxies /api/* → the PHP backend.
// In production set VITE_API_URL to your backend root (e.g. https://api.hanapbuhay.gov.ph).
export const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

// Plain JSON fetch. Turns network failures into a message people can act on.
export async function api(path, { method = 'GET', body, token } = {}) {
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
