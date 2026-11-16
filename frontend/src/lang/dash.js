// Worker dashboard in Filipino (Tagalog).
//
// tr('My Applications') returns the Tagalog text when a worker chose Filipino, and the
// English text unchanged otherwise (and for employers/admins, whose pages aren't translated).
// tr('Applied {when}', { when }) fills in {placeholders} in either language.
//
// The dictionary (./tl.js) is its own download, fetched only when Filipino is chosen.
// Dashboard.jsx turns it on for workers and remounts the pages when the language changes,
// so tr() is a plain function and works anywhere (components, helpers, messages).

let dict = null
let patterns = []
let active = false
let loading = null

export function tr(text, vars) {
  if (text == null || text === '') return text
  let out = text
  if (active && dict) {
    const hit = dict[text]
    if (hit !== undefined) out = hit
    else {
      for (const [re, rep] of patterns) {
        if (re.test(text)) { out = text.replace(re, rep); break }
      }
    }
  }
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m))
  return out
}

/** Is the worker dashboard showing Tagalog right now? */
export const tagalogOn = () => active

/** Dashboard.jsx: on for workers who chose Filipino, once the dictionary is loaded. */
export function setTagalog(on) { active = !!on && !!dict }

export const tagalogLoaded = () => !!dict

export function loadTagalog() {
  loading ??= import('./tl.js').then(m => {
    dict = m.default
    patterns = m.patterns || []
  }).catch(err => { loading = null; throw err })
  return loading
}
