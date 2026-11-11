# Bouwt dist/dealradar-nl.html uit de bronbestanden in src/
import json, os
os.makedirs('dist', exist_ok=True)
t=open('src/index.html',encoding='utf-8').read()
css=open('src/app.css',encoding='utf-8').read()
base=json.load(open('src/basedata.json',encoding='utf-8'))
m=json.load(open('src/map.json',encoding='utf-8'))
mp={k:m[k] for k in ['W','H','scale','translate','land','borders','nl','world']}
mp['world']={k:m['world'][k] for k in ['scale','k','translate','land','borders']}
data=("/* Basisdata: NL-stations (trainline-eu/stations, ODbL), vliegvelden (OurAirports), bestemmingen */\n"
      "const BASE = "+json.dumps(base,ensure_ascii=False,separators=(',',':'))+";\n"
      "/* Kaart van Europa (Natural Earth, publiek domein), Lambert-projectie rond 10°O 52°N */\n"
      "const MAP = "+json.dumps(mp,separators=(',',':'))+";")
deals=open('src/deals.js',encoding='utf-8').read()
app='\n'.join(open(f'src/{n}',encoding='utf-8').read() for n in ('app1.js','app2.js','app3.js','app4.js','boot.js'))
out=t.replace('/*__CSS__*/',css).replace('/*__DATA__*/',data).replace('/*__DEALS__*/',deals).replace('/*__APP__*/',app)
assert '/*__' not in out
open('dist/dealradar-nl.html','w',encoding='utf-8').write(out)
open('dist/_check.js','w',encoding='utf-8').write(data+"\n"+deals+"\n"+app)
print('ok', len(out)//1024, 'KB')
