/**
 * Procedural title generation from controls.
 */

import type { Controls } from '../image-models.js';
import { TOPOLOGY_WORDS, LUMINOSITY_WORDS, DENSITY_WORDS, SCALE_WORDS, getHueWords } from './word-tables.js';
import { pick } from '../../utils/prng.js';
import { tier } from '../../utils/string.js';

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
