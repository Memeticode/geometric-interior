/**
 * Gallery page entry point.
 * Shows pre-cached profile thumbnails with selection + navigation to editor pages.
 * Fold animations play via pre-rendered sprite strip PNGs on a canvas overlay.
 * "Generate" mode activates an in-gallery config panel with live preview + render queue.
 *
 * Routes (client-side, history.pushState):
 *   /gallery/images                          — image gallery (default)
 *   /gallery/images/portraits/{slug}         — portrait selected
 *   /gallery/images/local/{slug}             — user profile selected
 *   /gallery/images/generated/{id}           — generated profile selected
 *   /gallery/animations                      — animation gallery (placeholder)
 */

import { initTheme } from '../ui/theme.js';
import { initLangSelector } from '../i18n/lang-selector.js';
import { initResolutionSelector } from '../ui/resolution.js';
import { initLocale, t, getLocale } from '../i18n/locale.js';
import { createFaviconAnimation } from '../ui/animated-favicon.js';
import { loadProfiles, loadPortraits, syncProfileOrder, deleteProfile, loadProfileOrder, saveProfileOrder } from '../ui/profiles.js';
import { getAllThumbs, deleteThumb } from '../ui/thumb-cache.js';
import { getAllAssets, getAsset, deleteAsset, getAllAnimAssets, deleteAnimAsset } from '../ui/asset-store.js';
import { getResolution } from '../ui/resolution.js';
import { generateTitle, generateAltText } from '../../lib/core/text.js';
import { xmur3, mulberry32 } from '../../lib/core/prng.js';
import { seedTagToLabel } from '../../lib/core/seed-tags.js';
import { initToastClose, toast } from '../shared/toast.js';
import { showConfirm } from '../shared/modals.js';
import { initStatementModal } from '../shared/statement.js';
import { slugify } from '../shared/slugify.js';
import { TRASH_SVG } from '../shared/icons.js';
import { initTooltips, refreshTooltip, hideTooltip } from '../shared/tooltips.js';
import { initGalleryWorker } from './gallery-worker-bridge.js';
import { createRenderQueue } from './render-queue.js';
import { initGeneratePanel, renderQueueUI } from './generate-panel.js';
import { initRenderQueueMenu } from './render-queue-menu.js';

/* ── Theme + Locale + Favicon ── */
initLocale();
initTheme(document.getElementById('themeSwitcher'));
initLangSelector(document.getElementById('langSelect'));
initResolutionSelector(document.getElementById('resolutionSelect'));
createFaviconAnimation();
initToastClose();
initTooltips();

/* ── Site menu toggle ── */
const siteMenuToggle = document.getElementById('siteMenuToggle');
const siteMenu = document.getElementById('siteMenu');
const siteMenuBackdrop = document.getElementById('siteMenuBackdrop');
const appContainer = document.querySelector('.app-container');

function openSiteMenu() {
    const header = document.querySelector('.app-header');
    if (header) {
        document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
    }
    siteMenu.classList.remove('site-menu-closed');
    siteMenu.setAttribute('aria-hidden', 'false');
    siteMenuBackdrop.classList.remove('hidden');
    siteMenuToggle.classList.add('menu-open');
    appContainer.classList.add('menu-push');
}

function closeSiteMenu() {
    siteMenu.classList.add('site-menu-closed');
    siteMenu.setAttribute('aria-hidden', 'true');
    siteMenuBackdrop.classList.add('hidden');
    siteMenuToggle.classList.remove('menu-open');
    appContainer.classList.remove('menu-push');
}

function isSiteMenuOpen() {
    return !siteMenu.classList.contains('site-menu-closed');
}

siteMenuToggle.addEventListener('click', () => {
    if (isSiteMenuOpen()) closeSiteMenu();
    else openSiteMenu();
});

siteMenuBackdrop.addEventListener('click', closeSiteMenu);

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

/* ── Settings group collapsible toggles ── */
document.querySelectorAll('.settings-group-header').forEach(header => {
    header.addEventListener('click', (e) => {
        // Don't toggle when clicking action buttons inside the header
        if (e.target.closest('button')) return;
        // Skip non-collapsible nav headers
        if (header.classList.contains('menu-nav-header')) return;
        const expanded = header.getAttribute('aria-expanded') === 'true';
        header.setAttribute('aria-expanded', String(!expanded));
        const body = header.nextElementSibling;
        if (body && body.classList.contains('settings-group-body')) {
            body.classList.toggle('collapsed', expanded);
        }
    });
});

/* ── SVG icons (imported from shared/icons.js) ── */

/* ── Thumbnail cache ── */
let thumbCache = new Map();

function thumbCacheKey(seed, controls) {
    return seed + '|' + JSON.stringify(controls);
}

/* ── DOM refs ── */
const selectedImage = document.getElementById('selectedImage');
const selectedImageWrap = document.getElementById('selectedImageWrap');
const selectedName = document.getElementById('selectedName');
const selectedSeed = document.getElementById('selectedSeed');
const selectedDisplay = document.getElementById('selectedDisplay');
const galleryContentEl = document.getElementById('galleryContent');
const selectedGenToggle = document.getElementById('selectedGenToggle');
const selectedGenTitle = document.getElementById('selectedGenTitle');
const selectedGenAlt = document.getElementById('selectedGenAlt');
const galleryArrowLeft = document.getElementById('galleryArrowLeft');
const galleryArrowRight = document.getElementById('galleryArrowRight');
const selectedVideo = document.getElementById('selectedVideo');

/* ── Carousel DOM refs ── */
const carouselTrack = document.getElementById('carouselTrack');
const viewAllToggle = document.getElementById('viewAllToggle');
const viewAllInline = document.getElementById('viewAllInline');
const viewAllGrid = document.getElementById('viewAllGrid');
const carouselStrip = document.querySelector('.carousel-strip');

