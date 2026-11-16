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

/* The three account types. `name` is what a person is called in the app (top bar,
   sign-up); `ask` is how they choose it ("I'm looking for work"). */
export const TYPES = [
  {
    id: 'worker',
    who: 'rey',
    name: 'Job seeker',
    ask: 'I’m looking for work',
    tag: 'Always free',
    blurb: 'Jobs and gigs near you.',
    points: [
      'Build a digital Skills Passport',
      'Get matched to relevant jobs',
      'See skill gaps clearly',
      'Access free TESDA training',
    ],
  },
  {
    id: 'employer',
    who: 'ana',
    name: 'Employer',
    ask: 'I’m hiring for my business',
    tag: 'Business / MSME',
    blurb: 'Regular and long-term hiring.',
    points: [
      'Post jobs with photos and pay',
      'Applicants ranked by skill match',
      'Search workers and invite them',
      'Verified business badge',
    ],
  },
  {
    id: 'hirer',
    who: 'ben',
    name: 'Client',
    ask: 'I need help with a quick job',
    tag: 'Gigs & short jobs',
    blurb: 'Repairs, events and one-time jobs.',
    points: [
      'Post a request with your budget',
      'Urgent requests for same-day help',
      'Chat with the worker directly',
      'Rate the work when it’s done',
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
  rey: '/images/avatar.webp',        // Filipino skilled worker (Juan)
  ana: '/images/maria.webp',         // Filipino employer/recruiter (Maria)
  ben: '/images/service_crew.webp',  // Filipino client/service crew
  jun: '/images/mechanic.webp',       // Filipino technical specialist
}

export function Avatar({ who = 'rey', className = '', style = {} }) {
  const photo = WHO_PHOTOS[who] || '/images/avatar.webp'
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
