/**
 * Shared editor entry point — used by both image and animation pages.
 *
 * Differences between modes are parameterized via the config object:
 *   mode: 'image' | 'animation'
 *   pageTitle: i18n key for document.title
 *   animElements: null (image) | { animToggle, animConfigSection, ... } (animation)
 */

import { createRenderer } from '../../lib/engine/create-renderer.js';
import { PRESETS } from '../../lib/core/palettes.js';
import { loadProfiles, saveProfiles, deleteProfile, ensureStarterProfiles, loadPortraits, getPortraitNames, loadProfileOrder, saveProfileOrder, syncProfileOrder } from '../ui/profiles.js';
import { packageStillZip, packageStillZipFromBlob, downloadBlob, canvasToPngBlob, injectPngTextChunks, toIsoLocalish, safeName } from '../export/export.js';
import { encodeStateToURL, decodeStateFromURL } from '../core/url-state.js';
import { initPageSettings } from '../ui/page-settings.js';
import { getResolution } from '../ui/resolution.js';
import { createFaviconAnimation } from '../ui/animated-favicon.js';
import { generateTitle, generateAltText } from '../../lib/core/text.js';
import { xmur3, mulberry32 } from '../../lib/core/prng.js';
import { seedTagToLabel, isSeedTag, parseSeed, getLocalizedWords, TAG_LIST_LENGTH } from '../../lib/core/seed-tags.js';
import { validateStillConfig, configToProfile, profileToConfig } from '../../lib/core/config-schema.js';
import { getAllThumbs, putThumb, deleteThumb } from '../ui/thumb-cache.js';
import { toast, initToastClose } from '../shared/toast.js';
import { autoGrow, initAutoGrowTextareas } from '../shared/dom-utils.js';
import { initTooltips, hideTooltip, refreshTooltip } from '../shared/tooltips.js';
import { initCollapsibles } from '../shared/collapsibles.js';
import { initPanel, isPanelOpen, closePanel } from '../shared/panel.js';
import { initStatementModal } from '../shared/statement.js';
import { showConfirm, initModals, closeInfoModal } from '../shared/modals.js';
import { slugify, validateProfileName } from '../shared/slugify.js';
// generateIntent no longer used — seed tags replace freeform intent
import { initLocale, t, getLocale } from '../i18n/locale.js';
import { TRASH_SVG, ARROW_UP_SVG, ARROW_DOWN_SVG } from '../shared/icons.js';

export function initEditor({ mode, pageTitle, animElements }) {

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
    // Seed tag selects (3 dropdowns replacing single textarea)
    seedTagArr: document.getElementById('seedTagArr'),
    seedTagStr: document.getElementById('seedTagStr'),
    seedTagDet: document.getElementById('seedTagDet'),

    // Camera controls
    zoom: document.getElementById('zoom'),
    rotation: document.getElementById('rotation'),
    zoomLabel: document.getElementById('zoomLabel'),
    rotationLabel: document.getElementById('rotationLabel'),

    // Discrete controls (hidden inputs driven by tile/swatch UI)
    topology: document.getElementById('topology'),
    topologySelector: document.getElementById('topologySelector'),

    // Continuous controls
    density: document.getElementById('density'),
    luminosity: document.getElementById('luminosity'),
    fracture: document.getElementById('fracture'),
    coherence: document.getElementById('coherence'),
    hue: document.getElementById('hue'),
    spectrum: document.getElementById('spectrum'),
    chroma: document.getElementById('chroma'),
    scale: document.getElementById('scale'),
    division: document.getElementById('division'),
    faceting: document.getElementById('faceting'),
    flow: document.getElementById('flow'),

    densityLabel: document.getElementById('densityLabel'),
    luminosityLabel: document.getElementById('luminosityLabel'),
    fractureLabel: document.getElementById('fractureLabel'),
    coherenceLabel: document.getElementById('coherenceLabel'),
    hueLabel: document.getElementById('hueLabel'),
    spectrumLabel: document.getElementById('spectrumLabel'),
    chromaLabel: document.getElementById('chromaLabel'),
    scaleLabel: document.getElementById('scaleLabel'),
    divisionLabel: document.getElementById('divisionLabel'),
    facetingLabel: document.getElementById('facetingLabel'),
    flowLabel: document.getElementById('flowLabel'),

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

    infoModal: document.getElementById('infoModal'),
    infoModalTitle: document.getElementById('infoModalTitle'),
    infoModalBody: document.getElementById('infoModalBody'),
    infoModalClose: document.getElementById('infoModalClose'),

    // Animation elements (animation mode only)
    ...(animElements || {}),
};

initAutoGrowTextareas();

