/**
 * Profile exploration script — generates screenshots of candidate configurations
 * using Playwright + the live Vite dev server.
 *
 * Usage: node explore-profiles.mjs
 * Requires: vite dev server running on port 5204 (or 5173)
 */

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';

const OUT_DIR = 'exploration';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ── Candidate configurations ──
// Each has: name, seed (intent), controls, and optionally paletteTweaks
const CANDIDATES = [
    // === SAPPHIRE FAMILY ===
    {
        name: '01-abyssal-whisper',
        seed: 'The silence inside radiant emptiness meets the dark.',
        controls: { topology: 'flow-field', palette: 'sapphire', density: 0.30, luminosity: 0.55, fracture: 0.35, depth: 0.80, coherence: 0.60 },
    },
    {
        name: '02-sapphire-cathedral',
        seed: 'A cathedral built from frozen lightning and quiet geometry.',
        controls: { topology: 'flow-field', palette: 'sapphire', density: 0.55, luminosity: 0.65, fracture: 0.30, depth: 0.60, coherence: 0.75 },
    },

    // === WARM SPECTRUM FAMILY ===
    {
        name: '03-ember-lattice',
        seed: 'A prayer made of slow fire becomes a door.',
        controls: { topology: 'flow-field', palette: 'warm-spectrum', density: 0.65, luminosity: 0.60, fracture: 0.55, depth: 0.45, coherence: 0.70 },
    },
    {
        name: '04-golden-dissolution',
        seed: 'What light does to dissolving glass learns to fall.',
        controls: { topology: 'flow-field', palette: 'warm-spectrum', density: 0.40, luminosity: 0.70, fracture: 0.65, depth: 0.55, coherence: 0.35 },
    },
    {
        name: '05-solar-convergence',
        seed: 'The moment before warm void catches fire.',
        controls: { topology: 'flow-field', palette: 'warm-spectrum', density: 0.75, luminosity: 0.80, fracture: 0.40, depth: 0.35, coherence: 0.55 },
    },

    // === TEAL FAMILY ===
    {
        name: '06-teal-cathedral',
        seed: 'An architecture of liquid geometry holds the room.',
        controls: { topology: 'flow-field', palette: 'teal-volumetric', density: 0.55, luminosity: 0.70, fracture: 0.40, depth: 0.60, coherence: 0.75 },
    },
    {
        name: '07-oceanic-drift',
        seed: 'The space where deep transparence remembers water.',
        controls: { topology: 'flow-field', palette: 'teal-volumetric', density: 0.45, luminosity: 0.60, fracture: 0.50, depth: 0.70, coherence: 0.45 },
    },

    // === PRISMATIC FAMILY ===
    {
        name: '08-spectral-bloom',
        seed: 'The space where bright silence catches fire.',
        controls: { topology: 'flow-field', palette: 'prismatic', density: 0.50, luminosity: 0.80, fracture: 0.50, depth: 0.55, coherence: 0.50 },
    },
    {
        name: '09-prismatic-cascade',
        seed: 'Everything that follows luminous absence refuses to land.',
        controls: { topology: 'flow-field', palette: 'prismatic', density: 0.70, luminosity: 0.65, fracture: 0.60, depth: 0.45, coherence: 0.40 },
    },
    {
        name: '10-iridescent-whisper',
        seed: 'A geometry that dreams of infinite nearness folds inward.',
        controls: { topology: 'flow-field', palette: 'prismatic', density: 0.35, luminosity: 0.75, fracture: 0.30, depth: 0.65, coherence: 0.65 },
    },

    // === AMETHYST FAMILY ===
    {
        name: '11-amethyst-depths',
        seed: 'What remains after crystallized doubt folds inward.',
        controls: { topology: 'flow-field', palette: 'amethyst', density: 0.75, luminosity: 0.50, fracture: 0.70, depth: 0.65, coherence: 0.40 },
    },
    {
        name: '12-orchid-lattice',
        seed: 'The interior of sharp tenderness touches the edge.',
        controls: { topology: 'flow-field', palette: 'amethyst', density: 0.50, luminosity: 0.65, fracture: 0.45, depth: 0.50, coherence: 0.65 },
    },

    // === VIOLET-DEPTH FAMILY ===
    {
        name: '13-violet-essence',
        seed: 'The weight of crystallized doubt finds its shape.',
        controls: { topology: 'flow-field', palette: 'violet-depth', density: 0.50, luminosity: 0.50, fracture: 0.50, depth: 0.50, coherence: 0.50 },
    },
    {
        name: '14-violet-sparse',
        seed: 'The memory of weightless stone turns to light.',
        controls: { topology: 'flow-field', palette: 'violet-depth', density: 0.25, luminosity: 0.60, fracture: 0.25, depth: 0.70, coherence: 0.70 },
    },
    {
        name: '15-violet-storm',
        seed: 'Somewhere between shattered calm and quiet thunder.',
        controls: { topology: 'flow-field', palette: 'violet-depth', density: 0.80, luminosity: 0.55, fracture: 0.80, depth: 0.40, coherence: 0.30 },
    },

    // === CRYSTAL-LATTICE FAMILY ===
    {
        name: '16-glacial-order',
        seed: 'A window into fractured stillness holds the room.',
        controls: { topology: 'flow-field', palette: 'crystal-lattice', density: 0.55, luminosity: 0.60, fracture: 0.35, depth: 0.55, coherence: 0.80 },
    },
    {
        name: '17-frost-dissolution',
        seed: 'The slow collapse of translucent grief drifts apart.',
        controls: { topology: 'flow-field', palette: 'crystal-lattice', density: 0.40, luminosity: 0.70, fracture: 0.60, depth: 0.75, coherence: 0.35 },
    },

    // === EXTREME / ARTISTIC COMBOS ===
    {
        name: '18-minimal-breath',
        seed: 'The last breath of bright silence forgets itself.',
        controls: { topology: 'flow-field', palette: 'sapphire', density: 0.15, luminosity: 0.75, fracture: 0.20, depth: 0.85, coherence: 0.80 },
    },
    {
        name: '19-dense-ember',
        seed: 'A geometry that dreams of burning fog reaches through.',
        controls: { topology: 'flow-field', palette: 'warm-spectrum', density: 0.90, luminosity: 0.45, fracture: 0.75, depth: 0.30, coherence: 0.25 },
    },
    {
        name: '20-luminous-void',
        seed: 'The color of suspended breath begins to sing.',
        controls: { topology: 'flow-field', palette: 'violet-depth', density: 0.35, luminosity: 0.90, fracture: 0.40, depth: 0.60, coherence: 0.55 },
    },
    {
        name: '21-teal-crystalline',
        seed: 'The distance between luminous absence and warm void.',
        controls: { topology: 'flow-field', palette: 'teal-volumetric', density: 0.60, luminosity: 0.55, fracture: 0.55, depth: 0.50, coherence: 0.60 },
    },
    {
        name: '22-amethyst-glow',
        seed: 'What happens when radiant emptiness becomes a door.',
        controls: { topology: 'flow-field', palette: 'amethyst', density: 0.45, luminosity: 0.80, fracture: 0.35, depth: 0.55, coherence: 0.55 },
    },
    {
        name: '23-prismatic-deep',
        seed: 'The interior of soft collapse touches the edge.',
        controls: { topology: 'flow-field', palette: 'prismatic', density: 0.60, luminosity: 0.55, fracture: 0.55, depth: 0.75, coherence: 0.50 },
    },
    {
        name: '24-sapphire-surge',
        seed: 'An architecture of quiet thunder holds the room.',
        controls: { topology: 'flow-field', palette: 'sapphire', density: 0.70, luminosity: 0.70, fracture: 0.50, depth: 0.45, coherence: 0.55 },
    },
];

// ── Main ──

const PORT = process.env.PORT || 5204;
const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

const errors = [];
page.on('pageerror', err => errors.push(err.message));

console.log(`Connecting to http://localhost:${PORT}...`);
await page.goto(`http://localhost:${PORT}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(4000); // Wait for initial render + worker

for (const candidate of CANDIDATES) {
    console.log(`Rendering: ${candidate.name}...`);

    await page.evaluate((c) => {
        // Set seed/intent
        const profileName = document.getElementById('profileName');
        if (profileName) {
            profileName.value = c.seed;
            profileName.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Set palette (click the chip to trigger proper palette loading)
        const palChip = document.querySelector(`.pal-chip[data-value="${c.controls.palette}"]`);
        if (palChip) palChip.click();

        // Set sliders
        for (const key of ['density', 'luminosity', 'fracture', 'depth', 'coherence']) {
            const el = document.getElementById(key);
            if (el) {
                el.value = c.controls[key];
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }, candidate);

    // Wait for render to complete
    await page.waitForTimeout(2500);

    // Capture just the canvas
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

console.log(`\nDone! ${CANDIDATES.length} candidates saved to ${OUT_DIR}/`);
await browser.close();