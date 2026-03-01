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
    // v1 palette is converted to v2 color axes on roundtrip
    assert(typeof config.color === 'object' && config.color !== null, 'expected color object in v2 output');
    assert(typeof config.color.hue === 'number', 'expected numeric color.hue');
    assert(typeof config.color.chroma === 'number', 'expected numeric color.chroma');
});

// ── Seed tag config tests ──

const VALID_V2_TAG = {
    kind: 'still-v2',
    name: 'Tag Profile',
    seedTag: [5, 3, 11],
    intent: 'Balanced, folded, bright',
    color: { hue: 0.5, spectrum: 0.3, chroma: 0.6 },
    structure: { density: 0.5, luminosity: 0.5, fracture: 0.5, coherence: 0.5, scale: 0.5, division: 0.5, faceting: 0.5, flow: 0.5 },
};

test('validateStillConfig accepts v2 config with seedTag', () => {
    const r = validateStillConfig(VALID_V2_TAG);
    assert(r.ok === true, `expected ok=true, got errors: ${r.errors?.join(', ')}`);
});

test('validateStillConfig accepts v2 config with seedTag and no intent', () => {
    const { intent, ...noIntent } = VALID_V2_TAG;
    const r = validateStillConfig(noIntent);
    assert(r.ok === true, `expected ok=true, got errors: ${r.errors?.join(', ')}`);
});

test('validateStillConfig rejects invalid seedTag (wrong length)', () => {
    const r = validateStillConfig({ ...VALID_V2_TAG, seedTag: [1, 2] });
    assert(r.ok === false, 'expected rejection for wrong-length seedTag');
});

test('validateStillConfig rejects invalid seedTag (out of range)', () => {
    const r = validateStillConfig({ ...VALID_V2_TAG, seedTag: [0, 18, 5] });
    assert(r.ok === false, 'expected rejection for out-of-range seedTag element');
});

test('validateStillConfig rejects invalid seedTag (non-integer)', () => {
    const r = validateStillConfig({ ...VALID_V2_TAG, seedTag: [1.5, 3, 5] });
    assert(r.ok === false, 'expected rejection for non-integer seedTag element');
});

test('configToProfile extracts seedTag as seed', () => {
    const result = configToProfile(VALID_V2_TAG);
    assert(Array.isArray(result.profile.seed), 'expected array seed');
    assert(JSON.stringify(result.profile.seed) === JSON.stringify([5, 3, 11]),
        `expected [5,3,11], got ${JSON.stringify(result.profile.seed)}`);
});

test('profileToConfig emits seedTag for tag seed', () => {
    const { name, profile } = configToProfile(VALID_V2_TAG);
    const config = profileToConfig(name, profile);
    assert(Array.isArray(config.seedTag), 'expected seedTag in config');
    assert(JSON.stringify(config.seedTag) === JSON.stringify([5, 3, 11]),
        `expected [5,3,11], got ${JSON.stringify(config.seedTag)}`);
    assert(typeof config.intent === 'string' && config.intent.length > 0,
        'expected intent string label for tag seed');
});

test('profileToConfig → configToProfile roundtrip preserves seedTag', () => {
    const { name, profile } = configToProfile(VALID_V2_TAG);
    const config = profileToConfig(name, profile);
    const { profile: profile2 } = configToProfile(config);
    assert(Array.isArray(profile2.seed), 'expected array seed after roundtrip');
    assert(JSON.stringify(profile2.seed) === JSON.stringify([5, 3, 11]),
        `roundtrip lost seedTag: got ${JSON.stringify(profile2.seed)}`);
});

test('profileToConfig does not emit seedTag for string seed', () => {
    const config = profileToConfig('Test', { seed: 'hello', controls: VALID_V2_TAG.structure });
    assert(config.seedTag === undefined, 'expected no seedTag for string seed');
    assert(config.intent === 'hello', `expected intent "hello", got "${config.intent}"`);
});

export { passed, failed };
