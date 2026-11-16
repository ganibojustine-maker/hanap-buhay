/**
 * TrainingBrowser — TESDA training in Oriental Mindoro, public and in the dashboard.
 *
 * The catalogue is the TESDA list that ships with the app, merged with anything an admin
 * added. What makes it useful rather than a directory is the ordering: for a signed-in
 * worker the courses that close the skill gaps on their best-matching jobs come first,
 * then the ones their neighbours are enrolling in, then everything else.
 *
 * "I enrolled" is recorded (course_enrollments) so the page can later ask for the
 * certificate and push it into the Skills Passport — which is where the verified skill
 * that raised their match score came from in the first place.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth.jsx'
import { api } from '../../api.js'
import {
  IconSearch, IconBook, IconPin, IconClock, IconShield, IconArrow, IconCheck,
  IconBookmark, IconSpark, IconUsers, IconPlus, IconX,
} from '../../components/icons.jsx'
import { TOWNS } from '../../components/art.jsx'
import { getCourseImage } from '../../utils/jobImages.js'
import {
  TESDA_COURSES, TESDA_ONLINE, TESDA_SOURCE_DATE, COURSE_CATEGORIES,
  townsLabel, mergeCourses, coursesForSkill, enrollUrl,
} from '../../utils/tesdaCourses.js'
import { tr } from '../../lang/dash.js'
import '../../styles/training.css'

const asOf = new Date(TESDA_SOURCE_DATE).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })

/** NC I/II/III tells you roughly how long and how deep a course is. */
const NC_NOTE = {
  'NC I': 'Entry level — the basics an assistant or helper needs.',
  'NC II': 'The level most employers ask for. Qualifies you to work on your own.',
  'NC III': 'Supervisory level — lead a small team or take complex jobs.',
  'NC IV': 'Specialist level, usually with planning and supervision duties.',
}
const ncOf = title => (String(title).match(/\bNC\s*(IV|III|II|I)\b/i) || [])[0]?.toUpperCase().replace(/\s+/, ' ') || null

function SortChips({ value, onChange, options }) {
  return (
    <div className="tc-chips" role="group" aria-label="Sort courses">
      {options.map(([id, label]) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}>{label}</button>
      ))}
    </div>
  )
}

