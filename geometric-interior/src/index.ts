// Zod schemas (runtime values)
export {
    ControlsSchema,
    StillConfigSchema,
    ProfileSchema,
    SeedTagSchema,
    SeedSchema,
    PaletteDataSchema,
    RenderMetaSchema,
    CameraConfigSchema,
    ImageAssetMetaSchema,
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
    ImageAssetMeta,
} from './core/schemas.js';

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
    BatchAccumulators,
    CurveSample,
    GuideCurve,
} from './render-engine/models.js';

// Render engine interfaces
export type {
    Renderer,
    RendererOptions,
    SceneBuildResult,
} from './render-engine/interfaces.js';

// Renderer
export { createRenderer } from './render-engine/create-renderer.js';

// Config conversion
export { configToProfile, profileToConfig } from './core/config-schema.js';
export { deriveParams } from './core/params.js';

// Palettes
export { PALETTES, PRESETS } from './core/palettes.js';

// Utils — math, PRNG, color
export { clamp01, lerp, controlLerp } from './utils/math.js';
export { xmur3, mulberry32 } from './utils/prng.js';
export { hslToRgb01 } from './utils/color.js';

// Text generation
export { generateTitle } from './core/text-generation/title-text.js';
export { generateAltText } from './core/text-generation/alt-text.js';

// Seed tags
export {
    parseSeed, createTagStreams, seedTagToLabel, serializeSeedTag, deserializeSeedTag,
    isSeedTag, seedToString, slotBias,
    ARRANGEMENT_WORDS, STRUCTURE_WORDS, DETAIL_WORDS, TAG_LIST_LENGTH,
} from './core/text-generation/seed-tags.js';
