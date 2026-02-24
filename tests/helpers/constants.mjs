/**
 * Shared test data: combos, configs, palette keys, slider keys.
 */

export const SLIDER_KEYS = ['density', 'luminosity', 'fracture', 'depth', 'coherence'];

export const ALL_PALETTE_KEYS = [
    'violet-depth', 'warm-spectrum', 'teal-volumetric', 'prismatic',
    'crystal-lattice', 'sapphire', 'amethyst', 'custom',
];

/** The 14 render combos from the original test-render.mjs. */
export const RENDER_COMBOS = [
    { name: 'midpoint', topology: 'flow-field', palette: 'violet-depth', density: 0.50, luminosity: 0.50, fracture: 0.50, depth: 0.50, coherence: 0.50 },
    { name: 'density-lo', topology: 'flow-field', palette: 'violet-depth', density: 0.00, luminosity: 0.50, fracture: 0.50, depth: 0.50, coherence: 0.50 },
    { name: 'density-hi', topology: 'flow-field', palette: 'violet-depth', density: 1.00, luminosity: 0.50, fracture: 0.50, depth: 0.50, coherence: 0.50 },
    { name: 'luminosity-lo', topology: 'flow-field', palette: 'violet-depth', density: 0.50, luminosity: 0.00, fracture: 0.50, depth: 0.50, coherence: 0.50 },
    { name: 'luminosity-hi', topology: 'flow-field', palette: 'violet-depth', density: 0.50, luminosity: 1.00, fracture: 0.50, depth: 0.50, coherence: 0.50 },
    { name: 'fracture-lo', topology: 'flow-field', palette: 'violet-depth', density: 0.50, luminosity: 0.50, fracture: 0.00, depth: 0.50, coherence: 0.50 },
    { name: 'fracture-hi', topology: 'flow-field', palette: 'violet-depth', density: 0.50, luminosity: 0.50, fracture: 1.00, depth: 0.50, coherence: 0.50 },
    { name: 'depth-lo', topology: 'flow-field', palette: 'violet-depth', density: 0.50, luminosity: 0.50, fracture: 0.50, depth: 0.00, coherence: 0.50 },
    { name: 'depth-hi', topology: 'flow-field', palette: 'violet-depth', density: 0.50, luminosity: 0.50, fracture: 0.50, depth: 1.00, coherence: 0.50 },
    { name: 'coherence-lo', topology: 'flow-field', palette: 'violet-depth', density: 0.50, luminosity: 0.50, fracture: 0.50, depth: 0.50, coherence: 0.00 },
    { name: 'coherence-hi', topology: 'flow-field', palette: 'violet-depth', density: 0.50, luminosity: 0.50, fracture: 0.50, depth: 0.50, coherence: 1.00 },
    { name: 'all-zero', topology: 'flow-field', palette: 'violet-depth', density: 0.00, luminosity: 0.00, fracture: 0.00, depth: 0.00, coherence: 0.00 },
    { name: 'all-one', topology: 'flow-field', palette: 'violet-depth', density: 1.00, luminosity: 1.00, fracture: 1.00, depth: 1.00, coherence: 1.00 },
    { name: 'warm-flow', topology: 'flow-field', palette: 'warm-spectrum', density: 0.70, luminosity: 0.75, fracture: 0.40, depth: 0.35, coherence: 0.45 },
];

/** A complete valid still config for import testing. */
export const VALID_STILL_CONFIG = {
    kind: 'still',
    name: 'Test Import Profile',
    intent: 'A test seed for import validation',
    palette: { hue: 200, range: 30, saturation: 0.55 },
    structure: { density: 0.5, luminosity: 0.5, fracture: 0.5, depth: 0.5, coherence: 0.5 },
};

/** Three valid configs for batch import testing. */
export const BATCH_CONFIGS = [
    {
        kind: 'still',
        name: 'Batch One',
        intent: 'first batch seed',
        palette: { hue: 100, range: 40, saturation: 0.6 },
        structure: { density: 0.3, luminosity: 0.4, fracture: 0.5, depth: 0.6, coherence: 0.7 },
    },
    {
        kind: 'still',
        name: 'Batch Two',
        intent: 'second batch seed',
        palette: { hue: 200, range: 60, saturation: 0.7 },
        structure: { density: 0.7, luminosity: 0.6, fracture: 0.5, depth: 0.4, coherence: 0.3 },
    },
    {
        kind: 'still',
        name: 'Batch Three',
        intent: 'third batch seed',
        palette: { hue: 300, range: 80, saturation: 0.8 },
        structure: { density: 0.1, luminosity: 0.9, fracture: 0.2, depth: 0.8, coherence: 0.5 },
    },
];

/** Invalid configs for error case testing: { label, json, expectedError }. */
export const INVALID_CONFIGS = [
    {
        label: 'not JSON',
        json: 'not valid json {{{',
        expectedError: 'Invalid JSON',
    },
    {
        label: 'missing fields',
        json: JSON.stringify({ kind: 'still' }),
        expectedError: 'required',
    },
    {
        label: 'wrong kind',
        json: JSON.stringify({
            kind: 'animation',
            name: 'Test',
            intent: 'test',
            palette: { hue: 0, range: 0, saturation: 0 },
            structure: { density: 0, luminosity: 0, fracture: 0, depth: 0, coherence: 0 },
        }),
        expectedError: 'must be "still"',
    },
    {
        label: 'out of range values',
        json: JSON.stringify({
            kind: 'still',
            name: 'Test',
            intent: 'test',
            palette: { hue: 0, range: 0, saturation: 5.0 },
            structure: { density: 0, luminosity: 0, fracture: 0, depth: 0, coherence: 0 },
        }),
        expectedError: 'between',
    },
];
