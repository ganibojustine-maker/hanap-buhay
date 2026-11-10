<?php
/**
 * Comprehensive Job Seed Script for Hanapbuhay
 * Covers:
 * - All 15 Oriental Mindoro Municipalities (including Bongabong, Baco, Bansud, Bulalacao, Calapan City)
 * - All 5 Job Types (full-time, part-time, contractual, freelance, gig)
 * - All 4 Salary Tiers (5k-10k, 10k-20k, 20k-35k, 35k+)
 */

$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) continue;
        if (strpos($line, '=') !== false) {
            list($k, $v) = explode('=', $line, 2);
            $_ENV[trim($k)] = trim($v, " \t\n\r\0\x0B\"'");
        }
    }
}

$dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'], $_ENV['DB_PORT'], $_ENV['DB_NAME']);
$opt = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT => false,
];
$pdo = new PDO($dsn, $_ENV['DB_USER'], $_ENV['DB_PASSWORD'], $opt);

echo "Connected to database!\n";

$jobs = [
    // --- BONGABONG (Focus for user filter test) ---
    [
        'employer_id' => 2,
        'title' => 'Agricultural Supply Chain & Inventory Officer',
        'company' => 'Bongabong Agri-Trade Center',
        'description' => 'Oversee inventory management, farm produce aggregation, and logistics coordination with local grain and crop farmers across Bongabong.',
        'requirements' => 'Experience in warehouse operations or agricultural supply chains. Knowledge of inventory software and local dialects is an advantage.',
        'location' => 'Bongabong',
        'job_type' => 'full-time',
        'salary_min' => 20000.00,
        'salary_max' => 30000.00, // 20k-35k
        'skills_needed' => 'Inventory Management, Logistics, Supply Chain, MS Excel',
        'status' => 'active',
        'is_featured' => 1,
    ],
    [
        'employer_id' => 4,
        'title' => 'Cafe Barista & Front of House Assistant',
        'company' => 'Kape Mindoro - Bongabong Poblacion',
        'description' => 'Prepare espresso drinks, attend to customer orders, manage point-of-sale cashiering, and maintain a warm, welcoming cafe ambiance.',
        'requirements' => 'Enthusiastic personality, customer-service oriented. Prior barista or food service experience preferred but willing to train.',
        'location' => 'Bongabong',
        'job_type' => 'part-time',
        'salary_min' => 6000.00,
        'salary_max' => 9500.00, // 5k-10k
        'skills_needed' => 'Customer Service, Cashiering, Coffee Preparation, Food Handling',
        'status' => 'active',
        'is_featured' => 0,
    ],
    [
        'employer_id' => 10,
        'title' => 'Residential Construction Foreman',
        'company' => 'Southern Mindoro Builders Co.',
        'description' => 'Lead on-site masonry, concrete pouring, and framing teams for residential townhouse construction projects in Bongabong.',
        'requirements' => 'At least 3 years site lead or foreman experience. Able to interpret architectural blueprints and enforce safety protocols.',
        'location' => 'Bongabong',
        'job_type' => 'contractual',
        'salary_min' => 15000.00,
        'salary_max' => 20000.00, // 10k-20k
        'skills_needed' => 'Masonry, Carpentry, Blueprint Reading, Team Supervision, Safety',
        'status' => 'active',
        'is_featured' => 0,
    ],
    [
        'employer_id' => 5,
        'title' => 'Event Sound & Lights Technician',
        'company' => 'Bongabong Pro Events & Audio',
        'description' => 'Provide on-demand audio and stage lighting setup, live mixer tuning, and teardown for weekend fiestas, weddings, and municipal events.',
        'requirements' => 'Basic knowledge of PA sound systems, microphones, XLR cabling, and DMX lighting controllers.',
        'location' => 'Bongabong',
        'job_type' => 'gig',
        'salary_min' => 5000.00,
        'salary_max' => 8500.00, // 5k-10k
        'skills_needed' => 'Audio Mixing, PA Systems, Stage Lighting, Equipment Maintenance',
        'status' => 'active',
        'is_featured' => 0,
    ],
    [
        'employer_id' => 2,
        'title' => 'Agri-Commodities Digital Marketing Specialist',
        'company' => 'Bongabong Organic Cooperative',
        'description' => 'Design social media promos, manage Facebook/TikTok business pages, and run targeted campaigns for local organic rice and banana chips exports.',
        'requirements' => 'Portfolio of graphic design and social media campaign results. Proficiency in Canva or Adobe Photoshop.',
        'location' => 'Bongabong',
        'job_type' => 'freelance',
        'salary_min' => 18000.00,
        'salary_max' => 28000.00, // 10k-20k to 20k-35k
        'skills_needed' => 'Social Media Management, Canva, Content Writing, Digital Ads',
        'status' => 'active',
        'is_featured' => 0,
    ],
    [
        'employer_id' => 10,
        'title' => 'Rural Banking Branch Operations Lead',
        'company' => 'Mindoro Rural Credit Cooperative',
        'description' => 'Direct branch loans administration, supervise teller operations, oversee audit compliance, and expand microfinance services to farmers in Bongabong.',
        'requirements' => 'Degree in Finance, Business Administration, or related field. Minimum 4 years banking or microfinance leadership experience.',
        'location' => 'Bongabong',
        'job_type' => 'full-time',
        'salary_min' => 38000.00,
        'salary_max' => 50000.00, // 35k+
        'skills_needed' => 'Branch Management, Microfinance, Financial Auditing, Risk Compliance',
        'status' => 'active',
        'is_featured' => 1,
    ],

    // --- BACO ---
    [
        'employer_id' => 4,
        'title' => 'Eco-Tourism Site Coordinator & Guide',
        'company' => 'Baco River Adventures & Eco-Park',
        'description' => 'Facilitate eco-tours, assist tourists along river trekking routes, and ensure environmental cleanliness and safety regulations are upheld.',
        'requirements' => 'Strong communication skills, physical stamina, knowledge of Baco geography and eco-tourism principles. CPR/First Aid certification a plus.',
        'location' => 'Baco',
        'job_type' => 'full-time',
        'salary_min' => 12000.00,
        'salary_max' => 16000.00, // 10k-20k
        'skills_needed' => 'Tour Guiding, First Aid, Customer Relations, Environmental Awareness',
        'status' => 'active',
        'is_featured' => 0,
    ],
    [
        'employer_id' => 2,
        'title' => 'Citrus & Fruit Farm Caretaker',
        'company' => 'Baco Highlands Orchard',
        'description' => 'Manage seasonal calamansi and rambutan harvesting, drip irrigation monitoring, and organic fertilizing tasks.',
        'requirements' => 'Experience in tropical fruit crop care, irrigation lines, and basic agricultural machinery.',
        'location' => 'Baco',
        'job_type' => 'contractual',
        'salary_min' => 7000.00,
        'salary_max' => 9500.00, // 5k-10k
        'skills_needed' => 'Farming, Irrigation, Crop Care, Harvesting',
        'status' => 'active',
        'is_featured' => 0,
    ],

    // --- BANSUD ---
    [
        'employer_id' => 5,
        'title' => 'Automotive & Diesel Engine Mechanic',
        'company' => 'Bansud Auto Works & Diagnostics',
        'description' => 'Perform preventative maintenance, diesel injection repairs, brake system servicing, and diagnostic troubleshooting on utility vans and trucks.',
        'requirements' => 'TESDA NC II Automotive Servicing or minimum 2 years hands-on automotive repair experience.',
        'location' => 'Bansud',
        'job_type' => 'full-time',
        'salary_min' => 16000.00,
        'salary_max' => 22000.00, // 10k-20k / 20k-35k
        'skills_needed' => 'Diesel Engines, Brake Systems, Auto Electrical, Diagnostics',
        'status' => 'active',
        'is_featured' => 0,
    ],
    [
        'employer_id' => 4,
        'title' => 'Community Pharmacy Assistant',
        'company' => 'Bansud Health & Wellness Drugstore',
        'description' => 'Assist licensed pharmacist in inventory stocking, processing customer prescriptions, and counter cashiering.',
        'requirements' => 'Pharmacy service NC II or completed vocational training in health care assistance. Good interpersonal skills.',
        'location' => 'Bansud',
        'job_type' => 'part-time',
        'salary_min' => 6000.00,
        'salary_max' => 8500.00, // 5k-10k
        'skills_needed' => 'Pharmacy Assisting, Inventory, Cashiering, Customer Care',
        'status' => 'active',
        'is_featured' => 0,
    ],

    // --- BULALACAO ---
    [
        'employer_id' => 11,
        'title' => 'Island Resort Operations Supervisor',
        'company' => 'Bulalacao Bay Eco-Resort',
        'description' => 'Supervise island guest check-ins, oversee housekeeping and boat transfer scheduling, and coordinate guest island-hopping excursions.',
        'requirements' => 'Background in hotel and restaurant management (BS HRM / Tourism). Minimum 2 years resort operations supervisory experience.',
        'location' => 'Bulalacao',
        'job_type' => 'full-time',
        'salary_min' => 22000.00,
        'salary_max' => 32000.00, // 20k-35k
        'skills_needed' => 'Hospitality, Front Office, Resort Logistics, Staff Supervision',
        'status' => 'active',
        'is_featured' => 1,
    ],
    [
        'employer_id' => 11,
        'title' => 'Marine Outboard Engine Mechanic (On-Call)',
        'company' => 'Bulalacao Island Sea Transport',
        'description' => 'Diagnose, service, and maintain Yamaha/Suzuki 2-stroke and 4-stroke outboard boat motors for local tourist pumpboats.',
        'requirements' => 'Proven skill in outboard motor troubleshooting, carburetor tuning, propeller maintenance, and emergency sea repairs.',
        'location' => 'Bulalacao',
        'job_type' => 'gig',
        'salary_min' => 7000.00,
        'salary_max' => 10000.00, // 5k-10k
        'skills_needed' => 'Outboard Engines, Marine Mechanics, Troubleshooting',
        'status' => 'active',
        'is_featured' => 0,
    ],

    // --- CALAPAN CITY ---
    [
        'employer_id' => 10,
        'title' => 'Senior Structural & Site Project Engineer',
        'company' => 'Calapan Construction Corp',
        'description' => 'Lead execution of multi-story commercial building developments in Calapan City. Oversee subcontractor bids, concrete quality assurance, and project timelines.',
        'requirements' => 'Licensed Civil Engineer with at least 5 years site engineering experience. High proficiency in AutoCAD and project scheduling.',
        'location' => 'Calapan City',
        'job_type' => 'full-time',
        'salary_min' => 38000.00,
        'salary_max' => 55000.00, // 35k+
        'skills_needed' => 'Civil Engineering, AutoCAD, Project Management, Structural QC',
        'status' => 'active',
        'is_featured' => 1,
    ],
    [
        'employer_id' => 10,
        'title' => 'Commercial HVAC & Air Conditioning Specialist',
        'company' => 'Oriental Cool Air Solutions',
        'description' => 'Install, pressure test, and maintain VRF and split-type inverter air conditioning systems for commercial offices and retail stores in Calapan.',
        'requirements' => 'TESDA RAC NC II / NC III certification. Experienced with manifold gauges, copper brazing, and refrigerant recovery.',
        'location' => 'Calapan City',
        'job_type' => 'contractual',
        'salary_min' => 18000.00,
        'salary_max' => 26000.00, // 10k-20k to 20k-35k
        'skills_needed' => 'HVAC, Inverter Aircon, Refrigeration, Copper Brazing, Electrical',
        'status' => 'active',
        'is_featured' => 0,
    ],
    [
        'employer_id' => 5,
        'title' => 'Digital Content Creator & Video Editor',
        'company' => 'Calapan Creative Hub',
        'description' => 'Produce engaging short-form video reels, promotional photography, and graphic assets for local Mindoro brands and ecommerce partners.',
        'requirements' => 'Solid portfolio in video editing (CapCut, Premiere Pro, or DaVinci Resolve) and visual design.',
        'location' => 'Calapan City',
        'job_type' => 'part-time',
        'salary_min' => 8000.00,
        'salary_max' => 12000.00, // 5k-10k / 10k-20k
        'skills_needed' => 'Video Editing, Adobe Premiere, Canva, Content Strategy',
        'status' => 'active',
        'is_featured' => 0,
    ],
    [
        'employer_id' => 4,
        'title' => 'Weekend Catering Banquet Staff',
        'company' => 'Grand Calapan Catering & Events',
        'description' => 'Assist in food buffet setup, guest table service, food warming, and banquet hall clearing during Saturday and Sunday wedding receptions.',
        'requirements' => 'Pleasant grooming, punctual, courteous manners. Experience in food service or banquet waiting is a plus.',
        'location' => 'Calapan City',
        'job_type' => 'gig',
        'salary_min' => 5000.00,
        'salary_max' => 7500.00, // 5k-10k
        'skills_needed' => 'Food Service, Banquet Waiting, Guest Hospitality, Table Setting',
        'status' => 'active',
        'is_featured' => 0,
    ],

    // --- OTHER ORIENTAL MINDORO TOWNS ---
    [
        'employer_id' => 2,
        'title' => 'Coconut By-Products Factory Technician',
        'company' => 'Gloria Agri-Industrial Plant',
        'description' => 'Operate virgin coconut oil centrifuges, copra drying equipment, and oversee packaging line calibration.',
        'requirements' => 'Vocational machine operation training or 1+ year factory production experience.',
        'location' => 'Gloria',
        'job_type' => 'contractual',
        'salary_min' => 13000.00,
        'salary_max' => 17000.00,
        'skills_needed' => 'Machine Operation, Quality Control, Food Safety',
        'status' => 'active',
        'is_featured' => 0,
    ],
    [
        'employer_id' => 4,
        'title' => 'Indigenous Community Liaison Officer',
        'company' => 'Mansalay Cultural & Livelihood Initiative',
        'description' => 'Coordinate community livelihood workshops, fair trade craft fairs, and support Mangyan artisan cooperative programs.',
        'requirements' => 'Background in community development, social work, or cultural studies. Fluent in local dialect and respectful of indigenous traditions.',
        'location' => 'Mansalay',
        'job_type' => 'full-time',
        'salary_min' => 16000.00,
        'salary_max' => 22000.00,
        'skills_needed' => 'Community Organizing, Cultural Sensitivity, Facilitation',
        'status' => 'active',
        'is_featured' => 0,
    ],
    [
        'employer_id' => 2,
        'title' => 'Freshwater Fishery & Hatchery Assistant',
        'company' => 'Naujan Lake Aqua Farms',
        'description' => 'Monitor water pH and temperature, assist in tilapia fingerling feeding schedules, and net harvesting.',
        'requirements' => 'Willing to work outdoors on lakeside fish cages. Basic aquaculture experience welcomed.',
        'location' => 'Naujan',
        'job_type' => 'part-time',
        'salary_min' => 6500.00,
        'salary_max' => 9000.00,
        'skills_needed' => 'Aquaculture, Water Monitoring, Fish Handling',
        'status' => 'active',
        'is_featured' => 0,
    ],
    [
        'employer_id' => 10,
        'title' => 'Heavy Equipment Operator (Excavator / Backhoe)',
        'company' => 'Pinamalayan Infrastructure Works',
        'description' => 'Operate hydraulic excavators and backhoe loaders for provincial drainage and road widening projects.',
        'requirements' => 'TESDA Heavy Equipment Operation NC II with valid Professional Driver License (Code 8 / Restrictions 2,3,8).',
        'location' => 'Pinamalayan',
        'job_type' => 'full-time',
        'salary_min' => 24000.00,
        'salary_max' => 33000.00,
        'skills_needed' => 'Heavy Equipment, Excavator, Safety Protocols, Earthmoving',
        'status' => 'active',
        'is_featured' => 1,
    ],
    [
        'employer_id' => 4,
        'title' => 'Coastal Conservation Environmental Field Researcher',
        'company' => 'Pola Bay Marine Sanctuary Watch',
        'description' => 'Conduct weekly mangrove reforestation surveys, record sea turtle nesting sites, and document coral health data.',
        'requirements' => 'Degree in Biology, Environmental Science, or Fisheries. Strong swimming and report writing skills.',
        'location' => 'Pola',
        'job_type' => 'freelance',
        'salary_min' => 18000.00,
        'salary_max' => 25000.00,
        'skills_needed' => 'Environmental Science, Field Surveying, Marine Conservation, GIS',
        'status' => 'active',
        'is_featured' => 0,
    ],
    [
        'employer_id' => 11,
        'title' => 'Dive Shop Lead Instructor & Equipment Custodian',
        'company' => 'Puerto Galera Coral Divers',
        'description' => 'Lead open water diving sessions, manage scuba gear servicing and compressor air testing, and educate tourists on coral reef preservation.',
        'requirements' => 'PADI or SSI Certified Divemaster or Open Water Scuba Instructor. Clean safety record.',
        'location' => 'Puerto Galera',
        'job_type' => 'full-time',
        'salary_min' => 28000.00,
        'salary_max' => 38000.00,
        'skills_needed' => 'Scuba Diving, PADI Instructor, First Aid, Gear Maintenance',
        'status' => 'active',
        'is_featured' => 1,
    ],
    [
        'employer_id' => 5,
        'title' => 'Port Cargo Logistics & Dispatch Clerk',
        'company' => 'Roxas Port FastCat Logistics',
        'description' => 'Coordinate inter-island cargo manifesting, verify truck weigh-in slips, and organize roll-on/roll-off (RoRo) ferry vessel staging.',
        'requirements' => 'Detail-oriented, knowledgeable in computer encoding and shipping documentation.',
        'location' => 'Roxas',
        'job_type' => 'contractual',
        'salary_min' => 15000.00,
        'salary_max' => 20000.00,
        'skills_needed' => 'Logistics Encoding, Manifesting, Port Dispatch, Cargo Safety',
        'status' => 'active',
        'is_featured' => 0,
    ],
    [
        'employer_id' => 4,
        'title' => 'Organic Highland Coffee Harvester & Processor',
        'company' => 'San Teodoro Mountain Roast',
        'description' => 'Hand-pick ripe Liberica and Robusta coffee cherries, manage drying beds, and participate in wet-mill pulp removal.',
        'requirements' => 'Careful handling of produce, reliable stamina for hillside farms.',
        'location' => 'San Teodoro',
        'job_type' => 'part-time',
        'salary_min' => 5500.00,
        'salary_max' => 8000.00,
        'skills_needed' => 'Coffee Harvesting, Post-Harvest Processing, Sorting',
        'status' => 'active',
        'is_featured' => 0,
    ],
    [
        'employer_id' => 2,
        'title' => 'Lake Naujan Eco-Guide & Boatman',
        'company' => 'Socorro Inland Eco-Tours',
        'description' => 'Navigate motorized wooden boats across Lake Naujan for migratory bird-watching tourists and photographers.',
        'requirements' => 'Skilled motorized banca operator with valid boat crew safety certs. Friendly demeanor.',
        'location' => 'Socorro',
        'job_type' => 'gig',
        'salary_min' => 5000.00,
        'salary_max' => 7500.00,
        'skills_needed' => 'Boat Handling, Eco-Guiding, Bird Watching, Water Safety',
        'status' => 'active',
        'is_featured' => 0,
    ],
    [
        'employer_id' => 10,
        'title' => 'Agronomy Soil Scientist & Crop Nutrition Consultant',
        'company' => 'Victoria Central Rice Research Lab',
        'description' => 'Conduct laboratory soil testing, formulate organic NPK nutrient schedules, and deliver field advisories to grain farmers across Central Oriental Mindoro.',
        'requirements' => 'BS or MS in Agriculture (Agronomy or Soil Science). Experience with soil testing chemistry and field trials.',
        'location' => 'Victoria',
        'job_type' => 'full-time',
        'salary_min' => 36000.00,
        'salary_max' => 48000.00,
        'skills_needed' => 'Soil Science, Agronomy, Agricultural Chemistry, Crop Consulting',
        'status' => 'active',
        'is_featured' => 1,
    ],
];

