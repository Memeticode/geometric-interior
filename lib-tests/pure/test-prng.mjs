/**
 * Tests for xmur3, mulberry32, clamp01, lerp, controlLerp.
 */
import { xmur3, mulberry32, clamp01, lerp, controlLerp } from '../../dist/lib/geometric-interior.js';

let passed = 0, failed = 0;

function test(name, fn) {
    try { fn(); passed++; console.log(`  PASS: ${name}`); }
    catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${e.message}`); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertClose(a, b, eps = 1e-9, msg) {
    if (Math.abs(a - b) > eps) throw new Error(msg || `expected ${a} close to ${b} (eps=${eps})`);
}

console.log('\n=== PRNG Tests ===\n');

test('xmur3 returns a function', () => {
    const h = xmur3('hello');
    assert(typeof h === 'function');
});

test('xmur3 determinism: same string = same sequence', () => {
    const a1 = xmur3('seed-abc')();
    const a2 = xmur3('seed-abc')();
    assert(a1 === a2, `${a1} !== ${a2}`);
});

test('xmur3 sensitivity: different strings = different values', () => {
    const a = xmur3('alpha')();
    const b = xmur3('beta')();
    assert(a !== b, 'different strings produced same hash');
});

test('mulberry32 returns values in [0, 1)', () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 1000; i++) {
        const v = rng();
        assert(v >= 0 && v < 1, `out of range: ${v}`);
    }
});

test('mulberry32 determinism: same seed = same 100-value sequence', () => {
    const seq1 = [];
    const seq2 = [];
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    for (let i = 0; i < 100; i++) {
        seq1.push(rng1());
        seq2.push(rng2());
    }
    for (let i = 0; i < 100; i++) {
        assert(seq1[i] === seq2[i], `mismatch at index ${i}`);
    }
});

test('mulberry32 different seeds produce different sequences', () => {
    const rng1 = mulberry32(1);
    const rng2 = mulberry32(999);
    let same = 0;
    for (let i = 0; i < 20; i++) {
        if (rng1() === rng2()) same++;
    }
    assert(same < 5, 'too many matching values from different seeds');
});

test('clamp01 clamps below 0', () => {
    assertClose(clamp01(-5), 0);
    assertClose(clamp01(-0.001), 0);
});

test('clamp01 clamps above 1', () => {
    assertClose(clamp01(5), 1);
    assertClose(clamp01(1.001), 1);
});

test('clamp01 passes through 0..1', () => {
    assertClose(clamp01(0), 0);
    assertClose(clamp01(0.5), 0.5);
    assertClose(clamp01(1), 1);
});

test('lerp endpoints', () => {
    assertClose(lerp(10, 20, 0), 10);
    assertClose(lerp(10, 20, 1), 20);
});

test('lerp midpoint', () => {
    assertClose(lerp(0, 100, 0.5), 50);
    assertClose(lerp(-10, 10, 0.5), 0);
});

test('controlLerp t=0 returns lo', () => {
    assertClose(controlLerp(0, 10, 50, 100), 10);
});

test('controlLerp t=0.5 returns mid', () => {
    assertClose(controlLerp(0.5, 10, 50, 100), 50);
});

test('controlLerp t=1 returns hi', () => {
    assertClose(controlLerp(1, 10, 50, 100), 100);
});

test('controlLerp continuity at t=0.5', () => {
    const left = controlLerp(0.4999, 10, 50, 100);
    const right = controlLerp(0.5001, 10, 50, 100);
    assertClose(left, right, 0.1, `discontinuity: ${left} vs ${right}`);
});

export { passed, failed };
