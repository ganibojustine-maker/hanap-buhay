/**
 * lastSeen.js: the last answer of a public list, kept on this device.
 *
 * The API runs on a free server that sleeps when nobody uses it, and waking it takes up
 * to a minute. Public pages (the landing page's open posts and town counts) show what
 * this device saw last time straight away, then swap in the fresh answer when it comes.
 * Only public data is kept here, never anything about the signed-in person.
 */
const PREFIX = 'hb_seen_'
const MAX_AGE = 3 * 24 * 3600 * 1000   // older than 3 days is not worth showing

export function recall(key) {
  try {
    const v = JSON.parse(localStorage.getItem(PREFIX + key) || 'null')
    return v && Date.now() - v.at < MAX_AGE ? v.data : null
  } catch { return null }
}

export function remember(key, data) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), data })) } catch { /* storage full or blocked */ }
}