/* ── Generate panel DOM refs ── */
const generatePanelEl = document.getElementById('generatePanel');
const genSlidersEl = document.getElementById('genSliders');
const genTagArrEl = document.getElementById('genTagArr');
const genTagStrEl = document.getElementById('genTagStr');
const genTagDetEl = document.getElementById('genTagDet');
const genRandomizeBtn = document.getElementById('genRandomizeBtn');
const genGenerateBtn = document.getElementById('genGenerateBtn');
const genPreviewCanvas = document.getElementById('genPreviewCanvas');
const genProgressOverlay = document.getElementById('genProgressOverlay');
const genProgressFill = document.getElementById('genProgressFill');
const genProgressLabel = document.getElementById('genProgressLabel');
const genQueueEl = document.getElementById('genQueue');
const animSectionEl = document.getElementById('animSection');
const animGalleryEl = document.getElementById('animGallery');
const carouselStripEl = carouselTrack.closest('.carousel-strip');

/* ── Generated text toggle ── */
selectedGenToggle.addEventListener('click', () => {
    const expanded = selectedGenToggle.getAttribute('aria-expanded') === 'true';
    selectedGenToggle.setAttribute('aria-expanded', String(!expanded));
    selectedGenAlt.classList.toggle('expanded', !expanded);
});

window.addEventListener('resize', () => {
    if (carouselCards.length) positionCards(carouselTrack, carouselCards, carouselCenterIdx, carouselList.length);
});

/* ── State ── */
let selected = { name: null, isPortrait: false };
let activeType = 'image'; // 'image' | 'animation'
let activeMode = 'gallery'; // 'gallery' | 'generate'
let navigableList = [];  // [{name, profile, isPortrait, assetId}] — all profiles in display order
let currentIndex = -1;

/* ── Carousel state ── */
let carouselList = [];       // [{name, profile, isPortrait, assetId?}] — portraits first, then local
let carouselCenterIdx = 0;
let carouselCards = [];      // [{element, index}]

/* ── Slideshow ── */
const slideshowBtn = document.getElementById('slideshowBtn');
const slideshowDuration = document.getElementById('slideshowDuration');
let slideshowTimer = null;
let slideshowPlaying = false;

const PLAY_SVG = '<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16"><path d="M5 3l8 5-8 5z"/></svg>';
const PAUSE_SVG = '<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16"><rect x="3" y="3" width="4" height="10" rx="1"/><rect x="9" y="3" width="4" height="10" rx="1"/></svg>';

function startSlideshow() {
    if (navigableList.length <= 1) return;
    slideshowPlaying = true;
    slideshowBtn.classList.add('slideshow-active');
    slideshowBtn.innerHTML = PAUSE_SVG;
    slideshowBtn.setAttribute('data-tooltip', 'Pause slideshow');
    slideshowBtn.setAttribute('aria-label', 'Pause slideshow');
    refreshTooltip(slideshowBtn);
    scheduleNextSlide();
}

function stopSlideshow() {
    slideshowPlaying = false;
    slideshowBtn.classList.remove('slideshow-active');
    slideshowBtn.innerHTML = PLAY_SVG;
    slideshowBtn.setAttribute('data-tooltip', 'Start slideshow');
    slideshowBtn.setAttribute('aria-label', 'Start slideshow');
    refreshTooltip(slideshowBtn);
    if (slideshowTimer) { clearTimeout(slideshowTimer); slideshowTimer = null; }
}

function scheduleNextSlide() {
    if (!slideshowPlaying) return;
    if (slideshowTimer) clearTimeout(slideshowTimer);
    const ms = parseInt(slideshowDuration.value, 10) * 1000;
    slideshowTimer = setTimeout(() => {
        slideshowTimer = null;
        if (!slideshowPlaying) return;
        navigateArrow(1);
        scheduleNextSlide();
    }, ms);
}

slideshowBtn.addEventListener('click', () => {
    if (slideshowPlaying) stopSlideshow();
    else startSlideshow();
});

/* ── Carousel engine ── */

function getVisibleCount() {
    const viewport = carouselTrack.parentElement;
    const cardW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-w')) || 180;
    const spacing = cardW * 0.6;
    const w = viewport ? viewport.clientWidth : window.innerWidth;
    const half = Math.floor((w - cardW) / (2 * spacing));
    return Math.max(3, 2 * Math.max(1, half) + 1);
}

/**
 * Position carousel cards with coverflow 3D transforms.
 * Centers the card at `centerIdx`, tilts neighbors, hides far-offscreen cards.
 */
function positionCards(trackEl, cards, centerIdx, total) {
    const visible = getVisibleCount();
    const half = Math.floor(visible / 2);
    trackEl.style.setProperty('--carousel-speed', '0.6s');

    const cardW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-w')) || 180;

    for (const { element, index } of cards) {
        let offset = index - centerIdx;
        // Wrap for circular navigation
        if (total > 1) {
            if (offset > total / 2) offset -= total;
            if (offset < -total / 2) offset += total;
        }
        const abs = Math.abs(offset);

        element.classList.remove('active');

        if (abs > half + 1) {
            element.style.setProperty('--card-opacity', '0');
            element.style.pointerEvents = 'none';
            element.style.zIndex = '0';
        } else if (offset === 0) {
            element.style.setProperty('--cx', '0px');
            element.style.setProperty('--ry', '0deg');
            element.style.setProperty('--tz', '40px');
            element.style.setProperty('--sc', '1');
            element.style.setProperty('--card-opacity', '1');
            element.style.zIndex = '10';
            element.style.pointerEvents = '';
            element.classList.add('active');
        } else {
            const cx = offset * (cardW * 0.6);
            const ry = offset > 0 ? -25 : 25;
            const tz = -abs * 20;
            const sc = Math.max(0.65, 1 - abs * 0.08);
            const opacity = abs <= half ? 1 : 0;

            element.style.setProperty('--cx', cx + 'px');
            element.style.setProperty('--ry', ry + 'deg');
            element.style.setProperty('--tz', tz + 'px');
            element.style.setProperty('--sc', String(sc));
            element.style.setProperty('--card-opacity', String(opacity));
            element.style.zIndex = String(Math.max(0, 10 - abs));
            element.style.pointerEvents = abs <= half ? '' : 'none';
        }
    }
}

