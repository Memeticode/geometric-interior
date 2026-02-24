/**
 * Entry point — wires all modules to the DOM.
 * Phase 1: Three.js WebGL renderer with new control scheme.
 */

import { createRenderer } from './engine/create-renderer.js';
import { PALETTE_KEYS, updatePalette, resetPalette, getPaletteDefaults, getPalette } from './core/palettes.js';
import { loadProfiles, saveProfiles, deleteProfile, ensureStarterProfiles, loadPortraits, getPortraitNames, loadProfileOrder, saveProfileOrder, syncProfileOrder } from './ui/profiles.js';
import { packageStillZip, packageStillZipFromBlob, downloadBlob, canvasToPngBlob, injectPngTextChunks, toIsoLocalish, safeName } from './export/export.js';
import { encodeStateToURL, decodeStateFromURL } from './core/url-state.js';
import { initTheme } from './ui/theme.js';
import { createFaviconAnimation } from './ui/animated-favicon.js';
import { generateTitle, generateAltText } from './core/text.js';
import { xmur3, mulberry32 } from './core/prng.js';
import { validateStillConfig, configToProfile, profileToConfig } from './core/config-schema.js';
import { createMorphController, MORPH_DURATION_MS } from './core/morph.js';

/* ---------------------------
 * DOM references
 * ---------------------------
 */
let canvas = document.getElementById('c');

// After Vite HMR, the canvas may have been transferred to a previous worker.
// Detect this by checking the marker attribute set before transfer.
if (canvas.dataset.transferred) {
    const fresh = document.createElement('canvas');
    fresh.id = canvas.id;
    fresh.width = canvas.width;
    fresh.height = canvas.height;
    canvas.replaceWith(fresh);
    canvas = fresh;
}

const el = {
    seed: document.getElementById('profileName'),

    // Discrete controls (hidden inputs driven by tile/swatch UI)
    topology: document.getElementById('topology'),
    palette: document.getElementById('palette'),
    topologySelector: document.getElementById('topologySelector'),
    paletteSelector: document.getElementById('paletteSelector'),

    // Continuous controls
    density: document.getElementById('density'),
    luminosity: document.getElementById('luminosity'),
    fracture: document.getElementById('fracture'),
    depth: document.getElementById('depth'),
    coherence: document.getElementById('coherence'),

    densityLabel: document.getElementById('densityLabel'),
    luminosityLabel: document.getElementById('luminosityLabel'),
    fractureLabel: document.getElementById('fractureLabel'),
    depthLabel: document.getElementById('depthLabel'),
    coherenceLabel: document.getElementById('coherenceLabel'),

    profileNameField: document.getElementById('profileNameField'),
    saveProfile: document.getElementById('saveProfile'),
    resetProfile: document.getElementById('resetProfile'),
    portraitGallery: document.getElementById('portraitGallery'),
    userGallery: document.getElementById('userGallery'),
    galleryToggle: document.getElementById('galleryToggle'),
    galleryContent: document.getElementById('galleryContent'),
    activeSection: document.getElementById('activeSection'),
    activeCard: document.getElementById('activeCard'),
    activeCardToggle: document.getElementById('activeCardToggle'),
    activePreviewThumb: document.getElementById('activePreviewThumb'),
    activeStatusLabel: document.getElementById('activeStatusLabel'),
    activePreviewName: document.getElementById('activePreviewName'),
    activePreviewSeed: document.getElementById('activePreviewSeed'),

    titleText: document.getElementById('titleText'),
    altText: document.getElementById('altText'),
    textWrap: document.getElementById('textWrap'),
    textInner: document.getElementById('textInner'),
    displayName: document.getElementById('displayName'),
    displayIntent: document.getElementById('displayIntent'),
    toast: document.getElementById('toast'),

    developerStatement: document.getElementById('developerStatement'),
    artistStatement: document.getElementById('artistStatement'),
    statementModal: document.getElementById('statementModal'),
    statementModalClose: document.getElementById('statementModalClose'),
    statementTabSelect: document.getElementById('statementTabSelect'),
    statementTitle: document.getElementById('statementTitle'),
    developerBody: document.getElementById('developerBody'),
    artistBody: document.getElementById('artistBody'),
    governanceStatement: document.getElementById('governanceStatement'),
    governanceBody: document.getElementById('governanceBody'),

    canvasOverlay: document.getElementById('canvasOverlay'),
    canvasOverlayText: document.getElementById('canvasOverlayText'),
    exportBtn: document.getElementById('exportBtn'),
    shareBtn: document.getElementById('shareBtn'),
    sharePopover: document.getElementById('sharePopover'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsPopover: document.getElementById('settingsPopover'),
    animToggle: document.getElementById('animToggle'),

    infoModal: document.getElementById('infoModal'),
    infoModalTitle: document.getElementById('infoModalTitle'),
    infoModalBody: document.getElementById('infoModalBody'),
    infoModalClose: document.getElementById('infoModalClose'),

    // Custom palette editor
    customPaletteEditor: document.getElementById('customPaletteEditor'),
    customHue: document.getElementById('customHue'),
    customHueRange: document.getElementById('customHueRange'),
    customSat: document.getElementById('customSat'),
    customHueLabel: document.getElementById('customHueLabel'),
    customHueRangeLabel: document.getElementById('customHueRangeLabel'),
    customSatLabel: document.getElementById('customSatLabel'),
    customPalGradient: document.getElementById('customPalGradient'),
};

/* Auto-grow textareas (fallback for browsers without field-sizing: content) */
function autoGrow(ta) {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
}
for (const ta of document.querySelectorAll('textarea.auto-grow')) {
    ta.addEventListener('input', () => autoGrow(ta));
    autoGrow(ta);
}

const SLIDER_KEYS = ['density', 'luminosity', 'fracture', 'depth', 'coherence'];
const TOPOLOGY_VALUES = ['flow-field', 'icosahedral', 'mobius', 'multi-attractor'];

/* ---------------------------
 * Module instances
 * ---------------------------
 */
let renderWorker = null;
let workerReady = false;
let fallbackRenderer = null;
let initComplete = false;
let requestIdCounter = 0;
const pendingCallbacks = new Map();

let workerInitTimer = null;

function activateFallbackRenderer() {
    if (fallbackRenderer) return; // already activated
    console.warn('[render] Activating main-thread fallback renderer');
    // After transferControlToOffscreen(), the original canvas can't render
    // on the main thread. Replace it with a fresh canvas element.
    const newCanvas = document.createElement('canvas');
    newCanvas.id = canvas.id;
    newCanvas.width = canvas.width;
    newCanvas.height = canvas.height;
    canvas.replaceWith(newCanvas);
    canvas = newCanvas;
    renderWorker = null;
    workerReady = false;
    fallbackRenderer = createRenderer(canvas);
    doInitialRender();
}

function initWorkerRenderer() {
    if (!canvas.transferControlToOffscreen) return null;
    try {
        const offscreen = canvas.transferControlToOffscreen();
        canvas.dataset.transferred = '1';
        const worker = new Worker(
            new URL('./engine/render-worker.js', import.meta.url),
            { type: 'module' },
        );
        worker.onmessage = onWorkerMessage;
        worker.onerror = (err) => {
            console.error('[render] Worker error:', err.message);
            if (workerInitTimer) { clearTimeout(workerInitTimer); workerInitTimer = null; }
            activateFallbackRenderer();
        };
        const rect = canvas.getBoundingClientRect();
        worker.postMessage({
            type: 'init',
            canvas: offscreen,
            width: rect.width,
            height: rect.height,
            dpr: window.devicePixelRatio,
        }, [offscreen]);

        // Timeout: if worker doesn't respond within 8s, fall back
        workerInitTimer = setTimeout(() => {
            workerInitTimer = null;
            if (!workerReady) {
                console.warn('[render] Worker init timed out, falling back');
                activateFallbackRenderer();
            }
        }, 8000);

        return worker;
    } catch (err) {
        console.warn('[render] Worker init failed, using main-thread fallback:', err);
        return null;
    }
}

function onWorkerMessage(e) {
    const msg = e.data;
    switch (msg.type) {
        case 'ready':
            if (workerInitTimer) { clearTimeout(workerInitTimer); workerInitTimer = null; }
            workerReady = true;
            doInitialRender();
            break;
        case 'rendered': {
            lastNodeCount = msg.meta.nodeCount || 0;
            const cb = pendingCallbacks.get(msg.requestId);
            if (cb) { pendingCallbacks.delete(msg.requestId); cb(msg.meta); }
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
        case 'morph-frame':
            // Worker is rendering frames autonomously; nothing to do here
            break;
        case 'morph-complete':
            // Worker finished all 72 frames; UI morph controller handles completion
            break;
        case 'morph-ended':
            // Worker acknowledged morph cancel
            break;
        case 'error':
            console.error('[render] Worker reported error:', msg.error);
            if (workerInitTimer) { clearTimeout(workerInitTimer); workerInitTimer = null; }
            activateFallbackRenderer();
            break;
    }
}

renderWorker = initWorkerRenderer();
if (!renderWorker) {
    fallbackRenderer = createRenderer(canvas);
}

// Track canvas size changes and forward to worker
if (renderWorker) {
    const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            if (entry.target === canvas) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0 && workerReady) {
                    renderWorker.postMessage({
                        type: 'resize',
                        width,
                        height,
                        dpr: window.devicePixelRatio,
                    });
                }
            }
        }
    });
    resizeObserver.observe(canvas);
}

/* ---------------------------
 * Thumbnail generator
 * ---------------------------
 */
let thumbOffscreen = null;
let thumbRenderer = null;

function getThumbRenderer() {
    if (!thumbRenderer) {
        thumbOffscreen = document.createElement('canvas');
        thumbOffscreen.width = 280;
        thumbOffscreen.height = 180;
        thumbRenderer = createRenderer(thumbOffscreen);
    }
    return thumbRenderer;
}

const thumbCache = new Map();
const thumbQueue = [];
let thumbProcessing = false;

function thumbCacheKey(seed, controls, paletteTweaks) {
    let k = seed + '|' + JSON.stringify(controls);
    if (paletteTweaks) k += '|' + JSON.stringify(paletteTweaks);
    return k;
}

function queueThumbnail(seed, controls, destImg, paletteTweaks) {
    // Normalize: if no tweaks provided, use factory defaults for the palette
    // so cache keys and render results are identical either way
    const tweaks = paletteTweaks || getPaletteDefaults(controls.palette || 'violet-depth');
    const key = thumbCacheKey(seed, controls, tweaks);
    const wrap = destImg.closest('.thumb-wrap');
    if (thumbCache.has(key)) {
        destImg.src = thumbCache.get(key);
        if (wrap) wrap.classList.remove('thumb-loading');
        return;
    }
    if (wrap) wrap.classList.add('thumb-loading');
    thumbQueue.push({ seed, controls, destImg, key, paletteTweaks: tweaks });
    drainThumbQueue();
}

