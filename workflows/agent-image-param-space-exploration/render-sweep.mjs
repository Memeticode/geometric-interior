/**
 * Seed sweep renderer — renders seed variants for visual comparison.
 * Reads from seed-sweep.json, outputs to output/seed-sweeps/.
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(__dirname, 'seed-sweep.json');
const outputDir = resolve(__dirname, 'output', 'seed-sweeps');

const configs = JSON.parse(readFileSync(configPath, 'utf-8'));
mkdirSync(outputDir, { recursive: true });

function toFilename(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
}

console.log(`Seed sweep: ${configs.length} variants to render`);
console.log(`Output: ${outputDir}\n`);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5204/sampler.html', { waitUntil: 'load' });
await page.waitForFunction(() => !!window._renderer, { timeout: 15000 });
await page.waitForTimeout(1000);

let rendered = 0;
const t0 = Date.now();

for (let i = 0; i < configs.length; i++) {
    const cfg = configs[i];
    const filename = `${toFilename(cfg.name)}.png`;
    const outPath = resolve(outputDir, filename);

    if (existsSync(outPath)) {
        console.log(`  ${cfg.name}: CACHED`);
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

        const base64 = result.dataUrl.replace(/^data:image\/png;base64,/, '');
        writeFileSync(outPath, Buffer.from(base64, 'base64'));
        rendered++;

        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`  ${cfg.name} [${cfg.seed.join(',')}] nodes=${result.nodes} (${elapsed}s)`);
    } catch (err) {
        console.log(`  ${cfg.name}: ERROR ${err.message}`);
    }
}

await browser.close();
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nComplete in ${elapsed}s: ${rendered} rendered.`);
