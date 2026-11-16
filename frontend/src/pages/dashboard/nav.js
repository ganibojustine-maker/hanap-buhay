/**
 * nav.js — the one place the dashboard's structure is described.
 *
 * The sidebar used to list every page: fifteen entries for a worker, three of which were
 * different views of the same job list and two of which opened the same Skills Passport.
 * Pages that belong together are one **section** now, and the views inside a section are
 * **tabs** on that section's header — the pattern people already know from GitHub, Gmail
 * and LinkedIn. A worker sees six places to go instead of fifteen.
 *
 * Nothing moved on disk: every route still exists at the same URL, so old links, emails
 * and notifications keep working. Only the way they are presented changed.
 *
 * Shape:
 *   id       stable key
 *   to       where the sidebar entry goes (the first tab)
 *   icon     sidebar icon
 *   label    sidebar label
 *   title    page heading once you are inside (defaults to label)
 *   lede     one short line under the heading; omit when the page is self-evident
 *   tabs     [{ to, label }] — rendered as the section's tab strip when there is >1
 *   paths    extra routes that still count as "inside this section" (detail pages)
 *   action   { to | href, label } — one button on the right of the header
 *   foot     render in the sidebar footer instead of the main list
 *   badge    key into the badge counts the shell passes down
 */
import {
  IconHome, IconSpark, IconBriefcase, IconShield, IconBook, IconMsgCircle,
  IconUsers, IconSettings, IconHelp, IconAlert, IconSearch, IconMap,
  IconStar, IconBuilding, IconUser, IconHandshake, IconCard, IconBadge, IconFile,
} from '../../components/icons.jsx'

/**
 * Every role has its own sidebar, routes and pages. Messages has its own address per role
 * (/dashboard/worker/messages, /dashboard/employer/messages, /dashboard/client/messages,
 * /dashboard/admin/messages), so one person's chats can never show under another account.
 */
export const MESSAGES_PATH = {
  worker: '/dashboard/worker/messages', employer: '/dashboard/employer/messages',
  hirer: '/dashboard/client/messages', admin: '/dashboard/admin/messages',
}
export const PLAN_PATH = { employer: '/dashboard/plans', hirer: '/dashboard/pass' }

const FIND_JOBS_TABS = [
  { to: '/dashboard/matches', label: 'For you' },
  { to: '/dashboard/browse',  label: 'Search' },
  { to: '/dashboard/map',     label: 'Map' },
  { to: '/dashboard/saved',   label: 'Saved' },
]

// exact: the first tab is the parent of the others, so it is only "on" at its own URL
const PASSPORT_TABS = [
  { to: '/dashboard/passport',              label: 'Skills', exact: true },
  { to: '/dashboard/passport/certificates', label: 'Certificates' },
  { to: '/dashboard/passport/work',         label: 'Work photos' },
  { to: '/dashboard/resume',                label: 'Resume' },
]

// Gigs are three places, not one crowded tab strip: finding gigs, the gig work you have
// (proposals sent and contracts running), and the services you sell
const WORKER_GIG_FIND_TABS = [
  { to: '/dashboard/gigs',     label: 'List', exact: true },
  { to: '/dashboard/gigs/map', label: 'Map' },
]
const WORKER_GIG_WORK_TABS = [
  { to: '/dashboard/gigs/proposals', label: 'Proposals' },
  { to: '/dashboard/gigs/contracts', label: 'Contracts' },
]

const peopleTabs = role => [
  { to: MESSAGES_PATH[role], label: 'Chats' },
  { to: '/dashboard/network', label: 'My network' },
]

const TALENT_TABS = [
  { to: '/dashboard/talent',       label: 'Search', exact: true },
  { to: '/dashboard/talent/saved', label: 'Saved workers' },
]

const CLIENT_TALENT_TABS = [
  { to: '/dashboard/talent',          label: 'Workers', exact: true },
  { to: '/dashboard/talent/services', label: 'Services' },
  { to: '/dashboard/talent/saved',    label: 'Saved talent' },
]

const JOB_BOARD_TABS = [
  { to: '/dashboard/browse',   label: 'Job board' },
  { to: '/dashboard/map',      label: 'Map' },
  { to: '/dashboard/training', label: 'Training' },
]

const ADMIN_MOD_TABS = [
  { to: '/dashboard/reports', label: 'Reported posts' },
  { to: '/dashboard/verify',  label: 'Verification' },
  { to: '/dashboard/reviews', label: 'Reviews' },
]

