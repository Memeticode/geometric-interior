/**
 * Title and alt-text generation from controls.
 */

import { PALETTES, customPalette } from './palettes.js';
import type { Controls } from '../types.js';

const TOPOLOGY_WORDS: Record<string, string[]> = {
    'icosahedral': ['Faceted', 'Crystalline', 'Tessellated', 'Lattice'],
    'mobius': ['Twisted', 'Continuous', 'Möbius', 'Flowing'],
    'flow-field': ['Drifting', 'Curling', 'Streaming', 'Field'],
    'multi-attractor': ['Converging', 'Radiant', 'Tensioned', 'Nucleated'],
};

const PALETTE_WORDS: Record<string, string[]> = {
    'violet-depth': ['Violet', 'Amethyst', 'Deep Purple', 'Umbral'],
    'warm-spectrum': ['Warm', 'Golden', 'Ember', 'Solar'],
    'teal-volumetric': ['Teal', 'Oceanic', 'Cyan', 'Aqueous'],
    'prismatic': ['Prismatic', 'Iridescent', 'Spectral', 'Chromatic'],
    'crystal-lattice': ['Crystal', 'Silver', 'Frost', 'Glacial'],
    'sapphire': ['Sapphire', 'Cobalt', 'Azure', 'Ultramarine'],
    'amethyst': ['Amethyst', 'Magenta', 'Plum', 'Orchid'],
};

const HUE_WORD_MAP = [
    { max: 30,  words: ['Ruby', 'Crimson', 'Carmine', 'Scarlet'] },
    { max: 60,  words: ['Amber', 'Golden', 'Saffron', 'Topaz'] },
    { max: 90,  words: ['Chartreuse', 'Citrine', 'Peridot', 'Lime'] },
    { max: 150, words: ['Emerald', 'Jade', 'Viridian', 'Malachite'] },
    { max: 210, words: ['Cerulean', 'Teal', 'Aquamarine', 'Marine'] },
    { max: 270, words: ['Cobalt', 'Indigo', 'Lapis', 'Sapphire'] },
    { max: 330, words: ['Amethyst', 'Plum', 'Orchid', 'Mauve'] },
    { max: 361, words: ['Ruby', 'Crimson', 'Carmine', 'Scarlet'] },
];

function getCustomPaletteWords(): string[] {
    const hue = ((customPalette.baseHue ?? 180) % 360 + 360) % 360;
    return (HUE_WORD_MAP.find(e => hue < e.max) || HUE_WORD_MAP[0]).words;
}

const DENSITY_WORDS: Record<string, string[]> = {
    high: ['Dense', 'Layered', 'Complex', 'Saturated'],
    mid: ['Balanced', 'Structured', 'Composed', 'Measured'],
    low: ['Sparse', 'Minimal', 'Distilled', 'Essential'],
};

const DEPTH_WORDS: Record<string, string[]> = {
    high: ['Cavernous', 'Infinite', 'Abyssal', 'Receding'],
    mid: ['Spatial', 'Dimensional', 'Layered', 'Atmospheric'],
    low: ['Flat', 'Near', 'Intimate', 'Surface'],
};

const LUMINOSITY_WORDS: Record<string, string[]> = {
    high: ['Luminous', 'Radiant', 'Incandescent', 'Blazing'],
    mid: ['Glowing', 'Steady', 'Warm', 'Tempered'],
    low: ['Dark', 'Subdued', 'Dim', 'Shadowed'],
};

function pick(arr: string[], rng: () => number): string {
    return arr[Math.floor(rng() * arr.length)];
}

function tier(value: number): string {
    if (value > 0.66) return 'high';
    if (value > 0.33) return 'mid';
    return 'low';
}

