/**
 * Quick 3-config test render — validates shader changes before re-running the full batch.
 *
 * Tests one config per texture type:
 *   1. Phosphor Field  — flow-lines + orbital  (Gaussian filament glow)
 *   2. Violet Vortex   — voronoi + orbital      (cell network + symmetric modulation)
 *   3. Rose Interior   — noise                  (organic brightness variation)
 *
 * Output: output/test-renders/{N}-{slug}.png + .json sidecar
 *
 * Usage:
 *   npm run dev:render   # in vite-app/ — port 5204
 *   node workflows/agent-image-environment-param-space-exploration/test-render.mjs
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(__dirname, 'output', 'test-renders');
mkdirSync(outputDir, { recursive: true });

// Load all configs and find by name
const rawText = readFileSync(resolve(__dirname, 'configs.json'), 'utf-8');
const strippedText = rawText.replace(/\/\/[^\n]*/g, '');
const allConfigs = JSON.parse(strippedText);

const TEST_NAMES = ['Phosphor Field', 'Violet Vortex', 'Rose Interior'];
const testConfigs = TEST_NAMES.map(name => {
    const cfg = allConfigs.find(c => c.name === name);
    if (!cfg) throw new Error(`Config not found in configs.json: "${name}"`);
    return cfg;
});

const MINIMAL_SEED = [5, 3, 2];
const MINIMAL_CONTROLS = {
    topology: 'flow-field',
    density: 0.0, fracture: 0.50, scale: 0.50,
    coherence: 0.90, division: 0.0, faceting: 0.40,
    luminosity: 0.0, bloom: 0.0,
    hue: 0.0, spectrum: 0.0, chroma: 0.0, flow: 0.5,
};

function toSlug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
}

console.log(`Test render: ${testConfigs.length} configs → ${outputDir}\n`);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5204/scripts/render-page.html', { waitUntil: 'load' });
await page.waitForFunction(() => window._ready === true, { timeout: 15000 });
await page.waitForTimeout(1000);

for (let i = 0; i < testConfigs.length; i++) {
    const cfg = testConfigs[i];
    const slug = toSlug(cfg.name);
    const pngPath  = resolve(outputDir, `${i + 1}-${slug}.png`);
    const jsonPath = resolve(outputDir, `${i + 1}-${slug}.json`);

    const result = await page.evaluate(({ seed, controls, bgConfig }) => {
        const canvas = document.getElementById('renderCanvas');
        const renderer = window._renderer;
        renderer.resize(800, 520);
        renderer.renderWith(seed, controls);
        renderer.setBgConfig(bgConfig);
        renderer.renderFrame();
        return canvas.toDataURL('image/png');
    }, { seed: MINIMAL_SEED, controls: MINIMAL_CONTROLS, bgConfig: cfg.bgConfig });

    writeFileSync(pngPath,  Buffer.from(result.replace(/^data:image\/png;base64,/, ''), 'base64'));
    writeFileSync(jsonPath, JSON.stringify({ name: cfg.name, group: cfg.group, bgNote: cfg.bgNote, bgConfig: cfg.bgConfig }, null, 2));
    console.log(`  [${i + 1}] ${cfg.name} (${cfg.bgConfig.texture.type} + ${cfg.bgConfig.flow.type})`);
    console.log(`       → ${pngPath}`);
}

await browser.close();
console.log('\nDone.');
