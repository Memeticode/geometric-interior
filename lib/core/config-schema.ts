/**
 * Canonical configuration schema for still images.
 * Defines validation, and conversion to/from internal profile format.
 */

import type { StillConfig, ValidationResult, Profile } from '../types.js';

const STRUCTURE_KEYS = ['density', 'luminosity', 'fracture', 'depth', 'coherence'] as const;

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

    if (data.kind !== 'still') {
        errors.push(`kind: must be "still"${data.kind != null ? `, got "${data.kind}"` : ' (missing)'}`);
    }

    checkStr(errors, 'name', data, 40);
    checkStr(errors, 'intent', data, 120);

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
        for (const key of STRUCTURE_KEYS) {
            checkNum(errors, 'structure', data.structure, key, 0, 1);
        }
    }

    return { ok: errors.length === 0, errors };
}

export function configToProfile(config: StillConfig): { name: string; profile: Profile } {
    return {
        name: config.name,
        profile: {
            seed: config.intent,
            controls: {
                topology: 'flow-field',
                palette: 'custom',
                density: config.structure.density,
                luminosity: config.structure.luminosity,
                fracture: config.structure.fracture,
                depth: config.structure.depth,
                coherence: config.structure.coherence,
            },
            paletteTweaks: {
                baseHue: config.palette.hue,
                hueRange: config.palette.range,
                saturation: config.palette.saturation,
            },
        },
    };
}

export function profileToConfig(name: string, profile: Profile): StillConfig {
    return {
        kind: 'still',
        name,
        intent: profile.seed,
        palette: {
            hue: profile.paletteTweaks.baseHue,
            range: profile.paletteTweaks.hueRange,
            saturation: profile.paletteTweaks.saturation,
        },
        structure: {
            density: profile.controls.density,
            luminosity: profile.controls.luminosity,
            fracture: profile.controls.fracture,
            depth: profile.controls.depth,
            coherence: profile.controls.coherence,
        },
    };
}
