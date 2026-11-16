import { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react'
import { IconGlobe, IconCheck, IconChevron } from './components/icons.jsx'

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', flag: '🇺🇸', short: 'EN' },
  { code: 'tl', label: 'Filipino (Tagalog)', native: 'Wikang Filipino / Tagalog', flag: '🇵🇭', short: 'FIL' }
]

export const TRANSLATIONS = {
  en: {
    "lp.why.v1": "Certificate uploaded",
    "lp.why.v2": "Checked by the hanapbuhay team",
    "lp.why.v3": "Verified badge on the profile",
    "gj.promo.d": "Build a free Skills Passport and know what each job needs before you apply.",
    "gj.promo.t": "See your match for every job",
    "gj.retry": "Try again",
    "gj.err": "We couldn’t load jobs just now.",
    "gj.all": "See all jobs",
    "gj.none2": "Try another town or a shorter keyword.",
    "gj.none": "No jobs match that search yet.",
    "gj.more": "Show more jobs",
    "gj.clear": "Clear search",
    "gj.newest": "newest first",
    "gj.of": "of",
    "gj.showing": "Showing",
    "gj.searching": "Searching…",
    "gj.loading": "Loading open jobs…",
    "gj.open": "open jobs",
    "gj.title": "Open jobs in Oriental Mindoro",
    "lp.emp.verified": "Verified business",
    "lp.emp.hired": "Hired!",
    "lp.emp.newapp": "New applicant",
    "lp.emp.col3": "Hired",
    "lp.emp.col2": "Shortlist",
    "lp.emp.col1": "New",
    "lp.emp.board": "Live hiring board",
    "lp.why.hired": "Hired",
    "lp.why.verify.d": "Certificates and business permits are reviewed by our team.",
    "lp.why.verify.t": "Checked, not claimed",
    "lp.map.hint": "Point at a town",
    "lp.map.view": "View jobs here",
    "lp.emp.kicker": "For employers & MSMEs",
    "lp.emp.title": "Hire people who can do the job.",
    "lp.emp.p1": "Post openings with photos, pay and schedule",
    "lp.emp.p2": "Applicants ranked by skill match",
    "lp.emp.p3": "Search workers and invite them to apply",
    "lp.emp.p4": "Earn the Verified business badge",
    "lp.emp.cta": "Start hiring free",
    "lp.emp.gig": "Need help for a quick job?",
    "nav.sign_in": "Sign in",
    "nav.sign_up": "Get started",
    "nav.create_account": "Create free account",
    "nav.dashboard": "Dashboard",
    "pub.Home": "Home",
    "pub.Find Jobs": "Find Jobs",
    "pub.Job Map": "Job Map",
    "pub.Training": "Training",
    "lh.features": "Features",
    "lh.how": "How it works",
    "lh.roles": "For employers",
    "lh.dashboard": "Open dashboard",
    "lh.menu": "Menu",
    "lp.hero.eyebrow": "Live in all 15 towns of Oriental Mindoro",
    "lp.hero.title_a": "Find work that fits",
    "lp.hero.title_b": "what you can do.",
    "lp.hero.lede": "Jobs, gigs and hiring across the province, matched by real skills, not résumés.",
    "lp.hero.cta": "Get started free",
    "lp.hero.browse": "Browse jobs",
    "lp.hero.t1": "Free for job seekers",
    "lp.hero.t2": "Verified employers",
    "lp.hero.t3": "TESDA-aligned",
    "lp.map.label": "Map of Oriental Mindoro with open jobs in each town",
    "lp.map.legend": "{n} open jobs · 15 towns",
    "lp.map.jobs": "{n} open jobs",
    "lp.map.job": "1 open job",
    "lp.map.none": "No openings yet",
    "lp.map.new": "Just posted",
    "lp.map.pay": "Pay to discuss",
    "lp.now.title": "Hiring now",
    "lp.now.all": "See all jobs",
    "lp.roles.title": "Built for everyone who works",
    "lp.roles.worker.title": "Job seekers",
    "lp.roles.worker.desc": "Find jobs and gigs near you.",
    "lp.roles.worker.cta": "Find work",
    "lp.roles.employer.title": "Employers & MSMEs",
    "lp.roles.employer.desc": "Hire for regular, long-term roles.",
    "lp.roles.employer.cta": "Start hiring",
    "lp.roles.hirer.title": "Clients",
    "lp.roles.hirer.desc": "Get help for quick jobs and gigs.",
    "lp.roles.hirer.cta": "Post a request",
    "lp.why.title": "Skills first. Not résumés.",
    "lp.why.passport.t": "Skills Passport",
    "lp.why.passport.d": "Your skills, certificates and work, in one profile employers trust.",
    "lp.why.match.t": "Honest matching",
    "lp.why.match.d": "Every job shows how well you fit, and exactly what’s missing.",
    "lp.why.train.t": "Training near you",
    "lp.why.train.d": "TESDA courses near you that close the gap.",
    "lp.why.missing": "Missing: NC II",
    "lp.why.verified": "Verified",
    "lp.why.after": "Match after training",
    "lp.why.free": "Free",
    "lp.how.title": "How it works",
    "lp.how.1t": "Create a profile",
    "lp.how.1d": "Skills, not a résumé.",
    "lp.how.2t": "Get matched",
    "lp.how.2d": "See how well you fit.",
    "lp.how.3t": "Get hired",
    "lp.how.3d": "Chat and apply in a tap.",
    "lp.cta.title": "Ready when you are.",
    "lp.cta.lede": "Free for job seekers. Always.",
    "lp.cta.work": "Find work",
    "lp.cta.hire": "Hire workers",
    "lp.foot.privacy": "Privacy",
    "lp.foot.terms": "Terms",
    "lp.foot.jobs": "Find jobs",
    "lp.foot.map": "Job map",
    "lp.foot.training": "Training",
    "lp.foot.copy": "hanapbuhay · Oriental Mindoro",
    "lang.label": "Language",
    "lang.choose": "Select Language",
    "lang.english": "English",
    "lang.filipino": "Filipino (Tagalog)"
  },

  tl: {
    "lp.why.v1": "Na-upload ang sertipiko",
    "lp.why.v2": "Sinuri ng team ng hanapbuhay",
    "lp.why.v3": "May Verified badge na ang profile",
    "gj.promo.d": "Gumawa ng libreng Skills Passport at alamin ang kailangan ng bawat trabaho bago mag-apply.",
    "gj.promo.t": "Alamin ang tugma mo sa bawat trabaho",
    "gj.retry": "Subukan muli",
    "gj.err": "Hindi ma-load ang mga trabaho ngayon.",
    "gj.all": "Lahat ng trabaho",
    "gj.none2": "Subukan ang ibang bayan o mas maikling salita.",
    "gj.none": "Walang trabahong tugma sa hinanap mo.",
    "gj.more": "Magpakita pa",
    "gj.clear": "I-clear",
    "gj.newest": "pinakabago muna",
    "gj.of": "sa",
    "gj.showing": "Ipinapakita ang",
    "gj.searching": "Naghahanap…",
    "gj.loading": "Kinukuha ang mga trabaho…",
    "gj.open": "bukas na trabaho",
    "gj.title": "Mga bukas na trabaho sa Oriental Mindoro",
    "lp.emp.verified": "Beripikadong negosyo",
    "lp.emp.hired": "Natanggap!",
    "lp.emp.newapp": "Bagong aplikante",
    "lp.emp.col3": "Natanggap",
    "lp.emp.col2": "Shortlist",
    "lp.emp.col1": "Bago",
    "lp.emp.board": "Live na hiring board",
    "lp.why.hired": "Natanggap",
    "lp.why.verify.d": "Sinusuri ng aming team ang mga sertipiko at business permit.",
    "lp.why.verify.t": "Sinuri, hindi basta sinabi",
    "lp.map.hint": "Ituro ang isang bayan",
    "lp.map.view": "Tingnan ang trabaho rito",
    "lp.emp.kicker": "Para sa employer at MSME",
    "lp.emp.title": "Kumuha ng taong kaya ang trabaho.",
    "lp.emp.p1": "Mag-post ng bakante na may larawan, sahod at iskedyul",
    "lp.emp.p2": "Aplikanteng nakaayos ayon sa tugma",
    "lp.emp.p3": "Maghanap ng manggagawa at imbitahan sila",
    "lp.emp.p4": "Makuha ang Verified badge ng negosyo",
    "lp.emp.cta": "Mag-hire nang libre",
    "lp.emp.gig": "Mabilisang trabaho lang?",
    "nav.sign_in": "Mag-sign in",
    "nav.sign_up": "Magsimula",
    "nav.create_account": "Gumawa ng libreng account",
    "nav.dashboard": "Dashboard",
    "pub.Home": "Home",
    "pub.Find Jobs": "Maghanap ng Trabaho",
    "pub.Job Map": "Mapa ng Trabaho",
    "pub.Training": "Pagsasanay",
    "lh.features": "Mga tampok",
    "lh.how": "Paano gumagana",
    "lh.roles": "Para sa employer",
    "lh.dashboard": "Buksan ang dashboard",
    "lh.menu": "Menu",
    "lp.hero.eyebrow": "Bukas na sa 15 bayan ng Oriental Mindoro",
    "lp.hero.title_a": "Trabahong bagay",
    "lp.hero.title_b": "sa kaya mong gawin.",
    "lp.hero.lede": "Trabaho, raket at pag-hire sa buong probinsya, tugma sa totoong kasanayan, hindi sa résumé.",
    "lp.hero.cta": "Magsimula nang libre",
    "lp.hero.browse": "Tingnan ang trabaho",
    "lp.hero.t1": "Libre sa naghahanap",
    "lp.hero.t2": "Beripikadong employer",
    "lp.hero.t3": "Nakaayon sa TESDA",
    "lp.map.label": "Mapa ng Oriental Mindoro at ang mga bukas na trabaho sa bawat bayan",
    "lp.map.legend": "{n} bukas na trabaho · 15 bayan",
    "lp.map.jobs": "{n} bukas na trabaho",
    "lp.map.job": "1 bukas na trabaho",
    "lp.map.none": "Wala pang bakante",
    "lp.map.new": "Bagong post",
    "lp.map.pay": "Pag-uusapan",
    "lp.now.title": "Naghahanap ngayon",
    "lp.now.all": "Lahat ng trabaho",
    "lp.roles.title": "Para sa lahat ng nagtatrabaho",
    "lp.roles.worker.title": "Naghahanap ng trabaho",
    "lp.roles.worker.desc": "Trabaho at raket malapit sa iyo.",
    "lp.roles.worker.cta": "Maghanap",
    "lp.roles.employer.title": "Employer at MSME",
    "lp.roles.employer.desc": "Mag-hire para sa regular na trabaho.",
    "lp.roles.employer.cta": "Mag-hire",
    "lp.roles.hirer.title": "Kliyente",
    "lp.roles.hirer.desc": "Tulong para sa mabilisang trabaho.",
    "lp.roles.hirer.cta": "Mag-post ng request",
    "lp.why.title": "Kasanayan muna. Hindi résumé.",
    "lp.why.passport.t": "Skills Passport",
    "lp.why.passport.d": "Ang kasanayan, sertipiko at gawa mo, sa isang profile na pinagkakatiwalaan ng employer.",
    "lp.why.match.t": "Tapat na pagtutugma",
    "lp.why.match.d": "Makikita sa bawat trabaho kung gaano ka katugma, at kung ano ang kulang.",
    "lp.why.train.t": "Pagsasanay malapit sa iyo",
    "lp.why.train.d": "Mga kurso ng TESDA malapit sa iyo na pupuno sa kulang.",
    "lp.why.missing": "Kulang: NC II",
    "lp.why.verified": "Beripikado",
    "lp.why.after": "Tugma pagkatapos ng kurso",
    "lp.why.free": "Libre",
    "lp.how.title": "Paano gumagana",
    "lp.how.1t": "Gumawa ng profile",
    "lp.how.1d": "Kasanayan, hindi résumé.",
    "lp.how.2t": "Maitugma",
    "lp.how.2d": "Tingnan kung gaano ka katugma.",
    "lp.how.3t": "Matanggap",
    "lp.how.3d": "Mag-chat at mag-apply sa isang tap.",
    "lp.cta.title": "Handa ka na ba?",
    "lp.cta.lede": "Libre para sa naghahanap ng trabaho. Palagi.",
    "lp.cta.work": "Maghanap ng trabaho",
    "lp.cta.hire": "Kumuha ng tauhan",
    "lp.foot.privacy": "Privacy",
    "lp.foot.terms": "Mga Tuntunin",
    "lp.foot.jobs": "Maghanap ng trabaho",
    "lp.foot.map": "Mapa ng trabaho",
    "lp.foot.training": "Pagsasanay",
    "lp.foot.copy": "hanapbuhay · Oriental Mindoro",
    "lang.label": "Wika",
    "lang.choose": "Pumili ng Wika",
    "lang.english": "English",
    "lang.filipino": "Filipino (Tagalog)"
  }
}

