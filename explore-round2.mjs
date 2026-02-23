/**
 * Round 2: Focused exploration targeting warm, amethyst, and prismatic palettes
 * in the sweet spot (low-mid density, moderate coherence, controlled luminosity).
 */

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';

const OUT_DIR = 'exploration';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const CANDIDATES = [
    // === WARM SPECTRUM — sweet spot ===
    {
        name: 'r2-01-warm-gossamer',
        seed: 'The memory of slow fire turns to light.',
        controls: { topology: 'flow-field', palette: 'warm-spectrum', density: 0.35, luminosity: 0.55, fracture: 0.40, depth: 0.55, coherence: 0.65 },
    },
    {
        name: 'r2-02-ember-whisper',
        seed: 'A window into burning fog holds the room.',
        controls: { topology: 'flow-field', palette: 'warm-spectrum', density: 0.30, luminosity: 0.60, fracture: 0.30, depth: 0.65, coherence: 0.70 },
    },
    {
        name: 'r2-03-golden-filament',
        seed: 'The distance between warm void and soft collapse.',
        controls: { topology: 'flow-field', palette: 'warm-spectrum', density: 0.45, luminosity: 0.50, fracture: 0.50, depth: 0.50, coherence: 0.55 },
    },

    // === AMETHYST — lower density to avoid darkness ===
    {
        name: 'r2-04-amethyst-veil',
        seed: 'What remains after translucent grief finds its shape.',
        controls: { topology: 'flow-field', palette: 'amethyst', density: 0.30, luminosity: 0.65, fracture: 0.35, depth: 0.60, coherence: 0.60 },
    },
    {
        name: 'r2-05-orchid-bloom',
        seed: 'The space where sharp tenderness begins to sing.',
        controls: { topology: 'flow-field', palette: 'amethyst', density: 0.40, luminosity: 0.70, fracture: 0.25, depth: 0.50, coherence: 0.75 },
    },

    // === PRISMATIC — careful, lower density ===
    {
        name: 'r2-06-spectral-veil',
        seed: 'A cathedral built from infinite nearness and deep transparence.',
        controls: { topology: 'flow-field', palette: 'prismatic', density: 0.30, luminosity: 0.60, fracture: 0.35, depth: 0.60, coherence: 0.65 },
    },
    {
        name: 'r2-07-prismatic-filament',
        seed: 'The interior of bright silence reaches through.',
        controls: { topology: 'flow-field', palette: 'prismatic', density: 0.40, luminosity: 0.55, fracture: 0.45, depth: 0.55, coherence: 0.55 },
    },

    // === Refinements of round 1 winners ===
    {
        name: 'r2-08-teal-refined',
        seed: 'An architecture of liquid geometry holds the room.',
        controls: { topology: 'flow-field', palette: 'teal-volumetric', density: 0.45, luminosity: 0.60, fracture: 0.35, depth: 0.55, coherence: 0.70 },
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

console.log(`\nRound 2 done! ${CANDIDATES.length} candidates saved.`);
await browser.close();