// Usage: node golden.tmp.mjs capture|compare  — still-image pixel check (temporary)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
const OUT = process.env.GOLDEN;
const mode = process.argv[2];
const profiles = JSON.parse(readFileSync('vite-app/src/stores/starter-profiles.json', 'utf8'));
const cases = [];
for (const s of Object.values(profiles.sections)) for (const p of Object.values(s.portraits)) cases.push({ seed: p.seed, controls: p.controls, camera: p.camera });
let r = 12345; const rnd = () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648;
const KEYS = ['hue','spectrum','chroma','density','fracture','coherence','luminosity','bloom','scale','division','faceting','flow'];
for (let i = 0; i < 8; i++) cases.push({ seed: [i * 2 % 18, i * 5 % 18, i * 7 % 18], controls: Object.fromEntries(KEYS.map(k => [k, +rnd().toFixed(3)])), camera: i % 2 ? { zoom: rnd(), rotation: Math.round(rnd() * 360 - 180), elevation: Math.round(rnd() * 90 - 45) } : undefined });
cases.push({ seed: [0,0,0], controls: Object.fromEntries(KEYS.map(k => [k, 0])) });
cases.push({ seed: [17,17,17], controls: Object.fromEntries(KEYS.map(k => [k, 1])) });

const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:5204/geometric-interior/image-config-editor.html', { waitUntil: 'load' });
await p.waitForFunction(() => window._renderer);
const shots = await p.evaluate(cases => {
  const R = window._renderer, cv = document.getElementById('canvas');
  R.setTargetResolution(320, 200);
  return cases.map(c => {
    if (c.camera) R.setCameraState(Math.pow(3, 0.6 - 1.6 * c.camera.zoom), c.camera.rotation, c.camera.elevation);
    else R.clearCameraState();
    R.renderWith(c.seed, { ...Object.fromEntries(['hue','spectrum','chroma','density','fracture','coherence','luminosity','bloom','scale','division','faceting','flow'].map(k => [k, 0.5])), ...c.controls });
    const t = document.createElement('canvas'); t.width = cv.width; t.height = cv.height;
    const x = t.getContext('2d'); x.drawImage(cv, 0, 0);
    return Array.from(x.getImageData(0, 0, t.width, t.height).data);
  });
}, cases);
if (mode === 'capture') { writeFileSync(OUT, JSON.stringify(shots)); console.log(`captured ${shots.length} images`); }
else {
  const gold = JSON.parse(readFileSync(OUT, 'utf8'));
  let bad = 0;
  shots.forEach((s, i) => { let n = 0, mx = 0; for (let j = 0; j < s.length; j += 4) { const d = Math.max(Math.abs(s[j]-gold[i][j]), Math.abs(s[j+1]-gold[i][j+1]), Math.abs(s[j+2]-gold[i][j+2])); if (d) { n++; mx = Math.max(mx, d); } } if (n) { bad++; console.log(`case ${i}: ${n} px differ, max channel delta ${mx}`); } });
  console.log(bad ? `${bad}/${shots.length} images differ` : `all ${shots.length} images identical`);
}
if (errs.length) console.log('page errors:', errs);
await b.close();
