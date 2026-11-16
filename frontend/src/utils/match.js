/**
 * match.js: the one match scale used everywhere (worker cards, job page, apply dialog,
 * employer applicants, client proposals). The same levels as the server
 * (backend/app/libraries/Job_matcher.php LEVELS), so a number never means two things.
 *
 *   Strong  75–100%  green  you have most of what the post asks for
 *   Good    50–74%   amber  a few requirements are missing
 *   Low      0–49%   red    several requirements are missing
 */
export const MATCH_LEVELS = [
  { key: 'strong', min: 75, label: 'Strong match', chip: 'green', hint: 'You have most of what this post asks for.' },
  { key: 'good',   min: 50, label: 'Good match',   chip: 'gold',  hint: 'A few requirements are missing.' },
  { key: 'low',    min: 0,  label: 'Low match',    chip: 'red',   hint: 'Several requirements are missing.' },
]

/** The level for a score: { key, min, label, chip, hint }. */
export function matchLevel(score) {
  const s = Number(score) || 0
  return MATCH_LEVELS.find(l => s >= l.min) || MATCH_LEVELS[MATCH_LEVELS.length - 1]
}

/** 'strong' | 'good' | 'low' */
export const matchKey = score => matchLevel(score).key

/** The chip colour class for a score: 'green' | 'gold' | 'red' */
export const matchChip = score => matchLevel(score).chip
