/* =====================================================================
   DealRadar NL — GECONTROLEERDE DATA (snapshot)
   ---------------------------------------------------------------------
   Elke prijs in dit bestand komt van de genoemde bron. Claude heeft de
   bronnen gecontroleerd op maandag 9 november 2026 tussen 20:29 en 22:35
   (Nederlandse tijd). Prijzen veranderen snel: controleer altijd bij de
   aanbieder voordat je boekt.

   Zelf een deal toevoegen? Kopieer een blok in SNAPSHOT_DEALS en vul in:
     id        unieke code (tekst)
     mode      'trein' | 'vliegtuig' | 'bus' | 'combi'
     provider  naam van de vervoerder
     from      vertrekpunt: code uit ORIGINS hieronder
     to        bestemming: id uit DEST (zie basedata)
     arr       (vliegtuig) aankomstvliegveld, bv. 'STN'
     price     prijs in euro (getal)
     trip      'enkel' of 'retour'
     priceType 'vanaf' (laagste prijs, datum vrij) of 'gevonden' (prijs voor de genoemde data)
     out/back  reisdata (JJJJ-MM-DD) als de prijs voor vaste data geldt
     dur       reistijd in minuten (null = onbekend, de app schat dan)
     transfers aantal overstappen (null = onbekend)
     bag       'koffer' (inbegrepen) | 'tasje' (alleen klein tasje gratis) | 'onbekend'
     km        afstand in km als de bron die noemt
     note      korte uitleg / voorwaarden
     src       lijst met sleutels uit SRC
     checked   tijdstip van controle
     srcDate   datum die de bron zelf noemt (optioneel)
     book      sleutel uit PROVIDERS (link naar boeken)
     who       'jongeren' | 'groep' (alleen voor bepaalde reizigers)
   ===================================================================== */

const CHECK_WINDOW = 'maandag 9 november 2026, 20:29–22:35';
const T = hhmm => `2026-11-09T${hhmm}:00+01:00`;

/* ---------- Bronnen ---------- */
const SRC = {
  nsiGroep:   { name: 'NS International – vanafprijzen (tabel groepsreizen)', url: 'https://www.nsinternational.com/nl/groepsreizen' },
  nsiHome:    { name: 'NS International – homepage', url: 'https://www.nsinternational.com/nl' },
  nsiInn:     { name: 'NS International – trein naar Innsbruck', url: 'https://www.nsinternational.com/nl/oostenrijk/trein-innsbruck' },
  nsiSzg:     { name: 'NS International – trein naar Salzburg', url: 'https://nsinternational.com/nl/oostenrijk/trein-salzburg' },
  nsiWest:    { name: 'NS International – trein naar Westendorf', url: 'https://www.nsinternational.com/nl/wintersport/trein-westendorf' },
  nsiWinter:  { name: 'NS International – wintersport met de trein', url: 'https://www.nsinternational.com/nl/wintersport-met-de-trein' },
  nsiES:      { name: 'NS International – European Sleeper', url: 'https://www.nsinternational.com/en/trains/nighttrain/european-sleeper' },
  eurostar:   { name: 'Eurostar – winter- en kersttickets', url: 'https://www.eurostar.com/nl-nl/speciale-aanbiedingen/kersttreintickets-winter-koppen' },
  eurostarAll:{ name: 'Eurostar – speciale aanbiedingen', url: 'https://www.eurostar.com/nl-nl/speciale-aanbiedingen' },
  eurostarKids:{ name: 'Eurostar – speciale tarieven (kinderen)', url: 'https://www.eurostar.com/be-nl/speciale-aanbiedingen?subid=11693270' },
  dbNL:       { name: 'Deutsche Bahn – voordelig tarief Europa Nederland', url: 'https://int.bahn.de/nl/aanbod/voordelig-tarief-flexpreis/voordelig-tarief-europa-nederland' },
  dbYoung:    { name: 'Deutsche Bahn – Super Sparpreis Europa Young Niederlande', url: 'https://www.bahn.de/bahnbusiness/faq/preis-super-sparpreis-europa-young-niederlande' },
  dbGroep:    { name: 'Deutsche Bahn – supervoordelig groepstarief Europa', url: 'https://int.bahn.de/nl/aanbod/voordelig-tarief-flexpreis/supervoordelig-groepstarief-europa' },
  everyrail:  { name: 'EveryRail – Parijs naar Marseille (laatst gecontroleerd juli 2026, via zoekresultaat)', url: 'https://everyrail.com/nl/treinen/trein-parijs-marseille/' },
  kPar:       { name: 'Kombo – bus Amsterdam–Parijs', url: 'https://www.kombo.co/de/bus-Amsterdam-Paris' },
  kBer:       { name: 'Kombo – bus Amsterdam–Berlijn', url: 'https://www.kombo.co/en/bus-Amsterdam-Berlin' },
  kBru:       { name: 'Kombo – bus Amsterdam–Brussel', url: 'https://www.kombo.co/nl/bus-Amsterdam-Brussel' },
  kPrg:       { name: 'Kombo – bus Amsterdam–Praag', url: 'https://www.kombo.co/nl/bus-Amsterdam-Praag' },
  kZrh:       { name: 'Kombo – bus Amsterdam–Zürich', url: 'https://www.kombo.co/nl/bus-Amsterdam-Zurich' },
  kLil:       { name: 'Kombo – bus Amsterdam–Lille', url: 'https://www.kombo.co/nl/bus-Amsterdam-Lille' },
  kRtdPar:    { name: 'Kombo – bus Rotterdam–Parijs', url: 'https://www.kombo.co/nl/bus-Rotterdam-Parijs' },
  kAmsHam:    { name: 'Kombo – bus Amsterdam–Hamburg', url: 'https://www.kombo.co/de/bus-Amsterdam-Hamburg' },
  kAmsLon:    { name: 'Kombo – bus Amsterdam–Londen', url: 'https://www.kombo.co/en/bus-Amsterdam-London' },
  kUtrBru:    { name: 'Kombo – bus Utrecht–Brussel', url: 'https://www.kombo.co/en/bus-Utrecht-Brussels' },
  kAmsCph:    { name: 'Kombo – bus Amsterdam–Kopenhagen', url: 'https://www.kombo.co/nl/bus-Amsterdam-Kopenhagen' },
  kAmsLux:    { name: 'Kombo – bus Amsterdam–Luxemburg', url: 'https://www.kombo.co/fr/bus-Amsterdam-Luxembourg' },
  kAmsStr:    { name: 'Kombo – bus Amsterdam–Straatsburg', url: 'https://www.kombo.co/fr/bus-Amsterdam-Strasbourg' },
  kEinPar:    { name: 'Kombo – bus Eindhoven–Parijs', url: 'https://www.kombo.co/en/bus-Eindhoven-Paris' },
  skyEIN:     { name: 'Skyscanner – goedkope vluchten vanaf Eindhoven (prijzen van de laatste 4 dagen)', url: 'https://www.skyscanner.de/fluge-von/ein/billigfluge-von-eindhoven-flughafen.html' },
  skyAMS:     { name: 'Skyscanner – goedkope vluchten vanaf Schiphol', url: 'https://www.skyscanner.nl/nl/en-gb/eur/flights-from/AMS' },
  skyGRQ:     { name: 'Skyscanner – goedkope vluchten vanaf Groningen', url: 'https://skyscanner.nl/nl/en-gb/eur/flights-from/grq/cheap-flights-from-groningen-airport.html' },
  kiwi:       { name: 'Kiwi.com – live zoekresultaat (via de Claude-connector)', url: 'https://www.kiwi.com/nl/' },
  nsPrijzen:  { name: 'NS – prijzen 2026 (losse kaartjes en abonnementen)', url: 'https://www.ns.nl/klantenservice/betalen/tarieven-consumenten.html' },
  groepGeldig:{ name: 'AmsterdamTips – NS Groepsticket (geldigheid 2026)', url: 'https://www.amsterdamtips.com/?p=2759' },
  jongNS:     { name: 'Treinreiziger.nl – jongeren 20% extra korting op PrijsTijd Deals', url: 'https://www.treinreiziger.nl/vanaf-maandag-nieuw-kortingsproduct-voor-jongeren-bij-ns-extra-korting-op-prijs-tijd-deal/amp/' },
  snowplaza:  { name: 'Snowplaza – Nightjet winter 2026–2027', url: 'https://www.snowplaza.nl/weblog/nightjet-nachttrein-wintersport-boeken-winter-2026-2027/' },
  nightride:  { name: 'Nightride – skinachttreinen 2026–2027', url: 'https://nightride.com/nl/blog/ski-nachttrein-2026-2027' },
  einClose:   { name: 'Transavia – sluiting Eindhoven Airport 2027', url: 'https://www.transavia.com/informatie/nl-nl/sluiting-eindhoven-airport' },
  einAirport: { name: 'Eindhoven Airport – tijdelijke sluiting baan', url: 'https://www.eindhovenairport.nl/en/runway-closure' },
  mstHV:      { name: 'Transavia – vertrek vanaf Maastricht', url: 'https://www.transavia.com/vliegvelden/nl-be/maastricht' },
  bagHV:      { name: 'AirAdvisor – Transavia bagagekosten (bijgewerkt 26 okt 2026)', url: 'https://airadvisor.com/nl/bagagelimiet/transavia-airlines' },
  bagTA:      { name: 'Test-Aankoop – extra betalen voor handbagage', url: 'https://www.test-aankoop.be/familie-prive/reizen/pers/extra-betalen-voor-handbagage' },
  co2Flight:  { name: 'CO2emissiefactoren.nl 2026 – vliegtuig Europees 700–2500 km', url: 'https://co2emissiefactoren.nl/factoren/2026/51/189/personenvervoer-vliegtuig-europees-700-2500-km/' },
  co2Train:   { name: 'CO2emissiefactoren.nl 2026 – trein elektrisch', url: 'https://co2emissiefactoren.nl/factoren/2026/53/196/personenvervoer-openbaar-vervoer-trein-elektrisch/' },
  co2Short:   { name: 'CO2 Emissiefactoren België 2025 – vlucht < 700 km (via Climatiq)', url: 'https://www.climatiq.io/data/emission-factor/76723029-e9f3-45d0-b4eb-5649b1d36d27' },
  co2Coach:   { name: 'CO2 Emissiefactoren 2024 – touringcar diesel (via Climatiq)', url: 'https://www.climatiq.io/data/emission-factor/7d213d3b-43dc-4e03-b7cc-a1a42422accd' },
  uplift:     { name: 'DEFRA/BEIS – 8% omweg-toeslag voor vluchten (via Climatiq)', url: 'https://www.climatiq.io/data/emission-factor/482e9f0a-ce75-8325-9c7f-42553ff7363e' },
};