/**
 * Build carousel card elements into a track element.
 */
function buildCarouselCards(list, trackEl, onCardClick) {
    trackEl.innerHTML = '';
    const cards = [];
    for (let i = 0; i < list.length; i++) {
        const entry = list[i];
        const card = document.createElement('div');
        card.className = 'carousel-card';
        card.dataset.profileName = entry.name;
        if (entry.assetId) card.dataset.assetId = entry.assetId;

        const imgWrap = document.createElement('div');
        imgWrap.className = 'carousel-card-img';
        const img = document.createElement('img');
        img.alt = entry.name;
        if (entry.assetId) {
            const asset = generatedAssets.find(a => a.id === entry.assetId);
            if (asset && asset.thumbDataUrl) img.src = asset.thumbDataUrl;
        } else {
            const src = getCarouselThumbSrc(entry.name, entry.profile, entry.isPortrait);
            if (src) img.src = src;
        }
        if (entry.isPortrait) {
            img.onerror = () => {
                if (entry.profile.seed && entry.profile.controls) {
                    const key = thumbCacheKey(entry.profile.seed, entry.profile.controls);
                    if (thumbCache.has(key)) img.src = thumbCache.get(key);
                }
            };
        }
        imgWrap.appendChild(img);
        card.appendChild(imgWrap);

        card.dataset.tooltip = entry.name;
        card.dataset.tooltipPos = 'above';

        card.addEventListener('click', () => onCardClick(i, entry));
        trackEl.appendChild(card);
        cards.push({ element: card, index: i });
    }
    return cards;
}

/**
 * Sync carousel position to match a selected profile.
 */
function syncCarouselToSelection(name, isPortrait, assetId) {
    const idx = carouselList.findIndex(e =>
        assetId ? e.assetId === assetId : e.name === name);
    if (idx >= 0) {
        carouselCenterIdx = idx;
        positionCards(carouselTrack, carouselCards, idx, carouselList.length);
    }
}

/* ── Generated assets ── */
let generatedAssets = []; // loaded from IndexedDB
let animAssets = [];      // animation assets from IndexedDB
let workerBridge = null;
let renderQueue = null;
let genPanel = null;
let generateInitialized = false;
let currentVideoUrl = null; // object URL for active video playback
let currentStaticUrl = null; // object URL for generated profile staticBlob display

/* ── Render queue site menu section ── */
function viewJob(job) {
    hideGenerateMode();
    activeMode = 'gallery';
    updateMenuNavLinks();
    if (job.asset) {
        if (job.jobType === 'animation') {
            activeType = 'animation';
            updateMenuNavLinks();
            animAssets = animAssets.filter(a => a.id !== job.asset.id);
            animAssets.unshift(job.asset);
            refreshGallery();
            applyAnimSelection(job.asset.id);
        } else {
            generatedAssets = generatedAssets.filter(a => a.id !== job.asset.id);
            generatedAssets.unshift(job.asset);
            refreshGallery();
            const profile = { seed: job.asset.seed, controls: job.asset.controls };
            selectProfile(job.asset.name, profile, false, job.asset.id);
        }
    }
}

const rqMenu = initRenderQueueMenu({
    groupEl: document.getElementById('rqGroup'),
    listEl: document.getElementById('rqJobList'),
    badgeEl: document.getElementById('renderQueueBadge'),
    clearBtn: document.getElementById('rqClearBtn'),
    onCancel(jobId) { if (renderQueue) renderQueue.cancel(jobId); },
    onClear() { if (renderQueue) renderQueue.clearFinished(); },
    onView: viewJob,
});

/* ── URL routing ── */

function parseRoute() {
    const path = window.location.pathname;
    if (path.startsWith('/gallery/animations')) return { type: 'animation', source: null, profileSlug: null };
    // /gallery/images/portraits/{slug} or /gallery/images/local/{slug} or /gallery/images/generated/{id}
    const match = path.match(/^\/gallery\/images\/(portraits|local|generated)\/(.+)$/);
    if (match) return { type: 'image', source: match[1], profileSlug: match[2] };
    return { type: 'image', source: null, profileSlug: null };
}

function pushRoute() {
    const url = activeType === 'animation' ? '/gallery/animations' : '/gallery/images';
    if (window.location.pathname !== url) {
        history.pushState({ type: activeType, profile: null }, '', url);
    }
}

function pushProfileRoute(name, isPortrait, assetId) {
    if (assetId) {
        const url = `/gallery/images/generated/${assetId}`;
        if (window.location.pathname !== url) {
            history.pushState({ type: 'image', profile: name, isPortrait: false, assetId }, '', url);
        }
    } else {
        const slug = slugify(name);
        const prefix = isPortrait ? 'portraits' : 'local';
        const url = `/gallery/images/${prefix}/${slug}`;
        if (window.location.pathname !== url) {
            history.pushState({ type: 'image', profile: name, isPortrait }, '', url);
        }
    }
}

