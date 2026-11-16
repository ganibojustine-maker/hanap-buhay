# How hanapbuhay matches workers to jobs

**Method:** rule-based, weighted scoring. No machine learning and no hidden numbers. Every score
is built from up to five parts, each with a fixed weight. The same code
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

## Only what the job asks for is scored

A part the job does not ask for is **left out**, and the weights of the remaining parts are
rescaled to 100. A job with no experience or education requirement is scored on skills,
certificate (if any) and distance alone. Asking for nothing never gives free points, so a worker
cannot reach a Good match without matching what the job actually needs.

## Missing skills lower the score in proportion

The skills a job lists scale the whole score by a **qualification factor**:

`factor = 0.30 + 0.70 × (average skill coverage)`

| Skills covered | Factor (most of the score kept) |
|---|---|
| None | 30% (always a Low match) |
| Half | 65% |
| All | 100% |

There are no fixed caps or cliffs. Each skill the job lists is shown with its own percentage, so a
worker sees exactly what is missing and how much it costs. A similar skill (60% or more of the same
words, for example "Arc welding" for "Welding") counts in proportion to how close it is, and the
worker's level (beginner 70%, intermediate 85%, advanced or expert 100%) scales it further.

Two smaller adjustments: a required **TESDA NC** the worker does not hold takes off up to 12% more,
and a job that **lists no skills** is scored at 80% at most, because there is little to compare.
Education works in steps: one level short keeps half the points, two levels short none.

In real hiring a worker who cannot do the work is not a good fit however close they live. This keeps
the score honest and lets it move smoothly with what is really lacking.

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

The weights and the factor above are constants in one place (`Job_matcher`) and can be changed
and re-defended without touching any screen.

## Match levels

| Score | Level | What the worker sees |
|---|---|---|
| 75–100 | Strong match | Shown on the card in green. |
| 50–74 | Good match | Shown on the card in amber, with the main gap. |
| 0–49 | Low match | Shown on the card in red, with the main gap. The apply dialog lists what is missing with a free-training link for each skill. The worker can still apply ("Apply anyway"). |

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
| Before the factor | 41 | Sum of the parts |
| Qualification factor | × 0.53 | Skill coverage is 0.43 (Welding 85% + Safety 0, averaged): 0.30 + 0.70 × 0.43, then the missing NC II takes a little more |
| **Total** | **21: Low match** | Gaps shown: Welding NC II, Safety Training, 2+ years |

After the worker finishes a TESDA welding course, the admin accepts the NC II certificate, and
they add Safety Training, finish senior high and gain the years, the score rises to 82 (Strong match).

## Questions a panel may ask

- **Is this AI?** No. It is a transparent, rule-based formula. Every point can be traced to a
  rule above, and the worker sees the breakdown.
- **Can a worker game it?** Self-reported skills get skill credit, but only an admin-verified
  certificate earns certification points. Employers also see whether each skill is verified.
- **Why not use distance by road?** Road data for every barangay is not available offline. Town
  centre distance is consistent and good enough to rank nearby jobs first.
- **Does verification change the score?** No. Verification is a separate trust badge, so the
  score measures fit only, not trust.
