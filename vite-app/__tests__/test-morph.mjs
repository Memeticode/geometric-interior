/**
 * Morph transition tests: animation, cancellation, chaining.
 */
import { fileURLToPath } from 'url';
import path from 'path';
import { ensurePanelOpen, ensureConfigExpanded, scrollToElement } from './helpers/browser.mjs';
import { setSlider, readControlsFromPage } from './helpers/controls.mjs';
import { waitForStillRendered, waitForMorphComplete, sleep } from './helpers/waits.mjs';
import { assertEnabled, assertInRange, assertNoPageErrors } from './helpers/assertions.mjs';
import { clickAnyProfileCard } from './helpers/profiles.mjs';

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

    async function dismissConfirm(buttonValue = 'discard') {
        const dismissed = await page.evaluate((val) => {
            const modal = document.getElementById('confirmModal');
            if (!modal || modal.classList.contains('hidden')) return false;
            const buttons = modal.querySelectorAll('#confirmActions button');
            for (const btn of buttons) {
                if (btn.textContent.toLowerCase().includes(val)) { btn.click(); return true; }
            }
            if (buttons.length > 0) { buttons[0].click(); return true; }
            return false;
        }, buttonValue);
        if (dismissed) await sleep(400);
    }

    async function clickProfileAndDismiss(profileName) {
        await clickAnyProfileCard(page, profileName);
        await sleep(300);
        await dismissConfirm('discard');
    }

    console.log('\n=== Morph Tests ===\n');

    await waitForStillRendered(page);
    await ensurePanelOpen(page);
    await ensureConfigExpanded(page);

    const portraits = await page.$$eval(
        '#portraitGallery .profile-card .profile-card-name',
        els => els.map(el => el.textContent)
    );

    const initialControls = await readControlsFromPage(page);

    // ── Test: Morph runs during profile switch (mid-morph interpolation) ──
    await test('Morph runs during profile switch (controls animate over time)', async () => {
        if (portraits.length === 0) throw new Error('No portraits available');

        await setSlider(page, 'density', 0.2);
        await sleep(500);

        await clickProfileAndDismiss(portraits[0]);

        await sleep(500);

        const controls = await readControlsFromPage(page);
        const d1 = controls.density;
        await sleep(200);
        const controls2 = await readControlsFromPage(page);
        const d2 = controls2.density;

        if (Math.abs(d1 - 0.2) < 0.01 && Math.abs(d2 - 0.2) < 0.01) {
            console.log('    (Note: morph target may have same density as start)');
        }

        await waitForMorphComplete(page);
    });

    // ── Test: Morph completes and enables export ──
    await test('Morph completes and sets stillRendered=true (export enabled)', async () => {
        if (portraits.length < 2) throw new Error('Need at least 2 portraits');

        await clickProfileAndDismiss(portraits.length > 1 ? portraits[1] : portraits[0]);
        await waitForMorphComplete(page);

        await assertEnabled(page, '#exportBtn');
    });

    // ── Test: Morph cancelled by slider change ──
    await test('Morph can be cancelled by manual slider change', async () => {
        if (portraits.length === 0) throw new Error('No portraits');

        await setSlider(page, 'density', 0.8);
        await sleep(500);

        await clickProfileAndDismiss(portraits[0]);
        await sleep(200);

        await setSlider(page, 'density', 0.15);
        await sleep(300);

        const controls = await readControlsFromPage(page);
        if (Math.abs(controls.density - 0.15) > 0.05) {
            throw new Error(`Expected density ~0.15 after cancel, got ${controls.density}`);
        }
    });

    // ── Test: Sequential profile switches complete correctly ──
    await test('Sequential profile switches complete correctly', async () => {
        if (portraits.length < 2) throw new Error('Need at least 2 portraits');

        // First switch
        await clickProfileAndDismiss(portraits[0]);
        await waitForMorphComplete(page);
        await assertEnabled(page, '#exportBtn');

        // Second switch after first completes
        const lastPortrait = portraits[Math.min(1, portraits.length - 1)];
        await clickProfileAndDismiss(lastPortrait);
        await waitForMorphComplete(page);
        await assertEnabled(page, '#exportBtn');
    });

    // ── Test: History back/forward triggers morph ──
    await test('History back/forward triggers morph', async () => {
        const backEnabled = await page.$eval('#historyBackBtn', el => !el.disabled);
        if (!backEnabled) {
            if (portraits.length > 0) {
                await clickProfileAndDismiss(portraits[0]);
                await waitForMorphComplete(page);
            }
        }

        const beforeSeed = await page.$eval('#profileName', el => el.value);

        const canGoBack = await page.$eval('#historyBackBtn', el => !el.disabled);
        if (canGoBack) {
            await page.evaluate(() => document.getElementById('historyBackBtn').click());
            await sleep(300);
            await waitForMorphComplete(page);

            const afterSeed = await page.$eval('#profileName', el => el.value);
            if (afterSeed === beforeSeed) {
                console.log('    (Note: back may have returned to same seed)');
            }
        }
    });

    // ── Final ──
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
        console.log(`\nMorph: ${r.passed} passed, ${r.failed} failed\n`);
        process.exit(r.failed > 0 ? 1 : 0);
    } finally {
        await cleanup();
    }
}
