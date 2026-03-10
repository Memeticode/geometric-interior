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

import '../../components/carousel-dropdown-browser.js';
import { createHeader } from '../../components/create-header.js';
import { createFooter } from '../../components/create-footer.js';
import { initApp } from '../../components/app-init.js';
import { initTheme } from '../../stores/theme.js';
import { initLangSelector } from '../../i18n/lang-selector.js';
import { initResolutionSelector, getResolution, getGenResolution, initGenResolutionSelector } from '../../stores/resolution.js';
import { t, getLocale } from '../../i18n/locale.js';
import { loadProfiles, loadPortraits, getPortraitNames, loadPortraitSections, syncProfileOrder, deleteProfile, loadProfileOrder, saveProfileOrder, saveProfiles } from '../../stores/profiles.js';
import { getAllThumbs, deleteThumb } from '../../stores/thumb-cache.js';
import { getAllAssets, getAsset, deleteAsset, getAllAnimAssets, deleteAnimAsset } from '../../stores/asset-store.js';
import { generateTitle } from '@geometric-interior/core/text-generation/title-text.js';
import { generateAltText } from '@geometric-interior/core/text-generation/alt-text.js';
import { xmur3, mulberry32 } from '@geometric-interior/utils/prng.js';
import { seedTagToLabel } from '@geometric-interior/core/text-generation/seed-tags.js';
import { toast } from '../../components/toast.js';
import { showConfirm } from '../../components/modals.js';
import { slugify } from '../../components/slugify.js';
import { TRASH_SVG } from '../../components/icons.js';
import { refreshTooltip } from '../../components/tooltips.js';
import { initSharePopover } from '../../components/share-popover.js';
import { initGalleryWorker } from './gallery-worker-bridge.js';
import { createRenderQueue } from './render-queue.js';
import { initGeneratePanel, renderQueueUI } from './generate-panel.js';
import { initRenderQueueMenu } from './render-queue-menu.js';
import { initCustomDropdown } from '../../components/custom-dropdown.js';

/* ── Build header & footer DOM ── */
createHeader(document.querySelector('.app-header'), { page: 'gallery' });
const footerRefs = createFooter(document.querySelector('.app-footer'), { page: 'gallery' });

/* ── Shared init (locale, tooltips, toast, statement modal, favicon) ── */
const { statement } = initApp({ page: 'gallery' });

/* ── Gallery-specific init ── */
initTheme(footerRefs.themeSwitcher);
initLangSelector(footerRefs.langDropdown);
initResolutionSelector(document.getElementById('resolutionDropdown'));
initGenResolutionSelector(document.getElementById('genResolutionDropdown'));
initCustomDropdown(document.getElementById('slideshowDropdown'), {
    initialValue: '2',
    onSelect(value) {
        // Sync gen slideshow dropdown to same interval
        syncGenSlideshowInterval(value);
        if (slideshowPlaying) {
            restartRingAnimation();
            if (slideshowTimer) { clearTimeout(slideshowTimer); slideshowTimer = null; }
            scheduleNextSlide();
        }
    },
});
initCustomDropdown(document.getElementById('genSlideshowDropdown'), {
    initialValue: '2',
    onSelect(value) {
        // Sync gallery slideshow dropdown to same interval
        syncGallerySlideshowInterval(value);
        if (slideshowPlaying) {
            restartRingAnimation();
            if (slideshowTimer) { clearTimeout(slideshowTimer); slideshowTimer = null; }
            scheduleNextSlide();
        }
    },
});

/* ── Site menu toggle ── */
const siteMenuToggle = document.getElementById('siteMenuToggle');
const siteMenu = document.getElementById('siteMenu');
const siteMenuBackdrop = document.getElementById('siteMenuBackdrop');
const appContainer = document.querySelector('.app-container');

const MENU_STATE_KEY = 'geo-site-menu-open';

function openSiteMenu() {
    const header = document.querySelector('.app-header');
    if (header) {
        document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
    }
    siteMenu.classList.remove('site-menu-closed');
    siteMenu.setAttribute('aria-hidden', 'false');
    siteMenuBackdrop.classList.remove('hidden');
    siteMenuToggle.classList.add('menu-open');
    siteMenuToggle.setAttribute('data-tooltip', 'Close menu');
    siteMenuToggle.setAttribute('aria-label', 'Close menu');
    refreshTooltip(siteMenuToggle);
    appContainer.classList.add('menu-push');
    localStorage.setItem(MENU_STATE_KEY, '1');
}

function closeSiteMenu() {
    siteMenu.classList.add('site-menu-closed');
    siteMenu.setAttribute('aria-hidden', 'true');
    siteMenuBackdrop.classList.add('hidden');
    siteMenuToggle.classList.remove('menu-open');
    siteMenuToggle.setAttribute('data-tooltip', 'Open menu');
    siteMenuToggle.setAttribute('aria-label', 'Open menu');
    refreshTooltip(siteMenuToggle);
    appContainer.classList.remove('menu-push');
    localStorage.setItem(MENU_STATE_KEY, '0');
}

// Restore menu state from previous session (skip transition)
if (localStorage.getItem(MENU_STATE_KEY) === '1') {
    siteMenu.style.transition = 'none';
    siteMenuBackdrop.style.transition = 'none';
    appContainer.style.setProperty('--menu-restore', '1');
    const main = document.querySelector('.gallery-main');
    const footer = document.querySelector('.app-footer');
    if (main) main.style.transition = 'none';
    if (footer) footer.style.transition = 'none';
    openSiteMenu();
    // Force layout then re-enable transitions
    siteMenu.offsetHeight; // eslint-disable-line no-unused-expressions
    siteMenu.style.transition = '';
    siteMenuBackdrop.style.transition = '';
    if (main) main.style.transition = '';
    if (footer) footer.style.transition = '';
}

function isSiteMenuOpen() {
    return !siteMenu.classList.contains('site-menu-closed');
}

siteMenuToggle.addEventListener('click', () => {
    if (isSiteMenuOpen()) closeSiteMenu();
    else openSiteMenu();
});

