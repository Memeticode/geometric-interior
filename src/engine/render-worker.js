/**
 * Web Worker for offscreen Three.js rendering.
 * Receives an OffscreenCanvas via transferControlToOffscreen(),
 * handles render/resize/export messages, and coalesces rapid requests.
 */

import { createRenderer } from './create-renderer.js';
import { updatePalette } from '../core/palettes.js';

let renderer = null;
let offscreenCanvas = null;

/* ── Request coalescing ── */
let pendingRender = null;
let renderScheduled = false;
let lastRenderReq = null;

/* ── Morph state ── */
let morphActive = false;
let morphTimer = null;
let morphFrame = 0;
const MORPH_FRAMES = 72;
const MORPH_FRAME_MS = 1000 / 24; // 41.67ms → 24fps

function renderMorphFrame() {
    if (!morphActive || morphFrame >= MORPH_FRAMES) {
        if (renderer && morphActive) renderer.morphEnd();
        morphActive = false;
        morphTimer = null;
        self.postMessage({ type: 'morph-complete' });
        return;
    }
    const tRaw = morphFrame / (MORPH_FRAMES - 1);
    const t = 0.5 * (1 - Math.cos(Math.PI * tRaw)); // cosine ease
    renderer.morphUpdate(t);
    self.postMessage({ type: 'morph-frame', frameIndex: morphFrame, totalFrames: MORPH_FRAMES });
    morphFrame++;
    morphTimer = setTimeout(renderMorphFrame, MORPH_FRAME_MS);
}

function scheduleFrame(fn) {
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(fn);
    } else {
        setTimeout(fn, 0);
    }
}

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
        // Sync palette state before rendering
        if (req.paletteTweaks) {
            for (const [key, tweaks] of Object.entries(req.paletteTweaks)) {
                updatePalette(key, tweaks);
            }
        }

        // Resize if dimensions provided
        if (req.width && req.height) {
            renderer.resize(req.width, req.height);
        }

        const meta = renderer.renderWith(req.seed, req.controls);
        lastRenderReq = req;

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
                // Don't resize eagerly — it clears the framebuffer.
                // Instead, re-render at the new size so the canvas is never blank.
                if (lastRenderReq) {
                    lastRenderReq.width = msg.width;
                    lastRenderReq.height = msg.height;
                    pendingRender = lastRenderReq;
                    scheduleRender();
                } else {
                    renderer.resize(msg.width, msg.height);
                }
            }
            break;

        case 'render':
            if (morphActive) break; // ignore regular renders during morph
            pendingRender = msg;
            scheduleRender();
            break;

        case 'morph-prepare':
            if (renderer) {
                try {
                    // Sync palette state for both from and to
                    if (msg.paletteTweaksA) {
                        for (const [key, tweaks] of Object.entries(msg.paletteTweaksA)) {
                            updatePalette(key, tweaks);
                        }
                    }
                    if (msg.paletteTweaksB) {
                        for (const [key, tweaks] of Object.entries(msg.paletteTweaksB)) {
                            updatePalette(key, tweaks);
                        }
                    }
                    if (msg.width && msg.height) {
                        renderer.resize(msg.width, msg.height);
                    }
                    renderer.morphPrepare(msg.seedA, msg.controlsA, msg.seedB, msg.controlsB);
                    morphActive = true;
                    self.postMessage({ type: 'morph-prepared' });
                } catch (err) {
                    console.error('[render-worker] morph-prepare error:', err);
                    self.postMessage({ type: 'morph-prepared', error: err.message });
                }
            }
            break;

        case 'morph-start':
            if (!morphActive || !renderer) break;
            morphFrame = 0;
            renderMorphFrame();
            break;

        case 'morph-cancel':
            if (morphTimer !== null) { clearTimeout(morphTimer); morphTimer = null; }
            if (renderer && morphActive) renderer.morphEnd();
            morphActive = false;
            self.postMessage({ type: 'morph-ended' });
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
