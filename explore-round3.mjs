/**
 * Round 3: Ultra-targeted — lower luminosity to control center blowout,
 * specifically for warm and amethyst palettes where structure needs to show.
 */

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';

const OUT_DIR = 'exploration';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const CANDIDATES = [
    // Warm: very controlled luminosity, let planes show
    {
        name: 'r3-01-warm-subdued',
        seed: 'The memory of slow fire turns to light.',
        controls: { topology: 'flow-field', palette: 'warm-spectrum', density: 0.35, luminosity: 0.38, fracture: 0.40, depth: 0.55, coherence: 0.65 },
    },
    {
        name: 'r3-02-warm-deep',
        seed: 'A window into burning fog holds the room.',
        controls: { topology: 'flow-field', palette: 'warm-spectrum', density: 0.30, luminosity: 0.42, fracture: 0.35, depth: 0.70, coherence: 0.70 },
    },
    {
        name: 'r3-03-warm-structured',
        seed: 'What light does to dissolving glass learns to fall.',
        controls: { topology: 'flow-field', palette: 'warm-spectrum', density: 0.40, luminosity: 0.35, fracture: 0.45, depth: 0.50, coherence: 0.60 },
    },
    // Amethyst: controlled
    {
        name: 'r3-04-amethyst-subdued',
        seed: 'The interior of sharp tenderness touches the edge.',
        controls: { topology: 'flow-field', palette: 'amethyst', density: 0.30, luminosity: 0.42, fracture: 0.30, depth: 0.60, coherence: 0.70 },
    },
    {
        name: 'r3-05-amethyst-deep',
        seed: 'What remains after crystallized doubt folds inward.',
        controls: { topology: 'flow-field', palette: 'amethyst', density: 0.35, luminosity: 0.45, fracture: 0.40, depth: 0.70, coherence: 0.60 },
    },
    // Prismatic: controlled
    {
        name: 'r3-06-prismatic-subdued',
        seed: 'The space where bright silence catches fire.',
        controls: { topology: 'flow-field', palette: 'prismatic', density: 0.35, luminosity: 0.40, fracture: 0.40, depth: 0.60, coherence: 0.60 },
    },
    // Sapphire: slightly different approach
    {
        name: 'r3-07-sapphire-wide',
        seed: 'The silence inside radiant emptiness meets the dark.',
        controls: { topology: 'flow-field', palette: 'sapphire', density: 0.40, luminosity: 0.45, fracture: 0.40, depth: 0.60, coherence: 0.65 },
    },
];

const PORT = process.env.PORT || 5212;
const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

const errors = [];
page.on('pageerror', err => errors.push(err.message));

console.log(`Connecting to http://localhost:${PORT}...`);
await page.goto(`http://localhost:${PORT}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(4000);

for (const candidate of CANDIDATES) {
    console.log(`Rendering: ${candidate.name}...`);

    await page.evaluate((c) => {
        const profileName = document.getElementById('profileName');
        if (profileName) {
            profileName.value = c.seed;
            profileName.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const palChip = document.querySelector(`.pal-chip[data-value="${c.controls.palette}"]`);
        if (palChip) palChip.click();
        for (const key of ['density', 'luminosity', 'fracture', 'depth', 'coherence']) {
            const el = document.getElementById(key);
            if (el) {
                el.value = c.controls[key];
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }, candidate);

    await page.waitForTimeout(2500);

    const canvasBox = await page.$eval('#c', el => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
    });

    await page.screenshot({
        path: `${OUT_DIR}/${candidate.name}.png`,
        clip: canvasBox,
    });
    console.log(`  Saved: ${OUT_DIR}/${candidate.name}.png`);
}

if (errors.length) {
    console.log('\n=== PAGE ERRORS ===');
    for (const e of errors) console.log(e);
}

console.log(`\nRound 3 done! ${CANDIDATES.length} candidates saved.`);
await browser.close();