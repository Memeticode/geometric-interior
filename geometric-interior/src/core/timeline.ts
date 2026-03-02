/**
 * Animation timeline evaluator.
 *
 * Pure function: evaluateTimeline(animation, timeSeconds) → FrameState
 *
 * Maps absolute time to complete render state by evaluating content events,
 * camera movements, and live parameter tracks. Stateless — can seek to any
 * frame without sequential playback.
 */

import type { Controls } from './image-models.js';
import type { Seed } from './text-generation/seed-tags.js';
import { applyEasing } from './easing.js';
import type { ContentEvent, Animation, FrameState } from './animation-models.js';

// Re-export all animation types so existing consumers can still import from timeline
export type {
    EasingType, ContentEvent, CameraState, CameraMove, ParamTrack,
    FocusState, FocusTrack, AnimationSettings, Animation, FrameState,
} from './animation-models.js';

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

/**
 * Walk events backward from eventIndex to find the most recent
 * expand or transition event that has a camera field.
 * Returns the config camera values (zoom, rotation), defaulting to identity.
 */
function resolveConfigCamera(events: ContentEvent[], eventIndex: number): { zoom: number; rotation: number } {
    for (let i = eventIndex; i >= 0; i--) {
        const ev = events[i];
        if ((ev.type === 'expand' || ev.type === 'transition') && ev.camera) {
            return { zoom: ev.camera.zoom ?? 1.0, rotation: ev.camera.rotation ?? 0 };
        }
    }
    return { zoom: 1.0, rotation: 0 };
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

    // Evaluate camera: start from per-config camera, then apply overlay moves
    let baseCamZoom: number;
    let baseCamRotation: number;

    if (event.type === 'transition') {
        // Interpolate between from-config and to-config camera during transition
        const fromCam = resolveConfigCamera(events, eventIndex - 1);
        const toCam = resolveConfigCamera(events, eventIndex);
        baseCamZoom = lerpVal(fromCam.zoom, toCam.zoom, eventProgress);
        baseCamRotation = lerpVal(fromCam.rotation, toCam.rotation, eventProgress);
    } else {
        const configCam = resolveConfigCamera(events, eventIndex);
        baseCamZoom = configCam.zoom;
        baseCamRotation = configCam.rotation;
    }

    let cameraZoom = baseCamZoom;
    let cameraOrbitY = baseCamRotation;
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
