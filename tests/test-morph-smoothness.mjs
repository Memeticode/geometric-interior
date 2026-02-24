/**
 * Morph smoothness test: captures frame sequences during profile transitions
 * and measures inter-frame pixel similarity to quantify visual smoothness.
 *
 * Usage:
 *   node tests/test-morph-smoothness.mjs
 *   HEADED=1 node tests/test-morph-smoothness.mjs
 *   SAVE_FRAMES=1 node tests/test-morph-smoothness.mjs   # save frame PNGs
 *
 * Prerequisites:
 *   npx vite --port 5204   (dev server must be running)
 */
import { PNG } from 'pngjs';
import { ensurePanelOpen, screenshotCanvas, getCanvasBox } from './helpers/browser.mjs';
import { clickAnyProfileCard } from './helpers/profiles.mjs';
import { waitForStillRendered, waitForMorphComplete, sleep } from './helpers/waits.mjs';
import { assertNoPageErrors } from './helpers/assertions.mjs';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAVE_FRAMES = process.env.SAVE_FRAMES === '1';
const FRAME_DIR = join(__dirname, 'morph-frames');

function decodePNG(buffer) {
    const png = PNG.sync.read(Buffer.from(buffer));
    return { width: png.width, height: png.height, data: png.data };
}

function pixelDelta(imgA, imgB) {
    if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
        throw new Error('Image dimensions mismatch');
    }
    const pixels = imgA.width * imgA.height;
    let totalDelta = 0;
    for (let i = 0; i < pixels; i++) {
        const off = i * 4;
        totalDelta += Math.abs(imgA.data[off] - imgB.data[off]);
        totalDelta += Math.abs(imgA.data[off + 1] - imgB.data[off + 1]);
        totalDelta += Math.abs(imgA.data[off + 2] - imgB.data[off + 2]);
    }
    return totalDelta / (pixels * 255 * 3);
}

function smoothnessStats(deltas) {
    if (deltas.length === 0) return { mean: 0, max: 0, stddev: 0, count: 0 };
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const max = Math.max(...deltas);
    const variance = deltas.reduce((sum, d) => sum + (d - mean) ** 2, 0) / deltas.length;
    return { mean, max, stddev: Math.sqrt(variance), count: deltas.length };
}

export async function runTests(page, errors) {
    let passed = 0, failed = 0;

    async function test(name, fn) {
        try {
            await fn();
            passed++;
            console.log(`  PASS: ${name}`);
        } catch (err) {
            failed++;
            console.error(`  FAIL: ${name}`);
            console.error(`    ${err.message}`);
        }
    }

    async function dismissConfirm() {
        const dismissed = await page.evaluate(() => {
            const modal = document.getElementById('confirmModal');
            if (!modal || modal.classList.contains('hidden')) return false;
            const btns = modal.querySelectorAll('#confirmActions button');
            for (const btn of btns) {
                if (btn.textContent.toLowerCase().includes('discard')) { btn.click(); return true; }
            }
            if (btns.length > 0) { btns[0].click(); return true; }
            return false;
        });
        if (dismissed) await sleep(400);
    }

    async function captureTransitionFrames(fromProfile, toProfile) {
        await clickAnyProfileCard(page, fromProfile);
        await sleep(300);
        await dismissConfirm();
        await waitForMorphComplete(page);
        await waitForStillRendered(page);

        const clip = await getCanvasBox(page);

        const frames = [];
        frames.push(await page.screenshot({ clip }));

        await clickAnyProfileCard(page, toProfile);
        await sleep(50);
        await dismissConfirm();

        const morphStart = Date.now();
        const MORPH_CAPTURE_MS = 5000;
        while (Date.now() - morphStart < MORPH_CAPTURE_MS) {
            frames.push(await page.screenshot({ clip }));
        }

        await waitForMorphComplete(page);
        frames.push(await page.screenshot({ clip }));

        return frames;
    }

    console.log('\n=== Morph Smoothness Tests ===\n');

    await waitForStillRendered(page);
    await ensurePanelOpen(page);

    if (SAVE_FRAMES && !existsSync(FRAME_DIR)) {
        mkdirSync(FRAME_DIR, { recursive: true });
    }

    const TRANSITION_PAIRS = [
        ['Verdant Stream', 'Prismatic Abyss'],
        ['Rose Quartz', 'Sapphire Lattice'],
        ['Citrine Whisper', 'Dark Ruby'],
    ];

    const allResults = [];

    for (const [fromName, toName] of TRANSITION_PAIRS) {
        const label = `${fromName} → ${toName}`;

        await test(`Transition smoothness: ${label}`, async () => {
            const frames = await captureTransitionFrames(fromName, toName);

            if (frames.length < 3) {
                throw new Error(`Only captured ${frames.length} frames (need at least 3)`);
            }

            if (SAVE_FRAMES) {
                const pairDir = join(FRAME_DIR, `${fromName}-to-${toName}`.replace(/\s+/g, '_'));
                if (!existsSync(pairDir)) mkdirSync(pairDir, { recursive: true });
                for (let i = 0; i < frames.length; i++) {
                    writeFileSync(join(pairDir, `frame_${String(i).padStart(3, '0')}.png`), frames[i]);
                }
            }

            const decoded = frames.map(f => decodePNG(f));

            const deltas = [];
            for (let i = 1; i < decoded.length; i++) {
                deltas.push(pixelDelta(decoded[i - 1], decoded[i]));
            }

            const stats = smoothnessStats(deltas);
            console.log(`    Frames captured: ${frames.length}`);
            console.log(`    Mean delta: ${stats.mean.toFixed(6)}`);
            console.log(`    Max delta:  ${stats.max.toFixed(6)}`);
            console.log(`    Stddev:     ${stats.stddev.toFixed(6)}`);

            allResults.push({ label, ...stats, frameCount: frames.length });

            if (stats.max > 0.40) {
                throw new Error(
                    `Max delta ${stats.max.toFixed(6)} exceeds threshold 0.40 — transition has extreme jumps`
                );
            }

            if (frames.length < 3) {
                throw new Error(
                    `Only captured ${frames.length} frames — need at least 3 for delta analysis`
                );
            }
        });
    }

    if (allResults.length > 0) {
        console.log('\n  --- Smoothness Summary ---');
        for (const r of allResults) {
            console.log(
                `  ${r.label}: ${r.frameCount} frames, ` +
                `mean=${r.mean.toFixed(6)}, max=${r.max.toFixed(6)}, stddev=${r.stddev.toFixed(6)}`
            );
        }
    }

    await test('No uncaught page errors', async () => {
        assertNoPageErrors(errors);
    });

    return { passed, failed };
}

// ── Standalone entry ──
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith(path.basename(__filename))) {
    const { createTestContext } = await import('./helpers/browser.mjs');
    const { page, errors, cleanup } = await createTestContext();
    try {
        const r = await runTests(page, errors);
        console.log(`\nMorph Smoothness: ${r.passed} passed, ${r.failed} failed\n`);
        process.exit(r.failed > 0 ? 1 : 0);
    } finally {
        await cleanup();
    }
}
