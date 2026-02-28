/**
 * Web Worker for offscreen Three.js rendering.
 * Receives an OffscreenCanvas via transferControlToOffscreen(),
 * runs a persistent render loop with ambient animation,
 * and handles morph transitions in real-time.
 */

import { createRenderer } from '../../lib/engine/create-renderer.js';

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
