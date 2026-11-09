# Automatische tests voor DealRadar NL (Playwright + Chrome)
# Live API's zijn vanuit deze testomgeving niet bereikbaar; die worden nagebootst
# met antwoorden in het formaat uit de documentatie, om de verwerking te testen.
import json, math, re, sys, threading, http.server, socketserver, functools, os
from playwright.sync_api import sync_playwright

DIST = '/home/claude/build/dist'
PORT = 8799
results = []
def check(name, ok, info=''):
    results.append((name, bool(ok), info))
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{info}]' if info else ''))

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=DIST)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', PORT), functools.partial(Q, directory=DIST))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{PORT}/dealradar-nl.html'

NM = '/home/claude/build/node_modules/'
CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Content-Type': 'application/json'}
calls = {'pdok': 0, 'ns_st': 0, 'ns_trip': 0, 'tp': 0, 'tp_cal': 0, 'ns_query_key': 0}

def route_all(route, request):
    u = request.url
    if 'fonts.googleapis.com' in u or 'fonts.gstatic.com' in u:
        return route.abort()
    if 'cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js' in u:
        return route.fulfill(path=NM + 'jspdf/dist/jspdf.umd.min.js', headers={'Content-Type': 'application/javascript'})
    if 'cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/' in u:
        return route.fulfill(path=NM + 'jspdf-autotable/dist/jspdf.plugin.autotable.min.js', headers={'Content-Type': 'application/javascript'})
    if request.method == 'OPTIONS':
        return route.fulfill(status=204, headers=CORS)
    if 'api.pdok.nl' in u:
        calls['pdok'] += 1
        body = {'response': {'numFound': 1, 'docs': [{'type': 'adres', 'weergavenaam': 'Damrak 1, 1012LG Amsterdam', 'centroide_ll': 'POINT(4.8945 52.3747)'}]}}
        return route.fulfill(status=200, headers=CORS, body=json.dumps(body))
    if 'gateway.apiportal.ns.nl' in u:
        if 'subscription-key=' in u: calls['ns_query_key'] += 1
        if '/v2/stations' in u:
            calls['ns_st'] += 1
            st = [('UT', '8400621'), ('ASD', '8400058'), ('SHL', '8400561'), ('RTD', '8400530'), ('EHV', '8400206'), ('GN', '8400263'), ('MT', '8400424'), ('ASS', '8400059')]
            return route.fulfill(status=200, headers=CORS, body=json.dumps({'payload': [{'code': c, 'UICCode': u_, 'namen': {'lang': c}} for c, u_ in st]}))
        if '/v3/trips' in u:
            calls['ns_trip'] += 1
            return route.fulfill(status=200, headers=CORS, body=json.dumps({'trips': [{'optimal': True, 'plannedDurationInMinutes': 27, 'transfers': 0, 'productFare': {'priceInCents': 930}}]}))
    if 'api.travelpayouts.com' in u:
        if 'grouped_prices' in u:
            calls['tp_cal'] += 1
            data = {'2026-12-04': {'price': 52, 'airline': 'VY'}, '2026-12-05': {'price': 61}, '2026-12-06': {'price': 44}, '2026-12-07': {'price': 39}, '2026-12-11': {'price': 47}, '2026-12-13': {'price': 41}}
            return route.fulfill(status=200, headers=CORS, body=json.dumps({'success': True, 'data': data}))
        if 'prices_for_dates' in u:
            calls['tp'] += 1
            org = re.search(r'origin=([A-Z]{3})', u).group(1)
            rows = [{'origin': org, 'destination': 'BCN', 'origin_airport': org, 'destination_airport': 'BCN', 'price': 49, 'airline': 'VY', 'departure_at': '2026-12-12T07:00:00+01:00', 'transfers': 0, 'duration_to': 135, 'link': '/search/AMS1212BCN1'},
                    {'origin': org, 'destination': 'LIS', 'origin_airport': org, 'destination_airport': 'LIS', 'price': 58, 'airline': 'HV', 'departure_at': '2026-12-19T09:00:00+01:00', 'transfers': 0, 'duration_to': 170, 'link': '/search/AMS1912LIS1'}]
            return route.fulfill(status=200, headers=CORS, body=json.dumps({'success': True, 'data': rows, 'currency': 'eur'}))
    if u.startswith('http://127.0.0.1'):
        return route.continue_()
    return route.abort()

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--no-sandbox'])
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='nl-NL', timezone_id='Europe/Amsterdam', has_touch=True)
    ctx.route('**/*', route_all)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' and 'net::' not in m.text and 'Failed to load resource' not in m.text else None)
    page.goto(URL)
    page.wait_for_selector('.deal')
    ev = page.evaluate

    # 1. Laden
    n = ev("document.querySelectorAll('#dealGrid .deal').length")
    snap = ev('SNAP.length')
    check('Pagina laadt zonder JavaScript-fouten', not errors, '; '.join(errors[:3]))
    check('Deals zichtbaar bij openen', n > 30, f'{n} kaarten, {snap} in snapshot')
    check('Jongerentarieven standaard verborgen (met melding)', ev("!lastList.some(x=>x.e.who==='jongeren') && /jongerentarie/.test(document.querySelector('#dealNotices').textContent)"))

    # 2. Elke kaart: bron, link, tijdstip, boeklink
    card_ok = ev("""[...document.querySelectorAll('#dealGrid .deal')].every(c => {
        const src = c.querySelector('.src-line a'); const book = c.querySelector('.card-actions a.btn');
        return src && /^https:\\/\\//.test(src.href) && /gecontroleerd \\d+ \\w+ 2026, \\d\\d:\\d\\d/.test(c.querySelector('.src-line').textContent) && book && /^https:\\/\\//.test(book.href) && book.target==='_blank'; })""")
    check('Elke deal heeft bron-link, controle-tijdstip en boeklink', card_ok)
    check('Alle bronnen in de data zijn https-links', ev("Object.values(SRC).every(s=>/^https:\\/\\//.test(s.url))"))
    check('Elke snapshot-deal verwijst naar een bestaande bron', ev("SNAPSHOT_DEALS.every(d=>d.src.length && d.src.every(k=>SRC[k]))"))

    # 3. Sorteren
    for key, expr in [('prijs', 'x.e.perDir'), ('snel', 'x.dd.total'), ('groen', 'x.e.co2One'), ('score', 'x.s')]:
        page.select_option('#sortSel', key)
        ok = ev(f"(() => {{ const v = lastList.map(x => {expr}); return v.every((a,i)=> i===0 || v[i-1] <= a + 1e-9); }})()")
        check(f'Sorteren op "{key}" klopt', ok)
    page.select_option('#sortSel', 'prijs')
    first = ev("lastList[0].e.id + ' ' + lastList[0].e.perDir")
    check('Goedkoopste deal bovenaan', first.startswith('flix-brussel'), first)

    # 4. Filters
    ev("state.filters.modes.delete('vliegtuig'); renderAll()")
    check('Filter vervoer: geen vliegtuig meer', ev("lastList.length>0 && !lastList.some(x=>x.e.mode==='vliegtuig')"))
    ev("state.filters = defaultFilters(); state.filters.maxPrice = 50; renderAll()")
    check('Filter maximumprijs €50 (per richting)', ev("lastList.length>0 && lastList.every(x=>x.e.perDir<=50)"), f"{ev('lastList.length')} deals")
    ev("state.filters = defaultFilters(); state.filters.direct = true; renderAll()")
    check('Filter alleen rechtstreeks', ev("lastList.length>0 && lastList.every(x=>x.e.transfers===0)"))
    ev("state.filters = defaultFilters(); state.filters.bagIncl = true; renderAll()")
    check('Filter koffer inbegrepen', ev("lastList.length>0 && lastList.every(x=>x.e.bag==='koffer')"))
    ev("state.filters = defaultFilters(); state.filters.types.add('ski'); renderAll()")
    ski = ev("lastList.map(x=>x.e.dest.n)")
    check('Filter skiën toont alleen ski-bestemmingen', len(ski) > 0 and all(ev(f"DEST[lastList[{i}].e.to].t.includes('ski')") for i in range(len(ski))), ', '.join(sorted(set(ski))))
    ev("state.filters = defaultFilters(); state.filters.countries.add('DE'); renderAll()")
    check('Filter land Duitsland', ev("lastList.length>0 && lastList.every(x=>x.e.dest.cc==='DE')"))
    ev("state.filters = defaultFilters(); state.filters.maxHours = 4; renderAll()")
    check('Filter reistijd max 4 uur', ev("lastList.length>0 && lastList.every(x=>x.e.dur<=240)"))
    ev("state.filters = defaultFilters(); renderAll()")

    # 5. Bestemming, datum, korting
    ev("setDest('parijs')")
    check('Bestemming Parijs: alleen Parijs', ev("lastList.length>=3 && lastList.every(x=>x.e.to==='parijs')"), f"{ev('lastList.length')} deals")
    ev("setDest('overal')")
    page.click('.seg [data-when="weekend"]')
    check('Weekend: vaste data vertrekken op vr/za', ev("lastList.length>0 && lastList.filter(x=>x.e.out).every(x=>[5,6].includes(new Date(x.e.out+'T12:00').getDay()))"))
    page.click('.seg [data-when="month"]')
    page.select_option('#inMonth', '2026-12')
    check('Maand december: vaste data in december', ev("lastList.filter(x=>x.e.out).length>0 && lastList.filter(x=>x.e.out).every(x=>x.e.out.startsWith('2026-12'))"))
    page.click('.seg [data-when="flex"]')
    page.select_option('#inProfile', 'jongere12')
    check('Jongere: DB-jongerentarieven zichtbaar', ev("lastList.some(x=>x.e.who==='jongeren')"))
    page.select_option('#inProfile', 'volwassene')
    page.click('#travPlus'); page.click('#travPlus')
    check('3 reizigers: totaalprijs op kaart', ev("/3 pers\\.: /.test(document.querySelector('#dealGrid .deal .price-note').textContent)"))
    page.click('#travMinus'); page.click('#travMinus')

    # 6. Rekenen: CO2, retour, deur-tot-deur (onafhankelijk nagerekend)
    def hav(a, b):
        R = 6371; r = math.pi/180
        dlat = (b[0]-a[0])*r; dlon = (b[1]-a[1])*r
        x = math.sin(dlat/2)**2 + math.cos(a[0]*r)*math.cos(b[0]*r)*math.sin(dlon/2)**2
        return 2*R*math.asin(math.sqrt(x))
    e = ev("(()=>{const e=SNAP.find(d=>d.id==='nsi-parijs'); return {o:[e.o.lat,e.o.lon], d:[e.dest.lat,e.dest.lon], co2:e.co2One, f:e.co2f.f}})()")
    exp = hav(e['o'], e['d']) * 1.2 * 0.019
    check('CO2 trein Amsterdam–Parijs klopt', abs(exp - e['co2']) < 0.01, f"{e['co2']:.2f} kg (verwacht {exp:.2f})")
    e2 = ev("(()=>{const e=SNAP.find(d=>d.id==='ein-stn'); return {o:[e.o.lat,e.o.lon], a:[ARR_AIRPORTS.STN.lat, ARR_AIRPORTS.STN.lon], co2:e.co2One, perDir:e.perDir}})()")
    g = hav(e2['o'], e2['a']); fac = 0.202 if g < 700 else 0.172
    check('CO2 vlucht Eindhoven–Stansted (8% omweg, factor < 700 km)', abs(g*1.08*fac - e2['co2']) < 0.01, f"{e2['co2']:.1f} kg")
    check('Retourprijs per richting = prijs / 2', abs(e2['perDir'] - 17.5) < 1e-9)
    acc = ev("(()=>{const e=SNAP.find(d=>d.id==='nsi-parijs'); return door(e)})()")
    d = hav((52.08758, 5.11117), (52.37919, 4.89943))
    check('Deur-tot-deur: Utrecht → Amsterdam C geschat', acc['access'] == round(15 + d/65*60) and acc['total'] == acc['access'] + 10 + 205 + 15, f"{acc['access']} min naar vertrekpunt, totaal {acc['total']} min")
    check('Geen deal zonder geldige bestemming of vertrekpunt', ev("SNAP.length === SNAPSHOT_DEALS.length"))

    # 7. Export CSV en PDF
    csv = ev("csvOf(lastList)")
    lines = csv.strip('\ufeff').split('\n')
    check('CSV: kop + één regel per deal, met bron en tijdstip', len(lines) == ev('lastList.length') + 1 and 'Bron-URL' in lines[0] and 'Gecontroleerd op' in lines[0], f'{len(lines)-1} regels')
    page.click('#btnExport')
    with page.expect_download(timeout=15000) as dl:
        page.click('#exPdf')
    pdfpath = '/home/claude/build/dist/_test.pdf'
    dl.value.save_as(pdfpath)
    head = open(pdfpath, 'rb').read(5)
    check('PDF wordt gemaakt en gedownload', head == b'%PDF-', f'{os.path.getsize(pdfpath)//1024} KB')
    with page.expect_download(timeout=10000) as dl2:
        page.click('#exCsv')
    check('CSV wordt gedownload', dl2.value.suggested_filename == 'dealradar-deals.csv')
    page.keyboard.press('Escape')

    # 8. Favorieten en alerts
    page.click('#dealGrid .deal .fav')
    check('Favoriet bewaren', ev("state.favorites.length===1 && store.get('favorites',[]).length===1"))
    ev("addAlert('overal','alle',20)")
    check('Prijsalert onder €20 vindt matches', ev("alertMatches(state.alerts[0]).length>0 && alertMatches(state.alerts[0]).every(e=>e.perDir<=20)"), f"{ev('alertMatches(state.alerts[0]).length')} matches")
    page.goto(URL + '#bewaard'); page.wait_for_selector('#favList .fav-row')
    check('Favoriet en alert blijven bewaard na herladen', ev("state.favorites.length===1 && state.alerts.length===1"))
    check('Bewaard-teller op tabblad', ev("document.querySelector('#savedCount').textContent")=='2')

    # 9. Kaart
    page.goto(URL + '#kaart'); page.wait_for_selector('#mapMarkers .mk')
    nm = ev("document.querySelectorAll('#mapMarkers .mk[role=button]').length")
    check('Kaart toont prijs-stippen', nm > 30, f'{nm} bestemmingen met prijs')
    ev("selectMapDest('parijs')")
    check('Klik op bestemming toont deals', 'Parijs' in ev("document.querySelector('#destPanel h3').textContent") and ev("document.querySelectorAll('#destPanel .mini-deal').length") >= 3)
    page.click('#mapZoomIn')
    check('Inzoomen werkt', ev("MAPV.w < MAP.W"))

    # 10. Kalender en weekend
    page.goto(URL + '#kalender'); page.wait_for_selector('.cal-grid')
    page.select_option('#calFrom', 'EIN'); page.select_option('#calMonth', '2026-12')
    page.wait_for_timeout(300)
    nd = ev("document.querySelectorAll('.cal-day[data-deal]').length")
    check('Kalender Eindhoven, december: dagen met gecontroleerde deals', nd >= 6, f'{nd} dagen')
    page.click('#calWeekend'); page.wait_for_selector('#weekendOut .weekend-list li')
    check('Goedkoopste weekend geeft resultaten', ev("document.querySelectorAll('#weekendOut .weekend-list li').length") > 3)
    page.select_option('#calTo', 'barcelona')
    page.wait_for_timeout(200)
    check('Zonder live koppeling: duidelijke uitleg, geen verzonnen prijzen', 'Geen prijs per dag zonder live koppeling' in ev("document.querySelector('#calNotice').textContent") and ev("document.querySelectorAll('.cal-day .p').length")==0)
    page.click('[data-cal="demo"]'); page.wait_for_timeout(200)
    check('Demo-kalender is duidelijk gemarkeerd', ev("!!document.querySelector('.demo-mark') && /DEMO/.test(document.querySelector('#calNotice').textContent) && [...document.querySelectorAll('.cal-day .tag')].every(t=>t.textContent==='demo')"))
    page.click('[data-cal="nodemo"]')

    # 11. Vergelijken
    page.goto(URL + '#vergelijk'); page.wait_for_selector('.cmp')
    cols = ev("[...document.querySelectorAll('.cmp')].map(c=>c.dataset.mode+':'+(c.querySelector('.total')?c.querySelector('.total').textContent:'-'))")
    check('Vergelijk Parijs: trein, vliegtuig en bus', len(cols) == 3, ', '.join(cols))
    check('Winnaars gemarkeerd (goedkoopst/snelst/groenst)', ev("['Goedkoopst','Snelst','Groenst'].every(w=>document.querySelector('#cmpGrid').textContent.includes(w))"))
    page.select_option('#cmpBag', 'trolley')
    check('Bagagekosten tellen mee bij het vliegtuig', '€' in ev("[...document.querySelectorAll('.cmp[data-mode=vliegtuig] td')].map(t=>t.textContent).join(' ')"))

    # 12. Live koppelingen (nagebootst)
    page.goto(URL + '#deals'); page.wait_for_selector('.deal')
    ev("settings.nsKey='test-ns'; settings.tpToken='test-tp'; saveSettings()")
    ev("scan()"); page.wait_for_function("!state.scanning", timeout=20000)
    check('NS API: stations en ritten verwerkt', calls['ns_st'] >= 1 and calls['ns_trip'] >= 3 and ev("state.src.ns.status")=='ok', f"{calls['ns_trip']} ritten; {ev('state.src.ns.text')}")
    check('NS-prijs en -tijd in deur-tot-deur', re.search(r'met NS: 27 min, €\s?9,30', ev("document.querySelector('#dealGrid').textContent").replace('\u00a0',' ')) is not None)
    check('Travelpayouts: live vluchten toegevoegd met Live-label', ev("state.liveDeals.length>0 && document.querySelectorAll('.badge.live').length>0"), f"{ev('state.liveDeals.length')} live vluchten")
    check('Live deal heeft bron, tijdstip en boeklink (Aviasales)', ev("(()=>{const e=state.liveDeals[0]; return e.srcLive.url.startsWith('https://') && bookLink(e).url.startsWith('https://www.aviasales.com/search/')})()"))
    check('Live deal zegt eerlijk: opgehaald + cache van 48 uur', ev("(()=>{const c=[...document.querySelectorAll('.deal')].find(d=>d.querySelector('.badge.live')); return !!c && /opgehaald \\d+ \\w+ 2026, \\d\\d:\\d\\d/.test(c.textContent) && c.textContent.includes('48 uur') && !/gecontroleerd \\d/.test(c.querySelector('.src-line').textContent)})()"))
    ev("setDest('barcelona')")
    check('Live deal naar Barcelona zichtbaar bij bestemming', ev("lastList.some(x=>x.e.status==='live' && x.e.to==='barcelona')"))
    ev("setDest('overal')")
    page.goto(URL + '#kalender'); page.wait_for_selector('.cal-grid')
    page.select_option('#calFrom', 'AMS'); page.select_option('#calMonth', '2026-12'); page.select_option('#calTo', 'barcelona')
    page.wait_for_function("document.querySelectorAll('.cal-day .p').length>=6", timeout=10000)
    check('Live prijskalender (grouped_prices) verwerkt', calls['tp_cal'] >= 1 and 'Live' in ev("document.querySelector('#calNotice').textContent"))
    best = ev("document.querySelector('.cal-day.best .d').textContent")
    check('Goedkoopste dag gemarkeerd', best == '7', f'dag {best}')
    # adres zoeken via PDOK
    page.goto(URL + '#deals'); page.wait_for_selector('.deal')
    page.fill('#inOrigin', 'Damrak 1')
    page.wait_for_selector('#sugOrigin li:has-text("Damrak 1")', timeout=5000)
    page.click('#sugOrigin li:has-text("Damrak 1")')
    check('Adres zoeken (PDOK) zet vertrekpunt', ev("state.origin.n").startswith('Damrak 1') and calls['pdok'] >= 1)
    # fouten netjes melden
    ev("settings.tpToken=''; settings.nsKey=''; saveSettings()")
    page.route('**/api.pdok.nl/**', lambda r, req: r.abort())
    page.fill('#inOrigin', 'Keizersgracht 9')
    page.wait_for_function("state.src.pdok.status==='error'", timeout=5000)
    check('Foutmelding als een bron niet bereikbaar is', 'verbinding' in ev("state.src.pdok.text").lower())
    ev("setOrigin({n:'Utrecht Centraal',lat:52.08758,lon:5.11117,kind:'station',uic:'8400621'})")

    # 13. Toegankelijkheid (axe-core) in licht en donker
    page.add_script_tag(path=NM + 'axe-core/axe.min.js')
    def axe():
        r = page.evaluate("async () => { const r = await axe.run(document, {resultTypes:['violations']}); return r.violations.map(v => ({id:v.id, impact:v.impact, n:v.nodes.length, t:v.nodes.slice(0,2).map(n=>n.target.join(' '))})); }")
        return r
    v_light = axe()
    ev("settings.theme='dark'; applyTheme()")
    v_dark = axe()
    ev("settings.theme='system'; applyTheme()")
    serious = [v for v in v_light + v_dark if v['impact'] in ('serious', 'critical')]
    check('Toegankelijkheid (axe-core): geen ernstige problemen, licht en donker', not serious, json.dumps(serious)[:600])
    print('axe licht:', json.dumps(v_light)[:500]); print('axe donker:', json.dumps(v_dark)[:500])

    check('Geen JavaScript-fouten tijdens alle tests', not errors, '; '.join(errors[:3]))

    # ===== 14. Claude-modus: database, connectors (Kiwi.com, lastminute.com), geschiedenis, Samen reizen =====
    # window.claude wordt nagebootst met dezelfde vorm als de echte runtime (db, mcp, user).
    FAKE = r"""
    (() => {
      const store = { runs: {}, searches: {}, alerts: {} }, subs = [];
      const T = h => '2026-11-10T' + h + ':00+01:00';
      store.runs['2026-11-09b'] = { t: '2026-11-09T23:00:00+01:00', deals: [{ id: 'flix-brussel', price: 7.49, checked: '2026-11-09T23:00:00+01:00' }] };
      store.runs['2026-11-10'] = { t: T('06:40'), summary: 'test', alertHits: [], deals: [
        { id: 'flix-brussel', price: 6.99, checked: T('06:40') },
        { id: 'kiwi-ams-sdr', mode: 'vliegtuig', provider: 'Vueling', from: 'AMS', arr: 'SDR', toCity: 'Santander', toCountry: 'Spanje', price: 44, trip: 'enkel', priceType: 'gevonden', out: '2026-12-12', depTime: '10:00', dur: 130, transfers: 0, bag: 'tasje', link: 'https://kiwi.com/u/test1', src: ['kiwi'], checked: T('06:41') } ] };
      const notify = () => subs.forEach(s => s());
      const query = (name, field, dir, n) => ({
        orderBy: (f, d) => query(name, f, d, n), limit: k => query(name, field, dir, k),
        onSnapshot(next) {
          const fire = () => { let docs = Object.entries(store[name] || {}).map(([id, d]) => ({ id, exists: true, data: () => d }));
            if (field) docs.sort((a, b) => (a.data()[field] < b.data()[field] ? 1 : -1) * (dir === 'desc' ? 1 : -1));
            if (n) docs = docs.slice(0, n); next({ docs, size: docs.length, empty: !docs.length }); };
          subs.push(fire); setTimeout(fire, 0); return () => {};
        },
        doc: id => ({ set: async d => { store[name][id] = d; notify(); }, delete: async () => { delete store[name][id]; notify(); } }),
        add: async d => { const id = 's' + Math.random().toString(36).slice(2); store[name][id] = d; notify(); return { id }; },
      });
      const db = { collection: name => { store[name] = store[name] || {}; return query(name); } };
      const calls = { kiwi: [], lm: [] };
      const itin = (from, to, city, price, dep, extra = {}) => ({ id: from + to, tripType: 'oneway', price, priceFormatted: price + ' EUR', totalDurationSeconds: 9000, bookingUrl: 'https://kiwi.com/u/' + from + to,
        baggage: { personalItem: 1, cabinBag: 0, checkedBag: 0 },
        outbound: { from, to, departureTime: dep, arrivalTime: dep, durationSeconds: 9000, stops: 0, route: [from, to], segments: [{ from, to, fromCity: 'X', toCity: city, toCountry: extra.country || 'Spanje', carrierName: 'Ryanair', flightNumber: 'FR1' }] }, inbound: null });
      const mcp = {
        listTools: async () => ({ servers: [{ server: 'Kiwi.com', authStatus: 'connected', tools: [{ name: 'search-flight' }] }, { server: 'lastminute.com', authStatus: 'connected', tools: [{ name: 'search_flights' }] }] }),
        callTool: async (server, tool, input) => {
          if (server === 'Kiwi.com') { calls.kiwi.push(input); return { payload: { itineraries: [itin(input.flyFrom, 'AGP', 'Málaga', 19, '2026-12-03T08:00:00'), itin(input.flyFrom, 'BIO', 'Bilbao', 29, '2026-12-05T09:30:00')] } }; }
          if (server === 'lastminute.com') { calls.lm.push(input); return { payload: { flights: [{ airline: 'Ryanair', departure: input.departure + ' 08:00', arrival: input.arrival + ' 10:30', price_amount: 1799, deeplink: 'https://nl.lastminute.com/test' }] } }; }
          const e = new Error('nee'); e.code = 'server_not_connected'; throw e;
        },
      };
      const user = { isOwner: async () => true, id: async () => 'u1' };
      window.__fake = { store, calls };
      window.claude = { use: async n => ({ db, mcp, user }[n] || null) };
    })();
    """
    ctx2 = browser.new_context(viewport={'width': 1280, 'height': 900}, locale='nl-NL', timezone_id='Europe/Amsterdam')
    ctx2.route('**/*', route_all)
    ctx2.add_init_script(FAKE)
    p2 = ctx2.new_page()
    errs2 = []
    p2.on('console', lambda m: errs2.append(m.text) if m.type == 'error' and 'net::' not in m.text and 'Failed to load resource' not in m.text else None)
    p2.on('pageerror', lambda e: errs2.append(str(e)))
    p2.goto(URL + '#deals')
    p2.wait_for_selector('.deal')
    p2.wait_for_function("state.liveKiwi.length > 0 && SNAP.some(e => e.id === 'kiwi-ams-sdr')", timeout=15000)
    e2 = p2.evaluate
    check('Claude-modus: dagelijkse controle ververst gecontroleerde deals', e2("SNAP.find(e=>e.id==='flix-brussel').price===6.99 && /2026-11-10/.test(SNAP.find(e=>e.id==='flix-brussel').checked)"))
    check('Prijsgeschiedenis: 3 controles voor Amsterdam–Brussel, met sparkline op de kaart', e2("histStats('flix-brussel').n===3 && histStats('flix-brussel').isLow && !!document.querySelector('.deal[data-id=\"flix-brussel\"] .spark')"), str(e2("histStats('flix-brussel') && histStats('flix-brussel').a.map(x=>x.p)")))
    e2("openDealDialog(dealById('flix-brussel'))")
    check('Detailvenster toont prijsgeschiedenis als grafiek', p2.locator('#dlgDealBody .hist-chart circle.pt').count() == 3)
    p2.keyboard.press('Escape')
    check('Onbekend vliegveld (Santander) wordt een nieuwe bestemming met echte coördinaten', e2("!!DEST['x-santander'] && DEST['x-santander'].lat>43 && DEST['x-santander'].lat<44"))
    check('Kiwi.com live: vluchten met Live-label en Kiwi-boeklink', e2("state.liveKiwi.length>=2 && state.liveKiwi.every(e=>e.status==='live' && bookLink(e).url.startsWith('https://kiwi.com/u/'))") and p2.locator('.deal .badge.live').count() > 0, f"{e2('state.liveKiwi.length')} live, {e2('window.__fake.calls.kiwi.length')} zoekopdrachten")
    check('Kiwi.com: zoekt vanaf de dichtstbijzijnde vliegvelden (Utrecht → Schiphol en Rotterdam)', e2("window.__fake.calls.kiwi.map(c=>c.flyFrom).slice(0,2).join(',')") == 'AMS,RTM', e2("window.__fake.calls.kiwi.map(c=>c.flyFrom).join(',')"))
    check('Eigen zoekopdracht wordt in de database bewaard (geschiedenis groeit)', e2("Object.keys(window.__fake.store.searches).length>=1"))
    e2("openDealDialog(state.liveKiwi.find(e=>e.arr==='AGP'))")
    p2.click('#btnCmpLm')
    p2.wait_for_function("document.querySelector('#cmpLmOut').textContent.includes('lastminute.com:')", timeout=5000)
    check('Vergelijk bij lastminute.com: zelfde route en datum, met verschil', 'goedkoper' in p2.inner_text('#cmpLmOut') and e2("window.__fake.calls.lm[0].start_date") == '2026-12-03', p2.inner_text('#cmpLmOut')[:120])
    p2.keyboard.press('Escape')
    e2("addAlert('malaga','vliegtuig',30)")
    p2.wait_for_timeout(200)
    check('Prijsalert wordt in de database bewaard (voor de dagelijkse controle)', e2("Object.values(window.__fake.store.alerts).some(a=>a.dest==='malaga' && a.max===30)"))
    check('Topdeals: rij met minstens 3 deals, één per bestemming', e2("!document.querySelector('#topDeals').hidden && document.querySelectorAll('#topDeals .top-card').length>=3 && new Set([...document.querySelectorAll('#topDeals .top-card')].map(b=>dealById(b.dataset.open).to)).size===document.querySelectorAll('#topDeals .top-card').length"))
    check('Radar toont Kiwi.com en de dagelijkse controle', 'Kiwi.com live' in p2.inner_text('#radarList') and 'Dagelijkse controle: dagelijks' in p2.inner_text('#radarList'))
    # Samen reizen
    p2.goto(URL + '#samen'); p2.wait_for_selector('#people .person')
    e2("state.group=[{name:'Roy',place:{n:'Utrecht Centraal',lat:52.08758,lon:5.11117,kind:'station',uic:'8400621'}},{name:'Sam',place:{n:'Eindhoven Centraal',lat:51.44306,lon:5.47995,kind:'station',uic:'8400206'}}]; renderPeople(); renderGroup()")
    rows = e2("groupResults().rows.length")
    tot_ok = e2("(()=>{const r=groupResults().rows[0]; return Math.abs(r.total - r.arr.reduce((s,a)=>s+a.e.perDir,0))<0.001 && r.arr.length===2})()")
    check('Samen reizen: bestemmingen voor iedereen, totaal = som per persoon', rows > 5 and tot_ok and p2.locator('#groupResults .gcard').count() > 0, f'{rows} bestemmingen')
    e2("document.querySelector('#groupSort').value='eerlijk'; document.querySelector('#groupSort').dispatchEvent(new Event('change'))")
    check('Samen reizen: "eerlijkst" sorteert op het kleinste prijsverschil', e2("(()=>{const r=groupResults().rows; return r.every((x,i)=>i===0||r[i-1].spread<=x.spread)})()"))
    check('Samen reizen: Details opent deur-tot-deur vanaf het eigen vertrekpunt', (lambda: (p2.click('#groupResults .gcard [data-who="1"]'), 'vanaf Eindhoven Centraal' in p2.inner_text('#dlgDealBody'))[1])())
    p2.keyboard.press('Escape')
    check('Claude-modus: geen JavaScript-fouten', not errs2, '; '.join(errs2[:3]))
    ctx2.close()

    # ===== 15. App-versie (PWA): manifest, service worker en offline openen =====
    ctx3 = browser.new_context(viewport={'width': 390, 'height': 844}, locale='nl-NL', timezone_id='Europe/Amsterdam', service_workers='allow')
    ctx3.route('**/*', lambda r, req: r.abort() if 'fonts.g' in req.url else r.continue_())
    p3 = ctx3.new_page()
    errs3 = []
    p3.on('pageerror', lambda e: errs3.append(str(e)))
    p3.goto(f'http://127.0.0.1:{PORT}/pwa/index.html')
    p3.wait_for_selector('.deal')
    sw_ok = p3.evaluate("navigator.serviceWorker.ready.then(r => !!r.active)")
    man = p3.evaluate("fetch('manifest.webmanifest').then(r=>r.json())")
    check('App-versie: manifest met naam, iconen en standalone', man.get('display') == 'standalone' and len(man.get('icons', [])) >= 3 and man.get('short_name') == 'DealRadar')
    check('App-versie: service worker actief', sw_ok)
    p3.wait_for_timeout(800)
    ctx3.set_offline(True)
    p3.reload(); p3.wait_for_selector('.deal', timeout=8000)
    check('App-versie: werkt offline (opnieuw laden zonder internet)', p3.locator('.deal').count() > 30 and p3.evaluate("document.body.classList.contains('offline')"))
    ctx3.set_offline(False)
    check('App-versie: geen JavaScript-fouten', not errs3, '; '.join(errs3[:3]))
    ctx3.close()
    browser.close()
srv.shutdown()
ok = sum(1 for r in results if r[1]); print(f'\n{ok}/{len(results)} tests geslaagd')
json.dump([{'test': n, 'ok': o, 'info': i} for n, o, i in results], open('/home/claude/build/test_results.json', 'w'), ensure_ascii=False, indent=1)
