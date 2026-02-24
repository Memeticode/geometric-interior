/**
 * Rendering tests: canvas integrity, combos, palettes, determinism.
 * Replaces the original test-render.mjs with extended coverage.
 */
import { createTestContext, screenshotCanvas, ensurePanelOpen, ensureConfigExpanded, scrollToElement } from './helpers/browser.mjs';
import { setAllControls, triggerRender, selectPalette } from './helpers/controls.mjs';
import { waitForRender, waitForStillRendered } from './helpers/waits.mjs';
import { assertCanvasNonEmpty, assertScreenshotsDiffer, assertNoPageErrors } from './helpers/assertions.mjs';
import { RENDER_COMBOS, ALL_PALETTE_KEYS } from './helpers/constants.mjs';

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

const { browser, page, errors, cleanup } = await createTestContext();

try {
    // ── Test: All 14 combos render without page errors ──
    await test('All 14 combos render without page errors', async () => {
        for (const combo of RENDER_COMBOS) {
            await setAllControls(page, combo);
            await triggerRender(page);
            await waitForRender(page);

            const shot = await screenshotCanvas(page);
            assertCanvasNonEmpty(shot);
        }
        assertNoPageErrors(errors);
    });

    // ── Test: Each palette produces non-empty render ──
    await test('Each of 7 palette presets produces non-empty render', async () => {
        await ensurePanelOpen(page);
        await ensureConfigExpanded(page);
        await scrollToElement(page, '#paletteSelector');
        const presets = ALL_PALETTE_KEYS.filter(k => k !== 'custom');
        for (const key of presets) {
            await setAllControls(page, {
                seed: `palette-test-${key}`,
                topology: 'flow-field',
                palette: key,
                density: 0.5, luminosity: 0.5, fracture: 0.5, depth: 0.5, coherence: 0.5,
            });
            await scrollToElement(page, '#paletteSelector');
            await selectPalette(page, key);
            await triggerRender(page);
            await waitForRender(page);

            const shot = await screenshotCanvas(page);
            assertCanvasNonEmpty(shot);
        }
    });

    // ── Test: Custom palette renders ──
    await test('Custom palette with specific hue/range/sat renders', async () => {
        await ensurePanelOpen(page);
        await ensureConfigExpanded(page);
        await scrollToElement(page, '#paletteSelector');
        await selectPalette(page, 'custom');
        await page.evaluate(() => {
            document.getElementById('customHue').value = 180;
            document.getElementById('customHue').dispatchEvent(new Event('input', { bubbles: true }));
            document.getElementById('customHueRange').value = 60;
            document.getElementById('customHueRange').dispatchEvent(new Event('input', { bubbles: true }));
            document.getElementById('customSat').value = 0.8;
            document.getElementById('customSat').dispatchEvent(new Event('input', { bubbles: true }));
        });
        await triggerRender(page);
        await waitForRender(page);

        const shot = await screenshotCanvas(page);
        assertCanvasNonEmpty(shot);
    });

    // ── Test: Canvas has non-uniform pixels ──
    await test('Canvas has non-uniform pixels (not solid black)', async () => {
        // Just take a screenshot after the last render (no need to wait for stillRendered)
        const shot = await screenshotCanvas(page);
        assertCanvasNonEmpty(shot);
    });

    // ── Test: Different seeds produce different renders ──
    await test('Different seeds produce different renders', async () => {
        const baseControls = {
            topology: 'flow-field', palette: 'violet-depth',
            density: 0.5, luminosity: 0.5, fracture: 0.5, depth: 0.5, coherence: 0.5,
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
        // Set FULL state including palette tweaks for reproducibility
        const fullSetup = async () => {
            await ensurePanelOpen(page);
            await ensureConfigExpanded(page);
            await scrollToElement(page, '#paletteSelector');
            await setAllControls(page, {
                seed: 'determinism-check',
                topology: 'flow-field',
                palette: 'violet-depth',
                density: 0.5, luminosity: 0.5, fracture: 0.5, depth: 0.5, coherence: 0.5,
            });
            await selectPalette(page, 'violet-depth');
            // Also set palette tweaks explicitly
            await page.evaluate(() => {
                document.getElementById('customHue').value = 135;
                document.getElementById('customHueRange').value = 53;
                document.getElementById('customSat').value = 0.55;
            });
            await triggerRender(page);
            await waitForRender(page, 3000);
        };

        await fullSetup();
        const shotA = await screenshotCanvas(page);

        // Reload and render same config
        await page.goto('http://localhost:5204', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        await fullSetup();
        const shotB = await screenshotCanvas(page);

        // Compare with generous tolerance (WebGL rendering can have minor antialiasing/timing diffs)
        const a = new Uint8Array(shotA);
        const b = new Uint8Array(shotB);
        let diffCount = 0;
        const len = Math.min(a.length, b.length);
        for (let i = 0; i < len; i++) {
            if (a[i] !== b[i]) diffCount++;
        }
        const diffPct = diffCount / len;
        // Allow up to 5% difference for WebGL rendering variability
        if (diffPct > 0.05) {
            throw new Error(`Screenshots differ by ${(diffPct * 100).toFixed(2)}% of bytes (expected <5%)`);
        }
    });

    // ── Final check: no page errors across all tests ──
    await test('No uncaught page errors across all rendering tests', async () => {
        assertNoPageErrors(errors);
    });

} finally {
    await cleanup();
}

console.log(`\nRendering: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