function drainThumbQueue() {
    if (thumbProcessing || thumbQueue.length === 0) return;
    thumbProcessing = true;
    setTimeout(() => {
        try {
            const item = thumbQueue.shift();
            // Re-check cache — another queued item with the same key may
            // have already rendered (e.g. the custom-select and gallery
            // share profiles, so both queue the same keys at startup).
            const wrap = item ? item.destImg.closest('.thumb-wrap') : null;
            if (item && thumbCache.has(item.key)) {
                if (item.destImg.isConnected) item.destImg.src = thumbCache.get(item.key);
                if (wrap) wrap.classList.remove('thumb-loading');
            } else if (item && item.destImg.isConnected) {
                const palKey = item.controls.palette;
                resetPalette(palKey);
                if (item.paletteTweaks) updatePalette(palKey, item.paletteTweaks);
                getThumbRenderer().renderWith(item.seed, item.controls);
                const url = thumbOffscreen.toDataURL('image/png');
                thumbCache.set(item.key, url);
                item.destImg.src = url;
                if (wrap) wrap.classList.remove('thumb-loading');
            }
        } catch (err) {
            console.error('[thumb] render error:', err);
        }
        thumbProcessing = false;
        drainThumbQueue();
    }, 100);
}

/* ---------------------------
 * Topology tile selector
 * ---------------------------
 */
function initTopologySelector() {
    const tiles = el.topologySelector.querySelectorAll('.topo-tile');
    tiles.forEach(tile => {
        tile.addEventListener('click', () => {
            tiles.forEach(t => t.classList.remove('active'));
            tile.classList.add('active');
            el.topology.value = tile.dataset.value;
            onControlChange();
        });
    });
}

function setTopologyUI(value) {
    el.topology.value = value;
    const tiles = el.topologySelector.querySelectorAll('.topo-tile');
    tiles.forEach(t => {
        t.classList.toggle('active', t.dataset.value === value);
    });
}

/* ---------------------------
 * Palette swatch selector
 * ---------------------------
 */
/* ── Chip gradient cache (for restoring after edits) ── */
const originalChipGradients = new Map();

function cacheChipGradients() {
    for (const chip of el.paletteSelector.querySelectorAll('.pal-chip')) {
        const g = chip.querySelector('.pal-gradient');
        if (g) originalChipGradients.set(chip.dataset.value, g.style.background);
    }
}

function restoreChipGradient(key) {
    const orig = originalChipGradients.get(key);
    if (!orig) return;
    const chip = el.paletteSelector.querySelector(`.pal-chip[data-value="${key}"]`);
    const g = chip?.querySelector('.pal-gradient');
    if (g) g.style.background = orig;
}

function updateActiveChipGradient(key, settings) {
    const chip = el.paletteSelector.querySelector(`.pal-chip[data-value="${key}"]`);
    const g = chip?.querySelector('.pal-gradient');
    if (!g) return;
    const h = settings.baseHue;
    const hr = settings.hueRange;
    if (hr >= 180) {
        // Wide hue range: 5-stop rainbow across the full span
        const stops = [];
        for (let i = 0; i < 5; i++) {
            const t = i / 4;
            const hue = ((h - hr / 2) + hr * t + 360) % 360;
            const lit = 15 + t * 55;
            stops.push(`hsl(${hue} 65% ${lit}%)`);
        }
        g.style.background = `linear-gradient(135deg, ${stops.join(', ')})`;
    } else {
        const h1 = ((h - hr / 2) + 360) % 360;
        const h3 = (h + hr / 2) % 360;
        g.style.background =
            `linear-gradient(135deg, hsl(${h1} 50% 15%), hsl(${h} 60% 45%), hsl(${h3} 60% 70%))`;
    }
}

/* ── Palette editor (works for all palettes) ── */

const PAL_LS_PREFIX = 'geo_self_portrait_palette_v2_';
function paletteLSKey(key) { return PAL_LS_PREFIX + key; }

function readPaletteFromUI() {
    return {
        baseHue: parseInt(el.customHue.value, 10),
        hueRange: parseInt(el.customHueRange.value, 10),
        saturation: parseFloat(el.customSat.value),
    };
}

function loadPaletteIntoEditor(key) {
    const defaults = getPaletteDefaults(key);
    let vals = defaults;
    // Only restore localStorage tweaks for the custom palette;
    // built-in palettes always reset to their defaults when selected
    if (key === 'custom') {
        try {
            const raw = localStorage.getItem(paletteLSKey(key));
            if (raw) {
                const s = JSON.parse(raw);
                vals = {
                    baseHue: s.baseHue ?? defaults.baseHue,
                    hueRange: s.hueRange ?? defaults.hueRange,
                    saturation: s.saturation ?? defaults.saturation,
                };
            }
        } catch { /* ignore */ }
    } else {
        // Reset the built-in palette to factory defaults
        resetPalette(key);
        localStorage.removeItem(paletteLSKey(key));
    }
    el.customHue.value = vals.baseHue;
    el.customHueRange.value = vals.hueRange;
    el.customSat.value = vals.saturation;
    syncPaletteEditor();
}

function syncPaletteEditor() {
    const key = el.palette.value;
    const settings = readPaletteFromUI();
    updatePalette(key, settings);
    localStorage.setItem(paletteLSKey(key), JSON.stringify(settings));

    // Update labels
    el.customHueLabel.textContent = settings.baseHue;
    el.customHueRangeLabel.textContent = settings.hueRange;
    el.customSatLabel.textContent = settings.saturation.toFixed(2);

    // Only update the custom chip dynamically; built-in chips keep cached originals
    if (key === 'custom') updateActiveChipGradient(key, settings);

    // Show/hide "Write to Custom" button
    const wtc = document.getElementById('writeToCustom');
    if (wtc) wtc.classList.toggle('wtc-collapsed', key === 'custom');
}

function initPaletteSelector() {
    // Generate all chip gradients from palette data so they match the active state
    for (const chip of el.paletteSelector.querySelectorAll('.pal-chip')) {
        const key = chip.dataset.value;
        if (key === 'custom') continue;
        const pal = getPalette(key);
        if (pal) updateActiveChipGradient(key, pal);
    }
    // Sync custom chip gradient from localStorage (or defaults) so it always
    // reflects the user's configured colors, not the hardcoded HTML fallback
    {
        const defaults = getPaletteDefaults('custom');
        let customSettings = defaults;
        try {
            const raw = localStorage.getItem(paletteLSKey('custom'));
            if (raw) {
                const s = JSON.parse(raw);
                customSettings = {
                    baseHue: s.baseHue ?? defaults.baseHue,
                    hueRange: s.hueRange ?? defaults.hueRange,
                    saturation: s.saturation ?? defaults.saturation,
                };
            }
        } catch { /* ignore */ }
        updateActiveChipGradient('custom', customSettings);
    }
    cacheChipGradients();

    const chips = el.paletteSelector.querySelectorAll('.pal-chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            const key = chip.dataset.value;
            const alreadyActive = chip.classList.contains('active');
            const prevKey = el.palette.value;

            // Reset previous built-in palette when switching away
            if (prevKey !== key && prevKey !== 'custom') {
                resetPalette(prevKey);
                restoreChipGradient(prevKey);
            }

            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            el.palette.value = key;

            if (alreadyActive) {
                // Re-click: toggle editor open/closed
                el.customPaletteEditor.classList.toggle('collapsed');
            } else if (key === 'custom') {
                // Custom always opens editor
                el.customPaletteEditor.classList.remove('collapsed');
                loadPaletteIntoEditor(key);
            } else {
                // Non-custom preset: keep editor in its current state
                // (stays open if already open, stays closed if closed)
                loadPaletteIntoEditor(key);
            }
            onControlChange();
        });
    });

    // Wire palette sliders (work for any active palette)
    for (const id of ['customHue', 'customHueRange', 'customSat']) {
        el[id].addEventListener('input', () => {
            syncPaletteEditor();
            onControlChange();
        });
    }

    // "Reset" button — restore palette to factory defaults
    const resetBtn = document.getElementById('resetPalette');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            const key = el.palette.value;
            if (key !== 'custom') resetPalette(key);
            localStorage.removeItem(paletteLSKey(key));
            restoreChipGradient(key);
            const defaults = getPaletteDefaults(key);
            el.customHue.value = defaults.baseHue;
            el.customHueRange.value = defaults.hueRange;
            el.customSat.value = defaults.saturation;
            syncPaletteEditor();
            onControlChange();
        });
    }

    // "Write to Custom" button
    const wtc = document.getElementById('writeToCustom');
    if (wtc) {
        wtc.addEventListener('click', () => {
            const settings = readPaletteFromUI();
            updatePalette('custom', settings);
            localStorage.setItem(paletteLSKey('custom'), JSON.stringify(settings));
            // Reset the current built-in palette
            const prevKey = el.palette.value;
            if (prevKey !== 'custom') {
                resetPalette(prevKey);
                restoreChipGradient(prevKey);
            }
            // Switch UI to custom
            el.palette.value = 'custom';
            chips.forEach(c => c.classList.toggle('active', c.dataset.value === 'custom'));
            syncPaletteEditor();
            onControlChange();
        });
    }
}

function setPaletteUI(value) {
    const prevKey = el.palette.value;
    if (prevKey !== value && prevKey !== 'custom') {
        resetPalette(prevKey);
        restoreChipGradient(prevKey);
    }
    el.palette.value = value;
    const chips = el.paletteSelector.querySelectorAll('.pal-chip');
    chips.forEach(c => c.classList.toggle('active', c.dataset.value === value));
    loadPaletteIntoEditor(value);
    el.customPaletteEditor.classList.add('collapsed');
}

function restorePaletteTweaksFromStorage() {
    // Migrate old custom palette key
    const OLD_KEY = 'geo_self_portrait_custom_palette_v1';
    try {
        const old = localStorage.getItem(OLD_KEY);
        if (old && !localStorage.getItem(paletteLSKey('custom'))) {
            localStorage.setItem(paletteLSKey('custom'), old);
        }
        localStorage.removeItem(OLD_KEY);
    } catch { /* ignore */ }

    // Restore custom palette
    try {
        const raw = localStorage.getItem(paletteLSKey('custom'));
        if (raw) {
            const s = JSON.parse(raw);
            updatePalette('custom', s);
        }
    } catch { /* ignore */ }

    // Restore active built-in palette tweaks
    const activeKey = el.palette.value;
    if (activeKey && activeKey !== 'custom') {
        try {
            const raw = localStorage.getItem(paletteLSKey(activeKey));
            if (raw) updatePalette(activeKey, JSON.parse(raw));
        } catch { /* ignore */ }
    }
}

/* ---------------------------
 * State
 * ---------------------------
 */
let stillRendered = false;
let loadedProfileName = '';
let loadedFromPortrait = false;

/* ---------------------------
 * Render dispatch
 * ---------------------------
 */
let renderPending = false;
let renderTimerId = null;
let lastRenderTime = 0;
const RENDER_THROTTLE_MS = 150;

/**
 * Send a render request to the worker (or fallback renderer).
 * @param {string} seed
 * @param {object} controls
 * @param {object} [opts]
 * @param {boolean} [opts.deliberate] - True for profile loads / randomize (not slider tweaks)
 * @param {Function} [opts.callback] - Called with meta when render completes
 */
function sendRenderRequest(seed, controls, { deliberate = false, callback = null } = {}) {
    const id = ++requestIdCounter;
    if (callback) pendingCallbacks.set(id, callback);

    if (renderWorker && workerReady) {
        // Gather palette tweaks for the active palette
        const paletteTweaks = {};
        paletteTweaks[controls.palette] = readPaletteFromUI();

        renderWorker.postMessage({
            type: 'render',
            seed,
            controls,
            paletteTweaks,
            requestId: id,
            deliberate,
            width: canvas.clientWidth || canvas.getBoundingClientRect().width,
            height: canvas.clientHeight || canvas.getBoundingClientRect().height,
        });
    } else if (fallbackRenderer) {
        const meta = fallbackRenderer.renderWith(seed, controls);
        lastNodeCount = meta.nodeCount || 0;
        if (callback) { pendingCallbacks.delete(id); callback(meta); }
    }
}

