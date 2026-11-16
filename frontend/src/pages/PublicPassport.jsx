// /p/:token — a worker's Skills Passport, opened from the link or QR code they shared.
// Public (no account needed) and printable on one page. No phone, email or address:
// employers contact the worker through hanapbuhay.
import { useEffect, useState } from 'react'
import BrandLoader from '../components/BrandLoader.jsx'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Logo, IconCheck, IconPin, IconShield, IconBriefcase, IconBook, IconPrinter, IconMsgCircle, IconCalendar } from '../components/icons.jsx'
import WorkPhotos from '../components/WorkPhotos.jsx'
import '../styles/passport.css'
import { avatarDataUrl } from '../components/Avatar.jsx'

const TYPE_LABEL = { 'full-time': 'Full-time', 'part-time': 'Part-time', contractual: 'Contractual', freelance: 'Freelance', gig: 'Arawan / Raket' }
const year = v => (v ? new Date(String(v).replace(' ', 'T')).getFullYear() : '')
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s)

export default function PublicPassport() {
  const { token } = useParams()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const [p, setP] = useState(null)
  const [error, setError] = useState('')
  const [qr, setQr] = useState('')
  const url = `${window.location.origin}/p/${token}`

  useEffect(() => {
    let alive = true
    api(`/passport/${encodeURIComponent(token)}`)
      .then(r => { if (alive) setP(r.passport) })
      .catch(e => { if (alive) setError(e.status === 404 ? 'gone' : e.message || 'Could not load this Skills Passport.') })
    import('qrcode-generator').then(({ default: qrcode }) => {
      const q = qrcode(0, 'M'); q.addData(url); q.make()
      if (alive) setQr(q.createSvgTag({ cellSize: 3, margin: 1, scalable: true }))
    }).catch(() => {})
    return () => { alive = false }
  }, [token, url])

  // a shared link shouldn't end up in search results
  useEffect(() => {
    const m = Object.assign(document.createElement('meta'), { name: 'robots', content: 'noindex' })
    document.head.appendChild(m)
    return () => m.remove()
  }, [])

  useEffect(() => {
    if (!p) return
    document.title = `${p.full_name} · Skills Passport · hanapbuhay`
    if (params.get('print') === '1') { const t = setTimeout(() => window.print(), 600); return () => clearTimeout(t) }
  }, [p, params])

  if (error) {
    return (
      <div className="pp-page">
        <header className="pp-top"><Logo height={36} /></header>
        <main className="pp-sheet pp-gone">
          <h1>{error === 'gone' ? 'This link is not active' : 'Something went wrong'}</h1>
          <p>{error === 'gone' ? 'The worker may have turned off sharing or made a new link. Ask them for their current link or QR code.' : error}</p>
          <Link to="/jobs" className="btn btn-navy">Browse jobs on hanapbuhay</Link>
        </main>
      </div>
    )
  }
  if (!p) {
    return (
      <div className="pp-page">
        <header className="pp-top"><Logo height={36} /></header>
        <main className="pp-sheet" aria-busy="true">
          <BrandLoader compact label="Loading the Skills Passport…" />
        </main>
      </div>
    )
  }

  const first = p.full_name?.split(' ')[0] || 'this worker'
  const verifiedSkills = p.skills.filter(s => s.verified)
  const otherSkills = p.skills.filter(s => !s.verified)
  const av = p.availability
  const isEmployer = user && (user.account_type === 'employer' || user.account_type === 'hirer')
  const contactTo = isEmployer ? `/dashboard/messages?to=${p.id}` : user ? null : '/register'

  return (
    <div className="pp-page">
      <header className="pp-top">
        <Logo height={36} />
        <div className="pp-top-actions">
          <button type="button" className="btn btn-light btn-sm" onClick={() => window.print()}><IconPrinter size={15} /> Print / Save PDF</button>
        </div>
      </header>

      <main className="pp-sheet">
        <section className="pp-head">
          <div className="pp-photo">
            <img src={p.picture || avatarDataUrl(p)} alt="" onError={e => { e.currentTarget.src = avatarDataUrl(p) }} />
          </div>
          <div className="pp-who">
            <p className="pp-eyebrow">Skills Passport · hanapbuhay Oriental Mindoro</p>
            <h1>{p.full_name}</h1>
            <p className="pp-line">
              {p.location && <span><IconPin size={14} /> {p.location}</span>}
              {p.member_since && <span><IconCalendar size={14} /> Member since {year(p.member_since)}</span>}
              {p.hired_count > 0 && <span><IconBriefcase size={14} /> Hired {p.hired_count} {p.hired_count === 1 ? 'time' : 'times'} through hanapbuhay</span>}
            </p>
            <div className="pp-badges">
              {p.is_verified && <span className="pp-badge ok"><IconCheck size={13} /> Profile verified by hanapbuhay</span>}
              {av && <span className={`pp-badge ${av.open_to_work ? 'open' : ''}`}>{av.open_to_work ? 'Open to work' : 'Not looking right now'}</span>}
            </div>
          </div>
          {qr && <div className="pp-qr" aria-hidden="true" dangerouslySetInnerHTML={{ __html: qr }} />}
        </section>

        {p.bio && <section className="pp-sec"><h2>About</h2><p className="pp-bio">{p.bio}</p></section>}

        {av && av.open_to_work && (av.work_types.length > 0 || av.preferred_towns.length > 0) && (
          <section className="pp-sec">
            <h2>Looking for</h2>
            <dl className="pp-facts">
              {av.work_types.length > 0 && <div><dt>Work</dt><dd>{av.work_types.map(t => TYPE_LABEL[t] || t).join(', ')}</dd></div>}
              {av.preferred_towns.length > 0 && <div><dt>Towns</dt><dd>{av.preferred_towns.length >= 15 ? 'Anywhere in Oriental Mindoro' : av.preferred_towns.join(', ')}</dd></div>}
            </dl>
          </section>
        )}

        <section className="pp-sec">
          <h2>Skills <span>{p.skills.length}</span></h2>
          {p.skills.length === 0 ? <p className="pp-muted">No skills listed yet.</p> : (
            <ul className="pp-skills">
              {[...verifiedSkills, ...otherSkills].map((s, i) => (
                <li key={i} className={s.verified ? 'v' : ''}>
                  {s.verified && <IconShield size={13} aria-label="Verified certificate" />}
                  <span>{s.name}</span>
                  {s.level && <em>{cap(s.level)}</em>}
                  {s.source === 'tesda' && <b>TESDA</b>}
                </li>
              ))}
            </ul>
          )}
          {verifiedSkills.length > 0 && <p className="pp-note"><IconShield size={12} /> Backed by a certificate an admin checked.</p>}
        </section>

        {p.certificates.length > 0 && (
          <section className="pp-sec">
            <h2>Verified certificates</h2>
            <ul className="pp-list">
              {p.certificates.map((c, i) => (
                <li key={i}>
                  <b>{c.title}{c.nc_level ? ` (NC ${c.nc_level})` : ''}</b>
                  <span>{[c.issuer, c.issued_on && `Issued ${year(c.issued_on)}`, c.valid_until && `Valid until ${year(c.valid_until)}`].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <WorkPhotos variant="pp" items={p.work || []} title="Work photos" />

        {p.experience.length > 0 && (
          <section className="pp-sec">
            <h2>Work experience</h2>
            <ul className="pp-list">
              {p.experience.map((e, i) => (
                <li key={i}>
                  <b>{e.position}{e.employer ? ` · ${e.employer}` : ''}</b>
                  <span>{[e.place, [e.start, e.end].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')}</span>
                  {e.details && <p>{e.details}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {(p.education.length > 0 || p.languages) && (
          <section className="pp-sec pp-two">
            {p.education.length > 0 && (
              <div>
                <h2><IconBook size={15} /> Education</h2>
                <ul className="pp-list">
                  {p.education.map((e, i) => <li key={i}><b>{e.school}</b><span>{[e.level, e.year].filter(Boolean).join(' · ')}</span></li>)}
                </ul>
              </div>
            )}
            {p.languages && <div><h2>Languages</h2><p className="pp-bio">{p.languages}</p></div>}
          </section>
        )}

        <section className="pp-contact">
          <div>
            <b>Want to hire {first}?</b>
            <span>Message them on hanapbuhay. Contact details are shared only through the app.</span>
          </div>
          {contactTo
            ? <Link to={contactTo} className="btn btn-primary"><IconMsgCircle size={16} /> {isEmployer ? `Message ${first}` : 'Sign up free to message'}</Link>
            : <Link to="/dashboard" className="btn btn-light">Go to your dashboard</Link>}
        </section>

        <footer className="pp-foot">
          <span>{url}</span>
          <span>hanapbuhay Oriental Mindoro · Skills Passport</span>
        </footer>
      </main>
    </div>
  )
}
