/**
 * Render engine data types — geometry, lighting, and derived parameters.
 */

import type { Vector3, Color } from 'three';
import type { BgConfig } from './background.js';

/** Curve config per tier */
export interface CurveTierConfig {
    seedCount: number;
    maxCount: number;
    maxSteps: number;
    stepSize: number;
    curvature: number;
    minLength: number;
}

/** Chain config per tier */
export interface ChainTierConfig {
    chainLenBase: number;
    chainLenRange: number;
    scaleBase: number;
    scaleRange: number;
    spread: number;
    dualProb: number;
    spacing: number;
}

/** Dot generation config */
export interface DotConfig {
    heroDotCount: number;
    heroDotSpread: [number, number, number];
    heroDotRadiusBase: number;
    heroDotRadiusRange: number;
    heroDotGlowBase: number;
    heroDotGlowRange: number;
    mediumDotCount: number;
    mediumDotJitter: number;
    mediumDotRadiusBase: number;
    mediumDotRadiusRange: number;
    mediumDotGlowBase: number;
    mediumDotGlowRange: number;
    smallDotDensity: Record<string, number>;
    smallDotRadiusBase: number;
    smallDotRadiusRange: number;
    smallDotGlowBase: number;
    smallDotLightnessBase: number;
    smallDotLightnessRange: number;
    interiorDotCount: number;
    interiorDotSpread: [number, number, number];
    microDotCount: number;
    microDotSpread: [number, number, number];
    microDotRadiusBase: number;
    microDotRadiusRange: number;
    microDotGlowBase: number;
    microDotLightnessBase: number;
    microDotLightnessRange: number;
    dotBaseHue: number;
    microDotBaseHue: number;
}

/** Division parameters for envelope SDF */
export interface DivisionParams {
    grooveDepth: number;
    grooveWidth: number;
    secondaryGrooveDepth: number;
    secondaryGrooveAngle: number;
    noiseAmplitude: number;
}

/** Faceting parameters for folding chain geometry */
export interface FacetingParams {
    quadProbability: number;
    dihedralBase: number;
    dihedralRange: number;
    contractionBase: number;
    contractionRange: number;
}

/** Derived engine parameters from deriveParams() */
export interface DerivedParams {
    density: number;
    fracture: number;
    luminosity: number;
    baseHue: number;
    hueRange: number;
    saturation: number;
    bgConfig: BgConfig;
    bgColor: [number, number, number];
    fogColor: [number, number, number];
    envelopeRadii: [number, number, number];
    cameraZ: number;
    cameraFov: number;
    cameraOffsetX: number;
    cameraOffsetY: number;
    curveConfig: {
        primary: CurveTierConfig;
        secondary: CurveTierConfig;
        tertiary: CurveTierConfig;
    };
    chains: {
        primary: ChainTierConfig;
        secondary: ChainTierConfig;
        tertiary: ChainTierConfig;
    };
    edgeColorOffset: [number, number, number];
    edgeOpacityBase: number;
    edgeOpacityFadeScale: number;
    crackExtendScale: number;
    backLightFactor: number;
    illuminationCap: number;
    ambientLight: number;
    attenuationCoeff: number;
    frontLightFactor: number;
    edgeFadeThreshold: number;
    atmosphericCount: number;
    dotConfig: DotConfig;
    tendrilHueBase: number;
    tendrilHueRange: number;
    tendrilSatBase: number;
    tendrilSatRange: number;
    tendrilOpacity: { primary: number; other: number };
    bloomStrength: number;
    bloomThreshold: number;
    chromaticAberration: number;
    vignetteStrength: number;
    faceOpacityScale: number;
    flowScale: number;
    flowInfluence: number;
    flowType: number;
    colorFieldScale: number;
    divisionParams: DivisionParams;
    facetingParams: FacetingParams;
}

/** Glow point data for dot halos */
export interface GlowPointDatum {
    position: Vector3;
    size: number;
}

/** Light uniforms for face shader */
export interface LightUniforms {
    uLightPositions: { value: Vector3[] };
    uLightIntensities: { value: number[] };
    uLightCount: { value: number };
}

/** Dot position data with tier and intensity */
export interface DotPosition {
    pos: Vector3;
    tier?: string;
    intensity: number;
}

/** Sphere instance data for InstancedMesh */
export interface SphereInstDatum {
    position: Vector3;
    radius: number;
    color: Color;
}

/** Dot generation result */
export interface DotGenerationResult {
    sphereInstData: SphereInstDatum[];
    glowPointData: GlowPointDatum[];
    allDotPositions: DotPosition[];
    lightUniforms: LightUniforms;
}

/** Curve sample with frame */
export interface CurveSample {
    pos: Vector3;
    tangent: Vector3;
    normal: Vector3;
    binormal: Vector3;
}

/** Guide curve — Vector3 array with tier annotation */
export type GuideCurve = Vector3[] & { tier: string };

/** Dot matching result */
export interface DotMatching {
    matched: Array<{ fromIdx: number; toIdx: number }>;
    unmatchedFrom: number[];
    unmatchedTo: number[];
}

/** Batch accumulators for face and edge rendering */
export interface BatchAccumulators {
    faceAccum: {
        pos: number[];
        norm: number[];
        uv: number[];
        alpha: number[];
        color: number[];
        opacity: number[];
        noiseScale: number[];
        noiseStrength: number[];
        crackExtend: number[];
        foldDelay: number[];
        foldOrigin: number[];
    };
    edgeAccum: {
        pos: number[];
        alpha: number[];
        color: number[];
        opacity: number[];
        foldDelay: number[];
        foldOrigin: number[];
    };
}
