/**
 * Entry point — wires all modules to the DOM.
 * Phase 1: Three.js WebGL renderer with new control scheme.
 */

import { createRenderer } from './engine/create-renderer.js';
import { PALETTE_KEYS, updatePalette, resetPalette, getPaletteDefaults, getPalette } from './core/palettes.js';
import { loadProfiles, saveProfiles, deleteProfile, ensureStarterProfiles } from './ui/profiles.js';
import { packageStillZip, packageStillZipFromBlob } from './export/export.js';
import { initTheme } from './ui/theme.js';
import { createFaviconAnimation } from './ui/animated-favicon.js';
import { generateTitle, generateAltText } from './core/text.js';
import { xmur3, mulberry32 } from './core/prng.js';

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
    profileGallery: document.getElementById('profileGallery'),
    configControls: document.getElementById('configControls'),
    configControlsHome: document.getElementById('configControlsHome'),
    profilesToggle: document.getElementById('profilesToggle'),

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
    statementTitle: document.getElementById('statementTitle'),
    developerBody: document.getElementById('developerBody'),
    artistBody: document.getElementById('artistBody'),
    governanceStatement: document.getElementById('governanceStatement'),
    governanceBody: document.getElementById('governanceBody'),

    canvasOverlay: document.getElementById('canvasOverlay'),
    canvasOverlayText: document.getElementById('canvasOverlayText'),
    exportBtn: document.getElementById('exportBtn'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),

    infoModal: document.getElementById('infoModal'),
    infoModalTitle: document.getElementById('infoModalTitle'),
    infoModalBody: document.getElementById('infoModalBody'),
    infoModalClose: document.getElementById('infoModalClose'),

    // Custom palette editor
    customPaletteEditor: document.getElementById('customPaletteEditor'),
    customHue: document.getElementById('customHue'),
    customHueRange: document.getElementById('customHueRange'),
    customSat: document.getElementById('customSat'),
    customLit: document.getElementById('customLit'),
    customHueLabel: document.getElementById('customHueLabel'),
    customHueRangeLabel: document.getElementById('customHueRangeLabel'),
    customSatLabel: document.getElementById('customSatLabel'),
    customLitLabel: document.getElementById('customLitLabel'),
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
    const key = thumbCacheKey(seed, controls, paletteTweaks);
    if (thumbCache.has(key)) {
        destImg.src = thumbCache.get(key);
        return;
    }
    thumbQueue.push({ seed, controls, destImg, key, paletteTweaks });
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
            if (item && thumbCache.has(item.key)) {
                if (item.destImg.isConnected) item.destImg.src = thumbCache.get(item.key);
            } else if (item && item.destImg.isConnected) {
                if (item.paletteTweaks) updatePalette(item.controls.palette, item.paletteTweaks);
                getThumbRenderer().renderWith(item.seed, item.controls);
                const url = thumbOffscreen.toDataURL('image/png');
                thumbCache.set(item.key, url);
                item.destImg.src = url;
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
        lightness: parseFloat(el.customLit.value),
    };
}

function loadPaletteIntoEditor(key) {
    const defaults = getPaletteDefaults(key);
    let vals = defaults;
    try {
        const raw = localStorage.getItem(paletteLSKey(key));
        if (raw) {
            const s = JSON.parse(raw);
            vals = {
                baseHue: s.baseHue ?? defaults.baseHue,
                hueRange: s.hueRange ?? defaults.hueRange,
                saturation: s.saturation ?? defaults.saturation,
                lightness: s.lightness ?? defaults.lightness,
            };
        }
    } catch { /* ignore */ }
    el.customHue.value = vals.baseHue;
    el.customHueRange.value = vals.hueRange;
    el.customSat.value = vals.saturation;
    el.customLit.value = vals.lightness;
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
    el.customLitLabel.textContent = settings.lightness.toFixed(2);

    updateActiveChipGradient(key, settings);

    // Show/hide "Write to Custom" button
    const wtc = document.getElementById('writeToCustom');
    if (wtc) wtc.classList.toggle('hidden', key === 'custom');
}

