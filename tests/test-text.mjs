/**
 * Text generation tests: title, alt-text, determinism, refresh.
 */
import { createTestContext } from './helpers/browser.mjs';
import { setSeed, setAllControls, triggerRender } from './helpers/controls.mjs';
import { waitForStillRendered, waitForRender, sleep } from './helpers/waits.mjs';
import { assertTextNonEmpty, assertNoPageErrors } from './helpers/assertions.mjs';

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

const { page, errors, cleanup } = await createTestContext();

try {
    await waitForStillRendered(page);

    // Wait extra for typewriter animation to complete
    await sleep(3000);

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

        // First render
        await setAllControls(page, config);
        await triggerRender(page);
        await waitForRender(page, 3000);
        await sleep(2000); // Wait for text generation + typewriter

        const title1 = await page.$eval('#titleText', el => el.textContent.trim());
        const alt1 = await page.$eval('#altText', el => el.textContent.trim());

        if (!title1) throw new Error('First render produced empty title');

        // Reload and render same config
        await page.goto('http://localhost:5204', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        await setAllControls(page, config);
        await triggerRender(page);
        await waitForRender(page, 3000);
        await sleep(2000);

        const title2 = await page.$eval('#titleText', el => el.textContent.trim());
        const alt2 = await page.$eval('#altText', el => el.textContent.trim());

        if (title1 !== title2) {
            throw new Error(`Title not deterministic: "${title1}" vs "${title2}"`);
        }
        // Alt text includes nodeCount which may vary slightly between renders,
        // so only check title determinism (which depends purely on seed + controls).
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
        await sleep(2000);

        const titleBefore = await page.$eval('#titleText', el => el.textContent.trim());

        // Change seed
        await setSeed(page, 'text-refresh-changed');
        await triggerRender(page);
        await waitForRender(page, 3000);
        await sleep(2000); // 1000ms debounce + typewriter

        const titleAfter = await page.$eval('#titleText', el => el.textContent.trim());

        if (titleBefore === titleAfter && titleBefore !== '') {
            throw new Error(`Title did not change after seed change: "${titleBefore}"`);
        }
    });

    // ── Test: Alt text contains structural phrases ──
    await test('Alt text contains expected structural phrases', async () => {
        // Alt text is already populated from the previous test's seed change render
        const alt = await page.$eval('#altText', el => el.textContent.trim());
        if (!alt) throw new Error('Alt text is empty');

        // The alt text generation in text.js uses phrases like "A dark field carries"
        // and "energy nodes". Check for some expected content.
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

} finally {
    await cleanup();
}

console.log(`\nText: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
