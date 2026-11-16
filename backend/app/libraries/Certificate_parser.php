<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * Certificate Parser Library
 * ------------------------------------------------------------------
 * Reads the text of a skills certificate (TESDA National Certificate,
 * Certificate of Competency, training certificates) and returns the
 * skill it proves. The text comes from OCR in the browser (photos and
 * scans) or from PDF text extraction on the server.
 *
 * OCR text is noisy, so matching is tolerant: known TESDA qualification
 * titles are matched by word overlap, and "NC Il" / "NC 11" are read as NC II.
 */
class Certificate_parser
{
    /**
     * Common TESDA qualifications => skill category.
     * Matching ignores word order and the "NC" level, which is read separately.
     */
    private const QUALIFICATIONS = [
        // Welding & metal works
        'Shielded Metal Arc Welding (SMAW)'      => 'Welding',
        'Gas Tungsten Arc Welding (GTAW)'        => 'Welding',
        'Gas Metal Arc Welding (GMAW)'           => 'Welding',
        'Flux-Cored Arc Welding (FCAW)'          => 'Welding',
        'Submerged Arc Welding (SAW)'            => 'Welding',
        'Oxyacetylene Welding'                   => 'Welding',
        'Machining'                              => 'Metals',
        'Pipefitting'                            => 'Construction',
        // Construction
        'Carpentry'                              => 'Construction',
        'Masonry'                                => 'Construction',
        'Tile Setting'                           => 'Construction',
        'Plumbing'                               => 'Construction',
        'Construction Painting'                  => 'Construction',
        'Scaffold Erection'                      => 'Construction',
        'Rigging'                                => 'Construction',
        'Reinforcing Steel Works'                => 'Construction',
        'Formworks Carpentry'                    => 'Construction',
        'Heavy Equipment Operation'              => 'Heavy Equipment',
        'Driving'                                => 'Transport',
        'Forklift Operation'                     => 'Heavy Equipment',
        // Electrical & electronics
        'Electrical Installation and Maintenance' => 'Electrical',
        'Electric Power Distribution Line Construction' => 'Electrical',
        'Photovoltaic System Installation'       => 'Electrical',
        'Photovoltaic Systems Design'            => 'Electrical',
        'Electronic Products Assembly and Servicing' => 'Electronics',
        'Refrigeration and Airconditioning Servicing' => 'Electronics',
        'RAC Servicing (DomRAC)'                 => 'Electronics',
        'RAC Servicing (PACU/CRE)'               => 'Electronics',
        'Mechatronics Servicing'                 => 'Electronics',
        'Instrumentation and Control Servicing'  => 'Electronics',
        // Automotive
        'Automotive Servicing'                   => 'Automotive',
        'Motorcycle/Small Engine Servicing'      => 'Automotive',
        'Automotive Body Painting/Finishing'     => 'Automotive',
        'Driving (Articulated Vehicle)'          => 'Transport',
        // ICT
        'Computer Systems Servicing'             => 'ICT',
        'Computer Hardware Servicing'            => 'ICT',
        'Contact Center Services'                => 'ICT',
        'Visual Graphic Design'                  => 'ICT',
        'Programming (Java)'                     => 'ICT',
        'Programming (.NET Technology)'          => 'ICT',
        'Animation'                              => 'ICT',
        'Illustration'                           => 'ICT',
        'Broadband Installation (Fixed Wireless Systems)' => 'ICT',
        'Computer Programming'                   => 'ICT',
        'Medical Transcription'                  => 'ICT',
        // Business & office
        'Bookkeeping'                            => 'Office',
        'Microfinance Technology'                => 'Office',
        // Tourism & hospitality
        'Cookery'                                => 'Hospitality',
        'Commercial Cooking'                     => 'Hospitality',
        'Bread and Pastry Production'            => 'Hospitality',
        'Food and Beverage Services'             => 'Hospitality',
        'Bartending'                             => 'Hospitality',
        'Barista'                                => 'Hospitality',
        'Housekeeping'                           => 'Hospitality',
        'Front Office Services'                  => 'Hospitality',
        'Tour Guiding Services'                  => 'Tourism',
        'Travel Services'                        => 'Tourism',
        'Events Management Services'             => 'Tourism',
        'Local Guiding Services'                 => 'Tourism',
        'Food Processing'                        => 'Food',
        'Ship\'s Catering Services'              => 'Hospitality',
        // Health & social
        'Caregiving'                             => 'Health',
        'Health Care Services'                   => 'Health',
        'Emergency Medical Services'             => 'Health',
        'Pharmacy Services'                      => 'Health',
        'Massage Therapy'                        => 'Wellness',
        'Domestic Work'                          => 'Household',
        'Barangay Health Services'               => 'Health',
        'Dental Technology'                      => 'Health',
        // Beauty & garments
        'Hairdressing'                           => 'Beauty',
        'Beauty Care (Nail Care)'                => 'Beauty',
        'Beauty Care'                            => 'Beauty',
        'Barbering'                              => 'Beauty',
        'Dressmaking'                            => 'Garments',
        'Tailoring'                              => 'Garments',
        'Garments Sewing'                        => 'Garments',
        // Agriculture & fisheries
        'Agricultural Crops Production'          => 'Agriculture',
        'Organic Agriculture Production'         => 'Agriculture',
        'Animal Production (Poultry-Chicken)'    => 'Agriculture',
        'Animal Production (Swine)'              => 'Agriculture',
        'Animal Production (Ruminants)'          => 'Agriculture',
        'Horticulture'                           => 'Agriculture',
        'Rice Machinery Operations'              => 'Agriculture',
        'Agricultural Machinery Operation'       => 'Agriculture',
        'Aquaculture'                            => 'Fisheries',
        'Fish Capture'                           => 'Fisheries',
        'Fishing Gear Repair and Maintenance'    => 'Fisheries',
        'Fish Products Packaging'                => 'Fisheries',
        // Security & others
        'Security Services'                      => 'Security',
        'Trainers Methodology'                   => 'Training',
        'Slaughtering Operations'                => 'Food',
        'Furniture Making (Finishing)'           => 'Construction',
    ];

