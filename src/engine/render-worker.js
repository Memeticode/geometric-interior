/**
 * Web Worker for offscreen Three.js rendering.
 * Receives an OffscreenCanvas via transferControlToOffscreen(),
 * runs a persistent render loop with ambient animation,
 * and handles morph transitions in real-time.
 */

import { createRenderer } from '../../lib/engine/create-renderer.js';
import { evaluateTimeline, totalFrames as computeTotalFrames, totalDuration } from '../../lib/core/timeline.js';
import { Muxer, ArrayBufferTarget } from '../vendor/mp4-muxer.mjs';

let renderer = null;
let offscreenCanvas = null;

/* ── Request coalescing ── */
let pendingRender = null;
let renderScheduled = false;
let lastRenderReq = null;

/* ── Morph state ── */
let morphActive = false;
let morphAnimating = false;
let morphStartTime = 0;
let morphDurationMs = 1000;
let morphTargetReq = null;

/* ── Render loop state ── */
let loopRunning = false;
let loopStartTime = 0;
let animationEnabled = true;
let tabVisible = true;
const AMBIENT_INTERVAL = 1000 / 12; // ~12fps for ambient animation
const LOOP_LENGTH = 3.0; // seconds — animation loops every 3s
let lastTickTime = 0;

/* ── Fold state ── */
let foldAnimating = false;
let foldCallback = null; // 'fold-out-complete' or 'fold-in-complete'

/* ── Generate state ── */
let generateActive = false;
let generateCancelled = false;

function scheduleFrame(fn) {
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(fn);
    } else {
        setTimeout(fn, 16);
    }
}

/* ── Persistent render loop ── */

function startLoop() {
    if (loopRunning) return;
    loopRunning = true;
    loopStartTime = performance.now();
    scheduleFrame(tick);
}

function stopLoop() {
    loopRunning = false;
}

function tick() {
    if (!loopRunning || !renderer) return;
    const now = performance.now();

    // Throttle ambient frames to ~12fps; morph/fold run at full framerate
    if (!morphAnimating && !foldAnimating) {
        if (now - lastTickTime < AMBIENT_INTERVAL) {
            scheduleFrame(tick);
            return;
        }
    }
    lastTickTime = now;

    const rawElapsed = (now - loopStartTime) / 1000.0;
    // Ambient animation loops; morph/fold use raw elapsed for one-shot timing
    const elapsed = (morphAnimating || foldAnimating) ? rawElapsed : rawElapsed % LOOP_LENGTH;

    if (morphAnimating) {
        // Real-time morph: advance t each frame
        const morphElapsed = now - morphStartTime;
        const tRaw = Math.min(morphElapsed / morphDurationMs, 1.0);
        const tEased = 0.5 * (1 - Math.cos(Math.PI * tRaw));

        renderer.updateTime(elapsed);
        renderer.morphUpdate(tEased);

        self.postMessage({ type: 'morph-progress', t: tRaw });

        if (tRaw >= 1.0) {
            renderer.morphEnd();
            morphAnimating = false;
            morphActive = false;
            self.postMessage({ type: 'morph-complete' });
            // Re-render final state for clean persistent scene
            if (morphTargetReq) {
                lastRenderReq = morphTargetReq;
                pendingRender = morphTargetReq;
                morphTargetReq = null;
                doRender();
            }
        }
    } else {
        renderer.updateTime(elapsed);

        // Check fold animation completion
        if (foldAnimating && renderer.isFoldComplete()) {
            foldAnimating = false;
            if (foldCallback) {
                self.postMessage({ type: foldCallback });
                foldCallback = null;
            }
        }

        renderer.renderFrame();
    }

    scheduleFrame(tick);
}

/* ── On-demand render (scene rebuild) ── */

function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    scheduleFrame(doRender);
}

function doRender() {
    renderScheduled = false;
    if (!pendingRender || !renderer) return;

    const req = pendingRender;
    pendingRender = null;

    try {
        // Resize if dimensions provided
        if (req.width && req.height) {
            renderer.resize(req.width, req.height);
        }

        const meta = renderer.renderWith(req.seed, req.controls, req.locale || 'en');
        lastRenderReq = req;

        // Start render loop if animation is enabled
        if (animationEnabled && tabVisible) {
            startLoop();
        }

        self.postMessage({
            type: 'rendered',
            requestId: req.requestId,
            deliberate: req.deliberate || false,
            meta,
        });
    } catch (err) {
        console.error('[render-worker] render error:', err);
        self.postMessage({
            type: 'rendered',
            requestId: req.requestId,
            deliberate: req.deliberate || false,
            meta: { title: '', altText: '', nodeCount: 0 },
        });
    }
}

