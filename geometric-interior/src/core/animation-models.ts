/**
 * Animation timeline data model types.
 */

import type { Controls } from './image-models.js';
import type { Seed } from './text-generation/seed-tags.js';
import type { EasingType } from '../utils/easing.js';

export type { EasingType } from '../utils/easing.js';

export interface ContentEvent {
    type: 'expand' | 'pause' | 'transition' | 'collapse';
    duration: number;          // seconds
    easing: EasingType;
    config?: Controls;         // required for expand, transition
    seed?: Seed;               // required for expand, transition
    camera?: { zoom?: number; rotation?: number };  // per-config camera state
}

export interface CameraState {
    zoom?: number;             // multiplier on camera Z (1.0 = default)
    orbitY?: number;           // degrees of Y-axis orbit
    orbitX?: number;           // degrees of X-axis tilt
}

export interface CameraMove {
    type: 'zoom' | 'rotate';
    startTime: number;         // seconds from animation start
    endTime: number;
    easing: EasingType;
    from: CameraState;
    to: CameraState;
}

export interface ParamTrack {
    param: 'twinkle' | 'dynamism';
    startTime: number;
    endTime: number;
    easing: EasingType;
    from: number;              // 0-1
    to: number;                // 0-1
}

export interface FocusState {
    focalDepth: number;        // 0-1 (0 = near, 1 = far)
    blurAmount: number;        // 0-1 (0 = no blur, 1 = max blur)
}

export interface FocusTrack {
    startTime: number;
    endTime: number;
    easing: EasingType;
    from: FocusState;
    to: FocusState;
}

export interface AnimationSettings {
    fps: number;
    width: number;
    height: number;
}

export interface Animation {
    settings: AnimationSettings;
    events: ContentEvent[];
    cameraMoves: CameraMove[];
    paramTracks: ParamTrack[];
    focusTracks?: FocusTrack[];
}

/** Complete render state at a point in time */
export interface FrameState {
    /** Index of the active event in the events array. */
    eventIndex: number;
    /** Progress within the active event (0-1), easing already applied. */
    eventProgress: number;
    /** Type of the active event. */
    eventType: ContentEvent['type'];

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

    // Camera (Phase 3)
    cameraZoom: number;        // multiplier (1.0 = default)
    cameraOrbitY: number;      // degrees
    cameraOrbitX: number;      // degrees

    // Live params (Phase 4)
    twinkle: number;           // 0-1
    dynamism: number;          // 0-1

    // Focus / DOF (Phase 6)
    focalDepth: number;        // 0-1 (0.5 = default mid-range)
    blurAmount: number;        // 0-1 (0 = no blur)

    /** Frame clock time in seconds (for deterministic shader animation). */
    time: number;
}
