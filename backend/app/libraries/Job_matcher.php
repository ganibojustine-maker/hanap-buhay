<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * Job Matcher — the one place a worker-to-job match score is computed
 * ------------------------------------------------------------------
 * Used by Find Jobs, job cards, the score saved when a worker applies or
 * sends a proposal, the employer's applicant profile, Find Workers and job
 * alerts, so every screen shows the same number for the same worker and job.
 *
 * Rule-based weighted scoring (see docs/MATCHING.md):
 *   Skills 45 · Experience 15 · Certification 15 · Location 15 · Education 10
 * Only what a job actually asks for is scored (the weights of the other parts are dropped,
 * so asking for nothing never hands out free points). The skills a job lists then scale the
 * whole result by a smooth "qualification factor" (see score()), so the percentage moves with
 * exactly how much of the job the worker covers: no fixed caps, no cliffs.
 *
 * "Electrical NC II" style requirements need a TESDA NC at that level: the
 * skill part counts the skill, the certification part counts the NC, and a
 * missing NC is listed as a gap so the worker is pointed to a TESDA course.
 */
class Job_matcher
{
    /** Town centres (same coordinates as the Job Map). */
    public const TOWN_COORDS = [
        'Puerto Galera' => [13.5015, 120.9567], 'San Teodoro' => [13.4300, 121.0180], 'Baco' => [13.3592, 121.0964],
        'Calapan City'  => [13.4115, 121.1803], 'Naujan' => [13.3236, 121.3031], 'Victoria' => [13.1764, 121.2828],
        'Socorro'       => [13.0642, 121.4056], 'Pola' => [13.1467, 121.4361], 'Pinamalayan' => [13.0333, 121.4833],
        'Gloria'        => [12.9722, 121.4794], 'Bansud' => [12.8622, 121.4567], 'Bongabong' => [12.7458, 121.4886],
        'Roxas'         => [12.5858, 121.5175], 'Mansalay' => [12.5297, 121.4386], 'Bulalacao' => [12.3236, 121.3436],
    ];

    /** Weights of the five parts. A part the job does not ask for is left out and the rest are rescaled to 100. */
    public const WEIGHTS = ['skills' => 45, 'experience' => 15, 'certification' => 15, 'location' => 15, 'education' => 10];

    /** Match levels shown on every card: the first one whose minimum the score reaches. */
    public const LEVELS = [
        ['key' => 'strong', 'min' => 75, 'label' => 'Strong match'],
        ['key' => 'good',   'min' => 50, 'label' => 'Good match'],
        ['key' => 'low',    'min' => 0,  'label' => 'Low match'],
    ];

    /** Education, lowest to highest. Vocational (TESDA / tech-voc) ranks with senior high. */
    public const EDUCATION = [
        'none' => 0, 'elementary' => 1, 'high_school' => 2, 'senior_high' => 3, 'vocational' => 3, 'college' => 4, 'postgraduate' => 5,
    ];
    public const EDUCATION_LABELS = [
        'none' => 'No formal schooling', 'elementary' => 'Elementary graduate', 'high_school' => 'High school graduate',
        'senior_high' => 'Senior high graduate', 'vocational' => 'Vocational / TESDA course', 'college' => 'College graduate',
        'postgraduate' => "Master's degree or higher",
    ];

    /** jobs.experience → minimum years */
    private const EXPERIENCE_YEARS = ['none' => 0, '1' => 1, '2-3' => 2, '4+' => 4];

    /** Qualification factor: share of the score that does NOT depend on skills (distance, schooling...). */
    private const FACTOR_FLOOR = 0.30;     // with none of the listed skills a worker keeps at most 30% of the score
    private const FACTOR_NO_SKILLS_LISTED = 0.80; // the job lists no skills: little to compare, so 80% at most
    private const FACTOR_NC_PENALTY = 0.12; // a required TESDA NC that is missing takes up to 12% off

    /** Skill level → how much of a required skill it covers. */
    private const LEVEL_CREDIT = ['beginner' => 0.7, 'intermediate' => 0.85, 'advanced' => 1.0, 'expert' => 1.0];

    private const NC_RANK = ['I' => 1, 'II' => 2, 'III' => 3, 'IV' => 4];
    private const STOP = ['and', 'of', 'the', 'for', 'in', 'with', 'skill', 'skills', 'nc', 'level', 'basic', 'training',
        'tesda', 'certified', 'certificate', 'experience', 'knowledge', 'i', 'ii', 'iii', 'iv'];

