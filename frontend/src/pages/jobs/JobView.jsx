/**
 * JobView — one job posting, public and inside the dashboard.
 *
 * The heart of it is the Match Analysis: the server scores the job against the person's
 * Skills Passport with the same Job_matcher that scores their application, so the number
 * here, on the job list, on Job Matches and on the employer's applicant list is always
 * the same number. Each required skill is shown as held or missing, and every missing
 * one links straight to the TESDA course that teaches it, with the schools in Oriental
 * Mindoro that offer it.
 */
import { matchKey, matchLevel } from '../../utils/match.js'
import QuickApplyModal from '../../components/QuickApplyModal.jsx'
import { useCallback, useEffect, useState } from 'react'
import BrandLoader from '../../components/BrandLoader.jsx'
import MatchRing from '../../components/MatchRing.jsx'
import { paySuffix, PAY_LABEL, neededBy } from '../../components/JobCard.jsx'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth.jsx'
import { api } from '../../api.js'
import { IconPin, IconBriefcase, IconClock, IconCheck, IconAlert, IconSend, IconBuilding, IconCalendar, IconUsers, IconShield, IconArrow, IconStar, IconBookmark, IconMsgCircle, IconBack, IconX } from '../../components/icons.jsx'
import UserAvatar from '../../components/Avatar.jsx'
import { getJobImage } from '../../utils/jobImages.js'
import Gallery from '../../components/Gallery.jsx'
import { apiUrl } from '../../utils/photos.js'
import { coursesForSkill } from '../../utils/tesdaCourses.js'
import EnrollLink from '../../components/EnrollLink.jsx'
import CertificateUpload from '../../components/CertificateUpload.jsx'
import { ProposalDialog } from '../dashboard/worker/WorkerGigs.jsx'
import { CATEGORIES, EDUCATION } from '../../utils/categories.js'
import { phDate } from '../../utils/format.js'
import { MESSAGES_PATH, roleOf } from '../dashboard/nav.js'
import '../../styles/platform.css'
import { useSavedJobs, fmtSalary, timeAgo, parseSkills, FeaturedJobCard } from '../../components/JobCard.jsx'
import { typeLabel } from './JobSearch.jsx'
import '../../styles/public.css'
import '../../styles/jobview.css'


export function StarRow({ value = 0, size = 14 }) {
  return (
    <span className="stars" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={i <= Math.round(value) ? '#F5A623' : '#e5e7eb'}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  )
}

/* ─ Match analysis ─────────────────────────────────────────
   "How you match", the way the big job sites present it: one verdict, one sentence
   explaining it, then a checklist of what the employer asked for — each line saying
   plainly whether you have it. A missing skill carries its own way to learn it, right
   on that line; there is no separate gap panel to read and reconcile with the list.
*/
const VERDICT = s => [matchKey(s), matchLevel(s).label]

