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
import '../../components/image-viewer.js';
import { createHeader } from '../../components/create-header.js';
import { createFooter } from '../../components/create-footer.js';
import { initApp } from '../../components/app-init.js';
import { initTheme } from '../../stores/theme.js';
import { initLangSelector } from '../../i18n/lang-selector.js';
import { initResolutionSelector, getResolution, getGenResolution, getLowerPreset, setResolution, getPresets } from '../../stores/resolution.js';
import { t, getLocale } from '../../i18n/locale.js';
import { loadProfiles, loadPortraits, getPortraitNames, loadPortraitSections, syncProfileOrder, deleteProfile, loadProfileOrder, saveProfileOrder, saveProfiles } from '../../stores/profiles.js';
import { getAllThumbs, deleteThumb } from '../../stores/thumb-cache.js';
import { getAllAssets, getAsset, deleteAsset, putAsset, generateAssetId, getAllAnimAssets, deleteAnimAsset } from '../../stores/asset-store.js';
import { syncGeneratedOrder, saveGeneratedOrder } from '../../stores/generated-order.js';
import { generateTitle } from '@geometric-interior/core/text-generation/title-text.js';
import { generateAltText } from '@geometric-interior/core/text-generation/alt-text.js';
import { xmur3, mulberry32 } from '@geometric-interior/utils/prng.js';
import { getLocalizedWords, seedTagToLabel } from '@geometric-interior/core/text-generation/seed-tags.js';
import { toast } from '../../components/toast.js';
import { showConfirm } from '../../components/modals.js';
import { slugify } from '../../components/slugify.js';
import {
    TRASH_SVG, EDIT_SVG, FULLSCREEN_SVG, CLOSE_SVG, ERROR_SVG, RETRY_SVG,
    UNDO_SVG, REDO_SVG, SAVE_SVG, RANDOMIZE_SVG, RENDER_SVG,
    FIELD_DIAMOND_SVG, DOWNLOAD_SVG, SHARE_SVG, LINK_SVG, ARROW_RIGHT_SVG,
    BLUESKY_SVG, FACEBOOK_SVG, GOOGLE_SVG, LINKEDIN_SVG, REDDIT_SVG, TWITTER_SVG, EMAIL_SVG,
} from '../../components/icons.js';
import { downloadBlob, injectPngTextChunks, safeName, toIsoLocalish } from '../../export/export.js';
import { profileToConfig } from '@geometric-interior/core/config-schema.js';
import { refreshTooltip } from '../../components/tooltips.js';
import { initSharePopover } from '../../components/share-popover.js';
import { initGalleryWorker } from './gallery-worker-bridge.js';
import { createRenderQueue } from './render-queue.js';
import { initGeneratePanel, renderQueueUI } from './generate-panel.js';
import { initRenderQueueMenu } from './render-queue-menu.js';
// import { initCustomDropdown } from '../../components/custom-dropdown.js'; // slideshow removed
import { initAnimationEditor, destroyAnimationEditor } from '../animation/anim-main.js';
import { createLayoutMorph } from '../../components/layout-morph.js';

/* ── Build header & footer DOM ── */
createHeader(document.querySelector('.app-header'), { page: 'gallery' });
const footerRefs = createFooter(document.querySelector('.app-footer'), { page: 'gallery' });

/* ── Shared init (locale, tooltips, toast, statement modal, favicon) ── */
const { statement } = initApp({ page: 'gallery' });

/* ── Gallery-specific init ── */
initTheme(footerRefs.themeSwitcher);
initLangSelector(footerRefs.langDropdown);
// Image resolution selector set up later in viewer controls block
// Gen resolution selector removed — now part of render flow

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
/** @type {import('../../components/image-viewer.js').ImageViewer} */
const galleryViewer = document.getElementById('galleryViewer');
const gallerySelectionVisual = galleryViewer.getImg();
const gallerySelectionCardVisualWrap = galleryViewer.getWrap();
const gallerySelectionContainer = document.getElementById('gallerySelectionContainer');
const galleryContentEl = document.getElementById('galleryContent');
const selectedGenTitle = document.getElementById('selectedGenTitle');
const selectedVideo = galleryViewer.getVideo();
const gallerySelectionCardFooter = document.querySelector('.gallery-selection-card-footer');
const morphNameRow = document.querySelector('.morph-name');
const morphSeedRow = document.querySelector('.morph-seed');

/* ── Carousel component ── */
const carouselBrowser = document.getElementById('carouselBrowser');
carouselBrowser.arrowNavStep = 1;
carouselBrowser.arrowAutoSelect = true;
carouselBrowser.sectionNavStep = 'page';
const galleryMainEl = document.querySelector('.main-content');
const layoutMorph = createLayoutMorph(galleryMainEl);

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
let editWorkerFailed = false;  // true if worker init or WebGL context failed

/* ── Edit-mode DOM refs ── */
const galleryContainerEl = document.getElementById('galleryContainer');
const galleryBtnLeft = document.getElementById('galleryBtnLeft');
const galleryBtnRight = document.getElementById('galleryBtnRight');
// const galleryBtnEdit = document.getElementById('galleryBtnEdit'); // cancel button removed
const galleryBtnAdd = document.getElementById('galleryBtnAdd');
const gallerySaveBtn = document.getElementById('gallerySaveBtn');
// const galleryRenderBtn = document.getElementById('galleryRenderBtn'); // render button removed
let galleryEditCanvas = galleryViewer.getCanvas();
const galleryEditLoading = galleryViewer.getLoadingOverlay();
const galleryEditError = galleryViewer.getErrorOverlay();
const galleryEditConfigEl = document.getElementById('galleryEditConfig');
const editGenConfigSliders = document.getElementById('editGenConfigSliders');
const editNameField = document.getElementById('editNameField');
const editNameCounter = document.getElementById('editNameCounter');
const editNameError = document.getElementById('editNameError');
const editCommentaryField = document.getElementById('editCommentaryField');
const editCommentaryCounter = document.getElementById('editCommentaryCounter');
const editTagArr = document.getElementById('editTagArr');
const editTagStr = document.getElementById('editTagStr');
const editTagDet = document.getElementById('editTagDet');

/* ── Inject centralized SVG icons ── */
galleryBtnLeft.innerHTML = UNDO_SVG;
galleryBtnRight.innerHTML = REDO_SVG;
gallerySaveBtn.innerHTML = SAVE_SVG;
galleryBtnAdd.innerHTML = RANDOMIZE_SVG;
document.getElementById('morphFieldIcon').innerHTML = FIELD_DIAMOND_SVG;
genSaveBtn.innerHTML = SAVE_SVG;
genRenderBtn.innerHTML = RENDER_SVG;
genUndoBtn.innerHTML = UNDO_SVG;
genRedoBtn.innerHTML = REDO_SVG;
genRandomizeBtn.innerHTML = RANDOMIZE_SVG;
genFullscreenBtn.innerHTML = FULLSCREEN_SVG;
document.getElementById('genNameFieldIcon').innerHTML = FIELD_DIAMOND_SVG;
document.getElementById('genCommentaryFieldIcon').innerHTML = FIELD_DIAMOND_SVG;
document.getElementById('genErrorIcon').innerHTML = ERROR_SVG;

