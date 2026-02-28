/**
 * Title and alt-text generation from controls.
 * Supports locale-specific word tables and templates.
 */

import type { Controls } from '../types.js';

/* ── Word tables ── */

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

/** Hue-based color words (replaces palette-based lookup). */
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

function getHueWords(hue01: number, locale: string = 'en'): string[] {
    const hueDeg = ((hue01 * 360) % 360 + 360) % 360;
    const map = HUE_WORD_MAP[locale] || HUE_WORD_MAP.en;
    return (map.find(e => hueDeg < e.max) || map[0]).words;
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

const SCALE_WORDS: Record<string, Record<string, string[]>> = {
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
    const hueWords = getHueWords(c.hue, lang);
    const lumWords = LUMINOSITY_WORDS[lang][tier(c.luminosity)];
    const scaleWords = SCALE_WORDS[lang][tier(c.scale)];
    const denWords = DENSITY_WORDS[lang][tier(c.density)];

    const templates = lang === 'es' ? [
        () => `${pick(hueWords, rng)} ${pick(topoWords, rng)} ${pick(scaleWords, rng)}`,
        () => `Interior ${pick(topoWords, rng)} ${pick(lumWords, rng)}`,
        () => `Campo ${pick(denWords, rng)} ${pick(hueWords, rng)}`,
        () => `Geometría ${pick(topoWords, rng)} ${pick(scaleWords, rng)}`,
        () => `Variedad ${pick(hueWords, rng)} ${pick(lumWords, rng)}`,
        () => `Plano ${pick(topoWords, rng)} ${pick(denWords, rng)}`,
        () => `Estructura ${pick(lumWords, rng)} ${pick(hueWords, rng)}`,
        () => `Retícula ${pick(scaleWords, rng)} ${pick(hueWords, rng)}`,
    ] : [
        () => `${pick(topoWords, rng)} ${pick(hueWords, rng)} ${pick(scaleWords, rng)}`,
        () => `${pick(lumWords, rng)} ${pick(topoWords, rng)} Interior`,
        () => `${pick(hueWords, rng)} ${pick(denWords, rng)} Field`,
        () => `${pick(scaleWords, rng)} ${pick(topoWords, rng)} Geometry`,
        () => `${pick(lumWords, rng)} ${pick(hueWords, rng)} Manifold`,
        () => `${pick(topoWords, rng)} ${pick(denWords, rng)} Plane`,
        () => `${pick(hueWords, rng)} ${pick(lumWords, rng)} Structure`,
        () => `${pick(scaleWords, rng)} ${pick(hueWords, rng)} Lattice`,
    ];

    return (templates[Math.floor(rng() * templates.length)])();
}

export function generateAltText(controls: Controls, nodeCount: number, _title: string, locale: string = 'en'): string {
    const c = controls;
    const lang = locale === 'es' ? 'es' : 'en';
    const hueLabel = getHueWords(c.hue, lang)[0];

    if (lang === 'es') {
        const densityPhrase = c.density > 0.66
            ? 'planos translúcidos densamente superpuestos'
            : c.density > 0.33
            ? 'una disposición equilibrada de planos cristalinos'
            : 'fragmentos geométricos dispersos, cuidadosamente ubicados';

        const scalePhrase = c.scale > 0.66
            ? 'partículas atmosféricas finas llenando el espacio'
            : c.scale > 0.33
            ? 'profundidad moderada con bruma atmosférica'
            : 'formas monumentales amplias dominando la composición';

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
            `Un campo oscuro alberga ${densityPhrase}, organizados alrededor de ${topoName[c.topology] || 'una topología generativa'} en tonos ${hueLabel.toLowerCase()}.`,
            `La composición muestra ${scalePhrase}, con ${luminosityPhrase}.`,
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

    const scalePhrase = c.scale > 0.66
        ? 'fine atmospheric particles filling the space'
        : c.scale > 0.33
        ? 'moderate depth with atmospheric haze'
        : 'broad monumental forms dominating the composition';

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
        `A dark field carries ${densityPhrase}, organized around ${topoName[c.topology] || 'a generative topology'} in ${hueLabel.toLowerCase()} tones.`,
        `The composition shows ${scalePhrase}, with ${luminosityPhrase}.`,
        `Planes exhibit ${fracturePhrase}, ${coherencePhrase}.`,
        `${nodeCount} energy nodes anchor the structure, creating focal points of concentrated light.`,
        `Translucent polygonal forms overlap with additive blending, Fresnel-brightened edges catching the light at oblique angles.`,
    ].join('\n');
}

/* ── Animation alt-text ── */

const CONTROL_KEYS: (keyof Controls)[] = ['density', 'luminosity', 'fracture', 'coherence', 'scale', 'division', 'faceting'];

const DYNAMIC_PHRASES: Record<string, Record<string, string>> = {
    en: {
        density: 'plane density shifts, the field filling and emptying',
        luminosity: 'light swells and dims, energy arriving and receding',
        fracture: 'edges sharpen and smooth, fragmentation breathing',
        coherence: 'structure tightens and loosens, order questioning itself',
        scale: 'forms shift between monumental and atmospheric',
        division: 'the envelope splits and reunites, topology breathing',
        faceting: 'crystal faces broaden and sharpen, geometry reshaping',
        flow: 'the directional field shifts between radial, turbulent, and orbital patterns',
    },
    es: {
        density: 'la densidad de planos cambia, el campo llenándose y vaciándose',
        luminosity: 'la luz crece y mengua, la energía llegando y retrocediendo',
        fracture: 'los bordes se afilan y suavizan, la fragmentación respirando',
        coherence: 'la estructura se tensa y relaja, el orden cuestionándose a sí mismo',
        scale: 'las formas oscilan entre lo monumental y lo atmosférico',
        division: 'la envolvente se divide y reúne, la topología respirando',
        faceting: 'las caras cristalinas se amplían y agudizan, la geometría reformándose',
        flow: 'el campo direccional cambia entre patrones radiales, turbulentos y orbitales',
    },
};

const STABLE_PHRASES: Record<string, Record<string, string>> = {
    en: {
        density: 'structural density holds steady',
        luminosity: 'luminosity persists unchanged',
        fracture: 'edge complexity stays constant',
        coherence: 'topological coherence is maintained',
        scale: 'scale distribution remains fixed',
        division: 'form topology holds steady',
        faceting: 'crystal character stays constant',
        flow: 'directional field pattern holds steady',
    },
    es: {
        density: 'la densidad estructural se mantiene estable',
        luminosity: 'la luminosidad persiste sin cambios',
        fracture: 'la complejidad de los bordes permanece constante',
        coherence: 'la coherencia topológica se preserva',
        scale: 'la distribución de escala se mantiene fija',
        division: 'la topología de forma se mantiene estable',
        faceting: 'el carácter cristalino permanece constante',
        flow: 'el patrón del campo direccional se mantiene estable',
    },
};

const TRANSITION_VERBS: Record<string, Record<string, { rises: string; falls: string }>> = {
    en: {
        density: { rises: 'planes accumulating', falls: 'geometry thinning' },
        luminosity: { rises: 'light arriving', falls: 'glow receding' },
        fracture: { rises: 'edges shattering', falls: 'forms smoothing' },
        coherence: { rises: 'structure crystallizing', falls: 'order dissolving' },
        scale: { rises: 'forms scattering', falls: 'forms consolidating' },
        division: { rises: 'envelope splitting', falls: 'form reuniting' },
        faceting: { rises: 'faces sharpening', falls: 'panels broadening' },
        flow: { rises: 'field orbiting', falls: 'field radiating' },
    },
    es: {
        density: { rises: 'planos acumulándose', falls: 'geometría adelgazándose' },
        luminosity: { rises: 'luz llegando', falls: 'resplandor retrocediendo' },
        fracture: { rises: 'bordes fragmentándose', falls: 'formas suavizándose' },
        coherence: { rises: 'estructura cristalizándose', falls: 'orden disolviéndose' },
        scale: { rises: 'formas dispersándose', falls: 'formas consolidándose' },
        division: { rises: 'envolvente dividiéndose', falls: 'forma reuniéndose' },
        faceting: { rises: 'caras afilándose', falls: 'paneles ensanchándose' },
        flow: { rises: 'campo orbitando', falls: 'campo irradiando' },
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