function scheduleRender() {
    if (renderPending) return;
    renderPending = true;
    const elapsed = performance.now() - lastRenderTime;
    const delay = Math.max(0, RENDER_THROTTLE_MS - elapsed);
    renderTimerId = setTimeout(() => {
        renderTimerId = null;
        requestAnimationFrame(doRender);
    }, delay);
}

function doRender() {
    renderPending = false;
    lastRenderTime = performance.now();
    const seed = el.seed.value.trim() || 'seed';
    const controls = readControlsFromUI();
    sendRenderRequest(seed, controls);
}

function cancelPendingRender() {
    if (renderTimerId !== null) {
        clearTimeout(renderTimerId);
        renderTimerId = null;
    }
    renderPending = false;
}

/* ---------------------------
 * Morph controller
 * ---------------------------
 */
let morphLastPalette = null;

let morphPrepareCallback = null;

/**
 * Send morph-prepare to the worker (or fallback renderer).
 * Calls onReady once both scenes are built.
 */
function sendMorphPrepare(fromState, toState, onReady) {
    const paletteTweaksA = {};
    paletteTweaksA[fromState.controls.palette] = fromState.paletteTweaks;
    const paletteTweaksB = {};
    paletteTweaksB[toState.controls.palette] = toState.paletteTweaks;

    if (renderWorker && workerReady) {
        morphPrepareCallback = onReady;
        renderWorker.postMessage({
            type: 'morph-prepare',
            seedA: fromState.seed,
            controlsA: fromState.controls,
            seedB: toState.seed,
            controlsB: toState.controls,
            paletteTweaksA,
            paletteTweaksB,
            width: canvas.clientWidth || canvas.getBoundingClientRect().width,
            height: canvas.clientHeight || canvas.getBoundingClientRect().height,
        });
    } else if (fallbackRenderer) {
        for (const [key, tweaks] of Object.entries(paletteTweaksA)) {
            updatePalette(key, tweaks);
        }
        for (const [key, tweaks] of Object.entries(paletteTweaksB)) {
            updatePalette(key, tweaks);
        }
        fallbackRenderer.morphPrepare(fromState.seed, fromState.controls, toState.seed, toState.controls);
        onReady();
    }
}

function sendMorphStart() {
    if (renderWorker && workerReady) {
        renderWorker.postMessage({ type: 'morph-start' });
    } else if (fallbackRenderer) {
        // Fallback: drive morph from main thread timer at fixed 24fps
        let frame = 0;
        const FRAMES = 72;
        const FRAME_MS = 1000 / 24;
        function fallbackTick() {
            if (frame >= FRAMES) {
                fallbackRenderer.morphEnd();
                return;
            }
            const tRaw = frame / (FRAMES - 1);
            const t = 0.5 * (1 - Math.cos(Math.PI * tRaw));
            fallbackRenderer.morphUpdate(t);
            frame++;
            fallbackMorphTimer = setTimeout(fallbackTick, FRAME_MS);
        }
        fallbackTick();
    }
}

function sendMorphCancel() {
    if (renderWorker && workerReady) {
        renderWorker.postMessage({ type: 'morph-cancel' });
    } else if (fallbackRenderer) {
        if (fallbackMorphTimer !== null) {
            clearTimeout(fallbackMorphTimer);
            fallbackMorphTimer = null;
        }
        fallbackRenderer.morphEnd();
    }
}

let fallbackMorphTimer = null;

const morphCtrl = createMorphController({
    onTick(interpolated, tEased) {
        const palKey = interpolated.controls.palette;

        // Snap palette preset (only fires once at midpoint when it changes)
        if (palKey !== morphLastPalette) {
            setPaletteUI(palKey);
            morphLastPalette = palKey;
        }

        // Set palette tweaks (overwrite whatever setPaletteUI loaded)
        el.customHue.value = Math.round(interpolated.paletteTweaks.baseHue);
        el.customHueRange.value = Math.round(interpolated.paletteTweaks.hueRange);
        el.customSat.value = interpolated.paletteTweaks.saturation.toFixed(2);
        el.customHueLabel.textContent = Math.round(interpolated.paletteTweaks.baseHue);
        el.customHueRangeLabel.textContent = Math.round(interpolated.paletteTweaks.hueRange);
        el.customSatLabel.textContent = interpolated.paletteTweaks.saturation.toFixed(2);
        updatePalette(palKey, interpolated.paletteTweaks);

        // Update slider values
        for (const key of SLIDER_KEYS) {
            el[key].value = interpolated.controls[key];
        }
        updateSliderLabels(interpolated.controls);

        // Worker drives its own rendering at fixed 24fps — no sendMorphUpdate needed
    },
    onComplete() {
        // Worker completes on its own; this just handles UI animation completion
        morphLastPalette = null;
        setMorphLocked(false);
        setStillRendered(true);
        refreshGeneratedText(true);
    },
});

function startMorph(fromState, toState) {
    if (!animationEnabled) {
        // Instant render, no animation
        const seed = el.seed.value.trim() || 'seed';
        const controls = readControlsFromUI();
        renderAndUpdate(seed, controls, { animate: true });
        setStillRendered(true);
        return;
    }

    cancelPendingRender();
    cancelTextRefresh();
    if (typewriterAbort) { typewriterAbort(); typewriterAbort = null; }

    // If morph is already active, chain from current interpolated position
    if (morphCtrl.isActive()) {
        const current = morphCtrl.cancel();
        sendMorphCancel();
        if (current) fromState = current;
    }

    // Cancel any pending morph-prepare callback
    morphPrepareCallback = null;
    morphLastPalette = fromState.controls.palette;
    setStillRendered(false);
    setMorphLocked(true);

    // Build both scenes in worker, then start the animation
    sendMorphPrepare(fromState, toState, () => {
        sendMorphStart();
        morphCtrl.start(fromState, toState);
    });
}

/* ---------------------------
 * Controls reading/writing
 * ---------------------------
 */
function readControlsFromUI() {
    return {
        topology: 'flow-field',
        palette: el.palette.value,
        density: parseFloat(el.density.value),
        luminosity: parseFloat(el.luminosity.value),
        fracture: parseFloat(el.fracture.value),
        depth: parseFloat(el.depth.value),
        coherence: parseFloat(el.coherence.value),
    };
}

function updateSliderLabels(controls) {
    el.densityLabel.textContent = controls.density.toFixed(2);
    el.luminosityLabel.textContent = controls.luminosity.toFixed(2);
    el.fractureLabel.textContent = controls.fracture.toFixed(2);
    el.depthLabel.textContent = controls.depth.toFixed(2);
    el.coherenceLabel.textContent = controls.coherence.toFixed(2);
}

function setControlsInUI(controls) {
    setTopologyUI(controls.topology || 'flow-field');
    setPaletteUI(controls.palette || 'violet-depth');
    for (const key of SLIDER_KEYS) {
        if (el[key] && controls[key] !== undefined) {
            el[key].value = controls[key];
        }
    }
    updateSliderLabels(readControlsFromUI());
}


/* ---------------------------
 * Helpers
 * ---------------------------
 */
let toastTimer = 0;
function toast(msg) {
    if (!msg) return;
    clearTimeout(toastTimer);
    document.getElementById('toastMsg').textContent = msg;
    el.toast.classList.add('visible');
    toastTimer = setTimeout(() => {
        el.toast.classList.remove('visible');
    }, 1000);
}

document.getElementById('toastClose').addEventListener('click', () => {
    clearTimeout(toastTimer);
    el.toast.classList.remove('visible');
});

function syncDisplayFields() {
    el.displayName.textContent = el.profileNameField.value.trim();
    el.displayIntent.textContent = el.seed.value.trim();
}

function loadProfileDataIntoUI(name, p) {
    if (!name || !p) return;
    el.profileNameField.value = name;
    autoGrow(el.profileNameField);
    el.seed.value = p.seed || name;
    autoGrow(el.seed);
    if (p.controls) {
        setControlsInUI(p.controls);

        // Apply profile's stored palette tweaks AFTER setControlsInUI
        // (setControlsInUI calls loadPaletteIntoEditor which reads from
        // localStorage and would overwrite profile-specific tweaks)
        const palKey = p.controls.palette || 'violet-depth';
        const tweaks = p.paletteTweaks || (palKey === 'custom' ? p.customPalette : null);
        if (tweaks) {
            el.customHue.value = tweaks.baseHue;
            el.customHueRange.value = tweaks.hueRange;
            el.customSat.value = tweaks.saturation;
            updatePalette(palKey, tweaks);
            updateActiveChipGradient(palKey, tweaks);
        } else {
            // No stored tweaks — reset to factory defaults so thumbnail
            // and main canvas match (thumbnails use defaults when no tweaks)
            const defaults = getPaletteDefaults(palKey);
            el.customHue.value = defaults.baseHue;
            el.customHueRange.value = defaults.hueRange;
            el.customSat.value = defaults.saturation;
            resetPalette(palKey);
            updateActiveChipGradient(palKey, defaults);
        }
    }
    el.customPaletteEditor.classList.add('collapsed');
    syncDisplayFields();
    setDirty(false);
    setUserEdited(false);
    captureBaseline();
}

function loadProfileIntoUI(name) {
    if (!name) return;
    const profiles = loadProfiles();
    const p = profiles[name];
    if (!p) return;
    loadProfileDataIntoUI(name, p);
    loadedProfileName = name;
    loadedFromPortrait = false;
}

function loadProfileFromData(name, isPortrait) {
    if (isPortrait) {
        const portraits = loadPortraits();
        const p = portraits[name];
        if (!p) return;
        loadProfileDataIntoUI(name, p);
    } else {
        const profiles = loadProfiles();
        const p = profiles[name];
        if (!p) return;
        loadProfileDataIntoUI(name, p);
    }
    loadedProfileName = name;
    loadedFromPortrait = isPortrait;
}

let morphLocked = false;

function setMorphLocked(locked) {
    morphLocked = locked;
    el.exportBtn.disabled = locked;
    el.shareBtn.disabled = locked;
    el.settingsBtn.disabled = locked;
    document.getElementById('historyBackBtn').disabled = locked || historyIndex <= 0;
    document.getElementById('historyForwardBtn').disabled = locked || historyIndex >= navHistory.length - 1;
    document.getElementById('configRandomizeBtn').disabled = locked;
    // Close popovers when locking
    if (locked) {
        el.sharePopover.classList.add('hidden');
        el.settingsPopover.classList.add('hidden');
    }
    // Lock/unlock panel interactions
    const panelEl = document.querySelector('.panel');
    if (panelEl) panelEl.classList.toggle('morph-locked', locked);
}

function setStillRendered(value) {
    stillRendered = value;
    if (!morphLocked) {
        el.exportBtn.disabled = !value;
        el.shareBtn.disabled = !value;
    }
}

let dirty = false;
let userEdited = false;
let baselineSnapshot = null;

