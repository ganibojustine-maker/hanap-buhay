import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../auth.jsx'
import { api } from '../api.js'
import { Logo, IconSearch } from '../components/icons.jsx'
import { getJobImage } from '../utils/jobImages.js'

/* Geographically accurate coordinates for all 15 LGUs of Oriental Mindoro */
export const LGUS = {
  'Puerto Galera':  { coords: [13.5015, 120.9567], desc: 'Tourism, Diving & Marine Capital' },
  'San Teodoro':    { coords: [13.4300, 121.0180], desc: 'Eco-Tourism & Mountain Gateway' },
  'Baco':           { coords: [13.3592, 121.0964], desc: 'River Treks & Water Systems' },
  'Calapan City':   { coords: [13.4115, 121.1803], desc: 'Provincial Capital & Commercial Hub' },
  'Naujan':         { coords: [13.3236, 121.3031], desc: 'Rice Granary & Naujan Lake Basin' },
  'Victoria':       { coords: [13.1764, 121.2828], desc: 'Calamansi Capital of the Philippines' },
  'Socorro':        { coords: [13.0642, 121.4056], desc: 'Lake Trade & Agricultural Crossroad' },
  'Pola':           { coords: [13.1467, 121.4361], desc: 'Coastal Heritage & Marine Sanctuary' },
  'Pinamalayan':    { coords: [13.0333, 121.4833], desc: 'Rainbow City & Central Trade Hub' },
  'Gloria':         { coords: [12.9772, 121.4744], desc: 'Agro-Industrial & Commercial Corridor' },
  'Bansud':         { coords: [12.8639, 121.4861], desc: 'Metal Fabrication & Upland Farming' },
  'Bongabong':      { coords: [12.7483, 121.4878], desc: 'Southern Agricultural Trading Post' },
  'Roxas':          { coords: [12.5858, 121.5175], desc: 'Nautical Highway Ro-Ro Port Gateway' },
  'Mansalay':       { coords: [12.5297, 121.4386], desc: 'Mangyan Heritage & Coastal Fishery' },
  'Bulalacao':      { coords: [12.3278, 121.3417], desc: 'Southern Islands & Marine Fisheries' },
}

export const TOWN_NAMES = Object.keys(LGUS)
const PROVINCE_CENTER = [13.05, 121.30]
const PROVINCE_ZOOM = 9

export const CATEGORIES = [
  'All Sectors',
  'Trades & Construction',
  'Food & Hospitality',
  'Tech & Office',
  'Agriculture & Fisheries',
  'Transport & Logistics',
  'Healthcare & Services',
]

const JOB_TYPES = ['All Types', 'full-time', 'part-time', 'contractual', 'freelance', 'gig']

/* Distinct category styling with curated color palette and icons */
export const SECTOR_META = {
  'Trades & Construction': { icon: '🔨', color: '#D97706', bg: '#FEF3C7', border: '#B45309' },
  'Food & Hospitality':    { icon: '☕', color: '#059669', bg: '#D1FAE5', border: '#047857' },
  'Tech & Office':         { icon: '💻', color: '#2563EB', bg: '#DBEAFE', border: '#1D4ED8' },
  'Agriculture & Fisheries': { icon: '🌾', color: '#16A34A', bg: '#DCFCE7', border: '#15803D' },
  'Transport & Logistics': { icon: '⚓', color: '#7C3AED', bg: '#EDE9FE', border: '#6D28D9' },
  'Healthcare & Services': { icon: '🩺', color: '#E11D48', bg: '#FFE4E6', border: '#BE123C' },
}

/* Helper to classify jobs accurately into the 6 sectors */
export function detectCategory(job) {
  const t = `${job.title || ''} ${job.category || ''} ${job.description || ''} ${(job.skills_needed || []).join(' ')}`.toLowerCase()
  if (t.includes('weld') || t.includes('construct') || t.includes('foreman') || t.includes('carpenter') || t.includes('electric') || t.includes('mason') || t.includes('plumb') || t.includes('roof') || t.includes('metal') || t.includes('builder')) {
    return 'Trades & Construction'
  }
  if (t.includes('cafe') || t.includes('barista') || t.includes('restaurant') || t.includes('cook') || t.includes('food') || t.includes('dining') || t.includes('crew') || t.includes('catering') || t.includes('banquet') || t.includes('hotel') || t.includes('resort')) {
    return 'Food & Hospitality'
  }
  if (t.includes('tech') || t.includes('computer') || t.includes('it ') || t.includes('network') || t.includes('software') || t.includes('video') || t.includes('content') || t.includes('media') || t.includes('clerk') || t.includes('encoder') || t.includes('data') || t.includes('designer')) {
    return 'Tech & Office'
  }
  if (t.includes('farm') || t.includes('agri') || t.includes('crop') || t.includes('fish') || t.includes('marine') || t.includes('tilapia') || t.includes('rice') || t.includes('grain') || t.includes('citrus') || t.includes('calamansi') || t.includes('seafood') || t.includes('orchard')) {
    return 'Agriculture & Fisheries'
  }
  if (t.includes('port') || t.includes('cargo') || t.includes('mechanic') || t.includes('driver') || t.includes('truck') || t.includes('boat') || t.includes('ferry') || t.includes('logistics') || t.includes('transport') || t.includes('warehouse') || t.includes('manifest')) {
    return 'Transport & Logistics'
  }
  if (t.includes('health') || t.includes('nurse') || t.includes('clinic') || t.includes('care') || t.includes('doctor') || t.includes('medical') || t.includes('craft') || t.includes('artisan') || t.includes('community')) {
    return 'Healthcare & Services'
  }
  return 'Trades & Construction'
}

