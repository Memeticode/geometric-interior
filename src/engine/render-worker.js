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
                renderer.resize(msg.width, msg.height);
                if (msg.dpr) renderer.setDPR(msg.dpr);
            }
            break;

        case 'render':
            pendingRender = msg;
            scheduleRender();
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
