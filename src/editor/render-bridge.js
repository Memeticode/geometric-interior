/**
 * Render bridge — abstracts WebGL worker vs main-thread fallback rendering.
 * Manages worker lifecycle, message dispatch, resize observation, and
 * fold/morph coordination.
 */

import { createRenderer } from '../../lib/engine/create-renderer.js';
import { getResolution } from '../ui/resolution.js';

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} callbacks
 * @param {Function} callbacks.getAnimationState - () => { enabled, config }
 * @param {Function} callbacks.onReady - Worker (or fallback) is ready to render
 * @param {Function} callbacks.onRendered - (meta) after every render
 * @param {Function} callbacks.onMorphComplete - Morph animation finished
 * @param {Function} callbacks.onError - Fatal error
 */
export function createRenderBridge(canvas, {
    getAnimationState,
    onReady,
    onRendered,
    onMorphComplete,
    onError,
}) {
    let worker = null;
    let workerReady = false;
    let fallbackRenderer = null;
    let requestIdCounter = 0;
    const pendingCallbacks = new Map();
    let workerInitTimer = null;
    let targetRes = null;

    // One-shot callbacks for async worker responses
    let morphPrepareCallback = null;
    let foldOutCallback = null;
    let foldInCallback = null;

    /* ── Fallback activation ── */

    function activateFallbackRenderer() {
        if (fallbackRenderer) return;
        console.warn('[render] Activating main-thread fallback renderer');
        const fresh = document.createElement('canvas');
        fresh.id = canvas.id;
        fresh.width = canvas.width;
        fresh.height = canvas.height;
        canvas.replaceWith(fresh);
        canvas = fresh;
        worker = null;
        workerReady = false;
        fallbackRenderer = createRenderer(canvas);
        onReady?.();
    }

    /* ── Worker message handler ── */

    function handleMessage(e) {
        const msg = e.data;
        switch (msg.type) {
            case 'ready':
                if (workerInitTimer) { clearTimeout(workerInitTimer); workerInitTimer = null; }
                workerReady = true;
                {
                    const anim = getAnimationState?.() || { enabled: false };
                    worker.postMessage({ type: 'set-animation', enabled: anim.enabled });
                    if (anim.config) worker.postMessage({ type: 'set-anim-config', ...anim.config });
                }
                onReady?.();
                break;
            case 'rendered': {
                const cb = pendingCallbacks.get(msg.requestId);
                if (cb) { pendingCallbacks.delete(msg.requestId); cb(msg.meta); }
                onRendered?.(msg.meta);
                break;
            }
            case 'exported': {
                const cb = pendingCallbacks.get(msg.requestId);
                if (cb) { pendingCallbacks.delete(msg.requestId); cb(msg.blob); }
                break;
            }
            case 'export-error': {
                const cb = pendingCallbacks.get(msg.requestId);
                if (cb) { pendingCallbacks.delete(msg.requestId); cb(null); }
                break;
            }
            case 'morph-prepared':
                if (morphPrepareCallback) {
                    const cb = morphPrepareCallback;
                    morphPrepareCallback = null;
                    cb();
                }
                break;
            case 'morph-progress':
                break;
            case 'morph-complete':
                onMorphComplete?.();
                break;
            case 'morph-ended':
                break;
            case 'fold-out-complete':
                if (foldOutCallback) { const cb = foldOutCallback; foldOutCallback = null; cb(); }
                break;
            case 'fold-in-complete':
                if (foldInCallback) { const cb = foldInCallback; foldInCallback = null; cb(); }
                break;
            case 'error':
                console.error('[render] Worker reported error:', msg.error);
                if (workerInitTimer) { clearTimeout(workerInitTimer); workerInitTimer = null; }
                activateFallbackRenderer();
                onError?.(msg.error);
                break;
        }
    }

    /* ── Worker initialization ── */

    function initWorker() {
        if (!canvas.transferControlToOffscreen) return null;
        try {
            const offscreen = canvas.transferControlToOffscreen();
            canvas.dataset.transferred = '1';
            const w = new Worker(
                new URL('../engine/render-worker.js', import.meta.url),
                { type: 'module' },
            );
            w.onmessage = handleMessage;
            w.onerror = (err) => {
                console.error('[render] Worker error:', err.message);
                if (workerInitTimer) { clearTimeout(workerInitTimer); workerInitTimer = null; }
                activateFallbackRenderer();
            };
            const rect = canvas.getBoundingClientRect();
            const initRes = getResolution();
            const useTarget = initRes.key !== 'hd';
            w.postMessage({
                type: 'init',
                canvas: offscreen,
                width: useTarget ? initRes.w : rect.width,
                height: useTarget ? initRes.h : rect.height,
                dpr: window.devicePixelRatio,
            }, [offscreen]);

            workerInitTimer = setTimeout(() => {
                workerInitTimer = null;
                if (!workerReady) {
                    console.warn('[render] Worker init timed out, falling back');
                    activateFallbackRenderer();
                }
            }, 8000);

            return w;
        } catch (err) {
            console.warn('[render] Worker init failed:', err);
            return null;
        }
    }

    /* ── Initial setup ── */

    const initialRes = getResolution();
    canvas.width = initialRes.w;
    canvas.height = initialRes.h;
    targetRes = initialRes.key !== 'hd' ? { w: initialRes.w, h: initialRes.h } : null;

    worker = initWorker();
    if (!worker) {
        fallbackRenderer = createRenderer(canvas);
        fallbackRenderer.setTargetResolution(initialRes.w, initialRes.h);
    }

    // Resize observer (worker mode only)
    if (worker) {
        const obs = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target === canvas && !targetRes && workerReady) {
                    const { width, height } = entry.contentRect;
                    if (width > 0 && height > 0) {
                        worker.postMessage({ type: 'resize', width, height, dpr: window.devicePixelRatio });
                    }
                }
            }
        });
        obs.observe(canvas);
    }

    /* ── Helpers ── */

    function getCanvasSize() {
        if (targetRes) return targetRes;
        return {
            w: canvas.clientWidth || canvas.getBoundingClientRect().width,
            h: canvas.clientHeight || canvas.getBoundingClientRect().height,
        };
    }

    /* ── Public API ── */

    function sendRenderRequest(seed, controls, { deliberate = false, callback = null, locale = 'en' } = {}) {
        const id = ++requestIdCounter;
        if (callback) pendingCallbacks.set(id, callback);
        const size = getCanvasSize();
        if (worker && workerReady) {
            worker.postMessage({
                type: 'render', seed, controls, requestId: id, deliberate, locale,
                width: size.w, height: size.h,
            });
        } else if (fallbackRenderer) {
            const meta = fallbackRenderer.renderWith(seed, controls, locale);
            if (callback) { pendingCallbacks.delete(id); callback(meta); }
        }
    }

    function sendCameraState(zoom, rotation) {
        if (worker && workerReady) {
            worker.postMessage({ type: 'set-camera', zoom, orbitY: rotation, orbitX: 0 });
        } else if (fallbackRenderer) {
            fallbackRenderer.setCameraState(zoom, rotation, 0);
        }
    }

    function sendResize(w, h) {
        canvas.width = w;
        canvas.height = h;
        targetRes = { w, h };
        if (worker && workerReady) {
            worker.postMessage({ type: 'resize', width: w, height: h, dpr: window.devicePixelRatio });
        } else if (fallbackRenderer) {
            fallbackRenderer.setTargetResolution(w, h);
        }
    }

    function sendMorphPrepare(fromState, toState, onReady) {
        const size = getCanvasSize();
        if (worker && workerReady) {
            morphPrepareCallback = onReady;
            worker.postMessage({
                type: 'morph-prepare',
                seedA: fromState.seed, controlsA: fromState.controls,
                seedB: toState.seed, controlsB: toState.controls,
                width: size.w, height: size.h,
            });
        } else if (fallbackRenderer) {
            fallbackRenderer.morphPrepare(fromState.seed, fromState.controls, toState.seed, toState.controls);
            onReady?.();
        }
    }

    function sendMorphStart() {
        if (worker && workerReady) {
            worker.postMessage({ type: 'morph-start' });
        } else if (fallbackRenderer) {
            fallbackRenderer.morphUpdate(1.0);
            fallbackRenderer.morphEnd();
        }
    }

    function sendMorphCancel() {
        morphPrepareCallback = null;
        if (worker && workerReady) {
            worker.postMessage({ type: 'morph-cancel' });
        } else if (fallbackRenderer) {
            fallbackRenderer.morphEnd();
        }
    }

    function sendFoldOut(onComplete) {
        foldOutCallback = onComplete || null;
        if (worker && workerReady) {
            worker.postMessage({ type: 'fold-out' });
        } else if (fallbackRenderer) {
            fallbackRenderer.setFoldImmediate(0);
            if (foldOutCallback) { const cb = foldOutCallback; foldOutCallback = null; cb(); }
        }
    }

    function sendFoldIn(onComplete) {
        foldInCallback = onComplete || null;
        if (worker && workerReady) {
            worker.postMessage({ type: 'fold-in' });
        } else if (fallbackRenderer) {
            fallbackRenderer.setFoldImmediate(1);
            if (foldInCallback) { const cb = foldInCallback; foldInCallback = null; cb(); }
        }
    }

    function sendFoldImmediate(value) {
        if (worker && workerReady) {
            worker.postMessage({ type: 'fold-immediate', value });
        } else if (fallbackRenderer) {
            fallbackRenderer.setFoldImmediate(value);
        }
    }

    function sendAnimation(enabled) {
        if (worker && workerReady) {
            worker.postMessage({ type: 'set-animation', enabled });
        }
    }

    function sendAnimConfig(config) {
        if (worker && workerReady) {
            worker.postMessage({ type: 'set-anim-config', ...config });
        }
    }

    function sendVisibility(visible) {
        if (worker && workerReady) {
            worker.postMessage({ type: 'visibility', visible });
        }
    }

    function exportCanvas() {
        return new Promise((resolve, reject) => {
            if (worker && workerReady) {
                const id = ++requestIdCounter;
                pendingCallbacks.set(id, (b) => b ? resolve(b) : reject(new Error('Export failed')));
                worker.postMessage({ type: 'export', requestId: id });
            } else {
                reject(new Error('Worker not available for export'));
            }
        });
    }

    function cancelFoldCallbacks() {
        foldOutCallback = null;
        foldInCallback = null;
    }

    return {
        sendRenderRequest,
        sendCameraState,
        sendResize,
        sendMorphPrepare,
        sendMorphStart,
        sendMorphCancel,
        sendFoldOut,
        sendFoldIn,
        sendFoldImmediate,
        sendAnimation,
        sendAnimConfig,
        sendVisibility,
        exportCanvas,
        cancelFoldCallbacks,
        isReady: () => workerReady || !!fallbackRenderer,
        isWorker: () => !!(worker && workerReady),
        getCanvas: () => canvas,
        dispose() {
            if (workerInitTimer) clearTimeout(workerInitTimer);
            if (worker) { worker.terminate(); worker = null; }
            if (fallbackRenderer) { fallbackRenderer.dispose(); fallbackRenderer = null; }
        },
    };
}
