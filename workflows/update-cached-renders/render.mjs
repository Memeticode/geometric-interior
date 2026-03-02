/**
 * Batch-render all starter profile portraits at every resolution tier.
 *
 * Outputs per profile:
 *   {slug}-thumb.png   280×180
 *   {slug}-sd.png      840×540
 *   {slug}-hd.png     1400×900
 *   {slug}-fhd.png    1680×1080
 *   {slug}-qhd.png    2520×1620
 *   {slug}-4k.png     3360×2160
 *
 * Usage:
 *   node workflows/update-cached-renders/render.mjs
 *   node workflows/update-cached-renders/render.mjs --profile="Violet Sanctum"
 *   node workflows/update-cached-renders/render.mjs --resolution=hd
 *   HEADED=1 node workflows/update-cached-renders/render.mjs
 *
 * Prerequisites:
 *   npx vite --port 5204  (dev server must be running)
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { slugify } from '../../src/shared/slugify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 5204;
const BASE_URL = `http://localhost:${PORT}/sampler.html`;
const OUT_DIR = resolve(__dirname, '..', '..', 'public', 'static', 'images', 'portraits');
const PROFILES_PATH = resolve(__dirname, '..', '..', 'src', 'core', 'starter-profiles.json');
const MAX_RESTARTS = 10;

const SIZES = [
    { key: 'thumb', w: 280,  h: 180  },
    { key: 'sd',    w: 840,  h: 540  },
    { key: 'hd',    w: 1400, h: 900  },
    { key: 'fhd',   w: 1680, h: 1080 },
    { key: 'qhd',   w: 2520, h: 1620 },
    { key: '4k',    w: 3360, h: 2160 },
];

/* ── Argument parsing ── */

function parseArgs() {
    let profileFilter = null;
    let resolutionFilter = null;
    for (const arg of process.argv.slice(2)) {
        if (arg.startsWith('--profile=')) profileFilter = arg.slice('--profile='.length);
        if (arg.startsWith('--resolution=')) resolutionFilter = arg.slice('--resolution='.length).toLowerCase();
    }
    if (resolutionFilter && !SIZES.find(s => s.key === resolutionFilter)) {
        console.error(`Unknown resolution: ${resolutionFilter}`);
        console.error(`Valid keys: ${SIZES.map(s => s.key).join(', ')}`);
        process.exit(1);
    }
    return { profileFilter, resolutionFilter, headed: process.env.HEADED === '1' };
}

/* ── Job list ── */

function buildJobs(profiles, profileFilter, resolutionFilter) {
    const sizes = resolutionFilter ? SIZES.filter(s => s.key === resolutionFilter) : SIZES;
    const allNames = (profiles.order ?? Object.keys(profiles).filter(n => n !== 'order'))
        .filter(n => profiles[n]); // skip order entries with no matching profile
    const names = profileFilter ? allNames.filter(n => n === profileFilter) : allNames;

    const jobs = [];
    for (const size of sizes) {
        for (const name of names) {
            const slug = slugify(name);
            jobs.push({
                name, slug,
                seed: profiles[name].seed,
                controls: profiles[name].controls,
                size,
                outPath: resolve(OUT_DIR, `${slug}-${size.key}.png`),
            });
        }
    }
    return jobs;
}

/* ── Browser session ── */

async function launchSession(headed) {
    const browser = await chromium.launch({
        headless: !headed,
        args: ['--use-gl=angle', '--disable-dev-shm-usage', '--disable-gpu-sandbox'],
    });

    const page = await browser.newPage({
        viewport: { width: 1400, height: 900 },
        deviceScaleFactor: 1,
    });

    page.setDefaultTimeout(120_000);
    await page.routeWebSocket('**', _ws => {});
    page.on('pageerror', err => console.error(`  [browser error] ${err.message}`));

    try {
        await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30_000 });
        await new Promise(r => setTimeout(r, 2000));
    } catch {
        await browser.close();
        throw new Error(`Failed to load ${BASE_URL}. Is Vite running?  npx vite --port 5204`);
    }

    await page.waitForFunction(() => !!window._renderer, { timeout: 30_000 });
    return { browser, page };
}

/* ── Single render ── */

