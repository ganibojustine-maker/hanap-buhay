<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * Resume Parser Library
 * ------------------------------------------------------------------
 * Custom library placed in app/libraries following LavaLust structure.
 * Extracts candidate information (name, email, phone, location, bio,
 * and skills) from uploaded documents (.pdf, .docx, .txt).
 */
class Resume_parser
{
    private const TOWNS = [
        'Baco', 'Bansud', 'Bongabong', 'Bulalacao', 'Calapan City',
        'Gloria', 'Mansalay', 'Naujan', 'Pinamalayan', 'Pola',
        'Puerto Galera', 'Roxas', 'San Teodoro', 'Socorro', 'Victoria'
    ];

    private const PH_CITIES = [
        'Manila', 'Quezon City', 'Makati', 'Cebu', 'Davao',
        'Batangas', 'Laguna', 'Cavite', 'Rizal', 'Bulacan', 'Pampanga'
    ];

    private const KNOWN_SKILLS = [
        // Trade & Technical
        'welding', 'carpentry', 'masonry', 'plumbing', 'electrical wiring', 'electrician',
        'painting', 'roofing', 'tiling', 'fabrication', 'construction',
        // Technology & Digital
        'computer', 'microsoft office', 'ms office', 'excel', 'word', 'powerpoint',
        'photoshop', 'autocad', 'coding', 'programming', 'html', 'css', 'javascript',
        'php', 'python', 'java', 'mysql', 'database', 'web design', 'networking',
        // Service & Hospitality
        'customer service', 'cashiering', 'sales', 'marketing', 'cooking', 'baking',
        'food preparation', 'bartending', 'housekeeping', 'cleaning', 'laundry',
        'caregiving', 'nursing', 'first aid', 'driving', 'motorcycle', 'forklift',
        // Communication
        'english', 'tagalog', 'bisaya', 'communication',
        // Agriculture & Livelihood
        'farming', 'fishing', 'agriculture', 'livestock', 'poultry',
        // Office Administration
        'accounting', 'bookkeeping', 'payroll', 'data entry', 'typing', 'filing',
        'leadership', 'management', 'supervision', 'teamwork', 'problem solving'
    ];

    /** Marker written by the hanapbuhay Resume Builder (frontend/src/utils/resumePdf.js). */
    private const EMBED_MARKER = 'HBR1:';

