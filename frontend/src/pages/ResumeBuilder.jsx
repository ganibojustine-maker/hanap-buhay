import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconFile, IconCheck, IconAlert, IconPlus, IconTrash, IconSpark, IconUser, IconArrow, IconEye } from '../components/icons.jsx'
import { TOWNS } from '../components/art.jsx'
import { buildResumePdf, photoToJpeg, missingForAutofill, resumeFileName, THEMES, LEVEL_LABEL } from '../utils/resumePdf.js'
import '../styles/resume.css'

// Free Resume Builder for workers.
// Its fields are the same ones the profile and Skills Passport forms use, and the
// PDF carries that data inside it, so uploading it to Smart Auto-Fill
// (My Profile) fills every field and skill exactly.

const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert']
const BLANK = {
  experience: { position: '', employer: '', place: '', start: '', end: '', details: '' },
  education: { school: '', level: '', year: '' },
  certifications: { title: '', issuer: '', number: '', year: '' },
  skills: { name: '', level: '' },
}
const DEFAULTS = {
  theme: 'navy', show_photo: true,
  full_name: '', email: '', phone: '', town: '', address: '', about: '', birthdate: '', languages: '',
  skills: [], certifications: [], experience: [], education: [],
}

const certSkill = s => s.source === 'tesda' || s.source === 'training' || !!s.certificate_id

/** Draft built from the worker's profile, skills and uploaded certificates. */
function fromProfile(user, skills, certs) {
  const certRows = certs.map(c => ({ title: c.title, issuer: c.issuer || '', number: c.cert_number || '', year: (c.issued_on || '').slice(0, 4) }))
  const titles = new Set(certRows.map(c => c.title.toLowerCase()))
  for (const s of skills) {
    if (certSkill(s) && !titles.has(s.skill_name.toLowerCase())) {
      certRows.push({ title: s.skill_name, issuer: s.source === 'tesda' ? 'TESDA' : '', number: /^TESDA/i.test(s.certificate || '') ? '' : (s.certificate || ''), year: '' })
      titles.add(s.skill_name.toLowerCase())
    }
  }
  return {
    ...DEFAULTS,
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    town: TOWNS.includes(user?.location) ? user.location : '',
    about: user?.bio || '',
    skills: skills.filter(s => !certSkill(s)).map(s => ({ name: s.skill_name, level: s.level || '' })),
    certifications: certRows,
    experience: [{ ...BLANK.experience }],
    education: [{ ...BLANK.education }],
  }
}

/** Adds profile data the draft doesn't have yet (never overwrites what the worker typed). */
function mergeProfile(r, fresh) {
  const out = { ...r }
  for (const k of ['full_name', 'email', 'phone', 'town', 'about']) if (!String(out[k] || '').trim() && fresh[k]) out[k] = fresh[k]
  const names = new Set(out.skills.map(s => s.name.trim().toLowerCase()))
  out.skills = [...out.skills.filter(s => s.name.trim()), ...fresh.skills.filter(s => !names.has(s.name.toLowerCase()))]
  const titles = new Set(out.certifications.map(c => c.title.trim().toLowerCase()))
  out.certifications = [...out.certifications.filter(c => c.title.trim()), ...fresh.certifications.filter(c => !titles.has(c.title.toLowerCase()))]
  return out
}

function Field({ label, optional, children }) {
  return (
    <label className="field">
      <span>{label} {optional && <em>Optional</em>}</span>
      <div className="in no-icon">{children}</div>
    </label>
  )
}

