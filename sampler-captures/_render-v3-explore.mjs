import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

mkdirSync('sampler-captures/v3', { recursive: true });

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
    writeFileSync(`sampler-captures/v3/${name}.png`, Buffer.from(base64, 'base64'));
    console.log(`  ${name}: nodes=${result.nodes}`);
}

// =========================================================
// 1. FLOW EXPLORATION — the new spatial dimension
//    Test at high coherence where flow matters most
// =========================================================
console.log('\n=== FLOW EXPLORATION ===');

// Flow sweep at high coherence, violet
for (const f of [0.0, 0.25, 0.5, 0.75, 1.0]) {
    await render(`flow-${f.toFixed(2)}-violet`, {
        coherence: 0.90, flow: f, hue: 0.783
    });
}

// Flow extremes with different hues
await render('flow-radial-teal', { coherence: 0.90, flow: 0.0, hue: 0.51, chroma: 0.58 });
await render('flow-orbital-teal', { coherence: 0.90, flow: 1.0, hue: 0.51, chroma: 0.58 });
await render('flow-radial-warm', { coherence: 0.90, flow: 0.0, hue: 0.06, chroma: 0.85 });
await render('flow-orbital-warm', { coherence: 0.90, flow: 1.0, hue: 0.06, chroma: 0.85 });
await render('flow-radial-sapphire', { coherence: 0.90, flow: 0.0, hue: 0.625, chroma: 0.86 });
await render('flow-orbital-sapphire', { coherence: 0.90, flow: 1.0, hue: 0.625, chroma: 0.86 });

// Flow at low coherence (should be similar regardless of flow value)
await render('flow-radial-lowcoh', { coherence: 0.20, flow: 0.0 });
await render('flow-orbital-lowcoh', { coherence: 0.20, flow: 1.0 });

// =========================================================
// 2. DIVISION EXPLORATION — topology 1/2/3 lobes
// =========================================================
console.log('\n=== DIVISION EXPLORATION ===');

for (const d of [0.0, 0.25, 0.5, 0.75, 1.0]) {
    await render(`div-${d.toFixed(2)}`, { division: d });
}

// Division with different fracture levels
await render('div-0-lowfrac', { division: 0.0, fracture: 0.20 });
await render('div-1-lowfrac', { division: 1.0, fracture: 0.20 });
await render('div-0-highfrac', { division: 0.0, fracture: 0.85 });
await render('div-1-highfrac', { division: 1.0, fracture: 0.85 });

// Triple lobe with different hues
await render('div-triple-warm', { division: 1.0, hue: 0.06, chroma: 0.85 });
await render('div-triple-prismatic', { division: 1.0, hue: 0.5, spectrum: 1.0, chroma: 1.0 });

// =========================================================
// 3. SCALE EXPLORATION — monumental vs atmospheric
// =========================================================
console.log('\n=== SCALE EXPLORATION ===');

for (const s of [0.0, 0.25, 0.5, 0.75, 1.0]) {
    await render(`scale-${s.toFixed(2)}`, { scale: s });
}

// Scale extremes with density variation
await render('scale-mono-dense', { scale: 0.0, density: 0.25 });
await render('scale-atmo-dense', { scale: 1.0, density: 0.25 });
await render('scale-mono-sparse', { scale: 0.0, density: 0.03 });
await render('scale-atmo-sparse', { scale: 1.0, density: 0.03 });

// =========================================================
// 4. FACETING EXPLORATION — broad panels vs sharp shards
// =========================================================
console.log('\n=== FACETING EXPLORATION ===');

for (const f of [0.0, 0.25, 0.5, 0.75, 1.0]) {
    await render(`facet-${f.toFixed(2)}`, { faceting: f });
}

// Faceting with luminosity variation (visible details differ)
await render('facet-broad-bright', { faceting: 0.0, luminosity: 0.75 });
await render('facet-sharp-bright', { faceting: 1.0, luminosity: 0.75 });
await render('facet-broad-dark', { faceting: 0.0, luminosity: 0.25 });
await render('facet-sharp-dark', { faceting: 1.0, luminosity: 0.25 });

