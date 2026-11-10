'use strict';
/* =====================================================================
   DealRadar NL — deel 1: logica
   1. Hulpjes            2. Basisdata          3. Opslag en instellingen
   4. Toestand (state)   5. Rekenen            6. Filteren en sorteren
   7. Links naar aanbieders                    8. Live bronnen (API's)
   De schermen (UI) staan in deel 2.
   ===================================================================== */

/* ---------- 1. Hulpjes ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NF0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const NF2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
function eur(v) {
  if (v == null || Number.isNaN(v)) return '–';
  return Math.abs(v - Math.round(v)) < 0.005 ? NF0.format(Math.round(v)) : NF2.format(v);
}
function dur(min) {
  if (min == null || Number.isNaN(min)) return '?';
  const t = Math.round(min), h = Math.floor(t / 60), m = t % 60;
  return h ? `${h}u${String(m).padStart(2, '0')}` : `${m} min`;
}
function kg(v) { return v < 10 ? v.toFixed(1).replace('.', ',') + ' kg' : Math.round(v) + ' kg'; }
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MONTHS_LONG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const DOW = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
function todayISO() { const t = new Date(); t.setMinutes(t.getMinutes() - t.getTimezoneOffset()); return t.toISOString().slice(0, 10); }
function addDays(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
function dateNL(iso, opts = {}) {
  if (!iso) return '';
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  const y = d.getFullYear() !== new Date().getFullYear() || opts.year ? ' ' + d.getFullYear() : '';
  return `${opts.dow === false ? '' : DOW[d.getDay()] + ' '}${d.getDate()} ${MONTHS[d.getMonth()]}${y}`;
}
function timeNL(isoDateTime) {
  const d = new Date(isoDateTime);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function ageOf(isoDateTime) {
  const ms = Date.now() - new Date(isoDateTime).getTime();
  const min = Math.max(0, Math.round(ms / 60000)), h = Math.round(min / 60), d = Math.round(h / 24);
  const text = min < 60 ? `${min} min geleden` : h < 48 ? `${h} uur geleden` : `${d} dagen geleden`;
  return { text, cls: h < 24 ? 'fresh' : d <= 7 ? 'aging' : 'old', days: ms / 86400000 };
}
function km(a, b) {
  const R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const inFrame = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();

/* ---------- 2. Basisdata ---------- */
const DEST = BASE.dest;
Object.entries(DEST).forEach(([id, d]) => { d.id = id; });
const STATIONS = BASE.stations.map(([n, lat, lon, uic]) => ({ n, lat, lon, uic, kind: 'station' }));
const NL_AIR = BASE.airports;
const AIRPORT_PLACES = Object.entries(NL_AIR).map(([c, a]) => ({ n: `${a.n} (${c})`, lat: a.lat, lon: a.lon, kind: 'airport', iata: c }));
const CODE2DEST = {};
Object.values(DEST).forEach(d => (d.codes || []).forEach(c => { CODE2DEST[c] = d.id; }));
const COUNTRIES = {};
Object.values(DEST).forEach(d => { COUNTRIES[d.cc] = d.c; });
const TYPES = { stad: 'Stedentrip', strand: 'Strand', natuur: 'Natuur', ski: 'Skiën' };
const MODES = {
  trein: { label: 'Trein', icon: 'i-trein' },
  vliegtuig: { label: 'Vliegtuig', icon: 'i-vliegtuig' },
  bus: { label: 'Bus', icon: 'i-bus' },
  combi: { label: 'Combinatie', icon: 'i-combi' },
};
const AIRLINES = { FR: 'Ryanair', RK: 'Ryanair', U2: 'easyJet', EC: 'easyJet', DS: 'easyJet', HV: 'Transavia', KL: 'KLM', VY: 'Vueling', W6: 'Wizz Air', W4: 'Wizz Air', W9: 'Wizz Air', LH: 'Lufthansa', LX: 'Swiss', OS: 'Austrian', SN: 'Brussels Airlines', IB: 'Iberia', TP: 'TAP Air Portugal', BA: 'British Airways', AF: 'Air France', AZ: 'ITA Airways', TK: 'Turkish Airlines', PC: 'Pegasus', XQ: 'SunExpress', OR: 'TUI', X3: 'TUI', CD: 'Corendon', XC: 'Corendon', DY: 'Norwegian', D8: 'Norwegian', SK: 'SAS', A3: 'Aegean', EW: 'Eurowings', BT: 'airBaltic', LO: 'LOT', RO: 'Tarom', JU: 'Air Serbia', OU: 'Croatia Airlines', FB: 'Bulgaria Air', V7: 'Volotea', LS: 'Jet2', EI: 'Aer Lingus', FI: 'Icelandair', AY: 'Finnair', AT: 'Royal Air Maroc' };
const AIRLINE_SITES = { Ryanair: 'https://www.ryanair.com/nl/nl', easyJet: 'https://www.easyjet.com/nl/', Transavia: 'https://www.transavia.com/nl-NL/aanbiedingen/', KLM: 'https://www.klm.nl/', Vueling: 'https://www.vueling.com/nl', 'Wizz Air': 'https://wizzair.com/nl-nl', TUI: 'https://www.tui.nl/', Corendon: 'https://www.corendon.nl/', 'Sky Alps': 'https://www.skyalps.com/' };

