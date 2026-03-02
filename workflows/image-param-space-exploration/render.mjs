/**
 * Parameter space exploration batch renderer.
 *
 * Usage:
 *   npx vite --port 5204    # in another terminal
 *   node workflows/image-param-space-exploration/render.mjs [--start=N]
 *
 * Renders each config in configs.json and saves to output/renders/.
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(__dirname, 'configs.json');
const outputDir = resolve(__dirname, 'output', 'renders');

const configs = JSON.parse(readFileSync(configPath, 'utf-8'));
mkdirSync(outputDir, { recursive: true });

// Parse optional --start flag
const startArg = process.argv.find(a => a.startsWith('--start='));
const startIdx = startArg ? parseInt(startArg.split('=')[1], 10) : 0;

// Sanitize name for filename
function toFilename(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
}

console.log(`Space exploration: ${configs.length} configs to render`);
console.log(`Output: ${outputDir}\n`);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5204/sampler.html', { waitUntil: 'load' });
await page.waitForFunction(() => !!window._renderer, { timeout: 15000 });
await page.waitForTimeout(1000);

let rendered = 0;
let skipped = 0;
let failed = 0;
const t0 = Date.now();

for (let i = 0; i < configs.length; i++) {
    if (i < startIdx) { skipped++; continue; }

    const cfg = configs[i];
    const filename = `${String(i + 1).padStart(3, '0')}-${toFilename(cfg.name)}.png`;
    const outPath = resolve(outputDir, filename);

    // Skip if already rendered
    if (existsSync(outPath)) {
        console.log(`  [${String(i + 1).padStart(3, '0')}] ${cfg.name}: CACHED`);
        skipped++;
        continue;
    }

    try {
        const result = await page.evaluate(({ controls, seed }) => {
            const canvas = document.getElementById('renderCanvas');
            const renderer = window._renderer;
            renderer.resize(800, 520);
            const meta = renderer.renderWith(seed, controls);
            return { dataUrl: canvas.toDataURL('image/png'), nodes: meta?.nodeCount ?? '?' };
        }, { controls: cfg.controls, seed: cfg.seed });

        if (!result || !result.dataUrl) {
            console.log(`  [${String(i + 1).padStart(3, '0')}] ${cfg.name}: FAILED (no data)`);
            failed++;
            continue;
        }

        const base64 = result.dataUrl.replace(/^data:image\/png;base64,/, '');
        writeFileSync(outPath, Buffer.from(base64, 'base64'));
        rendered++;

        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`  [${String(i + 1).padStart(3, '0')}] ${cfg.name} [${cfg.category}] nodes=${result.nodes} (${elapsed}s)`);
    } catch (err) {
        console.log(`  [${String(i + 1).padStart(3, '0')}] ${cfg.name}: ERROR ${err.message}`);
        failed++;
    }
}

await browser.close();
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nComplete in ${elapsed}s: ${rendered} rendered, ${skipped} skipped, ${failed} failed.`);
console.log(`Files in ${outputDir}`);
