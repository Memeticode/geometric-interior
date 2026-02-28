/**
 * Rendering tests: canvas integrity, combos, determinism.
 * Replaces the original test-render.mjs with extended coverage.
 */
import { fileURLToPath } from 'url';
import path from 'path';
import { screenshotCanvas, ensurePanelOpen, ensureConfigExpanded, reloadPage } from './helpers/browser.mjs';
import { setAllControls, triggerRender } from './helpers/controls.mjs';
import { waitForRender, waitForStillRendered } from './helpers/waits.mjs';
import { assertCanvasNonEmpty, assertScreenshotsDiffer, assertNoPageErrors } from './helpers/assertions.mjs';
import { RENDER_COMBOS } from './helpers/constants.mjs';

export async function runTests(page, errors) {
    let passed = 0, failed = 0;
    const results = [];

    async function test(name, fn) {
        try {
            await fn();
            passed++;
            results.push({ name, status: 'PASS' });
            console.log(`  PASS: ${name}`);
        } catch (err) {
            failed++;
            results.push({ name, status: 'FAIL', error: err.message });
            console.error(`  FAIL: ${name}`);
            console.error(`    ${err.message}`);
        }
    }

    console.log('\n=== Rendering Tests ===\n');

    // ── Test: All combos render without page errors ──
    await test('All render combos produce non-empty canvas without errors', async () => {
        for (const combo of RENDER_COMBOS) {
            await setAllControls(page, combo);
            await triggerRender(page);
            await waitForRender(page);

            const shot = await screenshotCanvas(page);
            assertCanvasNonEmpty(shot);
        }
        assertNoPageErrors(errors);
    });

    // ── Test: Canvas has non-uniform pixels ──
    await test('Canvas has non-uniform pixels (not solid black)', async () => {
        const shot = await screenshotCanvas(page);
        assertCanvasNonEmpty(shot);
    });

    // ── Test: Different seeds produce different renders ──
    await test('Different seeds produce different renders', async () => {
        const baseControls = {
            topology: 'flow-field',
            density: 0.5, luminosity: 0.5, fracture: 0.5, coherence: 0.5,
            hue: 0.783, spectrum: 0.239, chroma: 0.417,
            scale: 0.5, division: 0.5, faceting: 0.5, flow: 0.5,
        };

        await setAllControls(page, { ...baseControls, seed: 'alpha-test-seed' });
        await triggerRender(page);
        await waitForRender(page);
        const shotA = await screenshotCanvas(page);

        await setAllControls(page, { ...baseControls, seed: 'beta-test-seed' });
        await triggerRender(page);
        await waitForRender(page);
        const shotB = await screenshotCanvas(page);

        assertScreenshotsDiffer(shotA, shotB);
    });

    // ── Test: Deterministic rendering ──
    await test('Deterministic rendering (same seed+controls = same screenshot)', async () => {
        const fullSetup = async () => {
            await ensurePanelOpen(page);
            await ensureConfigExpanded(page);
            await setAllControls(page, {
                seed: 'determinism-check',
                topology: 'flow-field',
                density: 0.5, luminosity: 0.5, fracture: 0.5, coherence: 0.5,
                hue: 0.375, spectrum: 0.300, chroma: 0.450,
                scale: 0.5, division: 0.5, faceting: 0.5, flow: 0.5,
            });
            await triggerRender(page);
            await waitForRender(page, 3000);
        };

        await fullSetup();
        const shotA = await screenshotCanvas(page);

        // Reload and render same config
        await reloadPage(page);
        await waitForStillRendered(page);

        await fullSetup();
        const shotB = await screenshotCanvas(page);

        const a = new Uint8Array(shotA);
        const b = new Uint8Array(shotB);
        let diffCount = 0;
        const len = Math.min(a.length, b.length);
        for (let i = 0; i < len; i++) {
            if (a[i] !== b[i]) diffCount++;
        }
        const diffPct = diffCount / len;
        if (diffPct > 0.05) {
            throw new Error(`Screenshots differ by ${(diffPct * 100).toFixed(2)}% of bytes (expected <5%)`);
        }
    });

    // ── Final check: no page errors across all tests ──
    await test('No uncaught page errors across all rendering tests', async () => {
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
        console.log(`\nRendering: ${r.passed} passed, ${r.failed} failed\n`);
        process.exit(r.failed > 0 ? 1 : 0);
    } finally {
        await cleanup();
    }
}
