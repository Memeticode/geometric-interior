/**
 * Controls → derived engine parameters.
 *
 * Input controls: { topology, palette, density, luminosity, fracture, depth, coherence }
 * Output: concrete numeric parameters for all engine subsystems.
 */

import { clamp01, lerp } from './prng.js';
import { getPalette } from './palettes.js';

export function deriveParams(controls, rng) {
    const c = controls;
    const pal = getPalette(c.palette);

    // --- Plane generation: fewer, larger, translucent planes ---
    // The reference aesthetic comes from natural overlap of large translucent planes,
    // not from dense packing. Planes should fill the entire frame.
    const planeCountPrimary = Math.round(lerp(14, 30, c.density));
    const planeCountSecondary = Math.round(lerp(35, 120, c.density));
    const planeCountMicro = Math.round(lerp(15, 100, c.density * c.fracture));

    // Log-normal params for plane sizes — biased toward larger planes
    const planeSizeMu = lerp(0.0, 0.6, 1 - c.density);
    const planeSizeSigma = lerp(0.3, 0.7, c.fracture);

    // Depth distribution — tight enough for good overlap, wide enough to fill frame
    const depthRange = lerp(4, 9, c.depth);
    const depthBias = lerp(1.2, 3.0, c.depth);

    // --- Energy nodes ---
    const nodeCount = Math.round(lerp(3, 8, c.density));

    // --- Topology ---
    const topologyMode = c.topology || 'flow-field';
    const topologyCoherence = c.coherence;
    const fieldFractalOctaves = Math.round(lerp(2, 5, c.fracture));
    const fieldFractalAmplitude = lerp(0.05, 0.5, c.fracture * (1 - c.coherence * 0.6));

    // --- Material / Color ---
    const paletteWobble = (rng() * 2 - 1) * 12;
    const baseHue = (pal.baseHue + paletteWobble + 360) % 360;
    const hueRange = pal.hueRange;
    const saturation = pal.saturation * lerp(0.8, 1.15, rng());
    const lightness = pal.lightness * lerp(0.85, 1.15, c.luminosity);

    // Per-face opacity: high because each polyhedron shows only 2-3 faces,
    // so there's much less overlap. Light diffuses through the crystalline structure.
    // Crystals should feel solid, not ghostly.
    const opacity = lerp(0.40, 0.72, c.density * 0.3 + c.luminosity * 0.4);

    // Ambient emissive: self-emission from crystal material.
    const emissiveStrength = lerp(1.2, 3.5, c.fracture * 0.3 + c.luminosity * 0.4);

    // Node light source parameters — PRIMARY spatial luminosity driver.
    const nodeBrightness = lerp(2.0, 6.0, c.luminosity ** 1.2);
    const nodeRadius = lerp(2.5, 7.0, c.luminosity * 0.4 + c.depth * 0.3);

    // Fresnel
    const fresnelPower = lerp(2.0, 5.0, 1 - c.fracture * 0.3);
    const edgeGlowStrength = lerp(0.8, 2.5, c.fracture * 0.4 + c.luminosity * 0.3);

    // Edge fractalization
    const edgeFractalLevel = clamp01(c.fracture);
    const lightFractalLevel = clamp01(c.fracture * c.luminosity);

    // Shader enhancements
    const causticStrength = lerp(0.0, 0.5, c.fracture * c.luminosity);
    const iridescenceStrength = lerp(0.0, 0.3, c.fracture * 0.5 + c.luminosity * 0.3);

    // --- Atmosphere ---
    const fogDensity = lerp(0.01, 0.10, c.depth);
    const fogColor = pal.fogColor;
    const bgColor = pal.bgColor;
    const backgroundLightness = lerp(0.02, 0.06, c.luminosity);

    // --- Postprocessing (tuned for dramatic bloom) ---
    const bloomStrength = lerp(0.5, 1.3, c.luminosity);
    const bloomThreshold = lerp(0.35, 0.60, 1 - c.luminosity);
    const chromaticAberration = lerp(0.0, 0.004, c.fracture);
    const vignetteStrength = lerp(0.3, 0.7, 1 - c.luminosity);

    // --- Camera ---
    const cameraDistance = lerp(5, 10, 1 - c.depth * 0.3);
    const cameraOffsetX = (rng() * 2 - 1) * lerp(0.3, 1.0, 1 - c.coherence);
    const cameraOffsetY = (rng() * 2 - 1) * lerp(0.2, 0.8, 1 - c.coherence);
    const fov = lerp(50, 70, c.depth);

    return {
        planeCountPrimary,
        planeCountSecondary,
        planeCountMicro,
        planeSizeMu,
        planeSizeSigma,
        depthRange,
        depthBias,
        nodeCount,

        topologyMode,
        topologyCoherence,
        fieldFractalOctaves,
        fieldFractalAmplitude,

        baseHue,
        hueRange,
        saturation,
        lightness,
        opacity,
        emissiveStrength,
        fresnelPower,
        edgeGlowStrength,
        edgeFractalLevel,
        lightFractalLevel,
        causticStrength,
        iridescenceStrength,
        edgeColor: pal.edgeColor,

        nodeBrightness,
        nodeRadius,

        fogDensity,
        fogColor,
        bgColor,
        backgroundLightness,

        bloomStrength,
        bloomThreshold,
        chromaticAberration,
        vignetteStrength,

        cameraDistance,
        cameraOffsetX,
        cameraOffsetY,
        fov,
    };
}
