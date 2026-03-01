/**
 * Playback preview controller for the animation editor.
 *
 * Renders animation frames at SD resolution using the worker's
 * generate-animation protocol. Provides play/pause/stop/seek.
 */

import { totalDuration, totalFrames, evaluateTimeline } from '../../lib/core/timeline.js';

const PREVIEW_WIDTH = 840;
const PREVIEW_HEIGHT = 540;

/**
 * Create a preview player.
 *
 * @param {object} opts
 * @param {object} opts.workerBridge - gallery worker bridge instance
 * @param {function} opts.getAnimation - () => Animation
 * @param {function} opts.onFrame - (timeSeconds: number) => void (for playhead sync)
 * @param {function} opts.onComplete - () => void
 * @param {function} opts.onStateChange - (isPlaying: boolean) => void
 * @returns {{ play, pause, stop, seek, isPlaying, destroy }}
 */
export function createPreviewPlayer({ workerBridge, getAnimation, onFrame, onComplete, onStateChange }) {
    let playing = false;
    let startTimestamp = null;
    let rafId = null;
    let previewAnimation = null;

    function play() {
        if (playing) return;
        const anim = getAnimation();
        if (!anim.events.length) return;

        playing = true;
        startTimestamp = null;

        // Build a SD-resolution copy for preview
        previewAnimation = {
            ...anim,
            settings: { ...anim.settings, width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT },
        };

        // Use simple RAF-based frame stepping with evaluateTimeline
        // This is cheaper than full generate-animation but shows approximate preview
        rafLoop();
        onStateChange?.(true);
    }

    function rafLoop(timestamp) {
        if (!playing) return;

        if (startTimestamp === null) startTimestamp = timestamp || performance.now();

        const elapsed = ((timestamp || performance.now()) - startTimestamp) / 1000;
        const dur = totalDuration(previewAnimation);

        if (elapsed >= dur) {
            stop();
            onComplete?.();
            return;
        }

        // Evaluate and render current frame
        const frame = evaluateTimeline(previewAnimation, elapsed);
        if (frame.currentConfig && frame.currentSeed && workerBridge) {
            workerBridge.sendRender(frame.currentSeed, frame.currentConfig, 'en');
        }

        onFrame?.(elapsed);

        rafId = requestAnimationFrame(rafLoop);
    }

    function pause() {
        if (!playing) return;
        playing = false;
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        onStateChange?.(false);
    }

    function stop() {
        playing = false;
        startTimestamp = null;
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        onStateChange?.(false);
    }

    function seek(timeSeconds) {
        if (playing) stop();

        const anim = getAnimation();
        if (!anim.events.length) return;

        const frame = evaluateTimeline(anim, timeSeconds);
        if (frame.currentConfig && frame.currentSeed && workerBridge) {
            workerBridge.sendRenderImmediate(frame.currentSeed, frame.currentConfig, 'en');
        }
        onFrame?.(timeSeconds);
    }

    function destroy() {
        stop();
    }

    return {
        play,
        pause,
        stop,
        seek,
        isPlaying() { return playing; },
        destroy,
    };
}