/* ─ One course ───────────────────────────────────────────── */
function CourseCard({ course, gapFor, enrolled, saved, enrollees, myTown, onSave, onEnroll, signedIn }) {
  const nc = ncOf(course.title)
  const inMyTown = myTown && course.towns?.[myTown]
  const [open, setOpen] = useState(false)

  return (
    <article className={`tc-card${gapFor ? ' is-gap' : ''}`}>
      <div className="tc-shot">
        <img src={getCourseImage(course)} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }} />
        {gapFor && <span className="tc-flag"><IconSpark size={12} /> {tr('Closes a gap')}</span>}
        {signedIn && (
          <button type="button" className={`tc-save${saved ? ' on' : ''}`} onClick={() => onSave(course)}
            aria-pressed={saved} title={saved ? tr('Saved') : tr('Save this course')} aria-label={saved ? tr('Remove from saved courses') : tr('Save this course')}>
            <IconBookmark size={15} />
          </button>
        )}
      </div>

      <div className="tc-body">
        <div className="tc-tags">
          {course.category && <span className="tc-tag cat">{course.category}</span>}
          <span className="tc-tag tesda"><IconShield size={11} /> {tr('TESDA registered')}</span>
          {nc && <span className="tc-tag nc">{nc}</span>}
          {inMyTown ? <span className="tc-tag near"><IconPin size={11} /> {tr('{n} in {town}', { n: course.towns[myTown], town: myTown })}</span> : null}
        </div>

        <h3>{course.title}</h3>
        {course.desc && <p className="tc-desc">{course.desc}</p>}

        {gapFor && (
          <p className="tc-gap-why">
            <IconSpark size={13} /> {gapFor.jobs === 1 ? tr('1 open job asks for') : tr('{n} open jobs ask for', { n: gapFor.jobs })} <b>{gapFor.skill}</b>
            {gapFor.job_titles?.length ? <> — {gapFor.job_titles.slice(0, 2).join(', ')}</> : null}
          </p>
        )}

        <dl className="tc-facts">
          {course.schools != null && (
            <div><dt><IconBook size={13} /> {tr('Schools')}</dt>
              <dd>{tr('{n} TESDA-registered schools in the province', { n: course.schools })}</dd></div>
          )}
          <div><dt><IconPin size={13} /> {tr('Where')}</dt><dd>{townsLabel(course)}</dd></div>
          {course.duration && <div><dt><IconClock size={13} /> {tr('Length')}</dt><dd>{course.duration}</dd></div>}
          <div><dt><IconUsers size={13} /> {tr('On hanapbuhay')}</dt>
            <dd>{enrollees > 0 ? (enrollees === 1 ? tr('1 person enrolled') : tr('{n} people enrolled', { n: enrollees })) : tr('Be the first to enrol')}</dd></div>
          {course.is_free || course.cost === 0 ? <div><dt>{tr('₱ Cost')}</dt><dd>{tr('Free with a TESDA scholarship slot (TWSP / STEP)')}</dd></div> : null}
        </dl>

        {nc && NC_NOTE[nc] && (
          <button type="button" className="tc-what" onClick={() => setOpen(v => !v)} aria-expanded={open}>
            {tr('What does {nc} mean?', { nc })} {open ? <IconX size={11} /> : <IconPlus size={11} />}
          </button>
        )}
        {open && <p className="tc-what-body">{tr(NC_NOTE[nc])}</p>}

        <div className="tc-actions">
          <a href={enrollUrl(course)} target="_blank" rel="noopener noreferrer" className="btn btn-navy btn-sm"
            onClick={() => onEnroll?.(course)}
            aria-label={tr("Enrol in {course}: opens TESDA's list of schools in a new tab", { course: course.title })}>
            {enrolled ? tr('Open school list') : tr('Enrol on TESDA')} <IconArrow size={14} />
          </a>
          {signedIn && (
            enrolled
              ? <span className="tc-enrolled"><IconCheck size={13} /> {enrolled.status === 'completed' ? tr('Finished') : tr('Enrolled')}</span>
              : null
          )}
        </div>
      </div>
    </article>
  )
}