function initPaletteSelector() {
    // Generate all chip gradients from palette data so they match the active state
    for (const chip of el.paletteSelector.querySelectorAll('.pal-chip')) {
        const key = chip.dataset.value;
        if (key === 'custom') continue;
        const pal = getPalette(key);
        if (pal) updateActiveChipGradient(key, pal);
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
    for (const id of ['customHue', 'customHueRange', 'customSat', 'customLit']) {
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
            el.customLit.value = defaults.lightness;
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
function toast(msg) {
    el.toast.textContent = msg;
    if (!msg) return;
    setTimeout(() => { if (el.toast.textContent === msg) el.toast.textContent = ''; }, 2400);
}

function syncDisplayFields() {
    el.displayName.textContent = el.profileNameField.value.trim();
    el.displayIntent.textContent = el.seed.value.trim();
}

function loadProfileIntoUI(name) {
    if (!name) return;
    const profiles = loadProfiles();
    const p = profiles[name];
    if (!p) return;
    el.profileNameField.value = name;
    el.seed.value = p.seed || name;
    autoGrow(el.seed);
    if (p.controls) {
        const tweaks = p.paletteTweaks || (p.controls.palette === 'custom' ? p.customPalette : null);
        if (tweaks) {
            el.customHue.value = tweaks.baseHue;
            el.customHueRange.value = tweaks.hueRange;
            el.customSat.value = tweaks.saturation;
            el.customLit.value = tweaks.lightness;
            updatePalette(p.controls.palette, tweaks);
        } else if (p.controls.palette !== 'custom') {
            resetPalette(p.controls.palette);
        }
        setControlsInUI(p.controls);
    }
    el.customPaletteEditor.classList.add('collapsed');
    loadedProfileName = name;
    syncDisplayFields();
    setDirty(false);
    userEdited = false;
}

function setStillRendered(value) {
    stillRendered = value;
    el.exportBtn.disabled = !value;
    if (el.fullscreenBtn) el.fullscreenBtn.disabled = !value;
}

let dirty = false;
let userEdited = false;
function setDirty(value) {
    dirty = value;
    el.saveProfile.disabled = !value;
    const stageSave = document.getElementById('stageSaveBtn');
    if (stageSave) stageSave.disabled = !value;
    const expandedCard = el.profileGallery.querySelector('.profile-card.expanded');
    if (expandedCard) {
        expandedCard.classList.toggle('dirty', value);
        if (value) {
            const nameEl = expandedCard.querySelector('.profile-card-name');
            if (nameEl) nameEl.textContent = el.profileNameField.value || 'Untitled';
        }
    }
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

    // Reveal wipe as visual polish over the fading-in canvas
    const wrapper = document.querySelector('.canvas-wrapper');
    const wipe = document.createElement('div');
    wipe.className = 'reveal-wipe';
    wrapper.appendChild(wipe);
    wipe.addEventListener('animationend', () => wipe.remove());

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
    updateSliderLabels(readControlsFromUI());
    scheduleTextRefresh();
    setStillRendered(false);
    userEdited = true;
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
    userEdited = true;
    setDirty(true);
    syncDisplayFields();
    const expandedCard = el.profileGallery.querySelector('.profile-card.expanded');
    if (expandedCard) {
        const nameEl = expandedCard.querySelector('.profile-card-name');
        if (nameEl) nameEl.textContent = el.profileNameField.value || 'Untitled';
    }
});

function saveCurrentProfile() {
    const name = el.profileNameField.value.trim();
    if (!name) { toast('Enter a name first.'); return; }

    const profiles = loadProfiles();
    if (profiles[name] && name !== loadedProfileName) {
        if (!confirm(`Profile "${name}" already exists. Overwrite?`)) return;
    }

    const controls = readControlsFromUI();
    const profileData = {
        seed: el.seed.value.trim() || 'seed',
        controls,
    };
    profileData.paletteTweaks = readPaletteFromUI();
    if (controls.palette === 'custom') {
        profileData.customPalette = profileData.paletteTweaks;
    }
    profiles[name] = profileData;
    saveProfiles(profiles);

    loadedProfileName = name;
    refreshProfileGallery();
    setDirty(false);
    userEdited = false;
}

el.saveProfile.addEventListener('click', saveCurrentProfile);

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
const HISTORY_MAX = 5;
let randHistory = [];
let historyIndex = -1;

function captureSnapshot() {
    return {
        seed: el.seed.value.trim(),
        name: el.profileNameField.value.trim(),
        controls: readControlsFromUI(),
        paletteTweaks: readPaletteFromUI(),
    };
}

function restoreSnapshot(snap) {
    el.seed.value = snap.seed;
    autoGrow(el.seed);
    el.profileNameField.value = snap.name;
    setControlsInUI(snap.controls);
    el.customHue.value = snap.paletteTweaks.baseHue;
    el.customHueRange.value = snap.paletteTweaks.hueRange;
    el.customSat.value = snap.paletteTweaks.saturation;
    el.customLit.value = snap.paletteTweaks.lightness;
    syncPaletteEditor();
    updateSliderLabels(snap.controls);
    syncDisplayFields();
    loadedProfileName = '';
    dirty = true;
    userEdited = false;
    refreshProfileGallery();
    renderAndUpdate(snap.seed, snap.controls, { animate: true });
    setStillRendered(true);
}

function updateHistoryButtons() {
    const back = document.getElementById('historyBackBtn');
    const fwd = document.getElementById('historyForwardBtn');
    if (back) back.disabled = historyIndex <= 0;
    if (fwd) fwd.disabled = historyIndex >= randHistory.length - 1;
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
        if (result === 'save') saveCurrentProfile();
    }

    el.seed.value = generateIntent();
    autoGrow(el.seed);

    // Topology hidden — always flow-field
    setTopologyUI('flow-field');
    const chosenPalette = PALETTE_KEYS[Math.floor(Math.random() * PALETTE_KEYS.length)];
    setPaletteUI(chosenPalette);
    el.customHue.value = Math.floor(Math.random() * 360);
    el.customHueRange.value = Math.floor(20 + Math.random() * 140);
    el.customSat.value = (0.3 + Math.random() * 0.5).toFixed(2);
    el.customLit.value = (0.4 + Math.random() * 0.35).toFixed(2);
    syncPaletteEditor();
    for (const id of SLIDER_KEYS) {
        el[id].value = Math.random().toFixed(2);
    }

    const seed = el.seed.value.trim() || 'seed';
    const controls = readControlsFromUI();
    updateSliderLabels(controls);

    // Generate a descriptive name from the randomized controls
    const nameRng = mulberry32(xmur3(seed + ':name')());
    el.profileNameField.value = generateTitle(controls, nameRng);

    // Detach from any loaded profile so this becomes a new unsaved draft
    loadedProfileName = '';
    dirty = true;
    userEdited = false;
    refreshProfileGallery();

    // Push to history (truncate any forward entries)
    if (historyIndex < randHistory.length - 1) {
        randHistory.splice(historyIndex + 1);
    }
    randHistory.push(captureSnapshot());
    if (randHistory.length > HISTORY_MAX) randHistory.shift();
    historyIndex = randHistory.length - 1;
    updateHistoryButtons();

    renderAndUpdate(seed, controls, { animate: true });
    setStillRendered(true);
}

/* ---------------------------
 * Profile gallery
 * ---------------------------
 */
const TRASH_SVG = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0v-6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>';

function collapseCurrentCard() {
    const expanded = el.profileGallery.querySelector('.profile-card.expanded');
    if (!expanded) return;
    el.configControlsHome.appendChild(el.configControls);
    expanded.classList.remove('expanded');
}

function expandCard(cardEl) {
    const profileName = cardEl.dataset.profileName;

    collapseCurrentCard();

    // Load profile data into controls (skip for draft cards which already have UI state)
    if (profileName && profileName !== '__draft__') {
        loadProfileIntoUI(profileName);
    }

    // Reparent config controls into this card
    const slot = cardEl.querySelector('.profile-card-expansion');
    slot.appendChild(el.configControls);

    cardEl.classList.add('expanded');

    // Mark as active
    el.profileGallery.querySelectorAll('.profile-card').forEach(c =>
        c.classList.remove('active-profile')
    );
    cardEl.classList.add('active-profile');

    // Trigger render
    const seed = el.seed.value.trim() || 'seed';
    const controls = readControlsFromUI();
    renderAndUpdate(seed, controls, { animate: true });
    setStillRendered(true);

    // Scroll into view
    setTimeout(() => cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
}

function buildProfileCard(name, p) {
    const card = document.createElement('div');
    card.className = 'profile-card';
    card.dataset.profileName = name;

    // Header (clickable area)
    const header = document.createElement('div');
    header.className = 'profile-card-header';

    const thumbImg = document.createElement('img');
    thumbImg.className = 'profile-thumb';
    header.appendChild(thumbImg);
    if (p.seed && p.controls) {
        queueThumbnail(p.seed, p.controls, thumbImg, p.paletteTweaks);
    }

    const body = document.createElement('div');
    body.className = 'profile-card-body';

    const nm = document.createElement('div');
    nm.className = 'profile-card-name';
    nm.textContent = name;
    body.appendChild(nm);

    const unsavedLabel = document.createElement('div');
    unsavedLabel.className = 'profile-card-unsaved-label';
    unsavedLabel.textContent = '(unsaved)';
    body.appendChild(unsavedLabel);

    header.appendChild(body);

    // Save button (visible when dirty via CSS)
    const saveBtn = document.createElement('button');
    saveBtn.className = 'profile-card-save';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        saveCurrentProfile();
    });
    card.appendChild(saveBtn);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'profile-card-delete';
    deleteBtn.title = 'Delete';
    deleteBtn.innerHTML = TRASH_SVG;
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const realName = card.dataset.profileName;
        if (realName && realName !== '__draft__') {
            deleteProfile(realName);
            if (realName === loadedProfileName) loadedProfileName = null;
        }
        refreshProfileGallery();
    });
    card.appendChild(deleteBtn);

    card.appendChild(header);

    // Expansion slot
    const expansion = document.createElement('div');
    expansion.className = 'profile-card-expansion';
    card.appendChild(expansion);

    // Click handler: accordion toggle
    header.addEventListener('click', (e) => {
        if (e.target.closest('.profile-card-delete') ||
            e.target.closest('.profile-card-save')) return;

        const isCurrentlyExpanded = card.classList.contains('expanded');
        if (isCurrentlyExpanded) {
            collapseCurrentCard();
        } else {
            expandCard(card);
        }
    });

    return card;
}