/* Comprehensive seed jobs spread accurately across Oriental Mindoro LGUs */
const REALISTIC_MINDORO_JOBS = [
  // Calapan City
  {
    id: 1,
    title: 'Commercial Construction Foreman',
    company: 'Calapan Construction Corp',
    category: 'Trades & Construction',
    location: 'Calapan City',
    landmark: 'Nautical Highway, Brgy. Bulusan',
    lat: 13.4085,
    lng: 121.1760,
    job_type: 'full-time',
    salary_min: 22000,
    salary_max: 32000,
    description: 'Lead masonry, steel rebar installation, and framing teams for commercial building developments along the Nautical Highway.',
    skills_needed: ['Masonry', 'Carpentry', 'Blueprint Reading', 'Site Safety'],
  },
  {
    id: 2,
    title: 'Restaurant Shift Supervisor & Cashier',
    company: 'SM City Calapan Dining Group',
    category: 'Food & Hospitality',
    location: 'Calapan City',
    landmark: 'SM City Calapan, Brgy. Bulusan',
    lat: 13.4110,
    lng: 121.1810,
    job_type: 'full-time',
    salary_min: 16000,
    salary_max: 21000,
    description: 'Manage dining floor staff, inventory controls, POS cashiering, and provide exceptional customer hospitality in a fast-paced mall restaurant.',
    skills_needed: ['POS Cashiering', 'Food Handling', 'Staff Supervision', 'Customer Service'],
  },
  {
    id: 3,
    title: 'IT Systems & Network Support Aide',
    company: 'Mindoro Tech Solutions',
    category: 'Tech & Office',
    location: 'Calapan City',
    landmark: 'Provincial Capitol Commercial Area',
    lat: 13.4180,
    lng: 121.1850,
    job_type: 'full-time',
    salary_min: 18000,
    salary_max: 25000,
    description: 'Hardware troubleshooting, LAN cable crimping, router setups, and PC maintenance for local government and corporate offices.',
    skills_needed: ['Hardware Repair', 'LAN Setup', 'Windows Troubleshooting', 'Printer Setup'],
  },
  {
    id: 4,
    title: 'Digital Content Creator & Video Editor',
    company: 'Calapan Creative Media Hub',
    category: 'Tech & Office',
    location: 'Calapan City',
    landmark: 'JP Rizal St., San Vicente',
    lat: 13.4140,
    lng: 121.1795,
    job_type: 'part-time',
    salary_min: 10000,
    salary_max: 15000,
    description: 'Produce short video reels, promotional photography, and social banners for local brands and agro-tourism initiatives.',
    skills_needed: ['CapCut', 'Premiere Pro', 'Photography', 'Canva'],
  },
  {
    id: 5,
    title: 'Weekend Catering Banquet Staff',
    company: 'Grand Calapan Catering & Events',
    category: 'Food & Hospitality',
    location: 'Calapan City',
    landmark: 'Brgy. Guinobatan',
    lat: 13.3980,
    lng: 121.1680,
    job_type: 'gig',
    salary_min: 6000,
    salary_max: 9000,
    description: 'Food buffet setup, table waiting, and banquet hall clearing during weekend weddings and official celebrations.',
    skills_needed: ['Table Service', 'Event Setup', 'Hospitality', 'Teamwork'],
  },
  {
    id: 37,
    title: 'Port Cargo Operations Checker',
    company: 'Calapan Harbor Freight Services',
    category: 'Transport & Logistics',
    location: 'Calapan City',
    landmark: 'Calapan Port Pier, San Antonio',
    lat: 13.4260,
    lng: 121.1965,
    job_type: 'full-time',
    salary_min: 17000,
    salary_max: 23000,
    description: 'Inspect arriving Batangas-Calapan fastcraft cargo manifests, palletized goods, and coordinate forklift staging.',
    skills_needed: ['Logistics', 'Manifest Checking', 'Port Safety', 'Inventory'],
  },

  // Puerto Galera
  {
    id: 6,
    title: 'Resort Operations & Front Desk Staff',
    company: 'El Galleon Dive Resort & Marina',
    category: 'Food & Hospitality',
    location: 'Puerto Galera',
    landmark: 'Sabang Beach Front',
    lat: 13.5230,
    lng: 120.9750,
    job_type: 'full-time',
    salary_min: 18000,
    salary_max: 24000,
    description: 'Warm guest greeting, check-in registration, dive tour bookings, and international tourist assistance.',
    skills_needed: ['Front Desk', 'English Communication', 'Guest Relations', 'Reservation Systems'],
  },
  {
    id: 7,
    title: 'Marine Outboard Engine Mechanic',
    company: 'PG Outboard & Banca Services',
    category: 'Transport & Logistics',
    location: 'Puerto Galera',
    landmark: 'Muelle Bay Port Pier',
    lat: 13.5040,
    lng: 120.9550,
    job_type: 'contractual',
    salary_min: 20000,
    salary_max: 28000,
    description: 'Diagnose and overhaul 2-stroke and 4-stroke outboard boat engines (Yamaha, Suzuki, Mercury) for tourist bankas and dive speedboats.',
    skills_needed: ['Engine Overhaul', 'Marine Mechanics', 'Fuel Systems', 'Preventive Maintenance'],
  },
  {
    id: 8,
    title: 'White Beach Tourist Booking Aide',
    company: 'White Beach Tourism Cooperative',
    category: 'Food & Hospitality',
    location: 'Puerto Galera',
    landmark: 'White Beach Strip',
    lat: 13.5080,
    lng: 120.9020,
    job_type: 'part-time',
    salary_min: 9000,
    salary_max: 13500,
    description: 'Assist arriving tourists with hotel inquiries, water-sports rentals, and environmental ticketing.',
    skills_needed: ['Tour Booking', 'Customer Care', 'Local Geography', 'Cash Handling'],
  },

  // Naujan
  {
    id: 9,
    title: 'Rice Mill Plant Dryer Operator',
    company: 'Naujan Grains Processing Co.',
    category: 'Agriculture & Fisheries',
    location: 'Naujan',
    landmark: 'Brgy. Barcenaga National Rd',
    lat: 13.3350,
    lng: 121.2980,
    job_type: 'full-time',
    salary_min: 18000,
    salary_max: 24000,
    description: 'Operate mechanical flatbed dryers, monitor moisture levels in palay grains, and oversee bagging lines.',
    skills_needed: ['Grain Drying', 'Machine Operation', 'Quality Checking', 'Warehouse Safety'],
  },
  {
    id: 10,
    title: 'Tilapia Aquaculture Logistics Lead',
    company: 'Naujan Lake Fisheries Cooperative',
    category: 'Agriculture & Fisheries',
    location: 'Naujan',
    landmark: 'Brgy. Bancuro Lake Shore',
    lat: 13.2950,
    lng: 121.3200,
    job_type: 'full-time',
    salary_min: 15000,
    salary_max: 20000,
    description: 'Coordinate fresh tilapia harvest, iced packing, and transport logistics to Calapan and Batangas markets.',
    skills_needed: ['Cold Chain', 'Logistics', 'Fish Quality Control', 'Inventory'],
  },

  // Victoria
  {
    id: 11,
    title: 'Citrus Harvest & Sorting Inspector',
    company: 'Victoria Calamansi Growers Guild',
    category: 'Agriculture & Fisheries',
    location: 'Victoria',
    landmark: 'Brgy. Alcate Processing Facility',
    lat: 13.1850,
    lng: 121.2750,
    job_type: 'full-time',
    salary_min: 15000,
    salary_max: 19500,
    description: 'Inspect fresh calamansi harvests, grading for puree processing and export shipment quality standards.',
    skills_needed: ['Grading', 'Sorting', 'Packaging', 'Produce Handling'],
  },
  {
    id: 12,
    title: 'Solar PV Rooftop Installer',
    company: 'Mindoro Clean Energy Solutions',
    category: 'Trades & Construction',
    location: 'Victoria',
    landmark: 'Brgy. Poblacion I',
    lat: 13.1720,
    lng: 121.2850,
    job_type: 'full-time',
    salary_min: 20000,
    salary_max: 28000,
    description: 'Install solar PV panels, inverters, racking systems, and DC cabling for farm estates and commercial warehouses.',
    skills_needed: ['Solar PV', 'Electrical Wiring', 'Rooftop Safety', 'Inverter Setup'],
  },

  // Bongabong
  {
    id: 13,
    title: 'Agricultural Commodities Trader Aide',
    company: 'Bongabong Agri-Trade Center',
    category: 'Agriculture & Fisheries',
    location: 'Bongabong',
    landmark: 'Brgy. Labasan Trading Complex',
    lat: 12.7550,
    lng: 121.4820,
    job_type: 'full-time',
    salary_min: 18000,
    salary_max: 25000,
    description: 'Record grain weight measurements, issue farmer receipts, and coordinate truck scheduling for southern Mindoro produce.',
    skills_needed: ['Weighing & Scaling', 'Bookkeeping', 'Supplier Relations', 'Data Entry'],
  },
  {
    id: 14,
    title: 'Cafe Barista & Assistant Manager',
    company: 'Kape Mindoro - Bongabong Poblacion',
    category: 'Food & Hospitality',
    location: 'Bongabong',
    landmark: 'Poblacion Commercial Street',
    lat: 12.7470,
    lng: 121.4890,
    job_type: 'part-time',
    salary_min: 8500,
    salary_max: 12000,
    description: 'Hand-brew specialty Mindoro coffee drinks, cashiering, bake fresh pastries, and maintain an inviting cafe atmosphere.',
    skills_needed: ['Espresso Brewing', 'Cashiering', 'Customer Relations', 'Food Safety'],
  },
  {
    id: 15,
    title: 'Live Audio & Stage Lighting Tech',
    company: 'Bongabong Pro Events & Sound',
    category: 'Trades & Construction',
    location: 'Bongabong',
    landmark: 'Brgy. Poblacion Plaza',
    lat: 12.7490,
    lng: 121.4860,
    job_type: 'gig',
    salary_min: 6500,
    salary_max: 10000,
    description: 'Setup PA line arrays, DMX stage lighting, and run sound mixers for municipal fiestas, concerts, and gatherings.',
    skills_needed: ['Audio Mixing', 'Cable Management', 'Stage Lighting', 'Live Setup'],
  },

  // Pinamalayan
  {
    id: 16,
    title: 'Commercial Hardware Store Supervisor',
    company: 'Rainbow City Builders Supply',
    category: 'Trades & Construction',
    location: 'Pinamalayan',
    landmark: 'Madrid Boulevard, Poblacion',
    lat: 13.0360,
    lng: 121.4810,
    job_type: 'full-time',
    salary_min: 17000,
    salary_max: 23000,
    description: 'Assist contractor orders for cement, rebar, PVC pipes, and power tools; manage stock restocking and floor sales.',
    skills_needed: ['Inventory Management', 'Sales Assistance', 'Construction Materials', 'POS'],
  },
  {
    id: 17,
    title: 'Shielded Metal Arc Welder (SMAW)',
    company: 'Pinamalayan Steel Fabrication',
    category: 'Trades & Construction',
    location: 'Pinamalayan',
    landmark: 'Brgy. Marfrancisco Highway',
    lat: 13.0280,
    lng: 121.4790,
    job_type: 'contractual',
    salary_min: 19000,
    salary_max: 26000,
    description: 'Fabricate custom steel window grills, security gates, truck sideboards, and structural steel trusses.',
    skills_needed: ['SMAW Welding', 'Metal Cutting', 'Blueprint Interpretation', 'Grinding'],
  },
  {
    id: 18,
    title: 'PC & Mobile Repair Technician',
    company: 'Central Mindoro Tech Clinic',
    category: 'Tech & Office',
    location: 'Pinamalayan',
    landmark: 'Morente St., Central District',
    lat: 13.0345,
    lng: 121.4855,
    job_type: 'full-time',
    salary_min: 15000,
    salary_max: 21000,
    description: 'Diagnose smartphone screens, laptop motherboards, re-install operating systems, and perform board-level soldering.',
    skills_needed: ['Micro-soldering', 'Laptop Repair', 'OS Reinstallation', 'Diagnostic Testing'],
  },

  // Roxas
  {
    id: 19,
    title: 'Cargo Manifest & Port Checker',
    company: 'Roxas Port Terminal Logistics Corp',
    category: 'Transport & Logistics',
    location: 'Roxas',
    landmark: 'Port of Dangay Ro-Ro Terminal',
    lat: 12.5890,
    lng: 121.5220,
    job_type: 'full-time',
    salary_min: 17000,
    salary_max: 23000,
    description: 'Inspect Ro-Ro cargo containers, cross-check vessel manifests, and coordinate vehicle boarding queues for Caticlan ferries.',
    skills_needed: ['Manifest Verification', 'Port Operations', 'Vehicle Inspection', 'Logistics'],
  },
  {
    id: 20,
    title: 'Heavy Truck Diesel Mechanic',
    company: 'Southern Island Transport Fleet',
    category: 'Transport & Logistics',
    location: 'Roxas',
    landmark: 'Dangay Port Approach Road',
    lat: 12.5820,
    lng: 121.5140,
    job_type: 'full-time',
    salary_min: 22000,
    salary_max: 30000,
    description: 'Maintain 10-wheeler wing vans, prime movers, air brake systems, and transmission overhauls.',
    skills_needed: ['Diesel Mechanics', 'Air Brakes', 'Hydraulics', 'Transmission Repair'],
  },

  // Baco
  {
    id: 21,
    title: 'River Trek Eco-Tour Guide',
    company: 'Baco River Adventures & Eco-Park',
    category: 'Food & Hospitality',
    location: 'Baco',
    landmark: 'Brgy. San Ignacio',
    lat: 13.3640,
    lng: 121.0920,
    job_type: 'full-time',
    salary_min: 13000,
    salary_max: 17500,
    description: 'Facilitate bamboo raft tours, orient guests on river conservation, and manage tourist safety equipment.',
    skills_needed: ['Tour Guiding', 'Water Safety', 'First Aid', 'Eco-Tourism'],
  },
  {
    id: 22,
    title: 'Rural Waterworks Pipeline Technician',
    company: 'Baco Municipal Water Service',
    category: 'Trades & Construction',
    location: 'Baco',
    landmark: 'Brgy. Poblacion Water Pump',
    lat: 13.3560,
    lng: 121.1010,
    job_type: 'full-time',
    salary_min: 14000,
    salary_max: 18500,
    description: 'Repair municipal water distribution pipelines, detect water loss leaks, and inspect valve systems.',
    skills_needed: ['Plumbing', 'Pipe Jointing', 'Leak Detection', 'Pumping Equipment'],
  },

  // San Teodoro
  {
    id: 23,
    title: 'Mountain Haven Eco-Lodge Staff',
    company: 'San Teodoro Mountain Haven',
    category: 'Food & Hospitality',
    location: 'San Teodoro',
    landmark: 'Brgy. Caagutayan Eco Trails',
    lat: 13.4350,
    lng: 121.0220,
    job_type: 'gig',
    salary_min: 7500,
    salary_max: 11000,
    description: 'Assist weekend trekkers, prepare farm-to-table breakfast meals, and maintain pristine trail cleanliness.',
    skills_needed: ['Hospitality', 'Trail Assistance', 'Food Preparation', 'Housekeeping'],
  },
  {
    id: 24,
    title: 'Fruit Orchard & Nursery Caretaker',
    company: 'Mindoro Highland Fruits',
    category: 'Agriculture & Fisheries',
    location: 'San Teodoro',
    landmark: 'Brgy. Poblacion Agro Field',
    lat: 13.4250,
    lng: 121.0140,
    job_type: 'full-time',
    salary_min: 13500,
    salary_max: 17000,
    description: 'Grafting, pruning, organic compost fertilization, and irrigation of rambutan, lanzones, and durian trees.',
    skills_needed: ['Plant Propagation', 'Pruning', 'Composting', 'Harvesting'],
  },

  // Socorro
  {
    id: 25,
    title: 'Licensed Commercial Electrician',
    company: 'Socorro Power & Wiring Services',
    category: 'Trades & Construction',
    location: 'Socorro',
    landmark: 'Brgy. Zone II Poblacion',
    lat: 13.0680,
    lng: 121.4080,
    job_type: 'contractual',
    salary_min: 18000,
    salary_max: 26000,
    description: 'Install 220V breaker panels, commercial conduit piping, emergency lighting, and perform electrical load calculations.',
    skills_needed: ['Electrical Wiring', 'Conduit Bending', 'Load Calculation', 'Safety Code'],
  },
  {
    id: 26,
    title: 'Lake Tour Boat Operator',
    company: 'Socorro Lake Watersport Ventures',
    category: 'Food & Hospitality',
    location: 'Socorro',
    landmark: 'Brgy. Subaan Boat Dock',
    lat: 13.0590,
    lng: 121.4010,
    job_type: 'gig',
    salary_min: 8000,
    salary_max: 12500,
    description: 'Pilot scenic tourist motorboats across Lake Naujan, ensure passenger lifevest compliance, and spot migratory waterfowls.',
    skills_needed: ['Boat Navigation', 'Passenger Safety', 'Lifevest Protocol', 'Customer Care'],
  },

  // Pola
  {
    id: 27,
    title: 'Heritage & Mangrove Tour Coordinator',
    company: 'Pola Community Ecotourism Council',
    category: 'Food & Hospitality',
    location: 'Pola',
    landmark: 'Brgy. Calima Boardwalk',
    lat: 13.1510,
    lng: 121.4390,
    job_type: 'part-time',
    salary_min: 8000,
    salary_max: 11500,
    description: 'Tour historical Spanish-era houses and coastal mangrove boardwalks with visiting educational delegations.',
    skills_needed: ['Storytelling', 'Tour Guiding', 'Environmental Ethics', 'Scheduling'],
  },
  {
    id: 28,
    title: 'Fish Port Quality Checker',
    company: 'Pola Coastal Seafood Guild',
    category: 'Agriculture & Fisheries',
    location: 'Pola',
    landmark: 'Pola Port Municipal Fish Landing',
    lat: 13.1430,
    lng: 121.4320,
    job_type: 'full-time',
    salary_min: 13500,
    salary_max: 17500,
    description: 'Inspect daily catch of tuna and mackerel for freshness, grading, and cold store icing compliance.',
    skills_needed: ['Fish Grading', 'Cold Storage', 'Hygiene Standards', 'Inventory'],
  },

  // Gloria
  {
    id: 29,
    title: 'Agro-Feed Warehouse Logistics Aide',
    company: 'Gloria Supermart & Feeds Supply',
    category: 'Agriculture & Fisheries',
    location: 'Gloria',
    landmark: 'Brgy. Maligaya Commercial Area',
    lat: 12.9810,
    lng: 121.4770,
    job_type: 'full-time',
    salary_min: 14000,
    salary_max: 18000,
    description: 'Manage 50kg feed sack inventory, operate hand pallet trucks, and handle logistics dispatches to livestock growers.',
    skills_needed: ['Stock Handling', 'Pallet Truck Operation', 'Inventory', 'Dispatching'],
  },
  {
    id: 30,
    title: 'Motorcycle Service Mechanic',
    company: 'Southern Motors Gloria Branch',
    category: 'Transport & Logistics',
    location: 'Gloria',
    landmark: 'National Highway, Gloria',
    lat: 12.9730,
    lng: 121.4710,
    job_type: 'full-time',
    salary_min: 16000,
    salary_max: 22000,
    description: 'Perform FI diagnostics, carburetor tuning, CVT belt servicing, and routine tune-ups for motorcycles and tricycles.',
    skills_needed: ['Motorcycle Diagnostics', 'CVT Servicing', 'FI Systems', 'Tune-up'],
  },

  // Bansud
  {
    id: 31,
    title: 'Metal Fabrication & Assembler',
    company: 'Bansud Metal Fabricators',
    category: 'Trades & Construction',
    location: 'Bansud',
    landmark: 'Brgy. Poblacion Industrial Zone',
    lat: 12.8680,
    lng: 121.4890,
    job_type: 'contractual',
    salary_min: 17000,
    salary_max: 23500,
    description: 'Fabricate sidecars for passenger tricycles, metal farm carts, and reinforced steel fencing.',
    skills_needed: ['Welding', 'Tricycle Fabrication', 'Pipe Bending', 'Safety Standards'],
  },
  {
    id: 32,
    title: 'Upland Farm Crop Assistant',
    company: 'Bansud Organic Agriculture Hub',
    category: 'Agriculture & Fisheries',
    location: 'Bansud',
    landmark: 'Brgy. Salcedo Agro Center',
    lat: 12.8590,
    lng: 121.4820,
    job_type: 'full-time',
    salary_min: 13000,
    salary_max: 16500,
    description: 'Planting, organic weeding, and harvesting of root crops, ginger, and lowland vegetables.',
    skills_needed: ['Organic Farming', 'Weeding', 'Crop Harvesting', 'Tool Care'],
  },

  // Mansalay
  {
    id: 33,
    title: 'Indigenous Crafts Inventory Assistant',
    company: 'Mansalay Hanunuo Livelihood Center',
    category: 'Healthcare & Services',
    location: 'Mansalay',
    landmark: 'Poblacion Cultural Plaza',
    lat: 12.5340,
    lng: 121.4420,
    job_type: 'part-time',
    salary_min: 8000,
    salary_max: 11000,
    description: 'Catalog traditional Hanunuo Mangyan woven baskets, beaded accessories, and Surat Mangyan inscriptions for trade exhibitions.',
    skills_needed: ['Inventory Cataloging', 'Artisan Support', 'Cultural Preservation', 'Packing'],
  },
  {
    id: 34,
    title: 'Rural Community Health Records Aide',
    company: 'Mansalay Primary Health Clinic',
    category: 'Healthcare & Services',
    location: 'Mansalay',
    landmark: 'Brgy. Manaul Health Center',
    lat: 12.5250,
    lng: 121.4340,
    job_type: 'full-time',
    salary_min: 14500,
    salary_max: 19000,
    description: 'Encode patient demographic records, organize maternal healthcare files, and assist visiting public health doctors.',
    skills_needed: ['Data Encoding', 'Medical Archiving', 'Patient Empathy', 'MS Excel'],
  },

  // Bulalacao
  {
    id: 35,
    title: 'Island Cruise Boat Crew & Safety Aide',
    company: 'Bulalacao Islands Tourism Fleet',
    category: 'Transport & Logistics',
    location: 'Bulalacao',
    landmark: 'Bulalacao Fish Port & Marina',
    lat: 12.3320,
    lng: 121.3450,
    job_type: 'full-time',
    salary_min: 15000,
    salary_max: 20000,
    description: 'Assist island hopping passengers to Aslom, Silad, and Target islands; manage anchor lines and snorkeling safety.',
    skills_needed: ['Watermanship', 'Guest Safety', 'Mooring', 'Tour Assistance'],
  },
  {
    id: 36,
    title: 'Seafood Cold Storage Quality Checker',
    company: 'Bulalacao Marine Export Corp',
    category: 'Agriculture & Fisheries',
    location: 'Bulalacao',
    landmark: 'Brgy. San Juan Coastal Facility',
    lat: 12.3230,
    lng: 121.3380,
    job_type: 'contractual',
    salary_min: 15500,
    salary_max: 20500,
    description: 'Inspect blast-frozen squid and yellowfin tuna cuts, check cold storage temperature logs, and verify vacuum packaging.',
    skills_needed: ['Cold Storage', 'HACCP', 'Seafood Inspection', 'Temperature Logging'],
  },
]