siteMenuBackdrop.addEventListener('click', closeSiteMenu);

/* ── Statement modal (initialized by initApp) ── */
const { loadContent: loadStatementContent, closeStatementModal } = statement;

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
const selectedHeaderText = document.querySelector('.selected-header-text');
const selectedFooter = document.querySelector('.selected-footer');

/* ── Carousel component ── */
const carouselBrowser = document.getElementById('carouselBrowser');
const galleryMainEl = document.querySelector('.gallery-main');


/* ── Generate panel DOM refs ── */
const generatePanelEl = document.getElementById('generatePanel');
const genSlidersEl = document.getElementById('genSliders');
const genTagArrEl = document.getElementById('genTagArr');
const genTagStrEl = document.getElementById('genTagStr');
const genTagDetEl = document.getElementById('genTagDet');
const genNameField = document.getElementById('genNameField');
const genSaveBtn = document.getElementById('genSaveBtn');
const genRandomizeBtn = document.getElementById('genRandomizeBtn');
const genRenderBtn = document.getElementById('genRenderBtn');
const genDuplicateBtn = document.getElementById('genDuplicateBtn');
const genDeleteBtn = document.getElementById('genDeleteBtn');
const genNameLabel = document.getElementById('genNameLabel');
const genCommentaryField = document.getElementById('genCommentaryField');
const genNameCounter = document.getElementById('genNameCounter');
const genNameError = document.getElementById('genNameError');
const genCommentaryCounter = document.getElementById('genCommentaryCounter');
let genPreviewCanvas = document.getElementById('genPreviewCanvas');
const genPreviewWrap = document.getElementById('genPreviewWrap');
const genHistoryBack = document.getElementById('genHistoryBack');
const genHistoryForward = document.getElementById('genHistoryForward');
const genUndoBtn = document.getElementById('genUndoBtn');
const genRedoBtn = document.getElementById('genRedoBtn');
const genFullscreenBtn = document.getElementById('genFullscreenBtn');
const genLoadingOverlay = document.getElementById('genLoadingOverlay');
const genErrorOverlay = document.getElementById('genErrorOverlay');
const genRetryBtn = document.getElementById('genRetryBtn');
const genProgressOverlay = document.getElementById('genProgressOverlay');
const genProgressFill = document.getElementById('genProgressFill');
const genProgressLabel = document.getElementById('genProgressLabel');
const genQueueEl = document.getElementById('genQueue');
const animSectionEl = document.getElementById('animSection');
const animGalleryEl = document.getElementById('animGallery');

if (genRetryBtn) genRetryBtn.addEventListener('click', retryGenerate);

/* ── Generated text toggle ── */
selectedGenToggle.addEventListener('click', () => {
    const expanded = selectedGenToggle.getAttribute('aria-expanded') === 'true';
    selectedGenToggle.setAttribute('aria-expanded', String(!expanded));
    selectedGenAlt.classList.toggle('expanded', !expanded);
});

let resizeRaf;
window.addEventListener('resize', () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        positionMenuSlider(false);
    });
});

/* ── State ── */
let selected = { name: null, isPortrait: false };
let activeType = 'image'; // 'image' | 'animation'
let activeMode = 'gallery'; // 'gallery' | 'generate'
let navigableList = [];  // [{name, profile, isPortrait, assetId}] — all profiles in display order
let currentIndex = -1;

/* ── Carousel state ── */
let carouselList = [];       // [{name, profile, isPortrait, assetId?}] — portraits first, then local

/* ── Slideshow ── */
const slideshowBtn = document.getElementById('slideshowBtn');
const slideshowDropdown = document.getElementById('slideshowDropdown');
const genSlideshowBtn = document.getElementById('genSlideshowBtn');
const genSlideshowDropdown = document.getElementById('genSlideshowDropdown');
let slideshowTimer = null;
let slideshowPlaying = false;

const PLAY_SVG = '<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16"><path d="M5 3l8 5-8 5z"/></svg>';
const PAUSE_SVG = '<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16"><rect x="3" y="3" width="4" height="10" rx="1"/><rect x="9" y="3" width="4" height="10" rx="1"/></svg>';

function getSlideDuration() {
    const activeItem = slideshowDropdown.querySelector('.custom-dropdown-item.active');
    return parseInt(activeItem ? activeItem.dataset.value : '2', 10);
}

function startSlideshow() {
    if (navigableList.length <= 1) return;
    slideshowPlaying = true;
    slideshowBtn.classList.add('slideshow-active');
    slideshowBtn.style.setProperty('--slide-duration', getSlideDuration() + 's');
    slideshowBtn.innerHTML = PAUSE_SVG;
    slideshowBtn.setAttribute('data-tooltip', 'Pause slideshow');
    slideshowBtn.setAttribute('aria-label', 'Pause slideshow');
    refreshTooltip(slideshowBtn);
    scheduleNextSlide();
}

function stopSlideshow() {
    slideshowPlaying = false;
    slideshowBtn.classList.remove('slideshow-active');
    slideshowBtn.style.removeProperty('--slide-duration');
    slideshowBtn.innerHTML = PLAY_SVG;
    slideshowBtn.setAttribute('data-tooltip', 'Start slideshow');
    slideshowBtn.setAttribute('aria-label', 'Start slideshow');
    refreshTooltip(slideshowBtn);
    if (slideshowTimer) { clearTimeout(slideshowTimer); slideshowTimer = null; }
}

function restartRingAnimation() {
    slideshowBtn.style.setProperty('--slide-duration', getSlideDuration() + 's');
    slideshowBtn.classList.remove('slideshow-active');
    slideshowBtn.offsetHeight; // force reflow
    slideshowBtn.classList.add('slideshow-active');
}

function scheduleNextSlide() {
    if (!slideshowPlaying) return;
    if (slideshowTimer) clearTimeout(slideshowTimer);
    const ms = getSlideDuration() * 1000;
    slideshowTimer = setTimeout(() => {
        slideshowTimer = null;
        if (!slideshowPlaying) return;
        navigateArrow(1);
        restartRingAnimation();
        scheduleNextSlide();
    }, ms);
}

