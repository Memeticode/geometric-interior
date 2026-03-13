/**
 * Shared full-page blocking overlay for transitions.
 * Blocks all pointer/keyboard/scroll input. Calls onSkip on any user interaction.
 *
 * Skip callbacks are wrapped in `no-transitions` so all CSS transitions snap
 * instantly — callers don't need to manage transition suppression themselves.
 */

let overlay = null;
let skipCb = null;

/** Wrap skip callback: suppress CSS transitions, call cb, force reflow, restore. */
function fireSkip() {
    if (!skipCb) return;
    const cb = skipCb;
    console.log('[overlay] fireSkip — suppressing transitions');
    document.documentElement.classList.add('no-transitions');
    cb();
    void document.documentElement.offsetHeight; // force reflow so changes apply
    document.documentElement.classList.remove('no-transitions');
}

function handleKey(e) {
    console.log('[overlay] keydown skip:', e.key);
    fireSkip();
}
function handleWheel() {
    console.log('[overlay] wheel skip');
    fireSkip();
}

/**
 * Show a full-page overlay that blocks all interactions.
 * @param {() => void} [onSkip] — called when user clicks/taps/keys/scrolls during overlay
 */
export function showBlockOverlay(onSkip) {
    if (overlay) {
        console.log('[overlay] showBlockOverlay: already exists, replacing');
        hideBlockOverlay();
    }
    overlay = document.createElement('div');
    overlay.className = 'lm-block-overlay';
    skipCb = onSkip || null;
    if (skipCb) {
        overlay.addEventListener('pointerdown', (e) => {
            console.log('[overlay] pointerdown skip on', e.target);
            fireSkip();
        });
        document.addEventListener('keydown', handleKey, { capture: true, once: true });
        document.addEventListener('wheel', handleWheel, { capture: true, once: true });
    }
    document.body.appendChild(overlay);
    console.log('[overlay] SHOWN, hasSkip:', !!skipCb, 'z-index:', getComputedStyle(overlay).zIndex);
}

/** Remove the blocking overlay and clean up listeners. */
export function hideBlockOverlay() {
    if (!overlay) return;
    console.log('[overlay] HIDDEN');
    overlay.remove();
    overlay = null;
    skipCb = null;
    document.removeEventListener('keydown', handleKey, true);
    document.removeEventListener('wheel', handleWheel, true);
}