function applyRoute() {
    const route = parseRoute();
    activeType = route.type;
    updateMenuNavLinks();

    if (activeType === 'image') {
        if (route.profileSlug) {
            const entry = findProfileBySlug(route.profileSlug, route.source);
            if (entry) {
                selected = { name: entry.name, isPortrait: entry.isPortrait, assetId: entry.assetId };
                showImageGallery();
                instantSelect(entry.name, entry.profile, entry.isPortrait, entry.assetId);
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
        showAnimationGallery();
    }
}

function findProfileBySlug(slug, source) {
    if (source !== 'local' && source !== 'generated') {
        const portraits = loadPortraits();
        for (const name of Object.keys(portraits)) {
            if (slugify(name) === slug) return { name, profile: portraits[name], isPortrait: true };
        }
    }
    if (source !== 'portraits' && source !== 'generated') {
        const profiles = loadProfiles();
        for (const name of Object.keys(profiles)) {
            if (slugify(name) === slug) return { name, profile: profiles[name], isPortrait: false };
        }
    }
    // Check generated assets by ID
    if (source !== 'portraits' && source !== 'local') {
        const asset = generatedAssets.find(a => a.id === slug);
        if (asset) {
            return {
                name: asset.name,
                profile: { seed: asset.seed, controls: asset.controls },
                isPortrait: false,
                isGenerated: true,
                assetId: asset.id,
                thumbDataUrl: asset.thumbDataUrl,
            };
        }
    }
    return null;
}

window.addEventListener('popstate', applyRoute);

/* ── Resolution change ── */
document.addEventListener('resolutionchange', (e) => {
    if (!workerBridge || !workerBridge.ready) return;
    if (currentIndex < 0 || currentIndex >= navigableList.length) return;
    if (activeMode !== 'gallery' || activeType !== 'image') return;

    const { profile } = navigableList[currentIndex];
    if (!profile || !profile.seed || !profile.controls) return;

    const { w, h } = e.detail;
    workerBridge.sendSnapshot({
        requestId: 'snap-' + Date.now(),
        seed: profile.seed,
        controls: profile.controls,
        locale: getLocale(),
        width: w,
        height: h,
    });
});

/* ── Text generation ── */

function generateProfileText(profile) {
    const c = profile.controls;
    if (!c) return { title: '', altText: '' };

    const seed = profile.seed || '';
    const titleRng = mulberry32(xmur3(seed + ':title')());
    const locale = getLocale();
    const title = generateTitle(c, titleRng, locale);

    const nodeCount = Math.round(80 + (c.density || 0.5) * 1400);
    const altText = generateAltText(c, nodeCount, title, locale);

    return { title, altText };
}

/* ── Thumbnail helpers ── */

/** Carousel thumbnail (always 280×180 PNG for fast loading) */
function getCarouselThumbSrc(name, profile, isPortrait) {
    if (isPortrait) return `/thumbs/${slugify(name)}.png`;
    if (profile.seed && profile.controls) {
        const key = thumbCacheKey(profile.seed, profile.controls);
        if (thumbCache.has(key)) return thumbCache.get(key);
    }
    return '';
}

/** Display image (PNG for portraits, ObjectURL for generated) */
function getDisplaySrc(name, profile, isPortrait) {
    if (isPortrait) {
        return `/thumbs/${slugify(name)}.png`;
    }
    if (profile.seed && profile.controls) {
        const key = thumbCacheKey(profile.seed, profile.controls);
        if (thumbCache.has(key)) return thumbCache.get(key);
    }
    return '';
}


/* ── Selection ── */

/**
 * Pure DOM update — sets image, name, seed, generated text, highlights card.
 * No animation, no history push.
 */
function applySelection(name, profile, isPortrait, assetId) {
    selected = { name, isPortrait, assetId };

    selectedName.textContent = name;
    selectedSeed.textContent = Array.isArray(profile.seed) ? seedTagToLabel(profile.seed) : (profile.seed || '');

    // Display full-resolution image
    if (currentStaticUrl) { URL.revokeObjectURL(currentStaticUrl); currentStaticUrl = null; }
    if (snapshotUrl) { URL.revokeObjectURL(snapshotUrl); snapshotUrl = null; }
    if (assetId) {
        // Generated profiles: load full-res staticBlob from IndexedDB
        const asset = generatedAssets.find(a => a.id === assetId);
        if (asset && asset.thumbDataUrl) selectedImage.src = asset.thumbDataUrl; // placeholder
        getAsset(assetId).then(full => {
            if (full && full.staticBlob && selected.assetId === assetId) {
                currentStaticUrl = URL.createObjectURL(full.staticBlob);
                selectedImage.src = currentStaticUrl;
            }
        });
    } else {
        const src = getDisplaySrc(name, profile, isPortrait);
        if (src) selectedImage.src = src;
    }

    if (isPortrait) {
        selectedImage.onerror = () => {
            selectedImage.onerror = null;
            // Fallback: try carousel PNG, then thumb cache
            const pngSrc = `/thumbs/${slugify(name)}.png`;
            selectedImage.src = pngSrc;
        };
    }

    // Use stored meta for generated profiles, else compute text
    if (assetId) {
        const asset = generatedAssets.find(a => a.id === assetId);
        if (asset && asset.meta) {
            selectedGenTitle.textContent = asset.meta.title || '';
            selectedGenAlt.textContent = asset.meta.altText || '';
            selectedImage.alt = asset.meta.title || name;
        }
    } else {
        const { title, altText } = generateProfileText(profile);
        selectedGenTitle.textContent = title;
        selectedGenAlt.textContent = altText;
        selectedImage.alt = title;
    }

    currentIndex = navigableList.findIndex(p =>
        assetId ? p.assetId === assetId : p.name === name
    );
    updateArrowStates();

    // Sync carousel to selected profile
    syncCarouselToSelection(name, isPortrait, assetId);
}

/**
 * Public entry point — applies selection + pushes browser history.
 */
function selectProfile(name, profile, isPortrait, assetId) {
    pushProfileRoute(name, isPortrait, assetId);
    applySelection(name, profile, isPortrait, assetId);
}

/**
 * Instant selection — used on popstate and initial load from URL.
 */
function instantSelect(name, profile, isPortrait, assetId) {
    applySelection(name, profile, isPortrait, assetId);
}

/* ── Arrow navigation ── */

function updateArrowStates() {
    const len = navigableList.length;
    const disabled = len <= 1;
    galleryArrowLeft.disabled = disabled;
    galleryArrowRight.disabled = disabled;

    if (!disabled && currentIndex >= 0) {
        const prevEntry = navigableList[(currentIndex - 1 + len) % len];
        const nextEntry = navigableList[(currentIndex + 1) % len];
        galleryArrowLeft.setAttribute('data-tooltip', prevEntry.name);
        galleryArrowRight.setAttribute('data-tooltip', nextEntry.name);
    } else {
        galleryArrowLeft.setAttribute('data-tooltip', '');
        galleryArrowRight.setAttribute('data-tooltip', '');
    }
}

function navigateArrow(direction) {
    if (navigableList.length <= 1) return;
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = navigableList.length - 1;
    if (newIndex >= navigableList.length) newIndex = 0;
    const entry = navigableList[newIndex];
    selectProfile(entry.name, entry.profile, entry.isPortrait, entry.assetId);
}

galleryArrowLeft.addEventListener('click', () => { if (slideshowPlaying) stopSlideshow(); navigateArrow(-1); });
galleryArrowRight.addEventListener('click', () => { if (slideshowPlaying) stopSlideshow(); navigateArrow(1); });

function navigateToEditor() {
    const params = new URLSearchParams();
    if (selected.name) {
        params.set('profile', selected.name);
        if (selected.isPortrait) params.set('source', 'portrait');
    }
    const page = activeType === 'animation' ? 'animation' : 'image';
    window.location.href = `/${page}.html?${params}`;
}

/* ── View All modal ── */

function isViewAllOpen() {
    return viewAllInline.classList.contains('expanded');
}

function flattenCards() {
    for (const { element } of carouselCards) {
        element.style.setProperty('--ry', '0deg');
        element.style.setProperty('--tz', '0px');
        element.style.setProperty('--sc', '0.45');
        element.style.setProperty('--card-opacity', '0');
        element.style.pointerEvents = 'none';
    }
    carouselStrip.classList.add('carousel-flattened');
}

function unflattenCards() {
    carouselStrip.classList.remove('carousel-flattened');
    positionCards(carouselTrack, carouselCards, carouselCenterIdx, carouselList.length);
}

function expandViewAll(list) {
    viewAllGrid.innerHTML = '';

    for (let i = 0; i < list.length; i++) {
        const entry = list[i];
        const card = document.createElement('div');
        card.className = 'view-all-card';
        const isSelected = entry.assetId
            ? selected.assetId === entry.assetId
            : selected.name === entry.name;
        if (isSelected) card.classList.add('selected');

        const img = document.createElement('img');
        img.alt = entry.name;
        if (entry.assetId) {
            const asset = generatedAssets.find(a => a.id === entry.assetId);
            if (asset && asset.thumbDataUrl) img.src = asset.thumbDataUrl;
        } else {
            const src = getCarouselThumbSrc(entry.name, entry.profile, entry.isPortrait);
            if (src) img.src = src;
        }
        if (entry.isPortrait) {
            img.onerror = () => {
                if (entry.profile.seed && entry.profile.controls) {
                    const key = thumbCacheKey(entry.profile.seed, entry.profile.controls);
                    if (thumbCache.has(key)) img.src = thumbCache.get(key);
                }
            };
        }
        card.appendChild(img);

        const nameEl = document.createElement('div');
        nameEl.className = 'view-all-card-name';
        nameEl.textContent = entry.name;
        card.appendChild(nameEl);

        // Delete action for non-portrait (local) profiles
        if (!entry.isPortrait) {
            const actions = document.createElement('div');
            actions.className = 'view-all-card-actions';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'view-all-delete';
            deleteBtn.innerHTML = TRASH_SVG;
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const deleteName = entry.name;
                const deleteAssetId = entry.assetId;
                showConfirm(
                    deleteAssetId ? 'Delete generated image?' : t('confirm.deleteProfile'),
                    deleteAssetId ? `Delete "${deleteName}"?` : t('confirm.deleteConfirm', { name: deleteName }),
                    [
                        { label: t('btn.cancel') },
                        {
                            label: t('btn.delete'), primary: true, callback: async () => {
                                if (deleteAssetId) {
                                    await deleteAsset(deleteAssetId);
                                    generatedAssets = generatedAssets.filter(a => a.id !== deleteAssetId);
                                } else {
                                    const pd = loadProfiles()[deleteName];
                                    if (pd && pd.seed && pd.controls) {
                                        const cacheKey = thumbCacheKey(pd.seed, pd.controls);
                                        thumbCache.delete(cacheKey);
                                        deleteThumb(cacheKey);
                                    }
                                    deleteProfile(deleteName);
                                    const order = loadProfileOrder();
                                    if (order) saveProfileOrder(order.filter(n => n !== deleteName));
                                }
                                collapseViewAll();
                                refreshGallery();
                            }
                        }
                    ]
                );
            });
            actions.appendChild(deleteBtn);
            card.appendChild(actions);
        }

        card.addEventListener('click', () => {
            const idx = carouselList.findIndex(e =>
                entry.assetId ? e.assetId === entry.assetId : e.name === entry.name);
            if (idx >= 0) {
                carouselCenterIdx = idx;
            }
            collapseViewAll();
            selectProfile(entry.name, entry.profile, entry.isPortrait, entry.assetId);
        });

        viewAllGrid.appendChild(card);
    }

    flattenCards();
    viewAllInline.classList.add('expanded');
    viewAllToggle.classList.add('active');
    viewAllInline.addEventListener('transitionend', () => {
        viewAllInline.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, { once: true });
}

function collapseViewAll() {
    if (!isViewAllOpen()) return;
    viewAllInline.classList.remove('expanded');
    viewAllToggle.classList.remove('active');
    unflattenCards();
}

viewAllToggle.addEventListener('click', () => {
    if (isViewAllOpen()) {
        collapseViewAll();
    } else {
        expandViewAll(carouselList);
    }
});

function refreshGallery() {
    if (isViewAllOpen()) collapseViewAll();
    if (activeType === 'image') {
        clearVideoPlayback();
        showImageGallery();
    } else {
        showAnimationGallery();
    }
}

function showImageGallery() {
    // Hide animation section, show carousel
    animSectionEl.style.display = 'none';
    if (carouselStripEl) carouselStripEl.style.display = '';

    // Build merged list: portraits first, then local
    const portraits = loadPortraits();
    const portraitNames = Object.keys(portraits).sort((a, b) => a.localeCompare(b));

    carouselList = portraitNames.map(name => ({
        name, profile: portraits[name], isPortrait: true
    }));

    // Append generated assets
    for (const asset of generatedAssets) {
        carouselList.push({
            name: asset.name,
            profile: { seed: asset.seed, controls: asset.controls },
            isPortrait: false,
            assetId: asset.id
        });
    }

    // Append user-saved profiles
    const profiles = loadProfiles();
    const userNames = syncProfileOrder(profiles);
    for (const name of userNames) {
        carouselList.push({ name, profile: profiles[name], isPortrait: false });
    }

    navigableList = carouselList;

    // Build single carousel
    carouselCards = buildCarouselCards(carouselList, carouselTrack, (idx, entry) => {
        if (idx === carouselCenterIdx) return;
        if (slideshowPlaying) stopSlideshow();
        carouselCenterIdx = idx;
        positionCards(carouselTrack, carouselCards, idx, carouselList.length);
        selectProfile(entry.name, entry.profile, entry.isPortrait, entry.assetId);
    });

    // Show/hide View All button
    viewAllToggle.style.display = carouselList.length > getVisibleCount() ? '' : 'none';

    // Auto-select first entry if nothing selected
    if (!selected.name && carouselList.length > 0) {
        const first = carouselList[0];
        carouselCenterIdx = 0;
        applySelection(first.name, first.profile, first.isPortrait, first.assetId);

        // Use replaceState so auto-select doesn't pollute history
        if (first.assetId) {
            history.replaceState({ type: 'image', profile: first.name }, '', `/gallery/images/generated/${first.assetId}`);
        } else {
            const slug = slugify(first.name);
            const prefix = first.isPortrait ? 'portraits' : 'local';
            history.replaceState({ type: 'image', profile: first.name }, '', `/gallery/images/${prefix}/${slug}`);
        }
    }

    positionCards(carouselTrack, carouselCards, carouselCenterIdx, carouselList.length);

    galleryContentEl.style.display = '';
    selectedDisplay.style.display = '';
}

/**
 * Show animation gallery — displays animation assets with video playback.
 */
function showAnimationGallery() {
    // Hide image carousel strip, show animation section
    if (carouselStripEl) carouselStripEl.style.display = 'none';
    carouselTrack.innerHTML = '';
    carouselCards = [];

    // Build animation cards
    animGalleryEl.innerHTML = '';
    if (animAssets.length > 0) {
        animSectionEl.style.display = '';
        for (const asset of animAssets) {
            animGalleryEl.appendChild(buildAnimCard(asset));
        }
    } else {
        animSectionEl.style.display = '';
        const d = document.createElement('div');
        d.className = 'small';
        d.textContent = 'No animations yet. Switch to Generate mode to create one.';
        animGalleryEl.appendChild(d);
    }

    // Build navigable list from animation assets
    navigableList = [];
    for (const asset of animAssets) {
        navigableList.push({
            name: asset.name,
            profile: { seed: null, controls: null },
            isPortrait: false,
            isAnimation: true,
            assetId: asset.id,
        });
    }

    // Auto-select first
    if (!selected.name && navigableList.length > 0) {
        const first = navigableList[0];
        applyAnimSelection(first.assetId);
    }

    galleryContentEl.style.display = '';
    selectedDisplay.style.display = animAssets.length > 0 ? '' : 'none';
}

/**
 * Build a gallery card for an animation asset.
 */
function buildAnimCard(asset) {
    const card = document.createElement('div');
    card.className = 'profile-card generated-card';
    if (selected.assetId === asset.id) card.classList.add('selected');
    card.dataset.profileName = asset.name;
    card.dataset.assetId = asset.id;

    const header = document.createElement('div');
    header.className = 'profile-card-header';

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'thumb-wrap';
    const thumbImg = document.createElement('img');
    thumbImg.className = 'profile-thumb';
    if (asset.thumbDataUrl) thumbImg.src = asset.thumbDataUrl;
    thumbWrap.appendChild(thumbImg);
    header.appendChild(thumbWrap);

    const body = document.createElement('div');
    body.className = 'profile-card-body';
    const nm = document.createElement('div');
    nm.className = 'profile-card-name';
    nm.textContent = asset.name;
    body.appendChild(nm);
    // Duration + fps label
    const meta = asset.meta || {};
    if (meta.durationS) {
        const dur = document.createElement('div');
        dur.className = 'profile-card-seed';
        dur.textContent = `${meta.durationS.toFixed(1)}s • ${meta.fps || 30}fps`;
        body.appendChild(dur);
    }
    header.appendChild(body);
    card.appendChild(header);

    // Actions: delete only
    const actions = document.createElement('div');
    actions.className = 'profile-card-actions';
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'profile-card-delete';
    deleteBtn.title = 'Delete';
    deleteBtn.innerHTML = TRASH_SVG;
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showConfirm('Delete animation?', `Delete "${asset.name}"?`, [
            { label: t('btn.cancel') },
            {
                label: t('btn.delete'), primary: true, callback: async () => {
                    await deleteAnimAsset(asset.id);
                    animAssets = animAssets.filter(a => a.id !== asset.id);
                    refreshGallery();
                }
            }
        ]);
    });
    actions.appendChild(deleteBtn);
    card.appendChild(actions);

    header.addEventListener('click', (e) => {
        if (e.target.closest('.profile-card-actions')) return;
        if (slideshowPlaying) stopSlideshow();
        applyAnimSelection(asset.id);
        pushProfileRoute(asset.name, false, asset.id);
    });

    return card;
}

