/**
 * Language selector widget — native <select> dropdown.
 * Switches between supported locales.
 */

import { setLocale, getLocale } from './locale.js';

/**
 * Initialize the language selector.
 * @param {HTMLSelectElement} selectEl - The <select> element
 */
export function initLangSelector(selectEl) {
    if (!selectEl) return;

    selectEl.value = getLocale();

    selectEl.addEventListener('change', () => {
        setLocale(selectEl.value);
    });

    document.addEventListener('localechange', (e) => {
        selectEl.value = e.detail.locale;
    });
}
