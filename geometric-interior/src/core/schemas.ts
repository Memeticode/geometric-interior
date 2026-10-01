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

/** RGB triple */
const rgbTriple = z.tuple([z.number(), z.number(), z.number()]);

// ──────────────────────────────────────
// Seed
// ──────────────────────────────────────

/** SeedTag: 3-element integer tuple, each in [0, TAG_LIST_LENGTH-1] */
export const SeedTagSchema = z.tuple([
    z.number().int().min(0).max(TAG_LIST_LENGTH - 1),
    z.number().int().min(0).max(TAG_LIST_LENGTH - 1),
    z.number().int().min(0).max(TAG_LIST_LENGTH - 1),
]);

/** Seed: either a non-empty string or a SeedTag */
export const SeedSchema = z.union([
    z.string().min(1),
    SeedTagSchema,
]);

// ──────────────────────────────────────
// Camera
// ──────────────────────────────────────

export const CameraConfigSchema = z.object({
    rotation: z.number().min(-180).max(180).default(0),
    elevation: z.number().min(-180).max(180).default(0),
    zoom: unit.default(0.5),
});

// ──────────────────────────────────────
// Controls (user-facing sliders)
// ──────────────────────────────────────

// Future topology ideas (removed — only flow-field was implemented):
// icosahedral, möbius, multi-attractor
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
// PaletteData
// ──────────────────────────────────────

export const PaletteDataSchema = z.object({
    label: z.string(),
    baseHue: z.number(),
    hueRange: z.number(),
    saturation: z.number(),
    fogColor: rgbTriple,
    bgColor: rgbTriple,
    edgeColor: rgbTriple,
    accentHue: z.number(),
});

// ──────────────────────────────────────
// StillConfig (canonical public config)
// ──────────────────────────────────────

export const StillConfigSchema = z.object({
    kind: z.literal('still-v2', { message: 'must be "still-v2"' }),
    name: z.string().max(40),
    intent: z.string().max(120).optional(),
    seedTag: SeedTagSchema.optional(),
    color: z.object({
        hue: unit,
        spectrum: unit,
        chroma: unit,
    }),
    structure: z.object({
        density: unit,
        luminosity: unit,
        bloom: unit.default(0.5),
        fracture: unit,
        coherence: unit,
        scale: unit.default(0.5),
        division: unit.default(0.5),
        faceting: unit.default(0.5),
        flow: unit.default(0.5),
    }),
    camera: CameraConfigSchema.optional(),
}).superRefine((data, ctx) => {
    // When seedTag is absent, intent is required and must be non-empty
    if (!data.seedTag) {
        if (typeof data.intent !== 'string' || !data.intent.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'required, must be a non-empty string',
                path: ['intent'],
            });
        }
    }
    // Validate name is non-empty after trimming
    if (!data.name.trim()) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'required, must be a non-empty string',
            path: ['name'],
        });
    }
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
// Profile (internal storage format)
// ──────────────────────────────────────

export const ProfileSchema = z.object({
    seed: SeedSchema,
    controls: ControlsSchema,
    camera: CameraConfigSchema.optional(),
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
    seed: SeedTagSchema,
    controls: ControlsSchema,
    camera: CameraConfigSchema.optional(),
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
    seed: SeedSchema,
    controls: ControlsSchema,
    camera: CameraConfigSchema.optional(),
    nodeCount: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
});

// ──────────────────────────────────────
// Inferred types
// ──────────────────────────────────────

export type SeedTag = z.infer<typeof SeedTagSchema>;
export type Seed = z.infer<typeof SeedSchema>;
export type CameraConfig = z.infer<typeof CameraConfigSchema>;
export type Controls = z.infer<typeof ControlsSchema>;
export type PaletteData = z.infer<typeof PaletteDataSchema>;
export type StillConfig = z.infer<typeof StillConfigSchema>;
export type RenderMeta = z.infer<typeof RenderMetaSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
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
// Validation wrapper (backward-compat)
// ──────────────────────────────────────

export function validateStillConfig(data: unknown): ValidationResult {
    const result = StillConfigSchema.safeParse(data);
    if (result.success) {
        return { ok: true, errors: [] };
    }
    const errors = result.error.issues.map(issue => {
        const path = issue.path.length > 0 ? issue.path.join('.') + ': ' : '';
        return path + issue.message;
    });
    return { ok: false, errors };
}
