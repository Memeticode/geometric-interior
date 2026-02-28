import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5204/sampler.html');
await page.waitForSelector('#renderBtn');

async function renderFull(name, params, palette = 'violet-depth') {
    const dataUrl = await page.evaluate(async (args) => {
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
        // Canvas is display:none but WebGL still renders to it
        return { dataUrl: canvas.toDataURL('image/png'), nodeCount: meta?.nodeCount ?? '?' };
    }, { params, palette });

    if (!dataUrl) {
        console.log(`${name}: FAILED (no renderer)`);
        return;
    }

    // Write the PNG
    const base64 = dataUrl.dataUrl.replace(/^data:image\/png;base64,/, '');
    writeFileSync(`sampler-captures/v2-${name}.png`, Buffer.from(base64, 'base64'));
    console.log(`${name}: nodes=${dataUrl.nodeCount}`);
}

// === NEW TERRITORY: configs enabled by v2 tuning ===

// 1. High coherence + prismatic: aligned colored shards
await renderFull('prism-aligned', { d: 0.25, f: 0.75, l: 0.40, c: 1.0 }, 'prismatic');

// 2. High coherence + prismatic at ghost params
await renderFull('prism-ghost-aligned', { d: 0.14, f: 0.86, l: 0.50, c: 1.0 }, 'prismatic');

// 3. Medium density that was previously washed out, now readable
await renderFull('medium-readable', { d: 0.65, f: 0.50, l: 0.50, c: 0.60 });

// 4. High density + high fracture - nebula revisited with v2 opacity
await renderFull('nebula-v2', { d: 0.86, f: 0.86, l: 0.50, c: 0.50 });

// 5. All-max revisited
await renderFull('allmax-v2', { d: 1.0, f: 1.0, l: 1.0, c: 1.0, dp: 1.0 });

// 6. "Legibility frontier" sweet spots across palettes
await renderFull('frontier-violet', { d: 0.35, f: 0.60, l: 0.45, c: 0.70 });
await renderFull('frontier-prismatic', { d: 0.35, f: 0.60, l: 0.45, c: 0.70 }, 'prismatic');
await renderFull('frontier-warm', { d: 0.35, f: 0.60, l: 0.45, c: 0.70 }, 'warm-spectrum');
await renderFull('frontier-teal', { d: 0.35, f: 0.60, l: 0.45, c: 0.70 }, 'teal-volumetric');
await renderFull('frontier-sapphire', { d: 0.35, f: 0.60, l: 0.45, c: 0.70 }, 'sapphire');

// 7. Coherence extremes at a sweet spot
await renderFull('sweet-coh0', { d: 0.40, f: 0.55, l: 0.45, c: 0.0 });
await renderFull('sweet-coh1', { d: 0.40, f: 0.55, l: 0.45, c: 1.0 });

// 8. Dark moody - exploiting tighter lum range
await renderFull('dark-jewel', { d: 0.20, f: 0.70, l: 0.0, c: 0.50 }, 'prismatic');

// 9. Bright but structured - testing lum=1 doesn't blow out
await renderFull('bright-structured', { d: 0.30, f: 0.50, l: 1.0, c: 0.60 });

// 10. Maximum coherence, minimum everything else
await renderFull('pure-coherence', { d: 0.0, f: 0.0, l: 0.50, c: 1.0 });

// 11. Extreme coherence contrast on prismatic
await renderFull('prism-chaos', { d: 0.30, f: 0.70, l: 0.40, c: 0.0 }, 'prismatic');
await renderFull('prism-order', { d: 0.30, f: 0.70, l: 0.40, c: 1.0 }, 'prismatic');

// 12. Dense + aligned - does coherence help at high density?
await renderFull('dense-chaotic', { d: 0.80, f: 0.40, l: 0.45, c: 0.0 });
await renderFull('dense-aligned', { d: 0.80, f: 0.40, l: 0.45, c: 1.0 });

await browser.close();
console.log('All full-size renders done');