$stmt = $pdo->prepare("
    INSERT INTO jobs (
        employer_id, title, company, description, requirements,
        location, job_type, salary_min, salary_max, skills_needed,
        status, is_featured, views, created_at
    ) VALUES (
        :employer_id, :title, :company, :description, :requirements,
        :location, :job_type, :salary_min, :salary_max, :skills_needed,
        :status, :is_featured, 0, NOW()
    )
");

$inserted = 0;
foreach ($jobs as $job) {
    // Check if job with exact same title and location already exists
    $check = $pdo->prepare("SELECT id FROM jobs WHERE title = :title AND location = :location");
    $check->execute([':title' => $job['title'], ':location' => $job['location']]);
    if ($check->fetch()) {
        echo "Skipping existing: {$job['title']} in {$job['location']}\n";
        continue;
    }

    $stmt->execute([
        ':employer_id'   => $job['employer_id'],
        ':title'         => $job['title'],
        ':company'       => $job['company'],
        ':description'   => $job['description'],
        ':requirements'  => $job['requirements'],
        ':location'      => $job['location'],
        ':job_type'      => $job['job_type'],
        ':salary_min'    => $job['salary_min'],
        ':salary_max'    => $job['salary_max'],
        ':skills_needed' => $job['skills_needed'],
        ':status'        => $job['status'],
        ':is_featured'   => $job['is_featured'],
    ]);
    $inserted++;
    echo "Inserted: [{$job['location']} | {$job['job_type']} | P{$job['salary_min']}-P{$job['salary_max']}] {$job['title']}\n";
}

echo "\nDone! Successfully inserted {$inserted} jobs.\n";

$total = $pdo->query("SELECT COUNT(*) FROM jobs WHERE status = 'active'")->fetchColumn();
echo "Total active jobs now in database: {$total}\n";