function setDirty(value) {
    dirty = value;
    el.saveProfile.disabled = !value;
    updateActiveSection();
}

function setUserEdited(value) {
    userEdited = value;
    el.resetProfile.disabled = !value;
}

function clearStillText() {
    if (typewriterAbort) { typewriterAbort(); typewriterAbort = null; }
    el.titleText.textContent = '';
    el.altText.textContent = '';
    hideCanvasOverlay();
}

/* Debounced generated-text refresh */
let lastNodeCount = 0;
let textRefreshTimer = null;

function refreshGeneratedText(animate) {
    const seed = el.seed.value.trim() || 'seed';
    const controls = readControlsFromUI();
    const titleRng = mulberry32(xmur3(seed + ':title')());
    const title = generateTitle(controls, titleRng);
    const altText = generateAltText(controls, lastNodeCount, title);
    if (animate) {
        playRevealAnimation(title, altText);
    } else {
        el.titleText.textContent = title;
        el.altText.textContent = altText;
        syncTextWrapHeight();
    }
}

function scheduleTextRefresh() {
    if (textRefreshTimer) clearTimeout(textRefreshTimer);
    textRefreshTimer = setTimeout(() => {
        textRefreshTimer = null;
        refreshGeneratedText(true);
    }, 1000);
}

function cancelTextRefresh() {
    if (textRefreshTimer) { clearTimeout(textRefreshTimer); textRefreshTimer = null; }
}

function showCanvasOverlay(text) {
    el.canvasOverlayText.textContent = text;
    el.canvasOverlay.classList.remove('hidden');
}

function hideCanvasOverlay() {
    el.canvasOverlay.classList.add('hidden');
}

/* Text wrap height animation */
let textHeightRAF = null;

function syncTextWrapHeight() {
    const h = el.textInner.scrollHeight;
    el.textWrap.style.maxHeight = h + 'px';
}

function startTextHeightSync() {
    stopTextHeightSync();
    let lastH = 0;
    function poll() {
        const h = el.textInner.scrollHeight;
        if (h !== lastH) { el.textWrap.style.maxHeight = h + 'px'; lastH = h; }
        textHeightRAF = requestAnimationFrame(poll);
    }
    textHeightRAF = requestAnimationFrame(poll);
}

function stopTextHeightSync() {
    if (textHeightRAF) { cancelAnimationFrame(textHeightRAF); textHeightRAF = null; }
}

function collapseTextWrap() {
    el.textWrap.style.maxHeight = '0';
}

/* Typewriter effect */
let typewriterAbort = null;

function typewriterEffect(element, text, charDelayMs, onComplete) {
    let i = 0;
    let cancelled = false;
    const textNode = document.createTextNode('');
    const cursor = document.createElement('span');
    cursor.className = 'tw-cursor';
    element.textContent = '';
    element.appendChild(textNode);
    element.appendChild(cursor);

    function tick() {
        if (cancelled) { cursor.remove(); return; }
        if (i <= text.length) {
            textNode.textContent = text.slice(0, i);
            i++;
            setTimeout(tick, charDelayMs);
        } else {
            cursor.remove();
            if (onComplete) onComplete();
        }
    }
    tick();
    return () => { cancelled = true; cursor.remove(); };
}

function playRevealAnimation(titleText, altText) {
    if (typewriterAbort) { typewriterAbort(); typewriterAbort = null; }
    stopTextHeightSync();
    el.titleText.textContent = '';
    el.altText.textContent = '';
    collapseTextWrap();

    // Canvas fades in immediately via 200ms CSS transition
    hideCanvasOverlay();

    // Smoothly grow text area as typewriter adds characters
    startTextHeightSync();

    // Text types as non-blocking decoration below the canvas
    const cancelTitle = typewriterEffect(el.titleText, titleText, 20, () => {
        const cancelAlt = typewriterEffect(el.altText, altText, 6, () => {
            typewriterAbort = null;
            stopTextHeightSync();
            syncTextWrapHeight();
        });
        typewriterAbort = cancelAlt;
    });
    typewriterAbort = cancelTitle;
}

function renderAndUpdate(seed, controls, { animate = false } = {}) {
    cancelPendingRender();
    cancelTextRefresh();
    if (animate) {
        el.canvasOverlay.classList.remove('hidden');
        el.canvasOverlayText.textContent = '';
    }
    sendRenderRequest(seed, controls, {
        deliberate: true,
        callback(meta) {
            lastNodeCount = meta.nodeCount || 0;
            if (animate) {
                playRevealAnimation(meta.title, meta.altText);
            } else {
                el.titleText.textContent = meta.title;
                el.altText.textContent = meta.altText;
                syncTextWrapHeight();
            }
            syncDisplayFields();
        },
    });
}

/* ---------------------------
 * Live render on control change
 * ---------------------------
 */
function renderStillCanvas() {
    const seed = el.seed.value.trim() || 'seed';
    const controls = readControlsFromUI();
    updateSliderLabels(controls);
    sendRenderRequest(seed, controls);
}

function onControlChange() {
    if (!initComplete) return;
    if (morphCtrl.isActive()) {
        morphCtrl.cancel();
        sendMorphCancel();
    } else if (morphPrepareCallback) {
        // Cancel pending morph-prepare before it started
        sendMorphCancel();
    }
    if (morphLocked) setMorphLocked(false);
    morphPrepareCallback = null;
    updateSliderLabels(readControlsFromUI());
    scheduleTextRefresh();
    setStillRendered(false);
    setUserEdited(true);
    setDirty(true);
    scheduleRender();
}

/* ---------------------------
 * Slider + control event listeners
 * ---------------------------
 */
for (const id of SLIDER_KEYS) {
    el[id].addEventListener('input', onControlChange);
}
el.seed.addEventListener('change', onControlChange);
el.seed.addEventListener('input', () => {
    syncDisplayFields();
    scheduleTextRefresh();
});
el.profileNameField.addEventListener('input', () => {
    setUserEdited(true);
    setDirty(true);
    syncDisplayFields();
});

let saveInProgress = false;

async function saveCurrentProfile() {
    if (saveInProgress) return;
    saveInProgress = true;

    try {
        const name = el.profileNameField.value.trim();
        if (!name) { toast('Enter a name first.'); return; }

        const profiles = loadProfiles();
        const portraitNames = getPortraitNames();
        const portraits = loadPortraits();
        const controls = readControlsFromUI();
        const currentSeed = el.seed.value.trim() || 'seed';

        // Check if identical to an existing portrait
        const matchingPortrait = portraits[name];
        if (matchingPortrait &&
            matchingPortrait.seed === currentSeed &&
            JSON.stringify(matchingPortrait.controls) === JSON.stringify(controls)) {
            toast('Already saved as a portrait.');
            return;
        }

        // Overwrite confirmation (async modal instead of native confirm)
        if (profiles[name] && name !== loadedProfileName) {
            const label = (loadedFromPortrait || portraitNames.includes(name))
                ? `User profile "${name}" already exists. The existing image will be overwritten.`
                : `Profile "${name}" already exists. The existing image will be overwritten.`;
            const result = await showConfirm('Overwrite Profile', label, [
                { label: 'Cancel', value: 'cancel' },
                { label: 'Overwrite', value: 'overwrite', primary: true },
            ]);
            if (result !== 'overwrite') return;
        }

        const profileData = {
            seed: currentSeed,
            controls,
        };
        profileData.paletteTweaks = readPaletteFromUI();
        if (controls.palette === 'custom') {
            profileData.customPalette = profileData.paletteTweaks;
        }
        profiles[name] = profileData;
        saveProfiles(profiles);

        // Append to order if new
        const order = loadProfileOrder() || [];
        if (!order.includes(name)) {
            order.push(name);
            saveProfileOrder(order);
        }

        loadedProfileName = name;
        loadedFromPortrait = false;
        refreshProfileGallery();
        setDirty(false);
        setUserEdited(false);
        captureBaseline();
    } finally {
        saveInProgress = false;
    }
}

el.saveProfile.addEventListener('click', async () => { await saveCurrentProfile(); });

async function resetCurrentProfile() {
    if (!baselineSnapshot || !userEdited) return;

    const currentName = el.profileNameField.value.trim() || 'Untitled';
    const result = await showConfirm(
        'Reset Changes',
        `Discard all changes to "${currentName}"? Unsaved changes will be lost.`,
        [
            { label: 'Cancel', value: 'cancel' },
            { label: 'Reset', value: 'reset', primary: true },
        ]
    );
    if (result !== 'reset') return;

    restoreSnapshot(baselineSnapshot);
    setUserEdited(false);
}

el.resetProfile.addEventListener('click', async () => { await resetCurrentProfile(); });

/* ---------------------------
 * Randomize
 * ---------------------------
 */
function generateIntent() {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const openings = [
        'the memory of', 'what remains after', 'a cathedral built from',
        'the weight of', 'somewhere between', 'the last breath of',
        'a geometry that dreams of', 'the silence inside', 'what light does to',
        'the space where', 'an architecture of', 'the slow collapse of',
        'a window into', 'the color of', 'what happens when',
        'the interior of', 'a prayer made of', 'the distance between',
        'the moment before', 'everything that follows',
    ];

    const cores = [
        'dissolving glass', 'frozen lightning', 'crystallized doubt',
        'luminous absence', 'fractured stillness', 'translucent grief',
        'weightless stone', 'liquid geometry', 'burning fog',
        'quiet thunder', 'shattered calm', 'radiant emptiness',
        'suspended breath', 'infinite nearness', 'soft collapse',
        'bright silence', 'warm void', 'sharp tenderness',
        'slow fire', 'deep transparence',
    ];

    const closings = [
        'finds its shape', 'meets the dark', 'begins to sing',
        'learns to fall', 'turns to light', 'forgets itself',
        'becomes a door', 'holds the room', 'touches the edge',
        'folds inward', 'drifts apart', 'catches fire',
        'refuses to land', 'remembers water', 'reaches through',
    ];

    // Vary structure: ~40% two-part, ~60% three-part
    let phrase;
    if (Math.random() < 0.4) {
        phrase = `${pick(openings)} ${pick(cores)}`;
    } else {
        phrase = `${pick(openings)} ${pick(cores)} ${pick(closings)}`;
    }
    return phrase.charAt(0).toUpperCase() + phrase.slice(1) + '.';
}

/* ---------------------------
 * Randomization history
 * ---------------------------
 */
const HISTORY_MAX = 25;
let navHistory = [];
let historyIndex = -1;

function captureSnapshot() {
    return {
        seed: el.seed.value.trim(),
        name: el.profileNameField.value.trim(),
        controls: readControlsFromUI(),
        paletteTweaks: readPaletteFromUI(),
        profileName: loadedProfileName || '',
        isPortrait: loadedFromPortrait,
        wasDirty: dirty,
    };
}

function captureBaseline() {
    baselineSnapshot = captureSnapshot();
}