/* ── Message handler ── */
self.onmessage = function (e) {
    const msg = e.data;

    switch (msg.type) {
        case 'init':
            try {
                offscreenCanvas = msg.canvas;
                renderer = createRenderer(offscreenCanvas, { dpr: msg.dpr });
                if (msg.width && msg.height) {
                    renderer.resize(msg.width, msg.height);
                }
                self.postMessage({ type: 'ready' });
            } catch (err) {
                console.error('[render-worker] init error:', err);
                self.postMessage({ type: 'error', error: err.message });
            }
            break;

        case 'resize':
            if (renderer) {
                if (msg.dpr) renderer.setDPR(msg.dpr);
                renderer.resize(msg.width, msg.height);
                // If loop is running, it will re-render at new size automatically.
                // If not, re-render the last request at new size.
                if (!loopRunning && lastRenderReq) {
                    lastRenderReq.width = msg.width;
                    lastRenderReq.height = msg.height;
                    pendingRender = lastRenderReq;
                    scheduleRender();
                }
            }
            break;

        case 'render':
            if (morphActive || morphAnimating) break; // ignore renders during morph
            if (foldAnimating && !msg.deliberate) break; // block casual renders during fold
            pendingRender = msg;
            scheduleRender();
            break;

        case 'morph-prepare':
            if (renderer) {
                try {
                    if (msg.width && msg.height) {
                        renderer.resize(msg.width, msg.height);
                    }
                    renderer.morphPrepare(msg.seedA, msg.controlsA, msg.seedB, msg.controlsB);
                    morphActive = true;
                    morphTargetReq = {
                        type: 'render',
                        seed: msg.seedB,
                        controls: msg.controlsB,
                        width: msg.width,
                        height: msg.height,
                    };
                    self.postMessage({ type: 'morph-prepared' });
                } catch (err) {
                    console.error('[render-worker] morph-prepare error:', err);
                    self.postMessage({ type: 'morph-prepared', error: err.message });
                }
            }
            break;

        case 'morph-start':
            if (!morphActive || !renderer) break;
            morphAnimating = true;
            morphStartTime = performance.now();
            morphDurationMs = msg.duration || 1000;
            // Ensure loop is running for real-time morph
            if (!loopRunning) startLoop();
            break;

        case 'morph-cancel':
            if (renderer && (morphActive || morphAnimating)) {
                renderer.morphEnd();
            }
            morphActive = false;
            morphAnimating = false;
            morphTargetReq = null;
            self.postMessage({ type: 'morph-ended' });
            break;

        case 'fold-in':
            if (renderer) {
                renderer.foldIn();
                foldAnimating = true;
                foldCallback = 'fold-in-complete';
                if (!loopRunning) startLoop();
            }
            break;

        case 'fold-out':
            if (renderer) {
                renderer.foldOut();
                foldAnimating = true;
                foldCallback = 'fold-out-complete';
                if (!loopRunning) startLoop();
            }
            break;

        case 'fold-immediate':
            if (renderer) {
                renderer.setFoldImmediate(msg.value ?? 1.0);
                foldAnimating = false;
                foldCallback = null;
            }
            break;

        case 'set-animation':
            animationEnabled = msg.enabled;
            if (animationEnabled && tabVisible && renderer) {
                startLoop();
            } else if (!animationEnabled) {
                stopLoop();
            }
            break;

        case 'set-anim-config':
            if (renderer) {
                renderer.setAnimConfig(msg);
            }
            break;

        case 'set-camera':
            if (renderer) {
                renderer.setCameraState(msg.zoom, msg.orbitY, msg.orbitX);
                if (!loopRunning) renderer.renderFrame();
            }
            break;

        case 'visibility':
            tabVisible = msg.visible;
            if (tabVisible && animationEnabled && renderer) {
                startLoop();
            } else if (!tabVisible) {
                stopLoop();
            }
            break;

        case 'export':
            doExport(msg.requestId);
            break;

        case 'generate':
            doGenerate(msg);
            break;

        case 'generate-cancel':
            generateCancelled = true;
            break;

        case 'generate-animation':
            doGenerateAnimation(msg);
            break;

        case 'generate-animation-cancel':
            generateCancelled = true;
            break;

        case 'snapshot':
            doSnapshot(msg);
            break;
    }
};

