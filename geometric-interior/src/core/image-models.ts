/**
 * Public API types for still image configuration and profiles.
 */

import type { Seed } from './text-generation/seed-tags.js';

/** @deprecated — kept for profile migration only */
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
    // Color axes
    hue: number;          // 0-1: dominant hue (maps to 0-360°)
    spectrum: number;     // 0-1: hue range (monochrome → prismatic)
    chroma: number;       // 0-1: color intensity (gray → vivid)
    // Geometric form
    density: number;      // 0-1: element count / population
    fracture: number;     // 0-1: scatter / fragmentation
    coherence: number;    // 0-1: flow alignment / organization
    // Light
    luminosity: number;   // 0-1: brightness / energy
    bloom: number;        // 0-1: emanation / light spread
    // New geometric dimensions
    scale: number;        // 0-1: size distribution (monumental → atmospheric)
    division: number;     // 0-1: form topology (1 lobe → 2 → 3)
    faceting: number;     // 0-1: shard character (broad/flat → sharp/angular)
    flow: number;         // 0-1: field pattern (radial → noise → orbital)
}

/** @deprecated — kept for profile migration only */
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
    kind: 'still' | 'still-v2';
    name: string;
    intent: string;
    /** Compositional seed tag (3-element numeric array) — alternative to string intent */
    seedTag?: [number, number, number];
    /** @deprecated v1 format — use `color` instead */
    palette?: {
        hue: number;
        range: number;
        saturation: number;
    };
    /** v2 format — continuous color axes */
    color?: {
        hue: number;
        spectrum: number;
        chroma: number;
    };
    structure: {
        density: number;
        luminosity: number;
        fracture: number;
        /** @deprecated v1 format — removed in v2 */
        depth?: number;
        coherence: number;
        scale?: number;
        division?: number;
        faceting?: number;
        flow?: number;
        bloom?: number;
    };
    camera?: { zoom: number; rotation: number; elevation?: number };
}

/** Render metadata returned by renderWith() */
export interface RenderMeta {
    title: string;
    altText: string;
    nodeCount: number;
}

/** Internal profile format used by the app for storage */
export interface Profile {
    seed: Seed;
    controls: Controls;
    camera?: { zoom: number; rotation: number; elevation?: number };
}

/** Validation result */
export interface ValidationResult {
    ok: boolean;
    errors: string[];
}
