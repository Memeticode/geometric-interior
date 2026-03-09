/**
 * Single-image renderer — renders one or more configs from a JSON file.
 *
 * Usage:
 *   node scripts/render-single.mjs config.json [--output dir/] [--width 800] [--height 520]
 *
 * Config file format (single):
 *   { "name": "My Image", "seed": [5, 3, 2], "controls": { "topology": "flow-field", ... } }
 *
 * Config file format (batch):
 *   [
 *     { "name": "Variant A", "seed": [0, 3, 2], "controls": { ... } },
 *     { "name": "Variant B", "seed": [5, 3, 2], "controls": { ... } }
 *   ]
 *
 * Requires render server running: npm run dev:render
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';

// --- Parse args ---

const args = process.argv.slice(2);
const configFile = args.find(a => !a.startsWith('--'));

if (!configFile) {
    console.error('Usage: node scripts/render-single.mjs config.json [--output dir/] [--width 800] [--height 520]');
    process.exit(1);
}

function getFlag(name, fallback) {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}

const outputDir = resolve(getFlag('output', dirname(configFile)));
const width = parseInt(getFlag('width', '800'), 10);
const height = parseInt(getFlag('height', '520'), 10);

// --- Load configs ---

const raw = JSON.parse(readFileSync(resolve(configFile), 'utf-8'));
const configs = Array.isArray(raw) ? raw : [raw];

mkdirSync(outputDir, { recursive: true });

function toFilename(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
}

console.log(`Rendering ${configs.length} config(s) at ${width}x${height}`);
console.log(`Output: ${outputDir}\n`);

// --- Launch browser ---

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5204/scripts/render-page.html', { waitUntil: 'load' });
await page.waitForFunction(() => window._ready === true, { timeout: 15000 });
await page.waitForTimeout(1000);

let rendered = 0;
let failed = 0;
const t0 = Date.now();

for (const cfg of configs) {
    const name = cfg.name || 'untitled';
    const filename = `${toFilename(name)}.png`;
    const outPath = resolve(outputDir, filename);

    try {
        const result = await page.evaluate(({ controls, seed, camera, w, h }) => {
            const canvas = document.getElementById('renderCanvas');
            const renderer = window._renderer;
            renderer.clearCameraState();
            renderer.resize(w, h);
            const meta = renderer.renderWith(seed, controls);
            if (camera) {
                const dist = Math.pow(3, 0.6 - 1.6 * (camera.zoom ?? 0.5));
                renderer.setCameraState(dist, camera.rotation ?? 0, camera.elevation ?? 0);
            }
            renderer.setFoldImmediate(1.0);
            renderer.updateTime(3.0);
            renderer.renderFrame();
            return {
                dataUrl: canvas.toDataURL('image/png'),
                nodes: meta?.nodeCount ?? '?',
                title: meta?.title ?? '',
                altText: meta?.altText ?? '',
            };
        }, { controls: cfg.controls, seed: cfg.seed, camera: cfg.camera || null, w: width, h: height });

        const base64 = result.dataUrl.replace(/^data:image\/png;base64,/, '');
        writeFileSync(outPath, Buffer.from(base64, 'base64'));
        rendered++;

        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        const camLabel = cfg.camera ? ` cam=[r${cfg.camera.rotation},e${cfg.camera.elevation},z${cfg.camera.zoom}]` : '';
        console.log(`  ${name} [${cfg.seed.join(',')}]${camLabel} nodes=${result.nodes} -> ${filename} (${elapsed}s)`);
        if (result.title) console.log(`    title: ${result.title}`);
        if (result.altText) console.log(`    alt: ${result.altText.substring(0, 120)}...`);
    } catch (err) {
        failed++;
        console.error(`  ${name}: ERROR ${err.message}`);
    }
}

await browser.close();
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nDone in ${elapsed}s: ${rendered} rendered, ${failed} failed.`);
