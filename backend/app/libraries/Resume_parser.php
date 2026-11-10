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
        ];

        if (trim($text) === '') {
            return $result;
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
        foreach (array_slice($lines, 0, 8) as $line) {
            if (preg_match('/@|https?:|www\.|phone|email|curriculum|resume|biodata|page\s*\d/i', $line)) {
                continue;
            }
            if (preg_match('/^[A-Z][a-zA-Z\.\'\- ]{3,50}$/', $line)) {
                $wordCount = str_word_count($line);
                if ($wordCount >= 2 && $wordCount <= 5) {
                    $result['full_name'] = ucwords(strtolower($line));
                    break;
                }
            }
        }

        // --- Location (Oriental Mindoro towns preferred, then major PH cities) ---
        $allLocations = array_merge(self::TOWNS, self::PH_CITIES);
        foreach ($allLocations as $town) {
            if (stripos($flat, $town) !== false) {
                $result['location'] = $town;
                break;
            }
        }

        // --- Bio / Professional Summary ---
        $bioPatterns = [
            '/(?:objective|summary|profile|about me|career objective|professional summary)[:\s\-]*([\s\S]{30,500?}?)(?:\n\n|\n[A-Z]{3,}|\z)/i',
        ];
        foreach ($bioPatterns as $pat) {
            if (preg_match($pat, $text, $m)) {
                $bio = trim(preg_replace('/\s+/', ' ', $m[1]));
                if (strlen($bio) > 20) {
                    $result['bio'] = substr($bio, 0, 500);
                    break;
                }
            }
        }

        // --- Skills extraction ---
        $detectedSkills = [];
        foreach (self::KNOWN_SKILLS as $skill) {
            if (stripos($flat, $skill) !== false) {
                $detectedSkills[] = ucwords($skill);
            }
        }

        if (preg_match('/(?:skills|competencies|expertise|technical skills)[:\s\-]*([\s\S]{10,800?}?)(?:\n\n|\n[A-Z]{3,}|\z)/i', $text, $m)) {
            $skillBlock = $m[1];
            $rawSkills = preg_split('/[,;\n•·\-]+/', $skillBlock);
            foreach ($rawSkills as $rs) {
                $rs = trim(preg_replace('/[^A-Za-z0-9 \+\#\.]/', '', $rs));
                if (strlen($rs) >= 2 && strlen($rs) <= 50) {
                    $candidate = ucwords(strtolower($rs));
                    if (!in_array($candidate, $detectedSkills, true)) {
                        $detectedSkills[] = $candidate;
                    }
                }
            }
        }

        $result['skills'] = array_slice(array_unique($detectedSkills), 0, 20);

        return $result;
    }

    /**
     * Extract raw text from file path based on extension (.txt, .pdf, .docx).
     *
     * @param string $path
     * @param string $mime
     * @return string
     */
    public function extract_text(string $path, string $mime = ''): string
    {
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        if ($ext === 'txt' || str_contains($mime, 'text/plain')) {
            return (string) @file_get_contents($path);
        }

        if ($ext === 'pdf' || str_contains($mime, 'pdf')) {
            $content = (string) @file_get_contents($path);
            $text = '';
            if (preg_match_all('/\((.*?)\)\s*Tj/s', $content, $m)) {
                $text .= implode(' ', $m[1]) . ' ';
            }
            if (preg_match_all('/\[(.*?)\]\s*TJ/s', $content, $m)) {
                foreach ($m[1] as $chunk) {
                    if (preg_match_all('/\((.*?)\)/s', $chunk, $sub)) {
                        $text .= implode('', $sub[1]) . ' ';
                    }
                }
            }
            $clean = preg_replace('/[^\x20-\x7E\r\n\t]/', ' ', $text);
            return trim($clean) !== '' ? $clean : $this->ascii_scrape($content);
        }

        if ($ext === 'docx' || str_contains($mime, 'wordprocessingml')) {
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

    private function ascii_scrape(string $raw): string
    {
        if (preg_match_all('/[A-Za-z0-9@\.\,\-\+\(\)\/\:\;\s]{4,}/', $raw, $matches)) {
            return implode(' ', $matches[0]);
        }
        return '';
    }
}