/**
 * Apply animation selection — shows video player for the selected animation.
 */
function applyAnimSelection(assetId) {
    const asset = animAssets.find(a => a.id === assetId);
    if (!asset) return;

    selected = { name: asset.name, isPortrait: false, assetId, isAnimation: true };
    selectedName.textContent = asset.name;
    selectedSeed.textContent = '';

    const meta = asset.meta || {};
    selectedGenTitle.textContent = meta.title || asset.name;
    selectedGenAlt.textContent = meta.durationS
        ? `${meta.durationS.toFixed(1)}s animation at ${meta.fps || 30}fps (${meta.width || '?'}×${meta.height || '?'})`
        : '';

    // Show video, hide image
    if (asset.videoBlob) {
        if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
        currentVideoUrl = URL.createObjectURL(asset.videoBlob);
        selectedVideo.src = currentVideoUrl;
        selectedVideo.classList.remove('hidden');
        selectedImage.style.display = 'none';
    } else if (asset.thumbDataUrl) {
        // No video — show thumbnail
        selectedVideo.classList.add('hidden');
        selectedImage.style.display = '';
        selectedImage.src = asset.thumbDataUrl;
    }

    // Highlight card
    document.querySelectorAll('.gallery-page .profile-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.assetId === assetId);
    });

    currentIndex = navigableList.findIndex(p => p.assetId === assetId);
    updateArrowStates();
}