/* ---------- 3. Opslag en instellingen ---------- */
// Alles blijft in jouw eigen browser (localStorage). Lukt dat niet, dan alleen in het geheugen.
const MEM = {};
const store = {
  get(k, d) { try { const v = localStorage.getItem('dealradar:' + k); if (v != null) return JSON.parse(v); } catch (e) { /* geen opslag */ } return k in MEM ? MEM[k] : d; },
  set(k, v) { MEM[k] = v; try { localStorage.setItem('dealradar:' + k, JSON.stringify(v)); } catch (e) { /* geen opslag */ } },
  clear() { Object.keys(MEM).forEach(k => delete MEM[k]); try { Object.keys(localStorage).filter(k => k.startsWith('dealradar:')).forEach(k => localStorage.removeItem(k)); } catch (e) { /* geen opslag */ } },
};
const DEFAULT_SETTINGS = { nsKey: '', tpToken: '', proxy: '', showDemo: false, checkinAMS: 120, checkinRegional: 90, transferCity: 40, hourValue: 10, co2Value: 0.10, theme: 'system' };
const settings = Object.assign({}, DEFAULT_SETTINGS, store.get('settings', {}));
function saveSettings() { store.set('settings', settings); }

/* ---------- 4. Toestand ---------- */
const UTRECHT = STATIONS.find(s => s.n === 'Utrecht Centraal') || STATIONS[0];
function defaultFilters() {
  return { modes: new Set(['trein', 'vliegtuig', 'bus', 'combi']), maxPrice: 300, maxHours: 24, maxAccess: 300, direct: false, bagIncl: false, countries: new Set(), types: new Set(), status: new Set(['snapshot', 'live']),
    origins: new Set(), nlOnly: false, depPart: 'alle', noIndic: false };
}
const state = {
  origin: store.get('origin', { n: UTRECHT.n, lat: UTRECHT.lat, lon: UTRECHT.lon, kind: 'station', uic: UTRECHT.uic }),
  dest: 'overal',
  trip: ['enkel', 'retour'].includes(store.get('trip')) ? store.get('trip') : 'retour', // soort reis: enkele reis of retour
  stay: 'alle',      // verblijf bij retour: alle | kort (1–4 nachten) | week (5–9) | lang (10+)
  bag: 'tasje',      // bagage bij live zoeken: tasje | hand | koffer
  when: { mode: 'flex', month: null, hol: 'kerst', region: store.get('region', 'midden'), from: '', to: '' },
  perDest: store.get('perDest', true),   // één (beste) deal per bestemming tonen
  layout: store.get('layout', 'cards'),  // cards | rows
  shown: 24,
  travellers: 1,
  profile: store.get('profile', 'volwassene'),
  sort: 'prijs',
  tab: 'deals',
  filters: defaultFilters(),
  liveDeals: [],
  liveTP: [],
  liveKiwi: [],
  nsAccess: {},
  src: {
    snapshot: { status: 'ok', text: '' },
    ns: { status: 'off', text: 'niet gekoppeld' },
    tp: { status: 'off', text: 'niet gekoppeld' },
    pdok: { status: 'idle', text: 'adres zoeken' },
    kiwi: { status: 'off', text: 'niet gekoppeld' },
    cloud: { status: 'off', text: 'alleen in Claude' },
    links: { status: 'ok', text: '' },
  },
  favorites: store.get('favorites', []),
  alerts: store.get('alerts', []),
  scanning: false,
  mapSel: null,
  group: null,
  groupSort: 'prijs',
};
const isYouth = () => state.profile === 'jongere12' || state.profile === 'jongere27';
const noLimit = (v, max) => v >= max;