/* ---------- Vertrekpunten van deals ---------- */
const ORIGINS = {
  ASD:  { n: 'Amsterdam Centraal', kind: 'station', lat: 52.37919, lon: 4.89943, uic: '8400058' },
  ASDS: { n: 'Amsterdam Centraal of Schiphol', kind: 'station', lat: 52.37919, lon: 4.89943, uic: '8400058' },
  RTD:  { n: 'Rotterdam Centraal', kind: 'station', lat: 51.92507, lon: 4.46884, uic: '8400530' },
  NJ:   { n: 'Amsterdam, Amersfoort of Deventer', kind: 'station', lat: 52.37919, lon: 4.89943, uic: '8400058' },
  BUSA: { n: 'Amsterdam (bus)', full: 'Amsterdam Sloterdijk, Bijlmer of Centraal (halte H)', kind: 'bus', lat: 52.38902, lon: 4.83811, uic: '8400059' },
  BUSR: { n: 'Rotterdam (bus)', full: 'Rotterdam Centraal of Zuidplein', kind: 'bus', lat: 51.92507, lon: 4.46884, uic: '8400530' },
  BUSU: { n: 'Utrecht Centraal (bus)', kind: 'bus', lat: 52.08758, lon: 5.11117, uic: '8400621' },
  BUSE: { n: 'Eindhoven (bus)', full: 'Eindhoven Centraal of Eindhoven Airport', kind: 'bus', lat: 51.44306, lon: 5.47995, uic: '8400206' },
  AMS:  { n: 'Schiphol', kind: 'airport', iata: 'AMS', lat: 52.3086, lon: 4.7639, uic: '8400561' },
  EIN:  { n: 'Eindhoven Airport', kind: 'airport', iata: 'EIN', lat: 51.4501, lon: 5.3745, uic: '8400206', via: 'Eindhoven Centraal + bus' },
  RTM:  { n: 'Rotterdam The Hague Airport', kind: 'airport', iata: 'RTM', lat: 51.9569, lon: 4.4372, uic: '8400530', via: 'Rotterdam Centraal + bus' },
  MST:  { n: 'Maastricht Aachen Airport', kind: 'airport', iata: 'MST', lat: 50.9111, lon: 5.7694, uic: '8400424', via: 'Maastricht + bus' },
  GRQ:  { n: 'Groningen Airport Eelde', kind: 'airport', iata: 'GRQ', lat: 53.1191, lon: 6.5777, uic: '8400263', via: 'Groningen + bus/taxi' },
  NRN:  { n: 'Weeze (net over de grens)', full: 'Airport Weeze (Duitsland), ongeveer 30 km van Nijmegen en Venlo', kind: 'airport', iata: 'NRN', lat: 51.6024, lon: 6.1422, abroad: true },
  CRL:  { n: 'Brussel-Charleroi', full: 'Brussels South Charleroi Airport (België), ongeveer 45 km ten zuiden van Brussel', kind: 'airport', iata: 'CRL', lat: 50.4592, lon: 4.4538, abroad: true },
};

/* Aankomstvliegvelden die ver van het centrum liggen (voor deur-tot-deur) */
const ARR_AIRPORTS = {
  STN: { n: 'Londen Stansted', lat: 51.885, lon: 0.235 },
  SEN: { n: 'Londen Southend', lat: 51.5706, lon: 0.6936 },
  BGY: { n: 'Milaan Bergamo', lat: 45.6694, lon: 9.7089 },
  BVA: { n: 'Parijs Beauvais', lat: 49.4544, lon: 2.1128 },
  CGN: { n: 'Keulen/Bonn', lat: 50.8659, lon: 7.1427 },
  VIE: { n: 'Wenen', lat: 48.1103, lon: 16.5697 },
  PRG: { n: 'Praag', lat: 50.1009, lon: 14.2599 },
  WMI: { n: 'Warschau Modlin', lat: 52.4511, lon: 20.6518 },
  TSF: { n: 'Venetië Treviso', lat: 45.6484, lon: 12.1944 },
  CIA: { n: 'Rome Ciampino', lat: 41.7994, lon: 12.5949 },
  LIN: { n: 'Milaan Linate', lat: 45.4451, lon: 9.2767 },
};

