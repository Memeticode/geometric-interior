/**
 * Environment parameter space exploration — background-only renderer.
 *
 * For each config in configs.json, produces one image:
 *   {NNN}-{slug}.png  — background rendered with effectively-invisible geometry
 *
 * The focus is the background in complete isolation. Geometry is rendered at
 * luminosity=0.02, bloom=0, chroma=0, density=0.01 — effectively invisible
 * on any background.
 *
 * Usage:
 *   npm run dev:render        # in vite-app/ — starts render server on port 5204
 *   node workflows/agent-image-environment-param-space-exploration/render.mjs [--start=N]
 *
 * --start=N  skip the first N configs (for resuming after interruption)
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(__dirname, 'output', 'renders');

// Strip JS-style comments from JSON (configs.json uses // comments for readability)
const rawText = readFileSync(resolve(__dirname, 'configs.json'), 'utf-8');
const strippedText = rawText.replace(/\/\/[^\n]*/g, '');
const configs = JSON.parse(strippedText);

mkdirSync(outputDir, { recursive: true });

// Parse optional --start flag
const startArg = process.argv.find(a => a.startsWith('--start='));
const startIdx = startArg ? parseInt(startArg.split('=')[1], 10) : 0;

// ─── Minimal geometry (bg-only render) ───────────────────────────────────────
// Extremely sparse and dim — effectively invisible on any background.
const MINIMAL_SEED = [5, 3, 2];
const MINIMAL_CONTROLS = {
    topology: 'flow-field',
    density: 0.01, fracture: 0.50, scale: 0.50,
    coherence: 0.90, division: 0.0, faceting: 0.40,
    luminosity: 0.02, bloom: 0.0,
    hue: 0.0, spectrum: 0.0, chroma: 0.0, flow: 0.5,
};

function toSlug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
}

console.log(`Environment exploration: ${configs.length} configs`);
console.log(`Output: ${outputDir}\n`);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5204/scripts/render-page.html', { waitUntil: 'load' });
await page.waitForFunction(() => window._ready === true, { timeout: 15000 });
await page.waitForTimeout(1000);

let rendered = 0;
let skipped = 0;
let failed = 0;
const t0 = Date.now();

for (let i = 0; i < configs.length; i++) {
    if (i < startIdx) { skipped++; continue; }

    const cfg = configs[i];
    const idx = String(i + 1).padStart(3, '0');
    const slug = toSlug(cfg.name);
    const outPath = resolve(outputDir, `${idx}-${slug}.png`);

    if (existsSync(outPath)) {
        console.log(`  [${idx}] ${cfg.name}: CACHED`);
        skipped++;
        continue;
    }

    const elapsed = () => ((Date.now() - t0) / 1000).toFixed(1);

    try {
        const result = await page.evaluate(({ seed, controls, bgConfig }) => {
            const canvas = document.getElementById('renderCanvas');
            const renderer = window._renderer;
            renderer.resize(800, 520);
            renderer.renderWith(seed, controls);
            renderer.setBgConfig(bgConfig);
            renderer.renderFrame();
            return canvas.toDataURL('image/png');
        }, { seed: MINIMAL_SEED, controls: MINIMAL_CONTROLS, bgConfig: cfg.bgConfig });

        if (result) {
            writeFileSync(outPath, Buffer.from(result.replace(/^data:image\/png;base64,/, ''), 'base64'));
            rendered++;
            console.log(`  [${idx}] ${cfg.name} [${cfg.group}] (${elapsed()}s)`);
        } else {
            throw new Error('no dataUrl returned');
        }
    } catch (err) {
        console.log(`  [${idx}] ${cfg.name}: ERROR ${err.message}`);
        failed++;
    }
}

await browser.close();
const totalElapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nComplete in ${totalElapsed}s: ${rendered} rendered, ${skipped} skipped, ${failed} failed.`);
console.log(`Files in: ${outputDir}`);
