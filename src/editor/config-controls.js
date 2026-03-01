/**
 * Config controls — reads/writes seed tags, camera, sliders, and topology
 * from/to the editor UI. Pure UI layer with no rendering or state management.
 */

import { seedTagToLabel, parseSeed, getLocalizedWords } from '../../lib/core/seed-tags.js';
import { getLocale } from '../i18n/locale.js';

export const SLIDER_KEYS = ['density', 'luminosity', 'fracture', 'coherence', 'hue', 'spectrum', 'chroma', 'scale', 'division', 'faceting', 'flow'];
export const TOPOLOGY_VALUES = ['flow-field', 'icosahedral', 'mobius', 'multi-attractor'];
export const CAMERA_DEFAULTS = { zoom: 1.0, rotation: 0 };

/**
 * @param {object} el - DOM element refs (must include slider, seed tag, camera, topology elements)
 */
export function createConfigControls(el) {

    /* ── Seed tags ── */

    function getCurrentSeed() {
        return [
            parseInt(el.seedTagArr.value, 10),
            parseInt(el.seedTagStr.value, 10),
            parseInt(el.seedTagDet.value, 10),
        ];
    }

    function setSeedInUI(seed) {
        const tag = Array.isArray(seed) ? seed : parseSeed(seed);
        el.seedTagArr.value = String(tag[0]);
        el.seedTagStr.value = String(tag[1]);
        el.seedTagDet.value = String(tag[2]);
    }

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

    /* ── Camera ── */

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

    /* ── Topology ── */

    function setTopologyUI(value) {
        el.topology.value = value;
        const tiles = el.topologySelector.querySelectorAll('.topo-tile');
        tiles.forEach(t => {
            t.classList.toggle('active', t.dataset.value === value);
        });
    }

    function initTopologySelector(onChange) {
        const tiles = el.topologySelector.querySelectorAll('.topo-tile');
        tiles.forEach(tile => {
            tile.addEventListener('click', () => {
                tiles.forEach(t => t.classList.remove('active'));
                tile.classList.add('active');
                el.topology.value = tile.dataset.value;
                onChange();
            });
        });
    }

    /* ── Slider controls ── */

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

    /* ── Display fields ── */

    function syncDisplayFields() {
        el.displayName.textContent = el.profileNameField.value.trim();
        el.displayIntent.textContent = seedTagToLabel(getCurrentSeed(), getLocale());
    }

    return {
        getCurrentSeed,
        setSeedInUI,
        initSeedTagSelects,
        readCameraFromUI,
        setCameraInUI,
        updateCameraLabels,
        readControlsFromUI,
        updateSliderLabels,
        setControlsInUI,
        setTopologyUI,
        initTopologySelector,
        syncDisplayFields,
        SLIDER_KEYS,
        CAMERA_DEFAULTS,
    };
}
