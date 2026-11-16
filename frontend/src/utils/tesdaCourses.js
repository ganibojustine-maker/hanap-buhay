// TESDA-registered training programs offered in Oriental Mindoro.
// Source: TESDA "TVI with Registered Program" search (https://tesda.gov.ph/TVI),
// collected 2026-11-13. "schools" and "towns" are counts at that time;
// the Enroll link always opens TESDA's live list, so people see the current schools.

export const TESDA_TVI_SEARCH = 'https://tesda.gov.ph/Tvi/Result'
export const TESDA_ONLINE = 'https://e-tesda.gov.ph/'
export const TESDA_SOURCE_DATE = '2026-11-13'

export const COURSE_CATEGORIES = ['All', 'Construction', 'Technology', 'Food & Hospitality', 'Agriculture', 'Healthcare', 'Automotive & Driving', 'Business', 'Beauty & Garments']

export const TESDA_COURSES = [
  {
    id: "events-management-services-nc-iii",
    title: "Events Management Services NC III",
    category: "Food & Hospitality",
    schools: 28,
    towns: {
      "Calapan City": 11,
      "Roxas": 6,
      "Naujan": 3,
      "Pinamalayan": 2,
      "Puerto Galera": 1,
      "Baco": 1,
      "Bongabong": 1,
      "Victoria": 1,
      "San Teodoro": 1,
      "Bansud": 1
    },
    desc: "Plan and run events: weddings, conferences, and parties. Covers coordination, budgeting, suppliers, and on-site management."
  },
  {
    id: "bread-and-pastry-production-nc-ii",
    title: "Bread and Pastry Production NC II",
    category: "Food & Hospitality",
    schools: 26,
    towns: {
      "Calapan City": 7,
      "Roxas": 4,
      "Bongabong": 3,
      "Naujan": 3,
      "Puerto Galera": 2,
      "Socorro": 2,
      "Victoria": 1,
      "Bulalacao": 1,
      "San Teodoro": 1,
      "Pinamalayan": 1,
      "Bansud": 1
    },
    desc: "Bake breads, cakes, pastries, and desserts for bakeries and food businesses. Includes food safety and costing."
  },
  {
    id: "agricultural-crops-production-nc-ii",
    title: "Agricultural Crops Production NC II",
    category: "Agriculture",
    schools: 24,
    towns: {
      "Naujan": 6,
      "Calapan City": 4,
      "Roxas": 3,
      "Victoria": 3,
      "Bongabong": 2,
      "Bansud": 2,
      "Puerto Galera": 1,
      "Socorro": 1,
      "Gloria": 1,
      "Pinamalayan": 1
    },
    desc: "Grow and care for vegetables and other crops: planting, fertilizing, pest control, and harvesting."
  },
  {
    id: "food-and-beverage-services-nc-ii",
    title: "Food and Beverage Services NC II",
    category: "Food & Hospitality",
    schools: 22,
    towns: {
      "Calapan City": 6,
      "Roxas": 5,
      "Puerto Galera": 2,
      "Bongabong": 2,
      "Pinamalayan": 2,
      "Victoria": 1,
      "Bulalacao": 1,
      "Naujan": 1,
      "Socorro": 1,
      "Bansud": 1
    },
    desc: "Serve guests in restaurants and hotels: table setting, taking orders, and serving food and drinks."
  },
  {
    id: "housekeeping-nc-ii",
    title: "Housekeeping NC II",
    category: "Food & Hospitality",
    schools: 22,
    towns: {
      "Calapan City": 9,
      "Roxas": 5,
      "Pinamalayan": 3,
      "Bongabong": 2,
      "Puerto Galera": 1,
      "Socorro": 1,
      "Bansud": 1
    },
    desc: "Clean and prepare hotel and resort rooms, handle laundry, and keep public areas in order."
  },
  {
    id: "organic-agriculture-production-nc-ii",
    title: "Organic Agriculture Production NC II",
    category: "Agriculture",
    schools: 20,
    towns: {
      "Naujan": 5,
      "Bongabong": 3,
      "Roxas": 3,
      "Baco": 2,
      "Pinamalayan": 1,
      "Calapan City": 1,
      "Socorro": 1,
      "Gloria": 1,
      "San Teodoro": 1,
      "Mansalay": 1,
      "Bansud": 1
    },
    desc: "Organic farming: composting, natural fertilizers and pest control, and raising organic crops and livestock."
  },
  {
    id: "driving-nc-ii",
    title: "Driving NC II",
    category: "Automotive & Driving",
    schools: 17,
    towns: {
      "Calapan City": 5,
      "Roxas": 3,
      "Pinamalayan": 2,
      "Baco": 1,
      "Naujan": 1,
      "Gloria": 1,
      "Bongabong": 1,
      "Victoria": 1,
      "San Teodoro": 1,
      "Bansud": 1
    },
    desc: "Drive light vehicles safely and professionally. Covers traffic rules, defensive driving, and basic vehicle checks."
  },
  {
    id: "computer-systems-servicing-nc-ii",
    title: "Computer Systems Servicing NC II",
    category: "Technology",
    schools: 12,
    towns: {
      "Calapan City": 6,
      "Pinamalayan": 2,
      "Baco": 1,
      "Naujan": 1,
      "Bongabong": 1,
      "Roxas": 1
    },
    desc: "Assemble, set up, troubleshoot, and repair computers and small networks."
  },
  {
    id: "shielded-metal-arc-welding-smaw-nc-ii",
    title: "Shielded Metal Arc Welding (SMAW) NC II",
    category: "Construction",
    schools: 12,
    towns: {
      "Victoria": 2,
      "Roxas": 2,
      "Calapan City": 2,
      "Bulalacao": 1,
      "Naujan": 1,
      "Mansalay": 1,
      "San Teodoro": 1,
      "Bansud": 1
    },
    desc: "Weld plates and structural steel with stick welding, following safety and quality standards."
  },
  {
    id: "masonry-nc-ii",
    title: "Masonry NC II",
    category: "Construction",
    schools: 11,
    towns: {
      "Calapan City": 4,
      "Puerto Galera": 2,
      "Pinamalayan": 1,
      "Naujan": 1,
      "Socorro": 1,
      "San Teodoro": 1,
      "Bansud": 1
    },
    desc: "Lay concrete hollow blocks, plaster walls, and do concrete work for houses and buildings."
  },
  {
    id: "shielded-metal-arc-welding-smaw-nc-i",
    title: "Shielded Metal Arc Welding (SMAW) NC I",
    category: "Construction",
    schools: 11,
    towns: {
      "Calapan City": 3,
      "Roxas": 2,
      "Bulalacao": 1,
      "Naujan": 1,
      "Mansalay": 1,
      "San Teodoro": 1,
      "Bansud": 1
    },
    desc: "Entry-level stick welding: tack and fillet welds on carbon steel plates."
  },
  {
    id: "carpentry-nc-ii",
    title: "Carpentry NC II",
    category: "Construction",
    schools: 8,
    towns: {
      "Calapan City": 3,
      "Naujan": 1,
      "Puerto Galera": 1,
      "Socorro": 1,
      "San Teodoro": 1,
      "Bansud": 1
    },
    desc: "Build formworks, frames, ceilings, doors, and windows for construction projects."
  },
  {
    id: "bookkeeping-nc-iii",
    title: "Bookkeeping NC III",
    category: "Business",
    schools: 7,
    towns: {
      "Calapan City": 3,
      "Roxas": 3,
      "San Teodoro": 1
    },
    desc: "Record business transactions, prepare financial statements, and handle payroll records."
  },
  {
    id: "cookery-nc-ii",
    title: "Cookery NC II",
    category: "Food & Hospitality",
    schools: 7,
    towns: {
      "Roxas": 3,
      "Bongabong": 1,
      "Pinamalayan": 1,
      "Bansud": 1,
      "Calapan City": 1
    },
    desc: "Prepare hot and cold dishes, soups, sauces, and desserts in commercial kitchens."
  },
  {
    id: "animal-production-swine-nc-ii",
    title: "Animal Production (Swine) NC II",
    category: "Agriculture",
    schools: 6,
    towns: {
      "Naujan": 2,
      "Gloria": 2,
      "Roxas": 1,
      "Calapan City": 1
    },
    desc: "Raise pigs: housing, feeding, health care, breeding, and farm records."
  },
  {
    id: "electronic-products-assembly-and-servicing-nc-ii",
    title: "Electronic Products Assembly and Servicing NC II",
    category: "Technology",
    schools: 6,
    towns: {
      "Calapan City": 1,
      "Socorro": 1,
      "Victoria": 1,
      "San Teodoro": 1,
      "Roxas": 1,
      "Bansud": 1
    },
    desc: "Assemble, test, and repair electronic products and household appliances."
  },
  {
    id: "bartending-nc-ii",
    title: "Bartending NC II",
    category: "Food & Hospitality",
    schools: 5,
    towns: {
      "Calapan City": 2,
      "Bulalacao": 1,
      "Bongabong": 1,
      "Roxas": 1
    },
    desc: "Prepare and serve drinks and cocktails, and run a bar safely and responsibly."
  },
  {
    id: "front-office-services-nc-ii",
    title: "Front Office Services NC II",
    category: "Food & Hospitality",
    schools: 5,
    towns: {
      "Calapan City": 3,
      "Bongabong": 1,
      "Roxas": 1
    },
    desc: "Handle hotel reservations, check-in and check-out, and guest service at the front desk."
  },
  {
    id: "tile-setting-nc-ii",
    title: "Tile Setting NC II",
    category: "Construction",
    schools: 5,
    towns: {
      "Calapan City": 4,
      "San Teodoro": 1
    },
    desc: "Install floor and wall tiles: surface preparation, layout, cutting, setting, and grouting."
  },
  {
    id: "health-care-services-nc-ii",
    title: "Health Care Services NC II",
    category: "Healthcare",
    schools: 4,
    towns: {
      "Calapan City": 2,
      "Victoria": 1,
      "Roxas": 1
    },
    desc: "Assist nurses and patients in hospitals and clinics: basic patient care and keeping the area clean and safe."
  },
  {
    id: "motorcycle-small-engine-servicing-nc-ii",
    title: "Motorcycle/Small Engine Servicing NC II",
    category: "Automotive & Driving",
    schools: 4,
    towns: {
      "Naujan": 1,
      "Gloria": 1,
      "Calapan City": 1,
      "Bansud": 1
    },
    desc: "Maintain and repair motorcycles and small engines: engine, fuel, electrical, and brake systems."
  },
  {
    id: "automotive-servicing-nc-i",
    title: "Automotive Servicing NC I",
    category: "Automotive & Driving",
    schools: 3,
    towns: {
      "Calapan City": 2,
      "Bansud": 1
    },
    desc: "Entry-level car maintenance: oil change, tune-up, tire and brake checks."
  },
  {
    id: "barista-nc-ii",
    title: "Barista NC II",
    category: "Food & Hospitality",
    schools: 3,
    towns: {
      "Pinamalayan": 1,
      "Roxas": 1,
      "Calapan City": 1
    },
    desc: "Prepare espresso drinks and other coffee beverages, and keep coffee equipment in good condition."
  },
  {
    id: "caregiving-elderly-nc-ii",
    title: "Caregiving (Elderly) NC II",
    category: "Healthcare",
    schools: 3,
    towns: {
      "Calapan City": 3
    },
    desc: "Care for elderly people at home or in facilities: daily living help, nutrition, and safety."
  },
  {
    id: "construction-painting-nc-ii",
    title: "Construction Painting NC II",
    category: "Construction",
    schools: 3,
    towns: {
      "San Teodoro": 1,
      "Bansud": 1,
      "Calapan City": 1
    },
    desc: "Prepare surfaces and apply paint and finishes on walls, ceilings, wood, and metal."
  },
  {
    id: "masonry-nc-i",
    title: "Masonry NC I",
    category: "Construction",
    schools: 3,
    towns: {
      "Pinamalayan": 1,
      "San Teodoro": 1,
      "Calapan City": 1
    },
    desc: "Entry-level masonry: mixing mortar and concrete, and laying blocks."
  },
  {
    id: "plumbing-nc-i",
    title: "Plumbing NC I",
    category: "Construction",
    schools: 3,
    towns: {
      "Calapan City": 2,
      "San Teodoro": 1
    },
    desc: "Entry-level plumbing: install and repair water pipes, fixtures, and drainage."
  },
  {
    id: "animal-production-poultry-chicken-nc-ii",
    title: "Animal Production (Poultry-Chicken) NC II",
    category: "Agriculture",
    schools: 2,
    towns: {
      "Calapan City": 1,
      "Naujan": 1
    },
    desc: "Raise broiler and layer chickens: brooding, feeding, health care, and egg production."
  },
  {
    id: "automotive-servicing-chassis-repair-nc-ii",
    title: "Automotive Servicing (Chassis Repair) NC II",
    category: "Automotive & Driving",
    schools: 2,
    towns: {
      "Calapan City": 1,
      "Bansud": 1
    },
    desc: "Repair car suspension, steering, brakes, and drive systems."
  },
  {
    id: "beauty-care-nail-care-services-nc-ii",
    title: "Beauty Care (Nail Care) Services NC II",
    category: "Beauty & Garments",
    schools: 2,
    towns: {
      "Calapan City": 2
    },
    desc: "Manicure, pedicure, and hand and foot spa services for salons."
  },
  {
    id: "caregiving-nc-ii",
    title: "Caregiving NC II",
    category: "Healthcare",
    schools: 2,
    towns: {
      "Calapan City": 1,
      "Roxas": 1
    },
    desc: "Care for children, the elderly, and people with special needs: daily care, first aid, and household help."
  },
  {
    id: "contact-center-services-nc-ii",
    title: "Contact Center Services NC II",
    category: "Technology",
    schools: 2,
    towns: {
      "Calapan City": 2
    },
    desc: "Handle customer calls and chats for BPO companies, with English communication skills."
  },
  {
    id: "dressmaking-nc-ii",
    title: "Dressmaking NC II",
    category: "Beauty & Garments",
    schools: 2,
    towns: {
      "Calapan City": 1,
      "Bansud": 1
    },
    desc: "Draft patterns, cut, and sew women's and children's clothes."
  },
  {
    id: "electrical-installation-and-maintenance-nc-ii",
    title: "Electrical Installation and Maintenance NC II",
    category: "Construction",
    schools: 2,
    towns: {
      "Naujan": 1,
      "Bansud": 1
    },
    desc: "Install and maintain wiring, lighting, and electrical devices in houses and small buildings."
  },
  {
    id: "heavy-equipment-operation-forklift-nc-ii",
    title: "Heavy Equipment Operation (Forklift) NC II",
    category: "Construction",
    schools: 2,
    towns: {
      "Roxas": 1,
      "Calapan City": 1
    },
    desc: "Operate a forklift safely to move and stack loads in warehouses and ports."
  },
  {
    id: "heavy-equipment-operation-hydraulic-excavator-nc-ii",
    title: "Heavy Equipment Operation (Hydraulic Excavator) NC II",
    category: "Construction",
    schools: 2,
    towns: {
      "Bongabong": 1,
      "Victoria": 1
    },
    desc: "Operate a hydraulic excavator safely for digging, loading, and site work."
  },
  {
    id: "massage-therapy-nc-ii",
    title: "Massage Therapy NC II",
    category: "Healthcare",
    schools: 2,
    towns: {
      "Puerto Galera": 2
    },
    desc: "Give wellness massage, including traditional Filipino hilot, for spas and wellness centers."
  },
  {
    id: "plumbing-nc-ii",
    title: "Plumbing NC II",
    category: "Construction",
    schools: 2,
    towns: {
      "Calapan City": 2
    },
    desc: "Install and maintain water supply, drainage, and sanitary plumbing systems in buildings."
  }
]

