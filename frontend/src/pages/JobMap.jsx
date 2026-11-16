/**
 * Job Map — every open job and gig in Oriental Mindoro on one map.
 * Rendered on its own at /map and inside the dashboard (embedded) at /dashboard/map.
 * Same data as Job Search (/api/jobs), so the map, the list and the job pages agree.
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { PublicNav } from '../components/PublicShell.jsx'
import BrandLoader from '../components/BrandLoader.jsx'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { IconX, IconPin } from '../components/icons.jsx'
import { fmtSalary } from '../components/JobCard.jsx'
import { CATEGORIES } from '../utils/categories.js'
import '../styles/platform.css'

/* The 15 municipalities: town centre and what each is known for */
export const LGUS = {
  'Puerto Galera':  { coords: [13.5015, 120.9567], desc: 'Tourism, diving and marine work' },
  'San Teodoro':    { coords: [13.4300, 121.0180], desc: 'Eco-tourism and upland farming' },
  'Baco':           { coords: [13.3592, 121.0964], desc: 'Farming and river communities' },
  'Calapan City':   { coords: [13.4115, 121.1803], desc: 'Provincial capital and commercial hub' },
  'Naujan':         { coords: [13.3236, 121.3031], desc: 'Rice granary and Naujan Lake' },
  'Victoria':       { coords: [13.1764, 121.2828], desc: 'Calamansi capital of the Philippines' },
  'Socorro':        { coords: [13.0642, 121.4056], desc: 'Agriculture and lake trade' },
  'Pola':           { coords: [13.1467, 121.4361], desc: 'Coastal town and marine sanctuary' },
  'Pinamalayan':    { coords: [13.0333, 121.4833], desc: 'Central trade hub' },
  'Gloria':         { coords: [12.9772, 121.4744], desc: 'Agro-industrial corridor' },
  'Bansud':         { coords: [12.8639, 121.4861], desc: 'Metal work and upland farming' },
  'Bongabong':      { coords: [12.7483, 121.4878], desc: 'Southern farm trading post' },
  'Roxas':          { coords: [12.5858, 121.5175], desc: 'Ro-Ro port gateway' },
  'Mansalay':       { coords: [12.5297, 121.4386], desc: 'Mangyan heritage and fisheries' },
  'Bulalacao':      { coords: [12.3278, 121.3417], desc: 'Southern islands and fisheries' },
}
export const TOWN_NAMES = Object.keys(LGUS)
const ALL = ''

/* The province with a little sea around it: the map cannot leave this box */
const PROVINCE = L.latLngBounds([12.15, 120.72], [13.62, 121.70])
/* where the 15 towns are: what the map opens on */
const TOWNS_BOX = L.latLngBounds([12.30, 120.93], [13.53, 121.55])

/* An approximate outline of Oriental Mindoro, traced a little offshore so no land is
   cut. Everything outside it is faded, so the eye stays on the province. */
const OUTLINE = [
  [13.56, 120.78], [13.57, 120.95], [13.50, 121.08], [13.47, 121.20], [13.40, 121.30],
  [13.27, 121.42], [13.15, 121.49], [13.02, 121.54], [12.87, 121.55], [12.73, 121.55],
  [12.58, 121.58], [12.48, 121.50], [12.37, 121.46], [12.26, 121.42], [12.18, 121.30],
  [12.24, 121.16], [12.45, 121.10], [12.68, 121.14], [12.90, 121.11], [13.10, 121.03],
  [13.27, 120.95], [13.42, 120.84],
]
const WORLD = [[-89, -179], [-89, 179], [89, 179], [89, -179]]

const MSG = { worker: '/dashboard/worker/messages' }
const TYPE_LABEL = { 'full-time': 'Full-time', 'part-time': 'Part-time', contractual: 'Contractual', freelance: 'Freelance', gig: 'Gig' }
const CLUSTER_UNTIL = 11 // below this zoom, a town's posts show as one numbered circle

function townOf(location) {
  const l = String(location || '').toLowerCase()
  return TOWN_NAMES.find(t => l.includes((t === 'Calapan City' ? 'calapan' : t).toLowerCase())) || null
}