/* ---------- 5. Rekenen ---------- */
// Reistijd schatten als een bron die niet noemt (altijd gemarkeerd als schatting).
// Per overstap tellen we een wachttijd mee: vliegen ca. 2,5 uur (overstap + extra vlucht), trein/bus 30 min.
const TRANSFER_MIN = { vliegtuig: 150, trein: 30, bus: 30 };
function estTravel(mode, gcd, transfers = 0) {
  const extra = (transfers || 0) * (TRANSFER_MIN[mode] ?? 30);
  if (mode === 'vliegtuig') return Math.round(35 + gcd / 760 * 60) + extra;
  if (mode === 'bus') return Math.round(gcd * CO2.routeGround / 68 * 60) + extra;
  return Math.round(gcd * CO2.routeGround / 95 * 60) + extra;
}
function originKey(o) { return `${o.lat.toFixed(4)},${o.lon.toFixed(4)}`; }
function nearestStation(pt) {
  let best = null, bd = Infinity;
  for (const s of STATIONS) { const d = km(pt, s); if (d < bd) { bd = d; best = s; } }
  return { ...best, km: bd };
}
function nearestAirports(pt, n = 5) {
  return Object.entries(NL_AIR).map(([c, a]) => ({ iata: c, n: a.n, lat: a.lat, lon: a.lon, km: km(pt, a) })).sort((a, b) => a.km - b.km).slice(0, n);
}
// Reis van jouw vertrekpunt naar het vertrekpunt van de deal (NS live als die er is, anders schatting)
function accessFor(pt, home = state.origin) {
  const d = km(home, pt);
  const live = state.nsAccess[`${originKey(home)}|${pt.uic}`];
  if (live) {
    const busExtra = pt.kind === 'airport' && pt.iata !== 'AMS' ? 25 : 0;
    return { min: live.min + busExtra, eur: live.eur, est: busExtra > 0, live: true, km: d, transfers: live.transfers, busExtra, when: live.when };
  }
  if (d < 1.5) return { min: 5, eur: 0, est: true, km: d };
  return { min: Math.round(15 + d / 65 * 60), eur: null, est: true, km: d };
}
function waitMin(e) {
  if (e.mode === 'vliegtuig') return e.o.iata === 'AMS' ? settings.checkinAMS : settings.checkinRegional;
  return e.mode === 'bus' ? 15 : 10;
}
function enrich(deal) {
  const dest = DEST[deal.to];
  const o = ORIGINS[deal.from];
  if (!dest || !o) return null;
  const arrPt = deal.arr && ARR_AIRPORTS[deal.arr] ? ARR_AIRPORTS[deal.arr] : dest;
  const gcd = km(o, arrPt);
  const isFlight = deal.mode === 'vliegtuig';
  const routeKm = deal.km || (isFlight ? gcd * CO2.upliftFlight : gcd * CO2.routeGround);
  const durEst = deal.dur == null;
  const nights = deal.out && deal.back ? Math.round((new Date(deal.back + 'T12:00:00') - new Date(deal.out + 'T12:00:00')) / 86400000) : null;
  const duration = deal.dur ?? estTravel(deal.mode === 'combi' ? 'trein' : deal.mode, gcd, deal.transfers);
  const fac = isFlight ? (gcd < 700 ? CO2.vliegKort : CO2.vlieg) : (deal.mode === 'bus' ? CO2.bus : CO2.trein);
  const legs = deal.trip === 'retour' ? 2 : 1;
  let egress;
  if (isFlight) {
    const far = deal.arr && ARR_AIRPORTS[deal.arr] ? km(ARR_AIRPORTS[deal.arr], dest) : 0;
    egress = 30 + (far > 25 ? Math.round(20 + far) : settings.transferCity);
  } else egress = deal.mode === 'bus' ? 20 : 15;
  return {
    status: 'snapshot', ...deal, dest, o, gcd, routeKm, dur: duration, durEst,
    co2f: fac, co2One: routeKm * fac.f, legs, perDir: deal.price / legs, egress, nights,
  };
}
function door(e, home) {
  const a = accessFor(e.o, home || state.origin);
  const wait = waitMin(e);
  return { a, access: a.min, wait, travel: e.dur, egress: e.egress, total: a.min + wait + e.dur + e.egress };
}
function score(e, dd) { return e.perDir + settings.hourValue * dd.total / 60 + settings.co2Value * e.co2One + 4 * (e.transfers || 0); }

let SNAP = [];
// Deals zonder vaste bestemmings-id (bv. vluchten met alleen een vliegveldcode) krijgen hier hun bestemming
function resolveDest(d) {
  if (d.to && DEST[d.to]) return d;
  const id = destForAirport(d.arr, d.toCity, d.toCountry);
  return id ? { ...d, to: id } : null;
}
function buildSnapshot() { SNAP = SNAPSHOT_DEALS.map(resolveDest).filter(Boolean).map(enrich).filter(Boolean); }

