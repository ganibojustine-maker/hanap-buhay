/**
 * Pager: the one way every list in hanapbuhay is paged and sorted.
 *
 *   const sorts = { new: ['Newest first', (a, b) => …], price: ['Lowest price', …] }
 *   const pg = usePaged(items, { sorts, perPage: 10 })
 *   <ListTools pg={pg} noun="proposal" />          "24 proposals · Sort by [Newest first] · [10 per page]"
 *   {pg.items.map(…)}                              only this page's rows
 *   <Pager pg={pg} />                              "Showing 11–20 of 24   ‹ 1 2 3 ›"
 *
 * Lists the server already pages (Job Search, Find Workers) use <Pager> alone with
 * { page, pages, total, perPage, setPage } of their own.
 *
 * The page goes back to 1 when the list or the sort changes, and the view scrolls to the
 * top of the list when the page changes, so nobody lands in the middle of page 3.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import '../styles/platform.css'

const byDate = k => (a, b) => String(b[k] || '').localeCompare(String(a[k] || ''))
const byNum = (k, dir = -1) => (a, b) => dir * (Number(a[k] || 0) - Number(b[k] || 0))
const byText = k => (a, b) => String(a[k] || '').localeCompare(String(b[k] || ''), 'en', { sensitivity: 'base' })
/** Ready-made comparators: SORT.date('created_at'), SORT.num('amount'), SORT.num('amount', 1) (low first), SORT.text('title'). */
export const SORT = { date: byDate, num: byNum, text: byText }

export function usePaged(list, { sorts = null, initialSort, perPage: initialPer = 10 } = {}) {
  const keys = sorts ? Object.keys(sorts) : []
  const [sort, setSort] = useState(initialSort || keys[0] || '')
  const [perPage, setPerPage] = useState(initialPer)
  const [page, setPageRaw] = useState(1)
  const top = useRef(null)
  const all = useMemo(() => {
    const arr = Array.isArray(list) ? [...list] : []
    const cmp = sorts?.[sort]?.[1]
    return cmp ? arr.sort(cmp) : arr
  }, [list, sort]) // eslint-disable-line react-hooks/exhaustive-deps
  const total = all.length
  const pages = Math.max(1, Math.ceil(total / perPage))
  // back to page 1 when a filter or search changes what is in the list (not when one row is updated)
  const sig = Array.isArray(list) ? `${list.length}:${list[0]?.id ?? ''}:${list[list.length - 1]?.id ?? ''}` : ''
  useEffect(() => { setPageRaw(1) }, [sort, perPage, sig])
  useEffect(() => { if (page > pages) setPageRaw(pages) }, [page, pages])
  const setPage = p => {
    setPageRaw(Math.min(Math.max(1, p), pages))
    const el = top.current
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const start = (page - 1) * perPage
  return {
    items: all.slice(start, start + perPage), all, total, page, pages, perPage, setPage, setPerPage,
    sort, setSort, sorts, from: total ? start + 1 : 0, to: Math.min(total, start + perPage), top,
  }
}

/** Page numbers with gaps: 1 … 4 5 6 … 12 */
function numbers(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const out = [1]
  const a = Math.max(2, page - 1), b = Math.min(pages - 1, page + 1)
  if (a > 2) out.push('…')
  for (let i = a; i <= b; i++) out.push(i)
  if (b < pages - 1) out.push('…')
  out.push(pages)
  return out
}

export function Pager({ pg, label = 'Pages' }) {
  const { page, pages, total, perPage, setPage } = pg
  if (!total || pages <= 1) return null
  const from = pg.from ?? (page - 1) * perPage + 1
  const to = pg.to ?? Math.min(total, page * perPage)
  return (
    <nav className="pgr" aria-label={label}>
      <span className="pgr-info">Showing <b>{from.toLocaleString('en-PH')}–{to.toLocaleString('en-PH')}</b> of <b>{Number(total).toLocaleString('en-PH')}</b></span>
      <span className="pgr-btns">
        <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Previous page">‹</button>
        {numbers(page, pages).map((n, i) => n === '…'
          ? <span key={`g${i}`} className="pgr-gap" aria-hidden="true">…</span>
          : <button key={n} type="button" className={n === page ? 'on' : ''} aria-current={n === page ? 'page' : undefined} onClick={() => setPage(n)} aria-label={`Page ${n}`}>{n}</button>)}
        <button type="button" onClick={() => setPage(page + 1)} disabled={page >= pages} aria-label="Next page">›</button>
      </span>
    </nav>
  )
}

/** "24 proposals · Sort by … · 10 per page" above a list. children go on the left, after the count. */
export function ListTools({ pg, noun = 'result', plural, children, perPageOptions = [10, 20, 50] }) {
  const n = pg.total
  const word = n === 1 ? noun : (plural || `${noun}s`)
  return (
    <div className="lt" ref={pg.top}>
      <span className="lt-count"><b>{n.toLocaleString('en-PH')}</b> {word}{children}</span>
      <span className="lt-ctrl">
        {pg.sorts && Object.keys(pg.sorts).length > 1 && (
          <label>Sort by
            <select value={pg.sort} onChange={e => pg.setSort(e.target.value)}>
              {Object.entries(pg.sorts).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
        )}
        {n > perPageOptions[0] && (
          <label className="lt-per">Show
            <select value={pg.perPage} onChange={e => pg.setPerPage(Number(e.target.value))} aria-label="Rows per page">
              {perPageOptions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        )}
      </span>
    </div>
  )
}
