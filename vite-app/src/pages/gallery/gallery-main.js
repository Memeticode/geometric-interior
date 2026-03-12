/**
 * Gallery page entry point.
 * Shows pre-cached profile thumbnails with selection + navigation to editor pages.
 * Fold animations play via pre-rendered sprite strip PNGs on a canvas overlay.
 * "Generate" mode activates an in-gallery config panel with live preview + render queue.
 *
 * Routes (client-side, history.pushState):
 *   /images                                  — image gallery (default)
 *   /images/portraits/{slug}                 — portrait selected
 *   /images/local/{slug}                     — user profile selected
 *   /images/generated/{id}                   — generated profile selected
 *   /images/editor                           — editing / adding an image
 *   /images/create                           — image generator panel (legacy)
 *   /animation                               — animation gallery
 *   /animation/create                        — animation editor
 */

import '../../components/carousel-dropdown-browser.js';
import { createHeader } from '../../components/create-header.js';
import { createFooter } from '../../components/create-footer.js';
import { initApp } from '../../components/app-init.js';
import { initTheme } from '../../stores/theme.js';
import { initLangSelector } from '../../i18n/lang-selector.js';
import { initResolutionSelector, getResolution, getGenResolution, getLowerPreset, syncDropdown } from '../../stores/resolution.js';
import { t, getLocale } from '../../i18n/locale.js';
import { loadProfiles, loadPortraits, getPortraitNames, loadPortraitSections, syncProfileOrder, deleteProfile, loadProfileOrder, saveProfileOrder, saveProfiles } from '../../stores/profiles.js';
import { getAllThumbs, deleteThumb } from '../../stores/thumb-cache.js';
import { getAllAssets, getAsset, deleteAsset, putAsset, generateAssetId, getAllAnimAssets, deleteAnimAsset } from '../../stores/asset-store.js';
import { syncGeneratedOrder, saveGeneratedOrder } from '../../stores/generated-order.js';
import { generateTitle } from '@geometric-interior/core/text-generation/title-text.js';
import { generateAltText } from '@geometric-interior/core/text-generation/alt-text.js';
import { xmur3, mulberry32 } from '@geometric-interior/utils/prng.js';
import { getLocalizedWords } from '@geometric-interior/core/text-generation/seed-tags.js';
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
import { initAnimationEditor, destroyAnimationEditor } from '../animation/anim-main.js';

/* ── Build header & footer DOM ── */
createHeader(document.querySelector('.app-header'), { page: 'gallery' });
const footerRefs = createFooter(document.querySelector('.app-footer'), { page: 'gallery' });

/* ── Shared init (locale, tooltips, toast, statement modal, favicon) ── */
const { statement } = initApp({ page: 'gallery' });

/* ── Gallery-specific init ── */
initTheme(footerRefs.themeSwitcher);
initLangSelector(footerRefs.langDropdown);
initResolutionSelector(document.getElementById('resolutionDropdown'));
// Gen resolution selector removed — now part of render flow
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
// Gen slideshow dropdown removed — slideshow only in gallery mode

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
    const footer = document.querySelector('.app-footer');
    if (footer) {
        document.documentElement.style.setProperty('--footer-h', footer.offsetHeight + 'px');
    }
    siteMenu.classList.remove('site-menu-closed');
    siteMenu.setAttribute('aria-hidden', 'false');
    siteMenuBackdrop.classList.remove('hidden');
    siteMenuToggle.classList.add('menu-open');
    siteMenuToggle.setAttribute('data-tooltip', 'Close menu');
    siteMenuToggle.setAttribute('aria-label', 'Close menu');
    refreshTooltip(siteMenuToggle);
    document.documentElement.style.setProperty('--menu-w', siteMenu.offsetWidth + 'px');
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
    document.documentElement.style.removeProperty('--menu-w');
    localStorage.setItem(MENU_STATE_KEY, '0');
}