/* Soort reis: welke prijs hoort bij "enkele reis" of "retour"?
   - Retour gekozen: echte retourprijzen tellen zoals ze zijn. Een vanafprijs zonder vaste datum (trein, bus)
     rekenen we als 2 × de enkele reis en dat staat er dan bij als "berekend". Losse vluchten op één datum doen niet mee.
   - Enkele reis gekozen: alleen prijzen die je los voor één richting kunt kopen. */
function tripPrice(e) {
  if (state.trip === 'retour') {
    if (e.trip === 'retour') return { p: e.price, calc: false };
    if (!e.out) return { p: e.price * 2, calc: true };
    return null;
  }
  return e.trip === 'enkel' ? { p: e.price, calc: false } : null;
}
const tripWord = () => (state.trip === 'retour' ? 'retour' : 'enkele reis');
const STAYS = { alle: { label: 'Maakt niet uit', min: 2, max: 7 }, kort: { label: 'Kort: 1 tot 4 nachten', min: 1, max: 4 }, week: { label: 'Week: 5 tot 9 nachten', min: 5, max: 9 }, lang: { label: 'Lang: 10 nachten of meer', min: 10, max: 21 } };
function stayOk(e) {
  if (state.trip !== 'retour' || state.stay === 'alle' || e.nights == null) return true;
  const s = STAYS[state.stay];
  return e.nights >= s.min && (state.stay === 'lang' || e.nights <= s.max);
}
// Periode waarin je wilt vertrekken (maand, schoolvakantie of eigen datums); null = flexibel
function holidayRange(id = state.when.hol, region = state.when.region) {
  const h = HOLIDAYS.find(x => x.id === id);
  if (!h) return null;
  const r = h.all || h[region] || h.midden;
  return { from: r[0], to: r[1], name: h.n };
}
function whenWindow() {
  const w = state.when;
  if (w.mode === 'month' && w.month) {
    const first = w.month + '-01';
    return { from: first, to: addDays(addDays(first, 32).slice(0, 8) + '01', -1) };
  }
  if (w.mode === 'holiday') {
    const r = holidayRange();
    // Vertrek mag op de vrijdag voor de vakantie; je bent uiterlijk op de laatste dag terug
    return r ? { from: addDays(r.from, -1), to: r.to, strictBack: true, name: r.name } : null;
  }
  if (w.mode === 'range' && (w.from || w.to)) return { from: w.from || todayISO(), to: w.to || '2099-12-31', strictBack: !!w.to };
  return null;
}

