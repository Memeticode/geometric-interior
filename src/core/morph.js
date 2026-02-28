/**
 * Smooth morph controller for transitioning between two visual states.
 *
 * Uses cosine easing on numeric slider values and circular interpolation
 * for hue (period 1, since hue is 0-1).
 */

import { cosineEase } from '../../lib/core/interpolation.js';
import { clamp01, lerp } from '../../lib/core/prng.js';

export const MORPH_DURATION_MS = 1000;

const NUMERIC_KEYS = ['density', 'luminosity', 'fracture', 'coherence', 'spectrum', 'chroma', 'scale', 'division', 'faceting', 'flow'];

/**
 * Shortest-path interpolation on a circular domain.
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor [0, 1]
 * @param {number} [period=360] - Period of the circular domain
 */
export function circularLerp(a, b, t, period = 360) {
    let diff = b - a;
    if (diff > period / 2) diff -= period;
    if (diff < -period / 2) diff += period;
    return ((a + diff * t) % period + period) % period;
}

/**
 * Interpolate between two visual states.
 *
 * @param {{ seed: string, controls: object }} from
 * @param {{ seed: string, controls: object }} to
 * @param {number} tRaw - Raw time [0, 1] — cosine easing applied internally
 * @returns {{ seed: string, controls: object }}
 */
export function interpolateState(from, to, tRaw) {
    const t = cosineEase(clamp01(tRaw));

    const controls = {
        topology: to.controls.topology,
    };

    // Numeric slider keys: eased lerp
    for (const key of NUMERIC_KEYS) {
        controls[key] = lerp(from.controls[key], to.controls[key], t);
    }

    // Hue: circular lerp on [0, 1] domain
    controls.hue = circularLerp(from.controls.hue, to.controls.hue, t, 1);

    // Seed: always target (geometry snaps once at start)
    return { seed: to.seed, controls };
}

/**
 * Create a morph controller that drives a RAF loop between two states.
 *
 * @param {object} opts
 * @param {function} opts.onTick - Called each frame with the interpolated state
 * @param {function} opts.onComplete - Called when the morph finishes
 * @returns {{ start, cancel, isActive, currentState }}
 */
export function createMorphController({ onTick, onComplete }) {
    let active = false;
    let rafId = null;
    let startMs = 0;
    let durationMs = MORPH_DURATION_MS;
    let fromState = null;
    let toState = null;
    let lastInterpolated = null;

    function tick(nowMs) {
        if (!active) return;

        const elapsed = nowMs - startMs;
        const tRaw = clamp01(elapsed / durationMs);

        const tEased = cosineEase(clamp01(tRaw));
        lastInterpolated = interpolateState(fromState, toState, tRaw);
        onTick(lastInterpolated, tEased);

        if (tRaw >= 1) {
            active = false;
            rafId = null;
            onComplete();
        } else {
            rafId = requestAnimationFrame(tick);
        }
    }

    function start(from, to, duration = MORPH_DURATION_MS) {
        // Cancel any existing morph
        if (rafId !== null) cancelAnimationFrame(rafId);

        fromState = from;
        toState = to;
        durationMs = duration;
        active = true;
        lastInterpolated = null;
        startMs = performance.now();
        rafId = requestAnimationFrame(tick);
    }

    /**
     * Cancel the morph. Returns the last interpolated state (or null).
     */
    function cancel() {
        if (rafId !== null) cancelAnimationFrame(rafId);
        const result = lastInterpolated;
        active = false;
        rafId = null;
        lastInterpolated = null;
        return result;
    }

    function isActive() {
        return active;
    }

    /** Get the last interpolated state (for rapid-click chaining). */
    function currentState() {
        return lastInterpolated;
    }

    return { start, cancel, isActive, currentState };
}