const ADMIN_GIG_TABS = [
  { to: '/dashboard/disputes',          label: 'Disputes' },
  { to: '/dashboard/gig-contracts',     label: 'Contracts' },
  { to: '/dashboard/hiring-monitor',    label: 'Job applications' },
]

const SUPPORT = { id: 'support', to: '/dashboard/support', icon: IconHelp, label: 'Help & Support', title: 'Help & Support', lede: 'Questions or problems? Send a request and our team answers you here.', badge: 'support', foot: true }
const SETTINGS = { id: 'settings', to: '/dashboard/settings', icon: IconSettings, label: 'Settings', title: 'Account Settings', lede: 'What we email you about, your password, and your account.', foot: true }
const VERIFY = lede => ({ id: 'verify', to: '/dashboard/verification', icon: IconBadge, label: 'Verification', title: 'Verification', lede, foot: true })

/*
 * The worker's sidebar, in groups (group = the small heading above the rows):
 *   Dashboard
 *   JOBS        Find jobs · My applications
 *   GIGS        Find gigs · My gig work · My services
 *   MY PROFILE  Skills Passport · Training
 *   Messages
 * Jobs and gigs never share a page: jobs are long-term work with an employer, gigs are
 * short paid tasks for a client, and each has its own way to apply.
 */
export const WORKER_SECTIONS = [
  { id: 'home', to: '/dashboard', icon: IconHome, label: 'Dashboard', title: 'Dashboard' },
  {
    id: 'find', group: 'Jobs', to: '/dashboard/matches', icon: IconSpark, label: 'Find jobs',
    title: 'Find jobs',
    lede: 'Jobs with employers across Oriental Mindoro, scored against your Skills Passport.',
    tabs: FIND_JOBS_TABS, paths: ['/dashboard/browse'],
  },
  {
    id: 'applied', group: 'Jobs', to: '/dashboard/applied', icon: IconBriefcase, label: 'My applications', title: 'My applications',
    lede: 'Every job you applied for, and where each one stands.',
    action: { to: '/dashboard/browse', label: 'Find more jobs', icon: 'search' },
  },
  {
    id: 'gigs', group: 'Gigs', to: '/dashboard/gigs', icon: IconHandshake, label: 'Find gigs', title: 'Find gigs',
    lede: 'Short paid tasks from clients near you. Send your price, do the work, get paid and reviewed.',
    tabs: WORKER_GIG_FIND_TABS,
  },
  {
    id: 'gigwork', group: 'Gigs', to: '/dashboard/gigs/proposals', icon: IconFile, label: 'My gig work', title: 'My gig work',
    lede: 'Proposals you sent and the gigs you are working on.',
    tabs: WORKER_GIG_WORK_TABS,
  },
  {
    id: 'services', group: 'Gigs', to: '/dashboard/gigs/services', icon: IconCard, label: 'My services', title: 'My services',
    lede: 'Services clients can book from you directly, with your photos and prices.',
  },
  {
    id: 'passport', group: 'My profile', to: '/dashboard/passport', icon: IconShield, label: 'Skills Passport',
    title: 'Skills Passport',
    lede: 'What employers and clients see: your skills, the proof behind them, and your resume.',
    tabs: PASSPORT_TABS, paths: ['/dashboard/resume'],
  },
  {
    id: 'training', group: 'My profile', to: '/dashboard/training', icon: IconBook, label: 'Training', title: 'Training & courses',
    lede: 'Free TESDA courses in Oriental Mindoro. The ones that close your skill gaps come first.',
    action: { href: 'https://e-tesda.gov.ph/', label: 'Free online courses (e-TESDA)' },
  },
  { id: 'people', to: MESSAGES_PATH.worker, icon: IconMsgCircle, label: 'Messages', title: 'Messages', tabs: peopleTabs('worker') },
  VERIFY('Get the Verified badge so employers and clients trust your profile.'),
  SUPPORT, SETTINGS,
]

