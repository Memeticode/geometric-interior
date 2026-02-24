/**
 * Import tests: modal behavior, JSON validation, schema checks, batch import.
 */
import { fileURLToPath } from 'url';
import path from 'path';
import { ensurePanelOpen, ensureConfigExpanded, scrollToElement } from './helpers/browser.mjs';
import { readControlsFromPage } from './helpers/controls.mjs';
import { waitForModalOpen, waitForModalClosed, waitForStillRendered, sleep } from './helpers/waits.mjs';
import { assertNoPageErrors } from './helpers/assertions.mjs';
import { getLocalStorageProfiles, countProfileCards } from './helpers/profiles.mjs';
import { VALID_STILL_CONFIG, BATCH_CONFIGS, INVALID_CONFIGS } from './helpers/constants.mjs';

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

    async function openImport() {
        await ensurePanelOpen(page);
        await ensureConfigExpanded(page);
        await scrollToElement(page, '#importBtn');
        await page.click('#importBtn');
        await waitForModalOpen(page, '#importModal');
    }

    async function closeImport() {
        await page.click('#importCancelBtn');
        await sleep(200);
    }

    async function pasteAndImport(jsonStr) {
        await page.evaluate((val) => {
            document.getElementById('importJson').value = val;
        }, jsonStr);
        await page.click('#importConfirmBtn');
    }

    console.log('\n=== Import Tests ===\n');

    await waitForStillRendered(page);
    await ensurePanelOpen(page);
    await ensureConfigExpanded(page);

    // ── Test: Import modal opens ──
    await test('Import modal opens when #importBtn is clicked', async () => {
        await openImport();
        const hidden = await page.$eval('#importModal', el => el.classList.contains('hidden'));
        if (hidden) throw new Error('Import modal is still hidden after click');
        await closeImport();
    });

    // ── Test: Import modal closes ──
    await test('Import modal closes when cancel is clicked', async () => {
        await openImport();
        await closeImport();
        await waitForModalClosed(page, '#importModal');
    });

    // ── Test: Valid JSON imports successfully ──
    await test('Valid JSON imports successfully', async () => {
        await openImport();
        await pasteAndImport(JSON.stringify(VALID_STILL_CONFIG));
        await sleep(500);

        const hidden = await page.$eval('#importModal', el => el.classList.contains('hidden'));
        if (!hidden) throw new Error('Import modal did not close after valid import');

        const profiles = await getLocalStorageProfiles(page);
        if (!profiles[VALID_STILL_CONFIG.name]) {
            throw new Error(`Profile "${VALID_STILL_CONFIG.name}" not found in localStorage`);
        }
    });

    // ── Test: Invalid JSON shows error ──
    await test('Invalid JSON shows error', async () => {
        await openImport();
        await pasteAndImport('not valid json {{{');
        await sleep(200);

        const errorText = await page.$eval('#importError', el => el.textContent);
        const errorVisible = await page.$eval('#importError', el => el.style.display !== 'none');
        if (!errorVisible) throw new Error('Error not displayed');
        if (!errorText.includes('Invalid JSON')) {
            throw new Error(`Expected "Invalid JSON" in error, got: "${errorText}"`);
        }
        await closeImport();
    });

    // ── Test: Missing fields caught ──
    await test('Schema validation catches missing fields', async () => {
        await openImport();
        await pasteAndImport(JSON.stringify({ kind: 'still' }));
        await sleep(200);

        const errorText = await page.$eval('#importError', el => el.textContent);
        if (!errorText.toLowerCase().includes('required')) {
            throw new Error(`Expected "required" in error, got: "${errorText}"`);
        }
        await closeImport();
    });

    // ── Test: Wrong kind caught ──
    await test('Schema validation catches wrong kind value', async () => {
        const wrongKind = { ...VALID_STILL_CONFIG, kind: 'animation' };
        await openImport();
        await pasteAndImport(JSON.stringify(wrongKind));
        await sleep(200);

        const errorText = await page.$eval('#importError', el => el.textContent);
        if (!errorText.includes('must be "still"')) {
            throw new Error(`Expected 'must be "still"' in error, got: "${errorText}"`);
        }
        await closeImport();
    });

    // ── Test: Out of range values caught ──
    await test('Schema validation catches out-of-range values', async () => {
        const outOfRange = {
            ...VALID_STILL_CONFIG,
            palette: { hue: 0, range: 0, saturation: 5.0 },
        };
        await openImport();
        await pasteAndImport(JSON.stringify(outOfRange));
        await sleep(200);

        const errorText = await page.$eval('#importError', el => el.textContent);
        if (!errorText.includes('between')) {
            throw new Error(`Expected "between" in error, got: "${errorText}"`);
        }
        await closeImport();
    });

    // ── Test: Batch import ──
    await test('Batch import (array of 3 configs) imports all', async () => {
        await openImport();
        await pasteAndImport(JSON.stringify(BATCH_CONFIGS));
        await sleep(500);

        const hidden = await page.$eval('#importModal', el => el.classList.contains('hidden'));
        if (!hidden) throw new Error('Modal did not close after batch import');

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
        const lastBatch = BATCH_CONFIGS[BATCH_CONFIGS.length - 1];
        const controls = await readControlsFromPage(page);

        if (Math.abs(controls.density - lastBatch.structure.density) > 0.05) {
            throw new Error(`Expected density ~${lastBatch.structure.density}, got ${controls.density}`);
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
        console.log(`\nImport: ${r.passed} passed, ${r.failed} failed\n`);
        process.exit(r.failed > 0 ? 1 : 0);
    } finally {
        await cleanup();
    }
}
