/* =====================================================================
   DealRadar NL — GECONTROLEERDE DATA (snapshot)
   ---------------------------------------------------------------------
   Elke prijs in dit bestand komt van de genoemde bron. Claude heeft alle
   bronnen opnieuw gecontroleerd op dinsdag 10 november 2026 tussen 06:33
   en 12:50 (Nederlandse tijd). Prijzen veranderen snel: controleer altijd
   bij de aanbieder voordat je boekt.

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
     depTime/backTime  vertrektijd heen/terug (UU:MM), als de bron die noemt
     backDur/backFlight/backFrom  reistijd, vluchtnummer en vertrekvliegveld van de terugreis
     indic     true = indicatie (prijs die de bron in de laatste dagen zag, geen live prijs)
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

const CHECK_WINDOW = 'dinsdag 10 november 2026, 06:33–12:50';
const T = hhmm => `2026-11-10T${hhmm}:00+01:00`;
const T9 = hhmm => `2026-11-09T${hhmm}:00+01:00`; // kaartjes en kortingen: gecontroleerd op 9 november

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
  vakanties:  { name: 'Rijksoverheid – schoolvakanties 2026-2027', url: 'https://www.rijksoverheid.nl/onderwerpen/schoolvakanties/overzicht-schoolvakanties-per-schooljaar/overzicht-schoolvakanties-2026-2027' },
  reisadvies: { name: 'Nederland Wereldwijd – reisadviezen en reisdocumenten', url: 'https://www.nederlandwereldwijd.nl/reisadvies' },
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
  BRU:  { n: 'Brussel-Zaventem', full: 'Brussels Airport in Zaventem (België)', kind: 'airport', iata: 'BRU', lat: 50.9014, lon: 4.4844, abroad: true },
  DUS:  { n: 'Düsseldorf Airport', full: 'Flughafen Düsseldorf (Duitsland)', kind: 'airport', iata: 'DUS', lat: 51.2895, lon: 6.7668, abroad: true },
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
  MXP: { n: 'Milaan Malpensa', lat: 45.6306, lon: 8.7281 },
};

/* ---------- Vluchten als korte rijen (worden hieronder uitgepakt tot deals) ---------- */
// Vertrekpunt, aankomst, stad, land, prijs, vertrek, minuten, vlucht, maatschappij, code van de boeklink
const KIWI_ONEWAY = [
    ["AMS", "DUB", "Dublin", "Ierland", 28, "2026-12-09T14:40", 100, "FR3103", "Ryanair", "x7745z"],
    ["AMS", "AGP", "Málaga", "Spanje", 41, "2027-01-10T18:55", 185, "FR5692", "Ryanair", "x72wjn"],
    ["AMS", "VLC", "Valencia", "Spanje", 67, "2027-01-17T06:55", 145, "HV6335", "Transavia", "x7ch64z"],
    ["AMS", "SVQ", "Sevilla", "Spanje", 67, "2027-01-04T07:05", 175, "HV6727", "Transavia", "nuj6v4j"],
    ["AMS", "BCN", "Barcelona", "Spanje", 73, "2027-01-20T10:30", 140, "VY1053", "Vueling", "k8ddqj"],
    ["AMS", "SEN", "Londen", "Verenigd Koninkrijk", 76, "2027-01-09T10:00", 55, "U25708", "easyJet", "xkkh9j"],
    ["AMS", "PMI", "Palma de Mallorca", "Spanje", 77, "2027-01-17T05:00", 145, "HV5625", "Transavia", "twubxpf"],
    ["AMS", "MAN", "Manchester", "Verenigd Koninkrijk", 78, "2027-01-21T10:00", 85, "U22162", "easyJet", "n2y5mbj"],
    ["AMS", "EDI", "Edinburgh", "Verenigd Koninkrijk", 79, "2026-12-31T18:20", 90, "U27837", "easyJet", "xn7j5qr"],
    ["AMS", "BHX", "Birmingham", "Verenigd Koninkrijk", 81, "2026-12-27T07:15", 80, "U27849", "easyJet", "yd7md7h"],
    ["AMS", "PRG", "Praag", "Tsjechië", 83, "2027-01-10T18:30", 90, "U27927", "easyJet", "9ph36xb"],
    ["AMS", "LIN", "Milaan", "Italië", 83, "2027-01-23T09:40", 95, "U25406", "easyJet", "shhymm9"],
    ["EIN", "TIA", "Tirana", "Albanië", 17, "2026-12-09T09:10", 160, "FR9940", "Ryanair", "234b95p"],
    ["EIN", "STN", "Londen", "Verenigd Koninkrijk", 19, "2026-12-05T19:25", 65, "FR2538", "Ryanair", "sdkfwqm"],
    ["EIN", "ZAG", "Zagreb", "Kroatië", 21, "2027-01-01T14:40", 110, "FR5869", "Ryanair", "8fydzt"],
    ["EIN", "SOF", "Sofia", "Bulgarije", 21, "2027-01-13T16:45", 155, "FR6014", "Ryanair", "5tzmxmr"],
    ["EIN", "CTA", "Catania", "Italië", 21, "2027-01-01T14:20", 165, "FR4062", "Ryanair", "9xzqqm"],
    ["EIN", "AGP", "Málaga", "Spanje", 21, "2026-12-01T18:05", 175, "FR2576", "Ryanair", "36jjtt"],
    ["EIN", "FCO", "Rome", "Italië", 22, "2027-01-01T09:20", 130, "FR5815", "Ryanair", "u2w78s"],
    ["EIN", "PMI", "Palma de Mallorca", "Spanje", 22, "2027-01-18T08:45", 140, "FR3532", "Ryanair", "rzstfh"],
    ["EIN", "BGY", "Milaan", "Italië", 23, "2026-12-02T17:20", 90, "FR3461", "Ryanair", "ffqyuu"],
    ["EIN", "BLQ", "Bologna", "Italië", 23, "2027-01-12T09:55", 100, "FR787", "Ryanair", "u9fmzk"],
    ["EIN", "GRO", "Girona", "Spanje", 24, "2027-01-11T09:25", 115, "FR2119", "Ryanair", "bv78svv"],
    ["EIN", "KRK", "Krakau", "Polen", 26, "2027-01-11T19:45", 110, "FR5891", "Ryanair", "n3g899"],
    ["RTM", "SVQ", "Sevilla", "Spanje", 67, "2027-01-24T17:30", 170, "HV6855", "Transavia", "c4gcqx"],
    ["RTM", "AGP", "Málaga", "Spanje", 67, "2027-01-17T07:30", 170, "HV5021", "Transavia", "3v5vwz"],
    ["RTM", "STN", "Londen", "Verenigd Koninkrijk", 70, "2027-01-05T18:00", 60, "HV6993", "Transavia", "wfr7hkh"],
    ["RTM", "INN", "Innsbruck", "Oostenrijk", 70, "2027-01-10T14:15", 85, "HV6925", "Transavia", "h6cr4s"],
    ["RTM", "BCN", "Barcelona", "Spanje", 70, "2027-01-01T07:25", 120, "HV6063", "Transavia", "ttmn5x"],
    ["RTM", "FCO", "Rome", "Italië", 70, "2027-01-11T17:35", 130, "HV6035", "Transavia", "dxcgqck"],
    ["RTM", "SZG", "Salzburg", "Oostenrijk", 71, "2027-01-01T06:55", 85, "HV5605", "Transavia", "jj3h89g"],
    ["RTM", "VLC", "Valencia", "Spanje", 71, "2026-12-14T07:30", 135, "HV6443", "Transavia", "7t3gp3"],
    ["RTM", "LIS", "Lissabon", "Portugal", 72, "2027-01-14T15:00", 175, "HV5241", "Transavia", "8nbb9d"],
    ["RTM", "FAO", "Faro", "Portugal", 72, "2027-01-17T16:00", 180, "HV6091", "Transavia", "zjuzjq8"],
    ["RTM", "EGC", "Bergerac", "Frankrijk", 73, "2027-01-09T16:35", 90, "HV6073", "Transavia", "um7tsy"],
    ["RTM", "ALC", "Alicante", "Spanje", 75, "2027-01-18T16:10", 145, "HV5053", "Transavia", "kk36pc"],
    ["NRN", "TIA", "Tirana", "Albanië", 17, "2026-12-07T07:15", 145, "FR8332", "Ryanair", "hyw28n"],
    ["NRN", "OPO", "Porto", "Portugal", 17, "2026-11-22T07:15", 160, "FR5489", "Ryanair", "c2kh4mw"],
    ["NRN", "SVQ", "Sevilla", "Spanje", 17, "2026-11-30T21:20", 175, "FR8632", "Ryanair", "j35hyv"],
    ["NRN", "TFS", "Tenerife", "Spanje", 17, "2026-12-06T21:05", 280, "FR7605", "Ryanair", "kdgjq8"],
    ["NRN", "ALC", "Alicante", "Spanje", 18, "2026-11-29T06:30", 155, "FR6212", "Ryanair", "uj2kfg"],
    ["NRN", "GRO", "Girona", "Spanje", 20, "2027-01-17T06:10", 120, "FR6390", "Ryanair", "zsvnx83"],
    ["NRN", "BRI", "Bari", "Italië", 21, "2027-01-17T06:25", 140, "FR7524", "Ryanair", "vmnb4w"],
    ["NRN", "PMI", "Palma de Mallorca", "Spanje", 21, "2027-01-04T13:05", 140, "FR6218", "Ryanair", "38wfq5s"],
    ["NRN", "EDI", "Edinburgh", "Verenigd Koninkrijk", 22, "2027-01-01T06:10", 100, "FR5688", "Ryanair", "7z8nb5"],
    ["NRN", "FUE", "Fuerteventura", "Spanje", 22, "2026-11-25T07:35", 270, "FR9642", "Ryanair", "wwb889"],
    ["NRN", "ZAG", "Zagreb", "Kroatië", 23, "2026-12-11T12:40", 110, "FR2126", "Ryanair", "mgntvd"],
    ["NRN", "AGP", "Málaga", "Spanje", 23, "2027-01-04T06:05", 180, "FR8612", "Ryanair", "gvfcpgu"],
    ["CRL", "MAN", "Manchester", "Verenigd Koninkrijk", 17, "2026-11-19T06:50", 85, "FR3223", "Ryanair", "gjw45f"],
    ["CRL", "BGY", "Milaan", "Italië", 17, "2027-01-17T14:05", 90, "FR4522", "Ryanair", "63dht79"],
    ["CRL", "TSF", "Venetië", "Italië", 17, "2027-01-19T10:05", 90, "FR1522", "Ryanair", "szqxb4h"],
    ["CRL", "TRN", "Turijn", "Italië", 17, "2026-12-06T09:05", 90, "FR4864", "Ryanair", "gbm8p8"],
    ["CRL", "MRS", "Marseille", "Frankrijk", 17, "2026-12-01T06:30", 100, "FR4838", "Ryanair", "2m73pt"],
    ["CRL", "TRS", "Triëst", "Italië", 17, "2026-12-04T07:45", 100, "FR4496", "Ryanair", "hwxdd6"],
    ["CRL", "DUB", "Dublin", "Ierland", 17, "2026-12-03T16:40", 105, "FR47", "Ryanair", "2bsqvq"],
    ["CRL", "WRO", "Wrocław", "Polen", 17, "2026-12-31T15:35", 105, "FR8372", "Ryanair", "x8476hn"],
    ["CRL", "GRO", "Girona", "Spanje", 17, "2026-12-06T06:50", 105, "FR1670", "Ryanair", "b3q5fy"],
    ["CRL", "CIA", "Rome", "Italië", 17, "2026-12-31T17:40", 120, "FR5650", "Ryanair", "sg9747"],
    ["CRL", "PSR", "Pescara", "Italië", 17, "2026-12-02T10:40", 120, "FR5016", "Ryanair", "hb55dm"],
    ["CRL", "EDI", "Edinburgh", "Verenigd Koninkrijk", 18, "2026-12-16T12:45", 100, "FR7323", "Ryanair", "nuwfnm"]
];
// Vertrekpunt, aankomst, stad, land, retourprijs, heen (vertrek, minuten, vlucht), terug (vertrek, minuten, vlucht), maatschappij, boeklink, controle-tijd, ander vliegveld terug
const KIWI_RETURN = [
  // Schiphol
  ['AMS', 'DUB', 'Dublin', 'Ierland', 52, '2026-12-09T14:40', 100, 'FR3103', '2026-12-14T09:35', 100, 'FR5505', 'Ryanair', '99mcj7', '12:29'],
  ['AMS', 'AGP', 'Málaga', 'Spanje', 75, '2027-01-10T18:55', 185, 'FR5692', '2027-01-15T18:55', 185, 'U27890', 'Ryanair + easyJet', 'r8b3n6', '12:29'],
  ['AMS', 'VLC', 'Valencia', 'Spanje', 96, '2027-01-23T07:00', 155, 'U27899', '2027-01-28T06:35', 160, 'VY7907', 'easyJet + Vueling', 'rz8h4g', '12:29'],
  ['AMS', 'SEN', 'Londen', 'Verenigd Koninkrijk', 108, '2027-01-16T10:00', 55, 'U25708', '2027-01-23T07:15', 60, 'U25707', 'easyJet', 'zjqqhrr', '12:29'],
  ['AMS', 'LIN', 'Milaan', 'Italië', 110, '2027-01-01T09:35', 100, 'U25406', '2027-01-07T06:00', 125, 'U23851', 'easyJet', '9yzzx9', '12:29', 'MXP'],
  // Eindhoven
  ['EIN', 'TIA', 'Tirana', 'Albanië', 35, '2026-12-10T11:40', 160, 'FR9940', '2026-12-17T08:30', 160, 'FR9939', 'Ryanair', '467jvhu', '12:30'],
  ['EIN', 'BGY', 'Milaan', 'Italië', 41, '2026-12-02T11:10', 90, 'FR3538', '2026-12-09T09:00', 105, 'FR3537', 'Ryanair', 'nfn8bb', '12:30'],
  ['EIN', 'STN', 'Londen', 'Verenigd Koninkrijk', 43, '2026-12-05T19:25', 65, 'FR2538', '2026-12-12T09:30', 65, 'FR8534', 'Ryanair', 'xnuybz', '12:30'],
  ['EIN', 'GRO', 'Girona', 'Spanje', 45, '2026-12-07T09:25', 115, 'FR2119', '2026-12-14T06:50', 130, 'FR2120', 'Ryanair', 'g5gh5q', '12:31'],
  ['EIN', 'BLQ', 'Bologna', 'Italië', 50, '2027-01-12T09:55', 100, 'FR787', '2027-01-19T07:40', 110, 'FR788', 'Ryanair', 'jk42t8', '12:33'],
  ['EIN', 'PSA', 'Pisa', 'Italië', 50, '2026-12-06T12:50', 105, 'FR9924', '2026-12-13T10:30', 115, 'FR9923', 'Ryanair', 'h6xh4x', '12:33'],
  ['EIN', 'SOF', 'Sofia', 'Bulgarije', 52, '2027-01-13T16:45', 155, 'FR6014', '2027-01-20T06:40', 165, 'W64325', 'Ryanair + Wizz Air', '3rsqzj', '12:33'],
  ['EIN', 'TSF', 'Venetië', 'Italië', 53, '2026-12-05T10:30', 90, 'FR1549', '2026-12-12T08:20', 100, 'FR1548', 'Ryanair', '4mfqjsg', '12:33'],
  // Weeze (Duitsland)
  ['NRN', 'TIA', 'Tirana', 'Albanië', 35, '2026-12-07T07:15', 145, 'FR8332', '2026-12-14T10:05', 155, 'FR8333', 'Ryanair', '34s7js8', '12:30'],
  ['NRN', 'FAO', 'Faro', 'Portugal', 41, '2026-12-11T06:15', 185, 'FR5781', '2026-12-18T08:45', 185, 'FR5780', 'Ryanair', '86t8sc', '12:31'],
  ['NRN', 'SVQ', 'Sevilla', 'Spanje', 44, '2027-01-18T21:20', 175, 'FR8632', '2027-01-25T18:00', 175, 'FR8633', 'Ryanair', 'j8jcruq', '12:31'],
  ['NRN', 'OPO', 'Porto', 'Portugal', 46, '2026-12-07T06:20', 160, 'FR5489', '2026-12-14T08:25', 160, 'FR5488', 'Ryanair', 'j7pfp86', '12:31'],
  ['NRN', 'ALC', 'Alicante', 'Spanje', 51, '2026-12-06T06:30', 155, 'FR6212', '2026-12-10T18:40', 165, 'FR6213', 'Ryanair', 'pqcf57', '12:31'],
  ['NRN', 'AGP', 'Málaga', 'Spanje', 55, '2027-01-17T16:20', 180, 'FR8612', '2027-01-23T08:45', 180, 'FR8635', 'Ryanair', 'wdnwuf', '12:31'],
  ['NRN', 'PMI', 'Palma de Mallorca', 'Spanje', 56, '2026-12-14T11:25', 140, 'FR6218', '2026-12-17T19:40', 145, 'FR6219', 'Ryanair', '945dhk', '12:31'],
  ['NRN', 'FUE', 'Fuerteventura', 'Spanje', 57, '2026-12-13T06:00', 270, 'FR9642', '2026-12-16T11:40', 265, 'FR9643', 'Ryanair', 'vynwwzq', '12:31'],
  ['NRN', 'EDI', 'Edinburgh', 'Verenigd Koninkrijk', 58, '2027-01-16T06:05', 100, 'FR5688', '2027-01-23T07:10', 95, 'FR5687', 'Ryanair', 'jpuprbm', '12:31'],
  ['NRN', 'ACE', 'Lanzarote', 'Spanje', 59, '2026-12-09T13:40', 265, 'FR9645', '2026-12-16T07:55', 260, 'FR9644', 'Ryanair', 'vmbu9t', '12:31'],
  // Brussel-Charleroi (België)
  ['CRL', 'CLJ', 'Cluj-Napoca', 'Roemenië', 32, '2026-12-04T06:30', 145, 'FR9547', '2026-12-11T06:10', 150, 'W43351', 'Ryanair + Wizz Air', 's954b5', '12:31'],
  ['CRL', 'BGY', 'Milaan', 'Italië', 35, '2027-01-17T14:05', 90, 'FR4522', '2027-01-20T09:05', 95, 'FR3659', 'Ryanair', 'xd76pm', '12:31'],
  ['CRL', 'TSF', 'Venetië', 'Italië', 35, '2026-12-06T07:15', 90, 'FR4938', '2026-12-12T16:00', 95, 'FR4939', 'Ryanair', 'q2gt5kd', '12:31'],
  ['CRL', 'TIA', 'Tirana', 'Albanië', 35, '2026-12-09T06:30', 150, 'FR8236', '2026-12-15T20:15', 160, 'FR8299', 'Ryanair', 'qqkmf3', '12:31'],
  // Kerstvakantie (vertrek vanaf 18 dec 2026, uiterlijk 3 jan 2027 terug), apart gezocht
  ['EIN', 'STN', 'Londen', 'Verenigd Koninkrijk', 81, '2026-12-26T09:10', 65, 'FR5682', '2027-01-01T07:05', 65, 'FR5681', 'Ryanair', 'mz8cws', '12:50', undefined, 'kerst'],
  ['CRL', 'MAN', 'Manchester', 'Verenigd Koninkrijk', 53, '2026-12-21T06:40', 85, 'FR614', '2026-12-23T08:10', 85, 'FR3222', 'Ryanair', 'b66yp4', '12:50', undefined, 'kerst'],
  // Rotterdam The Hague
  ['RTM', 'BCN', 'Barcelona', 'Spanje', 110, '2027-01-21T17:00', 120, 'HV6063', '2027-01-28T19:50', 135, 'HV6064', 'Transavia', 'hnfyutt', '12:33'],
  ['RTM', 'LIS', 'Lissabon', 'Portugal', 111, '2027-01-14T15:00', 175, 'HV5241', '2027-01-21T17:55', 170, 'HV5242', 'Transavia', 'vmfy5wg', '12:33'],
  ['RTM', 'FAO', 'Faro', 'Portugal', 111, '2027-01-15T15:45', 180, 'HV6093', '2027-01-22T18:35', 180, 'HV6094', 'Transavia', '5z3jhqh', '12:33'],
  ['RTM', 'STN', 'Londen', 'Verenigd Koninkrijk', 114, '2027-01-20T09:00', 55, 'HV6991', '2027-01-27T09:35', 60, 'HV6992', 'Transavia', '3ukjqn', '12:33'],
  ['RTM', 'FCO', 'Rome', 'Italië', 114, '2027-01-24T16:45', 130, 'HV6035', '2027-01-31T19:45', 145, 'HV6036', 'Transavia', 'wrhpx4', '12:33'],
  ['RTM', 'SVQ', 'Sevilla', 'Spanje', 114, '2027-01-24T17:30', 170, 'HV6855', '2027-01-29T19:35', 175, 'HV6856', 'Transavia', 'x2wrn9', '12:33'],
  ['RTM', 'AGP', 'Málaga', 'Spanje', 116, '2027-01-17T07:30', 170, 'HV5021', '2027-01-23T11:00', 175, 'HV5022', 'Transavia', '8j74sx', '12:33'],
  ['RTM', 'VLC', 'Valencia', 'Spanje', 118, '2026-12-07T07:30', 135, 'HV6443', '2026-12-11T19:45', 145, 'HV6442', 'Transavia', 'z8umvv', '12:33'],
  ['RTM', 'ALC', 'Alicante', 'Spanje', 123, '2027-01-25T07:00', 145, 'HV5051', '2027-01-28T19:40', 155, 'HV5052', 'Transavia', 'sgy66hf', '12:33'],
  ['RTM', 'SZG', 'Salzburg', 'Oostenrijk', 125, '2027-01-01T06:55', 85, 'HV5605', '2027-01-06T20:00', 90, 'HV5606', 'Transavia', '5dbs7d', '12:33'],
  ['RTM', 'INN', 'Innsbruck', 'Oostenrijk', 132, '2027-01-03T14:15', 85, 'HV6925', '2027-01-09T09:25', 90, 'HV6834', 'Transavia', '2d7ym3', '12:33'],
];
// id, vertrekpunt, bestemming (id of { toCity, toCountry }), aankomst, prijs, heen, terug, maatschappij, overstappen, extra
const SKY_DEALS = [
  // Eindhoven, retour
  ['ein-tia', 'EIN', 'tirana', 'TIA', 30, '2026-12-09', '2026-12-16', 'Ryanair', 0],
  ['ein-bgy', 'EIN', 'milaan', 'BGY', 36, '2026-12-02', '2026-12-09', 'Ryanair', 0],
  ['ein-stn', 'EIN', 'londen', 'STN', 36, '2026-12-05', '2026-12-12', 'Ryanair', 0],
  ['ein-fao', 'EIN', 'faro', 'FAO', 42, '2026-11-30', '2026-12-10', 'Ryanair', 0],
  ['ein-gro', 'EIN', 'girona', 'GRO', 43, '2026-12-07', '2026-12-14', 'Ryanair', 0],
  ['ein-krk', 'EIN', 'krakau', 'KRK', 44, '2026-12-08', '2026-12-09', 'Ryanair', 0],
  ['ein-bts', 'EIN', 'bratislava', 'BTS', 45, '2026-11-16', '2026-12-07', 'Ryanair', 0],
  ['ein-sof', 'EIN', 'sofia', 'SOF', 48, '2026-12-03', '2026-12-16', 'Ryanair', 0],
  ['ein-zag', 'EIN', 'zagreb', 'ZAG', 51, '2026-12-04', '2026-12-11', 'Ryanair', 0],
  ['ein-vno', 'EIN', 'vilnius', 'VNO', 54, '2026-12-05', '2026-12-12', 'Ryanair', 0],
  ['ein-pfo', 'EIN', 'paphos', 'PFO', 65, '2026-12-02', '2026-12-12', 'Ryanair', 0],
  ['ein-vie', 'EIN', 'wenen', 'VIE', 68, '2026-12-07', '2026-12-14', 'Ryanair', 0],
  ['ein-deb', 'EIN', 'debrecen', 'DEB', 69, '2027-01-22', '2027-01-29', 'Wizz Air', 0],
  ['ein-clj', 'EIN', 'cluj', 'CLJ', 70, '2026-12-31', '2027-01-19', 'Wizz Air', 0],
  ['ein-mla', 'EIN', 'malta', 'MLA', 72, '2026-12-10', '2026-12-13', 'Ryanair', 1],
  ['ein-beg', 'EIN', 'belgrado', 'BEG', 73, '2027-01-20', '2027-01-21', 'Wizz Air', 0],
  // Schiphol, enkele reis
  ['ams-dub', 'AMS', 'dublin', 'DUB', 25, '2026-12-09', null, 'Ryanair', 0, { tip: 'Skyscanner noemt ook een retour vanaf €48 (9 tot 14 dec 2026).' }],
  ['ams-agp', 'AMS', 'malaga', 'AGP', 37, '2027-01-10', null, 'Ryanair', 0],
  ['ams-nap', 'AMS', 'napels', 'NAP', 48, '2026-12-02', null, 'Ryanair', 1],
  ['ams-fao', 'AMS', 'faro', 'FAO', 50, '2026-12-09', null, 'Ryanair', 1],
  ['ams-bva', 'AMS', 'parijs', 'BVA', 52, '2026-12-12', null, 'Ryanair', 1, { tip: 'Aankomst Parijs Beauvais (ver buiten de stad). Ter vergelijking: de trein naar Parijs kost vanaf €35.' }],
  ['ams-dbv', 'AMS', 'dubrovnik', 'DBV', 54, '2026-12-12', null, 'Ryanair', 1],
  ['ams-rba', 'AMS', { toCity: 'Rabat', toCountry: 'Marokko' }, 'RBA', 54, '2026-12-05', null, 'Ryanair', 1],
  ['ams-ham', 'AMS', 'hamburg', 'HAM', 58, '2026-12-09', null, 'Ryanair', 1, { tip: 'De trein naar Hamburg kost vanaf €33 en heeft geen overstap op een vliegveld.' }],
  ['ams-tia', 'AMS', 'tirana', 'TIA', 59, '2026-12-01', null, 'Ryanair', 1],
  ['ams-mla', 'AMS', 'malta', 'MLA', 60, '2027-01-25', null, 'easyJet', 0],
  ['ams-tos', 'AMS', 'tromso', 'TOS', 62, '2027-01-24', null, 'easyJet', 0, { tip: 'Noorderlicht-seizoen.' }],
  ['ams-vce', 'AMS', 'venetie', 'VCE', 62, '2027-03-03', null, 'easyJet', 0],
  ['ams-prg', 'AMS', 'praag', 'PRG', 64, '2027-02-25', null, 'easyJet', 0],
  ['ams-rak', 'AMS', { toCity: 'Marrakech', toCountry: 'Marokko' }, 'RAK', 65, '2026-11-23', null, 'easyJet', 0],
  ['ams-wmi', 'AMS', 'warschau', 'WMI', 66, '2027-01-16', null, 'Ryanair', 1, { tip: 'Aankomst Warschau Modlin (buiten de stad).' }],
  // Groningen, enkele reis
  ['grq-her', 'GRQ', 'heraklion', 'HER', 152, '2027-08-26', null, 'Corendon', 0],
  ['grq-ayt', 'GRQ', 'antalya', 'AYT', 155, '2027-05-18', null, 'Corendon', 0, { tip: 'Skyscanner noemt ook een retour naar Antalya vanaf €303.' }],
  ['grq-bzo', 'GRQ', 'bolzano', 'BZO', 180, '2027-05-10', null, 'Sky Alps', 0, { tip: 'Rechtstreeks naar de Dolomieten.' }],
  ['grq-lpa', 'GRQ', 'gran-canaria', 'LPA', 222, '2026-11-13', null, 'TUI', 0],
];
const AIRPORT_NAMES = { MXP: 'Milaan Malpensa', LIN: 'Milaan Linate', BGY: 'Milaan Bergamo', STN: 'Londen Stansted', SEN: 'Londen Southend', LGW: 'Londen Gatwick', LTN: 'Londen Luton', LHR: 'Londen Heathrow', BVA: 'Parijs Beauvais', CDG: 'Parijs Charles de Gaulle', ORY: 'Parijs Orly', FCO: 'Rome Fiumicino', CIA: 'Rome Ciampino', TSF: 'Venetië Treviso', VCE: 'Venetië Marco Polo', WMI: 'Warschau Modlin', WAW: 'Warschau Chopin', BCN: 'Barcelona', GRO: 'Girona' };
// Een Kiwi.com-vlucht aanvullen tot een volledige deal (ook gebruikt voor de dagelijkse controle en live zoeken)
function kiwiDeal(r) {
  const ret = !!r.back, n = r.transfers || 0;
  const bagKey = r.bag === 'hand' ? '-hb' : r.bag === 'koffer' ? '-kb' : '';
  const d = { mode: 'vliegtuig', trip: ret ? 'retour' : 'enkel', priceType: 'gevonden', transfers: 0, bag: 'tasje', src: ['kiwi'], book: 'kiwi', ...r };
  if (!d.id) d.id = `kiwi-${d.from}-${d.arr}${ret ? '-r' : ''}${bagKey}${d.tag ? '-' + d.tag : ''}`.toLowerCase();
  if (!d.note) {
    const bag = { koffer: 'Ruimbagage (koffer) is inbegrepen.', hand: 'Een handbagagekoffer is inbegrepen.', tasje: 'Alleen een klein tasje is inbegrepen.' }[d.bag] || '';
    const fl = ret ? `heen ${d.flight || '?'}, terug ${d.backFlight || '?'}` : `vlucht ${d.flight || '?'}`;
    d.note = `Live gevonden via Kiwi.com${d.via ? ' door ' + d.via : ''}: ${fl}, ${n ? `${n} overstap${n > 1 ? 'pen' : ''}` : 'rechtstreeks'}. ${bag}`
      + (d.backFrom && d.backFrom !== d.arr ? ` Let op: de terugvlucht vertrekt vanaf ${AIRPORT_NAMES[d.backFrom] || d.backFrom} (${d.backFrom}), niet vanaf het vliegveld waar je aankomt.` : '')
      + (d.backTo && d.backTo !== d.from ? ` Let op: de terugvlucht landt op ${(ORIGINS[d.backTo] || {}).n || d.backTo}, niet op het vliegveld waar je vertrekt.` : '')
      + (d.from === 'NRN' ? ' Weeze ligt net over de grens in Duitsland; reken op extra reistijd om er te komen.' : '')
      + (d.from === 'CRL' ? ' Charleroi ligt ongeveer 45 km ten zuiden van Brussel; reken op extra reistijd om er te komen.' : '');
  }
  return d;
}

