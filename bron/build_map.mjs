// Maakt een lichte SVG-kaart van Europa (Natural Earth via world-atlas, public domain)
// Projectie: Lambert azimutaal gelijkvlakkig, centrum 10°O 52°N (zoals ETRS89-LAEA)
import fs from 'fs';
import {feature, mesh} from 'topojson-client';
import {geoAzimuthalEqualArea, geoPath} from 'd3-geo';
const topo = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-50m.json','utf8'));
const W=1000, H=860;
const proj = geoAzimuthalEqualArea().rotate([-10,-52]);
// kader: van IJsland/Canarische eilanden tot Cyprus/Noordkaap
const frame = {type:'MultiPoint', coordinates:[[-25,36],[-18,27.5],[34,34.5],[36,41],[30,71],[-24,66],[20,71.5]]};
proj.fitExtent([[18,18],[W-18,H-18]], frame);
proj.clipExtent([[0,0],[W,H]]);
const path = geoPath(proj).digits(0);
const countries = feature(topo, topo.objects.countries);
const land = path(feature(topo, topo.objects.land));
const borders = path(mesh(topo, topo.objects.countries, (a,b)=>a!==b));
const nl = countries.features.find(f=>f.properties.name==='Netherlands');
const nlPath = path(nl);
const out = {W,H, scale: proj.scale(), translate: proj.translate(), rotate:[-10,-52], land, borders, nl: nlPath};
// testpunten om de JS-projectie in de browser te controleren
const tests = [[4.9,52.37],[2.35,48.86],[-15.39,27.93],[18.92,69.68],[30.8,36.9]].map(p=>({p, xy: proj(p).map(v=>Math.round(v*10)/10)}));
out.tests = tests;
fs.writeFileSync('src/map.json', JSON.stringify(out));
console.log('scale',proj.scale(),'translate',proj.translate(),'land',land.length,'borders',borders.length,'nl',nlPath.length);
console.log(JSON.stringify(tests));

// ---- Wereldkaart (zelfde canvas): afstandsgetrouwe cilinderprojectie, 130°W t/m 155°O, midden rond 22°N ----
import {geoProjection} from 'd3-geo';
{
  const topoW = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-110m.json','utf8'));
  // Cilinderprojectie met 1,3 × rek in de hoogte (oogt natuurlijker op onze breedte), 130°W t/m 155°O, zonder Antarctica
  const r = Math.PI/180, lonMin = -130, lonMax = 155, lat0 = 11, K = 1.3;
  const s = W / ((lonMax - lonMin) * r);
  const t = [-s * lonMin * r, H/2 + s * K * lat0 * r];
  const yOf = lat => t[1] - s * K * lat * r;
  const pw = geoProjection((l, p) => [l, p * K]).scale(s).translate(t).clipExtent([[0,0],[W,Math.round(yOf(-58))]]);
  const pathW = geoPath(pw).digits(0);
  const landW = pathW(feature(topoW, topoW.objects.land));
  const bordersW = pathW(mesh(topoW, topoW.objects.countries, (a,b)=>a!==b));
  const testsW = [[4.9,52.37],[-74,40.7],[100.5,13.75],[-68.9,12.2],[18.4,-33.9]].map(p=>({p, xy: pw(p).map(v=>Math.round(v*10)/10)}));
  const all = JSON.parse(fs.readFileSync('src/map.json','utf8'));
  all.world = {W, H, scale: s, k: K, translate: t, land: landW, borders: bordersW, tests: testsW};
  fs.writeFileSync('src/map.json', JSON.stringify(all));
  console.log('wereld: land', landW.length, 'grenzen', bordersW.length, JSON.stringify(testsW));
}