async function renderOne(page, job) {
    const { seed, controls, size } = job;
    return page.evaluate(({ seed, controls, w, h }) => {
        const canvas = document.getElementById('renderCanvas');
        const renderer = window._renderer;
        renderer.resize(w, h);
        renderer.renderWith(seed, controls);
        renderer.setFoldImmediate(1.0);
        renderer.updateTime(3.0);
        renderer.renderFrame();
        return canvas.toDataURL('image/png');
    }, { seed, controls, w: size.w, h: size.h });
}

/* ── Main ── */

async function main() {
    const { profileFilter, resolutionFilter, headed } = parseArgs();
    const profiles = JSON.parse(readFileSync(PROFILES_PATH, 'utf-8'));
    const allJobs = buildJobs(profiles, profileFilter, resolutionFilter);

    if (profileFilter && allJobs.length === 0) {
        console.error(`Profile "${profileFilter}" not found.`);
        process.exit(1);
    }

    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

    const pending = allJobs.filter(j => !existsSync(j.outPath));
    const cached = allJobs.length - pending.length;

    console.log('='.repeat(60));
    console.log('  Cached Render Generator');
    console.log('='.repeat(60));
    console.log(`  Profiles:     ${new Set(allJobs.map(j => j.name)).size}`);
    console.log(`  Sizes:        ${[...new Set(allJobs.map(j => j.size.key))].join(', ')}`);
    console.log(`  Total jobs:   ${allJobs.length} (${cached} cached, ${pending.length} to render)`);
    console.log(`  Output:       ${OUT_DIR}`);
    console.log('');

    if (pending.length === 0) {
        console.log('All renders cached. Nothing to do.');
        return;
    }

    let cancelled = false;
    const onSigint = () => { cancelled = true; console.log('\n  Ctrl+C — finishing current render...\n'); };
    process.on('SIGINT', onSigint);

    const t0 = Date.now();
    let rendered = 0;
    let failed = 0;
    let restarts = 0;
    let idx = 0;

    while (idx < pending.length && !cancelled && restarts <= MAX_RESTARTS) {
        let browser, page;
        try {
            console.log(restarts > 0
                ? `  Restart #${restarts}: resuming from job ${idx + 1}/${pending.length}`
                : '  Launching browser...');
            ({ browser, page } = await launchSession(headed));
        } catch (err) {
            console.error(`  Launch failed: ${err.message}`);
            if (++restarts > MAX_RESTARTS) break;
            await new Promise(r => setTimeout(r, 3000));
            continue;
        }

        let crashed = false;
        page.on('crash', () => { crashed = true; });

        try {
            while (idx < pending.length && !cancelled && !crashed) {
                const job = pending[idx];

                if (existsSync(job.outPath)) { idx++; continue; }

                const renderT0 = Date.now();
                const dataUrl = await renderOne(page, job);

                if (!dataUrl || !dataUrl.startsWith('data:image/png')) {
                    console.log(`  FAILED: ${job.size.key}/${job.slug}`);
                    failed++;
                    idx++;
                    continue;
                }

                const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
                writeFileSync(job.outPath, buf);
                rendered++;
                idx++;

                const ms = Date.now() - renderT0;
                const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
                const sizeKB = (buf.length / 1024).toFixed(0);
                console.log(
                    `  [${rendered}/${pending.length}] ${job.slug}-${job.size.key}.png` +
                    `  ${job.size.w}×${job.size.h}  ${sizeKB}KB  ${ms}ms  (${elapsed}s elapsed)`
                );
            }
        } catch (err) {
            const msg = err.message || '';
            if (msg.includes('context') || msg.includes('destroyed') || msg.includes('Target closed') || msg.includes('crash')) {
                console.error(`\n  Context lost at job ${idx + 1}: ${msg}`);
                crashed = true;
            } else {
                try { await browser.close(); } catch {}
                throw err;
            }
        }

        try { await browser.close(); } catch {}

        if (cancelled) {
            console.log(`\n  Paused. ${rendered} rendered, ${pending.length - idx} remaining. Re-run to resume.`);
            process.exit(0);
        }

        if (crashed) {
            restarts++;
            if (restarts > MAX_RESTARTS) { console.error(`  Max restarts (${MAX_RESTARTS}) exceeded.`); break; }
            console.log('  Restarting browser in 2s...');
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    process.off('SIGINT', onSigint);
    const totalS = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\nDone in ${totalS}s: ${rendered} rendered, ${cached} cached, ${failed} failed.`);
}

main().catch(err => { console.error(err); process.exit(1); });
