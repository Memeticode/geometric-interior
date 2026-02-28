/**
 * Resolution preference — localStorage-backed with custom event.
 */

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

export function initResolutionSelector(selectEl) {
    if (!selectEl) return;
    const cur = getResolution();
    selectEl.value = cur.key;
    selectEl.addEventListener('change', () => setResolution(selectEl.value));
    document.addEventListener('resolutionchange', (e) => {
        selectEl.value = e.detail.key;
    });
}
