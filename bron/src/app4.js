/* =====================================================================
   DealRadar NL – deel 4: Reisdata (jouw eigen periodes)
   Je vult in wanneer je weg kunt, bijvoorbeeld: heen tussen 18 en 21 november,
   terug tussen 25 en 28 november. DealRadar zoekt deals die daarin passen:
   - Precies: vertrek en terugkomst vallen allebei in jouw periodes.
   - Bijna: tot 2 dagen eerder of later (of met 1 overstap).
   - Datum vrij: trein en bus met een vanafprijs; die geldt niet op elke dag.
   Nieuwe deals krijgen een teller op het tabblad en een melding.
   In Claude zoekt DealRadar ook live bij Kiwi.com, en de dagelijkse controle
   zoekt elke ochtend per periode en stuurt een pushmelding.
   ===================================================================== */
const WATCH_NL = ['AMS', 'EIN', 'RTM', 'MST', 'GRQ'];
const WATCH_BORDER = ['NRN', 'DUS', 'CGN', 'CRL', 'BRU'];
const NEAR_DAYS = 2;
const WMODES = ['vliegtuig', 'trein', 'bus'];
const dayDiff = (a, b) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 86400000);
const maxISO = (a, b) => (a > b ? a : b);
// Hoeveel dagen ligt een datum buiten een periode? 0 = erin, negatief = eerder, positief = later
const offRange = (d, from, to) => (d < from ? dayDiff(from, d) : d > to ? dayDiff(to, d) : 0);
const isoOk = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

function cleanWatchLocal(w) {
  if (!w || !w.id || !isoOk(w.outFrom) || !isoOk(w.outTo)) return null;
  const oneway = !!w.oneway;
  if (!oneway && (!isoOk(w.backFrom) || !isoOk(w.backTo))) return null;
  return {
    id: String(w.id), name: String(w.name || '').slice(0, 40), oneway,
    outFrom: w.outFrom, outTo: w.outTo, backFrom: oneway ? null : w.backFrom, backTo: oneway ? null : w.backTo,
    people: Math.min(9, Math.max(1, Math.round(+w.people || 1))),
    origins: (Array.isArray(w.origins) ? w.origins : ['nl', 'grens']).filter(o => o === 'nl' || o === 'grens'),
    dest: w.dest && (w.dest === 'europa' || w.dest === 'wereld' || DEST[w.dest]) ? w.dest : 'europa',
    maxPP: +w.maxPP > 0 ? Math.round(+w.maxPP) : null,
    modes: (Array.isArray(w.modes) ? w.modes : WMODES).filter(m => WMODES.includes(m)),
    notify: w.notify !== false, created: w.created || new Date().toISOString(),
    lastSearch: w.lastSearch || null, lastInfo: w.lastInfo || null,
    seen: Array.isArray(w.seen) ? w.seen.slice(-400) : [], toasted: Array.isArray(w.toasted) ? w.toasted.slice(-400) : [],
  };
}
state.watches = (store.get('watches', []) || []).map(cleanWatchLocal).filter(Boolean);
const saveWatches = () => store.set('watches', state.watches);

/* ---------- Live gevonden deals per periode (blijven bewaard in je browser) ---------- */
const WLIVE_RAW = store.get('watchLive', {}) || {}; // watch-id -> { exact: [ruwe deals], wide: [...] }
const WLIVE = new Map();                            // watch-id -> [verrijkte deals]
function rebuildWatchLive() {
  WLIVE.clear();
  const today = todayISO();
  for (const [id, parts] of Object.entries(WLIVE_RAW)) {
    if (!state.watches.some(w => w.id === id)) { delete WLIVE_RAW[id]; continue; }
    const list = [...(parts.exact || []), ...(parts.wide || [])]
      .filter(d => d && d.out && d.out >= today).map(resolveDest).filter(Boolean).map(enrich).filter(Boolean);
    WLIVE.set(id, list);
  }
}
rebuildWatchLive();
function watchDealById(id) { for (const list of WLIVE.values()) { const e = list.find(d => d.id === id); if (e) return e; } return null; }

/* ---------- Wat past bij een periode? ---------- */
function watchPrice(e, w) {
  if (w.oneway) return e.trip === 'enkel' ? { pp: e.price, calc: false } : null;
  if (e.trip === 'retour') return { pp: e.price, calc: false };
  return !e.out ? { pp: e.price * 2, calc: true } : null; // vrije datum: 2 × enkele reis
}
function watchFits(e, w) {
  const o = e.o || ORIGINS[e.from];
  if (!o || !((w.origins.includes('nl') && !o.abroad) || (w.origins.includes('grens') && o.abroad))) return false;
  if (!w.modes.includes(e.mode === 'combi' ? 'trein' : e.mode)) return false;
  if (w.dest === 'europa') return contOf(e.dest) === 'EU';
  if (w.dest === 'wereld') return true;
  return e.to === w.dest;
}
function watchMatches(w) {
  const today = todayISO(), seen = new Map();
  const pool = [...allDeals(), ...[...WLIVE.values()].flat()];
  for (const e of pool) {
    if (e.out && e.out < today) continue;
    if (e.who === 'jongeren' && !isYouth()) continue;
    if (!watchFits(e, w)) continue;
    const pr = watchPrice(e, w); if (!pr) continue;
    if (w.maxPP && pr.pp > w.maxPP) continue;
    let kind, offOut = 0, offBack = 0;
    if (!e.out) kind = 'free';
    else {
      offOut = offRange(e.out, w.outFrom, w.outTo);
      if (!w.oneway) { if (!e.back) continue; offBack = offRange(e.back, w.backFrom, w.backTo); }
      if (!offOut && !offBack) kind = 'exact';
      else if (Math.abs(offOut) <= NEAR_DAYS && Math.abs(offBack) <= NEAR_DAYS) kind = 'near';
      else continue;
    }
    const x = { e, pp: pr.pp, calc: pr.calc, total: pr.pp * w.people, kind, offOut, offBack };
    const old = seen.get(e.id);
    if (!old || (old.e.status !== 'live' && e.status === 'live')) seen.set(e.id, x);
  }
  const res = { exact: [], near: [], free: [] };
  for (const x of seen.values()) res[x.kind].push(x);
  const byPrice = (a, b) => a.pp - b.pp || (a.e.dur || 0) - (b.e.dur || 0);
  res.exact.sort(byPrice); res.near.sort((a, b) => (Math.abs(a.offOut) + Math.abs(a.offBack)) - (Math.abs(b.offOut) + Math.abs(b.offBack)) || byPrice(a, b)); res.free.sort(byPrice);
  return res;
}
const watchExpired = w => w.outTo < todayISO();
const watchHasFlights = w => w.modes.includes('vliegtuig') && !watchExpired(w);

