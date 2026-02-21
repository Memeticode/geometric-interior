/**
 * Statistical distribution samplers for controlled randomness.
 * All functions take an rng() → [0,1) as first argument.
 */

/**
 * Log-normal distribution — produces few large values, many small.
 * Used for plane sizes.
 */
export function logNormal(rng, mu = 0, sigma = 1) {
    // Box-Muller transform
    const u1 = Math.max(1e-10, rng());
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.exp(mu + sigma * z);
}

/**
 * Power-law distribution in [min, max] with exponent.
 * Higher exponent = more values near min.
 * Used for depth distribution.
 */
export function powerLaw(rng, min, max, exponent = 2) {
    const u = rng();
    return min + (max - min) * Math.pow(u, exponent);
}

/**
 * Gaussian (normal) distribution via Box-Muller.
 * Used for orientation jitter.
 */
export function gaussian(rng, mean = 0, stddev = 1) {
    const u1 = Math.max(1e-10, rng());
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + stddev * z;
}