    /** Words ignored when comparing titles. */
    private const STOP = ['and', 'of', 'the', 'for', 'in', 'nc', 'level'];

    /**
     * @return array{
     *   issuer:?string, source:string, is_tesda:bool, title:?string, nc_level:?string,
     *   level:?string, category:?string, cert_number:?string, holder_name:?string,
     *   issued_on:?string, valid_until:?string, skills:array
     * }
     */
    public function parse(string $text): array
    {
        $result = [
            'issuer'      => null,
            'source'      => 'training',
            'is_tesda'    => false,
            'title'       => null,
            'nc_level'    => null,
            'level'       => null,
            'category'    => null,
            'cert_number' => null,
            'holder_name' => null,
            'issued_on'   => null,
            'valid_until' => null,
            'skills'      => [],
        ];

        $text = $this->normalize($text);
        if (trim($text) === '') return $result;
        $upper = strtoupper($text);

        // --- Issuer ---
        if (preg_match('/\bTESDA\b|TECHNICAL\s+EDUCATION\s+(AND|&)\s+SKILLS|SKILLS\s+DEVELOPMENT\s+AUTHORITY/', $upper)) {
            $result['issuer'] = 'TESDA';
            $result['source'] = 'tesda';
            $result['is_tesda'] = true;
        } elseif (preg_match('/(?:issued\s+by|conducted\s+by|presented\s+by)[:\s]+([A-Z][A-Za-z0-9&.,\'\- ]{3,80})/i', $text, $m)) {
            $result['issuer'] = trim($m[1], " .,");
        }

        // --- NC level ---
        $nc = $this->find_nc_level($upper);
        $result['nc_level'] = $nc;
        $result['level'] = $this->level_for_nc($nc);

        // --- Qualification title ---
        [$title, $category] = $this->match_qualification($upper);
        if ($title === null) {
            $title = $this->guess_title($text);
        }
        if ($title !== null) {
            $result['title'] = $nc && !preg_match('/\bNC\s*(I{1,3}|IV)\b/i', $title) ? "$title NC $nc" : $title;
            $result['category'] = $category;
        }

        // --- Certificate number ---
        if (preg_match('/(?:CERTIFICATE|CERT\.?|CONTROL|SERIAL|REG(?:ISTRATION)?)\s*(?:NO|NUMBER|#)\.?\s*[:#]?\s*([A-Z0-9][A-Z0-9\- ]{5,30}[0-9])/', $upper, $m)) {
            $result['cert_number'] = preg_replace('/\s+/', '', $m[1]);
        } elseif (preg_match('/\b(\d{12,16})\b/', preg_replace('/(?<=\d)\s(?=\d)/', '', $upper), $m)) {
            // TESDA NC numbers are 14 digits, often printed without a label
            $result['cert_number'] = $m[1];
        }

        // --- Holder name ---
        if (preg_match('/(?:AWARDED\s+TO|CONFERRED\s+(?:UPON|TO)|GIVEN\s+TO|THIS\s+CERTIFIES\s+THAT|PRESENTED\s+TO)[:\s]+([A-Z][A-Z .,\'\-]{4,60}?)(?:\n|\s{2,}|\s+(?:FOR|HAS|WHO|IS)\b)/', $upper, $m)) {
            $result['holder_name'] = ucwords(strtolower(trim($m[1], " .,")));
        }

        // --- Dates ---
        $result['issued_on']   = $this->date_after($text, '(?:date\s+(?:of\s+)?issue[d]?|issued\s+(?:on|this)|date\s+issued|given\s+(?:this|on))');
        $result['valid_until'] = $this->date_after($text, '(?:valid\s+(?:until|up\s*to|thru|through)|expir(?:y|ation|es)(?:\s+date)?|validity)');
        if (!$result['issued_on']) {
            $result['issued_on'] = $this->first_date($text);
        }

        if ($result['title']) {
            $result['skills'][] = [
                'skill_name'  => mb_substr($result['title'], 0, 255),
                'category'    => $result['category'],
                'level'       => $result['level'],
                'source'      => $result['source'],
                'certificate' => $result['cert_number'] ?: ($result['is_tesda'] ? 'TESDA' . ($nc ? " NC $nc" : '') : null),
            ];
        }

        return $result;
    }

