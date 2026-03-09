/**
 * Alt-text generation from controls.
 *
 * Output format:
 *   {brief summary, ≤140 chars}\n\nExpanded Description: {interpretive prose, ≤1000 chars}
 *
 * Hard cap: 2000 characters total.
 */

import type { Controls, Seed } from '../schemas.js';
import { parseSeed } from './seed-tags.js';
import { getHueWords } from './word-tables.js';
import { injectColor } from '../../utils/string.js';
import { createTextRng, pickGraded, pickOne, gradedIndex, truncateAt, joinSentences } from './alt-text-engine.js';
import {
    SUM_DENSITY, SUM_FACETING, SUM_SCALE, SUM_ARRANGEMENT, SUM_BLOOM,
    SCENE_LUM, SCENE_BLOOM,
    GEO_FORM, GEO_FACETING, GEO_SPATIAL, GEO_DIVISION,
    COLOR_PHRASE, LIGHT_POINTS,
    CODA_ARRANGEMENT, CODA_STRUCTURE, CODA_DETAIL,
    CODA_BRIDGE, CODA_INFLECTION,
} from './alt-text-banks.js';

/* ── Helpers ── */

type Lang = 'en' | 'es';

function lang(locale: string): Lang { return locale === 'es' ? 'es' : 'en'; }

function hueAdj(hue01: number, l: Lang): string {
    return getHueWords(hue01, l)[0].toLowerCase();
}

/** 3-level index (low / mid / high) for cross-product banks. */
function tier3(v: number): number {
    if (v < 0.33) return 0;
    if (v < 0.67) return 1;
    return 2;
}

/** Map coherence (3 levels) × flow (3 levels) into a 0-8 index. */
function spatialIndex(coherence: number, flow: number): number {
    return tier3(coherence) * 3 + tier3(flow);
}

/** Map chroma (3 levels) × spectrum (3 levels) into a 0-8 index. */
function colorIndex(chroma: number, spectrum: number): number {
    return tier3(chroma) * 3 + tier3(spectrum);
}

/** Division: low (<0.30) = 0, mid = 1, high (>0.70) = 2. */
function divisionTier(v: number): number {
    if (v < 0.30) return 0;
    if (v > 0.70) return 2;
    return 1;
}

/* ── Summary builder ── */

function buildSummary(c: Controls, nodeCount: number, rng: () => number, l: Lang): string {
    const density = pickGraded(SUM_DENSITY[l], c.density, rng);
    const faceting = pickGraded(SUM_FACETING[l], c.faceting, rng);
    const scale = pickGraded(SUM_SCALE[l], c.scale, rng);
    const arrIdx = spatialIndex(c.coherence, c.flow);
    const arrangement = pickOne(SUM_ARRANGEMENT[l][arrIdx], rng);
    const bloom = pickGraded(SUM_BLOOM[l], c.bloom, rng);

    // Color word: depends on chroma level
    const chromaTier = tier3(c.chroma);
    let colorWord: string;
    if (chromaTier === 0) {
        colorWord = l === 'es' ? 'acromáticas' : 'achromatic';
    } else {
        colorWord = hueAdj(c.hue, l);
    }

    // Build with node count guaranteed near the front to survive truncation.
    if (l === 'es') {
        return `${nodeCount} puntos luminosos anclan ${density} ${scale} geométricas ${faceting} en ${colorWord} que ${arrangement} contra la oscuridad, ${bloom}.`;
    }

    return `${nodeCount} luminous points anchor ${density} ${faceting} ${colorWord} geometric ${scale} that ${arrangement} against darkness, ${bloom}.`;
}

/* ── Expanded description builders ── */

function buildScene(c: Controls, rng: () => number, l: Lang): string {
    const lum = pickGraded(SCENE_LUM[l], c.luminosity, rng);
    const bloom = pickGraded(SCENE_BLOOM[l], c.bloom, rng);
    return lum + bloom + '.';
}

function buildGeometry(c: Controls, rng: () => number, l: Lang): string {
    // density (5 levels) × fracture (3 levels) = 15 combos
    const dIdx = gradedIndex(c.density, 5);
    const fIdx = tier3(c.fracture);
    const formIdx = dIdx * 3 + fIdx;
    const form = pickOne(GEO_FORM[l][formIdx], rng);
    const faceting = pickOne(GEO_FACETING[l][gradedIndex(c.faceting, 5)], rng);

    const spatial = pickOne(GEO_SPATIAL[l][spatialIndex(c.coherence, c.flow)], rng);

    const divTier = divisionTier(c.division);
    const division = pickOne(GEO_DIVISION[l][divTier], rng);

    return joinSentences(form + faceting + '.', spatial + division);
}

function buildColor(c: Controls, nodeCount: number, rng: () => number, l: Lang): string {
    const cIdx = colorIndex(c.chroma, c.spectrum);
    const colorRaw = pickOne(COLOR_PHRASE[l][cIdx], rng);
    const color = injectColor(colorRaw, hueAdj(c.hue, l));

    // Light points phrase: bloom drives the bank (5 levels)
    const lightRaw = pickGraded(LIGHT_POINTS[l], c.bloom, rng);
    const light = lightRaw.replace(/\{N\}/g, String(nodeCount));

    return joinSentences(color, light);
}

/** Map a 0-8 family index into one of 3 meta-groups. */
function metaGroup(family9: number): number {
    if (family9 < 3) return 0;
    if (family9 < 6) return 1;
    return 2;
}

/**
 * Check for a parameter-sensitive inflection that should replace the
 * bridge phrase. Returns null if no parameter is extreme enough.
 *
 * Pair inflections checked first (more specific = higher priority),
 * then single-parameter inflections. First match wins.
 */
