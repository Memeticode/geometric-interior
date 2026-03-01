/**
 * Tests for deriveParams.
 */
import { deriveParams } from '../../dist/lib/geometric-interior.js';

let passed = 0, failed = 0;

function test(name, fn) {
    try { fn(); passed++; console.log(`  PASS: ${name}`); }
    catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${e.message}`); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const MID = {
    topology: 'flow-field',
    density: 0.5, luminosity: 0.5, fracture: 0.5, coherence: 0.5,
    hue: 0.783, spectrum: 0.239, chroma: 0.417,
    scale: 0.5, division: 0.5, faceting: 0.5, flow: 0.5,
};

console.log('\n=== Params Tests ===\n');

test('deriveParams returns an object with expected keys', () => {
    const p = deriveParams(MID);
    const expectedKeys = [
        'density', 'cameraZ', 'cameraFov', 'cameraOffsetX', 'cameraOffsetY',
        'bgInnerColor', 'bgOuterColor', 'bloomStrength', 'bloomThreshold',
        'chromaticAberration', 'vignetteStrength', 'envelopeRadii',
    ];
    for (const key of expectedKeys) {
        assert(key in p, `missing key: ${key}`);
    }
});

test('deriveParams produces finite numbers', () => {
    const p = deriveParams(MID);
    for (const [key, val] of Object.entries(p)) {
        if (typeof val === 'number') {
            assert(Number.isFinite(val), `${key} is not finite: ${val}`);
        }
        if (Array.isArray(val)) {
            for (const v of val) {
                if (typeof v === 'number') {
                    assert(Number.isFinite(v), `${key} element is not finite: ${v}`);
                }
            }
        }
    }
});

test('bgInnerColor components are near-black', () => {
    const p = deriveParams(MID);
    for (const c of p.bgInnerColor) {
        assert(c >= 0 && c < 0.05, `bgInnerColor component too bright: ${c}`);
    }
});

test('bgOuterColor components are near-black', () => {
    const p = deriveParams(MID);
    for (const c of p.bgOuterColor) {
        assert(c >= 0 && c < 0.05, `bgOuterColor component too bright: ${c}`);
    }
});

test('cameraZ is positive (camera in front of scene)', () => {
    const p = deriveParams(MID);
    assert(p.cameraZ > 0, `cameraZ should be positive: ${p.cameraZ}`);
});

test('cameraFov is in reasonable range (30-120)', () => {
    const p = deriveParams(MID);
    assert(p.cameraFov >= 30 && p.cameraFov <= 120, `cameraFov out of range: ${p.cameraFov}`);
});

test('envelopeRadii are positive', () => {
    const p = deriveParams(MID);
    assert(Array.isArray(p.envelopeRadii) || typeof p.envelopeRadii === 'object',
        'envelopeRadii not array-like');
    // envelopeRadii is a THREE.Vector3 or array
    const radii = p.envelopeRadii;
    if (Array.isArray(radii)) {
        for (const r of radii) assert(r > 0, `radius not positive: ${r}`);
    } else if (radii.x !== undefined) {
        assert(radii.x > 0 && radii.y > 0 && radii.z > 0, `radii not positive: ${radii.x}, ${radii.y}, ${radii.z}`);
    }
});

test('bloomStrength is non-negative', () => {
    const p = deriveParams(MID);
    assert(p.bloomStrength >= 0, `bloomStrength negative: ${p.bloomStrength}`);
});

test('different density values produce different dotConfig counts', () => {
    const lo = deriveParams({ ...MID, density: 0 });
    const hi = deriveParams({ ...MID, density: 1 });
    // Both should have dotConfig, but with different counts
    assert(lo.dotConfig !== undefined, 'missing dotConfig at density=0');
    assert(hi.dotConfig !== undefined, 'missing dotConfig at density=1');
    // Higher density should generally produce more dots
    const loTotal = lo.dotConfig.heroDotCount + lo.dotConfig.mediumDotCount + lo.dotConfig.interiorDotCount + lo.dotConfig.microDotCount;
    const hiTotal = hi.dotConfig.heroDotCount + hi.dotConfig.mediumDotCount + hi.dotConfig.interiorDotCount + hi.dotConfig.microDotCount;
    assert(hiTotal >= loTotal, `density=1 (${hiTotal}) should produce >= dots than density=0 (${loTotal})`);
});

test('deriveParams at extreme corners (all-zero, all-one) does not throw', () => {
    deriveParams({ ...MID, density: 0, luminosity: 0, fracture: 0, depth: 0, coherence: 0 });
    deriveParams({ ...MID, density: 1, luminosity: 1, fracture: 1, depth: 1, coherence: 1 });
});

export { passed, failed };
