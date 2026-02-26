/**
 * Palette definitions for the crystalline plane engine.
 */

import type { PaletteData, PaletteKey, PaletteTweaks } from '../types.js';

type BuiltinPaletteKey = Exclude<PaletteKey, 'custom'>;

export const PALETTES: Record<BuiltinPaletteKey, PaletteData> = {
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
export const PALETTE_DEFAULTS: Record<BuiltinPaletteKey, Readonly<PaletteData>> = Object.fromEntries(
    Object.entries(PALETTES).map(([k, v]) => [k, Object.freeze({
        ...v,
        fogColor: [...v.fogColor] as [number, number, number],
        bgColor: [...v.bgColor] as [number, number, number],
        edgeColor: [...v.edgeColor] as [number, number, number],
    })])
) as Record<BuiltinPaletteKey, Readonly<PaletteData>>;

export const PALETTE_KEYS: string[] = [...Object.keys(PALETTES), 'custom'];

/* ── Custom palette (mutable) ── */

function hslToRgb01(h: number, s: number, l: number): [number, number, number] {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r: number, g: number, b: number;
    if (h < 60)       { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else               { r = c; g = 0; b = x; }
    return [r + m, g + m, b + m];
}

export function deriveCustomColors(baseHue: number): Pick<PaletteData, 'fogColor' | 'bgColor' | 'edgeColor' | 'accentHue'> {
    const h = ((baseHue % 360) + 360) % 360;
    return {
        fogColor: hslToRgb01(h, 0.2, 0.04),
        bgColor: hslToRgb01(h, 0.15, 0.025),
        edgeColor: hslToRgb01(h, 0.7, 0.8),
        accentHue: (h + 10) % 360,
    };
}

export const customPalette: PaletteData = {
    label: 'Custom',
    baseHue: 325,
    hueRange: 100,
    saturation: 0.75,
    ...deriveCustomColors(325),
};

/** Update any palette in-place (built-in or custom). Derives fog/bg/edge from baseHue. */
export function updatePalette(key: string, { baseHue, hueRange, saturation }: PaletteTweaks): void {
    const target: PaletteData | undefined = key === 'custom'
        ? customPalette
        : (PALETTES as Record<string, PaletteData>)[key];
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
export function updateCustomPalette(settings: PaletteTweaks): void {
    updatePalette('custom', settings);
}

/** Reset a built-in palette to its original hand-tuned defaults. */
export function resetPalette(key: string): void {
    const defaults = (PALETTE_DEFAULTS as Record<string, Readonly<PaletteData>>)[key];
    const target = (PALETTES as Record<string, PaletteData>)[key];
    if (!defaults || !target) return;
    Object.assign(target, {
        ...defaults,
        fogColor: [...defaults.fogColor] as [number, number, number],
        bgColor: [...defaults.bgColor] as [number, number, number],
        edgeColor: [...defaults.edgeColor] as [number, number, number],
    });
}

/** Get the original default values for a palette (read-only). */
export function getPaletteDefaults(key: string): Pick<PaletteData, 'baseHue' | 'hueRange' | 'saturation'> {
    if (key === 'custom') return { baseHue: 325, hueRange: 100, saturation: 0.75 };
    return (PALETTE_DEFAULTS as Record<string, Readonly<PaletteData>>)[key] || PALETTE_DEFAULTS['violet-depth'];
}

export function getPalette(key: string): PaletteData {
    if (key === 'custom') return customPalette;
    return (PALETTES as Record<string, PaletteData>)[key] || PALETTES['violet-depth'];
}
