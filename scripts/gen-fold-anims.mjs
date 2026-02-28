/**
 * Generate fold animation sprite strips for all starter profiles.
 * Each sprite is a vertical strip of 60 frames (280×10800 PNG).
 *
 * Usage:
 *   node scripts/gen-fold-anims.mjs
 *   HEADED=1 node scripts/gen-fold-anims.mjs   # watch it render
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

async function main() {
    if (!existsSync(THUMB_DIR)) mkdirSync(THUMB_DIR, { recursive: true });

    const headed = process.env.HEADED === '1';

    console.log('='.repeat(50));
    console.log('  Fold Animation Sprite Generator');
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

    console.log('Navigating to image editor...');
    try {
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (err) {
        console.error(`Failed to load ${BASE_URL}`);
        console.error('Is the Vite dev server running?  npx vite --port 5204');
        await browser.close();
        process.exit(1);
    }

    // Wait for the fold renderer to be ready
    await page.waitForFunction(
        () => typeof window.__renderPortraitFold === 'function',
        { timeout: 30000 }
    );
    console.log('App ready.\n');

    // Get portrait names
    const portraitNames = await page.evaluate(() => {
        const { loadPortraits } = window.__profileUtils || {};
        if (loadPortraits) return Object.keys(loadPortraits());
        // Fallback: get from gallery cards if available
        const cards = document.querySelectorAll('#portraitGallery .profile-card');
        return Array.from(cards).map(c => c.querySelector('.profile-card-name')?.textContent).filter(Boolean);
    });

    // If no profile utils exposed, get names from starter profiles directly
    let names = portraitNames;
    if (!names || names.length === 0) {
        // Try evaluating loadPortraits via the thumb hook
        names = await page.evaluate(() => {
            try {
                return window.__renderPortraitFold && Object.keys(
                    // The fold function internally calls loadPortraits, but we can't access it
                    // Instead, try rendering a known name to verify it works
                    {}
                );
            } catch { return []; }
        });
    }

    // Get names by trying __renderPortraitThumb which uses loadPortraits internally
    if (!names || names.length === 0) {
        names = await page.evaluate(() => {
            // Import starter profiles from the module
            return fetch('/src/core/starter-profiles.json')
                .then(r => r.json())
                .then(profiles => Object.keys(profiles));
        });
    }

    if (!names || names.length === 0) {
        console.error('No portrait names found.');
        await browser.close();
        process.exit(1);
    }

    console.log(`Found ${names.length} portraits.\n`);

    for (const name of names) {
        process.stdout.write(`  ${slugify(name)}-fold.png ... `);
        try {
            const dataUrl = await page.evaluate((pName) => {
                return window.__renderPortraitFold(pName);
            }, name);

            const slug = slugify(name);
            const pngData = Buffer.from(dataUrl.split(',')[1], 'base64');
            const outPath = resolve(THUMB_DIR, `${slug}-fold.png`);
            writeFileSync(outPath, pngData);
            console.log(`${(pngData.length / 1024).toFixed(1)} KB`);
        } catch (err) {
            console.log(`FAILED: ${err.message}`);
        }
    }

    await browser.close();
    console.log(`\nDone. Fold sprite strips saved to public/thumbs/`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
