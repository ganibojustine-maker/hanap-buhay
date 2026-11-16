import { useEffect, useId, useRef, useState } from 'react'
import WorkPhotos from './WorkPhotos.jsx'
import BrandLoader from './BrandLoader.jsx'
import { IconX, IconMail, IconPhone, IconPin, IconShield, IconCheck, IconFile, IconEye, IconClock } from './icons.jsx'
import '../styles/applicant.css'

// The applicant's full profile, for the employer who owns the job:
// match for this job, Skills Passport, TESDA certificates (with the files),
// and the resume from the worker's Resume Builder, downloadable as a PDF.
// Data: GET /api/applications/:id/profile (ApplicationController::applicant_profile)

const LEVEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', expert: 'Expert' }
const CERT_STATUS = { verified: ['green', 'Verified'], rejected: ['red', 'Not accepted'], pending: ['gold', 'Not yet checked'] }
const since = d => (d ? new Date(d.replace(' ', 'T')).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }) : '')

// the worker's availability (set on their profile), as label/value rows
const WORK_LABEL = { 'full-time': 'Full-time', 'part-time': 'Part-time', contractual: 'Contractual', freelance: 'Freelance', gig: 'Arawan / Raket' }
const UNIT_LABEL = { day: 'per day', month: 'per month', hour: 'per hour', project: 'per project' }
function availabilityRows(a) {
  if (!a) return []
  const rows = []
  if (a.work_types?.length) rows.push(['Work', a.work_types.map(t => WORK_LABEL[t] || t).join(', ')])
  if (a.expected_rate) rows.push(['Expected pay', `₱${Number(a.expected_rate).toLocaleString()} ${UNIT_LABEL[a.rate_unit] || ''}`.trim()])
  if (a.preferred_towns?.length) rows.push(['Towns', a.preferred_towns.length >= 15 ? 'Anywhere in Oriental Mindoro' : a.preferred_towns.join(', ')])
  return rows
}

/** Resume for the PDF: the worker's own Resume Builder draft, or one made from the profile. */
function resumeFor(data) {
  const w = data.worker
  const r = data.resume
  if (r && (r.full_name || r.about || r.experience?.length)) return { ...r, email: r.email || w.email, phone: r.phone || w.phone }
  return {
    theme: 'navy', full_name: w.full_name, email: w.email, phone: w.phone, town: w.location || '', address: '', about: w.bio || '',
    skills: data.skills.filter(s => !s.certificate_id && s.source !== 'tesda').map(s => ({ name: s.skill_name, level: s.level || '' })),
    certifications: data.certificates.map(c => ({ title: c.title, issuer: c.issuer || '', number: c.cert_number || '', year: (c.issued_on || '').slice(0, 4) })),
    experience: [], education: [], birthdate: '', languages: '',
  }
}

