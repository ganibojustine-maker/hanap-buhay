/**
 * art.jsx — Shared constants, avatars, seascape and type data
 * Used by Landing, auth showcase, and dashboard
 */

export const TOWNS = [
  'Baco', 'Bansud', 'Bongabong', 'Bulalacao',
  'Calapan City', 'Gloria', 'Mansalay', 'Naujan',
  'Pinamalayan', 'Pola', 'Puerto Galera', 'Roxas',
  'San Teodoro', 'Socorro', 'Victoria',
]

export const TYPES = [
  {
    id: 'worker',
    who: 'rey',
    name: 'Job Seekers & Workers',
    tag: 'Find work, earn more',
    blurb: 'Skilled workers, daily-wage earners, out-of-school youth, fresh graduates, freelancers — build your digital Skills Passport and get matched to jobs near you.',
    points: [
      'Build a digital Skills Passport',
      'Get matched to relevant jobs',
      'See skill gaps clearly',
      'Access free TESDA training',
      'Connect with local employers',
    ],
  },
  {
    id: 'employer',
    who: 'ana',
    name: 'Employers & MSMEs',
    tag: 'Hire local talent',
    blurb: 'SMEs, contractors, and local businesses in Oriental Mindoro can post jobs and discover pre-screened local talent matched to their exact needs.',
    points: [
      'Post jobs in minutes',
      'AI-matched applicants',
      'Review Skills Passports',
      'Message candidates directly',
      'Manage hiring in one place',
    ],
  },
  {
    id: 'hirer',
    who: 'ben',
    name: 'Clients & Service Buyers',
    tag: 'Get things done',
    blurb: 'Need a carpenter, electrician, caregiver, or digital freelancer? Find trusted local service providers verified by real work history and community ratings.',
    points: [
      'Browse skilled service providers',
      'Verified skills & credentials',
      'Rated by the community',
      'Direct messaging & booking',
      'Local talent you can trust',
    ],
  },
]

export const CAST_ORDER = ['rey', 'ana', 'ben']

const CAST_COLOR = { rey: '#1E3160', ana: '#3B3066', ben: '#1E4D3B', ling: '#5C3A1E', gab: '#2E3A4F' }

export const CAST = {
  rey: { accent: '#F5A623', role: 'Construction Worker' },
  ana: { accent: '#4EA8DE', role: 'Office Professional' },
  ben: { accent: '#56C87A', role: 'Farm & Agricultural Worker' },
}

/* ── Filipino avatar real photos ───────────────────────── */
const WHO_PHOTOS = {
  rey: '/images/avatar.jpg',        // Filipino skilled worker (Juan)
  ana: '/images/maria.jpg',         // Filipino employer/recruiter (Maria)
  ben: '/images/service_crew.jpg',  // Filipino client/service crew
  jun: '/images/mechanic.jpg',       // Filipino technical specialist
}

export function Avatar({ who = 'rey', className = '', style = {} }) {
  const photo = WHO_PHOTOS[who] || '/images/avatar.jpg'
  return (
    <div className={`face ${className}`} style={{ borderRadius: 'inherit', overflow: 'hidden', width: '100%', height: '100%', position: 'relative', background: 'var(--navy-soft)', ...style }}>
      <img
        src={photo}
        alt={who}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />
    </div>
  )
}

/* ── Seascape SVG decoration (auth page) ───────────────── */
export function Seascape() {
  return (
    <svg className="seascape" viewBox="0 0 600 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1E6EA6" />
          <stop offset="100%" stopColor="#0D4A7B" />
        </linearGradient>
      </defs>
      <circle cx="480" cy="35" r="24" fill="#F5A623" opacity=".9" className="sun" />
      <circle cx="480" cy="35" r="30" fill="#F5A623" opacity=".2" />
      <polygon points="0,140 60,70 120,140" fill="#162347" opacity=".7" />
      <polygon points="70,140 140,50 210,140" fill="#1E3160" opacity=".8" />
      <polygon points="380,140 440,65 500,140" fill="#162347" opacity=".6" />
      <polygon points="450,140 530,80 600,140" fill="#1E3160" opacity=".75" />
      <rect x="0" y="120" width="600" height="50" fill="url(#sea)" />
      <path className="wave" d="M-80 125 Q-40 118 0 125 Q40 132 80 125 Q120 118 160 125 Q200 132 240 125 Q280 118 320 125 Q360 132 400 125 Q440 118 480 125 Q520 132 560 125 Q600 118 640 125 L640 140 L-80 140Z"
        fill="#2A85C3" opacity=".7" />
      <path className="w2" d="M-80 132 Q-40 126 0 132 Q40 138 80 132 Q120 126 160 132 Q200 138 240 132 Q280 126 320 132 Q360 138 400 132 Q440 126 480 132 Q520 138 560 132 Q600 126 640 132 L640 145 L-80 145Z"
        fill="#1A5E8A" opacity=".5" />
      <g className="banca" transform="translate(280,108)">
        <line x1="-35" y1="2" x2="35" y2="2" stroke="#8B6914" strokeWidth="1.5" />
        <line x1="-38" y1="4" x2="-38" y2="8" stroke="#8B6914" strokeWidth="1.5" />
        <line x1="38" y1="4" x2="38" y2="8" stroke="#8B6914" strokeWidth="1.5" />
        <ellipse cx="-40" cy="9" rx="10" ry="3.5" fill="#6B4F12" />
        <ellipse cx="40" cy="9" rx="10" ry="3.5" fill="#6B4F12" />
        <path d="M-28 0 Q0 6 28 0 Q28 12 0 14 Q-28 12 -28 0Z" fill="#8B4513" />
        <line x1="0" y1="-30" x2="0" y2="0" stroke="#5C3A1E" strokeWidth="2" />
        <path d="M0 -28 Q18 -14 0 0 Z" fill="rgba(255,255,255,.85)" />
      </g>
      <line x1="555" y1="138" x2="555" y2="100" stroke="#5C3A1E" strokeWidth="3" />
      <g transform="translate(555,100)">
        <ellipse cx="0" cy="-5" rx="18" ry="8" fill="#2D6A1E" transform="rotate(-15)" />
        <ellipse cx="0" cy="-5" rx="18" ry="8" fill="#2D6A1E" transform="rotate(25)" />
        <ellipse cx="0" cy="-5" rx="18" ry="8" fill="#2D6A1E" transform="rotate(-45)" />
        <ellipse cx="0" cy="-5" rx="18" ry="8" fill="#3A8728" transform="rotate(5)" />
      </g>
    </svg>
  )
}
