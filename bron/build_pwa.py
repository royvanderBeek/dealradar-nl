# Bouwt de app-versie (PWA) van DealRadar NL in dist/pwa/:
# index.html (zelfde app + manifest), sw.js (offline), manifest, iconen, data/latest.json en README.
# Gebruik: python3 build.py && python3 build_pwa.py
import hashlib, json, os, shutil
from playwright.sync_api import sync_playwright

OUT = 'dist/pwa'
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT + '/data', exist_ok=True)

html = open('dist/dealradar-nl.html', encoding='utf-8').read()
head_extra = '''<meta name="dealradar-pwa" content="1">
<meta name="theme-color" content="#10262C">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="DealRadar">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">'''
html = html.replace('<title>DealRadar NL</title>', '<title>DealRadar NL</title>\n' + head_extra, 1)
open(OUT + '/index.html', 'w', encoding='utf-8').write(html)
version = hashlib.sha256(html.encode()).hexdigest()[:10]

# --- Iconen (radar-logo) ---
def icon_svg(maskable=False):
    bg = '<rect width="512" height="512" fill="#10262C"/>' if maskable else '<rect width="512" height="512" rx="112" fill="#10262C"/>'
    s = 0.72 if maskable else 1
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{bg}
<g transform="translate(256 256) scale({s})">
<circle r="180" fill="none" stroke="#F2F5F3" stroke-opacity=".3" stroke-width="12"/>
<circle r="112" fill="none" stroke="#F2F5F3" stroke-opacity=".3" stroke-width="12"/>
<circle r="44" fill="none" stroke="#F2F5F3" stroke-opacity=".3" stroke-width="12"/>
<path d="M0 0 L0 -206 A206 206 0 0 1 178.4 -103 Z" fill="#E0561C"/>
<circle cx="100" cy="-100" r="26" fill="#F2F5F3"/>
</g></svg>'''
open(OUT + '/favicon.svg', 'w').write(icon_svg())
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--no-sandbox'])
    for name, size, mask in [('icon-192.png', 192, False), ('icon-512.png', 512, False), ('icon-maskable-512.png', 512, True), ('apple-touch-icon.png', 180, True)]:
        pg = b.new_page(viewport={'width': size, 'height': size})
        pg.set_content(f'<html><body style="margin:0;background:transparent">{icon_svg(mask).replace("<svg ", f"<svg width=\"{size}\" height=\"{size}\" ", 1)}</body></html>')
        pg.locator('svg').screenshot(path=f'{OUT}/{name}', omit_background=True)
        pg.close()
    b.close()

# --- Manifest ---
json.dump({
    'name': 'DealRadar NL', 'short_name': 'DealRadar', 'lang': 'nl',
    'description': 'Goedkope trein-, vlieg- en busdeals vanaf heel Nederland, met bron en tijdstip bij elke prijs.',
    'start_url': './#deals', 'scope': './', 'display': 'standalone',
    'background_color': '#F2F5F3', 'theme_color': '#10262C',
    'icons': [
        {'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
        {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
        {'src': 'icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
    ],
}, open(OUT + '/manifest.webmanifest', 'w'), ensure_ascii=False, indent=1)

# --- Service worker: app eerst uit het netwerk (nieuwste versie), anders uit de cache (offline) ---
open(OUT + '/sw.js', 'w').write(f"""/* DealRadar NL service worker – versie {version}
   Pagina en data: eerst online ophalen (nieuwste prijzen), offline uit de cache.
   Lettertypen en iconen: uit de cache, op de achtergrond bijwerken. */
const CACHE = 'dealradar-{version}';
const SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './icon-192.png', './icon-512.png', './data/latest.json'];
self.addEventListener('install', e => {{
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
}});
self.addEventListener('activate', e => {{
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
}});
const fresh = (req, key) => fetch(req).then(r => {{ if (r.ok) {{ const copy = r.clone(); caches.open(CACHE).then(c => c.put(key || req, copy)); }} return r; }}).catch(() => caches.match(key || req));
self.addEventListener('fetch', e => {{
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {{ e.respondWith(fresh(req, './index.html')); return; }}
  if (url.origin === location.origin && url.pathname.endsWith('/data/latest.json')) {{ e.respondWith(fresh(req)); return; }}
  const fonts = /fonts\\.(googleapis|gstatic)\\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !fonts) return; // API's: altijd live, nooit uit de cache
  e.respondWith(caches.match(req).then(hit => {{
    const net = fetch(req).then(r => {{ if (r.ok || r.type === 'opaque') {{ const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }} return r; }}).catch(() => hit);
    return hit || net;
  }}));
}});
""")

# --- Startbestand voor de dagelijkse controle (wordt overschreven als de controle naar GitHub mag schrijven) ---
json.dump({'t': '2026-11-09T22:45:00+01:00', 'summary': 'Nog geen dagelijkse controle naar GitHub geschreven; de app gebruikt de ingebouwde deals.', 'deals': []},
          open(OUT + '/data/latest.json', 'w'), ensure_ascii=False)
open(OUT + '/.nojekyll', 'w').write('')

open(OUT + '/README.md', 'w', encoding='utf-8').write('''# DealRadar NL

Goedkope trein-, vlieg- en busdeals vanaf heel Nederland. Bij elke prijs staan de bron, een link en het tijdstip van controle.

**Open de app:** https://royvanderbeek.github.io/dealradar-nl/

## Op je telefoon zetten
- **iPhone (Safari):** open de link, tik op *Deel* en kies **Zet op beginscherm**.
- **Android (Chrome):** open de link en tik op **Installeer app** (of menu → *App installeren*).

De app werkt daarna ook zonder internet, met de laatst bewaarde deals.

## Wat kan de app?
- **Retour of enkele reis.** Bij vluchten is de retourprijs samen gezocht (heen en terug, met vluchtnummers en het aantal nachten). Bij trein en bus rekent de app 2 × de vanafprijs en zet er "berekend" bij.
- **Wanneer:** flexibel, een maand, een weekend, een schoolvakantie (data van de Rijksoverheid) of je eigen datums.
- **Overzicht:** de beste deal per bestemming, een compacte lijst, een kaart van Europa, een prijskalender en ideeën zoals "Naar de zon" of "Met de trein".
- **Eerlijk:** elke deal heeft een bron, een link en een controle-tijd. Schattingen van Skyscanner staan apart als "Indicatie".
- **In Claude** kun je ook live zoeken via Kiwi.com (met of zonder koffer) en één prijs live nacontroleren.

## Hoe blijven de prijzen actueel?
- **In Claude** (artifact "DealRadar NL") draait elke ochtend een dagelijkse controle. Die zoekt enkele vluchten en retourvluchten via de Kiwi.com-connector, controleert prijzen en stuurt een pushmelding bij een prijsalert.
- **Deze website** gebruikt de ingebouwde, gecontroleerde deals plus `data/latest.json` als de dagelijkse controle die bijwerkt.
- Live zoeken kan ook met je eigen API-sleutels (NS, Travelpayouts) via Instellingen in de app.

Prijzen veranderen snel. Controleer de prijs altijd bij de aanbieder voordat je boekt.

## Bestanden
| Bestand | Wat |
|---|---|
| `index.html` | De hele app in één bestand |
| `sw.js` | Service worker voor offline gebruik |
| `manifest.webmanifest` + iconen | Nodig om de app te installeren |
| `data/latest.json` | Nieuwste dagelijkse controle (optioneel) |
''')
print('pwa ok', version, sorted(os.listdir(OUT)))
