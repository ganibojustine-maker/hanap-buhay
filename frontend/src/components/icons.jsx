import { Link } from 'react-router-dom'

/* ---------- brand mark ---------- */
export function Mark({ size = 36, light = false, className = '' }) {
  return (
    <img
      src={light ? '/images/logo-mark-light.svg' : '/images/logo-mark.svg'}
      alt="HanapBuhay"
      className={className}
      style={{
        height: size,
        width: 'auto',
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0
      }}
    />
  )
}

export function Logo({ light = false, to = '/', height = 44, className = '' }) {
  return (
    <Link
      to={to}
      className={`logo ${light ? 'logo-light' : ''} ${className}`}
      aria-label="HanapBuhay - Find. Apply. Get Hired."
      style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
    >
      <img
        src={light ? '/images/logo-light.svg' : '/images/logo.svg'}
        alt="HanapBuhay - Find. Apply. Get Hired."
        style={{
          height: height,
          width: 'auto',
          maxWidth: '100%',
          objectFit: 'contain',
          display: 'block',
          flexShrink: 0
        }}
      />
    </Link>
  )
}

/* ---------- icon set ---------- */
export const Icon = ({ children, size = 18, sw = 1.8, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
)
export const IconMail     = (p) => <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></Icon>
export const IconLock     = (p) => <Icon {...p}><rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></Icon>
export const IconUser     = (p) => <Icon {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></Icon>
export const IconPin      = (p) => <Icon {...p}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></Icon>
export const IconBolt     = (p) => <Icon {...p}><path d="M13 3 5 13h6l-1 8 8-10h-6z"/></Icon>
export const IconHammer   = (p) => <Icon {...p}><path d="m14 6 4 4M4 20l9-9M12 4l8 8-3 3-8-8z"/></Icon>
export const IconWrench   = (p) => <Icon {...p}><path d="M14.5 6.5a4 4 0 0 0 5.2 5.2L11 20.4a2.1 2.1 0 0 1-3-3L16.3 9"/><path d="M14.5 6.5a4 4 0 0 1 5.2-2.7l-2.7 2.7.5 2 2 .5 2.7-2.7"/></Icon>
export const IconArrow    = (p) => <Icon className="arr" {...p}><path d="M5 12h14M13 6l6 6-6 6"/></Icon>
export const IconBack     = (p) => <Icon {...p}><path d="M19 12H5M11 6l-6 6 6 6"/></Icon>
export const IconCheck    = ({ size = 16, ...p }) => <Icon size={size} sw={2.2} {...p}><path d="m5 12.5 4.5 4.5L19 7.5"/></Icon>
export const IconX        = (p) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18"/></Icon>
export const IconMenu     = (p) => <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16"/></Icon>
export const IconAlert    = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></Icon>
export const IconBriefcase= (p) => <Icon {...p}><rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/></Icon>
export const IconHome     = (p) => <Icon {...p}><path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></Icon>
export const IconShield   = (p) => <Icon {...p}><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/><path d="m9 12 2 2 4-4"/></Icon>
export const IconBook     = (p) => <Icon {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6"/></Icon>
export const IconLogout   = (p) => <Icon {...p}><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M16 8l4 4-4 4M20 12H9"/></Icon>
export const IconChevron  = (p) => <Icon {...p}><path d="m6 9 6 6 6-6"/></Icon>
export const IconUsers    = (p) => <Icon {...p}><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .6 3.5 2.3 3.5 5.2"/></Icon>
export const IconFile     = (p) => <Icon {...p}><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/></Icon>
export const IconSpark    = (p) => <Icon {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></Icon>
export const IconSearch   = (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></Icon>
export const IconFilter   = (p) => <Icon {...p}><path d="M22 3H2l8 9.46V19l4 2v-8.54z"/></Icon>
export const IconMap      = (p) => <Icon {...p}><path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z"/><path d="M9 3v15M15 6v15"/></Icon>
export const IconStar     = (p) => <Icon {...p}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></Icon>
export const IconBell     = (p) => <Icon {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></Icon>
export const IconMsgCircle= (p) => <Icon {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></Icon>
export const IconSend     = (p) => <Icon {...p}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></Icon>
export const IconBuilding = (p) => <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h6M3 15h6M15 9h3M15 15h3M15 3v4M15 17v4"/></Icon>
export const IconCalendar = (p) => <Icon {...p}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></Icon>
export const IconTrend    = (p) => <Icon {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></Icon>
export const IconSettings = (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></Icon>
export const IconPlus     = (p) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>
export const IconTrash    = (p) => <Icon {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></Icon>
export const IconEdit     = (p) => <Icon {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></Icon>
export const IconGlobe    = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10A15 15 0 0 1 8 12a15 15 0 0 1 4-10z"/></Icon>
export const IconPhone    = (p) => <Icon {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.47 18a19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.92-8.38A2 2 0 0 1 3.55 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 17z"/></Icon>
export const IconClock    = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></Icon>

export const Eye = ({ off, size = 19, ...p }) => <Icon size={size} {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>{off && <path d="M3 3l18 18"/>}</Icon>
export const IconEye = Eye

export const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.1 5.5c4.2-3.9 6.6-9.6 6.6-16.9z"/>
    <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/>
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.4-4.9 2.3-8.8 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
  </svg>
)
export function GoogleBtn({ onClick, busy, children }) {
  return (
    <button type="button" className="btn btn-google btn-block" onClick={onClick} disabled={busy}>
      {busy ? <span className="spin spin-dark" /> : <GoogleG />}
      <span>{children}</span>
    </button>
  )
}