/* ---------- Meldingen: teller, melding in de app, en (op de website) een systeemmelding ---------- */
let watchToastTimer = null;
function checkWatches(opt = {}) {
  if (!state.watches) return;
  let unseen = 0, freshAll = [];
  for (const w of state.watches) {
    if (watchExpired(w)) continue;
    const m = watchMatches(w);
    const ids = m.exact.map(x => x.e.id);
    unseen += ids.filter(id => !w.seen.includes(id)).length;
    if (!w.notify) continue;
    const fresh = m.exact.filter(x => !w.toasted.includes(x.e.id));
    if (fresh.length) { w.toasted = [...new Set([...w.toasted, ...fresh.map(x => x.e.id)])].slice(-400); freshAll.push({ w, fresh }); }
  }
  const el = $('#watchCount');
  if (el) { el.hidden = !unseen; el.textContent = unseen > 99 ? '99+' : unseen; }
  if (!freshAll.length) return;
  saveWatches();
  if (opt.silent) return;
  // Eén melding voor alles samen, kort na het laden (dan staan alle bronnen erin)
  clearTimeout(watchToastTimer);
  watchToastTimer = setTimeout(() => {
    const n = freshAll.reduce((s, f) => s + f.fresh.length, 0);
    const best = freshAll.map(f => ({ w: f.w, x: f.fresh[0] })).sort((a, b) => a.x.pp - b.x.pp)[0];
    const name = watchName(best.w);
    const msg = `${n} nieuwe deal${n === 1 ? '' : 's'} voor ${freshAll.length === 1 ? `"${name}"` : 'je reisdata'}. Goedkoopst: ${best.x.e.o.n} → ${best.x.e.dest.n} ${eur(best.x.total)}${best.w.people > 1 ? ` samen` : ''}.`;
    toast(msg, { action: { label: 'Bekijk', fn: () => goTab('reisdata') }, ms: 9000 });
    systemNotify('DealRadar: nieuwe deals op jouw data', msg);
  }, 900);
}
function systemNotify(title, body) {
  if (inFrame || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(r => r.showNotification(title, { body, icon: 'icon-192.png', tag: 'dealradar-reisdata' })).catch(() => {});
    else new Notification(title, { body });
  } catch (err) { /* geen meldingen mogelijk */ }
}