function restoreSnapshot(snap) {
    // Capture current visual state before restoring
    const fromState = {
        seed: el.seed.value.trim() || 'seed',
        controls: readControlsFromUI(),
        paletteTweaks: readPaletteFromUI(),
    };

    el.seed.value = snap.seed;
    autoGrow(el.seed);
    el.profileNameField.value = snap.name;
    autoGrow(el.profileNameField);
    setControlsInUI(snap.controls);
    el.customHue.value = snap.paletteTweaks.baseHue;
    el.customHueRange.value = snap.paletteTweaks.hueRange;
    el.customSat.value = snap.paletteTweaks.saturation;
    syncPaletteEditor();
    updateSliderLabels(snap.controls);
    syncDisplayFields();

    // Restore profile context from snapshot
    if (snap.profileName) {
        // Verify the profile still exists
        const store = snap.isPortrait ? loadPortraits() : loadProfiles();
        if (store[snap.profileName]) {
            loadedProfileName = snap.profileName;
            loadedFromPortrait = snap.isPortrait;
            setDirty(snap.wasDirty);
            setUserEdited(snap.wasDirty);
        } else {
            // Profile was deleted — treat as unsaved
            loadedProfileName = '';
            loadedFromPortrait = false;
            setDirty(true);
            setUserEdited(false);
        }
    } else {
        loadedProfileName = '';
        loadedFromPortrait = false;
        setDirty(true);
        setUserEdited(false);
    }

    refreshProfileGallery();

    // Capture target state and morph
    const toState = {
        seed: el.seed.value.trim() || 'seed',
        controls: readControlsFromUI(),
        paletteTweaks: readPaletteFromUI(),
    };
    startMorph(fromState, toState);
}

function updateHistoryButtons() {
    const back = document.getElementById('historyBackBtn');
    const fwd = document.getElementById('historyForwardBtn');
    if (back) back.disabled = morphLocked || historyIndex <= 0;
    if (fwd) fwd.disabled = morphLocked || historyIndex >= navHistory.length - 1;
}

/**
 * Update the current history entry in-place if the user's state has diverged,
 * preserving unsaved edits before navigating away.
 */
function captureCurrentBeforeNavigating() {
    if (historyIndex < 0 || navHistory.length === 0) {
        pushToHistory();
        return;
    }
    const current = captureSnapshot();
    const stored = navHistory[historyIndex];
    const changed = current.seed !== stored.seed
        || current.name !== stored.name
        || current.profileName !== stored.profileName
        || current.wasDirty !== stored.wasDirty
        || JSON.stringify(current.controls) !== JSON.stringify(stored.controls)
        || JSON.stringify(current.paletteTweaks) !== JSON.stringify(stored.paletteTweaks);
    if (changed) {
        navHistory[historyIndex] = current;
    }
}

/** Push current state to history. Tracks all visited images (profiles, randomized, unsaved). */
function pushToHistory() {
    const snap = captureSnapshot();

    // Deduplicate: skip if identical to current history entry
    if (historyIndex >= 0 && historyIndex < navHistory.length) {
        const cur = navHistory[historyIndex];
        if (cur.seed === snap.seed
            && cur.profileName === snap.profileName
            && cur.isPortrait === snap.isPortrait
            && JSON.stringify(cur.controls) === JSON.stringify(snap.controls)
            && JSON.stringify(cur.paletteTweaks) === JSON.stringify(snap.paletteTweaks)) {
            return;
        }
    }

    // Truncate forward entries
    if (historyIndex < navHistory.length - 1) {
        navHistory.splice(historyIndex + 1);
    }

    navHistory.push(snap);
    if (navHistory.length > HISTORY_MAX) navHistory.shift();
    historyIndex = navHistory.length - 1;
    updateHistoryButtons();
}

/** Populate UI with random configuration (no confirmation dialog, no render). */
function randomizeUI() {
    el.seed.value = generateIntent();
    autoGrow(el.seed);

    // Topology hidden — always flow-field
    setTopologyUI('flow-field');
    const chosenPalette = PALETTE_KEYS[Math.floor(Math.random() * PALETTE_KEYS.length)];
    setPaletteUI(chosenPalette);
    el.customHue.value = Math.floor(Math.random() * 360);
    el.customHueRange.value = Math.floor(20 + Math.random() * 140);
    el.customSat.value = (0.3 + Math.random() * 0.5).toFixed(2);
    syncPaletteEditor();
    el.customPaletteEditor.classList.remove('collapsed');
    for (const id of SLIDER_KEYS) {
        el[id].value = Math.random().toFixed(2);
    }

    const seed = el.seed.value.trim() || 'seed';
    const controls = readControlsFromUI();
    updateSliderLabels(controls);

    // Generate a descriptive name from the randomized controls
    const nameRng = mulberry32(xmur3(seed + ':name')());
    el.profileNameField.value = generateTitle(controls, nameRng);
    autoGrow(el.profileNameField);

    // Detach from any loaded profile so this becomes a new unsaved draft
    loadedProfileName = '';
    loadedFromPortrait = false;
    setDirty(true);
    setUserEdited(false);
    captureBaseline();
}

async function randomize() {
    if (userEdited) {
        let result;
        if (loadedProfileName) {
            result = await showConfirm(
                'Unsaved Changes',
                `Save changes to "${loadedProfileName}"?`,
                [
                    { label: 'Cancel', value: 'cancel' },
                    { label: 'Discard', value: 'discard' },
                    { label: 'Save', value: 'save', primary: true },
                ]
            );
        } else {
            const draftName = el.profileNameField.value.trim();
            if (draftName) {
                result = await showConfirm(
                    'Unsaved Changes',
                    `Save "${draftName}" as a new profile?`,
                    [
                        { label: 'Cancel', value: 'cancel' },
                        { label: 'Discard', value: 'discard' },
                        { label: 'Save', value: 'save', primary: true },
                    ]
                );
            } else {
                result = await showConfirm(
                    'Unsaved Changes',
                    'Discard unsaved changes and randomize?',
                    [
                        { label: 'Cancel', value: 'cancel' },
                        { label: 'Discard', value: 'discard', primary: true },
                    ]
                );
            }
        }
        if (result === 'cancel') return;
        if (result === 'save') await saveCurrentProfile();
    }

    // Capture current visual state before randomizing
    const fromState = {
        seed: el.seed.value.trim() || 'seed',
        controls: readControlsFromUI(),
        paletteTweaks: readPaletteFromUI(),
    };

    captureCurrentBeforeNavigating();

    randomizeUI();
    refreshProfileGallery();
    pushToHistory();

    // Capture target state and morph
    const toState = {
        seed: el.seed.value.trim() || 'seed',
        controls: readControlsFromUI(),
        paletteTweaks: readPaletteFromUI(),
    };
    startMorph(fromState, toState);
}

/* ---------------------------
 * Profile gallery
 * ---------------------------
 */
const TRASH_SVG = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0v-6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>';
const ARROW_UP_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l5-5 5 5"/></svg>';
const ARROW_DOWN_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l5 5 5-5"/></svg>';

function moveProfile(name, dir) {
    const order = syncProfileOrder(loadProfiles());
    const idx = order.indexOf(name);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    [order[idx], order[target]] = [order[target], order[idx]];
    saveProfileOrder(order);
    refreshProfileGallery();
}

function clearActiveCards() {
    el.portraitGallery.querySelectorAll('.profile-card').forEach(c =>
        c.classList.remove('active-profile')
    );
    el.userGallery.querySelectorAll('.profile-card').forEach(c =>
        c.classList.remove('active-profile')
    );
}

function updateActiveSection() {
    updateActivePreview();
}

function updateActivePreview() {
    const name = el.profileNameField.value.trim() || 'Untitled';
    const seed = el.seed.value.trim() || '';
    el.activePreviewName.textContent = name;
    el.activePreviewSeed.textContent = seed;

    // Status label
    let status;
    if (!loadedProfileName) {
        status = 'Unsaved';
    } else if (loadedFromPortrait) {
        status = dirty ? 'Portrait \u00b7 unsaved' : 'Portrait';
    } else {
        status = dirty ? 'User \u00b7 unsaved' : 'User';
    }
    el.activeStatusLabel.textContent = status;

    // Queue a thumbnail for the current config
    const controls = readControlsFromUI();
    const paletteTweaks = readPaletteFromUI();
    queueThumbnail(seed || 'seed', controls, el.activePreviewThumb, paletteTweaks);
}

async function selectCard(cardEl) {
    if (morphLocked) return; // prevent interactions during morph
    const profileName = cardEl.dataset.profileName;
    const isPortrait = cardEl.classList.contains('portrait-card');
    if (dirty && userEdited) {
        // User made config changes — offer to save
        const currentName = el.profileNameField.value.trim() || 'Untitled';
        const result = await showConfirm(
            'Unsaved Changes',
            `Save "${currentName}" before switching?`,
            [
                { label: 'Cancel', value: 'cancel' },
                { label: 'Discard', value: 'discard' },
                { label: 'Save', value: 'save', primary: true },
            ]
        );
        if (result === 'cancel') return;
        if (result === 'save') await saveCurrentProfile();
    }

    // Capture current visual state BEFORE loading target
    const fromState = {
        seed: el.seed.value.trim() || 'seed',
        controls: readControlsFromUI(),
        paletteTweaks: readPaletteFromUI(),
    };

    // Preserve current state in history before switching
    captureCurrentBeforeNavigating();

    // Load profile data into Active section controls
    loadProfileFromData(profileName, isPortrait);

    // Push the newly loaded profile to history
    pushToHistory();

    // Mark as active across both galleries
    clearActiveCards();
    cardEl.classList.add('active-profile');

    // Update active section header
    updateActiveSection();

    // Capture target state (after loadProfileFromData set the UI)
    const toState = {
        seed: el.seed.value.trim() || 'seed',
        controls: readControlsFromUI(),
        paletteTweaks: readPaletteFromUI(),
    };

    // Morph from current to target
    startMorph(fromState, toState);
}

function buildProfileCard(name, p, { isPortrait = false, index = 0, total = 1 } = {}) {
    const card = document.createElement('div');
    card.className = 'profile-card';
    if (isPortrait) card.classList.add('portrait-card');
    card.dataset.profileName = name;

    // Header (clickable area)
    const header = document.createElement('div');
    header.className = 'profile-card-header';

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'thumb-wrap thumb-loading';
    const thumbImg = document.createElement('img');
    thumbImg.className = 'profile-thumb';
    thumbWrap.appendChild(thumbImg);
    header.appendChild(thumbWrap);
    if (p.seed && p.controls) {
        queueThumbnail(p.seed, p.controls, thumbImg, p.paletteTweaks);
    }

    const body = document.createElement('div');
    body.className = 'profile-card-body';

    const nm = document.createElement('div');
    nm.className = 'profile-card-name';
    nm.textContent = name;
    body.appendChild(nm);

    if (p.seed) {
        const seedEl = document.createElement('div');
        seedEl.className = 'profile-card-seed';
        seedEl.textContent = p.seed;
        body.appendChild(seedEl);
    }

    header.appendChild(body);
    card.appendChild(header);

    // Action buttons (user profiles only)
    if (!isPortrait) {
        const actions = document.createElement('div');
        actions.className = 'profile-card-actions';

        const upBtn = document.createElement('button');
        upBtn.className = 'profile-card-move';
        upBtn.title = 'Move up';
        upBtn.innerHTML = ARROW_UP_SVG;
        upBtn.disabled = index === 0 || total <= 1;
        upBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            moveProfile(card.dataset.profileName, -1);
        });

        const downBtn = document.createElement('button');
        downBtn.className = 'profile-card-move';
        downBtn.title = 'Move down';
        downBtn.innerHTML = ARROW_DOWN_SVG;
        downBtn.disabled = index === total - 1 || total <= 1;
        downBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            moveProfile(card.dataset.profileName, 1);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'profile-card-delete';
        deleteBtn.title = 'Delete';
        deleteBtn.innerHTML = TRASH_SVG;
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const realName = card.dataset.profileName;
            if (realName) {
                deleteProfile(realName);
                const order = loadProfileOrder();
                if (order) {
                    const filtered = order.filter(n => n !== realName);
                    saveProfileOrder(filtered);
                }
                if (realName === loadedProfileName) {
                    loadedProfileName = '';
                    loadedFromPortrait = false;
                    setDirty(true);
                }
            }
            refreshProfileGallery();
        });

        actions.appendChild(upBtn);
        actions.appendChild(downBtn);
        actions.appendChild(deleteBtn);
        card.appendChild(actions);
    }

    // Single click: select card
    header.addEventListener('click', (e) => {
        if (e.target.closest('.profile-card-actions')) return;
        selectCard(card);
    });

    return card;
}

