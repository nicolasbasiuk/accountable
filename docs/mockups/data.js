// Data and helpers shared by the three mockups, so they differ only in look.
// Today is Tuesday, Nov 24, 2026. Every figure is worked out from the lists below.
const TODAY = '2026-11-24';

const STAGES = [
  { key: 'new', name: 'New', p: 10, color: '#06D6A0', on: '#073B4C' },
  { key: 'qualified', name: 'Qualified', p: 25, color: '#FFC145', on: '#073B4C' },
  { key: 'proposal', name: 'Proposal', p: 50, color: '#F78C6B', on: '#073B4C' },
  { key: 'negotiation', name: 'Negotiation', p: 75, color: '#118AB2', on: '#FFFFFF' },
  { key: 'won', name: 'Won', p: 100, color: '#073B4C', on: '#FFFFFF' },
  { key: 'lost', name: 'Lost', p: 0, color: '#6B818A', on: '#073B4C' },
];

// name, organization, value, close date, probability if set by hand
const CARDS = {
  new: [
    ['Customer portal', 'Upland Water', 88000, '2027-03-18'],
    ['Mobile app', 'Juniper Retail Group', 95000, '2027-03-22'],
    ['Phone system', 'Brightwater Dental Group', 16500, '2026-11-20'],
    ['Device rollout', 'Eastbrook Schools', 64000, '2027-03-05'],
    ['Security audit', 'Verity Accounting', 19000, '2027-01-18'],
    ['Network refresh', 'Cedar Row Hotels', 72500, '2027-03-12'],
    ['Website rebuild', 'Pinecrest Farms', 18500, '2027-02-12'],
    ['Penetration test', 'Fenwick Insurance', 22000, '2027-01-22'],
    ['Email migration', 'Dunmore Legal', 14500, '2027-01-15'],
    ['Inventory system', 'Marlow Textiles', 46000, '2027-02-26'],
    ['Backup and recovery', 'Saltmarsh Marine', 27500, '2027-02-05'],
    ['Managed support', 'Quillon Publishing', 36000, '2027-01-29'],
    ['Reporting dashboard', 'Redfern Motors', 31000, '2027-02-19'],
    ['API integration', 'Tamsin Cosmetics', 41500, '2027-02-09'],
    ['Help desk setup', 'Oakline Property', 24000, '2027-03-02'],
    ['Data cleanup', 'Calloway Foods', 9500, '2027-01-08'],
  ],
  qualified: [
    ['Order tracking', 'Kestrel Aviation Parts', 68000, '2027-02-02'],
    ['Cloud migration', 'Alder & Pike Logistics', 118000, '2027-02-16'],
    ['Booking system', 'Cedar Row Hotels', 39000, '2026-11-17'],
    ['Data warehouse', 'Halden Pharma', 132000, '2027-03-09'],
    ['Identity and access', 'Larkfield Credit Union', 57000, '2027-01-26'],
    ['Security training', 'Fenwick Insurance', 12500, '2026-12-11'],
    ['Field app', 'Corvane Energy', 84000, '2027-02-23'],
    ['Managed support', 'Granite Peak Builders', 48000, '2027-01-12'],
    ['Email migration', 'Newhaven Clinics', 26500, '2026-12-18'],
    ['Network refresh', 'Ironleaf Manufacturing', 54500, '2027-01-20'],
    ['Payroll integration', 'Verity Accounting', 33000, '2027-01-05'],
    ['Backup and recovery', 'Redfern Motors', 21500, '2026-12-22'],
  ],
  proposal: [
    ['ERP integration', 'Calloway Foods', 104000, '2027-01-14'],
    ['Case management', 'Dunmore Legal', 58500, '2027-01-19', 40],
    ['Device rollout', 'Newhaven Clinics', 43000, '2026-11-19'],
    ['Customer portal', 'Larkfield Credit Union', 91500, '2027-01-28'],
    ['Penetration test', 'Corvane Energy', 28000, '2026-12-04'],
    ['Helpdesk outsourcing', 'Brightwater Dental Group', 62000, '2026-12-16'],
    ['Website rebuild', 'Tamsin Cosmetics', 35500, '2026-12-10'],
    ['Cloud migration', 'Marlow Textiles', 76000, '2027-02-04'],
    ['Reporting dashboard', 'Upland Water', 29500, '2026-12-29'],
  ],
  negotiation: [
    ['Learning platform', 'Eastbrook Schools', 78000, '2027-01-11'],
    ['Managed support', 'Alder & Pike Logistics', 86000, '2026-12-03'],
    ['Identity and access', 'Ironleaf Manufacturing', 52500, '2026-11-13', 60],
    ['Data warehouse', 'Juniper Retail Group', 124500, '2026-12-15'],
    ['Security audit', 'Halden Pharma', 47000, '2026-12-01', 80],
    ['Mobile app', 'Granite Peak Builders', 69000, '2026-12-21'],
    ['Network refresh', 'Saltmarsh Marine', 31500, '2026-12-08'],
  ],
  won: [
    ['Cloud migration', 'Newhaven Clinics', 82000, '2026-11-18'],
    ['Security audit', 'Oakline Property', 24500, '2026-11-10'],
    ['Managed support', 'Upland Water', 41500, '2026-11-04'],
    ['ERP integration', 'Redfern Motors', 96500, '2026-10-27'],
    ['Network refresh', 'Quillon Publishing', 38000, '2026-10-21'],
    ['Customer portal', 'Fenwick Insurance', 54000, '2026-10-13'],
    ['Email migration', 'Pinecrest Farms', 15000, '2026-10-06'],
    ['Data warehouse', 'Corvane Energy', 88500, '2026-09-24'],
    ['Backup and recovery', 'Dunmore Legal', 22500, '2026-09-16'],
    ['Inventory system', 'Kestrel Aviation Parts', 45000, '2026-09-08'],
    ['Device rollout', 'Verity Accounting', 46500, '2026-08-28'],
  ],
  lost: [
    ['Phone system', 'Marlow Textiles', 28000, '2026-11-12'],
    ['Mobile app', 'Kestrel Aviation Parts', 73000, '2026-10-30'],
    ['Help desk setup', 'Larkfield Credit Union', 34500, '2026-10-15'],
    ['Cloud migration', 'Saltmarsh Marine', 61000, '2026-10-02'],
    ['Website rebuild', 'Halden Pharma', 19500, '2026-09-22'],
    ['Data cleanup', 'Oakline Property', 11000, '2026-09-03'],
  ],
};

