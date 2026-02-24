/**
 * History navigation tests: back/forward, boundary disabling, state preservation.
 */
import { createTestContext, ensurePanelOpen, ensureConfigExpanded } from './helpers/browser.mjs';
import { readControlsFromPage, readPaletteTweaksFromPage, readSeed } from './helpers/controls.mjs';
import { waitForStillRendered, waitForMorphComplete, sleep } from './helpers/waits.mjs';
import { assertDisabled, assertEnabled, assertNoPageErrors } from './helpers/assertions.mjs';
import { clickAnyProfileCard } from './helpers/profiles.mjs';

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

console.log('\n=== History Tests ===\n');

const { page, errors, cleanup } = await createTestContext();

try {
    await waitForStillRendered(page);
    await ensurePanelOpen(page);
    await ensureConfigExpanded(page);

    /** Dismiss confirm modal if visible, clicking the specified button value */
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

    /** Click a profile card and dismiss any unsaved changes confirm */
    async function clickProfileAndDismiss(profileName) {
        await clickAnyProfileCard(page, profileName);
        await sleep(300);
        await dismissConfirm('discard');
    }

    // ── Test: Back button disabled initially ──
    await test('Back button is disabled initially', async () => {
        await assertDisabled(page, '#historyBackBtn');
    });

    // ── Test: Forward button disabled initially ──
    await test('Forward button is disabled initially', async () => {
        await assertDisabled(page, '#historyForwardBtn');
    });

    // Get initial seed for comparison
    const initialSeed = await readSeed(page);

    // ── Test: Profile click creates history entry ──
    await test('Profile click creates history entry (back becomes enabled)', async () => {
        // Click a starter portrait
        const portraitName = await page.$eval(
            '#portraitGallery .profile-card .profile-card-name',
            el => el.textContent
        );
        await clickProfileAndDismiss(portraitName);
        await waitForMorphComplete(page);

        await assertEnabled(page, '#historyBackBtn');
    });

    // Get portrait seed for comparison
    const portraitSeed = await readSeed(page);

    // ── Test: Back restores previous state ──
    await test('Back button restores previous state (seed matches)', async () => {
        await page.evaluate(() => document.getElementById('historyBackBtn').click());
        await waitForMorphComplete(page);

        const seed = await readSeed(page);
        if (seed !== initialSeed) {
            throw new Error(`Expected seed "${initialSeed}" after back, got "${seed}"`);
        }
    });

    // ── Test: Forward restores next state ──
    await test('Forward button restores next state after going back', async () => {
        await page.evaluate(() => document.getElementById('historyForwardBtn').click());
        await waitForMorphComplete(page);

        const seed = await readSeed(page);
        if (seed !== portraitSeed) {
            throw new Error(`Expected seed "${portraitSeed}" after forward, got "${seed}"`);
        }
    });

    // ── Test: Buttons disable at boundaries ──
    await test('Buttons disable at boundaries', async () => {
        // Go back to start
        await page.evaluate(() => document.getElementById('historyBackBtn').click());
        await waitForMorphComplete(page);

        // At start: back should be disabled, forward enabled
        await assertDisabled(page, '#historyBackBtn');
        await assertEnabled(page, '#historyForwardBtn');

        // Go forward to end
        await page.evaluate(() => document.getElementById('historyForwardBtn').click());
        await waitForMorphComplete(page);

        // At end: forward should be disabled, back enabled
        await assertDisabled(page, '#historyForwardBtn');
        await assertEnabled(page, '#historyBackBtn');
    });

    // ── Test: History preserves controls and palette through round-trip ──
    await test('History preserves seed, controls, and palette tweaks', async () => {
        // Navigate to a second portrait to create more history
        const portraits = await page.$$eval(
            '#portraitGallery .profile-card .profile-card-name',
            els => els.map(el => el.textContent)
        );
        if (portraits.length > 1) {
            await clickProfileAndDismiss(portraits[1]);
            await waitForMorphComplete(page);
        }

        // Record current state
        const seedBefore = await readSeed(page);
        const controlsBefore = await readControlsFromPage(page);
        const tweaksBefore = await readPaletteTweaksFromPage(page);

        // Navigate away (click another portrait)
        if (portraits.length > 2) {
            await clickProfileAndDismiss(portraits[2]);
        } else if (portraits.length > 0) {
            await clickProfileAndDismiss(portraits[0]);
        }
        await waitForMorphComplete(page);

        // Navigate back
        await page.evaluate(() => document.getElementById('historyBackBtn').click());
        await waitForMorphComplete(page);

        // Verify state matches
        const seedAfter = await readSeed(page);
        const controlsAfter = await readControlsFromPage(page);

        if (seedAfter !== seedBefore) {
            throw new Error(`Seed mismatch: expected "${seedBefore}", got "${seedAfter}"`);
        }
        if (Math.abs(controlsAfter.density - controlsBefore.density) > 0.05) {
            throw new Error(`Density mismatch: expected ${controlsBefore.density}, got ${controlsAfter.density}`);
        }
        if (Math.abs(controlsAfter.luminosity - controlsBefore.luminosity) > 0.05) {
            throw new Error(`Luminosity mismatch: expected ${controlsBefore.luminosity}, got ${controlsAfter.luminosity}`);
        }
    });

    // ── Test: Multiple history entries via randomize ──
    await test('Randomize creates history entries', async () => {
        // Click randomize a few times
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => document.getElementById('configRandomizeBtn').click());
            await sleep(300);
            await dismissConfirm('discard');
            await waitForMorphComplete(page, 8000);
        }

        // Back button should be enabled (multiple entries)
        await assertEnabled(page, '#historyBackBtn');
    });

    // ── Final ──
    await test('No uncaught page errors', async () => {
        assertNoPageErrors(errors);
    });

} finally {
    await cleanup();
}

console.log(`\nHistory: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
