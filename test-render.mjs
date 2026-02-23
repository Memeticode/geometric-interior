import { chromium } from 'playwright';
import { unlinkSync } from 'fs';

const COMBOS = [
    // Midpoint: all sliders at 0.5 = exact demo defaults
    { name: 'midpoint', topology: 'flow-field', palette: 'violet-depth', density: 0.50, luminosity: 0.50, fracture: 0.50, depth: 0.50, coherence: 0.50 },
    // Extremes: each slider at 0 or 1, others at 0.5
    { name: 'density-lo', topology: 'flow-field', palette: 'violet-depth', density: 0.00, luminosity: 0.50, fracture: 0.50, depth: 0.50, coherence: 0.50 },
    { name: 'density-hi', topology: 'flow-field', palette: 'violet-depth', density: 1.00, luminosity: 0.50, fracture: 0.50, depth: 0.50, coherence: 0.50 },
    { name: 'luminosity-lo', topology: 'flow-field', palette: 'violet-depth', density: 0.50, luminosity: 0.00, fracture: 0.50, depth: 0.50, coherence: 0.50 },
    { name: 'luminosity-hi', topology: 'flow-field', palette: 'violet-depth', density: 0.50, luminosity: 1.00, fracture: 0.50, depth: 0.50, coherence: 0.50 },
    { name: 'fracture-lo', topology: 'flow-field', palette: 'violet-depth', density: 0.50, luminosity: 0.50, fracture: 0.00, depth: 0.50, coherence: 0.50 },
    { name: 'fracture-hi', topology: 'flow-field', palette: 'violet-depth', density: 0.50, luminosity: 0.50, fracture: 1.00, depth: 0.50, coherence: 0.50 },
    { name: 'depth-lo', topology: 'flow-field', palette: 'violet-depth', density: 0.50, luminosity: 0.50, fracture: 0.50, depth: 0.00, coherence: 0.50 },
    { name: 'depth-hi', topology: 'flow-field', palette: 'violet-depth', density: 0.50, luminosity: 0.50, fracture: 0.50, depth: 1.00, coherence: 0.50 },
    { name: 'coherence-lo', topology: 'flow-field', palette: 'violet-depth', density: 0.50, luminosity: 0.50, fracture: 0.50, depth: 0.50, coherence: 0.00 },
    { name: 'coherence-hi', topology: 'flow-field', palette: 'violet-depth', density: 0.50, luminosity: 0.50, fracture: 0.50, depth: 0.50, coherence: 1.00 },
    // All extremes
    { name: 'all-zero', topology: 'flow-field', palette: 'violet-depth', density: 0.00, luminosity: 0.00, fracture: 0.00, depth: 0.00, coherence: 0.00 },
    { name: 'all-one', topology: 'flow-field', palette: 'violet-depth', density: 1.00, luminosity: 1.00, fracture: 1.00, depth: 1.00, coherence: 1.00 },
    // Starter profiles
    { name: 'warm-flow', topology: 'flow-field', palette: 'warm-spectrum', density: 0.70, luminosity: 0.75, fracture: 0.40, depth: 0.35, coherence: 0.45 },
    { name: 'prismatic-attractor', topology: 'multi-attractor', palette: 'prismatic', density: 0.60, luminosity: 0.65, fracture: 0.55, depth: 0.35, coherence: 0.45 },
];

const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const errors = [];
page.on('pageerror', err => errors.push(err.message));

await page.goto('http://localhost:5204', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(3000);

for (const combo of COMBOS) {
    // Set controls via the page — use correct DOM element IDs
    await page.evaluate((c) => {
        // Set seed via profileName input (combined seed/intent field)
        const profileName = document.getElementById('profileName');
        if (profileName) profileName.value = 'test-' + c.name;

        // Set hidden inputs
        document.getElementById('topology').value = c.topology;
        document.getElementById('palette').value = c.palette;

        // Set range sliders
        document.getElementById('density').value = c.density;
        document.getElementById('luminosity').value = c.luminosity;
        document.getElementById('fracture').value = c.fracture;
        document.getElementById('depth').value = c.depth;
        document.getElementById('coherence').value = c.coherence;

        // Trigger topology/palette UI selection
        document.querySelectorAll('.topo-tile').forEach(t => t.classList.toggle('active', t.dataset.value === c.topology));
        document.querySelectorAll('.pal-chip').forEach(t => t.classList.toggle('active', t.dataset.value === c.palette));
    }, combo);

    // Click render button if it exists, otherwise trigger via input event
    const renderBtn = await page.$('#renderBtn');
    if (renderBtn) {
        await renderBtn.click();
    } else {
        // Trigger a change event on coherence to force re-render
        await page.evaluate(() => {
            const el = document.getElementById('coherence');
            el.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }
    await page.waitForTimeout(2000);

    // Clip just the canvas area for comparison
    const canvasBox = await page.$eval('#c', el => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
    });

    await page.screenshot({
        path: `test-${combo.name}.png`,
        clip: canvasBox,
    });
    console.log(`Saved: test-${combo.name}.png`);
}

if (errors.length) {
    console.log('\n=== PAGE ERRORS ===');
    for (const e of errors) console.log(e);
}

// Clean up test images
console.log('\nCleaning up test images...');
for (const combo of COMBOS) {
    const path = `test-${combo.name}.png`;
    try { unlinkSync(path); } catch { /* already gone */ }
}
console.log('Done.');

await browser.close();