export function generateTitle(controls: Controls, rng: () => number): string {
    const c = controls;
    const topoWords = TOPOLOGY_WORDS[c.topology] || TOPOLOGY_WORDS['flow-field'];
    const palWords = c.palette === 'custom' ? getCustomPaletteWords() : (PALETTE_WORDS[c.palette] || PALETTE_WORDS['violet-depth']);
    const lumWords = LUMINOSITY_WORDS[tier(c.luminosity)];
    const depWords = DEPTH_WORDS[tier(c.depth)];
    const denWords = DENSITY_WORDS[tier(c.density)];

    const templates = [
        () => `${pick(topoWords, rng)} ${pick(palWords, rng)} ${pick(depWords, rng)}`,
        () => `${pick(lumWords, rng)} ${pick(topoWords, rng)} Interior`,
        () => `${pick(palWords, rng)} ${pick(denWords, rng)} Field`,
        () => `${pick(depWords, rng)} ${pick(topoWords, rng)} Geometry`,
        () => `${pick(lumWords, rng)} ${pick(palWords, rng)} Manifold`,
        () => `${pick(topoWords, rng)} ${pick(denWords, rng)} Plane`,
        () => `${pick(palWords, rng)} ${pick(lumWords, rng)} Structure`,
        () => `${pick(depWords, rng)} ${pick(palWords, rng)} Lattice`,
    ];

    return (templates[Math.floor(rng() * templates.length)])();
}

export function generateAltText(controls: Controls, nodeCount: number, _title: string): string {
    const c = controls;
    const palLabel = c.palette === 'custom' ? 'Custom' : (PALETTES[c.palette]?.label || c.palette);

    const densityPhrase = c.density > 0.66
        ? 'densely layered translucent planes'
        : c.density > 0.33
        ? 'a balanced arrangement of crystalline planes'
        : 'sparse, carefully placed geometric shards';

    const depthPhrase = c.depth > 0.66
        ? 'deep spatial recession, planes disappearing into fog'
        : c.depth > 0.33
        ? 'moderate depth with atmospheric haze'
        : 'shallow depth, forms held close to the viewer';

    const luminosityPhrase = c.luminosity > 0.66
        ? 'bright emissive glow radiating from within each form'
        : c.luminosity > 0.33
        ? 'a steady, tempered luminescence'
        : 'subdued lighting, forms barely emerging from darkness';

    const fracturePhrase = c.fracture > 0.66
        ? 'heavily fractured edges and splintered micro-shards'
        : c.fracture > 0.33
        ? 'moderately textured edges with occasional fragmentation'
        : 'clean, smooth edges maintaining geometric purity';

    const coherencePhrase = c.coherence > 0.66
        ? 'tightly following the governing topology'
        : c.coherence > 0.33
        ? 'loosely organized around structural attractors'
        : 'scattered freely with minimal structural constraint';

    const topoName: Record<string, string> = {
        'icosahedral': 'an icosahedral lattice',
        'mobius': 'a Möbius ribbon manifold',
        'flow-field': 'a curl noise flow field',
        'multi-attractor': 'multiple energy attractors',
    };

    return [
        `A dark field carries ${densityPhrase}, organized around ${topoName[c.topology] || 'a generative topology'} in the ${palLabel} palette.`,
        `The composition shows ${depthPhrase}, with ${luminosityPhrase}.`,
        `Planes exhibit ${fracturePhrase}, ${coherencePhrase}.`,
        `${nodeCount} energy nodes anchor the structure, creating focal points of concentrated light.`,
        `Translucent polygonal forms overlap with additive blending, Fresnel-brightened edges catching the light at oblique angles.`,
    ].join('\n');
}

/* ── Animation alt-text ── */

const CONTROL_KEYS: (keyof Controls)[] = ['density', 'luminosity', 'fracture', 'depth', 'coherence'];

const DYNAMIC_PHRASES: Record<string, string> = {
    density: 'plane density shifts, the field filling and emptying',
    luminosity: 'light swells and dims, energy arriving and receding',
    fracture: 'edges sharpen and smooth, fragmentation breathing',
    depth: 'space deepens and flattens, fog advancing and retreating',
    coherence: 'structure tightens and loosens, order questioning itself',
};