// Fallback phrase map for convenience
const PHRASE_MAP = {
  'Find Jobs': 'Maghanap ng Trabaho',
  'How It Works': 'Paano Gumagana',
  "Who It's For": 'Para Kanino Ito',
  'Locations': 'Mga Bayan at Lokasyon',
  'Sign In': 'Mag-sign In',
  'Sign Up Free': 'Magrehistro nang Libre',
  'Create Free Account': 'Gumawa ng Libreng Account',
  'Dashboard': 'Dashboard',
  'Search': 'Maghanap',
  'Location': 'Lokasyon',
  'View Details': 'Tingnan ang Detalye',
  'Browse Jobs': 'Mag-browse ng Trabaho'
}

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem('hanapbuhay_lang')
      if (saved && (saved === 'en' || saved === 'tl')) return saved
    } catch {}
    return 'en'
  })

  useEffect(() => {
    try {
      localStorage.setItem('hanapbuhay_lang', lang)
      document.documentElement.lang = lang === 'tl' ? 'fil' : 'en'
    } catch {}
  }, [lang])

  const t = useMemo(() => {
    return (key, fallback) => {
      if (!key) return ''
      const dict = TRANSLATIONS[lang] || TRANSLATIONS.en
      if (dict && dict[key] !== undefined) {
        return dict[key]
      }
      if (lang === 'tl' && PHRASE_MAP[key]) {
        return PHRASE_MAP[key]
      }
      if (TRANSLATIONS.en && TRANSLATIONS.en[key] !== undefined) {
        return TRANSLATIONS.en[key]
      }
      return fallback !== undefined ? fallback : key
    }
  }, [lang])

  const currentLanguage = useMemo(() => {
    return LANGUAGES.find(l => l.code === lang) || LANGUAGES[0]
  }, [lang])

  const toggleLanguage = () => {
    setLang(prev => (prev === 'en' ? 'tl' : 'en'))
  }

  const value = {
    lang,
    setLang,
    toggleLanguage,
    t,
    currentLanguage,
    languages: LANGUAGES
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    return {
      lang: 'en',
      setLang: () => {},
      toggleLanguage: () => {},
      t: (k, fb) => fb || k,
      currentLanguage: LANGUAGES[0],
      languages: LANGUAGES
    }
  }
  return ctx
}