export function MatchAnalysis({ job, user, basePath = '/jobs', call, onChanged }) {
  const [upload, setUpload] = useState(false)
  const m = job.match
  if (!user) {
    return (
      <section className="jv-card ma-cta">
        <div>
          <h2>See how well you match</h2>
          <p>Sign in to compare this job with your skills and certificates.</p>
        </div>
        <Link to="/login" state={{ from: `/jobs/${job.id}` }} className="btn btn-primary">Sign in</Link>
      </section>
    )
  }
  if (!m) return null

  const [tone, verdict] = VERDICT(m.score)
  const where = m.distance_km === null ? null : m.distance_km === 0 ? 'in your town' : `${m.distance_km} km from ${user.location || 'you'}`
  // what is lacking: skills and certificates (with training), then experience and education
  const gaps = (m.gaps || []).map(g => ({ ...g, course: g.kind === 'skill' || g.kind === 'certificate' ? coursesForSkill(g.name, 1)[0] || null : null }))
  const training = basePath.startsWith('/dashboard') ? '/dashboard/training' : '/training'

  return (
    <section className={`jv-card ma ${tone}`} aria-labelledby="ma-h">
      <header className="ma-hd">
        <MatchRing score={m.score} size={84} />
        <div>
          <p className="ma-kicker">How you match</p>
          <h2 id="ma-h">{verdict}</h2>
          <p className="ma-sum">{m.matched.length + m.missing.length > 0 ? `You have ${m.matched.length} of ${m.matched.length + m.missing.length} requirements.` : 'The employer did not list specific skills.'}{where ? ` The job is ${where}.` : ''}</p>
        </div>
      </header>

      {gaps.length > 0 && (
        <div className="ma-gaps">
          <p className="ma-gap-line"><b>Missing:</b> {gaps.map(g => g.name).join(', ')}</p>
          <ul className="ma-list">
            {gaps.map(g => (
              <li key={g.name} className="missing">
                <span className="ma-ic" aria-hidden="true"><IconX size={13} /></span>
                <div className="ma-main"><b>{g.name}</b>{g.pending && <small>Your certificate is being checked</small>}</div>
                <span className="ma-state">
                  {g.kind === 'experience' || g.kind === 'education'
                    ? <Link to="/dashboard/profile" className="ma-learn">Update profile</Link>
                    : g.course ? <EnrollLink course={g.course} className="ma-learn">Find training</EnrollLink> : null}
                </span>
              </li>
            ))}
          </ul>
          {gaps.some(g => g.kind === 'certificate' || g.kind === 'skill') && user.account_type === 'worker' && call && (
            upload
              ? <div style={{ marginTop: 10 }}><CertificateUpload call={call} user={user} onSaved={() => { setUpload(false); onChanged?.() }} /></div>
              : <p className="pf-small" style={{ margin: '8px 0 0' }}>Finished a training? <button type="button" className="ma-learn" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }} onClick={() => setUpload(true)}>Upload your certificate</button>. Once our team accepts it, it counts here and your score goes up.</p>
          )}
        </div>
      )}

      {(m.parts || []).length > 0 && (
        <details className="ma-why">
          <summary>How this score is counted</summary>
          <ul className="ma-parts">
            {m.parts.map(p => (
              <li key={p.key}>
                <span className="pf-between"><b>{p.label}</b><span>{p.points} / {p.max}</span></span>
                <span className="pf-progress"><i style={{ width: `${(p.points / p.max) * 100}%` }} /></span>
                <small>{p.explain}</small>
              </li>
            ))}
          </ul>
          <p className="pf-small">A fixed formula: skills 45, experience 15, certificates 15, distance 15, education 10. Anything the job does not ask for counts as met. <Link to="/faq#matching">More about matching</Link></p>
          {gaps.some(g => g.course) && <Link to={training} className="ma-more">Free TESDA courses for these gaps <IconArrow size={12} /></Link>}
        </details>
      )}
    </section>
  )
}

