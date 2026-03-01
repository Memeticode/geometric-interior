/**
 * Shared editor entry point — used by both image and animation pages.
 *
 * Differences between modes are parameterized via the config object:
 *   mode: 'image' | 'animation'
 *   pageTitle: i18n key for document.title
 *   animElements: null (image) | { animToggle, animConfigSection, ... } (animation)
 *
 * This file is the orchestrator — it creates module instances and wires them
 * together. Business logic lives in the extracted modules:
 *   render-bridge.js, config-controls.js, thumb-renderer.js,
 *   text-display.js, import-handler.js, share-actions.js, profile-gallery.js
 */

import { createHeader } from '../shared/create-header.js';
import { createFooter } from '../shared/create-footer.js';
import { initApp } from '../shared/app-init.js';
import { TAG_LIST_LENGTH } from '../../lib/core/seed-tags.js';
import { decodeStateFromURL } from '../core/url-state.js';
import { initPageSettings } from '../ui/page-settings.js';
import { generateTitle } from '../../lib/core/text.js';
import { xmur3, mulberry32 } from '../../lib/core/prng.js';
import { loadProfiles, saveProfiles, ensureStarterProfiles, loadPortraits, getPortraitNames, loadProfileOrder, saveProfileOrder } from '../ui/profiles.js';
import { toast } from '../shared/toast.js';
import { autoGrow, initAutoGrowTextareas } from '../shared/dom-utils.js';
import { refreshTooltip } from '../shared/tooltips.js';
import { initCollapsibles } from '../shared/collapsibles.js';
import { initPanel, isPanelOpen, closePanel } from '../shared/panel.js';
import { showConfirm, initModals, closeInfoModal } from '../shared/modals.js';
import { validateProfileName } from '../shared/slugify.js';
import { t, getLocale } from '../i18n/locale.js';

import { createRenderBridge } from './render-bridge.js';
import { createConfigControls } from './config-controls.js';
import { createThumbRenderer } from './thumb-renderer.js';
import { createTextDisplay } from './text-display.js';
import { initImportHandler } from './import-handler.js';
import { initShareActions } from './share-actions.js';
import { createProfileGallery } from './profile-gallery.js';

