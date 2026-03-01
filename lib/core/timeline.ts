/**
 * Animation timeline evaluator.
 *
 * Pure function: evaluateTimeline(animation, timeSeconds) → FrameState
 *
 * Maps absolute time to complete render state by evaluating content events,
 * camera movements, and live parameter tracks. Stateless — can seek to any
 * frame without sequential playback.
 */

import type { Controls } from '../types.js';
import type { Seed } from './seed-tags.js';
import { applyEasing } from './easing.js';
import type { EasingType } from './easing.js';

export type { EasingType } from './easing.js';

/* ── Data Model ── */

export interface ContentEvent {
    type: 'expand' | 'pause' | 'transition' | 'collapse';
    duration: number;          // seconds
    easing: EasingType;
    config?: Controls;         // required for expand, transition
    seed?: Seed;               // required for expand, transition
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

/* ── Frame State ── */

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

/* ── Helpers ── */

/** Compute cumulative start times for each event. */
function computeEventBoundaries(events: ContentEvent[]): number[] {
    const starts: number[] = [];
    let t = 0;
    for (const ev of events) {
        starts.push(t);
        t += ev.duration;
    }
    return starts;
}

/** Total duration of all events. */
export function totalDuration(animation: Animation): number {
    let t = 0;
    for (const ev of animation.events) t += ev.duration;
    return t;
}

/** Total frame count. */
export function totalFrames(animation: Animation): number {
    return Math.max(1, Math.round(totalDuration(animation) * animation.settings.fps));
}

/**
 * Walk events backward from eventIndex to find the most recent
 * expand or transition event that established a config + seed.
 */
function resolveCurrentConfig(events: ContentEvent[], eventIndex: number): { config: Controls; seed: Seed } {
    for (let i = eventIndex; i >= 0; i--) {
        const ev = events[i];
        if ((ev.type === 'expand' || ev.type === 'transition') && ev.config && ev.seed !== undefined) {
            // For transition, the "current" config after it completes is the target config
            return { config: ev.config, seed: ev.seed };
        }
    }
    // Should not happen if animation is well-formed (first event is expand)
    throw new Error('No expand or transition event found before event ' + eventIndex);
}

/**
 * For a transition event, find the "from" config by walking backward
 * past the transition itself to the previous expand or completed transition.
 */
function resolveFromConfig(events: ContentEvent[], transitionIndex: number): { config: Controls; seed: Seed } {
    for (let i = transitionIndex - 1; i >= 0; i--) {
        const ev = events[i];
        if ((ev.type === 'expand' || ev.type === 'transition') && ev.config && ev.seed !== undefined) {
            return { config: ev.config, seed: ev.seed };
        }
    }
    throw new Error('No config found before transition at event ' + transitionIndex);
}

/** Interpolate a single value linearly. */
function lerpVal(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/* ── Main Evaluator ── */

/**
 * Evaluate the animation timeline at an absolute time.
 *
 * Pure function — no side effects, no state. Given an Animation definition
 * and a time in seconds, returns the complete FrameState describing what
 * the renderer should display.
 */
export function evaluateTimeline(animation: Animation, timeSeconds: number): FrameState {
    const { events, cameraMoves, paramTracks, focusTracks = [] } = animation;

    if (events.length === 0) {
        throw new Error('Animation has no events');
    }

    const starts = computeEventBoundaries(events);
    const dur = totalDuration(animation);

    // Clamp time to valid range
    const t = Math.max(0, Math.min(timeSeconds, dur));

    // Find active event
    let eventIndex = events.length - 1;
    for (let i = 0; i < events.length; i++) {
        const eventEnd = starts[i] + events[i].duration;
        if (t < eventEnd || i === events.length - 1) {
            eventIndex = i;
            break;
        }
    }

    const event = events[eventIndex];
    const eventStart = starts[eventIndex];
    const rawProgress = event.duration > 0
        ? Math.min((t - eventStart) / event.duration, 1)
        : 1;
    const eventProgress = applyEasing(rawProgress, event.easing);

    // Resolve current config + seed
    const { config: currentConfig, seed: currentSeed } = resolveCurrentConfig(events, eventIndex);

    // Compute fold progress
    let foldProgress = 1.0;
    if (event.type === 'expand') {
        foldProgress = eventProgress;
    } else if (event.type === 'collapse') {
        foldProgress = 1 - eventProgress;
    }

    // Compute morph state (transition events)
    let morphFromConfig: Controls | undefined;
    let morphFromSeed: Seed | undefined;
    let morphToConfig: Controls | undefined;
    let morphToSeed: Seed | undefined;
    let morphT: number | undefined;

    if (event.type === 'transition' && event.config && event.seed !== undefined) {
        const from = resolveFromConfig(events, eventIndex);
        morphFromConfig = from.config;
        morphFromSeed = from.seed;
        morphToConfig = event.config;
        morphToSeed = event.seed;
        morphT = eventProgress;
    }

    // Evaluate camera moves (Phase 3)
    let cameraZoom = 1.0;
    let cameraOrbitY = 0;
    let cameraOrbitX = 0;

    for (const move of cameraMoves) {
        if (t < move.startTime || t > move.endTime) continue;
        const moveDur = move.endTime - move.startTime;
        const moveRaw = moveDur > 0 ? (t - move.startTime) / moveDur : 1;
        const moveT = applyEasing(moveRaw, move.easing);

        if (move.from.zoom !== undefined && move.to.zoom !== undefined) {
            cameraZoom *= lerpVal(move.from.zoom, move.to.zoom, moveT);
        }
        if (move.from.orbitY !== undefined && move.to.orbitY !== undefined) {
            cameraOrbitY += lerpVal(move.from.orbitY, move.to.orbitY, moveT);
        }
        if (move.from.orbitX !== undefined && move.to.orbitX !== undefined) {
            cameraOrbitX += lerpVal(move.from.orbitX, move.to.orbitX, moveT);
        }
    }

    // Evaluate param tracks (Phase 4)
    let twinkle = 0;
    let dynamism = 0;

    for (const track of paramTracks) {
        if (t < track.startTime || t > track.endTime) continue;
        const trackDur = track.endTime - track.startTime;
        const trackRaw = trackDur > 0 ? (t - track.startTime) / trackDur : 1;
        const trackT = applyEasing(trackRaw, track.easing);
        const val = lerpVal(track.from, track.to, trackT);

        if (track.param === 'twinkle') twinkle = val;
        else if (track.param === 'dynamism') dynamism = val;
    }

    // Evaluate focus tracks (Phase 6)
    let focalDepth = 0.5;
    let blurAmount = 0;
    let focusTrackCount = 0;

    for (const track of focusTracks) {
        if (t < track.startTime || t > track.endTime) continue;
        const trackDur = track.endTime - track.startTime;
        const trackRaw = trackDur > 0 ? (t - track.startTime) / trackDur : 1;
        const trackT = applyEasing(trackRaw, track.easing);

        if (focusTrackCount === 0) {
            focalDepth = lerpVal(track.from.focalDepth, track.to.focalDepth, trackT);
            blurAmount = lerpVal(track.from.blurAmount, track.to.blurAmount, trackT);
        } else {
            // Compose multiple simultaneous tracks by averaging
            const fd = lerpVal(track.from.focalDepth, track.to.focalDepth, trackT);
            const ba = lerpVal(track.from.blurAmount, track.to.blurAmount, trackT);
            focalDepth = (focalDepth * focusTrackCount + fd) / (focusTrackCount + 1);
            blurAmount = (blurAmount * focusTrackCount + ba) / (focusTrackCount + 1);
        }
        focusTrackCount++;
    }

    return {
        eventIndex,
        eventProgress,
        eventType: event.type,
        currentConfig,
        currentSeed,
        foldProgress,
        morphFromConfig,
        morphFromSeed,
        morphToConfig,
        morphToSeed,
        morphT,
        cameraZoom,
        cameraOrbitY,
        cameraOrbitX,
        twinkle,
        dynamism,
        focalDepth,
        blurAmount,
        time: t,
    };
}
