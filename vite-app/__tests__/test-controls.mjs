/**
 * Controls tests: sliders, seed, morph cancellation.
 */
import { fileURLToPath } from 'url';
import path from 'path';
import { screenshotCanvas, ensurePanelOpen, ensureConfigExpanded, scrollToElement } from './helpers/browser.mjs';
import { setSlider, setSeed, setProfileName, readControlsFromPage } from './helpers/controls.mjs';
import { waitForRender, waitForStillRendered, sleep } from './helpers/waits.mjs';
import { assertScreenshotsDiffer, assertNoPageErrors } from './helpers/assertions.mjs';
import { clickAnyProfileCard } from './helpers/profiles.mjs';
import { SLIDER_KEYS } from './helpers/constants.mjs';

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

    console.log('\n=== Controls Tests ===\n');

    await waitForStillRendered(page);
    await ensurePanelOpen(page);
    await ensureConfigExpanded(page);

    // ── Test: Each slider change affects render output ──
    await test('Each slider change produces different render output', async () => {
        for (const key of SLIDER_KEYS) {
            await setSlider(page, key, 0.5);
            await waitForRender(page);
            const baseline = await screenshotCanvas(page);

            await setSlider(page, key, 0.95);
            await waitForRender(page);
            const changed = await screenshotCanvas(page);

            assertScreenshotsDiffer(baseline, changed);

            await setSlider(page, key, 0.5);
            await waitForRender(page);
        }
    });

    // ── Test: Seed change triggers re-render ──
    await test('Seed change triggers re-render', async () => {
        await setSeed(page, 'seed-before');
        await waitForRender(page, 2500);
        const before = await screenshotCanvas(page);

        await setSeed(page, 'seed-after-change');
        await waitForRender(page, 2500);
        const after = await screenshotCanvas(page);

        assertScreenshotsDiffer(before, after);
    });

    // ── Test: Profile name field is editable ──
    await test('Profile name field is editable and retains value', async () => {
        await setProfileName(page, 'My Test Profile');
        const val = await page.$eval('#profileNameField', el => el.value);
        if (val !== 'My Test Profile') {
            throw new Error(`Expected profile name "My Test Profile", got "${val}"`);
        }
    });

    // ── Test: Slider change cancels active morph ──
    await test('Slider change cancels active morph', async () => {
        const portraitName = await page.$eval(
            '#portraitGallery .profile-card .profile-card-name',
            el => el.textContent
        );
        await clickAnyProfileCard(page, portraitName);

        await sleep(300);
        await setSlider(page, 'density', 0.15);
        await sleep(200);

        const controls = await readControlsFromPage(page);
        if (Math.abs(controls.density - 0.15) > 0.02) {
            throw new Error(`Expected density ~0.15 after cancel, got ${controls.density}`);
        }
    });

    // ── Final: no page errors ──
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
        console.log(`\nControls: ${r.passed} passed, ${r.failed} failed\n`);
        process.exit(r.failed > 0 ? 1 : 0);
    } finally {
        await cleanup();
    }
}