/* Calculate real Haversine distance in km between two GPS coordinates */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Number((R * c).toFixed(1))
}

function TopNav() {
  const { user } = useAuth()
  return (
    <header style={{
      background: '#0A2557',
      padding: '0 28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 62,
      borderBottom: '1px solid rgba(255,255,255,.1)',
      flexShrink: 0,
      zIndex: 1000
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <Logo light />
        <span style={{
          background: 'rgba(255,199,44,.15)',
          color: '#FFC72C',
          border: '1px solid rgba(255,199,44,.35)',
          padding: '3px 10px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '.06em',
          textTransform: 'uppercase'
        }}>
          Oriental Mindoro GIS Engine
        </span>
      </div>

      <nav style={{ display: 'flex', gap: 6 }}>
        {[['/', 'Home'], ['/jobs', 'Jobs'], ['/map', 'Job Map'], ['/training', 'Training']].map(([to, label]) => (
          <Link key={to} to={to} style={{
            fontSize: 14,
            fontWeight: 600,
            color: to === '/map' ? '#FFC72C' : 'rgba(255,255,255,.8)',
            padding: '7px 14px',
            borderRadius: 8,
            textDecoration: 'none',
            background: to === '/map' ? 'rgba(255,199,44,.14)' : 'transparent',
            transition: 'all .2s'
          }}>
            {label}
          </Link>
        ))}
      </nav>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {user ? (
          <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: '#FFC72C',
              color: '#0A2557',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              fontSize: 13
            }}>
              {(user.full_name || user.email || 'U')[0].toUpperCase()}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{user.full_name?.split(' ')[0] || 'Dashboard'}</span>
          </Link>
        ) : (
          <>
            <Link to="/login" style={{ color: 'rgba(255,255,255,.85)', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>Sign In</Link>
            <Link to="/register" style={{
              background: '#FFC72C',
              color: '#0A2557',
              fontWeight: 700,
              fontSize: 13,
              padding: '7px 16px',
              borderRadius: 8,
              textDecoration: 'none'
            }}>
              Sign Up
            </Link>
          </>
        )}
      </div>
    </header>
  )
}

export default function JobMap() {
  const nav = useNavigate()
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersLayerRef = useRef(null)
  const userMarkerRef = useRef(null)

  // Master job dataset
  const [jobs, setJobs] = useState(REALISTIC_MINDORO_JOBS)
  const [selectedTown, setSelectedTown] = useState('All Municipalities')
  const [selectedCategory, setSelectedCategory] = useState('All Sectors')
  const [selectedType, setSelectedType] = useState('All Types')
  const [searchTerm, setSearchTerm] = useState('')
  const [minSalary, setMinSalary] = useState(0)
  const [activeJobId, setActiveJobId] = useState(null)

  // Map state - Default to 100% free, zero-watermark Esri World Street Map
  const [mapLayer, setMapLayer] = useState('street') // 'street' | 'osm' | 'satellite'
  const [viewMode, setViewMode] = useState('towns') // Default to 'towns' at province level so pins don't overlap!
  const [currentZoom, setCurrentZoom] = useState(PROVINCE_ZOOM)
  const [userLocation, setUserLocation] = useState(null)
  const [locatingUser, setLocatingUser] = useState(false)
  const [sortBy, setSortBy] = useState('relevant') // 'relevant' | 'salary' | 'distance'

  // Fetch live jobs from LavaLust API and merge with realistic Mindoro dataset
  useEffect(() => {
    api('/jobs?limit=100')
      .then(res => {
        const liveList = res?.data || res?.jobs || []
        if (Array.isArray(liveList) && liveList.length > 0) {
          const mappedLive = liveList.map((j, idx) => {
            const townName = TOWN_NAMES.find(t => (j.location || '').toLowerCase().includes(t.toLowerCase())) || 'Calapan City'
            const baseCoords = LGUS[townName]?.coords || LGUS['Calapan City'].coords
            // Natural jitter so pins in the same town don't overlap exactly
            const latOffset = ((idx % 5) - 2) * 0.006
            const lngOffset = (((idx * 2) % 5) - 2) * 0.006
            const cat = detectCategory(j)

            return {
              id: j.id,
              title: j.title,
              company: j.company || j.employer_name || 'Oriental Mindoro Business',
              category: cat,
              location: townName,
              landmark: j.employer_location || `${townName} Commercial Center`,
              lat: baseCoords[0] + latOffset,
              lng: baseCoords[1] + lngOffset,
              job_type: j.job_type || 'full-time',
              salary_min: Number(j.salary_min) || 15000,
              salary_max: Number(j.salary_max) || 22000,
              description: j.description || 'Verified job opening in Oriental Mindoro.',
              requirements: j.requirements || 'Dedicated, reliable work ethic, and skills.',
              skills_needed: typeof j.skills_needed === 'string' ? j.skills_needed.split(',').map(s => s.trim()) : (j.skills_needed || ['Skill Certified']),
              is_live_db: true,
            }
          })

          const existingIds = new Set(mappedLive.map(m => m.id))
          const nonDupSeed = REALISTIC_MINDORO_JOBS.filter(s => !existingIds.has(s.id))
          setJobs([...mappedLive, ...nonDupSeed])
        }
      })
      .catch(() => {
        setJobs(REALISTIC_MINDORO_JOBS)
      })
  }, [])

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return
    if (mapInstanceRef.current) return

    if (mapContainerRef.current._leaflet_id) {
      mapContainerRef.current._leaflet_id = null
    }

    // 100% Free, Zero-Watermark Tile Layers
    const street = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; National Geographic, DeLorme, NAVTEQ',
    })

    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })

    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    })

    const map = L.map(mapContainerRef.current, {
      center: PROVINCE_CENTER,
      zoom: PROVINCE_ZOOM,
      minZoom: 8,
      maxZoom: 18,
      layers: [street],
      zoomControl: false,
    })

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    // Layer group for pins
    const markersLayer = L.layerGroup().addTo(map)
    markersLayerRef.current = markersLayer

    // Track zoom level to auto-switch between Town Hubs and Local Job Sites
    map.on('zoomend', () => {
      const z = map.getZoom()
      setCurrentZoom(z)
      if (z >= 12) {
        setViewMode('jobs')
      }
    })

    map._layersObj = { street, osm, satellite }
    mapInstanceRef.current = map

    setTimeout(() => {
      map.invalidateSize()
    }, 250)

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Switch Tile Layer
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !map._layersObj) return
    const { street, osm, satellite } = map._layersObj

    ;[street, osm, satellite].forEach(l => {
      if (map.hasLayer(l)) map.removeLayer(l)
    })

    if (mapLayer === 'satellite') map.addLayer(satellite)
    else if (mapLayer === 'osm') map.addLayer(osm)
    else map.addLayer(street)
  }, [mapLayer])

  // Locate User GPS
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.')
      return
    }

    setLocatingUser(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocatingUser(false)
        const { latitude, longitude } = pos.coords
        setUserLocation({ lat: latitude, lng: longitude })

        const map = mapInstanceRef.current
        if (map) {
          map.flyTo([latitude, longitude], 12, { duration: 1.2 })

          if (userMarkerRef.current) userMarkerRef.current.remove()

          const userIcon = L.divIcon({
            className: 'user-loc-pin',
            html: `
              <div style="position:relative;display:flex;align-items:center;justify-content:center;width:32px;height:32px;">
                <div style="position:absolute;width:32px;height:32px;border-radius:50%;background:rgba(2,132,199,0.35);animation:gpsPulse 1.6s ease-out infinite;"></div>
                <div style="width:16px;height:16px;border-radius:50%;background:#0284C7;border:3px solid #FFFFFF;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          })

          userMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon })
            .addTo(map)
            .bindPopup(`
              <div style="padding:6px;font-family:sans-serif;">
                <b style="color:#0A2557;font-size:13px;">📍 You Are Here</b>
                <p style="margin:3px 0 0;font-size:11px;color:#64748B;">GPS: ${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°</p>
              </div>
            `)
            .openPopup()
        }

        setSortBy('distance')
      },
      () => {
        setLocatingUser(false)
        alert('Could not retrieve your live location. Showing Oriental Mindoro overview.')
      },
      { timeout: 10000 }
    )
  }

  // Filter Jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter(j => {
      const cat = detectCategory(j)
      const matchTown = selectedTown === 'All Municipalities' || j.location.toLowerCase() === selectedTown.toLowerCase()
      const matchCat = selectedCategory === 'All Sectors' || cat === selectedCategory
      const matchType = selectedType === 'All Types' || j.job_type === selectedType
      const matchSalary = !minSalary || (j.salary_min && j.salary_min >= minSalary)
      const q = searchTerm.toLowerCase().trim()
      const matchSearch = !q ||
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q) ||
        (j.landmark && j.landmark.toLowerCase().includes(q)) ||
        (j.skills_needed && j.skills_needed.some(s => s.toLowerCase().includes(q)))

      return matchTown && matchCat && matchType && matchSalary && matchSearch
    })
  }, [jobs, selectedTown, selectedCategory, selectedType, minSalary, searchTerm])

  // Sorted Jobs
  const sortedJobs = useMemo(() => {
    const list = [...filteredJobs]
    if (sortBy === 'distance' && userLocation) {
      return list.sort((a, b) => {
        const distA = calculateDistanceKm(userLocation.lat, userLocation.lng, a.lat, a.lng) || 9999
        const distB = calculateDistanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng) || 9999
        return distA - distB
      })
    }
    if (sortBy === 'salary') {
      return list.sort((a, b) => (b.salary_max || b.salary_min || 0) - (a.salary_max || a.salary_min || 0))
    }
    return list
  }, [filteredJobs, sortBy, userLocation])

  // Count jobs per municipality for the Town View
  const townJobCounts = useMemo(() => {
    const counts = {}
    TOWN_NAMES.forEach(t => { counts[t] = 0 })
    jobs.forEach(j => {
      const townKey = TOWN_NAMES.find(t => t.toLowerCase() === (j.location || '').toLowerCase())
      if (townKey) counts[townKey]++
    })
    return counts
  }, [jobs])

  // Sync Markers to Leaflet Map
  useEffect(() => {
    const map = mapInstanceRef.current
    const layer = markersLayerRef.current
    if (!map || !layer) return

    layer.clearLayers()

    // 1. If ViewMode is 'towns', show the 15 Municipal Hub Badges (clean, no overlap!)
    if (viewMode === 'towns') {
      TOWN_NAMES.forEach(town => {
        const lgu = LGUS[town]
        if (!lgu) return
        const count = townJobCounts[town] || 0
        const isSelected = selectedTown === town

        const html = `
          <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            transform: translate(-50%, -50%);
          ">
            ${isSelected ? `
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 54px;
                height: 54px;
                border-radius: 50%;
                background: rgba(255, 199, 44, 0.45);
                animation: mapPulse 1.8s ease-out infinite;
                pointer-events: none;
              "></div>
            ` : ''}

            <div style="
              width: ${isSelected ? '46px' : '38px'};
              height: ${isSelected ? '46px' : '38px'};
              border-radius: 50%;
              background: ${isSelected ? '#FFC72C' : (count > 0 ? '#0A2557' : '#64748B')};
              color: ${isSelected ? '#0A2557' : '#FFFFFF'};
              border: 3px solid #FFFFFF;
              box-shadow: 0 4px 14px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: ${isSelected ? '15px' : '13px'};
              font-weight: 800;
              transition: all .2s;
            ">
              ${count}
            </div>

            <div style="
              margin-top: 4px;
              background: rgba(10, 37, 87, 0.94);
              color: #FFFFFF;
              padding: 3px 9px;
              border-radius: 999px;
              font-size: 11px;
              font-weight: 700;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.25);
              border: 1px solid rgba(255,255,255,0.2);
            ">
              ${town}
            </div>
          </div>
        `

        const icon = L.divIcon({
          className: 'custom-town-pin',
          html,
          iconSize: [46, 56],
          iconAnchor: [23, 28],
        })

        const marker = L.marker(lgu.coords, { icon })
          .addTo(layer)
          .on('click', () => {
            setSelectedTown(town)
            setViewMode('jobs')
            map.flyTo(lgu.coords, 13, { duration: 0.9 })
          })

        marker.bindTooltip(`<b>${town}</b><br/>${count} active jobs<br/><small style="color:#FFC72C">${lgu.desc}</small>`, {
          direction: 'top',
          offset: [0, -28],
        })
      })

      return
    }

    // 2. ViewMode is 'jobs': Plot individual realistic teardrop job pins (clean, NO awkward text collisions!)
    filteredJobs.forEach(job => {
      const cat = detectCategory(job)
      const meta = SECTOR_META[cat] || SECTOR_META['Trades & Construction']
      const isActive = activeJobId === job.id

      // Sleek teardrop pin with clean icon inside
      const html = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          transform: translate(-50%, -100%);
          transition: transform .2s ease;
        ">
          ${isActive ? `
            <div style="
              position: absolute;
              top: 16px;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 50px;
              height: 50px;
              border-radius: 50%;
              background: rgba(255, 199, 44, 0.6);
              animation: mapPulse 1.6s ease-out infinite;
              pointer-events: none;
            "></div>
          ` : ''}

          <div style="
            width: ${isActive ? '38px' : '30px'};
            height: ${isActive ? '38px' : '30px'};
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            background: ${isActive ? '#FFC72C' : meta.color};
            border: 2px solid #FFFFFF;
            box-shadow: 0 3px 10px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all .2s;
          ">
            <span style="
              transform: rotate(45deg);
              font-size: ${isActive ? '16px' : '13px'};
              user-select: none;
            ">
              ${meta.icon}
            </span>
          </div>
        </div>
      `

      const icon = L.divIcon({
        className: 'custom-job-pin',
        html,
        iconSize: [36, 44],
        iconAnchor: [18, 44],
      })

      const distInfo = userLocation ? calculateDistanceKm(userLocation.lat, userLocation.lng, job.lat, job.lng) : null

      // Rich Interactive Popup
      const popupHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; width: 260px; padding: 4px;">
          <div style="position: relative; height: 100px; border-radius: 8px; overflow: hidden; margin-bottom: 10px; background: #0A2557;">
            <img src="${getJobImage(job)}" alt="${job.title}" style="width: 100%; height: 100%; object-fit: cover;" />
            <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(10,37,87,0.85) 0%, transparent 60%);"></div>
            <span style="position: absolute; bottom: 8px; left: 8px; background: #FFC72C; color: #0A2557; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
              ${job.job_type.replace('-', ' ')}
            </span>
            ${distInfo ? `
              <span style="position: absolute; top: 8px; right: 8px; background: rgba(10,37,87,0.85); color: #FFFFFF; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,.2);">
                📍 ${distInfo} km away
              </span>
            ` : ''}
          </div>

          <h3 style="margin: 0 0 4px; font-size: 14px; font-weight: 800; color: #0A2557; line-height: 1.3;">
            ${job.title}
          </h3>
          <div style="font-size: 11.5px; color: #475569; font-weight: 600; margin-bottom: 4px;">
            ${job.company}
          </div>
          <div style="font-size: 11px; color: #64748B; display: flex; align-items: center; gap: 4px; margin-bottom: 8px;">
            <span>📍</span> <span>${job.landmark || job.location}, Oriental Mindoro</span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid #E2E8F0;">
            <div>
              <small style="font-size: 10px; color: #64748B; display: block;">Monthly Salary</small>
              <b style="font-size: 13px; color: #16A34A;">₱${job.salary_min ? Number(job.salary_min).toLocaleString() : 'Negotiable'}</b>
            </div>
            <a href="/jobs/${job.id}" style="
              background: #0A2557;
              color: #FFFFFF;
              font-size: 11px;
              font-weight: 700;
              padding: 6px 12px;
              border-radius: 6px;
              text-decoration: none;
              transition: background .2s;
            ">
              Apply Now →
            </a>
          </div>
        </div>
      `

      const marker = L.marker([job.lat, job.lng], { icon })
        .addTo(layer)
        .bindTooltip(`<b>${job.title}</b><br/><span style="color:#16A34A;font-weight:700;">₱${job.salary_min.toLocaleString()}</span> • ${job.company}`, {
          direction: 'top',
          offset: [0, -36],
        })
        .bindPopup(popupHtml, {
          offset: [0, -38],
          closeButton: true,
          className: 'job-map-popup',
        })
        .on('click', () => {
          setActiveJobId(job.id)
        })

      if (isActive) {
        setTimeout(() => {
          marker.openPopup()
        }, 150)
      }
    })
  }, [filteredJobs, viewMode, selectedTown, townJobCounts, activeJobId, userLocation])

  // Center on town
  const handleSelectTown = (town) => {
    setSelectedTown(town)
    const map = mapInstanceRef.current
    if (!map) return

    if (town === 'All Municipalities') {
      setViewMode('towns')
      map.flyTo(PROVINCE_CENTER, PROVINCE_ZOOM, { duration: 1.0 })
    } else if (LGUS[town]) {
      setViewMode('jobs')
      map.flyTo(LGUS[town].coords, 13, { duration: 1.0 })
    }
  }

  // Focus a specific job card on map
  const handleFocusJob = (job) => {
    setActiveJobId(job.id)
    setViewMode('jobs')
    const map = mapInstanceRef.current
    if (map) {
      map.flyTo([job.lat, job.lng], 14, { duration: 0.9 })
    }
  }

  // Reset to full province overview
  const handleResetProvince = () => {
    setSelectedTown('All Municipalities')
    setActiveJobId(null)
    setViewMode('towns')
    const map = mapInstanceRef.current
    if (map) {
      map.flyTo(PROVINCE_CENTER, PROVINCE_ZOOM, { duration: 1.0 })
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F8FAFC' }}>
      <TopNav />

      <style>{`
        @keyframes mapPulse {
          0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0.9; }
          100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
        }
        @keyframes gpsPulse {
          0% { transform: scale(0.5); opacity: 0.9; }
          100% { transform: scale(2.0); opacity: 0; }
        }
        .custom-town-pin, .custom-job-pin, .user-loc-pin {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px !important;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.2) !important;
          padding: 8px !important;
        }
        .leaflet-popup-content {
          margin: 6px !important;
          line-height: 1.4 !important;
        }
        .job-card-active {
          border-color: #0A2557 !important;
          background: #EFF6FF !important;
          box-shadow: 0 4px 14px rgba(10,37,87,0.12) !important;
        }
      `}</style>

      {/* Main Split Layout: Left Control/Job Panel + Right Interactive Leaflet Canvas */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '400px 1fr', overflow: 'hidden' }}>

        {/* ── LEFT PANEL: Search, Filters, & Interactive Job Cards ── */}
        <aside style={{
          background: '#FFFFFF',
          borderRight: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          zIndex: 400,
        }}>

          {/* Banner & Province Stats */}
          <div style={{
            background: 'linear-gradient(135deg, #0A2557 0%, #153E85 100%)',
            padding: '16px 20px',
            color: '#FFFFFF',
            borderBottom: '3px solid #FFC72C',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                background: '#FFC72C',
                color: '#0A2557',
                fontSize: 10.5,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 4,
                textTransform: 'uppercase'
              }}>
                Mindoro GIS Engine
              </span>
              <span style={{ fontSize: 11, color: '#9CC0F5' }}>15 LGUs Covered</span>
            </div>

            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF', margin: '8px 0 2px' }}>
              Oriental Mindoro Job Map
            </h1>
            <p style={{ fontSize: 12, color: '#BFDBFE', margin: 0 }}>
              Live GPS job opportunities verified across Oriental Mindoro.
            </p>

            {/* Quick Stat Tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
              <div style={{ background: 'rgba(255,255,255,.1)', padding: '6px 10px', borderRadius: 8 }}>
                <small style={{ fontSize: 10, color: '#9CC0F5', display: 'block' }}>Matching</small>
                <b style={{ fontSize: 16, color: '#FFC72C' }}>{sortedJobs.length} Jobs</b>
              </div>
              <div style={{ background: 'rgba(255,255,255,.1)', padding: '6px 10px', borderRadius: 8 }}>
                <small style={{ fontSize: 10, color: '#9CC0F5', display: 'block' }}>Selected</small>
                <b style={{ fontSize: 13, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                  {selectedTown === 'All Municipalities' ? 'Province' : selectedTown}
                </b>
              </div>
              <div style={{ background: 'rgba(255,255,255,.1)', padding: '6px 10px', borderRadius: 8 }}>
                <small style={{ fontSize: 10, color: '#9CC0F5', display: 'block' }}>Min Pay</small>
                <b style={{ fontSize: 13, color: '#FFFFFF' }}>
                  {minSalary ? `₱${(minSalary/1000)}k+` : 'Any'}
                </b>
              </div>
            </div>
          </div>

          {/* Filter Controls */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', flexShrink: 0 }}>
            {/* Search Input */}
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <input
                type="text"
                placeholder="Search job title, skills, or employer..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 32px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 12.5,
                  background: '#FFFFFF',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>
                <IconSearch size={15} />
              </span>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8', fontSize: 12 }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Municipality Dropdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>
                  Municipality:
                </label>
                <select
                  value={selectedTown}
                  onChange={e => handleSelectTown(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 12,
                    background: '#FFFFFF',
                    fontWeight: 600,
                    color: '#0A2557'
                  }}
                >
                  <option value="All Municipalities">All Municipalities ({jobs.length})</option>
                  {TOWN_NAMES.map(t => (
                    <option key={t} value={t}>
                      {t} ({townJobCounts[t] || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>
                  Industry Sector:
                </label>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 12,
                    background: '#FFFFFF',
                    fontWeight: 600,
                    color: '#0A2557'
                  }}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Job Type Pills */}
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
              {JOB_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedType(t)}
                  style={{
                    fontSize: 10.5,
                    padding: '3px 8px',
                    borderRadius: 999,
                    border: selectedType === t ? '1px solid #0A2557' : '1px solid #E2E8F0',
                    background: selectedType === t ? '#0A2557' : '#FFFFFF',
                    color: selectedType === t ? '#FFFFFF' : '#475569',
                    fontWeight: selectedType === t ? 700 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    textTransform: 'capitalize'
                  }}
                >
                  {t.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Town Chips Scroller */}
          <div style={{ padding: '8px 18px', background: '#F1F5F9', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
              <button
                onClick={() => handleSelectTown('All Municipalities')}
                style={{
                  fontSize: 11,
                  padding: '3px 9px',
                  borderRadius: 6,
                  border: selectedTown === 'All Municipalities' ? '1px solid #0A2557' : '1px solid #CBD5E1',
                  background: selectedTown === 'All Municipalities' ? '#0A2557' : '#FFFFFF',
                  color: selectedTown === 'All Municipalities' ? '#FFFFFF' : '#334155',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                All Towns
              </button>
              {TOWN_NAMES.map(t => (
                <button
                  key={t}
                  onClick={() => handleSelectTown(t)}
                  style={{
                    fontSize: 11,
                    padding: '3px 9px',
                    borderRadius: 6,
                    border: selectedTown === t ? '1px solid #0A2557' : '1px solid #E2E8F0',
                    background: selectedTown === t ? '#0A2557' : '#FFFFFF',
                    color: selectedTown === t ? '#FFFFFF' : '#475569',
                    fontWeight: selectedTown === t ? 700 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {t} ({townJobCounts[t] || 0})
                </button>
              ))}
            </div>
          </div>

          {/* Job Results List with Scroll */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B' }}>
                {sortedJobs.length} {sortedJobs.length === 1 ? 'Job' : 'Jobs'} Available
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10.5, color: '#64748B' }}>Sort:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  style={{ fontSize: 11, border: '1px solid #CBD5E1', borderRadius: 4, padding: '2px 6px', background: '#FFFFFF' }}
                >
                  <option value="relevant">Most Relevant</option>
                  <option value="salary">Highest Salary</option>
                  {userLocation && <option value="distance">Closest to Me</option>}
                </select>
              </div>
            </div>

            {sortedJobs.length > 0 ? (
              sortedJobs.map(job => {
                const isActive = activeJobId === job.id
                const dist = userLocation ? calculateDistanceKm(userLocation.lat, userLocation.lng, job.lat, job.lng) : null
                const cat = detectCategory(job)
                const meta = SECTOR_META[cat] || SECTOR_META['Trades & Construction']

                return (
                  <div
                    key={job.id}
                    onClick={() => handleFocusJob(job)}
                    className={isActive ? 'job-card-active' : ''}
                    style={{
                      background: '#FFFFFF',
                      border: isActive ? '1.5px solid #0A2557' : '1px solid #E2E8F0',
                      borderRadius: 10,
                      padding: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      gap: 12,
                      transition: 'all .2s ease',
                      boxShadow: isActive ? '0 4px 14px rgba(10,37,87,0.1)' : '0 1px 4px rgba(0,0,0,0.04)'
                    }}
                  >
                    <div style={{ width: 50, height: 50, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#E2E8F0' }}>
                      <img
                        src={getJobImage(job)}
                        alt={job.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { e.currentTarget.style.display = 'none' }}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                        <b style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#0A2557',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'block'
                        }}>
                          {job.title}
                        </b>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          background: meta.bg,
                          color: meta.color,
                          padding: '1px 6px',
                          borderRadius: 4,
                          flexShrink: 0,
                          textTransform: 'uppercase'
                        }}>
                          {meta.icon} {job.job_type.replace('-', ' ')}
                        </span>
                      </div>

                      <span style={{ display: 'block', fontSize: 11.5, color: '#475569', margin: '2px 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {job.company}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748B', marginBottom: 6 }}>
                        <span>📍 {job.landmark ? `${job.landmark}, ${job.location}` : job.location}</span>
                        {dist && (
                          <span style={{ background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: 4, fontWeight: 700, fontSize: 10 }}>
                            {dist} km
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid #F1F5F9' }}>
                        <b style={{ fontSize: 12.5, color: '#16A34A' }}>
                          ₱{job.salary_min ? Number(job.salary_min).toLocaleString() : 'Negotiable'}
                          {job.salary_max ? `–₱${Number(job.salary_max).toLocaleString()}` : ''}
                        </b>

                        <Link
                          to={`/jobs/${job.id}`}
                          onClick={e => e.stopPropagation()}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#0A2557',
                            textDecoration: 'none',
                            padding: '3px 8px',
                            borderRadius: 4,
                            background: '#F1F5F9',
                            transition: 'all .15s'
                          }}
                        >
                          Details →
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: '#64748B' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#334155', margin: '0 0 6px' }}>No matching jobs found</p>
                <p style={{ fontSize: 12, margin: '0 0 14px' }}>Try broadening your search term or selecting "All Municipalities".</p>
                <button
                  onClick={() => {
                    setSelectedTown('All Municipalities')
                    setSelectedCategory('All Sectors')
                    setSelectedType('All Types')
                    setSearchTerm('')
                  }}
                  style={{
                    background: '#0A2557',
                    color: '#FFFFFF',
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>

        </aside>

        {/* ── RIGHT PANEL: Interactive Leaflet Map Canvas & Controls ── */}
        <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden' }}>

          {/* Leaflet Container (100% of the canvas) */}
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%', background: '#E2E8F0' }} />

          {/* Floating Top Map Controls Toolbar */}
          <div style={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 500,
            display: 'flex',
            gap: 8,
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(8px)',
            padding: 6,
            borderRadius: 10,
            boxShadow: '0 4px 18px rgba(0,0,0,0.15)',
            border: '1px solid #CBD5E1'
          }}>
            {/* View Mode Toggle: Town Hubs (Default) vs All Job Sites */}
            <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 6, padding: 2 }}>
              <button
                onClick={() => setViewMode('towns')}
                style={{
                  padding: '5px 10px',
                  borderRadius: 5,
                  border: 'none',
                  background: viewMode === 'towns' ? '#0A2557' : 'transparent',
                  color: viewMode === 'towns' ? '#FFFFFF' : '#334155',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                🏙️ Town Hubs
              </button>
              <button
                onClick={() => setViewMode('jobs')}
                style={{
                  padding: '5px 10px',
                  borderRadius: 5,
                  border: 'none',
                  background: viewMode === 'jobs' ? '#0A2557' : 'transparent',
                  color: viewMode === 'jobs' ? '#FFFFFF' : '#334155',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                📍 Job Sites
              </button>
            </div>

            {/* Zero-Watermark Tile Layer Switcher */}
            <select
              value={mapLayer}
              onChange={e => setMapLayer(e.target.value)}
              style={{
                padding: '5px 8px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                fontSize: 11.5,
                fontWeight: 700,
                background: '#FFFFFF',
                color: '#0A2557',
                cursor: 'pointer'
              }}
            >
              <option value="street">🗺️ Street Map (Esri)</option>
              <option value="osm">🌐 OpenStreetMap</option>
              <option value="satellite">🛰️ Satellite Aerial</option>
            </select>

            {/* GPS Locate Me Button */}
            <button
              onClick={handleLocateMe}
              disabled={locatingUser}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                borderRadius: 6,
                border: '1px solid #0284C7',
                background: userLocation ? '#0284C7' : '#F0F9FF',
                color: userLocation ? '#FFFFFF' : '#0369A1',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Find jobs closest to your live location"
            >
              <span>📍</span>
              <span>{locatingUser ? 'Locating...' : (userLocation ? 'GPS Active' : 'Near Me')}</span>
            </button>

            {/* Reset to Province Overview */}
            <button
              onClick={handleResetProvince}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#0A2557',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Reset to full Oriental Mindoro overview"
            >
              🔄 Province
            </button>
          </div>

          {/* Floating Map Legend (Bottom-Left) */}
          <div style={{
            position: 'absolute',
            bottom: 24,
            left: 20,
            zIndex: 500,
            background: 'rgba(10, 37, 87, 0.94)',
            color: '#FFFFFF',
            backdropFilter: 'blur(8px)',
            padding: '10px 14px',
            borderRadius: 10,
            boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.15)',
            fontSize: 11,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            maxWidth: 300,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,.15)', paddingBottom: 4 }}>
              <b style={{ color: '#FFC72C' }}>Interactive GIS Engine</b>
              <span style={{ fontSize: 10, color: '#9CC0F5' }}>Oriental Mindoro</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D97706' }}></span>
                <span>🔨 Trades</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669' }}></span>
                <span>☕ Hospitality</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB' }}></span>
                <span>💻 Tech & Office</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A' }}></span>
                <span>🌾 Agri & Fish</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7C3AED' }}></span>
                <span>⚓ Logistics</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#E11D48' }}></span>
                <span>🩺 Healthcare</span>
              </span>
            </div>
            <div style={{ fontSize: 10, color: '#9CC0F5', marginTop: 2 }}>
              💡 Click any town hub to zoom in, or hover over pins to view verified salaries & employers.
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
