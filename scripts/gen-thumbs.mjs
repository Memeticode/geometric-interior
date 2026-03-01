/**
 * Generate carousel thumbnail PNGs for all starter profiles.
 *
 * Outputs per profile:
 *   {slug}.png          280×180 carousel thumbnail (PNG)
 *
 * Usage:
 *   node scripts/gen-thumbs.mjs
 *   node scripts/gen-thumbs.mjs --profile="Violet Sanctum"
 *   HEADED=1 node scripts/gen-thumbs.mjs
 *
 * Prerequisites:
 *   npx vite --port 5204  (dev server must be running)
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { slugify } from '../src/shared/slugify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 5204;
const BASE_URL = `http://localhost:${PORT}/image.html`;
const THUMB_DIR = resolve(__dirname, '..', 'public', 'thumbs');

function parseProfileFilter() {
    const arg = process.argv.find(a => a.startsWith('--profile='));
    if (!arg) return null;
    return arg.split('=')[1];
}

async function main() {
    if (!existsSync(THUMB_DIR)) mkdirSync(THUMB_DIR, { recursive: true });

    const headed = process.env.HEADED === '1';

    console.log('='.repeat(50));
    console.log('  Portrait Thumbnail Generator');
    console.log('='.repeat(50));
    console.log(`  Output dir:    ${THUMB_DIR}`);
    console.log(`  Dev URL:       ${BASE_URL}`);
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

    console.log('Navigating to image editor...');
    try {
        await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
        console.error(`Failed to load ${BASE_URL}`);
        console.error('Is the Vite dev server running?  npx vite --port 5204');
        await browser.close();
        process.exit(1);
    }

    await page.waitForFunction(
        () => typeof window.__renderPortraitThumb === 'function',
        { timeout: 30000 }
    );
    console.log('App ready.\n');

    // Get portrait names
    const names = await page.evaluate(() =>
        fetch('/src/core/starter-profiles.json').then(r => r.json()).then(p => Object.keys(p))
    );

    if (!names || names.length === 0) {
        console.error('No portrait names found.');
        await browser.close();
        process.exit(1);
    }

    const profileFilter = parseProfileFilter();
    const filtered = profileFilter ? names.filter(n => n === profileFilter) : names;
    if (profileFilter && filtered.length === 0) {
        console.error(`Profile "${profileFilter}" not found.`);
        await browser.close();
        process.exit(1);
    }
    console.log(`Processing ${filtered.length} of ${names.length} portraits.\n`);

    for (const name of filtered) {
        const slug = slugify(name);
        const thumbUrl = await page.evaluate(pName => window.__renderPortraitThumb(pName), name);
        const thumbPng = Buffer.from(thumbUrl.split(',')[1], 'base64');
        writeFileSync(resolve(THUMB_DIR, `${slug}.png`), thumbPng);
        console.log(`  ${slug}.png (${(thumbPng.length / 1024).toFixed(1)} KB)`);
    }

    await browser.close();
    console.log(`\nDone. ${filtered.length} thumbnails saved.`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
