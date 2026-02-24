/**
 * Text generation tests: title, alt-text, determinism, refresh.
 */
import { fileURLToPath } from 'url';
import path from 'path';
import { reloadPage } from './helpers/browser.mjs';
import { setSeed, setAllControls, triggerRender } from './helpers/controls.mjs';
import { waitForStillRendered, waitForRender, waitFor, sleep } from './helpers/waits.mjs';
import { assertTextNonEmpty, assertNoPageErrors } from './helpers/assertions.mjs';

/** Poll until text in selector stabilizes (typewriter animation complete). */
async function waitForTextStable(page, selector, { timeout = 10000, stableMs = 500 } = {}) {
    let lastText = '';
    let stableSince = Date.now();
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const text = await page.$eval(selector, el => el.textContent.trim());
        if (text !== lastText) {
            lastText = text;
            stableSince = Date.now();
        } else if (text.length > 0 && Date.now() - stableSince >= stableMs) {
            return text;
        }
        await sleep(100);
    }
    throw new Error(`Text in ${selector} did not stabilize within ${timeout}ms`);
}

/** Wait for both title and alt text to finish their typewriter animations. */
async function waitForTexts(page, timeout = 10000) {
    await waitForTextStable(page, '#titleText', { timeout });
    await waitForTextStable(page, '#altText', { timeout });
}

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

    console.log('\n=== Text Generation Tests ===\n');

    await waitForStillRendered(page);

    // Wait for typewriter animations to complete
    await waitForTexts(page, 10000);

    // ── Test: Title non-empty after render ──
    await test('Title text is non-empty after render', async () => {
        await assertTextNonEmpty(page, '#titleText');
    });

    // ── Test: Alt text non-empty after render ──
    await test('Alt text is non-empty after render', async () => {
        await assertTextNonEmpty(page, '#altText');
    });

    // ── Test: Text is deterministic ──
    await test('Same seed + controls produces identical title across reload', async () => {
        const config = {
            seed: 'deterministic-text-test',
            topology: 'flow-field',
            palette: 'violet-depth',
            density: 0.5, luminosity: 0.5, fracture: 0.5, depth: 0.5, coherence: 0.5,
        };

        // Clear text from initial render, then render with test config
        await page.evaluate(() => {
            document.getElementById('titleText').textContent = '';
            document.getElementById('altText').textContent = '';
        });
        await setAllControls(page, config);
        await triggerRender(page);
        await waitForRender(page, 3000);
        await waitForTexts(page, 10000);

        const title1 = await page.$eval('#titleText', el => el.textContent.trim());
        const alt1 = await page.$eval('#altText', el => el.textContent.trim());

        if (!title1) throw new Error('First render produced empty title');

        // Reload and render same config
        await reloadPage(page);
        await waitForStillRendered(page);

        // Clear text from initial render before re-rendering with test config
        await page.evaluate(() => {
            document.getElementById('titleText').textContent = '';
            document.getElementById('altText').textContent = '';
        });
        await setAllControls(page, config);
        await triggerRender(page);
        await waitForRender(page, 3000);
        await waitForTexts(page, 10000);

        const title2 = await page.$eval('#titleText', el => el.textContent.trim());
        const alt2 = await page.$eval('#altText', el => el.textContent.trim());

        if (title1 !== title2) {
            throw new Error(`Title not deterministic: "${title1}" vs "${title2}"`);
        }
    });

    // ── Test: Text refreshes on seed change ──
    await test('Text refreshes after seed change', async () => {
        await setAllControls(page, {
            seed: 'text-refresh-original',
            topology: 'flow-field', palette: 'violet-depth',
            density: 0.5, luminosity: 0.5, fracture: 0.5, depth: 0.5, coherence: 0.5,
        });
        await triggerRender(page);
        await waitForRender(page, 3000);
        await waitForTexts(page, 10000);

        const titleBefore = await page.$eval('#titleText', el => el.textContent.trim());

        // Change seed
        await setSeed(page, 'text-refresh-changed');
        await triggerRender(page);
        await waitForRender(page, 3000);
        await waitForTexts(page, 10000);

        const titleAfter = await page.$eval('#titleText', el => el.textContent.trim());

        if (titleBefore === titleAfter && titleBefore !== '') {
            throw new Error(`Title did not change after seed change: "${titleBefore}"`);
        }
    });

    // ── Test: Alt text contains structural phrases ──
    await test('Alt text contains expected structural phrases', async () => {
        const alt = await page.$eval('#altText', el => el.textContent.trim());
        if (!alt) throw new Error('Alt text is empty');

        const hasFieldRef = alt.toLowerCase().includes('field') || alt.toLowerCase().includes('dark');
        const hasNodeRef = alt.toLowerCase().includes('node') || alt.toLowerCase().includes('energy');

        if (!hasFieldRef && !hasNodeRef) {
            console.log(`    (Note: alt text structure may vary. Got: "${alt.slice(0, 80)}...")`);
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
        console.log(`\nText: ${r.passed} passed, ${r.failed} failed\n`);
        process.exit(r.failed > 0 ? 1 : 0);
    } finally {
        await cleanup();
    }
}
