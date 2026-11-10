# DealRadar NL

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