/** Spread one town's posts around its centre so pins never sit on top of each other. */
function spot(town, i, n) {
  const [lat, lng] = LGUS[town].coords
  if (n <= 1) return [lat, lng]
  const ring = Math.floor(i / 8)
  const angle = ((i % 8) / Math.min(8, n)) * Math.PI * 2 + ring * 0.4
  const r = 0.006 + ring * 0.005
  return [lat + Math.sin(angle) * r, lng + Math.cos(angle) * r]
}

/* post text goes into the popup HTML, so it is escaped first */
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const level = s => (s >= 75 ? 'Strong match' : s >= 50 ? 'Good match' : 'Low match')

/**
 * Job Map: the same posts as Job Search (from /api/jobs, so the map, the list and the job
 * pages always agree), on a map of Oriental Mindoro. Filters on top, the list beside the
 * map (a swipe-up sheet on phones), pins by type, one numbered circle per town when zoomed
 * out, and a small card with match score, pay and Apply / View on each pin.
 */
export default function JobMap({ embedded = false, basePath = '/jobs' }) {
  const nav = useNavigate()
  const { user, call } = useAuth()
  const isWorker = user?.account_type === 'worker' && user?.role !== 'admin'
  const [jobs, setJobs] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [cat, setCat] = useState('')
  const [town, setTown] = useState('')
  const [minMatch, setMinMatch] = useState(0)
  const [activeId, setActiveId] = useState(null)
  const [sheet, setSheet] = useState(true)
  const [zoom, setZoom] = useState(9)
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const markers = useRef({})

  // every open post, up to 100 (two pages), with the viewer's match when they are a worker
  useEffect(() => {
    const get = path => (user && call ? call(path) : api(path))
    setError('')
    Promise.all([get('/jobs?limit=50&page=1&sort=recent'), get('/jobs?limit=50&page=2&sort=recent')])
      .then(([a, b]) => {
        const seen = new Set()
        setJobs([...(a.jobs || []), ...(b.jobs || [])].filter(j => !seen.has(j.id) && seen.add(j.id)))
      })
      .catch(() => { setError('We couldn’t load the map posts. Please refresh in a moment.'); setJobs([]) })
  }, [user, call])

  const placed = useMemo(() => {
    const byTown = {}
    for (const j of jobs || []) { const t = townOf(j.location); if (t) (byTown[t] ||= []).push(j) }
    return Object.entries(byTown).flatMap(([t, list]) => list.map((j, i) => ({ ...j, town: t, pos: spot(t, i, list.length) })))
  }, [jobs])

  const shown = useMemo(() => placed.filter(j => {
    if (type && (j.post_type || 'job') !== type) return false
    if (cat && j.category !== cat) return false
    if (town && j.town !== town) return false
    if (minMatch && Number(j.match?.score ?? 0) < minMatch) return false
    if (q) { const t = `${j.title} ${j.company} ${j.employer_name} ${j.skills_needed}`.toLowerCase(); if (!t.includes(q.toLowerCase())) return false }
    return true
  }).sort((a, b) => (isWorker ? Number(b.match?.score ?? 0) - Number(a.match?.score ?? 0) : 0) || String(b.created_at).localeCompare(String(a.created_at))),
  [placed, type, cat, town, minMatch, q, isWorker])

  /* the map, held inside the province, opening on all 15 towns */
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return
    const map = L.map(mapEl.current, { maxBounds: PROVINCE.pad(0.04), maxBoundsViscosity: 1, minZoom: 8, maxZoom: 17, zoomControl: false, zoomSnap: 0.5 })
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 17, attribution: '© Esri' }).addTo(map)
    map.attributionControl.setPrefix(false)
    L.control.zoom({ position: 'topright' }).addTo(map)
    L.polygon([WORLD, OUTLINE], { stroke: false, fillColor: '#F3F5F9', fillOpacity: 0.72, interactive: false }).addTo(map)
    L.polyline([...OUTLINE, OUTLINE[0]], { color: '#0D1B3E', weight: 1.2, opacity: 0.35, dashArray: '4 4', interactive: false }).addTo(map)
    map.setMinZoom(map.getBoundsZoom(PROVINCE, false))
    map.fitBounds(TOWNS_BOX, { padding: [24, 24] })
    setZoom(map.getZoom())
    map.on('zoomend', () => setZoom(map.getZoom()))
    // links inside popups stay in the app
    map.on('popupopen', e => {
      e.popup.getElement()?.querySelectorAll('a[data-spa]').forEach(a => { a.onclick = ev => { ev.preventDefault(); nav(a.getAttribute('href')) } })
    })
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const detailTo = j => `${basePath}/${j.id}`
  function popupHtml(j) {
    const isGig = j.post_type === 'gig'
    const pay = (j.salary_min || j.salary_max) ? fmtSalary(j.salary_min, j.salary_max) : (isGig ? 'Price to discuss' : 'Pay to discuss')
    const m = j.match
    const act = !user ? 'Sign in to apply' : isWorker ? (isGig ? 'Send proposal' : 'Apply') : 'View'
    return `<div class="jm2-pop">
      <span class="pf-type ${isGig ? 'gig' : 'job'}">${isGig ? 'Gig' : 'Job'}</span>
      <b>${esc(j.title)}</b>
      <div class="pf-small">${esc(j.company || j.employer_name || '')}${Number(j.employer_verified) === 1 ? ' · ✓ Verified' : ''}</div>
      <div class="pf-small">${esc([j.barangay, j.town].filter(Boolean).join(', '))} · ${esc(TYPE_LABEL[j.job_type] || '')}</div>
      <div style="font-weight:700;margin-top:4px">${esc(pay)}</div>
      ${m ? `<div class="pf-small" style="margin-top:2px"><b>${m.score}%</b> · ${esc(m.level_label || level(m.score))}${(m.gaps || []).length ? ` · Missing: ${esc(m.gaps.slice(0, 2).map(g => g.name).join(', '))}` : ''}</div>` : ''}
      <div class="pf-actions"><a data-spa class="btn btn-primary btn-sm" href="${detailTo(j)}">${act}</a><a data-spa class="btn btn-light btn-sm" href="${detailTo(j)}">View details</a></div>
    </div>`
  }

  /* pins and town circles, redrawn when the filters or the zoom change */
  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers(); markers.current = {}
    if (zoom < CLUSTER_UNTIL) {
      const byTown = {}
      shown.forEach(j => (byTown[j.town] ||= []).push(j))
      Object.entries(byTown).forEach(([t, list]) => {
        if (list.length === 1) return addPin(list[0])
        const icon = L.divIcon({ className: '', html: `<div class="jm2-cluster" title="${esc(t)}">${list.length}</div>`, iconSize: [42, 42], iconAnchor: [21, 21] })
        L.marker(LGUS[t].coords, { icon, keyboard: true, title: `${list.length} posts in ${t}` })
          .on('click', () => map.flyTo(LGUS[t].coords, 13, { duration: 0.7 }))
          .addTo(layer)
      })
    } else shown.forEach(addPin)
    function addPin(j) {
      const isGig = j.post_type === 'gig'
      const icon = L.divIcon({ className: '', html: `<div class="jm2-pin ${isGig ? 'gig' : 'job'}"><span>${j.match ? j.match.score : isGig ? 'G' : 'J'}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] })
      const mk = L.marker(j.pos, { icon, keyboard: true, title: j.title }).bindPopup(popupHtml(j), { maxWidth: 280 }).on('click', () => setActiveId(j.id)).addTo(layer)
      markers.current[j.id] = mk
    }
  }, [shown, zoom]) // eslint-disable-line react-hooks/exhaustive-deps

  // a town filter moves the map there
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (town) map.flyTo(LGUS[town].coords, 13, { duration: 0.7 })
    else map.flyToBounds(TOWNS_BOX, { padding: [24, 24], duration: 0.7 })
  }, [town])

  function focus(j) {
    setActiveId(j.id)
    const map = mapRef.current
    if (!map) return
    if (map.getZoom() < CLUSTER_UNTIL) map.setView(j.pos, 13)
    else map.panTo(j.pos)
    setTimeout(() => markers.current[j.id]?.openPopup(), 350)
    if (window.matchMedia('(max-width: 900px)').matches) setSheet(false)
  }

  return (
    <div className={embedded ? 'page-inner' : ''} style={embedded ? { maxWidth: 'none' } : undefined}>
      {!embedded && <PublicNav />}
      <div style={embedded ? undefined : { maxWidth: 1280, margin: '0 auto', padding: '18px 16px 24px' }}>
        {!embedded && (
          <div style={{ marginBottom: 12 }}>
            <h1 className="pf-h" style={{ fontSize: 24 }}>Job Map</h1>
            <p className="pf-sub" style={{ margin: 0 }}>Open jobs and gigs across Oriental Mindoro’s 15 towns.</p>
          </div>
        )}
        <div className="jm2-filters" role="group" aria-label="Map filters">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search title or skill" aria-label="Search" style={{ flex: '1 1 200px' }} />
          <select value={type} onChange={e => setType(e.target.value)} aria-label="Type"><option value="">Jobs and gigs</option><option value="job">Jobs</option><option value="gig">Gigs</option></select>
          <select value={cat} onChange={e => setCat(e.target.value)} aria-label="Kind of work"><option value="">Any kind of work</option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select value={town} onChange={e => setTown(e.target.value)} aria-label="Town"><option value="">All towns</option>{TOWN_NAMES.map(t => <option key={t}>{t}</option>)}</select>
          {isWorker && <select value={minMatch} onChange={e => setMinMatch(Number(e.target.value))} aria-label="Match"><option value={0}>Any match</option><option value={50}>Good match or better</option><option value={75}>Strong match only</option></select>}
          {(q || type || cat || town || minMatch) ? <button type="button" className="btn btn-light btn-sm" onClick={() => { setQ(''); setType(''); setCat(''); setTown(''); setMinMatch(0) }}><IconX size={13} /> Clear</button> : null}
        </div>
        {error && <div className="pf-note bad" role="alert" style={{ marginBottom: 10 }}>{error}</div>}
        <div className={`jm2${embedded ? '' : ' public'}`}>
          <aside className={`jm2-list${sheet ? '' : ' collapsed'}`} aria-label="Posts on the map">
            <button type="button" className="jm2-handle" aria-label={sheet ? 'Hide the list' : 'Show the list'} onClick={() => setSheet(s => !s)} />
            <div className="jm2-list-hd pf-between">
              <b>{jobs ? `${shown.length} post${shown.length === 1 ? '' : 's'}${town ? ` in ${town}` : ''}` : 'Loading…'}</b>
              <span className="pf-small">{isWorker ? 'Best match first' : 'Newest first'}</span>
            </div>
            <div className="jm2-scroll">
              {!jobs ? <BrandLoader compact label="Loading posts…" />
                : shown.length === 0 ? (
                  <div className="pf-empty" style={{ padding: 20 }}>
                    <IconPin size={30} /><h2 style={{ fontSize: 16 }}>No posts here</h2>
                    <p style={{ fontSize: 13.5 }}>{jobs.length ? 'Try another town, type or kind of work.' : 'There are no open posts yet. Check back soon.'}</p>
                  </div>
                ) : shown.map(j => (
                  <button key={j.id} type="button" className={`jm2-item${activeId === j.id ? ' on' : ''}`} onClick={() => focus(j)}>
                    <span className="pf-between"><span className={`pf-type ${j.post_type === 'gig' ? 'gig' : 'job'}`}>{j.post_type === 'gig' ? 'Gig' : 'Job'}</span>
                      {j.match && <span className={`chip ${j.match.score >= 75 ? 'green' : j.match.score >= 50 ? 'gold' : 'red'}`}>{j.match.score}%</span>}</span>
                    <b style={{ marginTop: 4 }}>{j.title}</b>
                    <small>{[j.company || j.employer_name, [j.barangay, j.town].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</small>
                    <small style={{ display: 'block', color: 'var(--ink)', fontWeight: 600 }}>{(j.salary_min || j.salary_max) ? fmtSalary(j.salary_min, j.salary_max) : 'Pay to discuss'}</small>
                  </button>
                ))}
            </div>
          </aside>
          <div className="jm2-map">
            <div ref={mapEl} style={{ position: 'absolute', inset: 0 }} role="application" aria-label="Map of Oriental Mindoro with job posts" />
            <div className="jm2-legend" aria-hidden="true">
              <span><i style={{ background: 'var(--navy)' }} />Job</span>
              <span><i style={{ background: 'var(--gold)' }} />Gig</span>
              <span><i style={{ background: 'rgba(13,27,62,.9)', border: '2px solid var(--gold)' }} />Several posts (tap to zoom)</span>
            </div>
          </div>
        </div>
        {!user && <p className="pf-small" style={{ marginTop: 10 }}><Link to="/login" state={{ from: '/map' }}>Sign in</Link> to see your match score on every pin.</p>}
      </div>
    </div>
  )
}
