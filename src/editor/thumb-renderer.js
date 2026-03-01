/**
 * Thumbnail renderer — offscreen canvas rendering with persistent cache.
 * Renders thumbnails on idle via requestIdleCallback to avoid blocking the UI.
 */

import { createRenderer } from '../../lib/engine/create-renderer.js';
import { loadPortraits } from '../ui/profiles.js';
import { getAllThumbs, putThumb, deleteThumb } from '../ui/thumb-cache.js';

export function createThumbRenderer() {
    let offscreen = null;
    let renderer = null;
    let thumbW = 280, thumbH = 180;

    const cache = new Map();
    const queue = [];
    let processing = false;
    let drainDeferred = true;

    // Pre-load persistent thumbnail cache from IndexedDB
    const cacheReady = getAllThumbs().then(persisted => {
        for (const [key, url] of persisted) cache.set(key, url);
    });

    function getRenderer(w = 280, h = 180) {
        if (!renderer) {
            offscreen = document.createElement('canvas');
            offscreen.width = w;
            offscreen.height = h;
            thumbW = w; thumbH = h;
            renderer = createRenderer(offscreen);
        } else if (w !== thumbW || h !== thumbH) {
            offscreen.width = w;
            offscreen.height = h;
            thumbW = w; thumbH = h;
            renderer.resize(w, h);
        }
        return renderer;
    }

    function cacheKey(seed, controls) {
        return seed + '|' + JSON.stringify(controls);
    }

    function queueThumbnail(seed, controls, destImg) {
        const key = cacheKey(seed, controls);
        const wrap = destImg.closest('.thumb-wrap');
        if (cache.has(key)) {
            destImg.src = cache.get(key);
            if (wrap) wrap.classList.remove('thumb-loading');
            return;
        }
        if (wrap) wrap.classList.add('thumb-loading');
        queue.push({ seed, controls, destImg, key });
        drainQueue();
    }

    const scheduleIdle = window.requestIdleCallback || (cb => setTimeout(cb, 100));

    function drainQueue() {
        if (drainDeferred) return;
        if (processing || queue.length === 0) return;
        processing = true;
        scheduleIdle(() => {
            try {
                const item = queue.shift();
                const wrap = item ? item.destImg.closest('.thumb-wrap') : null;
                if (item && cache.has(item.key)) {
                    if (item.destImg.isConnected) item.destImg.src = cache.get(item.key);
                    if (wrap) wrap.classList.remove('thumb-loading');
                } else if (item && item.destImg.isConnected) {
                    getRenderer().renderWith(item.seed, item.controls);
                    const url = offscreen.toDataURL('image/png');
                    cache.set(item.key, url);
                    putThumb(item.key, url);
                    item.destImg.src = url;
                    if (wrap) wrap.classList.remove('thumb-loading');
                }
            } catch (err) {
                console.error('[thumb] render error:', err);
            }
            processing = false;
            drainQueue();
        });
    }

    function startDraining() {
        drainDeferred = false;
        drainQueue();
    }

    function removeCachedThumb(seed, controls) {
        const key = cacheKey(seed, controls);
        cache.delete(key);
        deleteThumb(key);
    }

    // Expose for build-time portrait generation (scripts/gen-thumbs.mjs)
    window.__renderPortraitThumb = function(profileName) {
        const portraits = loadPortraits();
        const p = portraits[profileName];
        if (!p) throw new Error(`Portrait not found: ${profileName}`);
        const r = getRenderer();
        r.renderWith(p.seed, p.controls);
        r.setFoldImmediate(1.0);
        r.updateTime(3.0);
        r.renderFrame();
        return offscreen.toDataURL('image/png');
    };

    return {
        queueThumbnail,
        cacheKey,
        cache,
        cacheReady,
        startDraining,
        removeCachedThumb,
    };
}
