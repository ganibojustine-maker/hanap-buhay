# Gigs: the client and worker freelance flow

A **gig** is short, priced work posted by a **client** (service buyer), for example a repair, cleaning, cooking for an event or a small project. It is separate from an employer's **job**: there is no interview shortlist. The worker names a price and a timeline, and the work is tracked as a contract.

```
post gig → proposals → compare → hire → contract (+ milestones) → delivery
         → changes (up to the agreed rounds) → completed → payment confirmed → reviews
                     └ cancelled (before delivery)      └ disputed (after hiring; an admin decides)

book a worker's listed service → worker accepts → contract (same steps)
```

## Statuses

| Proposal | Meaning |
|---|---|
| submitted | Sent; the client has not decided |
| shortlisted | The client is comparing a few |
| hired | A contract was started |
| declined | The client said no |
| not_selected | The gig was filled by someone else |
| withdrawn | The worker took it back |

| Contract | Meaning |
|---|---|
| offered | A direct booking, waiting for the worker to accept |
| active | Work in progress |
| delivered | Waiting for the client to approve |
| revision_requested | The client asked for changes (limited by `revisions_allowed`) |
| completed | Approved |
| cancelled | Stopped before delivery |
| disputed | Our team is reviewing |

| Payment | Meaning |
|---|---|
| unpaid | Not paid yet |
| sent | The client says they paid |
| confirmed | The worker says they received it |

## Money

The client pays the worker **directly** (cash, GCash, Maya, bank transfer). Both sides confirm the payment in the contract, which leaves a record. hanapbuhay does not hold the money, because holding and releasing other people's funds needs a licensed escrow or e-money arrangement (BSP rules). This is listed as a decision for the team in PUBLIC_READINESS.md.

## What a client can see

| Can see | Cannot see |
|---|---|
| Public gig and job posts (as on the job board) | Other clients' proposals or the prices quoted to them |
| Worker profiles and Skills Passports in Find Talent | Other clients' contracts, messages or reviews in progress |
| Worker service listings, with price and service area | Workers' contact details before a proposal, booking or contact unlock |

## Pages

| Role | Pages |
|---|---|
| Client | Dashboard, My Gigs (post, edit, close, renew), Proposals (side-by-side comparison with the best fit marked, shortlist, decline, hire with milestones), Contracts (approve, ask for changes, add milestone, mark paid, cancel, dispute, review), Find Talent (workers, services, saved), Messages, Service Buyer Pass, Verification |
| Worker | Gigs: Find gigs (match score and missing skills on each card), My proposals, Contracts (accept a booking, deliver with a photo or PDF, confirm payment, cancel, dispute, review), My services |
| Admin | Hiring & Gigs: Disputes (mark complete, cancel, or let it continue, with a decision note both sides see), Contracts monitor, Job applications monitor |

## Marketplace features (migration 022)

| Feature | How it works |
|---|---|
| Post photos | Jobs, gigs and services take up to 6 photos each (`post_photos`). A job's first photo stays its cover in `job_images`, so every existing card keeps working. Removing the cover moves the next photo up. Photos are shrunk on the phone before upload. |
| Service listings | A worker sells a service with photos, a description, one price or 3 packages (Basic / Standard / Premium, each with its own price, days and what is included), the number of changes included, what the client must prepare, and the towns served. A live preview shows the card clients will see. |
| Service page | `/dashboard/talent/services/:id` (client) shows the gallery, packages, worker, reviews and the worker's other services. The client picks a package and books it; the contract records the package. The worker sees the same page as a preview. |
| Proposals | Besides price, days and the message, a worker can say when they can start and attach up to 4 photos from their work gallery. The client sees them in the comparison table. |
| Invites | From a worker's profile, a client invites them to one of their open gigs. The worker gets a notification and sees the invite at the top of Find gigs. |
| Profiles | A worker's services show on their public profile and on the client's view of their profile. My Profile has a Freelance and gigs summary. |
| Job Map | Near me uses the phone's location (or the town in the profile when location is off), shows distances, sorts by closest, filters by radius, shows photos on pins and in the list, and links to directions. |

Routes: `GET|POST /api/photos/{type}/{id}`, `DELETE /api/photos/{type}/{id}/{slot}`, `GET /api/photos/{type}/{id}/{slot}/file`, `GET /api/services/{id}`, `POST /api/gigs/{id}/invite`, `GET /api/gigs/invites`.