// month, revenue won, deals won
const MONTHS = [
  ['Dec', 84000, 2], ['Jan', 71500, 2], ['Feb', 126000, 3], ['Mar', 98500, 2],
  ['Apr', 142000, 3], ['May', 118500, 3], ['Jun', 187000, 4], ['Jul', 92000, 2],
  ['Aug', 134500, 3], ['Sep', 156000, 3], ['Oct', 203500, 4], ['Nov', 148000, 3],
];

// deals lost in the 12 months, by the stage they were lost from: deals, value
const LOST_FROM = { new: [5, 128000], qualified: [5, 196500], proposal: [4, 187000], negotiation: [4, 172500] };

// date, type, description, record, organization
const FOLLOW_UPS = [
  ['2026-11-16', 'call', 'Call back about the phone system quote', 'Phone system', 'Brightwater Dental Group'],
  ['2026-11-17', 'email', 'Send new dates for the booking system demo', 'Booking system', 'Cedar Row Hotels'],
  ['2026-11-18', 'email', 'Send the revised device list', 'Device rollout', 'Newhaven Clinics'],
  ['2026-11-19', 'call', 'Ask who signs off the budget', 'Marcus Webb', 'Redfern Motors'],
  ['2026-11-20', 'call', 'Go through the contract comments', 'Identity and access', 'Ironleaf Manufacturing'],
  ['2026-11-23', 'note', 'Check references before the final call', 'Security audit', 'Halden Pharma'],
  ['2026-11-24', 'call', 'Agree the start date and payment terms', 'Managed support', 'Alder & Pike Logistics'],
  ['2026-11-24', 'email', 'Send the security questionnaire', 'Penetration test', 'Corvane Energy'],
  ['2026-11-25', 'call', 'Discuss hosting options', 'Priya Nair', 'Halden Pharma'],
  ['2026-11-27', 'email', 'Share two case studies', 'Cloud migration', 'Marlow Textiles'],
  ['2026-11-30', 'call', 'Review the proposal with the board', 'Customer portal', 'Larkfield Credit Union'],
  ['2026-11-30', 'note', 'Prepare pricing for the extra sites', 'Network refresh', 'Saltmarsh Marine'],
  ['2026-12-01', 'call', 'Final call before signing', 'Security audit', 'Halden Pharma'],
  ['2026-12-02', 'email', 'Introduce the project lead', 'Data warehouse', 'Juniper Retail Group'],
  ['2026-12-04', 'call', 'Check the site survey is booked', 'Field app', 'Corvane Energy'],
  ['2026-12-07', 'email', 'Send the training plan', 'Security training', 'Fenwick Insurance'],
];

