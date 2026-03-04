/**
 * Internal animation types not subject to boundary validation.
 */

import type { Controls, Seed } from './schemas.js';

/** Complete render state at a point in time — constructed internally by evaluateTimeline(). */
export interface FrameState {
    /** Index of the active event in the events array. */
    eventIndex: number;
    /** Progress within the active event (0-1), easing already applied. */
    eventProgress: number;
    /** Type of the active event. */
    eventType: 'expand' | 'pause' | 'transition' | 'collapse';

    // Content
    currentConfig: Controls;
    currentSeed: Seed;
    foldProgress: number;      // 0-1 (1 = fully expanded)

    // Morph (transition events only)
    morphFromConfig?: Controls;
    morphFromSeed?: Seed;
    morphToConfig?: Controls;
    morphToSeed?: Seed;
    morphT?: number;           // 0-1, eased

    // Camera
    cameraZoom: number;        // multiplier (1.0 = default)
    cameraOrbitY: number;      // degrees
    cameraOrbitX: number;      // degrees

    // Live params
    twinkle: number;           // 0-1
    dynamism: number;          // 0-1

    // Focus / DOF
    focalDepth: number;        // 0-1 (0.5 = default mid-range)
    blurAmount: number;        // 0-1 (0 = no blur)

    /** Frame clock time in seconds (for deterministic shader animation). */
    time: number;
}
