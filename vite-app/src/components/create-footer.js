import { GITHUB_SVG, SETTINGS_SVG } from './icons.js';

/**
 * Shared footer builder — populates an empty <footer> element with the correct
 * variant for gallery, image editor, or animation editor pages.
 *
 * Gallery: flat layout (GitHub link + lang select + theme switcher)
 * Editors: settings popover (gear icon → theme + lang + optional resolution) + GitHub link
 *
 * @param {HTMLElement} footerEl - The <footer class="app-footer"> element to populate
 * @param {{ page: 'gallery' | 'image' | 'animation' }} opts
 * @returns {object} refs to key child elements
 */
export function createFooter(footerEl, { page }) {
    const isGallery = page === 'gallery';

    const themeSwitcherHTML = `
        <div class="theme-switcher" id="themeSwitcher">
            <div class="theme-slider" id="themeSlider"></div>
            <button class="theme-option" data-theme="system" data-i18n="theme.system">System</button>
            <button class="theme-option" data-theme="light" data-i18n="theme.light">Light</button>
            <button class="theme-option" data-theme="dark" data-i18n="theme.dark">Dark</button>
        </div>`;

    const langDropdownHTML = `
        <div class="custom-dropdown" id="langDropdown">
            <button class="custom-dropdown-trigger select-base" aria-haspopup="listbox" aria-expanded="false" aria-label="Language" data-i18n-aria="footer.langLabel">
                <span class="custom-dropdown-label">English</span>
            </button>
            <div class="custom-dropdown-menu hidden" role="listbox">
                <button class="custom-dropdown-item active" role="option" data-value="en" aria-selected="true">English</button>
                <button class="custom-dropdown-item" role="option" data-value="es" aria-selected="false">Espa&#241;ol</button>
            </div>
        </div>`;

    const githubLinkHTML = `
        <a href="https://github.com/Memeticode/symmetrical-barnacle" target="_blank" rel="noopener"
            class="footer-link footer-github">
            ${GITHUB_SVG}
            <span data-i18n="footer.github">GitHub</span>
        </a>`;

    if (isGallery) {
        footerEl.innerHTML = `
            <div class="footer-content">
                ${githubLinkHTML}
                <div class="footer-controls">
                    ${langDropdownHTML}
                    ${themeSwitcherHTML}
                </div>
            </div>`;
    } else {
        footerEl.innerHTML = `
            <div class="footer-content">
                <div class="settings-btn-wrap">
                    <button id="pageSettingsBtn" class="footer-link" data-tooltip="Settings" data-i18n-tooltip="footer.settings">
                        ${SETTINGS_SVG}
                    </button>
                    <div id="pageSettingsPopover" class="settings-popover hidden">
                        <div class="settings-section">
                            <span class="settings-section-label" data-i18n="footer.theme">Theme</span>
                            ${themeSwitcherHTML}
                        </div>
                        <div class="settings-section">
                            <span class="settings-section-label" data-i18n="footer.language">Language</span>
                            ${langDropdownHTML}
                        </div>
                    </div>
                </div>
                ${githubLinkHTML}
            </div>`;
    }

    return {
        themeSwitcher: footerEl.querySelector('#themeSwitcher'),
        langDropdown: footerEl.querySelector('#langDropdown'),
        pageSettingsBtn: footerEl.querySelector('#pageSettingsBtn'),
        pageSettingsPopover: footerEl.querySelector('#pageSettingsPopover'),
    };
}

/**
 * Create a toggle API for footer visibility (for testing).
 * @param {HTMLElement} footerEl
 */
export function createFooterToggle(footerEl) {
    return {
        toggle() { footerEl.classList.toggle('footer-hidden'); },
        show() { footerEl.classList.remove('footer-hidden'); },
        hide() { footerEl.classList.add('footer-hidden'); },
        get hidden() { return footerEl.classList.contains('footer-hidden'); },
    };
}
