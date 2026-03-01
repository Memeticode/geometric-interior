/**
 * Profile storage (localStorage) and loop list UI rendering.
 */

import starterProfiles from '../core/starter-profiles.json';
import { PRESETS } from '../../lib/core/palettes.js';
import { parseSeed } from '../../lib/core/seed-tags.js';
import { t } from '../i18n/locale.js';

const LS_KEY = 'geo_self_portrait_profiles_v3';

/**
 * Migrate a legacy profile (palette+paletteTweaks) to the new 10-axis format.
 * Returns the profile unchanged if already in new format.
 */
function migrateProfile(p) {
    if (!p || !p.controls) return p;
    // Already migrated?
    if ('hue' in p.controls && !('palette' in p.controls)) return p;

    const c = p.controls;
    const tweaks = p.paletteTweaks;

    // Determine hue/spectrum/chroma from paletteTweaks or palette preset
    let hue = 0.783, spectrum = 0.239, chroma = 0.417; // violet-depth defaults
    if (tweaks && tweaks.baseHue !== undefined) {
        hue = tweaks.baseHue / 360;
        spectrum = Math.sqrt(Math.max(0, (tweaks.hueRange - 10) / 350));
        const sat = tweaks.saturation;
        if (sat <= 0.65) {
            chroma = (sat - 0.05) / (2 * 0.60);
        } else {
            chroma = 0.5 + (sat - 0.65) / (2 * 0.35);
        }
        chroma = Math.max(0, Math.min(1, chroma));
    } else if (c.palette && c.palette !== 'custom') {
        const preset = PRESETS[c.palette];
        if (preset) {
            hue = preset.hue;
            spectrum = preset.spectrum;
            chroma = preset.chroma;
        }
    }

    // Build new controls
    const newControls = {
        topology: c.topology || 'flow-field',
        density: c.density ?? 0.5,
        luminosity: c.luminosity ?? 0.5,
        fracture: c.fracture ?? 0.5,
        coherence: c.coherence ?? 0.5,
        hue,
        spectrum,
        chroma,
        scale: 0.5,
        division: 0.5,
        faceting: 0.5,
        flow: 0.5,
    };

    return { seed: p.seed, controls: newControls };
}
const ORDER_KEY = 'geo_self_portrait_profile_order_v1';
const ANIM_LS_KEY = 'geo_self_portrait_anim_profiles_v1';

/* ---------------------------
 * Image profile CRUD
 * ---------------------------
 */

export function loadProfiles() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return {};
        // Migrate: move note → seed for legacy profiles
        let migrated = false;
        for (const p of Object.values(parsed)) {
            if (p.note && !p.seed) {
                p.seed = p.note;
                migrated = true;
            }
            if ('note' in p) {
                delete p.note;
                migrated = true;
            }
        }
        // Migrate: palette+paletteTweaks → hue/spectrum/chroma axes
        for (const [name, p] of Object.entries(parsed)) {
            if (p.controls && ('palette' in p.controls || 'depth' in p.controls)) {
                parsed[name] = migrateProfile(p);
                migrated = true;
            }
        }
        // Migrate: string seeds → seed tags
        for (const [name, p] of Object.entries(parsed)) {
            if (typeof p.seed === 'string') {
                p.seed = parseSeed(p.seed);
                migrated = true;
            }
        }
        if (migrated) localStorage.setItem(LS_KEY, JSON.stringify(parsed, null, 2));
        return parsed;
    } catch {
        return {};
    }
}

export function saveProfiles(profiles) {
    localStorage.setItem(LS_KEY, JSON.stringify(profiles, null, 2));
}

export function deleteProfile(name) {
    const profiles = loadProfiles();
    delete profiles[name];
    saveProfiles(profiles);
}

/* ---------------------------
 * Profile ordering
 * ---------------------------
 */

