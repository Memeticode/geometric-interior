/**
 * URL state encoding/decoding for shareable links.
 *
 * Encodes the full render state (seed, controls, name) into
 * compact URL search params so shared links reproduce the exact same image.
 */

import { PRESETS } from '../../lib/core/palettes.js';

// New param keys (v2)
const PARAM_SEED       = 's';
const PARAM_NAME       = 'n';
const PARAM_DENSITY    = 'd';
const PARAM_LUMINOSITY = 'l';
const PARAM_FRACTURE   = 'f';
const PARAM_COHERENCE  = 'c';
const PARAM_HUE        = 'h';   // 0-1 hue (was baseHue 0-360 in v1)
const PARAM_SPECTRUM   = 'sp';
const PARAM_CHROMA     = 'ch';
const PARAM_SCALE      = 'sc';
const PARAM_DIVISION   = 'dv';
const PARAM_FACETING   = 'ft';
const PARAM_FLOW       = 'fl';

// Legacy param keys (v1)
const LEGACY_PALETTE    = 'p';
const LEGACY_DEPTH      = 'z';
const LEGACY_HUE_INT    = 'h';  // was integer baseHue 0-360
const LEGACY_HUE_RANGE  = 'r';
const LEGACY_SATURATION = 'a';

function clampFloat(s, min, max, fallback) {
    if (s == null) return fallback;
    const v = parseFloat(s);
    if (Number.isNaN(v)) return fallback;
    return Math.min(max, Math.max(min, v));
}

/**
 * Encode app state into a shareable URL.
 * @param {string} origin — e.g. window.location.origin
 * @param {{ seed: string, controls: object, name?: string }} state
 * @returns {string} full URL with search params
 */
export function encodeStateToURL(origin, { seed, controls, name }) {
    const url = new URL(origin);

    if (name) url.searchParams.set(PARAM_NAME, name);
    url.searchParams.set(PARAM_SEED, seed);
    url.searchParams.set(PARAM_DENSITY, controls.density.toFixed(2));
    url.searchParams.set(PARAM_LUMINOSITY, controls.luminosity.toFixed(2));
    url.searchParams.set(PARAM_FRACTURE, controls.fracture.toFixed(2));
    url.searchParams.set(PARAM_COHERENCE, controls.coherence.toFixed(2));
    url.searchParams.set(PARAM_HUE, controls.hue.toFixed(3));
    url.searchParams.set(PARAM_SPECTRUM, controls.spectrum.toFixed(3));
    url.searchParams.set(PARAM_CHROMA, controls.chroma.toFixed(3));
    url.searchParams.set(PARAM_SCALE, controls.scale.toFixed(2));
    url.searchParams.set(PARAM_DIVISION, controls.division.toFixed(2));
    url.searchParams.set(PARAM_FACETING, controls.faceting.toFixed(2));
    url.searchParams.set(PARAM_FLOW, controls.flow.toFixed(2));

    return url.toString();
}

/**
 * Decode share state from a URL. Returns null if no share params present.
 * Supports both v1 (legacy palette+depth) and v2 (10-axis) URL formats.
 * @param {string} href — e.g. window.location.href
 * @returns {{ seed: string, controls: object, name: string } | null}
 */
export function decodeStateFromURL(href) {
    const url = new URL(href);
    const p = url.searchParams;
    if (!p.has(PARAM_SEED)) return null;

    // Legacy detection: v1 URLs have 'p' (palette) param
    if (p.has(LEGACY_PALETTE)) {
        return decodeLegacyURL(p);
    }

    return {
        seed: p.get(PARAM_SEED),
        controls: {
            topology: 'flow-field',
            density:    clampFloat(p.get(PARAM_DENSITY),    0, 1, 0.5),
            luminosity: clampFloat(p.get(PARAM_LUMINOSITY), 0, 1, 0.5),
            fracture:   clampFloat(p.get(PARAM_FRACTURE),   0, 1, 0.5),
            coherence:  clampFloat(p.get(PARAM_COHERENCE),  0, 1, 0.5),
            hue:        clampFloat(p.get(PARAM_HUE),        0, 1, 0.783),
            spectrum:   clampFloat(p.get(PARAM_SPECTRUM),    0, 1, 0.239),
            chroma:     clampFloat(p.get(PARAM_CHROMA),      0, 1, 0.417),
            scale:      clampFloat(p.get(PARAM_SCALE),       0, 1, 0.5),
            division:   clampFloat(p.get(PARAM_DIVISION),    0, 1, 0.5),
            faceting:   clampFloat(p.get(PARAM_FACETING),    0, 1, 0.5),
            flow:       clampFloat(p.get(PARAM_FLOW),        0, 1, 0.5),
        },
        name: p.get(PARAM_NAME) || '',
    };
}

/**
 * Convert a v1 URL (palette + depth + paletteTweaks) to v2 controls.
 */
function decodeLegacyURL(p) {
    const paletteKey = p.get(LEGACY_PALETTE) || 'violet-depth';

    // Start with preset coordinates or defaults
    const preset = PRESETS[paletteKey];
    let hue = preset?.hue ?? 0.783;
    let spectrum = preset?.spectrum ?? 0.239;
    let chroma = preset?.chroma ?? 0.417;

    // Override from explicit palette tweaks if present
    if (p.has(LEGACY_HUE_INT) && p.has(LEGACY_HUE_RANGE)) {
        const baseHue = clampFloat(p.get(LEGACY_HUE_INT), 0, 360, 282);
        const hueRange = clampFloat(p.get(LEGACY_HUE_RANGE), 5, 360, 30);
        const saturation = clampFloat(p.get(LEGACY_SATURATION), 0.05, 1, 0.55);

        hue = baseHue / 360;
        spectrum = Math.sqrt(Math.max(0, (hueRange - 10) / 350));
        if (saturation <= 0.65) {
            chroma = (saturation - 0.05) / (2 * 0.60);
        } else {
            chroma = 0.5 + (saturation - 0.65) / (2 * 0.35);
        }
        chroma = Math.max(0, Math.min(1, chroma));
    }

    return {
        seed: p.get(PARAM_SEED),
        controls: {
            topology: 'flow-field',
            density:    clampFloat(p.get(PARAM_DENSITY),    0, 1, 0.5),
            luminosity: clampFloat(p.get(PARAM_LUMINOSITY), 0, 1, 0.5),
            fracture:   clampFloat(p.get(PARAM_FRACTURE),   0, 1, 0.5),
            coherence:  clampFloat(p.get(PARAM_COHERENCE),  0, 1, 0.5),
            hue,
            spectrum,
            chroma,
            scale: 0.5,
            division: 0.5,
            faceting: 0.5,
            flow: 0.5,
        },
        name: p.get(PARAM_NAME) || '',
    };
}
