/**
 * History navigation tests: back/forward, boundary disabling, state preservation.
 */
import { fileURLToPath } from 'url';
import path from 'path';
import { ensurePanelOpen, ensureConfigExpanded } from './helpers/browser.mjs';
import { readControlsFromPage, readSeed } from './helpers/controls.mjs';
import { waitForStillRendered, waitForMorphComplete, sleep } from './helpers/waits.mjs';
import { assertDisabled, assertEnabled, assertNoPageErrors } from './helpers/assertions.mjs';
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

    console.log('\n=== History Tests ===\n');

    await waitForStillRendered(page);
    await ensurePanelOpen(page);
    await ensureConfigExpanded(page);

    // ── Test: Back button disabled initially ──
    await test('Back button is disabled initially', async () => {
        await assertDisabled(page, '#historyBackBtn');
    });

    // ── Test: Forward button disabled initially ──
    await test('Forward button is disabled initially', async () => {
        await assertDisabled(page, '#historyForwardBtn');
    });

    const initialSeed = await readSeed(page);

    // ── Test: Profile click creates history entry ──
    await test('Profile click creates history entry (back becomes enabled)', async () => {
        const portraitName = await page.$eval(
            '#portraitGallery .profile-card .profile-card-name',
            el => el.textContent
        );
        await clickProfileAndDismiss(portraitName);
        await waitForMorphComplete(page);

        await assertEnabled(page, '#historyBackBtn');
    });

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
        await page.evaluate(() => document.getElementById('historyBackBtn').click());
        await waitForMorphComplete(page);

        await assertDisabled(page, '#historyBackBtn');
        await assertEnabled(page, '#historyForwardBtn');

        await page.evaluate(() => document.getElementById('historyForwardBtn').click());
        await waitForMorphComplete(page);

        await assertDisabled(page, '#historyForwardBtn');
        await assertEnabled(page, '#historyBackBtn');
    });

    // ── Test: History preserves controls through round-trip ──
    await test('History preserves seed and controls', async () => {
        const portraits = await page.$$eval(
            '#portraitGallery .profile-card .profile-card-name',
            els => els.map(el => el.textContent)
        );
        if (portraits.length > 1) {
            await clickProfileAndDismiss(portraits[1]);
            await waitForMorphComplete(page);
        }

        const seedBefore = await readSeed(page);
        const controlsBefore = await readControlsFromPage(page);

        if (portraits.length > 2) {
            await clickProfileAndDismiss(portraits[2]);
        } else if (portraits.length > 0) {
            await clickProfileAndDismiss(portraits[0]);
        }
        await waitForMorphComplete(page);

        await page.evaluate(() => document.getElementById('historyBackBtn').click());
        await waitForMorphComplete(page);

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
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => document.getElementById('configRandomizeBtn').click());
            await sleep(300);
            await dismissConfirm('discard');
            await waitForMorphComplete(page);
        }

        await assertEnabled(page, '#historyBackBtn');
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
        console.log(`\nHistory: ${r.passed} passed, ${r.failed} failed\n`);
        process.exit(r.failed > 0 ? 1 : 0);
    } finally {
        await cleanup();
    }
}