export function initEditor({ mode, pageTitle, animElements }) {

/* ── Build header & footer DOM ── */
createHeader(document.querySelector('.app-header'), { page: mode });
const _footerRefs = createFooter(document.querySelector('.app-footer'), { page: mode });

/* ── Shared init (creates modal/toast/tooltip DOM) ── */
const { statement: _statement, infoModalRefs: _infoModalRefs } = initApp({ page: mode });

/* ── Canvas (HMR handling) ── */
let canvas = document.getElementById('c');
if (canvas.dataset.transferred) {
    const fresh = document.createElement('canvas');
    fresh.id = canvas.id;
    fresh.width = canvas.width;
    fresh.height = canvas.height;
    canvas.replaceWith(fresh);
    canvas = fresh;
}

/* ── DOM refs ── */
const el = {
    seedTagArr: document.getElementById('seedTagArr'),
    seedTagStr: document.getElementById('seedTagStr'),
    seedTagDet: document.getElementById('seedTagDet'),
    zoom: document.getElementById('zoom'),
    rotation: document.getElementById('rotation'),
    zoomLabel: document.getElementById('zoomLabel'),
    rotationLabel: document.getElementById('rotationLabel'),
    topology: document.getElementById('topology'),
    topologySelector: document.getElementById('topologySelector'),
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
    canvasOverlay: document.getElementById('canvasOverlay'),
    canvasOverlayText: document.getElementById('canvasOverlayText'),
    exportBtn: document.getElementById('exportBtn'),
    shareBtn: document.getElementById('shareBtn'),
    sharePopover: document.getElementById('sharePopover'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsPopover: document.getElementById('settingsPopover'),
    statementModal: document.getElementById('statementModal'),
    ...(animElements || {}),
};

initAutoGrowTextareas();

/* ── State ── */
let stillRendered = false;
let loadedProfileName = '';
let loadedFromPortrait = false;
let dirty = false;
let userEdited = false;
let baselineSnapshot = null;
let morphLocked = false;
let lastNodeCount = 0;
let initComplete = false;
let foldTransitionState = 'idle';
let foldTransitionTarget = null;

/* Animation state */
let animationEnabled;
let animCfg = null;

if (animElements) {
    animationEnabled = localStorage.getItem('geo-anim-enabled') !== 'false';
    const saved = JSON.parse(localStorage.getItem('geo-anim-config') || '{}');
    animCfg = { sparkle: saved.sparkle ?? 1, drift: saved.drift ?? 1, wobble: saved.wobble ?? 1 };
} else {
    animationEnabled = false;
}

/* ── Module instances ── */

const controls = createConfigControls(el);

const bridge = createRenderBridge(canvas, {
    getAnimationState: () => ({ enabled: animationEnabled, config: animCfg }),
    onReady: () => doInitialRender(),
    onRendered: (meta) => { lastNodeCount = meta.nodeCount || 0; },
    onMorphComplete: () => {
        setMorphLocked(false);
        setStillRendered(true);
        refreshText(true);
    },
    onError: () => {},
});

const thumbs = createThumbRenderer();

const textDisplay = createTextDisplay({
    titleEl: el.titleText,
    altEl: el.altText,
    textWrap: el.textWrap,
    textInner: el.textInner,
    overlayEl: el.canvasOverlay,
    overlayTextEl: el.canvasOverlayText,
});

/* ── State helpers ── */

function setDirty(value) {
    dirty = value;
    el.saveProfile.disabled = !value;
    gallery.updateActivePreview();
}

function setUserEdited(value) {
    userEdited = value;
    el.resetProfile.disabled = !value;
}

function setStillRendered(value) {
    stillRendered = value;
    if (!morphLocked) {
        el.exportBtn.disabled = !value;
        el.shareBtn.disabled = !value;
    }
}

function setMorphLocked(locked) {
    morphLocked = locked;
    el.exportBtn.disabled = locked;
    el.shareBtn.disabled = locked;
    el.settingsBtn.disabled = locked;
    document.getElementById('historyBackBtn').disabled = locked || historyIndex <= 0;
    document.getElementById('historyForwardBtn').disabled = locked || historyIndex >= navHistory.length - 1;
    document.getElementById('configRandomizeBtn').disabled = locked;
    if (locked) {
        el.sharePopover.classList.add('hidden');
        el.settingsPopover.classList.add('hidden');
    }
    const panelEl = document.querySelector('.panel');
    if (panelEl) panelEl.classList.toggle('morph-locked', locked);
}

/* ── Render dispatch ── */

let renderPending = false;
let renderTimerId = null;
let lastRenderTime = 0;
const RENDER_THROTTLE_MS = 150;

function scheduleRender() {
    if (renderPending) return;
    renderPending = true;
    const elapsed = performance.now() - lastRenderTime;
    const delay = Math.max(0, RENDER_THROTTLE_MS - elapsed);
    renderTimerId = setTimeout(() => {
        renderTimerId = null;
        requestAnimationFrame(() => {
            renderPending = false;
            lastRenderTime = performance.now();
            bridge.sendRenderRequest(controls.getCurrentSeed(), controls.readControlsFromUI());
        });
    }, delay);
}

function cancelPendingRender() {
    if (renderTimerId !== null) { clearTimeout(renderTimerId); renderTimerId = null; }
    renderPending = false;
}

/* ── Text helpers ── */

function refreshText(animate) {
    textDisplay.refreshGeneratedText(
        controls.getCurrentSeed(), controls.readControlsFromUI(),
        lastNodeCount, animate, animationEnabled,
    );
}

/* ── Transition logic ── */

function cancelActiveTransition() {
    bridge.sendMorphCancel();
    if (foldTransitionState !== 'idle') {
        bridge.cancelFoldCallbacks();
        foldTransitionState = 'idle';
        foldTransitionTarget = null;
        bridge.sendFoldImmediate(0);
    }
    textDisplay.hideOverlay();
    if (morphLocked) setMorphLocked(false);
}

function snapUIToState(state) {
    controls.setSeedInUI(state.seed);
    controls.setControlsInUI(state.controls);
    if (state.camera) {
        controls.setCameraInUI(state.camera);
        bridge.sendCameraState(state.camera.zoom, state.camera.rotation);
    }
    controls.syncDisplayFields();
}

function startProfileTransition(fromState, toState) {
    if (!animationEnabled) {
        snapUIToState(toState);
        bridge.sendRenderRequest(toState.seed, toState.controls, {
            deliberate: true, locale: getLocale(),
            callback(meta) { lastNodeCount = meta.nodeCount || 0; refreshText(true); },
        });
        setStillRendered(true);
        return;
    }

    cancelPendingRender();
    textDisplay.cancelTextRefresh();
    textDisplay.cancelTypewriter();
    cancelActiveTransition();

    foldTransitionTarget = toState;
    foldTransitionState = 'folding-out';
    setStillRendered(false);
    setMorphLocked(true);

    bridge.sendFoldOut(() => {
        if (foldTransitionState !== 'folding-out') return;
        foldTransitionState = 'rebuilding';
        snapUIToState(foldTransitionTarget);
        const target = foldTransitionTarget;

        bridge.sendRenderRequest(target.seed, target.controls, {
            deliberate: true, locale: getLocale(),
            callback(meta) {
                lastNodeCount = meta.nodeCount || 0;
                foldTransitionState = 'folding-in';
                bridge.sendFoldIn(() => {
                    foldTransitionState = 'idle';
                    foldTransitionTarget = null;
                    setMorphLocked(false);
                    setStillRendered(true);
                    refreshText(true);
                });
            },
        });
    });
}

/* ── Profile loading ── */

function loadProfileDataIntoUI(name, p) {
    if (!name || !p) return;
    el.profileNameField.value = name;
    autoGrow(el.profileNameField);
    controls.setSeedInUI(p.seed || name);
    if (p.controls) controls.setControlsInUI(p.controls);
    controls.setCameraInUI(p.camera);
    bridge.sendCameraState(p.camera?.zoom ?? 1.0, p.camera?.rotation ?? 0);
    controls.syncDisplayFields();
    setDirty(false);
    setUserEdited(false);
    captureBaseline();
}

function loadProfileFromData(name, isPortrait) {
    const store = isPortrait ? loadPortraits() : loadProfiles();
    const p = store[name];
    if (!p) return;
    loadProfileDataIntoUI(name, p);
    loadedProfileName = name;
    loadedFromPortrait = isPortrait;
}

/* ── Profile Gallery ── */

const gallery = createProfileGallery({
    el,
    thumbRenderer: thumbs,
    getCurrentSeed: controls.getCurrentSeed,
    readControlsFromUI: controls.readControlsFromUI,
    getLoadedState: () => ({ name: loadedProfileName, isPortrait: loadedFromPortrait, dirty }),
    async onSelect(profileName, isPortrait) {
        if (morphLocked) return;
        if (dirty && userEdited) {
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

        const fromState = { seed: controls.getCurrentSeed(), controls: controls.readControlsFromUI() };
        captureCurrentBeforeNavigating();
        loadProfileFromData(profileName, isPortrait);
        pushToHistory();
        gallery.clearActiveCards();
        gallery.updateActivePreview();

        const toState = { seed: controls.getCurrentSeed(), controls: controls.readControlsFromUI() };
        startProfileTransition(fromState, toState);
    },
    onDelete(realName) {
        if (realName === loadedProfileName) {
            loadedProfileName = '';
            loadedFromPortrait = false;
            setDirty(true);
        }
    },
});

/* ── Save / Reset ── */

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
        const currentControls = controls.readControlsFromUI();
        const currentSeed = controls.getCurrentSeed();

        const matchingPortrait = portraits[name];
        if (matchingPortrait &&
            JSON.stringify(matchingPortrait.seed) === JSON.stringify(currentSeed) &&
            JSON.stringify(matchingPortrait.controls) === JSON.stringify(currentControls)) {
            toast(t('toast.alreadyPortrait'));
            return;
        }

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

        profiles[name] = { seed: currentSeed, controls: currentControls, camera: controls.readCameraFromUI() };
        saveProfiles(profiles);
        const order = loadProfileOrder() || [];
        if (!order.includes(name)) { order.push(name); saveProfileOrder(order); }

        loadedProfileName = name;
        loadedFromPortrait = false;
        gallery.refresh();
        setDirty(false);
        setUserEdited(false);
        captureBaseline();
    } finally {
        saveInProgress = false;
    }
}

el.saveProfile.addEventListener('click', () => saveCurrentProfile());

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

el.resetProfile.addEventListener('click', () => resetCurrentProfile());

/* ── History ── */

const HISTORY_MAX = 25;
let navHistory = [];
let historyIndex = -1;

function captureSnapshot() {
    return {
        seed: controls.getCurrentSeed(),
        name: el.profileNameField.value.trim(),
        controls: controls.readControlsFromUI(),
        camera: controls.readCameraFromUI(),
        profileName: loadedProfileName || '',
        isPortrait: loadedFromPortrait,
        wasDirty: dirty,
    };
}

function captureBaseline() { baselineSnapshot = captureSnapshot(); }

function restoreSnapshot(snap) {
    const fromState = { seed: controls.getCurrentSeed(), controls: controls.readControlsFromUI() };

    controls.setSeedInUI(snap.seed);
    el.profileNameField.value = snap.name;
    autoGrow(el.profileNameField);
    controls.setControlsInUI(snap.controls);
    controls.updateSliderLabels(snap.controls);
    if (snap.camera) {
        controls.setCameraInUI(snap.camera);
        bridge.sendCameraState(snap.camera.zoom, snap.camera.rotation);
    }
    controls.syncDisplayFields();

    if (snap.profileName) {
        const store = snap.isPortrait ? loadPortraits() : loadProfiles();
        if (store[snap.profileName]) {
            loadedProfileName = snap.profileName;
            loadedFromPortrait = snap.isPortrait;
            setDirty(snap.wasDirty);
            setUserEdited(snap.wasDirty);
        } else {
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

    gallery.refresh();
    const toState = { seed: controls.getCurrentSeed(), controls: controls.readControlsFromUI() };
    startProfileTransition(fromState, toState);
}

function updateHistoryButtons() {
    const back = document.getElementById('historyBackBtn');
    const fwd = document.getElementById('historyForwardBtn');
    if (back) back.disabled = morphLocked || historyIndex <= 0;
    if (fwd) fwd.disabled = morphLocked || historyIndex >= navHistory.length - 1;
}

function captureCurrentBeforeNavigating() {
    if (historyIndex < 0 || navHistory.length === 0) { pushToHistory(); return; }
    const current = captureSnapshot();
    const stored = navHistory[historyIndex];
    const changed = current.seed !== stored.seed
        || current.name !== stored.name
        || current.profileName !== stored.profileName
        || current.wasDirty !== stored.wasDirty
        || JSON.stringify(current.controls) !== JSON.stringify(stored.controls);
    if (changed) navHistory[historyIndex] = current;
}

function pushToHistory() {
    const snap = captureSnapshot();
    if (historyIndex >= 0 && historyIndex < navHistory.length) {
        const cur = navHistory[historyIndex];
        if (JSON.stringify(cur.seed) === JSON.stringify(snap.seed)
            && cur.profileName === snap.profileName
            && cur.isPortrait === snap.isPortrait
            && JSON.stringify(cur.controls) === JSON.stringify(snap.controls)) {
            return;
        }
    }
    if (historyIndex < navHistory.length - 1) navHistory.splice(historyIndex + 1);
    navHistory.push(snap);
    if (navHistory.length > HISTORY_MAX) navHistory.shift();
    historyIndex = navHistory.length - 1;
    updateHistoryButtons();
}

/* ── Randomize ── */

function randomizeUI() {
    const seedTag = [
        Math.floor(Math.random() * TAG_LIST_LENGTH),
        Math.floor(Math.random() * TAG_LIST_LENGTH),
        Math.floor(Math.random() * TAG_LIST_LENGTH),
    ];
    controls.setSeedInUI(seedTag);
    controls.setCameraInUI(controls.CAMERA_DEFAULTS);
    bridge.sendCameraState(controls.CAMERA_DEFAULTS.zoom, controls.CAMERA_DEFAULTS.rotation);
    controls.setTopologyUI('flow-field');

    for (const id of controls.SLIDER_KEYS) {
        el[id].value = Math.random().toFixed(2);
    }

    const seed = controls.getCurrentSeed();
    const ctrlValues = controls.readControlsFromUI();
    controls.updateSliderLabels(ctrlValues);
    const nameRng = mulberry32(xmur3(seed + ':name')());
    el.profileNameField.value = generateTitle(ctrlValues, nameRng);
    autoGrow(el.profileNameField);

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

    const fromState = { seed: controls.getCurrentSeed(), controls: controls.readControlsFromUI() };
    captureCurrentBeforeNavigating();
    randomizeUI();
    gallery.refresh();
    pushToHistory();
    const toState = { seed: controls.getCurrentSeed(), controls: controls.readControlsFromUI() };
    startProfileTransition(fromState, toState);
}

/* ── Control change handlers ── */

function onControlChange() {
    if (!initComplete) return;
    if (foldTransitionState !== 'idle') { cancelActiveTransition(); bridge.sendFoldImmediate(1); }
    bridge.sendMorphCancel();
    textDisplay.hideOverlay();
    if (morphLocked) setMorphLocked(false);
    controls.updateSliderLabels(controls.readControlsFromUI());
    textDisplay.scheduleTextRefresh(() => refreshText(true));
    setStillRendered(false);
    setUserEdited(true);
    setDirty(true);
    scheduleRender();
}

function onCameraChange() {
    if (!initComplete) return;
    const cam = controls.readCameraFromUI();
    controls.updateCameraLabels(cam);
    bridge.sendCameraState(cam.zoom, cam.rotation);
    setUserEdited(true);
    setDirty(true);
}

for (const id of controls.SLIDER_KEYS) el[id].addEventListener('input', onControlChange);
el.seedTagArr.addEventListener('change', onControlChange);
el.seedTagStr.addEventListener('change', onControlChange);
el.seedTagDet.addEventListener('change', onControlChange);
el.zoom.addEventListener('input', onCameraChange);
el.rotation.addEventListener('input', onCameraChange);
el.profileNameField.addEventListener('input', () => {
    setUserEdited(true);
    setDirty(true);
    controls.syncDisplayFields();
});

/* ── Resolution changes ── */

document.addEventListener('resolutionchange', (e) => {
    const { w, h } = e.detail;
    bridge.sendResize(w, h);
    bridge.sendRenderRequest(controls.getCurrentSeed(), controls.readControlsFromUI(), { locale: getLocale() });
});

/* ── Share / Export / Import ── */

initShareActions({
    el,
    getCurrentSeed: controls.getCurrentSeed,
    readControlsFromUI: controls.readControlsFromUI,
    readCameraFromUI: controls.readCameraFromUI,
    getNodeCount: () => lastNodeCount,
    isStillRendered: () => stillRendered,
    bridge,
});

initImportHandler({
    onImported(lastName) {
        captureCurrentBeforeNavigating();
        // Load the imported profile
        const profiles = loadProfiles();
        const p = profiles[lastName];
        if (p) loadProfileDataIntoUI(lastName, p);
        loadedProfileName = lastName;
        loadedFromPortrait = false;
        pushToHistory();
        gallery.refresh();
        bridge.sendRenderRequest(controls.getCurrentSeed(), controls.readControlsFromUI(), {
            deliberate: true, locale: getLocale(),
            callback(meta) {
                lastNodeCount = meta.nodeCount || 0;
                if (animationEnabled) {
                    textDisplay.playRevealAnimation(meta.title, meta.altText);
                } else {
                    textDisplay.instantReveal(meta.title, meta.altText);
                }
                controls.syncDisplayFields();
            },
        });
        setStillRendered(true);
    },
});

/* ── Animation toggle ── */

if (animElements) {
    el.animToggle.setAttribute('aria-checked', String(animationEnabled));

    el.animToggle.addEventListener('click', () => {
        animationEnabled = !animationEnabled;
        el.animToggle.setAttribute('aria-checked', String(animationEnabled));
        localStorage.setItem('geo-anim-enabled', String(animationEnabled));
        syncAnimConfigVisibility();
        bridge.sendAnimation(animationEnabled);
    });
    el.animToggle.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); el.animToggle.click(); }
    });

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

    const sendAnimCfg = () => {
        localStorage.setItem('geo-anim-config', JSON.stringify(animCfg));
        bridge.sendAnimConfig(animCfg);
    };

    el.animSparkle.addEventListener('input', () => {
        animCfg.sparkle = parseFloat(el.animSparkle.value);
        el.animSparkleVal.textContent = animCfg.sparkle.toFixed(2);
        sendAnimCfg();
    });
    el.animDrift.addEventListener('input', () => {
        animCfg.drift = parseFloat(el.animDrift.value);
        el.animDriftVal.textContent = animCfg.drift.toFixed(2);
        sendAnimCfg();
    });
    el.animWobble.addEventListener('input', () => {
        animCfg.wobble = parseFloat(el.animWobble.value);
        el.animWobbleVal.textContent = animCfg.wobble.toFixed(2);
        sendAnimCfg();
    });
}