    /**
     * Is this document a certificate at all?
     *
     * A certificate says so in its own words: "National Certificate", "Certificate of
     * Competency", "This is to certify that", "has successfully completed", an issuing
     * body, a qualification. A resume, an ID, a receipt or a selfie does not. Each marker
     * found adds to a score; documents with the tell-tale words of something else (a
     * resume's "Work Experience" and "Education", a receipt's "Total Amount") are named,
     * so the worker is told what was uploaded instead of a vague "invalid file".
     *
     * verdict:
     *   certificate      clearly a certificate
     *   unsure           some certificate words; accepted, and the admin check decides
     *   not_certificate  readable, but not a certificate (kind says what it looks like)
     *   unreadable       no usable text (blurred, dark, cropped, or not a document)
     *
     * @return array{verdict:string, kind:?string, score:int, found:array}
     */
    public function assess(string $text): array
    {
        $text = $this->normalize($text);
        $upper = strtoupper($text);
        $letters = preg_match_all('/[A-Z]/', $upper);
        $words = preg_match_all('/\b[A-Z]{3,}\b/', $upper);
        if ($letters < 25 || $words < 4) {
            return ['verdict' => 'unreadable', 'kind' => null, 'score' => 0, 'found' => []];
        }

        $score = 0;
        $found = [];
        $markers = [
            // [pattern, points, label shown to the worker]
            ['/NATIONAL\s+CERTIFICATE/', 4, 'National Certificate'],
            ['/CERTIFICATE\s+OF\s+(COMPETENCY|COMPLETION|TRAINING|PARTICIPATION|ATTENDANCE|ACHIEVEMENT|PROFICIENCY|RECOGNITION|MERIT|APPRECIATION)/', 4, 'Certificate of …'],
            ['/THIS\s+IS\s+TO\s+CERTIFY|HEREBY\s+CERTIF|THIS\s+CERTIFIES/', 3, 'This is to certify'],
            ['/SUCCESSFULLY\s+(COMPLETED|PASSED|FINISHED)|HAS\s+COMPLETED|HAVING\s+(COMPLETED|PASSED)/', 3, 'successfully completed'],
            ['/\bTESDA\b|TECHNICAL\s+EDUCATION\s+(AND|&)\s+SKILLS/', 3, 'TESDA'],
            ['/\bAWARDED\b|\bCONFERRED\b|\bPRESENTED\s+TO\b|\bGIVEN\s+TO\b|\bGRANTED\s+TO\b/', 2, 'awarded to'],
            ['/\bCERTIFICATE\b|\bCERTIFICATION\b/', 2, 'Certificate'],
            ['/\bNC\s*(IV|III|II|I)\b/', 2, 'NC level'],
            ['/\bQUALIFICATION\b|\bCOMPETENC(Y|IES)\b|\bASSESSMENT\b/', 1, 'qualification'],
            ['/\bTRAINING\b|\bSEMINAR\b|\bWORKSHOP\b|\bCOURSE\b|\bPROGRAM\b/', 1, 'training'],
            ['/\bVALID\s+(UNTIL|UP\s*TO|THRU)|\bDATE\s+(OF\s+)?ISSU|\bISSUED\s+(ON|THIS|AT)\b|\bGIVEN\s+THIS\b/', 1, 'date issued'],
            ['/\bDIRECTOR\b|\bADMINISTRATOR\b|\bREGISTRAR\b|\bPRESIDENT\b|\bSUPERVISOR\b|\bASSESSOR\b/', 1, 'signatory'],
            ['/\bINSTITUTE\b|\bACADEMY\b|\bTRAINING\s+CENT(ER|RE)\b|\bCOLLEGE\b|\bSCHOOL\b|\bUNIVERSITY\b/', 1, 'school or training centre'],
        ];
        foreach ($markers as [$re, $pts, $label]) {
            if (preg_match($re, $upper)) { $score += $pts; $found[] = $label; }
        }
        [$title] = $this->match_qualification($upper);
        if ($title !== null) { $score += 2; $found[] = 'known TESDA qualification'; }

        // what else the document might be
        $kind = null;
        $resume = (int) (bool) preg_match('/CURRICULUM\s+VITAE|\bRESUME\b|\bR[EÉ]SUM[EÉ]\b|PERSONAL\s+DATA\s+SHEET|BIO-?DATA/', $upper)
                + (int) (bool) preg_match('/WORK\s+EXPERIENCE|EMPLOYMENT\s+HISTORY|WORK\s+HISTORY/', $upper)
                + (int) (bool) preg_match('/EDUCATIONAL\s+(BACKGROUND|ATTAINMENT)|\bEDUCATION\b/', $upper)
                + (int) (bool) preg_match('/CHARACTER\s+REFERENCES?|\bOBJECTIVES?\b|\bREFERENCES\b/', $upper);
        if ($resume >= 2) $kind = 'resume';
        elseif (preg_match('/OFFICIAL\s+RECEIPT|SALES\s+INVOICE|\bINVOICE\b|TOTAL\s+(AMOUNT|DUE)|\bAMOUNT\s+PAID\b|\bVAT(ABLE)?\b/', $upper)) $kind = 'receipt';
        elseif (preg_match('/PAY\s*SLIP|NET\s+PAY|GROSS\s+PAY|PAYROLL/', $upper)) $kind = 'payslip';
        elseif (preg_match("/DRIVER'?S\s+LICENSE|LICENSE\s+NO|PHILSYS|PHILIPPINE\s+IDENTIFICATION|\bUMID\b|POSTAL\s+ID|VOTER'?S\s+ID|PASSPORT\s+NO|\bPHILHEALTH\b|SOCIAL\s+SECURITY\s+SYSTEM/", $upper)
               || (preg_match('/DATE\s+OF\s+BIRTH|BIRTH\s*DATE/', $upper) && preg_match('/\bSEX\b|\bBLOOD\s+TYPE\b/', $upper))) $kind = 'id';
        elseif (preg_match('/TRANSCRIPT\s+OF\s+RECORDS|REPORT\s+CARD|FORM\s+138|GENERAL\s+WEIGHTED\s+AVERAGE/', $upper)) $kind = 'school_record';
        elseif (preg_match('/BARANGAY\s+CLEARANCE|POLICE\s+CLEARANCE|NBI\s+CLEARANCE/', $upper)) $kind = 'clearance';

        $strong = (bool) array_intersect($found, ['National Certificate', 'Certificate of …', 'This is to certify', 'TESDA', 'successfully completed']);
        if ($kind !== null && !$strong) {
            $verdict = 'not_certificate';
        } elseif ($score >= 6 && $strong) {
            $verdict = 'certificate';
        } elseif ($score >= 3 && in_array('Certificate', $found, true) || ($strong && $score >= 3)) {
            $verdict = 'unsure';
        } else {
            $verdict = 'not_certificate';
        }
        return ['verdict' => $verdict, 'kind' => $verdict === 'not_certificate' ? $kind : null, 'score' => $score, 'found' => $found];
    }

