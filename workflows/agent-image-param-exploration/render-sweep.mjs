/**
 * Bloom parameter tuning sweep renderer.
 *
 * Usage:
 *   npx vite --port 5204    # in another terminal
 *   node workflows/agent-image-param-exploration/render-sweep.mjs [--start=N]
 *
 * Renders each anchor × bloom value combination and saves to output/renders/.
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(__dirname, 'sweep-config.json');
const outputDir = resolve(__dirname, 'output', 'renders');

const config = JSON.parse(readFileSync(configPath, 'utf-8'));
mkdirSync(outputDir, { recursive: true });

// Parse optional --start flag
const startArg = process.argv.find(a => a.startsWith('--start='));
const startIdx = startArg ? parseInt(startArg.split('=')[1], 10) : 0;

// Build render list: anchor × value
const renderList = [];
for (const anchor of config.anchors) {
    for (const value of config.values) {
        const controls = { ...anchor.controls, [config.targetParam]: value };
        const valStr = value.toFixed(1);
        const filename = `${anchor.name}-${config.targetParam}-${valStr}.png`;
        renderList.push({ anchor: anchor.name, seed: anchor.seed, controls, value, filename });
    }
}

console.log(`Bloom sweep: ${renderList.length} total renders (${config.anchors.length} anchors × ${config.values.length} values)`);
console.log(`Output: ${outputDir}\n`);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5204/sampler.html', { waitUntil: 'load' });
// Wait for renderer to be ready
await page.waitForFunction(() => !!window._renderer, { timeout: 15000 });
// Extra settle time for WebGL context
await page.waitForTimeout(1000);

let rendered = 0;
let skipped = 0;
const t0 = Date.now();

for (let i = 0; i < renderList.length; i++) {
    if (i < startIdx) { skipped++; continue; }

    const item = renderList[i];
    const outPath = resolve(outputDir, item.filename);

    // Skip if already rendered
    if (existsSync(outPath)) {
        console.log(`  [${String(i + 1).padStart(3, '0')}] ${item.filename}: CACHED`);
        skipped++;
        continue;
    }

    const result = await page.evaluate(({ controls, seed }) => {
        const canvas = document.getElementById('renderCanvas');
        const renderer = window._renderer;
        renderer.resize(800, 520);
        const meta = renderer.renderWith(seed, controls);
        return { dataUrl: canvas.toDataURL('image/png'), nodes: meta?.nodeCount ?? '?' };
    }, { controls: item.controls, seed: item.seed });

    if (!result) {
        console.log(`  [${String(i + 1).padStart(3, '0')}] ${item.filename}: FAILED`);
        continue;
    }

    const base64 = result.dataUrl.replace(/^data:image\/png;base64,/, '');
    writeFileSync(outPath, Buffer.from(base64, 'base64'));
    rendered++;

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  [${String(i + 1).padStart(3, '0')}] ${item.anchor} bloom=${item.value.toFixed(1)} nodes=${result.nodes} (${elapsed}s)`);
}

await browser.close();
console.log(`\nComplete: ${rendered} rendered, ${skipped} skipped. Files in ${outputDir}`);
