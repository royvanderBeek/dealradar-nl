/* =====================================================================
   DealRadar NL — deel 2: schermen
   9. Basis (thema, meldingen, tabs)   10. Zoeken      11. Bronnen
   12. Deals                           13. Kaart       14. Kalender
   15. Vergelijken                     16. Bewaard     17. Delen en exporteren
   18. Instellingen en uitleg          19. Scannen en starten
   ===================================================================== */
const icon = (id, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function dealById(id) { return allDeals().find(d => d.id === id) || (typeof watchDealById === 'function' ? watchDealById(id) : undefined); }
function routeText(e) { return `${e.o.n} → ${e.dest.n}`; }
// Vlaggetje bij een land (twee letters → emoji); op systemen zonder vlaggen zie je de landcode
const flag = cc => (/^[A-Z]{2}$/.test(cc || '') ? String.fromCodePoint(...[...cc].map(c => 0x1F1A5 + c.charCodeAt(0))) : '');
const nightsText = n => (n == null ? '' : n === 0 ? 'zelfde dag terug' : `${n} nacht${n === 1 ? '' : 'en'}`);
// Reisdocumenten: algemene regel per land (voor Nederlanders); details staan bij de bron
const EU_SCHENGEN = new Set(['NL', 'BE', 'DE', 'FR', 'ES', 'PT', 'IT', 'IE', 'AT', 'CH', 'PL', 'CZ', 'SK', 'HU', 'HR', 'SI', 'GR', 'BG', 'RO', 'LT', 'LV', 'EE', 'FI', 'SE', 'NO', 'DK', 'IS', 'LU', 'MT', 'CY', 'LI']);
function docInfo(cc) {
  if (EU_SCHENGEN.has(cc)) return 'Een geldige ID-kaart of een geldig paspoort is genoeg (EU/Schengen).';
  if (cc === 'GB') return 'Paspoort verplicht; een ID-kaart is niet genoeg. Je hebt ook een ETA nodig: een digitale reistoestemming die je vooraf online aanvraagt.';
  return 'Buiten de EU en Schengen heb je meestal een paspoort nodig, en soms ook een visum of een reistoestemming. Controleer dit ruim voor je vertrek.';
}

/* ---------- 9. Basis ---------- */
const hostTheme = document.documentElement.getAttribute('data-theme');
function applyTheme() {
  const t = settings.theme, root = document.documentElement;
  if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
  else if (hostTheme) root.setAttribute('data-theme', hostTheme);
  else root.removeAttribute('data-theme');
  const label = { system: 'automatisch', light: 'licht', dark: 'donker' }[t];
  const btn = $('#btnTheme');
  btn.setAttribute('aria-label', `Thema: ${label}. Klik om te wisselen.`);
  btn.innerHTML = icon(t === 'light' ? 'i-sun' : t === 'dark' ? 'i-moon' : 'i-auto');
}
function toast(msg, opt = {}) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(msg)}</span>${opt.action ? `<button class="btn sm ghost" type="button">${esc(opt.action.label)}</button>` : ''}`;
  if (opt.action) el.querySelector('button').addEventListener('click', () => { opt.action.fn(); el.remove(); });
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), opt.ms || 5200);
}
function announce(msg) { const a = $('#announcer'); a.textContent = ''; setTimeout(() => { a.textContent = msg; }, 60); }
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    ta.remove(); return ok;
  }
}
function openDialog(id) { const d = $('#' + id); if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } } return d; }
document.addEventListener('click', ev => { const b = ev.target.closest('[data-close]'); if (b) b.closest('dialog').close(); });
$$('dialog').forEach(d => d.addEventListener('click', ev => { if (ev.target === d) d.close(); }));

const VIEWS = ['deals', 'reisdata', 'kaart', 'kalender', 'vergelijk', 'samen', 'bewaard'];
function setTab(tab, opt = {}) {
  if (!VIEWS.includes(tab)) tab = 'deals';
  state.tab = tab;
  $$('.view').forEach(v => { v.hidden = v.dataset.view !== tab; });
  $$('.tab').forEach(a => { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  renderView(tab);
  if (opt.scroll) $('#view-' + tab).scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}
function goTab(tab) { if (location.hash.slice(1) === tab) setTab(tab, { scroll: true }); else location.hash = tab; }
window.addEventListener('hashchange', () => setTab(location.hash.slice(1), { scroll: true }));
function renderView(tab) {
  if (tab === 'deals') renderDeals();
  if (tab === 'kaart') { renderMarkers(); renderDestPanel(); }
  if (tab === 'kalender') renderCalendar();
  if (tab === 'vergelijk') renderCompare();
  if (tab === 'samen') renderGroup();
  if (tab === 'bewaard') renderSaved();
  if (tab === 'reisdata' && typeof renderWatches === 'function') renderWatches();
}
function renderAll() { renderDeals(); renderView(state.tab === 'deals' ? 'none' : state.tab); renderSavedCount(); renderHeaderPill(); if (typeof checkWatches === 'function') checkWatches(); }
function renderHeaderPill() {
  const live = state.liveDeals.length;
  $('#dataPillText').textContent = `${SNAP.length} gecontroleerde deals${live ? ` · ${live} live` : ''}`;
  const newest = SNAP.reduce((m, e) => (Date.parse(e.checked) > m ? Date.parse(e.checked) : m), 0);
  $('#footSnapshot').textContent = `Gecontroleerde deals: ${SNAP.length}. Ingebouwde controle: ${CHECK_WINDOW}${newest ? `; nieuwste controle: ${timeNL(new Date(newest).toISOString())}` : ''}. Live prijzen komen via je Claude-connectors of je eigen API-sleutels.`;
}

/* ---------- 10. Zoeken ---------- */
function searchPlaces(q) {
  const n = norm(q); if (!n) return [];
  const res = [];
  for (const p of [...AIRPORT_PLACES, ...STATIONS]) {
    const pn = norm(p.n), i = pn.indexOf(n);
    if (i >= 0) res.push({ p, s: (i === 0 ? 0 : 1) + (p.kind === 'airport' ? -0.5 : 0) + pn.length / 100 });
  }
  return res.sort((a, b) => a.s - b.s).slice(0, 7).map(x => x.p);
}
function searchDest(q) {
  const n = norm(q);
  const all = Object.values(DEST);
  if (!n) return all.slice().sort((a, b) => a.n.localeCompare(b.n, 'nl')).slice(0, 8);
  return all.map(d => {
    const fields = [d.n, d.c, d.en].map(norm);
    const i = fields.findIndex(f => f.includes(n));
    return i < 0 ? null : { d, s: i * 2 + (fields[i].startsWith(n) ? 0 : 1) };
  }).filter(Boolean).sort((a, b) => a.s - b.s).slice(0, 8).map(x => x.d);
}
// Combobox met toetsenbord (pijltjes, Enter, Escape)
function combobox(input, list, getItems, onPick, renderItem) {
  let items = [], active = -1;
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
  const draw = () => {
    if (!items.length) { close(); return; }
    list.innerHTML = items.map((it, i) => `<li role="option" id="${list.id}-${i}" aria-selected="${i === active}" data-i="${i}">${renderItem(it)}</li>`).join('');
    list.hidden = false; input.setAttribute('aria-expanded', 'true');
    if (active >= 0) input.setAttribute('aria-activedescendant', `${list.id}-${active}`);
  };
  const update = async () => { items = await getItems(input.value, (more) => { if (document.activeElement !== input) return; items = more; draw(); }); active = -1; draw(); };
  input.addEventListener('input', update);
  input.addEventListener('focus', () => { if (input.value || list.id === 'sugDest') update(); });
  input.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); if (list.hidden) { update(); return; } active = Math.min(items.length - 1, active + 1); draw(); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); active = Math.max(0, active - 1); draw(); }
    else if (ev.key === 'Enter') { if (!list.hidden && items.length) { ev.preventDefault(); onPick(items[Math.max(0, active)]); close(); } }
    else if (ev.key === 'Escape') close();
  });
  list.addEventListener('mousedown', ev => ev.preventDefault());
  list.addEventListener('click', ev => { const li = ev.target.closest('li'); if (li) { onPick(items[+li.dataset.i]); close(); } });
  input.addEventListener('blur', () => setTimeout(close, 120));
}
const KIND_LABEL = { station: 'Station', airport: 'Vliegveld', adres: 'Adres', postcode: 'Postcode', woonplaats: 'Plaats', weg: 'Straat', gps: 'Locatie' };
const pdokDebounced = debounce(async (q, cb) => {
  state.src.pdok = { status: 'busy', text: 'zoeken…' }; renderRadar();
  try {
    const r = await pdokSearch(q);
    state.src.pdok = { status: 'ok', text: `${r.length} adressen` }; renderRadar();
    cb(r);
  } catch (err) { state.src.pdok = { status: 'error', text: explainError(err) }; renderRadar(); cb([]); }
}, 350);
function setOrigin(p) {
  state.origin = { n: p.n, lat: p.lat, lon: p.lon, kind: p.kind, uic: p.uic, iata: p.iata };
  store.set('origin', state.origin);
  $('#inOrigin').value = p.n;
  renderOriginHint();
  renderAll();
  if (settings.nsKey) scanNS().then(renderAll);
}
function renderOriginHint() {
  const st = nearestStation(state.origin), ap = nearestAirports(state.origin, 2);
  const stTxt = st.km < 0.3 ? `station ${st.n}` : `station ${st.n} (${st.km.toFixed(1).replace('.', ',')} km)`;
  $('#originHint').textContent = `Dichtstbij: ${stTxt} · ${ap.map(a => `${a.n} (${Math.round(a.km)} km)`).join(', ')}`;
}
// Hoe ver wil je weg? Buiten Europa hoort de wereldkaart erbij.
function setReach(r) {
  state.reach = ['wereld', 'europa', 'ver', 'AF', 'AS', 'NA', 'SA', 'OC'].includes(r) ? r : 'wereld';
  $('#inReach').value = state.reach;
  if (state.reach === 'europa') setMapMode('eu'); else if (state.reach !== 'wereld') setMapMode('world');
}
function setDest(id) {
  state.dest = id;
  $('#inReach').hidden = id !== 'overal';
  const anyBtn = $('#btnAnywhere');
  anyBtn.setAttribute('aria-pressed', String(id === 'overal'));
  $('#inDest').value = id === 'overal' ? '' : DEST[id].n;
  renderAll();
}
// Zoeken naar een plek (station, vliegveld of adres via PDOK); gebruikt door alle plek-velden
function placeItems(q, more) {
  const local = searchPlaces(q);
  if (q.trim().length >= 4 && (local.length < 3 || /\d/.test(q))) {
    pdokDebounced(q, addr => more(local.concat(addr.map(a => ({ ...a, kind: a.kind }))).slice(0, 10)));
  }
  return local;
}
const placeItem = p => `${icon(p.kind === 'airport' ? 'i-vliegtuig' : p.kind === 'station' ? 'i-trein' : 'i-pin', 'sm')}<span>${esc(p.n)}</span><span class="kind">${KIND_LABEL[p.kind] || 'Adres'}</span>`;
function initSearch() {
  const inO = $('#inOrigin');
  inO.value = state.origin.n;
  combobox(inO, $('#sugOrigin'), placeItems, setOrigin, placeItem);
  const inD = $('#inDest');
  combobox(inD, $('#sugDest'), q => searchDest(q), d => setDest(d.id), d => `${icon('i-pin', 'sm')}<span>${esc(d.n)}</span><span class="kind">${esc(d.c)}</span>`);
  inD.addEventListener('change', () => { if (!inD.value.trim()) setDest('overal'); });
  $('#btnAnywhere').addEventListener('click', () => setDest('overal'));
  $('#inReach').addEventListener('change', ev => { setReach(ev.target.value); renderAll(); if (CLOUD.kiwi && !state.scanning) scan({ onlyKiwi: true, initial: true }); });
  $('#btnLocate').addEventListener('click', () => {
    if (!('geolocation' in navigator)) { toast('Je browser kan je locatie niet delen. Typ je station of adres.'); return; }
    toast('Locatie opvragen…', { ms: 2500 });
    navigator.geolocation.getCurrentPosition(pos => {
      setOrigin({ n: 'Mijn locatie', lat: pos.coords.latitude, lon: pos.coords.longitude, kind: 'gps' });
      toast('Vertrekpunt staat op je huidige locatie.');
    }, () => toast(inFrame ? 'Locatie werkt niet in deze preview. Typ je station of adres.' : 'Locatie niet beschikbaar. Typ je station of adres.'), { timeout: 10000, maximumAge: 600000 });
  });
  // Wanneer
  const monthSel = $('#inMonth');
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthSel.insertAdjacentHTML('beforeend', `<option value="${v}">${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}</option>`);
  }
  const holSel = $('#inHol'), regSel = $('#inRegion'), inFrom = $('#inFrom'), inTo = $('#inTo');
  const today = todayISO();
  holSel.innerHTML = HOLIDAYS.filter(h => (h.all || h.zuid)[1] >= today).map(h => `<option value="${h.id}">${esc(h.n)}</option>`).join('');
  if (![...holSel.options].some(o => o.value === state.when.hol) && holSel.options.length) state.when.hol = holSel.options[0].value;
  holSel.value = state.when.hol; regSel.value = state.when.region;
  inFrom.min = inTo.min = today;
  const syncWhen = () => {
    const m = state.when.mode;
    $$('.seg [data-when]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.when === m)));
    monthSel.hidden = m !== 'month';
    $('#whenHoliday').hidden = m !== 'holiday';
    $('#whenRange').hidden = m !== 'range';
    state.when.month = m === 'month' ? monthSel.value : null;
    const h = $('#whenHint'), r = m === 'holiday' ? holidayRange() : null;
    const voorjaar = state.when.hol === 'voorjaar';
    h.innerHTML = r ? `${esc(r.name)}: ${esc(dateNL(r.from, { year: true }))} t/m ${esc(dateNL(r.to, { year: true }))}.${voorjaar ? ' Dit is een adviesdatum: je school mag afwijken.' : ''} <a href="${SRC.vakanties.url}" target="_blank" rel="noopener">Bron: Rijksoverheid</a>`
      : m === 'weekend' ? 'Vertrek op vrijdag of zaterdag, binnen 4 dagen terug.' : '';
  };
  $$('.seg [data-when]').forEach(b => b.addEventListener('click', () => { state.when.mode = b.dataset.when; syncWhen(); renderAll(); }));
  monthSel.addEventListener('change', () => { state.when.month = monthSel.value; renderAll(); });
  holSel.addEventListener('change', () => { state.when.hol = holSel.value; syncWhen(); renderAll(); });
  regSel.addEventListener('change', () => { state.when.region = regSel.value; store.set('region', regSel.value); syncWhen(); renderAll(); });
  inFrom.addEventListener('change', () => { state.when.from = inFrom.value; if (inTo.value && inTo.value < inFrom.value) { inTo.value = ''; state.when.to = ''; } inTo.min = inFrom.value || today; renderAll(); });
  inTo.addEventListener('change', () => { state.when.to = inTo.value; renderAll(); });
  window.setWhen = (mode, extra = {}) => { Object.assign(state.when, extra, { mode }); if (extra.hol) holSel.value = extra.hol; syncWhen(); };
  // Soort reis: retour of enkele reis
  const syncTrip = () => {
    $$('.trip-tabs [data-trip]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.trip === state.trip)));
    $('#fieldStay').hidden = state.trip !== 'retour';
    if (window.syncMoreOpts) syncMoreOpts();
    $('#fPriceTrip').textContent = tripWord();
  };
  window.setTrip = t => { state.trip = t === 'enkel' ? 'enkel' : 'retour'; store.set('trip', state.trip); syncTrip(); };
  $$('.trip-tabs [data-trip]').forEach(b => b.addEventListener('click', () => {
    if (state.trip === b.dataset.trip) return;
    setTrip(b.dataset.trip); renderAll();
    if (CLOUD.kiwi && !state.scanning) scan({ onlyKiwi: true, initial: true });
  }));
  syncTrip();
  // Op een telefoon staan reizigers, verblijf en bagage achter "Meer opties"
  const moreBtn = $('#btnMoreOpts'), grid = $('#searchExtra');
  const moreText = () => { $('#moreOptsText').textContent = grid.classList.contains('open') ? 'Minder opties' : `Meer opties: ${state.travellers} reiziger${state.travellers === 1 ? '' : 's'}${state.trip === 'retour' ? ', verblijf' : ''}, korting en bagage`; };
  moreBtn.addEventListener('click', () => { const o = grid.classList.toggle('open'); moreBtn.setAttribute('aria-expanded', String(o)); moreText(); });
  window.syncMoreOpts = moreText; moreText();
  const staySel = $('#inStay'), bagSel = $('#inBag');
  staySel.addEventListener('change', () => { state.stay = staySel.value; renderAll(); });
  bagSel.addEventListener('change', () => { state.bag = bagSel.value; renderAll(); });
  // Reizigers en korting
  const setTrav = n => { state.travellers = Math.max(1, Math.min(9, n)); $('#travCount').textContent = state.travellers; syncMoreOpts(); renderAll(); renderPasses(); };
  $('#travMinus').addEventListener('click', () => setTrav(state.travellers - 1));
  $('#travPlus').addEventListener('click', () => setTrav(state.travellers + 1));
  const prof = $('#inProfile');
  prof.value = state.profile;
  prof.addEventListener('change', () => {
    state.profile = prof.value; store.set('profile', state.profile);
    state.nsAccess = {}; renderAll(); renderPasses();
    if (settings.nsKey) scanNS().then(renderAll);
  });
  $('#searchForm').addEventListener('submit', ev => { ev.preventDefault(); scan(); if (state.tab !== 'deals') goTab('deals'); });
  // Snelle keuzes
  $$('.chips [data-chip]').forEach(b => b.addEventListener('click', () => {
    const c = b.dataset.chip;
    if (c === 'overal') { setDest('overal'); state.sort = 'prijs'; $('#sortSel').value = 'prijs'; goTab('deals'); }
    if (c === 'weekend') { goTab('kalender'); runWeekend(); }
    if (c === 'vergelijk') goTab('vergelijk');
    if (c === 'onder50') {
      const on = b.getAttribute('aria-pressed') !== 'true';
      state.filters.maxPrice = on ? 50 : PRICE_MAX; syncFilterUI(); renderAll();
    }
  }));
  $$('.chips [data-type]').forEach(b => b.addEventListener('click', () => {
    const t = b.dataset.type;
    if (state.filters.types.has(t)) state.filters.types.delete(t); else state.filters.types.add(t);
    syncFilterUI(); renderAll();
  }));
  renderOriginHint();
}

/* ---------- 11. Bronnen (radar) ---------- */
function renderRadar() {
  const s = state.src;
  const items = [
    { key: 'snapshot', label: `Gecontroleerde deals: ${SNAP.length}`, st: s.snapshot.status, act: 'help', title: `Gecontroleerd op ${CHECK_WINDOW}` },
    { key: 'ns', label: `NS API: ${s.ns.text}`, st: s.ns.status, act: 'settings' },
    { key: 'kiwi', label: `Kiwi.com live: ${s.kiwi.text}`, st: s.kiwi.status, act: 'help' },
    { key: 'cloud', label: `Dagelijkse controle: ${s.cloud.text}`, st: s.cloud.status, act: 'help' },
    { key: 'tp', label: `Vluchtprijzen (Travelpayouts): ${s.tp.text}`, st: s.tp.status, act: 'settings' },
    { key: 'pdok', label: `Adressen (PDOK): ${s.pdok.text}`, st: s.pdok.status === 'idle' ? 'ok' : s.pdok.status, act: 'help' },
    { key: 'links', label: `${searchLinks().length} aanbieders om live te checken`, st: 'ok', act: 'providers' },
  ];
  $('#radarList').innerHTML = items.map(i => `<li><button type="button" class="src-pill" data-status="${i.st}" data-act="${i.act}" title="${esc(i.title || i.label)}"><span class="st" aria-hidden="true"></span>${esc(i.label)}<span class="sr-only"> (status: ${{ ok: 'werkt', off: 'uit', error: 'fout', busy: 'bezig' }[i.st] || i.st})</span></button></li>`).join('');
}
$('#radarList').addEventListener('click', ev => {
  const b = ev.target.closest('[data-act]'); if (!b) return;
  if (b.dataset.act === 'settings') openSettings();
  if (b.dataset.act === 'help') openHelp('data');
  if (b.dataset.act === 'providers') { goTab('deals'); setTimeout(() => $('#provTitle').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }), 80); }
});

/* ---------- 12. Deals ---------- */
function initFiltersUI() {
  $('#fModes').innerHTML = Object.entries(MODES).filter(([k]) => k !== 'combi' || SNAP.some(e => e.mode === 'combi')).map(([k, m]) => `<label class="check"><input type="checkbox" data-f="mode" value="${k}" checked><span class="mode-dot" style="background:var(--m-${k})"></span>${m.label}</label>`).join('');
  $('#fTypes').innerHTML = Object.entries(TYPES).map(([k, l]) => `<label class="check"><input type="checkbox" data-f="type" value="${k}">${l}</label>`).join('');
  $('#fStatus').innerHTML = `<label class="check"><input type="checkbox" data-f="status" value="snapshot" checked>Gecontroleerd (met bron)</label><label class="check"><input type="checkbox" data-f="status" value="live" checked>Live (via API)</label>`;
  $('#filters').addEventListener('change', ev => {
    const t = ev.target, f = state.filters;
    if (t.dataset.f === 'mode') t.checked ? f.modes.add(t.value) : f.modes.delete(t.value);
    if (t.dataset.f === 'type') t.checked ? f.types.add(t.value) : f.types.delete(t.value);
    if (t.dataset.f === 'country') t.checked ? f.countries.add(t.value) : f.countries.delete(t.value);
    if (t.dataset.f === 'status') t.checked ? f.status.add(t.value) : f.status.delete(t.value);
    if (t.dataset.f === 'origin') t.checked ? f.origins.add(t.value) : f.origins.delete(t.value);
    if (t.id === 'fDirect') f.direct = t.checked;
    if (t.id === 'fBag') f.bagIncl = t.checked;
    if (t.id === 'fNlOnly') f.nlOnly = t.checked;
    if (t.id === 'fNoIndic') f.noIndic = t.checked;
    if (t.id === 'fDepPart') f.depPart = t.value;
    syncFilterUI(); renderAll();
  });
  const ranges = [['fPrice', 'maxPrice', v => noLimit(v, PRICE_MAX) ? 'alles' : `≤ ${eur(v)}`], ['fHours', 'maxHours', v => noLimit(v, 24) ? 'alles' : `≤ ${v} uur`], ['fAccess', 'maxAccess', v => noLimit(v, 300) ? 'alles' : `≤ ${dur(v)}`]];
  ranges.forEach(([id, key, fmt]) => {
    const el = $('#' + id);
    el.addEventListener('input', () => { state.filters[key] = +el.value; $('#' + id + 'Out').textContent = fmt(+el.value); debouncedRender(); });
  });
  $('#btnResetFilters').addEventListener('click', () => { state.filters = defaultFilters(); syncFilterUI(); renderAll(); toast('Alle filters zijn gewist.'); });
  const open = () => { $('#filters').classList.add('open'); $('#scrim').hidden = false; $('#btnFiltersClose').focus(); };
  const close = () => { $('#filters').classList.remove('open'); $('#scrim').hidden = true; $('#btnFilters').focus(); };
  $('#btnFilters').addEventListener('click', open);
  $('#btnFiltersClose').addEventListener('click', close);
  $('#scrim').addEventListener('click', close);
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && $('#filters').classList.contains('open')) close(); });
  $('#sortSel').addEventListener('change', ev => { state.sort = ev.target.value; renderDeals(); });
}
const debouncedRender = debounce(() => renderAll(), 120);
// Lijst met vertrekpunten in het filter: alleen punten waar nu deals vanaf gaan
let originSig = '';
function renderOriginFilter() {
  const count = {};
  for (const e of allDeals()) count[e.from] = (count[e.from] || 0) + 1;
  const keys = Object.keys(count).sort((a, b) => ORIGINS[a].kind.localeCompare(ORIGINS[b].kind) || ORIGINS[a].n.localeCompare(ORIGINS[b].n, 'nl'));
  const sig = keys.join(',');
  if (sig === originSig) return;
  originSig = sig;
  $('#fOrigins').innerHTML = keys.map(k => `<label class="check"><input type="checkbox" data-f="origin" value="${k}">${esc(ORIGINS[k].n)}</label>`).join('');
}
let countrySig = '';
function renderCountryFilter() {
  const ccs = [...new Set(allDeals().map(e => e.dest.cc))].sort((a, b) => (COUNTRIES[a] || a).localeCompare(COUNTRIES[b] || b, 'nl'));
  const sig = ccs.join(',');
  if (sig === countrySig) return;
  countrySig = sig;
  $('#fCountries').innerHTML = ccs.map(cc => `<label class="check"><input type="checkbox" data-f="country" value="${cc}"><span aria-hidden="true">${flag(cc)}</span> ${esc(COUNTRIES[cc] || cc)}</label>`).join('');
}
function syncFilterUI() {
  const f = state.filters;
  renderOriginFilter(); renderCountryFilter();
  $$('#filters [data-f="origin"]').forEach(c => { c.checked = f.origins.has(c.value); });
  $('#fNlOnly').checked = f.nlOnly; $('#fNoIndic').checked = f.noIndic; $('#fDepPart').value = f.depPart;
  $('#fPriceTrip').textContent = tripWord();
  $$('#filters [data-f="mode"]').forEach(c => { c.checked = f.modes.has(c.value); });
  $$('#filters [data-f="type"]').forEach(c => { c.checked = f.types.has(c.value); });
  $$('#filters [data-f="country"]').forEach(c => { c.checked = f.countries.has(c.value); });
  $$('#filters [data-f="status"]').forEach(c => { c.checked = f.status.has(c.value); });
  $('#fDirect').checked = f.direct; $('#fBag').checked = f.bagIncl;
  $('#fPrice').value = f.maxPrice; $('#fPriceOut').textContent = noLimit(f.maxPrice, PRICE_MAX) ? 'alles' : `≤ ${eur(f.maxPrice)}`;
  $('#fHours').value = f.maxHours; $('#fHoursOut').textContent = noLimit(f.maxHours, 24) ? 'alles' : `≤ ${f.maxHours} uur`;
  $('#fAccess').value = f.maxAccess; $('#fAccessOut').textContent = noLimit(f.maxAccess, 300) ? 'alles' : `≤ ${dur(f.maxAccess)}`;
  $$('.chips [data-type]').forEach(b => b.setAttribute('aria-pressed', String(f.types.has(b.dataset.type))));
  $('.chips [data-chip="onder50"]').setAttribute('aria-pressed', String(f.maxPrice === 50));
  const n = activeFilterCount();
  $('#filterCount').textContent = n ? `(${n})` : '';
}
function renderActiveFilters() {
  const f = state.filters, chips = [];
  if (state.dest !== 'overal') chips.push({ label: `Naar: ${DEST[state.dest].n}`, fn: () => setDest('overal') });
  else if (state.reach !== 'wereld') chips.push({ label: $('#inReach').selectedOptions[0].textContent, fn: () => setReach('wereld') });
  if (state.when.mode !== 'flex') {
    const w = state.when, r = w.mode === 'holiday' ? holidayRange() : null;
    const label = w.mode === 'weekend' ? 'Weekend' : w.mode === 'month' ? `Maand: ${$('#inMonth').selectedOptions[0]?.textContent || ''}`
      : w.mode === 'holiday' ? (r ? r.name : 'Vakantie') : `Datums: ${w.from ? dateNL(w.from, { dow: false }) : '…'} – ${w.to ? dateNL(w.to, { dow: false }) : '…'}`;
    chips.push({ label, fn: () => $('.seg [data-when="flex"]').click() });
  }
  if (state.trip === 'retour' && state.stay !== 'alle') chips.push({ label: STAYS[state.stay].label, fn: () => { state.stay = 'alle'; $('#inStay').value = 'alle'; } });
  f.origins.forEach(o => chips.push({ label: `Vanaf ${ORIGINS[o].n}`, fn: () => f.origins.delete(o) }));
  if (f.nlOnly) chips.push({ label: 'Vertrek in Nederland', fn: () => { f.nlOnly = false; } });
  if (f.depPart !== 'alle') chips.push({ label: `Vertrek: ${f.depPart}`, fn: () => { f.depPart = 'alle'; } });
  if (f.noIndic) chips.push({ label: 'Zonder indicaties', fn: () => { f.noIndic = false; } });
  if (f.modes.size < 4) chips.push({ label: `Vervoer: ${[...f.modes].map(m => MODES[m].label).join(', ') || 'geen'}`, fn: () => { f.modes = new Set(Object.keys(MODES)); } });
  if (!noLimit(f.maxPrice, PRICE_MAX)) chips.push({ label: `Max ${eur(f.maxPrice)} ${tripWord()}`, fn: () => { f.maxPrice = PRICE_MAX; } });
  if (!noLimit(f.maxHours, 24)) chips.push({ label: `Max ${f.maxHours} uur`, fn: () => { f.maxHours = 24; } });
  if (!noLimit(f.maxAccess, 300)) chips.push({ label: `Naar vertrekpunt ≤ ${dur(f.maxAccess)}`, fn: () => { f.maxAccess = 300; } });
  if (f.direct) chips.push({ label: 'Rechtstreeks', fn: () => { f.direct = false; } });
  if (f.bagIncl) chips.push({ label: 'Koffer inbegrepen', fn: () => { f.bagIncl = false; } });
  f.types.forEach(t => chips.push({ label: TYPES[t], fn: () => f.types.delete(t) }));
  f.countries.forEach(c => chips.push({ label: COUNTRIES[c] || c, fn: () => f.countries.delete(c) }));
  if (f.status.size < 2) chips.push({ label: f.status.has('live') ? 'Alleen live' : 'Alleen gecontroleerd', fn: () => { f.status = new Set(['snapshot', 'live']); } });
  const box = $('#activeFilters');
  box.innerHTML = chips.map((c, i) => `<button type="button" class="chip" data-i="${i}" aria-label="Filter weghalen: ${esc(c.label)}">${esc(c.label)} ${icon('i-close', 'sm')}</button>`).join('');
  box.onclick = ev => { const b = ev.target.closest('[data-i]'); if (!b) return; chips[+b.dataset.i].fn(); syncFilterUI(); renderAll(); };
}
// Prijsblok: bedrag + uitleg, passend bij enkele reis of retour
function priceBlock(e, tp) {
  const notes = [];
  if (tp.calc) notes.push(`retour p.p., <b>berekend</b>: 2 × ${eur(e.price)}`);
  else if (e.trip === 'retour') { notes.push('retour p.p.'); notes.push(`≈ ${eur(e.perDir)} per richting`); }
  else notes.push('enkele reis p.p.');
  if (state.travellers > 1) notes.push(`${state.travellers} pers.: <b>${eur(tp.p * state.travellers)}</b>`);
  return `<div class="price-row"><div class="price">${e.priceType === 'vanaf' ? '<small>vanaf</small>' : ''}${eur(tp.p)}</div><div class="price-note">${notes.join('<br>')}</div></div>`;
}
// Heen en terug als twee regels (alleen als de data vastliggen)
function legsBlock(e) {
  if (!e.out) return `<div class="dates">${icon('i-cal', 'sm')} Datum naar keuze, zolang beschikbaar</div>`;
  const leg = (k, d, t, extra) => `<div class="leg"><span class="leg-k">${k}</span><b>${esc(dateNL(d))}</b>${t ? `<span>${esc(t)}</span>` : ''}${extra ? `<span class="muted">${extra}</span>` : ''}</div>`;
  return `<div class="legs">${leg('Heen', e.out, e.depTime, e.flight ? esc(e.flight.split(', ')[0]) : '')}${e.back ? leg('Terug', e.back, e.backTime, e.backFlight ? esc(e.backFlight.split(', ')[0]) : '') : ''}${e.nights != null ? `<span class="nights">${nightsText(e.nights)}</span>` : ''}</div>`;
}
const statusBadge = e => (e.indic ? '<span class="badge indic">Indicatie</span>' : `<span class="badge ${e.status}">${e.status === 'live' ? 'Live' : 'Gecontroleerd'}</span>`);
function bagLabel(e) {
  if (e.mode === 'vliegtuig' && state.bag !== 'tasje' && e.bag === 'tasje') return 'Zonder koffer: die kost extra';
  return { koffer: 'Koffer inbegrepen', hand: 'Handbagagekoffer inbegrepen', tasje: 'Alleen klein tasje gratis', onbekend: 'Bagage: check bij boeken' }[e.bag] || 'Bagage: check';
}
function dealCard(x) {
  const { e, dd } = x, tp = x.tp || tripPrice(e) || { p: e.price, calc: false };
  const m = MODES[e.mode], fav = isFav(e.id);
  const arrName = e.arr && ARR_AIRPORTS[e.arr] ? ` <span class="small muted">(${esc(ARR_AIRPORTS[e.arr].n)})</span>` : '';
  const route = `${e.o.n} naar ${e.dest.n}`;
  const tr = e.transfers === 0 ? 'Rechtstreeks' : e.transfers == null ? 'Overstappen: onbekend' : `${e.transfers} overstap${e.transfers > 1 ? 'pen' : ''}`;
  const src = srcOf(e);
  const age = ageOf(e.checked);
  const book = bookLink(e);
  const acc = dd.a;
  const more = x.more && x.more.n ? `<button class="more-opts" type="button" data-act="more">${icon('i-layers', 'sm')}<span>Nog ${x.more.n} andere optie${x.more.n === 1 ? '' : 's'} naar ${esc(e.dest.n)}</span>${icon('i-enkel', 'sm')}</button>` : '';
  return `<li class="deal" data-mode="${e.mode}" data-id="${esc(e.id)}">
    <div class="deal-top">
      <span class="mode-tag">${icon(m.icon)}${m.label}</span>
      <span class="provider">${esc(e.provider)}</span>
      ${statusBadge(e)}
      ${TOP_IDS.has(e.id) ? '<span class="badge top">Topdeal</span>' : ''}
      ${e.who === 'jongeren' ? '<span class="badge who">Jongerentarief</span>' : ''}
    </div>
    <button class="icon-btn fav" type="button" data-act="fav" aria-pressed="${fav}" aria-label="${fav ? 'Haal uit favorieten' : 'Bewaar als favoriet'}: ${esc(route)}">${icon('i-star')}</button>
    <div class="route">
      <h3><span class="from">${esc(e.o.n)} <span class="arrow" aria-hidden="true">→</span><span class="sr-only"> naar</span></span> <span class="to">${esc(e.dest.n)}${arrName}</span></h3>
      <div class="sub"><span class="flag" aria-hidden="true">${flag(e.dest.cc)}</span> ${esc(e.dest.c)}${e.dest.t.length ? ' · ' + e.dest.t.map(t => TYPES[t]).join(', ') : ''}</div>
    </div>
    ${priceBlock(e, tp)}
    ${legsBlock(e)}
    ${histLine(e)}
    <ul class="facts">
      <li>${icon('i-clock')}${dur(e.dur)}${e.durEst ? ` <span class="est">(geschat${e.transfers ? ', incl. overstap' : ''})</span>` : ''}</li>
      <li>${icon('i-route')}${tr}</li>
      <li title="CO2 per persoon, per richting">${icon('i-leaf')}${kg(e.co2One)} CO2</li>
      <li>${icon('i-bag')}${bagLabel(e)}</li>
    </ul>
    <div class="d2d">Deur tot deur vanaf ${esc(state.origin.n)}: <b>ca. ${dur(dd.total)}</b> · naar ${esc(e.o.n)} ${acc.live ? 'met NS: ' + dur(acc.min) + (acc.eur != null ? ', ' + eur(acc.eur) : '') : 'ca. ' + dur(acc.min)}</div>
    <div class="src-line">Bron: <a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.name)}</a>${e.status === 'live' && e.srcLive ? `<span>· opgehaald ${esc(timeNL(e.checked))}</span><span class="age">(prijs door gebruikers gevonden in de 48 uur ervoor)</span>` : `<span>· ${e.status === 'live' ? 'live opgehaald' : 'gecontroleerd'} ${esc(timeNL(e.checked))}</span><span class="age ${age.cls}">(${age.text})</span>`}${e.srcDate ? `<span>· bron-datum ${esc(dateNL(e.srcDate, { dow: false, year: true }))}</span>` : ''}</div>
    <div class="card-actions">
      <a class="btn" href="${esc(book.url)}" target="_blank" rel="noopener">Naar boeken ${icon('i-ext', 'sm')}<span class="sr-only"> bij ${esc(book.name)} (opent in een nieuw venster)</span></a>
      <button class="icon-btn" type="button" data-act="alert" aria-label="Prijsalert voor ${esc(route)}">${icon('i-bell')}</button>
      <button class="icon-btn" type="button" data-act="share" aria-label="Deel ${esc(route)}">${icon('i-share')}</button>
      <button class="btn ghost sm" type="button" data-act="info">Details</button>
    </div>
    ${more}
  </li>`;
}
// Compacte regel (lijstweergave): één tik opent de details
function dealRow(x) {
  const { e } = x, tp = x.tp || tripPrice(e) || { p: e.price, calc: false };
  const when = e.out ? `${dateNL(e.out)}${e.back ? ' – ' + dateNL(e.back) : ''}${e.nights != null ? ' · ' + nightsText(e.nights) : ''}` : 'datum naar keuze';
  return `<li class="deal-row" data-mode="${e.mode}" data-id="${esc(e.id)}">
    <button type="button" class="row-main" data-act="info" aria-label="${esc(e.o.n)} naar ${esc(e.dest.n)}, ${e.priceType === 'vanaf' ? 'vanaf ' : ''}${esc(eur(tp.p))} ${tp.calc || e.trip === 'retour' ? 'retour' : 'enkele reis'}. Open details.">
      <span class="row-ic">${icon(MODES[e.mode].icon)}</span>
      <span class="row-txt"><b>${esc(e.dest.n)}</b> <span class="flag" aria-hidden="true">${flag(e.dest.cc)}</span>${e.indic ? ' <span class="badge indic">Indicatie</span>' : e.status === 'live' ? ' <span class="badge live">Live</span>' : ''}
        <span class="row-sub">${esc(e.o.n)} · ${esc(when)}</span>
        <span class="row-sub">${esc(e.provider)} · ${e.transfers === 0 ? 'rechtstreeks' : e.transfers == null ? 'overstappen onbekend' : e.transfers + ' overstap' + (e.transfers > 1 ? 'pen' : '')}${x.more && x.more.n ? ` · nog ${x.more.n} optie${x.more.n === 1 ? '' : 's'}` : ''}</span></span>
      <span class="row-price">${e.priceType === 'vanaf' ? '<small>vanaf</small> ' : ''}<b>${eur(tp.p)}</b><small>${tp.calc ? 'retour (2 ×)' : e.trip === 'retour' ? 'retour' : 'enkel'}</small></span>
    </button>
  </li>`;
}
/* Ideeën: tegels die in één tik een slimme selectie maken. Elke tegel telt echte deals (voor enkele reis of retour). */
const INSPIRE = [
  { id: 'zon', title: 'Naar de zon', icon: 'i-sun', test: e => e.dest.t.includes('strand'), apply: f => f.types.add('strand') },
  { id: 'stad', title: 'Stedentrip', icon: 'i-city', test: e => e.dest.t.includes('stad'), apply: f => f.types.add('stad') },
  { id: 'kerst', title: 'Kerstvakantie', icon: 'i-gift', test: e => { const r = holidayRange('kerst'); return !!(r && e.out && e.out >= addDays(r.from, -1) && e.out <= r.to && (!e.back || e.back <= r.to)); }, apply: () => setWhen('holiday', { hol: 'kerst' }), needs: () => holidayRange('kerst').to >= todayISO() },
  { id: 'ver', title: 'Buiten Europa', icon: 'i-globe', test: e => contOf(e.dest) !== 'EU', apply: () => setReach('ver') },
  { id: 'trein', title: 'Met de trein', icon: 'i-trein', test: e => e.mode === 'trein', apply: f => { f.modes = new Set(['trein']); } },
  { id: 'ski', title: 'Wintersport', icon: 'i-snow', test: e => e.dest.t.includes('ski'), apply: f => f.types.add('ski') },
  { id: 'natuur', title: 'Natuur', icon: 'i-tree', test: e => e.dest.t.includes('natuur'), apply: f => f.types.add('natuur') },
  { id: 'budget', title: () => `Onder ${eur(state.trip === 'retour' ? 50 : 25)}`, icon: 'i-euro', test: (e, tp) => tp.p <= (state.trip === 'retour' ? 50 : 25), apply: f => { f.maxPrice = state.trip === 'retour' ? 50 : 25; } },
  { id: 'direct', title: 'Rechtstreeks vliegen', icon: 'i-vliegtuig', test: e => e.mode === 'vliegtuig' && e.transfers === 0, apply: f => { f.modes = new Set(['vliegtuig']); f.direct = true; } },
];
function renderInspire() {
  const box = $('#inspire'); if (!box) return;
  const today = todayISO(), base = [];
  for (const e of allDeals()) {
    if ((e.out && e.out < today) || (e.who === 'jongeren' && !isYouth())) continue;
    const tp = tripPrice(e); if (tp) base.push({ e, tp });
  }
  const tiles = INSPIRE.filter(t => !t.needs || t.needs()).map(t => {
    const hit = base.filter(x => t.test(x.e, x.tp));
    return hit.length ? { t, n: new Set(hit.map(x => x.e.to)).size, min: Math.min(...hit.map(x => x.tp.p)) } : null;
  }).filter(Boolean);
  box.hidden = !tiles.length;
  box.innerHTML = tiles.length ? `<h2 class="inspire-title">Ideeën voor jou <span class="small muted">${tripWord()}, per persoon</span></h2><div class="inspire-row">${tiles.map(({ t, n, min }) => `<button type="button" class="tile" data-tile="${t.id}">
      <span class="tile-ic">${icon(t.icon)}</span><b>${esc(typeof t.title === 'function' ? t.title() : t.title)}</b>
      <span class="tile-p">vanaf ${eur(min)}</span><span class="small">${n} bestemming${n === 1 ? '' : 'en'}</span></button>`).join('')}</div>` : '';
}
$('#inspire').addEventListener('click', ev => {
  const b = ev.target.closest('[data-tile]'); if (!b) return;
  const t = INSPIRE.find(x => x.id === b.dataset.tile); if (!t) return;
  state.filters = defaultFilters();
  setReach('wereld');
  setWhen('flex');
  state.stay = 'alle'; $('#inStay').value = 'alle';
  state.dest = 'overal'; $('#inDest').value = ''; $('#btnAnywhere').setAttribute('aria-pressed', 'true');
  t.apply(state.filters);
  state.sort = 'prijs'; $('#sortSel').value = 'prijs';
  syncFilterUI(); renderAll();
  if (state.tab !== 'deals') goTab('deals');
  $('#view-deals').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  announce(`${typeof t.title === 'function' ? t.title() : t.title}: ${lastList.length} deals.`);
});
let lastList = [], lastSig = '';
function renderDeals() {
  const { list, hiddenYouth, expired, otherTrip } = filterDeals();
  lastList = list;
  // Eén deal per bestemming: de beste volgens de sortering, met een teller voor de rest
  let view = list;
  const grouped = state.perDest && state.dest === 'overal';
  if (grouped) {
    // Een gecontroleerde of live deal gaat voor een indicatie: die staat dan bij de "andere opties"
    const seen = new Map(); view = [];
    for (const x of list) {
      const g = seen.get(x.e.to);
      if (!g) { x.more = { n: 0, rep: x }; seen.set(x.e.to, x.more); view.push(x); continue; }
      g.n++;
      if (g.rep.e.indic && !x.e.indic) { view[view.indexOf(g.rep)] = null; x.more = g; g.rep = x; view.push(x); }
    }
    view = view.filter(Boolean);
  }
  const sig = `${state.sort}|${state.trip}|${grouped}|${state.dest}|${view.length}|${view[0] ? view[0].e.id : ''}`;
  if (sig !== lastSig) { state.shown = 24; lastSig = sig; }
  const cheapest = list.reduce((m, x) => (!m || x.tp.p < m.tp.p ? x : m), null);
  $('#summary').innerHTML = list.length
    ? `${grouped ? `${view.length} bestemming${view.length === 1 ? '' : 'en'} · ` : ''}${list.length} deal${list.length === 1 ? '' : 's'} <span class="muted">· goedkoopst ${eur(cheapest.tp.p)} ${tripWord()} p.p. (${esc(cheapest.e.dest.n)})</span>`
    : 'Geen deals <span class="muted">met deze keuzes</span>';
  const notices = [], hints = [];
  if (otherTrip) hints.push(state.trip === 'retour'
    ? `<span class="trip-note"><b>Retourprijzen.</b> Trein en bus met een vrije datum: 2 × de enkele reis ("berekend"). ${otherTrip} losse enkele vlucht${otherTrip === 1 ? '' : 'en'} ${otherTrip === 1 ? 'doet' : 'doen'} niet mee. <button class="linkish" type="button" data-trip-switch>Toon enkele reizen</button></span>`
    : `<span class="trip-note"><b>Enkele reizen.</b> ${otherTrip} deal${otherTrip === 1 ? '' : 's'} die alleen als retour te koop ${otherTrip === 1 ? 'is, doet' : 'zijn, doen'} niet mee. <button class="linkish" type="button" data-trip-switch>Toon retourreizen</button></span>`);
  if (hiddenYouth) hints.push(`<span>${hiddenYouth} jongerentarie${hiddenYouth === 1 ? 'f is' : 'ven zijn'} verborgen. Kies "Jongere" bij reizigers om ze te zien.</span>`);
  $('#dealHints').innerHTML = hints.join('');
  if (list.some(x => x.e.from === 'EIN')) notices.push(`<div class="notice">${icon('i-info')}<div><b>Let op:</b> ${esc(NOTICES.EIN.text)} <a href="${SRC.einClose.url}" target="_blank" rel="noopener">Bron</a></div></div>`);
  const newest = SNAP.reduce((m, e) => (Date.parse(e.checked) > m ? Date.parse(e.checked) : m), 0);
  const snapAge = ageOf(new Date(newest || Date.now()).toISOString());
  if (snapAge.days > 3) notices.push(`<div class="notice">${icon('i-info')}<div>De nieuwste controle is ${Math.round(snapAge.days)} dagen oud. In Claude ververst de dagelijkse controle de prijzen; anders kun je live zoeken met je connectors.</div></div>`);
  if (expired) notices.push(`<div class="notice info">${icon('i-info')}<div>${expired} deal${expired === 1 ? '' : 's'} met een datum in het verleden ${expired === 1 ? 'is' : 'zijn'} weggelaten.</div></div>`);
  $('#dealNotices').innerHTML = notices.join('');
  renderTopDeals(list);
  const grid = $('#dealGrid'), rows = state.layout === 'rows';
  grid.classList.toggle('rows', rows);
  const page = view.slice(0, state.shown);
  grid.innerHTML = page.map(rows ? dealRow : dealCard).join('') + (state.scanning && (settings.tpToken || CLOUD.kiwi) ? '<li class="skeleton" aria-label="Live resultaten laden"></li><li class="skeleton" aria-hidden="true"></li>' : '');
  const rest = view.length - page.length;
  $('#moreRow').innerHTML = rest > 0 ? `<button class="btn ghost" type="button" id="btnMore">Toon nog ${Math.min(24, rest)} ${grouped ? 'bestemmingen' : 'deals'} <span class="muted">(${rest} over)</span></button>` : '';
  $('#emptyState').innerHTML = list.length ? '' : emptyState();
  const pd = $('#btnPerDest'); pd.setAttribute('aria-pressed', String(state.perDest)); pd.disabled = state.dest !== 'overal';
  $('#btnLayout').innerHTML = icon(rows ? 'i-grid' : 'i-rows');
  $('#btnLayout').setAttribute('aria-label', rows ? 'Toon als kaarten' : 'Toon als compacte lijst');
  renderActiveFilters();
  syncFilterUI();
  renderProviders();
  renderInspire();
}
$('#moreRow').addEventListener('click', ev => { if (ev.target.closest('#btnMore')) { state.shown += 24; renderDeals(); } });
$('#dealHints').addEventListener('click', ev => {
  if (!ev.target.closest('[data-trip-switch]')) return;
  setTrip(state.trip === 'retour' ? 'enkel' : 'retour'); renderAll();
  if (CLOUD.kiwi && !state.scanning) scan({ onlyKiwi: true, initial: true });
});
$('#btnPerDest').addEventListener('click', () => { state.perDest = !state.perDest; store.set('perDest', state.perDest); renderDeals(); toast(state.perDest ? 'Je ziet de beste deal per bestemming.' : 'Je ziet alle deals los.', { ms: 2200 }); });
$('#btnLayout').addEventListener('click', () => { state.layout = state.layout === 'rows' ? 'cards' : 'rows'; store.set('layout', state.layout); renderDeals(); });
function emptyState() {
  const f = state.filters;
  const tips = [];
  if (activeFilterCount()) tips.push('<button class="btn" type="button" data-fix="filters">Wis filters</button>');
  if (state.dest !== 'overal') tips.push('<button class="btn ghost" type="button" data-fix="overal">Zoek overal</button>');
  if (!noLimit(f.maxPrice, PRICE_MAX)) tips.push(`<button class="btn ghost" type="button" data-fix="price">Verhoog maximumprijs naar ${eur(Math.min(PRICE_MAX, f.maxPrice * 2))}</button>`);
  if (state.when.mode !== 'flex') tips.push('<button class="btn ghost" type="button" data-fix="flex">Zet datum op flexibel</button>');
  setTimeout(() => {
    const box = $('#emptyState');
    box.onclick = ev => {
      const b = ev.target.closest('[data-fix]'); if (!b) return;
      const k = b.dataset.fix;
      if (k === 'filters') state.filters = defaultFilters();
      if (k === 'overal') { setDest('overal'); return; }
      if (k === 'price') state.filters.maxPrice = Math.min(PRICE_MAX, state.filters.maxPrice * 2);
      if (k === 'flex') { $('.seg [data-when="flex"]').click(); return; }
      syncFilterUI(); renderAll();
    };
  });
  return `<div class="empty"><svg class="big" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-radar"/></svg>
    <h3>Geen deals gevonden</h3>
    <p class="muted">De radar vond niets met deze keuzes in de gecontroleerde data${state.liveDeals.length ? ' en live bronnen' : ''}. Verruim je keuzes, of zoek live bij een aanbieder hieronder.</p>
    <div class="btns">${tips.join('')}</div></div>`;
}
function renderProviders() {
  const links = searchLinks();
  const dest = state.dest !== 'overal' ? DEST[state.dest].n : 'overal';
  $('#provHint').textContent = `Route: ${state.origin.n} → ${dest}. Opent hun zoekpagina; waar het kan met jouw route.`;
  $('#providers').innerHTML = links.map(l => `<a class="prov" href="${esc(l.url)}" target="_blank" rel="noopener"><span><span class="m">${MODES[l.mode].label}</span>${esc(l.name)}</span>${icon('i-ext', 'sm')}</a>`).join('');
}
function renderPasses() {
  const fit = p => {
    const w = p.who;
    if (state.profile === 'jongere12' && (p.id === 'ns-dal' || p.id === 'ns-ptd')) return true;
    if ((state.profile === 'jongere12' || state.profile === 'jongere27') && p.id === 'db-young') return true;
    if (state.profile === 'senior' && w.includes('65plus')) return true;
    if (state.profile === 'dal' && p.id === 'ns-dal') return true;
    if (state.travellers >= 2 && p.id === 'ns-groep') return true;
    if (state.travellers >= 6 && p.id === 'db-groep') return true;
    return false;
  };
  const items = PASSES.slice().sort((a, b) => fit(b) - fit(a));
  let html = items.map(p => `<article class="pass">
      <div class="who">${fit(p) ? '<span class="badge live">Past bij jou</span>' : ''}<span class="badge snapshot">Gecontroleerd</span></div>
      <h3>${esc(p.title)}</h3><div class="pp">${esc(p.price)}</div>
      <div class="small">${esc(p.sub)}</div><p class="small muted">${esc(p.body)}</p>
      <div class="src-line">Bron: ${p.src.map(k => `<a href="${SRC[k].url}" target="_blank" rel="noopener">${esc(SRC[k].name)}</a>`).join(', ')} · gecontroleerd ${esc(timeNL(p.checked))}</div>
      <a class="btn ghost sm" href="${esc(PROVIDERS[p.book].url({}))}" target="_blank" rel="noopener">Bekijk bij ${esc(PROVIDERS[p.book].name)} ${icon('i-ext', 'sm')}</a>
    </article>`).join('');
  if (state.profile === 'student') {
    html = `<article class="pass"><div class="who"><span class="badge live">Past bij jou</span></div><h3>Studentenreisproduct</h3><p class="small">Studeer je in het mbo, hbo of aan de universiteit? Dan reis je met je studentenreisproduct in Nederland gratis of met korting, afhankelijk van je keuze voor week of weekend. Combineer dat met een internationale deal.</p><p class="small muted">Algemene info, geen prijs. Kijk bij DUO en NS voor de regels.</p></article>` + html;
  }
  $('#passes').innerHTML = html;
  $('#tips').innerHTML = TIPS.map(t => `<article class="pass"><h3>${esc(t.title)}</h3><p class="small">${esc(t.body)}</p><div class="src-line">Bron: ${t.src.map(k => `<a href="${SRC[k].url}" target="_blank" rel="noopener">${esc(SRC[k].name)}</a>`).join(', ')}</div></article>`).join('')
    + `<article class="pass"><h3>Eindhoven Airport dicht in 2027</h3><p class="small">${esc(NOTICES.EIN.text)}</p><div class="src-line">Bron: <a href="${SRC.einClose.url}" target="_blank" rel="noopener">${esc(SRC.einClose.name)}</a>, <a href="${SRC.einAirport.url}" target="_blank" rel="noopener">${esc(SRC.einAirport.name)}</a></div></article>`
    + `<article class="pass"><h3>Maastricht in 2027</h3><p class="small">${esc(NOTICES.MST.text)}</p><div class="src-line">Bron: <a href="${SRC.mstHV.url}" target="_blank" rel="noopener">${esc(SRC.mstHV.name)}</a></div></article>`;
}
$('#dealGrid').addEventListener('click', ev => {
  const b = ev.target.closest('[data-act]'); if (!b) return;
  const id = b.closest('[data-id]').dataset.id, e = dealById(id); if (!e) return;
  const act = b.dataset.act;
  if (act === 'more') { setDest(e.to); $('#view-deals').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); return; }
  if (act === 'fav') { toggleFav(e); b.setAttribute('aria-pressed', String(isFav(e.id))); }
  if (act === 'alert') openAlertDialog(e);
  if (act === 'share') shareDeal(e);
  if (act === 'info') openDealDialog(e);
});
function bagInfo(e) {
  if (e.mode !== 'vliegtuig') return { text: 'Bagage zit bij de trein en bus in de prijs (binnen normale grenzen).', range: [0, 0] };
  const b = e.provider.includes('Transavia') ? BAGS.Transavia : BAGS._lowcost;
  return { text: `Handbagagekoffer: ca. ${eur(b.trolley[0])}–${eur(b.trolley[1])} extra per richting (${b.note}).`, range: b.trolley, src: b.src };
}
function openDealDialog(e, opts = {}) {
  const home = opts.home || state.origin;
  const dd = door(e, home), book = bookLink(e), al = airlineLink(e), bag = bagInfo(e);
  const srcs = srcsOf(e);
  const fac = e.co2f;
  const altLinks = e.mode === 'vliegtuig' ? ['google', 'sky'] : e.mode === 'bus' ? ['kombo', 'flixbus'] : ['trainline', 'nsi', 'db'];
  const ctx = linkCtx(e);
  $('#dlgDealTitle').textContent = `${e.o.n} → ${e.dest.n}`;
  $('#dlgDealBody').innerHTML = `
    <div class="deal-top"><span class="mode-tag" style="color:var(--m-${e.mode})">${icon(MODES[e.mode].icon)}${MODES[e.mode].label}</span><span class="provider">${esc(e.provider)}</span>${statusBadge(e)}</div>
    <div class="price-row"><div class="price">${e.priceType === 'vanaf' ? '<small>vanaf</small>' : ''}${eur(e.price)}</div><div class="price-note">${e.trip === 'retour' ? 'retour' : 'enkele reis'} per persoon${e.trip === 'retour' ? `<br>≈ ${eur(e.perDir)} per richting` : ''}${state.travellers > 1 ? `<br>${state.travellers} personen: <b>${eur(e.price * state.travellers)}</b>` : ''}</div></div>
    ${e.trip === 'enkel' && !e.out ? `<p class="calc-note">${icon('i-retour', 'sm')}<span>Heen en terug: reken op <b>2 × ${eur(e.price)} = ${eur(e.price * 2)}</b> per persoon. Dat is <b>berekend</b>, niet door de bron genoemd: de vanafprijs geldt niet op elke dag en in elke richting.</span></p>` : ''}
    ${e.indic ? `<p class="calc-note">${icon('i-info', 'sm')}<span><b>Indicatie:</b> Skyscanner schat deze prijs op basis van de laatste 4 dagen. Het is geen live prijs.</span></p>` : ''}
    ${e.note ? `<p>${esc(e.note)}</p>` : ''}
    ${e.parts ? `<div><b>Opbouw van de prijs</b><ul>${e.parts.map(p => `<li>${esc(p.label)}: ${eur(p.price)} (<a href="${SRC[p.src].url}" target="_blank" rel="noopener">${esc(SRC[p.src].name)}</a>)</li>`).join('')}</ul></div>` : ''}
    <dl class="kv">
      <dt>Vertrek</dt><dd>${esc(e.o.full || e.o.n)}</dd>
      <dt>Aankomst</dt><dd>${esc(e.dest.n)}, ${esc(e.dest.c)}${e.arr && ARR_AIRPORTS[e.arr] ? ` (vliegveld ${esc(ARR_AIRPORTS[e.arr].n)}, ${Math.round(km(ARR_AIRPORTS[e.arr], e.dest))} km van het centrum)` : ''}</dd>
      ${e.out ? `<dt>Heenreis</dt><dd>${esc(dateNL(e.out, { year: true }))}${e.depTime ? ', vertrek ' + esc(e.depTime) : ''}${e.flight ? ` (vlucht ${esc(e.flight)})` : ''}</dd>` : '<dt>Reisdata</dt><dd>Vrij te kiezen; de vanafprijs geldt niet op elke dag</dd>'}
      ${e.back ? `<dt>Terugreis</dt><dd>${esc(dateNL(e.back, { year: true }))}${e.backTime ? ', vertrek ' + esc(e.backTime) : ''}${e.backFlight ? ` (vlucht ${esc(e.backFlight)})` : ''}${e.backDur ? `, ${dur(e.backDur)}` : ''}${e.backFrom && e.backFrom !== e.arr ? ` · <b>vanaf ${esc(AIRPORT_NAMES[e.backFrom] || e.backFrom)} (${esc(e.backFrom)})</b>` : ''}${e.nights != null ? ` · ${nightsText(e.nights)}` : ''}</dd>` : ''}
      <dt>Reistijd</dt><dd>${dur(e.dur)} ${e.durEst ? `(geschat uit de afstand${e.transfers ? `, incl. ${e.transfers} overstap${e.transfers > 1 ? 'pen' : ''}` : ''}; de bron noemt geen reistijd)` : '(volgens de bron)'}</dd>
      <dt>Overstappen</dt><dd>${e.transfers == null ? 'Onbekend' : e.transfers === 0 ? 'Geen' : e.transfers}</dd>
      <dt>Bagage</dt><dd>${e.mode === 'vliegtuig' && e.bag === 'hand' ? 'Een handbagagekoffer zit in deze prijs.' : e.mode === 'vliegtuig' && e.bag === 'koffer' ? 'Ruimbagage (een koffer) zit in deze prijs.' : esc(bag.text)}${bag.src && e.bag !== 'hand' && e.bag !== 'koffer' ? ` <a href="${SRC[bag.src].url}" target="_blank" rel="noopener">Bron</a>` : ''}</dd>
      <dt>Reisdocument</dt><dd>${esc(docInfo(e.dest.cc))} <a href="${SRC.reisadvies.url}" target="_blank" rel="noopener">Controleer bij de overheid</a></dd>
      <dt>Afstand</dt><dd>${Math.round(e.routeKm)} km ${e.km ? '(volgens de bron)' : e.mode === 'vliegtuig' ? '(hemelsbreed + 8% omweg)' : '(hemelsbreed + 20%, schatting)'}</dd>
      <dt>CO2</dt><dd>${kg(e.co2One)} per persoon per richting = ${Math.round(e.routeKm)} km × ${String(fac.f).replace('.', ',')} kg/km (<a href="${SRC[fac.src].url}" target="_blank" rel="noopener">${esc(fac.label)}</a>)</dd>
    </dl>
    <div><b>Van deur tot deur vanaf ${esc(home.n)}: ca. ${dur(dd.total)}</b>
      <ul class="small">
        <li>Naar ${esc(e.o.n)}: ${dur(dd.access)} ${dd.a.live ? `(NS API${dd.a.eur != null ? ', ' + eur(dd.a.eur) : ''}${dd.a.busExtra ? ', + ca. 25 min bus' : ''})` : '(schatting op afstand; koppel de NS API voor echte tijden en prijzen)'}</li>
        <li>${e.mode === 'vliegtuig' ? 'Inchecken en beveiliging' : 'Op tijd aanwezig zijn'}: ${dur(dd.wait)} (aanname, aan te passen bij Instellingen)</li>
        <li>Reis: ${dur(e.dur)}</li>
        <li>Naar het centrum: ${dur(e.egress)} (aanname)</li>
      </ul></div>
    ${histChart(e)}
    ${CLOUD.kiwi && e.mode === 'vliegtuig' && e.out && e.o.iata && e.arr ? `<div class="cmp-box verify-box"><button class="btn sm" type="button" id="btnVerify">${icon('i-shield', 'sm')}Controleer de prijs nu (live)</button><div id="verifyOut" aria-live="polite"></div></div>` : ''}
    ${CLOUD.lastminute && e.mode === 'vliegtuig' && e.trip === 'enkel' && e.out && e.o.iata && e.arr ? `<div class="cmp-box"><button class="btn ghost sm" type="button" id="btnCmpLm">Vergelijk deze vlucht bij lastminute.com</button><div id="cmpLmOut" aria-live="polite"></div></div>` : ''}
    <div><b>Bronnen</b><ul class="small">${srcs.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a></li>`).join('')}</ul>
      <p class="small muted">${e.status === 'live' && e.srcLive ? `Opgehaald op ${esc(timeNL(e.checked))} uit de Aviasales-cache: deze prijs is door gebruikers gevonden in de 48 uur daarvoor, dus hij kan al anders zijn` : `${e.status === 'live' ? 'Live opgehaald' : 'Gecontroleerd'} op ${esc(timeNL(e.checked))}`}${e.srcDate ? `; de bron noemt prijzen van ${esc(dateNL(e.srcDate, { dow: false, year: true }))}` : ''}. Prijzen veranderen snel: controleer bij de aanbieder.</p></div>
    <div class="card-actions">
      <a class="btn" href="${esc(book.url)}" target="_blank" rel="noopener">Naar boeken bij ${esc(book.name)} ${icon('i-ext', 'sm')}</a>
      ${al ? `<a class="btn ghost" href="${esc(al.url)}" target="_blank" rel="noopener">${esc(al.name)} ${icon('i-ext', 'sm')}</a>` : ''}
      ${altLinks.map(k => `<a class="btn ghost sm" href="${esc(PROVIDERS[k].url(ctx))}" target="_blank" rel="noopener">Vergelijk bij ${esc(PROVIDERS[k].name)}</a>`).join('')}
    </div>`;
  openDialog('dlgDeal');
  const bv = $('#btnVerify');
  if (bv) bv.addEventListener('click', () => { bv.disabled = true; verifyDeal(e, $('#verifyOut')).finally(() => { bv.disabled = false; }); });
  const bl = $('#btnCmpLm');
  if (bl) bl.addEventListener('click', () => { bl.disabled = true; compareLastminute(e, $('#cmpLmOut')).finally(() => { bl.disabled = false; }); });
}