/* ---------- 6. Filteren en sorteren ---------- */
// Alle deals: gecontroleerd + live. Staat een deal in beide, dan telt de live versie (die is nieuwer).
let _all = null, _allKey = null;
function allDeals() {
  if (_all && _allKey === SNAP && _all.live === state.liveDeals) return _all;
  const liveIds = new Set(state.liveDeals.map(e => e.id));
  _all = SNAP.filter(e => !liveIds.has(e.id)).concat(state.liveDeals);
  _allKey = SNAP; _all.live = state.liveDeals;
  return _all;
}
function isWeekendStart(iso) { const g = new Date(iso + 'T12:00:00').getDay(); return g === 5 || g === 6; }
function filterDeals(opts = {}) {
  const f = state.filters, today = todayISO();
  let hiddenYouth = 0, expired = 0, otherTrip = 0;
  const out = [], win = whenWindow();
  for (const e of allDeals()) {
    if (e.out && e.out < today) { expired++; continue; }
    const tp = opts.anyTrip ? { p: e.perDir, calc: false } : tripPrice(e);
    if (!tp) { otherTrip++; continue; }
    if (!f.modes.has(e.mode)) continue;
    if (!f.status.has(e.status)) continue;
    if (!opts.ignoreDest && state.dest !== 'overal' && e.to !== state.dest) continue;
    if (!noLimit(f.maxPrice, 300) && tp.p > f.maxPrice) continue;
    if (!stayOk(e)) continue;
    if (f.origins.size && !f.origins.has(e.from)) continue;
    if (f.nlOnly && e.o.abroad) continue;
    if (f.noIndic && e.indic) continue;
    if (f.depPart !== 'alle' && e.depTime) {
      const h = +e.depTime.slice(0, 2), part = h < 12 ? 'ochtend' : h < 18 ? 'middag' : 'avond';
      if (part !== f.depPart) continue;
    }
    if (!noLimit(f.maxHours, 24) && e.dur > f.maxHours * 60) continue;
    if (f.direct && e.transfers !== 0) continue;
    if (f.bagIncl && e.bag !== 'koffer') continue;
    if (f.countries.size && !f.countries.has(e.dest.cc)) continue;
    if (f.types.size && !e.dest.t.some(t => f.types.has(t))) continue;
    if (win && e.out && (e.out < win.from || e.out > win.to || (win.strictBack && e.back && e.back > win.to))) continue;
    if (state.when.mode === 'weekend') {
      if (e.out && !isWeekendStart(e.out)) continue;
      if (e.out && e.back && (new Date(e.back) - new Date(e.out)) / 86400000 > 4) continue;
      if (!e.out && e.dur > 7 * 60) continue;
    }
    const dd = door(e, opts.home);
    if (!noLimit(f.maxAccess, 300) && dd.access > f.maxAccess) continue;
    if (e.who === 'jongeren' && !isYouth()) { hiddenYouth++; continue; }
    out.push({ e, dd, s: score(e, dd), tp });
  }
  return { list: sortDeals(out), hiddenYouth, expired, otherTrip };
}
function sortDeals(arr) {
  const by = {
    prijs: (a, b) => a.tp.p - b.tp.p || a.dd.total - b.dd.total,
    datum: (a, b) => (a.e.out || '9999').localeCompare(b.e.out || '9999') || a.tp.p - b.tp.p,
    per100: (a, b) => per100(a.e) - per100(b.e),
    snel: (a, b) => a.dd.total - b.dd.total || a.e.perDir - b.e.perDir,
    groen: (a, b) => a.e.co2One - b.e.co2One || a.e.perDir - b.e.perDir,
    score: (a, b) => a.s - b.s,
  }[state.sort] || ((a, b) => a.tp.p - b.tp.p);
  return arr.sort(by);
}
function activeFilterCount() {
  const f = state.filters;
  return (f.modes.size < 4 ? 1 : 0) + (!noLimit(f.maxPrice, 300) ? 1 : 0) + (!noLimit(f.maxHours, 24) ? 1 : 0) + (!noLimit(f.maxAccess, 300) ? 1 : 0)
    + (f.direct ? 1 : 0) + (f.bagIncl ? 1 : 0) + f.countries.size + f.types.size + (f.status.size < 2 ? 1 : 0)
    + f.origins.size + (f.nlOnly ? 1 : 0) + (f.noIndic ? 1 : 0) + (f.depPart !== 'alle' ? 1 : 0);
}

