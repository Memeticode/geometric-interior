/**
 * Panel toggle / drawer logic.
 * Manages open/close of the sidebar panel, backdrop, and header-height sync.
 */

import { refreshTooltip } from './tooltips.js';
import { t } from '../i18n/locale.js';

let panelEl = null;
let panelToggleBtn = null;
let panelBackdrop = null;

/* Keep --header-h in sync so the tablet/mobile panel sits below the header */
function syncHeaderHeight() {
    const h = document.querySelector('.app-header');
    if (h) document.documentElement.style.setProperty('--header-h', h.offsetHeight + 'px');
}

export function isPanelOpen() {
    return panelEl && !panelEl.classList.contains('panel-collapsed');
}

export function openPanel() {
    if (!panelEl) return;
    panelEl.classList.remove('panel-collapsed');
    panelEl.setAttribute('aria-hidden', 'false');
    if (panelBackdrop) panelBackdrop.classList.remove('hidden');
    if (panelToggleBtn) {
        panelToggleBtn.classList.add('panel-open');
        panelToggleBtn.setAttribute('data-tooltip', t('panel.closeMenu'));
        panelToggleBtn.setAttribute('aria-label', t('panel.closeMenu'));
        refreshTooltip(panelToggleBtn);
    }
    localStorage.setItem('geo-self-portrait-panel-collapsed', 'false');
}

export function closePanel() {
    if (!panelEl) return;
    panelEl.classList.add('panel-collapsed');
    panelEl.setAttribute('aria-hidden', 'true');
    if (panelBackdrop) panelBackdrop.classList.add('hidden');
    if (panelToggleBtn) {
        panelToggleBtn.classList.remove('panel-open');
        panelToggleBtn.setAttribute('data-tooltip', t('panel.openMenu'));
        panelToggleBtn.setAttribute('aria-label', t('panel.openMenu'));
        refreshTooltip(panelToggleBtn);
    }
    localStorage.setItem('geo-self-portrait-panel-collapsed', 'true');
}

/**
 * Initialize the panel toggle system.
 * Finds DOM elements, sets up click handlers, and syncs header height.
 */
export function initPanel() {
    panelEl = document.querySelector('.panel');
    panelToggleBtn = document.getElementById('panelToggle');
    panelBackdrop = document.getElementById('panelBackdrop');

    syncHeaderHeight();
    window.addEventListener('resize', syncHeaderHeight);

    if (!panelToggleBtn || !panelEl) return;

    // Set initial button state to match panel
    if (isPanelOpen()) {
        panelToggleBtn.classList.add('panel-open');
        panelToggleBtn.setAttribute('data-tooltip', t('panel.closeMenu'));
        panelToggleBtn.setAttribute('aria-label', t('panel.closeMenu'));
    }

    // Remove no-transition class set by inline script after first frame
    requestAnimationFrame(() => panelEl.classList.remove('no-transition'));

    panelToggleBtn.addEventListener('click', () => {
        if (isPanelOpen()) closePanel();
        else openPanel();
    });

    // Close drawer when clicking backdrop
    if (panelBackdrop) {
        panelBackdrop.addEventListener('click', closePanel);
    }
}
