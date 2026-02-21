/**
 * Entry point — wires all modules to the DOM.
 * Phase 1: Three.js WebGL renderer with new control scheme.
 */

import { createRenderer } from './engine/create-renderer.js';
import { PALETTE_KEYS, updatePalette, resetPalette, getPaletteDefaults } from './core/palettes.js';
import { loadProfiles, saveProfiles, deleteProfile, ensureStarterProfiles } from './ui/profiles.js';
import { packageStillZip } from './export/export.js';
import { initTheme } from './ui/theme.js';
import { createLoadingAnimation } from './ui/loading-animation.js';
import { createFaviconAnimation } from './ui/animated-favicon.js';

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

    profileName: document.getElementById('profileName'),
    saveProfile: document.getElementById('saveProfile'),
    randomize: document.getElementById('randomize'),
    profileGallery: document.getElementById('profileGallery'),

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
    imageProfileSelect: document.getElementById('imageProfileSelect'),

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
const thumbOffscreen = document.createElement('canvas');
thumbOffscreen.width = 280;
thumbOffscreen.height = 180;
const thumbRenderer = createRenderer(thumbOffscreen);

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
                thumbRenderer.renderWith(item.seed, item.controls);
                const url = thumbOffscreen.toDataURL('image/png');
                thumbCache.set(item.key, url);
                item.destImg.src = url;
            }
        } catch (err) {
            console.error('[thumb] render error:', err);
        }
        thumbProcessing = false;
        drainThumbQueue();
    }, 50);
}

/* ---------------------------
 * Custom select wrapper (for profile dropdowns)
 * ---------------------------
 */
function wrapSelect(selectEl, { getProfile }) {
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-select-trigger';

    const dropdown = document.createElement('div');
    dropdown.className = 'custom-select-dropdown';

    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.appendChild(selectEl);
    wrapper.appendChild(trigger);
    wrapper.appendChild(dropdown);

    let focusedIdx = -1;

    function isOpen() { return wrapper.classList.contains('open'); }
    function open() {
        wrapper.classList.add('open');
        focusedIdx = -1;
        const sel = dropdown.querySelector('.selected');
        if (sel) sel.scrollIntoView({ block: 'nearest' });
    }
    function close() { wrapper.classList.remove('open'); clearFocus(); }
    function toggle() { isOpen() ? close() : open(); }

    function clearFocus() {
        focusedIdx = -1;
        dropdown.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
    }
    function focusOption(idx) {
        const opts = dropdown.querySelectorAll('.custom-select-option');
        if (opts.length === 0) return;
        clearFocus();
        focusedIdx = Math.max(0, Math.min(idx, opts.length - 1));
        opts[focusedIdx].classList.add('focused');
        opts[focusedIdx].scrollIntoView({ block: 'nearest' });
    }
    function selectValue(value) {
        if (selectEl.value !== value) {
            selectEl.value = value;
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        updateTrigger();
        close();
    }

    function updateTrigger() {
        const value = selectEl.value;
        const opt = selectEl.options[selectEl.selectedIndex];
        const text = opt ? opt.textContent : '';
        const isPlaceholder = !value;
        const profile = value ? getProfile(value) : null;

        trigger.innerHTML = '';

        if (profile?.seed && profile?.controls) {
            const img = document.createElement('img');
            img.className = 'cs-thumb';
            queueThumbnail(profile.seed, profile.controls, img, profile.paletteTweaks);
            trigger.appendChild(img);
        }

        const label = document.createElement('span');
        label.className = isPlaceholder ? 'cs-label cs-placeholder' : 'cs-label';
        label.textContent = text || 'Select\u2026';
        trigger.appendChild(label);

        const arrow = document.createElement('span');
        arrow.className = 'cs-arrow';
        arrow.textContent = '\u25be';
        trigger.appendChild(arrow);
    }

    function refresh() {
        dropdown.innerHTML = '';
        const currentValue = selectEl.value;

        for (const opt of selectEl.options) {
            const div = document.createElement('div');
            div.className = 'custom-select-option';
            if (opt.value === currentValue) div.classList.add('selected');

            if (!opt.value) {
                div.classList.add('cs-placeholder');
            } else {
                const profile = getProfile(opt.value);
                if (profile?.seed && profile?.controls) {
                    const img = document.createElement('img');
                    img.className = 'cs-thumb';
                    queueThumbnail(profile.seed, profile.controls, img, profile.paletteTweaks);
                    div.appendChild(img);
                }
            }

            const label = document.createElement('span');
            label.className = 'cs-opt-label';
            label.textContent = opt.textContent;
            div.appendChild(label);

            div.addEventListener('click', () => selectValue(opt.value));
            dropdown.appendChild(div);
        }
        updateTrigger();
    }

    trigger.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { close(); return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!isOpen()) open();
            const opts = dropdown.querySelectorAll('.custom-select-option');
            if (opts.length === 0) return;
            if (e.key === 'ArrowDown') focusOption(focusedIdx + 1);
            else focusOption(focusedIdx - 1);
        }
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isOpen()) { open(); return; }
            const opts = dropdown.querySelectorAll('.custom-select-option');
            if (focusedIdx >= 0 && focusedIdx < opts.length) opts[focusedIdx].click();
        }
    });
    document.addEventListener('click', (e) => { if (isOpen() && !wrapper.contains(e.target)) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });

    refresh();
    return { refresh };
}

