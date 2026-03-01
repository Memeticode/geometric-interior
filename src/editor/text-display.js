/**
 * Text display — typewriter animation, generated text, and canvas overlay.
 */

import { generateTitle, generateAltText } from '../../lib/core/text.js';
import { xmur3, mulberry32 } from '../../lib/core/prng.js';

/**
 * @param {object} els - DOM element refs
 * @param {HTMLElement} els.titleEl - Title text element
 * @param {HTMLElement} els.altEl - Alt text element
 * @param {HTMLElement} els.textWrap - Outer wrapper for animated height
 * @param {HTMLElement} els.textInner - Inner wrapper (scrollHeight source)
 * @param {HTMLElement} els.overlayEl - Canvas overlay container
 * @param {HTMLElement} els.overlayTextEl - Canvas overlay text span
 */
export function createTextDisplay({ titleEl, altEl, textWrap, textInner, overlayEl, overlayTextEl }) {
    let typewriterAbort = null;
    let textHeightRAF = null;
    let textRefreshTimer = null;

    /* ── Text wrap height ── */

    function syncTextWrapHeight() {
        const h = textInner.scrollHeight;
        textWrap.style.maxHeight = h + 'px';
    }

    function startTextHeightSync() {
        stopTextHeightSync();
        let lastH = 0;
        function poll() {
            const h = textInner.scrollHeight;
            if (h !== lastH) { textWrap.style.maxHeight = h + 'px'; lastH = h; }
            textHeightRAF = requestAnimationFrame(poll);
        }
        textHeightRAF = requestAnimationFrame(poll);
    }

    function stopTextHeightSync() {
        if (textHeightRAF) { cancelAnimationFrame(textHeightRAF); textHeightRAF = null; }
    }

    function collapseTextWrap() {
        textWrap.style.maxHeight = '0';
    }

    /* ── Typewriter ── */

    function typewriterEffect(element, text, charDelayMs, onComplete) {
        let i = 0;
        let cancelled = false;
        const textNode = document.createTextNode('');
        const cursor = document.createElement('span');
        cursor.className = 'tw-cursor';
        element.textContent = '';
        element.appendChild(textNode);
        element.appendChild(cursor);

        function tick() {
            if (cancelled) { cursor.remove(); return; }
            if (i <= text.length) {
                textNode.textContent = text.slice(0, i);
                i++;
                setTimeout(tick, charDelayMs);
            } else {
                cursor.remove();
                if (onComplete) onComplete();
            }
        }
        tick();
        return () => { cancelled = true; cursor.remove(); };
    }

    /* ── Reveal animations ── */

    function playRevealAnimation(title, altText) {
        cancelTypewriter();
        stopTextHeightSync();
        titleEl.textContent = '';
        altEl.textContent = '';
        collapseTextWrap();
        hideOverlay();
        startTextHeightSync();

        const cancelTitle = typewriterEffect(titleEl, title, 20, () => {
            const cancelAlt = typewriterEffect(altEl, altText, 6, () => {
                typewriterAbort = null;
                stopTextHeightSync();
                syncTextWrapHeight();
            });
            typewriterAbort = cancelAlt;
        });
        typewriterAbort = cancelTitle;
    }

    function instantReveal(title, altText) {
        cancelTypewriter();
        stopTextHeightSync();
        hideOverlay();
        titleEl.textContent = title;
        altEl.textContent = altText;
        syncTextWrapHeight();
    }

    /* ── Generated text ── */

    function refreshGeneratedText(seed, controls, nodeCount, animate, animationEnabled) {
        const titleRng = mulberry32(xmur3(seed + ':title')());
        const title = generateTitle(controls, titleRng);
        const altText = generateAltText(controls, nodeCount, title);
        if (animate && animationEnabled) {
            playRevealAnimation(title, altText);
        } else {
            titleEl.textContent = title;
            altEl.textContent = altText;
            syncTextWrapHeight();
        }
    }

    function scheduleTextRefresh(callback) {
        cancelTextRefresh();
        textRefreshTimer = setTimeout(() => {
            textRefreshTimer = null;
            callback();
        }, 1000);
    }

    function cancelTextRefresh() {
        if (textRefreshTimer) { clearTimeout(textRefreshTimer); textRefreshTimer = null; }
    }

    function cancelTypewriter() {
        if (typewriterAbort) { typewriterAbort(); typewriterAbort = null; }
    }

    function clearText() {
        cancelTypewriter();
        titleEl.textContent = '';
        altEl.textContent = '';
        hideOverlay();
    }

    /* ── Canvas overlay ── */

    function showOverlay(text) {
        overlayTextEl.textContent = text;
        overlayEl.classList.remove('hidden');
    }

    function hideOverlay() {
        overlayEl.classList.add('hidden');
    }

    return {
        playRevealAnimation,
        instantReveal,
        refreshGeneratedText,
        scheduleTextRefresh,
        cancelTextRefresh,
        cancelTypewriter,
        clearText,
        showOverlay,
        hideOverlay,
        syncTextWrapHeight,
    };
}
