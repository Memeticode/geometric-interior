import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

const configs = JSON.parse(readFileSync('sampler-captures/_100-configs.json', 'utf-8'));
mkdirSync('sampler-captures/v3-50', { recursive: true });

// Parse optional --start flag to skip already-rendered entries
const startArg = process.argv.find(a => a.startsWith('--start='));
const startIdx = startArg ? parseInt(startArg.split('=')[1], 10) - 1 : 0;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5204/sampler.html');
await page.waitForSelector('#renderBtn');
await page.waitForFunction(() => !!window._renderer, { timeout: 10000 });

const total = configs.length;
const toRender = total - startIdx;
console.log(`Rendering ${toRender} of ${total} configurations (starting at #${startIdx + 1})...\n`);

for (let i = startIdx; i < configs.length; i++) {
    const cfg = configs[i];
    const slug = cfg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    const prefix = String(i + 1).padStart(3, '0');
    const filename = `${prefix}-${slug}`;
    const seed = `cache-${slug}`;

    // Skip if already cached
    if (existsSync(`sampler-captures/v3-50/${filename}.png`)) {
        console.log(`  [${prefix}] ${cfg.name}: CACHED (skipped)`);
        continue;
    }

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

    const tag = cfg.category === 'profile' ? 'PROFILE' : cfg.category;
    console.log(`  [${prefix}] ${cfg.name} (${tag}): nodes=${result.nodes}`);
}

await browser.close();
console.log(`\nAll renders complete — files in sampler-captures/v3-50/`);
