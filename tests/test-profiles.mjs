/**
 * Profile management tests: CRUD, gallery, ordering, active indicator.
 */
import { fileURLToPath } from 'url';
import path from 'path';
import { ensurePanelOpen, ensureConfigExpanded, scrollToElement } from './helpers/browser.mjs';
import { setSeed, setSlider, setProfileName, readControlsFromPage } from './helpers/controls.mjs';
import { waitForStillRendered, waitForMorphComplete, sleep } from './helpers/waits.mjs';
import { assertNoPageErrors } from './helpers/assertions.mjs';
import {
    getLocalStorageProfiles, countProfileCards, getActiveProfileCardName,
    clickAnyProfileCard, deleteProfileCard, moveProfileCard, getProfileOrder,
    getProfileCardNames,
} from './helpers/profiles.mjs';

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
                if (btn.textContent.toLowerCase().includes(val)) {
                    btn.click();
                    return true;
                }
            }
            if (buttons.length > 0) { buttons[0].click(); return true; }
            return false;
        }, buttonValue);
        if (dismissed) await sleep(400);
        return dismissed;
    }

    async function clickProfileAndDismiss(profileName) {
        await clickAnyProfileCard(page, profileName);
        await sleep(300);
        await dismissConfirm('discard');
    }

    async function saveProfileViaEval() {
        await page.evaluate(() => {
            document.getElementById('saveProfile').click();
        });
        await sleep(500);
        await dismissConfirm('overwrite');
        await sleep(300);
    }

    console.log('\n=== Profile Tests ===\n');

    await waitForStillRendered(page);
    await ensurePanelOpen(page);
    await ensureConfigExpanded(page);

    // ── Test: Starter portraits in gallery ──
    await test('Starter portraits render in portrait gallery', async () => {
        const count = await countProfileCards(page, 'portraitGallery');
        if (count < 5) {
            throw new Error(`Expected at least 5 starter portraits, found ${count}`);
        }
    });

    // ── Test: Save profile ──
    await test('Save profile persists to localStorage', async () => {
        await setSeed(page, 'save-test-seed');
        await setProfileName(page, 'Save Test Profile');
        await setSlider(page, 'density', 0.73);
        await sleep(300);

        await saveProfileViaEval();

        const profiles = await getLocalStorageProfiles(page);
        if (!profiles['Save Test Profile']) {
            throw new Error('Profile "Save Test Profile" not found in localStorage');
        }
        const saved = profiles['Save Test Profile'];
        if (saved.seed !== 'save-test-seed') {
            throw new Error(`Expected seed "save-test-seed", got "${saved.seed}"`);
        }
    });

    // ── Test: Load saved profile restores controls ──
    await test('Load saved profile restores all controls after morph', async () => {
        await setSlider(page, 'density', 0.1);
        await setSlider(page, 'luminosity', 0.1);
        await sleep(500);

        await clickProfileAndDismiss('Save Test Profile');
        await waitForMorphComplete(page);

        const controls = await readControlsFromPage(page);
        if (Math.abs(controls.density - 0.73) > 0.05) {
            throw new Error(`Expected density ~0.73, got ${controls.density}`);
        }
    });

    // ── Test: Profile card sets active indicator ──
    await test('Profile card click sets active-profile indicator', async () => {
        const portraitName = await page.$eval(
            '#portraitGallery .profile-card .profile-card-name',
            el => el.textContent
        );
        await clickProfileAndDismiss(portraitName);
        await waitForMorphComplete(page);

        const activeName = await getActiveProfileCardName(page);
        if (activeName !== portraitName) {
            throw new Error(`Expected active card "${portraitName}", got "${activeName}"`);
        }

        const activeCount = await page.$$eval('.profile-card.active-profile', els => els.length);
        if (activeCount !== 1) {
            throw new Error(`Expected 1 active card, found ${activeCount}`);
        }
    });

    // ── Test: Save more profiles for ordering tests ──
    await test('Save additional profiles for ordering test', async () => {
        await setSeed(page, 'order-a');
        await setProfileName(page, 'Order A');
        await sleep(200);
        await saveProfileViaEval();

        await setSeed(page, 'order-b');
        await setProfileName(page, 'Order B');
        await setSlider(page, 'density', 0.55);
        await sleep(200);
        await saveProfileViaEval();

        const profiles = await getLocalStorageProfiles(page);
        if (!profiles['Order A'] || !profiles['Order B']) {
            throw new Error('Failed to save Order A and Order B profiles');
        }
    });

    // ── Test: Move profile reorders ──
    await test('Move up/down reorders profiles in storage', async () => {
        const orderBefore = await getProfileOrder(page);
        const idxA = orderBefore.indexOf('Order A');
        const idxB = orderBefore.indexOf('Order B');

        if (idxA < 0 || idxB < 0) {
            throw new Error(`Order A or Order B not found in profile order: ${orderBefore.join(', ')}`);
        }

        await moveProfileCard(page, 'Order B', 'up');
        await sleep(300);

        const orderAfter = await getProfileOrder(page);
        const newIdxB = orderAfter.indexOf('Order B');
        if (newIdxB >= idxB) {
            throw new Error(`Order B did not move up (was ${idxB}, now ${newIdxB})`);
        }
    });

    // ── Test: Active preview shows current info ──
    await test('Active preview shows current profile name and seed', async () => {
        await setSeed(page, 'preview-test-seed');
        await setProfileName(page, 'Preview Test');
        await sleep(300);

        const name = await page.$eval('#activePreviewName', el => el.textContent);
        const seed = await page.$eval('#activePreviewSeed', el => el.textContent);

        if (name !== 'Preview Test') {
            throw new Error(`Expected active preview name "Preview Test", got "${name}"`);
        }
        if (seed !== 'preview-test-seed') {
            throw new Error(`Expected active preview seed "preview-test-seed", got "${seed}"`);
        }
    });

    // ── Test: Delete profile ──
    await test('Delete profile removes from localStorage and gallery', async () => {
        await setSeed(page, 'delete-me-seed');
        await setProfileName(page, 'Delete Me');
        await setSlider(page, 'fracture', 0.33);
        await sleep(200);
        await saveProfileViaEval();

        let profiles = await getLocalStorageProfiles(page);
        if (!profiles['Delete Me']) throw new Error('Profile "Delete Me" not saved');

        await deleteProfileCard(page, 'Delete Me');
        await sleep(500);

        profiles = await getLocalStorageProfiles(page);
        if (profiles['Delete Me']) {
            throw new Error('Profile "Delete Me" still exists after deletion');
        }

        const cardNames = await getProfileCardNames(page, 'userGallery');
        if (cardNames.includes('Delete Me')) {
            throw new Error('Profile card "Delete Me" still visible after deletion');
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
        console.log(`\nProfiles: ${r.passed} passed, ${r.failed} failed\n`);
        process.exit(r.failed > 0 ? 1 : 0);
    } finally {
        await cleanup();
    }
}
