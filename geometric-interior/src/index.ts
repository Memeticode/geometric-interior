// Zod schemas (runtime values)
export {
    ControlsSchema,
    StillConfigSchema,
    ProfileSchema,
    AnimationSchema,
    SeedTagSchema,
    SeedSchema,
    PaletteDataSchema,
    RenderMetaSchema,
    CameraConfigSchema,
    ContentEventSchema,
    CameraStateSchema,
    CameraMoveSchema,
    ParamTrackSchema,
    FocusStateSchema,
    FocusTrackSchema,
    AnimationSettingsSchema,
    EasingTypeSchema,
    ImageAssetMetaSchema,
    AnimAssetMetaSchema,
    validateStillConfig,
} from './core/schemas.js';

// Core types (all from schemas)
export type {
    Controls,
    PaletteData,
    StillConfig,
    RenderMeta,
    Profile,
    ValidationResult,
    CameraConfig,
    SeedTag,
    Seed,
    ContentEvent,
    CameraState,
    CameraMove,
    ParamTrack,
    FocusState,
    FocusTrack,
    AnimationSettings,
    Animation,
    ImageAssetMeta,
    AnimAssetMeta,
} from './core/schemas.js';

// FrameState (internal type, lives in timeline)
export type { FrameState } from './core/timeline.js';

// SceneRngStreams (internal type, lives in seed-tags)
export type { SceneRngStreams } from './core/text-generation/seed-tags.js';

// Render engine data types (internal, unchanged)
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

// Config conversion
export { configToProfile, profileToConfig } from './core/config-schema.js';
export { deriveParams } from './core/params.js';

// Palettes
export { PALETTES, PRESETS } from './core/palettes.js';

// Utils — math, PRNG, easing, color
export { clamp01, lerp, controlLerp } from './utils/math.js';
export { xmur3, mulberry32 } from './utils/prng.js';
export { applyEasing, cosineEase, smootherstep, warpSegmentT, catmullRom, EASING_TYPES } from './utils/easing.js';
export type { EasingType } from './utils/easing.js';
export { hslToRgb01 } from './utils/color.js';

// Text generation
export { generateTitle } from './core/text-generation/title-text.js';
export { generateAltText, generateAnimAltText } from './core/text-generation/alt-text.js';

// Interpolation
export { evalControlsAt, TIME_WARP_STRENGTH } from './core/interpolation.js';

// Seed tags
export {
    parseSeed, createTagStreams, seedTagToLabel, serializeSeedTag, deserializeSeedTag,
    isSeedTag, seedToString, slotBias,
    ARRANGEMENT_WORDS, STRUCTURE_WORDS, DETAIL_WORDS, TAG_LIST_LENGTH,
} from './core/text-generation/seed-tags.js';

// Animation timeline
export { evaluateTimeline, totalDuration, totalFrames } from './core/timeline.js';
