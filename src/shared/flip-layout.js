/**
 * <flip-layout> — reusable FLIP animation custom element.
 *
 * Wraps child items and animates them between layout states using the
 * FLIP (First-Last-Invert-Play) technique.  Items themselves are real
 * DOM elements that translate — no cloning, no fading.
 *
 * Usage:
 *   const fl = document.querySelector('flip-layout');
 *
 *   // Standard: animate children within the component
 *   await fl.flip(() => {
 *       fl.classList.toggle('grid-mode');
 *   });
 *
 *   // Cross-container: provide external "first" positions
 *   await fl.flip(() => {
 *       buildGridCards();
 *       showGrid();
 *   }, { firstRects: capturedCarouselRects });
 *
 * Children must have a `data-flip-key` attribute for matching between
 * the "first" and "last" snapshots.
 *
 * Attributes:
 *   duration  — animation duration in ms   (default 450)
 *   easing    — CSS easing function         (default cubic-bezier(0.4, 0, 0.2, 1))
 */

const DEFAULT_DURATION = 450;
const DEFAULT_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

class FlipLayout extends HTMLElement {
    static observedAttributes = ['duration', 'easing'];

    #duration = DEFAULT_DURATION;
    #easing = DEFAULT_EASING;
    #animating = false;

    get duration() { return this.#duration; }
    get easing() { return this.#easing; }
    get animating() { return this.#animating; }

    attributeChangedCallback(name, _old, val) {
        if (name === 'duration') this.#duration = parseInt(val, 10) || DEFAULT_DURATION;
        if (name === 'easing') this.#easing = val || DEFAULT_EASING;
    }

    /** Capture bounding rects for all [data-flip-key] descendants. */
    #capture() {
        const rects = new Map();
        for (const el of this.querySelectorAll('[data-flip-key]')) {
            rects.set(el.dataset.flipKey, {
                rect: el.getBoundingClientRect(),
                el,
            });
        }
        return rects;
    }

    /**
     * Animate children between their current positions and the positions
     * resulting from `applyChanges()`.
     *
     * @param {() => void} applyChanges  — callback that mutates layout
     * @param {{ firstRects?: Map<string, DOMRect> }} [opts]
     *        firstRects — external "before" positions keyed by flip-key.
     *        Use this for cross-container FLIP where the source elements
     *        are outside the <flip-layout>.
     * @returns {Promise<void>}  resolves when animation completes
     */
    async flip(applyChanges, { firstRects } = {}) {
        if (this.#animating) return;
        this.#animating = true;

        // ── FIRST ──
        let first;
        if (firstRects) {
            // External rects — wrap each DOMRect in the same shape as #capture()
            first = new Map();
            for (const [key, rect] of firstRects) {
                first.set(key, { rect, el: null });
            }
        } else {
            first = this.#capture();
        }

        // ── Apply layout change ──
        applyChanges();

        // Force reflow so LAST positions are final
        void this.offsetHeight;

        // ── LAST ──
        const last = this.#capture();

        // ── INVERT + PLAY ──
        await playFlip(first, last, this.#duration, this.#easing);

        this.#animating = false;
    }
}

/**
 * Core FLIP animation logic — shared between <flip-layout> and flipAnimate().
 *
 * @param {Map<string, {rect: DOMRect, el: Element|null}>} first
 * @param {Map<string, {rect: DOMRect, el: Element}>} last
 * @param {number} duration
 * @param {string} easing
 */
async function playFlip(first, last, duration, easing) {
    const animated = [];

    for (const [key, { rect: lastRect, el }] of last) {
        const firstEntry = first.get(key);
        if (firstEntry) {
            // Matched item — translate from FIRST visual position to LAST
            const firstRect = firstEntry.rect;
            const dx = firstRect.left - lastRect.left;
            const dy = firstRect.top - lastRect.top;
            const sx = firstRect.width / (lastRect.width || 1);
            const sy = firstRect.height / (lastRect.height || 1);

            el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
            el.style.transformOrigin = 'top left';

            // Force the inverted position
            void el.offsetHeight;

            el.style.transition = `transform ${duration}ms ${easing}`;
            el.style.removeProperty('transform');
            animated.push(el);
        } else {
            // Entering item — scale up from nothing
            el.style.transform = 'scale(0)';
            el.style.transformOrigin = 'center center';
            void el.offsetHeight;
            el.style.transition = `transform ${duration}ms ${easing}`;
            el.style.removeProperty('transform');
            animated.push(el);
        }
    }

    // ── Exiting items — clone at FIRST position, shrink out, remove ──
    for (const [key, { rect, el }] of first) {
        if (!last.has(key) && el) {
            const clone = el.cloneNode(true);
            clone.style.position = 'fixed';
            clone.style.left = rect.left + 'px';
            clone.style.top = rect.top + 'px';
            clone.style.width = rect.width + 'px';
            clone.style.height = rect.height + 'px';
            clone.style.margin = '0';
            clone.style.zIndex = '100';
            clone.style.pointerEvents = 'none';
            clone.style.transformOrigin = 'center center';
            document.body.appendChild(clone);

            void clone.offsetHeight;
            clone.style.transition =
                `transform ${duration}ms ${easing}, ` +
                `opacity ${duration}ms ${easing}`;
            clone.style.transform = 'scale(0)';
            clone.style.opacity = '0';

            setTimeout(() => clone.remove(), duration + 50);
        }
    }

    // Wait for animation, then clean up inline styles
    await new Promise(resolve => setTimeout(resolve, duration + 20));

    for (const el of animated) {
        el.style.transform = '';
        el.style.transformOrigin = '';
        el.style.transition = '';
    }
}

/**
 * Standalone FLIP animation — animate a set of elements from source
 * positions to their current positions.  Useful for cross-container
 * transitions where elements are not inside a <flip-layout>.
 *
 * @param {Element[]} targets     — elements to animate (at LAST positions)
 * @param {(el: Element) => string} keyFn — returns a matching key per element
 * @param {Map<string, DOMRect>} firstRects — source rects keyed by the same keys
 * @param {{ duration?: number, easing?: string }} [opts]
 * @returns {Promise<void>}
 */
async function flipAnimate(targets, keyFn, firstRects, {
    duration = DEFAULT_DURATION,
    easing = DEFAULT_EASING,
} = {}) {
    const first = new Map();
    for (const [key, rect] of firstRects) {
        first.set(key, { rect, el: null });
    }

    const last = new Map();
    for (const el of targets) {
        const key = keyFn(el);
        if (key) last.set(key, { rect: el.getBoundingClientRect(), el });
    }

    await playFlip(first, last, duration, easing);
}

customElements.define('flip-layout', FlipLayout);

export { FlipLayout, flipAnimate };
