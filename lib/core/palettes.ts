/**
 * Palette definitions and color utilities for the crystalline plane engine.
 */

import type { PaletteData } from '../types.js';

type BuiltinPaletteKey = 'violet-depth' | 'warm-spectrum' | 'teal-volumetric' | 'prismatic' | 'crystal-lattice' | 'sapphire' | 'amethyst';

/** Original palette data — kept as reference for PRESETS derivation. */
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

/** Convert HSL (h in degrees, s/l in 0-1) to RGB in 0-1 range. */
export function hslToRgb01(h: number, s: number, l: number): [number, number, number] {
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

/** Preset coordinates mapping palette names → continuous (hue, spectrum, chroma) axes. */
export const PRESETS: Record<string, { hue: number; spectrum: number; chroma: number }> = {
    'violet-depth':     { hue: 282 / 360, spectrum: Math.sqrt(Math.max(0, (30 - 10) / 350)),  chroma: (0.55 - 0.05) / (2 * 0.60) },
    'warm-spectrum':    { hue: 22 / 360,  spectrum: Math.sqrt(Math.max(0, (27 - 10) / 350)),  chroma: 0.5 + (0.97 - 0.65) / (2 * 0.35) },
    'teal-volumetric':  { hue: 185 / 360, spectrum: Math.sqrt(Math.max(0, (25 - 10) / 350)),  chroma: (0.60 - 0.05) / (2 * 0.60) },
    'sapphire':         { hue: 225 / 360, spectrum: Math.sqrt(Math.max(0, (30 - 10) / 350)),  chroma: 0.5 + (0.90 - 0.65) / (2 * 0.35) },
    'amethyst':         { hue: 312 / 360, spectrum: Math.sqrt(Math.max(0, (35 - 10) / 350)),  chroma: (0.55 - 0.05) / (2 * 0.60) },
    'crystal-lattice':  { hue: 211 / 360, spectrum: 0.0,                                       chroma: 0.0 },
    'prismatic':        { hue: 0 / 360,   spectrum: 1.0,                                       chroma: 1.0 },
};
