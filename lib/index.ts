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
    SeedTag,
    Seed,
    SceneRngStreams,
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

// Seed tags
export {
    parseSeed, createTagStreams, seedTagToLabel, serializeSeedTag, deserializeSeedTag,
    isSeedTag, seedToString, slotBias,
    ARRANGEMENT_WORDS, STRUCTURE_WORDS, DETAIL_WORDS, TAG_LIST_LENGTH,
} from './core/seed-tags.js';

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
