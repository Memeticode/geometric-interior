/**
 * Generate thumbnail PNGs for all starter profiles.
 *
 * Outputs per profile:
 *   {slug}-thumb.png    280×180 carousel thumbnail (PNG)
 *
 * Usage:
 *   node scripts/gen-starter-profile-images.mjs
 *   node scripts/gen-starter-profile-images.mjs --profile="Violet Sanctum"
 *   HEADED=1 node scripts/gen-starter-profile-images.mjs
 *
 * Prerequisites:
 *   npm run dev:render  (render server must be running)
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 5204;
const BASE_URL = `http://localhost:${PORT}/scripts/render-page.html`;
const THUMB_DIR = resolve(__dirname, '..', 'vite-app', 'public', 'static', 'images', 'portraits');
const PROFILES_PATH = resolve(__dirname, '..', 'vite-app', 'src', 'core', 'starter-profiles.json');

function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9-]+/g, '_').replace(/^_|_$/g, '');
}

function parseProfileFilter() {
    const arg = process.argv.find(a => a.startsWith('--profile='));
    if (!arg) return null;
    return arg.split('=')[1];
}

async function main() {
    if (!existsSync(THUMB_DIR)) mkdirSync(THUMB_DIR, { recursive: true });

    const headed = process.env.HEADED === '1';

    // Read profiles from disk (no app dependency)
    const profiles = JSON.parse(readFileSync(PROFILES_PATH, 'utf-8'));
    const allNames = (profiles.order ?? Object.keys(profiles).filter(n => n !== 'order'))
        .filter(n => profiles[n]);

    const profileFilter = parseProfileFilter();
    const filtered = profileFilter ? allNames.filter(n => n === profileFilter) : allNames;

    if (profileFilter && filtered.length === 0) {
        console.error(`Profile "${profileFilter}" not found.`);
        process.exit(1);
    }

    console.log('='.repeat(50));
    console.log('  Portrait Thumbnail Generator');
    console.log('='.repeat(50));
    console.log(`  Output dir:    ${THUMB_DIR}`);
    console.log(`  Render URL:    ${BASE_URL}`);
    console.log(`  Profiles:      ${filtered.length} of ${allNames.length}`);
    console.log('');

    const browser = await chromium.launch({
        headless: !headed,
        args: ['--use-gl=angle', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage({
        viewport: { width: 1400, height: 900 },
        deviceScaleFactor: 1,
    });

    await page.routeWebSocket('**', _ws => {});
    page.on('pageerror', err => console.error(`  [browser error] ${err.message}`));

    console.log('Loading render harness...');
    try {
        await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
        console.error(`Failed to load ${BASE_URL}`);
        console.error('Is the render server running?  npm run dev:render');
        await browser.close();
        process.exit(1);
    }

    await page.waitForFunction(() => window._ready === true, { timeout: 30000 });
    console.log('Renderer ready.\n');

    const t0 = Date.now();

    for (const name of filtered) {
        const slug = slugify(name);
        const profile = profiles[name];

        const thumbUrl = await page.evaluate(({ seed, controls }) => {
            const renderer = window._renderer;
            const canvas = document.getElementById('renderCanvas');
            renderer.resize(280, 180);
            renderer.renderWith(seed, controls);
            renderer.setFoldImmediate(1.0);
            renderer.updateTime(3.0);
            renderer.renderFrame();
            return canvas.toDataURL('image/png');
        }, { seed: profile.seed, controls: profile.controls });

        const thumbPng = Buffer.from(thumbUrl.split(',')[1], 'base64');
        writeFileSync(resolve(THUMB_DIR, `${slug}-thumb.png`), thumbPng);
        console.log(`  ${slug}-thumb.png (${(thumbPng.length / 1024).toFixed(1)} KB)`);
    }

    await browser.close();
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\nDone in ${elapsed}s. ${filtered.length} thumbnails saved.`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
