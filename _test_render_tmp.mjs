
import { chromium } from 'playwright';

const COMBOS = [
    { name: 'violet-flow', topology: 'flow-field', palette: 'violet-depth', density: 0.60, luminosity: 0.70, fracture: 0.35, depth: 0.45, coherence: 0.55 },
    { name: 'warm-mobius', topology: 'mobius', palette: 'warm-spectrum', density: 0.55, luminosity: 0.70, fracture: 0.25, depth: 0.45, coherence: 0.50 },
    { name: 'teal-flow', topology: 'flow-field', palette: 'teal-volumetric', density: 0.65, luminosity: 0.65, fracture: 0.40, depth: 0.50, coherence: 0.55 },
    { name: 'prismatic-attractor', topology: 'multi-attractor', palette: 'prismatic', density: 0.75, luminosity: 0.80, fracture: 0.55, depth: 0.40, coherence: 0.50 },
    { name: 'crystal-icosahedral', topology: 'icosahedral', palette: 'crystal-lattice', density: 0.70, luminosity: 0.75, fracture: 0.50, depth: 0.35, coherence: 0.65 },
];

const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const errors = [];
page.on('pageerror', err => errors.push(err.message));

await page.goto('http://localhost:5204', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(3000);

for (const combo of COMBOS) {
    await page.evaluate((c) => {
        const profileName = document.getElementById('profileName');
        if (profileName) profileName.value = 'test-' + c.name;

        document.getElementById('topology').value = c.topology;
        document.getElementById('palette').value = c.palette;
        document.getElementById('density').value = c.density;
        document.getElementById('luminosity').value = c.luminosity;
        document.getElementById('fracture').value = c.fracture;
        document.getElementById('depth').value = c.depth;
        document.getElementById('coherence').value = c.coherence;

        document.querySelectorAll('.topo-tile').forEach(t => t.classList.toggle('active', t.dataset.value === c.topology));
        document.querySelectorAll('.pal-chip').forEach(t => t.classList.toggle('active', t.dataset.value === c.palette));
    }, combo);

    const renderBtn = await page.$('#renderBtn');
    if (renderBtn) {
        await renderBtn.click();
    } else {
        await page.evaluate(() => {
            const el = document.getElementById('coherence');
            el.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }
    await page.waitForTimeout(2000);

    const canvasBox = await page.$eval('#c', el => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
    });

    await page.screenshot({
        path: 'test-' + combo.name + '.png',
        clip: canvasBox,
    });
    console.log('Saved: test-' + combo.name + '.png');
}

if (errors.length) {
    console.log('
=== PAGE ERRORS ===');
    for (const e of errors) console.log(e);
}

await browser.close();