/* ─ HTML preview drawn to match the PDF ─────────────────── */
function Preview({ r, photo }) {
  const wrapRef = useRef(null)
  const paperRef = useRef(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState(842)
  const theme = THEMES[r.theme] || THEMES.navy
  const color = `rgb(${theme.rgb.join(',')})`
  const accent = `rgb(${theme.accent.join(',')})`

  useLayoutEffect(() => {
    const measure = () => {
      if (!wrapRef.current || !paperRef.current) return
      const s = Math.min(1, wrapRef.current.clientWidth / 595)
      setScale(s)
      setHeight(paperRef.current.offsetHeight * s)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (wrapRef.current) ro.observe(wrapRef.current)
    if (paperRef.current) ro.observe(paperRef.current)
    return () => ro.disconnect()
  }, [])

  const skills = r.skills.filter(s => s.name.trim())
  const certs = r.certifications.filter(c => c.title.trim())
  const exp = r.experience.filter(e => e.position.trim() || e.employer.trim())
  const edu = r.education.filter(e => e.school.trim())
  const address = [r.address, r.town && `${r.town}, Oriental Mindoro`].filter(Boolean).join(', ')
  const H = ({ children }) => <h4 style={{ color, borderColor: color }}>{children}</h4>

  return (
    <div ref={wrapRef} className="rb-paper-wrap" style={{ height }}>
      <div ref={paperRef} className="rb-paper" style={{ transform: `scale(${scale})`, '--pp-accent': accent }} aria-label="Resume preview">
        <div className="pp-band" style={{ background: color, borderColor: accent }}>
          <div style={{ minWidth: 0 }}>
            <div className="pp-name">{r.full_name || 'Your Name'}</div>
            <div className="pp-contact">{[r.phone && `Phone: ${r.phone}`, r.email && `Email: ${r.email}`].filter(Boolean).join('   |   ')}</div>
            {address && <div className="pp-contact">Address: {address}</div>}
          </div>
          {photo && <img className="pp-photo" src={photo} alt="" />}
        </div>
        <div className="pp-body">
          {r.about.trim() && <><H>About Me</H><div className="pp-details">{r.about.trim()}</div></>}
          {skills.length > 0 && <><H>Skills</H><div className="pp-skills">{skills.map((s, i) => <span key={i}>{s.name}{LEVEL_LABEL[s.level] ? ` (${LEVEL_LABEL[s.level]})` : ''}</span>)}</div></>}
          {certs.length > 0 && <><H>Certifications &amp; Trainings</H>{certs.map((c, i) => (
            <div key={i}>
              <div className="pp-row"><span>{c.title}</span><small>{c.year}</small></div>
              <div className="pp-meta">{[c.issuer, c.number && `Certificate No. ${c.number}`].filter(Boolean).join('  ·  ')}</div>
            </div>
          ))}</>}
          {exp.length > 0 && <><H>Work Experience</H>{exp.map((e, i) => (
            <div key={i}>
              <div className="pp-row"><span>{e.position || e.employer}</span><small>{[e.start, e.end || (e.start ? 'Present' : '')].filter(Boolean).join(' – ')}</small></div>
              <div className="pp-meta" style={{ color }}>{[e.position ? e.employer : '', e.place].filter(Boolean).join(', ')}</div>
              {e.details.trim() && <div className="pp-details">{e.details.trim()}</div>}
            </div>
          ))}</>}
          {edu.length > 0 && <><H>Education</H>{edu.map((e, i) => (
            <div key={i}>
              <div className="pp-row"><span>{e.school}</span><small>{e.year}</small></div>
              <div className="pp-meta">{e.level}</div>
            </div>
          ))}</>}
          {(r.birthdate || r.languages || r.town) && <><H>Personal Information</H>
            {r.birthdate && <div className="pp-kv"><b>Date of Birth:</b><span>{r.birthdate}</span></div>}
            {r.languages && <div className="pp-kv"><b>Languages:</b><span>{r.languages}</span></div>}
            {r.town && <div className="pp-kv"><b>Town:</b><span>{r.town}, Oriental Mindoro</span></div>}
          </>}
        </div>
        <div className="pp-foot">Created with hanapbuhay Resume Builder</div>
      </div>
    </div>
  )
}

/* ─ Page ─────────────────────────────────────────────────── */
export default function ResumeBuilder({ user, call }) {
  const [r, setR] = useState(null)
  const [profileDraft, setProfileDraft] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [saveState, setSaveState] = useState('') // '' | saving | saved | error
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const dirty = useRef(false)

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const [res, sk, ce] = await Promise.all([
        call('/resume').catch(() => ({})),
        call('/skills/my').catch(() => ({ skills: [] })),
        call('/skills/certificates').catch(() => ({ certificates: [] })),
      ])
      const fresh = fromProfile(user, sk.skills || [], ce.certificates || [])
      setProfileDraft(fresh)
      setR(res?.resume ? mergeProfile({ ...DEFAULTS, ...res.resume }, fresh) : fresh)
    } catch (e) {
      setLoadError(e?.message || 'Could not load your resume.')
    }
  }, [call, user])
  useEffect(() => { load() }, [load])

  // Autosave the draft a moment after the last change
  useEffect(() => {
    if (!r || !dirty.current) return
    setSaveState('saving')
    const t = setTimeout(() => {
      call('/resume', { method: 'PUT', body: r })
        .then(() => setSaveState('saved'))
        // 503 = the server can't keep drafts yet (migration 015); the PDF still works
        .catch(e => setSaveState(e?.status === 503 ? 'unavailable' : 'error'))
    }, 1200)
    return () => clearTimeout(t)
  }, [r, call])

  const update = patch => { dirty.current = true; setDone(false); setR(prev => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) })) }
  const set = k => e => update({ [k]: e.target.value })
  const setRow = (section, i, k) => e => update(prev => ({ [section]: prev[section].map((row, j) => j === i ? { ...row, [k]: e.target.value } : row) }))
  const addRow = section => update(prev => ({ [section]: [...prev[section], { ...BLANK[section] }] }))
  const removeRow = (section, i) => update(prev => ({ [section]: prev[section].filter((_, j) => j !== i) }))

  async function download() {
    setBusy(true); setError('')
    try {
      const photo = r.show_photo && user?.picture ? await photoToJpeg(user.picture) : null
      const blob = buildResumePdf(r, { photo })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = resumeFileName(r)
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      setDone(true)
      if (r.show_photo && user?.picture && !photo) setError('Your profile photo could not be added to the PDF. Re-upload it in My Profile and try again.')
    } catch (e) {
      setError(e?.message || 'Could not create the PDF.')
    } finally {
      setBusy(false)
    }
  }

  if (loadError) {
    return <div className="page-inner"><div className="panel"><p style={{ color: 'var(--red)', marginBottom: 12 }}>{loadError}</p><button className="btn btn-navy btn-sm" onClick={load}>Try again</button></div></div>
  }
  if (!r) {
    return <div className="page-inner"><div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="spin" /> Loading your resume…</div></div>
  }

  const missing = missingForAutofill(r)
  const photo = r.show_photo ? user?.picture : null

  return (
    <div className="page-inner">
      {/* Skills Passport → Resume. The section header above has the title and tabs. */}
      <div className="section-title rb-head" style={{ marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 20, letterSpacing: '-.02em', margin: 0 }}>Resume Builder</h2>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: '4px 0 0', maxWidth: 620 }}>
            Filled in from your profile and Skills Passport. Edit anything, then download a one-page PDF to print or send.
          </p>
          <p className="sp-seen" style={{ marginTop: 6 }}><IconEye size={14} /> Employers you apply to can open and download this resume.</p>
        </div>
        <div className="rb-toolbar">
          <span className="rb-save-state" aria-live="polite">
            {saveState === 'saving' && <><span className="spin" style={{ width: 12, height: 12, borderWidth: 2 }} /> Saving draft…</>}
            {saveState === 'saved' && <><IconCheck size={13} /> Draft saved</>}
            {saveState === 'error' && <span style={{ color: 'var(--red)' }}>Draft not saved, check your connection</span>}
            {saveState === 'unavailable' && <span style={{ color: 'var(--amber)' }}>Drafts can't be saved yet. You can still download the PDF.</span>}
          </span>
          <button type="button" className="btn btn-light btn-sm" onClick={() => profileDraft && update(prev => mergeProfile(prev, profileDraft))} title="Add details from your profile and Skills Passport that are not in the resume yet">
            <IconUser size={15} /> Fill from profile
          </button>
          <button type="button" className="btn btn-primary" onClick={download} disabled={busy}>
            {busy ? <span className="spin" /> : <><IconFile size={16} /> Download PDF</>}
          </button>
        </div>
      </div>

      <div className={`rb-check ${missing.length ? 'warn' : 'ok'}`}>
        {missing.length ? <IconAlert size={18} /> : <IconCheck size={18} />}
        <div>
          {missing.length
            ? <><b>Add these so Smart Auto-Fill can complete your profile:</b><ul>{missing.map(m => <li key={m}>{m}</li>)}</ul></>
            : <><b>Ready for Smart Auto-Fill.</b> Your resume has everything the profile and Skills Passport need.</>}
        </div>
      </div>

      {done && (
        <div className="rb-check ok" role="status">
          <IconSpark size={18} />
          <div>
            <b>Your resume was downloaded.</b> Next: upload it in My Profile to fill your profile automatically.{' '}
            <Link to="/dashboard/profile" style={{ fontWeight: 700, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Go to My Profile <IconArrow size={13} /></Link>
          </div>
        </div>
      )}
      {error && <div className="rb-check warn" role="alert"><IconAlert size={18} /><div>{error}</div></div>}

      <div className="rb-grid">
        <div>
          {/* Personal */}
          <section className="panel rb-section">
            <header><div><h2>Personal Information</h2><p>Same details as your profile.</p></div></header>
            <Field label="Full Name *"><input value={r.full_name} onChange={set('full_name')} maxLength={150} placeholder="e.g. Juan Dela Cruz" autoComplete="name" /></Field>
            <div className="rb-2">
              <Field label="Mobile Number *"><input value={r.phone} onChange={set('phone')} maxLength={32} placeholder="09XXXXXXXXX" inputMode="tel" autoComplete="tel" /></Field>
              <Field label="Email" optional><input type="email" value={r.email} onChange={set('email')} maxLength={255} placeholder="you@example.com" autoComplete="email" /></Field>
              <Field label="Town *">
                <select value={r.town} onChange={set('town')}>
                  <option value="">Choose your town</option>
                  {TOWNS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Barangay / Street" optional><input value={r.address} onChange={set('address')} maxLength={255} placeholder="e.g. Brgy. Lalud" /></Field>
              <Field label="Date of Birth" optional><input type="date" value={r.birthdate} onChange={set('birthdate')} /></Field>
              <Field label="Languages" optional><input value={r.languages} onChange={set('languages')} maxLength={200} placeholder="e.g. Tagalog, English" /></Field>
            </div>
            <Field label="About Me / Objective *">
              <textarea value={r.about} onChange={set('about')} maxLength={2000} style={{ minHeight: 110 }}
                placeholder="Short summary: what work you do, years of experience, and the job you are looking for." />
            </Field>
          </section>

          {/* Skills */}
          <section className="panel rb-section">
            <header><div><h2>Skills *</h2><p>Each skill is added to your Skills Passport with its level.</p></div></header>
            {r.skills.map((s, i) => (
              <div key={i} className="rb-skill">
                <div className="in no-icon"><input value={s.name} onChange={setRow('skills', i, 'name')} maxLength={120} placeholder="e.g. Electrical Wiring" aria-label={`Skill ${i + 1}`} /></div>
                <div className="in no-icon">
                  <select value={s.level} onChange={setRow('skills', i, 'level')} aria-label={`Level of skill ${i + 1}`}>
                    <option value="">Level</option>
                    {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
                  </select>
                </div>
                <button type="button" className="rb-remove" onClick={() => removeRow('skills', i)} aria-label={`Remove skill ${i + 1}`}><IconTrash size={15} /></button>
              </div>
            ))}
            <button type="button" className="rb-add" onClick={() => addRow('skills')}><IconPlus size={14} /> Add skill</button>
          </section>

          {/* Certifications */}
          <section className="panel rb-section">
            <header>
              <div><h2>Certifications &amp; Trainings</h2><p>TESDA NC, COC, seminars. Upload the certificates in <Link to="/dashboard/passport" style={{ textDecoration: 'underline' }}>Skills Passport</Link> to have them listed here.</p></div>
            </header>
            {r.certifications.map((c, i) => (
              <div key={i} className="rb-item">
                <button type="button" className="rb-remove" onClick={() => removeRow('certifications', i)} aria-label="Remove certification"><IconTrash size={15} /></button>
                <Field label="Title / Qualification"><input value={c.title} onChange={setRow('certifications', i, 'title')} maxLength={200} placeholder="e.g. Shielded Metal Arc Welding (SMAW) NC II" /></Field>
                <div className="rb-3">
                  <Field label="Issued by"><input value={c.issuer} onChange={setRow('certifications', i, 'issuer')} maxLength={150} placeholder="TESDA" /></Field>
                  <Field label="Certificate No."><input value={c.number} onChange={setRow('certifications', i, 'number')} maxLength={80} /></Field>
                  <Field label="Year"><input value={c.year} onChange={setRow('certifications', i, 'year')} maxLength={10} inputMode="numeric" placeholder="2024" /></Field>
                </div>
              </div>
            ))}
            <button type="button" className="rb-add" onClick={() => addRow('certifications')}><IconPlus size={14} /> Add certification</button>
          </section>

          {/* Experience */}
          <section className="panel rb-section">
            <header><div><h2>Work Experience</h2><p>Most recent first. Include part-time, contractual and "raket" work.</p></div></header>
            {r.experience.map((e, i) => (
              <div key={i} className="rb-item">
                <button type="button" className="rb-remove" onClick={() => removeRow('experience', i)} aria-label="Remove work experience"><IconTrash size={15} /></button>
                <div className="rb-2">
                  <Field label="Position"><input value={e.position} onChange={setRow('experience', i, 'position')} maxLength={150} placeholder="e.g. Welder" /></Field>
                  <Field label="Employer / Client"><input value={e.employer} onChange={setRow('experience', i, 'employer')} maxLength={150} placeholder="e.g. Mindoro Metal Works" /></Field>
                </div>
                <div className="rb-3">
                  <Field label="Place"><input value={e.place} onChange={setRow('experience', i, 'place')} maxLength={150} placeholder="e.g. Calapan City" /></Field>
                  <Field label="Start"><input value={e.start} onChange={setRow('experience', i, 'start')} maxLength={20} placeholder="e.g. Jan 2021" /></Field>
                  <Field label="End"><input value={e.end} onChange={setRow('experience', i, 'end')} maxLength={20} placeholder="Blank = Present" /></Field>
                </div>
                <Field label="What you did" optional>
                  <textarea value={e.details} onChange={setRow('experience', i, 'details')} maxLength={1500} style={{ minHeight: 80 }} placeholder="One task per line" />
                </Field>
              </div>
            ))}
            <button type="button" className="rb-add" onClick={() => addRow('experience')}><IconPlus size={14} /> Add work experience</button>
          </section>

          {/* Education */}
          <section className="panel rb-section">
            <header><div><h2>Education</h2></div></header>
            {r.education.map((e, i) => (
              <div key={i} className="rb-item">
                <button type="button" className="rb-remove" onClick={() => removeRow('education', i)} aria-label="Remove education"><IconTrash size={15} /></button>
                <Field label="School"><input value={e.school} onChange={setRow('education', i, 'school')} maxLength={200} placeholder="e.g. Calapan City National High School" /></Field>
                <div className="rb-2">
                  <Field label="Level / Course"><input value={e.level} onChange={setRow('education', i, 'level')} maxLength={150} placeholder="e.g. High School Graduate" /></Field>
                  <Field label="Year"><input value={e.year} onChange={setRow('education', i, 'year')} maxLength={20} placeholder="e.g. 2015" /></Field>
                </div>
              </div>
            ))}
            <button type="button" className="rb-add" onClick={() => addRow('education')}><IconPlus size={14} /> Add school</button>
          </section>
        </div>

        <aside className="rb-preview-col">
          <div className="panel" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Color</span>
                <div className="rb-swatches">
                  {Object.entries(THEMES).map(([k, t]) => (
                    <button key={k} type="button" className="rb-swatch" aria-pressed={r.theme === k} aria-label={t.label}
                      style={{ background: `rgb(${t.rgb.join(',')})` }} onClick={() => update({ theme: k })} />
                  ))}
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: user?.picture ? 'pointer' : 'not-allowed', opacity: user?.picture ? 1 : .55 }}>
                <input type="checkbox" checked={!!r.show_photo && !!user?.picture} disabled={!user?.picture} onChange={e => update({ show_photo: e.target.checked })} />
                Include photo
              </label>
            </div>
          </div>
          <Preview r={r} photo={photo} />
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, textAlign: 'center' }}>
            Preview. Long resumes continue on a second page in the PDF.
          </p>
        </aside>
      </div>
    </div>
  )
}
