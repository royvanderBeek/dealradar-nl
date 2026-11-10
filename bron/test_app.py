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
    today = ev('todayISO()')

    # 1. Laden
    n = ev("document.querySelectorAll('#dealGrid .deal').length")
    snap = ev('SNAP.length')
    check('Pagina laadt zonder JavaScript-fouten', not errors, '; '.join(errors[:3]))
    check('Deals zichtbaar bij openen (eerste 24, rest achter "Toon meer")', n == 24 and snap > 150, f'{n} kaarten, {snap} in snapshot')
    check('Jongerentarieven standaard verborgen (met melding)', ev("!lastList.some(x=>x.e.who==='jongeren') && /jongerentarie/.test(document.querySelector('#dealHints').textContent)"))

    # 2. Elke kaart: bron, link, tijdstip, boeklink
    card_ok = ev("""[...document.querySelectorAll('#dealGrid .deal')].every(c => {
        const src = c.querySelector('.src-line a'); const book = c.querySelector('.card-actions a.btn');
        return src && /^https:\\/\\//.test(src.href) && /gecontroleerd \\d+ \\w+ 2026, \\d\\d:\\d\\d/.test(c.querySelector('.src-line').textContent) && book && /^https:\\/\\//.test(book.href) && book.target==='_blank'; })""")
    check('Elke deal heeft bron-link, controle-tijdstip en boeklink', card_ok)
    check('Alle bronnen in de data zijn https-links', ev("Object.values(SRC).every(s=>/^https:\\/\\//.test(s.url))"))
    check('Elke snapshot-deal verwijst naar een bestaande bron', ev("SNAPSHOT_DEALS.every(d=>d.src.length && d.src.every(k=>SRC[k]))"))

    # 3. Sorteren
    for key, expr in [('prijs', 'x.tp.p'), ('snel', 'x.dd.total'), ('groen', 'x.e.co2One'), ('score', 'x.s'), ('per100', 'per100(x.e)'), ('datum', "(x.e.out||'9999')")]:
        page.select_option('#sortSel', key)
        ok = ev(f"(() => {{ const v = lastList.map(x => {expr}); return v.every((a,i)=> i===0 || (typeof a === 'string' ? v[i-1] <= a : v[i-1] <= a + 1e-9)); }})()")
        check(f'Sorteren op "{key}" klopt', ok)
    page.select_option('#sortSel', 'prijs')
    first = ev("lastList[0].e.id + ' ' + lastList[0].tp.p")
    check('Goedkoopste deal bovenaan', first.startswith('flix-brussel'), first)

    # 4. Filters
    ev("state.filters.modes.delete('vliegtuig'); renderAll()")
    check('Filter vervoer: geen vliegtuig meer', ev("lastList.length>0 && !lastList.some(x=>x.e.mode==='vliegtuig')"))
    ev("state.filters = defaultFilters(); state.filters.maxPrice = 50; renderAll()")
    check('Filter maximumprijs €50 (getoonde prijs)', ev("lastList.length>0 && lastList.every(x=>x.tp.p<=50)"), f"{ev('lastList.length')} deals")
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
    check('Telefoon: reizigers, verblijf en bagage staan achter "Meer opties"', not page.is_visible('#inProfile'))
    page.click('#btnMoreOpts')
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
    check('Retourprijs per richting = prijs / 2', abs(e2['perDir'] - 18) < 1e-9)
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
    ev("setTrip('enkel'); renderAll()")  # live vluchtprijzen van Travelpayouts zijn enkele reizen
    ev("settings.nsKey='test-ns'; settings.tpToken='test-tp'; saveSettings()")
    ev("scan()"); page.wait_for_function("!state.scanning", timeout=20000)
    check('NS API: stations en ritten verwerkt', calls['ns_st'] >= 1 and calls['ns_trip'] >= 3 and ev("state.src.ns.status")=='ok', f"{calls['ns_trip']} ritten; {ev('state.src.ns.text')}")
    check('NS-prijs en -tijd in deur-tot-deur', re.search(r'met NS: 27 min, €\s?9,30', ev("document.querySelector('#dealGrid').textContent").replace('\u00a0',' ')) is not None)
    ev("setDest('barcelona')")
    check('Travelpayouts: live vluchten toegevoegd met Live-label', ev("state.liveDeals.length>0 && document.querySelectorAll('.badge.live').length>0"), f"{ev('state.liveDeals.length')} live vluchten")
    check('Live deal heeft bron, tijdstip en boeklink (Aviasales)', ev("(()=>{const e=state.liveDeals[0]; return e.srcLive.url.startsWith('https://') && bookLink(e).url.startsWith('https://www.aviasales.com/search/')})()"))
    check('Live deal zegt eerlijk: opgehaald + cache van 48 uur', ev("(()=>{const c=[...document.querySelectorAll('.deal')].find(d=>d.querySelector('.badge.live')); return !!c && /opgehaald \\d+ \\w+ 2026, \\d\\d:\\d\\d/.test(c.textContent) && c.textContent.includes('48 uur') && !/gecontroleerd \\d/.test(c.querySelector('.src-line').textContent)})()"))
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
      const T = h => '2026-11-11T' + h + ':00+01:00';
      store.runs['2026-11-10b'] = { t: '2026-11-10T23:00:00+01:00', deals: [{ id: 'flix-brussel', price: 7.49, checked: '2026-11-10T23:00:00+01:00' }] };
      store.runs['2026-11-11'] = { t: T('06:40'), summary: 'test', alertHits: [], deals: [
        { id: 'flix-brussel', price: 6.99, checked: T('06:40') },
        { id: 'kiwi-ein-opo-r', from: 'EIN', arr: 'OPO', toCity: 'Porto', toCountry: 'Portugal', price: 61.5, out: '2026-12-12', depTime: '07:10', dur: 160, flight: 'FR100', provider: 'Ryanair', link: 'https://kiwi.com/u/test2', checked: T('06:42'), back: '2026-12-16', backTime: '20:05', backDur: 165, backFlight: 'FR101' },
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
      const addDaysISO = (iso, n) => { const d = new Date(iso.slice(0, 10) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
      const ret = (it, nights, cabin) => { const back = addDaysISO(it.outbound.departureTime, nights) + 'T18:15:00'; const o = it.outbound;
        return { ...it, tripType: 'return', price: it.price * 2 + (cabin ? 30 : 0), baggage: { personalItem: 1, cabinBag: cabin ? 1 : 0, checkedBag: 0 },
          inbound: { from: o.to, to: o.from, departureTime: back, arrivalTime: back, durationSeconds: 9600, stops: 0, route: [o.to, o.from], segments: [{ from: o.to, to: o.from, fromCity: 'Y', toCity: 'X', carrierName: 'Ryanair', flightNumber: 'FR2' }] } }; };
      const mcp = {
        listTools: async () => ({ servers: [{ server: 'Kiwi.com', authStatus: 'connected', tools: [{ name: 'search-flight' }] }, { server: 'lastminute.com', authStatus: 'connected', tools: [{ name: 'search_flights' }] }] }),
        callTool: async (server, tool, input) => {
          if (server === 'Kiwi.com') { calls.kiwi.push(input);
            let list = [itin(input.flyFrom, 'AGP', 'Málaga', 19, '2026-12-03T08:00:00'), itin(input.flyFrom, 'BIO', 'Bilbao', 29, '2026-12-05T09:30:00')];
            const isRet = input.nights_in_dst_from != null || input.returnDate;
            if (isRet) list = list.map(it => ret(it, input.nights_in_dst_from != null ? Math.max(input.nights_in_dst_from, 3) : 3, !!input.adults_hand_bags));
            return { payload: { itineraries: list } }; }
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
    check('Claude-modus: dagelijkse controle ververst gecontroleerde deals', e2("SNAP.find(e=>e.id==='flix-brussel').price===6.99 && /2026-11-11/.test(SNAP.find(e=>e.id==='flix-brussel').checked)"))
    check('Prijsgeschiedenis: 3 controles voor Amsterdam–Brussel, met sparkline op de kaart', e2("histStats('flix-brussel').n===3 && histStats('flix-brussel').isLow && !!document.querySelector('.deal[data-id=\"flix-brussel\"] .spark')"), str(e2("histStats('flix-brussel') && histStats('flix-brussel').a.map(x=>x.p)")))
    e2("openDealDialog(dealById('flix-brussel'))")
    check('Detailvenster toont prijsgeschiedenis als grafiek', p2.locator('#dlgDealBody .hist-chart circle.pt').count() == 3)
    p2.keyboard.press('Escape')
    check('Dagelijkse controle: korte retour-rij wordt een volledige deal (soort reis, nachten, bron, uitleg)', e2("(()=>{const e=SNAP.find(d=>d.id==='kiwi-ein-opo-r'); return !!e && e.mode==='vliegtuig' && e.trip==='retour' && e.nights===4 && e.perDir===30.75 && e.to==='porto' && e.bag==='tasje' && srcOf(e).url.startsWith('https://') && /dagelijkse controle/.test(e.note) && /FR101/.test(e.note) && bookLink(e).url==='https://kiwi.com/u/test2'})()"))
    check('Onbekend vliegveld (Santander) wordt een nieuwe bestemming met echte coördinaten', e2("!!DEST['x-santander'] && DEST['x-santander'].lat>43 && DEST['x-santander'].lat<44"))
    check('Retour is de standaard: live zoeken vraagt retourvluchten (2 tot 7 nachten) op', e2("window.__fake.calls.kiwi[0].nights_in_dst_from===2 && window.__fake.calls.kiwi[0].nights_in_dst_to===7 && state.liveKiwi.every(e=>e.trip==='retour' && e.back>e.out && e.nights===3 && e.backFlight==='FR2')"))
    e2("setDest('malaga')")
    card = p2.locator('.deal[data-id="kiwi-ams-agp-r"]')
    check('Retourkaart: heen en terug met datum en tijd, aantal nachten en prijs per richting', card.count() == 1 and 'heen' in card.inner_text().lower() and 'terug' in card.inner_text().lower() and '3 nachten' in card.inner_text() and 'retour p.p.' in card.inner_text() and '38' in card.locator('.price').inner_text(), card.inner_text()[:160].replace('\n', ' | ') if card.count() else 'kaart ontbreekt')
    e2("openDealDialog(dealById('kiwi-ams-agp-r'))")
    dlg = p2.inner_text('#dlgDealBody')
    check('Details retour: terugreis, reisdocument en knop om de prijs live te controleren', 'Terugreis' in dlg and 'FR2' in dlg and 'ID-kaart' in dlg and p2.locator('#btnVerify').count() == 1)
    p2.click('#btnVerify'); p2.wait_for_function("document.querySelector('#verifyOut').textContent.includes('Live gecontroleerd')", timeout=5000)
    vq = e2("window.__fake.calls.kiwi[window.__fake.calls.kiwi.length-1]")
    check('Prijs live nacontroleren: zelfde vlucht en data, "klopt nog"', 'klopt nog' in p2.inner_text('#verifyOut') and vq.get('departureDate') == '03/12/2026' and vq.get('returnDate') == '06/12/2026' and vq.get('flyTo') == 'AGP', p2.inner_text('#verifyOut')[:100])
    p2.keyboard.press('Escape')
    e2("setDest('overal')")
    p2.select_option('#inBag', 'hand'); p2.click('#btnScan'); p2.wait_for_function("!state.scanning && state.liveKiwi.some(e=>e.bag==='hand')", timeout=10000)
    check('Bagage: live zoeken vraagt de prijs met handbagagekoffer op (aparte deal, eigen prijs)', e2("(()=>{const c=window.__fake.calls.kiwi; const e=dealById('kiwi-ams-agp-r-hb'); return Array.isArray(c[c.length-1].adults_hand_bags) && !!e && e.price===68 && e.bag==='hand' && dealById('kiwi-ams-agp-r').price===38})()"))
    p2.select_option('#inBag', 'tasje')
    p2.click('.trip-tabs [data-trip="enkel"]')
    p2.wait_for_function("!state.scanning && state.liveKiwi.some(e=>e.trip==='enkel')", timeout=10000)
    check('Enkele reis: live zoeken zonder nachten, lijst toont alleen enkele reizen', e2("(()=>{const c=window.__fake.calls.kiwi; return c[c.length-1].nights_in_dst_from===undefined && lastList.length>0 && lastList.every(x=>x.e.trip==='enkel')})()"))
    check('Kiwi.com live: vluchten met Live-label en Kiwi-boeklink', e2("state.liveKiwi.length>=2 && state.liveKiwi.every(e=>e.status==='live' && bookLink(e).url.startsWith('https://kiwi.com/u/'))") and p2.locator('.deal .badge.live').count() > 0, f"{e2('state.liveKiwi.length')} live, {e2('window.__fake.calls.kiwi.length')} zoekopdrachten")
    check('Kiwi.com zoekt de hele wereld af: Europa, Afrika, Azië, Noord- en Zuid-Amerika, ver weg met 1 overstap en langer verblijf', e2("(()=>{const c=window.__fake.calls.kiwi; const to=new Set(c.map(x=>x.flyTo)); const far=c.find(x=>x.flyTo==='Asia'); return ['Europe','Africa','Asia','North America','South America'].every(r=>to.has(r)) && far.flyFrom==='AMS' && far.max_sector_stopovers===1 && far.nights_in_dst_from===5 && far.nights_in_dst_to===16})()"), e2("[...new Set(window.__fake.calls.kiwi.map(x=>x.flyFrom+'>'+x.flyTo))].join(' ')")[:160])
    check('Kiwi.com: zoekt vanaf de dichtstbijzijnde vliegvelden (Utrecht → Schiphol en Rotterdam)', e2("window.__fake.calls.kiwi.map(c=>c.flyFrom).slice(0,2).join(',')") == 'AMS,RTM', e2("window.__fake.calls.kiwi.map(c=>c.flyFrom).join(',')"))
    check('Eigen zoekopdracht wordt in de database bewaard (geschiedenis groeit)', e2("Object.keys(window.__fake.store.searches).length>=1"))
    e2("openDealDialog(state.liveKiwi.find(e=>e.arr==='AGP' && e.trip==='enkel'))")
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
    tot_ok = e2("(()=>{const r=groupResults().rows[0]; return Math.abs(r.total - r.arr.reduce((s,a)=>s+a.tp.p,0))<0.001 && r.arr.length===2})()")
    check('Samen reizen: bestemmingen voor iedereen, totaal = som per persoon', rows > 5 and tot_ok and p2.locator('#groupResults .gcard').count() > 0, f'{rows} bestemmingen')
    e2("document.querySelector('#groupSort').value='eerlijk'; document.querySelector('#groupSort').dispatchEvent(new Event('change'))")
    check('Samen reizen: "eerlijkst" sorteert op het kleinste prijsverschil', e2("(()=>{const r=groupResults().rows; return r.every((x,i)=>i===0||r[i-1].spread<=x.spread)})()"))
    check('Samen reizen: Details opent deur-tot-deur vanaf het eigen vertrekpunt', (lambda: (p2.click('#groupResults .gcard [data-who="1"]'), 'vanaf Eindhoven Centraal' in p2.inner_text('#dlgDealBody'))[1])())
    p2.keyboard.press('Escape')
    check('Claude-modus: geen JavaScript-fouten', not errs2, '; '.join(errs2[:3]))
    ctx2.close()


    # ===== 16. Versie 3: retour, verblijf, vakanties, datums, weergave, ideeën en controle van alle data =====
    ctx4 = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='nl-NL', timezone_id='Europe/Amsterdam', has_touch=True)
    ctx4.route('**/*', route_all)
    p4 = ctx4.new_page(); errs4 = []
    p4.on('pageerror', lambda e: errs4.append(str(e)))
    p4.on('console', lambda m: errs4.append('console: ' + m.text) if m.type == 'error' and 'net::' not in m.text and 'Failed to load resource' not in m.text else None)
    p4.goto(URL + '#deals'); p4.wait_for_selector('.deal')
    e4 = p4.evaluate
    check('Retour (standaard): alleen echte retourprijzen of berekend 2 × de vanafprijs', e4("state.trip==='retour' && lastList.length>40 && lastList.every(x => x.e.trip==='retour' ? (!x.tp.calc && x.tp.p===x.e.price) : (!x.e.out && x.tp.calc && Math.abs(x.tp.p-2*x.e.price)<1e-9))"), f"{e4('lastList.length')} deals, {e4('lastList.filter(x=>x.tp.calc).length')} berekend")
    check('Berekende retourprijs staat duidelijk op de kaart', e4("(()=>{const c=document.querySelector('.deal[data-id=\"flix-brussel\"]'); return !!c && /berekend/.test(c.querySelector('.price-note').textContent) && /16,38/.test(c.querySelector('.price').textContent)})()"))
    check('Uitleg onder de telling noemt retourprijzen en de verborgen enkele vluchten', 'Retourprijzen' in p4.inner_text('#dealHints') and 'Toon enkele reizen' in p4.inner_text('#dealHints'))
    rr = e4("lastList.filter(x=>x.e.trip==='retour' && x.e.mode==='vliegtuig').map(x=>x.e)")
    check('Elke retourvlucht heeft heen- en terugdatum, en het aantal nachten klopt', len(rr) >= 40 and all(r['back'] > r['out'] and r['nights'] == (__import__('datetime').date.fromisoformat(r['back']) - __import__('datetime').date.fromisoformat(r['out'])).days for r in rr), f'{len(rr)} retourvluchten')
    p4.click('.trip-tabs [data-trip="enkel"]')
    check('Enkele reis: alleen prijzen die je los kunt kopen', e4("state.trip==='enkel' && lastList.length>60 && lastList.every(x=>x.e.trip==='enkel' && x.tp.p===x.e.price)"), f"{e4('lastList.length')} deals")
    check('Keuze enkele reis/retour wordt onthouden', e4("store.get('trip')==='enkel'"))
    p4.click('.trip-tabs [data-trip="retour"]')
    p4.click('#btnMoreOpts'); p4.select_option('#inStay', 'kort')
    check('Verblijf "kort": retourvluchten van 1 tot 4 nachten', e4("(()=>{const d=lastList.filter(x=>x.e.nights!=null); return d.length>3 && d.every(x=>x.e.nights>=1 && x.e.nights<=4)})()"), f"{e4('lastList.filter(x=>x.e.nights!=null).length')} vluchten")
    p4.select_option('#inStay', 'week')
    check('Verblijf "week": 5 tot 9 nachten', e4("(()=>{const d=lastList.filter(x=>x.e.nights!=null); return d.length>10 && d.every(x=>x.e.nights>=5 && x.e.nights<=9)})()"))
    p4.select_option('#inStay', 'alle')
    p4.click('.seg [data-when="holiday"]')
    check('Schoolvakantie: kerstvakantie 19 dec 2026 t/m 3 jan 2027, met bron', e4("holidayRange('kerst').from==='2026-12-19' && holidayRange('kerst').to==='2027-01-03'") and 'Rijksoverheid' in p4.inner_text('#whenHint') and '3 jan' in p4.inner_text('#whenHint'))
    check('Kerstvakantie: vertrek vanaf 18 dec en uiterlijk 3 jan terug', e4("(()=>{const d=lastList.filter(x=>x.e.out); return d.length>=2 && d.every(x=>x.e.out>='2026-12-18' && x.e.out<='2027-01-03' && (!x.e.back || x.e.back<='2027-01-03'))})()"), f"{e4('lastList.filter(x=>x.e.out).length')} vluchten met datum")
    check('Voorjaarsvakantie verschilt per regio (zuid een week eerder)', e4("holidayRange('voorjaar','zuid').from==='2027-02-13' && holidayRange('voorjaar','midden').from==='2027-02-20' && holidayRange('zomer','noord').from==='2027-07-10'"))
    p4.click('.seg [data-when="range"]')
    p4.fill('#inFrom', '2026-12-01'); p4.dispatch_event('#inFrom', 'change'); p4.fill('#inTo', '2026-12-15'); p4.dispatch_event('#inTo', 'change')
    check('Eigen datums: vertrek vanaf 1 dec, uiterlijk 15 dec terug', e4("(()=>{const d=lastList.filter(x=>x.e.out); return d.length>3 && d.every(x=>x.e.out>='2026-12-01' && x.e.back<='2026-12-15')})()"), f"{e4('lastList.filter(x=>x.e.out).length')} vluchten")
    p4.click('.seg [data-when="flex"]')
    ids = e4("[...document.querySelectorAll('#dealGrid .deal')].map(c=>dealById(c.dataset.id).to)")
    check('Eén deal per bestemming: geen dubbele bestemmingen, met "andere opties"', len(ids) == len(set(ids)) and p4.locator('.more-opts').count() > 3 and 'bestemmingen' in p4.inner_text('#summary'))
    before = p4.locator('#dealGrid .deal').count()
    p4.click('#btnMore')
    check('"Toon meer" laat de volgende bestemmingen zien', p4.locator('#dealGrid .deal').count() > before, f"{before} → {p4.locator('#dealGrid .deal').count()}")
    p4.click('.more-opts >> nth=0')
    check('"Andere opties" opent alle deals naar die bestemming', e4("state.dest!=='overal' && lastList.length>1 && lastList.every(x=>x.e.to===state.dest)"))
    e4("setDest('overal')")
    p4.click('#btnPerDest')
    ids2 = e4("lastList.slice(0,24).map(x=>x.e.to)")
    check('Per bestemming uit: alle deals los', len(ids2) > len(set(ids2)) and e4("state.perDest===false"))
    p4.click('#btnPerDest'); p4.click('#btnLayout')
    check('Compacte lijst: één regel per deal, tik opent details', p4.locator('#dealGrid .deal-row').count() == 24 and p4.locator('#dealGrid .deal').count() == 0)
    p4.click('#dealGrid .deal-row >> nth=0'); p4.wait_for_selector('#dlgDeal[open]')
    check('Details van een berekende retour: uitleg 2 × enkele reis', 'berekend' in p4.inner_text('#dlgDealBody') and 'Reisdocument' in p4.inner_text('#dlgDealBody'))
    p4.keyboard.press('Escape'); p4.click('#btnLayout')
    tiles = e4("[...document.querySelectorAll('#inspire .tile')].map(t=>t.dataset.tile)")
    check('Ideeën: tegels met echte aantallen en vanafprijs', len(tiles) >= 6 and 'trein' in tiles and 'kerst' in tiles, ', '.join(tiles))
    p4.click('#inspire [data-tile="trein"]')
    check('Tegel "Met de trein": alleen treinen', e4("lastList.length>5 && lastList.every(x=>x.e.mode==='trein')"))
    tp_txt = p4.inner_text('#inspire [data-tile="zon"] .tile-p')
    p4.click('#inspire [data-tile="zon"]')
    check('Tegel "Naar de zon": alleen strandbestemmingen, vanafprijs klopt met de lijst', e4("lastList.length>5 && lastList.every(x=>x.e.dest.t.includes('strand'))") and e4("eur(lastList[0].tp.p)").replace(' ', ' ') in tp_txt.replace(' ', ' '), tp_txt)
    e4("state.filters = defaultFilters(); state.filters.nlOnly = true; renderAll()")
    check('Filter "Alleen vertrek in Nederland": geen Weeze of Charleroi', e4("lastList.length>20 && lastList.every(x=>!x.e.o.abroad)"))
    e4("state.filters = defaultFilters(); state.filters.origins.add('EIN'); renderAll()")
    check('Filter vertrekpunt: alleen Eindhoven Airport', e4("lastList.length>5 && lastList.every(x=>x.e.from==='EIN')") and p4.locator('#fOrigins input').count() >= 8)
    e4("state.filters = defaultFilters(); state.filters.depPart = 'ochtend'; renderAll()")
    check('Filter vertrektijd: ochtend', e4("(()=>{const d=lastList.filter(x=>x.e.depTime); return d.length>5 && d.every(x=>+x.e.depTime.slice(0,2)<12)})()"))
    e4("state.filters = defaultFilters(); state.filters.noIndic = true; renderAll()")
    check('Indicaties (Skyscanner) zijn gemarkeerd en te verbergen', e4("lastList.every(x=>!x.e.indic) && SNAP.filter(e=>e.indic).length>=30 && SNAP.filter(e=>e.indic).every(e=>e.src.some(k=>k.startsWith('sky')))"))
    e4("state.filters = defaultFilters(); renderAll()")
    # Hele wereld
    check('Standaard zoek je in de hele wereld: ook deals buiten Europa', e4("state.reach==='wereld' && lastList.filter(x=>contOf(x.e.dest)!=='EU').length>=20"), f"{e4('lastList.filter(x=>contOf(x.e.dest)!==\'EU\').length')} deals buiten Europa")
    p4.select_option('#inReach', 'europa')
    check('Hoe ver: alleen Europa', e4("lastList.length>60 && lastList.every(x=>contOf(x.e.dest)==='EU')"))
    p4.select_option('#inReach', 'ver')
    far = e4("lastList.map(x=>x.e.dest.n+' ('+contOf(x.e.dest)+')')")
    check('Hoe ver: buiten Europa (Afrika, Azië, Amerika) en de wereldkaart gaat aan', len(far) >= 20 and e4("lastList.every(x=>contOf(x.e.dest)!=='EU') && ['AF','AS','NA'].every(c=>lastList.some(x=>contOf(x.e.dest)===c)) && MAPMODE==='world'"), ', '.join(sorted(set(far)))[:200])
    p4.select_option('#inReach', 'AF')
    check('Hoe ver: één werelddeel (Afrika: Marokko en Egypte)', e4("lastList.length>=9 && lastList.every(x=>['MA','EG'].includes(x.e.dest.cc))"))
    p4.select_option('#inReach', 'wereld')
    check('Verre vlucht: CO2 met de factor voor meer dan 2500 km, overstap staat in de uitleg', e4("(()=>{const e=SNAP.find(d=>d.id==='kiwi-ams-bkk-r'); return !!e && e.to==='bangkok' && e.gcd>9000 && e.co2f.f===0.157 && Math.abs(e.co2One-e.gcd*1.08*0.157)<0.5 && e.transfers===1 && /Muscat/.test(e.note) && e.nights===13 && contOf(e.dest)==='AS'})()"))
    check('Wereldkaart: projectie klopt (New York links, Bangkok rechts van Nederland) en heeft stippen', e4("(()=>{setMapMode('world'); const a=proj(4.9,52.37), ny=proj(-74,40.7), bk=proj(100.5,13.75); const ok=Math.abs(a[0]-473.3)<1 && Math.abs(a[1]-241.3)<1 && Math.abs(ny[0]-196.5)<1 && Math.abs(ny[1]-294.5)<1 && Math.abs(bk[0]-808.8)<1 && Math.abs(bk[1]-417.5)<1; const n=document.querySelectorAll('#mapMarkers .mk[role=button]').length; setMapMode('eu'); return ok && n>50 && Math.abs(proj(4.9,52.37)[0]-516.5)<1})()"))
    check('Ideeën: tegel "Buiten Europa"', e4("!!document.querySelector('#inspire [data-tile=\"ver\"]')") and (p4.click('#inspire [data-tile="ver"]') or True) and e4("state.reach==='ver' && lastList.length>=20 && lastList.every(x=>contOf(x.e.dest)!=='EU')"))
    e4("setReach('wereld'); setMapMode('eu'); state.filters = defaultFilters(); renderAll()")
    check('Bestemming buiten Europa kiezen (Bangkok) werkt ook als "Alleen Europa" aan staat', e4("(()=>{setReach('europa'); setDest('bangkok'); const ok=lastList.length>=1 && lastList.every(x=>x.e.to==='bangkok'); setDest('overal'); setReach('wereld'); renderAll(); return ok})()"))
    check('Maximumprijs loopt nu tot €1000 (ver weg is duurder)', e4("document.querySelector('#fPrice').max==='1000' && state.filters.maxPrice===1000 && lastList.some(x=>x.tp.p>400)"))
    check('Geen horizontaal scrollen op een telefoon', e4("document.documentElement.scrollWidth <= window.innerWidth + 1"), f"{e4('document.documentElement.scrollWidth')} px breed")
    # Controle van alle ingebouwde data
    snapd = e4("SNAP.map(e=>({id:e.id,mode:e.mode,trip:e.trip,price:e.price,out:e.out||null,back:e.back||null,checked:e.checked,link:e.link||null,book:bookLink(e).url,src:srcsOf(e).map(s=>s.url),indic:!!e.indic,type:e.priceType,flight:e.flight||null,backFlight:e.backFlight||null,dur:e.dur,bag:e.bag,nights:e.nights}))")
    ids_all = [d['id'] for d in snapd]
    check('Data: elke deal heeft een unieke id', len(ids_all) == len(set(ids_all)), f'{len(ids_all)} deals')
    check('Data: elke deal is vandaag (10 nov 2026) gecontroleerd en heeft een prijs, bron en boeklink', all(d['checked'].startswith('2026-11-10T') and d['price'] > 0 and d['src'] and all(u.startswith('https://') for u in d['src']) and d['book'].startswith('https://') for d in snapd))
    check('Data: geen reisdatum in het verleden op de dag van controle', all((d['out'] or '9') >= '2026-11-10' for d in snapd), ', '.join(d['id'] for d in snapd if (d['out'] or '9') < '2026-11-10'))
    kiwi = [d for d in snapd if d['id'].startswith('kiwi-')]
    check('Data: elke Kiwi-vlucht heeft datum, vluchtnummer, reistijd en eigen boeklink', len(kiwi) >= 95 and all(d['out'] and d['flight'] and d['dur'] and d['link'] and d['link'].startswith('https://kiwi.com/u/') and d['book'] == d['link'] for d in kiwi), f'{len(kiwi)} vluchten')
    kr = [d for d in kiwi if d['trip'] == 'retour']
    check('Data: elke Kiwi-retour heeft terugdatum, terugvlucht en een logisch aantal nachten', len(kr) == 60 and all(d['back'] and d['backFlight'] and 2 <= d['nights'] <= 17 and ('-r' in d['id']) for d in kr), f'{len(kr)} retourvluchten')
    check('Data: vanafprijzen (trein en bus) hebben geen vaste datum; gevonden prijzen wel', all((d['out'] is None) == (d['type'] == 'vanaf') for d in snapd))
    check('Data: kaartjes en kortingen houden hun controle van 9 november', e4("PASSES.every(p=>p.checked.startsWith('2026-11-09T'))"))
    check('Versie 3: geen JavaScript-fouten', not errs4, '; '.join(errs4[:3]))
    ctx4.close()

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
    check('App-versie: werkt offline (opnieuw laden zonder internet)', p3.locator('.deal').count() >= 20 and p3.evaluate("document.body.classList.contains('offline')"))
    ctx3.set_offline(False)
    check('App-versie: geen JavaScript-fouten', not errs3, '; '.join(errs3[:3]))
    ctx3.close()
    browser.close()
srv.shutdown()
ok = sum(1 for r in results if r[1]); print(f'\n{ok}/{len(results)} tests geslaagd')
json.dump([{'test': n, 'ok': o, 'info': i} for n, o, i in results], open('/home/claude/build/test_results.json', 'w'), ensure_ascii=False, indent=1)