export default function ApplicantProfile({ appId, call, onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const [fileMsg, setFileMsg] = useState('')
  const panel = useRef(null)
  const opener = useRef(typeof document !== 'undefined' ? document.activeElement : null)
  const titleId = useId()

  useEffect(() => {
    let alive = true
    call(`/applications/${appId}/profile`)
      .then(r => { if (alive) setData(r) })
      .catch(e => { if (alive) setError(e?.message || 'Could not load this profile.') })
    return () => { alive = false }
  }, [appId, call])

  useEffect(() => {
    panel.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); opener.current?.focus?.() }
  }, [onClose])

  async function openCert(cert) {
    setFileMsg('')
    const win = window.open('', '_blank')
    try {
      const r = await call(`/skills/certificates/${cert.id}/file`)
      const url = URL.createObjectURL(await (await fetch(r.data_url)).blob())
      if (win) win.location.href = url; else window.location.href = url
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (e) {
      win?.close()
      setFileMsg(e?.message || 'Could not open the certificate file.')
    }
  }

  async function downloadResume() {
    setPdfBusy(true)
    try {
      const { buildResumePdf, photoToJpeg, resumeFileName } = await import('../utils/resumePdf.js')
      const r = resumeFor(data)
      const photo = r.show_photo !== false && data.worker.picture ? await photoToJpeg(data.worker.picture) : null
      const url = URL.createObjectURL(buildResumePdf(r, { photo }))
      const a = document.createElement('a')
      a.href = url; a.download = resumeFileName(r)
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } finally {
      setPdfBusy(false)
    }
  }

  const w = data?.worker
  const m = data?.match
  const resume = data?.resume
  return (
    <div className="ap-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <aside ref={panel} tabIndex={-1} className="ap-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="ap-head">
          <h2 id={titleId}>{w ? w.full_name : 'Applicant profile'}</h2>
          <button type="button" className="ap-x" onClick={onClose} aria-label="Close"><IconX size={18} /></button>
        </header>

        {error && <p className="ap-error" role="alert">{error}</p>}
        {!data && !error && <div className="ap-body"><BrandLoader compact label="Loading the applicant…" /></div>}

        {data && (
          <div className="ap-body">
            <section className="ap-id">
              <div className="avatar" style={{ width: 64, height: 64, fontSize: 24, overflow: 'hidden', flexShrink: 0 }}>
                {w.picture && <img src={w.picture} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />}
                <span>{(w.full_name || '?')[0].toUpperCase()}</span>
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="ap-badges">
                  {w.is_verified === 1
                    ? <span className="chip green"><IconCheck size={12} /> Verified by hanapbuhay</span>
                    : <span className="chip">Not yet verified</span>}
                  {w.availability && (w.availability.open_to_work
                    ? <span className="chip blue">Open to work</span>
                    : <span className="chip">Not looking right now</span>)}
                </div>
                <p className="ap-meta">{[w.location && `${w.location}, Oriental Mindoro`, w.member_since && `Member since ${since(w.member_since)}`].filter(Boolean).join(' · ')}</p>
                <p className="ap-contact">
                  {w.email && <a href={`mailto:${w.email}`}><IconMail size={14} /> {w.email}</a>}
                  {w.phone && <a href={`tel:${w.phone}`}><IconPhone size={14} /> {w.phone}</a>}
                </p>
              </div>
            </section>

            {m && (
              <section className="ap-card">
                <h3>Match for {data.application.job_title}</h3>
                <div className="ap-match">
                  <b className={m.score >= 75 ? 'strong' : m.score >= 50 ? 'good' : ''}>{m.score}%</b>
                  <div>
                    <p>{m.level_label ? `${m.level_label} · ` : ''}{m.reasons.join(' · ')}</p>
                    <small>{(m.parts || []).map(p => `${p.label} ${p.points}/${p.max}`).join(' · ')}</small>
                  </div>
                </div>
                {data.application.low_match_ack === 1 && <p className="ap-note" style={{ fontSize: 13, color: 'var(--amber)', margin: '8px 0 0' }}>The applicant saw that they miss some requirements and chose to apply anyway.</p>}
                {(m.matched.length > 0 || m.missing.length > 0) && (
                  <div className="ap-chips">
                    {m.matched.map(s => <span key={s} className="chip green">{m.verified.includes(s) ? <IconShield size={12} /> : <IconCheck size={12} />} {s}</span>)}
                    {m.missing.map(s => <span key={s} className="chip red">Missing: {s}</span>)}
                  </div>
                )}
              </section>
            )}

            <section className="ap-card">
              <h3>Application</h3>
              <p className="ap-muted"><IconClock size={13} /> Applied {new Date(data.application.created_at.replace(' ', 'T')).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
              {data.application.cover_note
                ? <blockquote className="ap-quote">{data.application.cover_note}</blockquote>
                : <p className="ap-muted">No message was added.</p>}
            </section>

            {availabilityRows(w.availability).length > 0 && (
              <section className="ap-card">
                <h3>Availability</h3>
                <dl className="ap-avail">
                  {availabilityRows(w.availability).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                </dl>
              </section>
            )}

            {w.bio && <section className="ap-card"><h3>About</h3><p className="ap-text">{w.bio}</p></section>}

            <section className="ap-card">
              <h3>Skills Passport <span className="ap-count">{data.skills.length}</span></h3>
              {data.skills.length === 0 ? <p className="ap-muted">No skills listed yet.</p> : (
                <ul className="ap-skills">
                  {data.skills.map(s => (
                    <li key={s.id}>
                      <span className="ap-skill-name">{s.verified ? <IconShield size={14} className="ap-ok" aria-label="Verified" /> : null}{s.skill_name}</span>
                      <span className="ap-skill-meta">
                        {s.level && <span>{LEVEL[s.level] || s.level}</span>}
                        {s.source === 'tesda' && <span className="ap-tesda">TESDA</span>}
                        {s.verified ? <span className="ap-ok-text">Verified</span> : s.certificate_id ? <span>Certificate uploaded</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="ap-card">
              <h3>Certificates <span className="ap-count">{data.certificates.length}</span></h3>
              {data.certificates.length === 0 ? <p className="ap-muted">No certificates uploaded.</p> : (
                <ul className="ap-certs">
                  {data.certificates.map(c => {
                    const [tone, label] = CERT_STATUS[c.status] || CERT_STATUS.pending
                    return (
                      <li key={c.id}>
                        <div style={{ minWidth: 0 }}>
                          <b>{c.title}</b>
                          <span>{[c.issuer, c.cert_number && `No. ${c.cert_number}`, c.valid_until && `Valid until ${c.valid_until}`].filter(Boolean).join(' · ')}</span>
                        </div>
                        <span className={`chip ${tone}`}>{label}</span>
                        <button type="button" className="btn btn-light btn-sm" onClick={() => openCert(c)} aria-label={`View certificate: ${c.title}`}><IconEye size={14} /> View</button>
                      </li>
                    )
                  })}
                </ul>
              )}
              {fileMsg && <p className="ap-error" role="alert">{fileMsg}</p>}
              <p className="ap-muted" style={{ marginTop: 8 }}>"Verified" means a hanapbuhay admin checked the certificate.</p>
            </section>

            <WorkPhotos variant="ap" items={data.work || []} title="Work photos"
              note="Photos the worker took of their own work. They are not checked by hanapbuhay." />

            <section className="ap-card">
              <div className="ap-row">
                <h3>Resume</h3>
                <button type="button" className="btn btn-navy btn-sm" onClick={downloadResume} disabled={pdfBusy}>
                  {pdfBusy ? <span className="spin" /> : <><IconFile size={14} /> Download resume (PDF)</>}
                </button>
              </div>
              {!resume && <p className="ap-muted">This worker hasn't filled in the Resume Builder yet. The PDF is made from their profile and Skills Passport.</p>}
              {resume?.experience?.filter(e => e.position || e.employer).length > 0 && (
                <>
                  <h4>Work experience</h4>
                  <ul className="ap-list">
                    {resume.experience.filter(e => e.position || e.employer).map((e, i) => (
                      <li key={i}>
                        <b>{e.position || e.employer}</b>
                        <span>{[e.position ? e.employer : '', e.place, [e.start, e.end || (e.start ? 'Present' : '')].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')}</span>
                        {e.details && <p className="ap-text">{e.details}</p>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {resume?.education?.filter(e => e.school).length > 0 && (
                <>
                  <h4>Education</h4>
                  <ul className="ap-list">
                    {resume.education.filter(e => e.school).map((e, i) => (
                      <li key={i}><b>{e.school}</b><span>{[e.level, e.year].filter(Boolean).join(' · ')}</span></li>
                    ))}
                  </ul>
                </>
              )}
              {resume?.languages && <p className="ap-muted" style={{ marginTop: 8 }}><IconPin size={13} /> Languages: {resume.languages}</p>}
            </section>
          </div>
        )}
      </aside>
    </div>
  )
}
