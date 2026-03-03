/**
 * Tarot shuffle — generates a random seed tag and its localized label.
 *
 * Usage:
 *   node workflows/tarot-prediction/shuffle.mjs [--locale en]
 *
 * Output (JSON to stdout):
 *   {"seed": [7, 3, 14], "label": "Shifting, fractured, radiant", "serial": "7.3.14"}
 *
 * Requires render server running: npm run dev:render
 */

import { chromium } from 'playwright';

const args = process.argv.slice(2);
const localeIdx = args.indexOf('--locale');
const locale = localeIdx >= 0 && args[localeIdx + 1] ? args[localeIdx + 1] : 'en';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5204/scripts/render-page.html', { waitUntil: 'load' });
await page.waitForFunction(() => window._ready === true, { timeout: 15000 });

const result = await page.evaluate(async (loc) => {
    const mod = await import('../geometric-interior/src/index.js');
    const tag = [
        Math.floor(Math.random() * 18),
        Math.floor(Math.random() * 18),
        Math.floor(Math.random() * 18),
    ];
    const label = mod.seedTagToLabel(tag, loc);
    return { seed: tag, label, serial: tag.join('.') };
}, locale);

await browser.close();

console.log(JSON.stringify(result));
