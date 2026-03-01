/**
 * Shared header builder — populates an empty <header> element with the correct
 * variant for gallery, image editor, or animation editor pages.
 *
 * @param {HTMLElement} headerEl - The <header class="app-header"> element to populate
 * @param {{ page: 'gallery' | 'image' | 'animation' }} opts
 * @returns {object} refs to key child elements
 */
export function createHeader(headerEl, { page }) {
    const isGallery = page === 'gallery';

    // ── Toggle button ──
    const toggleHTML = isGallery
        ? `<button id="siteMenuToggle" class="site-menu-toggle" aria-label="Open menu">
               <div class="panel-toggle-icon">
                   <span class="bar bar-top"></span>
                   <span class="bar bar-mid"></span>
                   <span class="bar bar-bot"></span>
               </div>
               <span class="rq-badge hidden" id="renderQueueBadge"></span>
           </button>`
        : `<button id="panelToggle" class="panel-toggle-btn" aria-label="Open menu" data-tooltip="Open menu" data-i18n-aria="panel.openMenu" data-i18n-tooltip="panel.openMenu" data-tooltip-pos="right">
               <div class="panel-toggle-icon">
                   <span class="bar bar-top"></span>
                   <span class="bar bar-mid"></span>
                   <span class="bar bar-bot"></span>
               </div>
           </button>`;

    // ── Navigation links ──
    const navLinks = [];
    if (!isGallery) {
        const pages = [
            { href: '/', key: 'nav.gallery', label: 'Gallery' },
            { href: '/image.html', key: 'nav.imageEditor', label: 'Image Editor' },
            { href: '/animation.html', key: 'nav.animationEditor', label: 'Animation Editor' },
        ];
        for (const p of pages) {
            const isActive = (page === 'image' && p.href === '/image.html')
                          || (page === 'animation' && p.href === '/animation.html');
            const cls = 'header-link' + (isActive ? ' header-link-active' : '');
            navLinks.push(`<a href="${p.href}" class="${cls}" data-i18n="${p.key}">${p.label}</a>`);
        }
    }

    // Statement buttons (all pages)
    const statementBtns = [
        `<button id="artistStatement" class="header-link" data-i18n="header.artistStatement">Artist Statement</button>`,
        `<button id="developerStatement" class="header-link" data-i18n="header.developerStatement">Developer Statement</button>`,
        `<button id="governanceStatement" class="header-link" data-i18n="header.governanceFramework">Governance Framework</button>`,
    ];

    const allLinks = [...navLinks, ...statementBtns];
    const linksHTML = allLinks.join('<span class="header-sep">&middot;</span>');

    // ── Header actions (gallery only: share button + popover) ──
    const actionsHTML = isGallery ? `
        <div class="header-actions">
            <div class="share-btn-wrap">
                <button id="shareBtn" class="header-link" data-tooltip="Share" data-i18n-tooltip="stage.share">
                    ${SHARE_ICON}
                </button>
                <div id="sharePopover" class="share-popover hidden">
                    ${sharePopoverContent()}
                </div>
            </div>
        </div>` : '';

    // ── Assemble ──
    headerEl.innerHTML = `
        ${toggleHTML}
        <div class="header-brand">
            <h1 data-i18n="header.title">Geometric Interior: Self-Portraits of a Predictive Model</h1>
            <div class="header-links">${linksHTML}</div>
        </div>
        ${actionsHTML}`;

    return {
        panelToggle: headerEl.querySelector('#panelToggle'),
        siteMenuToggle: headerEl.querySelector('#siteMenuToggle'),
        renderQueueBadge: headerEl.querySelector('#renderQueueBadge'),
        shareBtn: headerEl.querySelector('#shareBtn'),
        sharePopover: headerEl.querySelector('#sharePopover'),
        artistStatement: headerEl.querySelector('#artistStatement'),
        developerStatement: headerEl.querySelector('#developerStatement'),
        governanceStatement: headerEl.querySelector('#governanceStatement'),
    };
}

// ── SVG icons ──

const SHARE_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
    <circle cx="12" cy="3" r="2"/><circle cx="4" cy="8" r="2"/><circle cx="12" cy="13" r="2"/>
    <path d="M5.7 9.2l4.6 2.6M10.3 4.2L5.7 6.8"/>
</svg>`;

const LINK_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
    <path d="M6.5 9.5a3 3 0 0 0 4.24 0l2-2a3 3 0 0 0-4.24-4.24l-1 1"/>
    <path d="M9.5 6.5a3 3 0 0 0-4.24 0l-2 2a3 3 0 0 0 4.24 4.24l1-1"/>
</svg>`;

const DOWNLOAD_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
    <path d="M8 2v9M4.5 8L8 11.5 11.5 8"/><path d="M2.5 13.5h11"/>
</svg>`;

const EMAIL_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
    <rect x="1.5" y="3" width="13" height="10" rx="2"/><path d="M1.5 5l6.5 4 6.5-4"/>
</svg>`;