/** Official TESDA page listing the registered schools in Oriental Mindoro that offer this course. */
export function enrollUrl(course) {
  // A course saved in the database with its own secure link (TESDA or another provider) uses that link
  if (course?.url && /^https:\/\/[^\s"'<>]+$/i.test(course.url)) return course.url
  const qs = new URLSearchParams({ SearchCourse: course?.qualification || course?.title || '', SearchIns: '', SearchLoc: 'oriental mindoro' })
  return `${TESDA_TVI_SEARCH}?${qs}`
}

/** Towns offering the course, most schools first: "Calapan City (7), Roxas (4) +5 more". */
export function townsLabel(course, max = 3) {
  const entries = Object.entries(course?.towns || {})
  if (!entries.length) return course?.location || 'Oriental Mindoro'
  const shown = entries.slice(0, max).map(([t, n]) => `${t} (${n})`).join(', ')
  return entries.length > max ? `${shown} +${entries.length - max} more` : shown
}

/**
 * The bundled TESDA catalog plus any courses the API returns (added by admins),
 * without duplicates. API rows keep their own https link if they have one.
 */
export function mergeCourses(apiRows = []) {
  const seen = new Set(TESDA_COURSES.map(c => c.title.toLowerCase()))
  const extra = (apiRows || [])
    .filter(c => c?.title && !seen.has(String(c.title).toLowerCase()))
    .map(c => ({ ...c, id: `db-${c.id}`, desc: c.desc || c.description || '', towns: c.location ? { [c.location]: 1 } : {}, schools: null }))
  return [...TESDA_COURSES, ...extra]
}

// ── Skill gap → TESDA course ─────────────────────────────────
// Job posts use everyday words ("welder", "cook", "wiring"); TESDA uses qualification
// names. Each keyword points to the course id(s) that teach it, best first.
const SKILL_KEYWORDS = [
  [/weld|smaw|arc\b|fabricat/, ['shielded-metal-arc-welding-smaw-nc-ii', 'shielded-metal-arc-welding-smaw-nc-i']],
  [/carpent|formwork|woodwork|furniture/, ['carpentry-nc-ii']],
  [/mason|hollow block|concret|plaster/, ['masonry-nc-ii', 'masonry-nc-i']],
  [/tile|tiling/, ['tile-setting-nc-ii']],
  [/plumb|pipe/, ['plumbing-nc-ii', 'plumbing-nc-i']],
  [/paint/, ['construction-painting-nc-ii']],
  [/electric|wiring|wire|eim/, ['electrical-installation-and-maintenance-nc-ii']],
  [/electronic|appliance|repair.*(tv|radio)/, ['electronic-products-assembly-and-servicing-nc-ii']],
  [/excavat|backhoe/, ['heavy-equipment-operation-hydraulic-excavator-nc-ii']],
  [/forklift/, ['heavy-equipment-operation-forklift-nc-ii']],
  [/driv|chauffeur/, ['driving-nc-ii']],
  [/motorcycle|small engine/, ['motorcycle-small-engine-servicing-nc-ii']],
  [/mechanic|automotive|auto repair|car repair|chassis/, ['automotive-servicing-nc-i', 'automotive-servicing-chassis-repair-nc-ii']],
  [/computer|hardware|it support|technician|network|pc /, ['computer-systems-servicing-nc-ii']],
  [/call center|bpo|customer service|csr/, ['contact-center-services-nc-ii']],
  [/bookkeep|accounting|payroll/, ['bookkeeping-nc-iii']],
  [/bak|bread|pastry/, ['bread-and-pastry-production-nc-ii']],
  [/cook|chef|kitchen|food prep/, ['cookery-nc-ii']],
  [/waiter|waitress|food and beverage|f&b|server|service crew/, ['food-and-beverage-services-nc-ii']],
  [/bartend/, ['bartending-nc-ii']],
  [/barista|coffee/, ['barista-nc-ii']],
  [/housekeep|room attendant|cleaning|janitor/, ['housekeeping-nc-ii']],
  [/front desk|front office|reception/, ['front-office-services-nc-ii']],
  [/event/, ['events-management-services-nc-iii']],
  [/caregiv|elderly|nanny|yaya/, ['caregiving-elderly-nc-ii', 'caregiving-nc-ii']],
  [/health care|nursing aide|patient care|first aid/, ['health-care-services-nc-ii']],
  [/massage|hilot|spa/, ['massage-therapy-nc-ii']],
  [/dressmak|sewing|tailor|seamstress/, ['dressmaking-nc-ii']],
  [/nail|manicure|pedicure/, ['beauty-care-nail-care-services-nc-ii']],
  [/organic/, ['organic-agriculture-production-nc-ii']],
  [/farm|crop|agricult|vegetable|rice/, ['agricultural-crops-production-nc-ii', 'organic-agriculture-production-nc-ii']],
  [/swine|hog|pig/, ['animal-production-swine-nc-ii']],
  [/poultry|chicken|broiler|layer/, ['animal-production-poultry-chicken-nc-ii']],
]

/** TESDA courses (best first, at most `max`) that teach a skill a job asks for. */
export function coursesForSkill(skill, max = 2) {
  const s = ` ${String(skill || '').toLowerCase()} `
  const byId = new Map(TESDA_COURSES.map(c => [c.id, c]))
  const ids = []
  for (const [re, list] of SKILL_KEYWORDS) if (re.test(s)) ids.push(...list)
  // also any course whose title shares a whole word with the skill ("Bookkeeping", "Driving")
  const words = s.split(/[^a-z]+/).filter(w => w.length >= 4 && !['with', 'skills', 'basic', 'training', 'service', 'services', 'production', 'operation', 'management', 'repair'].includes(w))
  for (const c of TESDA_COURSES) if (words.some(w => c.title.toLowerCase().includes(w))) ids.push(c.id)
  return [...new Set(ids)].map(id => byId.get(id)).filter(Boolean).slice(0, max)
}