/* ---------- Gecontroleerde deals ---------- */
const SNAPSHOT_DEALS = [
  // ===== TREIN: NS International (vanafprijs, enkele reis p.p., 2e klas, vanaf Amsterdam Centraal) =====
  { id: 'nsi-parijs', mode: 'trein', provider: 'Eurostar', from: 'ASDS', to: 'parijs', price: 35, trip: 'enkel', priceType: 'vanaf', dur: 205, transfers: 0, bag: 'koffer',
    note: 'Standard/2e klas, enkele reis. Eurostar noemt dezelfde vanafprijs ook vanaf Schiphol en Rotterdam C. Afhankelijk van beschikbaarheid.', src: ['nsiGroep', 'eurostar'], checked: T('20:44'), book: 'eurostar' },
  { id: 'nsi-londen', mode: 'trein', provider: 'Eurostar', from: 'ASD', to: 'londen', price: 88, trip: 'retour', priceType: 'vanaf', dur: 260, transfers: 0, bag: 'koffer',
    note: 'Retour vanaf €88 (NS International). Eurostar: vanaf €44 per reis met verplichte terugreis, voor reizen tussen 18 nov 2026 en 14 feb 2027.', src: ['nsiGroep', 'eurostar'], checked: T('20:44'), book: 'eurostar' },
  { id: 'nsi-berlijn', mode: 'trein', provider: 'NS International (ICE/IC)', from: 'ASD', to: 'berlijn', price: 38, trip: 'enkel', priceType: 'vanaf', dur: 351, transfers: 0, bag: 'koffer',
    note: 'Enkele reis, 2e klas. Reistijd volgens NS International: 5.51 uur.', src: ['nsiGroep'], checked: T('20:30'), book: 'nsi' },
  { id: 'nsi-disney', mode: 'trein', provider: 'Eurostar (via NS International)', from: 'ASD', to: 'disneyland', price: 35, trip: 'enkel', priceType: 'vanaf', dur: 230, transfers: null, bag: 'koffer',
    note: 'Marne-la-Vallée (Disneyland Paris). Enkele reis, 2e klas.', src: ['nsiGroep'], checked: T('20:30'), book: 'eurostar' },
  { id: 'nsi-hamburg', mode: 'trein', provider: 'NS International', from: 'ASD', to: 'hamburg', price: 33, trip: 'enkel', priceType: 'vanaf', dur: 315, transfers: null, bag: 'koffer',
    note: 'Enkele reis, 2e klas. Reistijd volgens NS International: 5.15 uur.', src: ['nsiGroep'], checked: T('20:30'), book: 'nsi' },
  { id: 'nsi-brussel', mode: 'trein', provider: 'NS International', from: 'ASD', to: 'brussel', price: 25, trip: 'enkel', priceType: 'vanaf', dur: 116, transfers: 0, bag: 'koffer',
    note: 'Enkele reis, 2e klas. Eurostar noemt Brussel vanaf €29 (Standard).', src: ['nsiGroep', 'eurostar'], checked: T('20:44'), book: 'nsi' },
  { id: 'nsi-munchen', mode: 'trein', provider: 'NS International (ICE)', from: 'ASD', to: 'munchen', price: 38, trip: 'enkel', priceType: 'vanaf', dur: 417, transfers: null, bag: 'koffer',
    note: 'Enkele reis, 2e klas. Reistijd volgens NS International: 6.57 uur.', src: ['nsiGroep'], checked: T('20:30'), book: 'nsi' },
  { id: 'nsi-antwerpen', mode: 'trein', provider: 'NS International', from: 'ASD', to: 'antwerpen', price: 20, trip: 'enkel', priceType: 'vanaf', dur: 75, transfers: 0, bag: 'koffer',
    note: 'Enkele reis, 2e klas. Op de homepage staat ook €21; de tabel noemt €20.', src: ['nsiGroep', 'nsiHome'], checked: T('20:30'), book: 'nsi' },
  { id: 'nsi-antwerpen-rtd', mode: 'trein', provider: 'NS International (Eurocity Direct)', from: 'RTD', to: 'antwerpen', price: 12, trip: 'enkel', priceType: 'vanaf', dur: null, transfers: 0, bag: 'koffer',
    note: 'Actie "Met korting naar Antwerpen": vanaf €12 vanuit Rotterdam. Voorwaarden en periode staan op de actiepagina van NS International.', src: ['nsiHome'], checked: T('20:30'), book: 'nsi' },
  { id: 'nsi-frankfurt', mode: 'trein', provider: 'NS International (ICE)', from: 'ASD', to: 'frankfurt', price: 38, trip: 'enkel', priceType: 'vanaf', dur: 233, transfers: 0, bag: 'koffer',
    note: 'Enkele reis, 2e klas. Reistijd volgens NS International: 3.53 uur.', src: ['nsiGroep'], checked: T('20:30'), book: 'nsi' },
  { id: 'nsi-wenen', mode: 'trein', provider: 'NS International', from: 'ASD', to: 'wenen', price: 35, trip: 'enkel', priceType: 'vanaf', dur: 727, transfers: null, bag: 'koffer',
    note: 'Enkele reis, 2e klas. Reistijd volgens NS International: 12.07 uur (nachttrein).', src: ['nsiGroep'], checked: T('20:30'), book: 'nsi' },
  { id: 'nsi-keulen', mode: 'trein', provider: 'NS International (ICE)', from: 'ASD', to: 'keulen', price: 20, trip: 'enkel', priceType: 'vanaf', dur: 157, transfers: 0, bag: 'koffer',
    note: 'Enkele reis, 2e klas. Reistijd volgens NS International: 2.37 uur.', src: ['nsiGroep'], checked: T('20:30'), book: 'nsi' },
  { id: 'nsi-dusseldorf', mode: 'trein', provider: 'NS International (ICE)', from: 'ASD', to: 'dusseldorf', price: 20, trip: 'enkel', priceType: 'vanaf', dur: null, transfers: 0, bag: 'koffer',
    note: 'Vanafprijs van de homepage van NS International. De bron noemt geen reistijd; de app schat die.', src: ['nsiHome'], checked: T('20:30'), book: 'nsi' },

  // ===== TREIN: Deutsche Bahn =====
  { id: 'db-keulen', mode: 'trein', provider: 'Deutsche Bahn', from: 'ASD', to: 'keulen', price: 24.99, trip: 'enkel', priceType: 'vanaf', dur: 157, transfers: 0, bag: 'koffer',
    note: 'Voordelig tarief Europa: vanaf €24,99 op korte trajecten, bv. Keulen–Amsterdam. Tot 12 maanden vooruit te boeken. Kinderen onder 14 reizen vaak gratis mee.', src: ['dbNL'], checked: T('20:44'), book: 'db' },
  { id: 'db-berlijn', mode: 'trein', provider: 'Deutsche Bahn', from: 'ASD', to: 'berlijn', price: 44.99, trip: 'enkel', priceType: 'vanaf', dur: 351, transfers: 0, bag: 'koffer',
    note: 'Voordelig tarief Europa: vanaf €44,99 op langere trajecten, bv. Berlijn–Amsterdam.', src: ['dbNL'], checked: T('20:44'), book: 'db' },
  { id: 'db-young-keulen', mode: 'trein', provider: 'Deutsche Bahn (Young)', from: 'ASD', to: 'keulen', price: 18.99, trip: 'enkel', priceType: 'vanaf', dur: 157, transfers: 0, bag: 'koffer', who: 'jongeren',
    note: 'Super Sparpreis Europa Young: vanaf €18,99 in de 2e klas op korte trajecten, bv. Keulen–Amsterdam. Alleen voor jongeren (leeftijdsgrens: zie DB).', src: ['dbYoung'], checked: T('20:44'), book: 'db' },
  { id: 'db-young-berlijn', mode: 'trein', provider: 'Deutsche Bahn (Young)', from: 'ASD', to: 'berlijn', price: 29.99, trip: 'enkel', priceType: 'vanaf', dur: 351, transfers: 0, bag: 'koffer', who: 'jongeren',
    note: 'Super Sparpreis Europa Young: vanaf €29,99 op lange trajecten, bv. Berlijn of Frankfurt–Amsterdam. Alleen voor jongeren.', src: ['dbYoung'], checked: T('20:44'), book: 'db' },
  { id: 'db-young-frankfurt', mode: 'trein', provider: 'Deutsche Bahn (Young)', from: 'ASD', to: 'frankfurt', price: 29.99, trip: 'enkel', priceType: 'vanaf', dur: 233, transfers: 0, bag: 'koffer', who: 'jongeren',
    note: 'Super Sparpreis Europa Young: vanaf €29,99 op lange trajecten, bv. Frankfurt–Amsterdam. Alleen voor jongeren.', src: ['dbYoung'], checked: T('20:44'), book: 'db' },

  // ===== TREIN: nachttreinen en wintersport =====
  { id: 'es-berlijn', mode: 'trein', provider: 'European Sleeper (nachttrein)', from: 'ASD', to: 'berlijn', price: 39, trip: 'enkel', priceType: 'vanaf', dur: null, transfers: 0, bag: 'koffer',
    note: 'Nachttrein Brussel–Amsterdam–Berlijn: zitplaats vanaf €39, couchette vanaf €69, slaapcoupé vanaf €109. Rijdt 3 keer per week.', src: ['nsiES'], checked: T('20:44'), book: 'es' },
  { id: 'es-brussel', mode: 'trein', provider: 'European Sleeper (nachttrein)', from: 'ASD', to: 'brussel', price: 14, trip: 'enkel', priceType: 'vanaf', dur: null, transfers: 0, bag: 'koffer',
    note: 'Zitplaats tussen Nederland en België vanaf €14. Rijdt 3 keer per week; tijden wisselen, controleer het boekingssysteem.', src: ['nsiES'], checked: T('20:44'), book: 'es' },
  { id: 'nj-innsbruck', mode: 'trein', provider: 'ÖBB Nightjet (via NS International)', from: 'NJ', to: 'innsbruck', price: 35, trip: 'enkel', priceType: 'vanaf', dur: null, transfers: 0, bag: 'koffer',
    note: 'Nachttrein, rechtstreeks. Zitplaats vanaf €35, ligplaats vanaf €55. Vanaf Amsterdam, Amersfoort of Deventer. Let op: wintersporttickets voor reizen na 12 dec 2026 zijn nog niet te koop.', src: ['nsiInn', 'nsiWinter'], checked: T('20:44'), book: 'nsi' },
  { id: 'ice-innsbruck', mode: 'trein', provider: 'NS International (ICE)', from: 'ASD', to: 'innsbruck', price: 38, trip: 'enkel', priceType: 'vanaf', dur: null, transfers: 2, bag: 'koffer',
    note: 'Overdag met ICE, 2 overstappen vanaf Amsterdam Centraal.', src: ['nsiInn'], checked: T('20:44'), book: 'nsi' },
  { id: 'nj-salzburg', mode: 'trein', provider: 'ÖBB Nightjet (via NS International)', from: 'ASD', to: 'salzburg', price: 38, trip: 'enkel', priceType: 'vanaf', dur: 765, transfers: 0, bag: 'koffer',
    note: 'Rechtstreeks in 12.45 uur (sinds 13 juni 2026). NS International weet nog niet of deze directe trein in 2027 blijft rijden.', src: ['nsiSzg'], checked: T('20:44'), book: 'nsi' },
  { id: 'ice-salzburg', mode: 'trein', provider: 'NS International (ICE)', from: 'ASD', to: 'salzburg', price: 40, trip: 'enkel', priceType: 'vanaf', dur: 561, transfers: 2, bag: 'koffer',
    note: 'Overdag met ICE: 9 uur 21 minuten met 1 tot 2 overstappen.', src: ['nsiSzg'], checked: T('20:44'), book: 'nsi' },
  { id: 'nj-westendorf', mode: 'trein', provider: 'ÖBB Nightjet (via NS International)', from: 'ASD', to: 'westendorf', price: 37, trip: 'enkel', priceType: 'vanaf', dur: null, transfers: 1, bag: 'koffer',
    note: 'Nachttrein naar Wörgl, daar overstappen op de trein naar Westendorf. Vroeg boeken is voordelig.', src: ['nsiWest', 'nsiWinter'], checked: T('20:44'), book: 'nsi' },

  // ===== COMBINATIE: trein + trein =====
  { id: 'combi-marseille', mode: 'combi', provider: 'Eurostar + OUIGO', from: 'ASDS', to: 'marseille', price: 51, trip: 'enkel', priceType: 'vanaf', dur: null, transfers: 1, bag: 'koffer',
    parts: [ { label: 'Eurostar Amsterdam → Parijs', price: 35, src: 'eurostar' }, { label: 'OUIGO Parijs → Marseille', price: 16, src: 'everyrail' } ],
    note: 'Totaal = €35 + €16. In Parijs wissel je van station (Gare du Nord → meestal Gare de Lyon); die metrorit zit niet in de prijs. De OUIGO-prijs komt uit een pagina van juli 2026.', src: ['eurostar', 'everyrail'], checked: T('20:44'), book: 'sncf' },

  // ===== BUS: FlixBus en BlaBlaCar Bus (via Kombo) =====
  { id: 'bla-parijs', mode: 'bus', provider: 'BlaBlaCar Bus', from: 'BUSA', to: 'parijs', price: 17.99, trip: 'enkel', priceType: 'vanaf', dur: 370, transfers: 0, bag: 'koffer', km: 431, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo (prijzen van 9 nov 2026). Ongeveer 6 uur 10 minuten.', src: ['kPar'], checked: T('20:34'), book: 'kombo-par' },
  { id: 'flix-parijs', mode: 'bus', provider: 'FlixBus', from: 'BUSA', to: 'parijs', price: 18.24, trip: 'enkel', priceType: 'vanaf', dur: 370, transfers: 0, bag: 'koffer', km: 431, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo (prijzen van 9 nov 2026).', src: ['kPar'], checked: T('20:34'), book: 'flixbus' },
  { id: 'flix-berlijn', mode: 'bus', provider: 'FlixBus', from: 'BUSA', to: 'berlijn', price: 25.98, trip: 'enkel', priceType: 'vanaf', dur: 435, transfers: 0, bag: 'koffer', km: 577, srcDate: '2026-10-22',
    note: 'Laagste prijs volgens Kombo. Let op: Kombo noteerde deze prijzen op 22 okt 2026.', src: ['kBer'], checked: T('20:34'), book: 'flixbus' },
  { id: 'flix-brussel', mode: 'bus', provider: 'FlixBus', from: 'BUSA', to: 'brussel', price: 8.19, trip: 'enkel', priceType: 'vanaf', dur: 160, transfers: 0, bag: 'koffer', km: 175, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo. Goedkoopste datum in de kalender: donderdag 12 nov 2026, vanaf €9.', src: ['kBru'], checked: T('20:34'), book: 'kombo-bru' },
  { id: 'bla-brussel', mode: 'bus', provider: 'BlaBlaCar Bus', from: 'BUSA', to: 'brussel', price: 8.99, trip: 'enkel', priceType: 'vanaf', dur: 160, transfers: 0, bag: 'koffer', km: 175, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo (prijzen van 9 nov 2026).', src: ['kBru'], checked: T('20:34'), book: 'kombo-bru' },
  { id: 'flix-praag', mode: 'bus', provider: 'FlixBus', from: 'BUSA', to: 'praag', price: 37.98, trip: 'enkel', priceType: 'vanaf', dur: 795, transfers: 0, bag: 'koffer', km: 710, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo. Goedkoopste datum: maandag 23 nov 2026, vanaf €38. Rit van ongeveer 13 uur.', src: ['kPrg'], checked: T('20:34'), book: 'kombo-prg' },
  { id: 'flix-zurich', mode: 'bus', provider: 'FlixBus', from: 'BUSA', to: 'zurich', price: 46.98, trip: 'enkel', priceType: 'vanaf', dur: 745, transfers: 0, bag: 'koffer', km: 614, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo. Goedkoopste datum: zaterdag 21 nov 2026, vanaf €47. BlaBlaCar Bus vanaf €49,99.', src: ['kZrh'], checked: T('20:44'), book: 'kombo-zrh' },
  { id: 'bla-lille', mode: 'bus', provider: 'BlaBlaCar Bus', from: 'BUSA', to: 'lille', price: 9.99, trip: 'enkel', priceType: 'vanaf', dur: 225, transfers: 0, bag: 'koffer', km: 232, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo. Goedkoopste datum: zaterdag 14 nov 2026, vanaf €10. FlixBus vanaf €10,49.', src: ['kLil'], checked: T('20:44'), book: 'kombo-lil' },

  // ===== BUS: extra routes en vertrekplaatsen (Kombo, gecontroleerd 9 nov 2026 rond 22:28) =====
  { id: 'bla-rtd-parijs', mode: 'bus', provider: 'BlaBlaCar Bus', from: 'BUSR', to: 'parijs', price: 19.99, trip: 'enkel', priceType: 'vanaf', dur: 398, transfers: 0, bag: 'koffer', km: 372, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo (prijzen van 9 nov 2026). FlixBus vanaf €20,98. Goedkoopste datum in de kalender: dinsdag 10 nov 2026, vanaf €20. Ongeveer 6 uur 38 minuten.', src: ['kRtdPar'], checked: T('22:27'), book: 'kombo-route' },
  { id: 'flix-hamburg', mode: 'bus', provider: 'FlixBus', from: 'BUSA', to: 'hamburg', price: 23.48, trip: 'enkel', priceType: 'vanaf', dur: 325, transfers: 0, bag: 'koffer', km: 367, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo (prijzen van 9 nov 2026). Goedkoopste datum: dinsdag 24 nov 2026, vanaf €24. Ongeveer 5 uur 25 minuten.', src: ['kAmsHam'], checked: T('22:27'), book: 'kombo-route' },
  { id: 'flix-londen', mode: 'bus', provider: 'FlixBus', from: 'BUSA', to: 'londen', price: 36.98, trip: 'enkel', priceType: 'vanaf', dur: 630, transfers: 0, bag: 'koffer', srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo (prijzen van 9 nov 2026). Goedkoopste datum: vrijdag 8 jan 2027, vanaf €37. Rit van ongeveer 10,5 uur.', src: ['kAmsLon'], checked: T('22:27'), book: 'kombo-route' },
  { id: 'flix-utr-brussel', mode: 'bus', provider: 'FlixBus', from: 'BUSU', to: 'brussel', price: 10.98, trip: 'enkel', priceType: 'vanaf', dur: 155, transfers: 0, bag: 'koffer', km: 147, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo (prijzen van 9 nov 2026). Goedkoopste datum: vrijdag 13 nov 2026, vanaf €11. Vertrek vanaf Utrecht Centraal.', src: ['kUtrBru'], checked: T('22:27'), book: 'kombo-route' },
  { id: 'flix-kopenhagen', mode: 'bus', provider: 'FlixBus', from: 'BUSA', to: 'kopenhagen', price: 42.98, trip: 'enkel', priceType: 'vanaf', dur: 745, transfers: 0, bag: 'koffer', km: 622, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo (prijzen van 9 nov 2026). Goedkoopste datum: maandag 7 dec 2026, vanaf €44. Rit van ruim 12 uur.', src: ['kAmsCph'], checked: T('22:27'), book: 'kombo-route' },
  { id: 'flix-luxemburg', mode: 'bus', provider: 'FlixBus', from: 'BUSA', to: 'luxemburg', price: 22.98, trip: 'enkel', priceType: 'vanaf', dur: 345, transfers: 0, bag: 'koffer', km: 320, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo (prijzen van 9 nov 2026). BlaBlaCar Bus vanaf €25,99. Goedkoopste datum: woensdag 25 nov 2026, vanaf €23.', src: ['kAmsLux'], checked: T('22:29'), book: 'kombo-route' },
  { id: 'flix-straatsburg', mode: 'bus', provider: 'FlixBus', from: 'BUSA', to: 'straatsburg', price: 29.98, trip: 'enkel', priceType: 'vanaf', dur: 525, transfers: 0, bag: 'koffer', km: 469, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo (prijzen van 9 nov 2026). BlaBlaCar Bus vanaf €31,99. Goedkoopste datum: vrijdag 8 jan 2027, vanaf €30. Leuk in december: de kerstmarkt.', src: ['kAmsStr'], checked: T('22:29'), book: 'kombo-route' },
  { id: 'flix-ein-parijs', mode: 'bus', provider: 'FlixBus', from: 'BUSE', to: 'parijs', price: 17.69, trip: 'enkel', priceType: 'vanaf', dur: 285, transfers: 0, bag: 'koffer', km: 363, srcDate: '2026-10-25',
    note: 'Laagste prijs volgens Kombo. Let op: Kombo noteerde deze prijzen op 25 okt 2026. Goedkoopste datum: vrijdag 4 dec 2026, vanaf €18. Vertrek vanaf Eindhoven Centraal of Eindhoven Airport.', src: ['kEinPar'], checked: T('22:29'), book: 'kombo-route' },

  // ===== VLIEGTUIG vanaf Eindhoven (retour, gevonden door Skyscanner in de laatste 4 dagen) =====
  { id: 'ein-tia', mode: 'vliegtuig', provider: 'Ryanair', from: 'EIN', to: 'tirana', arr: 'TIA', price: 34, trip: 'retour', priceType: 'gevonden', out: '2026-11-18', back: '2026-11-25', transfers: 0, bag: 'tasje', src: ['skyEIN'], checked: T('20:32'), book: 'sky' },
  { id: 'ein-stn', mode: 'vliegtuig', provider: 'Ryanair', from: 'EIN', to: 'londen', arr: 'STN', price: 35, trip: 'retour', priceType: 'gevonden', out: '2026-12-05', back: '2026-12-12', transfers: 0, bag: 'tasje', note: 'Aankomst Londen Stansted (buiten de stad).', src: ['skyEIN'], checked: T('20:32'), book: 'sky' },
  { id: 'ein-bgy', mode: 'vliegtuig', provider: 'Ryanair', from: 'EIN', to: 'milaan', arr: 'BGY', price: 41, trip: 'retour', priceType: 'gevonden', out: '2026-12-02', back: '2026-12-14', transfers: 0, bag: 'tasje', note: 'Aankomst Milaan Bergamo (buiten de stad).', src: ['skyEIN'], checked: T('20:32'), book: 'sky' },
  { id: 'ein-fao', mode: 'vliegtuig', provider: 'Ryanair', from: 'EIN', to: 'faro', arr: 'FAO', price: 43, trip: 'retour', priceType: 'gevonden', out: '2026-11-30', back: '2026-12-10', transfers: 0, bag: 'tasje', src: ['skyEIN'], checked: T('20:32'), book: 'sky' },
  { id: 'ein-gro', mode: 'vliegtuig', provider: 'Ryanair', from: 'EIN', to: 'girona', arr: 'GRO', price: 45, trip: 'retour', priceType: 'gevonden', out: '2026-12-07', back: '2026-12-14', transfers: 0, bag: 'tasje', src: ['skyEIN'], checked: T('20:32'), book: 'sky' },
  { id: 'ein-krk', mode: 'vliegtuig', provider: 'Ryanair', from: 'EIN', to: 'krakau', arr: 'KRK', price: 46, trip: 'retour', priceType: 'gevonden', out: '2026-12-08', back: '2026-12-16', transfers: 0, bag: 'tasje', src: ['skyEIN'], checked: T('20:32'), book: 'sky' },
  { id: 'ein-bts', mode: 'vliegtuig', provider: 'Ryanair', from: 'EIN', to: 'bratislava', arr: 'BTS', price: 47, trip: 'retour', priceType: 'gevonden', out: '2026-11-23', back: '2026-12-07', transfers: 0, bag: 'tasje', src: ['skyEIN'], checked: T('20:32'), book: 'sky' },
  { id: 'ein-sof', mode: 'vliegtuig', provider: 'Ryanair + Wizz Air', from: 'EIN', to: 'sofia', arr: 'SOF', price: 48, trip: 'retour', priceType: 'gevonden', out: '2027-01-12', back: '2027-01-21', transfers: 0, bag: 'tasje', note: 'Heen met Ryanair, terug met Wizz Air.', src: ['skyEIN'], checked: T('20:32'), book: 'sky' },
  { id: 'ein-zag', mode: 'vliegtuig', provider: 'Ryanair', from: 'EIN', to: 'zagreb', arr: 'ZAG', price: 51, trip: 'retour', priceType: 'gevonden', out: '2026-12-04', back: '2026-12-11', transfers: 0, bag: 'tasje', src: ['skyEIN'], checked: T('20:32'), book: 'sky' },
  { id: 'ein-vno', mode: 'vliegtuig', provider: 'Ryanair', from: 'EIN', to: 'vilnius', arr: 'VNO', price: 57, trip: 'retour', priceType: 'gevonden', out: '2026-12-31', back: '2027-01-16', transfers: 0, bag: 'tasje', src: ['skyEIN'], checked: T('20:32'), book: 'sky' },
  { id: 'ein-vie', mode: 'vliegtuig', provider: 'Ryanair', from: 'EIN', to: 'wenen', arr: 'VIE', price: 68, trip: 'retour', priceType: 'gevonden', out: '2026-12-07', back: '2026-12-14', transfers: 0, bag: 'tasje', src: ['skyEIN'], checked: T('20:32'), book: 'sky' },
  { id: 'ein-deb', mode: 'vliegtuig', provider: 'Wizz Air', from: 'EIN', to: 'debrecen', arr: 'DEB', price: 69, trip: 'retour', priceType: 'gevonden', out: '2027-01-22', back: '2027-01-29', transfers: 0, bag: 'tasje', src: ['skyEIN'], checked: T('20:32'), book: 'sky' },
  { id: 'ein-clj', mode: 'vliegtuig', provider: 'Wizz Air', from: 'EIN', to: 'cluj', arr: 'CLJ', price: 70, trip: 'retour', priceType: 'gevonden', out: '2027-01-12', back: '2027-01-23', transfers: 0, bag: 'tasje', src: ['skyEIN'], checked: T('20:32'), book: 'sky' },
  { id: 'ein-beg', mode: 'vliegtuig', provider: 'Wizz Air', from: 'EIN', to: 'belgrado', arr: 'BEG', price: 73, trip: 'retour', priceType: 'gevonden', out: '2027-01-20', back: '2027-01-21', transfers: 0, bag: 'tasje', src: ['skyEIN'], checked: T('20:32'), book: 'sky' },
  { id: 'ein-pfo', mode: 'vliegtuig', provider: 'Ryanair', from: 'EIN', to: 'paphos', arr: 'PFO', price: 73, trip: 'retour', priceType: 'gevonden', out: '2026-11-25', back: '2026-12-12', transfers: 0, bag: 'tasje', src: ['skyEIN'], checked: T('20:32'), book: 'sky' },
  { id: 'ein-mla', mode: 'vliegtuig', provider: 'Ryanair', from: 'EIN', to: 'malta', arr: 'MLA', price: 74, trip: 'retour', priceType: 'gevonden', out: '2026-12-03', back: '2026-12-13', transfers: 1, bag: 'tasje', note: 'Met 1 overstap per richting.', src: ['skyEIN'], checked: T('20:32'), book: 'sky' },

  // ===== VLIEGTUIG vanaf Schiphol (enkele reis, door Skyscanner gevonden) =====
  { id: 'ams-dub', mode: 'vliegtuig', provider: 'Ryanair', from: 'AMS', to: 'dublin', arr: 'DUB', price: 25, trip: 'enkel', priceType: 'gevonden', out: '2026-12-02', transfers: 0, bag: 'tasje', note: 'Skyscanner: beste retourprijs naar Dublin €51.', src: ['skyAMS'], checked: T('20:33'), book: 'sky' },
  { id: 'ams-agp', mode: 'vliegtuig', provider: 'Ryanair', from: 'AMS', to: 'malaga', arr: 'AGP', price: 37, trip: 'enkel', priceType: 'gevonden', out: '2027-01-10', transfers: 0, bag: 'tasje', src: ['skyAMS'], checked: T('20:33'), book: 'sky' },
  { id: 'ams-opo', mode: 'vliegtuig', provider: 'Ryanair', from: 'AMS', to: 'porto', arr: 'OPO', price: 52, trip: 'enkel', priceType: 'gevonden', out: '2026-12-05', transfers: 1, bag: 'tasje', note: 'Met overstap.', src: ['skyAMS'], checked: T('20:33'), book: 'sky' },
  { id: 'ams-bva', mode: 'vliegtuig', provider: 'Ryanair', from: 'AMS', to: 'parijs', arr: 'BVA', price: 52, trip: 'enkel', priceType: 'gevonden', out: '2027-01-04', transfers: 1, bag: 'tasje', note: 'Met overstap, aankomst Parijs Beauvais (ver buiten de stad). Ter vergelijking: de trein naar Parijs kost vanaf €35.', src: ['skyAMS'], checked: T('20:33'), book: 'sky' },
  { id: 'ams-dbv', mode: 'vliegtuig', provider: 'Ryanair', from: 'AMS', to: 'dubrovnik', arr: 'DBV', price: 54, trip: 'enkel', priceType: 'gevonden', out: '2026-12-12', transfers: 1, bag: 'tasje', note: 'Met overstap.', src: ['skyAMS'], checked: T('20:33'), book: 'sky' },
  { id: 'ams-sen', mode: 'vliegtuig', provider: 'easyJet', from: 'AMS', to: 'londen', arr: 'SEN', price: 57, trip: 'enkel', priceType: 'gevonden', out: '2027-01-01', transfers: 0, bag: 'tasje', note: 'Aankomst Londen Southend (buiten de stad).', src: ['skyAMS'], checked: T('20:33'), book: 'sky' },
  { id: 'ams-nap', mode: 'vliegtuig', provider: 'Ryanair', from: 'AMS', to: 'napels', arr: 'NAP', price: 58, trip: 'enkel', priceType: 'gevonden', out: '2026-12-02', transfers: 1, bag: 'tasje', note: 'Met overstap.', src: ['skyAMS'], checked: T('20:33'), book: 'sky' },
  { id: 'ams-tia', mode: 'vliegtuig', provider: 'Ryanair', from: 'AMS', to: 'tirana', arr: 'TIA', price: 59, trip: 'enkel', priceType: 'gevonden', out: '2026-12-01', transfers: 1, bag: 'tasje', note: 'Met overstap.', src: ['skyAMS'], checked: T('20:33'), book: 'sky' },
  { id: 'ams-mla', mode: 'vliegtuig', provider: 'easyJet', from: 'AMS', to: 'malta', arr: 'MLA', price: 62, trip: 'enkel', priceType: 'gevonden', out: '2027-01-04', transfers: 0, bag: 'tasje', src: ['skyAMS'], checked: T('20:33'), book: 'sky' },
  { id: 'ams-tos', mode: 'vliegtuig', provider: 'easyJet', from: 'AMS', to: 'tromso', arr: 'TOS', price: 62, trip: 'enkel', priceType: 'gevonden', out: '2027-01-24', transfers: 0, bag: 'tasje', note: 'Noorderlicht-seizoen.', src: ['skyAMS'], checked: T('20:33'), book: 'sky' },
  { id: 'ams-pmo', mode: 'vliegtuig', provider: 'easyJet', from: 'AMS', to: 'palermo', arr: 'PMO', price: 64, trip: 'enkel', priceType: 'gevonden', out: '2027-01-01', transfers: 0, bag: 'tasje', src: ['skyAMS'], checked: T('20:33'), book: 'sky' },
  { id: 'ams-prg', mode: 'vliegtuig', provider: 'easyJet', from: 'AMS', to: 'praag', arr: 'PRG', price: 64, trip: 'enkel', priceType: 'gevonden', out: '2027-02-25', transfers: 0, bag: 'tasje', src: ['skyAMS'], checked: T('20:33'), book: 'sky' },
  { id: 'ams-cgn', mode: 'vliegtuig', provider: 'Ryanair', from: 'AMS', to: 'keulen', arr: 'CGN', price: 64, trip: 'enkel', priceType: 'gevonden', out: '2026-12-12', transfers: 1, bag: 'tasje', note: 'Met overstap. De trein naar Keulen kost vanaf €20 en is sneller.', src: ['skyAMS'], checked: T('20:33'), book: 'sky' },

  // ===== VLIEGTUIG: live gevonden met de Kiwi.com-connector (9 nov 2026, 22:33–22:35) =====
  // Enkele reis, 1 volwassene, rechtstreeks, alleen een klein tasje inbegrepen. Vertrek tussen 16 nov 2026 en 31 jan 2027.
  ...[
    // Schiphol
    ['AMS', 'DUB', 'dublin', 28, '2026-12-02T14:40', 100, 'Ryanair', 'FR3103', 'u2trjv'],
    ['AMS', 'AGP', 'malaga', 41, '2027-01-10T18:55', 185, 'Ryanair', 'FR5692', 'hwscpss'],
    ['AMS', 'VLC', 'valencia', 67, '2027-01-10T17:35', 145, 'Transavia', 'HV6331', 'wfchh3'],
    ['AMS', 'SVQ', 'sevilla', 67, '2027-01-13T16:30', 175, 'Transavia', 'HV6729', '3mdnub'],
    ['AMS', 'BCN', 'barcelona', 73, '2027-01-10T14:50', 140, 'Vueling', 'VY1055', 'x5vphnn'],
    ['AMS', 'PMI', 'palma', 77, '2027-01-19T17:20', 145, 'Transavia', 'HV5623', 'vjj74x'],
    ['AMS', 'MAN', 'manchester', 78, '2027-01-28T16:00', 80, 'easyJet', 'U22166', 'tjxj99'],
    ['AMS', 'EDI', 'edinburgh', 79, '2026-12-31T18:20', 90, 'easyJet', 'U27837', '3wjjfj4'],
    ['AMS', 'BHX', 'birmingham', 81, '2026-12-31T10:45', 80, 'easyJet', 'U27849', 'qr89uqw'],
    ['AMS', 'LIN', 'milaan', 83, '2027-01-23T21:20', 95, 'easyJet', 'U25408', 'pq4tk4s'],
    ['AMS', 'INN', 'innsbruck', 84, '2027-01-24T17:20', 100, 'Transavia', 'HV6603', 'pk9zsyr'],
    ['AMS', 'GVA', 'geneve', 86, '2026-12-31T21:05', 85, 'easyJet', 'U21516', '3w788p4'],
    ['AMS', 'CPH', 'kopenhagen', 87, '2027-01-29T17:05', 80, 'Norwegian', 'D83541', 't2ppn6t'],
    // Eindhoven
    ['EIN', 'TIA', 'tirana', 17, '2026-12-10T11:40', 160, 'Ryanair', 'FR9940', 'ssr5m7'],
    ['EIN', 'STN', 'londen', 19, '2026-12-05T19:25', 65, 'Ryanair', 'FR2538', '5t8bj4'],
    ['EIN', 'ZAG', 'zagreb', 21, '2027-01-01T14:40', 110, 'Ryanair', 'FR5869', '9p3gyqw'],
    ['EIN', 'SOF', 'sofia', 21, '2027-01-13T16:45', 155, 'Ryanair', 'FR6014', 'rf6wgz'],
    ['EIN', 'CTA', 'catania', 21, '2027-01-01T14:20', 165, 'Ryanair', 'FR4062', 't87yc3k'],
    ['EIN', 'AGP', 'malaga', 21, '2026-12-01T18:05', 175, 'Ryanair', 'FR2576', 'yydpp6'],
    ['EIN', 'FAO', 'faro', 21, '2027-01-29T13:15', 180, 'Ryanair', 'FR5769', 'p9q9bzs'],
    ['EIN', 'FCO', 'rome', 22, '2027-01-01T09:20', 130, 'Ryanair', 'FR5815', 'kc6fu4k'],
    ['EIN', 'PMI', 'palma', 22, '2027-01-18T08:45', 140, 'Ryanair', 'FR3532', 'tchw2kh'],
    ['EIN', 'BGY', 'milaan', 23, '2026-12-02T17:20', 90, 'Ryanair', 'FR3461', 'd5cr4z'],
    ['EIN', 'BLQ', 'bologna', 23, '2027-01-12T09:55', 100, 'Ryanair', 'FR787', '4qmjvp7'],
    ['EIN', 'GRO', 'girona', 24, '2027-01-11T09:25', 115, 'Ryanair', 'FR2119', 'sjyvykj'],
    ['EIN', 'KRK', 'krakau', 25, '2027-01-11T19:45', 110, 'Ryanair', 'FR5891', 'cj889pr'],
    ['EIN', 'ALC', 'alicante', 29, '2026-12-01T09:25', 150, 'Ryanair', 'FR7523', '9px4pp', '22:33'],
    ['EIN', 'PSA', 'pisa', 30, '2026-12-06T12:50', 105, 'Ryanair', 'FR9924', 'qq86hg'],
    ['EIN', 'WMI', 'warschau', 30, '2027-01-22T19:55', 110, 'Ryanair', 'FR4021', 'nxtgsc'],
    ['EIN', 'SVQ', 'sevilla', 33, '2026-11-30T10:45', 170, 'Ryanair', 'FR5269', 'ugpy2s', '22:33'],
    ['EIN', 'TFS', 'tenerife', 46, '2026-11-27T16:50', 280, 'Ryanair', 'FR9576', '52dkb3', '22:33'],
    ['EIN', 'VLC', 'valencia', 50, '2026-11-26T21:10', 140, 'Ryanair', 'FR1718', '59tb7h', '22:33'],
    ['EIN', 'IBZ', 'ibiza', 53, '2026-12-01T07:00', 145, 'Transavia', 'HV6513', 'r8q3n6', '22:33'],
    ['EIN', 'ACE', 'lanzarote', 75, '2026-12-15T06:55', 255, 'Transavia', 'HV6357', 'wxq9vt', '22:33'],
    ['EIN', 'LPA', 'gran-canaria', 76, '2026-11-25T06:55', 275, 'Transavia', 'HV6365', '2g6nnzg', '22:33'],
    // Rotterdam The Hague
    ['RTM', 'SVQ', 'sevilla', 67, '2027-01-24T17:30', 170, 'Transavia', 'HV6855', 'b2y43m'],
    ['RTM', 'AGP', 'malaga', 67, '2027-01-17T07:30', 170, 'Transavia', 'HV5021', '9xmc68q'],
    ['RTM', 'STN', 'londen', 69, '2027-01-26T14:30', 55, 'Transavia', 'HV6991', 'rj9juz'],
    ['RTM', 'INN', 'innsbruck', 70, '2027-01-03T14:15', 85, 'Transavia', 'HV6925', '7hchrc'],
    ['RTM', 'BCN', 'barcelona', 70, '2027-01-28T17:00', 120, 'Transavia', 'HV6063', 'vrtkcfy'],
    ['RTM', 'FCO', 'rome', 70, '2027-01-11T17:35', 130, 'Transavia', 'HV6035', '3b9kq3'],
    ['RTM', 'SZG', 'salzburg', 71, '2027-01-04T19:15', 85, 'Transavia', 'HV6781', '6s4b9g'],
    ['RTM', 'VLC', 'valencia', 71, '2026-12-14T07:30', 135, 'Transavia', 'HV6443', 'bhybb6h'],
    ['RTM', 'ALC', 'alicante', 72, '2027-01-28T07:00', 145, 'Transavia', 'HV5053', 'rvpmq2u'],
    ['RTM', 'LIS', 'lissabon', 72, '2027-01-14T15:00', 175, 'Transavia', 'HV5241', 'cwut72s'],
    ['RTM', 'FAO', 'faro', 72, '2027-01-17T16:00', 180, 'Transavia', 'HV6091', 'rmsrnwz'],
    ['RTM', 'EGC', 'bergerac', 73, '2027-01-09T16:35', 90, 'Transavia', 'HV6073', 'tugmpu'],
    ['RTM', 'LPA', 'gran-canaria', 77, '2026-12-02T06:55', 270, 'Transavia', 'HV6301', 'c5b5x5'],
    ['RTM', 'TFS', 'tenerife', 77, '2026-12-14T06:55', 275, 'Transavia', 'HV6213', 'wr4232v'],
    // Weeze (Duitsland)
    ['NRN', 'GRO', 'girona', 17, '2027-01-31T06:10', 120, 'Ryanair', 'FR6390', '59fktf9'],
    ['NRN', 'TIA', 'tirana', 17, '2026-12-07T07:15', 145, 'Ryanair', 'FR8332', '6hyp5n'],
    ['NRN', 'OPO', 'porto', 17, '2026-11-22T07:15', 160, 'Ryanair', 'FR5489', 'nv3y9r'],
    ['NRN', 'TFS', 'tenerife', 17, '2026-12-06T21:05', 280, 'Ryanair', 'FR7605', 's22fhp'],
    ['NRN', 'SVQ', 'sevilla', 18, '2026-11-30T21:20', 175, 'Ryanair', 'FR8632', '5cgd9kt'],
    ['NRN', 'BRI', 'bari', 21, '2027-01-17T06:25', 140, 'Ryanair', 'FR7524', 'nwykj3'],
    ['NRN', 'PMI', 'palma', 21, '2026-11-26T16:45', 140, 'Ryanair', 'FR6218', '6v736h'],
    ['NRN', 'ALC', 'alicante', 21, '2027-01-01T07:00', 155, 'Ryanair', 'FR6212', 'xmtr9v'],
    ['NRN', 'EDI', 'edinburgh', 22, '2027-01-01T06:10', 100, 'Ryanair', 'FR5688', '3kd5v2q'],
    ['NRN', 'FUE', 'fuerteventura', 22, '2026-11-25T07:35', 270, 'Ryanair', 'FR9642', 'gjnfq4h'],
    ['NRN', 'ZAG', 'zagreb', 23, '2027-01-01T12:40', 110, 'Ryanair', 'FR2126', '2qk652h'],
    ['NRN', 'AGP', 'malaga', 23, '2027-01-04T06:05', 180, 'Ryanair', 'FR8612', 'wpzr9ut'],
    ['NRN', 'FAO', 'faro', 23, '2026-12-11T06:15', 185, 'Ryanair', 'FR5781', 'dx229x'],
    ['NRN', 'PFO', 'paphos', 26, '2027-01-01T14:10', 235, 'Ryanair', 'FR3878', 'rn49uud'],
    ['NRN', 'ACE', 'lanzarote', 28, '2026-12-06T13:20', 265, 'Ryanair', 'FR9645', '52mkry'],
    // Brussel-Charleroi (België)
    ['CRL', 'MAN', 'manchester', 17, '2026-11-19T06:50', 85, 'Ryanair', 'FR3223', 'cjq84yf'],
    ['CRL', 'BGY', 'milaan', 17, '2027-01-17T14:05', 90, 'Ryanair', 'FR4522', 'g6z88x4'],
    ['CRL', 'TSF', 'venetie', 17, '2026-12-06T07:15', 90, 'Ryanair', 'FR4938', '3jz9yg'],
    ['CRL', 'TRS', 'triest', 17, '2026-12-04T07:45', 100, 'Ryanair', 'FR4496', 'qbvd3n'],
    ['CRL', 'MRS', 'marseille', 17, '2026-11-17T06:30', 100, 'Ryanair', 'FR4838', 'fh9mc8'],
    ['CRL', 'PSA', 'pisa', 17, '2026-11-21T21:30', 100, 'Ryanair', 'FR3745', 'kr2h44'],
    ['CRL', 'DUB', 'dublin', 17, '2026-12-10T16:40', 105, 'Ryanair', 'FR47', '32brsg'],
    ['CRL', 'GRO', 'girona', 17, '2026-12-06T06:50', 105, 'Ryanair', 'FR1670', '5rwzbg6'],
    ['CRL', 'VIE', 'wenen', 17, '2027-01-25T19:10', 105, 'Ryanair', 'FR86', 'hh88fd'],
    ['CRL', 'ZAG', 'zagreb', 17, '2027-01-30T20:30', 110, 'Ryanair', 'FR2124', 'y34966'],
    ['CRL', 'CIA', 'rome', 17, '2026-12-31T17:40', 120, 'Ryanair', 'FR5650', 'f2fhvw'],
    ['CRL', 'TRN', 'turijn', 18, '2026-12-31T20:55', 90, 'Ryanair', 'FR4864', 'v92fk5'],
    ['CRL', 'EDI', 'edinburgh', 18, '2026-12-16T12:45', 100, 'Ryanair', 'FR7323', 'r7x8wdb'],
    ['CRL', 'WRO', 'wroclaw', 18, '2026-11-23T21:25', 105, 'Ryanair', 'FR8372', '6pytt8j'],
    ['CRL', 'BIQ', 'biarritz', 19, '2027-01-08T13:25', 105, 'Ryanair', 'FR5331', 'v6q6mdt'],
  ].map(([from, arr, to, price, dep, dur, provider, flight, code, hhmm]) => ({
    id: `kiwi-${from}-${arr}`.toLowerCase(), mode: 'vliegtuig', provider, from, to, arr, price, trip: 'enkel', priceType: 'gevonden',
    out: dep.slice(0, 10), depTime: dep.slice(11, 16), dur, transfers: 0, bag: 'tasje', flight,
    link: `https://kiwi.com/u/${code}`, src: ['kiwi'], checked: T(hhmm || (from === 'AMS' ? '22:34' : '22:35')), book: 'kiwi',
    note: `Live gevonden via Kiwi.com: vlucht ${flight}, rechtstreeks. Alleen een klein tasje is inbegrepen.` +
      (from === 'NRN' ? ' Weeze ligt net over de grens in Duitsland; reken op extra reistijd om er te komen.' : '') +
      (from === 'CRL' ? ' Charleroi ligt ongeveer 45 km ten zuiden van Brussel; reken op extra reistijd om er te komen.' : ''),
  })),

  // ===== VLIEGTUIG vanaf Groningen (enkele reis, door Skyscanner gevonden) =====
  { id: 'grq-lpa', mode: 'vliegtuig', provider: 'TUI', from: 'GRQ', to: 'gran-canaria', arr: 'LPA', price: 220, trip: 'enkel', priceType: 'gevonden', out: '2026-11-16', transfers: 0, bag: 'onbekend', src: ['skyGRQ'], checked: T('20:33'), book: 'sky' },
  { id: 'grq-her', mode: 'vliegtuig', provider: 'Corendon', from: 'GRQ', to: 'heraklion', arr: 'HER', price: 146, trip: 'enkel', priceType: 'gevonden', out: '2027-08-26', transfers: 0, bag: 'onbekend', src: ['skyGRQ'], checked: T('20:33'), book: 'sky' },
  { id: 'grq-ayt', mode: 'vliegtuig', provider: 'Corendon', from: 'GRQ', to: 'antalya', arr: 'AYT', price: 155, trip: 'enkel', priceType: 'gevonden', out: '2027-05-18', transfers: 0, bag: 'onbekend', note: 'Skyscanner: beste retourprijs naar Antalya €303.', src: ['skyGRQ'], checked: T('20:33'), book: 'sky' },
  { id: 'grq-bzo', mode: 'vliegtuig', provider: 'Sky Alps', from: 'GRQ', to: 'bolzano', arr: 'BZO', price: 180, trip: 'enkel', priceType: 'gevonden', out: '2027-05-10', transfers: 0, bag: 'onbekend', note: 'Rechtstreeks naar de Dolomieten.', src: ['skyGRQ'], checked: T('20:33'), book: 'sky' },
];

/* ---------- Slimme kaartjes en kortingen (echte prijzen 2026) ---------- */
const PASSES = [
  { id: 'ns-groep', title: 'NS Groepsticket', price: '€38,50 voor 2–3 personen', sub: '+ €4,50 per persoon (4 t/m 7). Met 7 personen ≈ €8,07 p.p. per enkele reis.',
    who: ['groep'], body: 'Eén enkele reis naar dezelfde bestemming in heel Nederland. Doordeweeks in de daluren en het hele weekend.', src: ['nsPrijzen', 'groepGeldig'], checked: T('20:33'), book: 'ns' },
  { id: 'ns-dal', title: 'NS Flex Dal Voordeel', price: '€6,35 per maand', sub: '40% korting buiten de spits. Gratis voor jongeren van 12 t/m 17 jaar.',
    who: ['jongeren', 'iedereen'], body: 'Handig als je vaker buiten de spits reist. Jaarabonnement op saldo: €76,20 per jaar.', src: ['nsPrijzen', 'jongNS'], checked: T('20:33'), book: 'ns' },
  { id: 'ns-ptd', title: 'NS PrijsTijd Deals voor jongeren', price: '20% extra korting', sub: 'Voor 12 t/m 17 jaar, bovenop de PrijsTijd Deal.',
    who: ['jongeren'], body: 'Vroegboekkorting voor rustige treinen; koop je kaartje minstens een dag van tevoren. (Bericht van okt 2025.)', src: ['jongNS'], checked: T('20:37'), book: 'ns' },
  { id: 'ns-railrunner', title: 'Railrunner', price: '€2,50', sub: 'Kinderen van 4 t/m 11 jaar die met een volwassene reizen.',
    who: ['kinderen'], body: 'Een vaste lage prijs per reisdag voor kinderen in de trein.', src: ['nsPrijzen'], checked: T('20:33'), book: 'ns' },
  { id: 'ns-weekendvrij', title: 'NS Flex Weekend Vrij', price: '€39,50 per maand', sub: 'Onbeperkt reizen in het weekend (2e klas). 65+: €28,95 per maand.',
    who: ['iedereen', '65plus'], body: 'Slim als je vaak in het weekend reist, bijvoorbeeld voor stedentrips binnen Nederland.', src: ['nsPrijzen'], checked: T('20:33'), book: 'ns' },
  { id: 'ns-60', title: 'NS Keuzedagen 60+', price: '€34,95 per jaar', sub: 'Alleen in combinatie met Dal Voordeel. NS Flex Dal Vrij 65+: €59,95 per maand.',
    who: ['65plus'], body: 'Extra reisdagen voor ouderen; zie de voorwaarden bij NS.', src: ['nsPrijzen'], checked: T('20:33'), book: 'ns' },
  { id: 'db-groep', title: 'DB supervoordelig groepstarief Europa', price: 'vanaf €14,99 p.p.', sub: 'Vanaf 6 personen. Gratis zitplaatsreservering; kinderen vanaf 6 jaar halve prijs.',
    who: ['groep'], body: 'Voor groepsreizen met Deutsche Bahn tussen Nederland en Duitsland (niet voor regionaal vervoer).', src: ['dbGroep'], checked: T('20:44'), book: 'db' },
  { id: 'db-young', title: 'DB Super Sparpreis Europa Young', price: 'vanaf €18,99', sub: 'Kort traject (bv. Keulen); vanaf €29,99 voor lange trajecten (bv. Berlijn).',
    who: ['jongeren'], body: 'Goedkope enkele reis in de 2e klas tussen Nederland en Duitsland voor jongeren.', src: ['dbYoung'], checked: T('20:44'), book: 'db' },
  { id: 'eurostar-kids', title: 'Eurostar met kinderen', price: '30% tot 50% korting', sub: 'Kinderen 4–11 jaar: 30% in de spits, tot 50% daarbuiten. Onder 4 jaar gratis.',
    who: ['kinderen'], body: 'Volgens de pagina met speciale tarieven van Eurostar (gezien via zoekresultaat).', src: ['eurostarKids'], checked: T('20:36'), book: 'eurostar' },
  { id: 'eurostar-snap', title: 'Eurostar Snap', price: 'tot 50% korting', sub: 'Last-minute naar Parijs of Londen als je flexibel bent met je reistijd.',
    who: ['iedereen'], body: 'Je kiest de dag, Eurostar kiest de trein. Alleen zinvol als je flexibel bent.', src: ['eurostarAll'], checked: T('20:36'), book: 'eurostar' },
];

/* ---------- Tips zonder vaste prijs ---------- */
const TIPS = [
  { title: 'Nachttrein naar Praag en Milaan', body: 'European Sleeper rijdt 3 keer per week Brussel–Amsterdam–Berlijn–Dresden–Praag. Instappen kan o.a. in Rotterdam, Den Haag HS, Amsterdam, Amersfoort en Deventer. Sinds 9 september 2026 rijdt er ook een nachttrein Brussel–Keulen–Zürich–Milaan (overstappen in Amsterdam of Utrecht naar Keulen). Prijzen voor Praag en Milaan staan niet op de pagina.', src: ['nsiES'], type: 'stad' },
  { title: 'Skitrein naar de Franse Alpen', body: 'De Travelski Night Express rijdt op vrijdagavond van 18 dec 2026 tot en met 26 mrt 2027 vanaf Amsterdam (ook Rotterdam, Antwerpen en Brussel).', src: ['nightride'], type: 'ski' },
  { title: 'Nightjet wintersport 2026–2027', body: 'Volgens Snowplaza: minicabine of couchette vanaf €54,90 en slaapcoupé vanaf €89,90 als je vroeg boekt. De Nightjet naar Innsbruck stopt ook in Kufstein, Wörgl en Jenbach.', src: ['snowplaza'], type: 'ski' },
  { title: 'Wintersport na 12 december', body: 'NS International verkoopt nog geen treintickets voor wintersport na 12 dec 2026. Houd de site in de gaten.', src: ['nsiWinter'], type: 'ski' },
];

/* ---------- Meldingen per vliegveld ---------- */
const NOTICES = {
  EIN: { text: 'Eindhoven Airport is dicht van 1 februari tot en met 18 juli 2027 (baanrenovatie). Transavia vliegt dan vanaf Weeze en Maastricht.', src: ['einClose', 'einAirport'], from: '2027-02-01', to: '2027-07-18' },
  MST: { text: 'Van 1 feb t/m 18 jul 2027 vliegt Transavia tijdelijk vanaf Maastricht naar o.a. Alicante, Málaga, Faro, Gran Canaria, Palma, Sevilla, Tenerife, Valencia, Ibiza, Rhodos en Zakynthos.', src: ['mstHV'] },
};

/* ---------- Bagage (extra kosten handbagage-koffer per persoon per enkele reis) ---------- */
const BAGS = {
  Transavia: { trolley: [20, 50], hold15: [30, 58], src: 'bagHV', note: 'online geboekt; op de luchthaven €60' },
  _lowcost:  { trolley: [6, 75], src: 'bagTA', note: 'Ryanair, Vueling, Wizz Air en easyJet: toeslagen van ongeveer €6 tot €75 per stuk' },
};

/* ---------- CO2 per reizigerskilometer (kg) ---------- */
const CO2 = {
  trein: { f: 0.019, src: 'co2Train', label: 'trein (elektrisch), CO2emissiefactoren.nl 2026' },
  bus:   { f: 0.019, src: 'co2Coach', label: 'touringcar (diesel), CO2emissiefactoren 2024' },
  vliegKort: { f: 0.202, src: 'co2Short', label: 'vlucht < 700 km, CO2 Emissiefactoren België 2025' },
  vlieg: { f: 0.172, src: 'co2Flight', label: 'vlucht 700–2500 km, CO2emissiefactoren.nl 2026 (incl. niet-CO2-effecten)' },
  upliftFlight: 1.08, // DEFRA/BEIS: 8% omweg
  routeGround: 1.2,   // aanname: weg/spoor is ca. 20% langer dan hemelsbreed
};