/* ─ Employer reviews ─────────────────────────────────────── */
function EmployerReviews({ employerId, company }) {
  const [data, setData] = useState(null)
  useEffect(() => { api(`/employers/${employerId}/reviews`).then(setData).catch(() => setData(null)) }, [employerId])
  if (!data?.summary?.count) return null
  const { summary, reviews } = data
  return (
    <section className="jv-card" id="reviews">
      <h2>What hired workers say about {company}</h2>
      <p className="jv-rating-line">
        <StarRow value={summary.average} size={16} />
        <b>{summary.average.toFixed(1)}</b> from {summary.count} {summary.count === 1 ? 'worker' : 'workers'} they hired through hanapbuhay
      </p>
      <ul className="jv-reviews">
        {reviews.map((r, i) => (
          <li key={i}>
            <div className="jv-review-top">
              <StarRow value={r.rating} size={13} />
              <b>{r.by}</b>
              <span>{[r.job_title, r.created_at && new Date(String(r.created_at).replace(' ', 'T')).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })].filter(Boolean).join(' · ')}</span>
            </div>
            {r.comment && <p>{r.comment}</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ─ Page ─────────────────────────────────────────────────── */
export default function JobView({ embedded = false, basePath = '/jobs' }) {
  const { id } = useParams()
  const nav = useNavigate()
  const { user, call } = useAuth()
  const saved = useSavedJobs()

  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [applied, setApplied] = useState(false)
  const [showApply, setShowApply] = useState(false)
  const [done, setDone] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportMsg, setReportMsg] = useState('')
  const [reportBusy, setReportBusy] = useState(false)
  const [proposal, setProposal] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const get = user && call ? call(`/jobs/${id}`) : api(`/jobs/${id}`)
    get.then(r => { setJob(r.job || null); setApplied(!!r.job?.applied) })
      .catch(() => setJob(null))
      .finally(() => setLoading(false))
  }, [id, user, call])

  useEffect(() => { load() }, [load])

  // the shared apply dialog (QuickApplyModal) shows the fit check, then sends through here
  async function apply(note, acknowledge = false) {
    await call('/applications', { method: 'POST', body: { job_id: Number(id), cover_note: note, acknowledge_gap: acknowledge } })
    setApplied(true); setShowApply(false); setDone('Application sent. The employer was told by email.')
  }
  // Apply / Send proposal, decided by who is looking and what kind of post it is
  function startApply() {
    if (!user) return nav('/login', { state: { from: `/jobs/${id}` } })
    if (isGig) return setProposal(true)
    setShowApply(true)
  }

  async function sendReport(e) {
    e.preventDefault()
    setReportBusy(true); setReportMsg('')
    try {
      const r = await call(`/jobs/${id}/report`, { method: 'POST', body: { reason: reportReason } })
      setReportMsg(r?.message || 'Thank you. Our team will review this job post.')
      setReportReason('')
    } catch (err) {
      setReportMsg(err.message || 'Could not send the report.')
    } finally { setReportBusy(false) }
  }

  if (loading) {
    return (
      <div className={`jv${embedded ? ' is-embedded' : ''}`}>
        <BrandLoader label="Loading the job…" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className={`jv${embedded ? ' is-embedded' : ''}`}>
        <div className="jv-card" style={{ textAlign: 'center', padding: 40 }}>
          <h2 style={{ fontSize: 22, marginBottom: 8 }}>This job is no longer available</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 20 }}>It may have been filled, closed or removed by the employer.</p>
          <Link to={basePath} className="btn btn-primary">Browse open jobs</Link>
        </div>
      </div>
    )
  }

  const j = job
  const company = j.company || j.employer_name || 'Local employer'
  const skills = parseSkills(j.skills_needed)
  const isWorker = user?.account_type === 'worker' && user?.role !== 'admin'
  const isOwner = user && Number(user.id) === Number(j.employer_id)
  const isGig = j.post_type === 'gig'
  const ended = j.is_open === false
  const notSeeker = user && !isWorker && !isOwner
  const msgPath = user ? MESSAGES_PATH[roleOf(user)] : '/login'
  const applyLabel = isGig ? 'Send proposal' : 'Apply now'

  // the post's details, in the order a worker decides by
  const EXP = { none: 'No experience needed', '1': 'At least 1 year', '2-3': '2–3 years', '4+': '4 years or more' }
  const details = [
    Number(j.is_urgent) === 1 && ['Urgency', 'Urgent — needed as soon as possible'],
    j.needed_by && ['Needed', neededBy(j)],
    j.duration && ['How long', j.duration],
    Number(j.openings) > 0 && ['Openings', Number(j.openings) === 1 ? '1 person' : `${j.openings} people`],
    j.schedule && ['Schedule', j.schedule],
    j.experience && ['Experience', EXP[j.experience] || j.experience],
    j.education_level && j.education_level !== 'none' && ['Education', `At least: ${EDUCATION[j.education_level]}`],
    j.expires_at && ['Open until', phDate(j.expires_at)],
    j.address && ['Where exactly', `${j.address}, ${j.location || 'Oriental Mindoro'}`],
  ].filter(Boolean)
  const benefits = String(j.benefits || '').split(',').map(x => x.trim()).filter(Boolean)

  return (
    <div className={`jv${embedded ? ' is-embedded' : ''}`}>
      {embedded && (
        <Link to={basePath} className="jv-back"><IconBack size={15} /> Back to Job Search</Link>
      )}
      <div className="jv-grid">
        <div className="jv-main">
          {/* header */}
          <section className="jv-card jv-head">
            {(j.photos || []).length > 1 ? (
              <div className="jv-gallery"><Gallery photos={j.photos.map(p => apiUrl(p.url))} alt={`Photo for ${j.title}`} ratio="16 / 8" /></div>
            ) : Number(j.image_v) > 0 && (
              <div className="jv-cover"><img src={getJobImage(j)} alt={`Photo for ${j.title}`} /></div>
            )}
            <div className="jv-head-top">
              <div className="jv-logo">
                <span>{company[0]?.toUpperCase()}</span>
                {/* the banner already shows the job's own photo; here, the employer's logo or initial */}
                {(j.employer_picture || !(Number(j.image_v) > 0)) && <img src={j.employer_picture || getJobImage(j)} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />}
              </div>
              <div className="jv-head-copy">
                <h1>{j.title}</h1>
                <p className="jv-co">
                  {j.employer_id
                    ? <Link to={embedded ? `/dashboard/people/${j.employer_id}` : `/jobs?q=${encodeURIComponent(company)}`}>{company}</Link>
                    : company}
                  {Number(j.employer_verified) === 1 && <span className="jv-vchk" title="Verified employer"><IconShield size={13} /> Verified</span>}
                  {j.employer_rating?.count > 0 && (
                    <a href="#reviews" className="jv-rating-link">
                      <StarRow value={j.employer_rating.average} /> {j.employer_rating.average.toFixed(1)}
                      <small>({j.employer_rating.count})</small>
                    </a>
                  )}
                </p>
                <div className="jv-meta">
                  <span className={`pf-type ${isGig ? 'gig' : 'job'}`}>{isGig ? 'Gig' : 'Job'}</span>
                  <span><IconPin size={14} />{[j.barangay, j.location].filter(Boolean).join(', ')}</span>
                  {j.category && <span>{CATEGORIES[j.category]}</span>}
                  <span><IconBriefcase size={14} />{typeLabel(j.job_type)}</span>
                  <span><IconClock size={14} />Posted {timeAgo(j.created_at) || 'recently'}</span>
                  <span><IconUsers size={14} />{j.applicants || 0} applicant{Number(j.applicants) === 1 ? '' : 's'}</span>
                </div>
              </div>
              {j.match && (
                <MatchRing score={j.match.score} size={80} />
              )}
            </div>

            <div className="jv-head-foot">
              <div>
                <small>{PAY_LABEL[j.pay_basis || 'month']}</small>
                <b>{fmtSalary(j.salary_min, j.salary_max)}{(j.salary_min || j.salary_max) ? <small className="jv-pay-unit"> {paySuffix(j)}</small> : null}</b>
              </div>
              <div className="jv-head-actions">
                {user && (
                  <button type="button" className={`jrow-save${saved.isSaved(j.id) ? ' on' : ''}`} onClick={() => saved.toggle(j.id)}
                    aria-pressed={saved.isSaved(j.id)} title={saved.isSaved(j.id) ? 'Saved' : 'Save this job'}>
                    <IconBookmark size={16} />
                  </button>
                )}
                {user && j.employer_id && !isOwner && (
                  <Link to={`${msgPath}?to=${j.employer_id}`} className="btn btn-light">
                    <IconMsgCircle size={15} /> Message
                  </Link>
                )}
                {done
                  ? <span className="jv-applied"><IconCheck size={18} /> {done}</span>
                  : applied
                    ? <span className="jv-applied"><IconCheck size={18} /> You applied for this job</span>
                    : isOwner
                      ? <Link to={isGig ? `/dashboard/proposals?gig=${j.id}` : `/dashboard/applicants/${j.id}`} className="btn btn-navy">{isGig ? 'View proposals' : 'View applicants'}</Link>
                      : ended ? <span className="jv-applied" style={{ color: 'var(--muted)' }}>This post has ended</span>
                      : <button className="btn btn-primary btn-lg" onClick={startApply} disabled={notSeeker}>{applyLabel}</button>}
              </div>
            </div>
          </section>

          {notSeeker && !ended && (
            <p className="pf-note info">Only job seekers can {isGig ? 'send proposals' : 'apply'}. You are signed in as {user.role === 'admin' ? 'an administrator' : user.account_type === 'hirer' ? 'a client' : 'an employer'}. To look for work, sign up with a separate job seeker account.</p>
          )}
          {isWorker && <MatchAnalysis job={j} user={user} basePath={basePath} call={call} onChanged={load} />}
          {!user && <MatchAnalysis job={j} user={user} basePath={basePath} />}

          {details.length > 0 && (
            <section className="jv-card">
              <h2>Job details</h2>
              <dl className="jv-details">
                {details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
              </dl>
              {benefits.length > 0 && (
                <>
                  <h3 className="jv-sub">Benefits</h3>
                  <ul className="jv-chips">{benefits.map(b => <li key={b} className="ok"><IconCheck size={13} />{b}</li>)}</ul>
                </>
              )}
            </section>
          )}

          <section className="jv-card">
            <h2>Job description</h2>
            <div className="jv-prose">
              {(j.description || 'The employer did not add a description.').split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </section>

          {j.requirements && (
            <section className="jv-card">
              <h2>Requirements</h2>
              <ul className="jv-reqs">
                {j.requirements.split('\n').filter(Boolean).map((r, i) => (
                  <li key={i}><IconCheck size={15} />{r}</li>
                ))}
              </ul>
            </section>
          )}

          {/* the match checklist above already lists these for a signed-in worker */}
          {skills.length > 0 && !j.match && (
            <section className="jv-card">
              <h2>Skills the employer asked for</h2>
              <ul className="jv-chips">
                {skills.map(s => {
                  const has = j.match?.matched?.some(x => x.toLowerCase() === s.toLowerCase())
                  const missing = j.match?.missing?.some(x => x.toLowerCase() === s.toLowerCase())
                  return (
                    <li key={s} className={has ? 'ok' : missing ? 'gap' : ''}>
                      {has ? <IconCheck size={13} /> : missing ? <IconAlert size={13} /> : null}{s}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {j.employer_rating?.count > 0 && j.employer_id && <EmployerReviews employerId={j.employer_id} company={company} />}

          {j.similar?.length > 0 && (
            <section>
              <h2 className="jv-section-h">Similar jobs {user?.location ? `near ${user.location}` : 'in Oriental Mindoro'}</h2>
              <div className="jc-grid jv-similar">
                {j.similar.slice(0, 4).map(s => (
                  <FeaturedJobCard key={s.id} job={s} detailsTo={`${basePath}/${s.id}`} compact
                    saved={saved.isSaved(s.id)} onToggleSave={user ? saved.toggle : undefined} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* sidebar */}
        <aside className="jv-side">
          <div className="jv-apply-box">
            <h3>{applied ? 'Application sent' : ended ? 'This post has ended' : isGig ? 'Can you do this gig?' : 'Ready to apply?'}</h3>
            <p>{applied
              ? 'Track the reply under Applications.'
              : ended ? 'It no longer takes applications. Similar open posts are listed below.'
              : isGig ? 'Send the client your price and how many days you need.' : 'Your Skills Passport is shared with the employer automatically.'}</p>
            {applied
              ? <Link to="/dashboard/applied" className="btn btn-primary btn-block">Track my application</Link>
              : isOwner
                ? <Link to={`/dashboard/jobs/${j.id}/edit`} className="btn btn-primary btn-block">Edit this job post</Link>
                : ended ? <Link to={basePath} className="btn btn-light btn-block">See open posts</Link>
                : <button className="btn btn-primary btn-block btn-lg" onClick={startApply} disabled={notSeeker}>{applyLabel}</button>}
            {notSeeker && <p className="jv-signin-note">Only job seekers can {isGig ? 'send proposals' : 'apply'}.</p>}
            {!user && <p className="jv-signin-note"><Link to="/login" state={{ from: `/jobs/${id}` }}>Sign in</Link> or <Link to="/register" state={{ from: `/jobs/${id}` }}>create a free account</Link> to {isGig ? 'send a proposal' : 'apply'}. We bring you back to this post.</p>}
          </div>

          <div className="jv-card jv-facts">
            <h3>Job overview</h3>
            <dl>
              <div><dt><IconBriefcase size={14} /> Type</dt><dd>{typeLabel(j.job_type)}</dd></div>
              <div><dt><IconPin size={14} /> Town</dt><dd>{j.location}</dd></div>
              <div><dt><IconCalendar size={14} /> Posted</dt><dd>{timeAgo(j.created_at) || '—'}</dd></div>
              <div><dt><IconBuilding size={14} /> Company</dt><dd>{company}</dd></div>
              <div><dt><IconUsers size={14} /> Views</dt><dd>{j.views || 0}</dd></div>
              {j.employer_rating && (
                <div><dt><IconStar size={14} /> Rating</dt><dd>{j.employer_rating.count > 0
                  ? <a href="#reviews">{j.employer_rating.average.toFixed(1)} / 5 ({j.employer_rating.count})</a>
                  : <span style={{ color: 'var(--muted)' }}>No reviews yet</span>}</dd></div>
              )}
            </dl>
          </div>

          {j.employer_id && (
            <div className="jv-card jv-employer">
              <h3>About the employer</h3>
              <div className="jv-employer-row">
                <UserAvatar id={j.employer_id} name={company} picture={j.employer_picture} size={44} rounded="rounded" />
                <div>
                  <b>{company}</b>
                  <small>{j.employer_location || j.location}</small>
                </div>
              </div>
              {j.employer_bio && <p className="jv-employer-bio">{j.employer_bio}</p>}
              <Link to={embedded ? `/dashboard/people/${j.employer_id}` : '/register'} className="btn btn-light btn-block btn-sm">
                {embedded ? 'View employer profile' : 'Sign up to view profile'}
              </Link>
            </div>
          )}

          {user && !isOwner && (
            <div className="jv-report">
              {!reportOpen ? (
                <button type="button" onClick={() => setReportOpen(true)}><IconAlert size={14} /> Report this job</button>
              ) : (
                <form onSubmit={sendReport}>
                  <label htmlFor="jv-report">What is wrong with this job post?</label>
                  <textarea id="jv-report" rows={3} value={reportReason} onChange={e => setReportReason(e.target.value)}
                    placeholder="e.g. asks applicants to pay a fee, fake company, offensive content…" />
                  {reportMsg && <p className={reportMsg.startsWith('Thank') || reportMsg.startsWith('You already') ? 'ok' : 'err'}>{reportMsg}</p>}
                  <div>
                    <button type="submit" className="btn btn-navy btn-sm" disabled={reportBusy || reportReason.trim().length < 5}>{reportBusy ? 'Sending…' : 'Send report'}</button>
                    <button type="button" className="btn btn-light btn-sm" onClick={() => { setReportOpen(false); setReportMsg('') }}>Close</button>
                  </div>
                </form>
              )}
            </div>
          )}
        </aside>
      </div>

      {proposal && <ProposalDialog gig={j} call={call} onClose={() => setProposal(false)} onSent={() => { setProposal(false); setApplied(true); setDone('Proposal sent. We’ll tell you when the client answers.') }} />}
      {showApply && (
        <QuickApplyModal job={j} user={user} skills={j.match?.matched || []}
          onClose={() => setShowApply(false)} onSubmit={apply} />
      )}
    </div>
  )
}