/* ---------- Gecontroleerde deals ---------- */
const SNAPSHOT_DEALS = [
  // ===== TREIN: NS International (vanafprijs, enkele reis p.p., 2e klas, vanaf Amsterdam Centraal) =====
  { id: 'nsi-parijs', mode: 'trein', provider: 'Eurostar', from: 'ASDS', to: 'parijs', price: 35, trip: 'enkel', priceType: 'vanaf', dur: 205, transfers: 0, bag: 'koffer',
    note: 'Standard/2e klas, enkele reis. Eurostar noemt dezelfde vanafprijs ook vanaf Schiphol en Rotterdam C. Afhankelijk van beschikbaarheid.', src: ['nsiGroep', 'eurostar'], checked: T('12:29'), book: 'eurostar' },
  { id: 'nsi-londen', mode: 'trein', provider: 'Eurostar', from: 'ASD', to: 'londen', price: 88, trip: 'retour', priceType: 'vanaf', dur: 260, transfers: 0, bag: 'koffer',
    note: 'Retour vanaf €88 (NS International). Eurostar: vanaf €44 per reis met verplichte terugreis, voor reizen tussen 18 nov 2026 en 14 feb 2027.', src: ['nsiGroep', 'eurostar'], checked: T('12:29'), book: 'eurostar' },
  { id: 'nsi-berlijn', mode: 'trein', provider: 'NS International (ICE/IC)', from: 'ASD', to: 'berlijn', price: 38, trip: 'enkel', priceType: 'vanaf', dur: 351, transfers: 0, bag: 'koffer',
    note: 'Enkele reis, 2e klas. Reistijd volgens NS International: 5.51 uur.', src: ['nsiGroep'], checked: T('12:29'), book: 'nsi' },
  { id: 'nsi-disney', mode: 'trein', provider: 'Eurostar (via NS International)', from: 'ASD', to: 'disneyland', price: 35, trip: 'enkel', priceType: 'vanaf', dur: 230, transfers: null, bag: 'koffer',
    note: 'Marne-la-Vallée (Disneyland Paris). Enkele reis, 2e klas.', src: ['nsiGroep'], checked: T('12:29'), book: 'eurostar' },
  { id: 'nsi-hamburg', mode: 'trein', provider: 'NS International', from: 'ASD', to: 'hamburg', price: 33, trip: 'enkel', priceType: 'vanaf', dur: 315, transfers: null, bag: 'koffer',
    note: 'Enkele reis, 2e klas. Reistijd volgens NS International: 5.15 uur.', src: ['nsiGroep'], checked: T('12:29'), book: 'nsi' },
  { id: 'nsi-brussel', mode: 'trein', provider: 'NS International', from: 'ASD', to: 'brussel', price: 25, trip: 'enkel', priceType: 'vanaf', dur: 116, transfers: 0, bag: 'koffer',
    note: 'Enkele reis, 2e klas. Eurostar noemt Brussel vanaf €29 (Standard).', src: ['nsiGroep', 'eurostar'], checked: T('12:29'), book: 'nsi' },
  { id: 'nsi-munchen', mode: 'trein', provider: 'NS International (ICE)', from: 'ASD', to: 'munchen', price: 38, trip: 'enkel', priceType: 'vanaf', dur: 417, transfers: null, bag: 'koffer',
    note: 'Enkele reis, 2e klas. Reistijd volgens NS International: 6.57 uur.', src: ['nsiGroep'], checked: T('12:29'), book: 'nsi' },
  { id: 'nsi-antwerpen', mode: 'trein', provider: 'NS International', from: 'ASD', to: 'antwerpen', price: 20, trip: 'enkel', priceType: 'vanaf', dur: 75, transfers: 0, bag: 'koffer',
    note: 'Enkele reis, 2e klas. De tabel en de stadskaart noemen €20; in het blok met topbestemmingen op de homepage staat €21.', src: ['nsiGroep', 'nsiHome'], checked: T('12:29'), book: 'nsi' },
  { id: 'nsi-antwerpen-rtd', mode: 'trein', provider: 'NS International (Eurocity Direct)', from: 'RTD', to: 'antwerpen', price: 12, trip: 'enkel', priceType: 'vanaf', dur: null, transfers: 0, bag: 'koffer',
    note: 'Actie "Met korting naar Antwerpen": vanaf €12 vanuit Rotterdam. Voorwaarden en periode staan op de actiepagina van NS International.', src: ['nsiHome'], checked: T('12:33'), book: 'nsi' },
  { id: 'nsi-frankfurt', mode: 'trein', provider: 'NS International (ICE)', from: 'ASD', to: 'frankfurt', price: 38, trip: 'enkel', priceType: 'vanaf', dur: 233, transfers: 0, bag: 'koffer',
    note: 'Enkele reis, 2e klas. Reistijd volgens NS International: 3.53 uur.', src: ['nsiGroep'], checked: T('12:29'), book: 'nsi' },
  { id: 'nsi-wenen', mode: 'trein', provider: 'NS International', from: 'ASD', to: 'wenen', price: 35, trip: 'enkel', priceType: 'vanaf', dur: 727, transfers: null, bag: 'koffer',
    note: 'Enkele reis, 2e klas. Reistijd volgens NS International: 12.07 uur (nachttrein).', src: ['nsiGroep'], checked: T('12:29'), book: 'nsi' },
  { id: 'nsi-keulen', mode: 'trein', provider: 'NS International (ICE)', from: 'ASD', to: 'keulen', price: 20, trip: 'enkel', priceType: 'vanaf', dur: 157, transfers: 0, bag: 'koffer',
    note: 'Enkele reis, 2e klas. Reistijd volgens NS International: 2.37 uur.', src: ['nsiGroep'], checked: T('12:29'), book: 'nsi' },
  { id: 'nsi-dusseldorf', mode: 'trein', provider: 'NS International (ICE)', from: 'ASD', to: 'dusseldorf', price: 20, trip: 'enkel', priceType: 'vanaf', dur: null, transfers: 0, bag: 'koffer',
    note: 'Vanafprijs van de homepage van NS International. De bron noemt geen reistijd; de app schat die.', src: ['nsiHome'], checked: T('12:33'), book: 'nsi' },

  // ===== TREIN: Deutsche Bahn =====
  { id: 'db-keulen', mode: 'trein', provider: 'Deutsche Bahn', from: 'ASD', to: 'keulen', price: 24.99, trip: 'enkel', priceType: 'vanaf', dur: 157, transfers: 0, bag: 'koffer',
    note: 'Voordelig tarief Europa: vanaf €24,99 op korte trajecten, bv. Keulen–Amsterdam. Tot 12 maanden vooruit te boeken. Kinderen onder 14 reizen in veel gevallen gratis mee met iemand van 15 jaar of ouder.', src: ['dbNL'], checked: T('12:33'), book: 'db' },
  { id: 'db-berlijn', mode: 'trein', provider: 'Deutsche Bahn', from: 'ASD', to: 'berlijn', price: 44.99, trip: 'enkel', priceType: 'vanaf', dur: 351, transfers: 0, bag: 'koffer',
    note: 'Voordelig tarief Europa: vanaf €44,99 op langere trajecten, bv. Berlijn–Amsterdam.', src: ['dbNL'], checked: T('12:33'), book: 'db' },
  { id: 'db-young-keulen', mode: 'trein', provider: 'Deutsche Bahn (Young)', from: 'ASD', to: 'keulen', price: 18.99, trip: 'enkel', priceType: 'vanaf', dur: 157, transfers: 0, bag: 'koffer', who: 'jongeren',
    note: 'Super Sparpreis Europa Young: vanaf €18,99 in de 2e klas op korte trajecten, bv. Keulen–Amsterdam. Alleen voor jongeren (leeftijdsgrens: zie DB).', src: ['dbYoung'], checked: T('12:34'), book: 'db' },
  { id: 'db-young-berlijn', mode: 'trein', provider: 'Deutsche Bahn (Young)', from: 'ASD', to: 'berlijn', price: 29.99, trip: 'enkel', priceType: 'vanaf', dur: 351, transfers: 0, bag: 'koffer', who: 'jongeren',
    note: 'Super Sparpreis Europa Young: vanaf €29,99 op lange trajecten, bv. Berlijn of Frankfurt–Amsterdam. Alleen voor jongeren.', src: ['dbYoung'], checked: T('12:34'), book: 'db' },
  { id: 'db-young-frankfurt', mode: 'trein', provider: 'Deutsche Bahn (Young)', from: 'ASD', to: 'frankfurt', price: 29.99, trip: 'enkel', priceType: 'vanaf', dur: 233, transfers: 0, bag: 'koffer', who: 'jongeren',
    note: 'Super Sparpreis Europa Young: vanaf €29,99 op lange trajecten, bv. Frankfurt–Amsterdam. Alleen voor jongeren.', src: ['dbYoung'], checked: T('12:34'), book: 'db' },

  // ===== TREIN: nachttreinen en wintersport =====
  { id: 'es-berlijn', mode: 'trein', provider: 'European Sleeper (nachttrein)', from: 'ASD', to: 'berlijn', price: 39, trip: 'enkel', priceType: 'vanaf', dur: null, transfers: 0, bag: 'koffer',
    note: 'Nachttrein Brussel–Amsterdam–Berlijn: zitplaats vanaf €39, couchette vanaf €69, slaapcoupé vanaf €109. Rijdt 3 keer per week.', src: ['nsiES'], checked: T('12:33'), book: 'es' },
  { id: 'es-brussel', mode: 'trein', provider: 'European Sleeper (nachttrein)', from: 'ASD', to: 'brussel', price: 14, trip: 'enkel', priceType: 'vanaf', dur: null, transfers: 0, bag: 'koffer',
    note: 'Zitplaats tussen Nederland en België vanaf €14. Rijdt 3 keer per week; tijden wisselen, controleer het boekingssysteem.', src: ['nsiES'], checked: T('12:33'), book: 'es' },
  { id: 'nj-innsbruck', mode: 'trein', provider: 'ÖBB Nightjet (via NS International)', from: 'NJ', to: 'innsbruck', price: 35, trip: 'enkel', priceType: 'vanaf', dur: null, transfers: 0, bag: 'koffer',
    note: 'Nachttrein, rechtstreeks. Zitplaats vanaf €35, ligplaats vanaf €55, slaapplaats vanaf €100. Vanaf Amsterdam, Amersfoort of Deventer.', src: ['nsiInn', 'nsiWinter'], checked: T('12:34'), book: 'nsi' },
  { id: 'ice-innsbruck', mode: 'trein', provider: 'NS International (ICE)', from: 'ASD', to: 'innsbruck', price: 38, trip: 'enkel', priceType: 'vanaf', dur: null, transfers: 2, bag: 'koffer',
    note: 'Overdag met ICE, 2 overstappen vanaf Amsterdam Centraal.', src: ['nsiInn'], checked: T('12:34'), book: 'nsi' },
  { id: 'nj-salzburg', mode: 'trein', provider: 'ÖBB Nightjet (via NS International)', from: 'ASD', to: 'salzburg', price: 38, trip: 'enkel', priceType: 'vanaf', dur: null, transfers: 0, bag: 'koffer',
    note: 'Nachttrein, rechtstreeks (sinds 13 juni 2026): je komt de volgende ochtend aan. De bron noemt geen duidelijke reistijd; de app schat die. NS International weet nog niet of deze directe trein in 2027 blijft rijden.', src: ['nsiSzg'], checked: T('12:34'), book: 'nsi' },
  { id: 'ice-salzburg', mode: 'trein', provider: 'NS International (ICE)', from: 'ASD', to: 'salzburg', price: 40, trip: 'enkel', priceType: 'vanaf', dur: 561, transfers: 2, bag: 'koffer',
    note: 'Overdag met ICE: 9 uur 21 minuten met 1 tot 2 overstappen.', src: ['nsiSzg'], checked: T('12:34'), book: 'nsi' },
  { id: 'nj-westendorf', mode: 'trein', provider: 'ÖBB Nightjet (via NS International)', from: 'ASD', to: 'westendorf', price: 37, trip: 'enkel', priceType: 'vanaf', dur: null, transfers: 1, bag: 'koffer',
    note: 'Nachttrein naar Wörgl, daar overstappen op de trein naar Westendorf. Vroeg boeken is voordelig.', src: ['nsiWest', 'nsiWinter'], checked: T('12:34'), book: 'nsi' },

  // ===== BUS: FlixBus en BlaBlaCar Bus (via Kombo) =====
  { id: 'bla-parijs', mode: 'bus', provider: 'BlaBlaCar Bus', from: 'BUSA', to: 'parijs', price: 17.99, trip: 'enkel', priceType: 'vanaf', dur: 370, transfers: 0, bag: 'koffer', km: 431, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo (prijzen van 9 nov 2026). Ongeveer 6 uur 10 minuten.', src: ['kPar'], checked: T('12:32'), book: 'kombo-par' },
  { id: 'flix-parijs', mode: 'bus', provider: 'FlixBus', from: 'BUSA', to: 'parijs', price: 18.24, trip: 'enkel', priceType: 'vanaf', dur: 370, transfers: 0, bag: 'koffer', km: 431, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo (prijzen van 9 nov 2026).', src: ['kPar'], checked: T('12:32'), book: 'flixbus' },
  { id: 'flix-berlijn', mode: 'bus', provider: 'FlixBus', from: 'BUSA', to: 'berlijn', price: 25.98, trip: 'enkel', priceType: 'vanaf', dur: 495, transfers: 0, bag: 'koffer', km: 577, srcDate: '2026-11-10',
    note: 'Laagste prijs volgens Kombo (prijzen van 10 nov 2026). Goedkoopste datum: dinsdag 24 nov 2026, vanaf €26. Rit van ongeveer 8 uur 15 minuten.', src: ['kBer'], checked: T('12:32'), book: 'flixbus' },
  { id: 'flix-brussel', mode: 'bus', provider: 'FlixBus', from: 'BUSA', to: 'brussel', price: 8.19, trip: 'enkel', priceType: 'vanaf', dur: 160, transfers: 0, bag: 'koffer', km: 175, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo. Goedkoopste datum in de kalender: donderdag 12 nov 2026, vanaf €9.', src: ['kBru'], checked: T('12:32'), book: 'kombo-bru' },
  { id: 'bla-brussel', mode: 'bus', provider: 'BlaBlaCar Bus', from: 'BUSA', to: 'brussel', price: 8.99, trip: 'enkel', priceType: 'vanaf', dur: 160, transfers: 0, bag: 'koffer', km: 175, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo (prijzen van 9 nov 2026).', src: ['kBru'], checked: T('12:32'), book: 'kombo-bru' },
  { id: 'flix-praag', mode: 'bus', provider: 'FlixBus', from: 'BUSA', to: 'praag', price: 37.98, trip: 'enkel', priceType: 'vanaf', dur: 795, transfers: 0, bag: 'koffer', km: 710, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo. Goedkoopste data: maandag 23 en woensdag 25 nov 2026, vanaf €38. Rit van ongeveer 13 uur 15 minuten.', src: ['kPrg'], checked: T('12:32'), book: 'kombo-prg' },
  { id: 'flix-zurich', mode: 'bus', provider: 'FlixBus', from: 'BUSA', to: 'zurich', price: 46.98, trip: 'enkel', priceType: 'vanaf', dur: 745, transfers: 0, bag: 'koffer', km: 614, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo. Goedkoopste datum: zaterdag 21 nov 2026, vanaf €47. BlaBlaCar Bus vanaf €49,99.', src: ['kZrh'], checked: T('12:32'), book: 'kombo-zrh' },
  { id: 'bla-lille', mode: 'bus', provider: 'BlaBlaCar Bus', from: 'BUSA', to: 'lille', price: 9.99, trip: 'enkel', priceType: 'vanaf', dur: 225, transfers: 0, bag: 'koffer', km: 232, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo. Goedkoopste datum: zaterdag 14 nov 2026, vanaf €10. FlixBus vanaf €10,49.', src: ['kLil'], checked: T('12:32'), book: 'kombo-lil' },

  // ===== BUS: extra routes en vertrekplaatsen (Kombo, gecontroleerd 9 nov 2026 rond 22:28) =====
  { id: 'bla-rtd-parijs', mode: 'bus', provider: 'BlaBlaCar Bus', from: 'BUSR', to: 'parijs', price: 19.99, trip: 'enkel', priceType: 'vanaf', dur: 398, transfers: 0, bag: 'koffer', km: 372, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo (prijzen van 9 nov 2026). FlixBus vanaf €20,98. Goedkoopste datum in de kalender: dinsdag 10 nov 2026, vanaf €20. Ongeveer 6 uur 38 minuten.', src: ['kRtdPar'], checked: T('12:33'), book: 'kombo-route' },
  { id: 'flix-hamburg', mode: 'bus', provider: 'FlixBus', from: 'BUSA', to: 'hamburg', price: 23.48, trip: 'enkel', priceType: 'vanaf', dur: 325, transfers: 0, bag: 'koffer', km: 367, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo (prijzen van 9 nov 2026). Goedkoopste datum: dinsdag 24 nov 2026, vanaf €24. Ongeveer 5 uur 25 minuten.', src: ['kAmsHam'], checked: T('12:33'), book: 'kombo-route' },
  { id: 'flix-londen', mode: 'bus', provider: 'FlixBus', from: 'BUSA', to: 'londen', price: 36.98, trip: 'enkel', priceType: 'vanaf', dur: 630, transfers: 0, bag: 'koffer', km: 358, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo (prijzen van 9 nov 2026). Goedkoopste datum: vrijdag 8 jan 2027, vanaf €37. Rit van ongeveer 10,5 uur.', src: ['kAmsLon'], checked: T('12:33'), book: 'kombo-route' },
  { id: 'flix-utr-brussel', mode: 'bus', provider: 'FlixBus', from: 'BUSU', to: 'brussel', price: 10.98, trip: 'enkel', priceType: 'vanaf', dur: 155, transfers: 0, bag: 'koffer', km: 147, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo (prijzen van 9 nov 2026). Goedkoopste datum: vrijdag 13 nov 2026, vanaf €11. Vertrek vanaf Utrecht Centraal.', src: ['kUtrBru'], checked: T('12:33'), book: 'kombo-route' },
  { id: 'flix-kopenhagen', mode: 'bus', provider: 'FlixBus', from: 'BUSA', to: 'kopenhagen', price: 42.98, trip: 'enkel', priceType: 'vanaf', dur: 745, transfers: 0, bag: 'koffer', km: 622, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo (prijzen van 9 nov 2026). Goedkoopste datum: maandag 7 dec 2026, vanaf €44. Rit van ruim 12 uur.', src: ['kAmsCph'], checked: T('12:33'), book: 'kombo-route' },
  { id: 'flix-luxemburg', mode: 'bus', provider: 'FlixBus', from: 'BUSA', to: 'luxemburg', price: 22.98, trip: 'enkel', priceType: 'vanaf', dur: 345, transfers: 0, bag: 'koffer', km: 320, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo (prijzen van 9 nov 2026). BlaBlaCar Bus vanaf €25,99. Goedkoopste datum: woensdag 25 nov 2026, vanaf €23.', src: ['kAmsLux'], checked: T('12:33'), book: 'kombo-route' },
  { id: 'flix-straatsburg', mode: 'bus', provider: 'FlixBus', from: 'BUSA', to: 'straatsburg', price: 29.98, trip: 'enkel', priceType: 'vanaf', dur: 525, transfers: 0, bag: 'koffer', km: 469, srcDate: '2026-11-09',
    note: 'Laagste prijs volgens Kombo (prijzen van 9 nov 2026). BlaBlaCar Bus vanaf €31,99. Goedkoopste datum: vrijdag 8 jan 2027, vanaf €30. Leuk in december: de kerstmarkt.', src: ['kAmsStr'], checked: T('12:33'), book: 'kombo-route' },
  { id: 'flix-ein-parijs', mode: 'bus', provider: 'FlixBus', from: 'BUSE', to: 'parijs', price: 17.99, trip: 'enkel', priceType: 'vanaf', dur: 345, transfers: 0, bag: 'koffer', km: 363, srcDate: '2026-11-10',
    note: 'Laagste prijs volgens Kombo (prijzen van 10 nov 2026). Goedkoopste datum: woensdag 2 dec 2026, vanaf €18. Ongeveer 5 uur 45 minuten. Vertrek vanaf Eindhoven Centraal of Eindhoven Airport.', src: ['kEinPar'], checked: T('12:33'), book: 'kombo-route' },

  // ===== VLIEGTUIG: live gevonden met de Kiwi.com-connector =====
  // Enkele reis: de dagelijkse controle van 10 nov 2026, 06:33. Retour: live opgehaald op 10 nov 2026 tussen 12:29 en 12:33
  // (2 tot 7 nachten, vertrek tussen 12 nov 2026 en 25 jan 2027; plus twee retourvluchten binnen de kerstvakantie). Altijd 1 volwassene, rechtstreeks, alleen een klein tasje inbegrepen.
  ...KIWI_ONEWAY.map(([from, arr, toCity, toCountry, price, dep, dur, flight, provider, code]) => kiwiDeal({
    from, arr, toCity, toCountry, price, out: dep.slice(0, 10), depTime: dep.slice(11, 16), dur, flight, provider,
    link: `https://kiwi.com/u/${code}`, checked: T('06:33'), via: 'de dagelijkse controle' })),
  ...KIWI_RETURN.map(([from, arr, toCity, toCountry, price, dep, dur, flight, back, backDur, backFlight, provider, code, hhmm, backFrom, tag]) => kiwiDeal({
    tag,
    from, arr, toCity, toCountry, price, out: dep.slice(0, 10), depTime: dep.slice(11, 16), dur, flight, provider,
    back: back.slice(0, 10), backTime: back.slice(11, 16), backDur, backFlight, backFrom,
    link: `https://kiwi.com/u/${code}`, checked: T(hhmm) })),

  // ===== VLIEGTUIG: indicaties van Skyscanner (gelezen op 10 nov 2026, 12:32) =====
  // Skyscanner noemt dit zelf een schatting op basis van prijzen van de laatste 4 dagen. Daarom staan ze als "Indicatie" in de app.
  ...SKY_DEALS.map(([id, from, to, arr, price, out, back, provider, transfers, extra]) => ({
    id, mode: 'vliegtuig', provider, from, arr, price, trip: back ? 'retour' : 'enkel', priceType: 'gevonden', indic: true,
    out, back: back || undefined, transfers, bag: from === 'GRQ' ? 'onbekend' : 'tasje',
    src: [{ EIN: 'skyEIN', AMS: 'skyAMS', GRQ: 'skyGRQ' }[from]], checked: T('12:32'), book: 'sky',
    ...(typeof to === 'string' ? { to } : to), ...(extra || {}),
    note: `Indicatie van Skyscanner: een schatting op basis van prijzen van de laatste 4 dagen${transfers ? `, met ${transfers} overstap${back ? ' per richting' : ''}` : ', rechtstreeks'}. De prijs kan al anders zijn.${extra && extra.tip ? ' ' + extra.tip : ''}`,
  })),
];

/* ---------- Slimme kaartjes en kortingen (echte prijzen 2026) ---------- */
const PASSES = [
  { id: 'ns-groep', title: 'NS Groepsticket', price: '€38,50 voor 2–3 personen', sub: '+ €4,50 per persoon (4 t/m 7). Met 7 personen ≈ €8,07 p.p. per enkele reis.',
    who: ['groep'], body: 'Eén enkele reis naar dezelfde bestemming in heel Nederland. Doordeweeks in de daluren en het hele weekend.', src: ['nsPrijzen', 'groepGeldig'], checked: T9('20:33'), book: 'ns' },
  { id: 'ns-dal', title: 'NS Flex Dal Voordeel', price: '€6,35 per maand', sub: '40% korting buiten de spits. Gratis voor jongeren van 12 t/m 17 jaar.',
    who: ['jongeren', 'iedereen'], body: 'Handig als je vaker buiten de spits reist. Jaarabonnement op saldo: €76,20 per jaar.', src: ['nsPrijzen', 'jongNS'], checked: T9('20:33'), book: 'ns' },
  { id: 'ns-ptd', title: 'NS PrijsTijd Deals voor jongeren', price: '20% extra korting', sub: 'Voor 12 t/m 17 jaar, bovenop de PrijsTijd Deal.',
    who: ['jongeren'], body: 'Vroegboekkorting voor rustige treinen; koop je kaartje minstens een dag van tevoren. (Bericht van okt 2025.)', src: ['jongNS'], checked: T9('20:37'), book: 'ns' },
  { id: 'ns-railrunner', title: 'Railrunner', price: '€2,50', sub: 'Kinderen van 4 t/m 11 jaar die met een volwassene reizen.',
    who: ['kinderen'], body: 'Een vaste lage prijs per reisdag voor kinderen in de trein.', src: ['nsPrijzen'], checked: T9('20:33'), book: 'ns' },
  { id: 'ns-weekendvrij', title: 'NS Flex Weekend Vrij', price: '€39,50 per maand', sub: 'Onbeperkt reizen in het weekend (2e klas). 65+: €28,95 per maand.',
    who: ['iedereen', '65plus'], body: 'Slim als je vaak in het weekend reist, bijvoorbeeld voor stedentrips binnen Nederland.', src: ['nsPrijzen'], checked: T9('20:33'), book: 'ns' },
  { id: 'ns-60', title: 'NS Keuzedagen 60+', price: '€34,95 per jaar', sub: 'Alleen in combinatie met Dal Voordeel. NS Flex Dal Vrij 65+: €59,95 per maand.',
    who: ['65plus'], body: 'Extra reisdagen voor ouderen; zie de voorwaarden bij NS.', src: ['nsPrijzen'], checked: T9('20:33'), book: 'ns' },
  { id: 'db-groep', title: 'DB supervoordelig groepstarief Europa', price: 'vanaf €14,99 p.p.', sub: 'Vanaf 6 personen. Gratis zitplaatsreservering; kinderen vanaf 6 jaar halve prijs.',
    who: ['groep'], body: 'Voor groepsreizen met Deutsche Bahn tussen Nederland en Duitsland (niet voor regionaal vervoer).', src: ['dbGroep'], checked: T9('20:44'), book: 'db' },
  { id: 'db-young', title: 'DB Super Sparpreis Europa Young', price: 'vanaf €18,99', sub: 'Kort traject (bv. Keulen); vanaf €29,99 voor lange trajecten (bv. Berlijn).',
    who: ['jongeren'], body: 'Goedkope enkele reis in de 2e klas tussen Nederland en Duitsland voor jongeren.', src: ['dbYoung'], checked: T9('20:44'), book: 'db' },
  { id: 'eurostar-kids', title: 'Eurostar met kinderen', price: '30% tot 50% korting', sub: 'Kinderen 4–11 jaar: 30% in de spits, tot 50% daarbuiten. Onder 4 jaar gratis.',
    who: ['kinderen'], body: 'Volgens de pagina met speciale tarieven van Eurostar (gezien via zoekresultaat).', src: ['eurostarKids'], checked: T9('20:36'), book: 'eurostar' },
  { id: 'eurostar-snap', title: 'Eurostar Snap', price: 'tot 50% korting', sub: 'Last-minute naar Parijs of Londen als je flexibel bent met je reistijd.',
    who: ['iedereen'], body: 'Je kiest de dag, Eurostar kiest de trein. Alleen zinvol als je flexibel bent.', src: ['eurostarAll'], checked: T9('20:36'), book: 'eurostar' },
];

/* ---------- Tips zonder vaste prijs ---------- */
const TIPS = [
  { title: 'Nachttrein naar Praag en Milaan', body: 'European Sleeper rijdt 3 keer per week Brussel–Amsterdam–Berlijn–Dresden–Praag. Instappen kan o.a. in Rotterdam, Den Haag HS, Amsterdam, Amersfoort en Deventer. Sinds 9 september 2026 rijdt er ook een nachttrein Brussel–Keulen–Zürich–Milaan (overstappen in Amsterdam of Utrecht naar Keulen). Prijzen voor Praag en Milaan staan niet op de pagina.', src: ['nsiES'], type: 'stad' },
  { title: 'Skitrein naar de Franse Alpen', body: 'De Travelski Night Express rijdt op vrijdagavond van 18 dec 2026 tot en met 26 mrt 2027 vanaf Amsterdam (ook Rotterdam, Antwerpen en Brussel).', src: ['nightride'], type: 'ski' },
  { title: 'Nightjet wintersport 2026–2027', body: 'Volgens Snowplaza: minicabine of couchette vanaf €54,90 en slaapcoupé vanaf €89,90 als je vroeg boekt. De Nightjet naar Innsbruck stopt ook in Kufstein, Wörgl en Jenbach.', src: ['snowplaza'], type: 'ski' },
  { title: 'Wintersport na 12 december', body: 'NS International verkoopt nog geen treintickets voor wintersport na 12 dec 2026. Houd de site in de gaten.', src: ['nsiWinter'], type: 'ski' },
];

/* ---------- Schoolvakanties 2026-2027 (Rijksoverheid; gelezen op 10 nov 2026) ---------- */
// Kerst-, mei- en zomervakantie liggen vast. De voorjaarsvakantie is een advies: je school mag afwijken.
const HOLIDAYS = [
  { id: 'kerst', n: 'Kerstvakantie', all: ['2026-12-19', '2027-01-03'] },
  { id: 'voorjaar', n: 'Voorjaarsvakantie', noord: ['2027-02-20', '2027-02-28'], midden: ['2027-02-20', '2027-02-28'], zuid: ['2027-02-13', '2027-02-21'] },
  { id: 'mei', n: 'Meivakantie', all: ['2027-04-24', '2027-05-02'] },
  { id: 'zomer', n: 'Zomervakantie', noord: ['2027-07-10', '2027-08-22'], midden: ['2027-07-17', '2027-08-29'], zuid: ['2027-07-24', '2027-09-05'] },
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
