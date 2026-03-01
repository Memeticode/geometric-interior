/**
 * Compositional seed tag system.
 *
 * Replaces arbitrary-string seeds with a 3-element numeric array
 * [arrangement, structure, detail] where each slot controls an
 * independent PRNG stream and subtle bias for its visual subsystem.
 */

import { xmur3, mulberry32 } from './prng.js';

// ── Types ──

export type SeedTag = [number, number, number];
export type Seed = string | SeedTag;

export interface SceneRngStreams {
    arrangementRng: () => number;
    structureRng: () => number;
    detailRng: () => number;
    arrangementBias: number;
    structureBias: number;
    detailBias: number;
}

// ── Word lists (perceptual spectra) ──

/** Slot 1 — Arrangement: still → turbulent */
export const ARRANGEMENT_WORDS = [
    'anchored', 'poised', 'centered', 'settled', 'resting', 'balanced',
    'drifting', 'leaning', 'shifting', 'flowing', 'turning', 'arcing',
    'swirling', 'rushing', 'scattering', 'diverging', 'spiraling', 'turbulent',
] as const;

/** Slot 2 — Structure: smooth → jagged */
export const STRUCTURE_WORDS = [
    'silken', 'draped', 'smooth', 'folded', 'layered', 'woven',
    'creased', 'pleated', 'angular', 'faceted', 'carved', 'fractured',
    'splintered', 'shattered', 'crystalline', 'serrated', 'bristling', 'jagged',
] as const;

/** Slot 3 — Detail: frozen → burning */
export const DETAIL_WORDS = [
    'frozen', 'glacial', 'still', 'cool', 'misty', 'dim',
    'dusky', 'neutral', 'mild', 'warm', 'glowing', 'bright',
    'vivid', 'radiant', 'blazing', 'molten', 'incandescent', 'burning',
] as const;

export const TAG_LIST_LENGTH = 18;

// ── Localized word tables (same pattern as text.ts) ──

const ARRANGEMENT_LABELS: Record<string, readonly string[]> = {
    en: [
        'Anchored', 'Poised', 'Centered', 'Settled', 'Resting', 'Balanced',
        'Drifting', 'Leaning', 'Shifting', 'Flowing', 'Turning', 'Arcing',
        'Swirling', 'Rushing', 'Scattering', 'Diverging', 'Spiraling', 'Turbulent',
    ],
    es: [
        'Anclado', 'Equilibrado', 'Centrado', 'Asentado', 'En Reposo', 'Balanceado',
        'A la Deriva', 'Inclinado', 'Cambiante', 'Fluido', 'Girando', 'Arqueado',
        'Arremolinado', 'Precipitado', 'Disperso', 'Divergente', 'En Espiral', 'Turbulento',
    ],
};

const STRUCTURE_LABELS: Record<string, readonly string[]> = {
    en: [
        'Silken', 'Draped', 'Smooth', 'Folded', 'Layered', 'Woven',
        'Creased', 'Pleated', 'Angular', 'Faceted', 'Carved', 'Fractured',
        'Splintered', 'Shattered', 'Crystalline', 'Serrated', 'Bristling', 'Jagged',
    ],
    es: [
        'Sedoso', 'Drapeado', 'Liso', 'Plegado', 'Estratificado', 'Tejido',
        'Arrugado', 'Plisado', 'Angular', 'Facetado', 'Tallado', 'Fracturado',
        'Astillado', 'Destrozado', 'Cristalino', 'Serrado', 'Erizado', 'Dentado',
    ],
};

const DETAIL_LABELS: Record<string, readonly string[]> = {
    en: [
        'Frozen', 'Glacial', 'Still', 'Cool', 'Misty', 'Dim',
        'Dusky', 'Neutral', 'Mild', 'Warm', 'Glowing', 'Bright',
        'Vivid', 'Radiant', 'Blazing', 'Molten', 'Incandescent', 'Burning',
    ],
    es: [
        'Congelado', 'Glacial', 'Quieto', 'Fresco', 'Brumoso', 'Tenue',
        'Crepuscular', 'Neutro', 'Suave', 'C\u00e1lido', 'Resplandeciente', 'Brillante',
        'V\u00edvido', 'Radiante', 'Ardiente', 'Fundido', 'Incandescente', 'Abrasador',
    ],
};

