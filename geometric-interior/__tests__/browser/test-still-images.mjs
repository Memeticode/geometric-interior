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

const cases = [
    { name: 'mid', seed: [0, 0, 0], controls: all(0.5) },
    { name: 'all-zero', seed: [0, 0, 0], controls: all(0) },
    { name: 'all-one', seed: [17, 17, 17], controls: all(1) },
    { name: 'sparse-ordered', seed: [1, 3, 2], controls: { ...all(0.5), density: 0.03, coherence: 0.9, chroma: 0.2 } },
    { name: 'dense-chaotic', seed: [15, 14, 16], controls: { ...all(0.5), density: 0.9, coherence: 0.1, fracture: 0.9 } },
    { name: 'text-seed', seed: 'geometric interior', controls: all(0.5) },
    { name: 'wide-aspect', seed: [4, 8, 12], controls: all(0.5), width: 400, height: 160 },
    { name: 'camera-orbit', seed: [5, 5, 5], controls: all(0.5), camera: { distance: 0.8, rotation: 60, elevation: 25 } },
    { name: 'camera-far', seed: [6, 2, 9], controls: all(0.5), camera: { distance: 1.6, rotation: -120, elevation: -40 } },
];
for (let i = 0; i < 12; i++) {
    cases.push({
        name: `random-${i}`,
        seed: [(i * 2) % 18, (i * 5) % 18, (i * 7) % 18],
        controls: Object.fromEntries(KEYS.map(k => [k, +rnd().toFixed(3)])),
    });
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
            c => window.renderHash({ width: 320, height: 200, ...c }), c);
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