/* ---------- Live zoeken bij Kiwi.com voor één periode ---------- */
// Stap 1 (precies): jouw periodes, rechtstreeks, met jouw maximumprijs.
// Stap 2 (verder zoeken, alleen als stap 1 weinig vindt): 2 dagen ruimer, 1 overstap mag, geen maximumprijs,
// en bij "hele wereld" ook Afrika en Azië.
async function searchWatch(w, opt = {}) {
  if (!CLOUD.mcp || !CLOUD.kiwi || !watchHasFlights(w)) return { asked: 0, found: 0 };
  const tomorrow = addDays(todayISO(), 1), pad = opt.wide ? NEAR_DAYS : 0;
  const dFrom = maxISO(addDays(w.outFrom, -pad), tomorrow), dTo = addDays(w.outTo, pad);
  if (dTo < dFrom) return { asked: 0, found: 0 };
  const origins = [...(w.origins.includes('nl') ? WATCH_NL : []), ...(w.origins.includes('grens') ? WATCH_BORDER : [])];
  const dest = DEST[w.dest];
  const targets = dest ? [dest.iata || dest.en || dest.n] : ['Europe'];
  const tasks = [];
  for (const o of origins) for (const t of targets) tasks.push({ o, t });
  if (!dest && w.dest === 'wereld') ['Africa', 'Asia', 'North America'].forEach(t => tasks.push({ o: 'AMS', t, far: true }));
  if (!dest && w.dest === 'wereld' && w.origins.includes('grens')) tasks.push({ o: 'CRL', t: 'Africa', far: true });
  const tag = w.id + (opt.wide ? 'x' : ''), found = new Map();
  let asked = 0, lastErr = null, fatal = false;
  const run = async ({ o, t, far }) => {
    if (fatal) return;
    const input = { flyFrom: o, flyTo: t, departureDate: ddmmyyyy(dFrom), departureDateTo: ddmmyyyy(dTo), adults: w.people, currency: 'EUR', locale: 'nl', sort: 'price', one_for_city: !dest, max_sector_stopovers: opt.wide || far ? 1 : 0 };
    if (!w.oneway) {
      const bFrom = maxISO(addDays(w.backFrom, -pad), dFrom), bTo = addDays(w.backTo, pad);
      if (bTo < bFrom) return;
      input.returnDate = ddmmyyyy(bFrom); input.returnDateTo = ddmmyyyy(bTo);
    }
    if (w.maxPP && !opt.wide) input.price_to = Math.ceil(w.maxPP * w.people);
    asked++;
    try {
      const res = await CLOUD.mcp.callTool(KIWI, 'search-flight', input, { cache: { staleTime: 10 * 60000, gcTime: 60 * 60000 } });
      const checked = res.cache && res.cache.storedAt ? new Date(res.cache.storedAt).toISOString() : new Date().toISOString();
      for (const it of ((res.payload && res.payload.itineraries) || [])) {
        const d = kiwiToDeal(it, checked, tag);
        if (!d || (!w.oneway && !d.back) || (w.oneway && d.back)) continue;
        d.id += '-' + d.out.slice(5).replace('-', '') + (d.back ? '-' + d.back.slice(5).replace('-', '') : ''); // één deal per datum
        const total = d.price;
        d.priceTotal = total; d.people = w.people; d.watch = w.id;
        d.price = Math.round(total / w.people * 100) / 100;
        if (w.people > 1) d.note += ` Prijs voor ${w.people} personen samen: ${eur(total)} (${eur(d.price)} per persoon).`;
        const old = found.get(d.id);
        if (!old || d.price < old.price) found.set(d.id, d);
      }
    } catch (err) {
      lastErr = err;
      if (['server_not_connected', 'needs_reauth', 'not_in_manifest', 'not_granted', 'capability_disabled', 'approval_required', 'selection_required'].includes(err && err.code)) fatal = true;
    }
  };
  for (let i = 0; i < tasks.length && !fatal; i += 4) await Promise.all(tasks.slice(i, i + 4).map(run));
  const list = [...found.values()];
  WLIVE_RAW[w.id] = { ...(WLIVE_RAW[w.id] || {}), [opt.wide ? 'wide' : 'exact']: list };
  store.set('watchLive', WLIVE_RAW);
  rebuildWatchLive();
  if (list.length) saveSearch(list, { watch: w.id, wide: !!opt.wide, outFrom: w.outFrom, outTo: w.outTo, backFrom: w.backFrom, backTo: w.backTo, people: w.people });
  return { asked, found: list.length, error: !list.length && lastErr ? mcpErrorText(lastErr, KIWI) : null };
}
const WBUSY = new Set();
async function runWatchSearch(w, opt = {}) {
  if (WBUSY.has(w.id) || !watchHasFlights(w) || !CLOUD.kiwi) return;
  WBUSY.add(w.id); renderWatches();
  try {
    const r1 = await searchWatch(w);
    let r2 = null;
    if (watchMatches(w).exact.length < 3) r2 = await searchWatch(w, { wide: true });
    else if (WLIVE_RAW[w.id]) { delete WLIVE_RAW[w.id].wide; store.set('watchLive', WLIVE_RAW); rebuildWatchLive(); }
    const m = watchMatches(w);
    w.lastSearch = new Date().toISOString();
    w.lastInfo = { exact: m.exact.length, near: m.near.length, wide: !!r2, error: r1.error || (r2 && r2.error) || null };
    saveWatches();
    if (!opt.quiet) toast(m.exact.length ? `${m.exact.length} deal${m.exact.length === 1 ? '' : 's'} precies op "${watchName(w)}". Goedkoopst ${eur(m.exact[0].total)}${w.people > 1 ? ' samen' : ''}.`
      : m.near.length ? `Op precies deze data niets gevonden. Wel ${m.near.length} optie${m.near.length === 1 ? '' : 's'} die bijna passen.` : w.lastInfo.error || 'Geen vluchten gevonden op deze data. Bekijk de tips onder de periode.', { ms: 6000 });
  } finally {
    WBUSY.delete(w.id);
    // Zelf gezocht: je ziet het resultaat al. Automatisch gezocht: dan wel een melding.
    checkWatches({ silent: !opt.quiet }); renderWatches(); renderSavedCount();
  }
}
// Bij het openen in Claude: periodes die langer dan 6 uur niet gezocht zijn, opnieuw zoeken (hooguit 2 tegelijk)
async function autoSearchWatches() {
  if (!CLOUD.kiwi) return;
  for (let i = 0; i < 40 && state.scanning; i++) await new Promise(r => setTimeout(r, 300));
  const due = state.watches.filter(w => watchHasFlights(w) && (!w.lastSearch || Date.now() - Date.parse(w.lastSearch) > 6 * 3600000)).slice(0, 2);
  for (const w of due) await runWatchSearch(w, { quiet: true });
}

