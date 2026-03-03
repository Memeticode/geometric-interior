/**
 * Easing and interpolation curve utilities.
 */

import { clamp01, lerp } from './math.js';

export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

/** Apply an easing function to a normalized time value. */
export function applyEasing(t: number, easing: EasingType): number {
    t = clamp01(t);
    switch (easing) {
        case 'linear':
            return t;
        case 'ease-in':
            return t * t * t;
        case 'ease-out':
            return 1 - (1 - t) * (1 - t) * (1 - t);
        case 'ease-in-out':
            return t < 0.5
                ? 4 * t * t * t
                : 1 - Math.pow(-2 * t + 2, 3) / 2;
        default:
            return t;
    }
}

export function cosineEase(t: number): number {
    return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

export function smootherstep(t: number): number {
    t = clamp01(t);
    return t * t * t * (t * (t * 6 - 15) + 10);
}

export function warpSegmentT(t: number, strength: number): number {
    const w = smootherstep(t);
    return lerp(t, w, clamp01(strength));
}

export function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
        (2 * p1) +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
}

/** Circular lerp on [0, period) domain. */
export function circularLerp(a: number, b: number, t: number, period = 1): number {
    let diff = b - a;
    if (diff > period / 2) diff -= period;
    if (diff < -period / 2) diff += period;
    return ((a + diff * t) % period + period) % period;
}

/** Unwrap a value to be within ±period/2 of the anchor. */
export function unwrapCircular(val: number, anchor: number, period = 1): number {
    let diff = val - anchor;
    if (diff > period / 2) diff -= period;
    if (diff < -period / 2) diff += period;
    return anchor + diff;
}
