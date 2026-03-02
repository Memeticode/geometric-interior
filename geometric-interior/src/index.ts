// Core image/config types
export type {
    Controls,
    PaletteData,
    StillConfig,
    RenderMeta,
    Profile,
    ValidationResult,
} from './core/image-models.js';

// Seed types
export type { SeedTag, Seed, SceneRngStreams } from './core/text-generation/seed-tags.js';

// Render engine data types
export type {
    DerivedParams,
    DotConfig,
    CurveTierConfig,
    ChainTierConfig,
    GlowPointDatum,
    LightUniforms,
    DotPosition,
    DotMatching,
    BatchAccumulators,
    CurveSample,
    GuideCurve,
} from './render-engine/models.js';

// Render engine interfaces
export type {
    Renderer,
    RendererOptions,
    SceneBuildResult,
    SceneRefs,
} from './render-engine/interfaces.js';

// Renderer
export { createRenderer } from './render-engine/create-renderer.js';

// Config
export { validateStillConfig, configToProfile, profileToConfig } from './core/config-schema.js';
export { deriveParams } from './core/params.js';

// Palettes
export { PALETTES, PRESETS, hslToRgb01 } from './core/palettes.js';

// Text generation
export { generateTitle } from './core/text-generation/title-text.js';
export { generateAltText, generateAnimAltText } from './core/text-generation/alt-text.js';

// Interpolation
export { cosineEase, catmullRom, evalControlsAt, evalAspectsAt, smootherstep, warpSegmentT, TIME_WARP_STRENGTH } from './core/interpolation.js';

// PRNG utilities
export { xmur3, mulberry32, clamp01, lerp, controlLerp } from './core/prng.js';

// Seed tags
export {
    parseSeed, createTagStreams, seedTagToLabel, serializeSeedTag, deserializeSeedTag,
    isSeedTag, seedToString, slotBias,
    ARRANGEMENT_WORDS, STRUCTURE_WORDS, DETAIL_WORDS, TAG_LIST_LENGTH,
} from './core/text-generation/seed-tags.js';

// Animation timeline
export { evaluateTimeline, totalDuration, totalFrames } from './core/timeline.js';
export { applyEasing } from './core/easing.js';
export type {
    EasingType,
    ContentEvent,
    CameraState,
    CameraMove,
    ParamTrack,
    FocusState,
    FocusTrack,
    AnimationSettings,
    Animation,
    FrameState,
} from './core/timeline.js';
