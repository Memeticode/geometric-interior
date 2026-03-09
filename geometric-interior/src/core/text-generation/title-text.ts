/**
 * Procedural title generation from controls.
 */

import type { Controls } from '../schemas.js';
import { LUMINOSITY_WORDS, DENSITY_WORDS, SCALE_WORDS, getHueWords } from './word-tables.js';
import { pick } from '../../utils/prng.js';
import { tier } from '../../utils/string.js';

export function generateTitle(controls: Controls, rng: () => number, locale: string = 'en'): string {
    const c = controls;
    const lang = LUMINOSITY_WORDS[locale] ? locale : 'en';
    const hueWords = getHueWords(c.hue, lang);
    const lumWords = LUMINOSITY_WORDS[lang][tier(c.luminosity)];
    const scaleWords = SCALE_WORDS[lang][tier(c.scale)];
    const denWords = DENSITY_WORDS[lang][tier(c.density)];

    const templates = lang === 'es' ? [
        () => `${pick(hueWords, rng)} ${pick(scaleWords, rng)} ${pick(lumWords, rng)}`,
        () => `Interior ${pick(denWords, rng)} ${pick(lumWords, rng)}`,
        () => `Campo ${pick(denWords, rng)} ${pick(hueWords, rng)}`,
        () => `Geometría ${pick(scaleWords, rng)} ${pick(lumWords, rng)}`,
        () => `Variedad ${pick(hueWords, rng)} ${pick(lumWords, rng)}`,
        () => `Plano ${pick(denWords, rng)} ${pick(scaleWords, rng)}`,
        () => `Estructura ${pick(lumWords, rng)} ${pick(hueWords, rng)}`,
        () => `Retícula ${pick(scaleWords, rng)} ${pick(hueWords, rng)}`,
    ] : [
        () => `${pick(lumWords, rng)} ${pick(hueWords, rng)} ${pick(scaleWords, rng)}`,
        () => `${pick(lumWords, rng)} ${pick(denWords, rng)} Interior`,
        () => `${pick(hueWords, rng)} ${pick(denWords, rng)} Field`,
        () => `${pick(scaleWords, rng)} ${pick(lumWords, rng)} Geometry`,
        () => `${pick(lumWords, rng)} ${pick(hueWords, rng)} Manifold`,
        () => `${pick(denWords, rng)} ${pick(scaleWords, rng)} Plane`,
        () => `${pick(hueWords, rng)} ${pick(lumWords, rng)} Structure`,
        () => `${pick(scaleWords, rng)} ${pick(hueWords, rng)} Lattice`,
    ];

    return (templates[Math.floor(rng() * templates.length)])();
}