/* ---------- 13. Kaart ---------- */
const MAPV = { x: 0, y: 0, w: MAP.W, h: MAP.H };
let MAPMODE = 'eu'; // 'eu' = kaart van Europa, 'world' = wereldkaart
function drawMapBase() {
  const m = MAPMODE === 'world' ? MAP.world : MAP;
  $('#mapBase').innerHTML = `<rect x="-2000" y="-2000" width="5000" height="5000" fill="var(--sea)"/><path class="land" d="${m.land}"/>${MAPMODE === 'eu' ? `<path class="nl" d="${MAP.nl}"/>` : ''}<path class="borders" d="${m.borders}"/>`;
}
function setMapMode(mode) {
  MAPMODE = mode === 'world' ? 'world' : 'eu';
  $$('.map-seg [data-map]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.map === MAPMODE)));
  drawMapBase();
  Object.assign(MAPV, { x: 0, y: 0, w: MAP.W, h: MAP.H });
  applyView(); renderDestPanel();
}
function proj(lon, lat) {
  if (MAPMODE === 'world') { const rr = Math.PI / 180, w = MAP.world; return [w.translate[0] + w.scale * lon * rr, w.translate[1] - w.scale * w.k * lat * rr]; }
  const r = Math.PI / 180, l0 = 10 * r, p0 = 52 * r, l = lon * r, p = lat * r;
  const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l - l0);
  const k = Math.sqrt(2 / (1 + cosc));
  const x = k * Math.cos(p) * Math.sin(l - l0), y = k * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l - l0));
  return [MAP.translate[0] + MAP.scale * x, MAP.translate[1] - MAP.scale * y];
}
// Kleur per prijsklasse; bij retour zijn de grenzen twee keer zo hoog
const tierMul = () => (state.trip === 'retour' ? 2 : 1);
function tier(v) { const m = tierMul(); return v <= 30 * m ? 1 : v <= 60 * m ? 2 : v <= 120 * m ? 3 : 4; }
function renderMapLegend() {
  const m = tierMul(), lab = [`t/m €${30 * m}`, `€${30 * m + 1}–${60 * m}`, `€${60 * m + 1}–${120 * m}`, `meer dan €${120 * m}`];
  $('#mapLegend').innerHTML = lab.map((l, i) => `<span><i style="background:var(--tier${i + 1})"></i>${l}</span>`).join('') + `<span><i style="background:var(--line)"></i>geen deal met deze keuzes</span><span class="muted">Prijs = goedkoopste per persoon, ${tripWord()}. Een gecontroleerde deal gaat voor een indicatie.</span>`;
}
function initMap() {
  drawMapBase();
  $$('.map-seg [data-map]').forEach(b => b.addEventListener('click', () => setMapMode(b.dataset.map)));
  renderMapLegend();
  const svg = $('#mapSvg');
  const ptrs = new Map();
  let last = null, lastDist = null, moved = false;
  const toSvg = (cx, cy) => { const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
  svg.addEventListener('pointerdown', ev => {
    if (ev.target.closest('.mk')) return;
    svg.setPointerCapture(ev.pointerId); ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); moved = false;
    last = toSvg(ev.clientX, ev.clientY);
  });
  svg.addEventListener('pointermove', ev => {
    if (!ptrs.has(ev.pointerId)) return;
    ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (ptrs.size === 1) {
      const p = toSvg(ev.clientX, ev.clientY);
      MAPV.x -= p.x - last.x; MAPV.y -= p.y - last.y; moved = true; applyView();
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastDist) { const mid = toSvg((a.x + b.x) / 2, (a.y + b.y) / 2); zoomAt(lastDist / d, mid.x, mid.y); }
      lastDist = d; moved = true;
    }
  });
  const up = ev => { ptrs.delete(ev.pointerId); if (ptrs.size < 2) lastDist = null; if (ptrs.size === 1) { const p = [...ptrs.values()][0]; last = toSvg(p.x, p.y); } };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  svg.addEventListener('wheel', ev => { ev.preventDefault(); const p = toSvg(ev.clientX, ev.clientY); zoomAt(ev.deltaY > 0 ? 1.18 : 1 / 1.18, p.x, p.y); }, { passive: false });
  svg.addEventListener('keydown', ev => {
    const step = MAPV.w * 0.08;
    const k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[ev.key];
    if (k && ev.target === svg) { ev.preventDefault(); MAPV.x += k[0]; MAPV.y += k[1]; applyView(); }
    if ((ev.key === '+' || ev.key === '=') && ev.target === svg) { ev.preventDefault(); zoomAt(1 / 1.3); }
    if (ev.key === '-' && ev.target === svg) { ev.preventDefault(); zoomAt(1.3); }
    if (ev.key === 'Enter' || ev.key === ' ') { const g = ev.target.closest && ev.target.closest('.mk'); if (g) { ev.preventDefault(); selectMapDest(g.dataset.dest); } }
  });
  $('#mapMarkers').addEventListener('click', ev => { const g = ev.target.closest('.mk'); if (g && !moved) selectMapDest(g.dataset.dest); });
  $('#mapZoomIn').addEventListener('click', () => zoomAt(1 / 1.4));
  $('#mapZoomOut').addEventListener('click', () => zoomAt(1.4));
  $('#mapReset').addEventListener('click', () => { Object.assign(MAPV, { x: 0, y: 0, w: MAP.W, h: MAP.H }); applyView(); });
}
function zoomAt(f, cx, cy) {
  cx = cx ?? MAPV.x + MAPV.w / 2; cy = cy ?? MAPV.y + MAPV.h / 2;
  const nw = Math.min(MAP.W * 1.2, Math.max(MAP.W / 8, MAPV.w * f)), real = nw / MAPV.w;
  MAPV.x = cx - (cx - MAPV.x) * real; MAPV.y = cy - (cy - MAPV.y) * real;
  MAPV.w = nw; MAPV.h = MAPV.h * real; applyView();
}
function applyView() {
  MAPV.x = Math.max(-MAP.W * 0.2, Math.min(MAP.W - MAPV.w * 0.5, MAPV.x));
  MAPV.y = Math.max(-MAP.H * 0.2, Math.min(MAP.H - MAPV.h * 0.5, MAPV.y));
  $('#mapSvg').setAttribute('viewBox', `${MAPV.x.toFixed(1)} ${MAPV.y.toFixed(1)} ${MAPV.w.toFixed(1)} ${MAPV.h.toFixed(1)}`);
  renderMarkers();
}
function cheapestPerDest() {
  const { list } = filterDeals({ ignoreDest: true });
  const best = {};
  for (const x of list) { const b = best[x.e.to]; if (!b || (b.e.indic && !x.e.indic) || (!!b.e.indic === !!x.e.indic && x.tp.p < b.tp.p)) best[x.e.to] = x; }
  return best;
}
function renderMarkers() {
  const best = cheapestPerDest();
  const z = MAP.W / MAPV.w, s = 1 / z;
  const ranked = Object.values(best).sort((a, b) => a.tp.p - b.tp.p).map(x => x.e.to);
  renderMapLegend();
  $('#mapSub').textContent = `Goedkoopste prijs per bestemming, per persoon (${tripWord()}). Filters van het tabblad Deals gelden ook hier.`;
  const pos = Object.fromEntries(ranked.map(id => [id, proj(DEST[id].lon, DEST[id].lat)]));
  const [ox, oy] = proj(state.origin.lon, state.origin.lat);

  // Prijslabels zonder overlap plaatsen: goedkoopste eerst (de gekozen bestemming altijd eerst).
  // Eerst rechts van de stip proberen, dan links; past het nergens, dan alleen de stip (prijs staat in het paneel).
  const boxes = [], side = {}, widths = {};
  const R = 8 * s; // ruimte rond elke stip
  const dotHit = (b, self) => ranked.some(id => id !== self && pos[id][0] + R > b[0] && pos[id][0] - R < b[2] && pos[id][1] + R > b[1] && pos[id][1] - R < b[3])
    || (ox + R > b[0] && ox - R < b[2] && oy + R > b[1] && oy - R < b[3]);
  const boxHit = b => boxes.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  const order = state.mapSel && best[state.mapSel] ? [state.mapSel, ...ranked.filter(id => id !== state.mapSel)] : ranked;
  const cap = z > 1.7 ? Infinity : 24;
  let placed = 0;
  for (const id of order) {
    if (placed >= cap) break;
    const [x, y] = pos[id];
    const w = widths[id] = 12 + eur(best[id].tp.p).length * 7.4;
    const right = [x + 10 * s, y - 11 * s, x + (10 + w) * s, y + 11 * s];
    const left = [x - (10 + w) * s, y - 11 * s, x - 10 * s, y + 11 * s];
    for (const [k, b] of [['r', right], ['l', left]]) {
      if (!boxHit(b) && (!dotHit(b, id) || id === state.mapSel)) { side[id] = k; boxes.push(b); placed++; break; }
    }
  }

  let html = '';
  for (const d of Object.values(DEST)) {
    if (best[d.id]) continue;
    const [x, y] = proj(d.lon, d.lat);
    html += `<g class="mk" data-dest="${d.id}" tabindex="-1" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})"><circle class="dot" r="4" fill="var(--line)"/></g>`;
  }
  for (const id of ranked.slice().reverse()) {
    const x0 = best[id], d = DEST[id], [x, y] = pos[id], t = tier(x0.tp.p);
    const label = eur(x0.tp.p), w = widths[id] || 0, rx = side[id] === 'l' ? -(10 + w) : 10;
    const sel = state.mapSel === id ? ' sel' : '';
    html += `<g class="mk${sel}" data-dest="${id}" tabindex="0" role="button" aria-label="${esc(d.n)}: vanaf ${esc(label)} ${tripWord()}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})">
      <circle class="dot" r="7" fill="var(--tier${t})"/>
      ${side[id] ? `<rect class="lbl-bg" x="${rx.toFixed(0)}" y="-11" width="${w.toFixed(0)}" height="22" rx="6"/><text x="${(rx + 6).toFixed(0)}" y="4.5">${esc(label)}</text>` : `<title>${esc(d.n)}: ${esc(label)}</title>`}
    </g>`;
  }
  html += `<g class="origin-mk" transform="translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${s.toFixed(3)})" aria-hidden="true"><circle class="ring" r="8"/><circle r="5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/></g>`;
  $('#mapMarkers').innerHTML = html;
}
function selectMapDest(id) { state.mapSel = id; renderMarkers(); renderDestPanel(); const p = $('#destPanel'); if (window.innerWidth < 1100) p.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' }); }
function renderDestPanel() {
  const best = cheapestPerDest();
  const panel = $('#destPanel');
  if (!state.mapSel) {
    const ranked = Object.values(best).sort((a, b) => a.tp.p - b.tp.p);
    panel.innerHTML = `<h3>Goedkoopste bestemmingen</h3><p class="small muted">Vanaf ${esc(state.origin.n)}, ${tripWord()} per persoon. Klik op een bestemming of een stip op de kaart.</p>
      <ul class="dest-list">${ranked.map(x => `<li><button type="button" data-dest="${x.e.to}"><span>${esc(x.e.dest.n)} <span class="small muted">${MODES[x.e.mode].label.toLowerCase()}</span></span><span class="p">${eur(x.tp.p)}</span></button></li>`).join('') || '<li class="muted">Geen deals met deze filters.</li>'}</ul>`;
  } else {
    const d = DEST[state.mapSel];
    const deals = filterDeals({ ignoreDest: true }).list.filter(x => x.e.to === d.id).sort((a, b) => a.tp.p - b.tp.p);
    const c = { fromIata: nearestAirports(state.origin, 1)[0].iata, fromName: nearestStation(state.origin).n, dest: d };
    panel.innerHTML = `<div class="section-head" style="margin:0"><h3>${esc(d.n)}</h3><button type="button" class="linkish" data-back>Alle bestemmingen</button></div>
      <div class="small muted">${esc(d.c)} · ${d.t.map(t => TYPES[t]).join(', ')}</div>
      ${deals.length ? deals.slice(0, 6).map(x => `<div class="mini-deal">${icon(MODES[x.e.mode].icon)}<div><b>${eur(x.tp.p)}</b> ${x.tp.calc ? 'retour (2 × enkel)' : x.e.trip === 'retour' ? 'retour' : 'enkel'} · ${esc(x.e.provider)}<div class="tiny muted">${esc(x.e.o.n)}${x.e.out ? ' · ' + dateNL(x.e.out) : ''}</div></div><button class="btn ghost sm" type="button" data-open="${esc(x.e.id)}">Details</button></div>`).join('')
        : '<p class="small">Geen gecontroleerde deal met de huidige filters. Zoek live bij een aanbieder:</p>'}
      <div class="card-actions">
        ${deals.length ? `<button class="btn sm" type="button" data-all="${d.id}">Alle deals naar ${esc(d.n)}</button>` : ''}
        <a class="btn ghost sm" href="${esc(PROVIDERS.google.url(c))}" target="_blank" rel="noopener">Google Flights</a>
        <a class="btn ghost sm" href="${esc(PROVIDERS.sky.url(c))}" target="_blank" rel="noopener">Skyscanner</a>
        <a class="btn ghost sm" href="${esc(PROVIDERS.db.url(c))}" target="_blank" rel="noopener">Trein (DB)</a>
      </div>`;
  }
}
$('#destPanel').addEventListener('click', ev => {
  const t = ev.target.closest('button'); if (!t) return;
  if (t.dataset.dest) selectMapDest(t.dataset.dest);
  if (t.hasAttribute('data-back')) { state.mapSel = null; renderMarkers(); renderDestPanel(); }
  if (t.dataset.open) { const e = dealById(t.dataset.open); if (e) openDealDialog(e); }
  if (t.dataset.all) { setDest(t.dataset.all); goTab('deals'); }
});

/* ---------- 14. Kalender ---------- */
function initCalendar() {
  const from = $('#calFrom'), to = $('#calTo'), month = $('#calMonth');
  from.innerHTML = Object.entries(NL_AIR).map(([c, a]) => `<option value="${c}">${esc(a.n)} (${c})</option>`).join('');
  from.value = nearestAirports(state.origin, 1)[0].iata;
  to.innerHTML = `<option value="alle">Alle bestemmingen (goedkoopste per dag)</option>` + Object.values(DEST).filter(d => d.iata).sort((a, b) => a.n.localeCompare(b.n, 'nl')).map(d => `<option value="${d.id}">${esc(d.n)}</option>`).join('');
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    month.insertAdjacentHTML('beforeend', `<option value="${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}">${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}</option>`);
  }
  // Begin met de eerste maand waarin het gekozen vliegveld gecontroleerde deals heeft
  const firstWithData = [...month.options].find(o => SNAP.some(e => e.from === from.value && e.out && e.out.startsWith(o.value)));
  if (firstWithData) month.value = firstWithData.value;
  $('#calShow').addEventListener('click', renderCalendar);
  $('#calWeekend').addEventListener('click', runWeekend);
  [from, to, month].forEach(el => el.addEventListener('change', renderCalendar));
}
let calToken = 0;
async function renderCalendar() {
  const from = $('#calFrom').value, to = $('#calTo').value, month = $('#calMonth').value;
  const my = ++calToken;
  const wrap = $('#calWrap'), notice = $('#calNotice');
  let data = {}, mode = 'snapshot', err = null;
  const snapForDay = {};
  for (const e of allDeals()) {
    if (e.from !== from || !e.out || !e.out.startsWith(month) || e.out < todayISO()) continue;
    if (to !== 'alle' && e.to !== to) continue;
    if (e.who === 'jongeren' && !isYouth()) continue;
    if (!snapForDay[e.out] || e.perDir < snapForDay[e.out].perDir) snapForDay[e.out] = e;
  }
  Object.entries(snapForDay).forEach(([d, e]) => { data[d] = { price: e.perDir, deal: e, status: e.status }; });
  if (to !== 'alle' && settings.tpToken) {
    wrap.innerHTML = '<div class="skeleton" style="height:320px" aria-label="Kalender laden"></div>';
    try {
      const live = await tpCalendar(from, DEST[to].iata, month);
      if (my !== calToken) return;
      Object.entries(live).forEach(([d, v]) => { if (!data[d] || v.price < data[d].price) data[d] = { price: v.price, status: 'live', airline: v.airline }; });
      mode = 'live';
    } catch (e2) { err = e2; }
  } else if (to !== 'alle' && settings.showDemo) {
    data = {}; Object.entries(demoCalendar(from, to, month)).forEach(([d, v]) => { data[d] = { price: v.price, status: 'demo' }; });
    mode = 'demo';
  }
  if (my !== calToken) return;
  const kc = to !== 'alle' ? KCAL.get(`${from}|${to}|${month}`) : null;
  if (kc && mode !== 'demo') {
    Object.entries(kc).forEach(([d, v]) => { if (!data[d] || v.price < data[d].price) data[d] = { price: v.price, status: 'live', airline: v.airline }; });
    if (mode === 'snapshot') mode = 'kiwi';
  }
  const dname = to === 'alle' ? 'alle bestemmingen' : DEST[to].n;
  const routeCtx = { fromIata: from, dest: to === 'alle' ? null : DEST[to] };
  const nLive = Object.values(data).filter(v => v.status === 'live').length;
  let nt = '';
  if (mode === 'demo') nt = `<div class="notice">${icon('i-info')}<div><b>DEMO:</b> dit zijn verzonnen voorbeeldprijzen om de kalender te laten zien. Gebruik ze niet om te boeken. <button class="linkish" type="button" data-cal="nodemo">Demo uitzetten</button></div></div>`;
  else if (err) nt = `<div class="notice">${icon('i-info')}<div>Live kalender lukte niet: ${esc(explainError(err))}</div></div>`;
  else if (mode === 'kiwi') nt = `<div class="notice info">${icon('i-info')}<div><b>Live via Kiwi.com:</b> de goedkoopste gevonden enkele vlucht op ${nLive} dag${nLive === 1 ? '' : 'en'}. Een dag zonder prijs zat niet bij de zoekresultaten; dat betekent niet dat er geen vlucht is. Controleer altijd bij de aanbieder.</div></div>`;
  else if (mode === 'live') nt = `<div class="notice info">${icon('i-info')}<div><b>Live:</b> ${nLive} dagen met prijzen uit de Travelpayouts-cache (gevonden in de laatste dagen). Controleer altijd bij de aanbieder.</div></div>`;
  else if (to !== 'alle') nt = `<div class="notice info">${icon('i-info')}<div><b>Geen prijs per dag zonder live koppeling.</b> Je ziet alleen gecontroleerde data. Opties:
      <div class="card-actions" style="margin-top:8px">${CLOUD.kiwi ? `<button class="btn sm" type="button" data-cal="kiwi">${icon('i-radar', 'sm')}Zoek prijzen per dag (live via Kiwi.com)</button>` : '<button class="btn sm" type="button" data-cal="settings">Koppel vluchtprijzen (gratis)</button>'}
      <a class="btn ghost sm" href="${esc(PROVIDERS.google.url(routeCtx))}" target="_blank" rel="noopener">Google Flights</a>
      <a class="btn ghost sm" href="${esc(PROVIDERS.sky.url(routeCtx))}" target="_blank" rel="noopener">Skyscanner (hele maand)</a>
      <button class="btn ghost sm" type="button" data-cal="demo">Toon demo (geen echte prijzen)</button></div></div></div>`;
  else nt = `<div class="notice info">${icon('i-info')}<div>Je ziet per dag de goedkoopste <b>gecontroleerde</b> vlucht vanaf ${esc(NL_AIR[from].n)} naar ${esc(dname)}. Kies een bestemming voor een volle prijskalender (met live koppeling).</div></div>`;
  notice.innerHTML = nt;
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1), days = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const prices = Object.values(data).map(v => v.price);
  const min = prices.length ? Math.min(...prices) : null, max = prices.length ? Math.max(...prices) : null;
  const shade = p => { if (min == null || max === min) return 'var(--radar-soft)'; const t = (p - min) / (max - min); return `color-mix(in srgb, var(--tier${t < 0.25 ? 1 : t < 0.5 ? 2 : t < 0.75 ? 3 : 4}) ${Math.round(18 + (1 - t) * 10)}%, var(--surface))`; };
  let cells = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'].map(d => `<div class="cal-dow" aria-hidden="true">${d}</div>`).join('');
  for (let i = 0; i < lead; i++) cells += '<div class="cal-day empty" aria-hidden="true"></div>';
  const today = todayISO();
  for (let d = 1; d <= days; d++) {
    const iso = `${month}-${String(d).padStart(2, '0')}`, v = data[iso], g = new Date(iso + 'T12:00:00').getDay();
    const cls = ['cal-day', iso < today ? 'past' : '', g === 5 || g === 6 || g === 0 ? 'weekend' : '', v && v.price === min ? 'best' : '', v && v.status === 'snapshot' ? 'snap' : ''].filter(Boolean).join(' ');
    const tag = v ? (v.status === 'demo' ? 'demo' : v.status === 'live' ? 'live' : (to === 'alle' && v.deal ? v.deal.dest.n.split(' ')[0] : 'gecontr.')) : '';
    const aria = `${DOW[g]} ${d} ${MONTHS_LONG[m - 1]}: ${v ? `${v.status === 'demo' ? 'demo-prijs ' : 'vanaf '}${eur(v.price)}${v.deal ? ' naar ' + v.deal.dest.n : ''}${v.price === min ? ', goedkoopste dag' : ''}` : 'geen prijs'}`;
    cells += `<div class="${cls}" ${v ? `style="background:${v.status === 'snapshot' ? 'var(--radar-soft)' : shade(v.price)}"` : ''} role="${v && v.deal ? 'button' : 'gridcell'}" ${v && v.deal ? `tabindex="0" data-deal="${esc(v.deal.id)}"` : ''} aria-label="${esc(aria)}"><span class="d">${d}</span>${v ? `<span class="p">${v.status === 'demo' ? '<span class="sr-only">demo </span>' : ''}${eur(v.price)}</span><span class="tag">${esc(tag)}</span>` : ''}</div>`;
  }
  const bestDay = Object.entries(data).sort((a, b) => a[1].price - b[1].price)[0];
  wrap.innerHTML = `<div class="cal-head"><h3>${MONTHS_LONG[m - 1]} ${y} · ${esc(NL_AIR[from].n)} → ${esc(dname)}</h3>
    ${bestDay ? `<span class="small"><b>Goedkoopste dag:</b> ${dateNL(bestDay[0])}, ${bestDay[1].status === 'demo' ? 'demo-prijs ' : 'vanaf '}${eur(bestDay[1].price)}${bestDay[1].deal ? ' naar ' + esc(bestDay[1].deal.dest.n) : ''}</span>` : '<span class="small muted">Geen prijzen in deze maand.</span>'}</div>
    <div class="cal-grid" role="grid" aria-label="Prijskalender">${cells}</div>
    <div class="cal-legend"><span><i style="background:var(--radar-soft)"></i>gecontroleerde deal (per richting)</span>${mode !== 'snapshot' ? `<span><i style="background:color-mix(in srgb, var(--tier1) 28%, var(--surface))"></i>goedkoper</span><span><i style="background:color-mix(in srgb, var(--tier4) 18%, var(--surface))"></i>duurder</span>` : ''}<span><i style="outline:3px solid var(--accent);outline-offset:-2px;background:transparent"></i>goedkoopste dag</span></div>
    ${mode === 'demo' ? '<div class="demo-mark" aria-hidden="true"><span>DEMO</span></div>' : ''}`;
}
$('#calWrap').addEventListener('click', ev => { const c = ev.target.closest('[data-deal]'); if (c) { const e = dealById(c.dataset.deal); if (e) openDealDialog(e); } });
$('#calWrap').addEventListener('keydown', ev => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.dataset.deal) { ev.preventDefault(); const e = dealById(ev.target.dataset.deal); if (e) openDealDialog(e); } });
$('#calNotice').addEventListener('click', ev => {
  const b = ev.target.closest('[data-cal]'); if (!b) return;
  if (b.dataset.cal === 'settings') openSettings();
  if (b.dataset.cal === 'kiwi') {
    b.disabled = true; b.textContent = 'Zoeken bij Kiwi.com…';
    kiwiCalendar($('#calFrom').value, $('#calTo').value, $('#calMonth').value)
      .then(r => { if (!Object.keys(r).length) toast('Kiwi.com vond in deze maand geen vluchten op deze route.'); renderCalendar(); })
      .catch(err => { toast(mcpErrorText(err, KIWI)); renderCalendar(); });
  }
  if (b.dataset.cal === 'demo') { settings.showDemo = true; saveSettings(); renderCalendar(); }
  if (b.dataset.cal === 'nodemo') { settings.showDemo = false; saveSettings(); renderCalendar(); }
});
async function runWeekend() {
  const out = $('#weekendOut');
  const to = $('#calTo').value, from = $('#calFrom').value, month = $('#calMonth').value;
  const rows = [];
  // 1) Gecontroleerde deals die op vrijdag of zaterdag vertrekken (en binnen 4 dagen terug zijn)
  for (const e of allDeals()) {
    if (e.out && e.out < todayISO()) continue;
    if (e.who === 'jongeren' && !isYouth()) continue;
    if (to !== 'alle' && e.to !== to) continue;
    if (e.out) {
      if (!isWeekendStart(e.out)) continue;
      if (e.back && (new Date(e.back) - new Date(e.out)) / 86400000 > 4) continue;
      rows.push({ e, when: `${dateNL(e.out)}${e.back ? ' – ' + dateNL(e.back) : ' (enkele reis)'}`, kind: e.status });
    } else if (e.dur <= 7 * 60) {
      rows.push({ e, when: 'Kies zelf een vrijdag of zaterdag (vanafprijs niet op elke dag)', kind: 'flex' });
    }
  }
  rows.sort((a, b) => a.e.perDir - b.e.perDir);
  let html = `<div class="section-head" style="margin-top:18px"><h3>Goedkoopste weekend${to !== 'alle' ? ' naar ' + esc(DEST[to].n) : ''}</h3><span class="small muted">Vertrek op vrijdag of zaterdag, binnen 4 dagen terug.</span></div>`;
  // 2) Live of demo: combinaties heen (vr/za) + terug (zo/ma) voor één route
  if (to !== 'alle' && (settings.tpToken || settings.showDemo)) {
    const isDemo = !settings.tpToken;
    try {
      const outP = isDemo ? demoCalendar(from, to, month) : await tpCalendar(from, DEST[to].iata, month);
      const backP = isDemo ? demoCalendar(from, to + '-terug', month) : await tpCalendar(DEST[to].iata, from, month);
      const combos = [];
      for (const [d, v] of Object.entries(outP)) {
        if (!isWeekendStart(d) || d < todayISO()) continue;
        for (const add of [1, 2, 3]) {
          const b = addDays(d, add), g = new Date(b + 'T12:00:00').getDay();
          if ((g === 0 || g === 1) && backP[b]) combos.push({ d, b, total: v.price + backP[b].price });
        }
      }
      combos.sort((a, b) => a.total - b.total);
      html += combos.length ? `<ul class="weekend-list">${combos.slice(0, 5).map(c => `<li><span>${isDemo ? '<span class="badge demo">Demo</span> ' : '<span class="badge live">Live</span> '}${dateNL(c.d)} → ${dateNL(c.b)}</span><b>${isDemo ? 'demo ' : ''}${eur(c.total)} retour</b></li>`).join('')}</ul>${isDemo ? '<p class="small muted">Demo-prijzen zijn verzonnen en alleen bedoeld om de functie te tonen.</p>' : ''}`
        : '<p class="small muted">Geen weekendcombinatie gevonden in deze maand.</p>';
    } catch (err) { html += `<p class="small">Live weekendprijzen lukten niet: ${esc(explainError(err))}</p>`; }
  }
  html += rows.length ? `<ul class="weekend-list">${rows.slice(0, 10).map(r => `<li><span><span class="badge ${r.kind === 'live' ? 'live' : 'snapshot'}">${r.kind === 'live' ? 'Live' : 'Gecontroleerd'}</span> <b>${esc(r.e.dest.n)}</b> · ${MODES[r.e.mode].label.toLowerCase()} · ${esc(r.e.provider)}<br><span class="small muted">${esc(r.e.o.n)} · ${esc(r.when)}</span></span><span><b>${r.e.priceType === 'vanaf' ? 'vanaf ' : ''}${eur(r.e.price)}</b> <span class="small muted">${r.e.trip === 'retour' ? 'retour' : 'enkel'}</span> <button class="btn ghost sm" type="button" data-open="${esc(r.e.id)}">Details</button></span></li>`).join('')}</ul>`
    : '<p class="small">Geen weekendgeschikte gecontroleerde deals gevonden.</p>';
  out.innerHTML = html;
  announce('Goedkoopste weekend berekend.');
  out.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
}
$('#weekendOut').addEventListener('click', ev => { const b = ev.target.closest('[data-open]'); if (b) { const e = dealById(b.dataset.open); if (e) openDealDialog(e); } });

