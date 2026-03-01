/**
 * Profile gallery — builds and manages the sidebar gallery of portrait
 * and user profile cards with thumbnails, reordering, and deletion.
 */

import { loadProfiles, saveProfiles, deleteProfile, loadPortraits, getPortraitNames, loadProfileOrder, saveProfileOrder, syncProfileOrder } from '../ui/profiles.js';
import { seedTagToLabel } from '../../lib/core/seed-tags.js';
import { getLocale } from '../i18n/locale.js';
import { slugify } from '../shared/slugify.js';
import { t } from '../i18n/locale.js';
import { TRASH_SVG, ARROW_UP_SVG, ARROW_DOWN_SVG } from '../shared/icons.js';

/**
 * @param {object} opts
 * @param {object} opts.el - DOM refs (portraitGallery, userGallery, activePreviewName, activePreviewSeed, activeStatusLabel, activePreviewThumb, profileNameField)
 * @param {object} opts.thumbRenderer - { queueThumbnail, cacheKey, cache, removeCachedThumb }
 * @param {Function} opts.getCurrentSeed
 * @param {Function} opts.readControlsFromUI
 * @param {Function} opts.getLoadedState - () => { name, isPortrait, dirty }
 * @param {Function} opts.onSelect - (profileName, isPortrait) → Promise — called when user clicks a card
 * @param {Function} opts.onDelete - (profileName) — called after a profile is deleted
 */
export function createProfileGallery({ el, thumbRenderer, getCurrentSeed, readControlsFromUI, getLoadedState, onSelect, onDelete }) {

    function moveProfile(name, dir) {
        const order = syncProfileOrder(loadProfiles());
        const idx = order.indexOf(name);
        if (idx < 0) return;
        const target = idx + dir;
        if (target < 0 || target >= order.length) return;
        [order[idx], order[target]] = [order[target], order[idx]];
        saveProfileOrder(order);
        refresh();
    }

    function clearActiveCards() {
        el.portraitGallery.querySelectorAll('.profile-card').forEach(c =>
            c.classList.remove('active-profile')
        );
        el.userGallery.querySelectorAll('.profile-card').forEach(c =>
            c.classList.remove('active-profile')
        );
    }

    function updateActivePreview() {
        const name = el.profileNameField.value.trim() || 'Untitled';
        const seed = getCurrentSeed();
        const state = getLoadedState();

        el.activePreviewName.textContent = name;
        el.activePreviewSeed.textContent = seedTagToLabel(seed, getLocale());

        let status;
        if (!state.name) {
            status = 'Unsaved';
        } else if (state.isPortrait) {
            status = state.dirty ? 'Portrait \u00b7 unsaved' : 'Portrait';
        } else {
            status = state.dirty ? 'User \u00b7 unsaved' : 'User';
        }
        el.activeStatusLabel.textContent = status;

        const controls = readControlsFromUI();
        thumbRenderer.queueThumbnail(seed || 'seed', controls, el.activePreviewThumb);
    }

    function buildProfileCard(name, p, { isPortrait = false, index = 0, total = 1 } = {}) {
        const card = document.createElement('div');
        card.className = 'profile-card';
        if (isPortrait) card.classList.add('portrait-card');
        card.dataset.profileName = name;

        const header = document.createElement('div');
        header.className = 'profile-card-header';

        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'thumb-wrap thumb-loading';
        const thumbImg = document.createElement('img');
        thumbImg.className = 'profile-thumb';
        thumbWrap.appendChild(thumbImg);
        header.appendChild(thumbWrap);

        if (isPortrait) {
            thumbImg.src = `/thumbs/${slugify(name)}.png`;
            thumbImg.onerror = () => {
                if (p.seed && p.controls) thumbRenderer.queueThumbnail(p.seed, p.controls, thumbImg);
            };
            thumbWrap.classList.remove('thumb-loading');
        } else if (p.seed && p.controls) {
            thumbRenderer.queueThumbnail(p.seed, p.controls, thumbImg);
        }

        const body = document.createElement('div');
        body.className = 'profile-card-body';

        const nm = document.createElement('div');
        nm.className = 'profile-card-name';
        nm.textContent = name;
        body.appendChild(nm);

        if (p.seed) {
            const seedEl = document.createElement('div');
            seedEl.className = 'profile-card-seed';
            seedEl.textContent = Array.isArray(p.seed) ? seedTagToLabel(p.seed) : p.seed;
            body.appendChild(seedEl);
        }

        header.appendChild(body);
        card.appendChild(header);

        // Action buttons (user profiles only)
        if (!isPortrait) {
            const actions = document.createElement('div');
            actions.className = 'profile-card-actions';

            const upBtn = document.createElement('button');
            upBtn.className = 'profile-card-move';
            upBtn.title = t('gallery.moveUp');
            upBtn.innerHTML = ARROW_UP_SVG;
            upBtn.disabled = index === 0 || total <= 1;
            upBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                moveProfile(card.dataset.profileName, -1);
            });

            const downBtn = document.createElement('button');
            downBtn.className = 'profile-card-move';
            downBtn.title = t('gallery.moveDown');
            downBtn.innerHTML = ARROW_DOWN_SVG;
            downBtn.disabled = index === total - 1 || total <= 1;
            downBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                moveProfile(card.dataset.profileName, 1);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'profile-card-delete';
            deleteBtn.title = t('gallery.deleteProfile');
            deleteBtn.innerHTML = TRASH_SVG;
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const realName = card.dataset.profileName;
                if (realName) {
                    const profiles = loadProfiles();
                    const pd = profiles[realName];
                    if (pd && pd.seed && pd.controls) {
                        thumbRenderer.removeCachedThumb(pd.seed, pd.controls);
                    }
                    deleteProfile(realName);
                    const order = loadProfileOrder();
                    if (order) {
                        saveProfileOrder(order.filter(n => n !== realName));
                    }
                    onDelete?.(realName);
                }
                refresh();
            });

            actions.appendChild(upBtn);
            actions.appendChild(downBtn);
            actions.appendChild(deleteBtn);
            card.appendChild(actions);
        }

        header.addEventListener('click', (e) => {
            if (e.target.closest('.profile-card-actions')) return;
            onSelect(card.dataset.profileName, isPortrait);
        });

        return card;
    }

    function refresh() {
        const state = getLoadedState();

        // Portraits section
        const portraits = loadPortraits();
        const portraitNames = Object.keys(portraits).sort((a, b) => a.localeCompare(b));
        el.portraitGallery.innerHTML = '';

        for (const name of portraitNames) {
            const card = buildProfileCard(name, portraits[name], { isPortrait: true });
            el.portraitGallery.appendChild(card);
            if (name === state.name && state.isPortrait) {
                card.classList.add('active-profile');
            }
        }

        // User profiles section (ordered)
        const profiles = loadProfiles();
        const userNames = syncProfileOrder(profiles);
        el.userGallery.innerHTML = '';

        if (userNames.length === 0) {
            const d = document.createElement('div');
            d.className = 'small';
            d.textContent = t('gallery.noSavedProfiles');
            el.userGallery.appendChild(d);
        }

        for (let i = 0; i < userNames.length; i++) {
            const name = userNames[i];
            const card = buildProfileCard(name, profiles[name], { index: i, total: userNames.length });
            el.userGallery.appendChild(card);
            if (name === state.name && !state.isPortrait) {
                card.classList.add('active-profile');
            }
        }

        updateActivePreview();
    }

    return {
        refresh,
        clearActiveCards,
        updateActivePreview,
    };
}
