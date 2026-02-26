/**
 * Tests for validateStillConfig, configToProfile, profileToConfig.
 */
import { validateStillConfig, configToProfile, profileToConfig } from '../../dist/lib/geometric-interior.js';

let passed = 0, failed = 0;

function test(name, fn) {
    try { fn(); passed++; console.log(`  PASS: ${name}`); }
    catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${e.message}`); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const VALID = {
    kind: 'still',
    name: 'Test Profile',
    intent: 'test-seed',
    palette: { hue: 200, range: 30, saturation: 0.55 },
    structure: { density: 0.5, luminosity: 0.5, fracture: 0.5, depth: 0.5, coherence: 0.5 },
};

console.log('\n=== Schema Tests ===\n');

test('validateStillConfig accepts valid config', () => {
    const r = validateStillConfig(VALID);
    assert(r.ok === true, `expected ok=true, got errors: ${r.errors?.join(', ')}`);
});

test('validateStillConfig rejects missing kind', () => {
    const { kind, ...rest } = VALID;
    const r = validateStillConfig(rest);
    assert(r.ok === false, 'expected rejection for missing kind');
});

test('validateStillConfig rejects wrong kind', () => {
    const r = validateStillConfig({ ...VALID, kind: 'animation' });
    assert(r.ok === false, 'expected rejection for wrong kind');
    assert(r.errors.some(e => e.toLowerCase().includes('still')),
        `expected error mentioning "still", got: ${r.errors}`);
});

test('validateStillConfig rejects missing name', () => {
    const { name, ...rest } = VALID;
    const r = validateStillConfig(rest);
    assert(r.ok === false, 'expected rejection for missing name');
});

test('validateStillConfig rejects missing structure', () => {
    const { structure, ...rest } = VALID;
    const r = validateStillConfig(rest);
    assert(r.ok === false, 'expected rejection for missing structure');
});

test('validateStillConfig rejects out-of-range structure values', () => {
    const r = validateStillConfig({
        ...VALID,
        structure: { ...VALID.structure, density: 5.0 },
    });
    assert(r.ok === false, 'expected rejection for out-of-range density');
});

test('validateStillConfig rejects out-of-range palette saturation', () => {
    const r = validateStillConfig({
        ...VALID,
        palette: { ...VALID.palette, saturation: 5.0 },
    });
    assert(r.ok === false, 'expected rejection for out-of-range saturation');
});

test('validateStillConfig rejects non-object input', () => {
    const r = validateStillConfig('not an object');
    assert(r.ok === false, 'expected rejection for string input');
});

test('configToProfile produces { name, profile }', () => {
    const result = configToProfile(VALID);
    assert(result !== null && typeof result === 'object', 'expected object');
    assert(result.name === 'Test Profile', `expected name "Test Profile", got "${result.name}"`);
    assert(result.profile !== undefined, 'missing profile');
    assert(result.profile.seed === 'test-seed', `expected seed "test-seed", got "${result.profile.seed}"`);
});

test('profileToConfig produces valid StillConfig', () => {
    const { name, profile } = configToProfile(VALID);
    const config = profileToConfig(name, profile);
    const r = validateStillConfig(config);
    assert(r.ok === true, `roundtrip produced invalid config: ${r.errors?.join(', ')}`);
});

test('configToProfile → profileToConfig roundtrip preserves values', () => {
    const { name, profile } = configToProfile(VALID);
    const config = profileToConfig(name, profile);
    assert(config.name === VALID.name);
    assert(config.intent === VALID.intent);
    assert(config.structure.density === VALID.structure.density);
    assert(config.structure.luminosity === VALID.structure.luminosity);
    assert(config.palette.hue === VALID.palette.hue);
    assert(config.palette.saturation === VALID.palette.saturation);
});

export { passed, failed };