const SLIDER_KEYS = ['density', 'luminosity', 'fracture', 'coherence', 'hue', 'spectrum', 'chroma', 'scale', 'division', 'faceting', 'flow'];
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
let animCfg = null; // initialized in animation mode's toggle section

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
            new URL('../engine/render-worker.js', import.meta.url),
            { type: 'module' },
        );
        worker.onmessage = onWorkerMessage;
        worker.onerror = (err) => {
            console.error('[render] Worker error:', err.message);
            if (workerInitTimer) { clearTimeout(workerInitTimer); workerInitTimer = null; }
            activateFallbackRenderer();
        };
        const rect = canvas.getBoundingClientRect();
        const initRes = getResolution();
        const useTarget = initRes.key !== 'hd';
        worker.postMessage({
            type: 'init',
            canvas: offscreen,
            width: useTarget ? initRes.w : rect.width,
            height: useTarget ? initRes.h : rect.height,
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
            if (animElements) {
                renderWorker.postMessage({ type: 'set-animation', enabled: animationEnabled });
                renderWorker.postMessage({ type: 'set-anim-config', ...animCfg });
            } else {
                renderWorker.postMessage({ type: 'set-animation', enabled: false });
            }
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
        case 'morph-progress':
            // Image editor: morph UI removed, ignore progress
            break;
        case 'morph-complete':
            // Image editor: morph UI removed
            setMorphLocked(false);
            setStillRendered(true);
            refreshGeneratedText(true);
            break;
        case 'morph-ended':
            // Worker acknowledged morph cancel
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
            break;
    }
}

// Apply stored resolution to canvas
const initialRes = getResolution();
canvas.width = initialRes.w;
canvas.height = initialRes.h;

renderWorker = initWorkerRenderer();
if (!renderWorker) {
    fallbackRenderer = createRenderer(canvas);
    fallbackRenderer.setTargetResolution(initialRes.w, initialRes.h);
}

// Current target resolution (overrides ResizeObserver when set)
let targetRes = initialRes.key !== 'hd' ? { w: initialRes.w, h: initialRes.h } : null;

// Track canvas size changes and forward to worker
if (renderWorker) {
    const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            if (entry.target === canvas) {
                // When a target resolution is set, don't let display size override it
                if (targetRes) return;
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

// Listen for resolution changes from the settings popover
/* ---------------------------
 * Seed tag helpers
 * ---------------------------
 */

/** Read the current seed from UI — always returns a SeedTag array. */
function getCurrentSeed() {
    return [
        parseInt(el.seedTagArr.value, 10),
        parseInt(el.seedTagStr.value, 10),
        parseInt(el.seedTagDet.value, 10),
    ];
}

/** Set seed in UI — handles both SeedTag arrays and legacy strings. */
function setSeedInUI(seed) {
    const tag = Array.isArray(seed) ? seed : parseSeed(seed);
    el.seedTagArr.value = String(tag[0]);
    el.seedTagStr.value = String(tag[1]);
    el.seedTagDet.value = String(tag[2]);
}

/** Populate seed tag selects with localized words. */
function initSeedTagSelects() {
    const locale = getLocale();
    const words = getLocalizedWords(locale);
    populateTagSelect(el.seedTagArr, words.arrangement);
    populateTagSelect(el.seedTagStr, words.structure);
    populateTagSelect(el.seedTagDet, words.detail);
}

function populateTagSelect(selectEl, words) {
    const prev = selectEl.value;
    selectEl.innerHTML = '';
    for (let i = 0; i < words.length; i++) {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = words[i];
        selectEl.appendChild(opt);
    }
    if (prev) selectEl.value = prev;
}

const CAMERA_DEFAULTS = { zoom: 1.0, rotation: 0 };

function readCameraFromUI() {
    return {
        zoom: parseFloat(el.zoom.value),
        rotation: parseFloat(el.rotation.value),
    };
}

function setCameraInUI(camera) {
    const cam = camera || CAMERA_DEFAULTS;
    el.zoom.value = cam.zoom;
    el.rotation.value = cam.rotation;
    updateCameraLabels(cam);
}

function updateCameraLabels(camera) {
    el.zoomLabel.textContent = camera.zoom.toFixed(2);
    el.rotationLabel.textContent = Math.round(camera.rotation) + '\u00b0';
}

function sendCameraState(zoom, rotation) {
    if (renderWorker && workerReady) {
        renderWorker.postMessage({ type: 'set-camera', zoom, orbitY: rotation, orbitX: 0 });
    } else if (fallbackRenderer) {
        fallbackRenderer.setCameraState(zoom, rotation, 0);
    }
}

function onCameraChange() {
    if (!initComplete) return;
    const cam = readCameraFromUI();
    updateCameraLabels(cam);
    sendCameraState(cam.zoom, cam.rotation);
    setUserEdited(true);
    setDirty(true);
}

document.addEventListener('resolutionchange', (e) => {
    const { w, h } = e.detail;
    canvas.width = w;
    canvas.height = h;
    targetRes = { w, h };
    if (renderWorker && workerReady) {
        renderWorker.postMessage({ type: 'resize', width: w, height: h, dpr: window.devicePixelRatio });
    } else if (fallbackRenderer) {
        fallbackRenderer.setTargetResolution(w, h);
    }
    // Re-render current scene at new resolution
    const seed = getCurrentSeed();
    const controls = readControlsFromUI();
    sendRenderRequest(seed, controls);
});

/* ---------------------------
 * Thumbnail generator
 * ---------------------------
 */
let thumbOffscreen = null;
let thumbRenderer = null;
let thumbW = 280, thumbH = 180;

function getThumbRenderer(w = 280, h = 180) {
    if (!thumbRenderer) {
        thumbOffscreen = document.createElement('canvas');
        thumbOffscreen.width = w;
        thumbOffscreen.height = h;
        thumbW = w; thumbH = h;
        thumbRenderer = createRenderer(thumbOffscreen);
    } else if (w !== thumbW || h !== thumbH) {
        thumbOffscreen.width = w;
        thumbOffscreen.height = h;
        thumbW = w; thumbH = h;
        thumbRenderer.resize(w, h);
    }
    return thumbRenderer;
}

const thumbCache = new Map();
const thumbQueue = [];
let thumbProcessing = false;
let thumbDrainDeferred = true;

// Pre-load persistent thumbnail cache from IndexedDB
const thumbCacheReady = getAllThumbs().then(persisted => {
    for (const [key, url] of persisted) thumbCache.set(key, url);
});

function thumbCacheKey(seed, controls) {
    return seed + '|' + JSON.stringify(controls);
}

function queueThumbnail(seed, controls, destImg) {
    const key = thumbCacheKey(seed, controls);
    const wrap = destImg.closest('.thumb-wrap');
    if (thumbCache.has(key)) {
        destImg.src = thumbCache.get(key);
        if (wrap) wrap.classList.remove('thumb-loading');
        return;
    }
    if (wrap) wrap.classList.add('thumb-loading');
    thumbQueue.push({ seed, controls, destImg, key });
    drainThumbQueue();
}

const scheduleIdle = window.requestIdleCallback || (cb => setTimeout(cb, 100));

function drainThumbQueue() {
    if (thumbDrainDeferred) return;
    if (thumbProcessing || thumbQueue.length === 0) return;
    thumbProcessing = true;
    scheduleIdle(() => {
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
                getThumbRenderer().renderWith(item.seed, item.controls);
                const url = thumbOffscreen.toDataURL('image/png');
                thumbCache.set(item.key, url);
                putThumb(item.key, url);
                item.destImg.src = url;
                if (wrap) wrap.classList.remove('thumb-loading');
            }
        } catch (err) {
            console.error('[thumb] render error:', err);
        }
        thumbProcessing = false;
        drainThumbQueue();
    });
}