function refreshProfileGallery() {
    const profiles = loadProfiles();
    const names = Object.keys(profiles).sort((a, b) => a.localeCompare(b));

    // Park config controls before rebuilding
    collapseCurrentCard();

    el.profileGallery.innerHTML = '';

    // Draft card at top if unsaved without a loaded profile
    if (!loadedProfileName && dirty) {
        const draftName = el.profileNameField.value.trim() || 'Untitled';
        const draftData = {
            seed: el.seed.value.trim() || 'seed',
            controls: readControlsFromUI(),
            paletteTweaks: readPaletteFromUI(),
        };
        const draftCard = buildProfileCard(draftName, draftData);
        draftCard.dataset.profileName = '__draft__';
        draftCard.classList.add('dirty');
        el.profileGallery.appendChild(draftCard);

        // Auto-expand draft card
        const slot = draftCard.querySelector('.profile-card-expansion');
        slot.appendChild(el.configControls);
        draftCard.classList.add('expanded', 'active-profile');
    }

    if (names.length === 0 && !loadedProfileName && !dirty) {
        const d = document.createElement('div');
        d.className = 'small';
        d.textContent = 'No saved profiles yet.';
        el.profileGallery.appendChild(d);
        return;
    }

    for (const name of names) {
        const card = buildProfileCard(name, profiles[name]);
        el.profileGallery.appendChild(card);

        // Auto-expand the loaded profile
        if (name === loadedProfileName) {
            const slot = card.querySelector('.profile-card-expansion');
            slot.appendChild(el.configControls);
            card.classList.add('expanded', 'active-profile');
            card.classList.toggle('dirty', dirty);
        }
    }
}

