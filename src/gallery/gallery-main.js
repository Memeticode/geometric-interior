/**
 * Gallery page entry point.
 * Lightweight — no Three.js, no render worker, no canvas.
 * Shows pre-cached profile thumbnails with selection + navigation to editor pages.
 * Fold animations play via pre-rendered sprite strip PNGs on a canvas overlay.
 *
 * Routes (client-side, history.pushState):
 *   /gallery/images                          — image gallery (default)
 *   /gallery/images/portraits/{slug}         — portrait selected
 *   /gallery/images/local/{slug}             — user profile selected
 *   /gallery/animations                      — animation gallery (placeholder)
 *   /generate/image                          — navigates to image.html
 *   /generate/animation                      — navigates to animation.html
 */

import { initTheme } from '../ui/theme.js';
import { initLocale, t, getLocale } from '../i18n/locale.js';
import { initLangSelector } from '../i18n/lang-selector.js';
import { createFaviconAnimation } from '../ui/animated-favicon.js';
import { loadProfiles, loadPortraits, syncProfileOrder, deleteProfile, loadProfileOrder, saveProfileOrder } from '../ui/profiles.js';
import { getAllThumbs, deleteThumb } from '../ui/thumb-cache.js';
import { getPaletteDefaults, updatePalette } from '../../lib/core/palettes.js';
import { generateTitle, generateAltText } from '../../lib/core/text.js';
import { xmur3, mulberry32 } from '../../lib/core/prng.js';
import { initToastClose, toast } from '../shared/toast.js';
import { showConfirm } from '../shared/modals.js';
import { initStatementModal } from '../shared/statement.js';
import { slugify } from '../shared/slugify.js';

/* ── Theme + Locale + Favicon ── */
initLocale();
initTheme(document.getElementById('themeSwitcher'));
initLangSelector(document.getElementById('langSwitcher'));
createFaviconAnimation();
initToastClose();

/* ── Statement modal ── */
const { loadContent: loadStatementContent, closeStatementModal } = initStatementModal({
    statementModal: document.getElementById('statementModal'),
    statementModalClose: document.getElementById('statementModalClose'),
    statementTitle: document.getElementById('statementTitle'),
    statementTabSelect: document.getElementById('statementTabSelect'),
    developerBody: document.getElementById('developerBody'),
    artistBody: document.getElementById('artistBody'),
    governanceBody: document.getElementById('governanceBody'),
    developerStatement: document.getElementById('developerStatement'),
    artistStatement: document.getElementById('artistStatement'),
    governanceStatement: document.getElementById('governanceStatement'),
});

/* ── Gallery section toggles ── */
document.querySelectorAll('.gallery-section-header').forEach(header => {
    header.addEventListener('click', () => {
        const expanded = header.getAttribute('aria-expanded') === 'true';
        header.setAttribute('aria-expanded', String(!expanded));
        const targetId = header.dataset.target;
        if (targetId) {
            const target = document.getElementById(targetId);
            if (target) target.style.display = expanded ? 'none' : '';
        }
    });
});

/* ── SVG icons ── */
const TRASH_SVG = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0v-6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>';
const ARROW_UP_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l5-5 5 5"/></svg>';
const ARROW_DOWN_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l5 5 5-5"/></svg>';

/* ── Thumbnail cache ── */
let thumbCache = new Map();

function thumbCacheKey(seed, controls, paletteTweaks) {
    let k = seed + '|' + JSON.stringify(controls);
    if (paletteTweaks) k += '|' + JSON.stringify(paletteTweaks);
    return k;
}

/* ── DOM refs ── */
const portraitGalleryEl = document.getElementById('portraitGallery');
const userGalleryEl = document.getElementById('userGallery');
const selectedImage = document.getElementById('selectedImage');
const selectedImageWrap = document.getElementById('selectedImageWrap');
const selectedCanvas = document.getElementById('selectedCanvas');
const canvasCtx = selectedCanvas.getContext('2d');
const selectedName = document.getElementById('selectedName');
const selectedSeed = document.getElementById('selectedSeed');
const selectedDisplay = document.getElementById('selectedDisplay');
const galleryContentEl = document.getElementById('galleryContent');
const modeGroup = document.getElementById('modeGroup');
const typeGroup = document.getElementById('typeGroup');
const selectedGenTitle = document.getElementById('selectedGenTitle');
const selectedGenAlt = document.getElementById('selectedGenAlt');
const galleryArrowLeft = document.getElementById('galleryArrowLeft');
const galleryArrowRight = document.getElementById('galleryArrowRight');

