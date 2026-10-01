/**
 * Alt-text generation from controls.
 *
 * Output format:
 *   {brief summary, ≤140 chars}\n\nExpanded Description: {interpretive prose, ≤1000 chars}
 *
 * Hard cap: 2000 characters total.
 */

import type { Controls, SeedTag } from '../schemas.js';
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

function buildCoda(seed: SeedTag | undefined, controls: Controls, rng: () => number, l: Lang): string {
    let aFamily: number, sFamily: number, dFamily: number;

    if (seed == null) {
        // Without seed, pick random families (0-8)
        aFamily = Math.floor(rng() * CODA_ARRANGEMENT[l].length);
        sFamily = Math.floor(rng() * CODA_STRUCTURE[l].length);
        dFamily = Math.floor(rng() * CODA_DETAIL[l].length);
    } else {
        aFamily = Math.floor(seed[0] / 2);  // 0-8
        sFamily = Math.floor(seed[1] / 2);  // 0-8
        dFamily = Math.floor(seed[2] / 2);  // 0-8
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
    seed?: SeedTag,
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
