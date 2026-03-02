/**
 * Shared word tables and helpers for title and alt-text generation.
 * Supports locale-specific word tables (en, es).
 */

export const TOPOLOGY_WORDS: Record<string, Record<string, string[]>> = {
    en: {
        'icosahedral': ['Faceted', 'Crystalline', 'Tessellated', 'Lattice'],
        'mobius': ['Twisted', 'Continuous', 'Möbius', 'Flowing'],
        'flow-field': ['Drifting', 'Curling', 'Streaming', 'Field'],
        'multi-attractor': ['Converging', 'Radiant', 'Tensioned', 'Nucleated'],
    },
    es: {
        'icosahedral': ['Facetado', 'Cristalino', 'Teselado', 'Reticular'],
        'mobius': ['Torcido', 'Continuo', 'Möbius', 'Fluido'],
        'flow-field': ['Ondulante', 'Serpenteante', 'Fluyente', 'Errante'],
        'multi-attractor': ['Convergente', 'Radiante', 'Tensionado', 'Nucleado'],
    },
};

/** Hue-based color words (replaces palette-based lookup). */
export const HUE_WORD_MAP: Record<string, Array<{ max: number; words: string[] }>> = {
    en: [
        { max: 30,  words: ['Ruby', 'Crimson', 'Carmine', 'Scarlet'] },
        { max: 60,  words: ['Amber', 'Golden', 'Saffron', 'Topaz'] },
        { max: 90,  words: ['Chartreuse', 'Citrine', 'Peridot', 'Lime'] },
        { max: 150, words: ['Emerald', 'Jade', 'Viridian', 'Malachite'] },
        { max: 210, words: ['Cerulean', 'Teal', 'Aquamarine', 'Marine'] },
        { max: 270, words: ['Cobalt', 'Indigo', 'Lapis', 'Sapphire'] },
        { max: 330, words: ['Amethyst', 'Plum', 'Orchid', 'Mauve'] },
        { max: 361, words: ['Ruby', 'Crimson', 'Carmine', 'Scarlet'] },
    ],
    es: [
        { max: 30,  words: ['Rubí', 'Carmesí', 'Carmín', 'Escarlata'] },
        { max: 60,  words: ['Ámbar', 'Dorado', 'Azafrán', 'Topacio'] },
        { max: 90,  words: ['Chartreuse', 'Citrino', 'Peridoto', 'Lima'] },
        { max: 150, words: ['Esmeralda', 'Jade', 'Viridiano', 'Malaquita'] },
        { max: 210, words: ['Cerúleo', 'Turquesa', 'Aguamarina', 'Marino'] },
        { max: 270, words: ['Cobalto', 'Índigo', 'Lapislázuli', 'Zafiro'] },
        { max: 330, words: ['Amatista', 'Ciruela', 'Orquídea', 'Malva'] },
        { max: 361, words: ['Rubí', 'Carmesí', 'Carmín', 'Escarlata'] },
    ],
};

export function getHueWords(hue01: number, locale: string = 'en'): string[] {
    const hueDeg = ((hue01 * 360) % 360 + 360) % 360;
    const map = HUE_WORD_MAP[locale] || HUE_WORD_MAP.en;
    return (map.find(e => hueDeg < e.max) || map[0]).words;
}

export const DENSITY_WORDS: Record<string, Record<string, string[]>> = {
    en: {
        high: ['Dense', 'Layered', 'Complex', 'Saturated'],
        mid: ['Balanced', 'Structured', 'Composed', 'Measured'],
        low: ['Sparse', 'Minimal', 'Distilled', 'Essential'],
    },
    es: {
        high: ['Denso', 'Estratificado', 'Complejo', 'Saturado'],
        mid: ['Equilibrado', 'Estructurado', 'Compuesto', 'Mesurado'],
        low: ['Disperso', 'Mínimo', 'Destilado', 'Esencial'],
    },
};

export const SCALE_WORDS: Record<string, Record<string, string[]>> = {
    en: {
        high: ['Atmospheric', 'Particulate', 'Granular', 'Scattered'],
        mid: ['Spatial', 'Dimensional', 'Layered', 'Tempered'],
        low: ['Monumental', 'Grand', 'Sweeping', 'Expansive'],
    },
    es: {
        high: ['Atmosférico', 'Particulado', 'Granular', 'Disperso'],
        mid: ['Espacial', 'Dimensional', 'Estratificado', 'Templado'],
        low: ['Monumental', 'Grandioso', 'Amplio', 'Expansivo'],
    },
};

export const LUMINOSITY_WORDS: Record<string, Record<string, string[]>> = {
    en: {
        high: ['Luminous', 'Radiant', 'Incandescent', 'Blazing'],
        mid: ['Glowing', 'Steady', 'Warm', 'Tempered'],
        low: ['Dark', 'Subdued', 'Dim', 'Shadowed'],
    },
    es: {
        high: ['Luminoso', 'Radiante', 'Incandescente', 'Fulgurante'],
        mid: ['Resplandeciente', 'Sereno', 'Cálido', 'Templado'],
        low: ['Oscuro', 'Tenue', 'Sombrío', 'Ensombrecido'],
    },
};

export function pick(arr: string[], rng: () => number): string {
    return arr[Math.floor(rng() * arr.length)];
}

export function tier(value: number): string {
    if (value > 0.66) return 'high';
    if (value > 0.33) return 'mid';
    return 'low';
}