/* ---------- 7. Links naar aanbieders ---------- */
const enc = encodeURIComponent;
const yymmdd = iso => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
// c = { fromIata, fromName, dest, arr, out, back, link }
const PROVIDERS = {
  google: { name: 'Google Flights', mode: 'vliegtuig', url: c => c.dest
    ? `https://www.google.com/travel/flights?hl=nl&curr=EUR&q=${enc(`Flights from ${c.fromIata || 'AMS'} to ${c.arr || c.dest.en}${c.out ? ' on ' + c.out : ''}${c.back ? ' through ' + c.back : c.out ? ' one way' : ''}`)}`
    : 'https://www.google.com/travel/explore?hl=nl&curr=EUR' },
  sky: { name: 'Skyscanner', mode: 'vliegtuig', url: c => {
    const f = (c.fromIata || 'AMS').toLowerCase();
    const t = (c.arr || c.dest?.iata || '').toLowerCase();
    if (!t) return `https://www.skyscanner.nl/nl/en-gb/eur/flights-from/${f.toUpperCase()}`;
    if (c.out) return `https://www.skyscanner.nl/transport/vluchten/${f}/${t}/${yymmdd(c.out)}/${c.back ? yymmdd(c.back) + '/' : ''}?adultsv2=${state.travellers}&cabinclass=economy&rtn=${c.back ? 1 : 0}`;
    return `https://www.skyscanner.nl/transport/vluchten/${f}/${t}/?adultsv2=${state.travellers}&cabinclass=economy&rtn=0`;
  } },
  ryanair: { name: 'Ryanair', mode: 'vliegtuig', url: c => (c.out && (c.arr || c.dest?.iata))
    ? `https://www.ryanair.com/nl/nl/trip/flights/select?adults=${state.travellers}&teens=0&children=0&infants=0&dateOut=${c.out}&dateIn=${c.back || ''}&isConnectedFlight=false&isReturn=${c.back ? 'true' : 'false'}&discount=0&originIata=${c.fromIata || 'EIN'}&destinationIata=${c.arr || c.dest.iata}`
    : 'https://www.ryanair.com/nl/nl' },
  transavia: { name: 'Transavia', mode: 'vliegtuig', url: () => 'https://www.transavia.com/nl-NL/aanbiedingen/' },
  klm: { name: 'KLM', mode: 'vliegtuig', url: () => 'https://www.klm.nl/' },
  easyjet: { name: 'easyJet', mode: 'vliegtuig', url: () => 'https://www.easyjet.com/nl/' },
  vueling: { name: 'Vueling', mode: 'vliegtuig', url: () => 'https://www.vueling.com/nl' },
  wizz: { name: 'Wizz Air', mode: 'vliegtuig', url: () => 'https://wizzair.com/nl-nl' },
  nsi: { name: 'NS International', mode: 'trein', url: () => 'https://www.nsinternational.com/nl' },
  eurostar: { name: 'Eurostar', mode: 'trein', url: () => 'https://www.eurostar.com/nl-nl' },
  db: { name: 'Deutsche Bahn', mode: 'trein', url: c => c.dest ? `https://www.bahn.de/buchung/fahrplan/suche#sts=true&so=${enc(c.fromName || 'Amsterdam Centraal')}&zo=${enc(c.dest.en)}&kl=2` : 'https://int.bahn.de/nl' },
  sncf: { name: 'SNCF Connect', mode: 'trein', url: () => 'https://www.sncf-connect.com/nl-nl' },
  ouigo: { name: 'OUIGO', mode: 'trein', url: () => 'https://www.ouigo.com/' },
  trainline: { name: 'Trainline', mode: 'trein', url: () => 'https://www.thetrainline.com/' },
  es: { name: 'European Sleeper', mode: 'trein', url: () => 'https://www.europeansleeper.eu/' },
  flixbus: { name: 'FlixBus', mode: 'bus', url: () => 'https://www.flixbus.nl/' },
  kombo: { name: 'Kombo (bus vergelijken)', mode: 'bus', url: () => 'https://www.kombo.co/nl' },
  'kombo-route': { name: 'Kombo', mode: 'bus', url: c => c.srcUrl || 'https://www.kombo.co/nl' },
  kiwi: { name: 'Kiwi.com', mode: 'vliegtuig', url: c => c.link || 'https://www.kiwi.com/nl/' },
  'kombo-par': { name: 'Kombo', mode: 'bus', url: () => SRC.kPar.url },
  'kombo-bru': { name: 'Kombo', mode: 'bus', url: () => SRC.kBru.url },
  'kombo-prg': { name: 'Kombo', mode: 'bus', url: () => SRC.kPrg.url },
  'kombo-zrh': { name: 'Kombo', mode: 'bus', url: () => SRC.kZrh.url },
  'kombo-lil': { name: 'Kombo', mode: 'bus', url: () => SRC.kLil.url },
  ns: { name: 'NS', mode: 'trein', url: c => c.toName
    ? `https://www.ns.nl/reisplanner/#/?vertrek=${enc(c.fromName)}&vertrektype=treinstation&aankomst=${enc(c.toName)}&aankomsttype=treinstation&type=vertrek`
    : 'https://www.ns.nl/' },
  ov9292: { name: '9292 (ov in Nederland)', mode: 'trein', url: () => 'https://9292.nl/' },
  aviasales: { name: 'Aviasales', mode: 'vliegtuig', url: c => c.link ? 'https://www.aviasales.com' + c.link : 'https://www.aviasales.com/' },
};
function linkCtx(e) {
  const s0 = e.src && e.src[0] && SRC[e.src[0]];
  return { fromIata: e.o.iata, fromName: e.o.n, dest: e.dest, arr: e.arr, out: e.out, back: e.back, link: e.link, toName: e.dest.n, srcUrl: s0 ? s0.url : null };
}
function bookLink(e) {
  const p = PROVIDERS[e.book] || PROVIDERS.google;
  return { name: p.name, url: p.url(linkCtx(e)) };
}
function airlineLink(e) {
  const name = Object.keys(AIRLINE_SITES).find(n => e.provider.includes(n));
  return name ? { name, url: AIRLINE_SITES[name] } : null;
}
// Links voor de huidige zoekopdracht (paneel "Zoek live bij aanbieders")
function searchLinks() {
  const dest = state.dest !== 'overal' ? DEST[state.dest] : null;
  const ap = nearestAirports(state.origin, 1)[0];
  const st = nearestStation(state.origin);
  const c = { fromIata: ap.iata, fromName: st.n, dest };
  const keys = ['google', 'sky', 'ryanair', 'transavia', 'klm', 'easyjet', 'vueling', 'wizz', 'nsi', 'eurostar', 'db', 'sncf', 'ouigo', 'trainline', 'es', 'flixbus', 'kombo', 'ns'];
  return keys.map(k => ({ key: k, name: PROVIDERS[k].name, mode: PROVIDERS[k].mode, url: PROVIDERS[k].url(c) }));
}