/* ── Sliding underline ── */

function updateUnderline(group) {
    const active = group.querySelector('.nav-item.active');
    const underline = group.querySelector('.nav-underline');
    if (!active || !underline) return;
    const groupRect = group.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    underline.style.left = (activeRect.left - groupRect.left) + 'px';
    underline.style.width = activeRect.width + 'px';
}

function updateAllUnderlines() {
    updateUnderline(modeGroup);
    updateUnderline(typeGroup);
}

window.addEventListener('resize', updateAllUnderlines);

/* ── State ── */
let selected = { name: null, isPortrait: false };
let activeType = 'image'; // 'image' | 'animation'
let portraitList = [];   // [{name, profile}] sorted alphabetically
let currentIndex = -1;

/* ── URL routing ── */

function parseRoute() {
    const path = window.location.pathname;
    if (path.startsWith('/gallery/animations')) return { type: 'animation', source: null, profileSlug: null };
    // /gallery/images/portraits/{slug} or /gallery/images/local/{slug}
    const match = path.match(/^\/gallery\/images\/(portraits|local)\/(.+)$/);
    if (match) return { type: 'image', source: match[1], profileSlug: match[2] };
    return { type: 'image', source: null, profileSlug: null };
}

function pushRoute() {
    const url = activeType === 'animation' ? '/gallery/animations' : '/gallery/images';
    if (window.location.pathname !== url) {
        history.pushState({ type: activeType, profile: null }, '', url);
    }
}

function pushProfileRoute(name, isPortrait) {
    const slug = slugify(name);
    const prefix = isPortrait ? 'portraits' : 'local';
    const url = `/gallery/images/${prefix}/${slug}`;
    if (window.location.pathname !== url) {
        history.pushState({ type: 'image', profile: name, isPortrait }, '', url);
    }
}

function applyRoute() {
    const route = parseRoute();
    activeType = route.type;

    typeGroup.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === activeType);
    });

    if (activeType === 'image') {
        if (route.profileSlug) {
            const entry = findProfileBySlug(route.profileSlug, route.source);
            if (entry) {
                selected = { name: entry.name, isPortrait: entry.isPortrait };
                showImageGallery();
                instantSelect(entry.name, entry.profile, entry.isPortrait);
            } else {
                selected = { name: null, isPortrait: false };
                showImageGallery();
            }
        } else {
            selected = { name: null, isPortrait: false };
            showImageGallery();
        }
    } else {
        selected = { name: null, isPortrait: false };
        showAnimationPlaceholder();
    }

    requestAnimationFrame(updateAllUnderlines);
}

function findProfileBySlug(slug, source) {
    if (source !== 'local') {
        const portraits = loadPortraits();
        for (const name of Object.keys(portraits)) {
            if (slugify(name) === slug) return { name, profile: portraits[name], isPortrait: true };
        }
    }
    if (source !== 'portraits') {
        const profiles = loadProfiles();
        for (const name of Object.keys(profiles)) {
            if (slugify(name) === slug) return { name, profile: profiles[name], isPortrait: false };
        }
    }
    return null;
}

window.addEventListener('popstate', applyRoute);

/* ── Text generation ── */

function generateProfileText(profile) {
    const c = profile.controls;
    if (!c) return { title: '', altText: '' };

    const tweaks = profile.paletteTweaks || getPaletteDefaults(c.palette || 'violet-depth');
    if (c.palette === 'custom' && profile.paletteTweaks) {
        updatePalette('custom', profile.paletteTweaks);
    }

    const seed = profile.seed || '';
    const titleRng = mulberry32(xmur3(seed + ':title')());
    const locale = getLocale();
    const title = generateTitle(c, titleRng, locale);

    const nodeCount = Math.round(80 + (c.density || 0.5) * 1400);
    const altText = generateAltText(c, nodeCount, title, locale);

    return { title, altText };
}