/* ---------- 15. Vergelijken ---------- */
function compareDests() {
  const by = {};
  for (const e of allDeals()) {
    if (e.out && e.out < todayISO()) continue;
    if (e.mode === 'combi') continue;
    (by[e.to] = by[e.to] || new Set()).add(e.mode);
  }
  return Object.entries(by).filter(([, s]) => s.size >= 2).map(([id]) => DEST[id]).sort((a, b) => a.n.localeCompare(b.n, 'nl'));
}
function initCompare() {
  const sel = $('#cmpDest');
  sel.innerHTML = compareDests().map(d => `<option value="${d.id}">${esc(d.n)}</option>`).join('');
  if ([...sel.options].some(o => o.value === 'parijs')) sel.value = 'parijs';
  sel.addEventListener('change', renderCompare);
  $('#cmpBag').addEventListener('change', renderCompare);
}
function renderCompare() {
  const id = $('#cmpDest').value; if (!id) return;
  const bagOpt = $('#cmpBag').value, n = state.travellers;
  $('#cmpOrigin').textContent = state.origin.n;
  const cols = [];
  for (const mode of ['trein', 'vliegtuig', 'bus']) {
    const cands = allDeals().filter(e => e.to === id && e.mode === mode && !(e.out && e.out < todayISO()) && !(e.who === 'jongeren' && !isYouth()));
    if (!cands.length) { cols.push({ mode, none: true }); continue; }
    const e = cands.sort((a, b) => a.perDir - b.perDir)[0], dd = door(e);
    let bag = 0, bagTxt = 'inbegrepen', bagUnknown = false, bagRange = null;
    if (mode === 'vliegtuig' && bagOpt !== 'tasje') {
      const b = e.provider.includes('Transavia') ? BAGS.Transavia : BAGS._lowcost;
      if (bagOpt === 'trolley') { bag = b.trolley[0]; bagRange = b.trolley; bagTxt = `${eur(b.trolley[0])}–${eur(b.trolley[1])}`; }
      else if (b.hold15) { bag = b.hold15[0]; bagRange = b.hold15; bagTxt = `${eur(b.hold15[0])}–${eur(b.hold15[1])}`; }
      else { bagUnknown = true; bagTxt = 'check bij aanbieder'; }
    } else if (mode === 'vliegtuig') bagTxt = 'klein tasje gratis';
    const accEur = dd.a.eur;
    const unknown = [];
    if (accEur == null) unknown.push('reis naar vertrekpunt');
    if (bagUnknown) unknown.push('bagage');
    if (mode === 'vliegtuig') unknown.push('vervoer vliegveld–centrum');
    const total = (e.perDir + bag + (accEur || 0)) * n;
    cols.push({ mode, e, dd, bag, bagTxt, bagRange, accEur, unknown, total, co2: e.co2One * n });
  }
  const real = cols.filter(c => !c.none);
  const minP = Math.min(...real.map(c => c.total)), minT = Math.min(...real.map(c => c.dd.total)), minC = Math.min(...real.map(c => c.co2));
  const maxP = Math.max(...real.map(c => c.total)), maxT = Math.max(...real.map(c => c.dd.total)), maxC = Math.max(...real.map(c => c.co2));
  const bar = (label, v, max, txt) => `<div class="bar"><span>${label}</span><span class="track"><span class="fill" style="width:${max ? Math.max(4, v / max * 100) : 0}%"></span></span><b>${txt}</b></div>`;
  $('#cmpGrid').innerHTML = cols.map(c => {
    if (c.none) {
      const ctx = { fromIata: nearestAirports(state.origin, 1)[0].iata, fromName: nearestStation(state.origin).n, dest: DEST[id] };
      const k = c.mode === 'vliegtuig' ? 'google' : c.mode === 'bus' ? 'kombo' : 'db';
      return `<article class="cmp" data-mode="${c.mode}"><h3>${icon(MODES[c.mode].icon)}${MODES[c.mode].label}</h3><p class="small">Geen gecontroleerde ${MODES[c.mode].label.toLowerCase()}-deal naar ${esc(DEST[id].n)}.</p><a class="btn ghost sm" href="${esc(PROVIDERS[k].url(ctx))}" target="_blank" rel="noopener">Zoek bij ${esc(PROVIDERS[k].name)} ${icon('i-ext', 'sm')}</a></article>`;
    }
    const w = [];
    if (c.total === minP) w.push('Goedkoopst');
    if (c.dd.total === minT) w.push('Snelst');
    if (c.co2 === minC) w.push('Groenst');
    const tl = c.dd.total;
    const seg = (cls, v, t) => `<span class="${cls}" style="width:${(v / tl * 100).toFixed(1)}%" title="${t}: ${dur(v)}"></span>`;
    return `<article class="cmp" data-mode="${c.mode}">
      <h3>${icon(MODES[c.mode].icon)}${MODES[c.mode].label}</h3>
      <div class="winners">${w.map(x => `<span class="win">${x}</span>`).join('')}</div>
      <div class="small">${esc(c.e.provider)} · ${esc(c.e.o.n)} → ${esc(c.e.dest.n)}${c.e.out ? ' · ' + dateNL(c.e.out) : ''}</div>
      <div><span class="total">${eur(c.total)}</span> <span class="small muted">${n > 1 ? `${n} personen, ` : ''}per richting${c.unknown.length ? ' + kosten met een ?' : ''}</span></div>
      <div class="timeline" role="img" aria-label="Tijdlijn: ${dur(c.dd.access)} naar vertrekpunt, ${dur(c.dd.wait)} wachten, ${dur(c.dd.travel)} reizen, ${dur(c.dd.egress)} naar centrum">${seg('a', c.dd.access, 'Naar vertrekpunt')}${seg('w', c.dd.wait, 'Wachten')}${seg('t', c.dd.travel, 'Reis')}${seg('e', c.dd.egress, 'Naar centrum')}</div>
      <table><tbody>
        <tr><td>Ticket (p.p., per richting)${c.e.trip === 'retour' ? `<br><span class="tiny muted">retour ${eur(c.e.price)} ÷ 2</span>` : ''}</td><td>${c.e.priceType === 'vanaf' ? 'vanaf ' : ''}${eur(c.e.perDir)}</td></tr>
        <tr><td>Bagage (${esc({ tasje: 'klein tasje', trolley: 'trolley', ruim: 'ruimbagage' }[bagOpt])})</td><td>${esc(c.bagTxt)}</td></tr>
        <tr><td>Naar ${esc(c.e.o.n)} (${dur(c.dd.access)}${c.dd.a.est ? ', geschat' : ''})</td><td>${c.accEur != null ? eur(c.accEur) : '?'}</td></tr>
        <tr><td>${c.mode === 'vliegtuig' ? 'Inchecken en beveiliging' : 'Op tijd aanwezig'}</td><td>${dur(c.dd.wait)}</td></tr>
        <tr><td>Reistijd${c.e.durEst ? ` (geschat${c.e.transfers ? ', incl. overstap' : ''})` : ''}</td><td>${dur(c.e.dur)}</td></tr>
        <tr><td>Naar het centrum (aanname)</td><td>${dur(c.dd.egress)}</td></tr>
        <tr class="sum"><td>Deur tot deur</td><td>ca. ${dur(c.dd.total)}</td></tr>
      </tbody></table>
      <div class="bars">
        ${bar('Prijs', c.total, maxP, eur(c.total))}
        ${bar('Tijd', c.dd.total, maxT, dur(c.dd.total))}
        ${bar('CO2', c.co2, maxC, kg(c.co2))}
      </div>
      ${c.unknown.length ? `<p class="tiny muted">Niet in de prijs: ${esc(c.unknown.join(', '))}.</p>` : ''}
      <div class="card-actions"><a class="btn sm" href="${esc(bookLink(c.e).url)}" target="_blank" rel="noopener">Naar boeken ${icon('i-ext', 'sm')}</a><button class="btn ghost sm" type="button" data-open="${esc(c.e.id)}">Details</button></div>
    </article>`;
  }).join('');
  $('#cmpHowBody').innerHTML = `<ul class="small">
    <li><b>Ticket:</b> de goedkoopste gecontroleerde of live deal per vervoermiddel. Retourprijzen delen we door 2 om eerlijk te vergelijken.</li>
    <li><b>Naar het vertrekpunt:</b> met de NS API echte reistijd en prijs vanaf jouw station; anders een schatting: 15 minuten plus de afstand bij ca. 65 km/u. Voor Eindhoven, Rotterdam, Maastricht en Groningen Airport rekenen we 25 minuten bus extra.</li>
    <li><b>Wachten:</b> Schiphol ${dur(settings.checkinAMS)}, andere vliegvelden ${dur(settings.checkinRegional)}, trein 10 min, bus 15 min. Dit zijn aannames; pas ze aan bij Instellingen.</li>
    <li><b>Naar het centrum:</b> vliegtuig 30 min uitstappen en bagage plus ${dur(settings.transferCity)} (of meer bij een ver vliegveld zoals Beauvais of Stansted); trein 15 min; bus 20 min.</li>
    <li><b>Bagage:</b> Transavia handbagagekoffer ${eur(BAGS.Transavia.trolley[0])}–${eur(BAGS.Transavia.trolley[1])} (<a href="${SRC.bagHV.url}" target="_blank" rel="noopener">bron</a>); andere prijsvechters ongeveer ${eur(BAGS._lowcost.trolley[0])}–${eur(BAGS._lowcost.trolley[1])} (<a href="${SRC.bagTA.url}" target="_blank" rel="noopener">bron</a>). We rekenen met het laagste bedrag.</li>
    <li><b>CO2 per persoon per richting:</b> trein ${String(CO2.trein.f).replace('.', ',')} kg/km (<a href="${SRC.co2Train.url}" target="_blank" rel="noopener">bron</a>), bus ${String(CO2.bus.f).replace('.', ',')} kg/km (<a href="${SRC.co2Coach.url}" target="_blank" rel="noopener">bron</a>), vlucht onder 700 km ${String(CO2.vliegKort.f).replace('.', ',')} (<a href="${SRC.co2Short.url}" target="_blank" rel="noopener">bron</a>), langer ${String(CO2.vlieg.f).replace('.', ',')} kg/km (<a href="${SRC.co2Flight.url}" target="_blank" rel="noopener">bron</a>). Vliegafstand = hemelsbreed + 8% (<a href="${SRC.uplift.url}" target="_blank" rel="noopener">bron</a>); trein en bus = hemelsbreed + 20% als de bron geen afstand noemt.</li>
  </ul>`;
}
$('#cmpGrid').addEventListener('click', ev => { const b = ev.target.closest('[data-open]'); if (b) { const e = dealById(b.dataset.open); if (e) openDealDialog(e); } });

