/**
 * Generate static portrait thumbnails (280×180 PNG) for all starter profiles.
 *
 * Usage:
 *   node scripts/gen-thumbs.mjs
 *   HEADED=1 node scripts/gen-thumbs.mjs   # watch it render
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
const BASE_URL = `http://localhost:${PORT}/`;
const THUMB_DIR = resolve(__dirname, '..', 'public', 'thumbs');

async function main() {
    if (!existsSync(THUMB_DIR)) mkdirSync(THUMB_DIR, { recursive: true });

    const headed = process.env.HEADED === '1';

    console.log('='.repeat(50));
    console.log('  Portrait Thumbnail Generator');
    console.log('='.repeat(50));
    console.log(`  Output dir: ${THUMB_DIR}`);
    console.log(`  Dev URL:    ${BASE_URL}`);
    console.log('');

    const browser = await chromium.launch({
        headless: !headed,
        args: ['--use-gl=angle', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage({
        viewport: { width: 1400, height: 900 },
        deviceScaleFactor: 1,
    });

    // Block Vite HMR
    await page.routeWebSocket('**', _ws => {});

    page.on('pageerror', err => {
        console.error(`  [browser error] ${err.message}`);
    });

    console.log('Navigating to app...');
    try {
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (err) {
        console.error(`Failed to load ${BASE_URL}`);
        console.error('Is the Vite dev server running?  npx vite --port 5204');
        await browser.close();
        process.exit(1);
    }

    // Wait for the app to be ready (exportBtn is created late in init)
    await page.waitForFunction(
        () => typeof window.__renderPortraitThumb === 'function',
        { timeout: 30000 }
    );
    console.log('App ready.\n');

    // Get portrait names from the gallery
    const portraitNames = await page.evaluate(() => {
        const cards = document.querySelectorAll('#portraitGallery .profile-card');
        return Array.from(cards).map(c => c.querySelector('.profile-card-name')?.textContent).filter(Boolean);
    });

    if (portraitNames.length === 0) {
        console.error('No portrait cards found. Is the gallery rendered?');
        await browser.close();
        process.exit(1);
    }

    console.log(`Found ${portraitNames.length} portraits.\n`);

    for (const name of portraitNames) {
        const dataUrl = await page.evaluate((pName) => {
            return window.__renderPortraitThumb(pName);
        }, name);

        const slug = slugify(name);
        const pngData = Buffer.from(dataUrl.split(',')[1], 'base64');
        const outPath = resolve(THUMB_DIR, `${slug}.png`);
        writeFileSync(outPath, pngData);
        console.log(`  ${slug}.png  (${(pngData.length / 1024).toFixed(1)} KB)`);
    }

    await browser.close();
    console.log(`\nDone. ${portraitNames.length} thumbnails saved to public/thumbs/`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
