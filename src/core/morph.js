/**
 * Smooth morph controller for transitioning between two visual states.
 *
 * Uses cosine easing on numeric slider values and circular interpolation
 * for hue. Palette preset snaps at the morph midpoint.
 */

import { cosineEase } from '../../lib/core/interpolation.js';
import { clamp01, lerp } from '../../lib/core/prng.js';

export const MORPH_DURATION_MS = 3000;

const NUMERIC_KEYS = ['density', 'luminosity', 'fracture', 'depth', 'coherence'];

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
 * Linearly interpolate palette tweaks (circular for hue).
 */
export function lerpPaletteTweaks(from, to, t) {
    return {
        baseHue: circularLerp(from.baseHue, to.baseHue, t),
        hueRange: lerp(from.hueRange, to.hueRange, t),
        saturation: lerp(from.saturation, to.saturation, t),
    };
}

/**
 * Interpolate between two visual states.
 *
 * @param {{ seed: string, controls: object, paletteTweaks: object }} from
 * @param {{ seed: string, controls: object, paletteTweaks: object }} to
 * @param {number} tRaw - Raw time [0, 1] — cosine easing applied internally
 * @returns {{ seed: string, controls: object, paletteTweaks: object }}
 */
export function interpolateState(from, to, tRaw) {
    const t = cosineEase(clamp01(tRaw));

    // Numeric slider keys: eased lerp
    const controls = {
        topology: to.controls.topology,
        // Palette preset snaps at midpoint
        palette: tRaw < 0.5 ? from.controls.palette : to.controls.palette,
    };
    for (const key of NUMERIC_KEYS) {
        controls[key] = lerp(from.controls[key], to.controls[key], t);
    }

    // Palette tweaks: smooth lerp (circular for hue)
    const paletteTweaks = lerpPaletteTweaks(from.paletteTweaks, to.paletteTweaks, t);

    // Seed: always target (geometry snaps once at start)
    return { seed: to.seed, controls, paletteTweaks };
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