/* ── Thumbnail helpers ── */

function getThumbSrc(name, profile, isPortrait) {
    if (isPortrait) {
        return `/thumbs/${slugify(name)}.png`;
    }
    if (profile.seed && profile.controls) {
        const tweaks = profile.paletteTweaks || getPaletteDefaults(profile.controls.palette || 'violet-depth');
        const key = thumbCacheKey(profile.seed, profile.controls, tweaks);
        if (thumbCache.has(key)) return thumbCache.get(key);
    }
    return '';
}

/* ── Fold animation sprite playback ── */

const FOLD_FRAMES = 60;
const FOLD_EXPAND_MS = 3000;
const FOLD_COLLAPSE_MS = 3000;

// Ease-out cubic: fast start, decelerates to a stop
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
// Ease-in cubic: slow start, accelerates
function easeInCubic(t) { return t * t * t; }
const spriteCache = new Map(); // slug → Image

let foldAnimating = false;
let pendingSelect = null;
let currentFoldSprite = null; // sprite for current profile (for collapse)
let foldAnimId = 0; // monotonic ID to cancel stale animations

function loadFoldSprite(slug) {
    if (spriteCache.has(slug)) return Promise.resolve(spriteCache.get(slug));
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => { spriteCache.set(slug, img); resolve(img); };
        img.onerror = () => resolve(null);
        img.src = `/thumbs/${slug}-fold.png`;
    });
}

function syncCanvasSize() {
    const rect = selectedImageWrap.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (selectedCanvas.width !== w || selectedCanvas.height !== h) {
        selectedCanvas.width = w;
        selectedCanvas.height = h;
    }
}

function showCanvas() { selectedCanvas.style.display = 'block'; }
function hideCanvas() { selectedCanvas.style.display = 'none'; }

/**
 * Play fold-expand: sprite frames 0→(N-1) with ease-out over 3s.
 * Starts fast, decelerates smoothly to the final state.
 */
function playFoldExpand(sprite) {
    return new Promise(resolve => {
        const myId = ++foldAnimId;
        const frameH = sprite.naturalHeight / FOLD_FRAMES;
        let startTime = null;

        function tick(timestamp) {
            if (myId !== foldAnimId) { resolve(); return; }
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const rawT = Math.min(elapsed / FOLD_EXPAND_MS, 1);
            const easedT = easeOutCubic(rawT);
            const frame = Math.min(Math.round(easedT * (FOLD_FRAMES - 1)), FOLD_FRAMES - 1);

            canvasCtx.clearRect(0, 0, selectedCanvas.width, selectedCanvas.height);
            canvasCtx.drawImage(
                sprite,
                0, frame * frameH, sprite.naturalWidth, frameH,
                0, 0, selectedCanvas.width, selectedCanvas.height
            );

            if (rawT < 1) {
                requestAnimationFrame(tick);
            } else {
                resolve();
            }
        }
        requestAnimationFrame(tick);
    });
}

/**
 * Play fold-collapse: sprite frames (N-1)→0 with ease-in over 3s.
 * Starts slow, accelerates into the folded state.
 */
function playFoldCollapse(sprite) {
    return new Promise(resolve => {
        const myId = ++foldAnimId;
        const frameH = sprite.naturalHeight / FOLD_FRAMES;
        let startTime = null;

        function tick(timestamp) {
            if (myId !== foldAnimId) { resolve(); return; }
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const rawT = Math.min(elapsed / FOLD_COLLAPSE_MS, 1);
            const easedT = easeInCubic(rawT);
            // Collapse: fold goes 1→0, so frame index goes (N-1)→0
            const frame = Math.max(Math.round((1 - easedT) * (FOLD_FRAMES - 1)), 0);

            canvasCtx.clearRect(0, 0, selectedCanvas.width, selectedCanvas.height);
            canvasCtx.drawImage(
                sprite,
                0, frame * frameH, sprite.naturalWidth, frameH,
                0, 0, selectedCanvas.width, selectedCanvas.height
            );

            if (rawT < 1) {
                requestAnimationFrame(tick);
            } else {
                resolve();
            }
        }
        requestAnimationFrame(tick);
    });
}