/* ---------- 8. Live bronnen ---------- */
// Alle live verzoeken lopen via liveFetch. Met een proxy-URL (zie Uitleg) gaan ze via jouw eigen proxy.
async function liveFetch(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeout || 15000);
  const target = settings.proxy && !opts.noProxy ? settings.proxy.replace(/\/+$/, '') + '/?url=' + enc(url) : url;
  try {
    const r = await fetch(target, { headers: opts.headers || {}, signal: ctrl.signal });
    if (!r.ok) { const err = new Error('HTTP ' + r.status); err.status = r.status; throw err; }
    return await r.json();
  } finally { clearTimeout(timer); }
}
function explainError(err) {
  if (!err) return 'Onbekende fout.';
  if (err.name === 'AbortError') return 'De bron reageerde te traag. Probeer het opnieuw.';
  if (err.status === 401 || err.status === 403) return `Sleutel ongeldig of geen toegang (HTTP ${err.status}).`;
  if (err.status === 429) return 'Te veel verzoeken achter elkaar. Wacht even.';
  if (err.status) return `De bron gaf een fout (HTTP ${err.status}).`;
  if (err.message && !/fetch|network|load/i.test(err.message)) return err.message;
  return inFrame
    ? 'Geen verbinding: in deze preview zijn externe verbindingen geblokkeerd. Open het HTML-bestand los in je browser.'
    : 'Geen verbinding. Mogelijk blokkeert de bron verzoeken uit de browser (CORS). Stel dan een proxy in (zie Uitleg).';
}

/* PDOK Locatieserver: adressen zoeken (gratis, geen sleutel) */
async function pdokSearch(q) {
  const fq = enc('type:(adres OR postcode OR woonplaats OR weg)');
  const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${enc(q)}&rows=6&fl=weergavenaam,type,centroide_ll&fq=${fq}`;
  const data = await liveFetch(url, { timeout: 8000, noProxy: true });
  return ((data.response && data.response.docs) || []).map(d => {
    const m = /POINT\(([-\d.]+) ([-\d.]+)\)/.exec(d.centroide_ll || '');
    return m ? { n: d.weergavenaam, lon: +m[1], lat: +m[2], kind: d.type || 'adres' } : null;
  }).filter(Boolean);
}

/* NS API: reistijd en prijs naar het vertrekpunt (sleutel nodig, gratis via apiportal.ns.nl) */
const NS_BASE = 'https://gateway.apiportal.ns.nl';
async function nsGet(path, params) {
  const qs = new URLSearchParams(params).toString();
  const url = `${NS_BASE}${path}${qs ? '?' + qs : ''}`;
  try {
    return await liveFetch(url, { headers: { 'Ocp-Apim-Subscription-Key': settings.nsKey } });
  } catch (err) {
    // Sommige browsers blokkeren een eigen header (CORS). Probeer de sleutel dan als parameter.
    if (!err.status && !settings.proxy && err.name !== 'AbortError') {
      return await liveFetch(url + (qs ? '&' : '?') + 'subscription-key=' + enc(settings.nsKey));
    }
    throw err;
  }
}
let nsStationMap = null;
async function nsStations() {
  if (nsStationMap) return nsStationMap;
  const data = await nsGet('/reisinformatie-api/api/v2/stations', {});
  const list = Array.isArray(data) ? data : (data.payload || []);
  const map = {};
  for (const s of list) { const uic = String(s.UICCode || s.uicCode || ''); if (uic && s.code) map[uic] = s.code; }
  if (!Object.keys(map).length) throw new Error('NS gaf geen stationslijst terug.');
  nsStationMap = map;
  return map;
}
function nsDiscount() { return (state.profile === 'dal' || state.profile === 'jongere12') ? 'DISCOUNT_40_PERCENT' : null; }
function nsWhen() {
  // Morgen om 09:30 (daluren), als RFC 3339 met tijdzone.
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 30, 0, 0);
  const off = -d.getTimezoneOffset(), sign = off >= 0 ? '+' : '-', oh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0'), om = String(Math.abs(off) % 60).padStart(2, '0');
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T09:30:00${sign}${oh}:${om}`;
}
async function nsTrip(fromCode, toCode, when) {
  const params = { fromStation: fromCode, toStation: toCode, dateTime: when };
  const disc = nsDiscount();
  if (disc) params.discount = disc;
  const data = await nsGet('/reisinformatie-api/api/v3/trips', params);
  const trips = data.trips || [];
  const t = trips.find(x => x.optimal) || trips[0];
  if (!t) throw new Error('NS vond geen reis.');
  const cents = (t.productFare && t.productFare.priceInCents) ?? (t.fares && t.fares[0] && t.fares[0].priceInCents) ?? null;
  return { min: t.plannedDurationInMinutes ?? t.actualDurationInMinutes ?? null, eur: cents != null ? cents / 100 : null, transfers: t.transfers ?? null, when };
}

