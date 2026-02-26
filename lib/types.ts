import type { Vector3, ShaderMaterial, LineBasicMaterial, Points, Mesh, LineSegments, InstancedMesh, MeshBasicMaterial } from 'three';

/** Palette identifier — union of built-in names + 'custom' */
export type PaletteKey =
    | 'violet-depth'
    | 'warm-spectrum'
    | 'teal-volumetric'
    | 'prismatic'
    | 'crystal-lattice'
    | 'sapphire'
    | 'amethyst'
    | 'custom';

/** User-facing control sliders (all 0-1 range) */
export interface Controls {
    topology: 'flow-field';
    palette: PaletteKey;
    density: number;
    luminosity: number;
    fracture: number;
    depth: number;
    coherence: number;
}

/** Palette color tweaks */
export interface PaletteTweaks {
    baseHue: number;
    hueRange: number;
    saturation: number;
}

/** Resolved palette data (computed from PaletteKey + PaletteTweaks) */
export interface PaletteData {
    label: string;
    baseHue: number;
    hueRange: number;
    saturation: number;
    fogColor: [number, number, number];
    bgColor: [number, number, number];
    edgeColor: [number, number, number];
    accentHue: number;
}

/** Canonical still image configuration (public API type) */
export interface StillConfig {
    kind: 'still';
    name: string;
    intent: string;
    palette: {
        hue: number;
        range: number;
        saturation: number;
    };
    structure: {
        density: number;
        luminosity: number;
        fracture: number;
        depth: number;
        coherence: number;
    };
}

/** Render metadata returned by renderWith() */
export interface RenderMeta {
    title: string;
    altText: string;
    nodeCount: number;
}

/** Renderer instance returned by createRenderer() */
export interface Renderer {
    renderWith(seed: string, controls: Controls): RenderMeta;
    morphPrepare(seedA: string, controlsA: Controls, seedB: string, controlsB: Controls,
        paletteTweaksA?: Record<string, PaletteTweaks>, paletteTweaksB?: Record<string, PaletteTweaks>): void;
    morphUpdate(t: number): void;
    morphEnd(): void;
    resize(width: number, height: number): void;
    syncSize(): void;
    setDPR(dpr: number): void;
    dispose(): void;
    getCanvas(): HTMLCanvasElement | OffscreenCanvas;
}

export interface RendererOptions {
    dpr?: number;
}

/** Internal profile format used by the app for storage */
export interface Profile {
    seed: string;
    controls: Controls;
    paletteTweaks: PaletteTweaks;
}

/** Validation result */
export interface ValidationResult {
    ok: boolean;
    errors: string[];
}

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

/** Derived engine parameters from deriveParams() */
export interface DerivedParams {
    density: number;
    fracture: number;
    luminosity: number;
    baseHue: number;
    hueRange: number;
    saturation: number;
    bgInnerColor: [number, number, number];
    bgOuterColor: [number, number, number];
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
}

/** Scene build result refs for morph transitions */
export interface SceneRefs {
    glowPoints: Points | null;
    glowMat: ShaderMaterial | null;
    sphereInst: InstancedMesh | null;
    sphereMat: MeshBasicMaterial | null;
    faceMesh: Mesh | null;
    faceMat: ShaderMaterial | null;
    edgeLines: LineSegments | null;
    edgeMat: ShaderMaterial | null;
    tendrilLines: LineSegments | null;
    tendrilMat: LineBasicMaterial | null;
    glowPointData: GlowPointDatum[];
    lightUniforms: LightUniforms;
}

export interface SceneBuildResult {
    nodeCount: number;
    faceCount: number;
    refs: SceneRefs;
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
    color: import('three').Color;
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
    };
    edgeAccum: {
        pos: number[];
        alpha: number[];
        color: number[];
        opacity: number[];
    };
}
