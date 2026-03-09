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
 * @param {HTMLElement} [opts.slugDisplay]  — element to show URL-safe slug
 * @param {HTMLTextAreaElement} [opts.commentaryField] — commentary textarea
 * @param {HTMLElement} [opts.altTextField] — element to show auto-generated alt-text
 * @param {HTMLElement} [opts.nameCounter] — char counter for name
 * @param {HTMLElement} [opts.nameError] — validation error for name
 * @param {HTMLElement} [opts.commentaryCounter] — char counter for commentary
 */
export function initGeneratePanel(opts) {
    const {
        slidersEl, tagArrEl, tagStrEl, tagDetEl,
        nameField, saveBtn, resetBtn, randomizeBtn, renderBtn,
        onControlChange, onRender, onSave, slugDisplay, commentaryField,
        altTextField, nameCounter, nameError, commentaryCounter,
    } = opts;

    const sliderInputs = {};
    const cameraInputs = {};
    let userEditedName = false;

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

        targetMap[key] = input;

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
            controls[key] = parseFloat(sliderInputs[key].value);
        }
        return controls;
    }

    function readCamera() {
        return {
            rotation: parseFloat(cameraInputs.rotation.value),
            elevation: parseFloat(cameraInputs.elevation.value),
            zoom: parseFloat(cameraInputs.zoom.value),
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
        if (slugDisplay) slugDisplay.textContent = slugify(readName());
    }

    function updateAltText() {
        if (!altTextField) return;
        const controls = readControls();
        const nodeCount = Math.round(80 + (controls.density || 0.5) * 1400);
        const seed = readSeed();
        altTextField.textContent = generateAltText(controls, nodeCount, readName(), locale, seed);
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
        if (onControlChange) onControlChange(readSeed(), readControls(), readCamera());
    }

    tagArrEl.addEventListener('change', fireControlChange);
    tagStrEl.addEventListener('change', fireControlChange);
    tagDetEl.addEventListener('change', fireControlChange);

    nameField.addEventListener('input', () => {
        userEditedName = nameField.value.trim().length > 0;
        updateSlugDisplay();
        updateNameCounter();
    });

    if (commentaryField) {
        commentaryField.addEventListener('input', updateCommentaryCounter);
    }

    // ── Randomize ──

    function randomize() {
        tagArrEl.value = String(Math.floor(Math.random() * TAG_LIST_LENGTH));
        tagStrEl.value = String(Math.floor(Math.random() * TAG_LIST_LENGTH));
        tagDetEl.value = String(Math.floor(Math.random() * TAG_LIST_LENGTH));

        for (const key of SLIDER_KEYS) {
            const val = Math.random();
            sliderInputs[key].value = val.toFixed(2);
            const valueEl = sliderInputs[key].closest('.gen-slider-row').querySelector('.gen-slider-value');
            if (valueEl) valueEl.value = val.toFixed(2);
        }

        // Reset camera to defaults
        for (const cam of CAMERA_SLIDERS) {
            cameraInputs[cam.key].value = String(cam.defaultVal);
            const valueEl = cameraInputs[cam.key].closest('.gen-slider-row').querySelector('.gen-slider-value');
            if (valueEl) valueEl.value = formatValue(cam.defaultVal, cam.format, cam.step);
        }

        // Reset name to auto-generated
        userEditedName = false;
        fireControlChange();
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
            if (onSave) onSave(readSeed(), readControls(), readCamera(), readName());
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

        /** Set all controls + seed + camera + name from external data. */
        setValues(seed, controls, camera, name) {
            if (seed && Array.isArray(seed)) {
                tagArrEl.value = String(seed[0]);
                tagStrEl.value = String(seed[1]);
                tagDetEl.value = String(seed[2]);
            }
            if (controls) {
                for (const key of SLIDER_KEYS) {
                    if (controls[key] !== undefined && sliderInputs[key]) {
                        sliderInputs[key].value = String(controls[key]);
                        const valueEl = sliderInputs[key].closest('.gen-slider-row').querySelector('.gen-slider-value');
                        if (valueEl) valueEl.value = parseFloat(String(controls[key])).toFixed(2);
                    }
                }
            }
            if (camera) {
                for (const cam of CAMERA_SLIDERS) {
                    if (camera[cam.key] !== undefined && cameraInputs[cam.key]) {
                        cameraInputs[cam.key].value = String(camera[cam.key]);
                        const valueEl = cameraInputs[cam.key].closest('.gen-slider-row').querySelector('.gen-slider-value');
                        if (valueEl) valueEl.value = formatValue(parseFloat(String(camera[cam.key])), cam.format, cam.step);
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
