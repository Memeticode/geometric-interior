import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5204/sampler.html');
await page.waitForSelector('#renderBtn');
// Wait for renderer to init
await page.waitForFunction(() => !!window._renderer, { timeout: 10000 });

async function renderFull(name, params, palette = 'violet-depth') {
    const dataUrl = await page.evaluate((args) => {
        const { params, palette } = args;
        const canvas = document.getElementById('renderCanvas');
        if (!window._renderer) return null;
        const renderer = window._renderer;
        renderer.resize(800, 520);
        const controls = {
            density: params.d,
            fracture: params.f,
            luminosity: params.l,
            coherence: params.c,
            depth: params.dp ?? 0.5,
            palette: palette
        };
        const meta = renderer.renderWith('sampler-1', controls);
        return { dataUrl: canvas.toDataURL('image/png'), nodeCount: meta?.nodeCount ?? '?' };
    }, { params, palette });

    if (!dataUrl) { console.log(`${name}: FAILED`); return; }
    const base64 = dataUrl.dataUrl.replace(/^data:image\/png;base64,/, '');
    writeFileSync(`sampler-captures/v2-${name}.png`, Buffer.from(base64, 'base64'));
    console.log(`${name}: nodes=${dataUrl.nodeCount}`);
}

// === Best-of-palette exploration ===
// The "dark-jewel" (d=0.20, f=0.70, l=0.0, c=0.50, prismatic) was outstanding.
// Let's explore that dark-low-density region across palettes.

const darkParams = { d: 0.20, f: 0.70, l: 0.0, c: 0.50 };
await renderFull('dark-warm', darkParams, 'warm-spectrum');
await renderFull('dark-teal', darkParams, 'teal-volumetric');
await renderFull('dark-sapphire', darkParams, 'sapphire');
await renderFull('dark-violet', darkParams, 'violet-depth');
await renderFull('dark-amethyst', darkParams, 'amethyst');
await renderFull('dark-crystal', darkParams, 'crystal-lattice');

// === Coherence effect on prismatic at different fracture levels ===
// Does coherence create color patches (aligned chains sample similar hue-field regions)?
await renderFull('prism-f30-c0', { d: 0.25, f: 0.30, l: 0.35, c: 0.0 }, 'prismatic');
await renderFull('prism-f30-c1', { d: 0.25, f: 0.30, l: 0.35, c: 1.0 }, 'prismatic');
await renderFull('prism-f90-c0', { d: 0.25, f: 0.90, l: 0.35, c: 0.0 }, 'prismatic');
await renderFull('prism-f90-c1', { d: 0.25, f: 0.90, l: 0.35, c: 1.0 }, 'prismatic');

// === "Stained glass" — high fracture, low density, low lum, prismatic ===
await renderFull('stained-glass', { d: 0.10, f: 1.0, l: 0.10, c: 0.60 }, 'prismatic');

// === The "aurora" region — high coherence on warm/teal at low-mid density ===
await renderFull('aurora-warm', { d: 0.30, f: 0.50, l: 0.35, c: 1.0 }, 'warm-spectrum');
await renderFull('aurora-teal', { d: 0.30, f: 0.50, l: 0.35, c: 1.0 }, 'teal-volumetric');

// === Very sparse, very fractured — "constellation" ===
await renderFull('constellation', { d: 0.05, f: 1.0, l: 0.30, c: 0.0 }, 'violet-depth');
await renderFull('constellation-aligned', { d: 0.05, f: 1.0, l: 0.30, c: 1.0 }, 'violet-depth');

// === Mid-density coherence sweep — 5 steps ===
for (const c of [0.0, 0.25, 0.50, 0.75, 1.0]) {
    await renderFull(`coh-sweep-${c.toFixed(2)}`, { d: 0.35, f: 0.65, l: 0.40, c }, 'violet-depth');
}

await browser.close();
console.log('All batch 2 renders done');
