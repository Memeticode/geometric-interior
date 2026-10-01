// Zod schemas (runtime values)
export {
    ControlsSchema,
    ImageConfigSchema,
    SeedTagSchema,
    RenderMetaSchema,
    CameraConfigSchema,
    ImageAssetMetaSchema,
    validateImageConfig,
} from './core/schemas.js';

// Core types (all from schemas)
export type {
    Controls,
    ImageConfig,
    RenderMeta,
    ValidationResult,
    CameraConfig,
    SeedTag,
    ImageAssetMeta,
} from './core/schemas.js';

// Renderer types
export type { Renderer, RendererOptions } from './render-engine/interfaces.js';
export type { DerivedParams } from './render-engine/models.js';

// Renderer
export { createRenderer } from './render-engine/create-renderer.js';

// Params
export { deriveParams } from './core/params.js';

// Utils — math, PRNG, color
export { clamp01, lerp, controlLerp } from './utils/math.js';
export { xmur3, mulberry32 } from './utils/prng.js';
export { hslToRgb01 } from './utils/color.js';

// Text generation
export { generateTitle } from './core/text-generation/title-text.js';
export { generateAltText } from './core/text-generation/alt-text.js';

// Seed tags
export {
    createTagStreams, seedTagToLabel, serializeSeedTag, deserializeSeedTag, slotBias,
    ARRANGEMENT_WORDS, STRUCTURE_WORDS, DETAIL_WORDS, TAG_LIST_LENGTH,
} from './core/text-generation/seed-tags.js';
