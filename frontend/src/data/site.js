/**
 * Public contact details and policy versions, in one place. Every page reads them from here.
 * Before going live, set the team's real support details in frontend/.env (VITE_SUPPORT_*),
 * see docs/PUBLIC_READINESS.md.
 */
export const SITE = {
  name: 'hanapbuhay',
  region: 'Oriental Mindoro',
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL || 'support@hanapbuhay.app',
  privacyEmail: import.meta.env.VITE_PRIVACY_EMAIL || 'privacy@hanapbuhay.app',
  supportPhone: import.meta.env.VITE_SUPPORT_PHONE || '',
  address: import.meta.env.VITE_SUPPORT_ADDRESS || 'Calapan City, Oriental Mindoro, Philippines',
  hours: 'Monday to Friday, 8:00 AM to 5:00 PM (Philippine time)',
  dpo: import.meta.env.VITE_DPO_NAME || 'Data Protection Officer, hanapbuhay team',
}

/** Must match backend AuthController::TERMS_VERSION and PRIVACY_VERSION. */
export const TERMS_VERSION = '2026-11-16'
export const PRIVACY_VERSION = '2026-11-16'
export const POLICY_DATE = 'November 16, 2026'

/** Government offices people in the province already use (shown where it helps). */
export const PARTNER_OFFICES = [
  { name: 'PESO Oriental Mindoro (Provincial Public Employment Service Office)', what: 'Job fairs, referrals and employment help', where: 'Provincial Capitol, Calapan City' },
  { name: 'TESDA Oriental Mindoro Provincial Office', what: 'Free skills training, assessment and National Certificates (NC)', where: 'Calapan City' },
  { name: 'DOLE MIMAROPA, Oriental Mindoro Field Office', what: 'Labor standards, complaints and livelihood programs', where: 'Calapan City' },
  { name: 'Municipal PESO desks', what: 'Local job postings and referrals', where: 'Your municipal hall' },
]