function refreshProfileGallery() {
    // --- Portraits section ---
    const portraits = loadPortraits();
    const portraitNames = Object.keys(portraits).sort((a, b) => a.localeCompare(b));
    el.portraitGallery.innerHTML = '';

    for (const name of portraitNames) {
        const card = buildProfileCard(name, portraits[name], { isPortrait: true });
        el.portraitGallery.appendChild(card);

        if (name === loadedProfileName && loadedFromPortrait) {
            card.classList.add('active-profile');
        }
    }

    // --- Users section (ordered by user preference) ---
    const profiles = loadProfiles();
    const userNames = syncProfileOrder(profiles);
    el.userGallery.innerHTML = '';

    if (userNames.length === 0) {
        const d = document.createElement('div');
        d.className = 'small';
        d.textContent = 'No saved profiles yet.';
        el.userGallery.appendChild(d);
    }

    for (let i = 0; i < userNames.length; i++) {
        const name = userNames[i];
        const card = buildProfileCard(name, profiles[name], { index: i, total: userNames.length });
        el.userGallery.appendChild(card);

        if (name === loadedProfileName && !loadedFromPortrait) {
            card.classList.add('active-profile');
        }
    }

    updateActiveSection();
}

/* ---------------------------
 * Export
 * ---------------------------
 */
el.exportBtn.addEventListener('click', () => {
    if (el.exportBtn.disabled) return;
    if (!stillRendered) { toast('Render first.'); return; }

    try {
        const seed = el.seed.value.trim() || 'seed';
        const controls = readControlsFromUI();
        const paletteTweaks = readPaletteFromUI();
        const name = el.profileNameField.value.trim() || 'Untitled';

        const config = profileToConfig(name, { seed, controls, paletteTweaks });
        const json = JSON.stringify(config, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const ts = toIsoLocalish();
        downloadBlob(`geometric-interior_${safeName(seed)}_${ts}.json`, blob);
        toast('Configuration exported.');
    } catch (err) {
        console.error(err);
        toast('Export failed.');
    }
});

/* ---------------------------
 * Share
 * ---------------------------
 */

// Build share URL from current state
function buildShareURL() {
    return encodeStateToURL(window.location.origin, {
        seed: el.seed.value.trim() || 'seed',
        controls: readControlsFromUI(),
        paletteTweaks: readPaletteFromUI(),
        name: el.profileNameField.value.trim(),
    });
}

// Toggle share popover (hide tooltip so it doesn't overlap the menu)
el.shareBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    hideTooltip();
    el.sharePopover.classList.toggle('hidden');
    el.settingsPopover.classList.add('hidden');
});

// Toggle settings popover
el.settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    hideTooltip();
    el.settingsPopover.classList.toggle('hidden');
    el.sharePopover.classList.add('hidden');
});

// Close popovers on outside click
document.addEventListener('click', (e) => {
    if (!el.sharePopover.contains(e.target) && e.target !== el.shareBtn) {
        el.sharePopover.classList.add('hidden');
    }
    if (!el.settingsPopover.contains(e.target) && e.target !== el.settingsBtn) {
        el.settingsPopover.classList.add('hidden');
    }
});

// Close popovers on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!el.sharePopover.classList.contains('hidden')) {
            el.sharePopover.classList.add('hidden');
            el.shareBtn.focus();
        }
        if (!el.settingsPopover.classList.contains('hidden')) {
            el.settingsPopover.classList.add('hidden');
            el.settingsBtn.focus();
        }
    }
});

/* ── Animation toggle ── */
let animationEnabled = localStorage.getItem('geo-anim-enabled') !== 'false'; // default true
el.animToggle.setAttribute('aria-checked', String(animationEnabled));

el.animToggle.addEventListener('click', () => {
    animationEnabled = !animationEnabled;
    el.animToggle.setAttribute('aria-checked', String(animationEnabled));
    localStorage.setItem('geo-anim-enabled', String(animationEnabled));
});
el.animToggle.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        el.animToggle.click();
    }
});

// Copy Link
document.getElementById('shareCopyLink').addEventListener('click', async () => {
    const shareURL = buildShareURL();
    try {
        await navigator.clipboard.writeText(shareURL);
        toast('Link copied to clipboard.');
    } catch {
        // Fallback for older browsers / insecure contexts
        const ta = document.createElement('textarea');
        ta.value = shareURL;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        toast('Link copied.');
    }
    el.sharePopover.classList.add('hidden');
});

// Download Visual (full ZIP with image, metadata, title, alt-text)
document.getElementById('shareDownloadPng').addEventListener('click', async () => {
    if (!stillRendered) { toast('Render first.'); return; }
    if (!window.JSZip) { toast('JSZip missing (offline?).'); return; }
    el.sharePopover.classList.add('hidden');

    const seed = el.seed.value.trim() || 'seed';
    const controls = readControlsFromUI();
    const paletteTweaks = readPaletteFromUI();
    const name = el.profileNameField.value.trim() || 'Untitled';

    const titleRng = mulberry32(xmur3(seed + ':title')());
    const title = generateTitle(controls, titleRng);
    const altText = generateAltText(controls, lastNodeCount, title);
    const meta = { title, altText, nodeCount: lastNodeCount };

    try {
        if (renderWorker && workerReady) {
            const exportId = ++requestIdCounter;
            const blob = await new Promise((resolve, reject) => {
                pendingCallbacks.set(exportId, (b) => b ? resolve(b) : reject(new Error('Export failed')));
                renderWorker.postMessage({ type: 'export', requestId: exportId });
            });
            const rect = canvas.getBoundingClientRect();
            await packageStillZipFromBlob(blob, {
                seed, controls, paletteTweaks, name, meta,
                canvasWidth: Math.round(rect.width * window.devicePixelRatio),
                canvasHeight: Math.round(rect.height * window.devicePixelRatio),
            });
        } else {
            await packageStillZip(canvas, { seed, controls, paletteTweaks, name, meta });
        }
        toast('Visual exported.');
    } catch (err) {
        console.error(err);
        toast('Visual export failed.');
    }
});

// Share on X/Twitter
document.getElementById('shareTwitter').addEventListener('click', () => {
    const shareURL = buildShareURL();
    const seed = el.seed.value.trim() || 'seed';
    const controls = readControlsFromUI();
    const titleRng = mulberry32(xmur3(seed + ':title')());
    const title = generateTitle(controls, titleRng);

    const text = `${title} — Geometric Interior`;
    const intentURL = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareURL)}&text=${encodeURIComponent(text)}`;
    window.open(intentURL, '_blank', 'noopener,width=550,height=420');
    el.sharePopover.classList.add('hidden');
});

// Share on Facebook
document.getElementById('shareFacebook').addEventListener('click', () => {
    const shareURL = buildShareURL();
    const fbURL = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareURL)}`;
    window.open(fbURL, '_blank', 'noopener,width=555,height=525');
    el.sharePopover.classList.add('hidden');
});

// Share on Bluesky
document.getElementById('shareBluesky').addEventListener('click', () => {
    const shareURL = buildShareURL();
    const seed = el.seed.value.trim() || 'seed';
    const controls = readControlsFromUI();
    const titleRng = mulberry32(xmur3(seed + ':title')());
    const title = generateTitle(controls, titleRng);

    const text = `${title} — Geometric Interior\n${shareURL}`;
    const bskyURL = `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`;
    window.open(bskyURL, '_blank', 'noopener,width=600,height=500');
    el.sharePopover.classList.add('hidden');
});

// Share on Reddit
document.getElementById('shareReddit').addEventListener('click', () => {
    const shareURL = buildShareURL();
    const seed = el.seed.value.trim() || 'seed';
    const controls = readControlsFromUI();
    const titleRng = mulberry32(xmur3(seed + ':title')());
    const title = generateTitle(controls, titleRng);

    const redditURL = `https://www.reddit.com/submit?url=${encodeURIComponent(shareURL)}&title=${encodeURIComponent(`${title} — Geometric Interior`)}`;
    window.open(redditURL, '_blank', 'noopener,width=700,height=600');
    el.sharePopover.classList.add('hidden');
});

// Share on LinkedIn
document.getElementById('shareLinkedIn').addEventListener('click', () => {
    const shareURL = buildShareURL();
    const linkedInURL = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareURL)}`;
    window.open(linkedInURL, '_blank', 'noopener,width=600,height=550');
    el.sharePopover.classList.add('hidden');
});

// Share via Email
document.getElementById('shareEmail').addEventListener('click', () => {
    const shareURL = buildShareURL();
    const seed = el.seed.value.trim() || 'seed';
    const controls = readControlsFromUI();
    const titleRng = mulberry32(xmur3(seed + ':title')());
    const title = generateTitle(controls, titleRng);

    const subject = `${title} — Geometric Interior`;
    const body = `Check out this generative artwork:\n\n${shareURL}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    el.sharePopover.classList.add('hidden');
});

/* ---------------------------
 * Import profile
 * ---------------------------
 */
const importModal = document.getElementById('importModal');
const importFileInput = document.getElementById('importFile');
const importJsonArea = document.getElementById('importJson');
const importError = document.getElementById('importError');
const fileDropZone = document.getElementById('fileDropZone');
const fileDropName = document.getElementById('fileDropName');

function showImportError(msg) {
    importError.textContent = msg;
    importError.style.display = 'block';
}

function clearImportModal() {
    importFileInput.value = '';
    importJsonArea.value = '';
    importError.style.display = 'none';
    fileDropName.textContent = '';
}

function openImportModal() {
    clearImportModal();
    importModal.classList.remove('hidden');
    importModal.classList.add('modal-entering');
}

function closeImportModal() {
    importModal.classList.remove('modal-entering');
    importModal.classList.add('modal-leaving');
    setTimeout(() => {
        importModal.classList.remove('modal-leaving');
        importModal.classList.add('hidden');
    }, 250);
}