/** Sync interval dropdown selection between gallery and gen slideshow */
function syncGenSlideshowInterval(value) {
    const menu = genSlideshowDropdown?.querySelector('.custom-dropdown-menu');
    const label = genSlideshowDropdown?.querySelector('.custom-dropdown-label');
    if (!menu) return;
    menu.querySelectorAll('.custom-dropdown-item').forEach(item => {
        const isActive = item.dataset.value === value;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-selected', String(isActive));
        if (isActive && label) label.textContent = item.textContent;
    });
}
function syncGallerySlideshowInterval(value) {
    const menu = slideshowDropdown?.querySelector('.custom-dropdown-menu');
    const label = slideshowDropdown?.querySelector('.custom-dropdown-label');
    if (!menu) return;
    menu.querySelectorAll('.custom-dropdown-item').forEach(item => {
        const isActive = item.dataset.value === value;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-selected', String(isActive));
        if (isActive && label) label.textContent = item.textContent;
    });
}

slideshowBtn.addEventListener('click', () => {
    if (slideshowPlaying) stopSlideshow();
    else startSlideshow();
});

/* ── Fullscreen ── */

const fullscreenBtn = document.getElementById('fullscreenBtn');
let fullscreenOverlay = null;

function computeContainedRect(aspectRatio) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let w, h;
    if (vw / vh > aspectRatio) {
        h = vh; w = h * aspectRatio;
    } else {
        w = vw; h = w / aspectRatio;
    }
    return { top: (vh - h) / 2, left: (vw - w) / 2, width: w, height: h };
}

async function openFullscreen() {
    if (fullscreenOverlay) return;

    const galleryRect = selectedImageWrap.getBoundingClientRect();
    const aspectRatio = galleryRect.width / galleryRect.height;
    const finalRect = computeContainedRect(aspectRatio);

    const overlay = document.createElement('div');
    overlay.className = 'fullscreen-overlay';

    // Clone the currently visible media
    const isVideo = !selectedVideo.classList.contains('hidden');
    let media;
    if (isVideo) {
        media = document.createElement('video');
        media.src = selectedVideo.src;
        media.controls = true;
        media.loop = true;
        media.autoplay = true;
        media.playsInline = true;
    } else {
        media = document.createElement('img');
        media.src = selectedImage.src;
        media.alt = selectedImage.alt;
        // Decode image before animating to avoid blank/slow first frame
        try { await media.decode(); } catch { /* proceed anyway */ }
    }
    media.id = 'fullscreenMedia';

    // Position at final contained rect
    media.style.top = finalRect.top + 'px';
    media.style.left = finalRect.left + 'px';
    media.style.width = finalRect.width + 'px';
    media.style.height = finalRect.height + 'px';

    // FLIP: inverse transform to visually place at gallery position
    const dx = galleryRect.left - finalRect.left;
    const dy = galleryRect.top - finalRect.top;
    const sx = galleryRect.width / finalRect.width;
    const sy = galleryRect.height / finalRect.height;
    media.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'fullscreen-close';
    closeBtn.innerHTML = '\u00d7';
    closeBtn.setAttribute('aria-label', 'Close fullscreen');
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeFullscreen(); });

    overlay.appendChild(media);
    overlay.appendChild(closeBtn);

    // Click on backdrop (not media) to close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeFullscreen();
    });

    document.body.appendChild(overlay);
    fullscreenOverlay = overlay;

    // Hide the source image immediately
    selectedImage.style.visibility = 'hidden';
    selectedVideo.style.visibility = 'hidden';

    // Force layout, then animate
    media.offsetHeight;
    overlay.classList.add('fs-visible');
    media.classList.add('fs-animating');
    media.style.transform = 'none';
}

function closeFullscreen() {
    if (!fullscreenOverlay) return;
    const overlay = fullscreenOverlay;
    fullscreenOverlay = null;

    const media = overlay.querySelector('#fullscreenMedia');
    if (!media) { overlay.remove(); return; }

    const galleryRect = selectedImageWrap.getBoundingClientRect();
    const finalRect = {
        top: parseFloat(media.style.top),
        left: parseFloat(media.style.left),
        width: parseFloat(media.style.width),
        height: parseFloat(media.style.height),
    };

    const dx = galleryRect.left - finalRect.left;
    const dy = galleryRect.top - finalRect.top;
    const sx = galleryRect.width / finalRect.width;
    const sy = galleryRect.height / finalRect.height;

    overlay.classList.remove('fs-visible');
    media.classList.remove('fs-animating');
    media.classList.add('fs-closing');
    media.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

    media.addEventListener('transitionend', () => {
        overlay.remove();
        selectedImage.style.visibility = '';
        selectedVideo.style.visibility = '';
    }, { once: true });
}

/**
 * Update fullscreen media when the selected image changes (e.g. during slideshow).
 */
function syncFullscreenMedia() {
    if (!fullscreenOverlay) return;
    const media = fullscreenOverlay.querySelector('#fullscreenMedia');
    if (!media) return;
    const isVideo = !selectedVideo.classList.contains('hidden');
    if (isVideo && media.tagName === 'VIDEO') {
        media.src = selectedVideo.src;
    } else if (!isVideo && media.tagName === 'IMG') {
        media.src = selectedImage.src;
        media.alt = selectedImage.alt;
    }
}

fullscreenBtn.addEventListener('click', () => {
    if (fullscreenOverlay) closeFullscreen();
    else openFullscreen();
});

/* ── Carousel component integration ── */

