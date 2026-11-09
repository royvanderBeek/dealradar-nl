# Bouwt basisdata voor DealRadar NL uit open datasets:
# - trainline-eu/stations (stations.csv, ODbL) -> NL-stations + coördinaten bestemmingen
# - OurAirports (airports.csv, public domain) -> vliegvelden
import csv, json, unicodedata
RAW='/home/claude/data/raw/'
st=list(csv.DictReader(open(RAW+'stations.csv',encoding='utf-8'),delimiter=';'))
ap={r['iata_code']:r for r in csv.DictReader(open(RAW+'airports.csv',encoding='utf-8')) if r['iata_code']}

def norm(s):
    return unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()

# --- NL stations ---
nl=[]
seen=set()
for r in st:
    if r['country']!='NL' or r['is_suggestable']!='t' or not r['uic']: continue
    name=r['name'].replace('Amsterdam-Centraal','Amsterdam Centraal')
    if name in seen: continue
    seen.add(name)
    nl.append([name, round(float(r['latitude']),5), round(float(r['longitude']),5), r['uic']])
nl.sort(key=lambda x:x[0])
print('NL stations:',len(nl))

def station(name,cc=None):
    n=norm(name)
    c=[r for r in st if norm(r['name'])==n and (cc is None or r['country']==cc) and r['latitude']]
    if not c:
        c=[r for r in st if n in norm(r['name']) and (cc is None or r['country']==cc) and r['latitude']]
    if not c: return None
    r=c[0]; return (round(float(r['latitude']),4), round(float(r['longitude']),4), r['name'])

def airport(code):
    r=ap.get(code)
    if not r: return None
    return (round(float(r['latitude_deg']),4), round(float(r['longitude_deg']),4), r['name'])