    /* ── towns & distance ───────────────────────────────────── */

    /** "Calapan City, Oriental Mindoro" / "calapan" → "Calapan City"; unknown → null */
    public function town(?string $place): ?string
    {
        $p = strtolower((string) $place);
        if ($p === '') return null;
        foreach (array_keys(self::TOWN_COORDS) as $t) {
            $key = strtolower($t === 'Calapan City' ? 'calapan' : $t);
            if (str_contains($p, $key)) return $t;
        }
        return null;
    }

    public function distance_km(?string $a, ?string $b): ?float
    {
        $ta = $this->town($a); $tb = $this->town($b);
        if (!$ta || !$tb) return null;
        if ($ta === $tb) return 0.0;
        [$la1, $lo1] = self::TOWN_COORDS[$ta]; [$la2, $lo2] = self::TOWN_COORDS[$tb];
        $r = 6371; $dLa = deg2rad($la2 - $la1); $dLo = deg2rad($lo2 - $lo1);
        $h = sin($dLa / 2) ** 2 + cos(deg2rad($la1)) * cos(deg2rad($la2)) * sin($dLo / 2) ** 2;
        return round(2 * $r * asin(min(1, sqrt($h))), 1);
    }

    /* ── skills ─────────────────────────────────────────────── */

    private function norm(string $s): string
    {
        return trim(preg_replace('/\s+/', ' ', preg_replace('/[^a-z0-9]+/', ' ', strtolower($s))));
    }

    /** welding/welder → weld, carpentry/carpenter → carpent, electrical/electrician → electric */
    private function stem(string $w): string
    {
        foreach (['ician', 'ing', 'ers', 'ian', 'ery', 'er', 'ry', 'al', 'ist', 's'] as $suf) {
            if (strlen($w) - strlen($suf) >= 4 && str_ends_with($w, $suf)) return substr($w, 0, -strlen($suf));
        }
        return $w;
    }

    private function tokens(string $s): array
    {
        $out = [];
        foreach (explode(' ', $this->norm($s)) as $w) {
            if (strlen($w) >= 2 && !in_array($w, self::STOP, true)) $out[$this->stem($w)] = true;
        }
        return array_keys($out);
    }

    /** Abbreviations written in brackets: "Shielded Metal Arc Welding (SMAW)" → [smaw] */
    private function abbrevs(string $s): array
    {
        preg_match_all('/\(([A-Za-z]{2,8})\)/', $s, $m);
        return array_map('strtolower', $m[1]);
    }

    public function nc_level(string $s): ?string
    {
        if (preg_match('/\bNC\s*-?\s*(IV|III|II|I|4|3|2|1)\b/i', $s, $m)) {
            return strtr(strtoupper($m[1]), ['4' => 'IV', '3' => 'III', '2' => 'II', '1' => 'I']);
        }
        return null;
    }

    /** How well a worker skill covers the job's skill name, 0 to 1 (ignoring any NC level). */
    public function skill_strength(string $need, string $skill): float
    {
        $n = $this->norm($need); $s = $this->norm($skill);
        if ($n === '' || $s === '') return 0.0;
        if (str_contains(" $s ", " $n ") || str_contains(" $n ", " $s ")) return 1.0;
        $nAb = $this->abbrevs($need); $sAb = $this->abbrevs($skill);
        if (in_array($n, $sAb, true) || in_array($s, $nAb, true) || array_intersect($nAb, $sAb)) return 1.0;
        $tn = $this->tokens($need); $ts = $this->tokens($skill);
        if (!$tn || !$ts) return 0.0;
        $r = count(array_intersect($tn, $ts)) / count($tn);
        return $r >= 0.6 ? $r : 0.0;   // 60%+ of the words in common counts, in proportion
    }

    /** Does this worker skill satisfy the job's skill name (ignoring any NC level)? */
    public function skill_matches(string $need, string $skill): bool
    {
        return $this->skill_strength($need, $skill) > 0;
    }

    /** "Welding, Carpentry; Safety Training" → list */
    public function needs(?string $skillsNeeded): array
    {
        $parts = preg_split('/[,;\n\/•]+/', (string) $skillsNeeded);
        $out = [];
        foreach ($parts as $p) {
            $p = trim($p);
            if (mb_strlen($p) >= 2 && mb_strlen($p) <= 80) $out[mb_strtolower($p)] = $p;
        }
        return array_values($out);
    }

