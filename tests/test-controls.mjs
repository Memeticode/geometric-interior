/**
 * Controls tests: sliders, palette selection, seed, custom palette, morph cancellation.
 */
import { createTestContext, screenshotCanvas, ensurePanelOpen, ensureConfigExpanded, scrollToElement } from './helpers/browser.mjs';
import { setSlider, setSeed, setProfileName, selectPalette, setCustomPalette, readControlsFromPage } from './helpers/controls.mjs';
import { waitForRender, waitForStillRendered, sleep } from './helpers/waits.mjs';
import { assertScreenshotsDiffer, assertNoPageErrors } from './helpers/assertions.mjs';
import { clickAnyProfileCard } from './helpers/profiles.mjs';
import { SLIDER_KEYS } from './helpers/constants.mjs';

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

const { page, errors, cleanup } = await createTestContext();

try {
    await waitForStillRendered(page);

    // Ensure panel is open and config expanded for slider/palette interaction
    await ensurePanelOpen(page);
    await ensureConfigExpanded(page);

    // ── Test: Each slider change affects render output ──
    await test('Each slider change produces different render output', async () => {
        for (const key of SLIDER_KEYS) {
            // Set to baseline
            await setSlider(page, key, 0.5);
            await waitForRender(page);
            const baseline = await screenshotCanvas(page);

            // Move slider to extreme
            await setSlider(page, key, 0.95);
            await waitForRender(page);
            const changed = await screenshotCanvas(page);

            assertScreenshotsDiffer(baseline, changed);

            // Reset
            await setSlider(page, key, 0.5);
            await waitForRender(page);
        }
    });

    // ── Test: Palette chip click updates hidden input ──
    await test('Palette chip click updates hidden #palette input', async () => {
        await scrollToElement(page, '#paletteSelector');
        await selectPalette(page, 'sapphire');
        await page.waitForTimeout(200);
        const val = await page.$eval('#palette', el => el.value);
        if (val !== 'sapphire') throw new Error(`Expected palette "sapphire", got "${val}"`);
    });

    // ── Test: Palette chip sets .active class correctly ──
    await test('Palette chip click sets .active class correctly', async () => {
        await scrollToElement(page, '#paletteSelector');
        await selectPalette(page, 'warm-spectrum');
        await page.waitForTimeout(200);

        const activeChips = await page.$$eval('.pal-chip.active', els =>
            els.map(el => el.dataset.value)
        );
        if (activeChips.length !== 1) {
            throw new Error(`Expected exactly 1 active palette chip, got ${activeChips.length}`);
        }
        if (activeChips[0] !== 'warm-spectrum') {
            throw new Error(`Expected active chip "warm-spectrum", got "${activeChips[0]}"`);
        }
    });

    // ── Test: Custom palette slider labels update ──
    await test('Custom palette slider labels update on change', async () => {
        await scrollToElement(page, '#paletteSelector');
        await selectPalette(page, 'custom');
        await page.waitForTimeout(200);

        await setCustomPalette(page, { hue: 200 });
        const hueLabel = await page.$eval('#customHueLabel', el => el.textContent);
        if (hueLabel !== '200') throw new Error(`Expected hue label "200", got "${hueLabel}"`);

        await setCustomPalette(page, { sat: 0.65 });
        const satLabel = await page.$eval('#customSatLabel', el => el.textContent);
        if (satLabel !== '0.65') throw new Error(`Expected sat label "0.65", got "${satLabel}"`);
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
        // Click a portrait to start morph
        const portraitName = await page.$eval(
            '#portraitGallery .profile-card .profile-card-name',
            el => el.textContent
        );
        await clickAnyProfileCard(page, portraitName);

        // Wait a bit then change a slider mid-morph
        await sleep(300);
        await setSlider(page, 'density', 0.15);
        await sleep(200);

        // Density should be near our manual value, not the morph target
        const controls = await readControlsFromPage(page);
        if (Math.abs(controls.density - 0.15) > 0.02) {
            throw new Error(`Expected density ~0.15 after cancel, got ${controls.density}`);
        }
    });

    // ── Final: no page errors ──
    await test('No uncaught page errors', async () => {
        assertNoPageErrors(errors);
    });

} finally {
    await cleanup();
}

console.log(`\nControls: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
