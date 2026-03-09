/**
 * Sidebar toggle / drawer logic.
 * Manages open/close of the editor sidebar and header-height sync.
 */

import { refreshTooltip } from './tooltips.js';
import { t } from '../i18n/locale.js';

let sidebarEl = null;
let sidebarToggleBtn = null;
let sidebarBackdrop = null;

/* Keep --header-h in sync so the tablet/mobile sidebar sits below the header */
function syncHeaderHeight() {
    const h = document.querySelector('.app-header');
    if (h) document.documentElement.style.setProperty('--header-h', h.offsetHeight + 'px');
}

export function isSidebarOpen() {
    return sidebarEl && !sidebarEl.classList.contains('sidebar-collapsed');
}

export function openSidebar() {
    if (!sidebarEl) return;
    sidebarEl.classList.remove('sidebar-collapsed');
    sidebarEl.setAttribute('aria-hidden', 'false');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('hidden');
    if (sidebarToggleBtn) {
        sidebarToggleBtn.classList.add('sidebar-open');
        sidebarToggleBtn.setAttribute('data-tooltip', t('panel.closeMenu'));
        sidebarToggleBtn.setAttribute('aria-label', t('panel.closeMenu'));
        refreshTooltip(sidebarToggleBtn);
    }
    localStorage.setItem('geo-sidebar-collapsed', 'false');
}

export function closeSidebar() {
    if (!sidebarEl) return;
    sidebarEl.classList.add('sidebar-collapsed');
    sidebarEl.setAttribute('aria-hidden', 'true');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('hidden');
    if (sidebarToggleBtn) {
        sidebarToggleBtn.classList.remove('sidebar-open');
        sidebarToggleBtn.setAttribute('data-tooltip', t('panel.openMenu'));
        sidebarToggleBtn.setAttribute('aria-label', t('panel.openMenu'));
        refreshTooltip(sidebarToggleBtn);
    }
    localStorage.setItem('geo-sidebar-collapsed', 'true');
}

/**
 * Initialize the sidebar toggle system.
 * Finds DOM elements, sets up click handlers, and syncs header height.
 */
export function initSidebar() {
    sidebarEl = document.querySelector('.sidebar');
    sidebarToggleBtn = document.getElementById('sidebarToggle');
    sidebarBackdrop = document.getElementById('sidebarBackdrop');

    syncHeaderHeight();
    window.addEventListener('resize', syncHeaderHeight);

    if (!sidebarToggleBtn || !sidebarEl) return;

    // Set initial button state to match sidebar
    if (isSidebarOpen()) {
        sidebarToggleBtn.classList.add('sidebar-open');
        sidebarToggleBtn.setAttribute('data-tooltip', t('panel.closeMenu'));
        sidebarToggleBtn.setAttribute('aria-label', t('panel.closeMenu'));
    }

    // Remove no-transition class set by inline script after first frame
    requestAnimationFrame(() => sidebarEl.classList.remove('no-transition'));

    sidebarToggleBtn.addEventListener('click', () => {
        if (isSidebarOpen()) closeSidebar();
        else openSidebar();
    });

    // Close drawer when clicking backdrop
    if (sidebarBackdrop) {
        sidebarBackdrop.addEventListener('click', closeSidebar);
    }
}