/**
 * Clear video playback state when switching away from animation.
 */
function clearVideoPlayback() {
    if (currentVideoUrl) {
        URL.revokeObjectURL(currentVideoUrl);
        currentVideoUrl = null;
    }
    selectedVideo.src = '';
    selectedVideo.classList.add('hidden');
    selectedImage.style.display = '';
}

/* ── Menu navigation links ── */

const menuNavLinks = document.querySelectorAll('.menu-nav-link');

function updateMenuNavLinks() {
    menuNavLinks.forEach(link => {
        const matches = link.dataset.navType === activeType && link.dataset.navMode === activeMode;
        link.classList.toggle('active', matches);
    });
}

function handleMenuNav(type, mode) {
    const typeChanged = type !== activeType;
    const modeChanged = mode !== activeMode;
    if (!typeChanged && !modeChanged) return;

    activeType = type;
    activeMode = mode;
    updateMenuNavLinks();

    if (modeChanged) {
        if (mode === 'generate') {
            showGenerateMode();
        } else {
            hideGenerateMode();
        }
    }

    if (typeChanged) {
        selected = { name: null, isPortrait: false };
        pushRoute();
        refreshGallery();
    }

    // Close menu on mobile only (desktop uses content-push, keep it open)
    if (window.innerWidth < 768) closeSiteMenu();
}