/* ---------- In Claude: periodes staan ook in de database, zodat de dagelijkse controle ze ziet ---------- */
const cleanWatchCloud = w => {
  const d = DEST[w.dest];
  return { name: w.name, oneway: w.oneway, outFrom: w.outFrom, outTo: w.outTo, backFrom: w.backFrom, backTo: w.backTo, people: w.people, origins: w.origins,
    dest: w.dest, destName: d ? d.n : w.dest === 'wereld' ? 'Hele wereld' : 'Europa', codes: d ? (d.codes || []) : [], maxPP: w.maxPP, modes: w.modes, notify: w.notify, created: w.created };
};
async function cloudSetWatch(w) { if (CLOUD.db && CLOUD.isOwner) { try { await CLOUD.db.collection('watches').doc(w.id).set(cleanWatchCloud(w)); } catch (err) { toast('Reisdata alleen in deze browser bewaard (database niet bereikbaar).'); } } }
async function cloudDelWatch(id) { if (CLOUD.db && CLOUD.isOwner) { try { await CLOUD.db.collection('watches').doc(id).delete(); } catch (err) { /* lokaal wel weg */ } } }
let watchSyncBusy = false, watchesFromCloud = null;
async function syncWatchesFromCloud() {
  if (!watchesFromCloud || watchSyncBusy) return;
  watchSyncBusy = true;
  try {
    const ids = new Set(watchesFromCloud.map(w => w.id));
    for (const w of state.watches.filter(w => !ids.has(w.id))) {
      try { await CLOUD.db.collection('watches').doc(w.id).set(cleanWatchCloud(w)); ids.add(w.id); } catch (err) { break; }
    }
    const local = new Map(state.watches.map(w => [w.id, w]));
    const merged = [];
    for (const c of watchesFromCloud) {
      const old = local.get(c.id);
      const clean = cleanWatchLocal({ ...(old || {}), ...c, seen: old ? old.seen : [], toasted: old ? old.toasted : [], lastSearch: old ? old.lastSearch : null, lastInfo: old ? old.lastInfo : null });
      if (!clean) continue;
      // Hetzelfde object houden: een zoekopdracht die nog loopt, werkt dan de juiste periode bij
      if (old) { Object.assign(old, clean); merged.push(old); continue; }
      // Nieuw op een ander apparaat: wat er nu al staat telt niet als "nieuw" voor een melding
      clean.toasted = watchMatches(clean).exact.map(x => x.e.id);
      merged.push(clean);
    }
    state.watches = merged.concat(state.watches.filter(w => !merged.includes(w) && !ids.has(w.id)));
    saveWatches(); rebuildWatchLive(); checkWatches(); renderWatches();
  } finally { watchSyncBusy = false; }
}
function watchCloudSubscribe() {
  if (!CLOUD.db || !CLOUD.isOwner) return;
  CLOUD.db.collection('watches').onSnapshot(snap => { watchesFromCloud = snap.docs.map(d => ({ ...d.data(), id: d.id })); syncWatchesFromCloud(); }, () => {});
}