/* ──────────────────────────────────────────────────────────────
   Language Switcher Component (for Landing page only)
   ────────────────────────────────────────────────────────────── */
export function LanguageSwitcher({
  variant = 'dropdown',
  light = false,
  className = '',
  style = {}
}) {
  const { lang, setLang, toggleLanguage, languages, currentLanguage } = useLanguage()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 1. Compact Toggle Pill: [ 🇺🇸 EN | 🇵🇭 FIL ]
  if (variant === 'toggle') {
    return (
      <div
        className={`lang-toggle ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: light ? 'rgba(255,255,255,0.18)' : '#f1f5f9',
          border: light ? '1px solid rgba(255,255,255,0.28)' : '1px solid #e2e8f0',
          borderRadius: 20,
          padding: 2,
          userSelect: 'none',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          ...style
        }}
      >
        {languages.map(item => {
          const isActive = item.code === lang
          return (
            <button
              key={item.code}
              type="button"
              onClick={() => setLang(item.code)}
              title={item.native}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 11px',
                borderRadius: 16,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                transition: 'all 0.15s ease',
                background: isActive
                  ? (light ? '#ffffff' : 'var(--navy, #0D1B3E)')
                  : 'transparent',
                color: isActive
                  ? (light ? 'var(--navy, #0D1B3E)' : '#ffffff')
                  : (light ? '#ffffff' : '#64748b'),
                boxShadow: isActive ? '0 2px 6px rgba(0,0,0,0.12)' : 'none'
              }}
            >
              <span>{item.short}</span>
            </button>
          )
        })}
      </div>
    )
  }

  // 2. Dropdown Menu (Default for Landing Navbar)
  return (
    <div
      ref={dropdownRef}
      className={`lang-dropdown ${className}`}
      style={{ position: 'relative', display: 'inline-block', ...style }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Select Language"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 18,
          border: light ? '1px solid rgba(255,255,255,0.28)' : '1px solid #e2e8f0',
          background: light ? 'rgba(255,255,255,0.12)' : '#ffffff',
          color: light ? '#ffffff' : 'var(--navy-d, #080F24)',
          fontSize: 12.5,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          backdropFilter: light ? 'blur(4px)' : 'none',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>{currentLanguage.flag}</span>
        <span style={{ letterSpacing: '0.01em' }}>{currentLanguage.label}</span>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          transition: 'transform 0.2s ease',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          opacity: 0.7
        }}>
          <IconChevron size={12} />
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            background: '#ffffff',
            borderRadius: 14,
            padding: '6px',
            minWidth: 185,
            zIndex: 1000,
            boxShadow: '0 12px 30px rgba(13,27,62,0.16), 0 2px 6px rgba(0,0,0,0.06)',
            border: '1px solid #e2e8f0',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          <div style={{ padding: '6px 10px 4px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {lang === 'tl' ? 'Pumili ng Wika' : 'Select Language'}
          </div>
          {languages.map(item => {
            const isSelected = item.code === lang
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  setLang(item.code)
                  setOpen(false)
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: 'none',
                  background: isSelected ? '#eff6ff' : 'transparent',
                  color: isSelected ? '#1d4ed8' : '#1e293b',
                  fontSize: 13,
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.12s ease'
                }}
                onMouseEnter={e => {
                  if (!isSelected) e.currentTarget.style.background = '#f8fafc'
                }}
                onMouseLeave={e => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{item.flag}</span>
                  <div>
                    <div style={{ lineHeight: 1.2 }}>{item.label}</div>
                    <div style={{ fontSize: 10.5, color: isSelected ? '#3b82f6' : '#64748b' }}>{item.native}</div>
                  </div>
                </div>
                {isSelected && (
                  <span style={{ color: '#1d4ed8', display: 'flex', alignItems: 'center' }}>
                    <IconCheck size={15} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
