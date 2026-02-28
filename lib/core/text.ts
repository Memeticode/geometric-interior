/**
 * Title and alt-text generation from controls.
 * Supports locale-specific word tables and templates.
 */

import { PALETTES, customPalette } from './palettes.js';
import type { Controls } from '../types.js';

/* ── English word tables ── */

const TOPOLOGY_WORDS: Record<string, Record<string, string[]>> = {
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

const PALETTE_WORDS: Record<string, Record<string, string[]>> = {
    en: {
        'violet-depth': ['Violet', 'Amethyst', 'Deep Purple', 'Umbral'],
        'warm-spectrum': ['Warm', 'Golden', 'Ember', 'Solar'],
        'teal-volumetric': ['Teal', 'Oceanic', 'Cyan', 'Aqueous'],
        'prismatic': ['Prismatic', 'Iridescent', 'Spectral', 'Chromatic'],
        'crystal-lattice': ['Crystal', 'Silver', 'Frost', 'Glacial'],
        'sapphire': ['Sapphire', 'Cobalt', 'Azure', 'Ultramarine'],
        'amethyst': ['Amethyst', 'Magenta', 'Plum', 'Orchid'],
    },
    es: {
        'violet-depth': ['Violeta', 'Amatista', 'Púrpura', 'Umbral'],
        'warm-spectrum': ['Cálido', 'Dorado', 'Brasa', 'Solar'],
        'teal-volumetric': ['Turquesa', 'Oceánico', 'Cian', 'Acuoso'],
        'prismatic': ['Prismático', 'Iridiscente', 'Espectral', 'Cromático'],
        'crystal-lattice': ['Cristal', 'Argénteo', 'Escarcha', 'Glacial'],
        'sapphire': ['Zafiro', 'Cobalto', 'Azur', 'Ultramarino'],
        'amethyst': ['Amatista', 'Magenta', 'Ciruela', 'Orquídea'],
    },
};

const HUE_WORD_MAP: Record<string, Array<{ max: number; words: string[] }>> = {
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

function getCustomPaletteWords(locale: string = 'en'): string[] {
    const hue = ((customPalette.baseHue ?? 180) % 360 + 360) % 360;
    const map = HUE_WORD_MAP[locale] || HUE_WORD_MAP.en;
    return (map.find(e => hue < e.max) || map[0]).words;
}

const DENSITY_WORDS: Record<string, Record<string, string[]>> = {
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

const DEPTH_WORDS: Record<string, Record<string, string[]>> = {
    en: {
        high: ['Cavernous', 'Infinite', 'Abyssal', 'Receding'],
        mid: ['Spatial', 'Dimensional', 'Layered', 'Atmospheric'],
        low: ['Flat', 'Near', 'Intimate', 'Surface'],
    },
    es: {
        high: ['Cavernoso', 'Infinito', 'Abisal', 'Distante'],
        mid: ['Espacial', 'Dimensional', 'Estratificado', 'Atmosférico'],
        low: ['Plano', 'Cercano', 'Íntimo', 'Superficial'],
    },
};

const LUMINOSITY_WORDS: Record<string, Record<string, string[]>> = {
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

function pick(arr: string[], rng: () => number): string {
    return arr[Math.floor(rng() * arr.length)];
}

function tier(value: number): string {
    if (value > 0.66) return 'high';
    if (value > 0.33) return 'mid';
    return 'low';
}

export function generateTitle(controls: Controls, rng: () => number, locale: string = 'en'): string {
    const c = controls;
    const lang = TOPOLOGY_WORDS[locale] ? locale : 'en';
    const topoWords = (TOPOLOGY_WORDS[lang][c.topology] || TOPOLOGY_WORDS[lang]['flow-field']);
    const palWords = c.palette === 'custom' ? getCustomPaletteWords(lang) : (PALETTE_WORDS[lang][c.palette] || PALETTE_WORDS[lang]['violet-depth']);
    const lumWords = LUMINOSITY_WORDS[lang][tier(c.luminosity)];
    const depWords = DEPTH_WORDS[lang][tier(c.depth)];
    const denWords = DENSITY_WORDS[lang][tier(c.density)];

    // Spanish uses noun-adjective order: "Interior Fluido Luminoso"
    const templates = lang === 'es' ? [
        () => `${pick(palWords, rng)} ${pick(topoWords, rng)} ${pick(depWords, rng)}`,
        () => `Interior ${pick(topoWords, rng)} ${pick(lumWords, rng)}`,
        () => `Campo ${pick(denWords, rng)} ${pick(palWords, rng)}`,
        () => `Geometría ${pick(topoWords, rng)} ${pick(depWords, rng)}`,
        () => `Variedad ${pick(palWords, rng)} ${pick(lumWords, rng)}`,
        () => `Plano ${pick(topoWords, rng)} ${pick(denWords, rng)}`,
        () => `Estructura ${pick(lumWords, rng)} ${pick(palWords, rng)}`,
        () => `Retícula ${pick(depWords, rng)} ${pick(palWords, rng)}`,
    ] : [
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

export function generateAltText(controls: Controls, nodeCount: number, _title: string, locale: string = 'en'): string {
    const c = controls;
    const lang = locale === 'es' ? 'es' : 'en';
    const palLabel = c.palette === 'custom'
        ? (lang === 'es' ? 'Personalizado' : 'Custom')
        : (PALETTES[c.palette]?.label || c.palette);

    if (lang === 'es') {
        const densityPhrase = c.density > 0.66
            ? 'planos translúcidos densamente superpuestos'
            : c.density > 0.33
            ? 'una disposición equilibrada de planos cristalinos'
            : 'fragmentos geométricos dispersos, cuidadosamente ubicados';

        const depthPhrase = c.depth > 0.66
            ? 'una profunda recesión espacial, planos desvaneciéndose en la niebla'
            : c.depth > 0.33
            ? 'profundidad moderada con bruma atmosférica'
            : 'profundidad somera, formas mantenidas cerca del espectador';

        const luminosityPhrase = c.luminosity > 0.66
            ? 'un brillo emisivo intenso irradiando desde el interior de cada forma'
            : c.luminosity > 0.33
            ? 'una luminiscencia serena y templada'
            : 'iluminación tenue, formas apenas emergiendo de la oscuridad';

        const fracturePhrase = c.fracture > 0.66
            ? 'bordes fuertemente fracturados y micro-fragmentos astillados'
            : c.fracture > 0.33
            ? 'bordes moderadamente texturizados con fragmentación ocasional'
            : 'bordes limpios y suaves que mantienen la pureza geométrica';

        const coherencePhrase = c.coherence > 0.66
            ? 'siguiendo estrechamente la topología rectora'
            : c.coherence > 0.33
            ? 'organizados libremente alrededor de atractores estructurales'
            : 'dispersos libremente con mínima restricción estructural';

        const topoName: Record<string, string> = {
            'icosahedral': 'una retícula icosaédrica',
            'mobius': 'una variedad de cinta de Möbius',
            'flow-field': 'un campo de flujo de ruido rizado',
            'multi-attractor': 'múltiples atractores de energía',
        };

        return [
            `Un campo oscuro alberga ${densityPhrase}, organizados alrededor de ${topoName[c.topology] || 'una topología generativa'} en la paleta ${palLabel}.`,
            `La composición muestra ${depthPhrase}, con ${luminosityPhrase}.`,
            `Los planos exhiben ${fracturePhrase}, ${coherencePhrase}.`,
            `${nodeCount} nodos de energía anclan la estructura, creando puntos focales de luz concentrada.`,
            `Formas poligonales translúcidas se superponen con mezcla aditiva, bordes con brillo Fresnel capturando la luz en ángulos oblicuos.`,
        ].join('\n');
    }

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

const DYNAMIC_PHRASES: Record<string, Record<string, string>> = {
    en: {
        density: 'plane density shifts, the field filling and emptying',
        luminosity: 'light swells and dims, energy arriving and receding',
        fracture: 'edges sharpen and smooth, fragmentation breathing',
        depth: 'space deepens and flattens, fog advancing and retreating',
        coherence: 'structure tightens and loosens, order questioning itself',
    },
    es: {
        density: 'la densidad de planos cambia, el campo llenándose y vaciándose',
        luminosity: 'la luz crece y mengua, la energía llegando y retrocediendo',
        fracture: 'los bordes se afilan y suavizan, la fragmentación respirando',
        depth: 'el espacio se profundiza y aplana, la niebla avanzando y retrocediendo',
        coherence: 'la estructura se tensa y relaja, el orden cuestionándose a sí mismo',
    },
};

const STABLE_PHRASES: Record<string, Record<string, string>> = {
    en: {
        density: 'structural density holds steady',
        luminosity: 'luminosity persists unchanged',
        fracture: 'edge complexity stays constant',
        depth: 'spatial depth remains fixed',
        coherence: 'topological coherence is maintained',
    },
    es: {
        density: 'la densidad estructural se mantiene estable',
        luminosity: 'la luminosidad persiste sin cambios',
        fracture: 'la complejidad de los bordes permanece constante',
        depth: 'la profundidad espacial se mantiene fija',
        coherence: 'la coherencia topológica se preserva',
    },
};

const TRANSITION_VERBS: Record<string, Record<string, { rises: string; falls: string }>> = {
    en: {
        density: { rises: 'planes accumulating', falls: 'geometry thinning' },
        luminosity: { rises: 'light arriving', falls: 'glow receding' },
        fracture: { rises: 'edges shattering', falls: 'forms smoothing' },
        depth: { rises: 'space deepening', falls: 'depth collapsing' },
        coherence: { rises: 'structure crystallizing', falls: 'order dissolving' },
    },
    es: {
        density: { rises: 'planos acumulándose', falls: 'geometría adelgazándose' },
        luminosity: { rises: 'luz llegando', falls: 'resplandor retrocediendo' },
        fracture: { rises: 'bordes fragmentándose', falls: 'formas suavizándose' },
        depth: { rises: 'espacio profundizándose', falls: 'profundidad colapsando' },
        coherence: { rises: 'estructura cristalizándose', falls: 'orden disolviéndose' },
    },
};

export function generateAnimAltText(
    landmarks: Array<{ name: string; controls: Controls }>,
    durationSecs: number,
    keyframeTexts: Array<{ name: string; title: string }>,
    locale: string = 'en',
): string {
    const n = landmarks.length;
    const lang = locale === 'es' ? 'es' : 'en';

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

    if (lang === 'es') {
        parts.push(
            `Un bucle de ${durationSecs} segundos recorre ${n} punto${n !== 1 ? 's' : ''} de referencia, cada uno una geometría cristalina de luz y estructura.`
        );

        if (dynamicKeys.length > 0) {
            const phrases = dynamicKeys.map(k => DYNAMIC_PHRASES[lang][k]);
            parts.push(`A lo largo del ciclo, ${phrases.join('; ')}.`);
        }

        if (stableKeys.length > 0 && stableKeys.length < CONTROL_KEYS.length) {
            const phrases = stableKeys.map(k => STABLE_PHRASES[lang][k]);
            parts.push(`Mientras tanto, ${phrases.join('; ')}.`);
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
                const verb = TRANSITION_VERBS[lang][maxKey]?.[direction] || 'el campo transformándose';
                transitions.push(`de \u201c${fromTitle}\u201d a \u201c${toTitle}\u201d: ${verb}`);
            }
            parts.push(`El recorrido avanza ${transitions.join('; ')}.`);
        }

        parts.push(
            'La geometría completa su ciclo, planos translúcidos superponiéndose sin colapsar, ' +
            'regresando a donde comenzó, sutilmente transformada por haberse movido.'
        );
    } else {
        parts.push(
            `A ${durationSecs}-second loop cycles through ${n} landmark${n !== 1 ? 's' : ''}, each a crystalline geometry of light and structure.`
        );

        if (dynamicKeys.length > 0) {
            const phrases = dynamicKeys.map(k => DYNAMIC_PHRASES[lang][k]);
            parts.push(`Across the cycle, ${phrases.join('; ')}.`);
        }

        if (stableKeys.length > 0 && stableKeys.length < CONTROL_KEYS.length) {
            const phrases = stableKeys.map(k => STABLE_PHRASES[lang][k]);
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
                const verb = TRANSITION_VERBS[lang][maxKey]?.[direction] || 'the field shifting';
                transitions.push(`from \u201c${fromTitle}\u201d to \u201c${toTitle}\u201d: ${verb}`);
            }
            parts.push(`The journey moves ${transitions.join('; ')}.`);
        }

        parts.push(
            'The geometry completes its cycle, translucent planes overlapping without collapsing, ' +
            'returning to where it began, subtly changed by having moved.'
        );
    }

    return parts.join('\n');
}