/**
 * Animated profile transition with pre-rendered fold sprite playback.
 */
async function animatedSelect(name, profile, isPortrait) {
    if (foldAnimating) {
        pendingSelect = { name, profile, isPortrait };
        return;
    }

    foldAnimating = true;
    const slug = slugify(name);
    const newSprite = isPortrait ? await loadFoldSprite(slug) : null;

    // Collapse current profile if one is displayed
    if (selected.name !== null && currentFoldSprite) {
        showCanvas();
        syncCanvasSize();
        await playFoldCollapse(currentFoldSprite);
    }

    // Check for newer pending selection
    if (pendingSelect) {
        const next = pendingSelect;
        pendingSelect = null;
        foldAnimating = false;
        animatedSelect(next.name, next.profile, next.isPortrait);
        return;
    }

    // Apply selection (sets img, text, highlights)
    applySelection(name, profile, isPortrait);
    currentFoldSprite = newSprite;

    // Expand new profile
    if (newSprite) {
        showCanvas();
        syncCanvasSize();
        await playFoldExpand(newSprite);
    }

    hideCanvas();
    foldAnimating = false;

    // Process any pending selection queued during expand
    if (pendingSelect) {
        const next = pendingSelect;
        pendingSelect = null;
        animatedSelect(next.name, next.profile, next.isPortrait);
    }
}

/* ── Selection ── */

/**
 * Pure DOM update — sets image, name, seed, generated text, highlights card.
 * No animation, no history push.
 */
function applySelection(name, profile, isPortrait) {
    selected = { name, isPortrait };

    selectedName.textContent = name;
    selectedSeed.textContent = profile.seed || '';

    const src = getThumbSrc(name, profile, isPortrait);
    if (src) {
        selectedImage.src = src;
    }

    if (isPortrait) {
        selectedImage.onerror = () => {
            selectedImage.onerror = null;
            if (profile.seed && profile.controls) {
                const tweaks = profile.paletteTweaks || getPaletteDefaults(profile.controls.palette || 'violet-depth');
                const key = thumbCacheKey(profile.seed, profile.controls, tweaks);
                if (thumbCache.has(key)) selectedImage.src = thumbCache.get(key);
            }
        };
    }

    const { title, altText } = generateProfileText(profile);
    selectedGenTitle.textContent = title;
    selectedGenAlt.textContent = altText;
    selectedImage.alt = title;

    currentIndex = portraitList.findIndex(p => p.name === name);
    updateArrowStates();

    document.querySelectorAll('.gallery-page .profile-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.profileName === name);
    });
}

/**
 * Public entry point — triggers fold animation + pushes browser history.
 */
function selectProfile(name, profile, isPortrait) {
    pushProfileRoute(name, isPortrait);
    animatedSelect(name, profile, isPortrait);
}

/**
 * Instant selection (no animation) — used on popstate and initial load from URL.
 */
function instantSelect(name, profile, isPortrait) {
    // Cancel any running fold animation
    foldAnimId++;
    foldAnimating = false;
    pendingSelect = null;
    hideCanvas();

    applySelection(name, profile, isPortrait);

    // Preload fold sprite for future collapse
    if (isPortrait) {
        loadFoldSprite(slugify(name)).then(sprite => { currentFoldSprite = sprite; });
    } else {
        currentFoldSprite = null;
    }
}

/* ── Arrow navigation ── */

function updateArrowStates() {
    const disabled = portraitList.length <= 1;
    galleryArrowLeft.disabled = disabled;
    galleryArrowRight.disabled = disabled;
}

function navigateArrow(direction) {
    if (portraitList.length <= 1) return;
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = portraitList.length - 1;
    if (newIndex >= portraitList.length) newIndex = 0;
    const entry = portraitList[newIndex];
    selectProfile(entry.name, entry.profile, true);
}

galleryArrowLeft.addEventListener('click', () => navigateArrow(-1));
galleryArrowRight.addEventListener('click', () => navigateArrow(1));

