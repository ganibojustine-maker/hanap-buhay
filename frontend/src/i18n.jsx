import { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react'
import { IconGlobe, IconCheck, IconChevron } from './components/icons.jsx'

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', flag: '🇺🇸', short: 'EN' },
  { code: 'tl', label: 'Filipino (Tagalog)', native: 'Wikang Filipino / Tagalog', flag: '🇵🇭', short: 'FIL' }
]

export const TRANSLATIONS = {
  en: {
    // Nav
    'nav.find_jobs': 'Find Jobs',
    'nav.how_it_works': 'How It Works',
    'nav.who_its_for': "Who It's For",
    'nav.locations': 'Locations',
    'nav.sign_in': 'Sign In',
    'nav.sign_up': 'Sign Up Free',
    'nav.dashboard': 'Dashboard',
    'nav.create_account': 'Create Free Account',

    // Hero
    'hero.badge': 'Built for Oriental Mindoro',
    'hero.title_line1': 'Find the Right Job.',
    'hero.title_line2': 'Build Your Skills.',
    'hero.title_line3': 'A Brighter Future.',
    'hero.subtitle': 'Connecting job seekers, freelancers, and skilled workers with local employers and training opportunities in Oriental Mindoro.',
    'hero.search_placeholder': 'Job title, skills, or keyword',
    'hero.location_placeholder': 'Location',
    'hero.search_button': 'Search',
    'hero.stat_jobs': 'Active Jobs',
    'hero.stat_lgus': 'Oriental Mindoro',
    'hero.stat_placed': 'Workers Placed',
    'hero.badge_match': '92% Match',
    'hero.badge_match_sub': 'Construction Worker · Calapan',
    'hero.badge_jobs_week': 'Jobs this week',

    // Features
    'feat.f1_title': 'Job Matching',
    'feat.f1_desc': 'Find jobs that match your skills, experience, and location in Oriental Mindoro.',
    'feat.f2_title': 'Skills Development',
    'feat.f2_desc': 'Take training and uplift your skills with TESDA and local courses near you.',
    'feat.f3_title': 'Digital Skills Passport',
    'feat.f3_desc': 'Showcase your verified skills, certifications and work experience.',
    'feat.f4_title': 'Local MSMEs',
    'feat.f4_desc': 'Connect with local businesses, employers, and create more jobs together.',

    // Featured Jobs
    'jobs.eyebrow': 'Available Now',
    'jobs.title': 'Featured Jobs',
    'jobs.view_all': 'View all jobs',
    'jobs.negotiable': 'Salary negotiable',
    'jobs.from': 'From',
    'jobs.up_to': 'Up to',
    'jobs.mo': '/mo',
    'jobs.match': 'Match',
    'jobs.view_details': 'View Details',
    'jobs.local_employer': 'Local Employer',

    // How It Works
    'how.eyebrow': 'Simple Process',
    'how.title': 'From What You Can Do to the Work You Deserve.',
    'how.s1_title': 'Build your Skills Passport',
    'how.s1_desc': "List what you can do, where you've worked, and what you've trained for. No résumé needed.",
    'how.s2_title': 'Find Matching Work',
    'how.s2_desc': 'Jobs and gigs near you, ranked by how well your skills, experience, and location fit.',
    'how.s3_title': 'See Your Skill Gaps',
    'how.s3_desc': "Know exactly what's missing for a role, in plain words instead of a mystery score.",
    'how.s4_title': 'Learn & Level Up',
    'how.s4_desc': 'Get training suggestions that close those gaps, listed by place and cost.',

    // Who It's For
    'who.eyebrow': 'Made for Everyone',
    'who.title': 'One Platform, Three Ways In.',
    'who.worker_title': 'Jobseekers & Skilled Workers',
    'who.worker_tag': 'Find work based on what you can actually do',
    'who.worker_blurb': 'No fancy résumé needed. Build your Skills Passport, get matched with local jobs, and see how to qualify for higher-paying work.',
    'who.worker_p1': 'Free skills assessment & digital passport',
    'who.worker_p2': 'Job matches ranked by skill fit',
    'who.worker_p3': 'Direct training recommendations',
    'who.worker_cta': 'Join as a worker',

    'who.employer_title': 'Employers & Local MSMEs',
    'who.employer_tag': 'Hire verified talent with confidence',
    'who.employer_blurb': 'Post jobs in minutes, find pre-matched candidates, and verify trade certifications before you hire.',
    'who.employer_p1': 'Post unlimited job openings',
    'who.employer_p2': 'Pre-screened candidates by skill match',
    'who.employer_p3': 'Verified applicant credentials',
    'who.employer_cta': 'Join as an employer',

    'who.client_title': 'Clients & Service Buyers',
    'who.client_tag': 'Book reliable local service pros',
    'who.client_blurb': 'Find trusted electricians, plumbers, carpenters, and technicians for home or business projects across Oriental Mindoro.',
    'who.client_p1': 'Verified local service professionals',
    'who.client_p2': 'Clear quotes & background checks',
    'who.client_p3': 'Direct communication & tracking',
    'who.client_cta': 'Join as a client',

    // Towns
    'towns.eyebrow': '15 Municipalities + Calapan City',
    'towns.title': 'Made for Oriental Mindoro',

    // CTA
    'cta.title': 'Find Your Next Job in Oriental Mindoro Today.',
    'cta.subtitle': 'Join thousands of workers and employers already using Hanapbuhay.',
    'cta.create_account': 'Create Free Account',
    'cta.browse_jobs': 'Browse Jobs',

    // Footer
    'foot.copy': 'Hanapbuhay · Oriental Mindoro, Philippines',
    'foot.about': 'About',
    'foot.privacy': 'Privacy',
    'foot.terms': 'Terms',
    'foot.contact': 'Contact',

    // Language Selector
    'lang.label': 'Language',
    'lang.choose': 'Select Language',
    'lang.english': 'English',
    'lang.filipino': 'Filipino (Tagalog)'
  },

  tl: {
    // Nav
    'nav.find_jobs': 'Maghanap ng Trabaho',
    'nav.how_it_works': 'Paano Gumagana',
    'nav.who_its_for': 'Para Kanino Ito',
    'nav.locations': 'Mga Bayan at Lokasyon',
    'nav.sign_in': 'Mag-sign In',
    'nav.sign_up': 'Magrehistro nang Libre',
    'nav.dashboard': 'Dashboard',
    'nav.create_account': 'Gumawa ng Libreng Account',

    // Hero
    'hero.badge': 'Ginawa para sa Oriental Mindoro',
    'hero.title_line1': 'Hanapin ang Tamang Trabaho.',
    'hero.title_line2': 'Paunlarin ang Iyong Kasanayan.',
    'hero.title_line3': 'Mas Magandang Kinabukasan.',
    'hero.subtitle': 'Ikinokonekta ang mga naghahanap ng trabaho, freelancers, at skilled workers sa mga lokal na employer at oportunidad sa pagsasanay sa Oriental Mindoro.',
    'hero.search_placeholder': 'Pangalan ng trabaho, kasanayan, o keyword',
    'hero.location_placeholder': 'Lokasyon o Munisipalidad',
    'hero.search_button': 'Maghanap',
    'hero.stat_jobs': 'Aktibong Trabaho',
    'hero.stat_lgus': 'Bayan sa Oriental Mindoro',
    'hero.stat_placed': 'Nahanapan ng Trabaho',
    'hero.badge_match': '92% Tugma',
    'hero.badge_match_sub': 'Construction Worker · Calapan',
    'hero.badge_jobs_week': 'Bagong trabaho ngayong linggo',

    // Features
    'feat.f1_title': 'Pagtutugma ng Trabaho',
    'feat.f1_desc': 'Maghanap ng trabahong tugma sa iyong kasanayan, karanasan, at lokasyon sa Oriental Mindoro.',
    'feat.f2_title': 'Pagpapaunlad ng Kasanayan',
    'feat.f2_desc': 'Kumuha ng pagsasanay at itaas ang iyong galing sa tulong ng TESDA at mga lokal na kurso malapit sa iyo.',
    'feat.f3_title': 'Digital Skills Passport',
    'feat.f3_desc': 'Ipagmalaki ang iyong beripikadong kasanayan, sertipiko, at karanasan sa trabaho.',
    'feat.f4_title': 'Lokal na mga Negosyo (MSMEs)',
    'feat.f4_desc': 'Makipag-ugnayan sa mga lokal na negosyo at employer, at sama-samang lumikha ng trabaho.',

    // Featured Jobs
    'jobs.eyebrow': 'Bukas Ngayon',
    'jobs.title': 'Mga Tampok na Trabaho',
    'jobs.view_all': 'Tingnan lahat ng trabaho',
    'jobs.negotiable': 'Pwedeng pag-usapan ang sahod',
    'jobs.from': 'Mula',
    'jobs.up_to': 'Hanggang',
    'jobs.mo': '/buwan',
    'jobs.match': 'Tugma',
    'jobs.view_details': 'Tingnan ang Detalye',
    'jobs.local_employer': 'Lokal na Employer',

    // How It Works
    'how.eyebrow': 'Simpleng Hakbang',
    'how.title': 'Mula sa Iyong Kakayahan Hanggang sa Trabahong Nararapat sa Iyo.',
    'how.s1_title': 'Bumuo ng Skills Passport',
    'how.s1_desc': 'Ilista ang iyong kakayahan, pinagtrabahuan, at pinag-aralan. Hindi kailangan ng tradisyunal na résumé.',
    'how.s2_title': 'Maghanap ng Tugmang Trabaho',
    'how.s2_desc': 'Mga trabaho at raket malapit sa iyo, nakaayos ayon sa tugma ng iyong kasanayan at lokasyon.',
    'how.s3_title': 'Alamin ang Kulang na Kasanayan',
    'how.s3_desc': 'Alamin nang malinaw kung anong kulang para sa posisyon gamit ang simpleng paliwanag.',
    'how.s4_title': 'Mag-aral at Umangat',
    'how.s4_desc': 'Kumuha ng suhestiyon sa pagsasanay para mapunan ang kakulangan, may impormasyon sa lugar at bayad.',

    // Who It's For
    'who.eyebrow': 'Para sa Lahat',
    'who.title': 'Isang Plataporma, Tatlong Paraan para Sumali.',
    'who.worker_title': 'Naghahanap ng Trabaho at Skilled Workers',
    'who.worker_tag': 'Maghanap ng trabaho batay sa totoong kakayahan mo',
    'who.worker_blurb': 'Hindi kailangan ng komplikadong résumé. Buuin ang iyong Skills Passport, tumanggap ng trabahong tugma sa iyo, at matutong umangat.',
    'who.worker_p1': 'Libreng skills assessment at digital passport',
    'who.worker_p2': 'Pagtutugma ayon sa kasanayan at lokasyon',
    'who.worker_p3': 'Direktang rekomendasyon sa kurso at TESDA',
    'who.worker_cta': 'Sumali bilang Manggagawa',

    'who.employer_title': 'Mga Employer at Lokal na MSMEs',
    'who.employer_tag': 'Mag-hire ng beripikadong manggagawa nang may kumpiyansa',
    'who.employer_blurb': 'Mag-post ng trabaho sa loob ng ilang minuto, makahanap ng tugmang aplikante, at i-beripika ang sertipikasyon bago mag-hire.',
    'who.employer_p1': 'Mag-post ng mga bakanteng trabaho',
    'who.employer_p2': 'Na-screen na aplikante ayon sa skills',
    'who.employer_p3': 'Beripikadong kredensyal at dokumento',
    'who.employer_cta': 'Sumali bilang Employer',

    'who.client_title': 'Mga Kliyente at Naghahanap ng Serbisyo',
    'who.client_tag': 'Mag-book ng maaasahang lokal na eksperto sa serbisyo',
    'who.client_blurb': 'Maghanap ng mapagkakatiwalaang electrician, tubero, karpintero, at technician para sa tahanan o negosyo sa Oriental Mindoro.',
    'who.client_p1': 'Beripikadong lokal na propesyonal sa serbisyo',
    'who.client_p2': 'Malinaw na presyo at background check',
    'who.client_p3': 'Direktang mensahe at monitoring',
    'who.client_cta': 'Sumali bilang Kliyente',

    // Towns
    'towns.eyebrow': '15 Munisipalidad + Calapan City',
    'towns.title': 'Ginawa para sa Oriental Mindoro',

    // CTA
    'cta.title': 'Hanapin ang Iyong Susunod na Trabaho sa Oriental Mindoro Ngayon.',
    'cta.subtitle': 'Sumali sa libu-libong manggagawa at employer na gumagamit na ng Hanapbuhay.',
    'cta.create_account': 'Gumawa ng Libreng Account',
    'cta.browse_jobs': 'Mag-browse ng Trabaho',

    // Footer
    'foot.copy': 'Hanapbuhay · Oriental Mindoro, Pilipinas',
    'foot.about': 'Tungkol sa Amin',
    'foot.privacy': 'Patakaran sa Privacy',
    'foot.terms': 'Mga Tuntunin',
    'foot.contact': 'Makipag-ugnayan',

    // Language Selector
    'lang.label': 'Wika',
    'lang.choose': 'Pumili ng Wika',
    'lang.english': 'English',
    'lang.filipino': 'Filipino (Tagalog)'
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
                padding: '4px 10px',
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
              <span style={{ fontSize: 13 }}>{item.flag}</span>
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