function validateAndImportProfile(raw) {
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        showImportError('Invalid JSON.');
        return;
    }

    // Accept a single config object or an array of configs
    const items = Array.isArray(data) ? data : [data];
    if (items.length === 0) {
        showImportError('No profiles found.');
        return;
    }

    // Validate every entry
    for (let i = 0; i < items.length; i++) {
        const label = items.length > 1 ? `Item ${i + 1}` : 'Profile';
        const { ok, errors } = validateStillConfig(items[i]);
        if (!ok) {
            showImportError(`${label}:\n${errors.join('\n')}`);
            return;
        }
    }

    // Convert and save
    const profiles = loadProfiles();
    let lastName = '';
    for (const item of items) {
        const { name, profile } = configToProfile(item);
        profiles[name] = profile;
        lastName = name;
    }
    saveProfiles(profiles);

    // Load the last imported profile into the UI
    captureCurrentBeforeNavigating();
    loadProfileIntoUI(lastName);
    pushToHistory();
    refreshProfileGallery();
    renderAndUpdate(el.seed.value.trim() || 'seed', readControlsFromUI(), { animate: true });
    setStillRendered(true);

    closeImportModal();
    toast(`Imported ${items.length} profile${items.length > 1 ? 's' : ''}.`);
}

document.getElementById('importBtn').addEventListener('click', openImportModal);
document.getElementById('importModalClose').addEventListener('click', closeImportModal);
document.getElementById('importCancelBtn').addEventListener('click', closeImportModal);
importModal.addEventListener('click', (e) => { if (e.target === importModal) closeImportModal(); });

document.getElementById('importConfirmBtn').addEventListener('click', () => {
    // Prefer file if one was selected
    if (importFileInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = () => validateAndImportProfile(reader.result);
        reader.onerror = () => showImportError('Failed to read file.');
        reader.readAsText(importFileInput.files[0]);
    } else if (importJsonArea.value.trim()) {
        validateAndImportProfile(importJsonArea.value.trim());
    } else {
        showImportError('Upload a file or paste JSON.');
    }
});

// Auto-populate textarea when a file is selected
importFileInput.addEventListener('change', () => {
    if (importFileInput.files.length > 0) {
        fileDropName.textContent = importFileInput.files[0].name;
        const reader = new FileReader();
        reader.onload = () => {
            importJsonArea.value = reader.result;
            importError.style.display = 'none';
        };
        reader.readAsText(importFileInput.files[0]);
    }
});

// Drag-and-drop visual feedback
fileDropZone.addEventListener('dragover', (e) => { e.preventDefault(); fileDropZone.classList.add('drag-over'); });
fileDropZone.addEventListener('dragleave', () => { fileDropZone.classList.remove('drag-over'); });
fileDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        importFileInput.files = e.dataTransfer.files;
        importFileInput.dispatchEvent(new Event('change'));
    }
});

/* ---------------------------
 * Statement modal
 * ---------------------------
 */
const STATEMENT_TITLES = { developer: '', artist: '', governance: '' };

function simpleMarkdownToHtml(md) {
    return md
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^---$/gm, '<hr>')
        .split(/\n\n+/)
        .map(block => {
            block = block.trim();
            if (!block || block.startsWith('<h2>') || block === '<hr>') return block;
            return `<p>${block}</p>`;
        })
        .join('\n');
}

async function loadStatementContent() {
    const files = {
        developerTitle: 'txt/developer-statement-title.txt',
        artistTitle: 'txt/artist-statement-title.txt',
        developerContent: 'txt/developer-statement-content.txt',
        artistContent: 'txt/artist-statement-content.txt',
        developerFooter: 'txt/developer-statement-footer.txt',
        governanceTitle: 'txt/governance-framework-title.txt',
        governanceContent: 'md/governance-framework-content.md',
    };
    try {
        const [devTitle, artTitle, devContent, artContent, devFooter, govTitle, govContent] = await Promise.all(
            Object.values(files).map(f => fetch(f).then(r => r.text()))
        );
        STATEMENT_TITLES.developer = devTitle.trim();
        STATEMENT_TITLES.artist = artTitle.trim();
        STATEMENT_TITLES.governance = govTitle.trim();
        el.developerBody.querySelector('.manifesto').textContent = devContent.trim();
        el.artistBody.querySelector('.manifesto').textContent = artContent.trim();
        el.governanceBody.querySelector('.manifesto').innerHTML = simpleMarkdownToHtml(govContent.trim());
        const noteEl = el.artistBody.querySelector('.manifesto-note');
        if (noteEl) noteEl.textContent = devFooter.trim();
    } catch (err) {
        console.error('Failed to load statement content:', err);
    }
}

let statementContentReady = null;
let statementFlipping = false;
let statementClosing = false;

async function openStatementModal(tab) {
    if (statementClosing) return;
    if (statementContentReady) await statementContentReady;
    el.statementModal.classList.remove('hidden');
    el.statementModal.classList.remove('modal-leaving');
    el.statementModal.classList.add('modal-entering');
    const box = el.statementModal.querySelector('.modal-box');
    box.addEventListener('animationend', () => {
        el.statementModal.classList.remove('modal-entering');
    }, { once: true });
    switchStatementTab(tab, false);
}

function closeStatementModal() {
    if (statementClosing) return;
    statementClosing = true;
    statementFlipping = false;
    el.statementModal.classList.remove('modal-entering');
    el.statementModal.classList.add('modal-leaving');
    const box = el.statementModal.querySelector('.modal-box');
    box.addEventListener('animationend', () => {
        el.statementModal.classList.add('hidden');
        el.statementModal.classList.remove('modal-leaving');
        statementClosing = false;
    }, { once: true });
}

/* ---------------------------
 * Confirm modal (reusable)
 * ---------------------------
 */
function showConfirm(title, message, actions) {
    return new Promise(resolve => {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmBody').textContent = message;
        const actionsEl = document.getElementById('confirmActions');
        actionsEl.innerHTML = '';
        actions.forEach(({ label, value, primary }) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            if (primary) btn.classList.add('primary');
            btn.addEventListener('click', () => { closeConfirm(); resolve(value); });
            actionsEl.appendChild(btn);
        });
        modal.classList.remove('hidden');
        modal.classList.add('modal-entering');
        const box = modal.querySelector('.modal-box');
        box.addEventListener('animationend', () => modal.classList.remove('modal-entering'), { once: true });
    });
}

function closeConfirm() {
    const modal = document.getElementById('confirmModal');
    modal.classList.add('modal-leaving');
    const box = modal.querySelector('.modal-box');
    box.addEventListener('animationend', () => {
        modal.classList.add('hidden');
        modal.classList.remove('modal-leaving');
    }, { once: true });
}

function switchStatementTab(tab, animate = true) {
    const bodyMap = { developer: el.developerBody, artist: el.artistBody, governance: el.governanceBody };
    const currentTab = Object.keys(bodyMap).find(k => !bodyMap[k].classList.contains('hidden')) || 'artist';

    el.statementModal.querySelectorAll('.modal-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    /* Sync custom dropdown */
    const selectLabel = el.statementTabSelect.querySelector('.modal-tab-select-label');
    if (selectLabel) {
        const labels = { artist: 'Artist Statement', developer: 'Developer Statement', governance: 'Governance Framework' };
        selectLabel.textContent = labels[tab] || tab;
    }
    el.statementTabSelect.querySelectorAll('.modal-tab-select-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    if (!animate || currentTab === tab || statementFlipping) {
        el.statementTitle.textContent = STATEMENT_TITLES[tab] || '';
        for (const [k, body] of Object.entries(bodyMap)) {
            body.classList.toggle('hidden', k !== tab);
        }
        return;
    }

    statementFlipping = true;
    const outgoing = bodyMap[currentTab];
    const incoming = bodyMap[tab];
    const modalBody = el.statementModal.querySelector('.modal-body');
    const modalBox = el.statementModal.querySelector('.modal-box');
    const FLIP_OUT_MS = 300;

    /* Hide scrollbar for the entire transition (flip-out + flip-in) */
    modalBody.style.overflow = 'hidden';

    outgoing.classList.add('coin-flip-out');
    el.statementTitle.classList.add('coin-flip-out');

    setTimeout(() => {
        /* Suppress the modal-box height transition so it snaps instantly */
        modalBox.style.transition = 'none';

        outgoing.classList.remove('coin-flip-out');
        outgoing.classList.add('hidden');

        el.statementTitle.classList.remove('coin-flip-out');
        el.statementTitle.textContent = STATEMENT_TITLES[tab] || '';

        incoming.classList.remove('hidden');
        incoming.classList.add('coin-flip-in');
        el.statementTitle.classList.add('coin-flip-in');

        modalBody.scrollTop = 0;

        /* Force reflow so the box settles at its new height before
           re-enabling transitions */
        void modalBox.offsetHeight;
        modalBox.style.transition = '';

        const cleanup = () => {
            incoming.classList.remove('coin-flip-in');
            el.statementTitle.classList.remove('coin-flip-in');
            modalBody.style.overflow = '';
            statementFlipping = false;
        };
        incoming.addEventListener('animationend', cleanup, { once: true });
    }, FLIP_OUT_MS);
}

el.developerStatement.addEventListener('click', () => openStatementModal('developer'));
el.artistStatement.addEventListener('click', () => openStatementModal('artist'));
el.governanceStatement.addEventListener('click', () => openStatementModal('governance'));
el.statementModalClose.addEventListener('click', closeStatementModal);

/* Custom dropdown for mobile tab select */
const tabSelectTrigger = el.statementTabSelect.querySelector('.modal-tab-select-trigger');
const tabSelectMenu = el.statementTabSelect.querySelector('.modal-tab-select-menu');
if (tabSelectTrigger && tabSelectMenu) {
    tabSelectTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !tabSelectMenu.classList.contains('hidden');
        tabSelectMenu.classList.toggle('hidden', isOpen);
        el.statementTabSelect.classList.toggle('open', !isOpen);
    });
    tabSelectMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.modal-tab-select-item');
        if (!item) return;
        switchStatementTab(item.dataset.tab);
        el.statementTabSelect.classList.remove('open');
        tabSelectMenu.classList.add('closing');
        tabSelectMenu.addEventListener('transitionend', () => {
            tabSelectMenu.classList.remove('closing');
            tabSelectMenu.classList.add('hidden');
        }, { once: true });
    });
    /* Close dropdown when clicking anywhere else in the modal */
    el.statementModal.addEventListener('click', (e) => {
        if (!el.statementTabSelect.contains(e.target)) {
            tabSelectMenu.classList.add('hidden');
            el.statementTabSelect.classList.remove('open');
        }
    });
}

el.statementModal.addEventListener('click', (e) => {
    if (e.target === el.statementModal) closeStatementModal();
    const tab = e.target.closest('.modal-tab');
    if (tab) switchStatementTab(tab.dataset.tab);
});

/* ---------------------------
 * Info modal
 * ---------------------------
 */
function openInfoModal(title, body) {
    el.infoModalTitle.textContent = title;
    el.infoModalBody.textContent = body;
    el.infoModal.classList.remove('hidden');
}

function closeInfoModal() {
    el.infoModal.classList.add('hidden');
}

el.infoModalClose.addEventListener('click', closeInfoModal);
el.infoModal.addEventListener('click', (e) => { if (e.target === el.infoModal) closeInfoModal(); });

document.addEventListener('click', (e) => {
    const labelInfo = e.target.closest('.label-info');
    if (labelInfo) {
        const title = labelInfo.getAttribute('data-label') || '';
        const body = labelInfo.getAttribute('data-tooltip') || '';
        openInfoModal(title, body);
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!el.infoModal.classList.contains('hidden')) closeInfoModal();
    else if (!el.statementModal.classList.contains('hidden')) closeStatementModal();
    else if (isPanelOpen()) closePanel();
});

/* ---------------------------
 * Tooltips (unified, fixed-position to escape overflow)
 * ---------------------------
 */