// =========================================================
// 5. COMBINED NEW DIMENSIONS — interesting pairings
// =========================================================
console.log('\n=== COMBINED NEW DIMENSIONS ===');

// Radial starburst + triple lobe
await render('radial-triple', {
    flow: 0.0, division: 1.0, coherence: 0.85
});

// Orbital rings + monumental scale
await render('orbital-monumental', {
    flow: 1.0, scale: 0.0, coherence: 0.85
});

// Orbital rings + atmospheric
await render('orbital-atmospheric', {
    flow: 1.0, scale: 1.0, coherence: 0.85, density: 0.15
});

// Sharp shards + high fracture + low density = "constellation of crystals"
await render('crystal-constellation', {
    faceting: 1.0, fracture: 0.90, density: 0.04, luminosity: 0.50,
    hue: 0.586, spectrum: 0.0, chroma: 0.0
});

// Monumental + single lobe + radial = "singularity"
await render('singularity', {
    scale: 0.0, division: 0.0, flow: 0.0, coherence: 0.90,
    density: 0.06, luminosity: 0.60
});

// Atmospheric + triple lobe + orbital = "nebular rings"
await render('nebular-rings', {
    scale: 1.0, division: 1.0, flow: 1.0, coherence: 0.80,
    density: 0.18, luminosity: 0.45, hue: 0.51, chroma: 0.58
});

// Sharp faceting + high coherence + orbital = "crystal bands"
await render('crystal-bands', {
    faceting: 0.85, flow: 1.0, coherence: 0.90,
    density: 0.10, luminosity: 0.55, hue: 0.625, chroma: 0.86
});

// Broad panels + radial + single lobe = "solar bloom"
await render('solar-bloom', {
    faceting: 0.0, flow: 0.0, division: 0.0, coherence: 0.85,
    luminosity: 0.70, hue: 0.06, chroma: 0.90, spectrum: 0.22
});

// =========================================================
// 6. PORTRAIT CANDIDATES — full 11D compositions
//    These are designed as potential starter profiles
// =========================================================
console.log('\n=== PORTRAIT CANDIDATES ===');

// "Violet Cathedral" — the classic, enhanced with new dims
await render('portrait-violet-cathedral', {
    density: 0.06, luminosity: 0.58, fracture: 0.45, coherence: 0.78,
    hue: 0.783, spectrum: 0.24, chroma: 0.45,
    scale: 0.3, division: 0.5, faceting: 0.4, flow: 0.5
}, 'portrait-1');

// "Amber Starburst" — warm radial
await render('portrait-amber-starburst', {
    density: 0.08, luminosity: 0.60, fracture: 0.50, coherence: 0.88,
    hue: 0.06, spectrum: 0.22, chroma: 0.90,
    scale: 0.4, division: 0.4, faceting: 0.5, flow: 0.0
}, 'portrait-2');

// "Teal Orbital" — cool orbital bands
await render('portrait-teal-orbital', {
    density: 0.10, luminosity: 0.55, fracture: 0.40, coherence: 0.85,
    hue: 0.51, spectrum: 0.21, chroma: 0.58,
    scale: 0.6, division: 0.5, faceting: 0.5, flow: 1.0
}, 'portrait-3');

// "Prismatic Scatter" — full color, fractured
await render('portrait-prismatic-scatter', {
    density: 0.07, luminosity: 0.45, fracture: 0.85, coherence: 0.50,
    hue: 0.85, spectrum: 0.70, chroma: 0.55,
    scale: 0.5, division: 0.5, faceting: 0.6, flow: 0.5
}, 'portrait-4');

// "Deep Sapphire" — minimal, jewel-like
await render('portrait-deep-sapphire', {
    density: 0.04, luminosity: 0.65, fracture: 0.25, coherence: 0.92,
    hue: 0.625, spectrum: 0.24, chroma: 0.86,
    scale: 0.35, division: 0.5, faceting: 0.35, flow: 0.5
}, 'portrait-5');