// Restore menu state from previous session (skip transition)
if (localStorage.getItem(MENU_STATE_KEY) === '1') {
    siteMenu.style.transition = 'none';
    siteMenuBackdrop.style.transition = 'none';
    const main = document.querySelector('.main-content');
    if (main) main.style.transition = 'none';
    openSiteMenu();
    // Force layout then re-enable transitions
    siteMenu.offsetHeight; // eslint-disable-line no-unused-expressions
    siteMenu.style.transition = '';
    siteMenuBackdrop.style.transition = '';
    if (main) main.style.transition = '';
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
const gallerySelectionVisual = document.getElementById('gallerySelectionVisual');
const gallerySelectionCardVisualWrap = document.getElementById('gallerySelectionCardVisualWrap');
const gallerySelectionContainer = document.getElementById('gallerySelectionContainer');
const galleryContentEl = document.getElementById('galleryContent');
const selectedGenTitle = document.getElementById('selectedGenTitle');
const gallerySelectionCardCommentaryText = document.getElementById('gallerySelectionCardCommentaryText');
const selectedVideo = document.getElementById('selectedVideo');
const gallerySelectionCardFooter = document.querySelector('.gallery-selection-card-footer');
const morphNameRow = document.querySelector('.morph-name');
const morphSeedRow = document.querySelector('.morph-seed');

/* ── Carousel component ── */
const carouselBrowser = document.getElementById('carouselBrowser');
const galleryMainEl = document.querySelector('.main-content');


/* ── Generate / Animation editor DOM refs ── */
const generatePanelEl = document.getElementById('genPanel');
const animationEditorEl = document.getElementById('animationEditor');
const genSlidersEl = document.getElementById('genConfigSliders');
const genTagArrEl = document.getElementById('genTagArr');
const genTagStrEl = document.getElementById('genTagStr');
const genTagDetEl = document.getElementById('genTagDet');
const genNameField = document.getElementById('genNameField');
const genSaveBtn = document.getElementById('genSaveBtn');
const genRandomizeBtn = document.getElementById('genRandomizeBtn');
const genRenderBtn = document.getElementById('genRenderBtn');
const genNameLabel = document.getElementById('genNameLabel');
const genCommentaryField = document.getElementById('genCommentaryField');
const genNameCounter = document.getElementById('genNameCounter');
const genNameError = document.getElementById('genNameError');
const genCommentaryCounter = document.getElementById('genCommentaryCounter');
let genPreviewCanvas = document.getElementById('genPreviewCanvas');
const genPreviewWrap = document.getElementById('genPreviewWrap');
const genUndoBtn = document.getElementById('genUndoBtn');
const genRedoBtn = document.getElementById('genRedoBtn');
const genFullscreenBtn = document.getElementById('genFullscreenBtn');
const genStatusMessage = document.getElementById('genStatusMessage');
const genSavedGridEl = document.getElementById('genSavedGrid');
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
let activeMode = 'gallery'; // 'gallery' | 'create'
let navigableList = [];  // [{name, profile, isPortrait, assetId}] — all profiles in display order
let currentIndex = -1;

/* ── Inline edit mode ── */
let editMode = null;           // null | 'edit' | 'add'
let editSourceEntry = null;    // profile entry being edited (null for 'add')
let editPanel = null;          // initGeneratePanel instance for inline edit
let editWorkerBridge = null;   // worker bridge for edit preview canvas
let editInitialized = false;

/* ── Edit-mode DOM refs ── */
const galleryContainerEl = document.getElementById('galleryContainer');
const galleryBtnLeft = document.getElementById('galleryBtnLeft');
const galleryBtnRight = document.getElementById('galleryBtnRight');
const galleryBtnEdit = document.getElementById('galleryBtnEdit');
const galleryBtnAdd = document.getElementById('galleryBtnAdd');
const gallerySaveBtn = document.getElementById('gallerySaveBtn');
const galleryRenderBtn = document.getElementById('galleryRenderBtn');
const galleryEditCanvas = document.getElementById('galleryEditCanvas');
const galleryEditConfigEl = document.getElementById('galleryEditConfig');
const editGenConfigSliders = document.getElementById('editGenConfigSliders');
const editNameField = document.getElementById('editNameField');
const editNameCounter = document.getElementById('editNameCounter');
const editNameError = document.getElementById('editNameError');
const editCommentaryField = document.getElementById('editCommentaryField');
const editTagArr = document.getElementById('editTagArr');
const editTagStr = document.getElementById('editTagStr');
const editTagDet = document.getElementById('editTagDet');

/* Populate seed tag selects immediately (needed for browse-mode morph display) */
{
    const locale = getLocale();
    const words = getLocalizedWords(locale);
    const fill = (sel, list) => {
        sel.innerHTML = '';
        for (let i = 0; i < list.length; i++) {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = list[i];
            sel.appendChild(opt);
        }
    };
    fill(editTagArr, words.arrangement);
    fill(editTagStr, words.structure);
    fill(editTagDet, words.detail);
}

/* Auto-size seed selects to selected option text (browse mode looks like plain text) */
const _fitMeasure = document.createElement('span');
_fitMeasure.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;pointer-events:none;font:inherit';
document.body.appendChild(_fitMeasure);

function fitSelect(sel) {
    const style = getComputedStyle(sel);
    _fitMeasure.style.font = style.font;
    _fitMeasure.style.fontSize = style.fontSize;
    _fitMeasure.style.fontFamily = style.fontFamily;
    _fitMeasure.style.fontStyle = style.fontStyle;
    _fitMeasure.style.letterSpacing = style.letterSpacing;
    _fitMeasure.textContent = sel.options[sel.selectedIndex]?.text || '';
    sel.style.width = (_fitMeasure.offsetWidth + 2) + 'px';
}
function fitAllSelects() {
    fitSelect(editTagArr);
    fitSelect(editTagStr);
    fitSelect(editTagDet);
}
// Re-fit when user changes selection in edit mode
editTagArr.addEventListener('change', () => fitSelect(editTagArr));
editTagStr.addEventListener('change', () => fitSelect(editTagStr));
editTagDet.addEventListener('change', () => fitSelect(editTagDet));

/* Initial fit after populate — deferred so styles are computed */
requestAnimationFrame(() => fitAllSelects());

/* ── Carousel state ── */
let carouselList = [];       // [{name, profile, isPortrait, assetId?}] — portraits first, then local

/* ── Slideshow ── */
const slideshowBtn = document.getElementById('slideshowBtn');
const slideshowDropdown = document.getElementById('slideshowDropdown');
// Gen slideshow refs removed — slideshow only in gallery mode
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

/** Sync interval dropdown — gen slideshow removed, only gallery slideshow remains */
function syncGenSlideshowInterval(/* value */) { /* no-op: gen slideshow removed */ }

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

    const galleryRect = gallerySelectionCardVisualWrap.getBoundingClientRect();
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
        media.src = gallerySelectionVisual.src;
        media.alt = gallerySelectionVisual.alt;
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
    gallerySelectionVisual.style.visibility = 'hidden';
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

    const galleryRect = gallerySelectionCardVisualWrap.getBoundingClientRect();
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
        gallerySelectionVisual.style.visibility = '';
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
        media.src = gallerySelectionVisual.src;
        media.alt = gallerySelectionVisual.alt;
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
            refreshSavedGrid();
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

    // Animation routes
    if (path === '/animation/create') return { type: 'animation', mode: 'create', source: null, profileSlug: null };
    if (path.startsWith('/animation')) {
        const match = path.match(/^\/animation\/(portraits|local|generated)\/(.+)$/);
        if (match) return { type: 'animation', mode: 'gallery', source: match[1], profileSlug: match[2] };
        return { type: 'animation', mode: 'gallery', source: null, profileSlug: null };
    }

    // Image editor route
    if (path === '/images/editor') return { type: 'image', mode: 'edit', editMode: null, source: null, profileSlug: null };

    // Image routes
    if (path === '/images/create') return { type: 'image', mode: 'create', source: null, profileSlug: null };
    const match = path.match(/^\/images\/(portraits|local|generated)\/(.+)$/);
    if (match) return { type: 'image', mode: 'gallery', source: match[1], profileSlug: match[2] };
    return { type: 'image', mode: 'gallery', source: null, profileSlug: null };
}

function pushRoute() {
    const base = activeType === 'animation' ? '/animation' : '/images';
    const url = activeMode === 'create' ? `${base}/create` : base;
    if (window.location.pathname !== url) {
        history.pushState({ type: activeType, mode: activeMode, profile: null }, '', url);
    }
}