    /* ── worker facts ───────────────────────────────────────── */

    public static function level_of(int $score): array
    {
        foreach (self::LEVELS as $l) if ($score >= $l['min']) return $l;
        return self::LEVELS[count(self::LEVELS) - 1];
    }

    private function resume(array $worker): array
    {
        $r = $worker['resume_data'] ?? null;
        if (is_string($r)) $r = json_decode($r, true);
        return is_array($r) ? $r : [];
    }

    /** Years of work: users.experience_years, or added up from the resume's work history. */
    public function experience_years(array $worker): ?int
    {
        if (isset($worker['experience_years']) && $worker['experience_years'] !== null && $worker['experience_years'] !== '') {
            return (int) $worker['experience_years'];
        }
        $jobs = (array) ($this->resume($worker)['experience'] ?? []);
        if (!$jobs) return null;
        $total = 0;
        foreach ($jobs as $e) {
            if (!preg_match('/(19|20)\d{2}/', (string) ($e['start'] ?? ''), $a)) continue;
            $endText = (string) ($e['end'] ?? '');
            $end = preg_match('/(19|20)\d{2}/', $endText, $b) ? (int) $b[0]
                : ((stripos($endText, 'present') !== false || $endText === '') ? (int) date('Y') : (int) $a[0]);
            $total += max(0, $end - (int) $a[0]);
        }
        return min(40, $total);
    }

    /** Education level: users.education_level, or read from the resume's highest entry. */
    public function education_level(array $worker): ?string
    {
        $lvl = (string) ($worker['education_level'] ?? '');
        if (isset(self::EDUCATION[$lvl])) return $lvl;
        $best = null;
        foreach ((array) ($this->resume($worker)['education'] ?? []) as $e) {
            $t = strtolower(($e['level'] ?? '') . ' ' . ($e['school'] ?? ''));
            $guess = null;
            if (preg_match('/master|doctor|phd|post\s*grad/', $t)) $guess = 'postgraduate';
            elseif (preg_match('/bachelor|college|university/', $t)) $guess = 'college';
            elseif (preg_match('/tesda|vocational|\bnc\b/', $t)) $guess = 'vocational';
            elseif (preg_match('/senior|grade\s*12|\bshs\b/', $t)) $guess = 'senior_high';
            elseif (preg_match('/high|secondary/', $t)) $guess = 'high_school';
            elseif (preg_match('/elementary|primary/', $t)) $guess = 'elementary';
            if ($guess && ($best === null || self::EDUCATION[$guess] > self::EDUCATION[$best])) $best = $guess;
        }
        return $best;
    }

    private function km_label(float $km): string
    {
        return rtrim(rtrim(number_format($km, 1), '0'), '.') . ' km';
    }

    /* ── the formula ────────────────────────────────────────── */

