/* =====================================================================
   DealRadar NL — deel 3: cloud en extra's
   1. Vliegvelden en nieuwe bestemmingen   2. Deals uit de database
   3. Prijsgeschiedenis en topdeals         4. Live vluchten (Kiwi.com)
   5. Prijs vergelijken (lastminute.com)    6. Cloud: database + connectors
   7. App-versie (PWA)
   Alles in dit deel werkt alleen als de pagina het kan gebruiken:
   - in Claude: database (geschiedenis, alerts) en jouw connectors;
   - als losse website: service worker voor offline gebruik.
   Zonder die dingen werkt de rest van de app gewoon.
   ===================================================================== */

/* ---------- 1. Vliegvelden en nieuwe bestemmingen ---------- */
const AP = BASE.ap || {};
const CC_NL = { NL: 'Nederland', BE: 'België', DE: 'Duitsland', FR: 'Frankrijk', ES: 'Spanje', PT: 'Portugal', IT: 'Italië', GB: 'Verenigd Koninkrijk', IE: 'Ierland', AT: 'Oostenrijk', CH: 'Zwitserland', PL: 'Polen', CZ: 'Tsjechië', SK: 'Slowakije', HU: 'Hongarije', HR: 'Kroatië', SI: 'Slovenië', RS: 'Servië', BA: 'Bosnië en Herzegovina', ME: 'Montenegro', AL: 'Albanië', MK: 'Noord-Macedonië', GR: 'Griekenland', BG: 'Bulgarije', RO: 'Roemenië', MD: 'Moldavië', LT: 'Litouwen', LV: 'Letland', EE: 'Estland', FI: 'Finland', SE: 'Zweden', NO: 'Noorwegen', DK: 'Denemarken', IS: 'IJsland', LU: 'Luxemburg', MT: 'Malta', CY: 'Cyprus', TR: 'Turkije', MA: 'Marokko', TN: 'Tunesië', EG: 'Egypte', IL: 'Israël', JO: 'Jordanië', GE: 'Georgië', AM: 'Armenië' };
const slugify = s => norm(s).replace(/ /g, '-');
// Hoort een vliegveld bij een bekende bestemming? Zo niet: maak een nieuwe (alleen met echte coördinaten uit OurAirports).
function destForAirport(iata, city, country) {
  if (!iata) return null;
  if (CODE2DEST[iata]) return CODE2DEST[iata];
  const a = AP[iata];
  if (!a) return null;
  const name = city || a[3];
  const same = Object.values(DEST).find(d => norm(d.n) === norm(name) || norm(d.en) === norm(name));
  if (same) { CODE2DEST[iata] = same.id; same.codes = [...(same.codes || []), iata]; return same.id; }
  const id = 'x-' + slugify(name);
  if (!DEST[id]) DEST[id] = { id, n: name, c: country || CC_NL[a[2]] || a[2], cc: a[2], t: [], lat: a[0], lon: a[1], iata, en: name, codes: [iata], dyn: true };
  if (!COUNTRIES[a[2]]) COUNTRIES[a[2]] = DEST[id].c;
  CODE2DEST[iata] = id;
  return id;
}
// Bron van een deal (één plek, zodat live en gecontroleerde deals hetzelfde werken)
const srcOf = e => e.srcLive || SRC[(e.src || [])[0]] || SRC.kiwi;
const srcsOf = e => e.srcLive ? [e.srcLive] : (e.src || []).map(k => SRC[k]).filter(Boolean);

/* ---------- 2. Deals uit de database (dagelijkse controle en eigen zoekopdrachten) ---------- */
const SNAP_BY_ID = new Map(SNAPSHOT_DEALS.map(d => [d.id, d]));
const CLOUD = { db: null, mcp: null, user: null, isOwner: false, runs: [], searches: [], alertsDb: null, kiwi: false, lastminute: false, status: 'off', lastRun: null };
// Een deal uit de database of uit een live zoekopdracht controleren en aanvullen.
// Alleen deals met een bekend vertrekpunt, een echte prijs en een bestemming met coördinaten komen erdoor.
function normalizeDeal(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  // Vluchten van Kiwi.com staan er compleet in (ook als korte rij); trein en bus vullen de ingebouwde deal aan met een nieuwe prijs
  const isKiwi = /^kiwi-/.test(raw.id);
  const base = isKiwi ? null : SNAP_BY_ID.get(raw.id);
  let d = base ? { ...base, ...raw } : { ...raw };
  if (isKiwi) d = kiwiDeal({ via: 'de dagelijkse controle', ...d });
  d.price = Number(d.price);
  if (!(d.price > 0) || d.price > 5000 || !MODES[d.mode] || !ORIGINS[d.from]) return null;
  if (!DEST[d.to]) { const id = destForAirport(d.arr, d.toCity, d.toCountry); if (!id) return null; d.to = id; }
  d.src = (Array.isArray(d.src) ? d.src : []).filter(k => SRC[k]);
  if (!d.src.length) d.src = [d.mode === 'vliegtuig' ? 'kiwi' : 'nsiHome'];
  d.trip = d.trip === 'retour' ? 'retour' : 'enkel';
  d.priceType = d.priceType === 'vanaf' ? 'vanaf' : 'gevonden';
  d.bag = ['koffer', 'hand', 'tasje', 'onbekend'].includes(d.bag) ? d.bag : 'onbekend';
  for (const k of ['out', 'back']) if (d[k] != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(d[k]))) delete d[k];
  if (d.trip === 'retour' && d.mode === 'vliegtuig' && !d.back) return null; // een retourvlucht zonder terugdatum klopt niet
  if (!d.checked || Number.isNaN(Date.parse(d.checked))) return null;
  if (typeof d.link === 'string' && !/^https:\/\//.test(d.link)) delete d.link;
  if (!d.book || !PROVIDERS[d.book]) d.book = d.mode === 'vliegtuig' ? (d.link ? 'kiwi' : 'google') : d.mode === 'bus' ? 'kombo-route' : 'nsi';
  return d;
}
// Gecontroleerde deals = ingebouwde deals, aangevuld en ververst met de twee nieuwste dagelijkse controles
function mergeCloudDeals() {
  const byId = new Map(SNAPSHOT_DEALS.map(d => [d.id, d]));
  for (const run of CLOUD.runs.slice(0, 2).reverse()) {
    for (const raw of (run.deals || [])) {
      const d = normalizeDeal({ checked: run.t, ...raw });
      if (!d) continue;
      const old = byId.get(d.id);
      if (!old || Date.parse(d.checked) >= Date.parse(old.checked)) byId.set(d.id, d);
    }
  }
  SNAP = [...byId.values()].map(resolveDest).filter(Boolean).map(enrich).filter(Boolean);
}

