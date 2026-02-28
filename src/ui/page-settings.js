/**
 * Page settings popover — gear icon in footer.
 * Consolidates theme, language, and resolution controls.
 */

import { initTheme } from './theme.js';
import { initLangSelector } from '../i18n/lang-selector.js';
import { initResolutionSelector } from './resolution.js';

/**
 * @param {HTMLButtonElement} gearBtn - The gear icon button
 * @param {HTMLElement} popover - The settings popover container
 */
export function initPageSettings(gearBtn, popover) {
    if (!gearBtn || !popover) return;

    // Init sub-controls
    const themeSwitcher = popover.querySelector('#themeSwitcher');
    if (themeSwitcher) initTheme(themeSwitcher);

    const langSelect = popover.querySelector('#langSelect');
    if (langSelect) initLangSelector(langSelect);

    const resSelect = popover.querySelector('#resolutionSelect');
    if (resSelect) initResolutionSelector(resSelect);

    // Toggle popover
    gearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        popover.classList.toggle('hidden');
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!popover.contains(e.target) && e.target !== gearBtn) {
            popover.classList.add('hidden');
        }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !popover.classList.contains('hidden')) {
            popover.classList.add('hidden');
            gearBtn.focus();
        }
    });
}