const paramTooltip = document.getElementById('paramTooltip');
let tooltipSource = null;

function showTooltip(el, mouseX, mouseY) {
    tooltipSource = el;
    paramTooltip.textContent = el.getAttribute('data-tooltip');
    const pos = el.getAttribute('data-tooltip-pos');
    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    /* Measure tooltip dimensions (must be visible + positioned to get real size) */
    paramTooltip.style.transform = '';
    paramTooltip.style.left = '0px';
    paramTooltip.style.top = '0px';
    paramTooltip.classList.add('visible');
    const tw = paramTooltip.offsetWidth;
    const th = paramTooltip.offsetHeight;

    if (pos === 'right' || (!pos && el.closest('.panel'))) {
        /* Element-anchored positioning (panel items) */
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const fitsRight = rect.right + gap + tw <= vw - gap;
        const fitsLeft  = rect.left - gap - tw >= gap;
        const fitsBelow = rect.bottom + gap + th <= vh - gap;

        let left, top;
        if (fitsRight) {
            left = rect.right + gap;
            top = cy - th / 2;
        } else if (fitsLeft) {
            left = rect.left - gap - tw;
            top = cy - th / 2;
        } else if (fitsBelow) {
            left = cx - tw / 2;
            top = rect.bottom + gap;
        } else {
            left = cx - tw / 2;
            top = rect.top - gap - th;
        }

        /* Clamp to viewport */
        left = Math.max(gap, Math.min(left, vw - tw - gap));
        top  = Math.max(gap, Math.min(top, vh - th - gap));

        paramTooltip.style.left = left + 'px';
        paramTooltip.style.top = top + 'px';
    } else {
        /* Cursor-relative positioning (stage area items) */
        const preferAbove = pos === 'above';
        const cursorGap = 14;
        const mx = mouseX || 0;
        const my = mouseY || 0;

        let left = mx - tw / 2;
        left = Math.max(gap, Math.min(left, vw - tw - gap));

        let top;
        if (preferAbove) {
            top = my - th - cursorGap;
            if (top < gap) top = my + cursorGap; /* flip to below */
        } else {
            top = my + cursorGap;
            if (top + th > vh - gap) top = my - th - cursorGap; /* flip to above */
        }

        paramTooltip.style.left = left + 'px';
        paramTooltip.style.top = top + 'px';
    }
}

function hideTooltip() {
    tooltipSource = null;
    paramTooltip.classList.remove('visible');
}

function refreshTooltip(el) {
    if (tooltipSource === el && paramTooltip.classList.contains('visible')) {
        paramTooltip.textContent = el.getAttribute('data-tooltip');
    }
}

let recentTouch = false;
document.querySelectorAll('[data-tooltip]').forEach(el => {
    el.addEventListener('mouseenter', (e) => {
        if (recentTouch) return;
        showTooltip(el, e.clientX, e.clientY);
    });
    el.addEventListener('mouseleave', hideTooltip);

    // Touch handling: long-press shows tooltip, regular tap suppresses it
    let pressTimer = null;
    let didLongPress = false;

    el.addEventListener('touchstart', () => {
        didLongPress = false;
        pressTimer = setTimeout(() => {
            didLongPress = true;
            showTooltip(el);
        }, 400);
    }, { passive: true });

    el.addEventListener('touchend', (e) => {
        clearTimeout(pressTimer);
        recentTouch = true;
        setTimeout(() => { recentTouch = false; }, 500);
        if (didLongPress) {
            e.preventDefault();
            setTimeout(hideTooltip, 1500);
        }
    });

    el.addEventListener('touchmove', () => {
        clearTimeout(pressTimer);
    }, { passive: true });
});

/* ---------------------------
 * Collapsible sections
 * ---------------------------
 */
document.querySelectorAll('.collapsible-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        document.getElementById(btn.dataset.target).classList.toggle('collapsed', expanded);
    });
});

document.querySelectorAll('.sub-collapsible-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        document.getElementById(btn.dataset.target).classList.toggle('collapsed', expanded);
    });
});

/* Gallery header toggle */
el.galleryToggle.addEventListener('click', () => {
    const expanded = el.galleryToggle.getAttribute('aria-expanded') === 'true';
    el.galleryToggle.setAttribute('aria-expanded', String(!expanded));
    el.galleryContent.classList.toggle('collapsed', expanded);
});

/* Gallery sub-section toggles */
document.querySelectorAll('.gallery-section-header').forEach(header => {
    header.addEventListener('click', () => {
        const expanded = header.getAttribute('aria-expanded') === 'true';
        header.setAttribute('aria-expanded', String(!expanded));
        const target = document.getElementById(header.dataset.target);
        if (target) target.classList.toggle('collapsed', expanded);
    });
});

/* Active card config toggle — click anywhere on card header row */
function toggleActiveConfig() {
    const expanded = el.activeCardToggle.getAttribute('aria-expanded') === 'true';
    el.activeCardToggle.setAttribute('aria-expanded', String(!expanded));
    el.activeCardToggle.setAttribute('data-tooltip', expanded ? 'Open Configuration' : 'Close Configuration');
    refreshTooltip(el.activeCardToggle);
    document.getElementById('configControls').classList.toggle('collapsed', expanded);
}

document.querySelector('.active-card-main').addEventListener('click', (e) => {
    if (e.target.closest('.active-save-btn')) return;
    toggleActiveConfig();
});

/* Config randomize button */
document.getElementById('configRandomizeBtn').addEventListener('click', async (e) => {
    e.stopPropagation();
    await randomize();
});

/* History back/forward buttons */
document.getElementById('historyBackBtn').addEventListener('click', () => {
    if (historyIndex > 0) {
        captureCurrentBeforeNavigating();
        historyIndex--;
        restoreSnapshot(navHistory[historyIndex]);
        updateHistoryButtons();
    }
});
document.getElementById('historyForwardBtn').addEventListener('click', () => {
    if (historyIndex < navHistory.length - 1) {
        captureCurrentBeforeNavigating();
        historyIndex++;
        restoreSnapshot(navHistory[historyIndex]);
        updateHistoryButtons();
    }
});

/* ---------------------------
 * Panel toggle
 * ---------------------------
 */
const panelEl = document.querySelector('.panel');
const panelToggleBtn = document.getElementById('panelToggle');
const panelBackdrop = document.getElementById('panelBackdrop');

/* Keep --header-h in sync so the tablet/mobile panel sits below the header */
function syncHeaderHeight() {
    const h = document.querySelector('.app-header');
    if (h) document.documentElement.style.setProperty('--header-h', h.offsetHeight + 'px');
}
syncHeaderHeight();
window.addEventListener('resize', syncHeaderHeight);

function isPanelOpen() {
    return panelEl && !panelEl.classList.contains('panel-collapsed');
}

function openPanel() {
    if (!panelEl) return;
    panelEl.classList.remove('panel-collapsed');
    panelEl.setAttribute('aria-hidden', 'false');
    if (panelBackdrop) panelBackdrop.classList.remove('hidden');
    if (panelToggleBtn) {
        panelToggleBtn.classList.add('panel-open');
        panelToggleBtn.setAttribute('data-tooltip', 'Close menu');
        panelToggleBtn.setAttribute('aria-label', 'Close menu');
        refreshTooltip(panelToggleBtn);
    }
    localStorage.setItem('geo-self-portrait-panel-collapsed', 'false');
}

function closePanel() {
    if (!panelEl) return;
    panelEl.classList.add('panel-collapsed');
    panelEl.setAttribute('aria-hidden', 'true');
    if (panelBackdrop) panelBackdrop.classList.add('hidden');
    if (panelToggleBtn) {
        panelToggleBtn.classList.remove('panel-open');
        panelToggleBtn.setAttribute('data-tooltip', 'Open menu');
        panelToggleBtn.setAttribute('aria-label', 'Open menu');
        refreshTooltip(panelToggleBtn);
    }
    localStorage.setItem('geo-self-portrait-panel-collapsed', 'true');
}

function initPanelToggle() {
    if (!panelToggleBtn || !panelEl) return;

    // Set initial button state to match panel
    if (isPanelOpen()) {
        panelToggleBtn.classList.add('panel-open');
        panelToggleBtn.setAttribute('data-tooltip', 'Close menu');
        panelToggleBtn.setAttribute('aria-label', 'Close menu');
    }

    // Remove no-transition class set by inline script after first frame
    requestAnimationFrame(() => panelEl.classList.remove('no-transition'));

    panelToggleBtn.addEventListener('click', () => {
        if (isPanelOpen()) closePanel();
        else openPanel();
    });

    // Close drawer when clicking backdrop
    if (panelBackdrop) {
        panelBackdrop.addEventListener('click', closePanel);
    }
}

/* ---------------------------
 * Init
 * ---------------------------
 */
initPanelToggle();
initTopologySelector();
initPaletteSelector();
restorePaletteTweaksFromStorage();
initTheme(document.getElementById('themeSwitcher'));
createFaviconAnimation().start();
statementContentReady = loadStatementContent();
ensureStarterProfiles();

// Move configControls into the Active card (starts collapsed)
const configControls = document.getElementById('configControls');
el.activeCard.appendChild(configControls);
configControls.style.display = '';
configControls.classList.add('collapsed');

// Check for shared state in URL, otherwise randomize
const sharedState = decodeStateFromURL(window.location.href);
if (sharedState) {
    el.seed.value = sharedState.seed;
    autoGrow(el.seed);
    if (sharedState.name) {
        el.profileNameField.value = sharedState.name;
        autoGrow(el.profileNameField);
    }
    setControlsInUI(sharedState.controls);
    if (sharedState.paletteTweaks) {
        el.customHue.value = sharedState.paletteTweaks.baseHue;
        el.customHueRange.value = sharedState.paletteTweaks.hueRange;
        el.customSat.value = sharedState.paletteTweaks.saturation;
    }
    syncPaletteEditor();
    syncDisplayFields();
    // Generate display name if none provided
    if (!sharedState.name) {
        const nameRng = mulberry32(xmur3(sharedState.seed + ':name')());
        el.profileNameField.value = generateTitle(sharedState.controls, nameRng);
        autoGrow(el.profileNameField);
    }
    loadedProfileName = '';
    loadedFromPortrait = false;
    setDirty(true);
    setUserEdited(false);
} else {
    randomizeUI();
}
refreshProfileGallery();

// Seed history with initial state
navHistory.push(captureSnapshot());
historyIndex = 0;
updateHistoryButtons();

showCanvasOverlay('');

function doInitialRender() {
    const seed = el.seed.value.trim() || 'seed';
    const controls = readControlsFromUI();
    renderAndUpdate(seed, controls, { animate: true });
    setStillRendered(true);
    refreshProfileGallery();
    initComplete = true;
}

if (!renderWorker) {
    // Fallback: render on main thread
    requestAnimationFrame(doInitialRender);
}
// Worker path: doInitialRender is called from onWorkerMessage when 'ready' arrives

// Vite HMR: clean up worker so the next module instance starts fresh
if (import.meta.hot) {
    import.meta.hot.accept();
    import.meta.hot.dispose(() => {
        if (workerInitTimer) clearTimeout(workerInitTimer);
        if (renderWorker) { renderWorker.terminate(); renderWorker = null; }
        if (fallbackRenderer) { fallbackRenderer.dispose(); fallbackRenderer = null; }
    });
}