/* ---------- Weergave ---------- */
const rangeNL = (a, b) => {
  if (a === b) return dateNL(a);
  const A = new Date(a + 'T12:00:00'), B = new Date(b + 'T12:00:00');
  return A.getMonth() === B.getMonth() && A.getFullYear() === B.getFullYear() ? `${DOW[A.getDay()]} ${A.getDate()} – ${DOW[B.getDay()]} ${B.getDate()} ${MONTHS[B.getMonth()]}` : `${dateNL(a)} – ${dateNL(b)}`;
};
const watchName = w => w.name || (w.oneway ? `Weg ${rangeNL(w.outFrom, w.outTo)}` : `${rangeNL(w.outFrom, w.outTo)} → ${rangeNL(w.backFrom, w.backTo)}`);
const offText = (n, what) => (n ? `${what} ${Math.abs(n)} dag${Math.abs(n) === 1 ? '' : 'en'} ${n < 0 ? 'eerder' : 'later'}` : '');
const SESSION_NEW = new Map();
let watchShowAll = new Set();
function watchRow(x, w, isNew) {
  const e = x.e, m = MODES[e.mode];
  const when = e.out ? `${dateNL(e.out)}${e.depTime ? ' ' + e.depTime : ''}${e.back ? ` → ${dateNL(e.back)}${e.backTime ? ' ' + e.backTime : ''}` : ''}${e.nights != null ? ` · ${nightsText(e.nights)}` : ''}` : 'datum naar keuze';
  const tr = e.transfers === 0 ? 'rechtstreeks' : e.transfers == null ? 'overstappen onbekend' : `${e.transfers} overstap${e.transfers > 1 ? 'pen' : ''}`;
  const off = [offText(x.offOut, 'heen'), offText(x.offBack, 'terug')].filter(Boolean).join(', ');
  const src = e.status === 'live' ? `live ${timeNL(e.checked).split(', ')[1]}` : e.watch ? 'dagelijkse controle' : e.indic ? 'indicatie' : 'gecontroleerd';
  const tag = e.status === 'live' ? '<span class="badge live">Live</span>' : e.indic ? '<span class="badge indic">Indicatie</span>' : '';
  return `<li class="deal-row w-item" data-mode="${e.mode}" data-id="${esc(e.id)}">
    <button type="button" class="row-main" data-wopen="${esc(e.id)}" aria-label="${esc(e.o.n)} naar ${esc(e.dest.n)}, ${esc(eur(x.total))}${w.people > 1 ? ` voor ${w.people} personen` : ''}. Open details.">
      <span class="row-ic">${icon(m.icon)}</span>
      <span class="row-txt"><b>${esc(e.dest.n)}</b> <span class="flag" aria-hidden="true">${flag(e.dest.cc)}</span> ${isNew ? '<span class="badge top">Nieuw</span>' : ''}${tag}
        <span class="row-sub">${esc(e.o.n)} · ${esc(when)}</span>
        <span class="row-sub">${esc(e.provider)} · ${tr} · ${esc(src)}</span>
        ${off ? `<span class="row-sub w-off">${icon('i-info', 'sm')} ${esc(off)} dan je periode${e.transfers ? '' : ''}</span>` : ''}
        ${x.calc ? '<span class="row-sub w-off">Retour berekend: 2 × de vanafprijs. Geldt niet op elke dag.</span>' : ''}</span>
      <span class="row-price">${e.priceType === 'vanaf' ? '<small>vanaf</small>' : ''}<b>${eur(x.total)}</b><small>${w.people > 1 ? `samen · ${eur(x.pp)} p.p.` : w.oneway ? 'enkele reis' : 'retour p.p.'}</small></span>
    </button>
  </li>`;
}
function watchSearchLinks(w) {
  const pp = `adults=${w.people}`;
  const kiwi = `https://www.kiwi.com/nl/search/results/netherlands/${DEST[w.dest] ? slugify(DEST[w.dest].en || DEST[w.dest].n) : 'anywhere'}/${w.outFrom}_${w.outTo}/${w.oneway ? 'no-return' : `${w.backFrom}_${w.backTo}`}?${pp}`;
  const g = PROVIDERS.google.url({ dest: DEST[w.dest] || null, fromIata: 'AMS', arr: DEST[w.dest] ? DEST[w.dest].iata : null, out: w.outFrom, back: w.oneway ? null : w.backFrom });
  return `<div class="w-links"><span class="small muted">Zelf verder zoeken met jouw data:</span>
    <a class="btn ghost sm" href="${esc(kiwi)}" target="_blank" rel="noopener">Kiwi.com ${icon('i-ext', 'sm')}</a>
    <a class="btn ghost sm" href="${esc(g)}" target="_blank" rel="noopener">Google Flights ${icon('i-ext', 'sm')}</a>
    <a class="btn ghost sm" href="https://www.nsinternational.com/nl" target="_blank" rel="noopener">NS International ${icon('i-ext', 'sm')}</a>
    <a class="btn ghost sm" href="https://www.flixbus.nl/" target="_blank" rel="noopener">FlixBus ${icon('i-ext', 'sm')}</a></div>`;
}
function watchSection(key, title, sub, list, w, open, isNewFn) {
  if (!list.length) return '';
  const all = watchShowAll.has(w.id + key), shown = all ? list : list.slice(0, 6);
  return `<details class="w-sec" data-sec="${key}" ${open ? 'open' : ''}><summary><b>${title}</b> <span class="w-n">${list.length}</span> <span class="small muted">${sub}</span></summary>
    <ul class="deal-grid rows">${shown.map(x => watchRow(x, w, isNewFn(x.e.id))).join('')}</ul>
    ${list.length > shown.length ? `<button class="btn ghost sm" type="button" data-wall="${esc(w.id + key)}">Toon alle ${list.length}</button>` : ''}</details>`;
}
function watchCard(w) {
  const exp = watchExpired(w), m = exp ? { exact: [], near: [], free: [] } : watchMatches(w);
  const sess = SESSION_NEW.get(w.id) || new Set();
  if (state.tab === 'reisdata' && !exp) {
    m.exact.forEach(x => { if (!w.seen.includes(x.e.id)) { sess.add(x.e.id); w.seen.push(x.e.id); } });
    SESSION_NEW.set(w.id, sess);
  }
  const busy = WBUSY.has(w.id);
  const best = m.exact[0];
  const destTxt = w.dest === 'europa' ? 'Europa' : w.dest === 'wereld' ? 'hele wereld' : DEST[w.dest].n;
  const fromTxt = w.origins.length === 2 ? 'Nederland en net over de grens' : w.origins[0] === 'nl' ? 'Nederland' : 'net over de grens';
  const modesTxt = w.modes.length === 3 ? '' : ' · ' + w.modes.map(k => MODES[k].label.toLowerCase()).join(' en ');
  const status = busy ? `<span class="w-busy">${icon('i-radar', 'sm')} Live zoeken bij Kiwi.com…</span>`
    : w.lastSearch ? `Live gezocht ${esc(timeNL(w.lastSearch))}${w.lastInfo && w.lastInfo.wide ? ' · ook 2 dagen ruimer en met 1 overstap' : ''}${w.lastInfo && w.lastInfo.error ? ` · ${esc(w.lastInfo.error)}` : ''}`
      : CLOUD.kiwi ? 'Nog niet live gezocht.' : 'Op deze website: deals die al in DealRadar staan. Live zoeken kan in Claude.';
  let empty = '';
  if (!exp && !m.exact.length) {
    empty = `<div class="notice ${m.near.length || m.free.length ? 'info' : ''}">${icon('i-info')}<div>${busy ? 'Even geduld: DealRadar zoekt op jouw data.'
      : CLOUD.kiwi && w.lastSearch ? `Op precies deze data vond Kiwi.com ${w.modes.includes('vliegtuig') ? 'geen passende vlucht' : 'niets'}. ${m.near.length ? 'Hieronder staan opties die wel beschikbaar zijn: tot 2 dagen eerder of later, of met 1 overstap.' : 'Ook 2 dagen ruimer en met 1 overstap vond ik niets.'}${m.free.length ? ' Trein en bus kunnen wel: die hebben een vrije datum.' : ''}`
      : CLOUD.kiwi ? 'Nog geen deals op precies deze data. Tik op <b>Zoek nu</b> om live te zoeken.'
      : `Er staat nog geen deal in DealRadar die precies op deze data valt.${m.near.length ? ' Hieronder staan opties die bijna passen.' : ''} De dagelijkse controle en live zoeken in Claude vinden vaak meer.`}</div></div>${!busy ? watchSearchLinks(w) : ''}`;
  }
  const isNew = id => sess.has(id);
  return `<article class="watch ${exp ? 'expired' : ''}" data-w="${esc(w.id)}" aria-labelledby="wt-${esc(w.id)}">
    <div class="w-head">
      <div class="w-titles"><h3 id="wt-${esc(w.id)}">${esc(watchName(w))}</h3>
        <div class="w-when"><span>${icon('i-enkel', 'sm')} Heen <b>${esc(rangeNL(w.outFrom, w.outTo))}</b></span>${w.oneway ? '<span class="muted">enkele reis</span>' : `<span>${icon('i-retour', 'sm')} Terug <b>${esc(rangeNL(w.backFrom, w.backTo))}</b></span>`}</div>
        <div class="small muted">${w.people} persoon${w.people === 1 ? '' : 'en'} · vanaf ${fromTxt} · ${esc(destTxt)}${w.maxPP ? ` · max ${eur(w.maxPP)} p.p.` : ''}${modesTxt}</div></div>
      ${sess.size ? `<span class="badge top w-new">${sess.size} nieuw</span>` : ''}
    </div>
    ${exp ? '<p class="small muted">Deze periode is voorbij.</p>' : `<div class="w-stats">
      <span class="w-stat ${m.exact.length ? 'on' : ''}"><b>${m.exact.length}</b> precies</span>
      <span class="w-stat"><b>${m.near.length}</b> bijna</span>
      <span class="w-stat"><b>${m.free.length}</b> datum vrij</span>
      ${best ? `<span class="w-best">Goedkoopst <b>${eur(best.total)}</b>${w.people > 1 ? ' samen' : ''}: ${esc(best.e.o.n)} → ${esc(best.e.dest.n)}</span>` : ''}</div>
    <div class="w-status small muted">${status}</div>`}
    <div class="card-actions">
      ${!exp && CLOUD.kiwi && watchHasFlights(w) ? `<button class="btn sm" type="button" data-wsearch="${esc(w.id)}" ${busy ? 'disabled' : ''}>${icon('i-radar', 'sm')}Zoek nu</button>` : ''}
      ${!exp ? `<button class="btn ghost sm" type="button" data-wedit="${esc(w.id)}">Bewerk</button>` : ''}
      ${!exp ? `<button class="icon-btn toggle" type="button" data-wnotify="${esc(w.id)}" aria-pressed="${w.notify}" aria-label="${w.notify ? 'Melding staat aan' : 'Melding staat uit'} voor ${esc(watchName(w))}" title="${w.notify ? 'Melding aan' : 'Melding uit'}">${icon('i-bell')}</button>` : ''}
      <button class="icon-btn" type="button" data-wdel="${esc(w.id)}" aria-label="Verwijder ${esc(watchName(w))}">${icon('i-close')}</button>
    </div>
    ${exp ? '' : empty + watchSection('exact', 'Precies op jouw data', w.oneway ? 'vertrek in je periode' : 'heen én terug in je periodes', m.exact, w, true, isNew)
      + watchSection('near', 'Bijna: tot 2 dagen anders', 'of met 1 overstap', m.near, w, !m.exact.length, () => false)
      + watchSection('free', 'Trein en bus met vrije datum', w.oneway ? 'vanafprijs' : 'retour = 2 × vanafprijs', m.free, w, !m.exact.length && !m.near.length, () => false)}
  </article>`;
}
function renderWatches() {
  const box = $('#watchList'); if (!box) return;
  const list = [...state.watches].sort((a, b) => (watchExpired(a) - watchExpired(b)) || a.outFrom.localeCompare(b.outFrom));
  box.innerHTML = list.length ? list.map(watchCard).join('') : `<div class="empty">
      <svg class="big" aria-hidden="true"><use href="#i-cal"/></svg><h3>Nog geen reisdata</h3>
      <p class="small">Vul in wanneer je weg kunt, bijvoorbeeld heen tussen 18 en 21 november en terug tussen 25 en 28 november. DealRadar zoekt dan deals die precies passen.</p>
      <div class="btns"><button class="btn" type="button" data-wfocus>Vul je eerste reisdata in</button></div></div>`;
  if (state.tab === 'reisdata') saveWatches();
  const canAsk = !inFrame && 'Notification' in window && Notification.permission === 'default';
  $('#watchNotice').innerHTML = `<div class="notice info">${icon('i-bell')}<div>${CLOUD.db && CLOUD.isOwner
    ? 'Nieuwe deals op jouw data zie je hier met het label <b>Nieuw</b> en een teller op het tabblad. De dagelijkse controle zoekt elke ochtend om 06:32 per periode en stuurt je een pushmelding als er iets nieuws is.'
    : `Nieuwe deals op jouw data zie je hier met het label <b>Nieuw</b> en een teller op het tabblad, zodra je DealRadar opent.${canAsk ? ' Zet ook meldingen op dit apparaat aan.' : ''} Een pushmelding terwijl de app dicht is, komt van de dagelijkse controle in Claude.`}
    ${canAsk ? '<div style="margin-top:8px"><button class="btn ghost sm" type="button" id="btnWNotify">Meldingen aanzetten</button></div>' : ''}</div></div>`;
  checkWatches({ silent: true });
}
// Na een andere tab zijn "nieuw"-labels niet meer nieuw
window.addEventListener('hashchange', () => { if (location.hash.slice(1) !== 'reisdata') SESSION_NEW.clear(); });

