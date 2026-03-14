/**
 * Tooltip system — unified, fixed-position to escape overflow.
 * Self-contained module. Call initTooltips() once after DOM is ready.
 */

let paramTooltip = null;
let tooltipSource = null;

export function showTooltip(el, mouseX, mouseY) {
    tooltipSource = el;
    paramTooltip.textContent = el.getAttribute('data-tooltip');
    const pos = el.getAttribute('data-tooltip-pos');
    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    /* Measure tooltip dimensions (must be visible + positioned to get real size) */
    paramTooltip.style.transform = '';
    paramTooltip.style.left = '0px';
    paramTooltip.style.top = '0px';
    paramTooltip.style.width = '';
    paramTooltip.style.maxWidth = '';
    paramTooltip.style.textAlign = '';
    paramTooltip.classList.add('visible');
    const tw = paramTooltip.offsetWidth;
    const th = paramTooltip.offsetHeight;

    if (pos === 'overlay') {
        /* Overlay positioning — centered on the element with inset */
        const rect = el.getBoundingClientRect();
        const inset = 8;
        const overlayWidth = rect.width - inset * 2;
        paramTooltip.style.width = overlayWidth + 'px';
        paramTooltip.style.maxWidth = overlayWidth + 'px';
        paramTooltip.style.textAlign = 'center';
        // Re-measure height after setting width
        const overlayHeight = paramTooltip.offsetHeight;
        paramTooltip.style.left = (rect.left + inset) + 'px';
        paramTooltip.style.top = (rect.top + (rect.height - overlayHeight) / 2) + 'px';
    } else if (pos === 'right' || pos === 'left' || (!pos && el.closest('.sidebar'))) {
        /* Element-anchored positioning (sidebar items, share button, etc.) */
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const fitsRight = rect.right + gap + tw <= vw - gap;
        const fitsLeft  = rect.left - gap - tw >= gap;
        const fitsBelow = rect.bottom + gap + th <= vh - gap;

        let left, top;
        const preferLeft = pos === 'left';
        if (preferLeft ? fitsLeft : fitsRight) {
            left = preferLeft ? rect.left - gap - tw : rect.right + gap;
            top = cy - th / 2;
        } else if (preferLeft ? fitsRight : fitsLeft) {
            left = preferLeft ? rect.right + gap : rect.left - gap - tw;
            top = cy - th / 2;
        } else if (fitsBelow) {
            left = cx - tw / 2;
            top = rect.bottom + gap;
        } else {
            left = cx - tw / 2;
            top = rect.top - gap - th;
        }

        /* Clamp to viewport */
        left = Math.max(gap, Math.min(left, vw - tw - gap));
        top  = Math.max(gap, Math.min(top, vh - th - gap));

        paramTooltip.style.left = left + 'px';
        paramTooltip.style.top = top + 'px';
    } else {
        /* Cursor-relative positioning (stage area items) */
        const preferAbove = pos === 'above';
        const cursorGap = 14;
        const mx = mouseX || 0;
        const my = mouseY || 0;

        let left = mx - tw / 2;
        left = Math.max(gap, Math.min(left, vw - tw - gap));

        let top;
        if (preferAbove) {
            top = my - th - cursorGap;
            if (top < gap) top = my + cursorGap; /* flip to below */
        } else {
            top = my + cursorGap;
            if (top + th > vh - gap) top = my - th - cursorGap; /* flip to above */
        }

        paramTooltip.style.left = left + 'px';
        paramTooltip.style.top = top + 'px';
    }
}

export function hideTooltip() {
    tooltipSource = null;
    if (paramTooltip) paramTooltip.classList.remove('visible');
}

export function refreshTooltip(el) {
    if (tooltipSource === el && paramTooltip.classList.contains('visible')) {
        showTooltip(el);
    }
}

/**
 * Attach tooltip listeners via event delegation on the document.
 * Works for both static and dynamically-created [data-tooltip] elements.
 * Uses #paramTooltip element for display.
 */
export function initTooltips() {
    paramTooltip = document.getElementById('paramTooltip');

    let recentTouch = false;
    let touchTimer = 0;
    const TOUCH_TRANSITION_MS = 800;

    function findTooltip(target) {
        return target && target.closest ? target.closest('[data-tooltip]') : null;
    }

    /* --- Desktop: hover shows/hides tooltips --- */
    document.addEventListener('mouseover', (e) => {
        if (recentTouch) return;
        const el = findTooltip(e.target);
        if (el && !el.hasAttribute('data-tooltip-click')) showTooltip(el, e.clientX, e.clientY);
    });

    document.addEventListener('mouseout', (e) => {
        if (recentTouch) return;
        const el = findTooltip(e.target);
        if (!el || el.hasAttribute('data-tooltip-click')) return;
        const related = e.relatedTarget;
        if (related && el.contains(related)) return;
        hideTooltip();
    });

    /* --- Touch: only info-icon / label-info taps show tooltips --- */
    document.addEventListener('touchstart', () => {
        recentTouch = true;
        clearTimeout(touchTimer);
        touchTimer = setTimeout(() => { recentTouch = false; }, TOUCH_TRANSITION_MS);
    }, { passive: true });

    document.addEventListener('click', (e) => {
        if (!recentTouch) return;

        /* Tapped an info-icon or its label-info parent? Toggle that tooltip. */
        const infoIcon = e.target.closest('.info-icon');
        const labelInfo = e.target.closest('.label-info');
        if (infoIcon || labelInfo) {
            const el = findTooltip(infoIcon || labelInfo);
            if (el) {
                if (tooltipSource === el && paramTooltip.classList.contains('visible')) {
                    hideTooltip();
                } else {
                    const rect = el.getBoundingClientRect();
                    showTooltip(el, rect.left + rect.width / 2, rect.bottom);
                }
                return;
            }
        }

        /* Any other tap dismisses a visible tooltip */
        if (paramTooltip.classList.contains('visible')) hideTooltip();
    });
}
