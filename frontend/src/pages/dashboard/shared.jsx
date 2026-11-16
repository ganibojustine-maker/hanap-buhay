// Dashboard helpers shared by the role pages (split out of Dashboard.jsx so each role downloads only its own code).
import { IconCheck, IconX, IconClock, IconCalendar, IconStar, IconDownload } from '../../components/icons.jsx'
import { tr } from '../../lang/dash.js'

/* ─ Time greeting ───────────────────────────────────────── */
export const GREET = ['Good morning', 'Good noon', 'Good afternoon', 'Good evening']

export const greet = () => { const h = new Date().getHours(); return tr(GREET[h < 11 ? 0 : h < 14 ? 1 : h < 18 ? 2 : 3]) }

/* ─ Interview → calendar ────────────────────────────────── */
// interview_date is Philippine time as the employer typed it ("2026-11-20 09:00:00"),
// so it is converted to UTC here: the event lands at the right time on any phone.
function phToUtc(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 8, +m[5])) : null
}
const calStamp = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const icsText = v => String(v).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1')

/** Google Calendar link and .ics file (with reminders 1 day and 2 hours before) for an interview. */
export function interviewCalendar({ date, title, company, location, notes }) {
  const start = phToUtc(date)
  if (!start) return null
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const text = `Interview: ${title || 'Job'}${company ? ` (${company})` : ''}`
  const place = location ? (/oriental mindoro/i.test(location) ? location : `${location}, Oriental Mindoro`) : ''
  const details = [notes ? `Notes from the employer: ${notes}` : '', 'Scheduled on hanapbuhay. Bring a valid ID and copies of your certificates.'].filter(Boolean).join('\n\n')
  const google = 'https://calendar.google.com/calendar/render?' + new URLSearchParams({
    action: 'TEMPLATE', text, dates: `${calStamp(start)}/${calStamp(end)}`, details, location: place,
  })
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//hanapbuhay//Interview//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${calStamp(start)}-${Math.random().toString(36).slice(2, 10)}@hanapbuhay`,
    `DTSTAMP:${calStamp(new Date())}`, `DTSTART:${calStamp(start)}`, `DTEND:${calStamp(end)}`,
    `SUMMARY:${icsText(text)}`, `DESCRIPTION:${icsText(details)}`, place ? `LOCATION:${icsText(place)}` : '',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Interview tomorrow', 'TRIGGER:-P1D', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Interview in 2 hours', 'TRIGGER:-PT2H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
  return { google, ics, start }
}

