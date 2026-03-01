/**
 * Easing functions for the animation timeline system.
 *
 * Provides standard CSS-style easings: linear, ease-in, ease-out, ease-in-out.
 * All functions map t ∈ [0,1] → [0,1].
 */

import { clamp01 } from './prng.js';

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
            // Symmetric cubic — equivalent to CSS ease-in-out cubic-bezier
            return t < 0.5
                ? 4 * t * t * t
                : 1 - Math.pow(-2 * t + 2, 3) / 2;
        default:
            return t;
    }
}