# id, naam, land, cc, types, station (of None), iata (hoofd), engelse naam, extra codes
D=[
 ('parijs','Parijs','Frankrijk','FR',['stad'],'Paris Gare du Nord','PAR','Paris',['CDG','ORY','BVA']),
 ('disneyland','Disneyland Paris','Frankrijk','FR',['stad'],'Marne-la-Vallée – Chessy',None,'Marne-la-Vallee',[]),
 ('berlijn','Berlijn','Duitsland','DE',['stad'],'Berlin Hbf','BER','Berlin',[]),
 ('londen','Londen','Verenigd Koninkrijk','GB',['stad'],'London St Pancras','LON','London',['LHR','LGW','STN','LTN','SEN','LCY']),
 ('hamburg','Hamburg','Duitsland','DE',['stad'],'Hamburg Hbf','HAM','Hamburg',[]),
 ('brussel','Brussel','België','BE',['stad'],'Bruxelles-Midi','BRU','Brussels',['CRL']),
 ('munchen','München','Duitsland','DE',['stad'],'München Hbf','MUC','Munich',[]),
 ('antwerpen','Antwerpen','België','BE',['stad'],'Antwerpen-Centraal',None,'Antwerp',['ANR']),
 ('frankfurt','Frankfurt','Duitsland','DE',['stad'],'Frankfurt (Main) Hbf','FRA','Frankfurt',['HHN']),
 ('wenen','Wenen','Oostenrijk','AT',['stad'],'Wien Hbf','VIE','Vienna',[]),
 ('keulen','Keulen','Duitsland','DE',['stad'],'Köln Hbf','CGN','Cologne',[]),
 ('dusseldorf','Düsseldorf','Duitsland','DE',['stad'],'Düsseldorf Hbf','DUS','Dusseldorf',[]),
 ('praag','Praag','Tsjechië','CZ',['stad'],'Praha hl.n.','PRG','Prague',[]),
 ('marseille','Marseille','Frankrijk','FR',['stad','strand'],'Marseille St-Charles','MRS','Marseille',[]),
 ('zurich','Zürich','Zwitserland','CH',['stad','natuur'],'Zürich HB','ZRH','Zurich',[]),
 ('lille','Lille','Frankrijk','FR',['stad'],'Lille-Flandres','LIL','Lille',[]),
 ('gent','Gent','België','BE',['stad'],'Gent-Sint-Pieters',None,'Ghent',[]),
 ('innsbruck','Innsbruck','Oostenrijk','AT',['ski','natuur','stad'],'Innsbruck Hbf','INN','Innsbruck',[]),
 ('salzburg','Salzburg','Oostenrijk','AT',['ski','stad'],'Salzburg Hbf','SZG','Salzburg',[]),
 ('westendorf','Westendorf (Tirol)','Oostenrijk','AT',['ski','natuur'],'Westendorf',None,'Westendorf',[]),
 ('tirana','Tirana','Albanië','AL',['stad','natuur'],None,'TIA','Tirana',[]),
 ('milaan','Milaan','Italië','IT',['stad'],'Milano Centrale','MIL','Milan',['MXP','LIN','BGY']),
 ('faro','Faro (Algarve)','Portugal','PT',['strand'],None,'FAO','Faro',[]),
 ('girona','Girona (Costa Brava)','Spanje','ES',['strand','stad'],None,'GRO','Girona',[]),
 ('krakau','Krakau','Polen','PL',['stad'],None,'KRK','Krakow',[]),
 ('bratislava','Bratislava','Slowakije','SK',['stad'],None,'BTS','Bratislava',[]),
 ('sofia','Sofia','Bulgarije','BG',['stad'],None,'SOF','Sofia',[]),
 ('zagreb','Zagreb','Kroatië','HR',['stad'],None,'ZAG','Zagreb',[]),
 ('vilnius','Vilnius','Litouwen','LT',['stad'],None,'VNO','Vilnius',[]),
 ('debrecen','Debrecen','Hongarije','HU',['stad'],None,'DEB','Debrecen',[]),
 ('cluj','Cluj-Napoca','Roemenië','RO',['stad','natuur'],None,'CLJ','Cluj-Napoca',[]),
 ('belgrado','Belgrado','Servië','RS',['stad'],None,'BEG','Belgrade',[]),
 ('paphos','Paphos','Cyprus','CY',['strand'],None,'PFO','Paphos',[]),
 ('malta','Malta','Malta','MT',['strand','stad'],None,'MLA','Malta',[]),
 ('dublin','Dublin','Ierland','IE',['stad'],None,'DUB','Dublin',[]),
 ('malaga','Málaga','Spanje','ES',['strand','stad'],None,'AGP','Malaga',[]),
 ('porto','Porto','Portugal','PT',['stad'],None,'OPO','Porto',[]),
 ('dubrovnik','Dubrovnik','Kroatië','HR',['strand','stad'],None,'DBV','Dubrovnik',[]),
 ('napels','Napels','Italië','IT',['stad'],None,'NAP','Naples',[]),
 ('tromso','Tromsø','Noorwegen','NO',['natuur'],None,'TOS','Tromso',[]),
 ('palermo','Palermo (Sicilië)','Italië','IT',['strand','stad'],None,'PMO','Palermo',[]),
 ('gran-canaria','Gran Canaria','Spanje','ES',['strand','natuur'],None,'LPA','Gran Canaria',[]),
 ('bolzano','Bolzano (Dolomieten)','Italië','IT',['natuur','ski'],None,'BZO','Bolzano',[]),
 ('heraklion','Heraklion (Kreta)','Griekenland','GR',['strand'],None,'HER','Heraklion',[]),
 ('antalya','Antalya','Turkije','TR',['strand'],None,'AYT','Antalya',[]),
 ('barcelona','Barcelona','Spanje','ES',['stad','strand'],None,'BCN','Barcelona',[]),
 ('madrid','Madrid','Spanje','ES',['stad'],None,'MAD','Madrid',[]),
 ('lissabon','Lissabon','Portugal','PT',['stad','strand'],None,'LIS','Lisbon',[]),
 ('rome','Rome','Italië','IT',['stad'],None,'ROM','Rome',['FCO','CIA']),
 ('venetie','Venetië','Italië','IT',['stad'],None,'VCE','Venice',['TSF']),
 ('athene','Athene','Griekenland','GR',['stad','strand'],None,'ATH','Athens',[]),
 ('kopenhagen','Kopenhagen','Denemarken','DK',['stad'],None,'CPH','Copenhagen',[]),
 ('stockholm','Stockholm','Zweden','SE',['stad','natuur'],None,'ARN','Stockholm',['STO','BMA','NYO']),
 ('oslo','Oslo','Noorwegen','NO',['stad','natuur'],None,'OSL','Oslo',['TRF']),
 ('edinburgh','Edinburgh','Verenigd Koninkrijk','GB',['stad','natuur'],None,'EDI','Edinburgh',[]),
 ('boedapest','Boedapest','Hongarije','HU',['stad'],None,'BUD','Budapest',[]),
 ('warschau','Warschau','Polen','PL',['stad'],None,'WAW','Warsaw',['WMI']),
 ('istanbul','Istanbul','Turkije','TR',['stad'],None,'IST','Istanbul',['SAW']),
 ('nice','Nice','Frankrijk','FR',['strand','stad'],None,'NCE','Nice',[]),
 ('valencia','Valencia','Spanje','ES',['strand','stad'],None,'VLC','Valencia',[]),
 ('sevilla','Sevilla','Spanje','ES',['stad'],None,'SVQ','Seville',[]),
 ('alicante','Alicante','Spanje','ES',['strand'],None,'ALC','Alicante',[]),
 ('palma','Palma de Mallorca','Spanje','ES',['strand'],None,'PMI','Palma de Mallorca',[]),
 ('tenerife','Tenerife','Spanje','ES',['strand','natuur'],None,'TFS','Tenerife',['TFN']),
 ('geneve','Genève','Zwitserland','CH',['ski','stad'],None,'GVA','Geneva',[]),
 ('lyon','Lyon','Frankrijk','FR',['stad'],'Lyon Part-Dieu','LYS','Lyon',[]),
 ('reykjavik','Reykjavik','IJsland','IS',['natuur'],None,'KEF','Reykjavik',['REK']),
 ('bergen','Bergen','Noorwegen','NO',['natuur','stad'],None,'BGO','Bergen',[]),
 ('split','Split','Kroatië','HR',['strand'],None,'SPU','Split',[]),
 ('luxemburg','Luxemburg','Luxemburg','LU',['stad'],'Luxembourg','LUX','Luxembourg',[]),
 ('bazel','Bazel','Zwitserland','CH',['stad'],'Basel SBB','BSL','Basel',[]),
 ('ibiza','Ibiza','Spanje','ES',['strand'],None,'IBZ','Ibiza',[]),
 ('rhodos','Rhodos','Griekenland','GR',['strand'],None,'RHO','Rhodes',[]),
 ('riga','Riga','Letland','LV',['stad'],None,'RIX','Riga',[]),
 ('gdansk','Gdańsk','Polen','PL',['stad','strand'],None,'GDN','Gdansk',[]),
 ('bordeaux','Bordeaux','Frankrijk','FR',['stad'],None,'BOD','Bordeaux',[]),
 ('straatsburg','Straatsburg','Frankrijk','FR',['stad'],'Strasbourg','SXB','Strasbourg',[]),
 ('catania','Catania','Italië','IT',['strand','stad'],None,'CTA','Catania',[]),
 ('bologna','Bologna','Italië','IT',['stad'],'Bologna Centrale','BLQ','Bologna',[]),
 ('pisa','Pisa','Italië','IT',['stad'],'Pisa Centrale','PSA','Pisa',[]),
 ('bari','Bari','Italië','IT',['strand','stad'],'Bari Centrale','BRI','Bari',[]),
 ('triest','Triëst','Italië','IT',['stad','strand'],'Trieste Centrale','TRS','Trieste',[]),
 ('turijn','Turijn','Italië','IT',['stad'],'Torino Porta Nuova','TRN','Turin',[]),
 ('manchester','Manchester','Verenigd Koninkrijk','GB',['stad'],None,'MAN','Manchester',[]),
 ('birmingham','Birmingham','Verenigd Koninkrijk','GB',['stad'],None,'BHX','Birmingham',[]),
 ('fuerteventura','Fuerteventura','Spanje','ES',['strand','natuur'],None,'FUE','Fuerteventura',[]),
 ('lanzarote','Lanzarote','Spanje','ES',['strand','natuur'],None,'ACE','Lanzarote',[]),
 ('wroclaw','Wrocław','Polen','PL',['stad'],None,'WRO','Wroclaw',[]),
 ('biarritz','Biarritz','Frankrijk','FR',['strand'],None,'BIQ','Biarritz',[]),
 ('bergerac','Bergerac','Frankrijk','FR',['natuur'],None,'EGC','Bergerac',[]),
]
CITY_AIRPORT={'PAR':'CDG','LON':'LHR','MIL':'MXP','ROM':'FCO','STO':'ARN'}
dest={}
for (i,name,country,cc,types,stn,iata,en,extra) in D:
    pos=None; src=None
    if stn:
        s=station(stn,cc)
        if s: pos=(s[0],s[1]); src='station: '+s[2]
    if not pos and iata:
        a=airport(CITY_AIRPORT.get(iata,iata))
        if a: pos=(a[0],a[1]); src='airport: '+a[2]
    if not pos:
        print('!! geen coördinaten voor',i); continue
    codes=[c for c in ([iata] if iata else [])+extra]
    dest[i]=dict(n=name,c=country,cc=cc,t=types,lat=pos[0],lon=pos[1],iata=iata,en=en,codes=codes)
    print(f"{i:13s} {pos[0]:8.4f} {pos[1]:9.4f}  {src}")

nlair={}
for code,label in [('AMS','Schiphol'),('EIN','Eindhoven Airport'),('RTM','Rotterdam The Hague Airport'),('MST','Maastricht Aachen Airport'),('GRQ','Groningen Airport Eelde')]:
    a=airport(code); nlair[code]=dict(n=label,lat=a[0],lon=a[1])
print(nlair)
# Compacte vliegveldtabel (Europa en omgeving) voor live zoekresultaten: IATA -> [lat, lon, land, plaats]
apx={}
for code,r in ap.items():
    if r.get('scheduled_service')!='yes' or r['type'] not in ('large_airport','medium_airport'): continue
    la,lo=float(r['latitude_deg']),float(r['longitude_deg'])
    if not (25<=la<=72 and -32<=lo<=46): continue
    apx[code]=[round(la,3),round(lo,3),r['iso_country'],r['municipality'] or r['name']]
print('vliegvelden:',len(apx))
json.dump(dict(stations=nl,dest=dest,airports=nlair,ap=apx),open('/home/claude/build/src/basedata.json','w'),ensure_ascii=False,separators=(',',':'))
print('ok')