const BLUESKY_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M3.47 2.34c1.58 1.19 3.28 3.6 3.98 4.89.7-1.3 2.4-3.7 3.98-4.89C12.52 1.52 15 .57 15 3.23c0 .53-.3 4.45-.48 5.08-.62 2.2-2.89 2.76-4.88 2.42 3.49.6 4.37 2.58 2.46 4.56-3.63 3.77-5.22-.95-5.63-2.16a3.3 3.3 0 0 1-.12-.39c-.02.12-.06.25-.12.4-.4 1.2-2 5.92-5.63 2.15-1.91-1.98-1.03-3.96 2.46-4.56-2-.34-4.26-.22-4.88-2.42C3.01 7.68 2.7 3.76 2.7 3.23c0-2.66 2.48-1.71 3.58-.89z"/></svg>`;

const FACEBOOK_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M14 8a6 6 0 1 0-6.94 5.93v-4.2H5.56V8h1.5V6.56c0-1.48.88-2.3 2.23-2.3.65 0 1.32.11 1.32.11V5.8h-.74c-.73 0-.96.46-.96.92V8h1.64l-.26 1.73h-1.38v4.2A6 6 0 0 0 14 8z"/></svg>`;

const GOOGLE_ICON = `<svg viewBox="0 0 48 48" fill="currentColor" width="14" height="14"><path d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.04 24.04 0 0 0 0 21.56l7.98-6.19z"/><path d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

const LINKEDIN_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M3.6 13.5H1.1V5.6h2.5v7.9zM2.35 4.55a1.45 1.45 0 1 1 0-2.9 1.45 1.45 0 0 1 0 2.9zM14.5 13.5H12v-3.85c0-.92-.02-2.1-1.28-2.1-1.28 0-1.48 1-1.48 2.03v3.92H6.76V5.6h2.38v1.08h.03c.33-.63 1.14-1.3 2.35-1.3 2.52 0 2.98 1.66 2.98 3.81v4.31z"/></svg>`;

const REDDIT_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M14.5 8a1.5 1.5 0 0 0-2.53-1.09 7.37 7.37 0 0 0-3.45-1.08l.7-2.48 1.92.43a1.07 1.07 0 1 0 .13-.63l-2.18-.49a.36.36 0 0 0-.42.25l-.8 2.85a7.52 7.52 0 0 0-3.6 1.08A1.5 1.5 0 1 0 2.17 9.1a2.7 2.7 0 0 0-.04.46c0 2.22 2.76 4.03 6.16 4.03s6.16-1.8 6.16-4.03c0-.15-.01-.3-.04-.45A1.5 1.5 0 0 0 14.5 8zM5.14 9.36a.93.93 0 1 1 1.86 0 .93.93 0 0 1-1.86 0zm5.37 2.52c-.67.47-1.55.7-2.51.7s-1.84-.23-2.51-.7a.36.36 0 0 1 .41-.58c.52.37 1.26.57 2.1.57s1.58-.2 2.1-.57a.36.36 0 0 1 .41.58zm-.22-1.6a.93.93 0 1 1 0-1.85.93.93 0 0 1 0 1.86z"/></svg>`;

const TWITTER_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M9.33 6.93L14.15 1.5h-1.14L8.83 6.18 5.47 1.5H1.5l5.06 7.37L1.5 14.5h1.14l4.42-5.14 3.53 5.14h3.97L9.33 6.93zm-1.57 1.82l-.51-.73L3.1 2.38h1.75l3.29 4.7.51.73 4.27 6.11h-1.75L7.76 8.75z"/></svg>`;

function sharePopoverContent() {
    return `
        <button class="share-option" id="shareCopyLink">${LINK_ICON}<span data-i18n="share.copyLink">Copy Link</span></button>
        <button class="share-option" id="shareDownloadPng">${DOWNLOAD_ICON}<span data-i18n="share.downloadVisual">Download Visual</span></button>
        <div class="share-sep"></div>
        <button class="share-option" id="shareBluesky">${BLUESKY_ICON}<span data-i18n="share.bluesky">Bluesky</span></button>
        <button class="share-option" id="shareFacebook">${FACEBOOK_ICON}<span data-i18n="share.facebook">Facebook</span></button>
        <button class="share-option" id="shareGoogle">${GOOGLE_ICON}<span>Google</span></button>
        <button class="share-option" id="shareLinkedIn">${LINKEDIN_ICON}<span data-i18n="share.linkedin">LinkedIn</span></button>
        <button class="share-option" id="shareReddit">${REDDIT_ICON}<span data-i18n="share.reddit">Reddit</span></button>
        <button class="share-option" id="shareTwitter">${TWITTER_ICON}<span>X</span></button>
        <div class="share-sep"></div>
        <button class="share-option" id="shareEmail">${EMAIL_ICON}<span data-i18n="share.email">Email</span></button>`;
}
