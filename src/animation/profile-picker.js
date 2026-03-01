/**
 * Profile picker modal for the animation editor.
 * Shows available profiles in a grid; user clicks to select.
 */

import { t } from '../i18n/locale.js';
import { isSeedTag, seedTagToLabel } from '../../lib/core/seed-tags.js';
import { safeName } from '../export/export.js';

/**
 * Create a profile picker.
 *
 * @param {object} opts
 * @param {object} opts.portraits - portrait profiles { name: { seed, controls, camera } }
 * @param {function} opts.getUserProfiles - () => object - returns current user profiles
 * @param {function} opts.getThumbUrl - (name: string) => string|null
 * @param {string} [opts.locale] - current locale code
 * @returns {{ open(): Promise<profile|null>, close(): void }}
 */
export function createProfilePicker({ portraits, getUserProfiles, getThumbUrl, locale = 'en' }) {
    const modalEl = document.getElementById('profilePickerModal');
    const bodyEl = document.getElementById('profilePickerBody');
    const closeBtn = document.getElementById('profilePickerClose');

    let resolvePromise = null;

    function close() {
        modalEl.classList.add('hidden');
        if (resolvePromise) {
            resolvePromise(null);
            resolvePromise = null;
        }
    }

    closeBtn.addEventListener('click', close);
    modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) close();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modalEl.classList.contains('hidden')) {
            close();
        }
    });

    function renderGrid() {
        bodyEl.innerHTML = '';

        // Portraits section
        const portraitNames = Object.keys(portraits);
        if (portraitNames.length > 0) {
            const label = document.createElement('div');
            label.className = 'profile-picker-section-label';
            label.textContent = t('anim.portraits') || 'Portraits';
            bodyEl.appendChild(label);

            const grid = document.createElement('div');
            grid.className = 'profile-picker-grid';
            for (const name of portraitNames) {
                grid.appendChild(buildCell(name, portraits[name], true));
            }
            bodyEl.appendChild(grid);
        }

        // User profiles section
        const userProfiles = getUserProfiles();
        const userNames = Object.keys(userProfiles);
        if (userNames.length > 0) {
            const label = document.createElement('div');
            label.className = 'profile-picker-section-label';
            label.textContent = t('anim.saved') || 'Saved';
            bodyEl.appendChild(label);

            const grid = document.createElement('div');
            grid.className = 'profile-picker-grid';
            for (const name of userNames) {
                grid.appendChild(buildCell(name, userProfiles[name], false));
            }
            bodyEl.appendChild(grid);
        }
    }

    function buildCell(name, profile, isPortrait) {
        const cell = document.createElement('div');
        cell.className = 'profile-picker-cell';

        const thumb = document.createElement('img');
        thumb.className = 'profile-picker-thumb';
        thumb.alt = name;

        // Determine thumbnail URL
        if (isPortrait) {
            const slug = safeName(name.toLowerCase().replace(/\s+/g, '_'));
            thumb.src = `/thumbs/${slug}.png`;
        } else {
            const url = getThumbUrl(name);
            if (url) {
                thumb.src = url;
            } else {
                // Fallback: solid accent background
                thumb.style.background = 'var(--surface-active)';
            }
        }
        thumb.onerror = () => { thumb.style.background = 'var(--surface-active)'; thumb.src = ''; };

        cell.appendChild(thumb);

        const nameEl = document.createElement('span');
        nameEl.className = 'profile-picker-name';
        nameEl.textContent = name;
        cell.appendChild(nameEl);

        cell.addEventListener('click', () => {
            const seedLabel = isSeedTag(profile.seed)
                ? seedTagToLabel(profile.seed, locale)
                : (typeof profile.seed === 'string' ? profile.seed : '');

            if (resolvePromise) {
                resolvePromise({
                    name,
                    seed: profile.seed,
                    controls: profile.controls,
                    camera: profile.camera || { zoom: 1.0, rotation: 0 },
                    thumbUrl: thumb.src || null,
                    seedLabel,
                });
                resolvePromise = null;
            }
            modalEl.classList.add('hidden');
        });

        return cell;
    }

    return {
        open() {
            return new Promise((resolve) => {
                resolvePromise = resolve;
                renderGrid();
                modalEl.classList.remove('hidden');
            });
        },

        close,

        setLocale(loc) {
            locale = loc;
        },
    };
}