/** Get the three localized word arrays for a given locale. */
export function getLocalizedWords(locale: string = 'en') {
    return {
        arrangement: ARRANGEMENT_LABELS[locale] || ARRANGEMENT_LABELS.en,
        structure: STRUCTURE_LABELS[locale] || STRUCTURE_LABELS.en,
        detail: DETAIL_LABELS[locale] || DETAIL_LABELS.en,
    };
}

// ── Core functions ──

/** Compute bias parameter [0, 1] from a slot value. */
export function slotBias(slotValue: number): number {
    return slotValue / (TAG_LIST_LENGTH - 1);
}

/**
 * Parse a seed into a normalized SeedTag.
 * - If already a SeedTag array, clamp and round each slot.
 * - If a string, hash via xmur3 to produce 3 deterministic slot values.
 */
export function parseSeed(seed: Seed): SeedTag {
    if (Array.isArray(seed) && seed.length === 3) {
        return [
            Math.max(0, Math.min(TAG_LIST_LENGTH - 1, Math.round(seed[0]))),
            Math.max(0, Math.min(TAG_LIST_LENGTH - 1, Math.round(seed[1]))),
            Math.max(0, Math.min(TAG_LIST_LENGTH - 1, Math.round(seed[2]))),
        ];
    }
    const h = xmur3(String(seed));
    return [
        h() % TAG_LIST_LENGTH,
        h() % TAG_LIST_LENGTH,
        h() % TAG_LIST_LENGTH,
    ];
}

/**
 * Create three independent PRNG streams and bias values from a SeedTag.
 * Each slot gets its own prefixed hash so changing one slot only
 * re-randomizes its subsystem.
 */
export function createTagStreams(tag: SeedTag): SceneRngStreams {
    return {
        arrangementRng: mulberry32(xmur3('arr-' + tag[0])()),
        structureRng:   mulberry32(xmur3('str-' + tag[1])()),
        detailRng:      mulberry32(xmur3('det-' + tag[2])()),
        arrangementBias: slotBias(tag[0]),
        structureBias:   slotBias(tag[1]),
        detailBias:      slotBias(tag[2]),
    };
}

/** Convert a SeedTag to a localized display string: "settled, splintered, warm". */
export function seedTagToLabel(tag: SeedTag, locale: string = 'en'): string {
    const arr = ARRANGEMENT_LABELS[locale] || ARRANGEMENT_LABELS.en;
    const str = STRUCTURE_LABELS[locale] || STRUCTURE_LABELS.en;
    const det = DETAIL_LABELS[locale] || DETAIL_LABELS.en;
    const a = arr[tag[0]] || arr[0];
    const s = str[tag[1]] || str[0];
    const d = det[tag[2]] || det[0];
    // Capitalize first word
    return a.charAt(0).toUpperCase() + a.slice(1) + ', ' + s + ', ' + d;
}

/** Serialize a SeedTag for URL/storage: [3, 12, 8] → "3.12.8" */
export function serializeSeedTag(tag: SeedTag): string {
    return `${tag[0]}.${tag[1]}.${tag[2]}`;
}

/** Deserialize a SeedTag from a dot-separated string. Returns null if invalid. */
export function deserializeSeedTag(s: string): SeedTag | null {
    const parts = s.split('.');
    if (parts.length !== 3) return null;
    const nums = parts.map(Number);
    if (nums.some(n => Number.isNaN(n) || n < 0 || n >= TAG_LIST_LENGTH || n !== Math.floor(n))) return null;
    return nums as unknown as SeedTag;
}

/** Check whether a value is a SeedTag array. */
export function isSeedTag(seed: Seed): seed is SeedTag {
    return Array.isArray(seed) && seed.length === 3 && seed.every(n => typeof n === 'number');
}

/** Canonical string key for a seed (for hashing / title generation). */
export function seedToString(seed: Seed): string {
    return Array.isArray(seed) ? seed.join('.') : seed;
}