/** Build section + card elements for the carousel component from carouselList. */
function updateBrowserItems() {
    carouselBrowser.clearItems();

    const portraits = carouselList.filter(e => e.isPortrait);
    const generated = carouselList.filter(e => e.assetId && !e.isPortrait);
    const custom = carouselList.filter(e => !e.isPortrait && !e.assetId);

    const addSection = (label, entries) => {
        if (!entries.length) return;
        const section = document.createElement('carousel-dropdown-browser-section');
        section.label = label;
        for (const entry of entries) {
            const card = document.createElement('carousel-dropdown-browser-card');
            card.key = entry.assetId || entry.name;
            card.label = entry.name;
            card.thumbSrc = resolveThumbSrc(entry);
            if (entry.isPortrait) card.fallbackSrc = resolveFallbackSrc(entry) || '';
            if (!entry.isPortrait) card.deletable = true;
            card.data = entry;
            section.appendChild(card);
        }
        carouselBrowser.appendChild(section);
    };

    const sections = loadPortraitSections();
    for (const sec of sections) {
        const sectionPortraits = portraits.filter(e => sec.portraitNames.includes(e.name));
        addSection(sec.name, sectionPortraits);
    }
    addSection('Generated', generated);
    addSection('Custom', custom);
}

function resolveThumbSrc(entry) {
    if (entry.assetId) {
        const asset = generatedAssets.find(a => a.id === entry.assetId);
        return asset && asset.thumbDataUrl ? asset.thumbDataUrl : '';
    }
    return getCarouselThumbSrc(entry.name, entry.profile, entry.isPortrait);
}

function resolveFallbackSrc(entry) {
    if (!entry.profile || !entry.profile.seed || !entry.profile.controls) return undefined;
    const key = thumbCacheKey(entry.profile.seed, entry.profile.controls);
    return thumbCache.has(key) ? thumbCache.get(key) : undefined;
}

carouselBrowser.addEventListener('item-select', (e) => {
    const entry = e.detail.item.data;
    if (slideshowPlaying) stopSlideshow();
    selectProfile(entry.name, entry.profile, entry.isPortrait, entry.assetId);
});

carouselBrowser.addEventListener('center-change', () => {
    if (slideshowPlaying) stopSlideshow();
});

carouselBrowser.addEventListener('item-delete', (e) => {
    const entry = e.detail.item.data;
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
                    carouselBrowser.collapse();
                    refreshGallery();
                }
            }
        ]
    );
});

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
            const profile = { seed: job.asset.meta.seed, controls: job.asset.meta.controls };
            selectProfile(job.asset.name, profile, false, job.asset.id);
        }
    }
}

const rqMenu = initRenderQueueMenu({
    drawerEl: document.getElementById('rqMenu'),
    barEl: document.getElementById('rqMenuBar'),
    listEl: document.getElementById('rqJobList'),
    countEl: document.getElementById('rqMenuCount'),
    badgeEl: document.getElementById('renderQueueBadge'),
    onCancel(jobId) { if (renderQueue) renderQueue.cancel(jobId); },
    onView: viewJob,
});


/* ── URL routing ── */

function parseRoute() {
    const path = window.location.pathname;
    if (path === '/gallery/animations/generate') return { type: 'animation', mode: 'generate', source: null, profileSlug: null };
    if (path.startsWith('/gallery/animations')) return { type: 'animation', mode: 'gallery', source: null, profileSlug: null };
    if (path === '/gallery/images/generate') return { type: 'image', mode: 'generate', source: null, profileSlug: null };
    // /gallery/images/portraits/{slug} or /gallery/images/local/{slug} or /gallery/images/generated/{id}
    const match = path.match(/^\/gallery\/images\/(portraits|local|generated)\/(.+)$/);
    if (match) return { type: 'image', mode: 'gallery', source: match[1], profileSlug: match[2] };
    return { type: 'image', mode: 'gallery', source: null, profileSlug: null };
}

