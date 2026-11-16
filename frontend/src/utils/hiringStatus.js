/**
 * The employer hiring pipeline, as people read it (same list: backend libraries/Hiring_status.php).
 *
 *   Submitted → Under Review → Shortlisted → Interview Scheduled → Interviewed → Job Offer → Hired
 *   Not Selected (any open step) · Withdrawn (by the applicant)
 *
 * Stored values keep their old names: pending = Submitted, reviewed = Under Review,
 * for_interview = Interview Scheduled, rejected = Not Selected.
 */
export const PIPELINE = ['pending', 'reviewed', 'shortlisted', 'for_interview', 'interviewed', 'offer', 'hired']
export const FINAL = ['hired', 'rejected', 'withdrawn']

export const STATUS = {
  pending:       { label: 'Submitted',           tone: 'navy',  worker: 'Your application was sent. The employer has not opened it yet.', employer: 'New: you have not opened it yet.' },
  reviewed:      { label: 'Under Review',        tone: 'navy',  worker: 'The employer is looking at your application.', employer: 'You opened this application.' },
  shortlisted:   { label: 'Shortlisted',         tone: 'gold',  worker: 'You made the shortlist. The employer may invite you to an interview.', employer: 'On your shortlist.' },
  for_interview: { label: 'Interview Scheduled', tone: 'blue',  worker: 'You are invited to an interview. Check the date, time and place.', employer: 'Interview is set.' },
  interviewed:   { label: 'Interviewed',         tone: 'blue',  worker: 'Your interview is done. The employer is making a decision.', employer: 'Interview done. Decide the next step.' },
  offer:         { label: 'Job Offer',           tone: 'gold',  worker: 'The employer is offering you the job. Accept or decline the offer.', employer: 'Offer sent. Waiting for the applicant to answer.' },
  hired:         { label: 'Hired',               tone: 'green', worker: 'You got the job. The employer will contact you about your start date.', employer: 'Hired.' },
  rejected:      { label: 'Not Selected',        tone: 'red',   worker: 'The employer chose another applicant this time.', employer: 'Not selected.' },
  withdrawn:     { label: 'Withdrawn',           tone: '',      worker: 'You took back this application.', employer: 'The applicant withdrew.' },
}

export const statusLabel = s => STATUS[s]?.label || String(s || '').replace(/_/g, ' ')
export const statusTone = s => STATUS[s]?.tone || ''

/** Moves an employer may make from a step (forward only; "rejected" from any open step). */
export function nextSteps(from) {
  if (FINAL.includes(from)) return []
  const i = PIPELINE.indexOf(from)
  const ahead = PIPELINE.slice(i + 1).filter(s => s !== 'reviewed')
  if (from === 'for_interview') ahead.unshift('for_interview') // reschedule
  return [...ahead, 'rejected']
}

/** Gig contract and proposal statuses (backend GigController). */
export const CONTRACT = {
  offered:            { label: 'Waiting for the worker', tone: 'gold' },
  active:             { label: 'In progress',            tone: 'blue' },
  delivered:          { label: 'Delivered',              tone: 'gold' },
  revision_requested: { label: 'Changes requested',      tone: 'gold' },
  completed:          { label: 'Completed',              tone: 'green' },
  cancelled:          { label: 'Cancelled',              tone: '' },
  disputed:           { label: 'In dispute',             tone: 'red' },
}
export const PROPOSAL = {
  submitted:    { label: 'Sent',         tone: 'navy' },
  shortlisted:  { label: 'Shortlisted',  tone: 'gold' },
  hired:        { label: 'Hired',        tone: 'green' },
  declined:     { label: 'Declined',     tone: 'red' },
  not_selected: { label: 'Not selected', tone: '' },
  withdrawn:    { label: 'Withdrawn',    tone: '' },
}
export const PAYMENT_STATUS = { unpaid: 'Not paid yet', sent: 'Client says paid', confirmed: 'Payment received' }
