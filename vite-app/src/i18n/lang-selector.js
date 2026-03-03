/**
 * Language selector widget — custom dropdown that opens upward.
 * Replaces native <select> for guaranteed upward expansion.
 */

import { setLocale, getLocale } from './locale.js';
import { initCustomDropdown } from '../components/custom-dropdown.js';

const LABELS = { en: 'English', es: 'Español' };

/**
 * Initialize the custom language dropdown.
 * @param {HTMLElement} dropdownEl - The .custom-dropdown wrapper element
 */
export function initLangSelector(dropdownEl) {
    if (!dropdownEl) return;

    const current = getLocale();

    initCustomDropdown(dropdownEl, {
        initialValue: current,
        labelText: LABELS[current] || current,
        onSelect(value) { setLocale(value); },
    });

    // Sync on external locale change
    document.addEventListener('localechange', (e) => {
        const loc = e.detail.locale;
        const label = dropdownEl.querySelector('.custom-dropdown-label');
        if (label) label.textContent = LABELS[loc] || loc;
        syncActiveItem(dropdownEl, loc);
    });
}

function syncActiveItem(dropdownEl, value) {
    dropdownEl.querySelectorAll('.custom-dropdown-item').forEach(item => {
        const isActive = item.dataset.value === value;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-selected', String(isActive));
    });
}