/* ── Set up gallery viewer controls ── */
{
    // Text button — toggles alt-text overlay
    const textBtn = document.createElement('button');
    textBtn.className = 'icon-btn iv-text-btn';
    textBtn.textContent = t('gallery.altTextBtn');
    textBtn.setAttribute('aria-label', t('gallery.altTextBtn'));
    textBtn.addEventListener('click', () => {
        if (galleryViewer.altVisible) galleryViewer.dismissAltText();
        else galleryViewer.showAltText();
    });
    galleryViewer.addEventListener('alt-text-toggle', (e) => {
        textBtn.classList.toggle('iv-text-active', e.detail.visible);
    });

    // Resolution dropdown (opens upward, pixel-count labels)
    const resDropdown = document.createElement('div');
    resDropdown.className = 'custom-dropdown';
    resDropdown.id = 'imageResolutionDropdown';
    resDropdown.innerHTML = `
        <button class="custom-dropdown-trigger select-base" aria-haspopup="listbox"
            aria-expanded="false" aria-label="Resolution"
            data-i18n-aria="footer.resolutionLabel">
            <span class="custom-dropdown-label">540p</span>
        </button>
        <div class="custom-dropdown-menu hidden" role="listbox">
            <button class="custom-dropdown-item" role="option" data-value="4k" data-label="2160p" aria-selected="false">2160p</button>
            <button class="custom-dropdown-item" role="option" data-value="qhd" data-label="1620p" aria-selected="false">1620p</button>
            <button class="custom-dropdown-item" role="option" data-value="fhd" data-label="1080p" aria-selected="false">1080p</button>
            <button class="custom-dropdown-item" role="option" data-value="hd" data-label="900p" aria-selected="false">900p</button>
            <button class="custom-dropdown-item active" role="option" data-value="sd" data-label="540p" aria-selected="true">540p</button>
            <button class="custom-dropdown-item" role="option" data-value="pre" data-label="270p" aria-selected="false">270p</button>
        </div>`;

    // Fullscreen button
    const fsBtn = document.createElement('button');
    fsBtn.className = 'icon-btn';
    fsBtn.innerHTML = FULLSCREEN_SVG;
    fsBtn.setAttribute('aria-label', 'Fullscreen');
    fsBtn.addEventListener('click', () => {
        if (galleryViewer.isFullscreen) galleryViewer.closeFullscreen();
        else openFullscreen();
    });

    galleryViewer.setControls(textBtn, resDropdown, fsBtn);
    initResolutionSelector(resDropdown);

    // Error overlay content
    galleryViewer.setErrorContent(
        `<span class="iv-error-icon">${ERROR_SVG}</span>` +
        `<span data-i18n="error.webglUnavailable">WebGL unavailable — close other tabs or enable hardware acceleration</span>` +
        `<button class="iv-error-retry" data-i18n-tooltip="error.retry" data-tooltip="Retry" aria-label="Retry">${RETRY_SVG}</button>`
    );
}
const galleryEditRetry = galleryViewer.getErrorOverlay().querySelector('.iv-error-retry');

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
    fill(editTagStr, words.structure.map(w => w.toLowerCase()));
    fill(editTagDet, words.detail.map(w => w.toLowerCase()));
}


/* Auto-size seed selects to selected option text (browse mode looks like plain text) */
const _fitMeasure = document.createElement('span');
_fitMeasure.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;pointer-events:none;font:inherit';
document.body.appendChild(_fitMeasure);

function fitSelect(sel) {
    const wrap = sel.closest('.morph-select-wrap');
    const style = getComputedStyle(sel);
    _fitMeasure.style.font = style.font;
    _fitMeasure.style.fontSize = style.fontSize;
    _fitMeasure.style.fontFamily = style.fontFamily;
    _fitMeasure.style.fontStyle = 'italic'; // always measure browse-mode metrics
    _fitMeasure.style.letterSpacing = style.letterSpacing;
    const text = sel.options[sel.selectedIndex]?.text || '';
    _fitMeasure.textContent = text;
    wrap.style.setProperty('--morph-select-w', (_fitMeasure.offsetWidth + 4) + 'px');
}
function fitAllSelects() {
    fitSelect(editTagArr);
    fitSelect(editTagStr);
    fitSelect(editTagDet);
}

/** Append comma to displayed option text of first two seed selects (browse mode) */
function addSelectCommas() {
    for (const sel of [editTagArr, editTagStr]) {
        const opt = sel.options[sel.selectedIndex];
        if (opt && !opt.text.endsWith(',')) opt.text += ',';
    }
}
/** Strip trailing comma from first two seed selects (edit mode) */
function removeSelectCommas() {
    for (const sel of [editTagArr, editTagStr]) {
        const opt = sel.options[sel.selectedIndex];
        if (opt && opt.text.endsWith(',')) opt.text = opt.text.slice(0, -1);
    }
}

// Re-fit when user changes selection in edit mode
editTagArr.addEventListener('change', () => fitSelect(editTagArr));
editTagStr.addEventListener('change', () => fitSelect(editTagStr));
editTagDet.addEventListener('change', () => fitSelect(editTagDet));

/* Initial fit after populate — deferred so styles are computed. */
requestAnimationFrame(() => { addSelectCommas(); fitAllSelects(); });

/* ── Carousel state ── */
let carouselList = [];       // [{name, profile, isPortrait, assetId?}] — portraits first, then local

/* ── Slideshow (commented out) ── */
// const slideshowBtn = document.getElementById('slideshowBtn');
// const slideshowDropdown = document.getElementById('slideshowDropdown');
// let slideshowTimer = null;
// let slideshowPlaying = false;
// ... slideshow functions removed — navigation via carousel

/* ── Fullscreen (delegated to <image-viewer>) ── */