/* ---------- 16. Bewaard ---------- */
/* ---------- Samen reizen: meerdere vertrekpunten, één bestemming ---------- */
const GROUP_MAX = 4;
function saveGroup() { store.set('group', state.group); }
function initGroup() {
  const saved = store.get('group', null);
  state.group = Array.isArray(saved) && saved.length >= 2 ? saved : [{ name: 'Ik', place: { ...state.origin } }, { name: '', place: null }];
  state.groupSort = store.get('groupSort', 'prijs');
  $('#groupSort').value = state.groupSort;
  $('#groupSort').addEventListener('change', ev => { state.groupSort = ev.target.value; store.set('groupSort', state.groupSort); renderGroup(); });
  $('#btnAddPerson').addEventListener('click', () => {
    if (state.group.length >= GROUP_MAX) return;
    state.group.push({ name: '', place: null }); saveGroup(); renderPeople(); renderGroup();
    $('#pPlace' + (state.group.length - 1)).focus();
  });
  $('#people').addEventListener('click', ev => {
    const b = ev.target.closest('[data-remove]'); if (!b) return;
    state.group.splice(+b.dataset.remove, 1); saveGroup(); renderPeople(); renderGroup();
  });
  $('#groupResults').addEventListener('click', ev => {
    const b = ev.target.closest('[data-open]'); if (!b) return;
    const e = dealById(b.dataset.open), p = state.group[+b.dataset.who];
    if (e) openDealDialog(e, { home: p && p.place ? p.place : state.origin });
  });
  renderPeople();
}
function personLabel(p, i) { return p.name || `Persoon ${i + 1}`; }
function renderPeople() {
  $('#people').innerHTML = state.group.map((p, i) => `
    <li class="person">
      <span class="avatar" aria-hidden="true">${esc((p.name || String(i + 1)).slice(0, 1).toUpperCase())}</span>
      <div class="field"><label for="pName${i}">Naam</label><input class="input" id="pName${i}" value="${esc(p.name)}" placeholder="Persoon ${i + 1}" autocomplete="off" maxlength="20"></div>
      <div class="field grow"><label for="pPlace${i}">Vertrekt vanaf</label>
        <input class="input" id="pPlace${i}" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="pSug${i}" value="${esc(p.place ? p.place.n : '')}" placeholder="Station, vliegveld of adres" autocomplete="off">
        <ul class="suggest" id="pSug${i}" role="listbox" aria-label="Suggesties" hidden></ul></div>
      ${state.group.length > 2 ? `<button class="icon-btn" type="button" data-remove="${i}" aria-label="Verwijder ${esc(personLabel(p, i))}">${icon('i-close')}</button>` : '<span class="icon-spacer" aria-hidden="true"></span>'}
    </li>`).join('');
  state.group.forEach((p, i) => {
    const inp = $('#pPlace' + i);
    combobox(inp, $('#pSug' + i), placeItems, place => {
      state.group[i].place = { n: place.n, lat: place.lat, lon: place.lon, kind: place.kind, uic: place.uic, iata: place.iata };
      inp.value = place.n; saveGroup(); renderGroup();
      if (settings.nsKey) scanNS(state.group[i].place).then(renderGroup);
    }, placeItem);
    $('#pName' + i).addEventListener('input', debounce(ev => { state.group[i].name = ev.target.value.trim(); saveGroup(); renderGroup(); }, 250));
  });
  $('#btnAddPerson').disabled = state.group.length >= GROUP_MAX;
}
// Per persoon de beste optie per bestemming; daarna per bestemming de groep beoordelen
function groupResults() {
  const people = state.group.map((p, i) => ({ ...p, i })).filter(p => p.place);
  if (people.length < 2) return { people, rows: [], need: true };
  const sortKey = state.groupSort;
  // Per persoon: de beste mix van prijs en reistijd (incl. de reis naar het vertrekpunt),
  // zodat niemand twee uur omreist voor een paar euro. Bij "kortste reis" telt alleen de tijd.
  const better = (x, y) => sortKey === 'snel' ? x.dd.total - y.dd.total || x.tp.p - y.tp.p : x.s - y.s;
  const perDest = new Map();
  people.forEach((p, pi) => {
    for (const x of filterDeals({ ignoreDest: true, home: p.place }).list) {
      if (!perDest.has(x.e.to)) perDest.set(x.e.to, Array(people.length).fill(null));
      const arr = perDest.get(x.e.to);
      if (!arr[pi] || better(x, arr[pi]) < 0) arr[pi] = x;
    }
  });
  const rows = [];
  for (const [id, arr] of perDest) {
    if (arr.some(a => !a)) continue; // iedereen moet er kunnen komen
    const prices = arr.map(a => a.tp.p);
    rows.push({ id, dest: DEST[id], arr,
      total: prices.reduce((s, v) => s + v, 0),
      spread: Math.max(...prices) - Math.min(...prices),
      maxT: Math.max(...arr.map(a => a.dd.total)),
      sc: arr.reduce((s, a) => s + a.s, 0) });
  }
  const cmp = {
    prijs: (a, b) => a.total - b.total || a.maxT - b.maxT,
    eerlijk: (a, b) => a.spread - b.spread || a.total - b.total,
    snel: (a, b) => a.maxT - b.maxT || a.total - b.total,
    score: (a, b) => a.sc - b.sc,
  }[sortKey] || ((a, b) => a.total - b.total);
  return { people, rows: rows.sort(cmp) };
}
function renderGroup() {
  if (!state.group) return;
  const box = $('#groupResults');
  const g = groupResults();
  if (g.need) {
    box.innerHTML = `<div class="empty">${icon('i-group')}<h3>Vul minstens twee vertrekpunten in</h3><p>Bijvoorbeeld jouw station en dat van een vriend. Dan zoek ik bestemmingen waar jullie allebei goedkoop naartoe kunnen.</p></div>`;
    return;
  }
  if (!g.rows.length) {
    box.innerHTML = `<div class="empty">${icon('i-group')}<h3>Geen bestemming voor iedereen</h3><p>Met deze filters is er geen bestemming waar iedereen naartoe kan. Zet een filter uit op het tabblad Deals of kies "Overal".</p></div>`;
    return;
  }
  const best = g.rows[0];
  box.innerHTML = `<p class="small muted group-sum">${g.rows.length} bestemmingen waar iedereen naartoe kan. ${esc(best.dest.n)} is het beste volgens "${esc($('#groupSort').selectedOptions[0].textContent)}".</p>` +
    g.rows.slice(0, 12).map((r, k) => groupCard(r, g.people, k)).join('');
}
function groupCard(r, people, k) {
  // Wie kan samen dezelfde trein, bus of vlucht nemen?
  const byDeal = {};
  r.arr.forEach((a, i) => { (byDeal[a.e.id] = byDeal[a.e.id] || []).push(personLabel(people[i], people[i].i)); });
  const together = Object.entries(byDeal).filter(([, who]) => who.length > 1)
    .map(([id, who]) => { const e = dealById(id); return `${who.join(' en ')} kunnen samen reizen met ${esc(e.provider)} vanaf ${esc(e.o.n)}.`; });
  return `<article class="gcard${k === 0 ? ' top' : ''}">
    <header class="g-head">
      <div><h3>${esc(r.dest.n)}</h3><div class="small muted">${esc(r.dest.c)} · ${r.dest.t.map(t => TYPES[t]).join(', ')}</div></div>
      <div class="g-total"><b>${eur(r.total)}</b><span class="small muted">samen, ${tripWord()}</span></div>
    </header>
    <div class="g-meta">${k === 0 ? '<span class="win">Beste keuze</span>' : ''}<span class="g-pill">${icon('i-clock', 'sm')}Langste reis ca. ${dur(r.maxT)}</span><span class="g-pill">Prijsverschil ${eur(r.spread)}</span></div>
    <ul class="g-list">${r.arr.map((a, i) => `<li>
      <span class="g-who"><span class="avatar sm" aria-hidden="true">${esc(personLabel(people[i], people[i].i).slice(0, 1).toUpperCase())}</span>${esc(personLabel(people[i], people[i].i))}</span>
      <span class="g-how" style="--mc:var(--m-${a.e.mode})">${icon(MODES[a.e.mode].icon, 'sm')}<span>${esc(a.e.provider)}<br><span class="small muted">vanaf ${esc(a.e.o.n)} · deur tot deur ca. ${dur(a.dd.total)}</span></span></span>
      <span class="g-price">${a.e.priceType === 'vanaf' ? '<small>vanaf</small> ' : ''}${eur(a.tp.p)}${a.tp.calc ? ' <small>2 × enkel</small>' : ''}</span>
      <button class="btn ghost sm" type="button" data-open="${esc(a.e.id)}" data-who="${people[i].i}">Details</button>
    </li>`).join('')}</ul>
    ${together.length ? `<p class="g-together">${icon('i-group', 'sm')}${together.join(' ')}</p>` : ''}
  </article>`;
}

