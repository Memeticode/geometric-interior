/**
 * Canvas integrity tests.
 * Verifies basic rendering health: non-empty, resize, sequential renders.
 */
import { MID_CONTROLS } from './helpers/lib-context.mjs';

export async function runTests(page, errors) {
    let passed = 0, failed = 0;

    async function test(name, fn) {
        try {
            await fn();
            passed++;
            console.log(`  PASS: ${name}`);
        } catch (err) {
            failed++;
            console.error(`  FAIL: ${name}\n    ${err.message}`);
        }
    }

    console.log('\n=== Canvas Integrity Tests ===\n');

    await test('Canvas is non-empty after render', async () => {
        const varied = await page.evaluate((ctrl) => {
            const tl = (window).testLib;
            tl.renderStill('integrity-test', ctrl);
            const px = tl.getPixels();
            const first = [px.data[0], px.data[1], px.data[2]];
            for (let i = 4; i < px.data.length; i += 4) {
                if (px.data[i] !== first[0] || px.data[i + 1] !== first[1] || px.data[i + 2] !== first[2]) {
                    return true;
                }
            }
            return false;
        }, MID_CONTROLS);
        if (!varied) throw new Error('canvas is uniform after render');
    });

    await test('Render returns valid metadata', async () => {
        const meta = await page.evaluate((ctrl) => {
            const tl = (window).testLib;
            return tl.renderStill('meta-test', ctrl);
        }, MID_CONTROLS);
        if (!meta.meta.title || meta.meta.title.length === 0) throw new Error('empty title');
        if (typeof meta.meta.nodeCount !== 'number' || meta.meta.nodeCount < 1) throw new Error(`bad nodeCount: ${meta.meta.nodeCount}`);
        if (typeof meta.elapsedMs !== 'number' || meta.elapsedMs <= 0) throw new Error(`bad elapsedMs: ${meta.elapsedMs}`);
    });

    await test('Resize changes canvas dimensions', async () => {
        const info = await page.evaluate(() => {
            const tl = (window).testLib;
            tl.resize(400, 300);
            return tl.getInfo();
        });
        if (info.canvasWidth !== 400 || info.canvasHeight !== 300)
            throw new Error(`expected 400x300, got ${info.canvasWidth}x${info.canvasHeight}`);

        // Restore original size
        await page.evaluate(() => (window).testLib.resize(800, 520));
    });

    await test('Render after resize produces correct-size pixels', async () => {
        const result = await page.evaluate((ctrl) => {
            const tl = (window).testLib;
            tl.resize(600, 400);
            tl.renderStill('resize-test', ctrl);
            const px = tl.getPixels();
            tl.resize(800, 520); // restore
            return { width: px.width, height: px.height };
        }, MID_CONTROLS);
        if (result.width !== 600 || result.height !== 400)
            throw new Error(`expected 600x400, got ${result.width}x${result.height}`);
    });

    await test('10 sequential renders produce no errors', async () => {
        const ok = await page.evaluate((ctrl) => {
            const tl = (window).testLib;
            for (let i = 0; i < 10; i++) {
                tl.renderStill(`seq-${i}`, ctrl);
            }
            return true;
        }, MID_CONTROLS);
        if (!ok) throw new Error('sequential renders failed');
    });

    await test('getDataURL returns valid PNG data URL', async () => {
        const url = await page.evaluate((ctrl) => {
            const tl = (window).testLib;
            tl.renderStill('url-test', ctrl);
            return tl.getDataURL();
        }, MID_CONTROLS);
        if (!url.startsWith('data:image/png;base64,')) throw new Error(`bad data URL prefix: ${url.substring(0, 30)}`);
        if (url.length < 100) throw new Error(`data URL too short: ${url.length} chars`);
    });

    await test('No page errors', async () => {
        if (errors.length > 0) throw new Error(`page errors: ${errors.join('; ')}`);
    });

    return { passed, failed };
}