menuNavLinks.forEach(link => {
    link.addEventListener('click', () => {
        handleMenuNav(link.dataset.navType, link.dataset.navMode);
    });
});

/* ── Generate mode ── */

/**
 * Build a simple "expand → pause → collapse" Animation from seed + controls.
 * Used as the default animation when generating from the gallery panel.
 */
function buildSimpleAnimation(seed, controls) {
    const res = getResolution();
    return {
        settings: { fps: 30, width: res.w, height: res.h },
        events: [
            { type: 'expand', duration: 1.5, easing: 'ease-out', config: { ...controls }, seed },
            { type: 'pause', duration: 2.0, easing: 'linear' },
            { type: 'collapse', duration: 1.5, easing: 'ease-in' },
        ],
        cameraMoves: [],
        paramTracks: [],
    };
}

// Eagerly init worker bridge so snapshots work in gallery mode
workerBridge = initGalleryWorker(genPreviewCanvas);
if (workerBridge) {
    workerBridge.on('snapshot-complete', (msg) => {
        if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
        snapshotUrl = URL.createObjectURL(msg.blob);
        selectedImage.src = snapshotUrl;
    });
}
let snapshotUrl = null;

function initGenerate() {
    if (generateInitialized) return;
    generateInitialized = true;

    if (!workerBridge) {
        toast('WebGL worker not available');
        return;
    }

    genPanel = initGeneratePanel({
        slidersEl: genSlidersEl,
        tagArrEl: genTagArrEl,
        tagStrEl: genTagStrEl,
        tagDetEl: genTagDetEl,
        randomizeBtn: genRandomizeBtn,
        generateBtn: genGenerateBtn,
        onControlChange(seed, controls) {
            if (workerBridge && workerBridge.ready) {
                workerBridge.sendRender(seed, controls, getLocale());
            }
        },
        onGenerate(seed, controls) {
            if (!renderQueue) return;
            if (activeType === 'animation') {
                // Build a simple animation from the current config
                const animation = buildSimpleAnimation(seed, controls);
                renderQueue.enqueueAnimation(animation);
            } else {
                renderQueue.enqueue(seed, controls);
            }
        },
    });

    workerBridge.onReady(() => {
        renderQueue = createRenderQueue({
            workerBridge,
            onUpdate(jobs) {
                renderQueueUI(genQueueEl, jobs, {
                    onCancel(jobId) { renderQueue.cancel(jobId); },
                    onView: viewJob,
                });

                // Update header render queue menu
                if (rqMenu) rqMenu.update(jobs);

                // Update progress overlay
                const active = jobs.find(j => j.status === 'rendering');
                if (active) {
                    genProgressOverlay.classList.remove('hidden');
                    genProgressFill.style.width = active.progress + '%';
                    genProgressLabel.textContent = active.label || '';
                } else {
                    genProgressOverlay.classList.add('hidden');
                }
            },
            locale: getLocale(),
        });

        // Send initial preview render
        const seed = genPanel.readSeed();
        const controls = genPanel.readControls();
        workerBridge.sendRenderImmediate(seed, controls, getLocale());
    });
}

let modeTransitioning = false;

function showGenerateMode() {
    if (slideshowPlaying) stopSlideshow();
    if (modeTransitioning) return;
    initGenerate();
    modeTransitioning = true;

    // Phase 1: fade out gallery views
    selectedDisplay.classList.add('view-fade-out');
    galleryContentEl.classList.add('view-fade-out');

    setTimeout(() => {
        // Phase 2: swap visibility
        selectedDisplay.style.display = 'none';
        galleryContentEl.style.display = 'none';
        selectedDisplay.classList.remove('view-fade-out');
        galleryContentEl.classList.remove('view-fade-out');

        generatePanelEl.classList.remove('hidden');
        generatePanelEl.classList.add('view-fade-in');
        // force reflow
        generatePanelEl.offsetHeight;     // eslint-disable-line no-unused-expressions

        // Phase 3: fade in generate panel
        generatePanelEl.classList.remove('view-fade-in');
        modeTransitioning = false;
    }, 250);
}

