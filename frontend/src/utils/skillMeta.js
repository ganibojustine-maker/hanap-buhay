/**
 * skillMeta.js — what the Skills Passport dropdowns actually mean.
 *
 * "Beginner / Intermediate / Advanced / Expert" and "Self / TESDA / Employer / Training"
 * were bare words before, so two people filling the same form meant different things and
 * the match score was built on guesses. Each option now carries the plain sentence that
 * decides it, shown under the dropdown and in the option list, in English and Filipino.
 *
 * The ids are exactly what the database stores (skills_passport.level / .source), so
 * nothing here changes the schema.
 */

export const SKILL_LEVELS = [
  {
    id: 'beginner',
    label: 'Beginner',
    tl: 'Nagsisimula',
    short: 'Under supervision',
    desc: 'You have done it a few times, with someone guiding you. You still need to be shown.',
    years: 'Less than 1 year',
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    tl: 'May karanasan',
    short: 'On your own',
    desc: 'You can do the usual work on your own without being watched, and ask only when something is unusual.',
    years: 'About 1–2 years',
  },
  {
    id: 'advanced',
    label: 'Advanced',
    tl: 'Bihasa',
    short: 'Handles hard jobs',
    desc: 'You handle the difficult jobs, fix your own mistakes, and others ask you when they are stuck.',
    years: 'About 3–5 years',
  },
  {
    id: 'expert',
    label: 'Expert',
    tl: 'Dalubhasa',
    short: 'Teaches others',
    desc: 'You lead or train other workers in this, and you are trusted to judge whether work is done right.',
    years: '5 years or more',
  },
]

export const SKILL_SOURCES = [
  {
    id: 'tesda',
    label: 'TESDA certificate',
    tl: 'TESDA',
    short: 'NC / COC',
    desc: 'You hold a TESDA National Certificate (NC) or Certificate of Competency. Upload it — a verified TESDA certificate counts the most in job matching.',
    weight: 'Highest',
  },
  {
    id: 'employer',
    label: 'Proven at work',
    tl: 'Patunay ng employer',
    short: 'Work history',
    desc: 'You were paid to do this for an employer or client. A certificate of employment or a reference is good proof.',
    weight: 'High',
  },
  {
    id: 'training',
    label: 'Training or seminar',
    tl: 'Pagsasanay',
    short: 'Course attended',
    desc: 'You finished a course, seminar or apprenticeship that was not TESDA — e.g. a company training or an online course.',
    weight: 'Medium',
  },
  {
    id: 'self',
    label: 'Self-taught',
    tl: 'Sarili kong natutunan',
    short: 'No paper yet',
    desc: 'You learned it on your own or at home and have no certificate yet. Still worth listing — it just counts for less until it is proven.',
    weight: 'Lower',
  },
  {
    id: 'other',
    label: 'Other',
    tl: 'Iba pa',
    short: 'Something else',
    desc: 'Anything that does not fit the choices above. Add a note in the certificate field so employers understand.',
    weight: 'Lower',
  },
]

export const NC_LEVELS = [
  { id: 'I', label: 'NC I', desc: 'Entry level. Routine work, closely supervised — assistant or helper roles.' },
  { id: 'II', label: 'NC II', desc: 'The level most job posts ask for. You can work on your own on standard tasks.' },
  { id: 'III', label: 'NC III', desc: 'Complex work and some supervision. Lead a small crew or handle non-routine jobs.' },
  { id: 'IV', label: 'NC IV', desc: 'Specialist and supervisory work, including planning and checking others\' output.' },
]

export const byId = (list, id) => list.find(x => x.id === id) || null

/** The matching NC level for a skill level, used when a certificate fills the form. */
export const NC_TO_LEVEL = { I: 'beginner', II: 'intermediate', III: 'advanced', IV: 'expert' }

/**
 * What to show under a dropdown once something is chosen. Falls back to a prompt,
 * so the help text is never an empty gap in the layout.
 */
export function hintFor(list, id, prompt) {
  const found = byId(list, id)
  return found ? found.desc : prompt
}