function pushRoute() {
    const suffix = activeMode === 'generate' ? '/generate' : '';
    const url = (activeType === 'animation' ? '/gallery/animations' : '/gallery/images') + suffix;
    if (window.location.pathname !== url) {
        history.pushState({ type: activeType, mode: activeMode, profile: null }, '', url);
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
    const prevMode = activeMode;
    activeType = route.type;
    activeMode = route.mode;
    updateMenuNavLinks();

    // Handle generate mode transitions
    if (activeMode === 'generate' && prevMode !== 'generate') {
        showGenerateMode();
    } else if (activeMode !== 'generate' && prevMode === 'generate') {
        hideGenerateMode();
    }

    if (activeMode === 'generate') return;

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
                profile: { seed: asset.meta.seed, controls: asset.meta.controls, camera: asset.meta.camera },
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
    if (currentIndex < 0 || currentIndex >= navigableList.length) return;
    if (activeMode !== 'gallery' || activeType !== 'image') return;

    const entry = navigableList[currentIndex];
    const { profile } = entry;

    // Portrait: swap to resolution-specific static image
    if (entry.isPortrait) {
        selectedImage.src = getDisplaySrc(entry.name, profile, true);
        syncFullscreenMedia();
        return;
    }

    // Generated/local: re-render via worker
    if (!workerBridge || !workerBridge.ready) return;
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
    const altText = generateAltText(c, nodeCount, title, locale, seed);

    return { title, altText };
}

/* ── Thumbnail helpers ── */

/** Carousel thumbnail (always 280×180 PNG for fast loading) */
function getCarouselThumbSrc(name, profile, isPortrait) {
    if (isPortrait) return `/static/images/portraits/${slugify(name)}-thumb.png`;
    if (profile.seed && profile.controls) {
        const key = thumbCacheKey(profile.seed, profile.controls);
        if (thumbCache.has(key)) return thumbCache.get(key);
    }
    return '';
}

/** Display image (PNG for portraits, ObjectURL for generated) */
function getDisplaySrc(name, profile, isPortrait) {
    if (isPortrait) {
        const res = getResolution();
        return `/static/images/portraits/${slugify(name)}-${res.key}.png`;
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
let selectionFadeTimer = 0;

function applySelection(name, profile, isPortrait, assetId) {
    selected = { name, isPortrait, assetId };
    const fadeDuration = 250;

    // Fade out text + image + alt-text overlay together
    selectedHeaderText.classList.add('fading');
    selectedFooter.classList.add('fading');
    selectedImage.style.opacity = '0';
    fadeOutAltText();

    // Cancel any pending fade-in from a previous rapid selection
    clearTimeout(selectionFadeTimer);

    // After fade-out completes, swap content and fade back in
    selectionFadeTimer = setTimeout(() => {
        // Update text
        selectedName.textContent = name;
        selectedSeed.textContent = Array.isArray(profile.seed) ? seedTagToLabel(profile.seed) : (profile.seed || '');

        // Portrait commentary vs generated/custom text
        if (isPortrait && profile.generated) {
            selectedGenTitle.textContent = '';
            selectedGenAlt.textContent = profile.commentary || '';
            selectedGenAlt.classList.add('expanded');
            selectedGenToggle.style.display = '';
            selectedGenToggle.classList.add('portrait-static');
            selectedImage.alt = `${name} \u2014 ${profile.generated.title}`;
            selectedImage.setAttribute('data-tooltip', profile.generated['alt-text']);
            selectedImage.setAttribute('data-tooltip-pos', 'overlay');
        } else if (assetId) {
            const asset = generatedAssets.find(a => a.id === assetId);
            if (asset && asset.meta && asset.meta.commentary) {
                // Commentary exists — display like sampler portraits
                selectedGenTitle.textContent = '';
                selectedGenAlt.textContent = asset.meta.commentary;
                selectedGenAlt.classList.add('expanded');
                selectedGenToggle.style.display = '';
                selectedGenToggle.classList.add('portrait-static');
                selectedImage.alt = `${name} — ${asset.meta.title || ''}`;
                selectedImage.setAttribute('data-tooltip', asset.meta.altText || asset.meta.title || name);
                selectedImage.setAttribute('data-tooltip-pos', 'overlay');
            } else if (asset && asset.meta) {
                // No commentary — show title + collapsible alt-text
                selectedGenTitle.textContent = asset.meta.title || '';
                selectedGenAlt.textContent = asset.meta.altText || '';
                selectedImage.alt = asset.meta.title || name;
                selectedImage.setAttribute('data-tooltip', asset.meta.altText || asset.meta.title || name);
                selectedImage.setAttribute('data-tooltip-pos', 'overlay');
                selectedGenToggle.style.display = '';
                selectedGenToggle.classList.remove('portrait-static');
                selectedGenAlt.classList.remove('expanded');
                selectedGenToggle.setAttribute('aria-expanded', 'false');
            }
        } else if (profile.commentary) {
            // User-saved profile with commentary
            const { title, altText } = generateProfileText(profile);
            selectedGenTitle.textContent = '';
            selectedGenAlt.textContent = profile.commentary;
            selectedGenAlt.classList.add('expanded');
            selectedGenToggle.style.display = '';
            selectedGenToggle.classList.add('portrait-static');
            selectedImage.alt = `${name} — ${title}`;
            selectedImage.setAttribute('data-tooltip', altText || title);
            selectedImage.setAttribute('data-tooltip-pos', 'overlay');
        } else {
            const { title, altText } = generateProfileText(profile);
            selectedGenTitle.textContent = title;
            selectedGenAlt.textContent = altText;
            selectedImage.alt = title;
            selectedImage.setAttribute('data-tooltip', altText || title);
            selectedImage.setAttribute('data-tooltip-pos', 'overlay');
            selectedGenToggle.style.display = '';
            selectedGenToggle.classList.remove('portrait-static');
            selectedGenAlt.classList.remove('expanded');
            selectedGenToggle.setAttribute('aria-expanded', 'false');
        }

        // Update alt-text overlay if visible
        updateAltText(selectedImage.getAttribute('data-tooltip'));

        // Swap image src (old image is now fully hidden)
        if (currentStaticUrl) { URL.revokeObjectURL(currentStaticUrl); currentStaticUrl = null; }
        if (snapshotUrl) { URL.revokeObjectURL(snapshotUrl); snapshotUrl = null; }

        selectedImage.addEventListener('load', () => {
            selectedImage.style.opacity = '1';
        }, { once: true });

        if (assetId) {
            const asset = generatedAssets.find(a => a.id === assetId);
            if (asset && asset.thumbDataUrl) selectedImage.src = asset.thumbDataUrl;
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
                const pngSrc = `/static/images/portraits/${slugify(name)}-thumb.png`;
                selectedImage.src = pngSrc;
            };
        }

        // Fade text back in
        selectedHeaderText.classList.remove('fading');
        selectedFooter.classList.remove('fading');
    }, fadeDuration);

    currentIndex = navigableList.findIndex(p =>
        assetId ? p.assetId === assetId : p.name === name
    );
    updateArrowStates();

    // Sync carousel to selected profile
    carouselBrowser.selectedKey = assetId || name;
    carouselBrowser.syncToKey(assetId || name);

    // Sync fullscreen overlay if open
    syncFullscreenMedia();
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

    galleryArrowLeft.setAttribute('data-tooltip', disabled ? '' : 'Previous');
    galleryArrowRight.setAttribute('data-tooltip', disabled ? '' : 'Next');
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

/* ── Alt-text overlays (independent of tooltip system) ── */
// Suppress hover tooltips on these elements (they use dedicated overlays instead)
selectedImage.setAttribute('data-tooltip-click', '');
genPreviewCanvas.setAttribute('data-tooltip-click', '');

const altTextOverlay = document.getElementById('altTextOverlay');
const genAltTextOverlay = document.getElementById('genAltTextOverlay');
let altTextVisible = false;
let genAltTextVisible = false;

function showAltText(overlay, text) {
    overlay.textContent = text;
    overlay.classList.add('visible');
}
function hideAltText(overlay) {
    overlay.classList.remove('visible');
}
function fadeOutAltText() {
    if (altTextVisible) altTextOverlay.classList.remove('visible');
}
function updateAltText(text) {
    if (!altTextVisible) return;
    altTextOverlay.textContent = text;
    altTextOverlay.classList.add('visible');
}

selectedImage.addEventListener('click', () => {
    const text = selectedImage.getAttribute('data-tooltip');
    if (!text) return;
    if (altTextVisible) {
        hideAltText(altTextOverlay);
        altTextVisible = false;
    } else {
        showAltText(altTextOverlay, text);
        altTextVisible = true;
    }
});

genPreviewCanvas.addEventListener('click', () => {
    const text = genPreviewCanvas.getAttribute('data-tooltip');
    if (!text) return;
    if (genAltTextVisible) {
        hideAltText(genAltTextOverlay);
        genAltTextVisible = false;
    } else {
        showAltText(genAltTextOverlay, text);
        genAltTextVisible = true;
    }
});

function navigateToEditor() {
    const params = new URLSearchParams();
    if (selected.name) {
        params.set('profile', selected.name);
        if (selected.isPortrait) params.set('source', 'portrait');
    }
    const page = activeType === 'animation' ? 'animation' : 'image';
    window.location.href = `/${page}.html?${params}`;
}


function refreshGallery() {
    if (carouselBrowser.expanded) carouselBrowser.collapse();
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
    carouselBrowser.style.display = '';

    // Build merged list: portraits first, then local
    const portraits = loadPortraits();
    const portraitNames = getPortraitNames();

    carouselList = portraitNames.map(name => ({
        name, profile: portraits[name], isPortrait: true
    }));

    // Append generated assets
    for (const asset of generatedAssets) {
        carouselList.push({
            name: asset.name,
            profile: { seed: asset.meta.seed, controls: asset.meta.controls, camera: asset.meta.camera },
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

    // Update carousel component
    updateBrowserItems();

    // Auto-select first entry if nothing selected
    if (!selected.name && carouselList.length > 0) {
        const first = carouselList[0];
        carouselBrowser.syncToKey(first.assetId || first.name);
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

    galleryContentEl.style.display = '';
    selectedDisplay.style.display = '';
}

/**
 * Show animation gallery — displays animation assets with video playback.
 */
function showAnimationGallery() {
    // Hide image carousel, show animation section
    carouselBrowser.style.display = 'none';

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

    syncFullscreenMedia();
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
const menuNavSlider = document.getElementById('menuNavSlider');

function positionMenuSlider(animate) {
    const activeLink = siteMenu.querySelector('.menu-nav-link.active');
    if (!activeLink || !menuNavSlider) return;
    const menuRect = siteMenu.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    const top = linkRect.top - menuRect.top + siteMenu.scrollTop;
    if (!animate) {
        menuNavSlider.style.transition = 'none';
    }
    menuNavSlider.style.transform = `translateY(${top}px)`;
    menuNavSlider.style.height = `${linkRect.height}px`;
    menuNavSlider.classList.add('visible');
    if (!animate) {
        menuNavSlider.offsetHeight; // force reflow
        menuNavSlider.style.transition = '';
    }
}

function updateMenuNavLinks() {
    menuNavLinks.forEach(link => {
        const matches = link.dataset.navType === activeType && link.dataset.navMode === activeMode;
        link.classList.toggle('active', matches);
    });
    positionMenuSlider(true);
}

function handleMenuNav(type, mode) {
    const typeChanged = type !== activeType;
    const modeChanged = mode !== activeMode;
    if (!typeChanged && !modeChanged) return;

    activeType = type;
    activeMode = mode;
    updateMenuNavLinks();
    pushRoute();

    if (modeChanged) {
        if (mode === 'generate') {
            showGenerateMode();
        } else {
            hideGenerateMode();
        }
    }

    if (typeChanged) {
        selected = { name: null, isPortrait: false };
        refreshGallery();
        if (activeMode === 'generate') {
            selectedDisplay.style.display = 'none';
            galleryContentEl.style.display = 'none';
        }
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
    const res = getGenResolution();
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

let pendingFullscreenCaptureId = null;
let pendingResizeRender = false;
let snapshotUrl = null;
let webglFailed = false;

/** Show the WebGL error overlay and disable generate controls. */
function showGenError() {
    if (webglFailed) return;
    webglFailed = true;
    generateInitialized = false;          // allow retry
    genErrorOverlay?.classList.remove('hidden');
    genLoadingOverlay?.classList.add('hidden');
    setGenNavEnabled(false);
    if (genSaveBtn) genSaveBtn.disabled = true;
    if (genRandomizeBtn) genRandomizeBtn.disabled = true;
    if (genRenderBtn) genRenderBtn.disabled = true;
}

/** Hide the error overlay and re-attempt worker init. */
function retryGenerate() {
    webglFailed = false;
    genErrorOverlay?.classList.add('hidden');
    if (workerBridge) {
        workerBridge.terminate();
        workerBridge = null;
    }
    // transferControlToOffscreen() can only be called once per canvas —
    // replace it with a fresh clone so the worker can claim control.
    if (genPreviewCanvas?.dataset.transferred) {
        const fresh = document.createElement('canvas');
        fresh.id = genPreviewCanvas.id;
        fresh.className = genPreviewCanvas.className;
        fresh.width = genPreviewCanvas.width;
        fresh.height = genPreviewCanvas.height;
        genPreviewCanvas.replaceWith(fresh);
        genPreviewCanvas = fresh;
    }
    initGenerate();
}

/** Enable/disable all generate panel nav buttons. */
function setGenNavEnabled(enabled) {
    // Don't force-enable buttons that should be disabled by history state
    if (enabled && genPanel) {
        // Let the panel's own button state logic handle disabled states
        // Just remove our forced-disabled state
        [genFullscreenBtn].forEach(btn => { if (btn) btn.disabled = false; });
        // For history/undo buttons, trigger panel's update
        return;
    }
    [genHistoryBack, genHistoryForward, genUndoBtn, genRedoBtn, genFullscreenBtn].forEach(btn => {
        if (btn) btn.disabled = !enabled;
    });
}

/* ── Generate preview fullscreen ── */
let genFullscreenOverlay = null;

function openGenFullscreen() {
    if (genFullscreenOverlay) return;
    if (!workerBridge || !workerBridge.ready) return;

    pendingFullscreenCaptureId = 'fs-' + Date.now();
    workerBridge.captureFrame(pendingFullscreenCaptureId);
}

async function showGenFullscreenImage(blob) {
    const url = URL.createObjectURL(blob);
    const canvasRect = genPreviewWrap.getBoundingClientRect();
    const aspectRatio = canvasRect.width / canvasRect.height;
    const finalRect = computeContainedRect(aspectRatio);

    const overlay = document.createElement('div');
    overlay.className = 'fullscreen-overlay';

    const media = document.createElement('img');
    media.src = url;
    media.id = 'fullscreenMedia';

    // Decode image before animating to avoid blank frame
    try { await media.decode(); } catch { /* proceed anyway */ }

    media.style.top = finalRect.top + 'px';
    media.style.left = finalRect.left + 'px';
    media.style.width = finalRect.width + 'px';
    media.style.height = finalRect.height + 'px';

    const dx = canvasRect.left - finalRect.left;
    const dy = canvasRect.top - finalRect.top;
    const sx = canvasRect.width / finalRect.width;
    const sy = canvasRect.height / finalRect.height;
    media.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'fullscreen-close';
    closeBtn.innerHTML = '\u00d7';
    closeBtn.setAttribute('aria-label', 'Close fullscreen');
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeGenFullscreen(); });

    overlay.appendChild(media);
    overlay.appendChild(closeBtn);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeGenFullscreen();
    });

    document.body.appendChild(overlay);
    genFullscreenOverlay = overlay;
    genFullscreenOverlay._blobUrl = url;

    media.offsetHeight;
    overlay.classList.add('fs-visible');
    media.classList.add('fs-animating');
    media.style.transform = 'none';
}

function closeGenFullscreen() {
    if (!genFullscreenOverlay) return;
    const overlay = genFullscreenOverlay;
    genFullscreenOverlay = null;

    const media = overlay.querySelector('#fullscreenMedia');
    if (!media) { overlay.remove(); return; }

    const canvasRect = genPreviewWrap.getBoundingClientRect();
    const finalRect = {
        top: parseFloat(media.style.top),
        left: parseFloat(media.style.left),
        width: parseFloat(media.style.width),
        height: parseFloat(media.style.height),
    };

    const dx = canvasRect.left - finalRect.left;
    const dy = canvasRect.top - finalRect.top;
    const sx = canvasRect.width / finalRect.width;
    const sy = canvasRect.height / finalRect.height;

    overlay.classList.remove('fs-visible');
    media.classList.remove('fs-animating');
    media.classList.add('fs-closing');
    media.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

    media.addEventListener('transitionend', () => {
        if (overlay._blobUrl) URL.revokeObjectURL(overlay._blobUrl);
        overlay.remove();
    }, { once: true });
}

function initGenerate() {
    if (generateInitialized) return;
    generateInitialized = true;

    // Create worker bridge on first generate entry (deferred from page load)
    workerBridge = initGalleryWorker(genPreviewCanvas);
    if (workerBridge) {
        workerBridge.on('snapshot-complete', (msg) => {
            if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
            snapshotUrl = URL.createObjectURL(msg.blob);
            selectedImage.src = snapshotUrl;
        });
        workerBridge.on('frame-captured', (msg) => {
            if (pendingFullscreenCaptureId && msg.requestId === pendingFullscreenCaptureId) {
                pendingFullscreenCaptureId = null;
                if (msg.blob) showGenFullscreenImage(msg.blob);
            }
        });
        workerBridge.on('rendered', () => {
            if (pendingResizeRender) {
                pendingResizeRender = false;
                genLoadingOverlay.classList.add('hidden');
                setGenNavEnabled(true);
            }
        });
        workerBridge.on('error', () => {
            showGenError();
        });
    }

    if (!workerBridge) {
        showGenError();
        return;
    }

    if (genPanel) {
        // Retry path — panel already exists, just reconnect worker
        workerBridge.onReady(() => {
            renderQueue = createRenderQueue({
                workerBridge,
                onUpdate(jobs) {
                    renderQueueUI(genQueueEl, jobs, {
                        onCancel: (id) => renderQueue.cancel(id),
                    });
                },
                onComplete: onGenerateComplete,
                onAnimComplete: onAnimGenerateComplete,
            });
            const seed = genPanel.readSeed();
            const controls = genPanel.readControls();
            const camera = genPanel.readCamera();
            workerBridge.sendRenderImmediate(seed, controls, getLocale());
            workerBridge.sendCameraState(camera.zoom, camera.rotation, camera.elevation);
            genLoadingOverlay.classList.add('hidden');
            setGenNavEnabled(true);
        });
        return;
    }

    genPanel = initGeneratePanel({
        slidersEl: genSlidersEl,
        tagArrEl: genTagArrEl,
        tagStrEl: genTagStrEl,
        tagDetEl: genTagDetEl,
        nameField: genNameField,
        saveBtn: genSaveBtn,
        resetBtn: null,
        randomizeBtn: genRandomizeBtn,
        renderBtn: genRenderBtn,
        duplicateBtn: genDuplicateBtn,
        deleteBtn: genDeleteBtn,
        nameTooltipEl: genNameLabel?.querySelector('.label-info'),
        commentaryField: genCommentaryField,
        previewCanvas: genPreviewCanvas,
        nameCounter: genNameCounter,
        nameError: genNameError,
        commentaryCounter: genCommentaryCounter,
        historyBackBtn: genHistoryBack,
        historyForwardBtn: genHistoryForward,
        undoBtn: genUndoBtn,
        redoBtn: genRedoBtn,
        onControlChange(seed, controls, camera) {
            if (workerBridge && workerBridge.ready) {
                workerBridge.sendRender(seed, controls, getLocale());
                workerBridge.sendCameraState(camera.zoom, camera.rotation, camera.elevation);
            }
        },
        onRender(seed, controls, camera, name, commentary) {
            if (!renderQueue) return;
            if (activeType === 'animation') {
                const animation = buildSimpleAnimation(seed, controls);
                renderQueue.enqueueAnimation(animation);
            } else {
                renderQueue.enqueue(seed, controls, name, commentary);
            }
        },
        onSave(seed, controls, camera, name, commentary) {
            const profiles = loadProfiles();
            const entry = { seed, controls };
            if (commentary) entry.commentary = commentary;
            profiles[name] = entry;
            saveProfiles(profiles);
            // Refresh gallery to show the new profile
            refreshGallery();
            toast(`Saved "${name}"`);
        },
        async onDelete(name) {
            const result = await showConfirm(
                t('confirm.deleteProfile'),
                t('confirm.deleteConfirm', { name }),
                [
                    { label: t('btn.cancel') },
                    { label: t('btn.delete'), primary: true, value: 'delete' },
                ],
            );
            if (result !== 'delete') return;
            const pd = loadProfiles()[name];
            if (pd && pd.seed && pd.controls) {
                const cacheKey = thumbCacheKey(pd.seed, pd.controls);
                thumbCache.delete(cacheKey);
                deleteThumb(cacheKey);
            }
            deleteProfile(name);
            const order = loadProfileOrder();
            if (order) saveProfileOrder(order.filter(n => n !== name));
            refreshGallery();
            genPanel.setUnlocked();
            genPanel.randomize();
            toast(`Deleted "${name}"`);
        },
    });

    // Wire up fold-up collapsible toggles in the generate config
    generatePanelEl.querySelectorAll('.fold-up-area[data-target]').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const expanded = toggle.getAttribute('aria-expanded') === 'true';
            toggle.setAttribute('aria-expanded', String(!expanded));
            const target = document.getElementById(toggle.dataset.target);
            if (!target) return;

            // Keep fold-up active during the collapse/expand animation
            const container = toggle.closest('.fold-up-container');
            if (container) container.classList.add('fold-active');

            const removeFold = () => {
                if (container) container.classList.remove('fold-active');
                target.removeEventListener('transitionend', removeFold);
            };
            target.addEventListener('transitionend', removeFold);

            if (expanded) {
                // Collapse: freeze current height, then animate to 0
                target.style.maxHeight = target.scrollHeight + 'px';
                requestAnimationFrame(() => {
                    target.classList.add('collapsed');
                    target.style.maxHeight = '0';
                });
            } else {
                // Expand: remove collapsed, animate to scrollHeight, then clear
                target.classList.remove('collapsed');
                target.style.maxHeight = target.scrollHeight + 'px';
                const onEnd = () => {
                    target.style.maxHeight = '';
                    target.removeEventListener('transitionend', onEnd);
                };
                target.addEventListener('transitionend', onEnd);
            }
        });
    });

    // ── Resize preview canvas when generation resolution changes ──
    function resizeGenPreview() {
        if (!workerBridge || !workerBridge.ready) return;
        const res = getGenResolution();
        pendingResizeRender = true;
        genLoadingOverlay.classList.remove('hidden');
        setGenNavEnabled(false);
        workerBridge.resize(res.w, res.h);
    }
    document.addEventListener('genresolutionchange', resizeGenPreview);

    if (genFullscreenBtn) {
        genFullscreenBtn.addEventListener('click', () => {
            if (genFullscreenOverlay) closeGenFullscreen();
            else openGenFullscreen();
        });
    }

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

        // Resize preview to current resolution
        resizeGenPreview();

        // Send initial preview render + camera state
        const seed = genPanel.readSeed();
        const controls = genPanel.readControls();
        const camera = genPanel.readCamera();
        workerBridge.sendRenderImmediate(seed, controls, getLocale());
        workerBridge.sendCameraState(camera.zoom, camera.rotation, camera.elevation);
    });
}

