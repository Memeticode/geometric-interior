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

    // Per-face opacity: moderate so overlapping faces create translucent layers.
    // Edges boost alpha separately, so borders show through even on dim faces.
    const opacity = lerp(0.25, 0.50, c.density * 0.3 + c.luminosity * 0.4);

    // Ambient emissive: faint material texture (light comes from nodes, not self-emission)
    const emissiveStrength = lerp(0.5, 1.5, c.fracture * 0.3 + c.luminosity * 0.4);

    // Node light source parameters — PRIMARY luminosity driver.
    // Moderate brightness so shapes show color, not blown-out white.
    const nodeBrightness = lerp(2.0, 6.0, c.luminosity ** 1.2);
    const nodeRadius = lerp(3.5, 10.0, c.luminosity * 0.4 + c.depth * 0.3);

    // Fresnel
    const fresnelPower = lerp(2.0, 5.0, 1 - c.fracture * 0.3);
    const edgeGlowStrength = lerp(0.8, 2.5, c.fracture * 0.4 + c.luminosity * 0.3);

    // Edge fractalization
    const edgeFractalLevel = clamp01(c.fracture);
    const lightFractalLevel = clamp01(c.fracture * c.luminosity);

    // Shader enhancements
    const causticStrength = lerp(0.0, 0.5, c.fracture * c.luminosity);
    const iridescenceStrength = lerp(0.0, 0.3, c.fracture * 0.5 + c.luminosity * 0.3);

    // Edge borders (barycentric edge detection) — bright lines on mid-tone faces
    const edgeThickness = lerp(12.0, 40.0, c.fracture * 0.3 + 0.5);
    const edgeBrightness = lerp(1.5, 3.5, c.luminosity * 0.5 + 0.3);

    // Unfolding (adjacent face hinge rotation)
    const unfoldAmount = lerp(0.0, 0.8, c.fracture * 0.5 + 0.2);

    // --- Atmosphere ---
    const fogDensity = lerp(0.01, 0.10, c.depth);
    const fogColor = pal.fogColor;
    const bgColor = pal.bgColor;
    const backgroundLightness = lerp(0.02, 0.06, c.luminosity);

    // --- Postprocessing (bloom subtle enough to preserve color and edge detail) ---
    const bloomStrength = lerp(0.25, 0.65, c.luminosity);
    const bloomThreshold = lerp(0.45, 0.70, 1 - c.luminosity);
    const chromaticAberration = lerp(0.0, 0.004, c.fracture);
    const vignetteStrength = lerp(0.3, 0.7, 1 - c.luminosity);

    // --- Camera ---
    const cameraDistance = lerp(5, 10, 1 - c.depth * 0.3);
    const cameraOffsetX = (rng() * 2 - 1) * lerp(0.3, 1.0, 1 - c.coherence);
    const cameraOffsetY = (rng() * 2 - 1) * lerp(0.2, 0.8, 1 - c.coherence);
    const fov = lerp(50, 70, c.depth);

    return {
        density: c.density,
        fracture: c.fracture,
        luminosity: c.luminosity,
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
        edgeThickness,
        edgeBrightness,
        unfoldAmount,
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
