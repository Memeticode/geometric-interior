/**
 * Entry point — wires all modules to the DOM.
 * Phase 1: Three.js WebGL renderer with new control scheme.
 */

import { createRenderer } from './engine/create-renderer.js';
import { PALETTE_KEYS, updatePalette, resetPalette, getPaletteDefaults, getPalette } from './core/palettes.js';
import { loadProfiles, saveProfiles, deleteProfile, ensureStarterProfiles } from './ui/profiles.js';
import { packageStillZip } from './export/export.js';
import { initTheme } from './ui/theme.js';
import { createLoadingAnimation } from './ui/loading-animation.js';
import { createFaviconAnimation } from './ui/animated-favicon.js';
import { generateTitle } from './core/text.js';
import { xmur3, mulberry32 } from './core/prng.js';

/* ---------------------------
 * DOM references
 * ---------------------------
 */
const canvas = document.getElementById('c');

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
    randomize: document.getElementById('randomize'),
    profileGallery: document.getElementById('profileGallery'),
    activeProfileDisplay: document.getElementById('activeProfileDisplay'),

    titleText: document.getElementById('titleText'),
    altText: document.getElementById('altText'),
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
const renderer = createRenderer(canvas);

const loadingAnim = createLoadingAnimation(document.querySelector('.canvas-overlay-inner'));

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
 * Controls reading/writing
 * ---------------------------
 */
function readControlsFromUI() {
    return {
        topology: el.topology.value,
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
    setDirty(false);
}

function setStillRendered(value) {
    stillRendered = value;
    el.exportBtn.disabled = !value;
}

let dirty = false;
function setDirty(value) {
    dirty = value;
    el.saveProfile.disabled = !value;
}

function clearStillText() {
    if (typewriterAbort) { typewriterAbort(); typewriterAbort = null; }
    el.titleText.textContent = '';
    el.altText.textContent = '';
    hideCanvasOverlay();
}

function showCanvasOverlay(text, showSpinner = false) {
    el.canvasOverlayText.textContent = text;
    el.canvasOverlay.classList.remove('hidden');
    if (showSpinner) loadingAnim.start();
    else loadingAnim.stop();
}

function hideCanvasOverlay() {
    el.canvasOverlay.classList.add('hidden');
    loadingAnim.stop();
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
    el.titleText.textContent = '';
    el.altText.textContent = '';

    // Canvas fades in immediately via 200ms CSS transition
    hideCanvasOverlay();

    // Reveal wipe as visual polish over the fading-in canvas
    const wrapper = document.querySelector('.canvas-wrapper');
    const wipe = document.createElement('div');
    wipe.className = 'reveal-wipe';
    wrapper.appendChild(wipe);
    wipe.addEventListener('animationend', () => wipe.remove());

    // Text types as non-blocking decoration below the canvas
    const cancelTitle = typewriterEffect(el.titleText, titleText, 20, () => {
        const cancelAlt = typewriterEffect(el.altText, altText, 6, () => {
            typewriterAbort = null;
        });
        typewriterAbort = cancelAlt;
    });
    typewriterAbort = cancelTitle;
}

function renderAndUpdate(seed, controls, { animate = false } = {}) {
    if (animate) {
        el.canvasOverlay.classList.remove('hidden');
        loadingAnim.stop();
        el.canvasOverlayText.textContent = '';
    }
    const meta = renderer.renderWith(seed, controls);
    if (animate) {
        playRevealAnimation(meta.title, meta.altText);
    } else {
        el.titleText.textContent = meta.title;
        el.altText.textContent = meta.altText;
    }
    return meta;
}

/* ---------------------------
 * Live render on control change
 * ---------------------------
 */
function renderStillCanvas() {
    const seed = el.seed.value.trim() || 'seed';
    const controls = readControlsFromUI();
    updateSliderLabels(controls);
    renderer.renderWith(seed, controls);
}

function onControlChange() {
    renderStillCanvas();
    clearStillText();
    setStillRendered(false);
    setDirty(true);
}

/* ---------------------------
 * Slider + control event listeners
 * ---------------------------
 */
for (const id of SLIDER_KEYS) {
    el[id].addEventListener('input', onControlChange);
}
el.seed.addEventListener('change', onControlChange);
el.profileNameField.addEventListener('input', () => setDirty(true));

el.saveProfile.addEventListener('click', () => {
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
    toast(`Saved profile: ${name}`);
});

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

el.randomize.addEventListener('click', () => {
    el.seed.value = generateIntent();
    autoGrow(el.seed);

    setTopologyUI(TOPOLOGY_VALUES[Math.floor(Math.random() * TOPOLOGY_VALUES.length)]);
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

    renderAndUpdate(seed, controls, { animate: true });
    setStillRendered(true);
    setDirty(true);
    toast('Randomized.');
});

/* ---------------------------
 * Profile gallery
 * ---------------------------
 */
const TRASH_SVG = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0v-6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>';

function buildProfileCard(name, p, { isActive = false } = {}) {
    const card = document.createElement('div');
    card.className = 'profile-card';
    card.dataset.profileName = name;
    if (isActive) {
        card.classList.add('active-profile');
        card.style.cursor = 'pointer';
        const chevron = document.createElement('span');
        chevron.className = 'profile-card-chevron';
        chevron.innerHTML = '&#9662;';
        card.appendChild(chevron);
        card.addEventListener('click', () => {
            const gallery = document.getElementById('profilesContent');
            if (gallery) gallery.classList.toggle('collapsed');
            card.classList.toggle('expanded');
        });
    } else {
        card.style.cursor = 'pointer';
        card.addEventListener('click', (e) => {
            if (e.target.closest('.profile-card-delete')) return;
            loadProfileIntoUI(name);
            const seed = el.seed.value.trim() || 'seed';
            const controls = readControlsFromUI();
            renderAndUpdate(seed, controls, { animate: true });
            setStillRendered(true);
            refreshProfileGallery();
            const gallery = document.getElementById('profilesContent');
            if (gallery) gallery.classList.add('collapsed');
            toast(`Loaded: ${name}`);
        });
    }

    const thumbImg = document.createElement('img');
    thumbImg.className = 'profile-thumb';
    card.appendChild(thumbImg);
    if (p.seed && p.controls) {
        queueThumbnail(p.seed, p.controls, thumbImg, p.paletteTweaks);
    }

    const body = document.createElement('div');
    body.className = 'profile-card-body';

    const nm = document.createElement('div');
    nm.className = 'profile-card-name';
    nm.textContent = name;
    body.appendChild(nm);

    card.appendChild(body);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'profile-card-delete';
    deleteBtn.title = 'Delete';
    deleteBtn.innerHTML = TRASH_SVG;
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteProfile(name);
        if (name === loadedProfileName) loadedProfileName = null;
        refreshProfileGallery();
        toast(`Deleted: ${name}`);
    });
    card.appendChild(deleteBtn);

    return card;
}