export const EMPLOYER_SECTIONS = [
  { id: 'home', to: '/dashboard', icon: IconHome, label: 'Dashboard', title: 'Dashboard' },
  {
    id: 'jobs', to: '/dashboard/jobs', icon: IconBriefcase, label: 'My Job Posts', title: 'My Job Posts', paths: ['/dashboard/jobs/new'],
    lede: 'Your job posts, who applied, and which ones are still open.',
  },
  {
    id: 'applicants', to: '/dashboard/applicants', icon: IconUsers, label: 'Applicants', title: 'Applicants',
    lede: 'Review applicants, move them through your hiring steps, schedule interviews and send job offers.',
  },
  {
    id: 'talent', to: '/dashboard/talent', icon: IconSearch, label: 'Find Workers', title: 'Find Workers',
    lede: 'Search the Skills Passports of workers across Oriental Mindoro, save the good ones, and invite them to apply.',
    tabs: TALENT_TABS,
  },
  { id: 'people', to: MESSAGES_PATH.employer, icon: IconMsgCircle, label: 'Messages', title: 'Messages', tabs: peopleTabs('employer') },
  { id: 'plan', to: PLAN_PATH.employer, icon: IconCard, label: 'Hiring Plans', title: 'Hiring Plans',
    lede: 'Your plan, what is left on it, payments and receipts. Plans never charge you by themselves.' },
  VERIFY('Verify your business so your job posts go live right away and show the Verified business badge.'),
  SUPPORT, SETTINGS,
]

export const HIRER_SECTIONS = [
  { id: 'home', to: '/dashboard', icon: IconHome, label: 'Dashboard', title: 'Dashboard' },
  {
    id: 'gigs', to: '/dashboard/gigs', icon: IconBriefcase, label: 'My Gigs', title: 'My Gigs', paths: ['/dashboard/gigs/new'],
    lede: 'The work you posted, how many proposals each gig has, and which ones are still open.',
  },
  {
    id: 'proposals', to: '/dashboard/proposals', icon: IconFile, label: 'Proposals', title: 'Proposals',
    lede: 'Compare prices, delivery times and match scores side by side, then hire the best fit.',
  },
  {
    id: 'contracts', to: '/dashboard/contracts', icon: IconHandshake, label: 'Contracts', title: 'Contracts',
    lede: 'Work in progress: milestones, deliveries, changes, payment and reviews.',
  },
  {
    id: 'talent', to: '/dashboard/talent', icon: IconSearch, label: 'Find Talent', title: 'Find Talent',
    lede: 'Browse skilled workers and the services they offer across Oriental Mindoro.',
    tabs: CLIENT_TALENT_TABS,
  },
  { id: 'people', to: MESSAGES_PATH.hirer, icon: IconMsgCircle, label: 'Messages', title: 'Messages', tabs: peopleTabs('hirer') },
  { id: 'plan', to: PLAN_PATH.hirer, icon: IconCard, label: 'Service Buyer Pass', title: 'Service Buyer Pass',
    lede: 'Your pass, what is left on it, payments and receipts. Passes never charge you by themselves.' },
  VERIFY('Verify your identity so your gigs go live right away and workers trust your offers.'),
  SUPPORT, SETTINGS,
]

export const ADMIN_SECTIONS = [
  { id: 'home', to: '/dashboard', icon: IconHome, label: 'Overview', title: 'Overview' },
  { id: 'users', to: '/dashboard/users', icon: IconUsers, label: 'Users', title: 'User Management', lede: 'Search, moderate and manage every account.' },
  { id: 'jobs', to: '/dashboard/jobs', icon: IconBriefcase, label: 'Posts', title: 'Post Moderation', lede: 'Every job and gig, including posts waiting for review.' },
  { id: 'moderation', to: '/dashboard/reports', icon: IconAlert, label: 'Moderation', title: 'Moderation', tabs: ADMIN_MOD_TABS },
  { id: 'gigs', to: '/dashboard/disputes', icon: IconHandshake, label: 'Hiring & Gigs', title: 'Hiring & Gigs', tabs: ADMIN_GIG_TABS,
    lede: 'Monitor job applications and gig contracts, and resolve disputes.' },
  { id: 'payments', to: '/dashboard/payments', icon: IconCard, label: 'Payments', title: 'Payments & Revenue', lede: 'Every PayMongo payment, refunds and revenue.' },
  { id: 'support', to: '/dashboard/support', icon: IconHelp, label: 'Support Inbox', title: 'Support Inbox', lede: 'Help requests from workers, employers and clients. Replies reach them in-app and by email.', badge: 'support' },
  {
    id: 'board', to: '/dashboard/browse', icon: IconMap, label: 'Live Site',
    title: 'The live site',
    lede: 'The job board, map and course list exactly as the public sees them.',
    tabs: JOB_BOARD_TABS,
  },
  { id: 'people', to: MESSAGES_PATH.admin, icon: IconMsgCircle, label: 'Messages', title: 'Messages', foot: true },
  SETTINGS,
]

export function roleOf(user) {
  if (user?.role === 'admin') return 'admin'
  return user?.account_type || 'worker'
}

export function sectionsFor(user) {
  const r = roleOf(user)
  if (r === 'admin') return ADMIN_SECTIONS
  if (r === 'hirer') return HIRER_SECTIONS
  if (r === 'employer') return EMPLOYER_SECTIONS
  return WORKER_SECTIONS
}

