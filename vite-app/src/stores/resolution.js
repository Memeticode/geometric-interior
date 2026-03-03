/**
 * Resolution preference — localStorage-backed with custom event.
 */

import { initCustomDropdown } from '../components/custom-dropdown.js';

const STORAGE_KEY = 'geo-self-portrait-resolution';

const PRESETS = [
    { key: 'sd',  w: 840,  h: 540,  label: 'SD'  },
    { key: 'hd',  w: 1400, h: 900,  label: 'HD'  },
    { key: 'fhd', w: 1680, h: 1080, label: 'FHD' },
    { key: 'qhd', w: 2520, h: 1620, label: 'QHD' },
    { key: '4k',  w: 3360, h: 2160, label: '4K'  },
];

const DEFAULT_KEY = 'hd';

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
        const label = dropdownEl.querySelector('.custom-dropdown-label');
        const menu = dropdownEl.querySelector('.custom-dropdown-menu');
        if (menu) {
            menu.querySelectorAll('.custom-dropdown-item').forEach(item => {
                const isActive = item.dataset.value === e.detail.key;
                item.classList.toggle('active', isActive);
                item.setAttribute('aria-selected', String(isActive));
                // Use the item's own text so it matches the dropdown's format
                if (isActive && label) label.textContent = item.textContent;
            });
        }
    });
}