function isFav(id) { return state.favorites.some(f => f.id === id); }
function toggleFav(e) {
  if (isFav(e.id)) { state.favorites = state.favorites.filter(f => f.id !== e.id); toast('Verwijderd uit favorieten.'); }
  else {
    state.favorites.push({ id: e.id, label: `${e.o.n} → ${e.dest.n}`, mode: e.mode, provider: e.provider, price: e.price, perDir: e.perDir, trip: e.trip, out: e.out || null, savedAt: new Date().toISOString(), checked: e.checked });
    toast('Bewaard bij favorieten.', { action: { label: 'Bekijk', fn: () => goTab('bewaard') } });
  }
  store.set('favorites', state.favorites); renderSavedCount();
}
function renderSavedCount() {
  const n = state.favorites.length + state.alerts.length, el = $('#savedCount');
  el.hidden = !n; el.textContent = n;
}
function alertMatches(a) {
  return filterAll().filter(e => (a.dest === 'overal' || e.to === a.dest) && (a.mode === 'alle' || e.mode === a.mode) && e.perDir <= a.max).sort((x, y) => x.perDir - y.perDir);
}
function filterAll() { const today = todayISO(); return allDeals().filter(e => !(e.out && e.out < today) && !(e.who === 'jongeren' && !isYouth())); }
function renderSaved() {
  const favs = state.favorites;
  $('#favList').innerHTML = favs.length ? favs.map(f => {
    const cur = dealById(f.id);
    const expired = f.out && f.out < todayISO();
    const status = !cur ? '<span class="status-wait">Niet meer in de data</span>' : expired ? '<span class="status-wait">Datum voorbij</span>'
      : cur.price === f.price ? `<span class="status-ok">Nog steeds ${eur(cur.price)}</span>` : `<span class="status-ok">Nu ${eur(cur.price)} (was ${eur(f.price)})</span>`;
    return `<div class="fav-row"><div><b>${esc(f.label)}</b><div class="small muted">${MODES[f.mode].label} · ${esc(f.provider)} · ${eur(f.price)} ${f.trip === 'retour' ? 'retour' : 'enkel'}${f.out ? ' · ' + dateNL(f.out) : ''}</div><div class="small">${status} · bewaard ${esc(timeNL(f.savedAt))}</div></div>
      <div class="card-actions">${cur ? `<button class="btn ghost sm" type="button" data-fav-open="${esc(f.id)}">Details</button>` : ''}<button class="icon-btn" type="button" data-fav-del="${esc(f.id)}" aria-label="Verwijder favoriet ${esc(f.label)}">${icon('i-close')}</button></div></div>`;
  }).join('') : '<p class="small muted">Nog geen favorieten. Tik op de ster bij een deal om hem hier te bewaren.</p>';
  const al = state.alerts;
  $('#alertList').innerHTML = al.length ? al.map(a => {
    const m = alertMatches(a);
    return `<div class="alert-row"><div><b>${a.dest === 'overal' ? 'Overal' : esc(DEST[a.dest].n)}</b> · ${a.mode === 'alle' ? 'alle vervoer' : MODES[a.mode].label.toLowerCase()} · onder ${eur(a.max)}
      <div class="small">${m.length ? `<span class="status-ok">${m.length} deal${m.length === 1 ? '' : 's'} voldoet</span>: goedkoopst ${esc(m[0].dest.n)} ${eur(m[0].perDir)} met ${esc(m[0].provider)}` : '<span class="status-wait">Nog geen deal onder dit bedrag</span>'}</div>
      <div class="tiny muted">Laatst gecontroleerd ${esc(timeNL(a.lastCheck || a.created))}</div></div>
      <div class="card-actions">${m.length ? `<button class="btn ghost sm" type="button" data-fav-open="${esc(m[0].id)}">Bekijk</button>` : ''}<button class="icon-btn" type="button" data-al-del="${esc(a.id)}" aria-label="Verwijder alert">${icon('i-close')}</button></div></div>`;
  }).join('') : '<p class="small muted">Nog geen alerts.</p>';
  const canNotify = 'Notification' in window && !inFrame;
  $('#alertExplain').innerHTML = `Een alert controleert de deals elke keer dat je DealRadar opent of op "Scan deals" tikt. Voor meldingen terwijl de pagina dicht is, heb je een server nodig (zie Uitleg, idee 2). Tip: zet ook een prijsalert bij <a href="https://www.google.com/travel/flights?hl=nl" target="_blank" rel="noopener">Google Flights</a> of Skyscanner.${canNotify ? ` <button class="linkish" type="button" id="btnNotify">${Notification.permission === 'granted' ? 'Browsermeldingen staan aan' : 'Zet browsermeldingen aan'}</button>` : ''}`;
  const nb = $('#btnNotify');
  if (nb) nb.addEventListener('click', async () => { try { const p = await Notification.requestPermission(); toast(p === 'granted' ? 'Browsermeldingen staan aan.' : 'Meldingen zijn niet toegestaan.'); renderSaved(); } catch (e) { toast('Meldingen lukken niet in deze browser.'); } });
  const ad = $('#alDest');
  if (!ad.options.length) ad.innerHTML = '<option value="overal">Overal</option>' + Object.values(DEST).sort((a, b) => a.n.localeCompare(b.n, 'nl')).map(d => `<option value="${d.id}">${esc(d.n)}</option>`).join('');
}
$('#view-bewaard').addEventListener('click', ev => {
  const t = ev.target.closest('button'); if (!t) return;
  if (t.dataset.favDel) { state.favorites = state.favorites.filter(f => f.id !== t.dataset.favDel); store.set('favorites', state.favorites); renderSaved(); renderSavedCount(); renderDeals(); }
  if (t.dataset.favOpen) { const e = dealById(t.dataset.favOpen); if (e) openDealDialog(e); }
  if (t.dataset.alDel) { const id = t.dataset.alDel; state.alerts = state.alerts.filter(a => a.id !== id); store.set('alerts', state.alerts); cloudRemoveAlert(id); renderSaved(); renderSavedCount(); }
});
function addAlert(dest, mode, max) {
  const a = { id: 'al' + Date.now(), dest, mode, max: Math.max(1, Math.round(max)), created: new Date().toISOString(), notified: [] };
  state.alerts.push(a); store.set('alerts', state.alerts); cloudAddAlert(a);
  checkAlerts(); renderSavedCount();
  const m = alertMatches(a);
  toast(m.length ? `Alert gemaakt. Er voldoet nu al ${m.length} deal.` : 'Alert gemaakt. Je ziet een melding als een deal eronder komt.', { action: { label: 'Bekijk', fn: () => goTab('bewaard') } });
}
$('#alertForm').addEventListener('submit', ev => { ev.preventDefault(); addAlert($('#alDest').value, $('#alMode').value, +$('#alMax').value || 50); renderSaved(); });
function openAlertDialog(e) {
  const suggestion = Math.max(1, Math.floor(e.perDir * 0.9));
  $('#dlgAlertBody').innerHTML = `<p>Meld me als <b>${esc(e.dest.n)}</b> per ${esc(MODES[e.mode].label.toLowerCase())} onder dit bedrag komt (per persoon, per richting). Nu: ${eur(e.perDir)}.</p>
    <div class="input-row"><label class="sr-only" for="alDlgMax">Bedrag in euro</label><input class="input" id="alDlgMax" type="number" min="1" step="1" value="${suggestion}" inputmode="numeric"><button class="btn" type="button" id="alDlgSave">${icon('i-bell')}Maak alert</button></div>
    <p class="small muted">De alert kijkt naar alle bronnen in DealRadar (gecontroleerd en live) elke keer dat je de pagina opent of scant.</p>`;
  openDialog('dlgAlert');
  $('#alDlgSave').onclick = () => { addAlert(e.to, e.mode, +$('#alDlgMax').value); $('#dlgAlert').close(); };
}
function checkAlerts() {
  let changed = false;
  for (const a of state.alerts) {
    const m = alertMatches(a);
    a.lastCheck = new Date().toISOString();
    const fresh = m.filter(e => !(a.notified || []).includes(e.id));
    if (fresh.length) {
      a.notified = [...new Set([...(a.notified || []), ...fresh.map(e => e.id)])];
      const top = fresh[0];
      const msg = `Prijsalert: ${top.dest.n} voor ${eur(top.perDir)} met ${top.provider}`;
      toast(msg, { action: { label: 'Bekijk', fn: () => openDealDialog(top) }, ms: 8000 });
      if ('Notification' in window && !inFrame && Notification.permission === 'granted') { try { new Notification('DealRadar NL', { body: msg }); } catch (err) { /* geen meldingen */ } }
      changed = true;
    }
  }
  store.set('alerts', state.alerts);
  if (changed && state.tab === 'bewaard') renderSaved();
}