/* ---------------------------
 * Export
 * ---------------------------
 */
el.exportBtn.addEventListener('click', async () => {
    if (!stillRendered) { toast('Render first.'); return; }
    if (!window.JSZip) { toast('JSZip missing (offline?).'); return; }

    const seed = el.seed.value.trim() || 'seed';
    const controls = readControlsFromUI();

    // Generate metadata on main thread (cheap text generation)
    const titleRng = mulberry32(xmur3(seed + ':title')());
    const title = generateTitle(controls, titleRng);
    const altText = generateAltText(controls, lastNodeCount, title);
    const meta = { title, altText, nodeCount: lastNodeCount };

    if (renderWorker && workerReady) {
        // Request blob from worker
        const exportId = ++requestIdCounter;
        try {
            const blob = await new Promise((resolve, reject) => {
                pendingCallbacks.set(exportId, (b) => b ? resolve(b) : reject(new Error('Export failed')));
                renderWorker.postMessage({ type: 'export', requestId: exportId });
            });
            const rect = canvas.getBoundingClientRect();
            await packageStillZipFromBlob(blob, {
                seed, controls, meta,
                canvasWidth: Math.round(rect.width * window.devicePixelRatio),
                canvasHeight: Math.round(rect.height * window.devicePixelRatio),
            });
            toast('Exported still ZIP.');
        } catch (err) {
            console.error(err);
            toast('Still export failed.');
        }
    } else {
        try {
            await packageStillZip(canvas, { seed, controls, meta });
            toast('Exported still ZIP.');
        } catch (err) {
            console.error(err);
            toast('Still export failed.');
        }
    }
});

