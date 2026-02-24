/**
 * Profile management tests: CRUD, gallery, ordering, active indicator.
 */
import { createTestContext, ensurePanelOpen, ensureConfigExpanded, scrollToElement } from './helpers/browser.mjs';
import { setSeed, setSlider, setProfileName, readControlsFromPage } from './helpers/controls.mjs';
import { waitForStillRendered, waitForMorphComplete, sleep } from './helpers/waits.mjs';
import { assertNoPageErrors } from './helpers/assertions.mjs';
import {
    getLocalStorageProfiles, countProfileCards, getActiveProfileCardName,
    clickAnyProfileCard, deleteProfileCard, moveProfileCard, getProfileOrder,
    getProfileCardNames,
} from './helpers/profiles.mjs';

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

/**
 * Dismiss confirm modal if visible. Clicks the button matching the given value,
 * or the first button if no value specified.
 */
async function dismissConfirm(page, buttonValue = 'discard') {
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
        // Fallback: click first button
        if (buttons.length > 0) { buttons[0].click(); return true; }
        return false;
    }, buttonValue);
    if (dismissed) await sleep(400);
    return dismissed;
}

/**
 * Click a profile card and dismiss any "unsaved changes" confirm that appears.
 */
async function clickProfileAndDismiss(page, profileName) {
    await clickAnyProfileCard(page, profileName);
    await sleep(300);
    await dismissConfirm(page, 'discard');
}

/**
 * Save profile via evaluate (bypasses pointer interception from modals).
 */
async function saveProfileViaEval(page) {
    await page.evaluate(() => {
        document.getElementById('saveProfile').click();
    });
    await sleep(500);
    // Dismiss overwrite confirm if it appears
    await dismissConfirm(page, 'overwrite');
    await sleep(300);
}

console.log('\n=== Profile Tests ===\n');

const { page, errors, cleanup } = await createTestContext();

try {
    await waitForStillRendered(page);

    // Open panel and expand config for access to seed/name fields
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

        await saveProfileViaEval(page);

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
        // Change to different state via sliders
        await setSlider(page, 'density', 0.1);
        await setSlider(page, 'luminosity', 0.1);
        await sleep(500);

        // Click the saved profile card — dismiss unsaved changes confirm
        await clickProfileAndDismiss(page, 'Save Test Profile');
        await waitForMorphComplete(page, 8000);

        // Verify controls match saved values
        const controls = await readControlsFromPage(page);
        if (Math.abs(controls.density - 0.73) > 0.05) {
            throw new Error(`Expected density ~0.73, got ${controls.density}`);
        }
    });

    // ── Test: Profile card sets active indicator ──
    await test('Profile card click sets active-profile indicator', async () => {
        // Click a portrait
        const portraitName = await page.$eval(
            '#portraitGallery .profile-card .profile-card-name',
            el => el.textContent
        );
        await clickProfileAndDismiss(page, portraitName);
        await waitForMorphComplete(page, 8000);

        const activeName = await getActiveProfileCardName(page);
        if (activeName !== portraitName) {
            throw new Error(`Expected active card "${portraitName}", got "${activeName}"`);
        }

        // Verify only one active card
        const activeCount = await page.$$eval('.profile-card.active-profile', els => els.length);
        if (activeCount !== 1) {
            throw new Error(`Expected 1 active card, found ${activeCount}`);
        }
    });

    // ── Test: Save more profiles for ordering tests ──
    await test('Save additional profiles for ordering test', async () => {
        // Save profile A — unique name
        await setSeed(page, 'order-a');
        await setProfileName(page, 'Order A');
        await sleep(200);
        await saveProfileViaEval(page);

        // Save profile B — unique name
        await setSeed(page, 'order-b');
        await setProfileName(page, 'Order B');
        await setSlider(page, 'density', 0.55);
        await sleep(200);
        await saveProfileViaEval(page);

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

        // Move Order B up
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
        // First save a profile to delete — unique name
        await setSeed(page, 'delete-me-seed');
        await setProfileName(page, 'Delete Me');
        await setSlider(page, 'fracture', 0.33);
        await sleep(200);
        await saveProfileViaEval(page);

        // Verify it exists
        let profiles = await getLocalStorageProfiles(page);
        if (!profiles['Delete Me']) throw new Error('Profile "Delete Me" not saved');

        // Delete it
        await deleteProfileCard(page, 'Delete Me');
        await sleep(500);

        // Verify it's gone
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

} finally {
    await cleanup();
}

console.log(`\nProfiles: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