// Expose thumbnail renderer for build-time portrait generation (scripts/gen-thumbs.mjs)
window.__renderPortraitThumb = function(profileName) {
    const portraits = loadPortraits();
    const p = portraits[profileName];
    if (!p) throw new Error(`Portrait not found: ${profileName}`);
    const r = getThumbRenderer();
    r.renderWith(p.seed, p.controls);
    // Match sprite last frame: fold=1.0, time=3.0
    r.setFoldImmediate(1.0);
    r.updateTime(3.0);
    r.renderFrame();
    return thumbOffscreen.toDataURL('image/png');
};

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
        renderWorker.postMessage({
            type: 'render',
            seed,
            controls,
            requestId: id,
            deliberate,
            locale: getLocale(),
            width: targetRes ? targetRes.w : (canvas.clientWidth || canvas.getBoundingClientRect().width),
            height: targetRes ? targetRes.h : (canvas.clientHeight || canvas.getBoundingClientRect().height),
        });
    } else if (fallbackRenderer) {
        const meta = fallbackRenderer.renderWith(seed, controls, getLocale());
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
    const seed = getCurrentSeed();
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
let morphPrepareCallback = null;
let foldOutCallback = null;
let foldInCallback = null;
let foldTransitionState = 'idle'; // 'idle' | 'folding-out' | 'rebuilding' | 'folding-in'
let foldTransitionTarget = null;

/* ── Fold message helpers ── */

function sendFoldOut() {
    if (renderWorker && workerReady) {
        renderWorker.postMessage({ type: 'fold-out' });
    } else if (fallbackRenderer) {
        fallbackRenderer.setFoldImmediate(0);
    }
}

function sendFoldIn() {
    if (renderWorker && workerReady) {
        renderWorker.postMessage({ type: 'fold-in' });
    } else if (fallbackRenderer) {
        fallbackRenderer.setFoldImmediate(1);
    }
}

function sendFoldImmediate(value) {
    if (renderWorker && workerReady) {
        renderWorker.postMessage({ type: 'fold-immediate', value });
    } else if (fallbackRenderer) {
        fallbackRenderer.setFoldImmediate(value);
    }
}

/**
 * Snap all UI controls to a target state (seed, sliders).
 * Used during fold transitions when the canvas is invisible.
 */
function snapUIToState(state) {
    setSeedInUI(state.seed);
    setControlsInUI(state.controls);
    if (state.camera) {
        setCameraInUI(state.camera);
        sendCameraState(state.camera.zoom, state.camera.rotation);
    }
    syncDisplayFields();
}

/**
 * Cancel any active transition (morph or fold).
 */
function cancelActiveTransition() {
    // Cancel morph
    if (morphCtrl.isActive()) {
        morphCtrl.cancel();
        sendMorphCancel();
    }
    morphPrepareCallback = null;

    // Cancel fold transition
    if (foldTransitionState !== 'idle') {
        foldOutCallback = null;
        foldInCallback = null;
        foldTransitionState = 'idle';
        foldTransitionTarget = null;
        sendFoldImmediate(0);
    }

    hideCanvasOverlay();
    if (morphLocked) setMorphLocked(false);
}

/**
 * Profile transition via fold-out → rebuild → fold-in.
 * Replaces morph cross-fade for profile switching.
 */
function startProfileTransition(fromState, toState) {
    if (!animationEnabled) {
        // Animation disabled: instant rebuild, no fold
        snapUIToState(toState);
        sendRenderRequest(toState.seed, toState.controls, {
            deliberate: true,
            callback(meta) {
                lastNodeCount = meta.nodeCount || 0;
                refreshGeneratedText(true);
            },
        });
        setStillRendered(true);
        return;
    }

    cancelPendingRender();
    cancelTextRefresh();
    if (typewriterAbort) { typewriterAbort(); typewriterAbort = null; }

    // Cancel any active transition
    cancelActiveTransition();

    foldTransitionTarget = toState;
    foldTransitionState = 'folding-out';
    setStillRendered(false);
    setMorphLocked(true);

    // Set up fold-out completion callback
    foldOutCallback = () => {
        if (foldTransitionState !== 'folding-out') return; // stale
        foldTransitionState = 'rebuilding';

        // Snap UI while scene is invisible
        snapUIToState(foldTransitionTarget);

        const target = foldTransitionTarget;

        // Rebuild scene (will be built at foldProgress=0, invisible)
        sendRenderRequest(target.seed, target.controls, {
            deliberate: true,
            callback(meta) {
                lastNodeCount = meta.nodeCount || 0;
                // Now fold in the new scene
                foldTransitionState = 'folding-in';
                foldInCallback = () => {
                    foldTransitionState = 'idle';
                    foldTransitionTarget = null;
                    setMorphLocked(false);
                    setStillRendered(true);
                    refreshGeneratedText(true);
                };
                sendFoldIn();
                // Fallback: no worker messages, fire fold-in callback directly
                if (!renderWorker || !workerReady) {
                    const ficb = foldInCallback;
                    foldInCallback = null;
                    if (ficb) ficb();
                }
            },
        });
    };

    // For fallback renderer (no worker messages), fire callback directly
    if (!renderWorker || !workerReady) {
        sendFoldOut(); // sets fold to 0 immediately
        const cb = foldOutCallback;
        foldOutCallback = null;
        if (cb) cb();
        return;
    }

    // Worker path: send fold-out, callback fires on 'fold-out-complete' message
    sendFoldOut();
}

/**
 * Send morph-prepare to the worker (or fallback renderer).
 * Calls onReady once both scenes are built.
 */
function sendMorphPrepare(fromState, toState, onReady) {
    if (renderWorker && workerReady) {
        morphPrepareCallback = onReady;
        renderWorker.postMessage({
            type: 'morph-prepare',
            seedA: fromState.seed,
            controlsA: fromState.controls,
            seedB: toState.seed,
            controlsB: toState.controls,
            width: targetRes ? targetRes.w : (canvas.clientWidth || canvas.getBoundingClientRect().width),
            height: targetRes ? targetRes.h : (canvas.clientHeight || canvas.getBoundingClientRect().height),
        });
    } else if (fallbackRenderer) {
        fallbackRenderer.morphPrepare(fromState.seed, fromState.controls, toState.seed, toState.controls);
        onReady();
    }
}

function sendMorphStart() {
    if (renderWorker && workerReady) {
        renderWorker.postMessage({ type: 'morph-start' });
    } else if (fallbackRenderer) {
        // Fallback: direct morph on main thread (no bitmap pre-rendering)
        fallbackRenderer.morphUpdate(1.0);
        fallbackRenderer.morphEnd();
        const seed = getCurrentSeed();
        const controls = readControlsFromUI();
        sendRenderRequest(seed, controls);
    }
}

function sendMorphCancel() {
    if (renderWorker && workerReady) {
        renderWorker.postMessage({ type: 'morph-cancel' });
    } else if (fallbackRenderer) {
        fallbackRenderer.morphEnd();
    }
}

// Image editor: morph controller is a no-op stub (no morph transitions)
const morphCtrl = {
    isActive() { return false; },
    cancel() { return null; },
    start() {},
};

function startMorph(fromState, toState) {
    if (!animationEnabled) {
        // Instant render, no animation
        const seed = getCurrentSeed();
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
    setStillRendered(false);
    setMorphLocked(true);
    showCanvasOverlay('');

    // Build both scenes in worker, then start the animation
    sendMorphPrepare(fromState, toState, () => {
        hideCanvasOverlay();
        sendMorphStart();
        morphCtrl.start(fromState, toState, 1000);
    });
}

/* ---------------------------
 * Controls reading/writing
 * ---------------------------
 */
function readControlsFromUI() {
    return {
        topology: 'flow-field',
        density: parseFloat(el.density.value),
        luminosity: parseFloat(el.luminosity.value),
        fracture: parseFloat(el.fracture.value),
        coherence: parseFloat(el.coherence.value),
        hue: parseFloat(el.hue.value),
        spectrum: parseFloat(el.spectrum.value),
        chroma: parseFloat(el.chroma.value),
        scale: parseFloat(el.scale.value),
        division: parseFloat(el.division.value),
        faceting: parseFloat(el.faceting.value),
        flow: parseFloat(el.flow.value),
    };
}

function updateSliderLabels(controls) {
    for (const key of SLIDER_KEYS) {
        const label = el[key + 'Label'];
        if (label && controls[key] !== undefined) {
            label.textContent = controls[key].toFixed(2);
        }
    }
}

function setControlsInUI(controls) {
    setTopologyUI(controls.topology || 'flow-field');
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
initToastClose();

function syncDisplayFields() {
    el.displayName.textContent = el.profileNameField.value.trim();
    el.displayIntent.textContent = seedTagToLabel(getCurrentSeed(), getLocale());
}

function loadProfileDataIntoUI(name, p) {
    if (!name || !p) return;
    el.profileNameField.value = name;
    autoGrow(el.profileNameField);
    setSeedInUI(p.seed || name);
    if (p.controls) {
        setControlsInUI(p.controls);
    }
    setCameraInUI(p.camera);
    sendCameraState(
        (p.camera?.zoom ?? 1.0),
        (p.camera?.rotation ?? 0)
    );
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
    const seed = getCurrentSeed();
    const controls = readControlsFromUI();
    const titleRng = mulberry32(xmur3(seed + ':title')());
    const title = generateTitle(controls, titleRng);
    const altText = generateAltText(controls, lastNodeCount, title);
    if (animate && animationEnabled) {
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

function instantReveal(titleText, altText) {
    if (typewriterAbort) { typewriterAbort(); typewriterAbort = null; }
    stopTextHeightSync();
    hideCanvasOverlay();
    el.titleText.textContent = titleText;
    el.altText.textContent = altText;
    syncTextWrapHeight();
}

function renderAndUpdate(seed, controls, { animate = false } = {}) {
    cancelPendingRender();
    cancelTextRefresh();
    const doAnimate = animate && animationEnabled;
    if (doAnimate) {
        el.canvasOverlay.classList.remove('hidden');
        el.canvasOverlayText.textContent = '';
    }
    sendRenderRequest(seed, controls, {
        deliberate: true,
        callback(meta) {
            lastNodeCount = meta.nodeCount || 0;
            if (doAnimate) {
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
    const seed = getCurrentSeed();
    const controls = readControlsFromUI();
    updateSliderLabels(controls);
    sendRenderRequest(seed, controls);
}

function onControlChange() {
    if (!initComplete) return;

    // Cancel any active fold transition and snap to fully unfolded
    if (foldTransitionState !== 'idle') {
        cancelActiveTransition();
        sendFoldImmediate(1);
    }

    // Cancel any active morph
    if (morphCtrl.isActive()) {
        morphCtrl.cancel();
        sendMorphCancel();
        hideCanvasOverlay();
    } else if (morphPrepareCallback) {
        sendMorphCancel();
        hideCanvasOverlay();
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
el.seedTagArr.addEventListener('change', onControlChange);
el.seedTagStr.addEventListener('change', onControlChange);
el.seedTagDet.addEventListener('change', onControlChange);
el.zoom.addEventListener('input', onCameraChange);
el.rotation.addEventListener('input', onCameraChange);
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
        if (!name) { toast(t('toast.enterName')); return; }
        const nameCheck = validateProfileName(name);
        if (!nameCheck.valid) { toast(nameCheck.reason); return; }

        const profiles = loadProfiles();
        const portraitNames = getPortraitNames();
        const portraits = loadPortraits();
        const controls = readControlsFromUI();
        const currentSeed = getCurrentSeed();

        // Check if identical to an existing portrait
        const matchingPortrait = portraits[name];
        if (matchingPortrait &&
            JSON.stringify(matchingPortrait.seed) === JSON.stringify(currentSeed) &&
            JSON.stringify(matchingPortrait.controls) === JSON.stringify(controls)) {
            toast(t('toast.alreadyPortrait'));
            return;
        }

        // Overwrite confirmation (async modal instead of native confirm)
        if (profiles[name] && name !== loadedProfileName) {
            const label = (loadedFromPortrait || portraitNames.includes(name))
                ? t('confirm.overwriteUser', { name })
                : t('confirm.overwriteGeneric', { name });
            const result = await showConfirm(t('confirm.overwriteProfile'), label, [
                { label: t('btn.cancel'), value: 'cancel' },
                { label: t('btn.overwrite'), value: 'overwrite', primary: true },
            ]);
            if (result !== 'overwrite') return;
        }

        const profileData = {
            seed: currentSeed,
            controls,
            camera: readCameraFromUI(),
        };
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
        t('confirm.resetChanges'),
        t('confirm.discardChanges', { name: currentName }),
        [
            { label: t('btn.cancel'), value: 'cancel' },
            { label: t('btn.reset'), value: 'reset', primary: true },
        ]
    );
    if (result !== 'reset') return;

    restoreSnapshot(baselineSnapshot);
    setUserEdited(false);
}

el.resetProfile.addEventListener('click', async () => { await resetCurrentProfile(); });

/* ---------------------------
 * Randomization history
 * ---------------------------
 */
const HISTORY_MAX = 25;
let navHistory = [];
let historyIndex = -1;

function captureSnapshot() {
    return {
        seed: getCurrentSeed(),
        name: el.profileNameField.value.trim(),
        controls: readControlsFromUI(),
        camera: readCameraFromUI(),
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
        seed: getCurrentSeed(),
        controls: readControlsFromUI(),
    };

    setSeedInUI(snap.seed);
    el.profileNameField.value = snap.name;
    autoGrow(el.profileNameField);
    setControlsInUI(snap.controls);
    updateSliderLabels(snap.controls);
    if (snap.camera) {
        setCameraInUI(snap.camera);
        sendCameraState(snap.camera.zoom, snap.camera.rotation);
    }
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
        seed: getCurrentSeed(),
        controls: readControlsFromUI(),
    };
    startProfileTransition(fromState, toState);
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
        || JSON.stringify(current.controls) !== JSON.stringify(stored.controls);
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
        if (JSON.stringify(cur.seed) === JSON.stringify(snap.seed)
            && cur.profileName === snap.profileName
            && cur.isPortrait === snap.isPortrait
            && JSON.stringify(cur.controls) === JSON.stringify(snap.controls)) {
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
    // Generate random seed tag
    const seedTag = [
        Math.floor(Math.random() * TAG_LIST_LENGTH),
        Math.floor(Math.random() * TAG_LIST_LENGTH),
        Math.floor(Math.random() * TAG_LIST_LENGTH),
    ];
    setSeedInUI(seedTag);

    // Reset camera to defaults
    setCameraInUI(CAMERA_DEFAULTS);
    sendCameraState(CAMERA_DEFAULTS.zoom, CAMERA_DEFAULTS.rotation);

    // Topology hidden — always flow-field
    setTopologyUI('flow-field');
    for (const id of SLIDER_KEYS) {
        el[id].value = Math.random().toFixed(2);
    }

    const seed = getCurrentSeed();
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
                t('confirm.unsavedChanges'),
                t('confirm.saveBeforeSwitch', { name: loadedProfileName }),
                [
                    { label: t('btn.cancel'), value: 'cancel' },
                    { label: t('btn.discard'), value: 'discard' },
                    { label: t('btn.save'), value: 'save', primary: true },
                ]
            );
        } else {
            const draftName = el.profileNameField.value.trim();
            if (draftName) {
                result = await showConfirm(
                    t('confirm.unsavedChanges'),
                    t('confirm.saveAsNew', { name: draftName }),
                    [
                        { label: t('btn.cancel'), value: 'cancel' },
                        { label: t('btn.discard'), value: 'discard' },
                        { label: t('btn.save'), value: 'save', primary: true },
                    ]
                );
            } else {
                result = await showConfirm(
                    t('confirm.unsavedChanges'),
                    t('confirm.discardAndRandomize'),
                    [
                        { label: t('btn.cancel'), value: 'cancel' },
                        { label: t('btn.discard'), value: 'discard', primary: true },
                    ]
                );
            }
        }
        if (result === 'cancel') return;
        if (result === 'save') await saveCurrentProfile();
    }

    // Capture current visual state before randomizing
    const fromState = {
        seed: getCurrentSeed(),
        controls: readControlsFromUI(),
    };

    captureCurrentBeforeNavigating();

    randomizeUI();
    refreshProfileGallery();
    pushToHistory();

    // Capture target state and morph
    const toState = {
        seed: getCurrentSeed(),
        controls: readControlsFromUI(),
    };
    startProfileTransition(fromState, toState);
}

/* ---------------------------
 * Profile gallery
 * ---------------------------
 */

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
    const seed = getCurrentSeed();
    el.activePreviewName.textContent = name;
    el.activePreviewSeed.textContent = seedTagToLabel(seed, getLocale());

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
    queueThumbnail(seed || 'seed', controls, el.activePreviewThumb);
}

async function selectCard(cardEl) {
    if (morphLocked) return; // prevent interactions during morph
    const profileName = cardEl.dataset.profileName;
    const isPortrait = cardEl.classList.contains('portrait-card');
    if (dirty && userEdited) {
        // User made config changes — offer to save
        const currentName = el.profileNameField.value.trim() || 'Untitled';
        const result = await showConfirm(
            t('confirm.unsavedChanges'),
            t('confirm.saveBeforeSwitch', { name: currentName }),
            [
                { label: t('btn.cancel'), value: 'cancel' },
                { label: t('btn.discard'), value: 'discard' },
                { label: t('btn.save'), value: 'save', primary: true },
            ]
        );
        if (result === 'cancel') return;
        if (result === 'save') await saveCurrentProfile();
    }

    // Capture current visual state BEFORE loading target
    const fromState = {
        seed: getCurrentSeed(),
        controls: readControlsFromUI(),
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
        seed: getCurrentSeed(),
        controls: readControlsFromUI(),
    };

    // Morph from current to target
    startProfileTransition(fromState, toState);
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
    if (isPortrait) {
        // Use pre-generated static thumbnail; fall back to live render if missing
        thumbImg.src = `/thumbs/${slugify(name)}.png`;
        thumbImg.onerror = () => {
            if (p.seed && p.controls) queueThumbnail(p.seed, p.controls, thumbImg);
        };
        thumbWrap.classList.remove('thumb-loading');
    } else if (p.seed && p.controls) {
        queueThumbnail(p.seed, p.controls, thumbImg);
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
        seedEl.textContent = Array.isArray(p.seed) ? seedTagToLabel(p.seed) : p.seed;
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
        upBtn.title = t('gallery.moveUp');
        upBtn.innerHTML = ARROW_UP_SVG;
        upBtn.disabled = index === 0 || total <= 1;
        upBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            moveProfile(card.dataset.profileName, -1);
        });

        const downBtn = document.createElement('button');
        downBtn.className = 'profile-card-move';
        downBtn.title = t('gallery.moveDown');
        downBtn.innerHTML = ARROW_DOWN_SVG;
        downBtn.disabled = index === total - 1 || total <= 1;
        downBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            moveProfile(card.dataset.profileName, 1);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'profile-card-delete';
        deleteBtn.title = t('gallery.deleteProfile');
        deleteBtn.innerHTML = TRASH_SVG;
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const realName = card.dataset.profileName;
            if (realName) {
                // Remove cached thumbnail (read profile data before deleting)
                const profiles = loadProfiles();
                const pd = profiles[realName];
                if (pd && pd.seed && pd.controls) {
                    const cacheKey = thumbCacheKey(pd.seed, pd.controls);
                    thumbCache.delete(cacheKey);
                    deleteThumb(cacheKey);
                }
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
        d.textContent = t('gallery.noSavedProfiles');
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
    if (!stillRendered) { toast(t('toast.renderFirst')); return; }

    try {
        const seed = getCurrentSeed();
        const controls = readControlsFromUI();
        const name = el.profileNameField.value.trim() || 'Untitled';

        const camera = readCameraFromUI();
        const config = profileToConfig(name, { seed, controls, camera });
        const json = JSON.stringify(config, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const ts = toIsoLocalish();
        downloadBlob(`geometric-interior_${safeName(seed)}_${ts}.json`, blob);
        toast(t('toast.configExported'));
    } catch (err) {
        console.error(err);
        toast(t('toast.exportFailed'));
    }
});

/* ---------------------------
 * Share
 * ---------------------------
 */

// Build share URL from current state
function buildShareURL() {
    return encodeStateToURL(window.location.origin, {
        seed: getCurrentSeed(),
        controls: readControlsFromUI(),
        camera: readCameraFromUI(),
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
let animationEnabled;

if (animElements) {
    animationEnabled = localStorage.getItem('geo-anim-enabled') !== 'false'; // default true
    el.animToggle.setAttribute('aria-checked', String(animationEnabled));

    el.animToggle.addEventListener('click', () => {
        animationEnabled = !animationEnabled;
        el.animToggle.setAttribute('aria-checked', String(animationEnabled));
        localStorage.setItem('geo-anim-enabled', String(animationEnabled));
        syncAnimConfigVisibility();
        if (renderWorker && workerReady) {
            renderWorker.postMessage({ type: 'set-animation', enabled: animationEnabled });
        }
    });
    el.animToggle.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            el.animToggle.click();
        }
    });

    /* ── Animation config sliders ── */
    const savedAnimConfig = JSON.parse(localStorage.getItem('geo-anim-config') || '{}');
    animCfg = { sparkle: savedAnimConfig.sparkle ?? 1, drift: savedAnimConfig.drift ?? 1, wobble: savedAnimConfig.wobble ?? 1 };

    el.animSparkle.value = animCfg.sparkle;
    el.animSparkleVal.textContent = animCfg.sparkle.toFixed(2);
    el.animDrift.value = animCfg.drift;
    el.animDriftVal.textContent = animCfg.drift.toFixed(2);
    el.animWobble.value = animCfg.wobble;
    el.animWobbleVal.textContent = animCfg.wobble.toFixed(2);

    const syncAnimConfigVisibility = () => {
        el.animConfigSection.classList.toggle('hidden', !animationEnabled);
    };
    syncAnimConfigVisibility();

    const sendAnimConfig = () => {
        localStorage.setItem('geo-anim-config', JSON.stringify(animCfg));
        if (renderWorker && workerReady) {
            renderWorker.postMessage({ type: 'set-anim-config', ...animCfg });
        }
    };

    el.animSparkle.addEventListener('input', () => {
        animCfg.sparkle = parseFloat(el.animSparkle.value);
        el.animSparkleVal.textContent = animCfg.sparkle.toFixed(2);
        sendAnimConfig();
    });
    el.animDrift.addEventListener('input', () => {
        animCfg.drift = parseFloat(el.animDrift.value);
        el.animDriftVal.textContent = animCfg.drift.toFixed(2);
        sendAnimConfig();
    });
    el.animWobble.addEventListener('input', () => {
        animCfg.wobble = parseFloat(el.animWobble.value);
        el.animWobbleVal.textContent = animCfg.wobble.toFixed(2);
        sendAnimConfig();
    });
} else {
    animationEnabled = false;
}

/* ── Tab visibility → pause/resume render loop ── */
document.addEventListener('visibilitychange', () => {
    if (renderWorker && workerReady) {
        renderWorker.postMessage({ type: 'visibility', visible: !document.hidden });
    }
});

// Copy Link
document.getElementById('shareCopyLink').addEventListener('click', async () => {
    const shareURL = buildShareURL();
    try {
        await navigator.clipboard.writeText(shareURL);
        toast(t('toast.linkCopied'));
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
        toast(t('toast.linkCopiedShort'));
    }
    el.sharePopover.classList.add('hidden');
});

// Download Visual (full ZIP with image, metadata, title, alt-text)
document.getElementById('shareDownloadPng').addEventListener('click', async () => {
    if (!stillRendered) { toast(t('toast.renderFirst')); return; }
    if (!window.JSZip) { toast(t('toast.jszipMissing')); return; }
    el.sharePopover.classList.add('hidden');

    const seed = getCurrentSeed();
    const controls = readControlsFromUI();
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
                seed, controls, name, meta,
                canvasWidth: Math.round(rect.width * window.devicePixelRatio),
                canvasHeight: Math.round(rect.height * window.devicePixelRatio),
            });
        } else {
            await packageStillZip(canvas, { seed, controls, name, meta });
        }
        toast(t('toast.visualExported'));
    } catch (err) {
        console.error(err);
        toast(t('toast.visualExportFailed'));
    }
});

// Share on X/Twitter
document.getElementById('shareTwitter').addEventListener('click', () => {
    const shareURL = buildShareURL();
    const seed = getCurrentSeed();
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
    const seed = getCurrentSeed();
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
    const seed = getCurrentSeed();
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
    const seed = getCurrentSeed();
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
    renderAndUpdate(getCurrentSeed(), readControlsFromUI(), { animate: true });
    setStillRendered(true);

    closeImportModal();
    toast(t('toast.imported', { count: items.length, s: items.length > 1 ? 's' : '' }));
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

/* Statement modal — see src/shared/statement.js */
const { loadContent: loadStatementContent, closeStatementModal } = initStatementModal({
    statementModal: el.statementModal,
    statementModalClose: el.statementModalClose,
    statementTabSelect: el.statementTabSelect,
    statementTitle: el.statementTitle,
    developerBody: el.developerBody,
    artistBody: el.artistBody,
    governanceBody: el.governanceBody,
    developerStatement: el.developerStatement,
    artistStatement: el.artistStatement,
    governanceStatement: el.governanceStatement,
});

/* Modals (confirm + info) — see src/shared/modals.js */
initModals({
    infoModal: el.infoModal,
    infoModalTitle: el.infoModalTitle,
    infoModalBody: el.infoModalBody,
    infoModalClose: el.infoModalClose,
    escapeHandlers: [
        () => { if (!el.infoModal.classList.contains('hidden')) { closeInfoModal(); return true; } },
        () => { if (!el.statementModal.classList.contains('hidden')) { closeStatementModal(); return true; } },
        () => { if (isPanelOpen()) { closePanel(); return true; } },
    ],
});

initTooltips();

initCollapsibles();

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

/* Panel toggle — see src/shared/panel.js */

/* ---------------------------
 * Init
 * ---------------------------
 */
initPanel();
initTopologySelector();
initSeedTagSelects();
updateCameraLabels(CAMERA_DEFAULTS);
initLocale();
initPageSettings(
    document.getElementById('pageSettingsBtn'),
    document.getElementById('pageSettingsPopover'),
);
createFaviconAnimation().start();
loadStatementContent();
ensureStarterProfiles();

// Move configControls into the Active card (starts collapsed)
const configControls = document.getElementById('configControls');
el.activeCard.appendChild(configControls);
configControls.style.display = '';
configControls.classList.add('collapsed');

// Check for shared state in URL, otherwise randomize
const sharedState = decodeStateFromURL(window.location.href);
if (sharedState) {
    setSeedInUI(sharedState.seed);
    if (sharedState.name) {
        el.profileNameField.value = sharedState.name;
        autoGrow(el.profileNameField);
    }
    setControlsInUI(sharedState.controls);
    if (sharedState.camera) {
        setCameraInUI(sharedState.camera);
    }
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
thumbCacheReady.then(() => refreshProfileGallery());

// Seed history with initial state
navHistory.push(captureSnapshot());
historyIndex = 0;
updateHistoryButtons();

showCanvasOverlay('');

function doInitialRender() {
    const seed = getCurrentSeed();
    const controls = readControlsFromUI();
    const camera = readCameraFromUI();
    sendCameraState(camera.zoom, camera.rotation);

    // When animation is on, build scene collapsed and fold in
    if (animationEnabled) {
        sendFoldImmediate(0);
    }

    sendRenderRequest(seed, controls, {
        deliberate: true,
        callback(meta) {
            lastNodeCount = meta.nodeCount || 0;
            if (animationEnabled) {
                playRevealAnimation(meta.title, meta.altText);
                sendFoldIn();
            } else {
                instantReveal(meta.title, meta.altText);
            }
            syncDisplayFields();
            // Main image + text are up — start rendering queued thumbnails
            thumbDrainDeferred = false;
            drainThumbQueue();
        },
    });
    setStillRendered(true);
    thumbCacheReady.then(() => refreshProfileGallery());
    initComplete = true;
}

if (!renderWorker) {
    // Fallback: render on main thread
    requestAnimationFrame(doInitialRender);
}
// Worker path: doInitialRender is called from onWorkerMessage when 'ready' arrives

/* ── Locale change: re-render to regenerate title/alt text ── */
document.addEventListener('localechange', () => {
    document.title = t(pageTitle);
    // Re-populate seed tag selects with new locale words (preserves selection)
    const currentSeed = getCurrentSeed();
    initSeedTagSelects();
    setSeedInUI(currentSeed);
    syncDisplayFields();
    scheduleRender();
});

// Vite HMR: clean up worker so the next module instance starts fresh
if (import.meta.hot) {
    import.meta.hot.accept();
    import.meta.hot.dispose(() => {
        if (workerInitTimer) clearTimeout(workerInitTimer);
        if (renderWorker) { renderWorker.terminate(); renderWorker = null; }
        if (fallbackRenderer) { fallbackRenderer.dispose(); fallbackRenderer = null; }
    });
}

} // end initEditor
