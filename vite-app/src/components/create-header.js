import { DOT_SVG, SHARE_SVG, LINK_SVG, EMAIL_SVG, BLUESKY_SVG, FACEBOOK_SVG, GOOGLE_SVG, LINKEDIN_SVG, REDDIT_SVG, TWITTER_SVG } from './icons.js';

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
        ? `<button id="siteMenuToggle" class="site-menu-toggle" aria-label="Open menu" data-tooltip="Open menu" data-tooltip-pos="right">
               <div class="panel-toggle-icon">
                   <span class="bar bar-top"></span>
                   <span class="bar bar-mid"></span>
                   <span class="bar bar-bot"></span>
               </div>
               <span class="rq-badge hidden" id="renderQueueBadge"></span>
           </button>`
        : `<button id="sidebarToggle" class="sidebar-toggle-btn" aria-label="Open menu" data-tooltip="Open menu" data-i18n-aria="panel.openMenu" data-i18n-tooltip="panel.openMenu" data-tooltip-pos="right">
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
            { href: '/images', key: 'nav.gallery', label: 'Gallery' },
            { href: '/images/create', key: 'nav.imageEditor', label: 'Image Editor' },
            { href: '/animation/create', key: 'nav.animationEditor', label: 'Animation Editor' },
        ];
        for (const p of pages) {
            const isActive = (page === 'image' && p.href === '/images/create')
                          || (page === 'animation' && p.href === '/animation/create');
            const cls = 'header-link' + (isActive ? ' header-link-active' : '');
            navLinks.push(`<a href="${p.href}" class="${cls}" data-i18n="${p.key}">${p.label}</a>`);
        }
    }

    // Statement buttons (all pages)
    const statementBtns = [
        `<button id="artistStatement" class="header-link header-statement" data-i18n="header.artistStatement">Artist Statement</button>`,
        `<button id="developerStatement" class="header-link header-statement" data-i18n="header.developerStatement">Developer Statement</button>`,
        `<button id="governanceStatement" class="header-link header-statement" data-i18n="header.governanceFramework">Governance Framework</button>`,
    ];

    const allLinks = [...navLinks, ...statementBtns];
    const linksHTML = allLinks.join(`<span class="header-sep">${DOT_SVG}</span>`);

    // ── Share button (gallery only) ──
    const shareHTML = isGallery
        ? `<button id="shareBtn" data-tooltip="Open share" data-i18n-tooltip="stage.share" data-tooltip-pos="left">
               ${SHARE_SVG}
           </button>
           <div id="sharePopover" class="share-popover hidden">
               ${sharePopoverContent()}
           </div>`
        : '';

    // ── Assemble ──
    headerEl.innerHTML = `
        ${toggleHTML}
        <div class="header-brand">
            <h1 data-i18n="header.title">Geometric Interior: Self-Portraits of a Predictive Model</h1>
            <div class="header-links">${linksHTML}</div>
        </div>
        ${shareHTML}`;

    return {
        sidebarToggle: headerEl.querySelector('#sidebarToggle'),
        siteMenuToggle: headerEl.querySelector('#siteMenuToggle'),
        renderQueueBadge: headerEl.querySelector('#renderQueueBadge'),
        shareBtn: headerEl.querySelector('#shareBtn'),
        sharePopover: headerEl.querySelector('#sharePopover'),
        artistStatement: headerEl.querySelector('#artistStatement'),
        developerStatement: headerEl.querySelector('#developerStatement'),
        governanceStatement: headerEl.querySelector('#governanceStatement'),
    };
}


function sharePopoverContent() {
    return `
        <button class="share-option" id="shareCopyLink">${LINK_SVG}<span data-i18n="share.copyLink">Copy Link</span></button>
        <div class="share-sep"></div>
        <button class="share-option" id="shareBluesky">${BLUESKY_SVG}<span data-i18n="share.bluesky">Bluesky</span></button>
        <button class="share-option" id="shareFacebook">${FACEBOOK_SVG}<span data-i18n="share.facebook">Facebook</span></button>
        <button class="share-option" id="shareGoogle">${GOOGLE_SVG}<span>Google</span></button>
        <button class="share-option" id="shareLinkedIn">${LINKEDIN_SVG}<span data-i18n="share.linkedin">LinkedIn</span></button>
        <button class="share-option" id="shareReddit">${REDDIT_SVG}<span data-i18n="share.reddit">Reddit</span></button>
        <button class="share-option" id="shareTwitter">${TWITTER_SVG}<span>X</span></button>
        <div class="share-sep"></div>
        <button class="share-option" id="shareEmail">${EMAIL_SVG}<span data-i18n="share.email">Email</span></button>`;
}