    /**
     * Rule-based, weighted score of one worker for one job (0–100).
     *
     *   Skills         45  each skill the job lists, weighted by the worker's level in it
     *   Experience     15  worker's years of work vs. the years the job asks for
     *   Certification  15  the TESDA NC the job asks for, verified by an admin (half while pending)
     *   Location       15  distance between the worker's town (or a preferred town) and the job
     *   Education      10  worker's schooling vs. the minimum the job asks for
     *
     * Only the parts the job asks for count: a job with no experience or education requirement is
     * scored on skills, certificate and distance alone, so "no requirement" is never a free point.
         * Then multiplied by the qualification factor 0.30 + 0.70 x (average skill coverage), so the
     * percentage falls in proportion to the skills that are missing. A missing required NC takes
     * off up to 12% more; a job that lists no skills is scored at 80% at most.
     * Every part comes back with its points (out of 100 in total) and a one-line explanation.
     *
     * @param array $worker  users row (location, preferred_towns, experience_years, education_level, resume_data)
     * @param array $skills  worker skills: skill_name, level, source, certificate, verified (bool)
     * @param array $job     jobs row (skills_needed, location, experience, education_level)
     */
    public function score(array $worker, array $skills, array $job): array
    {
        $W = self::WEIGHTS;
        $needs = $this->needs($job['skills_needed'] ?? '');
        $matched = []; $missing = []; $verifiedHits = []; $gaps = [];
        $skillCredits = []; $skillNames = []; $ncNeeds = 0; $ncCredit = 0.0;

        foreach ($needs as $need) {
            $needNc = $this->nc_level($need);
            $needName = trim(preg_replace('/\b(TESDA|NC\s*-?\s*(IV|III|II|I|[1-4]))\b/i', '', $need), " -,.");
            $credentialOnly = $needName === '' || !$this->tokens($needName);
            $bestSkill = 0.0; $bestSk = null; $bestNc = 0.0;

            foreach ($skills as $sk) {
                $name = (string) ($sk['skill_name'] ?? '');
                $skNc = $this->nc_level($name . ' ' . ($sk['certificate'] ?? ''));
                $isTesda = ($sk['source'] ?? '') === 'tesda' || $skNc !== null;
                $strength = $credentialOnly ? 0.0 : $this->skill_strength($needName, $name);
                $sameSkill = $strength > 0;
                if ($sameSkill) {
                    $c = (self::LEVEL_CREDIT[$sk['level'] ?? ''] ?? 0.8) * $strength;
                    if ($c > $bestSkill) { $bestSkill = $c; $bestSk = $sk; }
                }
                if ($needNc && ($sameSkill || $credentialOnly) && $isTesda
                    && (self::NC_RANK[$skNc ?? 'I'] ?? 0) >= self::NC_RANK[$needNc]) {
                    $bestNc = max($bestNc, !empty($sk['verified']) ? 1.0 : 0.5);
                }
            }

            if (!$credentialOnly) {
                $skillCredits[] = $bestSkill; $skillNames[] = $needName;
                if ($bestSkill > 0 && !empty($bestSk['verified'])) $verifiedHits[] = $need;
            }
            if ($needNc) { $ncNeeds++; $ncCredit += $bestNc; }

            $lacksSkill = !$credentialOnly && $bestSkill <= 0;
            $lacksNc = $needNc && $bestNc < 1.0;
            if ($lacksSkill || $lacksNc) {
                $missing[] = $need;
                $gaps[] = [
                    'name'    => $need,
                    'kind'    => $lacksSkill ? 'skill' : 'certificate',
                    'skill'   => $credentialOnly ? null : $needName,
                    'pending' => !$lacksSkill && $bestNc === 0.5, // has it; an admin is still checking the certificate
                ];
            } else {
                $matched[] = $need;
            }
        }

        $parts = [];

        // 1. Skills
        $skillNeeds = count($skillCredits);
        $skillPts = $skillNeeds ? $W['skills'] * array_sum($skillCredits) / $skillNeeds : $W['skills'];
        $have = count(array_filter($skillCredits, fn($c) => $c > 0));
        $parts[] = ['key' => 'skills', 'label' => 'Skills', 'applies' => $skillNeeds > 0, 'raw' => $skillPts, 'points' => (int) round($skillPts), 'max' => $W['skills'],
            'explain' => $skillNeeds
                ? sprintf('You have %d of the %d skills this job lists.', $have, $skillNeeds)
                    . ($have > 0 && round($skillPts) < $W['skills'] && $have === $skillNeeds ? ' A higher skill level earns the rest.' : '')
                : 'This job does not list specific skills.'];

        // 2. Experience
        $needYears = self::EXPERIENCE_YEARS[(string) ($job['experience'] ?? '')] ?? 0;
        $years = $this->experience_years($worker);
        $yrs = fn(int $n) => $n . ' year' . ($n === 1 ? '' : 's');
        $plus = fn(int $n) => $n . '+ year' . ($n === 1 ? '' : 's');
        if ($needYears === 0) {
            $expPts = $W['experience']; $expText = 'No work experience required.';
        } elseif ($years === null) {
            $expPts = 0; $expText = 'Needs ' . $plus($needYears) . '. Add your years of experience to your profile.';
            $gaps[] = ['name' => $plus($needYears) . ' of experience', 'kind' => 'experience', 'skill' => null, 'pending' => false];
        } else {
            $expPts = $years >= $needYears ? $W['experience'] : $W['experience'] * $years / $needYears;
            $expText = 'You have ' . $yrs($years) . '; the job asks for ' . $plus($needYears) . '.';
            if ($years < $needYears) $gaps[] = ['name' => $plus($needYears) . ' of experience', 'kind' => 'experience', 'skill' => null, 'pending' => false];
        }
        $parts[] = ['key' => 'experience', 'label' => 'Experience', 'applies' => $needYears > 0, 'raw' => $expPts, 'points' => (int) round($expPts), 'max' => $W['experience'], 'explain' => $expText];

        // 3. Certification
        if ($ncNeeds === 0) {
            $certPts = $W['certification']; $certText = 'No certificate required.';
        } else {
            $certPts = $W['certification'] * $ncCredit / $ncNeeds;
            $certText = $ncCredit >= $ncNeeds ? 'You have the verified certificate this job asks for.'
                : ($ncCredit > 0 ? 'A certificate is still being checked by our team, or one is missing.' : 'This job asks for a TESDA NC you have not added yet.');
        }
        $parts[] = ['key' => 'certification', 'label' => 'Certificates', 'applies' => $ncNeeds > 0, 'raw' => $certPts, 'points' => (int) round($certPts), 'max' => $W['certification'], 'explain' => $certText];

        // 4. Location
        $km = $this->distance_km($worker['location'] ?? null, $job['location'] ?? null);
        foreach (array_filter(explode(',', (string) ($worker['preferred_towns'] ?? ''))) as $town) {
            $d = $this->distance_km(trim($town), $job['location'] ?? null);
            if ($d !== null && ($km === null || $d < $km)) $km = $d;
        }
        $L = $W['location'];
        if ($km === null)  { $locPts = (int) round($L * 0.4); $locText = 'Add your town so we can count the distance.'; }
        elseif ($km == 0)  { $locPts = $L;                    $locText = 'The job is in your town.'; }
        elseif ($km <= 15) { $locPts = (int) round($L * 0.8); $locText = $this->km_label($km) . ' from you.'; }
        elseif ($km <= 30) { $locPts = (int) round($L * 0.6); $locText = $this->km_label($km) . ' from you.'; }
        elseif ($km <= 50) { $locPts = (int) round($L * 0.4); $locText = $this->km_label($km) . ' from you.'; }
        elseif ($km <= 80) { $locPts = (int) round($L * 0.2); $locText = $this->km_label($km) . ' from you, a long trip.'; }
        else               { $locPts = 1;                     $locText = $this->km_label($km) . ' from you, the far end of the province.'; }
        $parts[] = ['key' => 'location', 'label' => 'Location', 'applies' => true, 'raw' => $locPts, 'points' => $locPts, 'max' => $L, 'explain' => $locText];

        // 5. Education
        $needEdu = (string) ($job['education_level'] ?? '');
        $edu = $this->education_level($worker);
        if (!isset(self::EDUCATION[$needEdu]) || $needEdu === 'none') {
            $eduPts = $W['education']; $eduText = 'No minimum schooling required.';
        } elseif ($edu === null) {
            $eduPts = 0; $eduText = 'Needs: ' . self::EDUCATION_LABELS[$needEdu] . '. Add your education to your profile.';
            $gaps[] = ['name' => self::EDUCATION_LABELS[$needEdu], 'kind' => 'education', 'skill' => null, 'pending' => false];
        } else {
            $diff = self::EDUCATION[$edu] - self::EDUCATION[$needEdu];
            $eduPts = $diff >= 0 ? $W['education'] : $W['education'] * max(0, 1 + $diff * 0.5);   // one step short: half, two: none
            $eduText = $diff >= 0 ? 'You meet the minimum schooling (' . self::EDUCATION_LABELS[$needEdu] . ').'
                : 'Needs: ' . self::EDUCATION_LABELS[$needEdu] . '. You have: ' . self::EDUCATION_LABELS[$edu] . '.';
            if ($diff < 0) $gaps[] = ['name' => self::EDUCATION_LABELS[$needEdu], 'kind' => 'education', 'skill' => null, 'pending' => false];
        }
        $parts[] = ['key' => 'education', 'label' => 'Education', 'applies' => isset(self::EDUCATION[$needEdu]) && $needEdu !== 'none', 'raw' => $eduPts, 'points' => (int) round($eduPts), 'max' => $W['education'], 'explain' => $eduText];

        // only what the job asks for counts; the weights of those parts are rescaled to 100
        $counted = array_values(array_filter($parts, fn($x) => $x['applies']));
        $maxSum = array_sum(array_column($counted, 'max'));
        $raw = $maxSum > 0 ? 100 * array_sum(array_column($counted, 'raw')) / $maxSum : 0;
        foreach ($parts as &$x) {
            $x['points'] = $x['applies'] ? (int) round($x['raw'] * 100 / $maxSum) : 0;
            $x['max'] = $x['applies'] ? (int) round($x['max'] * 100 / $maxSum) : 0;
            unset($x['raw']);
        }
        unset($x);
        $parts = array_values(array_filter($parts, fn($x) => $x['applies']));

        // Qualification factor: the skills a job lists scale the whole score smoothly.
        //   q = average skill coverage (0..1) -> factor = 0.30 + 0.70 * q
        // None of the skills: at most 30. Half covered: at most 65. All covered: no reduction.
        // A required TESDA NC that is missing takes off up to another 12%. A job that lists no
        // skills is scored at 80% at most, because there is little to compare.
        $q = $skillNeeds ? array_sum($skillCredits) / $skillNeeds : 0.0;
        $factor = $skillNeeds ? self::FACTOR_FLOOR + (1 - self::FACTOR_FLOOR) * $q : self::FACTOR_NO_SKILLS_LISTED;
        if ($ncNeeds > 0) $factor *= 1 - self::FACTOR_NC_PENALTY * (1 - $ncCredit / $ncNeeds);
        $score = (int) max(0, min(100, round($raw * $factor)));
        $level = self::level_of($score);

        // each requirement with its own percentage, so the worker sees what really lacks
        $checks = [];
        foreach ($skillCredits as $i => $c) {
            $checks[] = ['name' => $skillNames[$i], 'kind' => 'skill', 'pct' => (int) round($c * 100), 'status' => $c >= 0.99 ? 'met' : ($c > 0 ? 'partial' : 'missing')];
        }

        $reasons = [];
        $reasons[] = $skillNeeds ? sprintf('Has %d of %d skills', $have, $skillNeeds) : 'No specific skills listed';
        if ($km !== null) $reasons[] = $km == 0 ? 'Same town' : $this->km_label($km) . ' away';
        if ($verifiedHits) $reasons[] = 'Verified certificate';

        return [
            'score'       => $score,
            'level'       => $level['key'],
            'level_label' => $level['label'],
            'parts'       => $parts,
            'skills_have' => $have,
            'skills_need' => $skillNeeds,
            'gaps'        => $gaps,
            'checks'      => $checks,
            'factor'      => round($factor, 2),
            'distance_km' => $km,
            'matched'     => $matched,
            'missing'     => $missing,
            'verified'    => $verifiedHits,
            'reasons'     => $reasons,
            // older screens read these
            'skills_pts'  => 0,
            'place_pts'   => 0,
            'trust_pts'   => 0,
        ];
    }

