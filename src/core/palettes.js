/**
 * Palette definitions for the crystalline plane engine.
 * Each palette defines a chromatic family with base hue, range, and fog color.
 *
 * Derived from reference images:
 *   - Violet Depth: narrow violet band, deep space
 *   - Warm Spectrum: gold/rose/violet blend
 *   - Teal Volumetric: unified cyan/teal
 *   - Prismatic: full iridescent spectrum
 *   - Crystal Lattice: cool blue/silver with sharp reflections
 *   - Sapphire: deep blue family
 *   - Amethyst: purple/magenta family
 */

export const PALETTES = {
    'violet-depth': {
        label: 'Violet Depth',
        baseHue: 282,
        hueRange: 30,
        saturation: 0.55,
        fogColor: [0.003, 0.001, 0.006],
        bgColor: [0.001, 0.001, 0.003],
        edgeColor: [0.7, 0.5, 1.0],
        accentHue: 280,
    },
    'warm-spectrum': {
        label: 'Warm Spectrum',
        baseHue: 22,
        hueRange: 27,
        saturation: 0.97,
        fogColor: [0.006, 0.003, 0.001],
        bgColor: [0.003, 0.001, 0.001],
        edgeColor: [1.0, 0.8, 0.5],
        accentHue: 40,
    },
    'teal-volumetric': {
        label: 'Teal Volumetric',
        baseHue: 185,
        hueRange: 25,
        saturation: 0.6,
        fogColor: [0.001, 0.004, 0.005],
        bgColor: [0.001, 0.002, 0.003],
        edgeColor: [0.4, 0.9, 1.0],
        accentHue: 190,
    },
    'prismatic': {
        label: 'Prismatic',
        baseHue: 0,
        hueRange: 360,
        saturation: 1.0,
        fogColor: [0.003, 0.002, 0.004],
        bgColor: [0.001, 0.001, 0.002],
        edgeColor: [0.9, 0.8, 1.0],
        accentHue: 270,
    },
    'crystal-lattice': {
        label: 'Crystal Lattice',
        baseHue: 211,
        hueRange: 10,
        saturation: 0.05,
        fogColor: [0.002, 0.003, 0.005],
        bgColor: [0.001, 0.002, 0.003],
        edgeColor: [0.7, 0.8, 1.0],
        accentHue: 230,
    },
    'sapphire': {
        label: 'Sapphire',
        baseHue: 225,
        hueRange: 30,
        saturation: 0.9,
        fogColor: [0.001, 0.002, 0.006],
        bgColor: [0.001, 0.001, 0.003],
        edgeColor: [0.4, 0.6, 1.0],
        accentHue: 220,
    },
    'amethyst': {
        label: 'Amethyst',
        baseHue: 312,
        hueRange: 35,
        saturation: 0.55,
        fogColor: [0.004, 0.001, 0.005],
        bgColor: [0.002, 0.001, 0.003],
        edgeColor: [0.8, 0.4, 1.0],
        accentHue: 295,
    },
};

/** Frozen snapshots of original palette values (for reset after editing). */
export const PALETTE_DEFAULTS = Object.fromEntries(
    Object.entries(PALETTES).map(([k, v]) => [k, Object.freeze({ ...v, fogColor: [...v.fogColor], bgColor: [...v.bgColor], edgeColor: [...v.edgeColor] })])
);

export const PALETTE_KEYS = [...Object.keys(PALETTES), 'custom'];

/* ── Custom palette (mutable) ── */

function hslToRgb01(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r, g, b;
    if (h < 60)       { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else               { r = c; g = 0; b = x; }
    return [r + m, g + m, b + m];
}

export function deriveCustomColors(baseHue) {
    const h = ((baseHue % 360) + 360) % 360;
    return {
        fogColor: hslToRgb01(h, 0.2, 0.04),
        bgColor: hslToRgb01(h, 0.15, 0.025),
        edgeColor: hslToRgb01(h, 0.7, 0.8),
        accentHue: (h + 10) % 360,
    };
}

export const customPalette = {
    label: 'Custom',
    baseHue: 325,
    hueRange: 100,
    saturation: 0.75,
    ...deriveCustomColors(325),
};

/** Update any palette in-place (built-in or custom). Derives fog/bg/edge from baseHue. */
export function updatePalette(key, { baseHue, hueRange, saturation }) {
    const target = key === 'custom' ? customPalette : PALETTES[key];
    if (!target) return;
    const derived = deriveCustomColors(baseHue);
    target.baseHue = baseHue;
    target.hueRange = hueRange;
    target.saturation = saturation;
    target.fogColor = derived.fogColor;
    target.bgColor = derived.bgColor;
    target.edgeColor = derived.edgeColor;
    target.accentHue = derived.accentHue;
}

/** Backward-compat alias. */
export function updateCustomPalette(settings) {
    updatePalette('custom', settings);
}

/** Reset a built-in palette to its original hand-tuned defaults. */
export function resetPalette(key) {
    const defaults = PALETTE_DEFAULTS[key];
    if (!defaults || !PALETTES[key]) return;
    Object.assign(PALETTES[key], { ...defaults, fogColor: [...defaults.fogColor], bgColor: [...defaults.bgColor], edgeColor: [...defaults.edgeColor] });
}

/** Get the original default values for a palette (read-only). */
export function getPaletteDefaults(key) {
    if (key === 'custom') return { baseHue: 325, hueRange: 100, saturation: 0.75 };
    return PALETTE_DEFAULTS[key] || PALETTE_DEFAULTS['violet-depth'];
}

export function getPalette(key) {
    if (key === 'custom') return customPalette;
    return PALETTES[key] || PALETTES['violet-depth'];
}
