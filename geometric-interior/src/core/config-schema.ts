/**
 * Conversion functions between StillConfig and Profile formats.
 */

import type { StillConfig, Profile, SeedTag } from './schemas.js';
import { seedTagToLabel, isSeedTag } from './text-generation/seed-tags.js';

export function configToProfile(config: StillConfig): { name: string; profile: Profile } {
    const seed = config.seedTag
        ? (config.seedTag as SeedTag)
        : config.intent!;

    return {
        name: config.name,
        profile: {
            seed,
            controls: {
                hue: config.color.hue,
                spectrum: config.color.spectrum,
                chroma: config.color.chroma,
                density: config.structure.density,
                luminosity: config.structure.luminosity,
                fracture: config.structure.fracture,
                coherence: config.structure.coherence,
                scale: config.structure.scale,
                division: config.structure.division,
                faceting: config.structure.faceting,
                flow: config.structure.flow,
                bloom: config.structure.bloom,
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
