/**
 * Generate panel — configuration menu with sliders, seed tags, name field,
 * camera controls, preview, and render button.
 * Manages the UI state for the generation flow on the gallery page.
 */

import { t, getLocale } from '../../i18n/locale.js';
import {
    TAG_LIST_LENGTH, getLocalizedWords, seedToString,
} from '@geometric-interior/core/text-generation/seed-tags.js';
import { generateTitle } from '@geometric-interior/core/text-generation/title-text.js';
import { xmur3, mulberry32 } from '@geometric-interior/utils/prng.js';
import { slugify, validateProfileName } from '../../components/slugify.js';
import { generateAltText } from '@geometric-interior/core/text-generation/alt-text.js';

/** Slider grouping: matches the 4 parameter sections from docs/parameters.md */
const SLIDER_GROUPS = [
    { key: 'geometry', sliders: ['density', 'fracture', 'scale', 'division', 'faceting'] },
    { key: 'light',    sliders: ['luminosity', 'bloom'] },
    { key: 'color',    sliders: ['hue', 'spectrum', 'chroma'] },
    { key: 'space',    sliders: ['coherence', 'flow'] },
];

/** Flat key list (derived from groups, used for readControls/setValues). */
const SLIDER_KEYS = SLIDER_GROUPS.flatMap(g => g.sliders);

/** Camera slider definitions with custom ranges. */
const CAMERA_SLIDERS = [
    { key: 'rotation',  min: -180, max: 180,  step: 1,    defaultVal: 0,    format: 'deg' },
    { key: 'elevation', min: -180, max: 180,  step: 1,    defaultVal: 0,    format: 'deg' },
    { key: 'zoom',      min: 0,    max: 1,    step: 0.01, defaultVal: 0.38, format: '' },
];

/** Per-parameter track gradients (subtle, thematic). */
const SLIDER_GRADIENTS = {
    // Geometry
    density:   'linear-gradient(to right, transparent, rgba(180,130,255,0.4))',
    fracture:  'linear-gradient(to right, rgba(100,160,255,0.3), rgba(255,100,80,0.4))',
    scale:     'linear-gradient(to right, rgba(180,130,255,0.2), rgba(180,130,255,0.5))',
    division:  'linear-gradient(to right, rgba(140,180,255,0.25), rgba(200,140,255,0.45))',
    faceting:  'linear-gradient(to right, rgba(160,200,255,0.25), rgba(220,180,255,0.45))',
    // Light
    luminosity:'linear-gradient(to right, rgba(20,10,40,0.5), rgba(255,240,200,0.5))',
    bloom:     'linear-gradient(to right, transparent, rgba(255,200,255,0.45))',
    // Color
    hue:       'linear-gradient(to right, rgba(255,80,80,0.4), rgba(255,200,50,0.4), rgba(80,255,80,0.4), rgba(80,200,255,0.4), rgba(180,130,255,0.4), rgba(255,80,80,0.4))',
    spectrum:  'linear-gradient(to right, rgba(180,130,255,0.3), rgba(255,180,100,0.3), rgba(100,200,255,0.3))',
    chroma:    'linear-gradient(to right, rgba(160,160,160,0.3), rgba(255,100,200,0.45))',
    // Space
    coherence: 'linear-gradient(to right, rgba(255,120,80,0.35), rgba(100,180,255,0.35))',
    flow:      'linear-gradient(to right, rgba(140,140,180,0.3), rgba(100,220,200,0.4))',
    // Camera
    rotation:  'linear-gradient(to right, rgba(180,130,255,0.3), rgba(130,180,255,0.3), rgba(180,130,255,0.3))',
    elevation: 'linear-gradient(to right, rgba(100,130,200,0.3), rgba(200,160,255,0.4))',
    zoom:      'linear-gradient(to right, rgba(130,130,180,0.25), rgba(180,130,255,0.45))',
};