function refreshProfileGallery() {
    const profiles = loadProfiles();
    const names = Object.keys(profiles).sort((a, b) => a.localeCompare(b));

    // Active profile display (above dropdown)
    el.activeProfileDisplay.innerHTML = '';
    if (loadedProfileName && profiles[loadedProfileName]) {
        el.activeProfileDisplay.appendChild(
            buildProfileCard(loadedProfileName, profiles[loadedProfileName], { isActive: true })
        );
    }

    // Dropdown gallery (all other profiles)
    el.profileGallery.innerHTML = '';
    const others = names.filter(n => n !== loadedProfileName);

    if (others.length === 0 && !loadedProfileName) {
        const d = document.createElement('div');
        d.className = 'small';
        d.textContent = 'No saved profiles yet.';
        el.profileGallery.appendChild(d);
        return;
    }

    for (const name of others) {
        el.profileGallery.appendChild(buildProfileCard(name, profiles[name]));
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
    const meta = renderAndUpdate(seed, controls);

    try {
        await packageStillZip(canvas, { seed, controls, meta });
        toast('Exported still ZIP.');
    } catch (err) {
        console.error(err);
        toast('Still export failed.');
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

if (window.innerWidth > 767) {
    document.querySelectorAll('.collapsible-toggle[data-desktop-expand]').forEach(btn => {
        const content = document.getElementById(btn.dataset.target);
        content.classList.add('no-transition');
        btn.setAttribute('aria-expanded', 'true');
        content.classList.remove('collapsed');
        content.offsetHeight;
        content.classList.remove('no-transition');
    });
}

/* ---------------------------
 * Panel toggle
 * ---------------------------
 */
const panelEl = document.querySelector('.panel');
const panelToggleBtn = document.getElementById('panelToggle');

function initPanelToggle() {
    if (!panelToggleBtn || !panelEl) return;

    // Restore saved state (default: expanded on desktop, collapsed on mobile)
    const stored = localStorage.getItem('geo-self-portrait-panel-collapsed');
    const defaultCollapsed = window.innerWidth < 768;
    const collapsed = stored !== null ? stored === 'true' : defaultCollapsed;

    if (collapsed) {
        panelEl.classList.add('no-transition');
        panelEl.classList.add('panel-collapsed');
        panelEl.offsetHeight; // force reflow
        panelEl.classList.remove('no-transition');
    }

    panelToggleBtn.addEventListener('click', () => {
        panelEl.classList.toggle('panel-collapsed');
        const isCollapsed = panelEl.classList.contains('panel-collapsed');
        localStorage.setItem('geo-self-portrait-panel-collapsed', String(isCollapsed));
    });
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

showCanvasOverlay('', true);

requestAnimationFrame(() => {
    const seed = el.seed.value.trim() || 'seed';
    const controls = readControlsFromUI();
    renderAndUpdate(seed, controls, { animate: true });
    setStillRendered(true);
    refreshProfileGallery();
});
