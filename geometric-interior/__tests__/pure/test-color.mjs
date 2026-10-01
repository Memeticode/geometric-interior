/**
 * Tests for color utility functions.
 */
import { hslToRgb01 } from '../../dist/geometric-interior.js';

let passed = 0, failed = 0;

function test(name, fn) {
    try { fn(); passed++; console.log(`  PASS: ${name}`); }
    catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${e.message}`); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertClose(a, b, eps = 1e-6, msg) {
    if (Math.abs(a - b) > eps) throw new Error(msg || `expected ${a} close to ${b}`);
}

console.log('\n=== Color Tests ===\n');

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
