/**
 * Palette variation tests.
 * Verifies each palette renders non-empty and distinct output.
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

    console.log('\n=== Palette Variation Tests ===\n');

    for (const palette of BUILTIN_PALETTES) {
        await test(`${palette} renders non-empty canvas`, async () => {
            const nonEmpty = await page.evaluate((ctrl) => {
                const tl = (window).testLib;
                tl.resetPalette(ctrl.palette);
                tl.renderStill('palette-test', ctrl);
                const px = tl.getPixels();
                // Check not all pixels are identical (solid color)
                let varied = false;
                const first = [px.data[0], px.data[1], px.data[2]];
                for (let i = 4; i < px.data.length; i += 4) {
                    if (px.data[i] !== first[0] || px.data[i + 1] !== first[1] || px.data[i + 2] !== first[2]) {
                        varied = true;
                        break;
                    }
                }
                return varied;
            }, { ...MID_CONTROLS, palette });
            if (!nonEmpty) throw new Error(`${palette}: canvas is uniform/solid`);
        });
    }

    await test('Different palettes produce different renders', async () => {
        const result = await page.evaluate(({ seed, ctrl1, ctrl2 }) => {
            const tl = (window).testLib;
            tl.resetPalette(ctrl1.palette);
            tl.renderStill(seed, ctrl1);
            const snap1 = tl.getPixels();
            tl.resetPalette(ctrl2.palette);
            tl.renderStill(seed, ctrl2);
            const snap2 = tl.getPixels();
            return tl.comparePixels(snap1, snap2);
        }, { seed: 'pal-diff', ctrl1: { ...MID_CONTROLS, palette: 'violet-depth' }, ctrl2: { ...MID_CONTROLS, palette: 'warm-spectrum' } });
        if (result.diffPercent < 5) throw new Error(`only ${result.diffPercent.toFixed(2)}% diff between palettes`);
    });

    await test('Custom palette renders non-empty', async () => {
        const nonEmpty = await page.evaluate(({ ctrl, tweaks }) => {
            const tl = (window).testLib;
            tl.renderStill('custom-test', ctrl, tweaks);
            const px = tl.getPixels();
            let varied = false;
            const first = [px.data[0], px.data[1], px.data[2]];
            for (let i = 4; i < px.data.length; i += 4) {
                if (px.data[i] !== first[0] || px.data[i + 1] !== first[1] || px.data[i + 2] !== first[2]) {
                    varied = true;
                    break;
                }
            }
            return varied;
        }, { ctrl: { ...MID_CONTROLS, palette: 'custom' }, tweaks: { custom: { baseHue: 90, hueRange: 40, saturation: 0.8 } } });
        if (!nonEmpty) throw new Error('custom palette: canvas is uniform');
    });

    await test('Custom palette tweaks produce different results', async () => {
        const result = await page.evaluate((ctrl) => {
            const tl = (window).testLib;
            tl.renderStill('tweak-test', ctrl, { custom: { baseHue: 0, hueRange: 30, saturation: 0.6 } });
            const snap1 = tl.getPixels();
            tl.renderStill('tweak-test', ctrl, { custom: { baseHue: 180, hueRange: 30, saturation: 0.6 } });
            const snap2 = tl.getPixels();
            return tl.comparePixels(snap1, snap2);
        }, { ...MID_CONTROLS, palette: 'custom' });
        if (result.diffPercent < 1) throw new Error(`only ${result.diffPercent.toFixed(2)}% diff between hue 0 and 180`);
    });

    await test('No page errors', async () => {
        if (errors.length > 0) throw new Error(`page errors: ${errors.join('; ')}`);
    });

    return { passed, failed };
}
