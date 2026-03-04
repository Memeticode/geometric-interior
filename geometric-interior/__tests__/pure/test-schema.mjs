/**
 * Tests for validateStillConfig, configToProfile, profileToConfig.
 */
import { validateStillConfig, configToProfile, profileToConfig, ControlsSchema, ImageAssetMetaSchema, AnimAssetMetaSchema, AnimationSchema } from '../../dist/geometric-interior.js';

let passed = 0, failed = 0;

function test(name, fn) {
    try { fn(); passed++; console.log(`  PASS: ${name}`); }
    catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${e.message}`); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const VALID = {
    kind: 'still-v2',
    name: 'Test Profile',
    intent: 'test-seed',
    color: { hue: 0.55, spectrum: 0.3, chroma: 0.5 },
    structure: { density: 0.5, luminosity: 0.5, bloom: 0.5, fracture: 0.5, coherence: 0.5, scale: 0.5, division: 0.5, faceting: 0.5, flow: 0.5 },
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

test('validateStillConfig rejects missing color', () => {
    const { color, ...rest } = VALID;
    const r = validateStillConfig(rest);
    assert(r.ok === false, 'expected rejection for missing color');
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
    assert(typeof config.color === 'object' && config.color !== null, 'expected color object');
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
    structure: { density: 0.5, luminosity: 0.5, bloom: 0.5, fracture: 0.5, coherence: 0.5, scale: 0.5, division: 0.5, faceting: 0.5, flow: 0.5 },
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

// ── Defaults tests ──

test('ControlsSchema.parse({}) produces valid defaults', () => {
    const c = ControlsSchema.parse({});
    assert(c.topology === 'flow-field', `expected topology "flow-field", got "${c.topology}"`);
    assert(c.hue === 0.5, `expected hue 0.5, got ${c.hue}`);
    assert(c.density === 0.5, `expected density 0.5, got ${c.density}`);
    assert(c.bloom === 0.5, `expected bloom 0.5, got ${c.bloom}`);
    assert(c.scale === 0.5, `expected scale 0.5, got ${c.scale}`);
    assert(c.flow === 0.5, `expected flow 0.5, got ${c.flow}`);
});

test('ControlsSchema.parse preserves explicit values', () => {
    const c = ControlsSchema.parse({ hue: 0.8, density: 0.1 });
    assert(c.hue === 0.8, `expected hue 0.8, got ${c.hue}`);
    assert(c.density === 0.1, `expected density 0.1, got ${c.density}`);
    assert(c.spectrum === 0.5, `expected spectrum default 0.5, got ${c.spectrum}`);
});

test('StillConfig with omitted optional structure fields gets defaults', () => {
    const minimal = {
        kind: 'still-v2',
        name: 'Minimal',
        intent: 'test',
        color: { hue: 0.5, spectrum: 0.5, chroma: 0.5 },
        structure: { density: 0.5, luminosity: 0.5, fracture: 0.5, coherence: 0.5 },
    };
    const r = validateStillConfig(minimal);
    assert(r.ok === true, `expected ok=true, got errors: ${r.errors?.join(', ')}`);
});

// ── Asset metadata tests ──

test('ImageAssetMetaSchema accepts full meta with config', () => {
    const meta = {
        title: 'Test', altText: 'desc', commentary: 'notes',
        seed: [3, 5, 7],
        controls: { topology: 'flow-field', hue: 0.5, spectrum: 0.5, chroma: 0.5, density: 0.5, fracture: 0.5, coherence: 0.5, luminosity: 0.5, bloom: 0.5, scale: 0.5, division: 0.5, faceting: 0.5, flow: 0.5 },
        nodeCount: 42, width: 1920, height: 1080,
    };
    const parsed = ImageAssetMetaSchema.parse(meta);
    assert(parsed.commentary === 'notes', `expected commentary "notes", got "${parsed.commentary}"`);
    assert(Array.isArray(parsed.seed), 'expected seed array in parsed meta');
    assert(parsed.controls.hue === 0.5, 'expected controls.hue in parsed meta');
});

test('ImageAssetMetaSchema defaults commentary to empty string', () => {
    const meta = {
        title: 'Test', altText: 'desc',
        seed: 'my-seed',
        controls: {},
        nodeCount: 10, width: 800, height: 600,
    };
    const parsed = ImageAssetMetaSchema.parse(meta);
    assert(parsed.commentary === '', `expected empty commentary, got "${parsed.commentary}"`);
});

test('ImageAssetMetaSchema includes optional camera', () => {
    const meta = {
        title: 'Test', altText: 'desc',
        seed: [1, 2, 3],
        controls: {},
        camera: { rotation: 45, elevation: 10, zoom: 0.8 },
        nodeCount: 10, width: 800, height: 600,
    };
    const parsed = ImageAssetMetaSchema.parse(meta);
    assert(parsed.camera !== undefined, 'expected camera in parsed meta');
    assert(parsed.camera.rotation === 45, `expected rotation 45, got ${parsed.camera.rotation}`);
});

test('AnimAssetMetaSchema accepts full meta with animation', () => {
    const anim = {
        settings: { fps: 30, width: 1920, height: 1080 },
        events: [{ type: 'expand', duration: 1.5, easing: 'ease-out', config: {}, seed: 'test' }],
        cameraMoves: [],
        paramTracks: [],
    };
    const meta = {
        title: 'Anim', altText: 'desc', commentary: 'my notes',
        animation: anim,
        fps: 30, totalFrames: 90, durationS: 3.0,
        width: 1920, height: 1080,
    };
    const parsed = AnimAssetMetaSchema.parse(meta);
    assert(parsed.commentary === 'my notes', `expected commentary, got "${parsed.commentary}"`);
    assert(parsed.animation.settings.fps === 30, 'expected animation in parsed meta');
});

export { passed, failed };