// date, type, text, record, organization
const RECENT = [
  ['2026-11-24', 'call', 'Talked through payment terms', 'Managed support', 'Alder & Pike Logistics'],
  ['2026-11-23', 'move', 'Moved from Proposal to Negotiation', 'Learning platform', 'Eastbrook Schools'],
  ['2026-11-23', 'email', 'Sent the revised proposal', 'Case management', 'Dunmore Legal'],
  ['2026-11-23', 'note', 'Wants it running before the spring term', 'Learning platform', 'Eastbrook Schools'],
  ['2026-11-20', 'move', 'Moved from New to Qualified', 'Order tracking', 'Kestrel Aviation Parts'],
  ['2026-11-20', 'call', 'First call, keen to start in January', 'Customer portal', 'Upland Water'],
  ['2026-11-19', 'email', 'Sent the agenda for the workshop', 'ERP integration', 'Calloway Foods'],
  ['2026-11-18', 'move', 'Moved from Negotiation to Won', 'Cloud migration', 'Newhaven Clinics'],
  ['2026-11-17', 'call', 'Agreed to sign this week', 'Cloud migration', 'Newhaven Clinics'],
  ['2026-11-17', 'note', 'Budget is approved for next year', 'Wen Zhao', 'Juniper Retail Group'],
];