async function doExport(requestId) {
    if (!offscreenCanvas) return;
    try {
        const blob = await offscreenCanvas.convertToBlob({ type: 'image/png' });
        self.postMessage({ type: 'exported', requestId, blob });
    } catch (err) {
        self.postMessage({ type: 'export-error', requestId, error: err.message });
    }
}

/* ── One-shot snapshot at specific resolution ── */

async function doSnapshot(msg) {
    if (!renderer || !offscreenCanvas) {
        self.postMessage({ type: 'snapshot-failed', requestId: msg.requestId, error: 'Renderer not initialized' });
        return;
    }
    if (generateActive) {
        self.postMessage({ type: 'snapshot-failed', requestId: msg.requestId, error: 'Generation in progress' });
        return;
    }

    try {
        renderer.resize(msg.width, msg.height);
        renderer.renderWith(msg.seed, msg.controls, msg.locale || 'en');
        renderer.setFoldImmediate(1.0);
        renderer.updateTime(3.0);
        renderer.renderFrame();

        const blob = await offscreenCanvas.convertToBlob({ type: 'image/webp', quality: 0.85 });
        self.postMessage({ type: 'snapshot-complete', requestId: msg.requestId, blob });
    } catch (err) {
        console.error('[render-worker] snapshot error:', err);
        self.postMessage({ type: 'snapshot-failed', requestId: msg.requestId, error: err.message });
    }
}

/* ── Full generation pipeline ── */

async function doGenerate(msg) {
    if (!renderer || !offscreenCanvas) {
        self.postMessage({ type: 'generate-failed', requestId: msg.requestId, error: 'Renderer not initialized' });
        return;
    }
    if (generateActive) {
        self.postMessage({ type: 'generate-failed', requestId: msg.requestId, error: 'Generation already in progress' });
        return;
    }

    generateActive = true;
    generateCancelled = false;
    stopLoop();

    const { requestId, seed, controls, locale,
            staticWidth, staticHeight,
            spriteWidth, spriteHeight, frameCount } = msg;

    const progress = (pct, label) => {
        self.postMessage({ type: 'generate-progress', requestId, progress: pct, label });
    };

    try {
        // Step 1: Build scene + render static image at full resolution
        progress(0, 'Building scene…');
        renderer.resize(staticWidth, staticHeight);
        const meta = renderer.renderWith(seed, controls, locale || 'en');
        renderer.setFoldImmediate(1.0);
        renderer.updateTime(3.0);
        renderer.renderFrame();

        if (generateCancelled) throw new CancelError();
        progress(2, 'Capturing static image…');
        const staticBlob = await offscreenCanvas.convertToBlob({ type: 'image/webp', quality: 0.8 });

        if (generateCancelled) throw new CancelError();

        // Step 2: Render fold sprite at thumbnail resolution
        progress(5, 'Rendering fold animation…');
        renderer.resize(spriteWidth, spriteHeight);
        // Rebuild scene at sprite resolution
        renderer.renderWith(seed, controls, locale || 'en');

        const spriteCanvas = new OffscreenCanvas(spriteWidth, spriteHeight * frameCount);
        const spriteCtx = spriteCanvas.getContext('2d');

        const BLACK_FRAMES = 2;
        spriteCtx.fillStyle = '#000';
        spriteCtx.fillRect(0, 0, spriteWidth, spriteHeight * BLACK_FRAMES);

        for (let i = BLACK_FRAMES; i < frameCount; i++) {
            if (generateCancelled) throw new CancelError();

            const t = (i - BLACK_FRAMES) / (frameCount - 1 - BLACK_FRAMES);
            renderer.setFoldImmediate(t);
            renderer.updateTime(t * 3.0);
            renderer.renderFrame();
            spriteCtx.drawImage(offscreenCanvas, 0, i * spriteHeight);

            // Report progress every 3 frames
            if (i % 3 === 0 || i === frameCount - 1) {
                const pct = 5 + Math.round((i / (frameCount - 1)) * 90);
                progress(pct, `Rendering fold: ${i + 1}/${frameCount}`);
            }
        }

        if (generateCancelled) throw new CancelError();
        progress(95, 'Compositing sprite…');
        const spriteBlob = await spriteCanvas.convertToBlob({ type: 'image/webp', quality: 0.8 });

        // Step 3: Generate thumbnail at 280×180 (fold=1, time=3)
        if (generateCancelled) throw new CancelError();
        progress(97, 'Generating thumbnail…');
        renderer.resize(280, 180);
        renderer.renderWith(seed, controls, locale || 'en');
        renderer.setFoldImmediate(1.0);
        renderer.updateTime(3.0);
        renderer.renderFrame();
        const thumbBlob = await offscreenCanvas.convertToBlob({ type: 'image/png' });

        if (generateCancelled) throw new CancelError();
        progress(100, 'Complete');

        self.postMessage({
            type: 'generate-complete',
            requestId,
            staticBlob,
            spriteBlob,
            thumbBlob,
            meta: {
                ...meta,
                width: staticWidth,
                height: staticHeight,
            },
        });
    } catch (err) {
        if (err instanceof CancelError) {
            self.postMessage({ type: 'generate-failed', requestId, error: 'cancelled' });
        } else {
            console.error('[render-worker] generate error:', err);
            self.postMessage({ type: 'generate-failed', requestId, error: err.message });
        }
    } finally {
        generateActive = false;
        generateCancelled = false;
    }
}