const imageSelectUI = wrapSelect(el.imageProfileSelect, {
    getProfile: name => loadProfiles()[name],
});

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
    const h1 = ((h - hr / 2) + 360) % 360;
    const h3 = (h + hr / 2) % 360;
    g.style.background =
        `linear-gradient(135deg, hsl(${h1} 50% 15%), hsl(${h} 60% 45%), hsl(${h3} 60% 70%))`;
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
                el.customPaletteEditor.classList.toggle('collapsed');
            } else {
                el.customPaletteEditor.classList.remove('collapsed');
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

function refreshImageProfileSelect() {
    const profiles = loadProfiles();
    const names = Object.keys(profiles).sort((a, b) => a.localeCompare(b));
    const prev = el.imageProfileSelect.value;
    el.imageProfileSelect.innerHTML = '';
    for (const name of names) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        el.imageProfileSelect.appendChild(opt);
    }
    if (names.includes(prev)) el.imageProfileSelect.value = prev;
    imageSelectUI.refresh();
}

function loadProfileIntoUI(name) {
    if (!name) return;
    const profiles = loadProfiles();
    const p = profiles[name];
    if (!p) return;
    // Intent field serves as both name and seed
    el.profileName.value = p.seed || name;
    autoGrow(el.profileName);
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
}