/**
 * Initialize the generate panel.
 * @param {Object} opts
 * @param {HTMLElement} opts.slidersEl       — container for sliders
 * @param {HTMLSelectElement} opts.tagArrEl  — arrangement word select
 * @param {HTMLSelectElement} opts.tagStrEl  — structure word select
 * @param {HTMLSelectElement} opts.tagDetEl  — detail word select
 * @param {HTMLTextAreaElement} opts.nameField — name textarea
 * @param {HTMLButtonElement} opts.saveBtn
 * @param {HTMLButtonElement} opts.resetBtn
 * @param {HTMLButtonElement} opts.randomizeBtn
 * @param {HTMLButtonElement} opts.renderBtn
 * @param {Function} opts.onControlChange   — (seed, controls, camera) => void
 * @param {Function} opts.onRender          — (seed, controls, camera, name) => void
 * @param {Function} [opts.onSave]          — (seed, controls, camera, name) => void
 * @param {HTMLElement} [opts.nameTooltipEl] — element whose data-tooltip gets slug appended
 * @param {HTMLTextAreaElement} [opts.commentaryField] — commentary textarea
 * @param {HTMLElement} [opts.previewCanvas] — canvas element for alt-text tooltip overlay
 * @param {HTMLElement} [opts.nameCounter] — char counter for name
 * @param {HTMLElement} [opts.nameError] — validation error for name
 * @param {HTMLElement} [opts.commentaryCounter] — char counter for commentary
 * @param {HTMLButtonElement} [opts.historyBackBtn] — previous randomized image
 * @param {HTMLButtonElement} [opts.historyForwardBtn] — next randomized image
 * @param {HTMLButtonElement} [opts.undoBtn] — undo parameter tweak
 * @param {HTMLButtonElement} [opts.redoBtn] — redo parameter tweak
 * @param {HTMLButtonElement} [opts.duplicateBtn] — duplicate locked config for editing
 * @param {Function} [opts.onDuplicate] — () => void
 */
