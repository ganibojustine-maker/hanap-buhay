/**
 * Public information pages: Terms of Service, Privacy Policy (Data Privacy Act of 2012,
 * RA 10173), About, Help & Contact, FAQ, and the "page not found" screen.
 *
 * The policy texts must be reviewed by the team's adviser or a lawyer before the site goes
 * live (docs/PUBLIC_READINESS.md). When either text changes, update TERMS_VERSION /
 * PRIVACY_VERSION here (data/site.js) and in the backend, and everyone is asked to agree again.
 */
import { Link } from 'react-router-dom'
import { SiteHeader, SiteFooter } from '../components/SiteHeader.jsx'
import { IconMail, IconPhone, IconPin, IconClock, IconShield, IconArrow } from '../components/icons.jsx'
import { SITE, POLICY_DATE, PARTNER_OFFICES, TERMS_VERSION, PRIVACY_VERSION } from '../data/site.js'
import '../styles/platform.css'

function InfoLayout({ eyebrow, title, lede, children }) {
  return (
    <div className="lp" style={{ background: 'var(--bg)' }}>
      <SiteHeader />
      <main className="pf-info">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}

function LegalBody({ children }) {
  return (
    <article className="panel legal" style={{ padding: 'clamp(20px, 4vw, 34px)' }}>
      <div className="legal-body">{children}</div>
      <style>{`
        .legal-body h2 { font-size: 17px; margin: 26px 0 8px; letter-spacing: -.01em; scroll-margin-top: 80px }
        .legal-body h2:first-child { margin-top: 0 }
        .legal-body p, .legal-body li { font-size: 14.5px; line-height: 1.65; color: var(--text) }
        .legal-body p { margin: 0 0 10px }
        .legal-body ul { margin: 0 0 12px 20px; padding: 0 }
        .legal-body li { margin-bottom: 4px }
        .legal-body a { color: var(--blue) }
        .legal-body table { width: 100%; border-collapse: collapse; font-size: 14px; margin: 6px 0 14px }
        .legal-body th, .legal-body td { text-align: left; border-bottom: 1px solid var(--line); padding: 8px 6px; vertical-align: top }
      `}</style>
    </article>
  )
}

const Contact = () => (
  <>{SITE.supportEmail && <> <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a></>}{SITE.supportPhone ? ` or ${SITE.supportPhone}` : ''}</>
)

/* ─ Terms of Service ──────────────────────────────────── */
export function Terms() {
  return (
    <InfoLayout eyebrow="hanapbuhay Oriental Mindoro" title="Terms of Service" lede={`The rules for using hanapbuhay. Version ${TERMS_VERSION}, effective ${POLICY_DATE}.`}>
      <LegalBody>
        <h2>1. What hanapbuhay is</h2>
        <p>hanapbuhay is an online service that connects people looking for work in Oriental Mindoro with employers who hire staff (“jobs”) and with clients who need short, paid work done (“gigs”). We provide the tools: profiles, a Skills Passport, matching, applications, proposals, contracts, messaging, verification and paid plans. We are not the employer of any worker, and we are not an agent, recruiter or placement agency under the Labor Code.</p>

        <h2>2. Who may use it</h2>
        <ul>
          <li>You must be at least 18 years old, or at least 15 years old with written consent from a parent or guardian and only for work allowed for minors under Republic Act No. 9231. Employers must not offer work to minors that the law prohibits.</li>
          <li>You may hold one account per role. Give true, current information about yourself or your business.</li>
          <li>When you create an account you agree to these Terms and to our <Link to="/privacy">Privacy Policy</Link>. We record when you agreed and to which version, and ask again when they change.</li>
        </ul>

        <h2>3. Accounts and roles</h2>
        <ul>
          <li><b>Job seekers (workers)</b> build a profile and Skills Passport, apply to jobs, send proposals for gigs, and list services.</li>
          <li><b>Employers</b> post jobs, review applicants, schedule interviews and send job offers.</li>
          <li><b>Clients (service buyers)</b> post gigs, compare proposals, hire, manage contracts and book listed services.</li>
          <li>Keep your password secret. You are responsible for activity on your account. Tell us at once if you think someone else used it.</li>
        </ul>

        <h2>4. Matching and match scores</h2>
        <p>Match scores come from a fixed, published formula (skills, experience, certificates, distance and education). They help people decide; they are not a promise of a job or a guarantee of a worker’s quality. Employers and clients make their own hiring decisions and must not discriminate on the basis of sex, age, religion, ethnicity, disability, pregnancy, or other grounds protected by Philippine law.</p>

        <h2>5. Job posts and gigs</h2>
        <ul>
          <li>Posts must describe real work, the real pay or budget, and the real place of work.</li>
          <li><b>Never ask workers for money</b> to apply, to be hired, for training, uniforms, medical tests or “processing”. Posts that do are removed and the account may be suspended.</li>
          <li>Posts from unverified accounts are checked by our team before they go live. Every post has an end date and closes by itself; you can renew it.</li>
          <li>We may edit the category, hide, send back or take down a post that breaks these Terms, and we tell the poster why.</li>
        </ul>

        <h2>6. Hiring for jobs</h2>
        <p>The employer and the worker agree on the job between themselves. The employer must follow the Labor Code and other laws on wages, hours, benefits (SSS, PhilHealth, Pag-IBIG) and safe working conditions. hanapbuhay shows the hiring steps (Submitted, Under Review, Shortlisted, Interview Scheduled, Interviewed, Job Offer, Hired, Not Selected, Withdrawn) so both sides know where things stand.</p>

        <h2>7. Gigs, contracts and payment between users</h2>
        <ul>
          <li>When a client hires a worker from a proposal or books a service, a contract records the agreed price, due date, milestones and the number of rounds of changes.</li>
          <li><b>The client pays the worker directly</b> (cash, GCash, Maya, bank transfer). hanapbuhay does not hold, collect or release money between clients and workers. Both mark the payment in the contract so there is a record.</li>
          <li>A contract can be cancelled before the work is delivered. After delivery, problems go through a dispute.</li>
          <li>Pay only for work agreed in the contract, and keep messages in hanapbuhay so our team can help if something goes wrong.</li>
        </ul>

        <h2 id="disputes">8. Disputes</h2>
        <p>Either side of a contract can open a dispute. Our team reviews the contract, deliveries and messages, may ask both sides for their account, and usually decides within 2 working days whether the contract is complete, cancelled, or continues. Because we do not hold the money, our decision is a record for both sides and may affect accounts and reviews; it does not replace your right to go to the barangay, DOLE, the DTI or the courts.</p>

        <h2>9. Verification</h2>
        <p>Verification combines automatic checks (email, a code sent to your phone, profile completeness, the file, duplicate ID numbers, the name on the ID) with a review by our team of a government ID or, for employers, a business permit or registration. A Verified badge means we checked those documents. It is not a guarantee of anyone’s conduct. We may remove a badge if the information turns out to be false. Sending fake or someone else’s documents leads to suspension and may be reported to the authorities.</p>

        <h2 id="payments">10. Plans, payments and refunds</h2>
        <ul>
          <li>Employer plans and the client Service Buyer Pass are paid in advance through <b>PayMongo</b> with the methods shown at checkout (for example cards, GCash, Maya, QR Ph). We never see or store your full card number or e-wallet PIN.</li>
          <li>A plan starts or changes <b>only after PayMongo confirms the payment</b>. Prices are in Philippine pesos and include any taxes we are required to charge.</li>
          <li>Plans <b>do not renew or charge you automatically</b>. We remind you before a plan ends. Renewing the same plan early adds the new days on top.</li>
          <li>Upgrades start when paid. Switching to a cheaper plan or the free plan takes effect when the current plan ends. Cancelling stops reminders; the plan stays active until its end date.</li>
          <li><b>Refunds:</b> if you were charged twice, charged for a plan that did not switch on, or charged by mistake, contact us within 7 days. Approved refunds go back to the original payment method through PayMongo, usually within 5 to 10 banking days. A full refund ends the plan it paid for. Plans already used are otherwise not refundable, except where the law requires.</li>
        </ul>

        <h2>11. Messaging</h2>
        <p>Messages are for work on hanapbuhay. Do not send spam, threats, sexual content, requests for money, or links meant to steal information. We may review messages that are reported to us or flagged in a dispute.</p>

        <h2>12. Conduct, scams and fake postings</h2>
        <ul>
          <li>No fake profiles, fake jobs, pyramid or networking “jobs”, illegal work, human trafficking, or work abroad offers (overseas recruitment needs a DMW license and is not allowed here).</li>
          <li>No harassment, hate, discrimination, or sharing other people’s personal information.</li>
          <li>No reviews you were paid to write, or reviews of people you did not work with.</li>
          <li>Report suspicious posts or messages with the Report button or to our support team. We may share reports of crimes with the police or the NBI.</li>
        </ul>

        <h2>13. Suspension and closing accounts</h2>
        <p>We may warn, limit, suspend or close an account that breaks these Terms, puts others at risk, or uses false documents. We tell you the reason unless the law or an investigation prevents it, and you may ask us to review the decision. You may close your account at any time from Settings; some records are kept as the Privacy Policy explains.</p>

        <h2>14. Our responsibility</h2>
        <p>We work to keep hanapbuhay available, accurate and safe, but we cannot promise it will always be error-free or that every user is honest. To the extent the law allows, we are not liable for what users do or fail to do, including unpaid work, unsafe workplaces or lost income. Nothing here limits rights you have under the Consumer Act or other laws that cannot be waived.</p>

        <h2>15. Changes and governing law</h2>
        <p>We may update these Terms. We will tell you in the app and ask you to agree again before you continue. These Terms follow the laws of the Republic of the Philippines.</p>

        <h2>16. Contact</h2>
        <p>Questions about these Terms: <Contact />, {SITE.address}. See <Link to="/help">Help & contact</Link>.</p>
      </LegalBody>
    </InfoLayout>
  )
}

/* ─ Privacy Policy (RA 10173) ─────────────────────────── */
export function Privacy() {
  return (
    <InfoLayout eyebrow="hanapbuhay Oriental Mindoro" title="Privacy Policy" lede={`How we collect, use, share and protect your personal information under the Data Privacy Act of 2012 (Republic Act No. 10173). Version ${PRIVACY_VERSION}, effective ${POLICY_DATE}.`}>
      <LegalBody>
        <h2>1. Who is responsible for your data</h2>
        <p>The hanapbuhay team is the personal information controller for this service. Our Data Protection Officer is the {SITE.dpo}, reachable at <a href={`mailto:${SITE.privacyEmail}`}>{SITE.privacyEmail}</a>, {SITE.address}. We follow the Data Privacy Act of 2012, its Implementing Rules and Regulations, and the issuances of the National Privacy Commission (NPC).</p>

        <h2>2. What we collect</h2>
        <table>
          <thead><tr><th>Information</th><th>From whom</th></tr></thead>
          <tbody>
            <tr><td>Name, email, mobile number, password (stored only as a one-way hash), town and barangay, photo, short bio</td><td>Everyone</td></tr>
            <tr><td>Skills, skill levels, years of experience, education, resume details, work photos, training and certificates (including TESDA NC)</td><td>Job seekers</td></tr>
            <tr><td>Business name, registration or permit (DTI, SEC, CDA, Mayor’s permit, BIR 2303), job posts and hiring decisions</td><td>Employers</td></tr>
            <tr><td>Gigs, proposals, contracts, milestones, deliveries, payment confirmations and reviews</td><td>Clients and job seekers</td></tr>
            <tr><td>Government ID photo, ID number, name on the ID and an optional selfie, for verification</td><td>Job seekers and clients who choose to verify</td></tr>
            <tr><td>Chat messages</td><td>The people in each conversation</td></tr>
            <tr><td>Plan payments: amount, method type, PayMongo reference, receipt and refund status. Card numbers and e-wallet PINs are handled by PayMongo and never reach us.</td><td>Employers and clients who buy a plan</td></tr>
            <tr><td>Google account ID, name and email, if you sign in with Google</td><td>People who choose Google sign-in</td></tr>
            <tr><td>Device and usage data: IP address, browser, pages used, error logs</td><td>Everyone</td></tr>
          </tbody>
        </table>
        <p>We do not ask for sensitive personal information we do not need. Government ID numbers and education records are sensitive personal information under the law and are handled with the extra care described below.</p>

        <h2>3. Why we use it (and our legal basis)</h2>
        <ul>
          <li><b>To provide the service you signed up for</b> (contract): accounts, matching and match scores, applications, proposals, contracts, messaging, notifications and receipts.</li>
          <li><b>To verify identities and keep users safe</b> (legitimate interest and, for IDs, your consent): checking documents, preventing duplicate or fake accounts, investigating scams and disputes.</li>
          <li><b>To process payments and keep financial records</b> (contract and legal obligation, including tax rules).</li>
          <li><b>To send you updates</b>: status changes, interview reminders, payment results. You can turn off optional emails and texts in Settings.</li>
          <li><b>To improve hanapbuhay</b> using statistics that do not identify you.</li>
        </ul>
        <p>We do not sell your personal information and we do not use it for advertising by others.</p>

        <h2>4. Who sees it</h2>
        <ul>
          <li><b>The public</b> (not signed in) sees job and gig posts: title, poster name and verified badge, town and barangay, pay, type and date. Never your contact details or street address.</li>
          <li><b>Employers and clients</b> see a job seeker’s profile, Skills Passport and match score when the job seeker applies or sends a proposal, or when they search Find Workers. Contact details are shown only after an application or proposal, or when an employer uses a contact unlock.</li>
          <li><b>Job seekers</b> see the employer or client name, verified badge, rating and post details.</li>
          <li><b>Our verification and support team</b> sees ID and business documents, reports, disputes, and messages linked to a report or dispute, only as needed for that task.</li>
          <li><b>Service providers</b> who process data for us under written agreements: PayMongo (payments), Google Firebase (chat), Brevo (email), Semaphore (text messages), Aiven (database hosting) and Render (application hosting). Some store data outside the Philippines; we require them to protect it to the standard the law requires.</li>
          <li><b>Authorities</b>, when the law requires it or to report a crime such as fraud or trafficking.</li>
        </ul>

        <h2>5. How long we keep it</h2>
        <table>
          <thead><tr><th>Record</th><th>Kept for</th></tr></thead>
          <tbody>
            <tr><td>Account and profile</td><td>While your account is open; deleted or anonymized within 30 days after you close it</td></tr>
            <tr><td>ID photos and selfies for verification</td><td>Until the check is done plus 1 year (for disputes and repeated fraud), then deleted. Only the result and history are kept.</td></tr>
            <tr><td>Business documents</td><td>While the account is open, plus 1 year</td></tr>
            <tr><td>Applications, proposals, contracts and reviews</td><td>3 years after they end, for disputes and safety</td></tr>
            <tr><td>Payment and receipt records</td><td>10 years, as tax and accounting rules require</td></tr>
            <tr><td>Chat messages</td><td>Until either person deletes the account, or 3 years after the last message</td></tr>
            <tr><td>Security logs</td><td>Up to 1 year</td></tr>
          </tbody>
        </table>

        <h2>6. How we protect it</h2>
        <ul>
          <li>Encrypted connections (HTTPS) everywhere; the database requires encrypted connections.</li>
          <li>Passwords are stored as one-way hashes; sessions expire and can be signed out from every device.</li>
          <li>ID and business documents are only available to the account owner and authorized admins, are never shown publicly, and only the last four characters of an ID number are shown back to you.</li>
          <li>Each chat can be read only by its two people, enforced by database rules.</li>
          <li>Access by our team is limited to what each task needs, and decisions on verification are logged.</li>
          <li>If a breach puts your rights at risk, we will tell you and the NPC within 72 hours as the law requires.</li>
        </ul>

        <h2>7. Your rights</h2>
        <p>Under the Data Privacy Act you have the right to be informed, to access your data, to object, to correct it, to have it erased or blocked, to data portability, to withdraw consent, to damages, and to file a complaint. You can:</p>
        <ul>
          <li>See and correct most of your data yourself in Profile, Skills Passport and Settings.</li>
          <li>Download your resume and Skills Passport, or ask us for a copy of all your data.</li>
          <li>Close your account in Settings, which deletes your profile as described above.</li>
          <li>Withdraw consent for verification by asking us to delete your ID; your Verified badge is then removed.</li>
        </ul>
        <p>Email <a href={`mailto:${SITE.privacyEmail}`}>{SITE.privacyEmail}</a>. We answer within 15 working days. If you are not satisfied, you may complain to the National Privacy Commission at <a href="https://privacy.gov.ph" target="_blank" rel="noreferrer">privacy.gov.ph</a>.</p>

        <h2>8. Cookies and storage on your device</h2>
        <p>We do not use advertising or tracking cookies. Your browser stores only what the app needs: your sign-in session, language, and small settings like a dismissed notice. Signing out removes the account data from that device.</p>

        <h2>9. Children</h2>
        <p>hanapbuhay is not for children under 15. Job seekers aged 15 to 17 need a parent or guardian’s consent. If we learn we hold a child’s data without consent, we delete it.</p>

        <h2>10. Changes</h2>
        <p>We will tell you in the app when this policy changes and ask you to agree again before you continue.</p>
      </LegalBody>
    </InfoLayout>
  )
}

/* ─ About ─────────────────────────────────────────────── */
export function About() {
  return (
    <InfoLayout eyebrow="About us" title="Work for Oriental Mindoro, matched by skills" lede="hanapbuhay helps people across the province’s 15 towns find steady jobs and short paid gigs, and helps local businesses and households find the right person.">
      <div className="pf-grid2" style={{ marginBottom: 20 }}>
        <section className="panel"><h2 className="pf-h">For job seekers</h2><p className="pf-muted">Build a Skills Passport instead of a fancy resume. See how well you match each job, what you are missing, and the free TESDA course that closes the gap.</p></section>
        <section className="panel"><h2 className="pf-h">For employers</h2><p className="pf-muted">Post jobs, see applicants ranked by a transparent match score, schedule interviews and send offers. Verified businesses post instantly.</p></section>
        <section className="panel"><h2 className="pf-h">For clients</h2><p className="pf-muted">Post a gig or book a listed service. Compare proposals, agree on milestones, approve the work and leave a review.</p></section>
        <section className="panel"><h2 className="pf-h">Safe by design</h2><p className="pf-muted">Identity and business checks, posts reviewed before they go live, no fees ever charged to workers, and a team that handles reports and disputes.</p></section>
      </div>
      <section className="panel">
        <h2 className="pf-h">Offices that work alongside us</h2>
        <p className="pf-sub">hanapbuhay complements, not replaces, the public employment services in the province. These offices help with job fairs, training and labor concerns.</p>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8, fontSize: 14.5 }}>
          {PARTNER_OFFICES.map(o => <li key={o.name}><b>{o.name}</b>: {o.what}. <span className="pf-muted">{o.where}.</span></li>)}
        </ul>
        <p className="pf-small" style={{ marginTop: 12 }}>Listing an office here does not mean it endorses hanapbuhay.</p>
      </section>
    </InfoLayout>
  )
}