function CalendarButtons({ date, calendar, notes }) {
  const cal = interviewCalendar({ date, notes, ...calendar })
  if (!cal || cal.start.getTime() < Date.now()) return null // past interviews: nothing to add
  const download = () => {
    const url = URL.createObjectURL(new Blob([cal.ics], { type: 'text/calendar;charset=utf-8' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: 'hanapbuhay-interview.ics' })
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <div className="cal-btns">
      <a className="btn btn-sm cal-google" href={cal.google} target="_blank" rel="noopener noreferrer">
        <IconCalendar size={14} /> {tr("Add to Google Calendar")}
      </a>
      <button type="button" className="btn btn-sm btn-light" onClick={download} title={tr('For iPhone, Outlook, and other calendar apps')}>
        <IconDownload size={14} /> {tr("Other calendar (.ics)")}
      </button>
      <span className="cal-note">{tr("We also send a reminder the day before.")}</span>
    </div>
  )
}

export const fmt = (n, max) => { if (!n && !max) return 'Negotiable'; const f = v => '₱'+Number(v).toLocaleString(); return n && max ? `${f(n)}–${f(max)}/mo` : n ? `From ${f(n)}/mo` : `Up to ${f(max)}/mo` }

export const days = dt => { const d = Math.floor((Date.now() - new Date(String(dt).replace(' ', 'T'))) / 86400000); return d===0?tr('Today'):d===1?tr('1 day ago'):tr('{d}d ago', { d }) }



/* ─ Application Stepper Tracker ─────────────────────────── */
// calendar ({ title, company, location }): shows "Add to calendar" for an upcoming interview (worker view)
export function ApplicationTracker({ status, interviewDate, interviewNotes, calendar, viewer = 'worker' }) {
  const forEmployer = viewer === 'employer'
  const isRejected = status === 'rejected'

  // Submitted → Under Review → Shortlisted → Interview → Interviewed → Offer → Hired (utils/hiringStatus.js)
  const order = ['pending', 'reviewed', 'shortlisted', 'for_interview', 'interviewed', 'offer', 'hired']
  const reached = Math.max(0, order.indexOf(status))
  const currentStep = isRejected ? 0 : reached + 1
  const steps = [
    { num: 1, label: 'Submitted' }, { num: 2, label: 'Under Review' }, { num: 3, label: 'Shortlisted' },
    { num: 4, label: 'Interview' }, { num: 5, label: 'Interviewed' }, { num: 6, label: 'Job Offer' },
    { num: 7, label: isRejected ? 'Decision' : 'Hired' },
  ]

  return (
    <div style={{ marginTop: 14 }}>
      <div className="app-tracker">
        {steps.map((st, i) => {
          const isDone = !isRejected && currentStep > st.num
          const isActive = !isRejected && currentStep === st.num
          const isStepRejected = isRejected && st.num === 7

          return (
            <div key={st.num} style={{ display: 'contents' }}>
              <div className="tracker-step">
                <div className={`tracker-circle ${isDone ? 'done' : ''} ${isActive ? 'active' : ''} ${isStepRejected ? 'rejected' : ''}`}>
                  {isDone ? <IconCheck size={14} /> : isStepRejected ? <IconX size={14} /> : st.num}
                </div>
                <span className={`tracker-label ${isActive ? 'active' : ''}`}>
                  {isStepRejected ? tr("Not Selected") : tr(st.label)}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`tracker-line ${!isRejected && currentStep > st.num ? 'done' : ''}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Stage-specific callout / guidance */}
      {status === 'for_interview' && (
        <div style={{ marginTop: 12, background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 10, padding: '12px 16px', color: '#4c1d95' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
            <IconCalendar size={18} style={{ color: '#7c3aed' }} />
            {forEmployer ? tr('Interview scheduled') : tr("For Interview — Congratulations!")}
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#5b21b6' }}>
            {forEmployer ? tr('The applicant was told the date and your notes, and gets a reminder the day before.') : tr("The employer has selected your application for an interview. Please prepare and review the schedule/instructions below.")}
          </p>
          {interviewDate && (
            <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ffffff', border: '1px solid #ddd6fe', padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#6d28d9' }}>
              <IconClock size={14} />
              {tr("Schedule:")} {new Date(String(interviewDate).replace(' ', 'T')).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          )}
          {interviewNotes && (
            <div style={{ marginTop: 8, fontSize: 13, color: '#334155', background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <strong>{tr("Interview Notes / Instructions:")}</strong> {interviewNotes}
            </div>
          )}
          {interviewDate && calendar && <CalendarButtons date={interviewDate} calendar={calendar} notes={interviewNotes} />}
        </div>
      )}

      {status === 'interviewed' && (
        <div style={{ marginTop: 12, background: 'var(--blue-l)', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--blue-d)' }}>
          {forEmployer ? tr('Interview done. Send a job offer, hire, or mark as not selected.') : tr('Your interview is done. The employer is making a decision. We will tell you as soon as they do.')}
        </div>
      )}

      {status === 'offer' && forEmployer && (
        <div style={{ marginTop: 12, background: 'var(--gold-l)', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#92400e' }}>
          {tr('Offer sent. Waiting for the applicant to accept or decline. You can also mark them as hired once they agree in person.')}
        </div>
      )}

      {status === 'shortlisted' && (
        <div style={{ marginTop: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#1e40af' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconStar size={16} style={{ color: '#3b82f6', flexShrink: 0 }} />
            <span>{forEmployer ? tr('Shortlisted. Schedule an interview when you are ready.') : tr("You have been shortlisted! The employer is reviewing candidate profiles for interview scheduling.")}</span>
          </div>
          {interviewNotes && (
            <div style={{ marginTop: 8, fontSize: 13, color: '#1e40af', background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #bfdbfe' }}>
              <strong>{tr("Screening Note:")}</strong> {interviewNotes}
            </div>
          )}
        </div>
      )}

      {status === 'hired' && (
        <div style={{ marginTop: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: '12px 16px', color: '#065f46' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
            <IconCheck size={18} style={{ color: '#059669' }} />
            {tr("Congratulations! You are Hired!")}
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#047857' }}>
            {tr("The employer has officially accepted your application. Check your email or messages for your employment onboarding instructions.")}
          </p>
          {interviewNotes && (
            <div style={{ marginTop: 8, fontSize: 13, color: '#065f46', background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #a7f3d0' }}>
              <strong>{tr("Onboarding Note:")}</strong> {interviewNotes}
            </div>
          )}
        </div>
      )}

      {status === 'rejected' && (
        <div style={{ marginTop: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#991b1b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconX size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
            <span>{tr("This application was not selected. Keep going and explore other openings across Oriental Mindoro!")}</span>
          </div>
          {interviewNotes && (
            <div style={{ marginTop: 8, fontSize: 13, color: '#991b1b', background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #fecaca' }}>
              <strong>{tr("Employer Feedback:")}</strong> {interviewNotes}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
