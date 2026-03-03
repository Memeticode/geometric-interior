/**
 * Tarot card renderer — renders a single config and captures full metadata.
 *
 * Usage:
 *   node workflows/tarot-prediction/render-card.mjs config.json [--output dir/] [--width 800] [--height 520] [--locale en]
 *
 * Config file format:
 *   { "name": "card-01", "seed": [7, 3, 14], "controls": { "topology": "flow-field", ... } }
 *
 * Saves {name}.png in output dir and prints metadata JSON to stdout:
 *   {"title": "Flowing Sapphire Atmospheric", "altText": "...", "nodeCount": 482}
 *
 * Requires render server running: npm run dev:render
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

// --- Parse args ---

const args = process.argv.slice(2);
const configFile = args.find(a => !a.startsWith('--'));

if (!configFile) {
    console.error('Usage: node workflows/tarot-prediction/render-card.mjs config.json [--output dir/] [--width 800] [--height 520] [--locale en]');
    process.exit(1);
}

function getFlag(name, fallback) {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}

const outputDir = resolve(getFlag('output', dirname(configFile)));
const width = parseInt(getFlag('width', '800'), 10);
const height = parseInt(getFlag('height', '520'), 10);
const locale = getFlag('locale', 'en');

// --- Load config ---

const cfg = JSON.parse(readFileSync(resolve(configFile), 'utf-8'));
const name = cfg.name || 'untitled';

function toFilename(n) {
    return n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
}

mkdirSync(outputDir, { recursive: true });

// --- Launch browser & render ---

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5204/scripts/render-page.html', { waitUntil: 'load' });
await page.waitForFunction(() => window._ready === true, { timeout: 15000 });
await page.waitForTimeout(1000);

try {
    const result = await page.evaluate(({ controls, seed, w, h, loc }) => {
        const canvas = document.getElementById('renderCanvas');
        const renderer = window._renderer;
        renderer.resize(w, h);
        const meta = renderer.renderWith(seed, controls, loc);
        return {
            dataUrl: canvas.toDataURL('image/png'),
            title: meta?.title ?? '',
            altText: meta?.altText ?? '',
            nodeCount: meta?.nodeCount ?? 0,
        };
    }, { controls: cfg.controls, seed: cfg.seed, w: width, h: height, loc: locale });

    const filename = `${toFilename(name)}.png`;
    const outPath = resolve(outputDir, filename);
    const base64 = result.dataUrl.replace(/^data:image\/png;base64,/, '');
    writeFileSync(outPath, Buffer.from(base64, 'base64'));

    // Metadata to stdout for the agent to capture
    console.log(JSON.stringify({
        title: result.title,
        altText: result.altText,
        nodeCount: result.nodeCount,
    }));

    // Human-readable log to stderr
    process.stderr.write(`  ${name} [${cfg.seed.join(',')}] nodes=${result.nodeCount} -> ${filename}\n`);
} catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
}

await browser.close();
