# How hanapbuhay matches workers to jobs

**Method:** rule-based, weighted scoring. No machine learning and no hidden numbers. Every score
is the sum of five parts, each with a fixed maximum. The maximums add up to 100. The same code
(`backend/app/libraries/Job_matcher.php`) scores every screen: job cards, the job page, the job
map, the employer's applicant list, Find Workers and job alerts. The worker and the employer
always see the same number.

## The five parts

| Part | Max points | How the points are counted |
|---|---|---|
| **Skills** | 45 | For each skill the job lists, the worker gets credit for having it, scaled by their level: beginner 70%, intermediate 85%, advanced or expert 100%. Points = 45 × the average credit. |
| **Experience** | 15 | Required years come from the job post (none, 1, 2–3, 4+). Meets or beats them: 15. Fewer: 15 × worker's years ÷ required years. |
| **Certification** | 15 | Only when the job asks for a TESDA NC (for example "Electrical NC II"). A verified certificate at that level or higher gives full credit. A certificate still being checked by an admin gives half. None gives 0. |
| **Location** | 15 | Straight-line distance between the town centres of the worker (or a town they said they would work in) and the job. Same town 15, up to 15 km 12, up to 30 km 9, up to 50 km 6, up to 80 km 3, farther 1. Unknown town: 6. |
| **Education** | 10 | Minimum schooling from the job post. Meets it: 10. One level below: 5. Lower: 0. |

**A requirement the job does not ask for counts as met.** For example, a job with no
experience requirement gives everyone the full 15 experience points. A job is only scored on
what it actually needs. This keeps the score fair across simple and demanding jobs.

## Why these weights

- **Skills (45)** is the biggest part because doing the work is the main question in skills-first
  hiring. This is the idea behind TESDA's competency-based certification and PESO job matching.
- **Experience (15) and Certification (15)** are the two most common screening requirements on
  Philippine job posts. Certification counts only when it is required, so an uncertified but
  skilled worker is not punished for a job that does not ask for papers.
- **Location (15)** matters in Oriental Mindoro. Travel between towns such as Calapan and
  Bongabong costs a worker time and fare every day, and employers prefer nearby hires for
  daily-wage work.
- **Education (10)** is the smallest part. Most skilled-trade jobs in the province care more
  about skills than diplomas, but some office jobs set a minimum.

The weights are constants in one place (`Job_matcher::WEIGHTS`) and can be changed and
re-defended without touching any screen.

## Match levels

| Score | Level | What the worker sees |
|---|---|---|
| 75–100 | Strong match | Shown on the card in green. |
| 50–74 | Good match | Shown on the card in gold, with the main gap. |
| 0–49 | Low match | Shown on the card with the main gap. Applying opens a short notice that lists what is missing and offers TESDA training. The worker can still apply. |

## What a worker must fill in

To be matched and to apply, a worker needs:

- full name
- a mobile number in the 09XX XXX XXXX format
- their town
- their highest education ("none" is a valid answer)
- their years of experience ("0" is a valid answer)
- at least one skill in the Skills Passport

If something is missing, the Apply button lists exactly what to add and links to the page where
it is added. This is the same rule the server applies, so the button and the server never
disagree.

## Worked example

Job: *Welder, Calapan City.* Needs "Welding NC II, Safety Training", 2–3 years of experience,
and senior high school.

Worker: lives in Naujan, has Welding (intermediate, no certificate), 1 year of experience, and
finished high school.

| Part | Points | Why |
|---|---|---|
| Skills | 19 / 45 | Has Welding at 85%, does not have Safety Training: 45 × (0.85 + 0) ÷ 2 |
| Experience | 8 / 15 | 1 of 2 years: 15 × ½ |
| Certification | 0 / 15 | Job needs NC II, none added |
| Location | 9 / 15 | 16.5 km away |
| Education | 5 / 10 | One level below senior high |
| **Total** | **41: Low match** | Gaps shown: Welding NC II, Safety Training, 2+ years |

After the worker finishes a TESDA welding course and the admin accepts the NC II certificate,
the certification part becomes 15 and the score rises to 56 (Good match) with no other change.

## Questions a panel may ask

- **Is this AI?** No. It is a transparent, rule-based formula. Every point can be traced to a
  rule above, and the worker sees the breakdown.
- **Can a worker game it?** Self-reported skills get skill credit, but only an admin-verified
  certificate earns certification points. Employers also see whether each skill is verified.
- **Why not use distance by road?** Road data for every barangay is not available offline. Town
  centre distance is consistent and good enough to rank nearby jobs first.
- **Does verification change the score?** No. Verification is a separate trust badge, so the
  score measures fit only, not trust.