/** Build structured alt-text content from current profile data. */
function buildAltContent({ wrapExtras = false } = {}) {
    const entry = navigableList[currentIndex];
    if (!entry) return null;
    const { profile } = entry;
    const displayName = profile.displayName || entry.name;
    const locale = getLocale();

    let seedLabel = '';
    if (Array.isArray(profile.seed)) {
        seedLabel = seedTagToLabel(profile.seed, locale);
    }

    const commentary = editCommentaryField.value || '';
    const altTextStr = galleryViewer.altText || '';

    const frag = document.createDocumentFragment();

    // Name + seed — collapsible when wrapExtras
    const nameEl = document.createElement('div');
    nameEl.className = 'fullscreen-alt-name';
    nameEl.textContent = displayName;

    let seedEl = null;
    if (seedLabel) {
        seedEl = document.createElement('div');
        seedEl.className = 'fullscreen-alt-seed';
        seedEl.textContent = seedLabel;
    }

    if (wrapExtras) {
        const headerWrap = document.createElement('div');
        headerWrap.className = 'fs-alt-extra';
        const headerInner = document.createElement('div');
        headerInner.appendChild(nameEl);
        if (seedEl) headerInner.appendChild(seedEl);
        headerWrap.appendChild(headerInner);
        frag.appendChild(headerWrap);
    } else {
        frag.appendChild(nameEl);
        if (seedEl) frag.appendChild(seedEl);
    }

    // Separator + body (always visible)
    if (altTextStr) {
        const sep1 = document.createElement('div');
        sep1.className = 'fullscreen-alt-sep';
        frag.appendChild(sep1);

        const bodyEl = document.createElement('div');
        bodyEl.className = 'fullscreen-alt-body';
        bodyEl.textContent = altTextStr;
        frag.appendChild(bodyEl);
    }

    // Separator + commentary — collapsible when wrapExtras
    if (commentary) {
        const sep2 = document.createElement('div');
        sep2.className = 'fullscreen-alt-sep';

        const commentaryEl = document.createElement('div');
        commentaryEl.className = 'fullscreen-alt-commentary';
        commentaryEl.textContent = commentary;

        if (wrapExtras) {
            const footerWrap = document.createElement('div');
            footerWrap.className = 'fs-alt-extra';
            const footerInner = document.createElement('div');
            footerInner.appendChild(sep2);
            footerInner.appendChild(commentaryEl);
            footerWrap.appendChild(footerInner);
            frag.appendChild(footerWrap);
        } else {
            frag.appendChild(sep2);
            frag.appendChild(commentaryEl);
        }
    }

    return frag;
}

// Provide alt content builder and context menu to viewer
galleryViewer.setBuildAltContent(buildAltContent);

{
    const fsIsTouch = matchMedia('(pointer: coarse)').matches;
    const fsBrowserKey = fsIsTouch ? 'gallery.ctxBrowserTouch' : 'gallery.ctxBrowserDesktop';

    const fsPresets = getPresets();
    const fsCurRes = getResolution();
    const fsResItems = fsPresets.map(p =>
        `<button class="gallery-ctx-item gallery-ctx-res-item${p.key === fsCurRes.key ? ' ctx-active' : ''}" role="menuitemradio" aria-checked="${p.key === fsCurRes.key}" data-res="${p.key}" data-action="resolution">${p.label}</button>`
    ).join('');

    galleryViewer.setContextMenu([
        { html: `<span class="gallery-ctx-icon">${EDIT_SVG}</span>${t('gallery.ctxEdit')}`, action: 'edit' },
        { html: `<span class="gallery-ctx-icon">${FULLSCREEN_SVG}</span>${t('gallery.ctxExitFullscreen')}`, action: 'exit-fullscreen' },
        'sep',
        { label: t('gallery.ctxResolution') },
        { group: 'resolution', html: fsResItems },
        'sep',
        { html: t(fsBrowserKey), action: 'browser' },
    ], (action, data) => {
        if (action === 'edit') {
            const entry = navigableList[currentIndex];
            galleryViewer.closeFullscreen();
            if (entry) enterEditMode('edit', entry);
        } else if (action === 'exit-fullscreen') {
            galleryViewer.closeFullscreen();
        } else if (action === 'resolution') {
            if (data.res) setResolution(data.res);
        }
    });
}

async function openFullscreen() {
    await galleryViewer.openFullscreen();
}

function closeFullscreen() {
    galleryViewer.closeFullscreen();
}

function syncFullscreenMedia() {
    // Viewer handles this internally when setMedia() is called while fullscreen
}

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
            card.label = entry.profile?.displayName || entry.name;
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
    addSection(t('gallery.generated'), generated);
    addSection(t('gallery.custom'), custom);

    // Editor section — permanent placeholder at the end
    const editorSection = document.createElement('carousel-dropdown-browser-section');
    editorSection.label = t('gallery.editor');
    const editorCard = document.createElement('carousel-dropdown-browser-card');
    editorCard.key = '__add_image__';
    editorCard.label = t('gallery.addImage');
    editorCard.placeholder = true;
    editorCard.data = { isAddCard: true };
    editorSection.appendChild(editorCard);
    carouselBrowser.appendChild(editorSection);
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
    if (entry?.isAddCard) {
        if (!editMode) enterEditMode('add', null);
        return;
    }
    if (editMode) {
        exitEditMode(false);
    }
    selectProfile(entry.name, entry.profile, entry.isPortrait, entry.assetId);
});