    /**
     * What a worker must have before matching and applying (real job boards ask the same):
     * a name, a mobile number, a town, and at least one skill in the Skills Passport.
     * Experience and education are asked for, but "none" is a valid answer.
     *
     * @return array list of ['field' => key, 'label' => what to add, 'where' => page]
     */
    public function missing_profile(array $worker, array $skills): array
    {
        $out = [];
        if (mb_strlen(trim((string) ($worker['full_name'] ?? ''))) < 2) $out[] = ['field' => 'full_name', 'label' => 'Your full name', 'where' => '/dashboard/profile'];
        if (!preg_match('/^(\+?63|0)9\d{9}$/', preg_replace('/[\s\-]/', '', (string) ($worker['phone'] ?? '')))) $out[] = ['field' => 'phone', 'label' => 'A mobile number (09XX XXX XXXX)', 'where' => '/dashboard/profile'];
        if (!$this->town($worker['location'] ?? null)) $out[] = ['field' => 'location', 'label' => 'Your town in Oriental Mindoro', 'where' => '/dashboard/profile'];
        if (array_key_exists('education_level', $worker) && $this->education_level($worker) === null) $out[] = ['field' => 'education_level', 'label' => 'Your highest education', 'where' => '/dashboard/profile'];
        if (array_key_exists('experience_years', $worker) && $this->experience_years($worker) === null) $out[] = ['field' => 'experience_years', 'label' => 'Your years of work experience', 'where' => '/dashboard/profile'];
        if (!$skills) $out[] = ['field' => 'skills', 'label' => 'At least one skill in your Skills Passport', 'where' => '/dashboard/passport'];
        return $out;
    }
}
