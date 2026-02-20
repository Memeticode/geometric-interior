/**
 * Seamless animation interpolation: Catmull-Rom splines, time-warp, cosine easing.
 *
 * Interpolates continuous controls (density, luminosity, fracture, depth, coherence).
 * Discrete controls (topology, palette) use nearest-keyframe value.
 */

import { clamp01, lerp } from './prng.js';

export const TIME_WARP_STRENGTH = 0.78;

/** Numeric control keys that get smoothly interpolated. */
const NUMERIC_KEYS = ['density', 'luminosity', 'fracture', 'depth', 'coherence'];

/** Discrete control keys — use nearest keyframe value. */
const DISCRETE_KEYS = ['topology', 'palette'];

export function smootherstep(t) {
    t = clamp01(t);
    return t * t * t * (t * (t * 6 - 15) + 10);
}

export function warpSegmentT(t, strength) {
    const w = smootherstep(t);
    return lerp(t, w, clamp01(strength));
}

export function cosineEase(t) {
    return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

export function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
        (2 * p1) +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
}

/**
 * Evaluate interpolated controls at a normalized time position.
 * Landmarks should have a `.controls` property with both numeric and discrete keys.
 *
 * @param {number} tNorm - Normalized time [0, 1)
 * @param {Array<{controls: object}>} landmarks
 * @returns {object|null} Interpolated controls object
 */
export function evalControlsAt(tNorm, landmarks) {
    const n = landmarks.length;
    if (n < 2) return null;

    // Find nearest landmark for discrete values
    const nearestIdx = Math.round(tNorm * n) % n;
    const discrete = {};
    for (const key of DISCRETE_KEYS) {
        discrete[key] = landmarks[nearestIdx].controls[key];
    }

    if (n === 2) {
        const c0 = landmarks[0].controls;
        const c1 = landmarks[1].controls;

        const phase = (tNorm < 0.5) ? (tNorm * 2) : (2 - tNorm * 2);
        const warped = warpSegmentT(phase, TIME_WARP_STRENGTH * 0.55);
        const u = cosineEase(warped);

        const result = { ...discrete };
        for (const key of NUMERIC_KEYS) {
            result[key] = lerp(c0[key], c1[key], u);
        }
        return result;
    }

    const seg = tNorm * n;
    const i1 = Math.floor(seg) % n;
    const tLinear = seg - Math.floor(seg);

    const t = warpSegmentT(tLinear, TIME_WARP_STRENGTH);

    const i0 = (i1 - 1 + n) % n;
    const i2 = (i1 + 1) % n;
    const i3 = (i1 + 2) % n;

    const C0 = landmarks[i0].controls;
    const C1 = landmarks[i1].controls;
    const C2 = landmarks[i2].controls;
    const C3 = landmarks[i3].controls;

    const result = { ...discrete };
    for (const key of NUMERIC_KEYS) {
        result[key] = clamp01(catmullRom(C0[key], C1[key], C2[key], C3[key], t));
    }
    return result;
}

// Backward compatibility alias
export const evalAspectsAt = evalControlsAt;
