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
    const hasResolution = page === 'image';

    const themeSwitcherHTML = `
        <div class="theme-switcher" id="themeSwitcher">
            <div class="theme-slider" id="themeSlider"></div>
            <button class="theme-option" data-theme="system" data-i18n="theme.system">System</button>
            <button class="theme-option" data-theme="light" data-i18n="theme.light">Light</button>
            <button class="theme-option" data-theme="dark" data-i18n="theme.dark">Dark</button>
        </div>`;

    const langSelectHTML = `
        <select id="langSelect" class="lang-select" aria-label="Language" data-i18n-aria="footer.langLabel">
            <option value="en">English</option>
            <option value="es">Espa&#241;ol</option>
        </select>`;

    const githubLinkHTML = `
        <a href="https://github.com/Memeticode/symmetrical-barnacle" target="_blank" rel="noopener"
            class="footer-link footer-github">
            ${GITHUB_ICON}
            <span data-i18n="footer.github">GitHub</span>
        </a>`;

    if (isGallery) {
        footerEl.innerHTML = `
            <div class="footer-content">
                ${githubLinkHTML}
                <div class="footer-controls">
                    ${langSelectHTML}
                    ${themeSwitcherHTML}
                </div>
            </div>`;
    } else {
        const resolutionHTML = hasResolution ? `
            <div class="settings-section">
                <span class="settings-section-label" data-i18n="footer.resolution">Resolution</span>
                <select id="resolutionSelect" class="lang-select" aria-label="Resolution" data-i18n-aria="footer.resolutionLabel">
                    <option value="sd">SD (840&#215;540)</option>
                    <option value="hd" selected>HD (1400&#215;900)</option>
                    <option value="fhd">FHD (1680&#215;1080)</option>
                    <option value="qhd">QHD (2520&#215;1620)</option>
                    <option value="4k">4K (3360&#215;2160)</option>
                </select>
            </div>` : '';

        footerEl.innerHTML = `
            <div class="footer-content">
                <div class="settings-btn-wrap">
                    <button id="pageSettingsBtn" class="footer-link" data-tooltip="Settings" data-i18n-tooltip="footer.settings">
                        ${SETTINGS_ICON}
                    </button>
                    <div id="pageSettingsPopover" class="settings-popover hidden">
                        <div class="settings-section">
                            <span class="settings-section-label" data-i18n="footer.theme">Theme</span>
                            ${themeSwitcherHTML}
                        </div>
                        <div class="settings-section">
                            <span class="settings-section-label" data-i18n="footer.language">Language</span>
                            ${langSelectHTML}
                        </div>
                        ${resolutionHTML}
                    </div>
                </div>
                ${githubLinkHTML}
            </div>`;
    }

    return {
        themeSwitcher: footerEl.querySelector('#themeSwitcher'),
        langSelect: footerEl.querySelector('#langSelect'),
        resolutionSelect: footerEl.querySelector('#resolutionSelect'),
        pageSettingsBtn: footerEl.querySelector('#pageSettingsBtn'),
        pageSettingsPopover: footerEl.querySelector('#pageSettingsPopover'),
    };
}

// ── SVG icons ──

const GITHUB_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;

const SETTINGS_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M13.07 2.93l-1.41 1.41M4.34 11.66l-1.41 1.41"/></svg>`;