function paramInflection(c: Controls, rng: () => number, l: Lang): string | null {
    const checks: Array<{ key: string; test: boolean }> = [
        // Pair inflections — two simultaneous extremes
        { key: 'darkBloom',    test: c.luminosity < 0.15 && c.bloom > 0.70 },
        { key: 'darkJewel',    test: c.luminosity < 0.15 && c.bloom < 0.20 },
        { key: 'chaosStorm',   test: c.coherence < 0.20 && c.fracture > 0.65 },
        { key: 'sparseOrder',  test: c.density < 0.06 && c.coherence > 0.80 },
        { key: 'vividMono',    test: c.chroma > 0.70 && c.spectrum < 0.25 },
        { key: 'denseChaos',   test: c.density > 0.25 && c.coherence < 0.25 },
        // Single-parameter inflections
        { key: 'coherenceHigh', test: c.coherence > 0.88 },
        { key: 'coherenceLow',  test: c.coherence < 0.12 },
        { key: 'luminosityLow', test: c.luminosity < 0.08 },
        { key: 'bloomHigh',     test: c.bloom > 0.88 },
        { key: 'densityHigh',   test: c.density > 0.85 },
    ];
    for (const { key, test } of checks) {
        if (test) return pickOne(CODA_INFLECTION[key][l][0], rng);
    }
    return null;
}

function buildCoda(seed: Seed | undefined, controls: Controls, rng: () => number, l: Lang): string {
    let aFamily: number, sFamily: number, dFamily: number;

    if (seed == null) {
        // Without seed, pick random families (0-8)
        aFamily = Math.floor(rng() * CODA_ARRANGEMENT[l].length);
        sFamily = Math.floor(rng() * CODA_STRUCTURE[l].length);
        dFamily = Math.floor(rng() * CODA_DETAIL[l].length);
    } else {
        const tag = parseSeed(seed);
        aFamily = Math.floor(tag[0] / 2);  // 0-8
        sFamily = Math.floor(tag[1] / 2);  // 0-8
        dFamily = Math.floor(tag[2] / 2);  // 0-8
    }

    const arrangement = pickOne(CODA_ARRANGEMENT[l][aFamily], rng);
    const structure = pickOne(CODA_STRUCTURE[l][sFamily], rng);
    const detail = pickOne(CODA_DETAIL[l][dFamily], rng);

    // Bridge: parameter inflection overrides cross-slot bridge when active
    const inflection = paramInflection(controls, rng, l);
    const bridgeIdx = metaGroup(aFamily) * 3 + metaGroup(dFamily);
    const bridge = inflection ?? pickOne(CODA_BRIDGE[l][bridgeIdx], rng);

    // Lowercase the detail opening so it flows from the bridge's comma.
    const detailLower = detail.charAt(0).toLowerCase() + detail.slice(1);
    return arrangement + structure + bridge + ' ' + detailLower;
}

/* ── Main entry point ── */

const SUMMARY_MAX = 140;
const EXPANDED_MAX = 1000;
const HARD_CAP = 2000;

export function generateAltText(
    controls: Controls,
    nodeCount: number,
    _title: string,
    locale: string = 'en',
    seed?: Seed,
): string {
    const l = lang(locale);
    const rng = createTextRng(controls, nodeCount, seed);

    // Brief summary
    let summary = buildSummary(controls, nodeCount, rng, l);
    summary = truncateAt(summary, SUMMARY_MAX);

    // Expanded description sentences
    const scene = buildScene(controls, rng, l);
    const geometry = buildGeometry(controls, rng, l);
    const color = buildColor(controls, nodeCount, rng, l);
    const coda = buildCoda(seed, controls, rng, l);

    const prefix = l === 'es' ? 'Descripción Ampliada: ' : 'Expanded Description: ';
    let expanded = joinSentences(scene, geometry, color, coda);
    expanded = truncateAt(expanded, EXPANDED_MAX - prefix.length);

    let result = summary + '\n\n' + prefix + expanded;
    if (result.length > HARD_CAP) {
        result = truncateAt(result, HARD_CAP);
    }

    return result;
}

/* ── Animation alt-text (preserved, uses original phrase tables) ── */

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
    const l = lang(locale);

    const ranges: Record<string, { min: number; max: number; spread: number }> = {};
    for (const key of CONTROL_KEYS) {
        const values = landmarks.map(lm => lm.controls[key] as number);
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

    if (l === 'es') {
        parts.push(
            `Un bucle de ${durationSecs} segundos recorre ${n} punto${n !== 1 ? 's' : ''} de referencia, cada uno una geometría cristalina de luz y estructura.`
        );

        if (dynamicKeys.length > 0) {
            const phrases = dynamicKeys.map(k => DYNAMIC_PHRASES[l][k]);
            parts.push(`A lo largo del ciclo, ${phrases.join('; ')}.`);
        }

        if (stableKeys.length > 0 && stableKeys.length < CONTROL_KEYS.length) {
            const phrases = stableKeys.map(k => STABLE_PHRASES[l][k]);
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
                const verb = TRANSITION_VERBS[l][maxKey]?.[direction] || 'el campo transformándose';
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
            const phrases = dynamicKeys.map(k => DYNAMIC_PHRASES[l][k]);
            parts.push(`Across the cycle, ${phrases.join('; ')}.`);
        }

        if (stableKeys.length > 0 && stableKeys.length < CONTROL_KEYS.length) {
            const phrases = stableKeys.map(k => STABLE_PHRASES[l][k]);
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
                const verb = TRANSITION_VERBS[l][maxKey]?.[direction] || 'the field shifting';
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
