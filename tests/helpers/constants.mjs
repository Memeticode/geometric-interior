/**
 * Shared test data: combos, configs, slider keys.
 */

export const SLIDER_KEYS = ['density', 'luminosity', 'fracture', 'coherence', 'hue', 'spectrum', 'chroma', 'scale', 'division', 'faceting', 'flow'];

/** Default controls for violet-depth midpoint. */
const DEFAULT_CONTROLS = {
    topology: 'flow-field',
    density: 0.50, luminosity: 0.50, fracture: 0.50, coherence: 0.50,
    hue: 0.783, spectrum: 0.239, chroma: 0.417,
    scale: 0.50, division: 0.50, faceting: 0.50, flow: 0.50,
};

/** The render combos for testing. */
export const RENDER_COMBOS = [
    { name: 'midpoint', ...DEFAULT_CONTROLS },
    { name: 'density-lo', ...DEFAULT_CONTROLS, density: 0.00 },
    { name: 'density-hi', ...DEFAULT_CONTROLS, density: 1.00 },
    { name: 'luminosity-lo', ...DEFAULT_CONTROLS, luminosity: 0.00 },
    { name: 'luminosity-hi', ...DEFAULT_CONTROLS, luminosity: 1.00 },
    { name: 'fracture-lo', ...DEFAULT_CONTROLS, fracture: 0.00 },
    { name: 'fracture-hi', ...DEFAULT_CONTROLS, fracture: 1.00 },
    { name: 'coherence-lo', ...DEFAULT_CONTROLS, coherence: 0.00 },
    { name: 'coherence-hi', ...DEFAULT_CONTROLS, coherence: 1.00 },
    { name: 'hue-lo', ...DEFAULT_CONTROLS, hue: 0.00 },
    { name: 'hue-hi', ...DEFAULT_CONTROLS, hue: 1.00 },
    { name: 'scale-lo', ...DEFAULT_CONTROLS, scale: 0.00 },
    { name: 'scale-hi', ...DEFAULT_CONTROLS, scale: 1.00 },
    { name: 'all-zero', ...DEFAULT_CONTROLS, density: 0, luminosity: 0, fracture: 0, coherence: 0, hue: 0, spectrum: 0, chroma: 0, scale: 0, division: 0, faceting: 0, flow: 0 },
    { name: 'all-one', ...DEFAULT_CONTROLS, density: 1, luminosity: 1, fracture: 1, coherence: 1, hue: 1, spectrum: 1, chroma: 1, scale: 1, division: 1, faceting: 1, flow: 1 },
    { name: 'warm-flow', ...DEFAULT_CONTROLS, density: 0.70, luminosity: 0.75, fracture: 0.40, coherence: 0.45, hue: 0.061, spectrum: 0.220, chroma: 0.957 },
];

/** A complete valid still-v2 config for import testing. */
export const VALID_STILL_CONFIG = {
    kind: 'still-v2',
    name: 'Test Import Profile',
    intent: 'A test seed for import validation',
    color: { hue: 0.556, spectrum: 0.239, chroma: 0.417 },
    structure: { density: 0.5, luminosity: 0.5, fracture: 0.5, coherence: 0.5, scale: 0.5, division: 0.5, faceting: 0.5, flow: 0.5 },
};

/** Three valid configs for batch import testing. */
export const BATCH_CONFIGS = [
    {
        kind: 'still-v2',
        name: 'Batch One',
        intent: 'first batch seed',
        color: { hue: 0.278, spectrum: 0.293, chroma: 0.458 },
        structure: { density: 0.3, luminosity: 0.4, fracture: 0.5, coherence: 0.7, scale: 0.4, division: 0.3, faceting: 0.6, flow: 0.5 },
    },
    {
        kind: 'still-v2',
        name: 'Batch Two',
        intent: 'second batch seed',
        color: { hue: 0.556, spectrum: 0.382, chroma: 0.571 },
        structure: { density: 0.7, luminosity: 0.6, fracture: 0.5, coherence: 0.3, scale: 0.6, division: 0.7, faceting: 0.4, flow: 0.5 },
    },
    {
        kind: 'still-v2',
        name: 'Batch Three',
        intent: 'third batch seed',
        color: { hue: 0.833, spectrum: 0.449, chroma: 0.714 },
        structure: { density: 0.1, luminosity: 0.9, fracture: 0.2, coherence: 0.5, scale: 0.8, division: 0.2, faceting: 0.9, flow: 0.5 },
    },
];

/** A legacy v1 config for testing backward-compatible import. */
export const LEGACY_STILL_CONFIG = {
    kind: 'still',
    name: 'Legacy Import Test',
    intent: 'A test seed for legacy import',
    palette: { hue: 200, range: 30, saturation: 0.55 },
    structure: { density: 0.5, luminosity: 0.5, fracture: 0.5, depth: 0.5, coherence: 0.5 },
};

/** Invalid configs for error case testing: { label, json, expectedError }. */
export const INVALID_CONFIGS = [
    {
        label: 'not JSON',
        json: 'not valid json {{{',
        expectedError: 'Invalid JSON',
    },
    {
        label: 'missing fields',
        json: JSON.stringify({ kind: 'still-v2' }),
        expectedError: 'required',
    },
    {
        label: 'wrong kind',
        json: JSON.stringify({
            kind: 'animation',
            name: 'Test',
            intent: 'test',
            color: { hue: 0.5, spectrum: 0.5, chroma: 0.5 },
            structure: { density: 0, luminosity: 0, fracture: 0, coherence: 0, scale: 0, division: 0, faceting: 0, flow: 0 },
        }),
        expectedError: 'must be "still"',
    },
    {
        label: 'out of range values',
        json: JSON.stringify({
            kind: 'still-v2',
            name: 'Test',
            intent: 'test',
            color: { hue: 5.0, spectrum: 0.5, chroma: 0.5 },
            structure: { density: 0, luminosity: 0, fracture: 0, coherence: 0, scale: 0, division: 0, faceting: 0, flow: 0 },
        }),
        expectedError: 'between',
    },
];