export function loadProfileOrder() {
    try {
        const raw = localStorage.getItem(ORDER_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch { return null; }
}

export function saveProfileOrder(order) {
    localStorage.setItem(ORDER_KEY, JSON.stringify(order));
}

/** Reconcile order array with actual profile keys. */
export function syncProfileOrder(profiles) {
    const keys = Object.keys(profiles);
    let order = loadProfileOrder();
    if (!order) {
        order = keys.sort((a, b) => a.localeCompare(b));
    } else {
        order = order.filter(n => keys.includes(n));
        for (const k of keys) {
            if (!order.includes(k)) order.push(k);
        }
    }
    saveProfileOrder(order);
    return order;
}

export function refreshProfileSelect(selectEl) {
    const profiles = loadProfiles();
    const names = Object.keys(profiles).sort((a, b) => a.localeCompare(b));

    selectEl.innerHTML = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = names.length ? t('profile.selectSaved') : t('profile.noProfilesYet');
    selectEl.appendChild(empty);

    for (const name of names) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        selectEl.appendChild(opt);
    }
}

/* ---------------------------
 * Animation profile CRUD
 * ---------------------------
 */

export function loadAnimProfiles() {
    try {
        const raw = localStorage.getItem(ANIM_LS_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return {};
        // Migrate: move note → seed for legacy profiles
        let migrated = false;
        for (const ap of Object.values(parsed)) {
            if (ap.note && !ap.seed) {
                ap.seed = ap.note;
                delete ap.note;
                migrated = true;
            }
        }
        if (migrated) localStorage.setItem(ANIM_LS_KEY, JSON.stringify(parsed, null, 2));
        return parsed;
    } catch {
        return {};
    }
}

export function saveAnimProfiles(profiles) {
    localStorage.setItem(ANIM_LS_KEY, JSON.stringify(profiles, null, 2));
}

export function deleteAnimProfile(name) {
    const profiles = loadAnimProfiles();
    delete profiles[name];
    saveAnimProfiles(profiles);
}

export function findAnimProfilesReferencingImage(imageName) {
    const animProfiles = loadAnimProfiles();
    const results = [];
    for (const [animName, profile] of Object.entries(animProfiles)) {
        if (profile.landmarks.includes(imageName)) {
            results.push({ animName, profile });
        }
    }
    return results;
}

export function removeImageFromAnimProfiles(imageName) {
    const animProfiles = loadAnimProfiles();
    let changed = false;
    for (const profile of Object.values(animProfiles)) {
        const filtered = profile.landmarks.filter(n => n !== imageName);
        if (filtered.length !== profile.landmarks.length) {
            profile.landmarks = filtered;
            changed = true;
        }
    }
    if (changed) saveAnimProfiles(animProfiles);
}

/* ---------------------------
 * Starter profiles
 * ---------------------------
 */

export function loadPortraits() {
    return structuredClone(starterProfiles);
}

export function getPortraitNames() {
    return Object.keys(starterProfiles);
}

export function ensureStarterProfiles() {
    // Migration: remove starter profiles from user storage only if identical to portrait
    // (preserves user-customized profiles that share a portrait name)
    const profiles = loadProfiles();
    const portraitNames = getPortraitNames();
    let changed = false;
    for (const name of portraitNames) {
        if (profiles[name]) {
            const p = profiles[name];
            const s = starterProfiles[name];
            const identical = JSON.stringify(p.seed) === JSON.stringify(s.seed) &&
                JSON.stringify(p.controls) === JSON.stringify(s.controls);
            if (identical) {
                delete profiles[name];
                changed = true;
            }
        }
    }
    if (changed) saveProfiles(profiles);

    const animProfiles = loadAnimProfiles();
    if (Object.keys(animProfiles).length === 0) {
        saveAnimProfiles({
            'Chromatic Cycle': {
                landmarks: ['Violet Sanctum', 'Amber Starburst', 'Teal Orbital', 'Emerald Radiance', 'Prismatic Scatter', 'Sapphire Lattice', 'Coral Breath', 'Spectral Drift'],
                durationMs: 7000,
                seed: [7, 6, 7],
            }
        });
    }
}

/**
 * Render the loop landmarks list into the given container element.
 * @param {HTMLElement} listEl - Container element for the list
 * @param {string[]} landmarks - Array of profile names in order
 * @param {object} profiles - Current profiles object from loadProfiles()
 * @param {object} callbacks - { onReorder(newLandmarks), onRemove(index) }
 * @param {function|null} [renderThumbnail] - optional (seed, controls, destImg) => void
 */
export function renderLoopList(listEl, landmarks, profiles, callbacks, renderThumbnail = null) {
    listEl.innerHTML = '';

    if (landmarks.length === 0) {
        const d = document.createElement('div');
        d.className = 'small';
        d.textContent = t('profile.addToLoop');
        listEl.appendChild(d);
        return;
    }

    landmarks.forEach((name, idx) => {
        const p = profiles[name];
        const div = document.createElement('div');
        div.className = 'item';

        const left = document.createElement('div');
        left.className = 'item-left';

        // Thumbnail image (rendered at full resolution, scaled down via CSS)
        if (renderThumbnail && p?.seed && p?.controls) {
            const thumbImg = document.createElement('img');
            thumbImg.className = 'loop-thumb';
            left.appendChild(thumbImg);
            renderThumbnail(p.seed, p.controls, thumbImg);
        }

        const nm = document.createElement('div');
        nm.className = 'name';
        nm.textContent = `${idx + 1}. ${name}`;
        div.appendChild(nm);

        // Details / missing-profile line (appended to card after controls)
        let detailsEl = null;
        if (p?.controls) {
            const c = p.controls;
            detailsEl = document.createElement('details');
            detailsEl.className = 'item-details';
            const summary = document.createElement('summary');
            summary.textContent = t('profile.details');
            const sub = document.createElement('div');
            sub.className = 'subline';
            sub.textContent = `${c.topology} \u00b7 den ${c.density.toFixed(2)} \u00b7 lum ${c.luminosity.toFixed(2)} \u00b7 frc ${c.fracture.toFixed(2)} \u00b7 coh ${c.coherence.toFixed(2)} \u00b7 hue ${c.hue.toFixed(2)} \u00b7 spc ${(c.spectrum ?? 0).toFixed(2)} \u00b7 chr ${(c.chroma ?? 0).toFixed(2)} \u00b7 scl ${(c.scale ?? 0.5).toFixed(2)} \u00b7 flw ${(c.flow ?? 0.5).toFixed(2)}`;
            detailsEl.appendChild(summary);
            detailsEl.appendChild(sub);
        } else {
            detailsEl = document.createElement('div');
            detailsEl.className = 'subline';
            detailsEl.textContent = t('profile.missingProfile');
        }

        const controls = document.createElement('div');
        controls.className = 'controls';

        const up = document.createElement('button');
        up.textContent = '\u2191';
        up.disabled = idx === 0;
        up.addEventListener('click', () => {
            const copy = landmarks.slice();
            [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
            callbacks.onReorder(copy);
        });

        const down = document.createElement('button');
        down.textContent = '\u2193';
        down.disabled = idx === landmarks.length - 1;
        down.addEventListener('click', () => {
            const copy = landmarks.slice();
            [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
            callbacks.onReorder(copy);
        });

        const remove = document.createElement('button');
        remove.textContent = '\u2715';
        remove.className = 'danger';
        remove.addEventListener('click', () => {
            callbacks.onRemove(idx);
        });

        controls.appendChild(up);
        controls.appendChild(down);
        controls.appendChild(remove);

        const right = document.createElement('div');
        right.className = 'item-right';
        right.appendChild(controls);
        if (detailsEl) right.appendChild(detailsEl);

        div.appendChild(left);
        div.appendChild(right);
        listEl.appendChild(div);
    });
}