    private function normalize(string $text): string
    {
        $text = str_replace(["\r\n", "\r", "\t"], ["\n", "\n", ' '], $text);
        // Common OCR confusions inside the "NC II" token
        $text = preg_replace_callback('/\bN\s*[C©]\s*[-:]?\s*([IVLl1|!]{1,4})\b/u', function ($m) {
            return 'NC ' . strtr($m[1], ['l' => 'I', 'L' => 'I', '1' => 'I', '|' => 'I', '!' => 'I']);
        }, $text);
        $text = preg_replace('/[^\S\n]+/u', ' ', $text);
        return (string) $text;
    }

    private function find_nc_level(string $upper): ?string
    {
        if (preg_match('/NATIONAL\s+CERTIFICATE\s*(?:LEVEL)?\s*\(?\s*(IV|III|II|I|4|3|2|1)\b/', $upper, $m)
            || preg_match('/\bNC\s*(IV|III|II|I)\b/', $upper, $m)) {
            return strtr($m[1], ['4' => 'IV', '3' => 'III', '2' => 'II', '1' => 'I']);
        }
        return null;
    }

    private function level_for_nc(?string $nc): ?string
    {
        return ['I' => 'beginner', 'II' => 'intermediate', 'III' => 'advanced', 'IV' => 'expert'][$nc ?? ''] ?? null;
    }

