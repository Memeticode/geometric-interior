/**
 * Zod schemas — single source of truth for all boundary types.
 *
 * Types are derived via z.infer<> and re-exported for consumers.
 * Internal types (DerivedParams, SceneRngStreams, etc.)
 * remain as plain TS interfaces in their respective files.
 */

import { z } from 'zod';
import { TAG_LIST_LENGTH } from './text-generation/seed-tags.js';

// ──────────────────────────────────────
// Primitives / building blocks
// ──────────────────────────────────────

/** Number in [0, 1] */
const unit = z.number().min(0).max(1);

// ──────────────────────────────────────
// Seed
// ──────────────────────────────────────

/** SeedTag: 3-element integer tuple, each in [0, TAG_LIST_LENGTH-1] */
export const SeedTagSchema = z.tuple([
    z.number().int().min(0).max(TAG_LIST_LENGTH - 1),
    z.number().int().min(0).max(TAG_LIST_LENGTH - 1),
    z.number().int().min(0).max(TAG_LIST_LENGTH - 1),
]);

// ──────────────────────────────────────
// Camera
// ──────────────────────────────────────

/** zoom: 0 = far, 1 = close; 0.375 is the default framing. Angles in degrees. */
export const CameraConfigSchema = z.object({
    zoom: unit.default(0.375),
    rotation: z.number().min(-180).max(180).default(0),
    elevation: z.number().min(-180).max(180).default(0),
});

// ──────────────────────────────────────
// Controls (user-facing sliders)
// ──────────────────────────────────────

export const ControlsSchema = z.object({
    hue: unit.default(0.5),
    spectrum: unit.default(0.5),
    chroma: unit.default(0.5),
    density: unit.default(0.5),
    fracture: unit.default(0.5),
    coherence: unit.default(0.5),
    luminosity: unit.default(0.5),
    bloom: unit.default(0.5),
    scale: unit.default(0.5),
    division: unit.default(0.5),
    faceting: unit.default(0.5),
    flow: unit.default(0.5),
});

// ──────────────────────────────────────
// ImageConfig — everything that determines a rendered image
// ──────────────────────────────────────

export const ImageConfigSchema = z.object({
    seed: SeedTagSchema,
    controls: ControlsSchema,
    camera: CameraConfigSchema,
});

// ──────────────────────────────────────
// RenderMeta
// ──────────────────────────────────────

export const RenderMetaSchema = z.object({
    title: z.string(),
    altText: z.string(),
    nodeCount: z.number().int().nonnegative(),
});

// ──────────────────────────────────────
// Starter profiles (curated gallery data)
// ──────────────────────────────────────

export const StarterGeneratedSchema = z.object({
    title: z.string(),
    'alt-text': z.string(),
});

export const StarterPortraitSchema = z.object({
    name: z.string(),
    commentary: z.string().optional(),
    config: ImageConfigSchema,
    generated: StarterGeneratedSchema,
});

export const StarterSectionSchema = z.object({
    name: z.string(),
    portraits: z.record(z.string(), StarterPortraitSchema),
});

export const StarterProfilesSchema = z.object({
    'section-order': z.array(z.string()),
    sections: z.record(z.string(), StarterSectionSchema),
});

// ──────────────────────────────────────
// Asset metadata (formalizes IndexedDB storage)
// ──────────────────────────────────────

export const ImageAssetMetaSchema = z.object({
    title: z.string(),
    altText: z.string(),
    commentary: z.string().default(''),
    config: ImageConfigSchema,
    nodeCount: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
});

// ──────────────────────────────────────
// Inferred types
// ──────────────────────────────────────

export type SeedTag = z.infer<typeof SeedTagSchema>;
export type CameraConfig = z.infer<typeof CameraConfigSchema>;
export type Controls = z.infer<typeof ControlsSchema>;
export type ImageConfig = z.infer<typeof ImageConfigSchema>;
export type RenderMeta = z.infer<typeof RenderMetaSchema>;
export type StarterGenerated = z.infer<typeof StarterGeneratedSchema>;
export type StarterPortrait = z.infer<typeof StarterPortraitSchema>;
export type StarterSection = z.infer<typeof StarterSectionSchema>;
export type StarterProfiles = z.infer<typeof StarterProfilesSchema>;
export type ImageAssetMeta = z.infer<typeof ImageAssetMetaSchema>;

// ──────────────────────────────────────
// ValidationResult — plain type (output format, not validated data)
// ──────────────────────────────────────

export interface ValidationResult {
    ok: boolean;
    errors: string[];
}

// ──────────────────────────────────────
// Validation wrapper
// ──────────────────────────────────────

export function validateImageConfig(data: unknown): ValidationResult {
    const result = ImageConfigSchema.safeParse(data);
    if (result.success) {
        return { ok: true, errors: [] };
    }
    const errors = result.error.issues.map(issue => {
        const path = issue.path.length > 0 ? issue.path.join('.') + ': ' : '';
        return path + issue.message;
    });
    return { ok: false, errors };
}
