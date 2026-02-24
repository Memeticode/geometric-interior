/**
 * URL state encoding/decoding for shareable links.
 *
 * Encodes the full render state (seed, controls, palette tweaks, name) into
 * compact URL search params so shared links reproduce the exact same image.
 */

import { PALETTE_KEYS, getPaletteDefaults } from './palettes.js';

// Short param keys to keep URLs compact
const PARAM_SEED       = 's';
const PARAM_PALETTE    = 'p';
const PARAM_DENSITY    = 'd';
const PARAM_LUMINOSITY = 'l';
const PARAM_FRACTURE   = 'f';
const PARAM_DEPTH      = 'z';   // 'z' for zoom/depth since 'd' is density
const PARAM_COHERENCE  = 'c';
const PARAM_HUE        = 'h';
const PARAM_HUE_RANGE  = 'r';
const PARAM_SATURATION = 'a';
const PARAM_NAME       = 'n';

function clampFloat(s, min, max, fallback) {
    if (s == null) return fallback;
    const v = parseFloat(s);
    if (Number.isNaN(v)) return fallback;
    return Math.min(max, Math.max(min, v));
}

function clampInt(s, min, max, fallback) {
    if (s == null) return fallback;
    const v = parseInt(s, 10);
    if (Number.isNaN(v)) return fallback;
    return Math.min(max, Math.max(min, v));
}

/**
 * Encode app state into a shareable URL.
 * @param {string} origin — e.g. window.location.origin
 * @param {{ seed: string, controls: object, paletteTweaks: object, name?: string }} state
 * @returns {string} full URL with search params
 */
export function encodeStateToURL(origin, { seed, controls, paletteTweaks, name }) {
    const url = new URL(origin);

    // Human-readable order: name, intent, palette, sliders, then colors
    if (name) url.searchParams.set(PARAM_NAME, name);
    url.searchParams.set(PARAM_SEED, seed);
    url.searchParams.set(PARAM_PALETTE, controls.palette);
    url.searchParams.set(PARAM_DENSITY, controls.density.toFixed(2));
    url.searchParams.set(PARAM_LUMINOSITY, controls.luminosity.toFixed(2));
    url.searchParams.set(PARAM_FRACTURE, controls.fracture.toFixed(2));
    url.searchParams.set(PARAM_DEPTH, controls.depth.toFixed(2));
    url.searchParams.set(PARAM_COHERENCE, controls.coherence.toFixed(2));

    // Color tweaks: always include for custom palette; for built-in palettes
    // only include when the values differ from the palette's defaults.
    if (paletteTweaks) {
        let includeColors = controls.palette === 'custom';
        if (!includeColors) {
            const defaults = getPaletteDefaults(controls.palette);
            includeColors = Math.round(paletteTweaks.baseHue) !== defaults.baseHue
                || Math.round(paletteTweaks.hueRange) !== defaults.hueRange
                || Math.abs(paletteTweaks.saturation - defaults.saturation) > 0.005;
        }
        if (includeColors) {
            url.searchParams.set(PARAM_HUE, String(Math.round(paletteTweaks.baseHue)));
            url.searchParams.set(PARAM_HUE_RANGE, String(Math.round(paletteTweaks.hueRange)));
            url.searchParams.set(PARAM_SATURATION, paletteTweaks.saturation.toFixed(2));
        }
    }

    return url.toString();
}

/**
 * Decode share state from a URL. Returns null if no share params present.
 * All values are validated and clamped — malformed URLs fall back gracefully.
 * @param {string} href — e.g. window.location.href
 * @returns {{ seed: string, controls: object, paletteTweaks?: object, name: string } | null}
 */
export function decodeStateFromURL(href) {
    const url = new URL(href);
    const p = url.searchParams;
    if (!p.has(PARAM_SEED)) return null;

    const paletteRaw = p.get(PARAM_PALETTE) || 'violet-depth';
    const palette = PALETTE_KEYS.includes(paletteRaw) ? paletteRaw : 'violet-depth';

    const state = {
        seed: p.get(PARAM_SEED),
        controls: {
            topology: 'flow-field',
            palette,
            density:    clampFloat(p.get(PARAM_DENSITY),    0, 1, 0.65),
            luminosity: clampFloat(p.get(PARAM_LUMINOSITY), 0, 1, 0.70),
            fracture:   clampFloat(p.get(PARAM_FRACTURE),   0, 1, 0.35),
            depth:      clampFloat(p.get(PARAM_DEPTH),      0, 1, 0.40),
            coherence:  clampFloat(p.get(PARAM_COHERENCE),  0, 1, 0.50),
        },
        name: p.get(PARAM_NAME) || '',
    };

    if (p.has(PARAM_HUE)) {
        state.paletteTweaks = {
            baseHue:    clampInt(p.get(PARAM_HUE),        0, 360, 282),
            hueRange:   clampInt(p.get(PARAM_HUE_RANGE),  5, 360, 30),
            saturation: clampFloat(p.get(PARAM_SATURATION), 0.1, 1, 0.55),
        };
    }

    return state;
}