let modeTransitioning = false;

function showGenerateMode() {
    if (slideshowPlaying) stopSlideshow();
    if (modeTransitioning) return;
    const wasInitialized = generateInitialized;
    initGenerate();

    // Load the selected profile's config into the generate panel
    if (genPanel && selected.name) {
        const entry = navigableList.find(p =>
            p.assetId ? p.assetId === selected.assetId : p.name === selected.name,
        );
        if (entry?.profile?.seed && entry.profile.controls) {
            const displayName = entry.isPortrait ? entry.name + ' (User Version)' : entry.name;
            genPanel.setValues(entry.profile.seed, entry.profile.controls, entry.profile.camera, displayName, entry.profile.commentary);
            genPanel.pushImageHistory();
            // Lock panel for saved user profiles (not portraits, not generated assets)
            const isSavedUserProfile = !entry.isPortrait && !entry.assetId;
            if (isSavedUserProfile) {
                genPanel.setLocked(entry.name, { isPortrait: false, assetId: null });
            } else {
                genPanel.setUnlocked();
            }
            // On re-entry (worker already ready), trigger render with loaded values.
            // On first init, onReady() reads panel values and renders automatically.
            if (wasInitialized && workerBridge?.ready) {
                const seed = genPanel.readSeed();
                const controls = genPanel.readControls();
                const camera = genPanel.readCamera();
                workerBridge.sendRenderImmediate(seed, controls, getLocale());
                workerBridge.sendCameraState(camera.zoom, camera.rotation, camera.elevation);
            }
        }
    }

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
        if (fullscreenOverlay) {
            closeFullscreen();
            return;
        }
        if (carouselBrowser.expanded) {
            carouselBrowser.collapse();
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
activeMode = route.mode;
updateMenuNavLinks();
// Position slider without animation on initial load
requestAnimationFrame(() => positionMenuSlider(false));

if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
    history.replaceState({ type: 'image', profile: null }, '', '/gallery/images');
}

if (activeMode === 'generate') {
    showGenerateMode();
} else if (activeType === 'image' && route.profileSlug) {
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

// Load all IndexedDB data, then refresh gallery once
Promise.allSettled([
    getAllThumbs().then(persisted => { thumbCache = persisted; }),
    getAllAssets().then(assets => { generatedAssets = assets; }),
    getAllAnimAssets().then(assets => { animAssets = assets; }),
]).then(() => {
    refreshGallery();
});

/* ── Share ── */

initSharePopover({
    shareBtn: document.getElementById('shareBtn'),
    sharePopover: document.getElementById('sharePopover'),
    getShareURL: () => window.location.origin + window.location.pathname,
    getShareTitle: () => {
        const name = selectedName.textContent.trim();
        return name ? `${name} — Geometric Interior` : 'Geometric Interior';
    },
});
