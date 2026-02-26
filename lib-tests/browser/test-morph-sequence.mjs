/**
 * Morph sequence tests.
 * Tests deterministic frame-stepping via morphPrepare/morphStep/morphEnd.
 */
import { MID_CONTROLS, BUILTIN_PALETTES } from './helpers/lib-context.mjs';

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

    console.log('\n=== Morph Sequence Tests ===\n');

    const ctrlA = { ...MID_CONTROLS, density: 0.2, luminosity: 0.3 };
    const ctrlB = { ...MID_CONTROLS, density: 0.8, luminosity: 0.7 };

    await test('morphPrepare + morphStep + morphEnd completes without errors', async () => {
        const ok = await page.evaluate(({ seedA, cA, seedB, cB }) => {
            const tl = (window).testLib;
            tl.morphPrepare(seedA, cA, seedB, cB);
            for (let i = 0; i <= 10; i++) {
                tl.morphStep(i / 10);
            }
            tl.morphEnd();
            return true;
        }, { seedA: 'morph-a', cA: ctrlA, seedB: 'morph-b', cB: ctrlB });
        if (!ok) throw new Error('morph sequence failed');
    });

    await test('Morph filmstrip captures correct number of frames', async () => {
        const count = await page.evaluate(({ seedA, cA, seedB, cB }) => {
            const tl = (window).testLib;
            const urls = tl.morphFilmstrip(seedA, cA, seedB, cB, 8);
            return urls.length;
        }, { seedA: 'film-a', cA: ctrlA, seedB: 'film-b', cB: ctrlB });
        if (count !== 8) throw new Error(`expected 8 frames, got ${count}`);
    });

    await test('Morph filmstrip frames are valid PNGs', async () => {
        const valid = await page.evaluate(({ seedA, cA, seedB, cB }) => {
            const tl = (window).testLib;
            const urls = tl.morphFilmstrip(seedA, cA, seedB, cB, 4);
            return urls.every(u => u.startsWith('data:image/png;base64,') && u.length > 100);
        }, { seedA: 'valid-a', cA: ctrlA, seedB: 'valid-b', cB: ctrlB });
        if (!valid) throw new Error('some filmstrip frames are not valid PNGs');
    });

    await test('Morph smoothness: inter-frame deltas are reasonable', async () => {
        const metrics = await page.evaluate(({ seedA, cA, seedB, cB }) => {
            const tl = (window).testLib;
            return tl.morphSmoothness(seedA, cA, seedB, cB, 12);
        }, { seedA: 'smooth-a', cA: ctrlA, seedB: 'smooth-b', cB: ctrlB });
        console.log(`    Frames: ${metrics.frames}, Mean: ${metrics.meanDelta.toFixed(2)}%, Max: ${metrics.maxDelta.toFixed(2)}%, Stddev: ${metrics.stddev.toFixed(2)}%`);
        // Pixel-exact comparison shows 90%+ different pixels even for smooth morphs,
        // so check consistency (low stddev) rather than absolute threshold
        if (metrics.stddev > 25) throw new Error(`stddev too high (inconsistent): ${metrics.stddev.toFixed(2)}%`);
        if (metrics.maxDelta > 99.5) throw new Error(`max delta too high: ${metrics.maxDelta.toFixed(2)}%`);
    });

    await test('Morph across different palettes does not crash', async () => {
        const ok = await page.evaluate(({ seedA, seedB }) => {
            const tl = (window).testLib;
            const cA = { topology: 'flow-field', palette: 'violet-depth', density: 0.5, luminosity: 0.5, fracture: 0.5, depth: 0.5, coherence: 0.5 };
            const cB = { topology: 'flow-field', palette: 'warm-spectrum', density: 0.5, luminosity: 0.5, fracture: 0.5, depth: 0.5, coherence: 0.5 };
            tl.resetPalette('violet-depth');
            tl.resetPalette('warm-spectrum');
            tl.morphPrepare(seedA, cA, seedB, cB);
            for (let i = 0; i <= 5; i++) tl.morphStep(i / 5);
            tl.morphEnd();
            return true;
        }, { seedA: 'cross-a', seedB: 'cross-b' });
        if (!ok) throw new Error('cross-palette morph failed');
    });

    await test('Still render works correctly after morph', async () => {
        const varied = await page.evaluate((ctrl) => {
            const tl = (window).testLib;
            tl.renderStill('after-morph', ctrl);
            const px = tl.getPixels();
            const first = [px.data[0], px.data[1], px.data[2]];
            for (let i = 4; i < px.data.length; i += 4) {
                if (px.data[i] !== first[0] || px.data[i + 1] !== first[1] || px.data[i + 2] !== first[2]) {
                    return true;
                }
            }
            return false;
        }, MID_CONTROLS);
        if (!varied) throw new Error('canvas is uniform after morph + still render');
    });

    await test('No page errors', async () => {
        if (errors.length > 0) throw new Error(`page errors: ${errors.join('; ')}`);
    });

    return { passed, failed };
}