function pushProfileRoute(name, isPortrait, assetId) {
    const base = activeType === 'animation' ? '/animation' : '/images';
    if (assetId) {
        const url = `${base}/generated/${assetId}`;
        if (window.location.pathname !== url) {
            history.pushState({ type: activeType, profile: name, isPortrait: false, assetId }, '', url);
        }
    } else {
        const slug = slugify(name);
        const prefix = isPortrait ? 'portraits' : 'local';
        const url = `${base}/${prefix}/${slug}`;
        if (window.location.pathname !== url) {
            history.pushState({ type: activeType, profile: name, isPortrait }, '', url);
        }
    }
}

function pushEditRoute() {
    const url = '/images/editor';
    if (window.location.pathname !== url) {
        history.pushState({ type: 'image', mode: 'edit' }, '', url);
    }
}

function applyRoute() {
    const route = parseRoute();
    const prevMode = activeMode;
    activeType = route.type;
    activeMode = route.mode;
    updateMenuNavLinks();

    // Handle edit mode transitions (popstate: back/forward into or out of edit)
    if (activeMode === 'edit') {
        if (prevMode === 'create') hideGenerateMode();
        if (!editMode) {
            showImageGallery();
            // Re-enter edit mode for the currently selected profile (or add mode)
            if (selected.name) {
                const entry = findProfileBySlug(slugify(selected.name), selected.isPortrait ? 'portraits' : 'local');
                enterEditMode(entry ? 'edit' : 'add', entry, true);
            } else {
                enterEditMode('add', null, true);
            }
        }
        return;
    }

    // Exiting edit mode via popstate (back button)
    if (editMode && activeMode !== 'edit') {
        exitEditMode(false, true);
    }

    // Handle create mode transitions
    if (activeMode === 'create' && prevMode !== 'create') {
        showGenerateMode();
    } else if (activeMode !== 'create' && prevMode === 'create') {
        hideGenerateMode();
    }

    if (activeMode === 'create') return;

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

/**
 * Install a chained onerror on a portrait image that tries progressively
 * lower resolutions before falling back to the thumbnail.
 * Updates the dropdown visually but does NOT change the stored preference.
 */
function installPortraitFallback(imgEl, slug, currentKey) {
    imgEl.onerror = () => {
        imgEl.onerror = null;
        const lower = getLowerPreset(currentKey);
        if (!lower) {
            imgEl.src = `/static/images/portraits/${slug}-thumb.png`;
            return;
        }
        installPortraitFallback(imgEl, slug, lower.key);
        imgEl.src = `/static/images/portraits/${slug}-${lower.key}.png`;
        syncDropdown(document.getElementById('resolutionDropdown'), lower.key);
    };
}

/** Context for in-flight worker snapshot fallback. */
let pendingSnapshotContext = null;

document.addEventListener('resolutionchange', (e) => {
    if (currentIndex < 0 || currentIndex >= navigableList.length) return;
    if (activeMode !== 'gallery' || activeType !== 'image') return;

    const entry = navigableList[currentIndex];
    const { profile } = entry;

    // Portrait: swap to resolution-specific static image
    if (entry.isPortrait) {
        gallerySelectionVisual.src = getDisplaySrc(entry.name, profile, true);
        installPortraitFallback(gallerySelectionVisual, slugify(entry.name), e.detail.key);
        syncFullscreenMedia();
        return;
    }

    // Generated/local: re-render via worker
    if (!workerBridge || !workerBridge.ready) return;
    if (!profile || !profile.seed || !profile.controls) return;

    const { w, h } = e.detail;
    pendingSnapshotContext = {
        resKey: e.detail.key,
        seed: profile.seed,
        controls: profile.controls,
        locale: getLocale(),
    };
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
    morphNameRow.classList.add('fading');
    morphSeedRow.classList.add('fading');
    gallerySelectionCardFooter.classList.add('fading');
    gallerySelectionVisual.style.opacity = '0';
    fadeOutAltText();

    // Cancel any pending fade-in from a previous rapid selection
    clearTimeout(selectionFadeTimer);

    // After fade-out completes, swap content and fade back in
    selectionFadeTimer = setTimeout(() => {
        // Update unified morph elements
        editNameField.value = name;
        if (Array.isArray(profile.seed)) {
            editTagArr.value = String(profile.seed[0]);
            editTagStr.value = String(profile.seed[1]);
            editTagDet.value = String(profile.seed[2]);
        } else {
            editTagArr.value = '0';
            editTagStr.value = '0';
            editTagDet.value = '0';
        }
        fitAllSelects();

        // Portrait commentary vs generated/custom text
        if (isPortrait && profile.generated) {
            selectedGenTitle.textContent = '';
            gallerySelectionCardCommentaryText.textContent = profile.commentary || '';
            gallerySelectionCardCommentaryText.classList.add('expanded');
            gallerySelectionVisual.alt = `${name} \u2014 ${profile.generated.title}`;
            gallerySelectionVisual.setAttribute('data-tooltip', profile.generated['alt-text']);
            gallerySelectionVisual.setAttribute('data-tooltip-pos', 'overlay');
        } else if (assetId) {
            const asset = generatedAssets.find(a => a.id === assetId);
            if (asset && asset.meta && asset.meta.commentary) {
                // Commentary exists — display like sampler portraits
                selectedGenTitle.textContent = '';
                gallerySelectionCardCommentaryText.textContent = asset.meta.commentary;
                gallerySelectionCardCommentaryText.classList.add('expanded');
                gallerySelectionVisual.alt = `${name} — ${asset.meta.title || ''}`;
                gallerySelectionVisual.setAttribute('data-tooltip', asset.meta.altText || asset.meta.title || name);
                gallerySelectionVisual.setAttribute('data-tooltip-pos', 'overlay');
            } else if (asset && asset.meta) {
                // No commentary — show title + collapsible alt-text
                selectedGenTitle.textContent = asset.meta.title || '';
                gallerySelectionCardCommentaryText.textContent = asset.meta.altText || '';
                gallerySelectionVisual.alt = asset.meta.title || name;
                gallerySelectionVisual.setAttribute('data-tooltip', asset.meta.altText || asset.meta.title || name);
                gallerySelectionVisual.setAttribute('data-tooltip-pos', 'overlay');
                gallerySelectionCardCommentaryText.classList.remove('expanded');
            }
        } else if (profile.commentary) {
            // User-saved profile with commentary
            const { title, altText } = generateProfileText(profile);
            selectedGenTitle.textContent = '';
            gallerySelectionCardCommentaryText.textContent = profile.commentary;
            gallerySelectionCardCommentaryText.classList.add('expanded');
            gallerySelectionVisual.alt = `${name} — ${title}`;
            gallerySelectionVisual.setAttribute('data-tooltip', altText || title);
            gallerySelectionVisual.setAttribute('data-tooltip-pos', 'overlay');
        } else {
            const { title, altText } = generateProfileText(profile);
            selectedGenTitle.textContent = title;
            gallerySelectionCardCommentaryText.textContent = altText;
            gallerySelectionVisual.alt = title;
            gallerySelectionVisual.setAttribute('data-tooltip', altText || title);
            gallerySelectionVisual.setAttribute('data-tooltip-pos', 'overlay');
            gallerySelectionCardCommentaryText.classList.remove('expanded');
        }

        // Update alt-text overlay if visible
        updateAltText(gallerySelectionVisual.getAttribute('data-tooltip'));

        // Swap image src (old image is now fully hidden)
        if (currentStaticUrl) { URL.revokeObjectURL(currentStaticUrl); currentStaticUrl = null; }
        if (snapshotUrl) { URL.revokeObjectURL(snapshotUrl); snapshotUrl = null; }

        gallerySelectionVisual.addEventListener('load', () => {
            gallerySelectionVisual.style.opacity = '1';
        }, { once: true });

        if (assetId) {
            const asset = generatedAssets.find(a => a.id === assetId);
            if (asset && asset.thumbDataUrl) gallerySelectionVisual.src = asset.thumbDataUrl;
            getAsset(assetId).then(full => {
                if (full && full.staticBlob && selected.assetId === assetId) {
                    currentStaticUrl = URL.createObjectURL(full.staticBlob);
                    gallerySelectionVisual.src = currentStaticUrl;
                }
            });
        } else {
            const src = getDisplaySrc(name, profile, isPortrait);
            if (src) gallerySelectionVisual.src = src;
        }

        if (isPortrait) {
            installPortraitFallback(gallerySelectionVisual, slugify(name), getResolution().key);
        }

        // Fade text back in
        morphNameRow.classList.remove('fading');
        morphSeedRow.classList.remove('fading');
        gallerySelectionCardFooter.classList.remove('fading');
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
    galleryBtnLeft.disabled = disabled;
    galleryBtnRight.disabled = disabled;

    galleryBtnLeft.setAttribute('data-tooltip', disabled ? '' : 'Previous');
    galleryBtnRight.setAttribute('data-tooltip', disabled ? '' : 'Next');
}

function navigateArrow(direction) {
    if (navigableList.length <= 1) return;
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = navigableList.length - 1;
    if (newIndex >= navigableList.length) newIndex = 0;
    const entry = navigableList[newIndex];
    selectProfile(entry.name, entry.profile, entry.isPortrait, entry.assetId);
}

// Morph buttons: left = prev/undo, right = next/redo
galleryBtnLeft.addEventListener('click', () => {
    if (editMode) { if (editPanel) editPanel.undo(); }
    else { if (slideshowPlaying) stopSlideshow(); navigateArrow(-1); }
});
galleryBtnRight.addEventListener('click', () => {
    if (editMode) { if (editPanel) editPanel.redo(); }
    else { if (slideshowPlaying) stopSlideshow(); navigateArrow(1); }
});

/* ── Alt-text overlays (independent of tooltip system) ── */
// Suppress hover tooltips on these elements (they use dedicated overlays instead)
gallerySelectionVisual.setAttribute('data-tooltip-click', '');
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

gallerySelectionVisual.addEventListener('click', () => {
    const text = gallerySelectionVisual.getAttribute('data-tooltip');
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
    // Navigate to create mode within the SPA
    handleMenuNav(activeType, 'create');
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

    // Append generated assets (in user-defined order)
    const orderedGen = syncGeneratedOrder(generatedAssets);
    for (const asset of orderedGen) {
        carouselList.push({
            name: asset.name,
            profile: { seed: asset.meta?.seed, controls: asset.meta?.controls, camera: asset.meta?.camera },
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
            history.replaceState({ type: 'image', profile: first.name }, '', `/images/generated/${first.assetId}`);
        } else {
            const slug = slugify(first.name);
            const prefix = first.isPortrait ? 'portraits' : 'local';
            history.replaceState({ type: 'image', profile: first.name }, '', `/images/${prefix}/${slug}`);
        }
    }

    galleryContentEl.style.display = '';
    gallerySelectionContainer.style.display = '';
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
    gallerySelectionContainer.style.display = animAssets.length > 0 ? '' : 'none';
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
    editNameField.value = asset.name;
    editTagArr.value = '0';
    editTagStr.value = '0';
    editTagDet.value = '0';
    fitAllSelects();

    const meta = asset.meta || {};
    selectedGenTitle.textContent = meta.title || asset.name;
    gallerySelectionCardCommentaryText.textContent = meta.durationS
        ? `${meta.durationS.toFixed(1)}s animation at ${meta.fps || 30}fps (${meta.width || '?'}×${meta.height || '?'})`
        : '';

    // Show video, hide image
    if (asset.videoBlob) {
        if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
        currentVideoUrl = URL.createObjectURL(asset.videoBlob);
        selectedVideo.src = currentVideoUrl;
        selectedVideo.classList.remove('hidden');
        gallerySelectionVisual.style.display = 'none';
    } else if (asset.thumbDataUrl) {
        // No video — show thumbnail
        selectedVideo.classList.add('hidden');
        gallerySelectionVisual.style.display = '';
        gallerySelectionVisual.src = asset.thumbDataUrl;
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
    gallerySelectionVisual.style.display = '';
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
        if (mode === 'create') {
            showGenerateMode();
        } else {
            hideGenerateMode();
        }
    }

    if (typeChanged) {
        selected = { name: null, isPortrait: false };
        refreshGallery();
        if (activeMode === 'create') {
            gallerySelectionContainer.style.display = 'none';
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
    if (enabled && genPanel) {
        [genFullscreenBtn].forEach(btn => { if (btn) btn.disabled = false; });
        return;
    }
    [genUndoBtn, genRedoBtn, genFullscreenBtn].forEach(btn => {
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

/* ── Save handler with conflict detection ── */

/**
 * Capture the current preview frame as a data URL for use as a thumbnail.
 * Returns '' if the worker bridge is unavailable or capture fails.
 */
function capturePreviewThumb() {
    const wb = editMode ? editWorkerBridge : workerBridge;
    return new Promise(resolve => {
        if (!wb || !wb.ready) return resolve('');
        let settled = false;
        const reqId = 'save-thumb-' + Date.now();
        const handler = (msg) => {
            if (msg.requestId !== reqId || settled) return;
            settled = true;
            if (!msg.blob) return resolve('');
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve('');
            reader.readAsDataURL(msg.blob);
        };
        wb.on('frame-captured', handler);
        wb.captureFrame(reqId);
        // Timeout fallback
        setTimeout(() => { if (!settled) { settled = true; resolve(''); } }, 3000);
    });
}

async function handleSave(name, seed, controls, camera, commentary) {
    // Capture preview thumbnail before saving
    const thumbDataUrl = await capturePreviewThumb();

    // Check for name conflict in existing saved assets
    const existingAsset = generatedAssets.find(a => a.name === name);

    if (existingAsset) {
        // Show conflict modal
        const result = await showSaveConflictModal(name);
        if (!result) return null; // cancelled
        if (result.action === 'overwrite') {
            // Overwrite existing asset
            const asset = existingAsset;
            asset.seed = seed;
            asset.controls = controls;
            asset.thumbDataUrl = thumbDataUrl || asset.thumbDataUrl;
            asset.meta = { ...asset.meta, seed, controls, camera, commentary, title: name };
            asset.name = name;
            await putAsset(asset);
            generatedAssets = await getAllAssets();
            refreshSavedGrid();
            toast(`Overwritten "${name}"`);
            return { id: asset.id, overwritten: true };
        } else {
            // Save as new with different name
            name = result.name;
        }
    }

    // Save as new
    const id = generateAssetId();
    const asset = {
        id,
        name,
        thumbDataUrl,
        seed,
        controls,
        meta: { seed, controls, camera, commentary, title: name },
        createdAt: Date.now(),
    };
    await putAsset(asset);
    generatedAssets = await getAllAssets();
    refreshSavedGrid();
    toast(`Saved "${name}"`);
    return { id, overwritten: false };
}

function showSaveConflictModal(existingName) {
    return new Promise(resolve => {
        const backdrop = document.createElement('div');
        backdrop.className = 'gen-modal-backdrop';

        const modal = document.createElement('div');
        modal.className = 'gen-modal';

        const title = document.createElement('div');
        title.className = 'gen-modal-title';
        title.textContent = 'Name already exists';

        const msg = document.createElement('div');
        msg.className = 'gen-modal-msg';
        msg.textContent = `An image named "${existingName}" already exists. Overwrite it, or enter a new name:`;

        const input = document.createElement('input');
        input.className = 'gen-modal-input';
        input.type = 'text';
        input.value = existingName;
        input.maxLength = 40;

        const btns = document.createElement('div');
        btns.className = 'gen-modal-btns';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'gen-modal-btn';
        cancelBtn.textContent = 'Cancel';

        const overwriteBtn = document.createElement('button');
        overwriteBtn.className = 'gen-modal-btn';
        overwriteBtn.textContent = 'Overwrite';

        const saveNewBtn = document.createElement('button');
        saveNewBtn.className = 'gen-modal-btn primary';
        saveNewBtn.textContent = 'Save as New';

        function close(result) {
            backdrop.remove();
            resolve(result);
        }

        cancelBtn.addEventListener('click', () => close(null));
        overwriteBtn.addEventListener('click', () => close({ action: 'overwrite' }));
        saveNewBtn.addEventListener('click', () => {
            const newName = input.value.trim();
            if (!newName) return;
            if (newName === existingName) {
                // Same name — treat as overwrite
                close({ action: 'overwrite' });
                return;
            }
            // Check if new name also conflicts
            if (generatedAssets.find(a => a.name === newName)) {
                msg.textContent = `"${newName}" also exists. Enter a different name:`;
                input.focus();
                return;
            }
            close({ action: 'saveNew', name: newName });
        });

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) close(null);
        });

        btns.append(cancelBtn, overwriteBtn, saveNewBtn);
        modal.append(title, msg, input, btns);
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
        input.focus();
        input.select();
    });
}

/* ── Saved images grid ── */

function refreshSavedGrid() {
    if (!genSavedGridEl) return;
    const ordered = syncGeneratedOrder(generatedAssets);
    genSavedGridEl.innerHTML = '';

    if (ordered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'gen-saved-empty';
        empty.textContent = 'No user images saved';
        genSavedGridEl.appendChild(empty);
        return;
    }

    for (let i = 0; i < ordered.length; i++) {
        const asset = ordered[i];
        const card = document.createElement('div');
        card.className = 'gen-saved-card';
        card.draggable = true;
        card.dataset.assetId = asset.id;
        if (genPanel && genPanel.currentAssetId === asset.id) {
            card.classList.add('gen-saved-active');
        }

        // Thumbnail
        const thumb = document.createElement('img');
        thumb.className = 'gen-saved-thumb';
        thumb.src = asset.thumbDataUrl || '';
        thumb.alt = asset.name || '';
        thumb.loading = 'lazy';
        card.appendChild(thumb);

        // Info
        const info = document.createElement('div');
        info.className = 'gen-saved-info';
        const nameEl = document.createElement('div');
        nameEl.className = 'gen-saved-name';
        nameEl.textContent = asset.name || '';
        info.appendChild(nameEl);
        if (asset.meta?.commentary) {
            const comm = document.createElement('div');
            comm.className = 'gen-saved-commentary';
            comm.textContent = asset.meta.commentary;
            info.appendChild(comm);
        }
        card.appendChild(info);

        // Delete button (hover overlay)
        const actions = document.createElement('div');
        actions.className = 'gen-saved-actions';
        const delBtn = document.createElement('button');
        delBtn.className = 'gen-saved-action-btn gen-saved-delete';
        delBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="2" y1="2" x2="8" y2="8"/><line x1="8" y1="2" x2="2" y2="8"/></svg>';
        delBtn.title = 'Delete';
        delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const result = await showConfirm(
                'Delete image?',
                `Delete "${asset.name}"? This cannot be undone.`,
                [
                    { label: t('btn.cancel') },
                    { label: t('btn.delete'), primary: true, value: 'delete' },
                ],
            );
            if (result !== 'delete') return;
            await deleteAsset(asset.id);
            generatedAssets = generatedAssets.filter(a => a.id !== asset.id);
            refreshSavedGrid();
            toast(`Deleted "${asset.name}"`);
        });
        actions.appendChild(delBtn);
        card.appendChild(actions);

        // Click to load into editor
        card.addEventListener('click', () => {
            if (genPanel) {
                genPanel.loadFromAsset(asset);
                refreshSavedGrid(); // update active highlight
                if (workerBridge && workerBridge.ready) {
                    const seed = genPanel.readSeed();
                    const controls = genPanel.readControls();
                    const camera = genPanel.readCamera();
                    workerBridge.sendRenderImmediate(seed, controls, getLocale());
                    workerBridge.sendCameraState(camera.zoom, camera.rotation, camera.elevation);
                }
            }
        });

        // Drag and drop
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', asset.id);
            card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            card.classList.add('drag-over');
        });
        card.addEventListener('dragleave', () => {
            card.classList.remove('drag-over');
        });
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');
            const draggedId = e.dataTransfer.getData('text/plain');
            if (draggedId && draggedId !== asset.id) {
                reorderSavedGridDrop(draggedId, asset.id);
            }
        });

        genSavedGridEl.appendChild(card);
    }
}

function reorderSavedGridDrop(draggedId, targetId) {
    const ordered = syncGeneratedOrder(generatedAssets);
    const ids = ordered.map(a => a.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    // Remove from old position and insert at new
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedId);
    saveGeneratedOrder(ids);
    refreshSavedGrid();
}

function initGenerate() {
    if (generateInitialized) return;
    generateInitialized = true;

    // Create worker bridge on first generate entry (deferred from page load)
    workerBridge = initGalleryWorker(genPreviewCanvas);
    if (workerBridge) {
        workerBridge.on('snapshot-complete', (msg) => {
            pendingSnapshotContext = null;
            if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
            snapshotUrl = URL.createObjectURL(msg.blob);
            gallerySelectionVisual.src = snapshotUrl;
        });
        workerBridge.on('snapshot-failed', () => {
            if (!pendingSnapshotContext) return;
            const ctx = pendingSnapshotContext;
            const lower = getLowerPreset(ctx.resKey);
            if (!lower) {
                pendingSnapshotContext = null;
                return;
            }
            pendingSnapshotContext = { ...ctx, resKey: lower.key };
            workerBridge.sendSnapshot({
                requestId: 'snap-' + Date.now(),
                seed: ctx.seed,
                controls: ctx.controls,
                locale: ctx.locale,
                width: lower.w,
                height: lower.h,
            });
            syncDropdown(document.getElementById('resolutionDropdown'), lower.key);
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
        randomizeBtn: genRandomizeBtn,
        renderBtn: genRenderBtn,
        undoBtn: genUndoBtn,
        redoBtn: genRedoBtn,
        fullscreenBtn: genFullscreenBtn,
        nameTooltipEl: genNameLabel?.querySelector('.label-info'),
        commentaryField: genCommentaryField,
        previewCanvas: genPreviewCanvas,
        nameCounter: genNameCounter,
        nameError: genNameError,
        commentaryCounter: genCommentaryCounter,
        statusMessageEl: genStatusMessage,
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
        async onSave(name, seed, controls, camera, commentary) {
            return handleSave(name, seed, controls, camera, commentary);
        },
        onFullscreen() {
            if (genFullscreenOverlay) closeGenFullscreen();
            else openGenFullscreen();
        },
    });

    // Wire up collapsible toggles in the generate config
    generatePanelEl.querySelectorAll('.gen-collapse-toggle[data-target]').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const expanded = toggle.getAttribute('aria-expanded') === 'true';
            toggle.setAttribute('aria-expanded', String(!expanded));
            const target = document.getElementById(toggle.dataset.target);
            if (!target) return;

            if (expanded) {
                target.style.maxHeight = target.scrollHeight + 'px';
                requestAnimationFrame(() => {
                    target.classList.add('collapsed');
                    target.style.maxHeight = '0';
                });
            } else {
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

    // Determine which create panel to show
    const isAnimCreate = activeType === 'animation';
    const targetEl = isAnimCreate ? animationEditorEl : generatePanelEl;

    if (!isAnimCreate) {
        const wasInitialized = generateInitialized;
        initGenerate();
        refreshSavedGrid();

        // Load the selected profile's config into the generate panel
        if (genPanel && selected.name) {
            const entry = navigableList.find(p =>
                p.assetId ? p.assetId === selected.assetId : p.name === selected.name,
            );
            if (entry?.profile?.seed && entry.profile.controls) {
                const displayName = entry.isPortrait ? entry.name + ' (User Version)' : entry.name;
                genPanel.setValues(entry.profile.seed, entry.profile.controls, entry.profile.camera, displayName, entry.profile.commentary);
                genPanel.setUnlocked();
                if (wasInitialized && workerBridge?.ready) {
                    const seed = genPanel.readSeed();
                    const controls = genPanel.readControls();
                    const camera = genPanel.readCamera();
                    workerBridge.sendRenderImmediate(seed, controls, getLocale());
                    workerBridge.sendCameraState(camera.zoom, camera.rotation, camera.elevation);
                }
            }
        }
    } else {
        initAnimationEditor();
    }

    modeTransitioning = true;

    // Phase 1: fade out gallery views
    gallerySelectionContainer.classList.add('view-fade-out');
    galleryContentEl.classList.add('view-fade-out');

    setTimeout(() => {
        // Phase 2: swap visibility
        gallerySelectionContainer.style.display = 'none';
        galleryContentEl.style.display = 'none';
        gallerySelectionContainer.classList.remove('view-fade-out');
        galleryContentEl.classList.remove('view-fade-out');

        targetEl.classList.remove('hidden');
        targetEl.classList.add('view-fade-in');
        // force reflow
        targetEl.offsetHeight;     // eslint-disable-line no-unused-expressions

        // Phase 3: fade in create panel
        targetEl.classList.remove('view-fade-in');
        modeTransitioning = false;
    }, 250);
}

function hideGenerateMode() {
    if (modeTransitioning) return;
    modeTransitioning = true;

    // Hide whichever create panel is visible
    const visibleEl = !generatePanelEl.classList.contains('hidden') ? generatePanelEl
        : !animationEditorEl.classList.contains('hidden') ? animationEditorEl
        : null;

    if (visibleEl === animationEditorEl) {
        destroyAnimationEditor();
    }

    if (!visibleEl) {
        modeTransitioning = false;
        return;
    }

    // Phase 1: fade out create panel
    visibleEl.classList.add('view-fade-out');

    setTimeout(() => {
        // Phase 2: swap visibility
        visibleEl.classList.add('hidden');
        visibleEl.classList.remove('view-fade-out');

        gallerySelectionContainer.style.display = '';
        galleryContentEl.style.display = '';
        gallerySelectionContainer.classList.add('view-fade-in');
        galleryContentEl.classList.add('view-fade-in');
        // force reflow
        gallerySelectionContainer.offsetHeight;     // eslint-disable-line no-unused-expressions

        // Phase 3: fade in gallery views
        gallerySelectionContainer.classList.remove('view-fade-in');
        galleryContentEl.classList.remove('view-fade-in');
        modeTransitioning = false;
    }, 250);
}

/* ── Inline edit mode ── */

function initEditMode() {
    if (editInitialized) return;
    editInitialized = true;

    // Create worker bridge for the edit preview canvas
    editWorkerBridge = initGalleryWorker(galleryEditCanvas);
    if (!editWorkerBridge) return;

    editWorkerBridge.on('rendered', () => {
        // preview updated
    });
    editWorkerBridge.on('error', () => {
        // Could show error overlay
    });

    editPanel = initGeneratePanel({
        slidersEl: editGenConfigSliders,
        tagArrEl: editTagArr,
        tagStrEl: editTagStr,
        tagDetEl: editTagDet,
        nameField: editNameField,
        saveBtn: gallerySaveBtn,
        randomizeBtn: null,   // randomize handled by galleryBtnAdd morph
        renderBtn: galleryRenderBtn,
        undoBtn: null,        // undo handled by galleryBtnLeft morph
        redoBtn: null,        // redo handled by galleryBtnRight morph
        fullscreenBtn: null,
        nameCounter: editNameCounter,
        nameError: editNameError,
        commentaryField: editCommentaryField,
        previewCanvas: galleryEditCanvas,
        commentaryCounter: null,
        statusMessageEl: null,
        onControlChange(seed, controls, camera) {
            if (editWorkerBridge && editWorkerBridge.ready) {
                editWorkerBridge.sendRender(seed, controls, getLocale());
                editWorkerBridge.sendCameraState(camera.zoom, camera.rotation, camera.elevation);
            }
        },
        onRender(seed, controls, camera, name, commentary) {
            if (!renderQueue) return;
            renderQueue.enqueue(seed, controls, name, commentary);
        },
        async onSave(name, seed, controls, camera, commentary) {
            const result = await handleSave(name, seed, controls, camera, commentary);
            if (result) {
                exitEditMode(true);
            }
            return result;
        },
        onFullscreen() {
            if (fullscreenOverlay) closeFullscreen();
            else openFullscreen();
        },
    });

    // Wire up collapsible toggles in the edit config
    galleryEditConfigEl.querySelectorAll('.gen-collapse-toggle[data-target]').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const expanded = toggle.getAttribute('aria-expanded') === 'true';
            toggle.setAttribute('aria-expanded', String(!expanded));
            const target = document.getElementById(toggle.dataset.target);
            if (!target) return;
            if (expanded) {
                target.style.maxHeight = target.scrollHeight + 'px';
                requestAnimationFrame(() => {
                    target.classList.add('collapsed');
                    target.style.maxHeight = '0';
                });
            } else {
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

    editWorkerBridge.onReady(() => {
        // Create render queue if not already created by the old gen panel
        if (!renderQueue) {
            renderQueue = createRenderQueue({
                workerBridge: editWorkerBridge,
                onUpdate(jobs) {
                    if (rqMenu) rqMenu.update(jobs);
                },
                locale: getLocale(),
            });
        }

        // Send initial render if we're already in edit mode
        if (editMode && editPanel) {
            const seed = editPanel.readSeed();
            const controls = editPanel.readControls();
            const camera = editPanel.readCamera();
            editWorkerBridge.sendRenderImmediate(seed, controls, getLocale());
            editWorkerBridge.sendCameraState(camera.zoom, camera.rotation, camera.elevation);
        }
    });
}

async function enterEditMode(mode, entry, fromPopstate) {
    if (editMode) return; // already in edit mode
    if (slideshowPlaying) stopSlideshow();

    editMode = mode;
    editSourceEntry = entry || null;

    // Update URL (skip if triggered by popstate — URL already correct)
    if (!fromPopstate) pushEditRoute();

    // Initialize worker + panel on first use
    initEditMode();

    // Populate inputs
    if (mode === 'edit' && entry?.profile) {
        const displayName = entry.isPortrait ? entry.name + ' (User Version)' : entry.name;
        editPanel.setValues(
            entry.profile.seed,
            entry.profile.controls,
            entry.profile.camera,
            displayName,
            entry.profile.commentary,
        );
        editPanel.setUnlocked();
    } else {
        // 'add' mode — randomize
        editPanel.randomize();
    }

    // Toggle editing class (triggers all CSS cross-fade transitions)
    galleryContainerEl.classList.add('editing');
    // Clear inline widths so flex sizing takes over in edit mode
    editTagArr.style.width = '';
    editTagStr.style.width = '';
    editTagDet.style.width = '';

    // Update button tooltips for edit mode
    galleryBtnLeft.setAttribute('data-tooltip', 'Undo');
    galleryBtnRight.setAttribute('data-tooltip', 'Redo');
    galleryBtnEdit.setAttribute('data-tooltip', 'Cancel');
    galleryBtnAdd.setAttribute('data-tooltip', 'Randomize');

    // Send render if worker is ready
    if (editWorkerBridge && editWorkerBridge.ready) {
        const seed = editPanel.readSeed();
        const controls = editPanel.readControls();
        const camera = editPanel.readCamera();
        editWorkerBridge.sendRenderImmediate(seed, controls, getLocale());
        editWorkerBridge.sendCameraState(camera.zoom, camera.rotation, camera.elevation);
    }

    // Enter carousel edit mode: filter to user images, expand to grid, lock interaction
    await carouselBrowser.enterMode({
        filter: item => !item.data?.isPortrait,
        expand: true,
        hideControls: true,
        locked: true,
    });
}

async function exitEditMode(saved, fromPopstate) {
    if (!editMode) return;

    if (saved) {
        // Refresh gallery to show the new/updated profile
        refreshGallery();
    }

    // Remove editing class (triggers all CSS cross-fade transitions)
    galleryContainerEl.classList.remove('editing');
    // Restore inline widths for browse-mode text sizing
    requestAnimationFrame(() => fitAllSelects());

    // Navigate back to gallery URL (skip if triggered by popstate)
    if (!fromPopstate) {
        activeMode = 'gallery';
        if (selected.name) {
            pushProfileRoute(selected.name, selected.isPortrait, selected.assetId);
        } else {
            pushRoute();
        }
    }

    // Restore button tooltips for browse mode
    galleryBtnLeft.setAttribute('data-tooltip', 'Previous');
    galleryBtnRight.setAttribute('data-tooltip', 'Next');
    galleryBtnEdit.setAttribute('data-tooltip', 'Edit');
    galleryBtnAdd.setAttribute('data-tooltip', 'Add new');

    editMode = null;
    editSourceEntry = null;

    // Restore carousel to full state
    await carouselBrowser.exitMode();
}

// ── Edit/Add/Save/Render button handlers ──

galleryBtnEdit.addEventListener('click', () => {
    if (editMode) {
        // Cancel — exit without saving
        exitEditMode(false);
    } else {
        // Enter edit mode with selected profile
        const entry = navigableList[currentIndex];
        if (entry) enterEditMode('edit', entry);
    }
});

// ── Right-click / long-press "Edit image" context menu on main visual ──
{
    const ctxMenu = document.createElement('div');
    ctxMenu.className = 'gallery-ctx-menu';
    ctxMenu.setAttribute('role', 'menu');
    ctxMenu.innerHTML = '<button class="gallery-ctx-item" role="menuitem">Edit image</button>';
    document.body.appendChild(ctxMenu);

    const ctxItem = ctxMenu.querySelector('.gallery-ctx-item');

    function showCtxMenu(x, y) {
        ctxMenu.style.left = Math.min(x, window.innerWidth - 160) + 'px';
        ctxMenu.style.top = Math.min(y, window.innerHeight - 40) + 'px';
        ctxMenu.classList.add('visible');
        ctxItem.focus();
    }

    function hideCtxMenu() {
        ctxMenu.classList.remove('visible');
    }

    function triggerEdit() {
        hideCtxMenu();
        const entry = navigableList[currentIndex];
        if (entry) enterEditMode('edit', entry);
    }

    // Desktop: right-click
    gallerySelectionCardVisualWrap.addEventListener('contextmenu', (e) => {
        if (editMode) return; // already editing, allow native menu
        e.preventDefault();
        showCtxMenu(e.clientX, e.clientY);
    });

    // Mobile/tablet: long-press (500ms)
    let lpTimer = 0;
    let lpFired = false;
    gallerySelectionCardVisualWrap.addEventListener('touchstart', (e) => {
        if (editMode) return;
        if (e.touches.length !== 1) return;
        lpFired = false;
        const touch = e.touches[0];
        lpTimer = setTimeout(() => {
            lpFired = true;
            showCtxMenu(touch.clientX, touch.clientY);
        }, 500);
    }, { passive: true });
    gallerySelectionCardVisualWrap.addEventListener('touchmove', () => { clearTimeout(lpTimer); }, { passive: true });
    gallerySelectionCardVisualWrap.addEventListener('touchend', (e) => {
        clearTimeout(lpTimer);
        if (lpFired) e.preventDefault();
    });
    gallerySelectionCardVisualWrap.addEventListener('touchcancel', () => { clearTimeout(lpTimer); });

    ctxItem.addEventListener('click', triggerEdit);
    ctxItem.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); triggerEdit(); }
        if (e.key === 'Escape') hideCtxMenu();
    });

    document.addEventListener('mousedown', (e) => {
        if (!ctxMenu.contains(e.target)) hideCtxMenu();
    });
    document.addEventListener('scroll', hideCtxMenu, true);
    window.addEventListener('resize', hideCtxMenu);
}

galleryBtnAdd.addEventListener('click', () => {
    if (editMode) {
        // Randomize
        if (editPanel) editPanel.randomize();
    } else {
        // Enter add mode with random config
        enterEditMode('add', null);
    }
});

gallerySaveBtn.addEventListener('click', () => {
    if (editMode && editPanel) {
        const name = editPanel.readName();
        const seed = editPanel.readSeed();
        const controls = editPanel.readControls();
        const camera = editPanel.readCamera();
        const commentary = editPanel.readCommentary();
        handleSave(name, seed, controls, camera, commentary).then(result => {
            if (result) exitEditMode(true);
        });
    }
});

galleryRenderBtn.addEventListener('click', () => {
    if (editMode && editPanel && renderQueue) {
        const seed = editPanel.readSeed();
        const controls = editPanel.readControls();
        const name = editPanel.readName();
        const commentary = editPanel.readCommentary();
        renderQueue.enqueue(seed, controls, name, commentary);
    }
});

/* ── Keyboard navigation ── */
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (editMode) {
            exitEditMode(false);
            return;
        }
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
        if (activeMode === 'create') {
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
    history.replaceState({ type: 'image', profile: null }, '', '/images');
}

if (activeMode === 'create') {
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
            gallerySelectionCardCommentaryText.textContent = altText;
            gallerySelectionVisual.alt = title;
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
    if (activeMode === 'create') refreshSavedGrid();
});

/* ── Share ── */

initSharePopover({
    shareBtn: document.getElementById('shareBtn'),
    sharePopover: document.getElementById('sharePopover'),
    getShareURL: () => window.location.origin + window.location.pathname,
    getShareTitle: () => {
        const name = editNameField.value.trim();
        return name ? `${name} — Geometric Interior` : 'Geometric Interior';
    },
});
