/**
 * Tests for ImageConfigSchema / validateImageConfig, ControlsSchema and ImageAssetMetaSchema.
 */
import { validateImageConfig, ImageConfigSchema, ControlsSchema, ImageAssetMetaSchema } from '../../dist/geometric-interior.js';

let passed = 0, failed = 0;

function test(name, fn) {
    try { fn(); passed++; console.log(`  PASS: ${name}`); }
    catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${e.message}`); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const VALID = {
    seed: [3, 12, 8],
    controls: { hue: 0.55, spectrum: 0.3, chroma: 0.5, density: 0.5, luminosity: 0.5, bloom: 0.5, fracture: 0.5, coherence: 0.5, scale: 0.5, division: 0.5, faceting: 0.5, flow: 0.5 },
    camera: { zoom: 0.375, rotation: 0, elevation: 0 },
};

console.log('\n=== Schema Tests ===\n');

// ── ImageConfig ──

test('validateImageConfig accepts a valid config', () => {
    const r = validateImageConfig(VALID);
    assert(r.ok === true, `expected ok, got errors: ${r.errors.join(', ')}`);
});

test('validateImageConfig rejects non-object input', () => {
    assert(validateImageConfig(null).ok === false);
    assert(validateImageConfig('config').ok === false);
});

test('validateImageConfig rejects a text seed', () => {
    const r = validateImageConfig({ ...VALID, seed: 'hello' });
    assert(r.ok === false && r.errors.some(e => e.startsWith('seed')), `expected seed error, got ${r.errors.join(', ')}`);
});

test('validateImageConfig rejects invalid seed tags', () => {
    for (const seed of [[1, 2], [1, 2, 3, 4], [0, 0, 18], [-1, 0, 0], [1.5, 2, 3]]) {
        assert(validateImageConfig({ ...VALID, seed }).ok === false, `accepted bad seed ${JSON.stringify(seed)}`);
    }
});

test('validateImageConfig requires camera', () => {
    const { camera, ...noCamera } = VALID;
    const r = validateImageConfig(noCamera);
    assert(r.ok === false && r.errors.some(e => e.startsWith('camera')), `expected camera error, got ${r.errors.join(', ')}`);
});

test('validateImageConfig rejects out-of-range values', () => {
    assert(validateImageConfig({ ...VALID, controls: { ...VALID.controls, density: 1.5 } }).ok === false);
    assert(validateImageConfig({ ...VALID, camera: { ...VALID.camera, zoom: -0.1 } }).ok === false);
    assert(validateImageConfig({ ...VALID, camera: { ...VALID.camera, rotation: 200 } }).ok === false);
});

test('error messages carry the field path', () => {
    const r = validateImageConfig({ ...VALID, controls: { ...VALID.controls, hue: 2 } });
    assert(r.errors.some(e => e.startsWith('controls.hue: ')), `got ${r.errors.join(', ')}`);
});

test('ImageConfigSchema fills omitted controls and camera fields with defaults', () => {
    const c = ImageConfigSchema.parse({ seed: [1, 2, 3], controls: {}, camera: {} });
    assert(c.controls.density === 0.5, `expected density 0.5, got ${c.controls.density}`);
    assert(c.camera.zoom === 0.375, `expected default zoom 0.375, got ${c.camera.zoom}`);
    assert(c.camera.rotation === 0 && c.camera.elevation === 0, 'expected zero camera angles');
});

// ── Controls ──

test('ControlsSchema.parse({}) produces valid defaults', () => {
    const c = ControlsSchema.parse({});
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

// ── Asset metadata ──

test('ImageAssetMetaSchema accepts full meta with config', () => {
    const meta = {
        title: 'Test', altText: 'desc', commentary: 'notes',
        config: VALID,
        nodeCount: 42, width: 1920, height: 1080,
    };
    const parsed = ImageAssetMetaSchema.parse(meta);
    assert(parsed.commentary === 'notes', `expected commentary "notes", got "${parsed.commentary}"`);
    assert(parsed.config.seed[1] === 12, 'expected config.seed in parsed meta');
    assert(parsed.config.camera.zoom === 0.375, 'expected config.camera in parsed meta');
});

test('ImageAssetMetaSchema defaults commentary to empty string', () => {
    const meta = { title: 'Test', altText: 'desc', config: VALID, nodeCount: 10, width: 800, height: 600 };
    const parsed = ImageAssetMetaSchema.parse(meta);
    assert(parsed.commentary === '', `expected empty commentary, got "${parsed.commentary}"`);
});

export { passed, failed };
