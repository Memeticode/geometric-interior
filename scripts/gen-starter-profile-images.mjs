/**
 * Generate portrait PNGs for all starter profiles at all resolutions.
 *
 * Outputs per profile:
 *   {slug}-thumb.png    280×180  carousel thumbnail
 *   {slug}-sd.png       840×540
 *   {slug}-hd.png      1400×900
 *   {slug}-fhd.png     1680×1080
 *   {slug}-qhd.png     2520×1620
 *   {slug}-4k.png      3360×2160
 *
 * Usage:
 *   node scripts/gen-starter-profile-images.mjs
 *   node scripts/gen-starter-profile-images.mjs --profile="Violet Sanctum"
 *   node scripts/gen-starter-profile-images.mjs --only=thumb,sd
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
const PROFILES_PATH = resolve(__dirname, '..', 'vite-app', 'src', 'stores', 'starter-profiles.json');

const SIZES = [
    { label: 'thumb', width: 280,  height: 180  },
    { label: 'sd',    width: 840,  height: 540  },
    { label: 'hd',    width: 1400, height: 900  },
    { label: 'fhd',   width: 1680, height: 1080 },
    { label: 'qhd',   width: 2520, height: 1620 },
    { label: '4k',    width: 3360, height: 2160 },
];

function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9-]+/g, '_').replace(/^_|_$/g, '');
}

function parseProfileFilter() {
    const arg = process.argv.find(a => a.startsWith('--profile='));
    if (!arg) return null;
    return arg.split('=')[1];
}

function parseSizeFilter() {
    const arg = process.argv.find(a => a.startsWith('--only='));
    if (!arg) return null;
    return arg.split('=')[1].split(',').map(s => s.trim());
}

async function main() {
    if (!existsSync(THUMB_DIR)) mkdirSync(THUMB_DIR, { recursive: true });

    const headed = process.env.HEADED === '1';

    // Read profiles from disk (no app dependency)
    const data = JSON.parse(readFileSync(PROFILES_PATH, 'utf-8'));

    // Flatten sections → [{slug, name, seed, controls}, ...]
    // slug uses the same slugify as the app (underscores as separators)
    const allProfiles = [];
    for (const sectionKey of data['section-order']) {
        const section = data.sections[sectionKey];
        for (const [, portrait] of Object.entries(section.portraits)) {
            allProfiles.push({ slug: slugify(portrait.name), name: portrait.name, seed: portrait.seed, controls: portrait.controls, camera: portrait.camera || null });
        }
    }

    const profileFilter = parseProfileFilter();
    const filtered = profileFilter
        ? allProfiles.filter(p => p.name === profileFilter || p.slug === profileFilter)
        : allProfiles;

    if (profileFilter && filtered.length === 0) {
        console.error(`Profile "${profileFilter}" not found.`);
        process.exit(1);
    }

    const sizeFilter = parseSizeFilter();
    const sizes = sizeFilter
        ? SIZES.filter(s => sizeFilter.includes(s.label))
        : SIZES;

    console.log('='.repeat(50));
    console.log('  Portrait Image Generator');
    console.log('='.repeat(50));
    console.log(`  Output dir:    ${THUMB_DIR}`);
    console.log(`  Render URL:    ${BASE_URL}`);
    console.log(`  Profiles:      ${filtered.length} of ${allProfiles.length}`);
    console.log(`  Sizes:         ${sizes.map(s => s.label).join(', ')}`);
    console.log(`  Total renders: ${filtered.length * sizes.length}`);
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

    let renderCount = 0;

    for (const profile of filtered) {
        console.log(`  ${profile.name} (${profile.slug}):`);

        for (const size of sizes) {
            const dataUrl = await page.evaluate(({ seed, controls, camera, w, h }) => {
                const renderer = window._renderer;
                const canvas = document.getElementById('renderCanvas');
                renderer.clearCameraState();
                renderer.resize(w, h);
                renderer.renderWith(seed, controls);
                if (camera) {
                    const dist = Math.pow(3, 0.6 - 1.6 * (camera.zoom ?? 0.5));
                    renderer.setCameraState(dist, camera.rotation ?? 0, camera.elevation ?? 0);
                }
                renderer.setFoldImmediate(1.0);
                renderer.updateTime(3.0);
                renderer.renderFrame();
                return canvas.toDataURL('image/png');
            }, { seed: profile.seed, controls: profile.controls, camera: profile.camera, w: size.width, h: size.height });

            const png = Buffer.from(dataUrl.split(',')[1], 'base64');
            const filename = `${profile.slug}-${size.label}.png`;
            writeFileSync(resolve(THUMB_DIR, filename), png);
            console.log(`    ${filename} (${(png.length / 1024).toFixed(1)} KB)`);
            renderCount++;
        }
    }

    await browser.close();
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\nDone in ${elapsed}s. ${renderCount} images saved.`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
