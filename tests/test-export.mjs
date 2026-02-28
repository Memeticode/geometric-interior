/**
 * Export tests: JSON config export, button state, Download Visual ZIP.
 * Uses Playwright's download event to capture exported files.
 */
import { fileURLToPath } from 'url';
import path from 'path';
import { ensurePanelOpen, ensureConfigExpanded, scrollToElement, reloadPage } from './helpers/browser.mjs';
import { readControlsFromPage, readSeed, setSlider } from './helpers/controls.mjs';
import { waitForStillRendered, sleep } from './helpers/waits.mjs';
import { assertDisabled, assertEnabled, assertNoPageErrors } from './helpers/assertions.mjs';
import fs from 'fs';

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

    console.log('\n=== Export Tests ===\n');

    await ensurePanelOpen(page);
    await ensureConfigExpanded(page);

    // ── Test: Export button enabled after render ──
    await test('Export button is enabled after render completes', async () => {
        await waitForStillRendered(page);
        await scrollToElement(page, '#exportBtn');
        await assertEnabled(page, '#exportBtn');
    });

    // ── Test: Config export produces JSON file ──
    let exportedConfig = null;

    await test('Config export produces valid JSON file', async () => {
        await waitForStillRendered(page);
        await scrollToElement(page, '#exportBtn');

        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 15000 }),
            page.click('#exportBtn'),
        ]);

        const filename = download.suggestedFilename();
        if (!filename.endsWith('.json')) {
            throw new Error(`Expected .json filename, got "${filename}"`);
        }

        const dlPath = await download.path();
        const raw = fs.readFileSync(dlPath, 'utf-8');

        try {
            exportedConfig = JSON.parse(raw);
        } catch {
            throw new Error('Downloaded file is not valid JSON');
        }
    });

    // ── Test: JSON config has valid still-v2 schema ──
    await test('JSON config has valid still-v2 config schema', async () => {
        if (!exportedConfig) throw new Error('No config from previous export');

        const m = exportedConfig;
        if (m.kind !== 'still-v2') throw new Error(`Expected kind "still-v2", got "${m.kind}"`);
        if (typeof m.name !== 'string' || !m.name.trim()) throw new Error('name is empty or not a string');
        if (typeof m.intent !== 'string' || !m.intent.trim()) throw new Error('intent is empty or not a string');

        if (!m.color || typeof m.color !== 'object') throw new Error('color missing or not an object');
        for (const key of ['hue', 'spectrum', 'chroma']) {
            if (typeof m.color[key] !== 'number') throw new Error(`color.${key} not a number`);
            if (m.color[key] < 0 || m.color[key] > 1) throw new Error(`color.${key} out of range`);
        }

        if (!m.structure || typeof m.structure !== 'object') throw new Error('structure missing or not an object');
        for (const key of ['density', 'luminosity', 'fracture', 'coherence', 'scale', 'division', 'faceting', 'flow']) {
            if (typeof m.structure[key] !== 'number') throw new Error(`structure.${key} not a number`);
            if (m.structure[key] < 0 || m.structure[key] > 1) throw new Error(`structure.${key} out of range`);
        }
    });

    // ── Test: JSON config values match current UI state ──
    await test('JSON config values match current UI state', async () => {
        if (!exportedConfig) throw new Error('No config from previous export');

        const seed = await readSeed(page);
        const controls = await readControlsFromPage(page);

        if (exportedConfig.intent !== seed) {
            throw new Error(`intent: expected "${seed}", got "${exportedConfig.intent}"`);
        }

        const tol = 0.02;
        for (const key of ['density', 'luminosity', 'fracture', 'coherence', 'scale', 'division', 'faceting', 'flow']) {
            if (Math.abs(exportedConfig.structure[key] - controls[key]) > tol) {
                throw new Error(`structure.${key}: expected ~${controls[key]}, got ${exportedConfig.structure[key]}`);
            }
        }

        for (const key of ['hue', 'spectrum', 'chroma']) {
            if (Math.abs(exportedConfig.color[key] - controls[key]) > tol) {
                throw new Error(`color.${key}: expected ~${controls[key]}, got ${exportedConfig.color[key]}`);
            }
        }
    });

    // ── Test: Export button disables after slider change ──
    await test('Export button disables after slider change (stillRendered = false)', async () => {
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
        await reloadPage(page);
        await waitForStillRendered(page);

        await ensurePanelOpen(page);
        await ensureConfigExpanded(page);
        await waitForStillRendered(page);
        await scrollToElement(page, '#exportBtn');
        await assertEnabled(page, '#exportBtn');
    });

    // ── Test: Download Visual produces ZIP with correct structure ──
    let zipContents = null;

    await test('Download Visual produces ZIP with correct file structure', async () => {
        await waitForStillRendered(page);

        // Open share popover and click Download Visual
        await page.click('#shareBtn');
        await sleep(200);

        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 30000 }),
            page.click('#shareDownloadPng'),
        ]);

        const filename = download.suggestedFilename();
        if (!filename.endsWith('.zip')) {
            throw new Error(`Expected .zip filename, got "${filename}"`);
        }

        const dlPath = await download.path();
        const buf = fs.readFileSync(dlPath);

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

                let pngSignatureValid = false;
                if (pngFile) {
                    const pngBuf = await zip.file(pngFile).async('uint8array');
                    pngSignatureValid = pngBuf[0] === 0x89
                        && pngBuf[1] === 0x50
                        && pngBuf[2] === 0x4E
                        && pngBuf[3] === 0x47;
                }

                return { filenames, pngSignatureValid };
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

    // ── Test: Download Visual ZIP PNG has valid signature ──
    await test('Download Visual ZIP PNG has valid PNG signature', async () => {
        if (!zipContents) throw new Error('No zip contents');
        if (!zipContents.pngSignatureValid) {
            throw new Error('PNG signature bytes do not match 0x89504E47');
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
        console.log(`\nExport: ${r.passed} passed, ${r.failed} failed\n`);
        process.exit(r.failed > 0 ? 1 : 0);
    } finally {
        await cleanup();
    }
}