/* ── Tab visibility ── */

document.addEventListener('visibilitychange', () => {
    bridge.sendVisibility(!document.hidden);
});

/* ── Statement modal + modals ── */

const { loadContent: loadStatementContent, closeStatementModal } = _statement;

initModals({
    ..._infoModalRefs,
    escapeHandlers: [
        () => { if (!_infoModalRefs.infoModal.classList.contains('hidden')) { closeInfoModal(); return true; } },
        () => { if (!el.statementModal.classList.contains('hidden')) { closeStatementModal(); return true; } },
        () => { if (isPanelOpen()) { closePanel(); return true; } },
    ],
});

/* ── UI init ── */

initCollapsibles();
initPanel();
controls.initTopologySelector(onControlChange);
controls.initSeedTagSelects();
controls.updateCameraLabels(controls.CAMERA_DEFAULTS);
initPageSettings(_footerRefs.pageSettingsBtn, _footerRefs.pageSettingsPopover);
loadStatementContent();
ensureStarterProfiles();

// Move configControls into the Active card (starts collapsed)
const configControlsEl = document.getElementById('configControls');
el.activeCard.appendChild(configControlsEl);
configControlsEl.style.display = '';
configControlsEl.classList.add('collapsed');

// Gallery header toggle
el.galleryToggle.addEventListener('click', () => {
    const expanded = el.galleryToggle.getAttribute('aria-expanded') === 'true';
    el.galleryToggle.setAttribute('aria-expanded', String(!expanded));
    el.galleryContent.classList.toggle('collapsed', expanded);
});