// Helpers
const usd = n => '$' + Math.round(n).toLocaleString('en-US');
const usdK = n => (n ? '$' + n / 1000 + 'K' : '$0');
const esc = s => s.replace(/&/g, '&amp;');
const day = iso => new Date(iso + 'T12:00:00');
const date = iso => day(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const daysFromToday = iso => Math.round((day(iso) - day(TODAY)) / 864e5);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const sum = (list, f) => list.reduce((t, x) => t + f(x), 0);
const dueLabel = iso => ({ 0: 'Today', 1: 'Tomorrow' }[daysFromToday(iso)] || date(iso));

// Columns: the stages with their cards and totals
const COLUMNS = STAGES.map(s => {
  const cards = CARDS[s.key].map(([name, org, value, close, p = s.p]) => {
    const open = s.key !== 'won' && s.key !== 'lost';
    const late = open ? Math.max(0, -daysFromToday(close)) : 0;
    return { name, org, value, close, p, late };
  });
  return { ...s, cards, value: sum(cards, c => c.value), expected: sum(cards, c => c.value * c.p / 100) };
});
const OPEN = COLUMNS.slice(0, 4);
const WON_12 = { value: sum(MONTHS, m => m[1]), deals: sum(MONTHS, m => m[2]) };
const FIGURES = {
  wonMonth: MONTHS[11][1], wonMonthDeals: MONTHS[11][2], won12: WON_12.value, won12Deals: WON_12.deals,
  open: sum(OPEN, c => c.value), openDeals: sum(OPEN, c => c.cards.length), expected: sum(OPEN, c => c.expected),
};
const FUNNEL = STAGES.slice(0, 5).map((s, i) => {
  if (s.key === 'won') return { ...s, value: WON_12.value, deals: WON_12.deals };
  const later = OPEN.slice(i), lost = OPEN.slice(i).map(c => LOST_FROM[c.key]);
  return { ...s,
    value: sum(later, c => c.value) + sum(lost, l => l[1]) + WON_12.value,
    deals: sum(later, c => c.cards.length) + sum(lost, l => l[0]) + WON_12.deals };
}).map((s, i, all) => ({ ...s, share: i ? Math.round(s.value / all[i - 1].value * 100) : null }));
const OVERDUE = FOLLOW_UPS.filter(f => daysFromToday(f[0]) < 0);
const DUE = FOLLOW_UPS.filter(f => daysFromToday(f[0]) >= 0);
const LATE = sum(OPEN, c => c.cards.filter(x => x.late).length);
const LINE = `${OVERDUE.length} follow-ups are overdue and ${LATE} deals are late.`;

const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  organizations: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M2 21h20M8 7h4M8 11h4M8 15h4"/>',
  contacts: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  deals: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2 13h20"/>',
  pipeline: '<path d="M6 5v11M12 5v6M18 5v14"/>',
  call: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  email: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  note: '<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5z"/><path d="M15 3v6h6"/>',
  move: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const icon = (name, size = 18) => `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
const MARK = '<svg width="26" height="22" viewBox="0 0 26 22" aria-hidden="true"><rect width="26" height="6" rx="3" fill="#06D6A0"/><rect x="4" y="8" width="18" height="6" rx="3" fill="#FFC145"/><rect x="8" y="16" width="10" height="6" rx="3" fill="#F78C6B"/></svg>';
const navHTML = () => ['Dashboard', 'Organizations', 'Contacts', 'Deals', 'Pipeline'].map(n => {
  const k = n.toLowerCase(), here = k === 'dashboard' || k === 'pipeline';
  return `<a class="nav" data-nav="${k}" ${here ? `href="#${k}"` : ''}>${icon(k)}${n}</a>`;
}).join('');

// A smooth line that never overshoots its points
function smooth(pts) {
  const n = pts.length, dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : 2 * m[i - 1] * m[i] / (m[i - 1] + m[i]);
  let d = `M${pts[0]}`;
  for (let i = 0; i < n - 1; i++) d += `C${pts[i][0] + dx[i] / 3},${pts[i][1] + t[i] * dx[i] / 3} ${pts[i + 1][0] - dx[i] / 3},${pts[i + 1][1] - t[i + 1] * dx[i] / 3} ${pts[i + 1]}`;
  return d;
}
// Draws at the real size, so text keeps its size, and again whenever the size changes
function draw(selector, fn) {
  const node = document.querySelector(selector);
  new ResizeObserver(() => { const w = node.clientWidth, h = node.clientHeight; if (w) node.innerHTML = `<svg width="${w}" height="${h}" role="img" aria-label="${node.dataset.label}">${fn(w, h)}</svg>`; }).observe(node);
}
const fill = (selector, html) => { document.querySelector(selector).innerHTML = html; };
function route() {
  const page = location.hash === '#pipeline' ? 'pipeline' : 'dashboard';
  document.body.dataset.page = page;
  document.querySelectorAll('[data-nav]').forEach(a => a.dataset.nav === page ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  scrollTo(0, 0);
}
addEventListener('hashchange', route);
