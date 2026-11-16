/**
 * MindoroMap — the real map of Oriental Mindoro for the landing page.
 *
 * Every town is drawn from its official boundary (data/orientalMindoro.js) and carries a
 * pin sized by its open jobs, pulsing where there is work. Point at a town (or tap it on a
 * phone) and a card pops up with its count and newest openings; click through to its jobs.
 *
 * Props
 *   counts  { 'Baco': 5, ... } open jobs per town (GET /jobs/towns)
 *   jobs    newest postings (GET /jobs?sort=recent), used for the pop-up
 *   t       the landing page's translate function
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MAP_VIEWBOX, TOWN_SHAPES } from '../data/orientalMindoro.js'
import { IconArrow, IconBriefcase } from './icons.jsx'

const [, , VB_W, VB_H] = MAP_VIEWBOX.split(' ').map(Number)
// names written on the map: the capital, the ports and the main towns along the coast
const LABELS = ['Calapan City', 'Puerto Galera', 'Naujan', 'Pinamalayan', 'Bongabong', 'Roxas', 'Bulalacao']
const townOf = loc => {
  const l = String(loc || '').toLowerCase()
  return TOWN_SHAPES.find(s => l.includes(s.name === 'Calapan City' ? 'calapan' : s.name.toLowerCase()))?.name || null
}
const cap = v => (v ? String(v).charAt(0).toUpperCase() + String(v).slice(1) : '')
function pay(j) {
  const n = Number(j.salary_min || j.salary_max || 0)
  if (!n) return null
  const unit = { month: '/mo', day: '/day', hour: '/hr', fixed: '' }[j.pay_basis || 'month'] ?? '/mo'
  return `₱${n.toLocaleString('en-PH')}${unit}`
}

export default function MindoroMap({ counts = {}, jobs = [], t }) {
  const nav = useNavigate()
  const [hover, setHover] = useState(null)
  const leave = useRef(null)
  const touch = useRef(false)
  useEffect(() => () => clearTimeout(leave.current), [])

  const byTown = useMemo(() => {
    const m = {}
    jobs.forEach(j => { const tw = townOf(j.location); if (tw) (m[tw] ||= []).push(j) })
    return m
  }, [jobs])
  // until the per-town counts arrive, count the postings we already have
  const shown = useMemo(() => {
    if (Object.keys(counts).length) return counts
    const m = {}
    Object.entries(byTown).forEach(([k, v]) => { m[k] = v.length })
    return m
  }, [counts, byTown])
  const max = Math.max(1, ...Object.values(shown))

  const show = name => { clearTimeout(leave.current); setHover(name) }
  const hide = () => { clearTimeout(leave.current); leave.current = setTimeout(() => setHover(null), 160) }
  const go = name => nav(`/jobs?location=${encodeURIComponent(name)}`)
  const onTap = name => {
    // phones: first tap opens the card, the card's button goes to the jobs
    if (touch.current && hover !== name) { show(name); return }
    go(name)
  }
  const count = name => {
    const n = shown[name] || 0
    return n === 0 ? t('lp.map.none') : n === 1 ? t('lp.map.job') : t('lp.map.jobs').replace('{n}', n)
  }

  const town = hover ? TOWN_SHAPES.find(s => s.name === hover) : null
  const right = town && town.x / VB_W > 0.5   // open the card toward the middle of the map
  const below = town && town.y / VB_H < 0.22  // northern towns: open downward
  const list = town ? (byTown[town.name] || []).slice(0, 2) : []

  return (
    <div className="mm" role="group" aria-label={t('lp.map.label')} onPointerDown={e => { touch.current = e.pointerType === 'touch' }}>
      <svg className="mm-svg" viewBox={MAP_VIEWBOX}>
        <defs>
          <radialGradient id="mmGlow" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#3B5BAA" stopOpacity=".55" />
            <stop offset="100%" stopColor="#0D1B3E" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx={VB_W / 2} cy={VB_H / 2} rx={VB_W * 0.62} ry={VB_H * 0.55} fill="url(#mmGlow)" />
        <g className="mm-towns">
          {TOWN_SHAPES.map((s, k) => (
            <path key={s.name} d={s.d} pathLength="1" style={{ '--d': `${k * 0.06}s` }}
              className={`mm-town${hover === s.name ? ' on' : ''}`}
              tabIndex={0} role="link" aria-label={`${s.name}: ${count(s.name)}`}
              onMouseEnter={() => show(s.name)} onMouseLeave={hide}
              onFocus={() => show(s.name)} onBlur={hide}
              onClick={() => onTap(s.name)} onKeyDown={e => { if (e.key === 'Enter') go(s.name) }} />
          ))}
        </g>
        <g className="mm-pins" aria-hidden="true">
          {TOWN_SHAPES.map((s, k) => {
            const n = shown[s.name] || 0
            const r = n ? 3.2 + (n / max) * 5.5 : 2.4
            return (
              <g key={s.name} className={`mm-pin${n ? ' has' : ''}${hover === s.name ? ' on' : ''}`} style={{ '--d': `${0.9 + k * 0.05}s` }}>
                {n > 0 && <circle className="mm-pulse" cx={s.x} cy={s.y} r={r + 6} style={{ animationDelay: `${(k % 5) * 0.5}s` }} />}
                <circle className="mm-dot" cx={s.x} cy={s.y} r={r} />
              </g>
            )
          })}
        </g>
        <g className="mm-labels" aria-hidden="true">
          {TOWN_SHAPES.filter(s => LABELS.includes(s.name)).map(s => (
            <text key={s.name} x={s.x + 13} y={s.y + 4} className={hover === s.name ? 'on' : ''}>{s.name}</text>
          ))}
        </g>
      </svg>

      {town && (
        <div key={town.name} className={`mm-pop${right ? ' r' : ''}${below ? ' b' : ''}`}
          style={{ left: `${(town.x / VB_W) * 100}%`, top: `${(town.y / VB_H) * 100}%` }}
          onMouseEnter={() => show(town.name)} onMouseLeave={hide}>
          <div className="mm-pop-hd">
            <span className="mm-pop-ic"><IconBriefcase size={16} /></span>
            <div><b>{town.name}</b><span>{count(town.name)}</span></div>
          </div>
          {list.length > 0 && (
            <ul>
              {list.map(j => (
                <li key={j.id}><span>{cap(j.title)}</span>{pay(j) && <em>{pay(j)}</em>}</li>
              ))}
            </ul>
          )}
          <Link to={`/jobs?location=${encodeURIComponent(town.name)}`} className="mm-pop-go">
            {t('lp.map.view')} <IconArrow size={14} />
          </Link>
        </div>
      )}
    </div>
  )
}