export function initGeneratePanel(opts) {
    const {
        slidersEl, tagArrEl, tagStrEl, tagDetEl,
        nameField, saveBtn, resetBtn, randomizeBtn, renderBtn,
        onControlChange, onRender, onSave, nameTooltipEl, commentaryField,
        previewCanvas, nameCounter, nameError, commentaryCounter,
        historyBackBtn, historyForwardBtn, undoBtn, redoBtn,
        duplicateBtn, onDuplicate,
    } = opts;

    const sliderInputs = {};
    const cameraInputs = {};
    let userEditedName = false;
    let locked = false;       // true when viewing a saved (immutable) profile
    let savedName = null;     // name of the saved profile (null = unsaved draft)

    // ── Two-tier history ──
    // imageHistory: array of randomized image entries, each with its own undo stack
    // Prev/next navigates between randomized images
    // Undo/redo navigates within the current image's tweak history
    const MAX_IMAGE_HISTORY = 50;
    const MAX_UNDO = 50;
    const imageHistory = []; // [{undoStack: [state, ...], undoIndex: number}]
    let imageIndex = -1;
    let navigating = false;
    let undoPushTimer = null;

    function captureState() {
        return {
            seed: readSeed(),
            controls: readControls(),
            camera: readCamera(),
            name: nameField.value,
            userEditedName,
        };
    }

    /** Push a new randomized image entry to the top of image history. */
    function pushImageHistory() {
        // Save current undo state before leaving
        if (imageIndex >= 0 && imageHistory[imageIndex]) {
            flushUndoTimer();
        }
        const state = captureState();
        const entry = { undoStack: [state], undoIndex: 0 };
        // Always append to end (top), preserving all existing forward history
        imageHistory.push(entry);
        if (imageHistory.length > MAX_IMAGE_HISTORY) imageHistory.shift();
        imageIndex = imageHistory.length - 1;
        updateNavButtons();
    }

    /** Push an undo entry for the current image (debounced). */
    function pushUndo(immediate) {
        if (navigating) return;
        if (undoPushTimer) { clearTimeout(undoPushTimer); undoPushTimer = null; }
        const doPush = () => {
            const entry = imageHistory[imageIndex];
            if (!entry) return;
            // Truncate redo forward when branching
            if (entry.undoIndex < entry.undoStack.length - 1) {
                entry.undoStack.length = entry.undoIndex + 1;
            }
            entry.undoStack.push(captureState());
            if (entry.undoStack.length > MAX_UNDO) entry.undoStack.shift();
            entry.undoIndex = entry.undoStack.length - 1;
            updateNavButtons();
        };
        if (immediate) doPush();
        else undoPushTimer = setTimeout(doPush, 500);
    }

    function flushUndoTimer() {
        if (undoPushTimer) {
            clearTimeout(undoPushTimer);
            undoPushTimer = null;
            // Force the push
            const entry = imageHistory[imageIndex];
            if (!entry) return;
            if (entry.undoIndex < entry.undoStack.length - 1) {
                entry.undoStack.length = entry.undoIndex + 1;
            }
            entry.undoStack.push(captureState());
            if (entry.undoStack.length > MAX_UNDO) entry.undoStack.shift();
            entry.undoIndex = entry.undoStack.length - 1;
        }
    }

    /** Navigate between randomized images (prev/next). */
    function navigateImage(dir) {
        const newIdx = imageIndex + dir;
        if (newIdx < 0 || newIdx >= imageHistory.length) return;
        flushUndoTimer();
        imageIndex = newIdx;
        navigating = true;
        const entry = imageHistory[imageIndex];
        applyState(entry.undoStack[entry.undoIndex]);
        navigating = false;
        updateNavButtons();
    }

    /** Navigate undo/redo within current image entry. */
    function navigateUndo(dir) {
        const entry = imageHistory[imageIndex];
        if (!entry) return;
        const newIdx = entry.undoIndex + dir;
        if (newIdx < 0 || newIdx >= entry.undoStack.length) return;
        flushUndoTimer();
        entry.undoIndex = newIdx;
        navigating = true;
        applyState(entry.undoStack[entry.undoIndex]);
        navigating = false;
        updateNavButtons();
    }

    function applyState(state) {
        if (state.seed && Array.isArray(state.seed)) {
            tagArrEl.value = String(state.seed[0]);
            tagStrEl.value = String(state.seed[1]);
            tagDetEl.value = String(state.seed[2]);
        }
        if (state.controls) {
            for (const key of SLIDER_KEYS) {
                const ref = sliderInputs[key];
                if (state.controls[key] !== undefined && ref) {
                    ref.range.value = String(state.controls[key]);
                    ref.valueEl.value = parseFloat(String(state.controls[key])).toFixed(2);
                }
            }
        }
        if (state.camera) {
            for (const cam of CAMERA_SLIDERS) {
                const ref = cameraInputs[cam.key];
                if (state.camera[cam.key] !== undefined && ref) {
                    ref.range.value = String(state.camera[cam.key]);
                    ref.valueEl.value = formatValue(parseFloat(String(state.camera[cam.key])), cam.format, cam.step);
                }
            }
        }
        if (state.name) {
            nameField.value = state.name;
            userEditedName = state.userEditedName;
        } else {
            userEditedName = false;
            updateAutoName();
        }
        updateSlugDisplay();
        updateAltText();
        updateNameCounter();
        updateCommentaryCounter();
        if (onControlChange) onControlChange(readSeed(), readControls(), readCamera());
    }

    function updateNavButtons() {
        if (historyBackBtn) historyBackBtn.disabled = imageIndex <= 0;
        if (historyForwardBtn) historyForwardBtn.disabled = imageIndex >= imageHistory.length - 1;
        const entry = imageHistory[imageIndex];
        if (undoBtn) undoBtn.disabled = locked || !entry || entry.undoIndex <= 0;
        if (redoBtn) redoBtn.disabled = locked || !entry || entry.undoIndex >= entry.undoStack.length - 1;
        updateActionButtons();
    }

    /** Update Save/Render/Duplicate button states based on lock status. */
    function updateActionButtons() {
        if (saveBtn) saveBtn.disabled = locked || !nameField.value.trim();
        if (renderBtn) renderBtn.disabled = !locked;
        if (resetBtn) resetBtn.disabled = locked;
        if (duplicateBtn) {
            duplicateBtn.classList.toggle('hidden', !locked);
            duplicateBtn.disabled = !locked;
        }
    }

    /** Lock the panel (saved profile — immutable). */
    function setLocked(name) {
        locked = true;
        savedName = name || null;
        // Disable all inputs
        for (const key of SLIDER_KEYS) {
            if (sliderInputs[key]) sliderInputs[key].range.disabled = true;
        }
        for (const cam of CAMERA_SLIDERS) {
            if (cameraInputs[cam.key]) cameraInputs[cam.key].range.disabled = true;
        }
        tagArrEl.disabled = true;
        tagStrEl.disabled = true;
        tagDetEl.disabled = true;
        nameField.disabled = true;
        if (commentaryField) commentaryField.disabled = true;
        updateActionButtons();
    }

    /** Unlock the panel (draft — editable). */
    function setUnlocked() {
        locked = false;
        savedName = null;
        for (const key of SLIDER_KEYS) {
            if (sliderInputs[key]) sliderInputs[key].range.disabled = false;
        }
        for (const cam of CAMERA_SLIDERS) {
            if (cameraInputs[cam.key]) cameraInputs[cam.key].range.disabled = false;
        }
        tagArrEl.disabled = false;
        tagStrEl.disabled = false;
        tagDetEl.disabled = false;
        nameField.disabled = false;
        if (commentaryField) commentaryField.disabled = false;
        updateActionButtons();
    }

    if (historyBackBtn) historyBackBtn.addEventListener('click', () => navigateImage(-1));
    if (historyForwardBtn) historyForwardBtn.addEventListener('click', () => navigateImage(1));
    if (undoBtn) undoBtn.addEventListener('click', () => navigateUndo(-1));
    if (redoBtn) redoBtn.addEventListener('click', () => navigateUndo(1));

    // ── Build seed tag selects ──

    function populateTagSelect(selectEl, words) {
        selectEl.innerHTML = '';
        for (let i = 0; i < words.length; i++) {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = words[i];
            selectEl.appendChild(opt);
        }
    }

    const locale = getLocale();
    const localizedWords = getLocalizedWords(locale);
    populateTagSelect(tagArrEl, localizedWords.arrangement);
    populateTagSelect(tagStrEl, localizedWords.structure);
    populateTagSelect(tagDetEl, localizedWords.detail);

    // Start with random seed tags
    tagArrEl.value = String(Math.floor(Math.random() * TAG_LIST_LENGTH));
    tagStrEl.value = String(Math.floor(Math.random() * TAG_LIST_LENGTH));
    tagDetEl.value = String(Math.floor(Math.random() * TAG_LIST_LENGTH));

    // ── Build parameter sliders (grouped by section) ──

    slidersEl.innerHTML = '';
    for (const group of SLIDER_GROUPS) {
        buildSection(group.key, group.sliders.map(key => ({ key, min: 0, max: 1, step: 0.01, defaultVal: 0.50, format: '' })), sliderInputs);
    }

    // ── Build camera sliders ──

    buildSection('camera', CAMERA_SLIDERS.map(cam => ({ key: cam.key, min: cam.min, max: cam.max, step: cam.step, defaultVal: cam.defaultVal, format: cam.format })), cameraInputs);

    /**
     * Build a collapsible section with header + slider rows.
     */
    function buildSection(sectionKey, sliderDefs, targetMap) {
        const sectionId = 'genSection_' + sectionKey;

        // Collapsible header
        const header = document.createElement('div');
        header.className = 'gen-section-header gen-collapsible-toggle';
        header.setAttribute('aria-expanded', 'true');
        header.setAttribute('data-target', sectionId);

        const headerLabel = document.createElement('span');
        headerLabel.className = 'gen-section-label';
        headerLabel.setAttribute('data-i18n', `section.${sectionKey}`);
        headerLabel.textContent = t(`section.${sectionKey}`);

        const chevron = document.createElement('span');
        chevron.className = 'gen-chevron';
        chevron.innerHTML = '&#9662;';

        header.appendChild(chevron);
        header.appendChild(headerLabel);

        // Collapsible rows container
        const rowsWrap = document.createElement('div');
        rowsWrap.className = 'gen-section-rows';
        rowsWrap.id = sectionId;

        for (const def of sliderDefs) {
            buildSliderRow(def.key, def.min, def.max, def.step, def.defaultVal, def.format, targetMap, rowsWrap);
        }

        // Wrapper: header + rows nested together for hover highlight
        const section = document.createElement('div');
        section.className = 'gen-section';
        section.appendChild(header);
        section.appendChild(rowsWrap);
        slidersEl.appendChild(section);
    }

    /**
     * Build a single slider row and append it to the given container.
     */
    function buildSliderRow(key, min, max, step, defaultVal, format, targetMap, container) {
        const row = document.createElement('div');
        row.className = 'gen-slider-row';

        const labelWrap = document.createElement('label');
        labelWrap.className = 'gen-slider-label';

        const labelText = document.createElement('span');
        labelText.className = 'gen-slider-name label-info';
        labelText.setAttribute('data-tooltip', t(`control.${key}.tooltip`));
        labelText.setAttribute('data-i18n', `control.${key}`);
        labelText.setAttribute('data-i18n-tooltip', `control.${key}.tooltip`);

        const icon = document.createElement('span');
        icon.className = 'info-icon';
        icon.textContent = 'i';
        labelText.appendChild(document.createTextNode(t(`control.${key}`)));
        labelText.appendChild(icon);

        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.className = 'gen-slider-value';
        valueInput.value = formatValue(defaultVal, format, step);

        labelWrap.appendChild(labelText);
        labelWrap.appendChild(valueInput);

        const sliderWrap = document.createElement('div');
        sliderWrap.className = 'gen-slider-track';

        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(defaultVal);
        input.id = 'gen-' + key;

        if (SLIDER_GRADIENTS[key]) input.style.background = SLIDER_GRADIENTS[key];

        input.addEventListener('input', () => {
            valueInput.value = formatValue(parseFloat(input.value), format, step);
            fireControlChange();
        });

        function commitValueInput() {
            let raw = valueInput.value.replace(/°/g, '').trim();
            let num = parseFloat(raw);
            if (isNaN(num)) num = parseFloat(input.value);
            num = Math.min(max, Math.max(min, num));
            num = Math.round(num / step) * step;
            input.value = String(num);
            valueInput.value = formatValue(num, format, step);
            fireControlChange();
        }

        valueInput.addEventListener('blur', commitValueInput);
        valueInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitValueInput(); valueInput.blur(); }
        });

        targetMap[key] = { range: input, valueEl: valueInput, format, step };

        sliderWrap.appendChild(input);
        row.appendChild(labelWrap);
        row.appendChild(sliderWrap);
        container.appendChild(row);
    }

    function formatValue(val, format, step) {
        if (format === 'deg') return Math.round(val) + '\u00b0';
        return val.toFixed(2);
    }

    // ── Event handlers ──

    function readSeed() {
        return [
            parseInt(tagArrEl.value, 10),
            parseInt(tagStrEl.value, 10),
            parseInt(tagDetEl.value, 10),
        ];
    }

    function readControls() {
        const controls = { topology: 'flow-field' };
        for (const key of SLIDER_KEYS) {
            controls[key] = parseFloat(sliderInputs[key].range.value);
        }
        return controls;
    }

    function readCamera() {
        return {
            rotation: parseFloat(cameraInputs.rotation.range.value),
            elevation: parseFloat(cameraInputs.elevation.range.value),
            zoom: parseFloat(cameraInputs.zoom.range.value),
        };
    }

    function readName() {
        return nameField.value.trim() || autoName(readSeed(), readControls());
    }

    function autoName(seed, controls) {
        const seedStr = seedToString(seed);
        const rng = mulberry32(xmur3(seedStr + ':title')());
        return generateTitle(controls, rng, locale);
    }

    function updateAutoName() {
        if (userEditedName) return;
        const seed = readSeed();
        const controls = readControls();
        nameField.value = autoName(seed, controls);
    }

    function updateSlugDisplay() {
        if (!nameTooltipEl) return;
        const slug = slugify(readName());
        const baseTooltip = nameTooltipEl.getAttribute('data-i18n-tooltip')
            ? t(nameTooltipEl.getAttribute('data-i18n-tooltip'))
            : 'A name for this arrangement of light and form.';
        nameTooltipEl.setAttribute('data-tooltip', baseTooltip + '\nURL-safe identifier: ' + slug);
    }

    function updateAltText() {
        if (!previewCanvas) return;
        const controls = readControls();
        const nodeCount = Math.round(80 + (controls.density || 0.5) * 1400);
        const seed = readSeed();
        const altText = generateAltText(controls, nodeCount, readName(), locale, seed);
        previewCanvas.setAttribute('data-tooltip', altText);
        previewCanvas.setAttribute('data-tooltip-pos', 'overlay');
    }

    function updateNameCounter() {
        const len = nameField.value.length;
        const max = parseInt(nameField.maxLength, 10) || 40;
        if (nameCounter) {
            nameCounter.textContent = len + '/' + max;
            nameCounter.classList.toggle('over-limit', len > max);
        }
        if (nameError) {
            const val = validateProfileName(nameField.value);
            if (!val.valid && nameField.value.trim().length > 0) {
                nameError.textContent = t('validation.underscoresNotAllowed');
                nameError.classList.remove('hidden');
            } else {
                nameError.classList.add('hidden');
            }
        }
    }

    function updateCommentaryCounter() {
        if (!commentaryCounter || !commentaryField) return;
        const len = commentaryField.value.length;
        const max = parseInt(commentaryField.maxLength, 10) || 500;
        commentaryCounter.textContent = len + '/' + max;
        commentaryCounter.classList.toggle('over-limit', len > max);
    }

    function fireControlChange() {
        updateAutoName();
        updateSlugDisplay();
        updateAltText();
        updateNameCounter();
        pushUndo(false);
        if (onControlChange) onControlChange(readSeed(), readControls(), readCamera());
    }

    tagArrEl.addEventListener('change', fireControlChange);
    tagStrEl.addEventListener('change', fireControlChange);
    tagDetEl.addEventListener('change', fireControlChange);

    nameField.addEventListener('input', () => {
        userEditedName = nameField.value.trim().length > 0;
        updateSlugDisplay();
        updateNameCounter();
        updateActionButtons();
    });

    if (commentaryField) {
        commentaryField.addEventListener('input', updateCommentaryCounter);
    }

    // ── Randomize ──

    function randomize() {
        if (locked) setUnlocked();
        tagArrEl.value = String(Math.floor(Math.random() * TAG_LIST_LENGTH));
        tagStrEl.value = String(Math.floor(Math.random() * TAG_LIST_LENGTH));
        tagDetEl.value = String(Math.floor(Math.random() * TAG_LIST_LENGTH));

        for (const key of SLIDER_KEYS) {
            const ref = sliderInputs[key];
            const val = Math.random();
            ref.range.value = val.toFixed(2);
            ref.valueEl.value = val.toFixed(2);
        }

        // Reset camera to defaults
        for (const cam of CAMERA_SLIDERS) {
            const ref = cameraInputs[cam.key];
            ref.range.value = String(cam.defaultVal);
            ref.valueEl.value = formatValue(cam.defaultVal, cam.format, cam.step);
        }

        // Reset name to auto-generated
        userEditedName = false;
        updateAutoName();
        updateSlugDisplay();
        updateAltText();
        updateNameCounter();
        pushImageHistory();
        if (onControlChange) onControlChange(readSeed(), readControls(), readCamera());
    }

    randomizeBtn.addEventListener('click', randomize);

    // ── Render ──

    if (renderBtn) {
        renderBtn.addEventListener('click', () => {
            if (onRender) onRender(readSeed(), readControls(), readCamera(), readName());
        });
    }

    // ── Save ──

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const name = readName();
            if (onSave) onSave(readSeed(), readControls(), readCamera(), name, readCommentary());
            setLocked(name);
        });
    }

    // ── Duplicate ──

    if (duplicateBtn) {
        duplicateBtn.addEventListener('click', () => {
            setUnlocked();
            // Clear name so user must pick a new one
            nameField.value = '';
            userEditedName = false;
            updateAutoName();
            updateSlugDisplay();
            updateNameCounter();
            pushImageHistory();
            if (onDuplicate) onDuplicate();
            if (onControlChange) onControlChange(readSeed(), readControls(), readCamera());
        });
    }

    // ── Reset ──

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            randomize();
        });
    }

    // ── Generate initial state ──
    updateAutoName();
    updateSlugDisplay();
    updateAltText();
    updateNameCounter();
    updateCommentaryCounter();
    updateActionButtons();
    pushImageHistory();

    // ── Public API ──

    function readCommentary() {
        return commentaryField ? commentaryField.value.trim() : '';
    }

    return {
        readSeed,
        readControls,
        readCamera,
        readName,
        readCommentary,
        randomize,
        pushImageHistory,
        setLocked,
        setUnlocked,
        get locked() { return locked; },

        /** Set all controls + seed + camera + name from external data. */
        setValues(seed, controls, camera, name) {
            if (seed && Array.isArray(seed)) {
                tagArrEl.value = String(seed[0]);
                tagStrEl.value = String(seed[1]);
                tagDetEl.value = String(seed[2]);
            }
            if (controls) {
                for (const key of SLIDER_KEYS) {
                    const ref = sliderInputs[key];
                    if (controls[key] !== undefined && ref) {
                        ref.range.value = String(controls[key]);
                        ref.valueEl.value = parseFloat(String(controls[key])).toFixed(2);
                    }
                }
            }
            if (camera) {
                for (const cam of CAMERA_SLIDERS) {
                    const ref = cameraInputs[cam.key];
                    if (camera[cam.key] !== undefined && ref) {
                        ref.range.value = String(camera[cam.key]);
                        ref.valueEl.value = formatValue(parseFloat(String(camera[cam.key])), cam.format, cam.step);
                    }
                }
            }
            if (name) {
                nameField.value = name;
                userEditedName = true;
            } else {
                userEditedName = false;
                updateAutoName();
            }
            updateSlugDisplay();
            updateAltText();
            updateNameCounter();
            updateCommentaryCounter();
        },

        /** Enable or disable the render button. */
        setRenderEnabled(enabled) {
            if (renderBtn) renderBtn.disabled = !enabled;
        },
    };
}