/* ---------- 17. Delen en exporteren ---------- */
function dealText(e) {
  const src = srcOf(e);
  return `${e.o.n} → ${e.dest.n}: ${e.priceType === 'vanaf' ? 'vanaf ' : ''}${eur(e.price)} ${e.trip === 'retour' ? 'retour' : 'enkele reis'} p.p. met ${e.provider}${e.out ? ` (${dateNL(e.out, { year: true })}${e.back ? ' – ' + dateNL(e.back, { year: true }) : ''})` : ''}. Bron: ${src.name}, ${e.status === 'live' ? 'opgehaald' : 'gecontroleerd'} ${timeNL(e.checked)}${e.status === 'live' ? ' (prijs uit cache, max. 48 uur oud)' : ''}. Controleer de prijs: ${bookLink(e).url}`;
}
async function shareText(title, text, url) {
  if (navigator.share && !inFrame) {
    try { await navigator.share({ title, text, url }); return; } catch (err) { if (err && err.name === 'AbortError') return; }
  }
  const full = url && !text.includes(url) ? `${text}\n${url}` : text;
  $('#dlgShareBody').innerHTML = `<label class="small" for="shareTxt">Tekst om te delen</label><textarea class="input" id="shareTxt" readonly>${esc(full)}</textarea>
    <div class="card-actions"><button class="btn" type="button" id="shareCopy">${icon('i-copy')}Kopieer</button>
    <a class="btn ghost" href="https://wa.me/?text=${enc(full)}" target="_blank" rel="noopener">WhatsApp</a>
    <a class="btn ghost" href="https://t.me/share/url?url=${enc(url || '')}&text=${enc(text)}" target="_blank" rel="noopener">Telegram</a></div>`;
  openDialog('dlgShare');
  $('#shareCopy').onclick = async () => toast(await copyText(full) ? 'Gekopieerd.' : 'Kopiëren lukte niet; selecteer de tekst zelf.');
}
function shareDeal(e) { shareText('DealRadar NL', dealText(e), bookLink(e).url); }
$('#btnShareList').addEventListener('click', () => {
  const top = lastList.slice(0, 5).map((x, i) => `${i + 1}. ${x.e.dest.n}: ${x.e.priceType === 'vanaf' ? 'vanaf ' : ''}${eur(x.e.price)} ${x.e.trip === 'retour' ? 'retour' : 'enkel'} (${MODES[x.e.mode].label.toLowerCase()}, ${x.e.provider})`).join('\n');
  shareText('DealRadar NL', `Top deals vanaf ${state.origin.n} (DealRadar NL, gecontroleerd ${CHECK_WINDOW}):\n${top}\nPrijzen veranderen snel; check bij de aanbieder.`, '');
});
const CSV_COLS = ['Status', 'Vervoer', 'Aanbieder', 'Van', 'Naar', 'Land', 'Prijs (EUR)', 'Prijstype', 'Enkel/retour', 'Per richting (EUR)', 'Vertrek', 'Terug', 'Reistijd', 'Reistijd geschat', 'Overstappen', 'Bagage', 'CO2 p.p. per richting (kg)', 'Bron', 'Bron-URL', 'Gecontroleerd op', 'Boeken'];
function csvOf(list) {
  const q = v => { const s = String(v ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const num = v => v == null ? '' : String(Math.round(v * 100) / 100).replace('.', ',');
  const rows = list.map(({ e }) => {
    const src = srcOf(e);
    return [e.indic ? 'indicatie (laatste 4 dagen)' : e.status === 'live' ? (e.srcLive ? 'live (cache, max. 48 uur oud)' : 'live (Kiwi.com)') : 'gecontroleerd', MODES[e.mode].label, e.provider, e.o.full || e.o.n, e.dest.n, e.dest.c, num(e.price), e.priceType, e.trip, num(e.perDir), e.out || '', e.back || '', dur(e.dur), e.durEst ? 'ja' : 'nee', e.transfers ?? '', e.bag, num(e.co2One), src.name, src.url, e.checked, bookLink(e).url].map(q).join(';');
  });
  return '﻿' + CSV_COLS.join(';') + '\n' + rows.join('\n');
}
let _downloads;
async function getDownloads() {
  if (_downloads !== undefined) return _downloads;
  try {
    _downloads = window.claude && typeof window.claude.use === 'function'
      ? await Promise.race([window.claude.use('downloads'), new Promise(r => setTimeout(() => r(null), 3000))]) : null;
  } catch (e) { _downloads = null; }
  return _downloads;
}
async function saveFile(filename, data, mime) {
  const dl = await getDownloads();
  if (dl) {
    try { await dl.save({ filename, data }); toast(`${filename} aangeboden om op te slaan.`); return true; }
    catch (err) { if (err && err.code === 'declined') { toast('Opslaan geannuleerd.'); return false; } }
  }
  if (inFrame) return false;
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast(`${filename} gedownload.`);
    return true;
  } catch (e) { return false; }
}
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Laden mislukt: ' + src)); document.head.appendChild(s); });
}
async function makePdf(list) {
  if (!window.jspdf) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const safe = s => String(s).replace(/→/g, '>').replace(/[–—]/g, '-').replace(/[^\x00-\xFF€]/g, '');
  doc.setFontSize(16); doc.text('DealRadar NL - deals', 14, 15);
  doc.setFontSize(9);
  doc.text(safe(`Vanaf ${state.origin.n}. Gecontroleerde deals: ${CHECK_WINDOW}. Gemaakt: ${timeNL(new Date().toISOString())}. Prijzen veranderen snel: controleer bij de aanbieder.`), 14, 21);
  doc.autoTable({
    startY: 25, styles: { fontSize: 7.5, cellPadding: 1.4 }, headStyles: { fillColor: [16, 38, 44] },
    head: [['Vervoer', 'Route', 'Prijs', 'Type', 'Datum', 'Reistijd', 'CO2', 'Aanbieder', 'Bron', 'Gecontroleerd']],
    body: list.map(({ e }) => {
      const src = srcOf(e);
      return [MODES[e.mode].label, safe(`${e.o.n} > ${e.dest.n}`), safe(`${e.priceType === 'vanaf' ? 'vanaf ' : ''}${eur(e.price)}`), e.trip === 'retour' ? 'retour' : 'enkel', e.out ? safe(dateNL(e.out, { year: true }) + (e.back ? ' - ' + dateNL(e.back, { year: true }) : '')) : 'vrij', safe(dur(e.dur) + (e.durEst ? ' (geschat)' : '')), safe(kg(e.co2One)), safe(e.provider), safe(src.name), safe((e.status === 'live' ? 'opgehaald ' : '') + timeNL(e.checked))];
    }),
  });
  let y = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(8); doc.text('Bronnen:', 14, y); y += 4;
  const urls = [...new Set(list.flatMap(({ e }) => srcsOf(e).map(x => x.url)))];
  for (const u of urls) { if (y > 200) { doc.addPage(); y = 15; } doc.text(safe(u), 14, y); y += 3.6; }
  return doc.output('blob');
}
$('#btnExport').addEventListener('click', () => {
  const list = lastList, n = list.length;
  $('#dlgExportBody').innerHTML = `<p>Exporteer de <b>${n} deal${n === 1 ? '' : 's'}</b> die je nu ziet (met je filters en sortering). Elke regel heeft de bron, de link en het tijdstip van controle.</p>
    <div class="card-actions"><button class="btn" type="button" id="exCsv">${icon('i-file')}CSV downloaden</button><button class="btn ghost" type="button" id="exCsvCopy">${icon('i-copy')}CSV kopiëren</button><button class="btn ghost" type="button" id="exPdf">${icon('i-file')}PDF maken</button></div>
    <div id="exOut"></div>`;
  openDialog('dlgExport');
  const csv = csvOf(list);
  $('#exCsv').onclick = async () => {
    if (!(await saveFile('dealradar-deals.csv', csv, 'text/csv;charset=utf-8'))) {
      $('#exOut').innerHTML = `<p class="small">Downloaden kan hier niet. Kopieer de tekst hieronder en plak die in een bestand of in Excel.</p><textarea class="input" readonly aria-label="CSV-tekst">${esc(csv)}</textarea>`;
    }
  };
  $('#exCsvCopy').onclick = async () => toast(await copyText(csv) ? 'CSV gekopieerd. Plak in Excel of Google Sheets.' : 'Kopiëren lukte niet.');
  $('#exPdf').onclick = async () => {
    const b = $('#exPdf'); b.disabled = true; b.textContent = 'PDF maken…';
    try {
      const blob = await makePdf(list);
      if (!(await saveFile('dealradar-deals.pdf', blob, 'application/pdf'))) toast('Opslaan van de PDF kan hier niet. Open het HTML-bestand los in je browser.');
    } catch (err) {
      if (!inFrame) { toast('PDF-bibliotheek laadt niet (offline?). Je browser opent nu het printvenster: kies "Opslaan als PDF".'); setTimeout(() => window.print(), 600); }
      else toast('PDF maken lukt hier niet. Gebruik CSV, of open het bestand los in je browser.');
    } finally { b.disabled = false; b.innerHTML = `${icon('i-file')}PDF maken`; }
  };
});