    private function tokens(string $s): array
    {
        $s = strtolower(preg_replace('/[^a-z0-9 ]/i', ' ', $s));
        $words = array_filter(explode(' ', $s), fn($w) => strlen($w) >= 2 && !in_array($w, self::STOP, true));
        return array_values(array_unique($words));
    }

    /** Best known qualification whose words all (or nearly all) appear in the text. */
    private function match_qualification(string $upper): array
    {
        $textWords = array_flip($this->tokens($upper));
        $best = null; $bestScore = 0.0; $bestLen = 0;

        foreach (self::QUALIFICATIONS as $title => $category) {
            $words = $this->tokens($title);
            if (!$words) continue;
            $hit = 0;
            foreach ($words as $w) {
                if (isset($textWords[$w])) { $hit++; continue; }
                // tolerate one OCR typo in longer words
                if (strlen($w) >= 6) {
                    foreach ($textWords as $tw => $_) {
                        if (abs(strlen($tw) - strlen($w)) <= 1 && levenshtein($tw, $w) <= 1) { $hit++; break; }
                    }
                }
            }
            $score = $hit / count($words);
            // Abbreviation in brackets (SMAW, GTAW…) is strong evidence on its own
            if (preg_match('/\(([A-Z]{3,6})\)/', $title, $ab) && preg_match('/\b' . $ab[1] . '\b/', $upper)) {
                $score = max($score, 0.9);
            }
            $len = count($words);
            if ($score >= 0.75 && ($score > $bestScore || ($score === $bestScore && $len > $bestLen))) {
                $best = [$title, $category]; $bestScore = $score; $bestLen = $len;
            }
        }
        return $best ?? [null, null];
    }

