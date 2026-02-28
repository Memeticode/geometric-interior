// Types
export type {
    Controls,
    PaletteData,
    StillConfig,
    RenderMeta,
    Renderer,
    RendererOptions,
    DerivedParams,
    Profile,
    ValidationResult,
    DotConfig,
    CurveTierConfig,
    ChainTierConfig,
    SceneBuildResult,
    SceneRefs,
    GlowPointDatum,
    LightUniforms,
    DotPosition,
    DotMatching,
    BatchAccumulators,
    CurveSample,
    GuideCurve,
} from './types.js';

// Renderer
export { createRenderer } from './engine/create-renderer.js';

// Config
export { validateStillConfig, configToProfile, profileToConfig } from './core/config-schema.js';
export { deriveParams } from './core/params.js';

// Palettes
export { PALETTES, PRESETS, hslToRgb01 } from './core/palettes.js';

// Text generation
export { generateTitle, generateAltText, generateAnimAltText } from './core/text.js';

// Interpolation
export { cosineEase, catmullRom, evalControlsAt, evalAspectsAt, smootherstep, warpSegmentT, TIME_WARP_STRENGTH } from './core/interpolation.js';

// PRNG utilities
export { xmur3, mulberry32, clamp01, lerp, controlLerp } from './core/prng.js';