function navigateToEditor() {
    if (foldAnimating) return;
    const params = new URLSearchParams();
    if (selected.name) {
        params.set('profile', selected.name);
        if (selected.isPortrait) params.set('source', 'portrait');
    }
    const page = activeType === 'animation' ? 'animation' : 'image';
    window.location.href = `/${page}.html?${params}`;
}

/* ── Card building ── */

function buildCard(name, profile, { isPortrait = false, index = 0, total = 1 } = {}) {
    const card = document.createElement('div');
    card.className = 'profile-card';
    if (isPortrait) card.classList.add('portrait-card');
    if (selected.name === name) card.classList.add('selected');
    card.dataset.profileName = name;

    const header = document.createElement('div');
    header.className = 'profile-card-header';

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'thumb-wrap';
    const thumbImg = document.createElement('img');
    thumbImg.className = 'profile-thumb';
    thumbWrap.appendChild(thumbImg);
    header.appendChild(thumbWrap);

    const src = getThumbSrc(name, profile, isPortrait);
    if (src) thumbImg.src = src;
    if (isPortrait) {
        thumbImg.onerror = () => {
            if (profile.seed && profile.controls) {
                const tweaks = profile.paletteTweaks || getPaletteDefaults(profile.controls.palette || 'violet-depth');
                const key = thumbCacheKey(profile.seed, profile.controls, tweaks);
                if (thumbCache.has(key)) thumbImg.src = thumbCache.get(key);
            }
        };
    }

    const body = document.createElement('div');
    body.className = 'profile-card-body';
    const nm = document.createElement('div');
    nm.className = 'profile-card-name';
    nm.textContent = name;
    body.appendChild(nm);
    if (profile.seed) {
        const seedEl = document.createElement('div');
        seedEl.className = 'profile-card-seed';
        seedEl.textContent = profile.seed;
        body.appendChild(seedEl);
    }
    header.appendChild(body);
    card.appendChild(header);

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
            moveProfile(name, -1);
        });

        const downBtn = document.createElement('button');
        downBtn.className = 'profile-card-move';
        downBtn.title = t('gallery.moveDown');
        downBtn.innerHTML = ARROW_DOWN_SVG;
        downBtn.disabled = index === total - 1 || total <= 1;
        downBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            moveProfile(name, 1);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'profile-card-delete';
        deleteBtn.title = t('gallery.deleteProfile');
        deleteBtn.innerHTML = TRASH_SVG;
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showConfirm(t('confirm.deleteProfile'), t('confirm.deleteConfirm', { name }), [
                { label: t('btn.cancel') },
                {
                    label: t('btn.delete'), primary: true, callback: () => {
                        const profiles = loadProfiles();
                        const pd = profiles[name];
                        if (pd && pd.seed && pd.controls) {
                            const tweaks = pd.paletteTweaks || getPaletteDefaults(pd.controls.palette || 'violet-depth');
                            const cacheKey = thumbCacheKey(pd.seed, pd.controls, tweaks);
                            thumbCache.delete(cacheKey);
                            deleteThumb(cacheKey);
                        }
                        deleteProfile(name);
                        const order = loadProfileOrder();
                        if (order) saveProfileOrder(order.filter(n => n !== name));
                        refreshGallery();
                    }
                }
            ]);
        });

        actions.appendChild(upBtn);
        actions.appendChild(downBtn);
        actions.appendChild(deleteBtn);
        card.appendChild(actions);
    }

    header.addEventListener('click', (e) => {
        if (e.target.closest('.profile-card-actions')) return;
        selectProfile(name, profile, isPortrait);
    });

    return card;
}

function moveProfile(name, direction) {
    const order = loadProfileOrder() || [];
    const idx = order.indexOf(name);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= order.length) return;
    [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
    saveProfileOrder(order);
    refreshGallery();
}

function refreshGallery() {
    if (activeType === 'image') {
        showImageGallery();
    } else {
        showAnimationPlaceholder();
    }
}