/* ---------- Formulier ---------- */
let wfEdit = null, wfTrip = 'retour', wfPeople = 1;
function nextDow(dow, from = todayISO()) { let d = addDays(from, 1); while (new Date(d + 'T12:00:00').getDay() !== dow) d = addDays(d, 1); return d; }
function wfSet(v) {
  wfTrip = v.oneway ? 'enkel' : 'retour';
  $$('#wfTrip [data-wtrip]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.wtrip === wfTrip)));
  $('#wfBackSet').hidden = wfTrip === 'enkel';
  $('#wfOutFrom').value = v.outFrom || ''; $('#wfOutTo').value = v.outTo || '';
  $('#wfBackFrom').value = v.backFrom || ''; $('#wfBackTo').value = v.backTo || '';
  wfHint();
}
function wfDefaults() {
  const fri = nextDow(5);
  $('#wfName').value = ''; $('#wfDest').value = 'europa'; $('#wfMax').value = '';
  $('#wfNL').checked = true; $('#wfBorder').checked = true; $('#wfNotify').checked = true;
  $$('#wfModes input').forEach(c => { c.checked = true; });
  wfPeople = Math.max(1, state.travellers || 1); $('#wfPeople').textContent = wfPeople;
  wfSet({ outFrom: fri, outTo: addDays(fri, 1), backFrom: addDays(fri, 3), backTo: addDays(fri, 4) });
}
function wfRead() {
  return { name: $('#wfName').value.trim(), oneway: wfTrip === 'enkel', outFrom: $('#wfOutFrom').value, outTo: $('#wfOutTo').value,
    backFrom: $('#wfBackFrom').value, backTo: $('#wfBackTo').value, people: wfPeople, dest: $('#wfDest').value,
    maxPP: +$('#wfMax').value || null, origins: [$('#wfNL').checked && 'nl', $('#wfBorder').checked && 'grens'].filter(Boolean),
    modes: $$('#wfModes input').filter(c => c.checked).map(c => c.value), notify: $('#wfNotify').checked };
}
function wfCheck(v) {
  const t = todayISO();
  if (!isoOk(v.outFrom) || !isoOk(v.outTo)) return 'Vul bij Heen twee datums in.';
  if (v.outTo < v.outFrom) return 'Bij Heen moet de tweede datum na de eerste liggen.';
  if (v.outTo < t) return 'Deze heenperiode is al voorbij.';
  if (!v.oneway) {
    if (!isoOk(v.backFrom) || !isoOk(v.backTo)) return 'Vul bij Terug twee datums in.';
    if (v.backTo < v.backFrom) return 'Bij Terug moet de tweede datum na de eerste liggen.';
    if (v.backTo < v.outFrom) return 'Je komt terug voordat je vertrekt. Controleer de datums.';
  }
  if (dayDiff(v.outFrom, v.outTo) > 45 || (!v.oneway && dayDiff(v.backFrom, v.backTo) > 45)) return 'Kies een periode van hooguit 45 dagen.';
  if (!v.origins.length) return 'Kies minstens één plek om te vertrekken.';
  if (!v.modes.length) return 'Kies minstens één soort vervoer.';
  return '';
}
function wfHint() {
  const v = wfRead(), err = wfCheck(v), h = $('#wfHint');
  if (err) { h.textContent = ''; return; }
  const nMin = v.oneway ? null : Math.max(0, dayDiff(v.outTo, v.backFrom)), nMax = v.oneway ? null : dayDiff(v.outFrom, v.backTo);
  h.textContent = v.oneway ? `Vertrek op een van ${dayDiff(v.outFrom, v.outTo) + 1} dagen.` : `Je bent ${nMin === nMax ? nMax : `${nMin} tot ${nMax}`} nachten weg.`;
}
function wfQuick() {
  const t = todayISO(), q = [];
  const fri = nextDow(5);
  q.push({ id: 'wknd', n: 'Volgend weekend', v: { outFrom: fri, outTo: addDays(fri, 1), backFrom: addDays(fri, 2), backTo: addDays(fri, 3) } });
  for (const h of HOLIDAYS) {
    const r = holidayRange(h.id, state.when.region || 'midden');
    if (!r || r.to < t) continue;
    q.push({ id: h.id, n: h.n, v: { outFrom: maxISO(addDays(r.from, -1), addDays(t, 1)), outTo: maxISO(addDays(r.from, 2), addDays(t, 1)), backFrom: addDays(r.to, -3), backTo: r.to } });
    if (q.length >= 4) break;
  }
  $('#wfQuick').innerHTML = q.map(x => `<button type="button" class="chip" data-wq="${x.id}">${esc(x.n)}</button>`).join('');
  $('#wfQuick').onclick = ev => { const b = ev.target.closest('[data-wq]'); if (!b) return; const x = q.find(y => y.id === b.dataset.wq); wfSet({ ...x.v, oneway: wfTrip === 'enkel' }); if (!$('#wfName').value) $('#wfName').value = x.id === 'wknd' ? '' : x.n; };
}
function wfStart(w) {
  wfEdit = w ? w.id : null;
  $('#wfTitle').textContent = w ? 'Reisdata bewerken' : 'Nieuwe reisdata';
  $('#wfSaveTxt').textContent = w ? 'Wijzigingen opslaan' : 'Bewaar en zoek deals';
  $('#wfCancel').hidden = !w; $('#wfErr').textContent = '';
  if (!w) { wfDefaults(); return; }
  $('#wfName').value = w.name; $('#wfDest').value = w.dest; $('#wfMax').value = w.maxPP || '';
  $('#wfNL').checked = w.origins.includes('nl'); $('#wfBorder').checked = w.origins.includes('grens'); $('#wfNotify').checked = w.notify;
  $$('#wfModes input').forEach(c => { c.checked = w.modes.includes(c.value); });
  wfPeople = w.people; $('#wfPeople').textContent = wfPeople;
  wfSet(w);
}
function initWatchForm() {
  const dsel = $('#wfDest');
  dsel.innerHTML = '<option value="europa">Overal in Europa</option><option value="wereld">Hele wereld</option><optgroup label="Of kies een bestemming">'
    + Object.values(DEST).filter(d => !d.dyn).sort((a, b) => a.n.localeCompare(b.n, 'nl')).map(d => `<option value="${d.id}">${esc(d.n)}</option>`).join('') + '</optgroup>';
  const t = todayISO();
  ['#wfOutFrom', '#wfOutTo', '#wfBackFrom', '#wfBackTo'].forEach(s => { $(s).min = t; $(s).addEventListener('change', () => {
    // Slim meeschuiven: een latere begindatum schuift de einddatum mee
    if (s === '#wfOutFrom' && $('#wfOutTo').value < $('#wfOutFrom').value) $('#wfOutTo').value = $('#wfOutFrom').value;
    if (s === '#wfBackFrom' && $('#wfBackTo').value < $('#wfBackFrom').value) $('#wfBackTo').value = $('#wfBackFrom').value;
    if (s === '#wfOutFrom' && $('#wfBackFrom').value && $('#wfBackFrom').value < $('#wfOutFrom').value) { $('#wfBackFrom').value = $('#wfOutFrom').value; if ($('#wfBackTo').value < $('#wfBackFrom').value) $('#wfBackTo').value = $('#wfBackFrom').value; }
    $('#wfErr').textContent = ''; wfHint();
  }); });
  $$('#wfTrip [data-wtrip]').forEach(b => b.addEventListener('click', () => {
    wfTrip = b.dataset.wtrip; $$('#wfTrip [data-wtrip]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $('#wfBackSet').hidden = wfTrip === 'enkel'; wfHint();
  }));
  $('#wfMinus').addEventListener('click', () => { wfPeople = Math.max(1, wfPeople - 1); $('#wfPeople').textContent = wfPeople; });
  $('#wfPlus').addEventListener('click', () => { wfPeople = Math.min(9, wfPeople + 1); $('#wfPeople').textContent = wfPeople; });
  $('#wfCancel').addEventListener('click', () => wfStart(null));
  $('#watchForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const v = wfRead(), err = wfCheck(v);
    $('#wfErr').textContent = err;
    if (err) return;
    const old = wfEdit && state.watches.find(w => w.id === wfEdit);
    const w = cleanWatchLocal({ ...(old || {}), ...v, id: old ? old.id : 'w' + Date.now().toString(36), created: old ? old.created : undefined, lastSearch: null, lastInfo: null, seen: old ? old.seen : [], toasted: [] });
    // Wat er nu al staat, zie je meteen; daar komt geen aparte melding voor
    w.toasted = watchMatches(w).exact.map(x => x.e.id);
    if (old) { state.watches = state.watches.map(x => (x.id === old.id ? w : x)); delete WLIVE_RAW[w.id]; store.set('watchLive', WLIVE_RAW); rebuildWatchLive(); }
    else state.watches.push(w);
    saveWatches(); cloudSetWatch(w);
    wfStart(null); renderWatches(); renderSavedCount();
    const card = $(`.watch[data-w="${w.id}"]`); if (card) card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    announce(`${old ? 'Reisdata aangepast' : 'Reisdata bewaard'}: ${watchName(w)}.`);
    if (CLOUD.kiwi && watchHasFlights(w)) runWatchSearch(w);
    else { const m = watchMatches(w); toast(m.exact.length ? `${m.exact.length} deal${m.exact.length === 1 ? '' : 's'} passen precies.` : 'Bewaard. Je ziet het zodra er een deal op deze data komt.', { ms: 5000 }); }
  });
  $('#view-reisdata').addEventListener('click', async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    const w = id => state.watches.find(x => x.id === id);
    if (b.dataset.wopen) { const e = dealById(b.dataset.wopen); if (e) openDealDialog(e); }
    if (b.dataset.wsearch && w(b.dataset.wsearch)) runWatchSearch(w(b.dataset.wsearch));
    if (b.dataset.wedit && w(b.dataset.wedit)) { wfStart(w(b.dataset.wedit)); $('#watchForm').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); $('#wfName').focus({ preventScroll: true }); }
    if (b.dataset.wnotify && w(b.dataset.wnotify)) { const x = w(b.dataset.wnotify); x.notify = !x.notify; saveWatches(); cloudSetWatch(x); renderWatches(); toast(x.notify ? 'Melding staat aan.' : 'Melding staat uit.', { ms: 2000 }); }
    if (b.dataset.wall) { watchShowAll.add(b.dataset.wall); renderWatches(); }
    if (b.hasAttribute('data-wfocus')) { $('#watchForm').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); $('#wfOutFrom').focus({ preventScroll: true }); }
    if (b.id === 'btnWNotify') { try { const p = await Notification.requestPermission(); toast(p === 'granted' ? 'Meldingen staan aan op dit apparaat.' : 'Meldingen zijn niet toegestaan.'); } catch (err) { /* niets */ } renderWatches(); }
    if (b.dataset.wdel && w(b.dataset.wdel)) {
      const x = w(b.dataset.wdel), raw = WLIVE_RAW[x.id];
      state.watches = state.watches.filter(y => y.id !== x.id); delete WLIVE_RAW[x.id];
      saveWatches(); store.set('watchLive', WLIVE_RAW); rebuildWatchLive(); cloudDelWatch(x.id); renderWatches(); checkWatches({ silent: true });
      toast(`"${watchName(x)}" verwijderd.`, { action: { label: 'Ongedaan maken', fn: () => { state.watches.push(x); if (raw) WLIVE_RAW[x.id] = raw; saveWatches(); store.set('watchLive', WLIVE_RAW); rebuildWatchLive(); cloudSetWatch(x); renderWatches(); } }, ms: 7000 });
    }
  });
  // Ook vanaf het tabblad Deals: "Bewaar deze datums" als je eigen datums kiest
  wfQuick(); wfStart(null);
}
initWatchForm();
