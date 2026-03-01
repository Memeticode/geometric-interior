/**
 * Gallery page worker bridge.
 * Manages a render worker lifecycle for the gallery's preview canvas
 * and generation dispatch. Lighter than editor-main.js — no morph,
 * no fold animation, just preview rendering and generation jobs.
 */

const RENDER_THROTTLE_MS = 200;
const INIT_TIMEOUT_MS = 8000;

/**
 * Initialize the gallery render worker.
 * @param {HTMLCanvasElement} canvas — the preview canvas element
 * @returns {{ sendRender, sendGenerate, cancelGenerate, resize, terminate, onReady, onMessage }}
 */
export function initGalleryWorker(canvas) {
    let worker = null;
    let ready = false;
    let renderTimer = null;
    let pendingPreview = null;
    let onReadyCallback = null;
    let messageHandlers = {};

    if (!canvas.transferControlToOffscreen) {
        console.warn('[gallery-worker] OffscreenCanvas not supported');
        return null;
    }

    try {
        const offscreen = canvas.transferControlToOffscreen();
        canvas.dataset.transferred = '1';

        worker = new Worker(
            new URL('../engine/render-worker.js', import.meta.url),
            { type: 'module' },
        );

        worker.onmessage = (e) => {
            const msg = e.data;
            switch (msg.type) {
                case 'ready':
                    ready = true;
                    // Disable animation loop — gallery preview is on-demand only
                    worker.postMessage({ type: 'set-animation', enabled: false });
                    if (onReadyCallback) onReadyCallback();
                    break;
                case 'rendered':
                    if (messageHandlers.rendered) messageHandlers.rendered(msg);
                    break;
                case 'generate-progress':
                    if (messageHandlers['generate-progress']) messageHandlers['generate-progress'](msg);
                    break;
                case 'generate-complete':
                    if (messageHandlers['generate-complete']) messageHandlers['generate-complete'](msg);
                    break;
                case 'generate-failed':
                    if (messageHandlers['generate-failed']) messageHandlers['generate-failed'](msg);
                    break;
                case 'generate-animation-progress':
                    if (messageHandlers['generate-animation-progress']) messageHandlers['generate-animation-progress'](msg);
                    break;
                case 'generate-animation-complete':
                    if (messageHandlers['generate-animation-complete']) messageHandlers['generate-animation-complete'](msg);
                    break;
                case 'generate-animation-failed':
                    if (messageHandlers['generate-animation-failed']) messageHandlers['generate-animation-failed'](msg);
                    break;
                case 'error':
                    console.error('[gallery-worker] Worker error:', msg.error);
                    break;
            }
        };

        worker.onerror = (err) => {
            console.error('[gallery-worker] Worker error:', err.message);
        };

        const rect = canvas.getBoundingClientRect();
        worker.postMessage({
            type: 'init',
            canvas: offscreen,
            width: rect.width || 420,
            height: rect.height || 270,
            dpr: Math.min(window.devicePixelRatio || 1, 2),
        }, [offscreen]);

        // Timeout fallback
        const initTimer = setTimeout(() => {
            if (!ready) {
                console.warn('[gallery-worker] Init timed out');
            }
        }, INIT_TIMEOUT_MS);

        const bridge = {
            get ready() { return ready; },

            /**
             * Register a callback for when the worker is ready.
             */
            onReady(cb) {
                if (ready) cb();
                else onReadyCallback = cb;
            },

            /**
             * Register message handlers by type.
             * @param {string} type
             * @param {Function} handler
             */
            on(type, handler) {
                messageHandlers[type] = handler;
            },

            /**
             * Send a debounced preview render request.
             */
            sendRender(seed, controls, locale) {
                if (!ready) return;
                pendingPreview = { seed, controls, locale };
                if (renderTimer) return;
                renderTimer = setTimeout(() => {
                    renderTimer = null;
                    if (pendingPreview) {
                        worker.postMessage({
                            type: 'render',
                            seed: pendingPreview.seed,
                            controls: pendingPreview.controls,
                            locale: pendingPreview.locale || 'en',
                            deliberate: true,
                        });
                        pendingPreview = null;
                    }
                }, RENDER_THROTTLE_MS);
            },

            /**
             * Send an immediate (non-debounced) render.
             */
            sendRenderImmediate(seed, controls, locale) {
                if (!ready) return;
                if (renderTimer) { clearTimeout(renderTimer); renderTimer = null; }
                pendingPreview = null;
                worker.postMessage({
                    type: 'render',
                    seed,
                    controls,
                    locale: locale || 'en',
                    deliberate: true,
                });
            },

            /**
             * Dispatch a full generation job to the worker.
             */
            sendGenerate({ requestId, seed, controls, locale, staticWidth, staticHeight, spriteWidth, spriteHeight, frameCount }) {
                if (!ready) return;
                worker.postMessage({
                    type: 'generate',
                    requestId,
                    seed,
                    controls,
                    locale: locale || 'en',
                    staticWidth,
                    staticHeight,
                    spriteWidth: spriteWidth || 280,
                    spriteHeight: spriteHeight || 180,
                    frameCount: frameCount || 60,
                });
            },

            /**
             * Cancel an in-progress generation.
             */
            cancelGenerate() {
                if (!ready) return;
                worker.postMessage({ type: 'generate-cancel' });
            },

            /**
             * Dispatch an animation generation job to the worker.
             * @param {{ requestId: string, animation: object }} opts
             */
            sendGenerateAnimation({ requestId, animation }) {
                if (!ready) return;
                worker.postMessage({ type: 'generate-animation', requestId, animation });
            },

            /**
             * Cancel an in-progress animation generation.
             */
            cancelGenerateAnimation() {
                if (!ready) return;
                worker.postMessage({ type: 'generate-animation-cancel' });
            },

            /**
             * Resize the worker canvas.
             */
            resize(width, height) {
                if (!ready) return;
                worker.postMessage({
                    type: 'resize',
                    width,
                    height,
                    dpr: Math.min(window.devicePixelRatio || 1, 2),
                });
            },

            /**
             * Terminate the worker.
             */
            terminate() {
                if (renderTimer) clearTimeout(renderTimer);
                clearTimeout(initTimer);
                if (worker) worker.terminate();
                worker = null;
                ready = false;
            },
        };

        return bridge;
    } catch (err) {
        console.warn('[gallery-worker] Init failed:', err);
        return null;
    }
}