/* ---------------------------
 * Import profile
 * ---------------------------
 */
const importModal = document.getElementById('importModal');
const importFileInput = document.getElementById('importFile');
const importJsonArea = document.getElementById('importJson');
const importError = document.getElementById('importError');

function showImportError(msg) {
    importError.textContent = msg;
    importError.style.display = 'block';
}

function clearImportModal() {
    importFileInput.value = '';
    importJsonArea.value = '';
    importError.style.display = 'none';
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

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        showImportError('Expected a JSON object.');
        return;
    }

    // Detect shape: single profile { seed, controls } or collection { "Name": { seed, controls } }
    let entries;
    if (data.controls && typeof data.controls === 'object') {
        // Single profile — need a name
        const name = data.name || el.profileNameField.value.trim() || 'Imported';
        delete data.name;
        entries = [[name, data]];
    } else {
        // Collection — each value should be a profile
        entries = Object.entries(data);
        if (entries.length === 0) {
            showImportError('No profiles found in JSON.');
            return;
        }
    }

    // Validate each profile
    const required = ['density', 'luminosity', 'fracture', 'depth', 'coherence'];
    for (const [name, profile] of entries) {
        if (!profile || typeof profile !== 'object') {
            showImportError(`"${name}" is not a valid profile object.`);
            return;
        }
        if (!profile.controls || typeof profile.controls !== 'object') {
            showImportError(`"${name}" is missing a controls object.`);
            return;
        }
        for (const key of required) {
            if (typeof profile.controls[key] !== 'number') {
                showImportError(`"${name}" controls missing numeric "${key}".`);
                return;
            }
        }
    }

    // Save all profiles
    const profiles = loadProfiles();
    let lastName = '';
    for (const [name, profile] of entries) {
        if (!profile.seed) profile.seed = name;
        if (!profile.controls.topology) profile.controls.topology = 'flow-field';
        if (!profile.controls.palette) profile.controls.palette = 'violet-depth';
        profiles[name] = profile;
        lastName = name;
    }
    saveProfiles(profiles);

    // Load the last imported profile into the UI
    loadProfileIntoUI(lastName);
    refreshProfileGallery();
    renderAndUpdate(el.seed.value.trim() || 'seed', readControlsFromUI(), { animate: true });
    setStillRendered(true);

    closeImportModal();
    toast(`Imported ${entries.length} profile${entries.length > 1 ? 's' : ''}.`);
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
        const reader = new FileReader();
        reader.onload = () => {
            importJsonArea.value = reader.result;
            importError.style.display = 'none';
        };
        reader.readAsText(importFileInput.files[0]);
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
        governanceTitle: 'txt/governance-framework-title.txt',
        governanceContent: 'md/governance-framework-content.md',
    };
    try {
        const [devTitle, artTitle, devContent, artContent, govTitle, govContent] = await Promise.all(
            Object.values(files).map(f => fetch(f).then(r => r.text()))
        );
        STATEMENT_TITLES.developer = devTitle.trim();
        STATEMENT_TITLES.artist = artTitle.trim();
        STATEMENT_TITLES.governance = govTitle.trim();
        el.developerBody.querySelector('.manifesto').textContent = devContent.trim();
        el.artistBody.querySelector('.manifesto').textContent = artContent.trim();
        el.governanceBody.querySelector('.manifesto').innerHTML = simpleMarkdownToHtml(govContent.trim());
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
 * Parameter tooltips (fixed-position to escape overflow)
 * ---------------------------
 */
const paramTooltip = document.getElementById('paramTooltip');
document.querySelectorAll('.label-info[data-tooltip]').forEach(label => {
    label.addEventListener('mouseenter', () => {
        const rect = label.getBoundingClientRect();
        paramTooltip.textContent = label.getAttribute('data-tooltip');
        paramTooltip.style.left = (rect.right + 8) + 'px';
        paramTooltip.style.top = (rect.top + rect.height / 2) + 'px';
        paramTooltip.style.transform = 'translateY(-50%)';
        paramTooltip.classList.add('visible');
    });
    label.addEventListener('mouseleave', () => {
        paramTooltip.classList.remove('visible');
    });
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

/* Profiles header toggle */
el.profilesToggle.addEventListener('click', () => {
    const expanded = el.profilesToggle.getAttribute('aria-expanded') === 'true';
    el.profilesToggle.setAttribute('aria-expanded', String(!expanded));
    el.profileGallery.style.display = expanded ? 'none' : '';
});


/* Config randomize button */
document.getElementById('configRandomizeBtn').addEventListener('click', async (e) => {
    e.stopPropagation();
    await randomize();
});

/* History back/forward buttons */
document.getElementById('historyBackBtn').addEventListener('click', () => {
    if (historyIndex > 0) {
        historyIndex--;
        restoreSnapshot(randHistory[historyIndex]);
    }
});
document.getElementById('historyForwardBtn').addEventListener('click', () => {
    if (historyIndex < randHistory.length - 1) {
        historyIndex++;
        restoreSnapshot(randHistory[historyIndex]);
    }
});

/* Stage save button */
document.getElementById('stageSaveBtn').addEventListener('click', () => {
    saveCurrentProfile();
    if (!dirty) {
        userEdited = false;
        toast('Profile saved.');
    }
});

/* ---------------------------
 * Panel toggle
 * ---------------------------
 */
const panelEl = document.querySelector('.panel');
const panelToggleBtn = document.getElementById('panelToggle');
const panelBackdrop = document.getElementById('panelBackdrop');

function isPanelOpen() {
    return panelEl && !panelEl.classList.contains('panel-collapsed');
}

function openPanel() {
    if (!panelEl) return;
    panelEl.classList.remove('panel-collapsed');
    panelEl.setAttribute('aria-hidden', 'false');
    if (panelBackdrop) panelBackdrop.classList.remove('hidden');
    localStorage.setItem('geo-self-portrait-panel-collapsed', 'false');
}

function closePanel() {
    if (!panelEl) return;
    panelEl.classList.add('panel-collapsed');
    panelEl.setAttribute('aria-hidden', 'true');
    if (panelBackdrop) panelBackdrop.classList.add('hidden');
    localStorage.setItem('geo-self-portrait-panel-collapsed', 'true');
}

function initPanelToggle() {
    if (!panelToggleBtn || !panelEl) return;

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

/* ── Fullscreen ── */

const renderCard = document.getElementById('renderCard');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const fullscreenCloseBtn = document.getElementById('fullscreenClose');

function initFullscreen() {
    if (!renderCard || !fullscreenBtn) return;

    fullscreenBtn.addEventListener('click', () => {
        if (renderCard.requestFullscreen) {
            renderCard.requestFullscreen();
        } else if (renderCard.webkitRequestFullscreen) {
            renderCard.webkitRequestFullscreen();
        }
    });

    if (fullscreenCloseBtn) {
        fullscreenCloseBtn.addEventListener('click', () => {
            if (document.fullscreenElement || document.webkitFullscreenElement) {
                (document.exitFullscreen || document.webkitExitFullscreen).call(document);
            }
        });
    }

    function onFullscreenChange() {
        const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
        if (isFullscreen) {
            cancelPendingRender();
            showCanvasOverlay('');
            requestAnimationFrame(() => {
                const seed = el.seed.value.trim() || 'seed';
                const controls = readControlsFromUI();
                updateSliderLabels(controls);
                sendRenderRequest(seed, controls, {
                    deliberate: true,
                    callback() {
                        scheduleTextRefresh();
                        hideCanvasOverlay();
                    },
                });
            });
        } else {
            // Re-render at normal size — ResizeObserver clears the WebGL buffer on shrink
            requestAnimationFrame(() => {
                const seed = el.seed.value.trim() || 'seed';
                const controls = readControlsFromUI();
                sendRenderRequest(seed, controls);
            });
        }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
}

/* ---------------------------
 * Init
 * ---------------------------
 */
initPanelToggle();
initFullscreen();
initTopologySelector();
initPaletteSelector();
restorePaletteTweaksFromStorage();
initTheme(document.getElementById('themeSwitcher'));
createFaviconAnimation().start();
statementContentReady = loadStatementContent();
ensureStarterProfiles();

// Load the first available profile
const startProfiles = loadProfiles();
const startNames = Object.keys(startProfiles).sort((a, b) => a.localeCompare(b));
if (startNames.length > 0) loadProfileIntoUI(startNames[0]);
updateSliderLabels(readControlsFromUI());
refreshProfileGallery();

showCanvasOverlay('');

function doInitialRender() {
    const seed = el.seed.value.trim() || 'seed';
    const controls = readControlsFromUI();
    renderAndUpdate(seed, controls, { animate: true });
    setStillRendered(true);
    refreshProfileGallery();
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
