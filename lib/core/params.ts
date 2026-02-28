/**
 * Controls → derived engine parameters for the demo scene builder.
 */

import { controlLerp } from './prng.js';
import { getPalette } from './palettes.js';
import type { Controls, DerivedParams } from '../types.js';

export function deriveParams(controls: Controls, _rng: () => number): DerivedParams {
    const c = controls;
    const pal = getPalette(c.palette);
    const cl = controlLerp;
    const frac = 1 - c.fracture;
    const dep = 1 - c.depth;

    const baseHue = pal.baseHue;
    const hueRange = pal.hueRange;
    const saturation = pal.saturation;
    const lumScale = cl(c.luminosity, 0.5, 1.0, 2.0);
    const bgInnerColor: [number, number, number] = [0.003 * lumScale, 0.001 * lumScale, 0.006 * lumScale];
    const bgOuterColor: [number, number, number] = [0.0, 0.0, 0.0];

    const envelopeRadii: [number, number, number] = [
        cl(frac, 1.0, 1.4, 1.8),
        cl(frac, 0.70, 0.95, 1.20),
        cl(frac, 0.85, 1.15, 1.50),
    ];

    const cameraZ = cl(dep, 2.25, 3.5, 3.67);
    const cameraFov = cl(dep, 34, 50, 58);
    const cameraOffsetX = 0;
    const cameraOffsetY = 0;

    const curveConfig = {
        primary: {
            seedCount:  Math.round(cl(c.coherence, 5, 8, 12)),
            maxCount:   Math.round(cl(c.density, 3, 5, 7)),
            maxSteps:   Math.round(cl(frac, 28, 40, 55)),
            stepSize:   cl(c.coherence, 0.08, 0.06, 0.04),
            curvature:  cl(frac, 0.2, 0.4, 0.7),
            minLength:  8,
        },
        secondary: {
            seedCount:  Math.round(cl(c.coherence, 10, 16, 24)),
            maxCount:   Math.round(cl(c.density, 5, 10, 14)),
            maxSteps:   Math.round(cl(frac, 10, 16, 24)),
            stepSize:   cl(c.coherence, 0.07, 0.05, 0.035),
            curvature:  cl(frac, 0.3, 0.6, 1.0),
            minLength:  5,
        },
        tertiary: {
            seedCount:  Math.round(cl(c.coherence, 16, 24, 36)),
            maxCount:   Math.round(cl(c.density, 7, 14, 20)),
            maxSteps:   8,
            stepSize:   cl(c.coherence, 0.055, 0.04, 0.025),
            curvature:  cl(frac, 0.4, 0.8, 1.3),
            minLength:  3,
        },
    };

    const chains = {
        primary: {
            chainLenBase: Math.round(cl(c.density, 5, 8, 11)),
            chainLenRange: 3,
            scaleBase: 0.95,
            scaleRange: cl(frac, 0.25, 0.50, 0.80),
            spread: cl(frac, 0.35, 0.60, 0.85),
            dualProb: cl(c.density, 0.45, 0.75, 0.95),
            spacing: cl(c.coherence, 0.15, 0.11, 0.07),
        },
        secondary: {
            chainLenBase: Math.round(cl(c.density, 3, 5, 7)),
            chainLenRange: 2,
            scaleBase: 0.75,
            scaleRange: cl(frac, 0.18, 0.35, 0.55),
            spread: cl(frac, 0.25, 0.40, 0.60),
            dualProb: cl(c.density, 0.25, 0.50, 0.75),
            spacing: cl(c.coherence, 0.17, 0.13, 0.08),
        },
        tertiary: {
            chainLenBase: Math.round(cl(c.density, 2, 3, 5)),
            chainLenRange: 2,
            scaleBase: 0.45,
            scaleRange: cl(frac, 0.18, 0.35, 0.55),
            spread: cl(frac, 0.15, 0.30, 0.50),
            dualProb: cl(c.density, 0.10, 0.28, 0.50),
            spacing: cl(c.coherence, 0.13, 0.09, 0.05),
        },
    };

    const edgeColorOffset: [number, number, number] = [0, -0.04, 0.04];
    const edgeOpacityBase = cl(frac, 0.001, 0.003, 0.006);
    const edgeOpacityFadeScale = cl(frac, 0.008, 0.015, 0.025);
    const crackExtendScale = cl(frac, 1.04, 1.12, 1.22);

    const faceDensityAtten = cl(c.density, 0.90, 1.0, 2.5);
    const backLightFactor = cl(c.luminosity, 1.0, 2.0, 3.2) / faceDensityAtten;
    const illuminationCap = cl(c.luminosity, 1.2, 1.8, 2.5) / faceDensityAtten;
    const ambientLight = cl(c.luminosity, 0.008, 0.02, 0.04);
    const frontLightFactor = cl(c.luminosity, 0.15, 0.3, 0.5) / faceDensityAtten;
    const edgeFadeThreshold = cl(frac, 0.30, 0.22, 0.14);

    const atmosphericCount = Math.round(cl(c.density, 4, 8, 14));

    const densityScale = cl(c.density, 0.35, 1.0, 5.5);

    const heroSpreadScale = cl(frac, 0.5, 1.0, 1.75);
    const dotConfig = {
        heroDotCount: Math.round(cl(c.density, 3, 5, 9)),
        heroDotSpread: [0.08 * heroSpreadScale, 0.06 * heroSpreadScale, 0.08 * heroSpreadScale] as [number, number, number],
        heroDotRadiusBase: 0.028,
        heroDotRadiusRange: 0.05,
        heroDotGlowBase: cl(c.luminosity, 20, 34, 50) / densityScale,
        heroDotGlowRange: 14,

        mediumDotCount: Math.round(cl(c.density, 3, 8, 20)),
        mediumDotJitter: 0.02,
        mediumDotRadiusBase: 0.012,
        mediumDotRadiusRange: 0.020,
        mediumDotGlowBase: cl(c.luminosity, 10, 16, 24) / densityScale,
        mediumDotGlowRange: 8,

        smallDotDensity: {
            primary:   0.28 * cl(c.density, 0.25, 1.0, 2.0),
            secondary: 0.16 * cl(c.density, 0.25, 1.0, 2.0),
            tertiary:  0.09 * cl(c.density, 0.25, 1.0, 2.0),
        },
        smallDotRadiusBase: 0.003,
        smallDotRadiusRange: 0.008,
        smallDotGlowBase: cl(c.luminosity, 6, 10, 16) / densityScale,
        smallDotLightnessBase: cl(c.luminosity, 0.25, 0.35, 0.50),
        smallDotLightnessRange: 0.35,

        interiorDotCount: Math.round(cl(c.density, 18, 50, 180)),
        interiorDotSpread: [
            cl(frac, 0.40, 0.65, 0.90) * cl(c.density, 0.85, 1.0, 1.25),
            cl(frac, 0.30, 0.48, 0.66) * cl(c.density, 0.85, 1.0, 1.25),
            cl(frac, 0.36, 0.58, 0.80) * cl(c.density, 0.85, 1.0, 1.25),
        ] as [number, number, number],

        microDotCount: Math.round(cl(c.density, 70, 220, 800)),
        microDotSpread: [
            cl(frac, 0.55, 0.90, 1.25) * cl(c.density, 0.85, 1.0, 1.25),
            cl(frac, 0.38, 0.62, 0.86) * cl(c.density, 0.85, 1.0, 1.25),
            cl(frac, 0.46, 0.75, 1.04) * cl(c.density, 0.85, 1.0, 1.25),
        ] as [number, number, number],
        microDotRadiusBase: 0.002,
        microDotRadiusRange: 0.006,
        microDotGlowBase: cl(c.luminosity, 7, 12, 18) / densityScale,
        microDotLightnessBase: cl(c.luminosity, 0.20, 0.30, 0.45),
        microDotLightnessRange: 0.40,

        dotBaseHue: baseHue,
        microDotBaseHue: baseHue - 10,
    };

    const tendrilHueBase = baseHue - 20;
    const tendrilHueRange = Math.min(hueRange, 40);
    const tendrilSatBase = 0.4;
    const tendrilSatRange = 0.3;
    const tendrilOpacity = {
        primary: cl(c.coherence, 0.02, 0.06, 0.10),
        other: cl(c.coherence, 0.01, 0.03, 0.06),
    };

    const bloomDensityAtten = cl(c.density, 1.0, 1.0, 1.8);
    const bloomStrength = cl(c.luminosity, 0.10, 0.20, 0.35) / bloomDensityAtten;
    const bloomThreshold = cl(c.coherence, 0.55, 0.70, 0.85);
    const chromaticAberration = cl(frac, 0.001, 0.002, 0.004);
    const vignetteStrength = cl(dep, 0.20, 0.50, 0.86);

    // Flow field: coherence controls large-scale directional alignment of chains.
    // High coherence → low scale (large coherent regions) + strong influence (chains align).
    // Low coherence → high scale (per-chain chaos) + weak influence (surface draping dominates).
    const flowScale = cl(c.coherence, 5.0, 1.5, 0.5);
    const flowInfluence = cl(c.coherence, 0.0, 0.15, 0.35);

    return {
        density: c.density,
        fracture: c.fracture,
        luminosity: c.luminosity,
        baseHue,
        hueRange,
        saturation,
        bgInnerColor,
        bgOuterColor,
        bgColor: pal.bgColor as [number, number, number],
        fogColor: pal.fogColor as [number, number, number],
        envelopeRadii,
        cameraZ,
        cameraFov,
        cameraOffsetX,
        cameraOffsetY,
        curveConfig,
        chains,
        edgeColorOffset,
        edgeOpacityBase,
        edgeOpacityFadeScale,
        crackExtendScale,
        backLightFactor,
        illuminationCap,
        ambientLight,
        frontLightFactor,
        edgeFadeThreshold,
        atmosphericCount,
        dotConfig,
        tendrilHueBase,
        tendrilHueRange,
        tendrilSatBase,
        tendrilSatRange,
        tendrilOpacity,
        bloomStrength,
        bloomThreshold,
        chromaticAberration,
        vignetteStrength,
        flowScale,
        flowInfluence,
    };
}
