// Dashboard worker pages (split out of Dashboard.jsx so each role downloads only its own code).
import { FreelanceStrip } from './worker/WorkerGigs.jsx'
import { usePaged, Pager, ListTools, SORT } from '../../components/Pager.jsx'
import { useEffect, useRef, useState, useCallback } from 'react'
import { barangaysOf } from '../../data/barangays.js'
import { EDUCATION } from '../../utils/categories.js'
import { STATUS } from '../../utils/hiringStatus.js'
import { peso, phDate, phDateTime } from '../../utils/format.js'
import '../../styles/platform.css'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api.js'
import { IconUser, IconBriefcase, IconShield, IconFile, IconPin, IconMail, IconCheck, IconSpark, IconSearch, IconPlus, IconX, IconClock, IconArrow, IconCalendar, IconStar, IconPhone, IconWrench, IconBookmark, IconEye } from '../../components/icons.jsx'
import { TOWNS } from '../../components/art.jsx'
import ImageCropModal from '../../components/ImageCropModal.jsx'
import { getJobImage, getCourseImage } from '../../utils/jobImages.js'
import { FeaturedJobCard, useSavedJobs } from '../../components/JobCard.jsx'
import CertificateUpload from '../../components/CertificateUpload.jsx'
import WorkGallery from '../../components/WorkGallery.jsx'
import ReputationStrip from '../../components/ReputationStrip.jsx'
import { SKILL_LEVELS, SKILL_SOURCES, byId } from '../../utils/skillMeta.js'
import QuickApplyModal from '../../components/QuickApplyModal.jsx'
import '../../styles/overview.css'
import '../../styles/worker.css'
import { coursesForSkill, TESDA_COURSES } from '../../utils/tesdaCourses.js'
import { greet, days, ApplicationTracker } from './shared.jsx'
import { AvailabilityPanel, SharePassport, NextSteps, RateEmployer } from './WorkerTools.jsx'
import { tr } from '../../lang/dash.js'
import { avatarDataUrl } from '../../components/Avatar.jsx'
import BrandLoader from '../../components/BrandLoader.jsx'
import Dialog from '../../components/Dialog.jsx'
export { SavedJobs } from './WorkerTools.jsx'