/* ─ Help & Contact ────────────────────────────────────── */
export function Help() {
  return (
    <InfoLayout eyebrow="Help & contact" title="How can we help?" lede="Most answers are in the FAQ. Signed in? Use Help & Support in your dashboard so we can see your account and reply in the app.">
      <div className="pf-grid2">
        <section className="panel">
          <h2 className="pf-h">Contact our support team</h2>
          <dl className="pf-kv" style={{ marginTop: 10 }}>
            <dt><IconMail size={14} /> Email</dt><dd><a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a></dd>
            {SITE.supportPhone && <><dt><IconPhone size={14} /> Phone</dt><dd>{SITE.supportPhone}</dd></>}
            <dt><IconPin size={14} /> Address</dt><dd>{SITE.address}</dd>
            <dt><IconClock size={14} /> Hours</dt><dd>{SITE.hours}</dd>
          </dl>
          <div className="pf-actions"><Link to="/login" state={{ from: '/dashboard/support' }} className="btn btn-primary">Send a request from your account</Link></div>
        </section>
        <section className="panel">
          <h2 className="pf-h"><IconShield size={16} /> Report a scam or fake post</h2>
          <p className="pf-muted">Never pay anyone to get a job or gig. If someone asks for a fee, your OTP, or personal documents outside the app, press Report on the post or email us right away. For crimes, also report to the PNP Anti-Cybercrime Group or the NBI Cybercrime Division, or your nearest police station.</p>
          <h2 className="pf-h" style={{ marginTop: 16 }}>Privacy requests</h2>
          <p className="pf-muted">Ask for a copy of your data or its deletion at <a href={`mailto:${SITE.privacyEmail}`}>{SITE.privacyEmail}</a>.</p>
        </section>
      </div>
      <p style={{ marginTop: 18 }}><Link to="/faq">Read the FAQ <IconArrow size={13} /></Link></p>
    </InfoLayout>
  )
}

