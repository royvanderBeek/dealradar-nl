# Broncode van DealRadar NL

- `src/` – de app in delen: `index.html` (opbouw), `app.css` (vormgeving), `deals.js` (gecontroleerde deals met bronnen), `app1.js` (rekenen), `app2.js` (schermen), `app3.js` (database, connectors, geschiedenis, app-versie), `basedata.json` en `map.json` (open data).
- `build.py` maakt er één HTML-bestand van; `build_pwa.py` maakt de app-versie (deze website).
- `test_app.py` test de app automatisch in Chrome (Playwright).

Zelf een deal toevoegen: kopieer een blok in `src/deals.js` (bovenaan staat wat elk veld betekent) en bouw opnieuw met `python3 build.py && python3 build_pwa.py`.