/* ---------- 18. Instellingen en uitleg ---------- */
function openSettings() {
  const s = settings;
  $('#dlgSettingsBody').innerHTML = `
    <section class="form-grid" aria-labelledby="stKeys"><h3 id="stKeys">Live bronnen (API-sleutels)</h3>
      <p class="help-text">Sleutels blijven alleen in deze browser (localStorage). Deel dit bestand niet met je sleutels erin.</p>
      <div class="field"><label for="stNs">NS API-sleutel (Ocp-Apim-Subscription-Key)</label><div class="input-row"><input class="input" id="stNs" type="password" autocomplete="off" value="${esc(s.nsKey)}" placeholder="Plak je NS-sleutel"><button class="btn ghost sm" type="button" data-test="ns">Test</button></div><span class="key-status" id="stNsSt"></span></div>
      <div class="field"><label for="stTp">Travelpayouts API-token (vluchtprijzen)</label><div class="input-row"><input class="input" id="stTp" type="password" autocomplete="off" value="${esc(s.tpToken)}" placeholder="Plak je token"><button class="btn ghost sm" type="button" data-test="tp">Test</button></div><span class="key-status" id="stTpSt"></span></div>
      <div class="field"><label for="stProxy">Proxy-URL (optioneel, tegen CORS-blokkades)</label><input class="input" id="stProxy" type="url" value="${esc(s.proxy)}" placeholder="https://jouw-proxy.workers.dev"></div>
      <button class="linkish" type="button" data-help="keys">Hoe krijg ik deze sleutels?</button>
    </section>
    <section class="form-grid" aria-labelledby="stAss"><h3 id="stAss">Aannames voor deur-tot-deur</h3>
      <div class="field"><label for="stCi1">Op Schiphol zijn voor vertrek (minuten)</label><input class="input" id="stCi1" type="number" min="30" max="240" value="${s.checkinAMS}"></div>
      <div class="field"><label for="stCi2">Op andere vliegvelden (minuten)</label><input class="input" id="stCi2" type="number" min="30" max="240" value="${s.checkinRegional}"></div>
      <div class="field"><label for="stTc">Van vliegveld naar het centrum (minuten)</label><input class="input" id="stTc" type="number" min="10" max="180" value="${s.transferCity}"></div>
      <div class="field"><label for="stHv">Wat is een uur reistijd je waard? (euro, voor "beste prijs-kwaliteit")</label><input class="input" id="stHv" type="number" min="0" max="100" value="${s.hourValue}"></div>
      <div class="field"><label for="stCv">Weging CO2 (euro per kg, voor "beste prijs-kwaliteit")</label><input class="input" id="stCv" type="number" min="0" max="5" step="0.05" value="${s.co2Value}"></div>
    </section>
    <section class="form-grid" aria-labelledby="stDemo"><h3 id="stDemo">Demo</h3>
      <label class="check"><input type="checkbox" id="stShowDemo" ${s.showDemo ? 'checked' : ''}> Toon demo-prijzen in de kalender als er geen live koppeling is (altijd gemarkeerd als DEMO)</label>
    </section>
    <div class="card-actions"><button class="btn" type="button" id="stSave">${icon('i-check')}Opslaan</button><button class="btn ghost" type="button" id="stClear">Wis alle opgeslagen gegevens</button></div>`;
  openDialog('dlgSettings');
  const read = () => {
    s.nsKey = $('#stNs').value.trim(); s.tpToken = $('#stTp').value.trim(); s.proxy = $('#stProxy').value.trim();
    s.checkinAMS = +$('#stCi1').value || 120; s.checkinRegional = +$('#stCi2').value || 90; s.transferCity = +$('#stTc').value || 40;
    s.hourValue = Math.max(0, +$('#stHv').value || 0); s.co2Value = Math.max(0, +$('#stCv').value || 0); s.showDemo = $('#stShowDemo').checked;
  };
  $('#dlgSettingsBody').onclick = async ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.help) { $('#dlgSettings').close(); openHelp(t.dataset.help); }
    if (t.dataset.test === 'ns') {
      read(); const st = $('#stNsSt'); st.textContent = 'Testen…'; nsStationMap = null;
      try { const m = await nsStations(); st.textContent = `Werkt: ${Object.keys(m).length} stations ontvangen.`; st.style.color = 'var(--ok)'; }
      catch (err) { st.textContent = explainError(err); st.style.color = 'var(--bad)'; }
    }
    if (t.dataset.test === 'tp') {
      read(); const st = $('#stTpSt'); st.textContent = 'Testen…';
      try { const r = await tpPrices('AMS', 'BCN', null); st.textContent = `Werkt: ${r.length} prijzen Schiphol → Barcelona ontvangen.`; st.style.color = 'var(--ok)'; }
      catch (err) { st.textContent = explainError(err); st.style.color = 'var(--bad)'; }
    }
    if (t.id === 'stSave') {
      read(); saveSettings(); buildSnapshot(); state.nsAccess = {}; nsStationMap = null;
      $('#dlgSettings').close(); toast('Instellingen opgeslagen.'); scan();
    }
    if (t.id === 'stClear') {
      store.clear(); Object.assign(settings, DEFAULT_SETTINGS); state.favorites = []; state.alerts = [];
      $('#dlgSettings').close(); applyTheme(); buildSnapshot(); renderAll(); toast('Alle opgeslagen gegevens zijn gewist.');
    }
  };
}
const PROXY_CODE = `// Cloudflare Worker: kleine proxy voor DealRadar NL
// Zet je sleutels als "Secrets": NS_KEY en TP_TOKEN (dan hoeven ze niet in de browser).
const ALLOWED = ['gateway.apiportal.ns.nl', 'api.travelpayouts.com'];
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Ocp-Apim-Subscription-Key, X-Access-Token, Content-Type',
};
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const target = new URL(request.url).searchParams.get('url');
    if (!target) return new Response('Parameter url ontbreekt', { status: 400, headers: CORS });
    const t = new URL(target);
    if (!ALLOWED.includes(t.hostname)) return new Response('Host niet toegestaan', { status: 403, headers: CORS });
    const headers = new Headers();
    if (t.hostname === 'gateway.apiportal.ns.nl') {
      headers.set('Ocp-Apim-Subscription-Key', request.headers.get('Ocp-Apim-Subscription-Key') || env.NS_KEY || '');
    }
    if (t.hostname === 'api.travelpayouts.com' && env.TP_TOKEN && !t.searchParams.get('token')) {
      t.searchParams.set('token', env.TP_TOKEN);
    }
    const r = await fetch(t.toString(), { headers });
    return new Response(r.body, { status: r.status, headers: { ...CORS, 'Content-Type': r.headers.get('Content-Type') || 'application/json' } });
  },
};`;
function openHelp(section) {
  $('#dlgHelpBody').innerHTML = `
    <section id="h-use"><h3>Zo gebruik je DealRadar</h3><ol>
      <li>Kies waar je vertrekt: een station, vliegveld of adres (of tik op het richtkruis voor je locatie).</li>
      <li>Kies een bestemming, of laat "Overal" staan voor de goedkoopste plekken.</li>
      <li>Kies bovenaan <b>Retour</b> of <b>Enkele reis</b>. Bij retour kun je ook kiezen hoe lang je blijft.</li>
      <li>Kies wanneer: flexibel, een maand, een weekend, een <b>schoolvakantie</b> of je eigen datums. Kies ook het aantal reizigers. Ben je jonger dan 18? Kies "Jongere 12–17" voor jongerentarieven.</li>
      <li>Tik op <b>Scan deals</b>. Filter en sorteer. Tik op <b>Naar boeken</b> om de prijs bij de aanbieder te controleren.</li>
      <li>Standaard zie je de <b>beste deal per bestemming</b>. Met de knoppen naast Sorteren zie je alle deals los, of een compacte lijst.</li>
      <li>Gebruik <b>Kaart</b>, <b>Kalender</b> en <b>Vergelijk</b> voor overzicht, de goedkoopste dag en trein tegen vliegtuig.</li>
      <li>Reis je met vrienden die ergens anders wonen? Vul bij <b>Samen</b> ieders vertrekpunt in. Je ziet waar jullie samen het goedkoopst of het eerlijkst naartoe kunnen.</li>
      <li>Tik op het belletje voor een <b>prijsalert</b>. In Claude controleert de dagelijkse controle je alerts elke ochtend en krijg je een pushmelding als een prijs onder je grens zakt.</li>
    </ol></section>
    <section id="h-retour"><h3>Retour of enkele reis</h3><ul>
      <li><b>Echte retourprijs:</b> bij vluchten is de retourprijs samen gezocht: heen en terug op de genoemde data. Je ziet beide vluchten, de vertrektijden en het aantal nachten.</li>
      <li><b>Berekend:</b> trein- en busprijzen zijn vanafprijzen voor een enkele reis op een vrije datum. Bij retour rekent DealRadar 2 × die prijs en zet er "berekend" bij. De echte prijs hangt af van je datums.</li>
      <li><b>Indicatie:</b> prijzen van Skyscanner zijn een schatting op basis van de laatste 4 dagen. Ze staan apart gemarkeerd en je kunt ze verbergen bij Filters. Is er voor dezelfde bestemming ook een gecontroleerde of live deal, dan zie je die eerst.</li>
      <li><b>Controleer de prijs nu:</b> in Details van een vlucht zoekt deze knop (in Claude) dezelfde vlucht opnieuw op bij Kiwi.com. Zo zie je meteen of de prijs nog klopt.</li>
      <li><b>Bagage:</b> kies bij Zoeken een handbagagekoffer of ruimbagage. Live zoeken in Claude vraagt dan de prijs inclusief die bagage op.</li>
      <li><b>Schoolvakanties:</b> de data komen van de Rijksoverheid (schooljaar 2026-2027). De voorjaarsvakantie is een advies; je school mag afwijken.</li>
    </ul></section>
    <section id="h-wereld"><h3>De hele wereld</h3><ul>
      <li><b>Hoe ver?</b> Kies onder "Waarheen?" de hele wereld, alleen Europa, buiten Europa of één werelddeel. Je kunt ook een verre stad typen, zoals Bangkok of New York.</li>
      <li><b>Verre vluchten</b> zoekt de app (in Claude) vanaf Schiphol en je dichtstbijzijnde vliegveld, met hooguit 1 overstap en een verblijf van 5 tot 16 nachten. Bij een overstap staat erbij waar.</li>
      <li><b>Wereldkaart:</b> op het tabblad Kaart wissel je tussen Europa en de wereld.</li>
      <li><b>CO2:</b> voor vluchten boven 2500 km rekent de app met ${String(CO2.vliegVer.f).replace('.', ',')} kg per kilometer (<a href="${SRC.co2Far.url}" target="_blank" rel="noopener">bron</a>).</li>
    </ul></section>
    <section id="h-new"><h3>Live, dagelijks en geschiedenis</h3><ul>
      <li><b>Live vluchten (Kiwi.com):</b> in Claude zoekt <b>Scan deals</b> live via je gratis Kiwi.com-connector. Dat gebeurt vanaf de dichtstbijzijnde vliegvelden, en ook vanaf Weeze en Charleroi als die dichtbij liggen. Elke live deal heeft een eigen boeklink.</li>
      <li><b>Prijs vergelijken:</b> in het detailvenster van een vlucht vergelijk je met de lastminute.com-connector dezelfde route op dezelfde dag.</li>
      <li><b>Dagelijkse controle:</b> elke ochtend zoekt Claude nieuwe deals en controleert de prijzen opnieuw. Alles komt in de database van deze pagina.</li>
      <li><b>Prijsgeschiedenis:</b> elke controle en elke live zoekopdracht voegt een punt toe. Het lijntje op een kaart laat zien of de prijs daalt of stijgt. In Details zie je de grafiek.</li>
      <li><b>Topdeals:</b> de laagste prijs per 100 km, één per bestemming. Zo vergelijk je korte en lange reizen eerlijk.</li>
      <li><b>App op je telefoon:</b> de website-versie kun je installeren (Deel → Zet op beginscherm). Hij werkt dan ook offline, met de laatst bewaarde deals.</li>
    </ul></section>
    <section id="h-data"><h3>Waar komen de prijzen vandaan?</h3>
      <ul>
        <li><span class="badge snapshot">Gecontroleerd</span> Prijzen die Claude op ${esc(CHECK_WINDOW)} heeft opgezocht op de websites van NS International, Eurostar, Deutsche Bahn en Kombo (FlixBus en BlaBlaCar Bus), en vluchten die live via Kiwi.com zijn gevonden. Bij elke deal staan de bron, een link en het tijdstip. In Claude ververst de dagelijkse controle ze elke ochtend, met een nieuwe controletijd.</li>
        <li><span class="badge indic">Indicatie</span> Schattingen van Skyscanner op basis van prijzen van de laatste 4 dagen. Handig om een idee te krijgen, maar geen live prijs.</li>
        <li><span class="badge live">Live</span> Live opgehaald op het moment dat je zoekt: vluchten via je Kiwi.com-connector (in Claude), of met je eigen sleutels vluchtprijzen uit de Travelpayouts-cache (laatste 48 uur) en NS-reistijden en -prijzen naar het vertrekpunt.</li>
        <li><span class="badge demo">Demo</span> Alleen in de kalender als je dat aanzet. Verzonnen voorbeeldprijzen, nooit om te boeken.</li>
      </ul>
      <p>Reistijden die een bron niet noemt, CO2 en deur-tot-deur zijn <b>berekend</b> en staan dan als schatting of aanname gemarkeerd. Google Flights, Skyscanner, Ryanair, Trainline en FlixBus hebben geen open, gratis API; daarom opent DealRadar hun zoekpagina met jouw route.</p>
    </section>
    <section id="h-keys"><h3>API-sleutels koppelen</h3>
      <p><b>NS API (gratis):</b></p><ol>
        <li>Maak een account op <a href="https://apiportal.ns.nl/product#product=NsApp" target="_blank" rel="noopener">apiportal.ns.nl</a>.</li>
        <li>Abonneer je op het product <b>Ns-App</b> (gratis).</li>
        <li>Kopieer bij je profiel de <b>Primary key</b> en plak die bij Instellingen → NS API-sleutel. Tik op Test.</li>
      </ol>
      <p><b>Travelpayouts / Aviasales Data API (gratis token):</b></p><ol>
        <li>Meld je aan bij Travelpayouts en sluit je aan bij het Aviasales-programma.</li>
        <li>Kopieer je API-token (te vinden bij je profiel onder API) en plak het bij Instellingen. Tik op Test.</li>
        <li>Let op: dit zijn prijzen die andere zoekers in de laatste 48 uur vonden (<a href="${TP_DOCS}" target="_blank" rel="noopener">documentatie</a>), geen boekbare garantie.</li>
      </ol>
      <p><b>PDOK (adressen):</b> geen sleutel nodig.</p>
    </section>
    <section id="h-proxy"><h3>Werkt een live bron niet? (CORS)</h3>
      <p>Sommige API's weigeren verzoeken die rechtstreeks uit een webpagina komen. In de preview van Claude zijn externe verbindingen sowieso geblokkeerd: open het HTML-bestand dan los in je browser. Lukt het daar ook niet, maak dan gratis een kleine proxy bij Cloudflare Workers en plak de URL bij Instellingen → Proxy-URL.</p>
      <pre class="code" id="proxyCode">${esc(PROXY_CODE)}</pre>
      <button class="btn ghost sm" type="button" id="copyProxy">${icon('i-copy')}Kopieer proxy-code</button>
    </section>
    <section id="h-extend"><h3>Uitbreiden</h3><ul>
      <li><b>Deal toevoegen:</b> zoek <code>SNAPSHOT_DEALS</code> in het bestand en kopieer een blok. Bovenaan dat deel staat per veld wat het betekent.</li>
      <li><b>Bestemming toevoegen:</b> voeg een regel toe aan <code>dest</code> in de basisdata (naam, land, coördinaten, IATA-code, soort reis).</li>
      <li><b>Nieuwe bron:</b> schrijf een functie zoals <code>tpPrices</code> die een lijst deals teruggeeft met <code>status: 'live'</code>, en roep hem aan in <code>scan()</code>.</li>
      <li><b>Aanbieder-link:</b> voeg een regel toe aan <code>PROVIDERS</code>.</li>
    </ul></section>
    <section><h3>Privacy</h3><p>DealRadar heeft geen eigen server. Je sleutels en favorieten staan in jouw browser. In Claude staan je alerts, de dagelijkse controles en je zoekopdrachten in de database van deze pagina, zodat de dagelijkse controle ze kan gebruiken. Alleen jij als eigenaar kunt daar schrijven. Je alerts kan alleen jij lezen. De app praat alleen met de bronnen en connectors die je zelf koppelt.</p></section>`;
  openDialog('dlgHelp');
  $('#copyProxy').onclick = async () => toast(await copyText(PROXY_CODE) ? 'Proxy-code gekopieerd.' : 'Kopiëren lukte niet.');
  if (section) { const el = $('#h-' + section); if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 50); }
}
$('#btnSettings').addEventListener('click', openSettings);
$('#btnHelp').addEventListener('click', () => openHelp());
$('#btnTheme').addEventListener('click', () => {
  settings.theme = { system: 'light', light: 'dark', dark: 'system' }[settings.theme] || 'system';
  saveSettings(); applyTheme();
  toast(`Thema: ${{ system: 'automatisch', light: 'licht', dark: 'donker' }[settings.theme]}.`, { ms: 2000 });
});