/* ─ FAQ ───────────────────────────────────────────────── */
const FAQS = [
  ['Getting started', [
    ['Is hanapbuhay free for job seekers?', 'Yes, always. Workers never pay to apply, send proposals, train or get hired. Report anyone who asks you for money.'],
    ['Which towns are covered?', 'All 15 towns of Oriental Mindoro: Baco, Bansud, Bongabong, Bulalacao, Calapan City, Gloria, Mansalay, Naujan, Pinamalayan, Pola, Puerto Galera, Roxas, San Teodoro, Socorro and Victoria.'],
    ['What is the difference between a job and a gig?', 'A job is a position at a business: you apply, may be interviewed, and get hired. A gig is short, priced work for a client, like a repair: you send a proposal with your price, do the work, and get paid when it is approved.'],
  ]],
  ['Matching', [
    ['How is my match score counted?', 'A fixed formula out of 100: skills 45, experience 15, certificates 15, distance 15, education 10. Requirements a job does not ask for count as met. Open any job and press “How this score is counted” to see your exact points.'],
    ['My score is low. Can I still apply?', 'Yes. We show what is missing and suggest free TESDA training, then you decide. Employers see that you applied knowing the gaps.'],
    ['How do I raise my score?', 'Add your skills and levels to your Skills Passport, fill in your experience and education, and upload certificates. Once our team accepts a certificate, it counts and your score updates on every job.'],
  ]],
  ['Verification', [
    ['Why should I get verified?', 'Verified accounts get a badge that employers, clients and workers trust. Verified employers and clients post instantly, and verified workers appear first in Find Workers.'],
    ['What do I need?', 'A confirmed email and mobile number, a complete profile, and a valid government ID (workers and clients) or a business permit or registration (employers). Our team checks it within 1 to 2 working days.'],
    ['My ID was not accepted. What now?', 'You will see the reason on your Verification page. Send a clearer photo or a different valid ID.'],
  ]],
  ['Plans and payments', [
    ['How do I pay for a plan?', 'Through PayMongo with a card, GCash, Maya, QR Ph or the other methods shown at checkout.'],
    ['When does my plan start?', 'Only after PayMongo confirms your payment. If you close the payment page early, nothing is charged and nothing changes.'],
    ['My payment failed or is still pending.', 'Your plan was not changed. Open your plan page and press Try again, or choose another method. Pending payments are re-checked with PayMongo automatically.'],
    ['Will I be charged every month?', 'No. Plans never renew by themselves. We remind you before your plan ends.'],
  ]],
  ['Gigs', [
    ['How do clients pay workers?', 'Directly: cash, GCash, Maya or bank transfer, as you agree. The client marks the contract paid and the worker confirms receiving it.'],
    ['What if something goes wrong?', 'Before delivery, either side can cancel. After delivery, open a dispute on the contract and our team will review it.'],
  ]],
]
export function Faq() {
  return (
    <InfoLayout eyebrow="FAQ" title="Questions and answers" lede="Plain answers about jobs, gigs, matching, verification and payments.">
      <div className="pf-faq">
        {FAQS.map(([group, items]) => (
          <section key={group} id={group === 'Matching' ? 'matching' : undefined} style={{ marginBottom: 18 }}>
            <h2 className="pf-h" style={{ marginBottom: 10 }}>{group}</h2>
            {items.map(([q, a]) => <details key={q}><summary>{q}</summary><div>{a}</div></details>)}
          </section>
        ))}
      </div>
      <p>Still stuck? <Link to="/help">Contact us</Link>.</p>
    </InfoLayout>
  )
}

/* ─ Not found ─────────────────────────────────────────── */
export function NotFound() {
  return (
    <InfoLayout title="We can’t find that page" lede="The link may be old, or the post may have ended or been removed.">
      <div className="pf-actions">
        <Link to="/" className="btn btn-primary">Go to the home page</Link>
        <Link to="/jobs" className="btn btn-light">Browse jobs and gigs</Link>
        <Link to="/help" className="btn btn-light">Get help</Link>
      </div>
    </InfoLayout>
  )
}
