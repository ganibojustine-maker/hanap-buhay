/* HANAPBUHAY — clickable prototype (no build step, no backend, mock data only) */
(() => {
'use strict';

/* ---------- storage (safe) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('hb_' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('hb_' + k, JSON.stringify(v)); } catch {} },
};

/* ---------- icons ---------- */
const P = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 6.1A10 10 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 7.6A16 16 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4-.9"/>',
  dash: '<rect x="4" y="3" width="16" height="18" rx="4"/><path d="M9 12h6M9 8h3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  match: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M9 11h2l1-2 1 3 1-1h1"/>',
  apps: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  passport: '<rect x="5" y="3" width="14" height="18" rx="3"/><circle cx="12" cy="10" r="2.5"/><path d="M8.5 16.5h7"/>',
  book: '<path d="M3 6.5C5 5 8.5 5 12 7c3.5-2 7-2 9-.5V19c-2-1.5-5.500-1.500-9 .5-3.500-2-7-2-9-.5z"/><path d="M12 7v12.500"/>',
  msg: '<path d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-6l-5 4v-4a3 3 0 0 1-2-3z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.900 4.900l2.100 2.100M17 17l2.100 2.100M19.100 4.900 17 7M7 17l-2.100 2.100"/>',
  brief: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.500V16c3 2.500 9 2.500 12 0v-4.500"/>',
  tools: '<path d="m14 6 4 4M4 20l9-9M12 4l8 8-3 3-8-8z"/>',
  bolt: '<path d="M13 3 5 13h6l-1 8 8-10h-6z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  food: '<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v6M9 3v6M17 21V3c-2 1-3 4-3 8h3"/>',
  car: '<path d="M5 16V12l2-5h10l2 5v4M3 16h18M7 16v2M17 16v2"/><circle cx="8" cy="13" r=".8"/><circle cx="16" cy="13" r=".8"/>',
  leaf: '<path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15"/><path d="M5 19c3-5 6-8 10-10"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  cash: '<rect x="3" y="6" width="18" height="12" rx="3"/><circle cx="12" cy="12" r="2.500"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  bookmark: '<path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z"/>',
  shield: '<path d="M12 3 5 6v6c0 4.500 3 7.500 7 9 4-1.500 7-4.500 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  check: '<path d="m5 12.500 4.500 4.500L19 7.500"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  out: '<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M16 8l4 4-4 4M20 12H9"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.7.400-1 .9-1 1.700M12 17v.01"/>',
  mic: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  store: '<path d="M4 9l1.500-5h13L20 9M4 9v11h16V9M4 9c0 2 3 2 4 0 1 2 3 2 4 0 1 2 3 2 4 0 1 2 4 2 4 0M10 20v-5h4v5"/>',
  hh: '<path d="M4 11 12 4l8 7v8H4zM9 20v-5h6v5"/>',
};
const ic = (n, s = 18, extra = '') => `<svg class="ic" style="width:${s}px;height:${s}px;${extra}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;

const mark=(l='#fff')=>`<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="24.500" cy="9" r="6" fill="#FFC72C"/><path d="M5 15c5-2 10-1 14 2v18c-4-3-9-4-14-2z" fill="${l}"/><path d="M35 15c-5-2-10-1-14 2v18c4-3 9-4 14-2z" fill="#9CC0F5"/><path d="M19.500 17v18" stroke="#0A2557" stroke-width="1.500"/></svg>`;
const MARK = mark();
const logo = (dark = false, to = '#/') => `<a class="logo ${dark ? 'dark' : ''}" href="${to}" aria-label="Hanapbuhay home">${dark ? mark('#0A2557') : MARK}<span>HANAPBUHAY</span></a>`;

/* ---------- mock data ---------- */
const JOBS = [
  { id: 1, title: 'Construction Worker', co: 'Rizal Construction Services', loc: 'Calapan City', type: 'Full-time', pay: '₱500 - ₱700/day', min: 500, match: 92, img: 'construction', posted: '2 days ago', skills: ['Carpentry', 'Masonry', 'General Labor', 'Safety Awareness'], tagsk: ['Welding'] },
  { id: 2, title: 'Graphic Designer (Freelance)', co: 'Mindoro Creatives', loc: 'Calapan City', type: 'Freelance', pay: '₱300 - ₱600/project', min: 300, match: 78, img: 'designer', posted: '3 days ago', skills: ['Photoshop', 'Layout', 'Branding', 'Communication'], tagsk: ['Computer Skills'] },
  { id: 3, title: 'Electrical Technician', co: 'Mindoro Power Solutions', loc: 'Puerto Galera', type: 'Contractual', pay: '₱500 - ₱800/day', min: 500, match: 85, img: 'electrician', posted: '1 week ago', skills: ['Wiring', 'Basic Electrical', 'Safety Procedures', 'Hand Tools'], tagsk: ['Electrical'] },
  { id: 4, title: 'Food Service Crew', co: 'Isla Kape & Dine', loc: 'Calapan City', type: 'Part-time', pay: '₱350 - ₱500/day', min: 350, match: 83, img: 'food', posted: '4 days ago', skills: ['Customer Service', 'Food Safety', 'Teamwork', 'Cashiering'], tagsk: [] },
  { id: 5, title: 'Motorcycle Mechanic', co: 'Mindoro Auto Works', loc: 'Calapan City', type: 'Full-time', pay: '₱350 - ₱500/day', min: 350, match: 88, img: 'mechanic', posted: '5 days ago', skills: ['Engine Repair', 'Hand Tools', 'Diagnostics', 'Welding'], tagsk: ['Welding'] },
  { id: 6, title: 'Welder (SMAW)', co: 'Calapan Steel Works', loc: 'Calapan City', type: 'Full-time', pay: '₱600 - ₱900/day', min: 600, match: 81, img: 'welding', posted: '1 day ago', skills: ['SMAW', 'Blueprint Reading', 'Safety Procedures'], tagsk: ['Welding'] },
  { id: 7, title: 'Office Encoder', co: 'Oriental Mindoro Coop', loc: 'San Teodoro', type: 'Part-time', pay: '₱400 - ₱550/day', min: 400, match: 74, img: 'computer', posted: '6 days ago', skills: ['MS Office', 'Typing', 'Data Entry'], tagsk: ['Computer Skills'] },
  { id: 8, title: 'Delivery Rider', co: 'Mindoro Express', loc: 'Calapan City', type: 'Contractual', pay: '₱1,100 - ₱1,300/day', min: 1100, match: 70, img: 'mechanic', posted: '1 week ago', skills: ['Driving', 'Navigation', 'Customer Service'], tagsk: ['Driving'] },
];
const COURSES = [
  { id: 1, t: 'Welding NC II', by: 'TESDA', loc: 'Calapan City', hrs: '320 hours', fee: '₱3,500', img: 'welding', badge: 'pop', cat: 'TESDA' },
  { id: 2, t: 'Electrical Installation NC II', by: 'TESDA', loc: 'Calapan City', hrs: '400 hours', fee: '₱4,000', img: 'electrical-nc', badge: 'top', cat: 'TESDA' },
  { id: 3, t: 'Computer Literacy', by: 'TESDA', loc: 'Calapan City', hrs: '80 hours', fee: '₱1,500', img: 'computer', cat: 'Online' },
  { id: 4, t: 'Food and Beverage Services NC II', by: 'TESDA', loc: 'Calapan City', hrs: '320 hours', fee: '₱3,000', img: 'fnb', cat: 'Local Providers' },
];
const USER = { name: 'Juan Dela Cruz', first: 'Juan', role: 'Worker', title: 'Construction Worker', loc: 'Calapan City, Oriental Mindoro', avatar: store.get('avatar', 'assets/avatar.jpg') };

/* ---------- state ---------- */
const S = {
  authed: store.get('authed', false),
  favs: new Set(store.get('favs', [1])),
  applied: new Set(store.get('applied', [])),
  saved: new Set(store.get('saved', [])),
  skills: store.get('skills', ['Carpentry', 'Masonry', 'Welding', 'Basic Electrical', 'Hand Tools', 'Safety Procedures']),
  role: 'Worker',
  q: '', sort: 'Most Relevant', touched: false,
  f: { type: new Set(), loc: new Set(['Calapan City']), pay: new Set(), skill: new Set() },
  tab: 'All Courses', ptab: 'Overview', course: new Set(),
};
const persist = () => { store.set('favs', [...S.favs]); store.set('applied', [...S.applied]); store.set('saved', [...S.saved]); store.set('skills', S.skills); store.set('authed', S.authed); };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');

/* ---------- helpers ---------- */
let toastT;
function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.innerHTML = ic('check', 16) + msg; requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400);
}
function modal(html, onMount) {
  const o = document.createElement('div'); o.className = 'ov'; o.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => o.remove();
  o.addEventListener('click', (e) => { if (e.target === o || e.target.closest('[data-close]')) close(); });
  document.body.appendChild(o); onMount && onMount(o, close); return close;
}
const go = (h) => { location.hash = h; };
const jobById = (id) => JOBS.find((j) => j.id === +id) || JOBS[0];

function applyFlow(job) {
  if (!S.authed) { toast('Please log in to apply'); go('#/login'); return; }
  if (S.applied.has(job.id)) { toast('You already applied to this job'); return; }
  modal(`<h2>Apply to ${job.title}</h2><p>${job.co} · ${job.loc}</p>
    <textarea id="cover" placeholder="Add a short note to the employer (optional)"></textarea>
    <p style="margin:12px 0 0;font-size:12px;color:var(--muted)">Your Skills Passport will be shared with the employer.</p>
    <div class="btns"><button class="btn btn-outline btn-sm" data-close>Cancel</button><button class="btn btn-yellow btn-sm" id="send">Submit Application</button></div>`,
    (o, close) => $('#send', o).onclick = () => { S.applied.add(job.id); persist(); close(); toast('Application sent to ' + job.co); route(); });
}

/* ---------- shared bits ---------- */
const jobCardRow = (j) => `
<article class="card jrow" data-job="${j.id}" tabindex="0">
  <img src="assets/${j.img}.jpg" alt="${j.title}">
  <div class="mid"><h3>${j.title}</h3><p class="co">${j.co}</p>
    <div class="lc">${ic('pin', 13)}${j.loc} <span>•</span> ${j.type}</div><div class="pay">${j.pay}</div></div>
  <div class="rt"><span class="match">${j.match}% Match</span>
    <button class="heart ${S.favs.has(j.id) ? 'on' : ''}" data-fav="${j.id}" aria-label="Save job">${ic('heart', 18)}</button></div>
</article>`;

const NAV = [['dashboard', 'Dashboard', 'dash'], ['profile', 'My Profile', 'user'], ['matches', 'Job Matches', 'match'], ['applications', 'Applications', 'apps'], ['passport', 'Skills Passport', 'passport'], ['training', 'Training & Courses', 'book'], ['messages', 'Messages', 'msg'], ['settings', 'Settings', 'gear']];

function userMenu() {
  return `<div class="usr" id="usr"><button class="usr" id="usrbtn" aria-haspopup="true" style="gap:10px"><img src="${USER.avatar}" alt=""><div><strong>${USER.name.replace('Dela Cruz', 'Dela Cruz')}</strong><small>${USER.role}</small></div>${ic('down', 12)}</button>
  <div class="menu" id="umenu"><a href="#/passport">${ic('passport', 16)}Skills Passport</a><a href="#/settings">${ic('gear', 16)}Settings</a><button id="logout">${ic('out', 16)}Log out</button></div></div>`;
}
function shell(active, content, { navy = false, side = true, tinted = false } = {}) {
  const tb = `<header class="tb ${navy ? 'navy' : 'light'}">${logo(!navy, '#/dashboard')}
    <label class="gs">${ic('search', 16)}<input id="gs" placeholder="Search jobs, skills, or training..." aria-label="Search" value="${S.q}"></label>
    <div class="right"><button class="bell" aria-label="Notifications" id="bell">${ic('bell', 20)}<b></b></button>${navy ? userMenu() : ''}</div></header>`;
  const sd = side ? `<aside class="side ${navy ? '' : 'flt'}">${NAV.map(([k, l, i]) => `<a href="#/${k}" class="${k === active ? 'on' : ''}">${ic(i, 18)}${l}</a>`).join('')}
    <div class="help">${ic('help', 26, 'color:#ffd24a')}<div><b>Need help?</b><span>Check our Help Center or contact support.</span></div></div></aside>` : '';
  return `<div class="app view">${tb}<div class="body">${sd}<main class="main ${tinted ? 'tinted' : ''}">${content}</main></div></div>`;
}

/* ---------- views ---------- */
function vLanding() {
  const cats = [['Welding & Fabrication', 'tools', '#e1ebff', '#2a5bd7'], ['Electrical Installation', 'bolt', '#fff1d6', '#e09a00'], ['Computer & IT', 'monitor', '#e8f0ff', '#1d4fb8'], ['Food & Hospitality', 'food', '#ffdceb', '#d6336c'], ['Driving & Transport', 'car', '#e8f0ff', '#1d4fb8'], ['Agriculture & Farming', 'leaf', '#d9f6e4', '#12A150']];
  const q = [['brief', 'Find Jobs & Gigs', 'Full-time, part-time, contract, and freelance.', '#/jobs'], ['cap', 'Learn New Skills', 'TESDA and local training programs.', '#/training'], ['passport', 'Build Your Profile', 'Create your Skills Passport and showcase your talent.', '#/passport'], ['store', 'Support Local MSMEs', 'Help local businesses grow and hire.', '#/login']];
  return `<div class="stage view">
  <header class="pubnav" id="pubnav">${logo()}<nav aria-label="Main"><a href="#/" class="on">Home</a><a href="#/jobs">Jobs</a><a href="#/training">Training</a><a href="#/login">For Employers</a><a href="#/about">About</a></nav>
   <div class="acts"><a class="btn btn-ghost btn-sm" href="#/login">Log In</a><a class="btn btn-yellow btn-sm" href="#/login?signup=1">Sign Up</a></div>
   <button class="burger" id="burger" aria-label="Menu">${ic('menu', 24)}</button></header>
  <section class="hero"><div class="bgimg" role="img" aria-label="Workers in Oriental Mindoro"></div>
   <div class="in"><h1>Find Work.<br>Build Skills.<br><em>Move Forward.</em></h1>
   <p>HANAPBUHAY connects job seekers, freelancers, MSMEs, and individual hirers with real opportunities and training programs in Oriental Mindoro.</p>
   <form class="sbar" id="hsearch"><label>${ic('search', 17)}<input name="q" placeholder="Job title, skills, or keyword" aria-label="Job title"></label><label>${ic('pin', 17)}<input name="l" placeholder="Location" aria-label="Location"></label><button class="btn btn-yellow">Search</button></form></div></section>
  <div class="hero-curve"></div>
  <section class="sect"><div class="qgrid">${q.map(([i, t, d, h]) => `<a class="card qcard" href="${h}"><span class="ib">${ic(i, 22)}</span><h3>${t}</h3><p>${d}</p></a>`).join('')}</div>
   <div class="sh"><h2>Featured Jobs</h2><a href="#/jobs">View all jobs →</a></div>
   <div class="fgrid">${[1, 2, 4, 3].map((id) => { const j = jobById(id); return `<article class="card fjob" data-job="${j.id}" tabindex="0"><div class="top"><img class="th" src="assets/${j.img}.jpg" alt=""><span class="match">${j.match}% Match</span></div><h3>${j.title}</h3><p class="co">${j.co}</p><p class="loc">${ic('pin', 13)}${j.loc}, Oriental Mindoro</p><p class="pay">${j.pay}</p></article>`; }).join('')}</div>
   <div class="sh" style="margin-top:30px"><h2>Popular Jobs & Training Categories</h2></div>
   <div class="cats">${cats.map(([t, i, bg, c]) => `<button class="card cat" data-cat="${t}"><span class="ci" style="background:${bg};color:${c}">${ic(i, 18)}</span>${t.replace(' & ', ' &<br>')}</button>`).join('')}</div></section>
   <footer class="foot"><span>© 2026 HANAPBUHAY · Oriental Mindoro</span><span>Jobs · Skills · Training</span></footer></div>`;
}

function vLogin(signup) {
  const roles = [['Worker', 'mic'], ['Employer', 'user'], ['Individual Hirer', 'hh']];
  return `<div class="authwrap view"><div class="authcard">
  <div class="aside"><div class="brand">${MARK}<h2>HANAPBUHAY</h2><p>Jobs <i>•</i> Skills <i>•</i> Training</p></div><div class="scn" role="img" aria-label="Oriental Mindoro"></div><div class="tag2">Mas Magandang<br>Bukas para sa<br>Oriental Mindoro</div></div>
  <form class="formside" id="lf" novalidate><h1>${signup ? 'Create Account' : 'Welcome Back!'}</h1><p class="sub">${signup ? 'Sign up for HANAPBUHAY and start building your Skills Passport.' : 'Log in to your HANAPBUHAY account and continue your journey.'}</p>
   <button type="button" class="gbtn" id="google"><svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.500c3.500 0 6.600 1.200 9.100 3.600l6.800-6.800C35.800 2.400 30.300 0 24 0 14.600 0 6.500 5.400 2.600 13.200l7.900 6.100C12.400 13.700 17.700 9.500 24 9.500z"/><path fill="#4285F4" d="M46.500 24.500c0-1.600-.1-3.100-.4-4.500H24v9h12.700c-.6 3-2.300 5.500-4.800 7.200l7.700 6c4.500-4.200 6.900-10.300 6.900-17.700z"/><path fill="#FBBC05" d="M10.500 28.700A14.500 14.500 0 0 1 9.500 24c0-1.600.3-3.200.8-4.700l-7.900-6.100A24 24 0 0 0 0 24c0 3.900.9 7.500 2.600 10.800l7.900-6.100z"/><path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.700-6c-2.200 1.400-4.900 2.300-8.200 2.300-6.300 0-11.600-4.200-13.500-9.900l-7.900 6.100C6.500 42.600 14.600 48 24 48z"/></svg>Continue with Google</button>
   <div class="or">or</div>
   ${signup ? `<div class="fld"><label for="nm">Full name</label><div class="inp"><input id="nm" placeholder="Juan Dela Cruz" autocomplete="name"></div></div>` : ''}
   <div class="fld"><label for="em">Email address</label><div class="inp" id="emw"><input id="em" type="email" placeholder="you@example.com" autocomplete="email"></div></div>
   <div class="fld"><label for="pw">Password</label><div class="inp" id="pww"><input id="pw" type="password" placeholder="Enter your password" autocomplete="current-password"><button type="button" class="eye" id="eye" aria-label="Show password">${ic('eye', 18)}</button></div></div>
   <p class="errmsg" id="err" role="alert"></p>
   <div class="row"><label class="chk"><input type="checkbox" checked>Remember me</label><a class="lnk" href="#/login" id="forgot">Forgot password?</a></div>
   <button class="btn btn-yellow btn-block btn-lg" id="sub">${signup ? 'Sign Up' : 'Log In'}</button>
   <p class="alt">${signup ? 'Already have an account? <a class="lnk" href="#/login">Log In</a>' : 'Don’t have an account? <a class="lnk" href="#/login?signup=1">Sign Up</a>'}</p>
   <div class="roles" role="radiogroup" aria-label="Account type">${roles.map(([r, i]) => `<button type="button" class="role ${r === S.role ? 'on' : ''}" data-role="${r}" role="radio" aria-checked="${r === S.role}"><span class="ri">${ic(i === 'mic' ? 'passport' : i, 18)}</span>${r}</button>`).join('')}</div>
  </form></div></div>`;
}

function vDashboard() {
  const rec = [1, 5, 2].map(jobById);
  const types = { 1: 'Full-time', 5: 'Part-time', 2: 'Freelance' };
  const stats = [['Job Matches', 12, 'New opportunities', '#1f9bff'], ['Applications', S.applied.size + 5, 'In progress', '#12A150'], ['Skill Gaps', 3, 'Needs attention', '#ff5a3c'], ['Training Programs', 4, 'Recommended', '#2a5bd7']];
  return shell('dashboard', `
  <div class="pg-h"><div><h1>Good morning, ${USER.first}!</h1><p>Here’s your progress and opportunities.</p></div>
   <div class="pc"><div class="ring"><span>70%</span></div><div><small>Profile Completion</small><a class="btn btn-yellow btn-sm" href="#/passport" style="min-width:150px">Complete Profile</a></div></div></div>
  <div class="stats">${stats.map(([t, n, s, c]) => `<button class="card stat" data-go="${t === 'Applications' ? 'applications' : t === 'Training Programs' ? 'training' : t === 'Job Matches' ? 'matches' : 'passport'}"><div class="si" style="background:${c}22"><i style="background:${c}"></i></div><h4>${t}</h4><div class="n">${n}</div><small>${s}</small></button>`).join('')}</div>
  <div class="sec-h"><h2>Recommended Jobs for You</h2><a href="#/matches">View all</a></div>
  ${rec.map((j) => `<div class="card rjob"><img src="assets/${j.img}.jpg" alt="" data-job="${j.id}"><div class="mid" data-job="${j.id}"><h3>${j.title}</h3><p class="co">${j.co} • ${j.loc}</p><div class="meta"><span class="pill">${types[j.id] === 'Freelance' ? '◔ ' : ''}${types[j.id]}</span>${j.pay.replace(' - ', ' - ')}</div></div><span class="match">${j.match}% Match</span><div class="apply"><button class="btn btn-yellow btn-sm" data-apply="${j.id}" style="min-width:82px">${S.applied.has(j.id) ? 'Applied ✓' : 'Apply'}</button></div></div>`).join('')}
  <div class="two"><div class="card mini"><div class="sec-h"><h2>Your Skill Gaps</h2><a href="#/passport">View all</a></div>${['Advanced Excel', 'AutoCAD Basics', 'English Communication'].map((g) => `<div class="gap-i"><i></i>${g}</div>`).join('')}</div>
   <div class="card mini"><div class="sec-h"><h2>Recommended Training</h2><a href="#/training">View all</a></div>${COURSES.slice(0, 2).map((c) => `<div class="tr-i"><img src="assets/avatar.jpg" alt=""><div><h4>${c.t}</h4><small>${c.by} • ${c.loc} • ${c.hrs}</small></div></div>`).join('')}</div></div>`, { navy: true });
}

function filtered() {
  let L = JOBS.slice();
  const F = S.f;
  if (S.touched) {
    if (F.type.size) L = L.filter((j) => F.type.has(j.type));
    if (F.loc.size) L = L.filter((j) => F.loc.has(j.loc) || (F.loc.has('Other') && !['Calapan City', 'Puerto Galera', 'San Teodoro'].includes(j.loc)));
    if (F.skill.size) L = L.filter((j) => j.tagsk.some((s) => F.skill.has(s)));
    if (F.pay.size) L = L.filter((j) => [...F.pay].some((p) => { const [a, b] = p.split('-').map(Number); return j.min >= a && j.min <= b; }));
  }
  if (S.q) { const q = S.q.toLowerCase(); L = L.filter((j) => (j.title + j.co + j.loc + j.skills.join(' ')).toLowerCase().includes(q)); }
  if (S.sort === 'Highest Pay') L.sort((a, b) => b.min - a.min); else if (S.sort === 'Newest') L.sort((a, b) => b.id - a.id); else L.sort((a, b) => a.id - b.id);
  return L;
}
function vJobs() {
  const grp = (key, title, items) => `<div class="fg"><h4>${title}</h4>${items.map(([l, v, n]) => `<label class="chk"><input type="checkbox" data-f="${key}" value="${v}" ${S.f[key].has(v) ? 'checked' : ''}>${l} (${n})</label>`).join('')}</div>`;
  const L = filtered();
  const count = S.touched || S.q ? L.length : 48;
  return `<div class="app view"><header class="tb light">${logo(true, S.authed ? '#/dashboard' : '#/')}<label class="gs">${ic('search', 16)}<input id="gs" placeholder="Search jobs, skills, or training..." value="${S.q}" aria-label="Search"></label><div class="right"><button class="bell" aria-label="Notifications" id="bell">${ic('bell', 20)}</button></div></header>
  <div class="jlayout"><aside class="filters" aria-label="Filters"><div class="fh"><h3>Filters</h3><button id="clr">Clear all</button></div>
  ${grp('type', 'Job Type', [['Full-time', 'Full-time', 34], ['Part-time', 'Part-time', 12], ['Contractual', 'Contractual', 8], ['Freelance', 'Freelance', 6]])}
  ${grp('loc', 'Location', [['Calapan City', 'Calapan City', 34], ['Puerto Galera', 'Puerto Galera', 8], ['San Teodoro', 'San Teodoro', 5], ['Other', 'Other', 3]])}
  ${grp('pay', 'Salary Range', [['₱0 - ₱500', '0-500', 12], ['₱501 - ₱1,000', '501-1000', 18], ['₱1,001 - ₱1,500', '1001-1500', 10], ['₱1,501+', '1501-99999', 8]])}
  ${grp('skill', 'Skills', [['Welding', 'Welding', 12], ['Electrical', 'Electrical', 10], ['Computer Skills', 'Computer Skills', 8], ['Driving', 'Driving', 6]])}</aside>
  <section class="results"><div class="res-h"><div><h1>Job Search Results</h1><p>${count} jobs found in Calapan City, Oriental Mindoro</p></div>
   <select class="sel" id="sort" aria-label="Sort">${['Most Relevant', 'Highest Pay', 'Newest'].map((s) => `<option ${s === S.sort ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
   <div id="jl">${L.length ? L.map(jobCardRow).join('') : '<div class="card empty"><h3>No jobs match your filters</h3><p>Try clearing some filters.</p></div>'}</div></section></div></div>`;
}

function vJob(id) {
  const j = jobById(id), applied = S.applied.has(j.id), saved = S.saved.has(j.id);
  return `<div class="app view"><header class="tb light">${logo(true, S.authed ? '#/dashboard' : '#/')}<label class="gs">${ic('search', 16)}<input id="gs" placeholder="Search jobs, skills, or training..." aria-label="Search"></label></header>
  <div class="jd"><a class="back" href="#/jobs">${ic('back', 14)}Back to results</a>
  <div class="card jd-top"><img src="assets/${j.img}.jpg" alt=""><div class="info"><h1>${j.title}</h1><p class="co">${j.co}</p><p class="lc">${ic('pin', 15)}${j.loc}, Oriental Mindoro</p>
   <div class="ms"><span>${ic('brief', 16)}${j.type}</span><span>${ic('cash', 16)}${j.pay}</span><span>${ic('clock', 16)}Posted ${j.posted}</span></div></div><span class="match" style="height:34px;padding:0 18px;font-size:14px;align-self:flex-start">${j.match}% Match</span></div>
  <div class="jd-grid"><div class="card"><h3>Job Description</h3><p>We are looking for skilled and reliable ${j.title.toLowerCase().replace(/ \(.*\)/, '')}s to join our team. The ideal candidate must have experience in basic work for this role and be able to work in a team.</p>
   <h4>Responsibilities:</h4><ul><li>Assist in building and renovation projects</li><li>Follow safety guidelines</li><li>Work with the site team</li></ul>
   <h4>Requirements:</h4><ul><li>Physical fit</li><li>With or without onsite experience</li><li>At least 6 months of related experience (preferred)</li></ul></div>
   <div class="card"><h3>Required Skills</h3><div class="tags">${j.skills.map((s) => `<span class="tag">${s}</span>`).join('')}</div><h3>Employer</h3><div class="emp"><img src="assets/avatar.jpg" alt=""><div><b>${j.co}</b><small>${j.loc}, Oriental Mindoro</small></div></div><span class="ver">${ic('check', 12)}Verified Business</span></div></div>
  <div class="jd-cta"><button class="btn btn-yellow" data-apply="${j.id}">${applied ? 'Applied ✓' : 'Apply Now'}</button><button class="btn btn-outline" id="save">${ic('bookmark', 16)}${saved ? 'Saved' : 'Save'}</button></div></div></div>`;
}

function vPassport() {
  const tabs = ['Overview', 'Experience', 'Skills', 'Certificates', 'Documents'];
  const skillBox = `<div class="card pbox"><h3>Skills</h3><div class="chips">${S.skills.map((s) => `<span class="tag">${s}</span>`).join('')}<button class="btn btn-outline btn-sm" id="addskill" style="margin-left:auto">+ Add Skill</button></div></div>`;
  const expBox = `<div class="card pbox"><h3>Experience</h3><div class="exp-i"><img src="assets/avatar.jpg" alt=""><div class="t"><h4>Construction Worker</h4><small>Rizal Construction Services | 2019 - Present</small></div><button class="btn btn-outline btn-sm" data-t="Edit experience">Edit</button></div><div class="end"><button class="btn btn-outline btn-sm" data-t="Add experience">Add Experience</button></div></div>`;
  const certBox = `<div class="card pbox"><h3>Certificates</h3><div class="exp-i"><img src="assets/avatar.jpg" alt=""><div class="t"><h4>NC I - Shielded Metal Arc Welding</h4><small>TESDA | 2021</small></div><button class="btn btn-outline btn-sm" data-t="Opening certificate…">View</button></div><div class="end"><button class="btn btn-outline btn-sm" data-t="Upload a certificate">Add Certificate</button></div></div>`;
  const docBox = `<div class="card pbox"><h3>Documents</h3><div class="exp-i"><div class="t"><h4>Resume.pdf</h4><small>Uploaded Oct 2026</small></div><button class="btn btn-outline btn-sm" data-t="Opening document…">View</button></div><div class="end"><button class="btn btn-outline btn-sm" data-t="Upload a document">Upload</button></div></div>`;
  const pick = { Overview: skillBox + expBox + certBox, Experience: expBox, Skills: skillBox, Certificates: certBox, Documents: docBox }[S.ptab];
  return shell('passport', `<div class="pg-h"><div><h1>Skills Passport</h1><p>Your skills, experience, and credentials in one place.</p></div></div>
  <div class="who"><div style="position:relative;width:56px;height:56px;border-radius:50%;overflow:hidden;border:2px solid var(--gold);flex-shrink:0"><img src="${USER.avatar}" id="who-avatar" alt="" style="width:100%;height:100%;object-fit:cover"></div><div class="t"><h3>${USER.name}</h3><p>${USER.title}</p><div class="lc">${ic('pin', 13)}${USER.loc}</div></div><label for="proto-photo-input" class="btn btn-outline btn-sm" style="cursor:pointer">📷 Upload Photo</label><input type="file" id="proto-photo-input" accept="image/*" style="display:none"></div>
  <div class="prog"><div class="l"><span>Profile Completion</span><span>80%</span></div><div class="bar"><i id="bar" data-w="80"></i></div><small>Step 4 of 5</small></div>
  <div class="tabs" role="tablist">${tabs.map((t) => `<button role="tab" data-ptab="${t}" class="${t === S.ptab ? 'on' : ''}" aria-selected="${t === S.ptab}">${t}</button>`).join('')}</div>${pick}`, { tinted: true });
}

function vTraining() {
  const tabs = ['All Courses', 'TESDA', 'Local Providers', 'Online'];
  const L = COURSES.filter((c) => S.tab === 'All Courses' || c.cat === S.tab || (S.tab === 'TESDA' && c.by === 'TESDA'));
  return shell('training', `<div class="pg-h"><div><h1>Training & Courses</h1><p>Build new skills and get certified.</p></div></div>
  <div class="tabs" style="margin-top:18px">${tabs.map((t) => `<button data-tab="${t}" class="${t === S.tab ? 'on' : ''}" style="${t === S.tab ? 'background:var(--blue);color:#fff;border-color:var(--blue);box-shadow:none' : ''}">${t}</button>`).join('')}</div>
  ${L.map((c) => `<div class="card course"><img src="assets/${c.img}.jpg" alt=""><div class="mid"><div class="h"><h3>${c.t}</h3>${c.badge ? `<span class="badge ${c.badge}">${c.badge === 'pop' ? 'Popular' : 'Top Rated'}</span>` : ''}</div><small>${c.by} • ${c.loc}</small><div class="meta"><span>${ic('clock', 14)}${c.hrs}</span><span>${ic('cash', 14)}${c.fee}</span></div></div><button class="btn btn-outline btn-sm bt" data-course="${c.id}">${S.course.has(c.id) ? 'Enrolled ✓' : 'View Details'}</button></div>`).join('') || '<div class="card empty">No courses in this category yet.</div>'}`, { tinted: true });
}

function vSimple(key) {
  const T = { profile: ['My Profile', 'Manage how employers see you.'], matches: ['Job Matches', 'Jobs that fit your Skills Passport.'], applications: ['Applications', 'Track the jobs you have applied to.'], messages: ['Messages', 'Chat with employers and trainers.'], settings: ['Settings', 'Account and notification preferences.'], about: ['About', 'HANAPBUHAY connects Oriental Mindoro to work and training.'] };
  const [t, d] = T[key] || ['Page', ''];
  let body = `<div class="card ph"><h2>Coming in the next phase</h2><p>This screen isn’t part of the Phase 1 design set.</p></div>`;
  if (key === 'matches') body = [...JOBS].sort((a, b) => b.match - a.match).map(jobCardRow).join('');
  if (key === 'applications') { const A = JOBS.filter((j) => S.applied.has(j.id)); body = A.length ? A.map(jobCardRow).join('') : `<div class="card ph"><h2>No applications yet</h2><p>Apply to a job and it will show up here.</p><p style="margin-top:14px"><a class="btn btn-yellow btn-sm" href="#/jobs">Browse jobs</a></p></div>`; }
  if (key === 'about') return `<div class="stage view"><header class="pubnav">${logo()}<nav><a href="#/">Home</a><a href="#/jobs">Jobs</a><a href="#/training">Training</a><a href="#/login">For Employers</a><a href="#/about" class="on">About</a></nav></header><div class="main"><div class="pg-h"><div><h1>${t}</h1><p>${d}</p></div></div></div></div>`;
  return shell(key, `<div class="pg-h"><div><h1>${t}</h1><p>${d}</p></div></div><div style="margin-top:20px">${body}</div>`, { navy: true });
}

function vMobile() {
  const nav = (on) => [['home', 'Home', 'home'], ['jobs', 'Jobs', 'brief'], ['training', 'Training', 'cap'], ['profile', 'Profile', 'user']].map(([k, l, i]) => `<a href="#/${k === 'home' ? 'mobile' : k === 'profile' ? 'passport' : k}" class="${k === on ? 'on' : ''}">${ic(i, 20)}${l}</a>`).join('');
  return `<div class="mwrap view"><a class="btn btn-outline btn-sm back2" href="#/">${ic('back', 14)}Desktop</a>
  <div class="phone"><div class="scr"><span class="notch"></span><div class="mstatus"><span>9:41</span><span>●●● ▮</span></div>
  <div class="mscroll"><div class="mtop">${logo(true)}<button aria-label="Menu">${ic('menu', 22)}</button></div>
   <div class="mhero"><h1>Find Work.<br>Build Skills.<br><em>Move Forward.</em></h1><p>Jobs, skills, and training for a stronger Oriental Mindoro.</p></div>
   <form class="msearch" id="msearch"><label>${ic('search', 16)}<input placeholder="Job title, skills, or keyword" aria-label="Job"></label><label>${ic('pin', 16)}<input value="Calapan City" aria-label="Location"></label><button class="go" aria-label="Search">${ic('search', 18)}</button></form>
   <div class="mh3">Quick Links</div><div class="mq"><a href="#/jobs"><i>${ic('brief', 20)}</i>Jobs</a><a href="#/training"><i>${ic('cap', 20)}</i>Training</a><a href="#/passport"><i>${ic('passport', 20)}</i>Skills Pass</a><a href="#/passport"><i>${ic('user', 20)}</i>Profile</a></div>
   <div class="mh3">Top Job Matches</div>${[1, 5, 3].map((id) => { const j = jobById(id); return `<div class="mjob" data-job="${j.id}"><img src="assets/${j.img}.jpg" alt=""><div><h4>${j.title}</h4><small>${j.co}</small><div class="ps"><span class="pill">${ic('check', 11)}${j.match}% Match</span><span class="pill">${j.pay}</span></div></div></div>`; }).join('')}</div>
  <nav class="mnav" aria-label="Mobile">${nav('home')}</nav></div></div><div class="cap">Mobile Responsive Preview</div></div>`;
}

/* ---------- router ---------- */
const SCREENS = [['#/', '1 Landing'], ['#/login', '2 Login'], ['#/dashboard', '3 Dashboard'], ['#/jobs', '4 Search'], ['#/jobs/1', '5 Details'], ['#/passport', '6 Passport'], ['#/training', '7 Training'], ['#/mobile', 'Mobile']];
const PRIVATE = ['dashboard', 'passport', 'training', 'profile', 'matches', 'applications', 'messages', 'settings'];

function route() {
  const raw = location.hash || '#/';
  const [path, qs] = raw.slice(1).split('?');
  const seg = path.split('/').filter(Boolean);
  const page = seg[0] || '';
  if (PRIVATE.includes(page) && !S.authed && !store.get('demo', true)) { go('#/login'); return; }
  let html;
  if (page === '') html = vLanding();
  else if (page === 'login') html = vLogin(/signup=1/.test(qs || ''));
  else if (page === 'dashboard') html = vDashboard();
  else if (page === 'jobs') html = seg[1] ? vJob(seg[1]) : vJobs();
  else if (page === 'passport') html = vPassport();
  else if (page === 'training') html = vTraining();
  else if (page === 'mobile') html = vMobile();
  else html = vSimple(page);
  const keepScroll = app.dataset.p === raw;
  app.dataset.p = raw;
  const y = scrollY;
  app.innerHTML = html;
  if (!keepScroll) scrollTo(0, 0); else scrollTo(0, y);
  document.title = 'HANAPBUHAY — ' + ({ '': 'Find Work. Build Skills. Move Forward.', login: 'Log in', dashboard: 'Dashboard', jobs: 'Jobs', passport: 'Skills Passport', training: 'Training & Courses', mobile: 'Mobile preview' }[page] || 'Prototype');
  bar(raw); wire(page);
}
function bar(raw) {
  let b = $('.pbar');
  if (!b) { b = document.createElement('nav'); b.className = 'pbar'; b.setAttribute('aria-label', 'Prototype screens'); document.body.appendChild(b); }
  b.innerHTML = SCREENS.map(([h, l]) => `<a href="${h}" class="${raw === h || (h === '#/jobs/1' && /^#\/jobs\/\d/.test(raw)) ? 'on' : ''}">${l}</a>`).join('');
}

/* ---------- interactions ---------- */
function rerenderList() { const jl = $('#jl'); if (!jl) return route(); const L = filtered(); jl.innerHTML = L.length ? L.map(jobCardRow).join('') : '<div class="card empty"><h3>No jobs match your filters</h3><p>Try clearing some filters.</p></div>'; $('.res-h p').textContent = `${S.touched || S.q ? L.length : 48} jobs found in Calapan City, Oriental Mindoro`; }

function wire() {}
function onClick(e) {
  const t = e.target;
  let el;
  if ((el = t.closest('[data-fav]'))) { e.stopPropagation(); const id = +el.dataset.fav; S.favs.has(id) ? S.favs.delete(id) : S.favs.add(id); persist(); el.classList.toggle('on', S.favs.has(id)); toast(S.favs.has(id) ? 'Job saved to favorites' : 'Removed from favorites'); return; }
  if ((el = t.closest('[data-apply]'))) { e.stopPropagation(); applyFlow(jobById(el.dataset.apply)); return; }
  if ((el = t.closest('[data-job]'))) { go('#/jobs/' + el.dataset.job); return; }
  if ((el = t.closest('[data-go]'))) { go('#/' + el.dataset.go); return; }
  if ((el = t.closest('[data-cat]'))) { S.q = el.dataset.cat.split(' ')[0]; go('#/jobs'); return; }
  if ((el = t.closest('[data-ptab]'))) { S.ptab = el.dataset.ptab; route(); return; }
  if ((el = t.closest('[data-tab]'))) { S.tab = el.dataset.tab; route(); return; }
  if ((el = t.closest('[data-t]'))) { toast(el.dataset.t); return; }
  if ((el = t.closest('[data-role]'))) { S.role = el.dataset.role; $$('.role').forEach((r) => { const on = r.dataset.role === S.role; r.classList.toggle('on', on); r.setAttribute('aria-checked', on); }); return; }
  if ((el = t.closest('[data-course]'))) { const c = COURSES.find((x) => x.id === +el.dataset.course); modal(`<h2>${c.t}</h2><p>${c.by} • ${c.loc}<br>${c.hrs} • ${c.fee}</p><p>Hands-on, competency-based training aligned with TESDA standards. Complete the course to earn a National Certificate and add it to your Skills Passport.</p><div class="btns"><button class="btn btn-outline btn-sm" data-close>Close</button><button class="btn btn-yellow btn-sm" id="enr">${S.course.has(c.id) ? 'Enrolled ✓' : 'Enroll Now'}</button></div>`, (o, close) => $('#enr', o).onclick = () => { S.course.add(c.id); close(); toast('Enrolled in ' + c.t); route(); }); return; }
  if (t.closest('#addskill')) { modal(`<h2>Add a skill</h2><p>Skills help us match you to better jobs.</p><div class="inp"><input id="ns" placeholder="e.g. Plumbing" style="padding-right:14px" aria-label="Skill"></div><div class="btns"><button class="btn btn-outline btn-sm" data-close>Cancel</button><button class="btn btn-yellow btn-sm" id="ok">Add</button></div>`, (o, close) => { const i = $('#ns', o); i.focus(); const add = () => { const v = i.value.trim(); if (!v) return; if (!S.skills.includes(v)) S.skills.push(v); persist(); close(); toast('Skill added'); route(); }; $('#ok', o).onclick = add; i.onkeydown = (ev) => ev.key === 'Enter' && add(); }); return; }
  if (t.closest('#save')) { const id = +location.hash.split('/')[2]; S.saved.has(id) ? S.saved.delete(id) : S.saved.add(id); persist(); toast(S.saved.has(id) ? 'Job saved' : 'Removed from saved'); route(); return; }
  if (t.closest('#usrbtn')) { $('#umenu').classList.toggle('open'); return; }
  if (t.closest('#logout')) { S.authed = false; store.set('demo', false); persist(); toast('Logged out'); go('#/'); return; }
  if (t.closest('#bell')) { toast('You have 2 new job matches'); return; }
  if (t.closest('#burger')) { $('#pubnav').classList.toggle('open'); return; }
  if (t.closest('#eye')) { const i = $('#pw'); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; $('#eye').innerHTML = ic(show ? 'eyeoff' : 'eye', 18); return; }
  if (t.closest('#google')) { S.authed = true; store.set('demo', true); persist(); toast('Signed in with Google (demo)'); go('#/dashboard'); return; }
  if (t.closest('#forgot')) { e.preventDefault(); toast('Password reset link sent (demo)'); return; }
  if (t.closest('#clr')) { S.touched = true; S.f = { type: new Set(), loc: new Set(), pay: new Set(), skill: new Set() }; S.q = ''; route(); return; }
  if (!t.closest('#usr')) { const m = $('#umenu'); m && m.classList.remove('open'); }
}
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'proto-photo-input' && t.files?.[0]) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      USER.avatar = evt.target.result;
      store.set('avatar', evt.target.result);
      toast('Profile photo updated!');
      route();
    };
    reader.readAsDataURL(t.files[0]);
  }
  if (t.matches('[data-f]')) { S.touched = true; const set = S.f[t.dataset.f]; t.checked ? set.add(t.value) : set.delete(t.value); rerenderList(); }
  if (t.id === 'sort') { S.sort = t.value; rerenderList(); }
});
document.addEventListener('keydown', (e) => {
  if (e.target.id === 'gs' && e.key === 'Enter') { S.q = e.target.value.trim(); if (!location.hash.startsWith('#/jobs') || /jobs\/\d/.test(location.hash)) go('#/jobs'); else route(); }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('article[data-job]')) { e.preventDefault(); go('#/jobs/' + e.target.dataset.job); }
});
document.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'hsearch') { S.q = f.q.value.trim(); go('#/jobs'); }
  if (f.id === 'msearch') { go('#/jobs'); }
  if (f.id === 'lf') {
    const em = $('#em').value.trim(), pw = $('#pw').value, err = $('#err');
    $('#emw').classList.remove('err'); $('#pww').classList.remove('err');
    if (!/^\S+@\S+\.\S+$/.test(em)) { $('#emw').classList.add('err'); err.textContent = 'Enter a valid email address.'; $('#em').focus(); return; }
    if (pw.length < 6) { $('#pww').classList.add('err'); err.textContent = 'Password must be at least 6 characters.'; $('#pw').focus(); return; }
    err.textContent = ''; const b = $('#sub'); b.disabled = true; b.textContent = 'Please wait…';
    setTimeout(() => { S.authed = true; store.set('demo', true); persist(); toast('Welcome back, ' + USER.first + '!'); go('#/dashboard'); }, 600);
  }
});
window.addEventListener('hashchange', route);
window.addEventListener('load', () => { app.addEventListener('click', onClick); route(); requestAnimationFrame(() => { const b = $('#bar'); b && (b.style.width = b.dataset.w + '%'); }); });
new MutationObserver(() => { const b = $('#bar'); if (b && !b.style.width) requestAnimationFrame(() => requestAnimationFrame(() => (b.style.width = b.dataset.w + '%'))); }).observe(app, { childList: true });
})();