/* ─ Worker Overview ───────────────────────────────────────
   Laid out like the home screen of any job app people already use:
     1. who you are and how ready your profile is
     2. anything waiting on you (only when there is something)
     3. jobs recommended for you            — best matches from your passport
     4. featured jobs near your town        — promoted posts, never repeating 3
     5. courses picked for you              — TESDA courses for the skills you lack
     6. your recent applications
   Each block shows different things; nothing on this page repeats another block.
*/
export function WorkerOverview({ user, call }) {
  const [loaded, setLoaded]     = useState(false)
  const [matches, setMatches]   = useState([])
  const [summary, setSummary]   = useState({})
  const [gaps, setGaps]         = useState([])
  const [featured, setFeatured] = useState([])
  const [apps, setApps]         = useState([])
  const [passport, setPassport] = useState({ score: 0, skills_count: 0 })
  const [appliedIds, setAppliedIds] = useState(new Set())
  const [invites, setInvites] = useState([])
  const [applying, setApplying] = useState(null)
  const [applyJob, setApplyJob] = useState(null)
  const savedJobs = useSavedJobs()
  const nav = useNavigate()
  const [query, setQuery] = useState('')

  useEffect(() => {
    Promise.allSettled([
      call('/skills/passport-score').then(r => setPassport(r)),
      call('/applications/my').then(r => {
        const arr = (r.applications || []).filter(a => a.status !== 'withdrawn')
        setApps(arr)
        setAppliedIds(new Set(arr.map(a => Number(a.job_id))))
      }),
      call('/jobs/matches').then(r => {
        setMatches((r.jobs || []).filter(j => !j.applied))
        setGaps(r.gaps || [])
        setSummary(r.summary || {})
      }),
      call('/jobs/featured?limit=12').then(r => setFeatured(r.jobs || [])),
      call('/invites/mine').then(r => setInvites(r.invites || [])),
    ]).finally(() => setLoaded(true))
  }, [call])

  const submitQuickApply = async (note, ack = false) => {
    const job = applyJob
    setApplying(job.id)
    try {
      await call('/applications', { method: 'POST', body: { job_id: job.id, cover_note: note, acknowledge_gap: ack } })
      setAppliedIds(prev => new Set([...prev, Number(job.id)]))
      setApplyJob(null)
    } finally {
      setApplying(null)
    }
  }

  // recommended = best matches; featured = promoted posts that are NOT already recommended
  const recommended = matches.filter(j => !appliedIds.has(Number(j.id))).slice(0, 3)
  const shown = new Set(recommended.map(j => Number(j.id)))
  const featuredRow = featured.filter(j => !shown.has(Number(j.id)) && !appliedIds.has(Number(j.id))).slice(0, 6)

  // courses for the skills the best jobs ask for; popular local courses when there are no gaps yet
  const myTown = TOWNS.includes(user?.location) ? user.location : ''
  const courseIds = new Set()
  const courses = []
  for (const g of gaps) for (const c of coursesForSkill(g.skill, 1)) {
    if (!courseIds.has(c.id) && courses.length < 4) { courseIds.add(c.id); courses.push({ ...c, why: g.skill }) }
  }
  if (courses.length < 4) {
    const local = [...TESDA_COURSES].sort((a, b) => (b.towns?.[myTown] || 0) - (a.towns?.[myTown] || 0) || (b.schools || 0) - (a.schools || 0))
    for (const c of local) { if (courses.length >= 4) break; if (!courseIds.has(c.id)) { courseIds.add(c.id); courses.push(c) } }
  }

  // what is waiting on this person, only from real records
  const todo = []
  const interview = apps.find(a => a.status === 'for_interview' && a.interview_date)
  if (interview) todo.push({ tone: 'go', icon: IconCalendar, to: '/dashboard/applied', cta: tr('View'),
    text: tr('Interview for {job} on {when}', { job: interview.job_title || tr('a job'),
      when: new Date(String(interview.interview_date).replace(' ', 'T')).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }) })
  const invite = invites[0]
  if (invite) todo.push({ tone: 'go', icon: IconSpark, to: `/dashboard/browse/${invite.job_id}`, cta: tr('See job'),
    text: invites.length === 1
      ? tr('{who} invited you to apply: {job}', { who: invite.company || invite.employer_name, job: invite.title })
      : tr('{n} employers invited you to apply, starting with {job}', { n: invites.length, job: invite.title }) })
  const hired = apps.find(a => a.status === 'hired')
  if (hired) todo.push({ tone: 'go', icon: IconStar, to: '/dashboard/reviews', cta: tr('Rate'), text: tr('You were hired for {job}. Rate the employer.', { job: hired.job_title || tr('a job') }) })
  const shortlisted = apps.filter(a => a.status === 'shortlisted').length
  if (shortlisted) todo.push({ tone: 'ok', icon: IconCheck, to: '/dashboard/applied', cta: tr('Open'), text: shortlisted === 1 ? tr('1 employer shortlisted you.') : tr('{n} employers shortlisted you.', { n: shortlisted }) })
  if (loaded && !user?.location) todo.push({ tone: 'warn', icon: IconPin, to: '/dashboard/profile', cta: tr('Add town'), text: tr('Add your town so jobs near you come first.') })

  const first = user.full_name?.split(' ')[0] || tr('there')
  const activeApps = apps.filter(a => !['hired', 'rejected'].includes(a.status)).length
  const town = summary.town || user?.location

  // application pipeline, from real records
  const stage = st => apps.filter(a => a.status === st).length
  const pipeline = [
    { key: 'pending',       label: tr('Sent'),        n: stage('pending') },
    { key: 'reviewed',      label: tr('Viewed'),      n: stage('reviewed') },
    { key: 'shortlisted',   label: tr('Shortlisted'), n: stage('shortlisted') },
    { key: 'for_interview', label: tr('Interview'),   n: stage('for_interview') },
    { key: 'hired',         label: tr('Hired'),       n: stage('hired') },
  ]
  const pipeMax = Math.max(1, ...pipeline.map(x => x.n))
  const interviews = apps.filter(a => a.status === 'for_interview')
  const nextInterview = interviews.map(a => a.interview_date).filter(Boolean).sort()[0]

  // what still lifts the profile, in the order employers notice it
  const steps = [
    { done: !!user?.location, text: tr('Add your town'), to: '/dashboard/profile' },
    { done: !!user?.phone, text: tr('Add a phone number'), to: '/dashboard/profile' },
    { done: !!user?.bio, text: tr('Write a short bio'), to: '/dashboard/profile' },
    { done: passport.skills_count >= 3, text: tr('List at least 3 skills'), to: '/dashboard/passport' },
  ]
  const nextStep = steps.find(x => !x.done)

  const goSearch = e => {
    e.preventDefault()
    const q = query.trim()
    nav(`/dashboard/browse${q ? `?q=${encodeURIComponent(q)}` : ''}`)
  }

  if (!loaded) return <div className="page-inner"><BrandLoader compact label={tr('Loading your dashboard…')} /></div>

  return (
    <div className="page-inner ov">
      {applyJob && (
        <QuickApplyModal job={applyJob} user={user} skills={applyJob.match?.matched || []}
          onClose={() => setApplyJob(null)} onSubmit={submitQuickApply} />
      )}

      {/* 1 — hello, quick search, profile strength */}
      <section className="ov-hero">
        <div className="ov-hero-copy">
          <h1>{greet()}, {first}</h1>
          <p>{town ? tr('Here is what is open around {town} today.', { town }) : tr('Here is what is open in Oriental Mindoro today.')}</p>
          <form className="ov-find" onSubmit={goSearch} role="search">
            <IconSearch size={18} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={tr('Search jobs, skills or companies')} aria-label={tr('Search jobs')} />
            <button type="submit" className="btn btn-primary">{tr('Search')}</button>
          </form>
        </div>
        <Link to={nextStep?.to || (passport.score < 80 ? '/dashboard/passport/certificates' : '/dashboard/passport')} className="ov-strength" aria-label={tr('Profile strength {n}%', { n: passport.score })}>
          <div className="ring ring-gold" style={{ '--p': passport.score, width: 64, height: 64 }}>
            <span style={{ width: 50, height: 50, fontSize: 15 }}>{passport.score}%</span>
          </div>
          <div>
            <b>{tr('Profile strength')}</b>
            <small>{nextStep ? <>{tr('Next')}: {nextStep.text}</>
              : passport.score < 80 ? <>{tr('Next')}: {tr('Upload a certificate')}</>
              : tr('Employers see a complete profile')}</small>
          </div>
        </Link>
      </section>

      {/* 2 — the overview: four numbers, each one a door */}
      <section className="ov-stats" aria-label={tr('Overview')}>
        <Link to="/dashboard/matches" className="ov-stat blue">
          <span className="ov-stat-ic"><IconSpark size={20} /></span>
          <b>{summary.total ?? matches.length}</b>
          <span className="ov-stat-l">{tr('Job matches')}</span>
          <small>{summary.strong ? tr('{n} strong', { n: summary.strong }) : summary.nearby ? tr('{n} within 30 km', { n: summary.nearby }) : tr('Based on your skills')}</small>
        </Link>
        <Link to="/dashboard/applied" className="ov-stat gold">
          <span className="ov-stat-ic"><IconBriefcase size={20} /></span>
          <b>{activeApps}</b>
          <span className="ov-stat-l">{tr('Active applications')}</span>
          <small>{apps.length ? tr('{n} sent in total', { n: apps.length }) : tr('None sent yet')}</small>
        </Link>
        <Link to="/dashboard/applied" className="ov-stat violet">
          <span className="ov-stat-ic"><IconCalendar size={20} /></span>
          <b>{interviews.length}</b>
          <span className="ov-stat-l">{tr('Interviews')}</span>
          <small>{nextInterview
            ? tr('Next on {when}', { when: new Date(String(nextInterview).replace(' ', 'T')).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) })
            : tr('None scheduled')}</small>
        </Link>
        <Link to="/dashboard/saved" className="ov-stat green">
          <span className="ov-stat-ic"><IconBookmark size={20} /></span>
          <b>{savedJobs.saved.size}</b>
          <span className="ov-stat-l">{tr('Saved jobs')}</span>
          <small>{savedJobs.saved.size ? tr('Ready to apply') : tr('Tap the bookmark on a job')}</small>
        </Link>
      </section>

      {/* 3 — waiting on you */}
      {todo.length > 0 && (
        <section className="ov-todo">
          {todo.slice(0, 3).map((t, i) => {
            const Ic = t.icon
            return (
              <div key={i} className={`ov-todo-item ${t.tone}`}>
                <span className="ov-todo-ic"><Ic size={15} /></span>
                <p>{t.text}</p>
                <Link to={t.to} className="btn btn-light btn-sm">{t.cta}</Link>
              </div>
            )
          })}
        </section>
      )}

      <div className="ov-main">
        <div className="ov-col">
          {/* 4 — recommended */}
          <section className="ov-block">
            <div className="ov-block-hd">
              <div><h2>{tr('Recommended for you')}</h2><p>{tr('Best matches for your skills and town')}</p></div>
              <Link to="/dashboard/matches" className="ov-more">{tr('See all')} <IconArrow size={13} /></Link>
            </div>
            {recommended.length === 0
              ? <div className="ov-empty-card">
                  <p>{passport.skills_count === 0 ? tr('Add your skills and we will recommend jobs that fit.') : tr('No new matches right now.')}</p>
                  <Link to={passport.skills_count === 0 ? '/dashboard/passport' : '/dashboard/browse'} className="btn btn-navy btn-sm">
                    {passport.skills_count === 0 ? tr('Add skills') : tr('Search jobs')}
                  </Link>
                </div>
              : <div className="ov-cards">
                  {recommended.slice(0, 2).map(job => (
                    <FeaturedJobCard key={job.id} job={job} detailsTo={`/dashboard/browse/${job.id}`}
                      applied={appliedIds.has(Number(job.id))} busy={applying === job.id} onApply={setApplyJob}
                      saved={savedJobs.isSaved(job.id)} onToggleSave={savedJobs.toggle} />
                  ))}
                </div>}
          </section>

          {/* 5 — featured near you */}
          {featuredRow.length > 0 && (
            <section className="ov-block">
              <div className="ov-block-hd">
                <div><h2>{town ? tr('Featured near {town}', { town }) : tr('Featured jobs')}</h2><p>{tr('Employers hiring now')}</p></div>
                <Link to="/dashboard/browse" className="ov-more">{tr('Browse jobs')} <IconArrow size={13} /></Link>
              </div>
              <div className="ov-rail">
                {featuredRow.map(job => (
                  <FeaturedJobCard key={job.id} job={job} detailsTo={`/dashboard/browse/${job.id}`}
                    applied={appliedIds.has(Number(job.id))} busy={applying === job.id} onApply={setApplyJob}
                    saved={savedJobs.isSaved(job.id)} onToggleSave={savedJobs.toggle} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="ov-col">
          {/* 6 — where your applications are */}
          <section className="ov-panel">
            <div className="ov-panel-hd">
              <h2>{tr('Your applications')}</h2>
              <Link to="/dashboard/applied" className="ov-more">{tr('See all')} <IconArrow size={13} /></Link>
            </div>
            {apps.length === 0
              ? <p className="ov-empty">{tr('You have not applied for anything yet.')} <Link to="/dashboard/browse">{tr('Find a job')}</Link></p>
              : <>
                  <ul className="ov-pipe">
                    {pipeline.map(x => (
                      <li key={x.key} className={x.key}>
                        <span>{x.label}</span>
                        <i><em style={{ width: `${(x.n / pipeMax) * 100}%` }} /></i>
                        <b>{x.n}</b>
                      </li>
                    ))}
                  </ul>
                  <ul className="ov-apps">
                    {apps.slice(0, 3).map(a => (
                      <li key={a.id}>
                        <span className="ov-apps-ic"><IconBriefcase size={15} /></span>
                        <span>
                          <b>{a.job_title || tr('Job application')}</b>
                          <small>{[a.company || a.employer_name, days(a.created_at)].filter(Boolean).join(' · ')}</small>
                        </span>
                        <span className={`app-status ${a.status}`}>{tr(String(a.status).replace('_', ' '))}</span>
                      </li>
                    ))}
                  </ul>
                </>}
          </section>

          {/* 7 — courses */}
          {courses.length > 0 && (
            <section className="ov-panel">
              <div className="ov-panel-hd">
                <h2>{tr('Courses picked for you')}</h2>
                <Link to="/dashboard/training" className="ov-more">{tr('All')} <IconArrow size={13} /></Link>
              </div>
              <ul className="ov-courselist">
                {courses.slice(0, 3).map(c => (
                  <li key={c.id}>
                    <Link to="/dashboard/training">
                      <img src={getCourseImage(c)} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
                      <span>
                        <b>{c.title}</b>
                        <small>{c.why ? tr('Jobs ask for {skill}', { skill: c.why })
                          : myTown && c.towns?.[myTown] ? tr('{n} schools in {town}', { n: c.towns[myTown], town: myTown })
                          : tr('{n} schools in the province', { n: c.schools || 0 })}</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="ov-free">{tr('Free TESDA training in Oriental Mindoro')}</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

/* ─ Skills Passport sub-page ────────────────────────────── */
/* ─ Skills Passport ─────────────────────────────────────────
   Everything an employer looks at, in one place and in this order:
     Skills       what you can do, and how it was proven
     Certificates the paper for it (scanned, read, turned into a skill)
     Work gallery photos of the job actually being done
     Resume       the same passport printed as a PDF to hand over or email
   The Resume Builder used to be a separate page people never found; it is a tab
   here now, built from the very same records.
*/
export function SkillsPassport({ call, tokens, user, updateUser, tab = 'skills' }) {
  const [skills, setSkills]   = useState(null)
  const [score, setScore]     = useState(0)
  const [certs, setCerts]     = useState([])
  const [workCount, setWorkCount] = useState(0)
  const [hasResume, setHasResume] = useState(false)
  const [name, setName]       = useState('')
  const [level, setLevel]     = useState('')
  const [source, setSource]   = useState('self')
  const [adding, setAdding]   = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [err, setErr]         = useState('')
  const [dialog, setDialog]   = useState(null)
  const [removing, setRemoving] = useState(false)

  const load = useCallback(() => {
    call('/skills/my').then(r => setSkills(r.skills || [])).catch(() => setSkills([]))
    call('/skills/passport-score').then(r => setScore(r.score || 0)).catch(() => {})
    call('/skills/certificates').then(r => setCerts(r.certificates || [])).catch(() => {})
    call('/portfolio').then(r => setWorkCount((r.items || []).length)).catch(() => {})
    call('/resume').then(r => setHasResume(!!r?.resume)).catch(() => {})
  }, [call])

  useEffect(() => { load() }, [load])

  async function addSkill(e) {
    e.preventDefault()
    const clean = name.trim()
    if (clean.length < 2) { setErr(tr('Write the skill name, e.g. "Electrical wiring".')); return }
    setAdding(true); setErr('')
    try {
      await api('/skills', { method: 'POST', token: tokens?.access_token, body: { skill_name: clean, level, source } })
      setName(''); setLevel(''); setSource('self'); setShowForm(false); load()
    } catch (e2) {
      setErr(e2?.message || tr('Could not add the skill.'))
    }
    setAdding(false)
  }

  function deleteSkill(s) {
    setDialog({
      tone: 'danger', title: tr('Remove this skill?'),
      body: <p>{tr('“{name}” will be removed from your Skills Passport. Your match scores are worked out again without it.', { name: s.skill_name })}</p>,
      actions: [
        { label: tr('Remove'), primary: true, onClick: async () => {
          setRemoving(true)
          try { await api(`/skills/${s.id}`, { method: 'DELETE', token: tokens?.access_token }); setDialog(null); load() }
          catch (e2) { setDialog({ tone: 'error', title: tr('Could not remove'), body: <p>{tr(e2?.message || 'Please try again.')}</p>, actions: [{ label: tr('OK'), primary: true, onClick: () => setDialog(null) }] }) }
          finally { setRemoving(false) }
        } },
        { label: tr('Cancel'), onClick: () => setDialog(null) },
      ],
    })
  }

  const list = skills || []
  // what is already proven, and what is only claimed: the split the score is built on
  const verified = list.filter(s => s.verified || s.certificate_id)
  const claimed  = list.filter(s => !s.verified && !s.certificate_id)
  const pendingCerts = certs.filter(c => c.status === 'pending').length
  const levelMeta  = byId(SKILL_LEVELS, level)
  const sourceMeta = byId(SKILL_SOURCES, source)

  // what makes a passport strong, in the order it matters to an employer
  const steps = [
    { done: list.length >= 3, label: tr('List at least 3 skills'), note: tr('{n} of 3', { n: Math.min(list.length, 3) }), to: '/dashboard/passport' },
    { done: certs.length > 0, label: tr('Upload a certificate'), note: certs.length ? tr('{n} uploaded', { n: certs.length }) : tr('Proves a skill'), to: '/dashboard/passport/certificates' },
    { done: workCount > 0, label: tr('Add photos of your work'), note: workCount ? tr('{n} photos', { n: workCount }) : tr('Shows what you can do'), to: '/dashboard/passport/work' },
    { done: hasResume, label: tr('Build your resume'), note: hasResume ? tr('Saved') : tr('Free PDF'), to: '/dashboard/resume' },
  ]
  const nextStep = steps.find(x => !x.done)

  const Seen = ({ children }) => (
    <p className="sp-seen"><IconEye size={14} /> {children}</p>
  )

  return (
    <div className="page-inner spp">
      {dialog && <Dialog tone={dialog.tone} title={dialog.title} actions={dialog.actions} onClose={() => setDialog(null)} busy={removing}>{dialog.body}</Dialog>}

      {/* ── Skills (the passport's front page) ── */}
      {tab === 'skills' && (
        <>
          <section className="sp-top">
            <div className="sp-strength">
              <div className="ring ring-gold" style={{ '--p': score, width: 76, height: 76 }}>
                <span style={{ width: 58, height: 58, fontSize: 16 }}>{score}%</span>
              </div>
              <div>
                <h2>{tr('Passport strength')}</h2>
                <p>{nextStep ? <>{tr('Next')}: <Link to={nextStep.to}>{nextStep.label}</Link></> : tr('Your passport is complete. Keep certificates up to date.')}</p>
                <ul className="sp-counts">
                  <li><b>{verified.length}</b><span>{tr('proven')}</span></li>
                  <li><b>{claimed.length}</b><span>{tr('self-listed')}</span></li>
                  <li><b>{certs.length}</b><span>{tr('certificates')}</span></li>
                </ul>
              </div>
            </div>
            <ol className="sp-steps">
              {steps.map(st => (
                <li key={st.label} className={st.done ? 'done' : ''}>
                  <Link to={st.to}>
                    <span className="sp-step-ic">{st.done ? <IconCheck size={13} /> : null}</span>
                    <span className="sp-step-t"><b>{st.label}</b><small>{st.note}</small></span>
                    <IconArrow size={13} />
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {pendingCerts > 0 && (
            <p className="sp-pending">
              <IconClock size={14} /> {pendingCerts === 1
                ? tr('1 certificate is waiting to be checked. It already counts; it is marked Verified once approved.')
                : tr('{n} certificates are waiting to be checked.', { n: pendingCerts })}
            </p>
          )}

          {showForm && (
            <div className="panel rise sp-add">
              <h3 style={{ marginBottom: 4 }}>{tr("Add a skill")}</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>
                {tr("Be specific: \"Electrical wiring\" matches more jobs than \"Construction\".")}
              </p>
              <form onSubmit={addSkill} className="sp-add-grid">
                <div className="field" style={{ marginBottom: 0 }}>
                  <span>{tr("Skill name *")}</span>
                  <div className="in no-icon">
                    <input placeholder={tr("e.g. Electrical wiring, Baking, Tricycle driving")} value={name}
                      onChange={e => setName(e.target.value)} required maxLength={255} autoFocus />
                  </div>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <span>{tr("How good are you at it?")}</span>
                  <div className="in no-icon">
                    <select value={level} onChange={e => setLevel(e.target.value)}>
                      <option value="">{tr("Prefer not to say")}</option>
                      {SKILL_LEVELS.map(l => (
                        <option key={l.id} value={l.id}>{tr(l.label)} — {tr(l.short)} ({tr(l.years)})</option>
                      ))}
                    </select>
                  </div>
                  <small className="sp-hint">{tr(levelMeta ? levelMeta.desc : 'Pick the one that honestly describes you. Employers ask about this at the interview.')}</small>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <span>{tr("How can it be proven?")}</span>
                  <div className="in no-icon">
                    <select value={source} onChange={e => setSource(e.target.value)}>
                      {SKILL_SOURCES.map(sc => (
                        <option key={sc.id} value={sc.id}>{tr(sc.label)} — {tr(sc.short)}</option>
                      ))}
                    </select>
                  </div>
                  <small className="sp-hint">
                    {tr(sourceMeta ? sourceMeta.desc : '')}
                    {sourceMeta && <> <b>{tr('Counts for:')} {tr(sourceMeta.weight)}</b></>}
                  </small>
                </div>
                <div className="sp-add-actions">
                  <button type="submit" className="btn btn-primary" disabled={adding}>
                    {adding ? <span className="spin" /> : tr("Add skill")}
                  </button>
                  <button type="button" className="btn btn-light" onClick={() => { setShowForm(false); setErr('') }}>{tr("Cancel")}</button>
                </div>
              </form>
              {err && <p role="alert" style={{ color: 'var(--red)', fontSize: 13, fontWeight: 600, margin: '10px 0 0' }}>{err}</p>}
            </div>
          )}

          <div className="panel">
            <div className="panel-hd">
              <div>
                <h2>{tr("My skills")} <span className="sp-n">{list.length}</span></h2>
                <Seen>{tr('Employers see these when you apply. Proven skills score higher on every match.')}</Seen>
              </div>
              {!showForm && <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}><IconPlus size={14} /> {tr("Add skill")}</button>}
            </div>

            {skills === null ? <BrandLoader compact label={tr('Loading your skills…')} />
              : list.length === 0 ? (
                <div className="spp-empty">
                  <IconShield size={40} />
                  <p>{tr("No skills yet. Match scores stay low until this list says what you can do.")}</p>
                  <button className="btn btn-navy" onClick={() => setShowForm(true)}><IconPlus size={16} /> {tr("Add your first skill")}</button>
                </div>
              ) : (
                <>
                  {verified.length > 0 && (
                    <>
                      <h3 className="sp-group ok">{tr("Proven")} <span>{verified.length}</span></h3>
                      <ul className="sp-skills">{verified.map(s => <SkillRow key={s.id} s={s} onDelete={() => deleteSkill(s)} />)}</ul>
                    </>
                  )}
                  {claimed.length > 0 && (
                    <>
                      <h3 className="sp-group">{tr("Listed by you")} <span>{claimed.length}</span></h3>
                      <ul className="sp-skills">{claimed.map(s => <SkillRow key={s.id} s={s} onDelete={() => deleteSkill(s)} />)}</ul>
                      <p className="sp-tip">
                        {tr("A skill with a certificate behind it scores higher on every match.")}{' '}
                        <Link to="/dashboard/passport/certificates">{tr("Upload a certificate")}</Link>
                        {' '}{tr("or")}{' '}
                        <Link to="/dashboard/training">{tr("find free TESDA training")}</Link>.
                      </p>
                    </>
                  )}
                </>
              )}
          </div>

          {/* sharing needs migration 017: share_token is in the user once the column exists */}
          {user && 'share_token' in user && <SharePassport user={user} call={call} updateUser={updateUser} />}
        </>
      )}

      {/* ── Certificates ── */}
      {tab === 'certificates' && (
        <>
          <CertificateUpload call={call} user={user} onSaved={load} />
          <Seen>{tr('Employers see your certificates when you apply. Only certificates hanapbuhay has checked appear on your shared passport link.')}</Seen>
        </>
      )}

      {/* ── Work photos ── */}
      {tab === 'work' && (
        <>
          <WorkGallery call={call} tokens={tokens} skills={list} onChanged={load} />
          <Seen>{tr('Who sees these: employers you apply to, people who open your profile, and anyone you share your passport link with.')}</Seen>
        </>
      )}
    </div>
  )
}

/** One skill, with where it came from spelled out rather than hinted at by a chip. */
function SkillRow({ s, onDelete }) {
  const lvl = byId(SKILL_LEVELS, s.level)
  const src = byId(SKILL_SOURCES, s.source)
  const proven = Boolean(s.verified) || Boolean(s.certificate_id)
  return (
    <li className={`sp-skill${proven ? ' ok' : ''}`}>
      <div className="sp-skill-ic">{proven ? <IconShield size={16} /> : <IconWrench size={16} />}</div>
      <div className="sp-skill-main">
        <b>{s.skill_name}</b>
        <p>
          {lvl ? <>{tr(lvl.label)} · {tr(lvl.short)}</> : tr('Level not set')}
          {src ? <> · {tr(src.label)}</> : null}
          {s.certificate ? <> · {s.certificate}</> : null}
        </p>
      </div>
      {s.verified
        ? <span className="chip green" style={{ fontSize: 11 }}><IconCheck size={11} /> {tr('Verified')}</span>
        : s.certificate_id
          ? <span className="chip gold" style={{ fontSize: 11 }}>{tr('Certificate attached')}</span>
          : null}
      <button type="button" className="sp-skill-x" onClick={onDelete} title={tr("Remove")} aria-label={tr('Remove {name}', { name: s.skill_name })}>
        <IconX size={15} />
      </button>
    </li>
  )
}

/* ─ Applications list ───────────────────────────────────── */
export function MyApplications({ call }) {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [confirmId, setConfirmId] = useState(null) // application waiting for "Yes, withdraw"
  const [busyId, setBusyId] = useState(null)
  const [msg, setMsg] = useState(null)
  const [reviewsOn, setReviewsOn] = useState(false)
  const [steps, setSteps] = useState({}) // "not selected" → similar jobs + gaps, by application id

  useEffect(() => {
    call('/applications/my').then(r => {
      const list = r.applications || []
      setApps(list)
      setReviewsOn(!!r.reviews_enabled)
      if (list.some(a => a.status === 'rejected')) {
        call('/applications/next-steps').then(s => setSteps(s.steps || {})).catch(() => {})
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [call])

  const [history, setHistory] = useState({}) // application id → steps, loaded on demand
  const [offerBusy, setOfferBusy] = useState(null)
  async function answerOffer(a, action) {
    setOfferBusy(a.id); setMsg(null)
    try {
      const r = await call(`/applications/${a.id}/offer`, { method: 'POST', body: { action } })
      setApps(list => list.map(x => x.id === a.id ? { ...x, status: r.status } : x))
      setMsg({ ok: true, text: action === 'accept' ? tr('Congratulations! You accepted the offer for {job}. The employer was told.', { job: a.job_title }) : tr('You declined the offer for {job}. The employer was told.', { job: a.job_title }) })
    } catch (err) { setMsg({ ok: false, text: tr(err?.message || 'We couldn’t send your answer. Please try again.') }) } finally { setOfferBusy(null) }
  }
  async function toggleHistory(a) {
    if (history[a.id]) { setHistory(h => ({ ...h, [a.id]: null })); return }
    try { const r = await call(`/applications/${a.id}/history`); setHistory(h => ({ ...h, [a.id]: r.history || [] })) } catch { setHistory(h => ({ ...h, [a.id]: [] })) }
  }

  async function withdraw(a) {
    setBusyId(a.id); setMsg(null)
    try {
      await call(`/applications/${a.id}/withdraw`, { method: 'POST' })
      setApps(list => list.map(x => x.id === a.id ? { ...x, status: 'withdrawn' } : x))
      setMsg({ ok: true, text: tr('You withdrew your application for {job}. The employer was told.', { job: a.job_title || tr('this job') }) })
    } catch (err) {
      setMsg({ ok: false, text: tr(err?.message || 'Could not withdraw the application.') })
    } finally {
      setBusyId(null); setConfirmId(null)
    }
  }
  const canWithdraw = s => !['hired', 'rejected', 'withdrawn', 'offer'].includes(s)

  const renderStatusBadge = s => {
    const map = {
      pending:       { icon: IconClock, text: 'Submitted', cls: 'pending' },
      reviewed:      { icon: IconSearch, text: 'Under Review', cls: 'reviewed' },
      shortlisted:   { icon: IconStar, text: 'Shortlisted', cls: 'shortlisted' },
      for_interview: { icon: IconCalendar, text: 'Interview Scheduled', cls: 'for_interview' },
      interviewed:   { icon: IconCheck, text: 'Interviewed', cls: 'for_interview' },
      offer:         { icon: IconStar, text: 'Job Offer', cls: 'hired' },
      rejected:      { icon: IconX, text: 'Not Selected', cls: 'rejected' },
      hired:         { icon: IconCheck, text: 'Hired', cls: 'hired' },
      withdrawn:     { icon: IconX, text: 'Withdrawn', cls: 'withdrawn' },
    }
    const item = map[s] || { icon: IconFile, text: s || 'Submitted', cls: 'pending' }
    const Ic = item.icon
    return (
      <span className={`app-status ${item.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <Ic size={12} /> {tr(item.text)}
      </span>
    )
  }

  const counts = {
    all: apps.length,
    pending: apps.filter(a => a.status === 'pending' || a.status === 'reviewed').length,
    shortlisted: apps.filter(a => a.status === 'shortlisted').length,
    for_interview: apps.filter(a => a.status === 'for_interview' || a.status === 'interviewed').length,
    offer: apps.filter(a => a.status === 'offer').length,
    hired: apps.filter(a => a.status === 'hired').length,
    rejected: apps.filter(a => a.status === 'rejected').length,
    withdrawn: apps.filter(a => a.status === 'withdrawn').length,
  }

  const upcoming = apps
    .filter(a => a.status === 'for_interview' && a.interview_date && new Date(String(a.interview_date).replace(' ', 'T')) > new Date())
    .sort((x, y) => String(x.interview_date).localeCompare(String(y.interview_date)))[0]

  const filtered = apps.filter(a => {
    if (filter === 'all') return true
    if (filter === 'pending') return a.status === 'pending' || a.status === 'reviewed'
    if (filter === 'for_interview') return a.status === 'for_interview' || a.status === 'interviewed'
    return a.status === filter
  })
  const pg = usePaged(filtered, { sorts: {
    new: ['Newest first', SORT.date('created_at')],
    old: ['Oldest first', (a, b) => -SORT.date('created_at')(a, b)],
    match: ['Highest match', SORT.num('match_score')],
    title: ['Job title (A–Z)', SORT.text('job_title')],
  } })

  return (
    <div className="page-inner">

      {/* the next interview, so it is never buried in the list */}
      {upcoming && (
        <div className="ap-next">
          <span className="ap-next-ic"><IconCalendar size={20} /></span>
          <div>
            <b>{tr('Up next: interview for {job}', { job: upcoming.job_title || tr('a job') })}</b>
            <p>{new Date(String(upcoming.interview_date).replace(' ', 'T')).toLocaleString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              {upcoming.company || upcoming.employer_name ? ` · ${upcoming.company || upcoming.employer_name}` : ''}</p>
          </div>
          <Link to={`/dashboard/browse/${upcoming.job_id}`} className="btn btn-light btn-sm">{tr('View job')}</Link>
        </div>
      )}

      {/* Filters */}
      <div className="mc-chips ap-filters" role="group" aria-label={tr('Filter applications')}>
        {[
          { id: 'all', label: 'All' },
          { id: 'pending', label: 'In Review' },
          { id: 'shortlisted', label: 'Shortlisted' },
          { id: 'for_interview', label: 'Interview' },
          ...(counts.offer ? [{ id: 'offer', label: 'Job Offer' }] : []),
          { id: 'hired', label: 'Hired' },
          { id: 'rejected', label: 'Not Selected' },
          ...(counts.withdrawn ? [{ id: 'withdrawn', label: 'Withdrawn' }] : []),
        ].map(tab => (
          <button key={tab.id} type="button" aria-pressed={filter === tab.id} onClick={() => setFilter(tab.id)}>
            {tr(tab.label)} <span>{counts[tab.id] || 0}</span>
          </button>
        ))}
      </div>

      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} style={{ margin: '0 0 14px', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: msg.ok ? 'var(--green-l)' : 'var(--red-l)', color: msg.ok ? 'var(--green)' : 'var(--red)' }}>{msg.text}</p>
      )}

      {loading
        ? <BrandLoader compact label="Loading your applications…" />
        : filtered.length === 0
          ? <div className="panel" style={{ textAlign: 'center', padding: '48px 0' }}>
              <p style={{ color: 'var(--muted)', marginBottom: 20 }}>
                {filter === 'all' ? tr("You haven't applied to any jobs yet. Find jobs that match your Skills Passport and apply in a minute.") : tr('No applications in this list.')}
              </p>
              <Link to="/dashboard/browse" className="btn btn-navy">{tr("Browse Jobs")} <IconArrow /></Link>
            </div>
          : <>
            <ListTools pg={pg} noun={tr('application')} plural={tr('applications')} />
            <div style={{ display: 'grid', gap: 14 }}>
              {pg.items.map(a => (
                <div key={a.id} className="panel" style={{ borderLeft: a.status === 'for_interview' ? '4px solid #7c3aed' : a.status === 'hired' ? '4px solid #10b981' : a.status === 'shortlisted' ? '4px solid #3b82f6' : a.status === 'rejected' ? '4px solid #ef4444' : a.status === 'withdrawn' ? '4px solid #cbd5e1' : '4px solid #f59e0b', opacity: a.status === 'withdrawn' ? 0.8 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                    <Link to={`/dashboard/browse/${a.job_id}`} className="ap-thumb" aria-hidden="true" tabIndex={-1}>
                      <img src={getJobImage({ title: a.job_title, category: a.category })} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
                    </Link>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: 18, margin: 0 }}>{a.job_title || tr("Job Application")}</h2>
                        {renderStatusBadge(a.status)}
                      </div>
                      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 8 }}>{a.company || a.employer_name} · {a.job_location}</p>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {a.match_score && <span className={`chip ${a.match_score >= 75 ? 'green' : a.match_score >= 50 ? 'gold' : 'red'}`}>{tr('{n}% Match', { n: a.match_score })}</span>}
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{tr('Applied {when}', { when: days(a.created_at) })}</span>
                        {a.salary_min && <span style={{ fontSize: 13, color: 'var(--muted)' }}>₱{Number(a.salary_min).toLocaleString()}{tr('/mo')}</span>}
                      </div>

                      {STATUS[a.status] && <p style={{ fontSize: 13.5, color: 'var(--text)', margin: '8px 0 0' }}><b>{tr(STATUS[a.status].label)}:</b> {tr(STATUS[a.status].worker)}</p>}
                      {a.status === 'offer' && (
                        <div className="pf-note ok" style={{ marginTop: 10 }}>
                          <b>{tr('Job offer')}</b>
                          <dl className="pf-kv" style={{ marginTop: 6 }}>
                            {a.offer_salary && <><dt>{tr('Pay')}</dt><dd>{peso(a.offer_salary)}</dd></>}
                            {a.offer_start && <><dt>{tr('Start date')}</dt><dd>{phDate(a.offer_start)}</dd></>}
                            {a.offer_details && <><dt>{tr('Details')}</dt><dd style={{ fontWeight: 500 }}>{a.offer_details}</dd></>}
                          </dl>
                          <div className="pf-actions">
                            <button type="button" className="btn btn-primary btn-sm" disabled={offerBusy === a.id} onClick={() => answerOffer(a, 'accept')}><IconCheck size={13} /> {tr('Accept offer')}</button>
                            <button type="button" className="btn btn-light btn-sm" disabled={offerBusy === a.id} onClick={() => answerOffer(a, 'decline')}>{tr('Decline')}</button>
                          </div>
                        </div>
                      )}
                      {/* Application Timeline Tracker */}
                      {a.status === 'withdrawn'
                        ? <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10 }}>{tr("You withdrew this application. You can apply again from the job page while it is open.")}</p>
                        : <ApplicationTracker status={a.status} interviewDate={a.interview_date} interviewNotes={a.interview_notes}
                            calendar={{ title: a.job_title, company: a.company || a.employer_name, location: a.job_location }} />}
                      {a.status === 'rejected' && <NextSteps step={steps[a.id]} />}
                      <button type="button" className="btn btn-light btn-sm" style={{ marginTop: 10 }} onClick={() => toggleHistory(a)}>{history[a.id] ? tr('Hide steps') : tr('Show every step')}</button>
                      {history[a.id] && (
                        <ol className="pf-timeline" style={{ marginTop: 10 }}>
                          {history[a.id].length === 0 ? <li><b>{tr('Submitted')}</b><small>{phDateTime(a.created_at)}</small></li> : history[a.id].map((h, i) => (
                            <li key={i} className={h.to_status === 'hired' ? 'good' : ['rejected', 'withdrawn'].includes(h.to_status) ? 'bad' : ''}>
                              <b>{tr(h.label)}</b><small>{phDateTime(h.created_at)}</small>{h.note && h.to_status !== 'reviewed' && <p>{h.note}</p>}</li>
                          ))}
                        </ol>
                      )}
                      {a.status === 'hired' && reviewsOn && (
                        <RateEmployer app={a} call={call} onSaved={review => setApps(list => list.map(x => x.id === a.id ? { ...x, my_review: review } : x))} />
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Link to={`/dashboard/browse/${a.job_id}`} className="btn btn-light btn-sm">{a.status === 'withdrawn' ? tr('Apply again') : tr('View Job')}</Link>
                      {canWithdraw(a.status) && (confirmId === a.id
                        ? <span className="withdraw-confirm" role="group" aria-label={tr("Confirm withdraw")}>
                            <span>{tr("Withdraw this application?")}</span>
                            <button type="button" className="btn btn-sm" style={{ background: 'var(--red)', color: '#fff' }} onClick={() => withdraw(a)} disabled={busyId === a.id}>
                              {busyId === a.id ? <span className="spin" /> : tr("Yes, withdraw")}
                            </button>
                            <button type="button" className="btn btn-light btn-sm" onClick={() => setConfirmId(null)} disabled={busyId === a.id}>{tr("Keep")}</button>
                          </span>
                        : <button type="button" className="btn btn-light btn-sm" style={{ color: 'var(--red)' }} onClick={() => setConfirmId(a.id)}>{tr("Withdraw")}</button>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Pager pg={pg} />
          </>
      }
    </div>
  )
}

/* ─ Worker Profile page ─────────────────────────────────── */
export function WorkerProfile({ user, call, tokens, updateUser }) {
  const fileInputRef = useRef(null)
  const resumeInputRef = useRef(null)
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    location: user?.location || '',
    barangay: user?.barangay || '',
    education_level: user?.education_level || '',
    experience_years: user?.experience_years ?? '',
    bio: user?.bio || ''
  })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoMsg, setPhotoMsg] = useState({ type: '', text: '' })
  const [previewPhoto, setPreviewPhoto] = useState(null)
  const [cropModalSrc, setCropModalSrc] = useState(null)

  // Resume upload states
  const [resumeState, setResumeState] = useState('idle') // idle | scanning | parsed | error
  const [resumeMsg, setResumeMsg] = useState('')
  const [resumeParsed, setResumeParsed] = useState(null)
  const [resumeFile, setResumeFile] = useState(null)

  // no photo uploaded yet: this person's own generated avatar, not a stock face
  const currentPhoto = previewPhoto || user?.picture || (user?.id ? localStorage.getItem(`hb_avatar_${user.id}`) : null) || avatarDataUrl(user || {})

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        phone: user.phone || '',
        location: user.location || '',
        barangay: user.barangay || '',
        education_level: user.education_level || '',
        experience_years: user.experience_years ?? '',
        bio: user.bio || ''
      })
    }
  }, [user?.full_name, user?.phone, user?.location, user?.bio, user?.barangay, user?.education_level, user?.experience_years])

  // The signed-in user is loaded once per visit: re-check the verification status here so a
  // profile an admin just verified shows the badge without signing out and back in.
  useEffect(() => {
    call('/auth/me').then(r => {
      if (r?.user && Number(r.user.is_verified) !== Number(user?.is_verified)) updateUser?.(r.user)
    }).catch(() => {})
  }, [call]) // eslint-disable-line react-hooks/exhaustive-deps

  const isVerified = Number(user?.is_verified) === 1

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await call('/auth/me', { method: 'PATCH', body: form })
      if (res?.user && updateUser) {
        updateUser(res.user)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(tr(err?.message || 'Failed to save profile changes. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  // Resume scan & auto-fill
  async function handleResumeUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setResumeFile(file)
    setResumeState('scanning')
    setResumeMsg('')
    setResumeParsed(null)
    // Reset input so same file can be re-selected
    if (resumeInputRef.current) resumeInputRef.current.value = ''
    try {
      const fd = new FormData()
      fd.append('resume', file)
      const res = await call('/auth/resume-parse', { method: 'POST', body: fd })
      if (res?.parsed) {
        setResumeParsed(res.parsed)
        setResumeState('parsed')
      } else {
        throw new Error('No data returned')
      }
    } catch (err) {
      setResumeState('error')
      setResumeMsg(tr(err?.message || 'Could not scan resume. Please try a TXT or DOCX file.'))
    }
  }

  async function applyParsed() {
    if (!resumeParsed) return
    const p = resumeParsed
    setForm(f => ({
      ...f,
      full_name: p.full_name || f.full_name,
      phone:     p.phone     || f.phone,
      location:  TOWNS.includes(p.location) ? p.location : f.location,
      bio:       p.bio       || f.bio,
    }))
    setResumeState('idle')
    setResumeParsed(null)

    // Add detected skills to the Skills Passport (the server skips ones already there)
    const items = p.skill_items?.length ? p.skill_items : (p.skills || []).map(s => ({ skill_name: s }))
    let added = 0
    if (items.length) {
      setResumeMsg(tr('Adding your skills to the Skills Passport…'))
      const results = await Promise.allSettled(items.map(sk =>
        call('/skills', { method: 'POST', body: {
          skill_name: sk.skill_name, level: sk.level || '', source: sk.source || 'self',
          certificate: sk.certificate || '', category: sk.category || '',
        } })
      ))
      added = results.filter(r => r.status === 'fulfilled' && r.value?.created).length
    }
    setResumeMsg(
      (p.template ? tr('Profile fields filled from your hanapbuhay resume.') : tr('Profile fields filled.')) + ' ' +
      (items.length ? (added === 1 ? tr('1 new skill added to your Skills Passport.') : tr('{n} new skills added to your Skills Passport.', { n: added })) + ' ' : '') +
      tr('Review the details below, then click Save Changes.')
    )
  }

  // Handle Photo File Selection -> Opens Crop Modal
  function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // Clear input value so same file can be re-selected if cancelled
    e.target.value = ''

    // Validate type
    if (!file.type.startsWith('image/')) {
      setPhotoMsg({ type: 'error', text: tr('Please select a valid image file (JPG, PNG, WEBP).') })
      return
    }

    // Validate size (max 8MB for cropping)
    if (file.size > 8 * 1024 * 1024) {
      setPhotoMsg({ type: 'error', text: tr('Image file is too large. Please choose an image under 8MB.') })
      return
    }

    setPhotoMsg({ type: '', text: '' })

    // Read and open crop modal
    const reader = new FileReader()
    reader.onload = (evt) => {
      setCropModalSrc(evt.target.result)
    }
    reader.readAsDataURL(file)
  }

  // Handle Cropped Image Save
  async function handleCroppedPhoto(croppedBlob, croppedDataUrl) {
    setUploadingPhoto(true)
    setPreviewPhoto(croppedDataUrl)
    setPhotoMsg({ type: '', text: '' })

    try {
      const formData = new FormData()
      formData.append('avatar', croppedBlob, 'avatar.jpg')

      const res = await call('/auth/avatar', {
        method: 'POST',
        body: formData,
      })

      if (res?.picture && updateUser) {
        updateUser({ ...user, picture: res.picture })
        if (user?.id) localStorage.setItem(`hb_avatar_${user.id}`, res.picture)
      } else if (res?.user && updateUser) {
        updateUser(res.user)
      }

      setCropModalSrc(null)
      setPhotoMsg({ type: 'success', text: tr('Profile photo updated successfully!') })
      setTimeout(() => setPhotoMsg({ type: '', text: '' }), 4000)
    } catch (err) {
      // Fallback: update via base64 data URI in /auth/me
      try {
        const fallbackRes = await call('/auth/me', {
          method: 'PATCH',
          body: { picture: croppedDataUrl },
        })
        if (fallbackRes?.user && updateUser) {
          updateUser(fallbackRes.user)
        } else if (updateUser) {
          updateUser({ ...user, picture: croppedDataUrl })
        }
        if (user?.id) localStorage.setItem(`hb_avatar_${user.id}`, croppedDataUrl)
        setCropModalSrc(null)
        setPhotoMsg({ type: 'success', text: tr('Profile photo updated successfully!') })
        setTimeout(() => setPhotoMsg({ type: '', text: '' }), 4000)
      } catch (fbErr) {
        setPhotoMsg({ type: 'error', text: tr(err?.message || 'Failed to upload photo. Please try again.') })
        setPreviewPhoto(null)
      }
    } finally {
      setUploadingPhoto(false)
    }
  }

  // Handle Remove Photo
  async function handleRemovePhoto() {
    if (!window.confirm(tr('Are you sure you want to remove your profile photo?'))) return
    setUploadingPhoto(true)
    setPhotoMsg({ type: '', text: '' })
    try {
      const res = await call('/auth/me', {
        method: 'PATCH',
        body: { picture: '' },
      })
      if (res?.user && updateUser) {
        updateUser(res.user)
      } else if (updateUser) {
        updateUser({ ...user, picture: null })
      }
      setPreviewPhoto(null)
      if (user?.id) localStorage.removeItem(`hb_avatar_${user.id}`)
      setPhotoMsg({ type: 'success', text: tr('Profile photo reset to default.') })
      setTimeout(() => setPhotoMsg({ type: '', text: '' }), 3000)
    } catch (err) {
      setPhotoMsg({ type: 'error', text: tr('Failed to remove photo.') })
    } finally {
      setUploadingPhoto(false)
    }
  }

  return (
    <div className="page-inner">

      {/* the other half of a profile: what employers and other workers see about you */}
      <ReputationStrip call={call} user={user} />
      <FreelanceStrip call={call} user={user} />

      {/* ─── Resume Upload Banner ──────────────────────────────── */}
      <div className="panel rise" style={{
        marginBottom: 20,
        background: 'linear-gradient(135deg, #0a2557 0%, #1a3a8f 60%, #0f52ba 100%)',
        border: 'none',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Decorative blobs */}
        <div style={{ position:'absolute', top:-40, right:-40, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,.04)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-30, left:'40%', width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,.04)', pointerEvents:'none' }} />

        <input type="file" ref={resumeInputRef} onChange={handleResumeUpload}
          accept=".pdf,.docx,.doc,.txt,.rtf" style={{ display:'none' }} />

        <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap', position:'relative', zIndex:1 }}>
          {/* Icon */}
          <div style={{
            width:60, height:60, borderRadius:16, flexShrink:0,
            background:'rgba(255,255,255,.12)', backdropFilter:'blur(8px)',
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'#fff', boxShadow:'0 4px 16px rgba(0,0,0,.2)'
          }}><IconFile size={28} /></div>

          <div style={{ flex:1, minWidth:180 }}>
            <p style={{ color:'rgba(255,255,255,.6)', fontSize:11, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', marginBottom:3 }}>{tr("Smart Auto-Fill")}</p>
            <h2 style={{ color:'#fff', fontSize:18, fontWeight:800, marginBottom:4, letterSpacing:'-.02em' }}>{tr("Upload Your Resume")}</h2>
            <p style={{ color:'rgba(255,255,255,.7)', fontSize:13, lineHeight:1.5, margin:0 }}>
              {tr("Upload PDF, DOCX, or TXT — we'll scan it and auto-fill your profile & skills.")}
            </p>
            <p style={{ color:'rgba(255,255,255,.85)', fontSize:12.5, lineHeight:1.5, margin:'6px 0 0' }}>
              {tr("No resume yet?")} <Link to="/dashboard/resume" style={{ color:'#FFD27A', fontWeight:700, textDecoration:'underline' }}>{tr("Make one free with the Resume Builder")}</Link>{tr(". It fills every field when you upload it here.")}
            </p>
          </div>

          <div style={{ display:'flex', gap:10, alignItems:'center', flexShrink:0 }}>
            {resumeState === 'scanning' && (
              <div style={{ display:'flex', alignItems:'center', gap:10, color:'rgba(255,255,255,.8)', fontSize:13 }}>
                <span className="spin" style={{ width:20, height:20, borderColor:'rgba(255,255,255,.3)', borderTopColor:'#fff' }} />
                <span>{tr("Scanning resume…")}</span>
              </div>
            )}
            {resumeState === 'parsed' && resumeParsed && (
              <button className="btn btn-primary" onClick={applyParsed} style={{ fontSize:13, padding:'10px 20px', fontWeight:700, display:'inline-flex', alignItems:'center', gap:6 }}>
                <IconSpark size={15} /> {tr("Apply Auto-Fill")}
              </button>
            )}
            {resumeState !== 'scanning' && (
              <button
                className="btn"
                onClick={() => resumeInputRef.current?.click()}
                disabled={resumeState === 'scanning'}
                style={{
                  background:'rgba(255,255,255,.15)', backdropFilter:'blur(6px)',
                  color:'#fff', border:'1px solid rgba(255,255,255,.25)',
                  fontSize:13, padding:'10px 20px', fontWeight:600,
                  borderRadius:10, cursor:'pointer', transition:'.2s',
                  display:'inline-flex', alignItems:'center', gap:6
                }}
              >
                <IconFile size={15} />
                {resumeFile ? tr("Re-Upload") : tr("Browse File")}
              </button>
            )}
          </div>
        </div>

        {/* Status bar */}
        {(resumeMsg || (resumeState === 'parsed' && resumeParsed)) && (
          <div style={{
            marginTop:16, padding:'12px 16px', borderRadius:10, position:'relative', zIndex:1,
            background: resumeState === 'error' ? 'rgba(239,68,68,.2)' : 'rgba(255,255,255,.1)',
            border: `1px solid ${resumeState === 'error' ? 'rgba(239,68,68,.4)' : 'rgba(255,255,255,.2)'}`,
          }}>
            {resumeState === 'parsed' && resumeParsed && !resumeMsg && (
              <div>
                <p style={{ color:'rgba(255,255,255,.95)', fontSize:12, fontWeight:700, marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:18, height:18, borderRadius:'50%', background:'#10b981', color:'#fff' }}>
                    <IconCheck size={11} sw={2.6} />
                  </span>
                  <span>{tr("Resume scanned! Found the following data:")}</span>
                </p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {resumeParsed.full_name && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,.16)', color:'#fff', borderRadius:6, padding:'4px 10px', fontSize:12, fontWeight:600 }}>
                      <IconUser size={13} /> {resumeParsed.full_name}
                    </span>
                  )}
                  {resumeParsed.phone && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,.16)', color:'#fff', borderRadius:6, padding:'4px 10px', fontSize:12, fontWeight:600 }}>
                      <IconPhone size={13} /> {resumeParsed.phone}
                    </span>
                  )}
                  {resumeParsed.location && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,.16)', color:'#fff', borderRadius:6, padding:'4px 10px', fontSize:12, fontWeight:600 }}>
                      <IconPin size={13} /> {resumeParsed.location}
                    </span>
                  )}
                  {resumeParsed.skills?.slice(0,5).map(s => (
                    <span key={s} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(245,166,35,.2)', color:'#F5A623', border:'1px solid rgba(245,166,35,.35)', borderRadius:6, padding:'4px 10px', fontSize:12, fontWeight:600 }}>
                      <IconWrench size={13} /> {s}
                    </span>
                  ))}
                  {resumeParsed.skills?.length > 5 && (
                    <span style={{ display:'inline-flex', alignItems:'center', color:'rgba(255,255,255,.7)', fontSize:12, padding:'4px 6px', fontWeight:600 }}>
                      +{resumeParsed.skills.length-5} {tr("more skills")}
                    </span>
                  )}
                </div>
              </div>
            )}
            {resumeMsg && (
              <p style={{ color: resumeState === 'error' ? '#fca5a5' : 'rgba(255,255,255,.9)', fontSize:13, margin:0 }}>{resumeMsg}</p>
            )}
          </div>
        )}

        {/* Scanning animation overlay */}
        {resumeState === 'scanning' && (
          <div style={{ marginTop:14, position:'relative', zIndex:1 }}>
            <div style={{ height:3, background:'rgba(255,255,255,.1)', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', background:'linear-gradient(90deg, transparent, #FFD700, transparent)', animation:'resumeScan 1.4s ease-in-out infinite', width:'40%', borderRadius:2 }} />
            </div>
          </div>
        )}
      </div>

      <div className="wp-grid">
        <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
        <form onSubmit={save} className="panel">
          <h2 style={{ marginBottom: 20, fontSize: 18 }}>{tr("Personal Information")}</h2>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#b91c1c', marginBottom: 16, fontSize: 13, border: '1px solid #fca5a5' }}>
              {error}
            </div>
          )}

          <div className="field">
            <span>{tr("Full Name")}</span>
            <div className="in"><IconUser size={17} /><input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder={tr("Your full name")} /></div>
          </div>
          <div className="field">
            <span>{tr("Email")}</span>
            <div className="in"><IconMail size={17} /><input type="email" value={user.email} disabled style={{ opacity: .6 }} /></div>
          </div>
          <div className="field">
            <span>{tr("Phone")}</span>
            <div className="in"><IconPin size={17} /><input inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0917 123 4567" /></div>
            {user.phone_verified ? <small style={{ color: 'var(--green)', fontSize: 12 }}>{tr('Confirmed')}</small> : <small style={{ fontSize: 12 }}><Link to="/dashboard/verification">{tr('Confirm this number')}</Link></small>}
          </div>
          <div className="field">
            <span>{tr("Town / Location")}</span>
            <div className="in">
              <IconPin size={17} />
              <select value={form.location} onChange={e => setForm({ ...form, location: e.target.value, barangay: '' })}>
                <option value="">{tr("Choose your town")}</option>
                {TOWNS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <span>{tr('Barangay')} <em>{tr('Optional')}</em></span>
            <div className="in no-icon">
              <select value={form.barangay} disabled={!form.location} onChange={e => setForm({ ...form, barangay: e.target.value })}>
                <option value="">{form.location ? tr('Choose your barangay') : tr('Choose your town first')}</option>
                {barangaysOf(form.location).map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <span>{tr('Highest education')} *</span>
            <div className="in no-icon">
              <select required value={form.education_level} onChange={e => setForm({ ...form, education_level: e.target.value })}>
                <option value="">{tr('Choose one')}</option>
                {Object.entries(EDUCATION).map(([k, v]) => <option key={k} value={k}>{tr(v)}</option>)}
              </select>
            </div>
            <small style={{ fontSize: 12, color: 'var(--muted)' }}>{tr('Used in your match score (10 of 100 points). "No formal schooling" is a valid answer.')}</small>
          </div>
          <div className="field">
            <span>{tr('Years of work experience')} *</span>
            <div className="in no-icon"><input type="number" required min={0} max={60} value={form.experience_years} onChange={e => setForm({ ...form, experience_years: e.target.value })} placeholder="0" /></div>
            <small style={{ fontSize: 12, color: 'var(--muted)' }}>{tr('Count all paid work, including informal jobs. Used in your match score (15 of 100 points).')}</small>
          </div>
          <div className="field">
            <span>{tr("Bio / About Me")} <em>{tr("Optional")}</em></span>
            <div className="in no-icon">
              <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })}
                placeholder={tr("Brief description of your skills and experience…")} style={{ minHeight: 100 }} />
            </div>
          </div>
          <button type="submit" className={`btn btn-primary ${saved ? 'is-done' : ''}`} disabled={saving}>
            {saving ? <span className="spin" /> : saved ? <><IconCheck size={16} /> {tr("Saved")}</> : tr("Save Changes")}
          </button>
        </form>
        {/* availability needs migration 017: the server sends it once the columns exist */}
        {user.availability && <AvailabilityPanel user={user} call={call} updateUser={updateUser} />}
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="panel" style={{ textAlign: 'center', padding: '28px 20px' }}>
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display: 'none' }}
            />

            {/* Avatar Circle with Camera Overlay */}
            <div style={{ position: 'relative', width: 114, height: 114, margin: '0 auto 16px' }}>
              <div
                onClick={() => !uploadingPhoto && fileInputRef.current?.click()}
                title={tr("Click to upload profile photo")}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '3.5px solid var(--gold)',
                  boxShadow: '0 8px 20px rgba(10,37,87,0.15)',
                  cursor: uploadingPhoto ? 'wait' : 'pointer',
                  position: 'relative',
                  background: '#E2E8F0',
                  transition: 'transform .2s'
                }}
              >
                <img
                  src={currentPhoto}
                  alt={user?.full_name || tr("Profile")}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={e => { e.currentTarget.src = avatarDataUrl(user || {}) }}
                />

                {/* Uploading Spinner Overlay */}
                {uploadingPhoto && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(10, 37, 87, 0.75)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    fontSize: 11,
                    fontWeight: 700
                  }}>
                    <span className="spin" style={{ width: 22, height: 22, marginBottom: 4 }} />
                    <span>{tr("Uploading...")}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Photo Feedback Message */}
            {photoMsg.text && (
              <div style={{
                padding: '6px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 12,
                background: photoMsg.type === 'error' ? '#fee2e2' : '#dcfce7',
                color: photoMsg.type === 'error' ? '#b91c1c' : '#15803d',
                border: `1px solid ${photoMsg.type === 'error' ? '#fca5a5' : '#86efac'}`,
                animation: 'fadeIn .2s'
              }}>
                {photoMsg.text}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
              <button
                type="button"
                className="btn btn-navy btn-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <IconUser size={14} />
                <span>{uploadingPhoto ? tr("Uploading...") : tr("Upload Photo")}</span>
              </button>

              {(user?.picture || previewPhoto) && (
                <button
                  type="button"
                  className="btn btn-light btn-sm"
                  onClick={handleRemovePhoto}
                  disabled={uploadingPhoto}
                  style={{ fontSize: 12, color: '#DC2626' }}
                >
                  {tr("Remove")}
                </button>
              )}
            </div>

            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.4 }}>
              {tr("JPG, PNG, or WEBP up to 5MB.")}<br/>{tr("Clear face photo recommended for faster hiring.")}
            </p>

            <h3 style={{ fontSize: 18, marginBottom: 2 }}>{user.full_name || tr("Worker")}</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12, textTransform: 'capitalize' }}>{user.account_type ? tr(user.account_type) : tr("Skilled Worker")} · {user.location || tr("Oriental Mindoro")}</p>
            {isVerified ? (
              <span className="chip green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                title={tr("Checked and endorsed by a hanapbuhay administrator")}>
                <IconCheck size={12} /> {tr("Verified Profile")}
              </span>
            ) : (
              <>
                <span className="chip gold" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <IconClock size={12} /> {tr("Not yet verified")}
                </span>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '10px 0 0', lineHeight: 1.5 }}>
                  {tr("An admin checks your profile and certificates before you get the Verified badge. Complete your profile and")} <Link to="/dashboard/passport" style={{ color: 'var(--navy)', fontWeight: 600, textDecoration: 'underline' }}>{tr("upload your certificates")}</Link> {tr("to help it get approved.")}
                </p>
              </>
            )}
          </div>
          <div className="panel">
            <h3 style={{ marginBottom: 14, fontSize: 16 }}>{tr("Account Details")}</h3>
            <dl className="facts">
              <div><dt>{tr("Email")}</dt><dd style={{ fontSize: 13 }}>{user.email}</dd></div>
              <div><dt>{tr("Role")}</dt><dd><span className="chip navy">{user.role}</span></dd></div>
              <div><dt>{tr("Type")}</dt><dd style={{ textTransform: 'capitalize' }}>{user.account_type ? tr(user.account_type) : '—'}</dd></div>
              <div><dt>{tr("Google")}</dt><dd>{user.has_google ? <span className="chip green">{tr("Connected")}</span> : '—'}</dd></div>
            </dl>
          </div>
        </div>
      </div>

      {cropModalSrc && (
        <ImageCropModal
          imageSrc={cropModalSrc}
          title={tr("Crop & Adjust Profile Photo")}
          cropShape="circle"
          saving={uploadingPhoto}
          onCrop={handleCroppedPhoto}
          onCancel={() => setCropModalSrc(null)}
        />
      )}
    </div>
  )
}

/* ─ One match: the job, its photo, and the skills behind the score ─
   No training links here: closing a gap is a decision made on the job's own page,
   where the match analysis explains it. A list is for choosing which job to open. */
/* the line a For-you card adds: which of the job's skills you already have */
function SkillFit({ m }) {
  const needs = m.matched.length + m.missing.length
  if (!needs) return null
  return (
    <div className="jc-fit">
      <span className="jc-fit-l">{tr('You have {a} of {b} skills', { a: m.matched.length, b: needs })}</span>
      <span className="jc-fit-bar"><i style={{ width: `${(m.matched.length / needs) * 100}%` }} /></span>
    </div>
  )
}

/* ─ Find Jobs → For you ─────────────────────────────────────
   Only the jobs, best fit first, with one row of filters. The skill-gap panel and the
   stat tiles that used to sit above the list were reports about the list; the list is
   what people came for. Training lives on its own page and on each job's analysis. */
export function JobMatches({ call, user }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [filter, setFilter] = useState('all')
  const [applyJob, setApplyJob] = useState(null)
  const [applying, setApplying] = useState(null)
  const [justApplied, setJustApplied] = useState({})
  const saved = useSavedJobs()

  useEffect(() => {
    let alive = true
    setError('')
    call('/jobs/matches')
      .then(r => { if (alive) setData(r) })
      .catch(e => { if (alive) setError(tr(e?.message || 'Could not load your matches.')) })
    return () => { alive = false }
  }, [call, attempt])

  async function submitApply(note, ack = false) {
    const job = applyJob
    setApplying(job.id)
    try {
      await call('/applications', { method: 'POST', body: { job_id: job.id, cover_note: note, acknowledge_gap: ack } })
      setJustApplied(p => ({ ...p, [job.id]: true }))
      setApplyJob(null)
    } finally {
      setApplying(null)
    }
  }

  const all = data?.jobs || []
  const near = all.filter(j => j.match.distance_km !== null && j.match.distance_km <= 30)
  const strong = all.filter(j => j.match.score >= 70)
  const featured = all.filter(j => Number(j.is_featured) === 1)
  const list = filter === 'strong' ? strong : filter === 'near' ? near : filter === 'featured' ? featured : all
  const summary = data?.summary || {}
  const pay = j => Number(j.salary_max || j.salary_min || 0)
  const pg = usePaged(list, { perPage: 12, sorts: {
    match: [tr('Best match first'), (a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0)],
    near: [tr('Nearest first'), (a, b) => (a.match?.distance_km ?? 9999) - (b.match?.distance_km ?? 9999)],
    pay: [tr('Highest pay'), (a, b) => pay(b) - pay(a)],
    new: [tr('Newest first'), SORT.date('created_at')],
  } })

  const FILTERS = [
    ['all', tr('All'), all.length],
    ['strong', tr('Strong match'), strong.length],
    ['near', tr('Within 30 km'), near.length],
    ['featured', tr('Featured'), featured.length],
  ]

  return (
    <div className="page-inner">
      {applyJob && (
        <QuickApplyModal job={applyJob} user={user} skills={applyJob.match?.matched || []}
          onClose={() => setApplyJob(null)} onSubmit={submitApply} />
      )}

      {error && (
        <div className="panel" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, color: 'var(--red)' }}>
          <span>{error}</span>
          <button type="button" className="btn btn-light btn-sm" onClick={() => setAttempt(n => n + 1)}>{tr("Retry")}</button>
        </div>
      )}

      {!data && !error && <BrandLoader compact label={tr('Finding your matches…')} />}

      {data && (
        <>
          {summary.skills === 0 && (
            <div className="mc-hint">
              <span>{tr('Add your skills to get accurate matches. Until then every score is low.')}</span>
              <Link to="/dashboard/passport" className="btn btn-primary btn-sm">{tr('Add skills')}</Link>
            </div>
          )}

          <div className="mc-bar">
            <div className="mc-chips" role="group" aria-label={tr('Filter matches')}>
              {FILTERS.map(([id, label, n]) => (
                <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
                  {label} <span>{n}</span>
                </button>
              ))}
            </div>
            {summary.town && <span className="mc-sort">{tr('near {town}', { town: summary.town })}</span>}
          </div>
          {list.length > 0 && <ListTools pg={pg} noun={tr('job')} plural={tr('jobs')} perPageOptions={[12, 24, 48]} />}

          {list.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: '40px 16px' }}>
              <p style={{ color: 'var(--muted)', marginBottom: 16 }}>{all.length ? tr("No jobs in this filter.") : tr("No open jobs right now.")}</p>
              <Link to="/dashboard/browse" className="btn btn-navy">{tr("Search all jobs")}</Link>
            </div>
          ) : (
            <>
            <div className="jc-grid">
              {pg.items.map(j => (
                <FeaturedJobCard key={j.id} job={j} detailsTo={`/dashboard/browse/${j.id}`}
                  saved={saved.isSaved(j.id)} onToggleSave={saved.toggle}
                  onApply={setApplyJob} busy={applying === j.id}
                  applied={j.applied || justApplied[j.id]}>
                  <SkillFit m={j.match} />
                </FeaturedJobCard>
              ))}
            </div>
            <Pager pg={pg} />
            </>
          )}
        </>
      )}
    </div>
  )
}
