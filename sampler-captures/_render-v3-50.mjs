import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const configs = JSON.parse(readFileSync('sampler-captures/_50-configs.json', 'utf-8'));
mkdirSync('sampler-captures/v3-50', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5204/sampler.html');
await page.waitForSelector('#renderBtn');
await page.waitForFunction(() => !!window._renderer, { timeout: 10000 });

console.log(`Rendering ${configs.length} configurations...\n`);

for (let i = 0; i < configs.length; i++) {
    const cfg = configs[i];
    const slug = cfg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    const prefix = String(i + 1).padStart(2, '0');
    const filename = `${prefix}-${slug}`;
    const seed = `cache-${slug}`;

    const controls = { topology: 'flow-field', ...cfg.controls };

    const result = await page.evaluate(({ controls, seed }) => {
        const canvas = document.getElementById('renderCanvas');
        const renderer = window._renderer;
        renderer.resize(800, 520);
        const meta = renderer.renderWith(seed, controls);
        return { dataUrl: canvas.toDataURL('image/png'), nodes: meta?.nodeCount ?? '?' };
    }, { controls, seed });

    if (!result) {
        console.log(`  [${prefix}] ${cfg.name}: FAILED`);
        continue;
    }
    const base64 = result.dataUrl.replace(/^data:image\/png;base64,/, '');
    writeFileSync(`sampler-captures/v3-50/${filename}.png`, Buffer.from(base64, 'base64'));

    const tag = cfg.category === 'profile' ? 'PROFILE' : 'explore';
    console.log(`  [${prefix}] ${cfg.name} (${tag}): nodes=${result.nodes}`);
}

await browser.close();
console.log(`\nAll ${configs.length} renders complete — files in sampler-captures/v3-50/`);
