/**
 * Canonical configuration schema for still images.
 * Defines validation, and conversion to/from internal profile format.
 */

import type { StillConfig, ValidationResult, Profile } from '../types.js';
import { PRESETS } from './palettes.js';

const STRUCTURE_KEYS_V2 = ['density', 'luminosity', 'fracture', 'coherence', 'scale', 'division', 'faceting', 'flow'] as const;
const COLOR_KEYS_V2 = ['hue', 'spectrum', 'chroma'] as const;

/** Legacy v1 structure keys */
const STRUCTURE_KEYS_V1 = ['density', 'luminosity', 'fracture', 'depth', 'coherence'] as const;

function isObj(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function checkStr(errors: string[], key: string, obj: Record<string, unknown>, maxLen: number): void {
    const v = obj[key];
    if (typeof v !== 'string' || !v.trim()) {
        errors.push(`${key}: required, must be a non-empty string`);
    } else if (v.length > maxLen) {
        errors.push(`${key}: must be at most ${maxLen} characters`);
    }
}

function checkNum(errors: string[], path: string, obj: Record<string, unknown>, key: string, min: number, max: number): void {
    const v = obj[key];
    if (typeof v !== 'number' || Number.isNaN(v)) {
        errors.push(`${path}.${key}: required, must be a number`);
    } else if (v < min || v > max) {
        errors.push(`${path}.${key}: must be between ${min} and ${max}`);
    }
}

export function validateStillConfig(data: unknown): ValidationResult {
    const errors: string[] = [];

    if (!isObj(data)) {
        return { ok: false, errors: ['Expected a JSON object'] };
    }

    const kind = data.kind;
    if (kind !== 'still' && kind !== 'still-v2') {
        errors.push(`kind: must be "still" or "still-v2"${kind != null ? `, got "${kind}"` : ' (missing)'}`);
    }

    checkStr(errors, 'name', data, 40);
    checkStr(errors, 'intent', data, 120);

    if (kind === 'still') {
        // Legacy v1 format: palette section
        if (!isObj(data.palette)) {
            errors.push('palette: required, must be an object');
        } else {
            checkNum(errors, 'palette', data.palette, 'hue', 0, 359);
            checkNum(errors, 'palette', data.palette, 'range', 0, 360);
            checkNum(errors, 'palette', data.palette, 'saturation', 0, 1);
        }
        if (!isObj(data.structure)) {
            errors.push('structure: required, must be an object');
        } else {
            for (const key of STRUCTURE_KEYS_V1) {
                checkNum(errors, 'structure', data.structure, key, 0, 1);
            }
        }
    } else {
        // v2 format: color section
        if (!isObj(data.color)) {
            errors.push('color: required, must be an object');
        } else {
            for (const key of COLOR_KEYS_V2) {
                checkNum(errors, 'color', data.color, key, 0, 1);
            }
        }
        if (!isObj(data.structure)) {
            errors.push('structure: required, must be an object');
        } else {
            for (const key of STRUCTURE_KEYS_V2) {
                checkNum(errors, 'structure', data.structure, key, 0, 1);
            }
        }
    }

    return { ok: errors.length === 0, errors };
}

/**
 * Inverse of controlLerp for chroma → saturation mapping.
 * controlLerp(t, 0.05, 0.65, 1.0): t<0.5 → lerp(0.05, 0.65, t*2), t>=0.5 → lerp(0.65, 1.0, (t-0.5)*2)
 */
function saturationToChroma(sat: number): number {
    if (sat <= 0.65) {
        return Math.max(0, Math.min(0.5, (sat - 0.05) / (2 * 0.60)));
    }
    return Math.min(1.0, 0.5 + (sat - 0.65) / (2 * 0.35));
}

/** Convert v1 palette (hue degrees, hueRange, saturation) → v2 color (hue, spectrum, chroma). */
function paletteToColor(palHue: number, palRange: number, palSat: number): { hue: number; spectrum: number; chroma: number } {
    return {
        hue: Math.max(0, Math.min(1, palHue / 360)),
        spectrum: Math.sqrt(Math.max(0, (palRange - 10) / 350)),
        chroma: saturationToChroma(palSat),
    };
}

export function configToProfile(config: StillConfig): { name: string; profile: Profile } {
    if (config.kind === 'still' && config.palette) {
        // Legacy v1 → convert palette to color axes
        const color = paletteToColor(config.palette.hue, config.palette.range, config.palette.saturation);
        return {
            name: config.name,
            profile: {
                seed: config.intent,
                controls: {
                    topology: 'flow-field',
                    hue: color.hue,
                    spectrum: color.spectrum,
                    chroma: color.chroma,
                    density: config.structure.density,
                    luminosity: config.structure.luminosity,
                    fracture: config.structure.fracture,
                    coherence: config.structure.coherence,
                    scale: 0.5,
                    division: 0.5,
                    faceting: 0.5,
                    flow: 0.5,
                },
            },
        };
    }

    // v2 format
    const color = config.color ?? { hue: 0.5, spectrum: 0.5, chroma: 0.5 };
    return {
        name: config.name,
        profile: {
            seed: config.intent,
            controls: {
                topology: 'flow-field',
                hue: color.hue,
                spectrum: color.spectrum,
                chroma: color.chroma,
                density: config.structure.density,
                luminosity: config.structure.luminosity,
                fracture: config.structure.fracture,
                coherence: config.structure.coherence,
                scale: config.structure.scale ?? 0.5,
                division: config.structure.division ?? 0.5,
                faceting: config.structure.faceting ?? 0.5,
                flow: config.structure.flow ?? 0.5,
            },
        },
    };
}

export function profileToConfig(name: string, profile: Profile): StillConfig {
    return {
        kind: 'still-v2',
        name,
        intent: profile.seed,
        color: {
            hue: profile.controls.hue,
            spectrum: profile.controls.spectrum,
            chroma: profile.controls.chroma,
        },
        structure: {
            density: profile.controls.density,
            luminosity: profile.controls.luminosity,
            fracture: profile.controls.fracture,
            coherence: profile.controls.coherence,
            scale: profile.controls.scale,
            division: profile.controls.division,
            faceting: profile.controls.faceting,
            flow: profile.controls.flow,
        },
    };
}

// Re-export for use in profile migration
export { saturationToChroma, paletteToColor };