/* ─ Page ─────────────────────────────────────────────────── */
export default function TrainingBrowser({ embedded = false, heading = false }) {
  const { user, call } = useAuth()
  const signedIn = !!user
  const isWorker = user?.account_type === 'worker' && user?.role !== 'admin'
  const myTown = TOWNS.includes(user?.location) ? user.location : ''

  const [courses, setCourses] = useState(TESDA_COURSES)
  const [gaps, setGaps] = useState([])
  const [stats, setStats] = useState({ enrollments: {}, saved: [], mine: [] })
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('All')
  const [town, setTown] = useState('')
  const [sort, setSort] = useState('recommended')
  const [busy, setBusy] = useState(null)

  // catalogue (public endpoint, works signed out)
  useEffect(() => { api('/training').then(r => setCourses(mergeCourses(r.courses))).catch(() => {}) }, [])

  const loadStats = useCallback(() => {
    if (!signedIn || !call) return
    call('/training/stats')
      .then(r => setStats({ enrollments: r.enrollments || {}, saved: r.saved || [], mine: r.mine || [] }))
      .catch(() => {})
  }, [signedIn, call])
  useEffect(() => { loadStats() }, [loadStats])

  // the skill gaps that decide the order, from the same endpoint as Job Matches
  useEffect(() => {
    if (!isWorker || !call) return
    call('/jobs/matches').then(r => setGaps(r.gaps || [])).catch(() => {})
  }, [isWorker, call])

  /** course id → the gap it closes (the most-wanted one wins) */
  const gapByCourse = useMemo(() => {
    const map = new Map()
    for (const g of gaps) {
      for (const c of coursesForSkill(g.skill, 2)) {
        const prev = map.get(c.id)
        if (!prev || g.jobs > prev.jobs) map.set(c.id, g)
      }
    }
    return map
  }, [gaps])

  const savedSet = useMemo(() => new Set(stats.saved), [stats.saved])
  const mineByCourse = useMemo(() => {
    const m = new Map()
    for (const e of stats.mine) m.set(e.course_id, e)
    return m
  }, [stats.mine])

  const list = useMemo(() => {
    const rows = courses.filter(c => {
      if (q && !`${c.title} ${c.desc || ''} ${c.category || ''}`.toLowerCase().includes(q.toLowerCase())) return false
      if (category !== 'All' && c.category !== category) return false
      if (town && !c.towns?.[town]) return false
      return true
    })
    const n = id => Number(stats.enrollments?.[id] || 0)
    const rank = c => {
      const gap = gapByCourse.get(c.id)
      return [
        gap ? -gap.jobs : 0,                 // courses that unlock the most jobs first
        myTown && c.towns?.[myTown] ? -1 : 0, // then ones taught in your own town
        -n(c.id),                             // then the popular ones
        -(c.schools || 0),
      ]
    }
    const by = {
      recommended: (a, b) => rank(a) < rank(b) ? -1 : rank(a) > rank(b) ? 1 : 0,
      popular: (a, b) => n(b.id) - n(a.id) || (b.schools || 0) - (a.schools || 0),
      nearby: (a, b) => (b.towns?.[town || myTown] || 0) - (a.towns?.[town || myTown] || 0) || (b.schools || 0) - (a.schools || 0),
      az: (a, b) => a.title.localeCompare(b.title),
    }
    return [...rows].sort(by[sort] || by.recommended)
  }, [courses, q, category, town, sort, gapByCourse, myTown, stats.enrollments])

  const gapCount = list.filter(c => gapByCourse.has(c.id)).length
  const finishedWaiting = stats.mine.filter(e => e.status === 'enrolled')

  async function toggleSave(course) {
    if (!signedIn) return
    const on = savedSet.has(course.id)
    setStats(s => ({ ...s, saved: on ? s.saved.filter(x => x !== course.id) : [...s.saved, course.id] }))
    try {
      if (on) await call(`/training/saved/${encodeURIComponent(course.id)}`, { method: 'DELETE' })
      else await call('/training/saved', { method: 'POST', body: { course_id: course.id, title: course.title } })
    } catch {
      loadStats() // put it back the way the server has it
    }
  }

  async function markEnrolled(course) {
    if (!signedIn || mineByCourse.has(course.id)) return
    setBusy(course.id)
    try {
      await call('/training/enroll', { method: 'POST', body: { course_id: course.id, title: course.title, provider: 'TESDA-registered school' } })
      loadStats()
    } catch { /* the TESDA tab still opened; nothing to undo */ }
    finally { setBusy(null) }
  }

  async function markFinished(enrollment) {
    try {
      await call(`/training/enrollments/${enrollment.id}`, { method: 'PATCH', body: { status: 'completed' } })
      loadStats()
    } catch { /* ignore */ }
  }

  return (
    <div className={`tc${embedded ? ' is-embedded' : ''}`}>
      {heading && (
        <div className="section-title" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <p className="eyebrow">{tr('Learn & grow')}</p>
            <h1 style={{ fontSize: 28, marginTop: 4 }}>{tr('Training & Courses')}</h1>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4, maxWidth: 650 }}>
              {isWorker
                ? tr('The courses that close the skill gaps on your matches come first.')
                : tr('TESDA-registered programs, and the schools that offer each one.')}
            </p>
          </div>
          <a href={TESDA_ONLINE} target="_blank" rel="noopener noreferrer" className="btn btn-light btn-sm">
            {tr('Free online courses (e-TESDA)')} <IconArrow size={14} />
          </a>
        </div>
      )}

      {/* my courses */}
      {signedIn && stats.mine.length > 0 && (
        <section className="tc-mine">
          <div className="tc-mine-hd">
            <h2><IconBook size={17} /> {tr('My courses')}</h2>
            <span>{tr('{a} enrolled · {b} finished', { a: stats.mine.length, b: stats.mine.filter(e => e.status === 'completed').length })}</span>
          </div>
          <ul>
            {stats.mine.slice(0, 6).map(e => (
              <li key={e.id}>
                <div>
                  <b>{e.title || e.course_id}</b>
                  <small>{e.status === 'completed' ? tr('Finished') : tr('Enrolled')}{e.provider ? ` · ${e.provider}` : ''}</small>
                </div>
                {e.status === 'completed'
                  ? <Link to="/dashboard/passport" className="btn btn-primary btn-sm">{tr('Upload certificate')}</Link>
                  : <button type="button" className="btn btn-light btn-sm" onClick={() => markFinished(e)}>{tr('I finished this')}</button>}
              </li>
            ))}
          </ul>
          {finishedWaiting.length === 0 && stats.mine.some(e => e.status === 'completed') && (
            <p className="tc-mine-tip">
              {tr('Upload it in your Skills Passport — a verified certificate counts for more in every match.')}
            </p>
          )}
        </section>
      )}

      {/* filters */}
      <div className="tc-filters">
        <div className="in">
          <IconSearch size={17} />
          <input placeholder={tr('Search courses, e.g. welding, cookery, computer')} value={q} onChange={e => setQ(e.target.value)} aria-label={tr('Search courses')} />
        </div>
        <div className="in">
          <IconBook size={17} />
          <select value={category} onChange={e => setCategory(e.target.value)} aria-label={tr('Category')}>
            {COURSE_CATEGORIES.map(c => <option key={c} value={c}>{tr(c)}</option>)}
          </select>
        </div>
        <div className="in">
          <IconPin size={17} />
          <select value={town} onChange={e => setTown(e.target.value)} aria-label={tr('Town')}>
            <option value="">{tr('All towns')}{myTown ? ` (${tr('yours')}: ${myTown})` : ''}</option>
            {TOWNS.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="tc-bar">
        <p>
          <b>{list.length}</b> {list.length === 1 ? tr('course') : tr('courses')}
          {town ? ` ${tr('with schools in {town}', { town })}` : ''}
          {gapCount > 0 && sort === 'recommended' ? <> · <span className="tc-gap-count">{tr('{n} close a skill gap on your matches', { n: gapCount })}</span></> : null}
        </p>
        <SortChips value={sort} onChange={setSort} options={[
          ['recommended', isWorker ? tr('For you') : tr('Recommended')],
          ['popular', tr('Most enrolled')],
          ['nearby', town || myTown ? tr('Most schools in {town}', { town: town || myTown }) : tr('Most schools')],
          ['az', tr('A–Z')],
        ]} />
      </div>

      {isWorker && gaps.length === 0 && (
        <p className="tc-hint">
          {tr('Add skills to your')} <Link to="/dashboard/passport">{tr('Skills Passport')}</Link> {tr('and the courses that unlock the most jobs move to the top.')}
        </p>
      )}

      {list.length === 0 ? (
        <div className="tc-empty">{tr('No course matches these filters. Try another town or category.')}</div>
      ) : (
        <div className="tc-grid">
          {list.map(c => (
            <CourseCard
              key={c.id}
              course={c}
              gapFor={gapByCourse.get(c.id)}
              enrolled={mineByCourse.get(c.id)}
              saved={savedSet.has(c.id)}
              enrollees={Number(stats.enrollments?.[c.id] || 0)}
              myTown={myTown}
              signedIn={signedIn}
              onSave={toggleSave}
              onEnroll={markEnrolled}
            />
          ))}
        </div>
      )}

      {/* how it works */}
      <section className="tc-how">
        <div>
          <p className="eyebrow light">{tr('How enrolling works')}</p>
          <h2>{tr('You enrol directly with a TESDA-registered school.')}</h2>
          <p>
            <b>{tr('Enrol')}</b> {tr("opens TESDA's official list of schools, with addresses and phone numbers. Ask them about free scholarship slots (TWSP, STEP). When you finish, upload the certificate to your Skills Passport.")}
          </p>
          <small>{tr("School counts are from TESDA as of {date}. TESDA's own list is always the most current.", { date: asOf })}</small>
        </div>
        <div className="tc-how-cta">
          <a href={TESDA_ONLINE} target="_blank" rel="noopener noreferrer" className="btn btn-light btn-lg">{tr('Free online courses (e-TESDA)')} <IconArrow /></a>
          {signedIn
            ? <Link to="/dashboard/passport" className="btn btn-primary btn-lg">{tr('Upload a certificate')} <IconArrow /></Link>
            : <Link to="/register" className="btn btn-primary btn-lg">{tr('Create a free account')} <IconArrow /></Link>}
        </div>
      </section>
    </div>
  )
}