// "Rose Nebula" — atmospheric, soft
await render('portrait-rose-nebula', {
    density: 0.12, luminosity: 0.55, fracture: 0.50, coherence: 0.72,
    hue: 0.94, spectrum: 0.30, chroma: 0.50,
    scale: 0.75, division: 0.5, faceting: 0.5, flow: 0.5
}, 'portrait-6');

// "Crystal Lattice" — achromatic, pure geometry
await render('portrait-crystal-lattice', {
    density: 0.06, luminosity: 0.60, fracture: 0.30, coherence: 0.80,
    hue: 0.586, spectrum: 0.0, chroma: 0.0,
    scale: 0.45, division: 0.5, faceting: 0.3, flow: 0.5
}, 'portrait-7');

// "Dark Ruby Divide" — deep red, triple lobe, dark
await render('portrait-dark-ruby-divide', {
    density: 0.15, luminosity: 0.30, fracture: 0.60, coherence: 0.55,
    hue: 0.986, spectrum: 0.30, chroma: 0.60,
    scale: 0.5, division: 0.85, faceting: 0.6, flow: 0.5
}, 'portrait-8');

// "Emerald Radiance" — green radial
await render('portrait-emerald-radiance', {
    density: 0.07, luminosity: 0.62, fracture: 0.55, coherence: 0.85,
    hue: 0.375, spectrum: 0.30, chroma: 0.70,
    scale: 0.4, division: 0.45, faceting: 0.5, flow: 0.15
}, 'portrait-9');

// "Amethyst Spirals" — orbital, sharp faceting
await render('portrait-amethyst-spirals', {
    density: 0.08, luminosity: 0.52, fracture: 0.45, coherence: 0.82,
    hue: 0.867, spectrum: 0.27, chroma: 0.50,
    scale: 0.55, division: 0.5, faceting: 0.75, flow: 0.85
}, 'portrait-10');

// "Solar Forge" — single lobe, monumental, bright warm
await render('portrait-solar-forge', {
    density: 0.10, luminosity: 0.70, fracture: 0.40, coherence: 0.80,
    hue: 0.08, spectrum: 0.25, chroma: 0.88,
    scale: 0.15, division: 0.15, faceting: 0.2, flow: 0.0
}, 'portrait-11');

// "Midnight Trifold" — triple lobe, atmospheric, deep
await render('portrait-midnight-trifold', {
    density: 0.14, luminosity: 0.35, fracture: 0.55, coherence: 0.65,
    hue: 0.70, spectrum: 0.35, chroma: 0.40,
    scale: 0.70, division: 0.95, faceting: 0.55, flow: 0.5
}, 'portrait-12');

// =========================================================
// 7. EDGE CASES / EXTREMES — push the system
// =========================================================
console.log('\n=== EDGE CASES ===');

// All new dims at 0
await render('newdims-all-zero', { scale: 0.0, division: 0.0, faceting: 0.0, flow: 0.0, coherence: 0.85 });
// All new dims at 1
await render('newdims-all-one', { scale: 1.0, division: 1.0, faceting: 1.0, flow: 1.0, coherence: 0.85 });
// Everything at 0
await render('everything-zero', {
    density: 0.0, luminosity: 0.0, fracture: 0.0, coherence: 0.0,
    hue: 0.5, spectrum: 0.0, chroma: 0.0,
    scale: 0.0, division: 0.0, faceting: 0.0, flow: 0.0
});
// Everything at 1
await render('everything-one', {
    density: 1.0, luminosity: 1.0, fracture: 1.0, coherence: 1.0,
    hue: 0.5, spectrum: 1.0, chroma: 1.0,
    scale: 1.0, division: 1.0, faceting: 1.0, flow: 1.0
});

await browser.close();
console.log('\n=== All v3 renders complete ===');
