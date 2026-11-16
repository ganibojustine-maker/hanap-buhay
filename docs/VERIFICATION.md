# Verification

## Approach: hybrid (automatic checks, then an admin review)

| Option | Why not alone |
|---|---|
| Admin review only | Slow, and admins waste time on accounts with no confirmed phone or an incomplete profile. |
| Automatic only | Reading Philippine IDs reliably needs a paid identity service such as PhilSys eVerify API access or a KYC vendor. A computer also cannot judge a fake or edited ID photo well. |
| **Hybrid (chosen)** | The system does everything a computer can check for free and reliably. A person then judges the one thing a computer cannot: the document itself. |

**Automatic checks** (done by the system, shown to the admin next to each request):

- Email confirmed: the link sent at sign-up. Google sign-in counts as confirmed.
- Mobile number confirmed: a 6-digit code texted through Semaphore. It expires in 10 minutes and allows 5 tries.
- Profile complete: the same required fields as applying (see MATCHING.md).
- File check: JPG, PNG, WEBP or PDF only, up to 5 MB, and at least 400×250 pixels so it is readable.
- Duplicate check: the same ID number is not already pending or approved on another account.
- Name check: the name on the ID matches the account name.

**Admin review:** the admin looks at the ID (and the optional selfie holding the ID). They then approve it, reject it with a reason, or ask for a new photo with a reason.

## Criteria per role

| Step | Worker | Client | Employer |
|---|---|---|---|
| Email confirmed | ✔ | ✔ | ✔ |
| Mobile number confirmed (SMS code) | ✔ | ✔ | ✔ |
| Profile complete | Name, mobile, town, education, experience, 1+ skill | Name, town | Business name, town |
| Document | Valid government ID | Valid government ID | DTI / SEC / CDA / Mayor's permit / BIR 2303 |

The accepted IDs are PhilSys National ID or ePhilID, Driver's License, UMID, SSS, Passport, PRC, Postal ID, Voter's ID, PhilHealth, TIN, Senior Citizen, PWD, School ID (students) and Barangay clearance.

## Statuses (`users.verification_status`)

| Status | Meaning | Person sees |
|---|---|---|
| `unverified` | Nothing sent yet | "Not verified" and the steps to do |
| `pending` | Document sent, waiting for an admin | "Pending review: we check it within 1 to 2 working days" |
| `verified` | Approved | The Verified badge |
| `rejected` | Not approved | The admin's reason, and a form to send another ID |
| `resubmit` | The admin asked for a new photo | The admin's reason, and the form |

Every change is written to `verification_history`: who did it, when, and the reason. The account owner sees their own history on the Verification page. The admin sees it per account and as a decision log.

## What verification unlocks (enforced in code)

| Role | Unlocks |
|---|---|
| Worker | Verified badge on applications, proposals and the Skills Passport. Ranked first in Find Workers (`TalentController`). |
| Employer | Job posts go live immediately. Unverified posts wait for admin approval (`JobController::create`). Verified business badge. |
| Client | Gigs go live immediately. Verified client badge. |
| Everyone | A confirmed mobile number is required to send proposals, hire, or book a service (anti-scam, `GigController::require_phone`). |

## Data protection

ID images are only returned to the owner and to admins. The owner sees only the last four characters of the ID number. Images are deleted 1 year after the check (Privacy Policy section 5). A scheduled clean-up job for this is listed in PUBLIC_READINESS.md.
