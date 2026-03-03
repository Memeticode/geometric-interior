/**
 * Canonical configuration schema for still images.
 * Defines validation, and conversion to/from internal profile format.
 */

import type { StillConfig, ValidationResult, Profile } from './image-models.js';
import { seedTagToLabel, isSeedTag, TAG_LIST_LENGTH } from './text-generation/seed-tags.js';
import type { SeedTag } from './text-generation/seed-tags.js';
import { isObj, checkStr, checkNum } from '../utils/validation.js';

const STRUCTURE_KEYS = ['density', 'luminosity', 'bloom', 'fracture', 'coherence', 'scale', 'division', 'faceting', 'flow'] as const;
const COLOR_KEYS = ['hue', 'spectrum', 'chroma'] as const;

export function validateStillConfig(data: unknown): ValidationResult {
    const errors: string[] = [];

    if (!isObj(data)) {
        return { ok: false, errors: ['Expected a JSON object'] };
    }

    const kind = data.kind;
    if (kind !== 'still-v2') {
        errors.push(`kind: must be "still-v2"${kind != null ? `, got "${kind}"` : ' (missing)'}`);
    }

    checkStr(errors, 'name', data, 40);

    // Seed: either intent string or seedTag array
    const hasSeedTag = Array.isArray(data.seedTag);
    if (hasSeedTag) {
        const tag = data.seedTag as unknown[];
        if (tag.length !== 3 || !tag.every(n => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < TAG_LIST_LENGTH)) {
            errors.push(`seedTag: must be an array of 3 integers in [0, ${TAG_LIST_LENGTH - 1}]`);
        }
    }
    if (!hasSeedTag) {
        checkStr(errors, 'intent', data, 120);
    }

    if (!isObj(data.color)) {
        errors.push('color: required, must be an object');
    } else {
        for (const key of COLOR_KEYS) {
            checkNum(errors, 'color', data.color, key, 0, 1);
        }
    }
    if (!isObj(data.structure)) {
        errors.push('structure: required, must be an object');
    } else {
        for (const key of STRUCTURE_KEYS) {
            checkNum(errors, 'structure', data.structure, key, 0, 1);
        }
    }

    // Optional camera validation
    if (data.camera != null) {
        if (!isObj(data.camera)) {
            errors.push('camera: must be an object');
        } else {
            checkNum(errors, 'camera', data.camera, 'zoom', 0, 1.0);
            checkNum(errors, 'camera', data.camera, 'rotation', -180, 180);
            if (data.camera.elevation != null) {
                checkNum(errors, 'camera', data.camera, 'elevation', -180, 180);
            }
        }
    }

    return { ok: errors.length === 0, errors };
}

export function configToProfile(config: StillConfig): { name: string; profile: Profile } {
    const seed = config.seedTag
        ? (config.seedTag as SeedTag)
        : config.intent;

    return {
        name: config.name,
        profile: {
            seed,
            controls: {
                topology: 'flow-field',
                hue: config.color.hue,
                spectrum: config.color.spectrum,
                chroma: config.color.chroma,
                density: config.structure.density,
                luminosity: config.structure.luminosity,
                fracture: config.structure.fracture,
                coherence: config.structure.coherence,
                scale: config.structure.scale ?? 0.5,
                division: config.structure.division ?? 0.5,
                faceting: config.structure.faceting ?? 0.5,
                flow: config.structure.flow ?? 0.5,
                bloom: config.structure.bloom ?? 0.5,
            },
            ...(config.camera ? { camera: config.camera } : {}),
        },
    };
}

export function profileToConfig(name: string, profile: Profile): StillConfig {
    const isTag = isSeedTag(profile.seed);
    return {
        kind: 'still-v2',
        name,
        intent: isTag ? seedTagToLabel(profile.seed as SeedTag) : (profile.seed as string),
        ...(isTag ? { seedTag: profile.seed as SeedTag } : {}),
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
            bloom: profile.controls.bloom,
        },
        ...(profile.camera ? { camera: profile.camera } : {}),
    };
}