/* ---------- 19. Scannen en starten ---------- */
async function scanNS(home = state.origin) {
  state.src.ns = { status: 'busy', text: 'bezig…' }; renderRadar();
  try {
    const map = await nsStations();
    const fromSt = nearestStation(home);
    const fromCode = map[fromSt.uic];
    if (!fromCode) throw new Error(`Station ${fromSt.n} staat niet in de NS-lijst.`);
    const when = nsWhen(), okey = originKey(home);
    let n = 0;
    for (const uic of [...new Set(Object.values(ORIGINS).map(o => o.uic))]) {
      const key = `${okey}|${uic}`;
      if (state.nsAccess[key]) { n++; continue; }
      if (uic === fromSt.uic) { state.nsAccess[key] = { min: 0, eur: 0, transfers: 0, when }; n++; continue; }
      if (!map[uic]) continue;
      try { state.nsAccess[key] = await nsTrip(fromCode, map[uic], when); n++; }
      catch (err) { if (err.status === 401 || err.status === 403) throw err; }
    }
    // Van een adres naar het station: schatting erbij optellen
    if (fromSt.km > 0.3) {
      const extra = Math.round(5 + fromSt.km / 15 * 60);
      Object.keys(state.nsAccess).filter(k => k.startsWith(okey)).forEach(k => { if (!state.nsAccess[k].firstMile) { state.nsAccess[k].min += extra; state.nsAccess[k].firstMile = extra; } });
    }
    state.src.ns = { status: 'ok', text: `${n} ritten vanaf ${fromSt.n}` };
  } catch (err) { state.src.ns = { status: 'error', text: explainError(err) }; }
  renderRadar();
}
async function scanTP() {
  state.src.tp = { status: 'busy', text: 'bezig…' }; renderRadar();
  try {
    const aps = nearestAirports(state.origin, 5).filter((a, i) => i < 3 || a.iata === 'AMS');
    const dest = state.dest !== 'overal' ? DEST[state.dest] : null;
    if (dest && !dest.iata) throw new Error(`${dest.n} heeft geen vliegveld in de lijst.`);
    const month = state.when.mode === 'month' ? state.when.month : null;
    const res = []; let lastErr = null;
    for (const ap of aps) {
      try {
        const rows = await tpPrices(ap.iata, dest ? dest.iata : null, month);
        rows.forEach(r => { const d = tpToDeal(r, ap.iata); const en = d && enrich(d); if (en) res.push(en); });
      } catch (err) { lastErr = err; if (err.status === 401 || err.status === 403) throw err; }
    }
    if (!res.length && lastErr) throw lastErr;
    const seen = new Set();
    state.liveTP = res.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });
    syncLive();
    state.src.tp = { status: 'ok', text: `${state.liveTP.length} vluchten (cache, ≤ 48 uur)` };
  } catch (err) { state.liveTP = []; syncLive(); state.src.tp = { status: 'error', text: explainError(err) }; }
  renderRadar();
}
async function scan(opt = {}) {
  if (state.scanning) return;
  state.scanning = true;
  const btn = $('#btnScan'); btn.classList.add('busy'); btn.setAttribute('aria-busy', 'true');
  state.src.snapshot = { status: 'ok', text: `${SNAP.length} deals` };
  const tasks = [];
  if (settings.nsKey && !opt.onlyKiwi) tasks.push(scanNS()); else if (!settings.nsKey) state.src.ns = { status: 'off', text: 'niet gekoppeld' };
  if (opt.onlyKiwi) { /* alleen Kiwi */ } else if (settings.tpToken) tasks.push(scanTP()); else { state.src.tp = { status: 'off', text: 'niet gekoppeld' }; state.liveTP = []; syncLive(); }
  if (CLOUD.kiwi) tasks.push(scanKiwi());
  renderRadar(); renderAll();
  $('#scanInfo').textContent = tasks.length ? 'Radar scant live bronnen…' : (inFrame ? 'Gecontroleerde deals geladen.' : 'Gecontroleerde deals geladen. Open in Claude met je connectors of vul een API-sleutel in voor live prijzen.');
  if (tasks.length) { await Promise.allSettled(tasks); }
  state.scanning = false; btn.classList.remove('busy'); btn.removeAttribute('aria-busy');
  renderRadar(); renderAll(); checkAlerts();
  const live = [state.src.ns, state.src.tp, state.src.kiwi].filter(x => x.status !== 'off');
  const ok = live.filter(x => x.status === 'ok').length, errs = live.filter(x => x.status === 'error').length;
  $('#scanInfo').textContent = tasks.length ? `Klaar. ${ok} live bron${ok === 1 ? '' : 'nen'} gelukt${errs ? `, ${errs} met een fout (zie Bronnen)` : ''}${state.liveKiwi.length ? ` · ${state.liveKiwi.length} live vluchten via Kiwi.com` : ''}.` : 'Gecontroleerde deals geladen. Open in Claude met je connectors of vul een API-sleutel in voor live prijzen.';
  if (!opt.initial) {
    const top = lastList[0];
    announce(top ? `${lastList.length} deals gevonden. Goedkoopst: ${top.e.dest.n} vanaf ${eur(top.e.perDir)} per richting.` : 'Geen deals gevonden met deze keuzes.');
  }
}
function init() {
  applyTheme();
  buildSnapshot();
  initFiltersUI();
  initSearch();
  initMap();
  initCalendar();
  initCompare();
  initGroup();
  renderPasses();
  renderRadar();
  $('#travCount').textContent = state.travellers;
  setTab(location.hash.slice(1) || 'deals', { scroll: false });
  scan({ initial: true });
}