const STABLE_PHRASES: Record<string, string> = {
    density: 'structural density holds steady',
    luminosity: 'luminosity persists unchanged',
    fracture: 'edge complexity stays constant',
    depth: 'spatial depth remains fixed',
    coherence: 'topological coherence is maintained',
};

const TRANSITION_VERBS: Record<string, { rises: string; falls: string }> = {
    density: { rises: 'planes accumulating', falls: 'geometry thinning' },
    luminosity: { rises: 'light arriving', falls: 'glow receding' },
    fracture: { rises: 'edges shattering', falls: 'forms smoothing' },
    depth: { rises: 'space deepening', falls: 'depth collapsing' },
    coherence: { rises: 'structure crystallizing', falls: 'order dissolving' },
};

export function generateAnimAltText(
    landmarks: Array<{ name: string; controls: Controls }>,
    durationSecs: number,
    keyframeTexts: Array<{ name: string; title: string }>,
): string {
    const n = landmarks.length;

    const ranges: Record<string, { min: number; max: number; spread: number }> = {};
    for (const key of CONTROL_KEYS) {
        const values = landmarks.map(l => l.controls[key] as number);
        const min = Math.min(...values);
        const max = Math.max(...values);
        ranges[key] = { min, max, spread: max - min };
    }

    const DYNAMIC_THRESHOLD = 0.15;
    const dynamicKeys = (CONTROL_KEYS as string[])
        .filter(k => ranges[k].spread >= DYNAMIC_THRESHOLD)
        .sort((a, b) => ranges[b].spread - ranges[a].spread);
    const stableKeys = (CONTROL_KEYS as string[])
        .filter(k => ranges[k].spread < DYNAMIC_THRESHOLD);

    const parts: string[] = [];

    parts.push(
        `A ${durationSecs}-second loop cycles through ${n} landmark${n !== 1 ? 's' : ''}, each a crystalline geometry of light and structure.`
    );

    if (dynamicKeys.length > 0) {
        const phrases = dynamicKeys.map(k => DYNAMIC_PHRASES[k]);
        parts.push(`Across the cycle, ${phrases.join('; ')}.`);
    }

    if (stableKeys.length > 0 && stableKeys.length < CONTROL_KEYS.length) {
        const phrases = stableKeys.map(k => STABLE_PHRASES[k]);
        parts.push(`Throughout, ${phrases.join('; ')}.`);
    }

    if (n >= 2) {
        const transitions: string[] = [];
        for (let i = 0; i < n; i++) {
            const from = landmarks[i];
            const to = landmarks[(i + 1) % n];
            const fromTitle = keyframeTexts[i]?.title || from.name;
            const toTitle = keyframeTexts[(i + 1) % n]?.title || to.name;

            let maxDelta = 0, maxKey: string = CONTROL_KEYS[0];
            for (const key of CONTROL_KEYS) {
                const delta = Math.abs((to.controls[key] as number) - (from.controls[key] as number));
                if (delta > maxDelta) { maxDelta = delta; maxKey = key; }
            }

            const direction: 'rises' | 'falls' = (to.controls[maxKey as keyof Controls] as number) > (from.controls[maxKey as keyof Controls] as number) ? 'rises' : 'falls';
            const verb = TRANSITION_VERBS[maxKey]?.[direction] || 'the field shifting';
            transitions.push(`from \u201c${fromTitle}\u201d to \u201c${toTitle}\u201d: ${verb}`);
        }
        parts.push(`The journey moves ${transitions.join('; ')}.`);
    }

    parts.push(
        'The geometry completes its cycle, translucent planes overlapping without collapsing, ' +
        'returning to where it began, subtly changed by having moved.'
    );

    return parts.join('\n');
}