function setStillRendered(value) {
    stillRendered = value;
    el.exportBtn.disabled = !value;
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

    const cancelTitle = typewriterEffect(el.titleText, titleText, 30, () => {
        hideCanvasOverlay();
        const wrapper = document.querySelector('.canvas-wrapper');
        const wipe = document.createElement('div');
        wipe.className = 'reveal-wipe';
        wrapper.appendChild(wipe);
        wipe.addEventListener('animationend', () => wipe.remove());

        const cancelAlt = typewriterEffect(el.altText, altText, 8, () => {
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
}

/* ---------------------------
 * Slider + control event listeners
 * ---------------------------
 */
for (const id of SLIDER_KEYS) {
    el[id].addEventListener('input', onControlChange);
}
el.seed.addEventListener('change', onControlChange);

el.imageProfileSelect.addEventListener('change', () => {
    const name = el.imageProfileSelect.value;
    if (!name) return;
    loadProfileIntoUI(name);
    const seed = el.seed.value.trim() || 'seed';
    const controls = readControlsFromUI();
    renderAndUpdate(seed, controls, { animate: true });
    setStillRendered(true);
    updateActiveProfileIndicator();
});

el.saveProfile.addEventListener('click', () => {
    const defaultName = el.titleText.textContent.trim() || el.profileName.value.trim() || 'Untitled';
    const name = prompt('Profile name:', defaultName);
    if (!name || !name.trim()) return;

    const profiles = loadProfiles();
    const controls = readControlsFromUI();
    const profileData = {
        seed: el.seed.value.trim() || 'seed',
        controls,
    };
    profileData.paletteTweaks = readPaletteFromUI();
    if (controls.palette === 'custom') {
        profileData.customPalette = profileData.paletteTweaks;
    }
    profiles[name.trim()] = profileData;
    saveProfiles(profiles);

    refreshImageProfileSelect();
    refreshProfileGallery();
    loadedProfileName = name.trim();
    updateActiveProfileIndicator();
    toast(`Saved profile: ${name.trim()}`);
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
    el.profileName.value = generateIntent();
    autoGrow(el.profileName);

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
    renderAndUpdate(seed, controls, { animate: true });
    setStillRendered(true);
    toast('Randomized.');
});

/* ---------------------------
 * Profile gallery
 * ---------------------------
 */
const TRASH_SVG = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0v-6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>';

function refreshProfileGallery() {
    const profiles = loadProfiles();
    const names = Object.keys(profiles).sort((a, b) => a.localeCompare(b));
    el.profileGallery.innerHTML = '';

    if (names.length === 0) {
        const d = document.createElement('div');
        d.className = 'small';
        d.textContent = 'No saved profiles yet.';
        el.profileGallery.appendChild(d);
        return;
    }

    for (const name of names) {
        const p = profiles[name];
        const card = document.createElement('div');
        card.className = 'profile-card';
        card.dataset.profileName = name;

        if (name === loadedProfileName) {
            card.classList.add('active-profile');
        }

        card.addEventListener('click', () => card.classList.toggle('expanded'));

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

        const actions = document.createElement('div');
        actions.className = 'profile-card-actions';

        const actionBtn = document.createElement('button');
        actionBtn.textContent = 'Load';
        actionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            loadProfileIntoUI(name);
            el.imageProfileSelect.value = name;
            imageSelectUI.refresh();
            const seed = el.seed.value.trim() || 'seed';
            const controls = readControlsFromUI();
            renderAndUpdate(seed, controls, { animate: true });
            setStillRendered(true);
            updateActiveProfileIndicator();
            toast(`Loaded: ${name}`);
        });

        actions.appendChild(actionBtn);
        body.appendChild(actions);
        card.appendChild(body);

        const details = document.createElement('div');
        details.className = 'profile-card-details';

        const dl = document.createElement('dl');
        const addRow = (label, value) => {
            const dt = document.createElement('dt');
            dt.textContent = label;
            const dd = document.createElement('dd');
            dd.textContent = value;
            dl.appendChild(dt);
            dl.appendChild(dd);
        };

        addRow('Intent', p.seed || '\u2014');
        if (p.controls) {
            const c = p.controls;
            addRow('Topology', c.topology || '\u2014');
            addRow('Palette', c.palette || '\u2014');
            const pt = p.paletteTweaks || (c.palette === 'custom' ? p.customPalette : null);
            if (pt) {
                addRow('  Hue', String(pt.baseHue));
                addRow('  Range', String(pt.hueRange));
                addRow('  Saturation', pt.saturation.toFixed(2));
                addRow('  Lightness', pt.lightness.toFixed(2));
            }
            addRow('Density', c.density.toFixed(2));
            addRow('Luminosity', c.luminosity.toFixed(2));
            addRow('Fracture', c.fracture.toFixed(2));
            addRow('Depth', c.depth.toFixed(2));
            addRow('Coherence', c.coherence.toFixed(2));
        }
        details.appendChild(dl);
        card.appendChild(details);

        const chevron = document.createElement('span');
        chevron.className = 'profile-card-chevron';
        chevron.textContent = '\u25be';
        card.appendChild(chevron);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'profile-card-delete';
        deleteBtn.title = 'Delete';
        deleteBtn.innerHTML = TRASH_SVG;
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteProfile(name);
            refreshImageProfileSelect();
            refreshProfileGallery();
            toast(`Deleted: ${name}`);
        });
        card.appendChild(deleteBtn);

        el.profileGallery.appendChild(card);
    }
}

function updateActiveProfileIndicator() {
    const cards = el.profileGallery.querySelectorAll('.profile-card');
    cards.forEach(card => {
        const isActive = card.dataset.profileName === loadedProfileName;
        card.classList.toggle('active-profile', isActive);
    });
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
    document.querySelectorAll('.collapsible-toggle').forEach(btn => {
        const content = document.getElementById(btn.dataset.target);
        content.classList.add('no-transition');
        btn.setAttribute('aria-expanded', 'true');
        content.classList.remove('collapsed');
        content.offsetHeight;
        content.classList.remove('no-transition');
    });
}

/* ---------------------------
 * Init
 * ---------------------------
 */
initTopologySelector();
initPaletteSelector();
restorePaletteTweaksFromStorage();
initTheme(document.getElementById('themeSwitcher'));
createFaviconAnimation().start();
statementContentReady = loadStatementContent();
ensureStarterProfiles();
refreshImageProfileSelect();

loadProfileIntoUI(el.imageProfileSelect.value);
updateSliderLabels(readControlsFromUI());

showCanvasOverlay('', true);

requestAnimationFrame(() => {
    refreshProfileGallery();

    setTimeout(() => {
        const seed = el.seed.value.trim() || 'seed';
        const controls = readControlsFromUI();
        renderAndUpdate(seed, controls, { animate: true });
        setStillRendered(true);
    }, 600);
});