/**
 * Render the job queue list into a container element.
 * @param {HTMLElement} queueEl
 * @param {Array} jobs
 * @param {Object} opts
 * @param {Function} opts.onCancel — (jobId) => void
 * @param {Function} opts.onView   — (job) => void
 */
export function renderQueueUI(queueEl, jobs, opts = {}) {
    queueEl.innerHTML = '';

    if (jobs.length === 0) return;

    for (const job of jobs) {
        const item = document.createElement('div');
        item.className = 'gen-queue-item gen-queue-' + job.status;

        const info = document.createElement('div');
        info.className = 'gen-queue-info';

        const name = document.createElement('span');
        name.className = 'gen-queue-name';
        name.textContent = job.name;
        info.appendChild(name);

        if (job.status === 'rendering') {
            const bar = document.createElement('div');
            bar.className = 'gen-queue-bar';
            const fill = document.createElement('div');
            fill.className = 'gen-queue-bar-fill';
            fill.style.width = job.progress + '%';
            bar.appendChild(fill);
            info.appendChild(bar);

            const label = document.createElement('span');
            label.className = 'gen-queue-label';
            label.textContent = job.label || '';
            info.appendChild(label);
        } else if (job.status === 'queued') {
            const label = document.createElement('span');
            label.className = 'gen-queue-label';
            label.textContent = 'Queued';
            info.appendChild(label);
        } else if (job.status === 'complete') {
            const label = document.createElement('span');
            label.className = 'gen-queue-label gen-queue-complete-label';
            label.textContent = 'Complete';
            info.appendChild(label);
        } else if (job.status === 'failed') {
            const label = document.createElement('span');
            label.className = 'gen-queue-label gen-queue-failed-label';
            label.textContent = job.error || 'Failed';
            info.appendChild(label);
        }

        item.appendChild(info);

        // Action buttons
        const actions = document.createElement('div');
        actions.className = 'gen-queue-actions';

        if (job.status === 'queued') {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'gen-queue-btn';
            cancelBtn.textContent = '\u00d7'; // ×
            cancelBtn.title = 'Cancel';
            cancelBtn.addEventListener('click', () => {
                if (opts.onCancel) opts.onCancel(job.id);
            });
            actions.appendChild(cancelBtn);
        }

        if (job.status === 'complete') {
            const viewBtn = document.createElement('button');
            viewBtn.className = 'gen-queue-btn gen-queue-view-btn';
            viewBtn.textContent = 'View';
            viewBtn.addEventListener('click', () => {
                if (opts.onView) opts.onView(job);
            });
            actions.appendChild(viewBtn);
        }

        item.appendChild(actions);
        queueEl.appendChild(item);
    }
}
