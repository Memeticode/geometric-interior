import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

mkdirSync('sampler-captures/v3b', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5204/sampler.html');
await page.waitForSelector('#renderBtn');
await page.waitForFunction(() => !!window._renderer, { timeout: 10000 });

const BASE = {
    topology: 'flow-field',
    density: 0.08, luminosity: 0.55, fracture: 0.50, coherence: 0.70,
    hue: 0.783, spectrum: 0.24, chroma: 0.45,
    scale: 0.5, division: 0.5, faceting: 0.5, flow: 0.5
};

async function render(name, overrides, seed = 'explore-1') {
    const controls = { ...BASE, ...overrides };
    const result = await page.evaluate(({ controls, seed }) => {
        const canvas = document.getElementById('renderCanvas');
        const renderer = window._renderer;
        renderer.resize(800, 520);
        const meta = renderer.renderWith(seed, controls);
        return { dataUrl: canvas.toDataURL('image/png'), nodes: meta?.nodeCount ?? '?' };
    }, { controls, seed });

    if (!result) { console.log(`${name}: FAILED`); return; }
    const base64 = result.dataUrl.replace(/^data:image\/png;base64,/, '');
    writeFileSync(`sampler-captures/v3b/${name}.png`, Buffer.from(base64, 'base64'));
    console.log(`  ${name}: nodes=${result.nodes}`);
}

// =========================================================
// REFINED PORTRAITS — fixing brightness + new combos
// =========================================================
console.log('\n=== REFINED PORTRAITS ===');

// Amber Starburst — lower lum, slightly more fracture for structure
await render('amber-starburst-v2', {
    density: 0.07, luminosity: 0.48, fracture: 0.55, coherence: 0.88,
    hue: 0.06, spectrum: 0.22, chroma: 0.90,
    scale: 0.45, division: 0.45, faceting: 0.5, flow: 0.0
}, 'portrait-2');

// Teal Orbital — much lower lum, slightly less coherence
await render('teal-orbital-v2', {
    density: 0.08, luminosity: 0.42, fracture: 0.42, coherence: 0.80,
    hue: 0.51, spectrum: 0.21, chroma: 0.58,
    scale: 0.55, division: 0.5, faceting: 0.5, flow: 1.0
}, 'portrait-3');

// Deep Sapphire — lower lum so the blue reads
await render('deep-sapphire-v2', {
    density: 0.04, luminosity: 0.48, fracture: 0.28, coherence: 0.90,
    hue: 0.625, spectrum: 0.24, chroma: 0.86,
    scale: 0.40, division: 0.5, faceting: 0.35, flow: 0.5
}, 'portrait-5');

// Solar Forge — dramatically lower lum, it needs to be moody-warm not blown
await render('solar-forge-v2', {
    density: 0.08, luminosity: 0.40, fracture: 0.42, coherence: 0.80,
    hue: 0.08, spectrum: 0.25, chroma: 0.88,
    scale: 0.20, division: 0.20, faceting: 0.25, flow: 0.05
}, 'portrait-11');

// Emerald Radiance — lower lum
await render('emerald-radiance-v2', {
    density: 0.06, luminosity: 0.48, fracture: 0.52, coherence: 0.82,
    hue: 0.375, spectrum: 0.28, chroma: 0.70,
    scale: 0.42, division: 0.45, faceting: 0.5, flow: 0.18
}, 'portrait-9');

// =========================================================
// NEW COMBOS inspired by round 1
// =========================================================
console.log('\n=== NEW COMBOS ===');

// "Teal Nebula" — inspired by nebular-rings success but less extreme
await render('teal-nebula', {
    density: 0.12, luminosity: 0.40, fracture: 0.50, coherence: 0.72,
    hue: 0.51, spectrum: 0.25, chroma: 0.55,
    scale: 0.70, division: 0.65, faceting: 0.55, flow: 0.75
}, 'new-1');

// "Sapphire Shards" — inspired by crystal-bands, with more readable structure
await render('sapphire-shards', {
    density: 0.07, luminosity: 0.50, fracture: 0.55, coherence: 0.80,
    hue: 0.625, spectrum: 0.28, chroma: 0.82,
    scale: 0.5, division: 0.5, faceting: 0.80, flow: 0.80
}, 'new-2');

// "Warm Divide" — the warm triple lobe was beautiful, make it a portrait
await render('warm-divide', {
    density: 0.09, luminosity: 0.45, fracture: 0.50, coherence: 0.68,
    hue: 0.06, spectrum: 0.25, chroma: 0.85,
    scale: 0.50, division: 0.85, faceting: 0.55, flow: 0.5
}, 'new-3');

// "Prismatic Trifold" — the triple prismatic was stunning
await render('prismatic-trifold', {
    density: 0.08, luminosity: 0.42, fracture: 0.60, coherence: 0.60,
    hue: 0.5, spectrum: 0.85, chroma: 0.70,
    scale: 0.55, division: 0.90, faceting: 0.55, flow: 0.5
}, 'new-4');

// "Monolith" — single lobe, monumental, low everything except coherence
await render('monolith', {
    density: 0.05, luminosity: 0.35, fracture: 0.30, coherence: 0.85,
    hue: 0.783, spectrum: 0.15, chroma: 0.40,
    scale: 0.15, division: 0.10, faceting: 0.30, flow: 0.0
}, 'new-5');

// "Stardust" — atmospheric, scattered, gentle
await render('stardust', {
    density: 0.10, luminosity: 0.45, fracture: 0.65, coherence: 0.55,
    hue: 0.867, spectrum: 0.35, chroma: 0.45,
    scale: 0.85, division: 0.50, faceting: 0.50, flow: 0.5
}, 'new-6');

// "Ice Crystal" — achromatic, sharp, compact
await render('ice-crystal', {
    density: 0.05, luminosity: 0.55, fracture: 0.25, coherence: 0.85,
    hue: 0.55, spectrum: 0.05, chroma: 0.08,
    scale: 0.35, division: 0.50, faceting: 0.85, flow: 0.5
}, 'new-7');

// "Ember Drift" — warm atmospheric, scattered, orbital
await render('ember-drift', {
    density: 0.14, luminosity: 0.38, fracture: 0.60, coherence: 0.62,
    hue: 0.04, spectrum: 0.30, chroma: 0.80,
    scale: 0.72, division: 0.50, faceting: 0.55, flow: 0.80
}, 'new-8');

// =========================================================
// SEED VARIATIONS — test best combos with different seeds
// =========================================================
console.log('\n=== SEED VARIATIONS ===');

// Prismatic Scatter was great — try 3 seeds
for (const [i, seed] of ['seed-a', 'seed-b', 'seed-c'].entries()) {
    await render(`prismatic-scatter-${seed}`, {
        density: 0.07, luminosity: 0.45, fracture: 0.85, coherence: 0.50,
        hue: 0.85, spectrum: 0.70, chroma: 0.55,
        scale: 0.5, division: 0.5, faceting: 0.6, flow: 0.5
    }, seed);
}

// Dark Ruby Divide — try 3 seeds
for (const [i, seed] of ['seed-a', 'seed-b', 'seed-c'].entries()) {
    await render(`dark-ruby-divide-${seed}`, {
        density: 0.15, luminosity: 0.30, fracture: 0.60, coherence: 0.55,
        hue: 0.986, spectrum: 0.30, chroma: 0.60,
        scale: 0.5, division: 0.85, faceting: 0.6, flow: 0.5
    }, seed);
}

// Amethyst Spirals — try 3 seeds
for (const [i, seed] of ['seed-a', 'seed-b', 'seed-c'].entries()) {
    await render(`amethyst-spirals-${seed}`, {
        density: 0.08, luminosity: 0.52, fracture: 0.45, coherence: 0.82,
        hue: 0.867, spectrum: 0.27, chroma: 0.50,
        scale: 0.55, division: 0.5, faceting: 0.75, flow: 0.85
    }, seed);
}

await browser.close();
console.log('\n=== All v3b renders complete ===');
