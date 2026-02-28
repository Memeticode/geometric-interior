/**
 * Language selector widget — mirrors the theme-switcher pattern.
 * Sliding pill UI for switching between supported locales.
 */

import { setLocale, getLocale } from './locale.js';

function positionSlider(switcher, slider, activeBtn) {
    if (!activeBtn) return;
    slider.style.width = activeBtn.offsetWidth + 'px';
    slider.style.transform = `translateX(${activeBtn.offsetLeft - 3}px)`;
}

/**
 * Initialize the language selector.
 * @param {HTMLElement} switcherEl - The .lang-switcher container element
 */
export function initLangSelector(switcherEl) {
    if (!switcherEl) return;

    const slider = switcherEl.querySelector('.lang-slider');
    const buttons = switcherEl.querySelectorAll('.lang-option');
    const currentLocale = getLocale();

    // Set initial active state
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLocale);
    });

    // Position slider after layout is ready
    requestAnimationFrame(() => {
        slider.style.transition = 'none';
        const activeBtn = switcherEl.querySelector('.lang-option.active');
        positionSlider(switcherEl, slider, activeBtn);
        // Force reflow, then re-enable transition
        slider.offsetHeight;
        slider.style.transition = '';
    });

    // Button click handler
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const locale = btn.dataset.lang;
            setLocale(locale);
            buttons.forEach(b => b.classList.toggle('active', b === btn));
            positionSlider(switcherEl, slider, btn);
        });
    });

    // Reposition slider on resize
    window.addEventListener('resize', () => {
        const activeBtn = switcherEl.querySelector('.lang-option.active');
        positionSlider(switcherEl, slider, activeBtn);
    });
}