function showImageGallery() {
    const portraits = loadPortraits();
    const portraitNames = Object.keys(portraits).sort((a, b) => a.localeCompare(b));

    portraitList = portraitNames.map(name => ({ name, profile: portraits[name] }));

    portraitGalleryEl.innerHTML = '';
    for (const name of portraitNames) {
        portraitGalleryEl.appendChild(buildCard(name, portraits[name], { isPortrait: true }));
    }

    const profiles = loadProfiles();
    const userNames = syncProfileOrder(profiles);
    userGalleryEl.innerHTML = '';

    if (userNames.length === 0) {
        const d = document.createElement('div');
        d.className = 'small';
        d.textContent = t('gallery.noSavedProfiles');
        userGalleryEl.appendChild(d);
    }

    for (let i = 0; i < userNames.length; i++) {
        const name = userNames[i];
        userGalleryEl.appendChild(buildCard(name, profiles[name], { index: i, total: userNames.length }));
    }

    // Auto-select first portrait if nothing selected
    if (!selected.name && portraitList.length > 0) {
        const first = portraitList[0];
        applySelection(first.name, first.profile, true);

        // Play fold-expand animation for initial portrait
        const slug = slugify(first.name);
        loadFoldSprite(slug).then(sprite => {
            if (sprite) {
                currentFoldSprite = sprite;
                showCanvas();
                syncCanvasSize();
                playFoldExpand(sprite).then(hideCanvas);
            }
        });

        // Use replaceState so auto-select doesn't pollute history
        const url = `/gallery/images/portraits/${slug}`;
        history.replaceState({ type: 'image', profile: first.name }, '', url);
    }

    galleryContentEl.style.display = '';
    selectedDisplay.style.display = '';
}

function showAnimationPlaceholder() {
    portraitGalleryEl.innerHTML = '';
    userGalleryEl.innerHTML = '';
    const d = document.createElement('div');
    d.className = 'small';
    d.textContent = t('gallery.animComingSoon');
    portraitGalleryEl.appendChild(d);

    galleryContentEl.style.display = '';
    selectedDisplay.style.display = 'none';
}

/* ── Nav toggle listeners ── */

modeGroup.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (mode === 'generate') {
            navigateToEditor();
            return;
        }
    });
});

typeGroup.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        if (type === activeType) return;
        activeType = type;
        typeGroup.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b === btn));
        updateUnderline(typeGroup);
        selected = { name: null, isPortrait: false };
        pushRoute();
        refreshGallery();
    });
});

selectedImageWrap.addEventListener('click', navigateToEditor);

/* ── Keyboard navigation ── */
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeStatementModal();
        return;
    }
    if (activeType === 'image' && portraitList.length > 1) {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navigateArrow(-1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            navigateArrow(1);
        }
    }
});

/* ── Init ── */

const route = parseRoute();
activeType = route.type;
typeGroup.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === activeType);
});

if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
    history.replaceState({ type: 'image', profile: null }, '', '/gallery/images');
}

if (activeType === 'image' && route.profileSlug) {
    showImageGallery();
    const entry = findProfileBySlug(route.profileSlug, route.source);
    if (entry) {
        applySelection(entry.name, entry.profile, entry.isPortrait);
        // Play fold-expand for direct URL load
        if (entry.isPortrait) {
            const slug = slugify(entry.name);
            loadFoldSprite(slug).then(sprite => {
                if (sprite) {
                    currentFoldSprite = sprite;
                    showCanvas();
                    syncCanvasSize();
                    playFoldExpand(sprite).then(hideCanvas);
                }
            });
        }
    }
} else {
    refreshGallery();
}

requestAnimationFrame(updateAllUnderlines);

loadStatementContent();

/* ── Locale change: re-render text and gallery on locale switch ── */
document.addEventListener('localechange', () => {
    document.title = t('page.gallery');
    refreshGallery();
    // Re-generate text for selected profile
    if (selected.name) {
        const profiles = { ...loadPortraits(), ...loadProfiles() };
        const profile = profiles[selected.name];
        if (profile) {
            const { title, altText } = generateProfileText(profile);
            selectedGenTitle.textContent = title;
            selectedGenAlt.textContent = altText;
            selectedImage.alt = title;
        }
    }
});

getAllThumbs().then(persisted => {
    thumbCache = persisted;
    if (activeType === 'image') refreshGallery();
}).catch(err => {
    console.warn('[gallery] IndexedDB thumb cache unavailable:', err);
});