/* ── Animation generation pipeline ── */

/**
 * Try to set up in-worker WebCodecs video encoder + mp4-muxer.
 * Returns { encoder, muxer, target } or null if unavailable.
 */
async function tryInitVideoEncoder(width, height, fps) {
    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;

    const codecCandidates = [
        { codec: 'avc1.42E01E', muxCodec: 'avc' },
        { codec: 'avc1.640028', muxCodec: 'avc' },
    ];

    let chosen = null;
    for (const c of codecCandidates) {
        try {
            const support = await VideoEncoder.isConfigSupported({
                codec: c.codec, width, height, bitrate: 8_000_000, framerate: fps,
            });
            if (support.supported) { chosen = c; break; }
        } catch { /* skip */ }
    }
    if (!chosen) return null;

    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
        target,
        video: { codec: chosen.muxCodec, width, height },
        fastStart: 'in-memory',
    });

    const encoder = new VideoEncoder({
        output: (chunk, meta) => { muxer.addVideoChunk(chunk, meta); },
        error: (e) => { console.error('[render-worker] VideoEncoder error:', e); },
    });

    encoder.configure({
        codec: chosen.codec, width, height,
        bitrate: 8_000_000, framerate: fps, latencyMode: 'quality',
    });

    return { encoder, muxer, target };
}

