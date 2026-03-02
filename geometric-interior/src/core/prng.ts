/**
 * Deterministic PRNG and math utilities.
 */

export function xmur3(str: string): () => number {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return function () {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h ^= h >>> 16;
        return h >>> 0;
    };
}

export function mulberry32(a: number): () => number {
    return function () {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function clamp01(x: number): number { return Math.max(0, Math.min(1, x)); }

export function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

/**
 * Asymmetric lerp: t=0 → lo, t=0.5 → mid (exact), t=1 → hi.
 * Used for slider parameterization where mid is the demo default.
 */
export function controlLerp(t: number, lo: number, mid: number, hi: number): number {
    t = clamp01(t);
    return t < 0.5
        ? lo + (mid - lo) * (t * 2)
        : mid + (hi - mid) * ((t - 0.5) * 2);
}
