/**
 * Import tests: modal behavior, JSON validation, schema checks, batch import.
 */
import { createTestContext, ensurePanelOpen, ensureConfigExpanded, scrollToElement } from './helpers/browser.mjs';
import { readControlsFromPage } from './helpers/controls.mjs';
import { waitForModalOpen, waitForModalClosed, waitForStillRendered, sleep } from './helpers/waits.mjs';
import { assertNoPageErrors } from './helpers/assertions.mjs';
import { getLocalStorageProfiles, countProfileCards } from './helpers/profiles.mjs';
import { VALID_STILL_CONFIG, BATCH_CONFIGS, INVALID_CONFIGS } from './helpers/constants.mjs';

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

async function openImport(page) {
    await ensurePanelOpen(page);
    await ensureConfigExpanded(page);
    await scrollToElement(page, '#importBtn');
    await page.click('#importBtn');
    await waitForModalOpen(page, '#importModal');
}

async function closeImport(page) {
    await page.click('#importCancelBtn');
    await sleep(300);
}

async function pasteAndImport(page, jsonStr) {
    await page.evaluate((val) => {
        document.getElementById('importJson').value = val;
    }, jsonStr);
    await page.click('#importConfirmBtn');
}

console.log('\n=== Import Tests ===\n');

const { page, errors, cleanup } = await createTestContext();

try {
    await waitForStillRendered(page);

    // Ensure panel is open and config expanded for import button access
    await ensurePanelOpen(page);
    await ensureConfigExpanded(page);

    // ── Test: Import modal opens ──
    await test('Import modal opens when #importBtn is clicked', async () => {
        await openImport(page);
        const hidden = await page.$eval('#importModal', el => el.classList.contains('hidden'));
        if (hidden) throw new Error('Import modal is still hidden after click');
        await closeImport(page);
    });

    // ── Test: Import modal closes ──
    await test('Import modal closes when cancel is clicked', async () => {
        await openImport(page);
        await closeImport(page);
        await waitForModalClosed(page, '#importModal');
    });

    // ── Test: Valid JSON imports successfully ──
    await test('Valid JSON imports successfully', async () => {
        await openImport(page);
        await pasteAndImport(page, JSON.stringify(VALID_STILL_CONFIG));
        await sleep(1000);

        // Modal should be closed
        const hidden = await page.$eval('#importModal', el => el.classList.contains('hidden'));
        if (!hidden) throw new Error('Import modal did not close after valid import');

        // Profile should be in localStorage
        const profiles = await getLocalStorageProfiles(page);
        if (!profiles[VALID_STILL_CONFIG.name]) {
            throw new Error(`Profile "${VALID_STILL_CONFIG.name}" not found in localStorage`);
        }
    });

    // ── Test: Invalid JSON shows error ──
    await test('Invalid JSON shows error', async () => {
        await openImport(page);
        await pasteAndImport(page, 'not valid json {{{');
        await sleep(300);

        const errorText = await page.$eval('#importError', el => el.textContent);
        const errorVisible = await page.$eval('#importError', el => el.style.display !== 'none');
        if (!errorVisible) throw new Error('Error not displayed');
        if (!errorText.includes('Invalid JSON')) {
            throw new Error(`Expected "Invalid JSON" in error, got: "${errorText}"`);
        }
        await closeImport(page);
    });

    // ── Test: Missing fields caught ──
    await test('Schema validation catches missing fields', async () => {
        await openImport(page);
        await pasteAndImport(page, JSON.stringify({ kind: 'still' }));
        await sleep(300);

        const errorText = await page.$eval('#importError', el => el.textContent);
        if (!errorText.toLowerCase().includes('required')) {
            throw new Error(`Expected "required" in error, got: "${errorText}"`);
        }
        await closeImport(page);
    });

    // ── Test: Wrong kind caught ──
    await test('Schema validation catches wrong kind value', async () => {
        const wrongKind = { ...VALID_STILL_CONFIG, kind: 'animation' };
        await openImport(page);
        await pasteAndImport(page, JSON.stringify(wrongKind));
        await sleep(300);

        const errorText = await page.$eval('#importError', el => el.textContent);
        if (!errorText.includes('must be "still"')) {
            throw new Error(`Expected 'must be "still"' in error, got: "${errorText}"`);
        }
        await closeImport(page);
    });

    // ── Test: Out of range values caught ──
    await test('Schema validation catches out-of-range values', async () => {
        const outOfRange = {
            ...VALID_STILL_CONFIG,
            palette: { hue: 0, range: 0, saturation: 5.0 },
        };
        await openImport(page);
        await pasteAndImport(page, JSON.stringify(outOfRange));
        await sleep(300);

        const errorText = await page.$eval('#importError', el => el.textContent);
        if (!errorText.includes('between')) {
            throw new Error(`Expected "between" in error, got: "${errorText}"`);
        }
        await closeImport(page);
    });

    // ── Test: Batch import ──
    await test('Batch import (array of 3 configs) imports all', async () => {
        await openImport(page);
        await pasteAndImport(page, JSON.stringify(BATCH_CONFIGS));
        await sleep(1000);

        // Modal should close
        const hidden = await page.$eval('#importModal', el => el.classList.contains('hidden'));
        if (!hidden) throw new Error('Modal did not close after batch import');

        // All 3 profiles should exist
        const profiles = await getLocalStorageProfiles(page);
        for (const cfg of BATCH_CONFIGS) {
            if (!profiles[cfg.name]) {
                throw new Error(`Batch profile "${cfg.name}" not found in localStorage`);
            }
        }
    });

    // ── Test: Imported profile appears in gallery ──
    await test('Imported profile appears in user gallery', async () => {
        const cardNames = await page.$$eval(
            '#userGallery .profile-card .profile-card-name',
            els => els.map(el => el.textContent)
        );
        if (!cardNames.includes(VALID_STILL_CONFIG.name)) {
            throw new Error(`Profile card "${VALID_STILL_CONFIG.name}" not found in gallery. Found: ${cardNames.join(', ')}`);
        }
    });

    // ── Test: Imported profile loads into UI ──
    await test('Last imported profile controls load into UI', async () => {
        // The last batch import profile should be loaded
        const lastBatch = BATCH_CONFIGS[BATCH_CONFIGS.length - 1];
        const controls = await readControlsFromPage(page);

        // Controls should roughly match the imported config
        if (Math.abs(controls.density - lastBatch.structure.density) > 0.05) {
            throw new Error(`Expected density ~${lastBatch.structure.density}, got ${controls.density}`);
        }
    });

    // ── Final ──
    await test('No uncaught page errors', async () => {
        assertNoPageErrors(errors);
    });

} finally {
    await cleanup();
}

console.log(`\nImport: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
