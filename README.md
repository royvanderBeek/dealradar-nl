# DealRadar NL

Goedkope trein-, vlieg- en busdeals vanaf heel Nederland. Bij elke prijs staan de bron, een link en het tijdstip van controle.

**Open de app:** https://royvanderbeek.github.io/dealradar-nl/

## Op je telefoon zetten
- **iPhone (Safari):** open de link, tik op *Deel* en kies **Zet op beginscherm**.
- **Android (Chrome):** open de link en tik op **Installeer app** (of menu → *App installeren*).

De app werkt daarna ook zonder internet, met de laatst bewaarde deals.

## Hoe blijven de prijzen actueel?
- **In Claude** (artifact "DealRadar NL") draait elke ochtend een dagelijkse controle. Die zoekt vluchten via de Kiwi.com-connector, controleert prijzen en stuurt een pushmelding bij een prijsalert.
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