/* Travelpayouts (Aviasales Data API): vluchtprijzen uit de cache van de laatste 48 uur (gratis token) */
const TP_BASE = 'https://api.travelpayouts.com';
const TP_DOCS = 'https://support.travelpayouts.com/hc/en-us/articles/203956163';
async function tpGet(path, params) {
  const qs = new URLSearchParams({ ...params, token: settings.tpToken }).toString();
  return liveFetch(`${TP_BASE}${path}?${qs}`);
}
async function tpPrices(originIata, destIata, month) {
  const p = { origin: originIata, currency: 'eur', sorting: 'price', direct: 'false', limit: destIata ? '30' : '100', page: '1', one_way: 'true', unique: destIata ? 'false' : 'true' };
  if (destIata) p.destination = destIata;
  if (month) p.departure_at = month;
  const data = await tpGet('/aviasales/v3/prices_for_dates', p);
  if (data && data.success === false) throw new Error(data.error || 'Travelpayouts gaf een fout.');
  return (data && data.data) || [];
}
function tpToDeal(r, fromIata) {
  const destId = CODE2DEST[r.destination] || CODE2DEST[r.destination_airport];
  if (!destId || !ORIGINS[fromIata]) return null;
  const out = (r.departure_at || '').slice(0, 10);
  return {
    id: `tp-${fromIata}-${r.destination_airport || r.destination}-${out}-${r.price}`, status: 'live', mode: 'vliegtuig',
    provider: AIRLINES[r.airline] || r.airline || 'Luchtvaartmaatschappij', from: fromIata, to: destId, arr: r.destination_airport || r.destination,
    price: Number(r.price), trip: 'enkel', priceType: 'gevonden', out: out || undefined,
    dur: r.duration_to || r.duration || null, transfers: r.transfers ?? null, bag: 'onbekend',
    note: 'Prijs gevonden door Aviasales-gebruikers in de laatste 48 uur (cache). Controleer de actuele prijs.',
    srcLive: { name: 'Travelpayouts / Aviasales Data API', url: TP_DOCS }, src: [], checked: new Date().toISOString(), book: 'aviasales', link: r.link,
  };
}
async function tpCalendar(o, dIata, month) {
  try {
    const data = await tpGet('/aviasales/v3/grouped_prices', { origin: o, destination: dIata, currency: 'eur', departure_at: month, group_by: 'departure_at' });
    const out = {};
    for (const [day, v] of Object.entries((data && data.data) || {})) out[day.slice(0, 10)] = { price: Number(v.price), transfers: v.transfers, airline: AIRLINES[v.airline] || v.airline };
    if (Object.keys(out).length) return out;
  } catch (err) { if (err.status === 401 || err.status === 403) throw err; }
  const data2 = await tpGet('/v2/prices/month-matrix', { currency: 'eur', origin: o, destination: dIata, month: month + '-01', show_to_affiliates: 'true' });
  const out2 = {};
  for (const r of ((data2 && data2.data) || [])) {
    const d = r.depart_date;
    if (d && (!out2[d] || r.value < out2[d].price)) out2[d] = { price: Number(r.value), transfers: r.number_of_changes };
  }
  return out2;
}

/* DEMO-kalender: duidelijk nep, alleen om de functie te laten zien */
function demoCalendar(o, destId, month) {
  const dest = DEST[destId], ap = NL_AIR[o];
  const rnd = mulberry32(hashStr(`${o}-${destId}-${month}`));
  const base = 22 + km(ap, dest) * 0.035;
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const out = {};
  for (let d = 1; d <= days; d++) {
    const iso = `${month}-${String(d).padStart(2, '0')}`;
    const g = new Date(iso + 'T12:00:00').getDay();
    if (rnd() < 0.12) continue; // sommige dagen geen vlucht
    const wk = (g === 5 || g === 0) ? 1.35 : (g === 2 || g === 3) ? 0.85 : 1;
    out[iso] = { price: Math.round(base * wk * (0.7 + rnd() * 0.8)), demo: true };
  }
  return out;
}
