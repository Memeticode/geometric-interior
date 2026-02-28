/**
 * Tooltip system — unified, fixed-position to escape overflow.
 * Self-contained module. Call initTooltips() once after DOM is ready.
 */

let paramTooltip = null;
let tooltipSource = null;

function showTooltip(el, mouseX, mouseY) {
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
    paramTooltip.classList.add('visible');
    const tw = paramTooltip.offsetWidth;
    const th = paramTooltip.offsetHeight;

    if (pos === 'right' || (!pos && el.closest('.panel'))) {
        /* Element-anchored positioning (panel items) */
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const fitsRight = rect.right + gap + tw <= vw - gap;
        const fitsLeft  = rect.left - gap - tw >= gap;
        const fitsBelow = rect.bottom + gap + th <= vh - gap;

        let left, top;
        if (fitsRight) {
            left = rect.right + gap;
            top = cy - th / 2;
        } else if (fitsLeft) {
            left = rect.left - gap - tw;
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
        paramTooltip.textContent = el.getAttribute('data-tooltip');
    }
}

/**
 * Attach tooltip listeners to all [data-tooltip] elements on the page.
 * Uses #paramTooltip element for display.
 */
export function initTooltips() {
    paramTooltip = document.getElementById('paramTooltip');

    let recentTouch = false;
    document.querySelectorAll('[data-tooltip]').forEach(el => {
        el.addEventListener('mouseenter', (e) => {
            if (recentTouch) return;
            showTooltip(el, e.clientX, e.clientY);
        });
        el.addEventListener('mouseleave', hideTooltip);

        // Touch handling: long-press shows tooltip, regular tap suppresses it
        let pressTimer = null;
        let didLongPress = false;

        el.addEventListener('touchstart', () => {
            didLongPress = false;
            pressTimer = setTimeout(() => {
                didLongPress = true;
                showTooltip(el);
            }, 400);
        }, { passive: true });

        el.addEventListener('touchend', (e) => {
            clearTimeout(pressTimer);
            recentTouch = true;
            setTimeout(() => { recentTouch = false; }, 500);
            if (didLongPress) {
                e.preventDefault();
                setTimeout(hideTooltip, 1500);
            }
        });

        el.addEventListener('touchmove', () => {
            clearTimeout(pressTimer);
        }, { passive: true });
    });
}
