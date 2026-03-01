/**
 * Generate panel — configuration menu with sliders, seed tags, preview, and generate button.
 * Manages the UI state for the generation flow on the gallery page.
 */

import { t, getLocale } from '../i18n/locale.js';
import {
    TAG_LIST_LENGTH, seedTagToLabel, getLocalizedWords,
} from '../../lib/core/seed-tags.js';

/** Slider grouping: matches the 4 parameter sections from docs/parameters.md */
const SLIDER_GROUPS = [
    { key: 'geometry', sliders: ['density', 'fracture', 'scale', 'division', 'faceting'] },
    { key: 'light',    sliders: ['luminosity'] },
    { key: 'color',    sliders: ['hue', 'spectrum', 'chroma'] },
    { key: 'space',    sliders: ['coherence', 'flow'] },
];

/** Flat key list (derived from groups, used for readControls/setValues). */
const SLIDER_KEYS = SLIDER_GROUPS.flatMap(g => g.sliders);

/**
 * Initialize the generate panel.
 * @param {Object} opts
 * @param {HTMLElement} opts.slidersEl       — container for sliders
 * @param {HTMLSelectElement} opts.tagArrEl  — arrangement word select
 * @param {HTMLSelectElement} opts.tagStrEl  — structure word select
 * @param {HTMLSelectElement} opts.tagDetEl  — detail word select
 * @param {HTMLButtonElement} opts.randomizeBtn
 * @param {HTMLButtonElement} opts.generateBtn
 * @param {Function} opts.onControlChange   — (seed, controls) => void
 * @param {Function} opts.onGenerate        — (seed, controls) => void
 */
export function initGeneratePanel(opts) {
    const {
        slidersEl, tagArrEl, tagStrEl, tagDetEl,
        randomizeBtn, generateBtn,
        onControlChange, onGenerate,
    } = opts;

    const sliderInputs = {};

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

    // ── Build sliders (grouped by section) ──

    slidersEl.innerHTML = '';
    for (const group of SLIDER_GROUPS) {
        // Section header with (i) tooltip
        const header = document.createElement('div');
        header.className = 'gen-section-header';
        const headerLabel = document.createElement('span');
        headerLabel.className = 'label-info';
        headerLabel.setAttribute('data-tooltip', t(`section.${group.key}.tooltip`));
        headerLabel.setAttribute('data-i18n', `section.${group.key}`);
        headerLabel.setAttribute('data-i18n-tooltip', `section.${group.key}.tooltip`);
        headerLabel.textContent = t(`section.${group.key}`);
        const headerIcon = document.createElement('span');
        headerIcon.className = 'info-icon';
        headerIcon.textContent = 'i';
        headerLabel.appendChild(headerIcon);
        header.appendChild(headerLabel);
        slidersEl.appendChild(header);

        // Slider rows within this section
        for (const key of group.sliders) {
            const row = document.createElement('div');
            row.className = 'gen-slider-row';

            const labelWrap = document.createElement('label');
            labelWrap.className = 'gen-slider-label';

            const labelText = document.createElement('span');
            labelText.className = 'gen-slider-name label-info';
            labelText.textContent = t(`control.${key}`);
            labelText.setAttribute('data-tooltip', t(`control.${key}.tooltip`));
            labelText.setAttribute('data-i18n', `control.${key}`);
            labelText.setAttribute('data-i18n-tooltip', `control.${key}.tooltip`);
            const icon = document.createElement('span');
            icon.className = 'info-icon';
            icon.textContent = 'i';
            labelText.appendChild(icon);

            const valueSpan = document.createElement('span');
            valueSpan.className = 'gen-slider-value';
            valueSpan.textContent = '0.50';

            labelWrap.appendChild(labelText);
            labelWrap.appendChild(valueSpan);

            const sliderWrap = document.createElement('div');
            sliderWrap.className = 'gen-slider-track';

            const input = document.createElement('input');
            input.type = 'range';
            input.min = '0';
            input.max = '1';
            input.step = '0.01';
            input.value = '0.50';
            input.id = 'gen-' + key;

            input.addEventListener('input', () => {
                valueSpan.textContent = parseFloat(input.value).toFixed(2);
                fireControlChange();
            });

            sliderInputs[key] = input;

            sliderWrap.appendChild(input);
            row.appendChild(labelWrap);
            row.appendChild(sliderWrap);
            slidersEl.appendChild(row);
        }
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

    function fireControlChange() {
        if (onControlChange) onControlChange(readSeed(), readControls());
    }

    tagArrEl.addEventListener('change', fireControlChange);
    tagStrEl.addEventListener('change', fireControlChange);
    tagDetEl.addEventListener('change', fireControlChange);

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

        fireControlChange();
    }

    randomizeBtn.addEventListener('click', randomize);

    // ── Generate ──

    generateBtn.addEventListener('click', () => {
        if (onGenerate) onGenerate(readSeed(), readControls());
    });

    // ── Public API ──

    return {
        readSeed,
        readControls,
        randomize,

        /** Set all controls + seed from external data. */
        setValues(seed, controls) {
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
        },

        /** Enable or disable the generate button. */
        setGenerateEnabled(enabled) {
            generateBtn.disabled = !enabled;
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