    private const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];

    /**
     * Resumes made with the hanapbuhay Resume Builder carry their own data
     * (base64 JSON after the HBR1: marker in the PDF info dictionary), so every
     * profile field can be filled exactly instead of guessed from text.
     *
     * @return array|null same shape as parse(), or null when the file has no marker
     */
    public function read_embedded(string $path): ?array
    {
        $raw = (string) @file_get_contents($path);
        if ($raw === '' || !preg_match('/' . preg_quote(self::EMBED_MARKER, '/') . '([A-Za-z0-9+\/=]{20,})/', $raw, $m)) {
            return null;
        }
        $json = base64_decode($m[1], true);
        $data = $json !== false ? json_decode($json, true, 16) : null;
        if (!is_array($data)) return null;

        $str = fn($v, $max = 255) => is_scalar($v) && trim((string) $v) !== '' ? mb_substr(trim((string) $v), 0, $max) : null;

        $town = $str($data['town'] ?? null, 150);
        if ($town !== null) {
            foreach (self::TOWNS as $t) {
                if (strcasecmp($t, $town) === 0) { $town = $t; break; }
            }
        }

        $items = [];
        foreach (array_slice((array) ($data['skills'] ?? []), 0, 40) as $s) {
            $name = $str(is_array($s) ? ($s['name'] ?? null) : $s);
            if ($name === null || mb_strlen($name) < 2) continue;
            $level = is_array($s) && in_array($s['level'] ?? '', self::LEVELS, true) ? $s['level'] : null;
            $items[mb_strtolower($name)] = ['skill_name' => $name, 'level' => $level, 'source' => 'self', 'certificate' => null, 'category' => null];
        }
        foreach (array_slice((array) ($data['certifications'] ?? []), 0, 20) as $c) {
            if (!is_array($c)) continue;
            $title = $str($c['title'] ?? null);
            if ($title === null || mb_strlen($title) < 2) continue;
            $issuer = (string) ($str($c['issuer'] ?? null, 150) ?? '');
            $isTesda = stripos($issuer . ' ' . $title, 'tesda') !== false || preg_match('/\bNC\s*(I{1,3}|IV)\b/i', $title);
            $nc = preg_match('/\bNC\s*(IV|III|II|I)\b/i', $title, $mm) ? strtoupper($mm[1]) : null;
            $items[mb_strtolower($title)] = [
                'skill_name'  => $title,
                'level'       => ['I' => 'beginner', 'II' => 'intermediate', 'III' => 'advanced', 'IV' => 'expert'][$nc ?? ''] ?? null,
                'source'      => $isTesda ? 'tesda' : 'training',
                'certificate' => $str($c['number'] ?? null, 255) ?? ($isTesda ? 'TESDA' . ($nc ? " NC $nc" : '') : ($issuer ?: null)),
                'category'    => null,
            ];
        }
        $items = array_values($items);

        return [
            'full_name'   => $str($data['full_name'] ?? null, 150),
            'email'       => filter_var($data['email'] ?? '', FILTER_VALIDATE_EMAIL) ? strtolower($data['email']) : null,
            'phone'       => $str(preg_replace('/[^\d+]/', '', (string) ($data['phone'] ?? '')), 32),
            'location'    => $town,
            'address'     => $str($data['address'] ?? null),
            'bio'         => $str($data['about'] ?? null, 5000),
            'skills'      => array_map(fn($i) => $i['skill_name'], $items),
            'skill_items' => $items,
            'template'    => true,
        ];
    }

    /**
     * Parse resume text and extract structured profile attributes.
     *
     * @param string $text
     * @param string $filename
     * @return array
     */
    public function parse(string $text, string $filename = ''): array
    {
        $result = [
            'full_name' => null,
            'email'     => null,
            'phone'     => null,
            'location'  => null,
            'bio'       => null,
            'skills'    => [],
            'skill_items' => [],
            'template'  => false,
        ];

        if (trim($text) === '') {
            return $result;
        }

        // Labeled fields ("Name: …", "Mobile No.: …") win over pattern guesses
        if (preg_match('/^\s*(?:full\s*)?name\s*[:\-]\s*([A-Za-z][A-Za-z.\'\- ]{3,60})$/im', $text, $m)) {
            $result['full_name'] = ucwords(strtolower(trim($m[1])));
        }

        $flat = strtolower($text);

        // --- Email ---
        if (preg_match('/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/', $text, $m)) {
            $result['email'] = strtolower($m[0]);
        }

        // --- Phone (Philippine formats: 09xx, +639xx, 043-xxx) ---
        if (preg_match('/(?:\+63|0)[\s\-]?(?:9\d{2}|\d{2,3})[\s\-]?\d{3}[\s\-]?\d{4}/', $text, $m)) {
            $result['phone'] = preg_replace('/[^\d+]/', '', $m[0]);
        }

        // --- Candidate Name ---
        $lines = array_values(array_filter(array_map('trim', explode("\n", $text)), fn($l) => strlen($l) > 1));
        $headingWords = '/^(about(\s+me)?|objective|career\s+objective|profile|summary|professional\s+summary|skills|technical\s+skills|education|experience|work\s+experience|employment|contact|personal\s+(information|data)|certifications?|trainings?|references?|character\s+references|qualifications?)\b/i';
        foreach ($result['full_name'] ? [] : array_slice($lines, 0, 8) as $line) {
            if (preg_match('/@|https?:|www\.|phone|email|curriculum|resume|biodata|page\s*\d/i', $line) || preg_match($headingWords, $line)) {
                continue;
            }
            if (preg_match('/^\p{Lu}[\p{L}\.\'\- ]{3,50}$/u', $line)) {
                $wordCount = count(preg_split('/\s+/', $line));
                if ($wordCount >= 2 && $wordCount <= 5) {
                    $result['full_name'] = mb_convert_case(mb_strtolower($line), MB_CASE_TITLE);
                    break;
                }
            }
        }

        // --- Location: a town on the address line first, else the town mentioned first ---
        $allLocations = array_merge(self::TOWNS, self::PH_CITIES);
        $addressLine = preg_match('/^.*(?:address|town|location|tirahan|municipality)\s*:.*$/im', $text, $am) ? strtolower($am[0]) : '';
        $bestPos = PHP_INT_MAX;
        foreach ($allLocations as $town) {
            if ($addressLine !== '' && stripos($addressLine, $town) !== false) {
                $result['location'] = $town;
                break;
            }
            $pos = stripos($flat, strtolower($town));
            if ($pos !== false && $pos < $bestPos) {
                $bestPos = $pos;
                $result['location'] = $town;
            }
        }

        // --- Bio / Professional Summary (runs until a blank line or the next ALL-CAPS heading) ---
        $nextHeading = '(?:\n\s*\n|\n[A-Z][A-Z &\/]{2,}\s*(?:\n|$)|\z)';
        if (preg_match('/(?i:career objective|professional summary|objective|summary|profile|about me)\s*[:\-]?\s*\n?([\s\S]{30,1500}?)' . $nextHeading . '/', $text, $m)) {
            $bio = trim(preg_replace('/\s+/', ' ', $m[1]));
            if (mb_strlen($bio) > 20) {
                $result['bio'] = mb_substr($bio, 0, 1000);
            }
        }

        // --- Skills extraction ---
        $items = [];
        $addItem = function (string $name, ?string $level = null, string $source = 'self', ?string $cert = null) use (&$items) {
            $name = trim(preg_replace('/\s+/', ' ', $name), " .,;:-");
            if (mb_strlen($name) < 2 || mb_strlen($name) > 80) return;
            $key = mb_strtolower($name);
            if (!isset($items[$key])) {
                $items[$key] = ['skill_name' => $name, 'level' => $level, 'source' => $source, 'certificate' => $cert, 'category' => null];
            } elseif ($level && !$items[$key]['level']) {
                $items[$key]['level'] = $level;
            }
        };

        // Skills section: one skill per line/comma, "(Advanced)" read as the level
        if (preg_match('/(?i:technical skills|skills|competencies|expertise)\s*[:\-]?\s*\n?([\s\S]{3,1500}?)' . $nextHeading . '/', $text, $m)) {
            foreach (preg_split('/[,;\n•·]+|\s-\s/u', $m[1]) as $rs) {
                $level = null;
                if (preg_match('/\(?\b(beginner|intermediate|advanced|expert)\b\)?/i', $rs, $lm)) {
                    $level = strtolower($lm[1]);
                    $rs = str_replace($lm[0], '', $rs);
                }
                $rs = trim(preg_replace('/[^\p{L}0-9 \+\#\.\/()&\-]/u', '', $rs));
                if ($rs !== '' && mb_strlen($rs) <= 50) $addItem(mb_convert_case($rs, MB_CASE_TITLE), $level);
            }
        }

        // TESDA qualifications anywhere in the resume ("… NC II"), with a nearby certificate number
        foreach ($lines as $i => $line) {
            if (preg_match('/^(.{3,100}?\bNC\s*(IV|III|II|I))\b/', $line, $nm)) {
                $cert = null;
                $near = implode(' ', array_slice($lines, $i, 3));
                if (preg_match('/(?:certificate|cert\.?)\s*(?:no|number)\.?\s*[:#]?\s*([A-Z0-9\-]{6,30})/i', $near, $cm)) $cert = $cm[1];
                $lvl = ['I' => 'beginner', 'II' => 'intermediate', 'III' => 'advanced', 'IV' => 'expert'][$nm[2]];
                $addItem(trim($nm[1]), $lvl, 'tesda', $cert ?? 'TESDA NC ' . $nm[2]);
            }
        }

        foreach (self::KNOWN_SKILLS as $skill) {
            if (preg_match('/\b' . preg_quote($skill, '/') . '\b/i', $flat)) {
                $addItem(ucwords($skill));
            }
        }

        $result['skill_items'] = array_slice(array_values($items), 0, 25);
        $result['skills'] = array_map(fn($i) => $i['skill_name'], $result['skill_items']);

        return $result;
    }

    /**
     * Extract raw text from file path based on extension (.txt, .pdf, .docx).
     * Uploaded temp files have no extension, so pass the original one as $ext.
     *
     * @param string $path
     * @param string $mime
     * @param string $ext
     * @return string
     */
    /* ── what kind of file is this really? ───────────────────────────── */

    /**
     * The first bytes of common formats. A browser's "type" and the file name can both
     * be wrong (or a rename), so the decision is made on the bytes.
     *
     * @return string pdf | docx | doc | rtf | txt | image | video | audio | archive | unknown
     */
    public function sniff(string $path): string
    {
        $fh = @fopen($path, 'rb');
        $head = $fh ? (string) fread($fh, 512) : '';
        if ($fh) fclose($fh);
        if ($head === '') return 'unknown';

        if (str_starts_with($head, '%PDF-')) return 'pdf';
        if (str_starts_with($head, '{\rtf')) return 'rtf';
        if (str_starts_with($head, "\xD0\xCF\x11\xE0")) return 'doc';   // old Office (.doc)

        // ISO Base Media (mp4/mov/3gp/m4v) — "ftyp" at offset 4
        if (strlen($head) > 11 && substr($head, 4, 4) === 'ftyp') {
            $brand = strtolower(substr($head, 8, 4));
            return str_starts_with($brand, 'm4a') ? 'audio' : 'video';
        }
        foreach ([
            "\x1A\x45\xDF\xA3" => 'video',   // Matroska / WebM
            'RIFF'             => 'riff',    // AVI or WAV, checked below
            'FLV'              => 'video',
            "OggS"             => 'video',   // ogg/ogv/oga
            "ID3"              => 'audio',
            "\xFF\xFB"         => 'audio',   // mp3
            "fLaC"             => 'audio',
            "Rar!"             => 'archive',
            "\x1F\x8B"         => 'archive',
        ] as $magic => $kind) {
            if (str_starts_with($head, $magic)) {
                if ($kind === 'riff') {
                    $form = substr($head, 8, 4);
                    return $form === 'AVI ' ? 'video' : ($form === 'WAVE' ? 'audio' : 'unknown');
                }
                return $kind;
            }
        }
        if (@getimagesizefromstring($head . str_repeat("\0", 64)) !== false) return 'image';
        if (preg_match('/^(\xFF\xD8\xFF|\x89PNG|GIF8|BM)/', $head)) return 'image';

        // ZIP container: .docx is a zip whose first entry is normally [Content_Types].xml
        if (str_starts_with($head, "PK\x03\x04")) {
            if (str_contains($head, 'word/') || str_contains($head, '[Content_Types].xml')) {
                if (class_exists('ZipArchive')) {
                    $zip = new ZipArchive();
                    if ($zip->open($path) === true) {
                        $isDocx = $zip->locateName('word/document.xml') !== false;
                        $zip->close();
                        if ($isDocx) return 'docx';
                    }
                    return 'archive';
                }
                return 'docx';
            }
            return 'archive';
        }

        // printable text with no NUL bytes
        if (!str_contains($head, "\0") && preg_match('//u', $head)) return 'txt';
        return 'unknown';
    }

    /** File kinds this app will never read as a resume, with the message people see. */
    public const REJECT_KINDS = [
        'video'   => 'That is a video file. Upload your resume as a PDF, DOCX or TXT document.',
        'audio'   => 'That is an audio file. Upload your resume as a PDF, DOCX or TXT document.',
        'image'   => 'That is a picture. A photo of a resume cannot be read — upload the PDF or DOCX file, or build one free in the Resume Builder. (A certificate photo belongs in Skills Passport → Certificates.)',
        'archive' => 'That is a ZIP or compressed file. Upload the resume document itself (PDF, DOCX or TXT).',
    ];

    /* ── is this text actually a resume? ─────────────────────────────── */

    /** Section headings a resume or CV almost always has (worth 2 points each). */
    private const RESUME_STRONG = [
        'resume', 'curriculum vitae', 'work experience', 'employment history', 'work history',
        'professional experience', 'job experience', 'education', 'educational background',
        'educational attainment', 'qualifications', 'skills', 'key skills', 'technical skills',
        'certifications', 'seminars and trainings', 'trainings attended', 'character reference',
        'personal information', 'career objective', 'objective', 'achievements', 'work history',
        'karanasan sa trabaho', 'karanasan', 'edukasyon', 'kasanayan', 'mga kasanayan',
    ];

    /** Words that support the guess but prove nothing alone (1 point each, 3 max). */
    private const RESUME_WEAK = [
        'references', 'contact number', 'date of birth', 'civil status', 'nationality', 'languages',
        'graduated', 'bachelor', 'high school', 'senior high', 'college', 'university', 'position',
        'responsibilities', 'duties', 'tesda', 'certificate', 'training', 'experience', 'summary',
        'profile', 'about me', 'present', 'employer', 'company',
    ];

    private function marker_hits(string $flat, array $markers, int $perHit, int $cap, array &$signals): int
    {
        $score = 0;
        foreach ($markers as $m) {
            if (preg_match('/(?<![a-z])' . preg_quote($m, '/') . '(?![a-z])/u', $flat)) {
                $score += $perHit;
                if (count($signals) < 8) $signals[] = $m;
                if ($score >= $cap) return $cap;
            }
        }
        return $score;
    }

    /**
     * Decide whether extracted text reads like a resume.
     *
     * Deliberately forgiving: a short, plain, one-page Filipino resume still passes with a
     * couple of headings and a contact number. It only turns away text with none of the usual
     * resume signals — a receipt, an essay, a contract, a random download — so the parser
     * never fills someone's profile from a file that isn't theirs to begin with.
     *
     * @return array{ok: bool, score: int, signals: string[], reason: ?string}
     */
    public function looks_like_resume(string $text): array
    {
        $flat = mb_strtolower(preg_replace('/\s+/', ' ', $text) ?? '');
        $wordCount = count(array_filter(preg_split('/\s+/', trim($flat)) ?: []));

        $signals = [];
        $score = 0;
        $score += $this->marker_hits($flat, self::RESUME_STRONG, 2, 6, $signals);
        $score += $this->marker_hits($flat, self::RESUME_WEAK, 1, 3, $signals);

        if (preg_match('/[\w.+-]+@[\w-]+\.[\w.]{2,}/', $text)) { $score += 2; $signals[] = 'email address'; }
        if (preg_match('/(\+?63|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}/', $text)) { $score += 2; $signals[] = 'mobile number'; }
        if (preg_match('/\b(19|20)\d{2}\s*(?:-|–|—|to)\s*((19|20)\d{2}|present)\b/i', $flat)) { $score += 2; $signals[] = 'date range'; }
        elseif (preg_match_all('/\b(19|20)\d{2}\b/', $flat) >= 2) { $score += 1; $signals[] = 'years'; }
        foreach (self::TOWNS as $t) {
            if (str_contains($flat, mb_strtolower($t))) { $score += 1; $signals[] = 'Oriental Mindoro town'; break; }
        }
        $skillHits = 0;
        foreach (self::KNOWN_SKILLS as $sk) if (str_contains($flat, $sk)) $skillHits++;
        if ($skillHits >= 2) { $score += 2; $signals[] = $skillHits . ' known skills'; }
        elseif ($skillHits === 1) { $score += 1; }

        // Too little text to judge: almost always a scan, a photo, or a PDF whose fonts
        // can't be read. A terse but clearly structured resume (high score) still passes.
        if ($wordCount < 12 || ($wordCount < 25 && $score < 6)) {
            return ['ok' => false, 'score' => $score, 'signals' => $signals,
                'reason' => 'There is almost no readable text in this file. If it is a scan or a photo, upload the original PDF or DOCX, or build one free with the Resume Builder.'];
        }
        if ($score < 6) {
            return ['ok' => false, 'score' => $score, 'signals' => $signals,
                'reason' => "This file doesn't read like a resume. A resume lists your work experience, education, skills and how to reach you. Check you picked the right file, or build one free with the Resume Builder."];
        }
        return ['ok' => true, 'score' => $score, 'signals' => array_values(array_unique($signals)), 'reason' => null];
    }

    public function extract_text(string $path, string $mime = '', string $ext = ''): string
    {
        $ext = strtolower($ext !== '' ? $ext : pathinfo($path, PATHINFO_EXTENSION));

        if ($ext === 'txt' || ($ext === '' && str_contains($mime, 'text/plain'))) {
            return (string) @file_get_contents($path);
        }

        if ($ext === 'pdf' || ($ext === '' && str_contains($mime, 'pdf'))) {
            return $this->pdf_text((string) @file_get_contents($path));
        }

        if ($ext === 'docx' || ($ext === '' && str_contains($mime, 'wordprocessingml'))) {
            if (class_exists('ZipArchive')) {
                $zip = new ZipArchive();
                if ($zip->open($path) === true) {
                    $xml = $zip->getFromName('word/document.xml');
                    $zip->close();
                    if ($xml) {
                        return strip_tags(str_replace(['</w:p>', '</w:br>'], ["\n", "\n"], $xml));
                    }
                }
            }
        }

        return '';
    }

    /**
     * Text of a PDF that uses standard (non-CID) fonts. Content streams are
     * usually Flate-compressed, so each stream is inflated before the text
     * operators are read. Scanned (image-only) PDFs yield nothing here.
     */
    public function pdf_text(string $content): string
    {
        $sources = [$content];
        if (preg_match_all('/stream\r?\n(.*?)\r?\nendstream/s', $content, $streams)) {
            foreach ($streams[1] as $s) {
                $inflated = @gzuncompress($s);
                if ($inflated === false) $inflated = @gzinflate($s);
                if ($inflated !== false && $inflated !== '') $sources[] = $inflated;
            }
        }

        $text = '';
        foreach ($sources as $src) {
            if (!preg_match_all('/(?:\[((?:[^\]\\\\]|\\\\.)*)\]\s*TJ|\(((?:[^()\\\\]|\\\\.)*)\)\s*(?:Tj|\'|")|(T\*|ET|Td|TD))/s', $src, $ops, PREG_SET_ORDER)) {
                continue;
            }
            foreach ($ops as $op) {
                if (!empty($op[3])) {
                    // new line / positioning: keep the line breaks the parser relies on
                    if ($op[3] === 'Td' || $op[3] === 'TD' || $op[3] === 'T*') $text .= "\n";
                    continue;
                }
                if (isset($op[2]) && $op[2] !== '') {
                    $text .= $this->pdf_string($op[2]);
                } elseif (isset($op[1]) && $op[1] !== '' && preg_match_all('/\(((?:[^()\\\\]|\\\\.)*)\)/s', $op[1], $sub)) {
                    $text .= implode('', array_map([$this, 'pdf_string'], $sub[1]));
                }
            }
            $text .= "\n";
        }

        $text = preg_replace("/\n\s*\n+/", "\n", $text);
        $clean = preg_replace('/[^\x20-\x7E\xA0-\xFF\x{2010}-\x{2027}\x{20AC}\r\n\t]/u', ' ', (string) $text) ?? $text;
        return trim($clean) !== '' ? $clean : $this->ascii_scrape($content);
    }

    /** Decode a PDF literal string (escapes and octal codes, WinAnsi bytes → UTF-8). */
    private function pdf_string(string $s): string
    {
        $out = preg_replace_callback('/\\\\([nrtbf()\\\\]|[0-7]{1,3})/', function ($m) {
            $map = ['n' => "\n", 'r' => '', 't' => ' ', 'b' => '', 'f' => '', '(' => '(', ')' => ')', '\\' => '\\'];
            return $map[$m[1]] ?? chr(octdec($m[1]) & 0xFF);
        }, $s);
        return mb_convert_encoding((string) $out, 'UTF-8', 'Windows-1252');
    }

    private function ascii_scrape(string $raw): string
    {
        if (preg_match_all('/[A-Za-z0-9@\.\,\-\+\(\)\/\:\;\s]{4,}/', $raw, $matches)) {
            return implode(' ', $matches[0]);
        }
        return '';
    }
}
