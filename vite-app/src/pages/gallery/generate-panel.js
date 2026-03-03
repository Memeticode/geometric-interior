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
 */
export function initGeneratePanel(opts) {
    const {
        slidersEl, tagArrEl, tagStrEl, tagDetEl,
        nameField, saveBtn, resetBtn, randomizeBtn, renderBtn,
        onControlChange, onRender, onSave,
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
        headerLabel.className = 'label-info';
        headerLabel.setAttribute('data-tooltip', t(`section.${sectionKey}.tooltip`));
        headerLabel.setAttribute('data-i18n', `section.${sectionKey}`);
        headerLabel.setAttribute('data-i18n-tooltip', `section.${sectionKey}.tooltip`);

        const headerIcon = document.createElement('span');
        headerIcon.className = 'info-icon';
        headerIcon.textContent = 'i';
        headerLabel.appendChild(headerIcon);
        headerLabel.appendChild(document.createTextNode(t(`section.${sectionKey}`)));

        const chevron = document.createElement('span');
        chevron.className = 'gen-chevron';
        chevron.innerHTML = '&#9662;';

        header.appendChild(headerLabel);
        header.appendChild(chevron);
        slidersEl.appendChild(header);

        // Collapsible rows container
        const rowsWrap = document.createElement('div');
        rowsWrap.className = 'gen-section-rows';
        rowsWrap.id = sectionId;

        for (const def of sliderDefs) {
            buildSliderRow(def.key, def.min, def.max, def.step, def.defaultVal, def.format, targetMap, rowsWrap);
        }

        slidersEl.appendChild(rowsWrap);

        // Toggle click
        header.addEventListener('click', () => {
            const expanded = header.getAttribute('aria-expanded') === 'true';
            header.setAttribute('aria-expanded', String(!expanded));
            rowsWrap.classList.toggle('collapsed', expanded);
        });
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
        labelText.appendChild(icon);
        labelText.appendChild(document.createTextNode(t(`control.${key}`)));

        const valueSpan = document.createElement('span');
        valueSpan.className = 'gen-slider-value';
        valueSpan.textContent = formatValue(defaultVal, format, step);

        labelWrap.appendChild(labelText);
        labelWrap.appendChild(valueSpan);

        const sliderWrap = document.createElement('div');
        sliderWrap.className = 'gen-slider-track';

        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(defaultVal);
        input.id = 'gen-' + key;

        input.addEventListener('input', () => {
            valueSpan.textContent = formatValue(parseFloat(input.value), format, step);
            fireControlChange();
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

    function fireControlChange() {
        updateAutoName();
        if (onControlChange) onControlChange(readSeed(), readControls(), readCamera());
    }

    tagArrEl.addEventListener('change', fireControlChange);
    tagStrEl.addEventListener('change', fireControlChange);
    tagDetEl.addEventListener('change', fireControlChange);

    nameField.addEventListener('input', () => {
        userEditedName = nameField.value.trim().length > 0;
    });

    // ── Randomize ──

    function randomize() {
        tagArrEl.value = String(Math.floor(Math.random() * TAG_LIST_LENGTH));
        tagStrEl.value = String(Math.floor(Math.random() * TAG_LIST_LENGTH));
        tagDetEl.value = String(Math.floor(Math.random() * TAG_LIST_LENGTH));

        for (const key of SLIDER_KEYS) {
            const val = Math.random();
            sliderInputs[key].value = val.toFixed(2);
            const valueSpan = sliderInputs[key].closest('.gen-slider-row').querySelector('.gen-slider-value');
            if (valueSpan) valueSpan.textContent = val.toFixed(2);
        }

        // Reset camera to defaults
        for (const cam of CAMERA_SLIDERS) {
            cameraInputs[cam.key].value = String(cam.defaultVal);
            const valueSpan = cameraInputs[cam.key].closest('.gen-slider-row').querySelector('.gen-slider-value');
            if (valueSpan) valueSpan.textContent = formatValue(cam.defaultVal, cam.format, cam.step);
        }

        // Reset name to auto-generated
        userEditedName = false;
        fireControlChange();
    }

    randomizeBtn.addEventListener('click', randomize);

    // ── Render ──

    renderBtn.addEventListener('click', () => {
        if (onRender) onRender(readSeed(), readControls(), readCamera(), readName());
    });

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

    // ── Generate initial auto-name ──
    updateAutoName();

    // ── Public API ──

    return {
        readSeed,
        readControls,
        readCamera,
        readName,
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
                        const valueSpan = sliderInputs[key].closest('.gen-slider-row').querySelector('.gen-slider-value');
                        if (valueSpan) valueSpan.textContent = parseFloat(String(controls[key])).toFixed(2);
                    }
                }
            }
            if (camera) {
                for (const cam of CAMERA_SLIDERS) {
                    if (camera[cam.key] !== undefined && cameraInputs[cam.key]) {
                        cameraInputs[cam.key].value = String(camera[cam.key]);
                        const valueSpan = cameraInputs[cam.key].closest('.gen-slider-row').querySelector('.gen-slider-value');
                        if (valueSpan) valueSpan.textContent = formatValue(parseFloat(String(camera[cam.key])), cam.format, cam.step);
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
        },

        /** Enable or disable the render button. */
        setRenderEnabled(enabled) {
            renderBtn.disabled = !enabled;
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