function hideGenerateMode() {
    if (modeTransitioning) return;
    modeTransitioning = true;

    // Phase 1: fade out generate panel
    generatePanelEl.classList.add('view-fade-out');

    setTimeout(() => {
        // Phase 2: swap visibility
        generatePanelEl.classList.add('hidden');
        generatePanelEl.classList.remove('view-fade-out');

        selectedDisplay.style.display = '';
        galleryContentEl.style.display = '';
        selectedDisplay.classList.add('view-fade-in');
        galleryContentEl.classList.add('view-fade-in');
        // force reflow
        selectedDisplay.offsetHeight;     // eslint-disable-line no-unused-expressions

        // Phase 3: fade in gallery views
        selectedDisplay.classList.remove('view-fade-in');
        galleryContentEl.classList.remove('view-fade-in');
        modeTransitioning = false;
    }, 250);
}

/* ── Keyboard navigation ── */
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (isViewAllOpen()) {
            collapseViewAll();
            return;
        }
        if (isSiteMenuOpen()) {
            closeSiteMenu();
            return;
        }
        if (slideshowPlaying) {
            stopSlideshow();
            return;
        }
        if (activeMode === 'generate') {
            hideGenerateMode();
            activeMode = 'gallery';
            updateMenuNavLinks();
            return;
        }
        closeStatementModal();
        return;
    }
    if (activeType === 'image' && navigableList.length > 1) {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (slideshowPlaying) stopSlideshow();
            navigateArrow(-1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (slideshowPlaying) stopSlideshow();
            navigateArrow(1);
        }
    }
});

/* ── Init ── */

const route = parseRoute();
activeType = route.type;
updateMenuNavLinks();

if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
    history.replaceState({ type: 'image', profile: null }, '', '/gallery/images');
}

if (activeType === 'image' && route.profileSlug) {
    const entry = findProfileBySlug(route.profileSlug, route.source);
    if (entry) {
        // Pre-set selected so showImageGallery() skips auto-select
        selected = { name: entry.name, isPortrait: entry.isPortrait };
        showImageGallery();
        applySelection(entry.name, entry.profile, entry.isPortrait);
    } else {
        showImageGallery();
    }
} else {
    refreshGallery();
}

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

// Load generated assets from IndexedDB
getAllAssets().then(assets => {
    generatedAssets = assets;
    if (activeType === 'image' && assets.length > 0) refreshGallery();
}).catch(err => {
    console.warn('[gallery] IndexedDB asset store unavailable:', err);
});

// Load animation assets from IndexedDB
getAllAnimAssets().then(assets => {
    animAssets = assets;
    if (activeType === 'animation' && assets.length > 0) refreshGallery();
}).catch(err => {
    console.warn('[gallery] IndexedDB animation store unavailable:', err);
});

/* ── Share ── */

const shareBtn = document.getElementById('shareBtn');
const sharePopover = document.getElementById('sharePopover');

function getShareURL() {
    return window.location.origin + window.location.pathname;
}

function getShareTitle() {
    const name = selectedName.textContent.trim();
    return name ? `${name} — Geometric Interior` : 'Geometric Interior';
}

shareBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    hideTooltip();
    sharePopover.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
    if (!sharePopover.contains(e.target) && e.target !== shareBtn) {
        sharePopover.classList.add('hidden');
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sharePopover.classList.contains('hidden')) {
        sharePopover.classList.add('hidden');
        shareBtn.focus();
    }
});

document.getElementById('shareCopyLink').addEventListener('click', async () => {
    const url = getShareURL();
    try {
        await navigator.clipboard.writeText(url);
        toast(t('toast.linkCopied') || 'Link copied');
    } catch {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        toast(t('toast.linkCopiedShort') || 'Copied');
    }
    sharePopover.classList.add('hidden');
});

document.getElementById('shareDownloadPng').addEventListener('click', () => {
    const img = selectedImage;
    if (!img || !img.src) { toast('No image selected'); return; }
    const a = document.createElement('a');
    a.href = img.src;
    a.download = `${selectedName.textContent.trim() || 'image'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast(t('toast.visualExported') || 'Image downloaded');
    sharePopover.classList.add('hidden');
});

document.getElementById('shareTwitter').addEventListener('click', () => {
    const url = getShareURL();
    const title = getShareTitle();
    window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, '_blank', 'noopener,width=550,height=420');
    sharePopover.classList.add('hidden');
});

document.getElementById('shareFacebook').addEventListener('click', () => {
    const url = getShareURL();
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener,width=555,height=525');
    sharePopover.classList.add('hidden');
});

document.getElementById('shareBluesky').addEventListener('click', () => {
    const url = getShareURL();
    const title = getShareTitle();
    window.open(`https://bsky.app/intent/compose?text=${encodeURIComponent(`${title}\n${url}`)}`, '_blank', 'noopener,width=600,height=500');
    sharePopover.classList.add('hidden');
});

document.getElementById('shareReddit').addEventListener('click', () => {
    const url = getShareURL();
    const title = getShareTitle();
    window.open(`https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`, '_blank', 'noopener,width=700,height=600');
    sharePopover.classList.add('hidden');
});

document.getElementById('shareGoogle').addEventListener('click', () => {
    const url = getShareURL();
    window.open(`https://plus.google.com/share?url=${encodeURIComponent(url)}`, '_blank', 'noopener,width=600,height=500');
    sharePopover.classList.add('hidden');
});

document.getElementById('shareLinkedIn').addEventListener('click', () => {
    const url = getShareURL();
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank', 'noopener,width=600,height=550');
    sharePopover.classList.add('hidden');
});

document.getElementById('shareEmail').addEventListener('click', () => {
    const url = getShareURL();
    const title = getShareTitle();
    const body = `Check out this generative artwork:\n\n${url}`;
    window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`);
    sharePopover.classList.add('hidden');
});