async function doGenerateAnimation(msg) {
    if (!renderer || !offscreenCanvas) {
        self.postMessage({ type: 'generate-animation-failed', requestId: msg.requestId, error: 'Renderer not initialized' });
        return;
    }
    if (generateActive) {
        self.postMessage({ type: 'generate-animation-failed', requestId: msg.requestId, error: 'Generation already in progress' });
        return;
    }

    generateActive = true;
    generateCancelled = false;
    stopLoop();

    const { requestId, animation } = msg;
    const { width, height, fps } = animation.settings;
    const numFrames = computeTotalFrames(animation);
    const frameDt = 1 / fps;
    const frameDurationUs = Math.round(1_000_000 / fps);

    const progress = (frame) => {
        self.postMessage({
            type: 'generate-animation-progress',
            requestId,
            frame,
            totalFrames: numFrames,
            progress: frame / numFrames,
        });
    };

    let videoCtx = null;     // { encoder, muxer, target } or null
    let fallbackFrames = []; // ImageBitmap[] when WebCodecs unavailable
    let thumbBlob = null;
    let thumbCaptured = false;

    try {
        renderer.setTargetResolution(width, height);

        // Try in-worker video encoding
        videoCtx = await tryInitVideoEncoder(width, height, fps);
        const useEncoder = videoCtx !== null;

        let prevEventIndex = -1;
        let inMorph = false;

        for (let f = 0; f < numFrames; f++) {
            if (generateCancelled) throw new CancelError();

            const t = f * frameDt;
            const state = evaluateTimeline(animation, t);

            // Detect event boundary transitions
            if (state.eventIndex !== prevEventIndex) {
                if (inMorph) {
                    renderer.morphEnd();
                    inMorph = false;
                }

                const ev = animation.events[state.eventIndex];

                if (ev.type === 'expand') {
                    renderer.renderWith(state.currentSeed, state.currentConfig);
                    renderer.setFoldImmediate(0);
                } else if (ev.type === 'transition' && state.morphFromConfig && state.morphToConfig) {
                    renderer.morphPrepare(
                        state.morphFromSeed, state.morphFromConfig,
                        state.morphToSeed, state.morphToConfig,
                    );
                    inMorph = true;
                }

                prevEventIndex = state.eventIndex;
            }

            // Apply camera override (Phase 3), live params (Phase 4), focus (Phase 6)
            renderer.setCameraState(state.cameraZoom, state.cameraOrbitY, state.cameraOrbitX);
            renderer.setLiveParams({ twinkle: state.twinkle, dynamism: state.dynamism });
            renderer.setFocusState(state.focalDepth, state.blurAmount);

            // Render the frame
            if (inMorph && state.morphT !== undefined) {
                renderer.updateTime(state.time);
                renderer.morphUpdate(state.morphT);
            } else {
                renderer.setFoldImmediate(state.foldProgress);
                renderer.updateTime(state.time);
                renderer.renderFrame();
            }

            // Capture thumbnail at first fully-expanded frame
            if (!thumbCaptured && state.foldProgress >= 1.0 && state.eventType !== 'collapse') {
                try {
                    thumbBlob = await offscreenCanvas.convertToBlob({ type: 'image/png' });
                } catch { /* ignore */ }
                thumbCaptured = true;
            }

            // Encode or capture frame
            if (useEncoder) {
                const videoFrame = new VideoFrame(offscreenCanvas, {
                    timestamp: f * frameDurationUs,
                    duration: frameDurationUs,
                });
                const isKey = (f % (fps * 2) === 0);
                videoCtx.encoder.encode(videoFrame, { keyFrame: isKey });
                videoFrame.close();
            } else {
                const bitmap = await createImageBitmap(offscreenCanvas);
                fallbackFrames.push(bitmap);
            }

            // Report progress every 5 frames
            if (f % 5 === 0 || f === numFrames - 1) {
                progress(f + 1);
            }

            // Yield periodically for responsiveness
            if ((f & 7) === 7) await new Promise(r => setTimeout(r, 0));
        }

        // End any remaining morph
        if (inMorph) {
            renderer.morphEnd();
        }

        // Capture thumbnail fallback (midpoint frame) if not captured during expand
        if (!thumbCaptured) {
            try {
                thumbBlob = await offscreenCanvas.convertToBlob({ type: 'image/png' });
            } catch { /* ignore */ }
        }

        renderer.clearCameraState();
        renderer.clearFocusState();
        renderer.clearTargetResolution();

        if (useEncoder) {
            // Finalize video encoding
            await videoCtx.encoder.flush();
            videoCtx.encoder.close();
            videoCtx.muxer.finalize();

            const { buffer } = videoCtx.target;
            const videoBlob = new Blob([buffer], { type: 'video/mp4' });

            self.postMessage({
                type: 'generate-animation-complete',
                requestId,
                videoBlob,
                thumbBlob,
                fps,
                totalFrames: numFrames,
                width,
                height,
                durationS: totalDuration(animation),
            });
        } else {
            // Fallback: send ImageBitmaps for main-thread encoding
            self.postMessage(
                {
                    type: 'generate-animation-complete',
                    requestId,
                    frames: fallbackFrames,
                    thumbBlob,
                    fps,
                    totalFrames: numFrames,
                    width,
                    height,
                    durationS: totalDuration(animation),
                },
                fallbackFrames, // transfer ImageBitmaps
            );
        }
    } catch (err) {
        renderer.clearCameraState();
        renderer.clearFocusState();
        renderer.clearTargetResolution();
        // Clean up encoder on error
        if (videoCtx) {
            try { videoCtx.encoder.close(); } catch { /* ignore */ }
        }
        // Clean up fallback frames
        for (const bm of fallbackFrames) { try { bm.close(); } catch { /* ignore */ } }

        if (err instanceof CancelError) {
            self.postMessage({ type: 'generate-animation-failed', requestId, error: 'cancelled' });
        } else {
            console.error('[render-worker] generate-animation error:', err);
            self.postMessage({ type: 'generate-animation-failed', requestId, error: err.message });
        }
    } finally {
        generateActive = false;
        generateCancelled = false;
    }
}

class CancelError extends Error {
    constructor() { super('cancelled'); this.name = 'CancelError'; }
}
