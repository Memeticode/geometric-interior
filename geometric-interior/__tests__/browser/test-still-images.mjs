/**
 * Still-image regression test: renders a fixed set of configs and checks
 * each image's pixel hash against the checked-in baseline.
 *
 * Any change that alters rendered output — even by one pixel — fails.
 * If the change is intended, re-baseline:
 *   npm run test:lib:browser -- --update
 *
 * Rendering uses SwiftShader (software WebGL) so hashes are stable across GPUs.
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const libRoot = join(__dirname, '..', '..');
const BASELINE = join(__dirname, 'still-images.baseline.json');
const update = process.argv.includes('--update');

/* ── Cases ── */

const KEYS = ['hue', 'spectrum', 'chroma', 'density', 'fracture', 'coherence',
    'luminosity', 'bloom', 'scale', 'division', 'faceting', 'flow'];
const all = v => Object.fromEntries(KEYS.map(k => [k, v]));

// Small deterministic LCG so cases never change between runs
let s = 12345;
const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;

const DEFAULT_CAMERA = { zoom: 0.375, rotation: 0, elevation: 0 };
const img = (name, seed, controls, extra = {}) =>
    ({ name, config: { seed, controls, camera: extra.camera ?? DEFAULT_CAMERA }, width: extra.width, height: extra.height });

const cases = [
    img('mid', [0, 0, 0], all(0.5)),
    img('all-zero', [0, 0, 0], all(0)),
    img('all-one', [17, 17, 17], all(1)),
    img('sparse-ordered', [1, 3, 2], { ...all(0.5), density: 0.03, coherence: 0.9, chroma: 0.2 }),
    img('dense-chaotic', [15, 14, 16], { ...all(0.5), density: 0.9, coherence: 0.1, fracture: 0.9 }),
    img('wide-aspect', [4, 8, 12], all(0.5), { width: 400, height: 160 }),
    img('camera-orbit', [5, 5, 5], all(0.5), { camera: { zoom: 0.6, rotation: 60, elevation: 25 } }),
    img('camera-far', [6, 2, 9], all(0.5), { camera: { zoom: 0.1, rotation: -120, elevation: -40 } }),
];
for (let i = 0; i < 12; i++) {
    cases.push(img(`random-${i}`,
        [(i * 2) % 18, (i * 5) % 18, (i * 7) % 18],
        Object.fromEntries(KEYS.map(k => [k, +rnd().toFixed(3)]))));
}

/* ── Run ── */

const server = await createServer({
    root: libRoot,
    configFile: false,
    logLevel: 'error',
    server: { port: 5299, strictPort: false },
    assetsInclude: ['**/*.glsl'],
});
await server.listen();
const url = server.resolvedUrls.local[0] + '__tests__/browser/render-page.html';

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = {};
let passed = 0, failed = 0;

try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.ready, null, { timeout: 30000 });

    for (const c of cases) {
        results[c.name] = await page.evaluate(
            ({ config, width, height }) => window.renderHash({ config, width: width ?? 320, height: height ?? 200 }), c);
    }
    if (pageErrors.length) throw new Error('page errors:\n  ' + pageErrors.join('\n  '));
} finally {
    await browser.close();
    await server.close();
}

console.log('\n=== Still Image Tests ===\n');

if (update || !existsSync(BASELINE)) {
    writeFileSync(BASELINE, JSON.stringify(results, null, 2) + '\n');
    console.log(`  Baseline written: ${Object.keys(results).length} images → ${BASELINE}`);
    passed = Object.keys(results).length;
} else {
    const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
    for (const [name, hash] of Object.entries(results)) {
        if (!(name in baseline)) {
            failed++; console.error(`  FAIL: ${name} — not in baseline (run with --update)`);
        } else if (baseline[name] !== hash) {
            failed++; console.error(`  FAIL: ${name} — rendered image changed`);
        } else {
            passed++; console.log(`  PASS: ${name}`);
        }
    }
}

console.log(`\nStill Image Tests: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