carouselBrowser.addEventListener('center-change', () => {
    // slideshow stop removed — carousel is primary navigation
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
/** @type {Map<string, {resolve: Function, reject: Function}>} */
const pendingDownloadSnapshots = new Map();
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

    // Lock footer height before fade so resize can animate
    gallerySelectionCardFooter.style.height = gallerySelectionCardFooter.offsetHeight + 'px';

    // Fade out text + image + alt-text overlay together
    morphNameRow.classList.add('fading');
    morphSeedRow.classList.add('fading');
    gallerySelectionCardFooter.classList.add('fading');
    gallerySelectionVisual.style.opacity = '0';
    if (galleryViewer.altVisible) galleryViewer.getAltOverlay().classList.add('fading');

    // Cancel any pending fade-in from a previous rapid selection
    clearTimeout(selectionFadeTimer);

    // After fade-out completes, swap content and fade back in
    selectionFadeTimer = setTimeout(() => {
        // Update unified morph elements
        const displayName = profile.displayName || name;
        editNameField.value = displayName;
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
        addSelectCommas();

        // Portrait commentary vs generated/custom text
        if (isPortrait) {
            const { title, altText } = generateProfileText(profile);
            selectedGenTitle.textContent = '';
            editCommentaryField.value = profile.commentary || '';
            gallerySelectionVisual.alt = `${displayName} \u2014 ${title}`;
            gallerySelectionVisual.setAttribute('data-tooltip', altText || title);
            gallerySelectionVisual.setAttribute('data-tooltip-pos', 'overlay');
        } else if (assetId) {
            const asset = generatedAssets.find(a => a.id === assetId);
            if (asset && asset.meta) {
                selectedGenTitle.textContent = '';
                editCommentaryField.value = asset.meta.commentary || '';
                gallerySelectionVisual.alt = `${name} — ${asset.meta.title || ''}`;
                gallerySelectionVisual.setAttribute('data-tooltip', asset.meta.altText || asset.meta.title || name);
                gallerySelectionVisual.setAttribute('data-tooltip-pos', 'overlay');
            }
        } else if (profile.commentary) {
            const { title, altText } = generateProfileText(profile);
            selectedGenTitle.textContent = '';
            editCommentaryField.value = profile.commentary;
            gallerySelectionVisual.alt = `${name} — ${title}`;
            gallerySelectionVisual.setAttribute('data-tooltip', altText || title);
            gallerySelectionVisual.setAttribute('data-tooltip-pos', 'overlay');
        } else {
            const { title, altText } = generateProfileText(profile);
            selectedGenTitle.textContent = title;
            editCommentaryField.value = '';
            gallerySelectionVisual.alt = title;
            gallerySelectionVisual.setAttribute('data-tooltip', altText || title);
            gallerySelectionVisual.setAttribute('data-tooltip-pos', 'overlay');
        }

        // Sync alt text to viewer
        galleryViewer.altText = gallerySelectionVisual.getAttribute('data-tooltip') || '';
        if (galleryViewer.altVisible) galleryViewer.getAltOverlay().scrollTop = 0;

        // Swap image src (old image is now fully hidden)
        if (currentStaticUrl) { URL.revokeObjectURL(currentStaticUrl); currentStaticUrl = null; }
        if (snapshotUrl) { URL.revokeObjectURL(snapshotUrl); snapshotUrl = null; }

        gallerySelectionVisual.addEventListener('load', () => {
            gallerySelectionVisual.style.opacity = '1';
            if (galleryViewer.altVisible) galleryViewer.getAltOverlay().classList.remove('fading');
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

        // Animate footer height to fit new content
        const oldHeight = gallerySelectionCardFooter.offsetHeight;
        gallerySelectionCardFooter.style.height = 'auto';
        const newHeight = gallerySelectionCardFooter.offsetHeight;
        if (oldHeight !== newHeight) {
            gallerySelectionCardFooter.style.height = oldHeight + 'px';
            void gallerySelectionCardFooter.offsetHeight; // force layout
            gallerySelectionCardFooter.style.height = newHeight + 'px';
            const onEnd = (e) => {
                if (e.propertyName === 'height') {
                    gallerySelectionCardFooter.style.height = '';
                    gallerySelectionCardFooter.removeEventListener('transitionend', onEnd);
                }
            };
            gallerySelectionCardFooter.addEventListener('transitionend', onEnd);
        } else {
            gallerySelectionCardFooter.style.height = '';
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

// Edit-only buttons: undo/redo
galleryBtnLeft.addEventListener('click', () => {
    if (editMode && editPanel) editPanel.undo();
});
galleryBtnRight.addEventListener('click', () => {
    if (editMode && editPanel) editPanel.redo();
});

/* ── Alt-text overlays ── */
// Gallery viewer handles its own alt-text for image + canvas clicks.
// Gen preview canvas uses a separate overlay (not yet migrated to viewer).
genPreviewCanvas.setAttribute('data-tooltip-click', '');

const genAltTextOverlay = document.getElementById('genAltTextOverlay');
let genAltTextVisible = false;

function dismissAltText(resetScroll) {
    galleryViewer.dismissAltText(resetScroll);
}

// Helper for gen preview alt text
function showGenAltText(overlay, text) {
    overlay.innerHTML = '';
    const frag = document.createDocumentFragment();
    const sep1 = document.createElement('div');
    sep1.className = 'fullscreen-alt-sep';
    frag.appendChild(sep1);
    const bodyEl = document.createElement('div');
    bodyEl.className = 'fullscreen-alt-body';
    bodyEl.textContent = text;
    frag.appendChild(bodyEl);
    const sep2 = document.createElement('div');
    sep2.className = 'fullscreen-alt-sep';
    frag.appendChild(sep2);
    overlay.appendChild(frag);
    overlay.classList.add('visible');
}

genPreviewCanvas.addEventListener('click', () => {
    const text = genPreviewCanvas.getAttribute('data-tooltip');
    if (!text) return;
    if (genAltTextVisible) {
        genAltTextOverlay.classList.remove('visible');
        genAltTextVisible = false;
    } else {
        showGenAltText(genAltTextOverlay, text);
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
    addSelectCommas();

    const meta = asset.meta || {};
    selectedGenTitle.textContent = '';
    editCommentaryField.value = meta.durationS
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
    closeBtn.innerHTML = CLOSE_SVG;
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
    if (!wb || !wb.ready) return Promise.resolve('');
    return new Promise(resolve => {
        let settled = false;
        const reqId = 'save-thumb-' + Date.now();
        const prevHandler = wb._frameCapturedHandler || null;
        const handler = (msg) => {
            if (msg.requestId !== reqId || settled) return;
            settled = true;
            // Restore previous handler
            if (prevHandler) wb.on('frame-captured', prevHandler);
            if (!msg.blob) return resolve('');
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve('');
            reader.readAsDataURL(msg.blob);
        };
        wb._frameCapturedHandler = handler;
        wb.on('frame-captured', handler);
        wb.captureFrame(reqId);
        // Timeout fallback
        setTimeout(() => {
            if (!settled) {
                settled = true;
                if (prevHandler) wb.on('frame-captured', prevHandler);
                resolve('');
            }
        }, 3000);
    });
}

async function handleSave(name, seed, controls, camera, commentary, currentAssetId) {
    // Capture preview thumbnail before saving (retry once if empty)
    let thumbDataUrl = await capturePreviewThumb();
    if (!thumbDataUrl) {
        await new Promise(r => setTimeout(r, 300));
        thumbDataUrl = await capturePreviewThumb();
    }

    // If editing an existing saved image, ask overwrite or save-as-new
    if (currentAssetId) {
        const existingAsset = generatedAssets.find(a => a.id === currentAssetId);
        if (existingAsset) {
            const result = await showSaveConflictModal(name);
            if (!result) return null; // cancelled
            if (result.action === 'overwrite') {
                existingAsset.seed = seed;
                existingAsset.controls = controls;
                existingAsset.thumbDataUrl = thumbDataUrl || existingAsset.thumbDataUrl;
                existingAsset.meta = { ...existingAsset.meta, seed, controls, camera, commentary, title: name };
                existingAsset.name = name;
                await putAsset(existingAsset);
                generatedAssets = await getAllAssets();
                refreshSavedGrid();
                toast(`Overwritten "${name}"`);
                return { id: existingAsset.id, overwritten: true };
            }
            // fall through to save-as-new
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

function showSaveConflictModal(name) {
    return new Promise(resolve => {
        const backdrop = document.createElement('div');
        backdrop.className = 'gen-modal-backdrop';

        const modal = document.createElement('div');
        modal.className = 'gen-modal';

        const title = document.createElement('div');
        title.className = 'gen-modal-title';
        title.textContent = 'Update existing image?';

        const msg = document.createElement('div');
        msg.className = 'gen-modal-msg';
        msg.textContent = `You're editing "${name}". Save changes to this image, or save as a new image?`;

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
        saveNewBtn.addEventListener('click', () => close({ action: 'saveNew' }));

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) close(null);
        });

        btns.append(cancelBtn, overwriteBtn, saveNewBtn);
        modal.append(title, msg, btns);
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
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
            // Check pending download snapshots first
            if (msg.requestId && pendingDownloadSnapshots.has(msg.requestId)) {
                pendingDownloadSnapshots.get(msg.requestId).resolve(msg.blob);
                pendingDownloadSnapshots.delete(msg.requestId);
                return;
            }
            pendingSnapshotContext = null;
            if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
            snapshotUrl = URL.createObjectURL(msg.blob);
            gallerySelectionVisual.src = snapshotUrl;
        });
        workerBridge.on('snapshot-failed', (msg) => {
            // Check pending download snapshots first
            if (msg.requestId && pendingDownloadSnapshots.has(msg.requestId)) {
                pendingDownloadSnapshots.get(msg.requestId).reject(new Error('Snapshot failed'));
                pendingDownloadSnapshots.delete(msg.requestId);
                return;
            }
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
        });
        const fsFrameHandler = (msg) => {
            if (pendingFullscreenCaptureId && msg.requestId === pendingFullscreenCaptureId) {
                pendingFullscreenCaptureId = null;
                if (msg.blob) showGenFullscreenImage(msg.blob);
            }
        };
        workerBridge._frameCapturedHandler = fsFrameHandler;
        workerBridge.on('frame-captured', fsFrameHandler);
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
        async onSave(name, seed, controls, camera, commentary, assetId) {
            return handleSave(name, seed, controls, camera, commentary, assetId);
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

function showGenerateMode() {
    if (layoutMorph.morphing) return;

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

    layoutMorph.morph(isAnimCreate ? 'animate' : 'generate', {
        onBefore() { targetEl.classList.remove('hidden'); },
        onAfter()  { galleryContainerEl.classList.add('hidden'); },
    });
}

function hideGenerateMode() {
    if (layoutMorph.morphing) return;

    // Hide whichever create panel is visible
    const visibleEl = !generatePanelEl.classList.contains('hidden') ? generatePanelEl
        : !animationEditorEl.classList.contains('hidden') ? animationEditorEl
        : null;

    if (visibleEl === animationEditorEl) {
        destroyAnimationEditor();
    }

    if (!visibleEl) return;

    layoutMorph.morph('browse', {
        onBefore() { galleryContainerEl.classList.remove('hidden'); },
        onAfter()  { visibleEl.classList.add('hidden'); },
    });
}

/* ── Inline edit mode ── */

/** Disable/enable the configure image menu, its collapse toggles, and all inputs */
function setEditConfigDisabled(disabled) {
    // Prevent expanding/collapsing
    galleryEditConfigEl.querySelectorAll('.gen-collapse-toggle').forEach(toggle => {
        toggle.style.pointerEvents = disabled ? 'none' : '';
        toggle.style.opacity = disabled ? '0.4' : '';
    });
    // Collapse any open sections
    if (disabled) {
        galleryEditConfigEl.querySelectorAll('.gen-collapse-body').forEach(body => {
            body.classList.add('collapsed');
            body.style.maxHeight = '0';
        });
        galleryEditConfigEl.querySelectorAll('.gen-collapse-toggle').forEach(toggle => {
            toggle.setAttribute('aria-expanded', 'false');
        });
    }
    // Disable all inputs, selects, buttons inside config
    galleryEditConfigEl.querySelectorAll('input, select, button, textarea').forEach(el => {
        el.disabled = disabled;
    });
    // Disable inputs outside the config panel (name, seed, commentary, save)
    editNameField.disabled = disabled;
    editTagArr.disabled = disabled;
    editTagStr.disabled = disabled;
    editTagDet.disabled = disabled;
    editCommentaryField.disabled = disabled;
    gallerySaveBtn.disabled = disabled;
}

function initEditMode() {
    if (editInitialized) return;
    editInitialized = true;

    // Create worker bridge for the edit preview canvas
    editWorkerBridge = initGalleryWorker(galleryEditCanvas);
    if (!editWorkerBridge) {
        editWorkerFailed = true;
        galleryEditLoading.classList.add('hidden');
        galleryEditError.classList.remove('hidden');
        galleryEditCanvas.classList.add('hidden');
        setEditConfigDisabled(true);
        return;
    }

    editWorkerBridge.on('rendered', () => {
        galleryEditLoading.classList.add('hidden');
    });
    editWorkerBridge.on('error', () => {
        editWorkerFailed = true;
        galleryEditLoading.classList.add('hidden');
        galleryEditError.classList.remove('hidden');
        galleryEditCanvas.classList.add('hidden');
        setEditConfigDisabled(true);
    });

    editPanel = initGeneratePanel({
        slidersEl: editGenConfigSliders,
        tagArrEl: editTagArr,
        tagStrEl: editTagStr,
        tagDetEl: editTagDet,
        nameField: editNameField,
        saveBtn: gallerySaveBtn,
        randomizeBtn: null,   // randomize handled by galleryBtnAdd morph
        renderBtn: null, // render button removed from toolbar
        undoBtn: null,        // undo handled by galleryBtnLeft morph
        redoBtn: null,        // redo handled by galleryBtnRight morph
        fullscreenBtn: null,
        nameCounter: editNameCounter,
        nameError: editNameError,
        commentaryField: editCommentaryField,
        previewCanvas: galleryEditCanvas,
        commentaryCounter: editCommentaryCounter,
        statusMessageEl: null,
        onControlChange(seed, controls, camera) {
            if (editWorkerBridge && editWorkerBridge.ready) {
                galleryEditLoading.classList.remove('hidden');
                editWorkerBridge.sendRender(seed, controls, getLocale());
                editWorkerBridge.sendCameraState(camera.zoom, camera.rotation, camera.elevation);
            }
        },
        onRender(seed, controls, camera, name, commentary) {
            if (!renderQueue) return;
            renderQueue.enqueue(seed, controls, name, commentary);
        },
        async onSave(name, seed, controls, camera, commentary, assetId) {
            const result = await handleSave(name, seed, controls, camera, commentary, assetId);
            if (result) {
                exitEditMode(true);
            }
            return result;
        },
        onFullscreen() {
            if (galleryViewer.isFullscreen) closeFullscreen();
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
            galleryEditLoading.classList.remove('hidden');
            const seed = editPanel.readSeed();
            const controls = editPanel.readControls();
            const camera = editPanel.readCamera();
            editWorkerBridge.sendRenderImmediate(seed, controls, getLocale());
            editWorkerBridge.sendCameraState(camera.zoom, camera.rotation, camera.elevation);
        }
    });
}

galleryEditRetry.addEventListener('click', () => {
    galleryEditError.classList.add('hidden');
    editWorkerFailed = false;
    editInitialized = false;
    editWorkerBridge = null;

    // Replace the canvas element so transferControlToOffscreen() can be called again
    galleryEditCanvas = galleryViewer.replaceCanvas();

    // Keep config disabled until first successful render confirms WebGL works
    galleryEditLoading.classList.remove('hidden');

    initEditMode();
    // Trigger render if worker becomes ready; re-enable config on first success
    if (editWorkerBridge && editPanel) {
        editWorkerBridge.onReady(() => {
            const seed = editPanel.readSeed();
            const controls = editPanel.readControls();
            const camera = editPanel.readCamera();
            editWorkerBridge.sendRenderImmediate(seed, controls, getLocale());
            editWorkerBridge.sendCameraState(camera.zoom, camera.rotation, camera.elevation);
        });
        let retryConfirmed = false;
        editWorkerBridge.on('rendered', () => {
            galleryEditLoading.classList.add('hidden');
            if (!retryConfirmed) {
                retryConfirmed = true;
                setEditConfigDisabled(false);
            }
        });
    }
});

async function enterEditMode(mode, entry, fromPopstate) {
    if (editMode) return; // already in edit mode

    editMode = mode;
    editSourceEntry = entry || null;

    // Update URL (skip if triggered by popstate — URL already correct)
    if (!fromPopstate) pushEditRoute();

    // Initialize worker + panel on first use
    initEditMode();

    // Re-show error overlay if worker previously failed; otherwise ensure canvas is visible
    if (editWorkerFailed) {
        galleryEditError.classList.remove('hidden');
        galleryEditCanvas.classList.add('hidden');
        setEditConfigDisabled(true);
    } else {
        galleryEditCanvas.classList.remove('hidden');
    }

    // Populate inputs
    const isRandomize = !(mode === 'edit' && entry?.profile);
    if (!isRandomize) {
        const displayName = entry.isPortrait ? entry.name + ' (User Version)' : entry.name;
        editPanel.setValues(
            entry.profile.seed,
            entry.profile.controls,
            entry.profile.camera,
            displayName,
            entry.profile.commentary,
        );
        editPanel.setUnlocked();
    }
    editCommentaryField.placeholder = 'Add commentary (optional)';

    // Transform the "Add Image" card into an "Editing" indicator and select it
    // (must happen BEFORE layout morph so card has cdb-placeholder when CSS applies)
    const addCardEl = carouselBrowser.querySelector(
        'carousel-dropdown-browser-card[key="__add_image__"]'
    );
    if (addCardEl) {
        addCardEl.label = t('gallery.editing');
        addCardEl.placeholder = true;
        addCardEl.thumbSrc = '';
    }
    // Clear any previous error state on the carousel card
    const prevErrorCard = carouselBrowser.querySelector('.cdb-card[data-flip-key="__add_image__"] .cdb-card-img.cdb-img-error');
    if (prevErrorCard) prevErrorCard.classList.remove('cdb-img-error');

    carouselBrowser.selectedKey = '__add_image__';
    carouselBrowser.syncToKey('__add_image__');

    // Wait for carousel microtask to patch card DOM (adds cdb-placeholder class)
    await new Promise(r => queueMicrotask(r));

    // Toggle editing layout (triggers all CSS cross-fade transitions)
    galleryContainerEl.style.setProperty('--editing-label', `"${t('gallery.editing')}"`);
    layoutMorph.morph('edit', {
        onSwap() {
            if (isRandomize) editPanel.randomize();
            removeSelectCommas();
        },
    });

    // Hide alt text overlay when entering edit mode
    dismissAltText(true);

    // Update button tooltips for edit mode
    galleryBtnLeft.setAttribute('data-tooltip', 'Undo');
    galleryBtnRight.setAttribute('data-tooltip', 'Redo');
    galleryBtnAdd.setAttribute('data-tooltip', 'Randomize');

    // Send render if worker is ready
    if (editWorkerBridge && editWorkerBridge.ready) {
        galleryEditLoading.classList.remove('hidden');
        const seed = editPanel.readSeed();
        const controls = editPanel.readControls();
        const camera = editPanel.readCamera();
        editWorkerBridge.sendRenderImmediate(seed, controls, getLocale());
        editWorkerBridge.sendCameraState(camera.zoom, camera.rotation, camera.elevation);
    }

    // Collapse carousel grid if it was expanded
    if (carouselBrowser.expanded) {
        await carouselBrowser.collapse({ noScroll: true });
    }
}

async function exitEditMode(saved, fromPopstate) {
    if (!editMode) return;

    if (saved) {
        // Refresh gallery to show the new/updated profile
        refreshGallery();
    }

    // Hide alt text + error + loading overlays when leaving edit mode
    dismissAltText(true);
    galleryEditError.classList.add('hidden');
    galleryEditLoading.classList.add('hidden');
    setEditConfigDisabled(false);

    editCommentaryField.placeholder = 'No commentary';

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
    galleryBtnAdd.setAttribute('data-tooltip', 'Add new');

    // Capture thumbnail before clearing editMode (so capturePreviewThumb uses editWorkerBridge)
    const addCardEl = carouselBrowser.querySelector(
        'carousel-dropdown-browser-card[key="__add_image__"]'
    );
    const thumb = addCardEl ? await capturePreviewThumb() : '';

    editMode = null;
    editSourceEntry = null;

    // Revert the "Editing" card — show thumbnail if available, else placeholder
    if (addCardEl) {
        addCardEl.label = t('gallery.addImage');
        if (editWorkerFailed) {
            addCardEl.placeholder = true;
            addCardEl.thumbSrc = '';
        } else if (thumb) {
            addCardEl.placeholder = false;
            addCardEl.thumbSrc = thumb;
        } else {
            addCardEl.placeholder = true;
            addCardEl.thumbSrc = '';
        }
    }

    // Morph back to browse after card attributes are updated so CSS transitions animate smoothly
    layoutMorph.morph('browse', {
        onSwap() {
            addSelectCommas();
            fitAllSelects();
        },
    });

    // Mark carousel card with error state if worker failed
    if (editWorkerFailed) {
        requestAnimationFrame(() => {
            const renderedCard = carouselBrowser.querySelector('.cdb-card[data-flip-key="__add_image__"]');
            if (renderedCard) {
                const img = renderedCard.querySelector('.cdb-card-img');
                if (img) img.classList.add('cdb-img-error');
            }
        });
    }

}

// ── Edit/Add/Save/Render button handlers ──

// galleryBtnEdit removed — cancel via Escape key or navigating away

// ── Right-click / long-press context menu on main visual ──
{
    const ctxMenu = document.createElement('div');
    ctxMenu.className = 'gallery-ctx-menu';
    ctxMenu.setAttribute('role', 'menu');
    const isTouch = matchMedia('(pointer: coarse)').matches;
    const ctxBrowserKey = isTouch ? 'gallery.ctxBrowserTouch' : 'gallery.ctxBrowserDesktop';

    ctxMenu.innerHTML =
        // Share (expandable)
        `<button class="gallery-ctx-item gallery-ctx-expandable" role="menuitem" data-expand="share">` +
            `<span class="gallery-ctx-icon">${SHARE_SVG}</span>${t('gallery.ctxShare')}` +
            `<span class="gallery-ctx-chevron">${ARROW_RIGHT_SVG}</span>` +
        `</button>` +
        `<div class="gallery-ctx-submenu" data-submenu="share">` +
            `<button class="gallery-ctx-item gallery-ctx-sub-item" role="menuitem" data-action="share-copy"><span class="gallery-ctx-icon">${LINK_SVG}</span>${t('share.copyLink')}</button>` +
            `<div class="gallery-ctx-sep"></div>` +
            `<button class="gallery-ctx-item gallery-ctx-sub-item" role="menuitem" data-action="share-bluesky"><span class="gallery-ctx-icon">${BLUESKY_SVG}</span>${t('share.bluesky')}</button>` +
            `<button class="gallery-ctx-item gallery-ctx-sub-item" role="menuitem" data-action="share-facebook"><span class="gallery-ctx-icon">${FACEBOOK_SVG}</span>${t('share.facebook')}</button>` +
            `<button class="gallery-ctx-item gallery-ctx-sub-item" role="menuitem" data-action="share-google"><span class="gallery-ctx-icon">${GOOGLE_SVG}</span>Google</button>` +
            `<button class="gallery-ctx-item gallery-ctx-sub-item" role="menuitem" data-action="share-linkedin"><span class="gallery-ctx-icon">${LINKEDIN_SVG}</span>${t('share.linkedin')}</button>` +
            `<button class="gallery-ctx-item gallery-ctx-sub-item" role="menuitem" data-action="share-reddit"><span class="gallery-ctx-icon">${REDDIT_SVG}</span>${t('share.reddit')}</button>` +
            `<button class="gallery-ctx-item gallery-ctx-sub-item" role="menuitem" data-action="share-x"><span class="gallery-ctx-icon">${TWITTER_SVG}</span>X</button>` +
            `<div class="gallery-ctx-sep"></div>` +
            `<button class="gallery-ctx-item gallery-ctx-sub-item" role="menuitem" data-action="share-email"><span class="gallery-ctx-icon">${EMAIL_SVG}</span>${t('share.email')}</button>` +
        `</div>` +
        // Download (expandable)
        `<button class="gallery-ctx-item gallery-ctx-expandable" role="menuitem" data-expand="download">` +
            `<span class="gallery-ctx-icon">${DOWNLOAD_SVG}</span>${t('gallery.ctxDownload')}` +
            `<span class="gallery-ctx-chevron">${ARROW_RIGHT_SVG}</span>` +
        `</button>` +
        `<div class="gallery-ctx-submenu" data-submenu="download">` +
            `<button class="gallery-ctx-item gallery-ctx-sub-item" role="menuitem" data-action="download-image">${t('gallery.ctxDownloadImage')}</button>` +
            `<button class="gallery-ctx-item gallery-ctx-sub-item" role="menuitem" data-action="download-bundle">${t('gallery.ctxDownloadBundle')}</button>` +
        `</div>` +
        // Edit
        `<button class="gallery-ctx-item" role="menuitem" data-action="edit"><span class="gallery-ctx-icon">${EDIT_SVG}</span>${t('gallery.ctxEdit')}</button>` +
        // Separator + browser hint
        `<div class="gallery-ctx-sep"></div>` +
        `<div class="gallery-ctx-browser">${t(ctxBrowserKey)}</div>`;
    document.body.appendChild(ctxMenu);

    const ctxBrowserHint = ctxMenu.querySelector('.gallery-ctx-browser');
    let allFocusable = /** @type {HTMLElement[]} */ ([...ctxMenu.querySelectorAll('.gallery-ctx-item')]);
    let ctxVisible = false;

    /** Rebuild the focusable list after submenu expand/collapse. */
    function rebuildFocusable() {
        allFocusable = /** @type {HTMLElement[]} */ ([...ctxMenu.querySelectorAll('.gallery-ctx-item:not(.gallery-ctx-submenu:not(.expanded) .gallery-ctx-item)')]);
    }

    /** Toggle an expandable submenu, closing any other open one. */
    function toggleSubmenu(expandBtn) {
        const key = expandBtn.dataset.expand;
        const submenu = ctxMenu.querySelector(`[data-submenu="${key}"]`);
        const wasOpen = submenu.classList.contains('expanded');

        // Close all submenus first
        ctxMenu.querySelectorAll('.gallery-ctx-submenu.expanded').forEach(s => s.classList.remove('expanded'));
        ctxMenu.querySelectorAll('.gallery-ctx-expandable.expanded').forEach(b => b.classList.remove('expanded'));

        if (!wasOpen) {
            submenu.classList.add('expanded');
            expandBtn.classList.add('expanded');
        }
        rebuildFocusable();
    }

    function showCtxMenu(x, y) {
        // Collapse all submenus on open
        ctxMenu.querySelectorAll('.gallery-ctx-submenu.expanded').forEach(s => s.classList.remove('expanded'));
        ctxMenu.querySelectorAll('.gallery-ctx-expandable.expanded').forEach(b => b.classList.remove('expanded'));
        rebuildFocusable();

        ctxMenu.style.left = '0';
        ctxMenu.style.top = '0';
        ctxMenu.classList.add('visible');
        const rect = ctxMenu.getBoundingClientRect();
        ctxMenu.style.left = Math.min(x, window.innerWidth - rect.width - 4) + 'px';
        ctxMenu.style.top = Math.min(y, window.innerHeight - rect.height - 4) + 'px';
        ctxVisible = true;
        if (allFocusable[0]) allFocusable[0].focus();
    }

    function hideCtxMenu() {
        ctxMenu.classList.remove('visible');
        ctxVisible = false;
    }

    // ── Share helpers ──
    function getShareURL() {
        return window.location.origin + window.location.pathname;
    }
    function getShareTitle() {
        const name = editNameField.value.trim();
        return name ? `${name} — Geometric Interior` : 'Geometric Interior';
    }

    // ── Action dispatch ──
    ctxMenu.addEventListener('click', (e) => {
        const expandBtn = e.target.closest('.gallery-ctx-expandable');
        if (expandBtn) {
            toggleSubmenu(expandBtn);
            return;
        }

        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;

        // Share actions
        if (action === 'share-copy') {
            hideCtxMenu();
            const url = getShareURL();
            navigator.clipboard.writeText(url).then(
                () => toast(t('toast.linkCopied') || 'Link copied'),
                () => toast(t('toast.linkCopiedShort') || 'Copied'),
            );
            return;
        }
        if (action.startsWith('share-')) {
            hideCtxMenu();
            const url = getShareURL();
            const title = getShareTitle();
            const shareMap = {
                'share-bluesky': () => window.open(`https://bsky.app/intent/compose?text=${encodeURIComponent(title + '\n' + url)}`, '_blank', 'noopener,width=600,height=500'),
                'share-facebook': () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener,width=555,height=525'),
                'share-google': () => window.open(`https://plus.google.com/share?url=${encodeURIComponent(url)}`, '_blank', 'noopener,width=600,height=500'),
                'share-linkedin': () => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank', 'noopener,width=600,height=550'),
                'share-reddit': () => window.open(`https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`, '_blank', 'noopener,width=700,height=600'),
                'share-x': () => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, '_blank', 'noopener,width=550,height=420'),
                'share-email': () => window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent('Check out this generative artwork:\n\n' + url)}`),
            };
            if (shareMap[action]) shareMap[action]();
            return;
        }

        // Download actions
        if (action === 'download-image') {
            hideCtxMenu();
            downloadCurrentImage();
            return;
        }
        if (action === 'download-bundle') {
            hideCtxMenu();
            downloadBundle();
            return;
        }

        // Edit
        if (action === 'edit') {
            hideCtxMenu();
            const entry = navigableList[currentIndex];
            if (entry) enterEditMode('edit', entry);
            return;
        }
    });

    // ── Download: single image at current resolution ──
    async function downloadCurrentImage() {
        const entry = navigableList[currentIndex];
        if (!entry) return;
        const { profile } = entry;
        if (!profile || !profile.seed || !profile.controls) return;

        if (!workerBridge || !workerBridge.ready) {
            toast(t('error.webglUnavailable') || 'Worker not ready');
            return;
        }

        const res = getResolution();
        const title = profile.displayName || entry.name || 'Untitled';
        const altText = galleryViewer.altText || '';

        try {
            const blob = await requestSnapshot(profile, res.w, res.h);
            const enriched = await injectPngTextChunks(blob, [
                { keyword: 'Title', text: title },
                { keyword: 'Description', text: altText },
            ], { title, description: altText });
            const base = safeName(profile.seed) || 'image';
            downloadBlob(`geometric-interior_${base}_${res.key}.png`, enriched);
        } catch {
            toast('Download failed');
        }
    }

    // ── Download: bundle (multi-resolution ZIP) ──
    async function downloadBundle() {
        const entry = navigableList[currentIndex];
        if (!entry) return;
        const { profile } = entry;
        if (!profile || !profile.seed || !profile.controls) return;

        const JSZip = window.JSZip;
        if (!JSZip) { toast('JSZip not loaded'); return; }
        if (!workerBridge || !workerBridge.ready) {
            toast(t('error.webglUnavailable') || 'Worker not ready');
            return;
        }

        toast(t('toast.preparingBundle') || 'Preparing bundle…');

        const title = profile.displayName || entry.name || 'Untitled';
        const altText = galleryViewer.altText || '';
        const presets = getPresets().filter(p => p.key !== 'pre'); // skip tiny preview
        const ts = toIsoLocalish();
        const base = `bundle_${safeName(profile.seed)}_${ts}`;
        const zip = new JSZip();

        // Render each resolution sequentially
        for (const preset of presets) {
            try {
                const blob = await requestSnapshot(profile, preset.w, preset.h);
                const enriched = await injectPngTextChunks(blob, [
                    { keyword: 'Title', text: title },
                    { keyword: 'Description', text: altText },
                ], { title, description: altText });
                zip.file(`${base}/image_${preset.key}.png`, enriched);
            } catch {
                // Skip failed resolution
            }
        }

        // Add metadata
        const metadata = profileToConfig(entry.name || '', { seed: profile.seed, controls: profile.controls });
        zip.file(`${base}/metadata.json`, JSON.stringify(metadata, null, 2) + '\n');
        zip.file(`${base}/title.txt`, title + '\n');
        zip.file(`${base}/alt-text.txt`, altText + '\n');

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(`${base}.zip`, zipBlob);
        toast(t('toast.bundleReady') || 'Bundle downloaded');
    }

    /**
     * Request a one-shot snapshot from the worker and return a blob via Promise.
     * Uses pendingDownloadSnapshots map (checked in the worker bridge's snapshot handler).
     */
    function requestSnapshot(profile, width, height) {
        return new Promise((resolve, reject) => {
            const reqId = 'dl-snap-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
            pendingDownloadSnapshots.set(reqId, { resolve, reject });
            workerBridge.sendSnapshot({
                requestId: reqId,
                seed: profile.seed,
                controls: profile.controls,
                locale: getLocale(),
                width,
                height,
            });
        });
    }

    // ── Browser hint: right-click passes to native menu ──
    let allowNativeCtx = false;
    ctxBrowserHint.addEventListener('contextmenu', () => { hideCtxMenu(); });
    ctxBrowserHint.addEventListener('click', () => { hideCtxMenu(); allowNativeCtx = true; });

    // Desktop: right-click
    gallerySelectionCardVisualWrap.addEventListener('contextmenu', (e) => {
        if (editMode) return;
        if (allowNativeCtx) { allowNativeCtx = false; return; }
        e.preventDefault();
        if (ctxVisible) { hideCtxMenu(); return; }
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

    // Keyboard navigation
    ctxMenu.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { hideCtxMenu(); return; }
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const expandBtn = e.target.closest('.gallery-ctx-expandable');
            if (expandBtn) { toggleSubmenu(expandBtn); return; }
            const btn = e.target.closest('[data-action]');
            if (btn) btn.click();
            return;
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const idx = allFocusable.indexOf(/** @type {HTMLElement} */ (e.target));
            const next = e.key === 'ArrowDown'
                ? allFocusable[(idx + 1) % allFocusable.length]
                : allFocusable[(idx - 1 + allFocusable.length) % allFocusable.length];
            if (next) next.focus();
        }
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
        handleSave(name, seed, controls, camera, commentary, editPanel.currentAssetId).then(result => {
            if (result) exitEditMode(true);
        });
    }
});

// galleryRenderBtn removed from toolbar

/* ── Keyboard navigation ── */
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (editMode) {
            exitEditMode(false);
            return;
        }
        if (galleryViewer.isFullscreen) {
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
activeMode = route.mode;
updateMenuNavLinks();
// Position slider without animation on initial load
requestAnimationFrame(() => positionMenuSlider(false));

if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
    history.replaceState({ type: 'image', profile: null }, '', '/images');
}

if (activeMode === 'create') {
    const isAnim = activeType === 'animation';
    if (!isAnim) { initGenerate(); }
    else { initAnimationEditor(); }
    const targetEl = isAnim ? animationEditorEl : generatePanelEl;
    targetEl.classList.remove('hidden');
    galleryContainerEl.classList.add('hidden');
    layoutMorph.set(isAnim ? 'animate' : 'generate');
} else if (activeMode === 'edit') {
    showImageGallery();
    // enterEditMode deferred until IndexedDB loads (see Promise.allSettled below)
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
            const displayName = profile.displayName || selected.name;
            editNameField.value = displayName;
            editCommentaryField.value = profile.commentary || '';
            const { title, altText } = generateProfileText(profile);
            if (selected.isPortrait) {
                selectedGenTitle.textContent = '';
                gallerySelectionVisual.alt = `${displayName} \u2014 ${title}`;
                gallerySelectionVisual.setAttribute('data-tooltip', altText || title);
                galleryViewer.altText = altText || title;
            } else {
                selectedGenTitle.textContent = title;
                gallerySelectionVisual.alt = title;
            }
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
    if (activeMode === 'edit') enterEditMode('add', null, true);
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
