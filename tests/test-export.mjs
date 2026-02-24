/**
 * Export tests: button state, ZIP structure, metadata validation, PNG integrity.
 * Uses Playwright's download event to capture the actual exported ZIP.
 */
import { createTestContext, ensurePanelOpen, ensureConfigExpanded, scrollToElement } from './helpers/browser.mjs';
import { setSlider } from './helpers/controls.mjs';
import { waitForStillRendered } from './helpers/waits.mjs';
import { assertDisabled, assertEnabled, assertNoPageErrors } from './helpers/assertions.mjs';
import fs from 'fs';

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

console.log('\n=== Export Tests ===\n');

const { page, errors, cleanup } = await createTestContext();

try {
    // Open panel and expand config so export button is accessible
    await ensurePanelOpen(page);
    await ensureConfigExpanded(page);

    // ── Test: Export button enabled after render ──
    await test('Export button is enabled after render completes', async () => {
        await waitForStillRendered(page);
        await scrollToElement(page, '#exportBtn');
        await assertEnabled(page, '#exportBtn');
    });

    // ── Test: Export produces ZIP with correct structure ──
    let zipContents = null;

    await test('Export produces ZIP with correct file structure', async () => {
        await waitForStillRendered(page);
        await scrollToElement(page, '#exportBtn');

        // Use Playwright download event to capture the ZIP
        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 15000 }),
            page.click('#exportBtn'),
        ]);

        // Save to temp and parse in-browser using JSZip
        const path = await download.path();
        const buf = fs.readFileSync(path);

        // Send the buffer to the page for JSZip parsing
        zipContents = await page.evaluate(async (base64) => {
            const JSZip = window.JSZip;
            if (!JSZip) return { error: 'JSZip not loaded' };

            try {
                const binary = atob(base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

                const zip = await JSZip.loadAsync(bytes);
                const filenames = Object.keys(zip.files);

                const metaFile = filenames.find(f => f.endsWith('metadata.json'));
                const titleFile = filenames.find(f => f.endsWith('title.txt'));
                const altFile = filenames.find(f => f.endsWith('alt-text.txt'));
                const pngFile = filenames.find(f => f.endsWith('image.png'));

                const metadata = metaFile
                    ? JSON.parse(await zip.file(metaFile).async('string'))
                    : null;
                const titleTxt = titleFile
                    ? await zip.file(titleFile).async('string')
                    : null;
                const altTxt = altFile
                    ? await zip.file(altFile).async('string')
                    : null;

                let pngSignatureValid = false;
                if (pngFile) {
                    const pngBuf = await zip.file(pngFile).async('uint8array');
                    pngSignatureValid = pngBuf[0] === 0x89
                        && pngBuf[1] === 0x50
                        && pngBuf[2] === 0x4E
                        && pngBuf[3] === 0x47;
                }

                return { filenames, metadata, titleTxt, altTxt, pngSignatureValid };
            } catch (err) {
                return { error: err.message };
            }
        }, buf.toString('base64'));

        if (!zipContents) throw new Error('No export captured');
        if (zipContents.error) throw new Error(`ZIP parse error: ${zipContents.error}`);

        const fns = zipContents.filenames;
        if (!fns.some(f => f.endsWith('image.png'))) throw new Error('ZIP missing image.png');
        if (!fns.some(f => f.endsWith('title.txt'))) throw new Error('ZIP missing title.txt');
        if (!fns.some(f => f.endsWith('alt-text.txt'))) throw new Error('ZIP missing alt-text.txt');
        if (!fns.some(f => f.endsWith('metadata.json'))) throw new Error('ZIP missing metadata.json');
    });

    // ── Test: metadata.json has valid schema ──
    await test('metadata.json has valid still config schema', async () => {
        if (!zipContents || !zipContents.metadata) throw new Error('No metadata from previous export');

        const m = zipContents.metadata;
        if (m.kind !== 'still') throw new Error(`Expected kind "still", got "${m.kind}"`);
        if (typeof m.name !== 'string' || !m.name.trim()) throw new Error('name is empty or not a string');
        if (typeof m.intent !== 'string' || !m.intent.trim()) throw new Error('intent is empty or not a string');

        if (!m.palette || typeof m.palette !== 'object') throw new Error('palette missing or not an object');
        if (typeof m.palette.hue !== 'number') throw new Error('palette.hue not a number');
        if (typeof m.palette.range !== 'number') throw new Error('palette.range not a number');
        if (typeof m.palette.saturation !== 'number') throw new Error('palette.saturation not a number');

        if (!m.structure || typeof m.structure !== 'object') throw new Error('structure missing or not an object');
        for (const key of ['density', 'luminosity', 'fracture', 'depth', 'coherence']) {
            if (typeof m.structure[key] !== 'number') throw new Error(`structure.${key} not a number`);
            if (m.structure[key] < 0 || m.structure[key] > 1) throw new Error(`structure.${key} out of range`);
        }
    });

    // ── Test: title.txt is non-empty ──
    await test('title.txt is non-empty', async () => {
        if (!zipContents) throw new Error('No zip contents');
        if (!zipContents.titleTxt || !zipContents.titleTxt.trim()) {
            throw new Error('title.txt is empty');
        }
    });

    // ── Test: alt-text.txt is non-empty ──
    await test('alt-text.txt is non-empty', async () => {
        if (!zipContents) throw new Error('No zip contents');
        if (!zipContents.altTxt || !zipContents.altTxt.trim()) {
            throw new Error('alt-text.txt is empty');
        }
    });

    // ── Test: PNG has valid signature ──
    await test('PNG blob has valid PNG signature', async () => {
        if (!zipContents) throw new Error('No zip contents');
        if (!zipContents.pngSignatureValid) {
            throw new Error('PNG signature bytes do not match 0x89504E47');
        }
    });

    // ── Test: Export button disables after slider change ──
    await test('Export button disables after slider change (stillRendered = false)', async () => {
        // Re-open panel/config in case state changed
        await ensurePanelOpen(page);
        await ensureConfigExpanded(page);
        await scrollToElement(page, '#density');
        await setSlider(page, 'density', 0.92);
        await page.waitForTimeout(500);
        await scrollToElement(page, '#exportBtn');
        await assertDisabled(page, '#exportBtn');
    });

    // ── Test: Export re-enabled after page reload (deliberate render) ──
    await test('Export re-enabled after page reload (deliberate render)', async () => {
        await page.goto('http://localhost:5204', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        await ensurePanelOpen(page);
        await ensureConfigExpanded(page);
        await waitForStillRendered(page);
        await scrollToElement(page, '#exportBtn');
        await assertEnabled(page, '#exportBtn');
    });

    // ── Final: no page errors ──
    await test('No uncaught page errors', async () => {
        assertNoPageErrors(errors);
    });

} finally {
    await cleanup();
}

console.log(`\nExport: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
