/**
 * Resolution preference — localStorage-backed with custom event.
 */

import { initCustomDropdown } from '../components/custom-dropdown.js';

const STORAGE_KEY = 'geo-self-portrait-resolution';

const PRESETS = [
    { key: 'pre',   w: 420,  h: 270,  label: 'Pre'   },
    { key: 'sd',    w: 840,  h: 540,  label: 'SD'    },
    { key: 'hd',    w: 1400, h: 900,  label: 'HD'    },
    { key: 'fhd',   w: 1680, h: 1080, label: 'FHD'   },
    { key: 'qhd',   w: 2520, h: 1620, label: 'QHD'   },
    { key: '4k',    w: 3360, h: 2160, label: '4K'    },
];

const DEFAULT_KEY = 'sd';

export function getPresets() { return PRESETS; }

export function getResolution() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const p = PRESETS.find(p => p.key === stored);
            if (p) return { key: p.key, w: p.w, h: p.h };
        }
    } catch {}
    const def = PRESETS.find(p => p.key === DEFAULT_KEY);
    return { key: def.key, w: def.w, h: def.h };
}

export function setResolution(key) {
    const p = PRESETS.find(p => p.key === key);
    if (!p) return;
    try { localStorage.setItem(STORAGE_KEY, key); } catch {}
    document.dispatchEvent(new CustomEvent('resolutionchange', {
        detail: { key: p.key, w: p.w, h: p.h }
    }));
}

export function initResolutionSelector(dropdownEl) {
    if (!dropdownEl) return;
    const cur = getResolution();

    initCustomDropdown(dropdownEl, {
        initialValue: cur.key,
        onSelect(value) { setResolution(value); },
    });

    document.addEventListener('resolutionchange', (e) => {
        syncDropdown(dropdownEl, e.detail.key);
    });
}

/* ── Generate-panel resolution (independent, defaults to Pre) ── */

const GEN_STORAGE_KEY = 'geo-gen-resolution';
const GEN_DEFAULT_KEY = 'pre';

export function getGenResolution() {
    try {
        const stored = localStorage.getItem(GEN_STORAGE_KEY);
        if (stored) {
            const p = PRESETS.find(p => p.key === stored);
            if (p) return { key: p.key, w: p.w, h: p.h };
        }
    } catch {}
    const def = PRESETS.find(p => p.key === GEN_DEFAULT_KEY);
    return { key: def.key, w: def.w, h: def.h };
}

export function setGenResolution(key) {
    const p = PRESETS.find(p => p.key === key);
    if (!p) return;
    try { localStorage.setItem(GEN_STORAGE_KEY, key); } catch {}
    document.dispatchEvent(new CustomEvent('genresolutionchange', {
        detail: { key: p.key, w: p.w, h: p.h },
    }));
}

export function initGenResolutionSelector(dropdownEl) {
    if (!dropdownEl) return;
    const cur = getGenResolution();

    initCustomDropdown(dropdownEl, {
        initialValue: cur.key,
        onSelect(value) { setGenResolution(value); },
    });

    document.addEventListener('genresolutionchange', (e) => {
        syncDropdown(dropdownEl, e.detail.key);
    });
}

/**
 * Enable/disable resolution items in a dropdown based on available keys.
 * Items whose data-value is in `enabledKeys` are enabled; others are disabled.
 * @param {HTMLElement} dropdownEl
 * @param {Set<string>|string[]} enabledKeys
 */
export function setEnabledResolutions(dropdownEl, enabledKeys) {
    if (!dropdownEl) return;
    const keys = enabledKeys instanceof Set ? enabledKeys : new Set(enabledKeys);
    dropdownEl.querySelectorAll('.custom-dropdown-item').forEach(item => {
        const enabled = keys.has(item.dataset.value);
        item.classList.toggle('disabled', !enabled);
        item.setAttribute('aria-disabled', String(!enabled));
    });
}

/** Sync a dropdown's visual state to a resolution key. */
function syncDropdown(dropdownEl, activeKey) {
    const label = dropdownEl.querySelector('.custom-dropdown-label');
    const menu = dropdownEl.querySelector('.custom-dropdown-menu');
    if (menu) {
        menu.querySelectorAll('.custom-dropdown-item').forEach(item => {
            const isActive = item.dataset.value === activeKey;
            item.classList.toggle('active', isActive);
            item.setAttribute('aria-selected', String(isActive));
            if (isActive && label) label.textContent = item.textContent;
        });
    }
}
