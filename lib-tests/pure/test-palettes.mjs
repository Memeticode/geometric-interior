/**
 * Tests for palette functions.
 */
import {
    PALETTE_KEYS, getPalette, getPaletteDefaults, resetPalette, updatePalette,
} from '../../dist/lib/geometric-interior.js';

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

test('PALETTE_KEYS includes all 8 keys', () => {
    assert(Array.isArray(PALETTE_KEYS), 'PALETTE_KEYS not an array');
    assert(PALETTE_KEYS.length === 8, `expected 8 keys, got ${PALETTE_KEYS.length}`);
    assert(PALETTE_KEYS.includes('violet-depth'));
    assert(PALETTE_KEYS.includes('custom'));
});

test('getPalette returns data for each built-in key', () => {
    for (const key of PALETTE_KEYS.filter(k => k !== 'custom')) {
        const p = getPalette(key);
        assert(p !== null && typeof p === 'object', `null palette for ${key}`);
        assert(typeof p.label === 'string' && p.label.length > 0, `empty label for ${key}`);
        assert(typeof p.baseHue === 'number', `missing baseHue for ${key}`);
        assert(Array.isArray(p.fogColor) && p.fogColor.length === 3, `bad fogColor for ${key}`);
        assert(Array.isArray(p.bgColor) && p.bgColor.length === 3, `bad bgColor for ${key}`);
        assert(Array.isArray(p.edgeColor) && p.edgeColor.length === 3, `bad edgeColor for ${key}`);
    }
});

test('getPalette returns data for custom key', () => {
    const p = getPalette('custom');
    assert(p !== null && typeof p === 'object', 'null custom palette');
    assert(p.label === 'Custom', `expected label "Custom", got "${p.label}"`);
});

test('getPaletteDefaults returns original values', () => {
    const d = getPaletteDefaults('violet-depth');
    assert(d !== null && typeof d === 'object');
    assert(typeof d.baseHue === 'number');
});

test('updatePalette changes palette values', () => {
    resetPalette('violet-depth');
    const before = getPalette('violet-depth').baseHue;
    updatePalette('violet-depth', { baseHue: 120, hueRange: 40, saturation: 0.8 });
    const after = getPalette('violet-depth').baseHue;
    assert(after === 120, `expected baseHue=120 after update, got ${after}`);
    // Cleanup
    resetPalette('violet-depth');
});

test('resetPalette restores defaults after update', () => {
    const defaults = getPaletteDefaults('violet-depth');
    updatePalette('violet-depth', { baseHue: 999, hueRange: 999, saturation: 0.99 });
    resetPalette('violet-depth');
    const restored = getPalette('violet-depth');
    assertClose(restored.baseHue, defaults.baseHue);
    assertClose(restored.hueRange, defaults.hueRange);
    assertClose(restored.saturation, defaults.saturation);
});

test('fogColor and bgColor are near-black for all palettes', () => {
    for (const key of PALETTE_KEYS.filter(k => k !== 'custom')) {
        resetPalette(key);
        const p = getPalette(key);
        for (const c of p.fogColor) {
            assert(c < 0.05, `${key} fogColor too bright: ${c}`);
        }
        for (const c of p.bgColor) {
            assert(c < 0.05, `${key} bgColor too bright: ${c}`);
        }
    }
});

export { passed, failed };
