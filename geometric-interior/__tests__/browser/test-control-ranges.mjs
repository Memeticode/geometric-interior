/**
 * Control range tests.
 * Verifies slider sweeps render non-empty and produce distinct output.
 */
import { MID_CONTROLS } from './helpers/lib-context.mjs';

const SLIDER_KEYS = ['density', 'luminosity', 'fracture', 'depth', 'coherence'];
const SWEEP_VALUES = [0, 0.25, 0.5, 0.75, 1.0];

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

    console.log('\n=== Control Range Tests ===\n');

    for (const key of SLIDER_KEYS) {
        await test(`Sweep ${key} 0→1: all renders non-empty`, async () => {
            const allNonEmpty = await page.evaluate(({ baseCtrl, sliderKey, values }) => {
                const tl = (window).testLib;
                for (const v of values) {
                    const ctrl = { ...baseCtrl, [sliderKey]: v };
                    tl.renderStill('sweep-test', ctrl);
                    const px = tl.getPixels();
                    let varied = false;
                    const first = [px.data[0], px.data[1], px.data[2]];
                    for (let i = 4; i < px.data.length; i += 4) {
                        if (px.data[i] !== first[0] || px.data[i + 1] !== first[1] || px.data[i + 2] !== first[2]) {
                            varied = true;
                            break;
                        }
                    }
                    if (!varied) return { ok: false, value: v };
                }
                return { ok: true };
            }, { baseCtrl: MID_CONTROLS, sliderKey: key, values: SWEEP_VALUES });
            if (!allNonEmpty.ok) throw new Error(`${key}=${allNonEmpty.value}: canvas is uniform`);
        });
    }

    for (const key of SLIDER_KEYS) {
        await test(`Changing ${key} changes the render`, async () => {
            const result = await page.evaluate(({ baseCtrl, sliderKey }) => {
                const tl = (window).testLib;
                const ctrlA = { ...baseCtrl, [sliderKey]: 0.2 };
                const ctrlB = { ...baseCtrl, [sliderKey]: 0.8 };
                tl.renderStill('change-test', ctrlA);
                const snap1 = tl.getPixels();
                tl.renderStill('change-test', ctrlB);
                const snap2 = tl.getPixels();
                return tl.comparePixels(snap1, snap2);
            }, { baseCtrl: MID_CONTROLS, sliderKey: key });
            if (result.diffPercent < 0.5) throw new Error(`${key}: only ${result.diffPercent.toFixed(2)}% diff`);
        });
    }

    await test('Extreme combos render without errors', async () => {
        const combos = [
            { ...MID_CONTROLS, density: 0, luminosity: 0, fracture: 0, depth: 0, coherence: 0 },
            { ...MID_CONTROLS, density: 1, luminosity: 1, fracture: 1, depth: 1, coherence: 1 },
            { ...MID_CONTROLS, density: 0, luminosity: 1, fracture: 0, depth: 1, coherence: 0 },
            { ...MID_CONTROLS, density: 1, luminosity: 0, fracture: 1, depth: 0, coherence: 1 },
        ];
        const ok = await page.evaluate((comboList) => {
            const tl = (window).testLib;
            for (const ctrl of comboList) {
                tl.renderStill('extreme-test', ctrl);
            }
            return true;
        }, combos);
        if (!ok) throw new Error('extreme combo rendering failed');
    });

    await test('No page errors', async () => {
        if (errors.length > 0) throw new Error(`page errors: ${errors.join('; ')}`);
    });

    return { passed, failed };
}
