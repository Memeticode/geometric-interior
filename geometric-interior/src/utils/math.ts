/**
 * Pure scalar math utilities.
 */

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

/** Box-Muller Gaussian random using any rng function. */
export function gaussianRandom(rng: () => number, mean = 0, stdev = 1): number {
    const u = 1 - rng();
    const v = rng();
    return mean + stdev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/** Gaussian falloff: exp(-rate * d^2). */
export function computeFade(dist: number, decayRate: number): number {
    return Math.exp(-decayRate * dist * dist);
}

/** Triangle face normal from a flat positions array (9 floats: 3 vertices × xyz). */
export function computeNormal(positions: number[]): [number, number, number] {
    const e1x = positions[3] - positions[0];
    const e1y = positions[4] - positions[1];
    const e1z = positions[5] - positions[2];
    const e2x = positions[6] - positions[0];
    const e2y = positions[7] - positions[1];
    const e2z = positions[8] - positions[2];
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 0) { nx /= len; ny /= len; nz /= len; }
    return [nx, ny, nz];
}