/* ---------- 3. Prijsgeschiedenis en topdeals ---------- */
const HIST = new Map(); // deal-id -> [{ t, p, via }]
function rebuildHistory() {
  HIST.clear();
  const add = (id, t, p, via) => {
    p = Number(p);
    if (!id || !(p > 0) || !t || Number.isNaN(Date.parse(t))) return;
    const a = HIST.get(id) || [];
    const day = t.slice(0, 16);
    if (!a.some(x => x.t.slice(0, 16) === day)) a.push({ t, p, via });
    HIST.set(id, a);
  };
  for (const d of SNAPSHOT_DEALS) add(d.id, d.checked, d.price, 'ingebouwd');
  for (const r of CLOUD.runs) for (const d of (r.deals || [])) add(d.id, d.checked || r.t, d.price, 'dagelijkse controle');
  for (const s of CLOUD.searches) for (const d of (s.deals || [])) add(d.id, d.checked || s.t, d.price, 'eigen zoekopdracht');
  for (const e of state.liveDeals) add(e.id, e.checked, e.price, 'live');
  for (const a of HIST.values()) a.sort((x, y) => Date.parse(x.t) - Date.parse(y.t));
}
function histStats(id) {
  const a = HIST.get(id);
  if (!a || !a.length) return null;
  const ps = a.map(x => x.p), last = a[a.length - 1];
  const min = Math.min(...ps), max = Math.max(...ps);
  const prev = a.length > 1 ? a[a.length - 2].p : null;
  return { a, n: a.length, min, max, avg: ps.reduce((s, v) => s + v, 0) / ps.length, first: a[0].t, last, prev,
    change: prev == null ? 0 : last.p - prev, isLow: a.length > 1 && last.p <= min && max > min };
}
function sparkline(id, w = 70, h = 22) {
  const s = histStats(id);
  if (!s || s.n < 2) return '';
  const span = s.max - s.min || 1, n = s.a.length;
  const pts = s.a.map((x, i) => `${(2 + i / (n - 1) * (w - 4)).toFixed(1)},${(h - 3 - (x.p - s.min) / span * (h - 6)).toFixed(1)}`);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts.join(' ')}"/><circle cx="${pts[n - 1].split(',')[0]}" cy="${pts[n - 1].split(',')[1]}" r="2.4"/></svg>`;
}
// Korte regel op de kaart: prijsverloop
function histLine(e) {
  const s = histStats(e.id);
  if (!s || s.n < 2) return '';
  const ch = s.change;
  const txt = ch < -0.004 ? `<b class="down">▼ ${eur(-ch)} goedkoper</b> dan de vorige controle`
    : ch > 0.004 ? `<b class="up">▲ ${eur(ch)} duurder</b> dan de vorige controle` : 'Zelfde prijs als de vorige controle';
  return `<div class="hist-line">${sparkline(e.id)}<span>${txt} · ${s.n} controles sinds ${esc(dateNL(s.first, { dow: false }))}${s.isLow ? ' · <b class="down">laagste tot nu toe</b>' : ''}</span></div>`;
}
// Groot prijsverloop in het detailvenster
function histChart(e) {
  const s = histStats(e.id);
  if (!s) return '';
  if (s.n < 2) return `<div class="hist-box"><b>Prijsgeschiedenis</b><p class="small muted">Nog maar één controle (${esc(timeNL(s.first))}). Elke dagelijkse controle en elke live zoekopdracht voegt een punt toe.</p></div>`;
  const W = 520, H = 150, P = { l: 44, r: 12, t: 12, b: 24 };
  const t0 = Date.parse(s.a[0].t), t1 = Date.parse(s.last.t), tspan = Math.max(1, t1 - t0);
  const lo = Math.floor(s.min * 0.9), hi = Math.ceil(s.max * 1.08), pspan = Math.max(1, hi - lo);
  const X = t => P.l + (Date.parse(t) - t0) / tspan * (W - P.l - P.r), Y = p => P.t + (1 - (p - lo) / pspan) * (H - P.t - P.b);
  const pts = s.a.map(x => `${X(x.t).toFixed(1)},${Y(x.p).toFixed(1)}`).join(' ');
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  return `<div class="hist-box"><b>Prijsgeschiedenis</b>
    <svg class="hist-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Prijsverloop: ${s.n} controles, laagste ${eur(s.min)}, hoogste ${eur(s.max)}, nu ${eur(s.last.p)}">
      ${ticks.map(v => `<line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${P.l - 6}" y="${Y(v) + 4}" text-anchor="end">${esc(eur(v))}</text>`).join('')}
      <polyline class="line" points="${pts}"/>
      ${s.a.map(x => `<circle class="pt" cx="${X(x.t).toFixed(1)}" cy="${Y(x.p).toFixed(1)}" r="3.2"><title>${esc(timeNL(x.t))}: ${esc(eur(x.p))} (${esc(x.via)})</title></circle>`).join('')}
      <text x="${P.l}" y="${H - 6}">${esc(dateNL(s.first, { dow: false }))}</text><text x="${W - P.r}" y="${H - 6}" text-anchor="end">${esc(dateNL(s.last.t, { dow: false }))}</text>
    </svg>
    <p class="small">Laagste ${eur(s.min)} · gemiddeld ${eur(s.avg)} · hoogste ${eur(s.max)} · ${s.n} controles${s.isLow ? ' · <b class="down">nu de laagste prijs tot nu toe</b>' : ''}</p></div>`;
}
// Prijs per 100 km: een eerlijke maat om korte en lange reizen te vergelijken
const per100 = e => e.perDir / Math.max(1, e.routeKm / 100);
// Topdeals: laagste prijs per 100 km (reizen vanaf 300 km), één per bestemming
function topDeals(list, n = 6) {
  const seen = new Set(), out = [];
  for (const x of list.filter(x => x.e.routeKm >= 300 && !x.e.indic).sort((a, b) => per100(a.e) - per100(b.e))) {
    if (seen.has(x.e.to)) continue;
    seen.add(x.e.to); out.push(x);
    if (out.length >= n) break;
  }
  return out;
}
let TOP_IDS = new Set();
function renderTopDeals(list) {
  const box = $('#topDeals');
  if (!box) return;
  const top = state.dest === 'overal' ? topDeals(list) : [];
  TOP_IDS = new Set(top.map(x => x.e.id));
  if (top.length < 3) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = `<div class="top-head"><h3>${icon('i-radar')}Topdeals</h3><span class="small muted">Laagste prijs per 100 km, één per bestemming (zonder indicaties)</span></div>
    <ol class="top-list">${top.map(({ e, tp }) => `<li><button type="button" class="top-card" data-open="${esc(e.id)}" style="--mc:var(--m-${e.mode})">
      <span class="top-mode">${icon(MODES[e.mode].icon, 'sm')}${esc(MODES[e.mode].label)}</span>
      <b class="top-dest">${esc(e.dest.n)}</b>
      <span class="top-price">${e.priceType === 'vanaf' ? '<small>vanaf</small> ' : ''}${eur(tp.p)} <small>${tripWord()}</small></span>
      <span class="small muted">${eur(per100(e))} per 100 km · ${esc(e.o.n)}${e.out ? ' · ' + esc(dateNL(e.out, { dow: false })) : ''}</span>
    </button></li>`).join('')}</ol>`;
}

/* ---------- 4. Live vluchten via de Kiwi.com-connector ---------- */
const KIWI = 'Kiwi.com', LASTMIN = 'lastminute.com';
const ddmmyyyy = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
// Vanaf welke vliegvelden zoeken we? De 2 dichtstbijzijnde in NL, plus Weeze en Charleroi als die dichtbij genoeg zijn.
function kiwiOrigins() {
  const near = nearestAirports(state.origin, 5).slice(0, 2).map(a => a.iata);
  if (km(state.origin, ORIGINS.NRN) <= 150) near.push('NRN');
  if (km(state.origin, ORIGINS.CRL) <= 190) near.push('CRL');
  return [...new Set(near)].slice(0, 4);
}
// In welke periode zoeken we? Morgen t/m 75 dagen, of de maand, vakantie of datums die je koos.
function kiwiWindow() {
  const tomorrow = addDays(todayISO(), 1), w = whenWindow();
  if (w) {
    const from = w.from > tomorrow ? w.from : tomorrow;
    const to = w.to > addDays(from, 120) ? addDays(from, 60) : w.to;
    return to >= from ? { from, to, strictBack: w.strictBack, tag: state.when.mode === 'month' ? 'm' + state.when.month.replace('-', '') : state.when.mode === 'holiday' ? state.when.hol : 'dat' } : null;
  }
  if (state.when.mode === 'weekend') return { from: tomorrow, to: addDays(tomorrow, 42), weekend: true, tag: 'wknd' };
  return { from: tomorrow, to: addDays(tomorrow, 75) };
}
const kiwiFlights = leg => (leg && Array.isArray(leg.segments) ? leg.segments.map(s => s.flightNumber).filter(Boolean) : []);
// Een zoekresultaat van Kiwi.com omzetten naar een deal. Het vertrekvliegveld komt uit het resultaat zelf
// (Kiwi zoekt soms in een hele regio: "Brussel" geeft Charleroi én Zaventem).
function kiwiToDeal(it, checked, tag) {
  const ob = it && it.outbound;
  if (!ob || !Array.isArray(ob.route) || !(Number(it.price) > 0)) return null;
  const segs = Array.isArray(ob.segments) ? ob.segments : [];
  const from = ob.from || ob.route[0];
  if (!ORIGINS[from] || ORIGINS[from].kind !== 'airport') return null;
  const arr = ob.to || ob.route[ob.route.length - 1];
  const last = segs[segs.length - 1] || {};
  const to = destForAirport(arr, last.toCity, last.toCountry);
  if (!to) return null;
  const ib = it.tripType === 'return' && it.inbound && it.inbound.departureTime ? it.inbound : null;
  const ibSegs = ib && Array.isArray(ib.segments) ? ib.segments : [];
  const stops = Math.max(ob.stops ?? Math.max(0, ob.route.length - 2), ib ? (ib.stops ?? 0) : 0);
  const carriers = [...new Set([...segs, ...ibSegs].map(s => s.carrierName).filter(Boolean))];
  const bg = it.baggage || {};
  const bag = bg.checkedBag > 0 ? 'koffer' : bg.cabinBag > 0 ? 'hand' : 'tasje';
  const mins = leg => (leg && leg.durationSeconds ? Math.round(leg.durationSeconds / 60) : null);
  return kiwiDeal({
    status: 'live', liveKind: 'realtime', from, to, arr, toCity: last.toCity, toCountry: last.toCountry,
    provider: carriers.join(' + ') || 'Luchtvaartmaatschappij', price: Math.round(Number(it.price) * 100) / 100,
    out: String(ob.departureTime || '').slice(0, 10) || undefined, depTime: String(ob.departureTime || '').slice(11, 16) || undefined,
    dur: mins(ob), transfers: stops, bag, flight: kiwiFlights(ob).join(', '), tag: tag || undefined,
    stopNote: stops ? `Route heen: ${ob.route.join(' → ')}${ib && Array.isArray(ib.route) ? `; terug: ${ib.route.join(' → ')}` : ''}.` : undefined,
    ...(ib ? { back: String(ib.departureTime).slice(0, 10), backTime: String(ib.departureTime).slice(11, 16), backDur: mins(ib), backFlight: kiwiFlights(ib).join(', '), backFrom: ib.from, backTo: ib.to } : {}),
    link: typeof it.bookingUrl === 'string' && /^https:\/\//.test(it.bookingUrl) ? it.bookingUrl : undefined, checked,
  });
}
// De zoekvraag voor Kiwi.com, passend bij je keuzes (soort reis, verblijf, bagage, periode)
function kiwiInput(o, flyTo, win, broad, far) {
  // Ver weg: iets langer vooruit zoeken (110 dagen) en hooguit 1 overstap per richting
  const to = far && !win.tag ? addDays(win.from, 110) : win.to;
  const input = { flyFrom: o, flyTo, departureDate: ddmmyyyy(win.from), departureDateTo: ddmmyyyy(to), currency: 'EUR', locale: 'nl', sort: 'price', one_for_city: broad, adults: 1 };
  if (state.filters.direct) input.max_sector_stopovers = 0; else if (far) input.max_sector_stopovers = 1;
  if (state.bag === 'hand') input.adults_hand_bags = [1];
  if (state.bag === 'koffer') input.adults_hold_bags = [1];
  if (win.weekend) input.fly_days = '5,6';
  if (state.trip === 'retour') {
    const st = STAYS[state.stay];
    const longStay = far && state.stay === 'alle' && !win.weekend; // ver weg blijf je meestal langer
    const nMin = win.weekend ? 2 : longStay ? 5 : st.min, nMax = win.weekend ? 3 : longStay ? 16 : st.max;
    input.nights_in_dst_from = nMin; input.nights_in_dst_to = nMax;
    if (win.strictBack) {
      const lastDep = addDays(win.to, -nMin);
      if (lastDep < win.from) return null;
      input.departureDateTo = ddmmyyyy(lastDep);
    }
  }
  return input;
}
function mcpErrorText(err, server) {
  const code = err && err.code;
  if (code === 'server_not_connected') return `${server} is niet gekoppeld. Voeg hem toe in claude.ai → Instellingen → Connectors.`;
  if (code === 'needs_reauth') return `Verbind ${server} opnieuw in claude.ai → Instellingen → Connectors.`;
  if (code === 'not_in_manifest' || code === 'approval_required' || code === 'consent_required') return `Deze pagina mag ${server} nog niet gebruiken. Geef toestemming als Claude erom vraagt.`;
  if (code === 'server_unavailable' || code === 'upstream_error' || code === 'rate_limited') return `${server} reageert nu niet. Probeer het zo nog eens.`;
  if (code === 'tool_error') return `${server} gaf een fout: ${String(err.message || '').slice(0, 140)}`;
  if (code === 'selection_required') return `Kies in Claude welke ${server}-koppeling deze pagina mag gebruiken.`;
  return `${server} werkt nu niet${code ? ` (${code})` : ''}.`;
}
// Welke zoekopdrachten horen bij jouw keuze? Europa vanaf de dichtstbijzijnde vliegvelden;
// andere werelddelen vanaf Schiphol en je dichtstbijzijnde vliegveld (Afrika ook vanaf de andere, want daar vliegen prijsvechters heen).
const KIWI_REGION = { AF: 'Africa', AS: 'Asia', NA: 'North America', SA: 'South America', OC: 'Oceania' };
function kiwiTasks(dest, origins) {
  const withAms = [...new Set(['AMS', ...origins])];
  if (dest) {
    const far = contOf(dest) !== 'EU';
    return (far ? withAms.slice(0, 3) : origins).map(o => ({ o, flyTo: dest.iata || dest.en || dest.n, far }));
  }
  const r = state.reach, tasks = [];
  if (r === 'wereld' || r === 'europa') origins.forEach(o => tasks.push({ o, flyTo: 'Europe', far: false }));
  const conts = r === 'wereld' || r === 'ver' ? ['AF', 'AS', 'NA', 'SA'] : KIWI_REGION[r] ? [r] : [];
  for (const c of conts) (c === 'AF' ? withAms.slice(0, 4) : [...new Set(['AMS', origins[0]])]).forEach(o => tasks.push({ o, flyTo: KIWI_REGION[c], far: true }));
  return tasks;
}
async function scanKiwi() {
  if (!CLOUD.mcp || !CLOUD.kiwi) return;
  state.src.kiwi = { status: 'busy', text: 'zoeken…' }; renderRadar();
  const dest = state.dest !== 'overal' ? DEST[state.dest] : null;
  const flyTo = dest ? (dest.iata || dest.en || dest.n) : 'Europe';
  const win = kiwiWindow(), origins = kiwiOrigins();
  const tag = [state.trip === 'retour' && state.stay !== 'alle' && !(win && win.weekend) ? state.stay : '', win && win.tag ? win.tag : ''].filter(Boolean).join('-');
  const found = [];
  let lastErr = null, asked = 0;
  const tasks = win ? kiwiTasks(dest, origins) : [];
  let fatal = false;
  const run = async t => {
    const input = kiwiInput(t.o, t.flyTo, win, !dest, t.far);
    if (!input || fatal) return;
    asked++;
    try {
      const res = await CLOUD.mcp.callTool(KIWI, 'search-flight', input, { cache: { staleTime: 10 * 60000, gcTime: 60 * 60000 } });
      const checked = res.cache && res.cache.storedAt ? new Date(res.cache.storedAt).toISOString() : new Date().toISOString();
      const list = (res.payload && Array.isArray(res.payload.itineraries)) ? res.payload.itineraries : [];
      list.forEach(it => { const d = kiwiToDeal(it, checked, tag); if (d) found.push(d); });
    } catch (err) {
      lastErr = err;
      if (['server_not_connected', 'needs_reauth', 'not_in_manifest', 'not_granted', 'capability_disabled', 'approval_required', 'selection_required'].includes(err && err.code)) fatal = true;
    }
  };
  // Vier zoekopdrachten tegelijk, zodat ook "hele wereld" snel klaar is
  for (let i = 0; i < tasks.length && !fatal; i += 4) await Promise.all(tasks.slice(i, i + 4).map(run));
  const best = new Map();
  found.forEach(d => { const o = best.get(d.id); if (!o || d.price < o.price) best.set(d.id, d); });
  // Eerdere live resultaten van het andere soort reis blijven staan; dezelfde route wordt ververst
  const keep = (state.liveKiwi || []).filter(e => !best.has(e.id));
  state.liveKiwi = keep.concat([...best.values()].map(enrich).filter(Boolean));
  syncLive();
  const what = state.trip === 'retour' ? 'retourvluchten' : 'enkele vluchten';
  if (best.size) {
    state.src.kiwi = { status: 'ok', text: `${best.size} live ${what}` };
    saveSearch([...best.values()], { flyTo: dest ? flyTo : state.reach, from: win.from, to: win.to, origins, trip: state.trip, stay: state.stay, bag: state.bag });
  } else state.src.kiwi = lastErr ? { status: 'error', text: mcpErrorText(lastErr, KIWI) } : { status: 'ok', text: asked ? `geen ${what} gevonden` : 'deze periode is te kort of al voorbij' };
  rebuildHistory();
  renderRadar();
}
/* Eén deal nu live nacontroleren: zelfde route en datum(s), liefst dezelfde vlucht */
async function verifyDeal(e, box) {
  box.innerHTML = '<span class="small">Live controleren bij Kiwi.com…</span>';
  try {
    const input = { flyFrom: e.o.iata, flyTo: e.arr, departureDate: ddmmyyyy(e.out), currency: 'EUR', locale: 'nl', sort: 'price', adults: 1 };
    if (e.trip === 'retour' && e.back) input.returnDate = ddmmyyyy(e.back);
    if (e.transfers === 0) input.max_sector_stopovers = 0;
    if (e.bag === 'hand') input.adults_hand_bags = [1];
    if (e.bag === 'koffer') input.adults_hold_bags = [1];
    const res = await CLOUD.mcp.callTool(KIWI, 'search-flight', input);
    const now = new Date().toISOString();
    const its = ((res.payload && res.payload.itineraries) || []).filter(it => it && it.outbound && (it.outbound.from || '') === e.o.iata && Number(it.price) > 0 && (e.trip !== 'retour' || it.tripType === 'return'));
    if (!its.length) { box.innerHTML = `<div class="cmp-out"><b>Niet meer gevonden.</b> Kiwi.com vindt op ${esc(dateNL(e.out, { year: true }))} geen ${e.transfers === 0 ? 'rechtstreekse ' : ''}vlucht van ${esc(e.o.n)} naar ${esc(e.arr)}${e.back ? ' met deze terugdatum' : ''}. Mogelijk is hij uitverkocht of is het schema veranderd.<br><span class="small muted">Live gecontroleerd ${esc(timeNL(now))}.</span></div>`; return; }
    const f1 = (e.flight || '').split(', ')[0], b1 = (e.backFlight || '').split(', ')[0];
    const same = f1 ? its.find(it => kiwiFlights(it.outbound).includes(f1) && (!b1 || kiwiFlights(it.inbound).includes(b1))) : null;
    const best = same || its.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b));
    const p = Math.round(Number(best.price) * 100) / 100, diff = p - e.price;
    const link = typeof best.bookingUrl === 'string' && /^https:\/\//.test(best.bookingUrl) ? best.bookingUrl : 'https://www.kiwi.com/nl/';
    const fl = kiwiFlights(best.outbound).join(', ') + (best.inbound ? ' / ' + kiwiFlights(best.inbound).join(', ') : '');
    const verdict = Math.abs(diff) < 0.5 ? `<b class="down">De prijs klopt nog: ${eur(p)}.</b>` : diff < 0 ? `<b class="down">Nu ${eur(p)}: ${eur(-diff)} goedkoper</b> dan de ${eur(e.price)} hierboven.` : `<b class="up">Nu ${eur(p)}: ${eur(diff)} duurder</b> dan de ${eur(e.price)} hierboven.`;
    box.innerHTML = `<div class="cmp-out">${verdict} ${same || !f1 ? '' : 'Let op: dit is een andere vlucht op dezelfde datum; de vlucht van deze deal staat er niet meer bij.'}<br>Kiwi.com, vlucht ${esc(fl)}${e.source ? '' : ''}. <a href="${esc(link)}" target="_blank" rel="noopener">Bekijk bij Kiwi.com</a><br><span class="small muted">Live gecontroleerd ${esc(timeNL(now))}. Controleer bagage en voorwaarden bij het boeken.</span></div>`;
    // Een Kiwi-deal met dezelfde vlucht verversen we meteen in de lijst en in de prijsgeschiedenis
    if (same && /^kiwi-/.test(e.id)) {
      const d = kiwiToDeal(best, now);
      if (d) { d.id = e.id; const en = enrich(d); if (en) { state.liveKiwi = (state.liveKiwi || []).filter(x => x.id !== e.id).concat([en]); syncLive(); rebuildHistory(); renderAll(); saveSearch([d], { verify: e.id }); } }
    }
  } catch (err) { box.innerHTML = `<span class="small">${esc(mcpErrorText(err, KIWI))}</span>`; }
}
/* Prijskalender live: de goedkoopste gevonden vlucht per dag voor één route en één maand */
const KCAL = new Map();
async function kiwiCalendar(from, destId, month) {
  const dest = DEST[destId], tomorrow = addDays(todayISO(), 1);
  const first = month + '-01', last = addDays(addDays(first, 32).slice(0, 8) + '01', -1);
  const start = first > tomorrow ? first : tomorrow;
  if (last < start) return {};
  const res = await CLOUD.mcp.callTool(KIWI, 'search-flight', { flyFrom: from, flyTo: dest.iata || dest.en, departureDate: ddmmyyyy(start), departureDateTo: ddmmyyyy(last), currency: 'EUR', locale: 'nl', sort: 'price', adults: 1 }, { cache: { staleTime: 10 * 60000, gcTime: 60 * 60000 } });
  const checked = res.cache && res.cache.storedAt ? new Date(res.cache.storedAt).toISOString() : new Date().toISOString();
  const out = {};
  for (const it of ((res.payload && res.payload.itineraries) || [])) {
    const d = kiwiToDeal(it, checked);
    if (!d || d.from !== from || d.to !== destId || !d.out || !d.out.startsWith(month)) continue;
    if (!out[d.out] || d.price < out[d.out].price) out[d.out] = { price: d.price, airline: d.provider, transfers: d.transfers, link: d.link, checked };
  }
  KCAL.set(`${from}|${destId}|${month}`, out);
  return out;
}
function syncLive() { state.liveDeals = [...(state.liveTP || []), ...(state.liveKiwi || [])]; }
// Eigen zoekopdracht bewaren in de database (alleen de eigenaar), zodat de prijsgeschiedenis groeit
async function saveSearch(deals, q) {
  if (!CLOUD.db || !CLOUD.isOwner) return;
  const clean = deals.slice(0, 60).map(d => { const c = { ...d }; delete c.status; delete c.liveKind; return JSON.parse(JSON.stringify(c)); });
  try { await CLOUD.db.collection('searches').add({ t: new Date().toISOString(), q, deals: clean }); }
  catch (err) { console.warn('Zoekopdracht niet bewaard', err && err.code); }
}

/* ---------- 5. Prijs vergelijken bij lastminute.com (zelfde route en datum) ---------- */
async function compareLastminute(e, box) {
  box.innerHTML = '<span class="small">Zoeken bij lastminute.com…</span>';
  try {
    const input = { departure: e.o.iata, arrival: e.arr, start_date: e.out, max_results: 10, language: 'nl' };
    const res = await CLOUD.mcp.callTool(LASTMIN, 'search_flights', input, { cache: { staleTime: 10 * 60000, gcTime: 60 * 60000 } });
    const fl = ((res.payload && res.payload.flights) || []).filter(f => String(f.departure || '').startsWith(e.o.iata) && Number(f.price_amount) > 0);
    if (!fl.length) { box.innerHTML = '<span class="small">lastminute.com vond geen vlucht vanaf dit vliegveld op deze datum.</span>'; return; }
    const best = fl.reduce((a, b) => (Number(a.price_amount) <= Number(b.price_amount) ? a : b));
    const p = Number(best.price_amount) / 100, diff = p - e.price;
    const verdict = Math.abs(diff) < 0.5 ? 'ongeveer even duur' : diff < 0 ? `<b class="down">${eur(-diff)} goedkoper</b>` : `${eur(diff)} duurder`;
    const link = typeof best.deeplink === 'string' && /^https:\/\//.test(best.deeplink) ? best.deeplink : 'https://nl.lastminute.com/';
    box.innerHTML = `<div class="cmp-out"><b>lastminute.com: ${eur(p)}</b> (${esc(best.airline || '')}, ${esc(best.departure || '')} → ${esc(best.arrival || '')}) · ${verdict} dan deze deal. <a href="${esc(link)}" target="_blank" rel="noopener">Bekijk bij lastminute.com</a><br><span class="small muted">Live opgehaald ${esc(timeNL(new Date().toISOString()))}. Controleer bagage en voorwaarden bij het boeken.</span></div>`;
  } catch (err) { box.innerHTML = `<span class="small">${esc(mcpErrorText(err, LASTMIN))}</span>`; }
}

/* ---------- 6. Cloud: database (dagelijkse controle, geschiedenis, alerts) en connectors ---------- */
function cloudChanged() {
  mergeCloudDeals();
  rebuildHistory();
  const last = CLOUD.runs[0];
  CLOUD.lastRun = last || null;
  state.src.cloud = last
    ? { status: 'ok', text: `dagelijks, laatst ${timeNL(last.t)}` }
    : { status: 'ok', text: 'gekoppeld, wacht op eerste controle' };
  renderRadar(); renderAll();
  if (state.tab === 'bewaard') renderSaved();
}
async function initCloud() {
  if (!window.claude || typeof window.claude.use !== 'function') return;
  // Wie kijkt er? Alleen de eigenaar schrijft alerts en zoekopdrachten.
  try {
    CLOUD.user = await window.claude.use('user');
    if (CLOUD.user && typeof CLOUD.user.isOwner === 'function') CLOUD.isOwner = !!(await CLOUD.user.isOwner());
  } catch (err) { CLOUD.isOwner = false; }
  // Connectors (Kiwi.com, lastminute.com)
  try {
    CLOUD.mcp = await window.claude.use('mcp');
    if (CLOUD.mcp) {
      const lt = await CLOUD.mcp.listTools().catch(() => ({ servers: [] }));
      const names = (lt.servers || []).map(s => s.server);
      CLOUD.kiwi = names.includes(KIWI);
      CLOUD.lastminute = names.includes(LASTMIN);
      state.src.kiwi = CLOUD.kiwi ? { status: 'ok', text: 'klaar om te zoeken' } : { status: 'off', text: 'niet gekoppeld' };
      renderRadar();
      if (CLOUD.kiwi) { for (let i = 0; i < 40 && state.scanning; i++) await new Promise(r => setTimeout(r, 250)); scan({ initial: true, onlyKiwi: true }); }
    }
  } catch (err) { CLOUD.mcp = null; }
  // Database
  try {
    const db = await window.claude.use('db');
    if (!db) return;
    CLOUD.db = db;
    state.src.cloud = { status: 'busy', text: 'laden…' }; renderRadar();
    const timer = setTimeout(() => { if (state.src.cloud.status === 'busy') { state.src.cloud = { status: 'error', text: 'nog niet bereikbaar' }; renderRadar(); } }, 10000);
    const fail = err => { clearTimeout(timer); state.src.cloud = { status: 'error', text: err && err.code === 'revoked' ? 'geen toegang meer' : 'niet bereikbaar' }; renderRadar(); };
    db.collection('runs').orderBy('t', 'desc').limit(45).onSnapshot(snap => {
      clearTimeout(timer);
      CLOUD.runs = snap.docs.map(d => d.data()).filter(r => r && r.t);
      cloudChanged();
    }, fail);
    db.collection('searches').orderBy('t', 'desc').limit(40).onSnapshot(snap => {
      CLOUD.searches = snap.docs.map(d => d.data()).filter(r => r && r.t);
      rebuildHistory(); renderAll();
    }, () => {});
    if (CLOUD.isOwner) {
      db.collection('alerts').onSnapshot(snap => {
        CLOUD.alertsDb = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        syncAlertsFromCloud();
      }, () => {});
    }
  } catch (err) { state.src.cloud = { status: 'error', text: 'niet beschikbaar' }; renderRadar(); }
}
// Alerts: in Claude staan ze in de database (zodat de dagelijkse controle ze ziet), anders in je browser.
let alertSyncBusy = false;
async function syncAlertsFromCloud() {
  if (!CLOUD.alertsDb || alertSyncBusy) return;
  alertSyncBusy = true;
  try {
    const cloudIds = new Set(CLOUD.alertsDb.map(a => a.id));
    // Lokale alerts die nog niet in de database staan: één keer overzetten
    for (const a of state.alerts.filter(a => !cloudIds.has(a.id) && !a.deleted)) {
      try { await CLOUD.db.collection('alerts').doc(a.id).set(cleanAlert(a)); cloudIds.add(a.id); } catch (err) { break; }
    }
    const local = new Map(state.alerts.map(a => [a.id, a]));
    state.alerts = CLOUD.alertsDb.map(a => ({ ...a, notified: (local.get(a.id) || {}).notified || [] }));
    store.set('alerts', state.alerts);
    renderSavedCount();
    if (state.tab === 'bewaard') renderSaved();
  } finally { alertSyncBusy = false; }
}
// In de database staan ook de vliegveldcodes en de naam van de bestemming, zodat de dagelijkse controle vluchten kan koppelen
const cleanAlert = a => {
  const d = a.dest !== 'overal' ? DEST[a.dest] : null;
  return { dest: a.dest, destName: d ? d.n : 'Overal', codes: d ? (d.codes || []) : [], mode: a.mode, max: a.max, created: a.created };
};
async function cloudAddAlert(a) { if (CLOUD.db && CLOUD.isOwner) { try { await CLOUD.db.collection('alerts').doc(a.id).set(cleanAlert(a)); } catch (err) { toast('Alert alleen in deze browser bewaard (database niet bereikbaar).'); } } }
async function cloudRemoveAlert(id) { if (CLOUD.db && CLOUD.isOwner) { try { await CLOUD.db.collection('alerts').doc(id).delete(); } catch (err) { /* blijft lokaal weg */ } } }
// Treffers van de dagelijkse controle (staan in de nieuwste run)
function cloudHits() {
  const r = CLOUD.runs[0];
  return r && Array.isArray(r.alertHits) ? r.alertHits.map(h => ({ ...h, t: r.t })) : [];
}

/* ---------- 7. App-versie (PWA): alleen als losse website, niet in Claude ---------- */
let installEvt = null;
const IS_PWA = !!document.querySelector('meta[name="dealradar-pwa"]');
// De website-versie haalt elke keer de nieuwste dagelijkse controle op (data/latest.json in de repository)
async function loadRepoRun() {
  try {
    const r = await fetch('data/latest.json', { cache: 'no-cache' });
    if (!r.ok) return;
    const run = await r.json();
    if (run && run.t && Array.isArray(run.deals) && run.deals.length) { CLOUD.runs = [run]; cloudChanged(); }
  } catch (err) { /* offline of geen bestand: ingebouwde deals blijven staan */ }
}
function initPWA() {
  if (!IS_PWA || inFrame || !('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  loadRepoRun();
  navigator.serviceWorker.register('sw.js').catch(() => { /* geen offline-modus */ });
  window.addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); installEvt = ev; const b = $('#btnInstall'); if (b) b.hidden = false; });
  const b = $('#btnInstall');
  if (b) b.addEventListener('click', async () => {
    if (installEvt) { installEvt.prompt(); try { await installEvt.userChoice; } catch (err) { /* niets */ } installEvt = null; b.hidden = true; }
  });
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone;
  if (ios && b) { b.hidden = false; b.addEventListener('click', () => { if (!installEvt) toast('Op iPhone: tik op Deel en kies "Zet op beginscherm".', { ms: 7000 }); }); }
  const off = () => document.body.classList.toggle('offline', !navigator.onLine);
  window.addEventListener('online', off); window.addEventListener('offline', off); off();
}

init();
$('#topDeals').addEventListener('click', ev => { const b = ev.target.closest('[data-open]'); if (b) { const e = dealById(b.dataset.open); if (e) openDealDialog(e); } });
initCloud();
initPWA();