/** Every route a section owns, so one sidebar entry can stay lit across its tabs. */
function routesOf(section) {
  return [section.to, ...(section.tabs || []).map(t => t.to), ...(section.paths || [])]
}

/**
 * Which section a path belongs to. The longest matching route wins, so
 * /dashboard/jobs/12/edit resolves to the Job Posts section and not to /dashboard.
 */
export function sectionFor(sections, pathname) {
  let best = null
  let bestLen = -1
  for (const s of sections) {
    for (const r of routesOf(s)) {
      // "/dashboard" is the overview, not the parent of everything under it —
      // without this guard it would claim /dashboard/profile and light up Home.
      const hit = pathname === r || (r !== '/dashboard' && pathname.startsWith(r + '/'))
      if (hit && r.length > bestLen) { best = s; bestLen = r.length }
    }
  }
  return best
}

/** Is this tab the one being shown? */
export function tabIsActive(tabTo, pathname, exact = false) {
  return pathname === tabTo || (!exact && pathname.startsWith(tabTo + '/'))
}

/** The profile page for this account — reached from the name at the top, not a nav row. */
export function profileMeta(user) {
  if (user?.role === 'admin') return { to: '/dashboard/profile', label: 'Admin profile', icon: IconUser, title: 'Admin Profile' }
  if (user?.account_type === 'employer') return { to: '/dashboard/profile', label: 'Business profile', icon: IconBuilding, title: 'Business Profile' }
  if (user?.account_type === 'hirer') return { to: '/dashboard/profile', label: 'Client profile', icon: IconBuilding, title: 'Client Profile' }
  return { to: '/dashboard/profile', label: 'My profile', icon: IconUser, title: 'My Profile' }
}

/**
 * Pages reached from the account menu rather than the sidebar — things you open now and
 * then, about yourself. Admins moderate reviews under Moderation, so they do not get this.
 */
export const accountLinks = (user) => (
  user?.role === 'admin' ? [] : [{ to: '/dashboard/reviews', label: 'Ratings & reviews', icon: IconStar }]
)

/**
 * Pages that are a thing, not a place: one job, one applicant, one person, the post-a-job
 * form. They carry their own heading and a way back, so the section header stays out.
 */
const DETAIL_ROUTES = [
  /^\/dashboard\/gigs\/contracts\/\d+$/,
  /^\/dashboard\/gigs\/services\/\d+$/,
  /^\/dashboard\/talent\/services\/\d+$/,
  /^\/dashboard\/contracts\/\d+$/,
  /^\/dashboard\/gigs\/new$/,
  /^\/dashboard\/gigs\/\d+(\/edit)?$/,
  /^\/dashboard\/browse\/[^/]+$/,
  /^\/dashboard\/people\/[^/]+$/,
  /^\/dashboard\/talent\/\d+$/,
  /^\/dashboard\/jobs\/new$/,
  /^\/dashboard\/jobs\/[^/]+\/edit$/,
]

export const isDetailRoute = pathname => DETAIL_ROUTES.some(re => re.test(pathname))

/**
 * What the shared page header should show, or null.
 *
 * Only a section with more than one view gets one. A page that is the whole section keeps
 * the heading it already has — adding a second one above it is exactly the duplication
 * this file exists to remove.
 */
export function headerFor(sections, pathname, user) {
  if (isDetailRoute(pathname)) return null
  // pages reached from the account menu, not the sidebar
  if (pathname === '/dashboard/profile') {
    const m = profileMeta(user)
    return { id: 'profile', title: m.title, lede: PROFILE_LEDE[user?.role === 'admin' ? 'admin' : user?.account_type] || PROFILE_LEDE.worker }
  }
  if (pathname === '/dashboard/reviews') {
    return { id: 'reviews', title: 'Ratings & Reviews', lede: 'Ratings only exist after a real hire through hanapbuhay.' }
  }
  const section = sectionFor(sections, pathname)
  // the home page opens with its own greeting instead
  if (!section || section.id === 'home') return null
  return {
    id: section.id,
    title: section.title || section.label,
    lede: section.lede,
    tabs: (section.tabs || []).length > 1 ? section.tabs : null,
    action: section.action || null,
  }
}

const PROFILE_LEDE = {
  worker: 'Your details, availability and resume. Employers see this when you apply.',
  employer: 'Your business details and hiring contact, as workers see them.',
  hirer: 'Your details, as the workers you hire see them.',
  admin: 'Your administrator account.',
}