// Gallery sub-section toggles
document.querySelectorAll('.gallery-section-header').forEach(header => {
    header.addEventListener('click', () => {
        const expanded = header.getAttribute('aria-expanded') === 'true';
        header.setAttribute('aria-expanded', String(!expanded));
        const target = document.getElementById(header.dataset.target);
        if (target) target.classList.toggle('collapsed', expanded);
    });
});

// Active card config toggle
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

// Config randomize + history buttons
document.getElementById('configRandomizeBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    randomize();
});

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

/* ── Initial render ── */

// Check for shared state in URL, otherwise randomize
const sharedState = decodeStateFromURL(window.location.href);
if (sharedState) {
    controls.setSeedInUI(sharedState.seed);
    if (sharedState.name) {
        el.profileNameField.value = sharedState.name;
        autoGrow(el.profileNameField);
    }
    controls.setControlsInUI(sharedState.controls);
    if (sharedState.camera) controls.setCameraInUI(sharedState.camera);
    controls.syncDisplayFields();
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

thumbs.cacheReady.then(() => gallery.refresh());

navHistory.push(captureSnapshot());
historyIndex = 0;
updateHistoryButtons();

textDisplay.showOverlay('');

function doInitialRender() {
    const seed = controls.getCurrentSeed();
    const ctrlValues = controls.readControlsFromUI();
    const camera = controls.readCameraFromUI();
    bridge.sendCameraState(camera.zoom, camera.rotation);

    if (animationEnabled) bridge.sendFoldImmediate(0);

    bridge.sendRenderRequest(seed, ctrlValues, {
        deliberate: true, locale: getLocale(),
        callback(meta) {
            lastNodeCount = meta.nodeCount || 0;
            if (animationEnabled) {
                textDisplay.playRevealAnimation(meta.title, meta.altText);
                bridge.sendFoldIn();
            } else {
                textDisplay.instantReveal(meta.title, meta.altText);
            }
            controls.syncDisplayFields();
            thumbs.startDraining();
        },
    });
    setStillRendered(true);
    thumbs.cacheReady.then(() => gallery.refresh());
    initComplete = true;
}

if (!bridge.isWorker() && bridge.isReady()) {
    requestAnimationFrame(doInitialRender);
}

/* ── Locale change ── */

document.addEventListener('localechange', () => {
    document.title = t(pageTitle);
    const currentSeed = controls.getCurrentSeed();
    controls.initSeedTagSelects();
    controls.setSeedInUI(currentSeed);
    controls.syncDisplayFields();
    scheduleRender();
});

/* ── HMR ── */

if (import.meta.hot) {
    import.meta.hot.accept();
    import.meta.hot.dispose(() => { bridge.dispose(); });
}

} // end initEditor
