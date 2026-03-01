/**
 * Tests for smootherstep, cosineEase, catmullRom, warpSegmentT, evalControlsAt.
 */
import {
    smootherstep, cosineEase, catmullRom, warpSegmentT,
    evalControlsAt, TIME_WARP_STRENGTH,
} from '../../dist/lib/geometric-interior.js';

let passed = 0, failed = 0;

function test(name, fn) {
    try { fn(); passed++; console.log(`  PASS: ${name}`); }
    catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${e.message}`); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertClose(a, b, eps = 1e-6, msg) {
    if (Math.abs(a - b) > eps) throw new Error(msg || `expected ${a} close to ${b} (eps=${eps})`);
}

console.log('\n=== Interpolation Tests ===\n');

// smootherstep
test('smootherstep(0) = 0', () => assertClose(smootherstep(0), 0));
test('smootherstep(1) = 1', () => assertClose(smootherstep(1), 1));
test('smootherstep(0.5) = 0.5', () => assertClose(smootherstep(0.5), 0.5));
test('smootherstep clamps below 0', () => assertClose(smootherstep(-1), 0));
test('smootherstep clamps above 1', () => assertClose(smootherstep(2), 1));

// cosineEase
test('cosineEase(0) = 0', () => assertClose(cosineEase(0), 0));
test('cosineEase(1) = 1', () => assertClose(cosineEase(1), 1));
test('cosineEase(0.5) = 0.5', () => assertClose(cosineEase(0.5), 0.5));
test('cosineEase is monotonic', () => {
    let prev = 0;
    for (let t = 0.01; t <= 1; t += 0.01) {
        const v = cosineEase(t);
        assert(v >= prev - 1e-10, `non-monotonic at t=${t}: ${v} < ${prev}`);
        prev = v;
    }
});

// catmullRom
test('catmullRom passes through p1 at t=0', () => {
    assertClose(catmullRom(0, 10, 20, 30, 0), 10);
});
test('catmullRom passes through p2 at t=1', () => {
    assertClose(catmullRom(0, 10, 20, 30, 1), 20);
});
test('catmullRom linear case', () => {
    // For evenly spaced points, midpoint should be linear
    assertClose(catmullRom(0, 1, 2, 3, 0.5), 1.5);
});

// warpSegmentT
test('warpSegmentT(0, s) = 0', () => {
    assertClose(warpSegmentT(0, 0.5), 0);
    assertClose(warpSegmentT(0, 1.0), 0);
});
test('warpSegmentT(1, s) = 1', () => {
    assertClose(warpSegmentT(1, 0.5), 1);
    assertClose(warpSegmentT(1, 1.0), 1);
});
test('warpSegmentT with strength=0 is identity', () => {
    for (let t = 0; t <= 1; t += 0.1) {
        assertClose(warpSegmentT(t, 0), t, 1e-6);
    }
});

// TIME_WARP_STRENGTH
test('TIME_WARP_STRENGTH is a positive number', () => {
    assert(typeof TIME_WARP_STRENGTH === 'number');
    assert(TIME_WARP_STRENGTH > 0);
});

// evalControlsAt
const mkLandmark = (density, luminosity = 0.5) => ({
    controls: {
        topology: 'flow-field',
        density, luminosity, fracture: 0.5, coherence: 0.5,
        hue: 0.5, spectrum: 0.3, chroma: 0.4,
        scale: 0.5, division: 0.5, faceting: 0.5, flow: 0.5,
    },
});

test('evalControlsAt returns null for < 2 landmarks', () => {
    assert(evalControlsAt(0.5, []) === null);
    assert(evalControlsAt(0.5, [mkLandmark(0.5)]) === null);
});

test('evalControlsAt with 2 landmarks at t=0 returns first', () => {
    const result = evalControlsAt(0, [mkLandmark(0.2), mkLandmark(0.8)]);
    assert(result !== null);
    assertClose(result.density, 0.2, 0.01);
});

test('evalControlsAt with 2 landmarks blends at t=0.25', () => {
    const result = evalControlsAt(0.25, [mkLandmark(0, 0), mkLandmark(1, 1)]);
    assert(result !== null);
    // At t=0.25, the phase is 0.5 (swing), so it should be near the midpoint
    assert(result.density > 0.1 && result.density < 0.9,
        `expected blend, got density=${result.density}`);
});

test('evalControlsAt preserves discrete keys', () => {
    const result = evalControlsAt(0.3, [
        { controls: { topology: 'flow-field', density: 0, luminosity: 0, fracture: 0, coherence: 0, hue: 0, spectrum: 0, chroma: 0, scale: 0, division: 0, faceting: 0, flow: 0 } },
        { controls: { topology: 'flow-field', density: 1, luminosity: 1, fracture: 1, coherence: 1, hue: 1, spectrum: 1, chroma: 1, scale: 1, division: 1, faceting: 1, flow: 1 } },
    ]);
    assert(result !== null);
    assert(result.topology === 'flow-field',
        `unexpected topology: ${result.topology}`);
});

test('evalControlsAt with 3+ landmarks produces values in [0,1]', () => {
    const landmarks = [
        mkLandmark(0.2, 0.3),
        mkLandmark(0.5, 0.7),
        mkLandmark(0.8, 0.1),
    ];
    for (let t = 0; t < 1; t += 0.05) {
        const result = evalControlsAt(t, landmarks);
        assert(result !== null);
        assert(result.density >= 0 && result.density <= 1,
            `density out of range at t=${t}: ${result.density}`);
        assert(result.luminosity >= 0 && result.luminosity <= 1,
            `luminosity out of range at t=${t}: ${result.luminosity}`);
    }
});

export { passed, failed };
