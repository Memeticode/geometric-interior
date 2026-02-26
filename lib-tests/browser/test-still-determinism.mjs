/**
 * Still-frame rendering determinism tests.
 * Exercises the library's renderStill + comparePixels via window.testLib.
 */
import { MID_CONTROLS, BUILTIN_PALETTES } from './helpers/lib-context.mjs';

export async function runTests(page, errors) {
    let passed = 0, failed = 0;
    const results = [];

    async function test(name, fn) {
        try {
            await fn();
            passed++;
            results.push({ name, status: 'PASS' });
            console.log(`  PASS: ${name}`);
        } catch (err) {
            failed++;
            results.push({ name, status: 'FAIL', error: err.message });
            console.error(`  FAIL: ${name}`);
            console.error(`    ${err.message}`);
        }
    }

    console.log('\n=== Still Determinism Tests ===\n');

    await test('Same seed + controls = identical pixels', async () => {
        const result = await page.evaluate((controls) => {
            const tl = (window).testLib;
            tl.renderStill('alpha', controls);
            const snap1 = tl.getPixels();
            tl.renderStill('alpha', controls);
            const snap2 = tl.getPixels();
            return tl.comparePixels(snap1, snap2);
        }, MID_CONTROLS);
        if (!result.match) throw new Error(`pixels differ: ${result.diffPercent.toFixed(2)}% (${result.diffPixels} pixels)`);
    });

    await test('Different seeds = different pixels', async () => {
        const result = await page.evaluate((controls) => {
            const tl = (window).testLib;
            tl.renderStill('alpha', controls);
            const snap1 = tl.getPixels();
            tl.renderStill('beta', controls);
            const snap2 = tl.getPixels();
            return tl.comparePixels(snap1, snap2);
        }, MID_CONTROLS);
        if (result.diffPercent < 1) throw new Error(`seeds too similar: only ${result.diffPercent.toFixed(2)}% diff`);
    });

    for (const palette of BUILTIN_PALETTES) {
        await test(`Determinism: ${palette}`, async () => {
            const controls = { ...MID_CONTROLS, palette };
            const result = await page.evaluate(({ seed, ctrl }) => {
                const tl = (window).testLib;
                tl.resetPalette(ctrl.palette);
                tl.renderStill(seed, ctrl);
                const snap1 = tl.getPixels();
                tl.renderStill(seed, ctrl);
                const snap2 = tl.getPixels();
                return tl.comparePixels(snap1, snap2);
            }, { seed: 'det-test', ctrl: controls });
            if (!result.match) throw new Error(`${palette}: ${result.diffPercent.toFixed(2)}% diff`);
        });
    }

    await test('Determinism at all-zero controls', async () => {
        const controls = { ...MID_CONTROLS, density: 0, luminosity: 0, fracture: 0, depth: 0, coherence: 0 };
        const result = await page.evaluate((ctrl) => {
            const tl = (window).testLib;
            tl.renderStill('zero-test', ctrl);
            const snap1 = tl.getPixels();
            tl.renderStill('zero-test', ctrl);
            const snap2 = tl.getPixels();
            return tl.comparePixels(snap1, snap2);
        }, controls);
        if (!result.match) throw new Error(`all-zero: ${result.diffPercent.toFixed(2)}% diff`);
    });

    await test('Determinism at all-one controls', async () => {
        const controls = { ...MID_CONTROLS, density: 1, luminosity: 1, fracture: 1, depth: 1, coherence: 1 };
        const result = await page.evaluate((ctrl) => {
            const tl = (window).testLib;
            tl.renderStill('one-test', ctrl);
            const snap1 = tl.getPixels();
            tl.renderStill('one-test', ctrl);
            const snap2 = tl.getPixels();
            return tl.comparePixels(snap1, snap2);
        }, controls);
        if (!result.match) throw new Error(`all-one: ${result.diffPercent.toFixed(2)}% diff`);
    });

    await test('No page errors', async () => {
        if (errors.length > 0) throw new Error(`page errors: ${errors.join('; ')}`);
    });

    return { passed, failed };
}
