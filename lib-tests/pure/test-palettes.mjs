/**
 * Tests for palette data and color utility functions.
 */
import { PALETTES, PRESETS, hslToRgb01 } from '../../dist/lib/geometric-interior.js';

let passed = 0, failed = 0;

function test(name, fn) {
    try { fn(); passed++; console.log(`  PASS: ${name}`); }
    catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${e.message}`); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertClose(a, b, eps = 1e-6, msg) {
    if (Math.abs(a - b) > eps) throw new Error(msg || `expected ${a} close to ${b}`);
}

console.log('\n=== Palette Tests ===\n');

test('PALETTES is a non-empty object', () => {
    assert(typeof PALETTES === 'object' && PALETTES !== null, 'PALETTES not an object');
    const keys = Object.keys(PALETTES);
    assert(keys.length > 0, 'PALETTES is empty');
});

test('PALETTES entries have expected fields', () => {
    for (const [key, pal] of Object.entries(PALETTES)) {
        assert(typeof pal.label === 'string' && pal.label.length > 0, `${key}: empty label`);
        assert(typeof pal.baseHue === 'number', `${key}: missing baseHue`);
        assert(Array.isArray(pal.fogColor) && pal.fogColor.length === 3, `${key}: bad fogColor`);
        assert(Array.isArray(pal.bgColor) && pal.bgColor.length === 3, `${key}: bad bgColor`);
        assert(Array.isArray(pal.edgeColor) && pal.edgeColor.length === 3, `${key}: bad edgeColor`);
    }
});

test('PALETTES fogColor and bgColor are near-black', () => {
    for (const [key, pal] of Object.entries(PALETTES)) {
        for (const c of pal.fogColor) {
            assert(c < 0.05, `${key} fogColor too bright: ${c}`);
        }
        for (const c of pal.bgColor) {
            assert(c < 0.05, `${key} bgColor too bright: ${c}`);
        }
    }
});

test('PRESETS is a non-empty object', () => {
    assert(typeof PRESETS === 'object' && PRESETS !== null, 'PRESETS not an object');
    const keys = Object.keys(PRESETS);
    assert(keys.length > 0, 'PRESETS is empty');
});

test('PRESETS entries have hue, spectrum, chroma in [0, 1]', () => {
    for (const [key, preset] of Object.entries(PRESETS)) {
        assert(typeof preset.hue === 'number' && preset.hue >= 0 && preset.hue <= 1,
            `${key}: hue out of range: ${preset.hue}`);
        assert(typeof preset.spectrum === 'number' && preset.spectrum >= 0 && preset.spectrum <= 1,
            `${key}: spectrum out of range: ${preset.spectrum}`);
        assert(typeof preset.chroma === 'number' && preset.chroma >= 0 && preset.chroma <= 1,
            `${key}: chroma out of range: ${preset.chroma}`);
    }
});

test('hslToRgb01 pure red (0, 1, 0.5)', () => {
    const [r, g, b] = hslToRgb01(0, 1, 0.5);
    assertClose(r, 1.0, 0.01);
    assertClose(g, 0.0, 0.01);
    assertClose(b, 0.0, 0.01);
});

test('hslToRgb01 pure green (120, 1, 0.5)', () => {
    const [r, g, b] = hslToRgb01(120, 1, 0.5);
    assertClose(r, 0.0, 0.01);
    assertClose(g, 1.0, 0.01);
    assertClose(b, 0.0, 0.01);
});

test('hslToRgb01 pure blue (240, 1, 0.5)', () => {
    const [r, g, b] = hslToRgb01(240, 1, 0.5);
    assertClose(r, 0.0, 0.01);
    assertClose(g, 0.0, 0.01);
    assertClose(b, 1.0, 0.01);
});

test('hslToRgb01 white (0, 0, 1)', () => {
    const [r, g, b] = hslToRgb01(0, 0, 1);
    assertClose(r, 1.0, 0.01);
    assertClose(g, 1.0, 0.01);
    assertClose(b, 1.0, 0.01);
});

test('hslToRgb01 black (0, 0, 0)', () => {
    const [r, g, b] = hslToRgb01(0, 0, 0);
    assertClose(r, 0.0, 0.01);
    assertClose(g, 0.0, 0.01);
    assertClose(b, 0.0, 0.01);
});

test('hslToRgb01 returns values in [0, 1]', () => {
    const testCases = [
        [0, 1, 0.5], [120, 0.5, 0.3], [240, 0.8, 0.9], [300, 0, 0.5], [60, 1, 0.25],
    ];
    for (const [h, s, l] of testCases) {
        const [r, g, b] = hslToRgb01(h, s, l);
        assert(r >= 0 && r <= 1, `r out of range for (${h},${s},${l}): ${r}`);
        assert(g >= 0 && g <= 1, `g out of range for (${h},${s},${l}): ${g}`);
        assert(b >= 0 && b <= 1, `b out of range for (${h},${s},${l}): ${b}`);
    }
});

export { passed, failed };