    /** For certificates we don't know: the line naming the course/qualification. */
    private function guess_title(string $text): ?string
    {
        $lines = array_values(array_filter(array_map('trim', explode("\n", $text)), fn($l) => $l !== ''));

        foreach ($lines as $i => $line) {
            if (preg_match('/\bNC\s*(I{1,3}|IV)\b/', $line) && !preg_match('/NATIONAL\s+CERTIFICATE/i', $line)) {
                return $this->clean_title($line);
            }
        }
        $pattern = '/(?:qualification|course|training\s+on|seminar\s+on|completed\s+the|completing\s+the|for\s+having\s+(?:satisfactorily\s+)?(?:completed|passed)(?:\s+the)?|in)\s*[:\-]?\s*$/i';
        foreach ($lines as $i => $line) {
            if (preg_match($pattern, $line) && isset($lines[$i + 1])) {
                $next = $this->clean_title($lines[$i + 1]);
                if ($next !== null) return $next;
            }
            if (preg_match('/(?:qualification|course|training\s+on|seminar\s+on)\s*[:\-]\s*(.{4,90})$/i', $line, $m)) {
                $t = $this->clean_title($m[1]);
                if ($t !== null) return $t;
            }
        }
        return null;
    }

    private function clean_title(string $s): ?string
    {
        $s = trim(preg_replace('/[^A-Za-z0-9()\/&.,\'\- ]/', ' ', $s));
        $s = trim(preg_replace('/\s+/', ' ', $s), " .,-");
        $words = str_word_count($s);
        if (strlen($s) < 4 || strlen($s) > 120 || $words < 1 || $words > 12) return null;
        if (preg_match('/^(this|is|that|certificate|republic|philippines|awarded|name|date)/i', $s)) return null;
        $s = ucwords(strtolower($s), " (/-");
        // keep short joining words lowercase ("First Aid and Life Support"), acronyms upper
        $s = preg_replace_callback('/(?<=\s)(And|Of|The|In|For|On|To)(?=\s)/', fn($m) => strtolower($m[1]), $s);
        return preg_replace_callback('/\((\w{2,6})\)/', fn($m) => '(' . strtoupper($m[1]) . ')', $s);
    }

    private function date_after(string $text, string $labelPattern): ?string
    {
        $date = '((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}(?:st|nd|rd|th)?\s+(?:day\s+of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*,?\s+\d{4}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2})';
        if (preg_match('/' . $labelPattern . '\s*[:\-]?\s*' . $date . '/i', $text, $m)) {
            return $this->to_iso($m[1]);
        }
        return null;
    }

    private function first_date(string $text): ?string
    {
        if (preg_match('/((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4})/i', $text, $m)) {
            return $this->to_iso($m[1]);
        }
        return null;
    }

    private function to_iso(string $raw): ?string
    {
        $raw = preg_replace('/(\d)(st|nd|rd|th)\b/i', '$1', $raw);
        $raw = preg_replace('/\bday\s+of\s+/i', '', $raw);
        $raw = str_replace(',', '', $raw);
        // dd/mm vs mm/dd: Philippine documents use mm/dd/yyyy
        $ts = strtotime($raw);
        if ($ts === false) return null;
        $year = (int) date('Y', $ts);
        if ($year < 1980 || $year > (int) date('Y') + 10) return null;
        return date('Y-m-d', $ts);
    }
}
