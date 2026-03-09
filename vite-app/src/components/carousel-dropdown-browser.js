/**
 * <carousel-dropdown-browser> — reusable coverflow carousel + grid dropdown.
 *
 * Encapsulates the full carousel experience: arc layout, drag-to-scroll,
 * arrow navigation, hover effects, and FLIP-animated expand/collapse
 * to a grid "dropdown" view.
 *
 * Content is defined via declarative child elements:
 *   <carousel-dropdown-browser-card key="..." label="..." thumb-src="...">
 *   <carousel-dropdown-browser-section label="..."> (optional grouping)
 *
 * ── Animation Architecture ──
 *
 * Card positioning uses CSS custom properties (--cx, --cy, --ry, --tz, --sc,
 * --card-opacity) which feed into CSS `transform` and `opacity` declarations.
 * Normal carousel navigation animates these via CSS transitions.
 *
 * Expand/collapse uses the Web Animations API (element.animate()) instead
 * of CSS transitions. This avoids fragile reflow-timing issues inherent in the
 * FLIP pattern (`transition:none → reflow → transition+targets`), where
 * intermediate reflows during layout changes can "consume" the from-state
 * before the browser sees the to-state.
 *
 * The animation flow for both directions:
 *   1. Suppress CSS transitions (transition:'none') during layout changes
 *   2. Read "from" positions from current custom property values
 *   3. Compute "to" positions from target layout (grid rects or carousel layout)
 *   4. Call #animateCardsWA() — creates Web Animations with explicit keyframes
 *   5. Set custom properties to target values (CSS uses these after animation)
 *   6. Cleanup: cancel animations, restore transitions, swap DOM state
 *
 * Scroll synchronization:
 *   - Expand: scrolls down during animation if grid overflows viewport
 *   - Collapse: scrolls up during card animation, then compensates for the
 *     dropdown-collapse layout shift with an instant offset + smooth ease
 *
 * @fires item-select   — { key, index, item } when a card is clicked
 * @fires center-change — { key, index } when carousel center changes (drag, arrow)
 * @fires item-delete   — { key, index, item } when grid delete button is clicked
 * @fires expand-change — { expanded } when grid dropdown opens/closes
 */

import { TRASH_SVG } from './icons.js';
import './flip-layout.js';

// ── Child element: <carousel-dropdown-browser-card> ──

class CarouselDropdownBrowserCard extends HTMLElement {
    static observedAttributes = ['key', 'label', 'thumb-src', 'fallback-src', 'deletable'];
    #data = null;

    get key() { return this.getAttribute('key'); }
    set key(v) { this.setAttribute('key', v); }
    get label() { return this.getAttribute('label') || ''; }
    set label(v) { this.setAttribute('label', v); }
    get thumbSrc() { return this.getAttribute('thumb-src') || ''; }
    set thumbSrc(v) { this.setAttribute('thumb-src', v); }
    get fallbackSrc() { return this.getAttribute('fallback-src'); }
    set fallbackSrc(v) { v ? this.setAttribute('fallback-src', v) : this.removeAttribute('fallback-src'); }
    get deletable() { return this.hasAttribute('deletable'); }
    set deletable(v) { v ? this.setAttribute('deletable', '') : this.removeAttribute('deletable'); }
    get data() { return this.#data; }
    set data(v) { this.#data = v; }

    attributeChangedCallback() {
        this.closest('carousel-dropdown-browser')?.requestUpdate();
    }
}

// ── Child element: <carousel-dropdown-browser-section> ──

class CarouselDropdownBrowserSection extends HTMLElement {
    static observedAttributes = ['label'];
    get label() { return this.getAttribute('label') || ''; }
    set label(v) { this.setAttribute('label', v); }
    attributeChangedCallback() {
        this.closest('carousel-dropdown-browser')?.requestUpdate();
    }
}

customElements.define('carousel-dropdown-browser-card', CarouselDropdownBrowserCard);
customElements.define('carousel-dropdown-browser-section', CarouselDropdownBrowserSection);

// ── SVG arrows ──

const ARROW_LEFT = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M10 3l-5 5 5 5"/></svg>`;
const ARROW_RIGHT = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M6 3l5 5-5 5"/></svg>`;

// ── Layout constants ──
const SECTION_GAP = 0.2;         // extra card-widths of spacing at section boundaries
const PERSPECTIVE_D = 1200;      // matches CSS perspective(1200px)
const DEG = Math.PI / 180;       // degrees-to-radians multiplier
const HOVER_ZONE_DELAY = 900;    // ms delay before recomputing hover zones after layout

// ── Card geometry ──
const ARC_Z_MAX_RAD    = 1.2;    // max total arc angle in radians (at arc-z=50)
const ARC_Z_RANGE      = 50;     // arc-z slider range
const SPACING_FLAT     = 0.58;   // card-width fraction for flat spacing
const SPACING_ARC_ADJ  = 0.08;   // spacing reduction at full arc
const SCALE_MIN_ARC    = 0.70;   // minimum card scale in arc mode
const SCALE_RATE_ARC   = 0.08;   // scale reduction per position in arc mode
const SCALE_MIN_LINEAR = 0.88;   // minimum card scale in linear mode
const SCALE_RATE_LINEAR = 0.04;  // scale reduction per position in linear mode
const TZ_PER_POS       = 15;     // translateZ depth per card position (px)
const RY_MAX_DEG       = 50;     // max rotateY cap in zone 1 (degrees)
const EDGE_MARGIN      = 8;      // viewport edge margin (px)

// ── Hover ──
const HOVER_LIFT       = 4;      // px lift on hover
const HOVER_TZ_BASE    = 15;     // base tz boost on hover
const HOVER_TZ_EDGE    = 35;     // additional tz boost at edges
const HOVER_SC_BASE    = 0.03;   // base scale boost on hover
const HOVER_SC_EDGE    = 0.04;   // additional scale boost at edges
const HOVER_RY_FACTOR  = 0.4;    // fraction of ry to flatten on hover

// ── Zone boundaries ──
const ZONE_CULL        = 2;      // cards beyond half+ZONE_CULL are hidden
const ZONE2_FADE       = 0.5;    // cards beyond half+this get opacity 0
const ZONE2_TZ_EXTRA   = 30;     // extra depth in zone 2

// ── Drag / momentum ──
const MOMENTUM_DECAY   = 0.92;   // velocity decay per reference frame
const FRAME_REF_MS     = 16.67;  // reference frame duration (~60fps)
const DRAG_INTENT_PX   = 5;      // min px to count as drag
const FLING_VEL_MIN    = 0.15;   // min velocity for momentum fling

// ── Animation ──
const STAGGER_DELAY_MS = 50;     // ms between card animations

/** Cubic-bezier evaluator for JS-driven scroll animations. */
function cubicBezierEase(x1, y1, x2, y2) {
    const at = (t, a, b) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
    const dAt = (t, a, b) => 3 * (1 - t) * (1 - t) * a + 6 * (1 - t) * t * (b - a) + 3 * t * t * (1 - b);
    return (progress) => {
        if (progress <= 0) return 0;
        if (progress >= 1) return 1;
        let g = progress;
        for (let i = 0; i < 8; i++) {
            const err = at(g, x1, x2) - progress;
            if (Math.abs(err) < 1e-6) break;
            const d = dAt(g, x1, x2);
            if (Math.abs(d) < 1e-6) break;
            g -= err / d;
        }
        return at(g, y1, y2);
    };
}
const FLIP_EASE = cubicBezierEase(0.4, 0, 0.2, 1);

/** Project the outer edge of a card: perspective(d) rotateY(θ) translateZ(tz) scale(s). */
function projOuterEdge(W, s, tz, thetaRad, d, side) {
    const hw = side * W * s / 2;
    const ct = Math.cos(thetaRad), st = Math.sin(thetaRad);
    const x3 = hw * ct + tz * st;
    const z3 = -hw * st + tz * ct;
    return x3 * d / (d - z3);
}

// ── Helper: read a card element into a plain data object ──

function readCard(el) {
    return {
        key: el.key,
        label: el.label,
        thumbSrc: el.thumbSrc,
        fallbackSrc: el.fallbackSrc,
        deletable: el.deletable,
        data: el.data,
    };
}

// ── Main component ──

class CarouselDropdownBrowser extends HTMLElement {
    static observedAttributes = ['arc-z', 'arc-y', 'flip-duration', 'controls-position', 'infinite', 'bounce', 'expandable', 'card-title', 'debug-show-controls'];

    // ── Configuration ──
    #arcZ = 24;
    #arcY = 38;
    #flipDuration = 1500;
    #controlsPosition = 'above'; // 'above' | 'below'
    #infinite = true;              // wrap around or clamp at edges
    #bounce = 0.35;                // overshoot amount (0 = smooth, 1 = pronounced bounce)
    #expandable = true;            // whether the grid-expand toggle is available
    #debugShowControls = false;     // show debug controls panel
    #animatingExpand = false;       // guard against overlapping expand/collapse
    #isFirstRender = true;          // fade-in on initial load

    // ── Title configuration ──
    // Format: "v-align" or "v-align h-align"
    //   v-align: above | top | center | bottom | below | none (default: none = hidden)
    //   h-align: left | center | right (default: center)
    #cardTitle = 'none';

    // ── Data ──
    #items = [];           // [{ key, label, thumbSrc, fallbackSrc, deletable, data, section, sectionIndex }]
    #selectedKey = null;

    // ── Carousel state ──
    #centerIdx = 0;
    #cards = [];           // [{element, index}]
    #dragJustEnded = false;
    #numCardsVisibleLeft = 0;
    #numCardsVisibleRight = 0;
    #secNavLeft = null;
    #secNavRight = null;

    // ── Drag state ──
    #isDragging = false;
    #dragStartX = 0;
    #dragStartCenter = 0;
    #dragFractionalCenter = 0;
    #lastDragX = 0;
    #lastDragTime = 0;
    #dragVelocity = 0;
    #momentumRaf = null;

    // ── Hover state ──
    #hoverZones = [];      // [{ left, right, element }]
    #hoveredCard = null;   // currently hovered card element
    #zoneTimer = null;     // delay zone computation until transitions settle
    #cardLayout = new Map(); // element → CardLayout (see #computeCardGeometry)
    #lastFrame = null;       // FrameLayout from most recent #computeLayout()
    #isTransitioning = false; // true while cards are animating between positions

    // ── DOM refs ──
    #strip = null;
    #controls = null;
    #container = null;
    #viewport = null;
    #track = null;
    #navLeft = null;
    #navRight = null;
    #toggle = null;
    #dropdown = null;
    #grid = null;
    #flipLayout = null;
    #resizeObs = null;
    #scrollParent = null;
    #scrollRaf = null;
    #flipAnimations = [];  // Web Animations created by #animateCardsWA
    #sectionLabelContainer = null;
    #sectionLabels = [];
    #debugPanel = null;


    // ── MutationObserver ──
    #observer = null;
    #updatePending = false;
    #domBuilt = false;


    // ── Public properties ──

    /** Convenience setter: creates card elements from a flat array (backward compat). */
    get items() { return this.#items; }
    set items(list) {
        const arr = Array.isArray(list) ? list : [];
        // Remove existing data children
        this.#removeDataChildren();
        // Create card elements (no sections — flat list)
        for (const item of arr) {
            const card = document.createElement('carousel-dropdown-browser-card');
            card.key = item.key;
            card.label = item.label;
            card.thumbSrc = item.thumbSrc || '';
            if (item.fallbackSrc) card.fallbackSrc = item.fallbackSrc;
            if (item.deletable) card.deletable = true;
            card.data = item.data;
            this.appendChild(card);
        }
        // MutationObserver will trigger #collectAndRebuild
    }

    get selectedKey() { return this.#selectedKey; }
    set selectedKey(key) {
        this.#selectedKey = key;
        this.#updateActiveHighlight();
    }

    get centerIndex() { return this.#centerIdx; }
    get expanded() { return this.#dropdown?.classList.contains('expanded') ?? false; }

    // ── Public methods ──

    /** Notify parent that child element data changed. Debounced via microtask. */
    requestUpdate() {
        if (this.#updatePending) return;
        this.#updatePending = true;
        queueMicrotask(() => {
            this.#updatePending = false;
            this.#collectAndRebuild();
        });
    }

    /** Remove all data children (card + section elements). */
    clearItems() {
        this.#removeDataChildren();
    }

    syncToKey(key) {
        const idx = this.#items.findIndex(it => it.key === key);
        if (idx >= 0) {
            this.#centerIdx = idx;
            this.#positionCards();
        }
    }

    expand() {
        if (this.expanded || this.#animatingExpand) return;
        this.#animatingExpand = true;

        // Disable controls during animation
        this.#navLeft.disabled = true;
        this.#navRight.disabled = true;
        this.#toggle.disabled = true;
        this.#toggle.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));

        // Animate carousel cards to grid positions via CSS transitions
        // Clear hover/mask state and force-remove any residual masks from images
        this.#resetHoverState();
        for (const { element } of this.#cards) {
            // Suppress all transitions during layout changes
            element.style.transition = 'none';
            const frame = element.querySelector('.cdb-card-frame');
            if (frame) {
                frame.style.transition = 'none';
                frame.style.webkitMaskImage = 'none';
                frame.style.maskImage = 'none';
            }
        }

        const sectionLabelRects = this.#captureSectionLabelRects();
        const dur = this.#flipDuration;
        const easing = 'cubic-bezier(0.4, 0, 0.2, 1)';
        const cardW = this.#readCardW();

        // ── Capture controls position before layout changes ──
        const ctrlBefore = this.#controls.getBoundingClientRect();

        // ── Remove carousel container from layout flow ──
        const containerH = this.#container.getBoundingClientRect().height;
        this.#container.style.transition = 'none';
        this.#container.style.marginBottom = `-${containerH}px`;

        // ── Render grid invisibly, measure target positions ──
        this.#renderGridCards();
        const t = this.#parseTitlePos(this.#cardTitle);
        if (t.vAlign === 'tooltip') this.#applyTooltips(true);
        this.#dropdown.classList.add('expanded', 'cdb-measuring');
        this.#toggle.classList.add('active');
        void this.#grid.offsetHeight;
        this.#dropdown.classList.remove('cdb-measuring');

        // ── FLIP controls to smooth position change ──
        const ctrlAfter = this.#controls.getBoundingClientRect();
        const cdy = ctrlBefore.top - ctrlAfter.top;
        if (Math.abs(cdy) > 1) {
            this.#controls.style.transition = 'none';
            this.#controls.style.transform = `translateY(${cdy}px)`;
            void this.#controls.offsetHeight;
            this.#controls.style.transition = `transform ${dur}ms ${easing}`;
            this.#controls.style.transform = '';
        }

        // Store scroll parent for post-animation scroll
        this.#scrollParent = this.closest('.gallery-main') || this.parentElement;

        const gridCards = this.#grid.querySelectorAll('.cdb-grid-card');
        const gridRects = new Map();
        for (const card of gridCards) {
            gridRects.set(card.dataset.flipKey, card.getBoundingClientRect());
            card.style.opacity = '0';
        }

        // Hide grid headers (will animate in via FLIP)
        const headers = this.#grid.querySelectorAll('.cdb-grid-section-header');
        for (const h of headers) h.style.opacity = '0';

        // ── Prevent viewport clipping during animation ──
        this.#viewport.style.overflow = 'visible';

        // ── Hide carousel section labels (suppress transition to avoid ghost) ──
        for (const sec of this.#sectionLabels) {
            sec.element.style.transition = 'none';
            sec.element.style.opacity = '0';
        }
        this.#sectionLabelContainer.style.opacity = '0';

        // ── Compute track center (cards are positioned relative to this) ──
        const trackRect = this.#track.getBoundingClientRect();
        const trackCX = trackRect.left + trackRect.width / 2;
        const trackCY = trackRect.top + trackRect.height / 2;

        // ── Find edge positions (outermost visible cards) for off-screen emerge ──
        let leftEdge = null, rightEdge = null;
        for (const [, layout] of this.#cardLayout) {
            if (!layout || layout.opacity <= 0) continue;
            if (layout.visualOffset < 0) {
                if (!leftEdge || layout.visualOffset < leftEdge.visualOffset) leftEdge = layout;
            } else if (layout.visualOffset > 0) {
                if (!rightEdge || layout.visualOffset > rightEdge.visualOffset) rightEdge = layout;
            }
        }
        if (!leftEdge) leftEdge = rightEdge;
        if (!rightEdge) rightEdge = leftEdge;

        // ── Position off-screen cards at edge positions (no transition) ──
        const total = this.#items.length;
        const offScreenCards = [];
        if (leftEdge || rightEdge) {
            for (const { element, index } of this.#cards) {
                const layout = this.#cardLayout.get(element);
                if (layout && layout.opacity > 0) continue; // visible card
                if (!gridRects.has(element.dataset.flipKey)) continue; // not in grid

                let offset = index - this.#centerIdx;
                if (this.#infinite && total > 1) {
                    if (offset > total / 2) offset -= total;
                    if (offset < -total / 2) offset += total;
                }

                const edge = offset < 0 ? leftEdge : rightEdge;
                if (!edge) continue;

                element.style.transition = 'none';
                const img = element.querySelector('.cdb-card-frame');
                if (img) img.style.transition = 'none';

                this.#applyCardStyle(element, { ...edge, opacity: 0 });
                element.style.zIndex = '0';

                offScreenCards.push({ element, index, offset });
            }
        }

        // ── Sort visible cards by distance from center for cascade stagger ──
        const staggerDelay = STAGGER_DELAY_MS; // ms per rank
        const sorted = [...this.#cards]
            .map(c => ({ ...c, layout: this.#cardLayout.get(c.element) }))
            .filter(c => c.layout && c.layout.opacity > 0)
            .sort((a, b) => Math.abs(a.layout.visualOffset) - Math.abs(b.layout.visualOffset));

        const maxVisibleDelay = sorted.length > 0 ? (sorted.length - 1) * staggerDelay : 0;
        const offScreenBaseDelay = Math.min(sorted.length, 3) * staggerDelay;

        // ── Precompute targets ──
        const visibleTargets = [];
        for (let i = 0; i < sorted.length; i++) {
            const { element } = sorted[i];
            const key = element.dataset.flipKey;
            const gridRect = gridRects.get(key);
            if (!gridRect) continue;
            const gridCX = gridRect.left + gridRect.width / 2;
            const gridCY = gridRect.top + gridRect.height / 2;
            visibleTargets.push({
                element,
                img: element.querySelector('.cdb-card-frame'),
                cx: gridCX - trackCX,
                cy: gridCY - trackCY,
                sc: gridRect.width / cardW,
                delay: i * staggerDelay
            });
        }
        const offScreenTargets = [];
        for (const { element } of offScreenCards) {
            const key = element.dataset.flipKey;
            const gridRect = gridRects.get(key);
            if (!gridRect) continue;
            const gridCX = gridRect.left + gridRect.width / 2;
            const gridCY = gridRect.top + gridRect.height / 2;
            offScreenTargets.push({
                element,
                img: element.querySelector('.cdb-card-frame'),
                cx: gridCX - trackCX,
                cy: gridCY - trackCY,
                sc: gridRect.width / cardW
            });
        }

        // ── Animate cards to grid positions via Web Animations API ──
        // Explicit from/to keyframes — no reflow timing dependency.
        const waTargets = [];
        for (const t of visibleTargets) {
            const from = this.#readCardFromState(t.element);
            waTargets.push({
                element: t.element, img: t.img,
                fromCx: from.cx, fromCy: from.cy, fromRy: from.ry, fromRx: from.rx,
                fromTz: from.tz, fromSc: from.sc, fromOpacity: from.opacity,
                toCx: t.cx, toCy: t.cy, toRy: 0, toRx: 0, toTz: 0, toSc: t.sc, toOpacity: 1,
                duration: dur, delay: t.delay, easing,
            });
        }
        for (const t of offScreenTargets) {
            const from = this.#readCardFromState(t.element);
            waTargets.push({
                element: t.element, img: t.img,
                fromCx: from.cx, fromCy: from.cy, fromRy: from.ry,
                fromTz: from.tz, fromSc: from.sc, fromOpacity: 0,
                toCx: t.cx, toCy: t.cy, toRy: 0, toTz: 0, toSc: t.sc, toOpacity: 1,
                duration: dur, delay: offScreenBaseDelay, easing,
                opacityDuration: Math.round(dur * 0.6), opacityEasing: 'ease',
            });
        }
        this.#animateCardsWA(waTargets);

        // Fade out carousel titles during expand
        for (const { element } of this.#cards) {
            const title = element.querySelector('.cdb-card-title');
            if (title) {
                this.#flipAnimations.push(title.animate(
                    [{ opacity: 1 }, { opacity: 0 }],
                    { duration: dur * 0.3, easing: 'ease-in', fill: 'both' }
                ));
            }
        }

        const totalDur = Math.max(dur + maxVisibleDelay,
            offScreenCards.length > 0 ? dur + offScreenBaseDelay : 0);

        // ── Cross-fade: fade grid cards in near the end of animation ──
        // Grid cards start hidden, then fade in just before cleanup so the
        // swap from carousel cards to grid cards is imperceptible.
        const crossFadeDur = 300;
        const crossFadeDelay = Math.max(0, totalDur - crossFadeDur);
        for (const card of gridCards) {
            card.style.transition = `opacity ${crossFadeDur}ms ease`;
        }
        setTimeout(() => {
            for (const card of gridCards) card.style.opacity = '';
        }, crossFadeDelay);

        // ── Section headers: FLIP-translate from carousel label positions ──
        let headerSecIdx = 0;
        for (const h of headers) {
            const item = this.#items.find(it => it.section === h.textContent && it.sectionIndex >= headerSecIdx);
            if (!item) continue;
            const secLabel = sectionLabelRects.get(item.sectionIndex);
            const headerRect = h.getBoundingClientRect();
            if (secLabel) {
                const dy = secLabel.rect.top - headerRect.top;
                const dx = secLabel.rect.left - headerRect.left;
                h.style.transform = `translate(${dx}px, ${dy}px)`;
                h.style.opacity = '1';
                void h.offsetHeight;
                h.style.transition = `transform ${dur}ms ${easing}`;
                h.style.transform = '';
            } else {
                // No matching carousel label — emerge from the carousel edge
                const secItems = this.#items.filter(it => it.sectionIndex === item.sectionIndex);
                const avgOffset = secItems.reduce((sum, it) => {
                    const idx = this.#items.indexOf(it);
                    let off = idx - this.#centerIdx;
                    if (this.#infinite && total > 1) {
                        if (off > total / 2) off -= total;
                        if (off < -total / 2) off += total;
                    }
                    return sum + off;
                }, 0) / (secItems.length || 1);
                const edge = avgOffset < 0 ? leftEdge : rightEdge;
                if (edge) {
                    const edgeX = trackCX + edge.cx;
                    const edgeY = trackCY + edge.cy;
                    const dx = edgeX - headerRect.left;
                    const dy = edgeY - headerRect.top;
                    h.style.transform = `translate(${dx}px, ${dy}px)`;
                    h.style.opacity = '0';
                    void h.offsetHeight;
                    h.style.transition = `transform ${dur}ms ${easing}, opacity ${Math.round(dur * 0.4)}ms ease`;
                    h.style.transform = '';
                    h.style.opacity = '1';
                } else {
                    h.animate([{ opacity: 0 }, { opacity: 1 }], {
                        duration: dur * 0.3, delay: dur * 0.75, fill: 'both'
                    });
                }
            }
            headerSecIdx = item.sectionIndex + 1;
        }

        // Card name overlays fade in
        this.#animateGridNamesIn(totalDur);

        // ── Synchronized scroll: follow cards as they fly to grid positions ──
        if (this.#scrollParent && this.#scrollParent.scrollHeight > this.#scrollParent.clientHeight) {
            const dropdownBottom = this.#dropdown.getBoundingClientRect().bottom;
            const parentRect = this.#scrollParent.getBoundingClientRect();
            const overflow = dropdownBottom - parentRect.bottom;
            if (overflow > 0) {
                this.#animateScroll(this.#scrollParent.scrollTop + overflow, totalDur);
            }
        }

        // ── Cleanup after all animations complete ──
        setTimeout(() => {
            // Cancel Web Animations — CSS custom properties already hold targets
            this.#cancelFlipAnimations();

            // Suppress transitions before flattenCards changes custom properties
            for (const { element } of this.#cards) {
                element.style.transition = 'none';
                const img = element.querySelector('.cdb-card-frame');
                if (img) img.style.transition = 'none';
            }
            this.#sectionLabelContainer.style.transition = 'none';

            // Show grid cards, flatten carousel
            for (const card of gridCards) card.style.opacity = '';
            this.#flattenCards();
            this.#container.style.marginBottom = '';
            this.#viewport.style.overflow = '';

            // Force reflow so all changes apply in one paint
            void this.#strip.offsetHeight;

            // Re-enable transitions
            this.#container.style.transition = '';
            this.#sectionLabelContainer.style.transition = '';
            for (const { element } of this.#cards) {
                element.style.transition = '';
                const img = element.querySelector('.cdb-card-frame');
                if (img) img.style.transition = '';
            }
            this.#cleanupGridAnimationStyles();

            // Clear inline mask overrides so CSS masks work normally again
            for (const { element } of this.#cards) {
                const frame = element.querySelector('.cdb-card-frame');
                if (frame) {
                    frame.style.webkitMaskImage = '';
                    frame.style.maskImage = '';
                }
            }

            // Clear controls FLIP styles and re-enable
            this.#controls.style.transition = '';
            this.#controls.style.transform = '';
            this.#navLeft.disabled = false;
            this.#navRight.disabled = false;
            this.#toggle.disabled = false;
            this.#toggle.setAttribute('data-tooltip', 'Collapse');
            if (this.#toggle.matches(':hover')) {
                const r = this.#toggle.getBoundingClientRect();
                this.#toggle.dispatchEvent(new MouseEvent('mouseover', {
                    bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
                }));
            }

            this.#animatingExpand = false;
            this.dispatchEvent(new CustomEvent('expand-change', { detail: { expanded: true } }));
        }, totalDur + 50);
    }

    async collapse() {
        if (!this.expanded || this.#animatingExpand) return;
        this.#animatingExpand = true;

        // Disable controls during animation
        this.#navLeft.disabled = true;
        this.#navRight.disabled = true;
        this.#toggle.disabled = true;
        this.#toggle.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));

        const dur = this.#flipDuration;
        const easing = 'cubic-bezier(0.4, 0, 0.2, 1)';
        const cardW = this.#readCardW();

        // Center on the selected item when collapsing
        if (this.#selectedKey) {
            const idx = this.#items.findIndex(it => it.key === this.#selectedKey);
            if (idx >= 0) this.#centerIdx = idx;
        }

        // Capture grid card positions while grid is still visible
        const gridCards = this.#grid.querySelectorAll('.cdb-grid-card');
        const gridRects = new Map();
        for (const card of gridCards) {
            gridRects.set(card.dataset.flipKey, card.getBoundingClientRect());
        }

        // Fade out card names
        this.#animateGridNamesOut(dur);

        const headers = this.#grid.querySelectorAll('.cdb-grid-section-header');
        const cardDelay = Math.round(dur * 0.15);

        await new Promise(resolve => {
            setTimeout(() => {
                // ── Suppress all transitions ──
                for (const { element } of this.#cards) {
                    element.style.transition = 'none';
                    const img = element.querySelector('.cdb-card-frame');
                    if (img) img.style.transition = 'none';
                }
                this.#container.style.transition = 'none';
                this.#sectionLabelContainer.style.transition = 'none';
                // Hide real labels — phantoms will handle visibility
                for (const sec of this.#sectionLabels) {
                    sec.element.style.transition = 'none';
                    sec.element.style.opacity = '0';
                }

                // ── Capture grid header rects while still at original positions ──
                const gridHeaderRects = this.#captureGridHeaderRects();

                // ── Hide grid content BEFORE un-flatten to prevent visible shift ──
                this.#dropdown.style.transition = 'none';
                for (const card of gridCards) card.style.opacity = '0';
                this.#dropdown.style.opacity = '0';
                this.#dropdown.style.pointerEvents = 'none';
                for (const h of headers) h.style.opacity = '0';
                this.#toggle.classList.remove('active');

                // ── Capture controls position before un-flatten ──
                const ctrlBefore = this.#controls.getBoundingClientRect();

                // ── Un-flatten carousel (invisible — grid already hidden) ──
                this.#strip.classList.remove('cdb-flattened');

                // ── Position carousel cards at grid positions ──
                const trackRect = this.#track.getBoundingClientRect();
                const trackCX = trackRect.left + trackRect.width / 2;
                const trackCY = trackRect.top + trackRect.height / 2;

                // Position off-screen cards at grid positions (for "from" state)
                for (const { element } of this.#cards) {
                    const key = element.dataset.flipKey;
                    const gridRect = gridRects.get(key);
                    if (!gridRect) {
                        element.style.setProperty('--card-opacity', '0');
                        continue;
                    }
                    const gridCX = gridRect.left + gridRect.width / 2;
                    const gridCY = gridRect.top + gridRect.height / 2;
                    element.style.setProperty('--cx', (gridCX - trackCX) + 'px');
                    element.style.setProperty('--cy', (gridCY - trackCY) + 'px');
                    element.style.setProperty('--ry', '0deg');
                    element.style.setProperty('--tz', '0px');
                    element.style.setProperty('--sc', String(gridRect.width / cardW));
                    // Leave --card-opacity at 0 — Web Animation fill:'both' handles
                    // opacity, keeping cards invisible until animation starts.
                    element.style.zIndex = '5';
                }

                this.#viewport.style.overflow = 'visible';

                // ── FLIP controls to smooth position change ──
                const ctrlAfter = this.#controls.getBoundingClientRect();
                const cdy = ctrlBefore.top - ctrlAfter.top;
                if (Math.abs(cdy) > 1) {
                    this.#controls.style.transition = 'none';
                    this.#controls.style.transform = `translateY(${cdy}px)`;
                    void this.#controls.offsetHeight;
                    this.#controls.style.transition = `transform ${dur}ms ${easing}`;
                    this.#controls.style.transform = '';
                }

                // ── Compute carousel target layout ──
                const frame = this.#computeLayout();

                // ── Section label morph ──
                const visibleSections = this.#applySectionLabels(frame, true);
                const sectionLabelRects = this.#captureSectionLabelRects(visibleSections);
                const sectionPhantoms = this.#morphSectionLabels(gridHeaderRects, sectionLabelRects, dur, easing);

                // ── Find edge positions for off-screen cards ──
                let leftEdge = null, rightEdge = null;
                for (const [, layout] of this.#cardLayout) {
                    if (!layout || layout.opacity <= 0) continue;
                    if (layout.visualOffset < 0) {
                        if (!leftEdge || layout.visualOffset < leftEdge.visualOffset) leftEdge = layout;
                    } else if (layout.visualOffset > 0) {
                        if (!rightEdge || layout.visualOffset > rightEdge.visualOffset) rightEdge = layout;
                    }
                }
                if (!leftEdge) leftEdge = rightEdge;
                if (!rightEdge) rightEdge = leftEdge;

                // ── Animate cards to carousel positions via Web Animations API ──
                const total = this.#items.length;
                const staggerDelay = STAGGER_DELAY_MS;
                const sorted = [...this.#cards]
                    .map(c => ({ ...c, layout: this.#cardLayout.get(c.element) }))
                    .filter(c => c.layout && c.layout.opacity > 0 && gridRects.has(c.element.dataset.flipKey))
                    .sort((a, b) => Math.abs(a.layout.visualOffset) - Math.abs(b.layout.visualOffset));

                const maxVisibleDelay = sorted.length > 0 ? (sorted.length - 1) * staggerDelay : 0;

                const waTargets = [];
                for (let i = 0; i < sorted.length; i++) {
                    const { element, layout } = sorted[i];
                    const from = this.#readCardFromState(element);
                    waTargets.push({
                        element, img: element.querySelector('.cdb-card-frame'),
                        fromCx: from.cx, fromCy: from.cy, fromRy: from.ry, fromRx: from.rx,
                        fromTz: from.tz, fromSc: from.sc, fromOpacity: 1,
                        toCx: layout.cx, toCy: layout.cy, toRy: layout.ry, toRx: layout.rx,
                        toTz: layout.tz, toSc: layout.sc, toOpacity: layout.opacity,
                        duration: dur, delay: i * staggerDelay, easing,
                    });
                    element.style.zIndex = String(layout.zIndex);
                }

                // Off-screen cards: grid → edge position + fade out
                const offScreenBaseDelay = Math.min(sorted.length, 3) * staggerDelay;
                for (const { element, index } of this.#cards) {
                    const layout = this.#cardLayout.get(element);
                    if (layout && layout.opacity > 0) continue;
                    if (!gridRects.has(element.dataset.flipKey)) continue;

                    let offset = index - this.#centerIdx;
                    if (this.#infinite && total > 1) {
                        if (offset > total / 2) offset -= total;
                        if (offset < -total / 2) offset += total;
                    }
                    const edge = offset < 0 ? leftEdge : rightEdge;
                    if (!edge) continue;

                    const from = this.#readCardFromState(element);
                    waTargets.push({
                        element, img: element.querySelector('.cdb-card-frame'),
                        fromCx: from.cx, fromCy: from.cy, fromRy: from.ry, fromRx: from.rx,
                        fromTz: from.tz, fromSc: from.sc, fromOpacity: 1,
                        toCx: edge.cx, toCy: edge.cy, toRy: edge.ry, toRx: edge.rx,
                        toTz: edge.tz, toSc: edge.sc, toOpacity: 0,
                        duration: dur, delay: offScreenBaseDelay, easing,
                        opacityDuration: Math.round(dur * 0.6), opacityEasing: 'ease',
                    });
                    element.style.zIndex = '0';
                }
                this.#animateCardsWA(waTargets);

                // Fade in carousel titles during collapse
                for (const { element } of this.#cards) {
                    const title = element.querySelector('.cdb-card-title');
                    if (title) {
                        this.#flipAnimations.push(title.animate(
                            [{ opacity: 0 }, { opacity: 1 }],
                            { duration: dur * 0.4, delay: dur * 0.5, easing: 'ease-out', fill: 'both' }
                        ));
                    }
                }

                const totalDur = Math.max(dur + maxVisibleDelay, dur + offScreenBaseDelay);

                // ── Synchronized scroll: scroll to post-collapse position during animation ──
                this.#scrollParent = this.closest('.gallery-main') || this.parentElement;
                if (this.#scrollParent) {
                    const componentRect = this.getBoundingClientRect();
                    const parentRect = this.#scrollParent.getBoundingClientRect();
                    const above = parentRect.top - componentRect.top;
                    const dropdownH = this.#dropdown.getBoundingClientRect().height;
                    // Scroll up if component is above viewport, otherwise hold position
                    const rawTarget = above > 0
                        ? this.#scrollParent.scrollTop - above
                        : this.#scrollParent.scrollTop;
                    // Clamp to future max (after dropdown height disappears)
                    const futureMaxScroll = Math.max(0,
                        (this.#scrollParent.scrollHeight - dropdownH) - this.#scrollParent.clientHeight);
                    this.#animateScroll(Math.min(rawTarget, futureMaxScroll), totalDur);
                }

                // ── Cleanup after animation ──
                setTimeout(() => {
                    this.#cancelFlipAnimations();
                    for (const { element } of this.#cards) {
                        element.style.transition = '';
                        const img = element.querySelector('.cdb-card-frame');
                        if (img) img.style.transition = '';
                    }
                    this.#container.style.transition = '';
                    this.#sectionLabelContainer.style.transition = '';
                    this.#viewport.style.overflow = '';
                    // Suppress label transitions, clear container opacity
                    for (const sec of this.#sectionLabels) {
                        sec.element.style.transition = 'none';
                    }
                    this.#sectionLabelContainer.style.opacity = '';
                    void this.#sectionLabelContainer.offsetHeight;

                    // ── Collapse dropdown — compensate scroll for layout shift ──
                    const ctrlBefore2 = this.#controls.getBoundingClientRect();
                    const lblBefore2 = this.#sectionLabelContainer.getBoundingClientRect();
                    const scrollParent = this.closest('.gallery-main') || this.parentElement;
                    const scrollBefore = scrollParent ? scrollParent.scrollTop : 0;
                    const rectBefore = this.getBoundingClientRect();

                    this.#dropdown.style.transition = '';
                    this.#dropdown.style.opacity = '';
                    this.#dropdown.style.pointerEvents = '';
                    this.#dropdown.classList.add('cdb-measuring');
                    this.#dropdown.classList.remove('expanded');
                    void this.#dropdown.offsetHeight;
                    this.#dropdown.classList.remove('cdb-measuring');

                    // Compensate for any residual layout shift from dropdown collapse
                    if (scrollParent) {
                        const rectAfter = this.getBoundingClientRect();
                        const layoutShift = rectBefore.top - rectAfter.top;
                        if (Math.abs(layoutShift) > 1) {
                            scrollParent.scrollTop = scrollBefore - layoutShift;
                        }
                    }

                    // FLIP controls for dropdown collapse shift
                    const ctrlAfter2 = this.#controls.getBoundingClientRect();
                    const cdy2 = ctrlBefore2.top - ctrlAfter2.top;
                    if (Math.abs(cdy2) > 1) {
                        this.#controls.style.transition = 'none';
                        this.#controls.style.transform = `translateY(${cdy2}px)`;
                        void this.#controls.offsetHeight;
                        this.#controls.style.transition = 'transform 0.3s ease';
                        this.#controls.style.transform = '';
                    }

                    // FLIP section label container for dropdown collapse shift
                    const lblAfter2 = this.#sectionLabelContainer.getBoundingClientRect();
                    const lblDy = lblBefore2.top - lblAfter2.top;
                    if (Math.abs(lblDy) > 1) {
                        this.#sectionLabelContainer.style.transition = 'none';
                        this.#sectionLabelContainer.style.transform = `translateY(${lblDy}px)`;
                        void this.#sectionLabelContainer.offsetHeight;
                        this.#sectionLabelContainer.style.transition = 'transform 0.3s ease';
                        this.#sectionLabelContainer.style.transform = '';
                    }

                    // Position cards but keep labels hidden — phantoms still active during FLIP
                    this.#positionCards();
                    for (const sec of this.#sectionLabels) {
                        sec.element.style.opacity = '0';
                    }

                    // Clear FLIP styles, remove phantoms, reveal labels AFTER FLIP completes
                    setTimeout(() => {
                        this.#controls.style.transition = '';
                        this.#controls.style.transform = '';
                        this.#sectionLabelContainer.style.transition = '';
                        this.#sectionLabelContainer.style.transform = '';
                        // Remove phantoms, then reveal real labels at final positions
                        for (const o of sectionPhantoms) o.remove();
                        this.#positionCards();
                        for (const sec of this.#sectionLabels) {
                            sec.element.style.transition = '';
                        }
                    }, 350);
                    this.#toggle.disabled = false;
                    this.#toggle.setAttribute('data-tooltip', 'Expand');
                    if (this.#toggle.matches(':hover')) {
                        const r = this.#toggle.getBoundingClientRect();
                        this.#toggle.dispatchEvent(new MouseEvent('mouseover', {
                            bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
                        }));
                    }

                    resolve();
                }, totalDur + 50);
            }, cardDelay);
        });

        this.#animatingExpand = false;
        this.dispatchEvent(new CustomEvent('expand-change', { detail: { expanded: false } }));
    }

    toggle() {
        if (this.expanded) this.collapse();
        else this.expand();
    }

    // ── Attributes ──

    attributeChangedCallback(name, _old, val) {
        if (name === 'arc-z') { this.#arcZ = Math.round(parseFloat(val)) || 24; if (this.#domBuilt) this.#positionCards(); }
        if (name === 'arc-y') { this.#arcY = parseFloat(val) ?? 38; this.#syncArcYExtra(); if (this.#domBuilt) this.#positionCards(); }
        if (name === 'flip-duration') this.#flipDuration = parseInt(val, 10) || 450;
        if (name === 'controls-position') {
            this.#controlsPosition = val === 'below' ? 'below' : 'above';
            this.#appendStripChildren();
        }
        if (name === 'infinite') {
            this.#infinite = val !== null && val !== 'false';
        }
        if (name === 'bounce') {
            this.#bounce = Math.max(0, Math.min(1, parseFloat(val) || 0.35));
            this.#updateEasing();
        }
        if (name === 'expandable') {
            this.#expandable = val !== 'false';
            this.#updateToggleVisibility();
        }
        if (name === 'card-title') {
            this.#cardTitle = val || 'none';
            this.#applyTitleClasses();
        }
        if (name === 'debug-show-controls') {
            this.#debugShowControls = val !== null && val !== 'false';
            if (this.#debugPanel) this.#debugPanel.style.display = this.#debugShowControls ? '' : 'none';
        }
    }

    /**
     * Parse a title position string into { vAlign, hAlign, visible }.
     * Format: "vAlign" or "vAlign hAlign"
     *   vAlign: above | top | center | bottom | below | none
     *   hAlign: left | center | right
     */
    #parseTitlePos(pos) {
        if (!pos || pos === 'none') return { visible: false, vAlign: 'none', hAlign: 'center' };
        const parts = pos.trim().split(/\s+/);
        const vAlign = parts[0] || 'below';
        const hAlign = parts[1] || 'center';
        return { visible: true, vAlign, hAlign };
    }

    /** Apply CSS classes to host element for carousel/grid title position. */
    #applyTitleClasses() {
        // Remove all previous title classes
        for (const cls of [...this.classList]) {
            if (cls.startsWith('cdb-t-')) this.classList.remove(cls);
        }
        const t = this.#parseTitlePos(this.#cardTitle);
        if (t.visible) {
            this.classList.add(`cdb-t-${t.vAlign}`, `cdb-t-h-${t.hAlign}`);
        }
        this.#applyTooltips(t.vAlign === 'tooltip');
    }

    /** Set or clear data-tooltip on card elements for tooltip title mode. */
    #applyTooltips(enable) {
        for (const card of this.#track?.querySelectorAll('.cdb-card') ?? []) {
            const frame = card.querySelector('.cdb-card-frame');
            const title = card.querySelector('.cdb-card-title');
            if (enable && frame && title) {
                frame.setAttribute('data-tooltip', title.textContent);
                frame.setAttribute('data-tooltip-pos', 'above');
            } else if (frame) {
                frame.removeAttribute('data-tooltip');
                frame.removeAttribute('data-tooltip-pos');
            }
        }
        for (const card of this.#grid?.querySelectorAll('.cdb-grid-card') ?? []) {
            const name = card.querySelector('.cdb-grid-card-name');
            if (enable && name) {
                card.setAttribute('data-tooltip', name.textContent);
                card.setAttribute('data-tooltip-pos', 'above');
            } else {
                card.removeAttribute('data-tooltip');
                card.removeAttribute('data-tooltip-pos');
            }
        }
    }

    /** Compute cubic-bezier from bounce parameter and set CSS custom properties. */
    #syncArcYExtra() {
        this.style.setProperty('--arc-y-extra', Math.abs(this.#arcY) + 'px');
    }

    #updateEasing() {
        const b = this.#bounce;
        // bounce=0: cubic-bezier(0.25, 0.1, 0.25, 1) — smooth, no overshoot
        // bounce=1: cubic-bezier(0.34, 1.56, 0.64, 1) — pronounced overshoot
        const p1x = (0.25 + 0.09 * b).toFixed(3);
        const p1y = (0.1 + 1.46 * b).toFixed(3);
        const p2x = (0.25 + 0.39 * b).toFixed(3);
        const easing = `cubic-bezier(${p1x}, ${p1y}, ${p2x}, 1)`;
        this.style.setProperty('--cdb-easing', easing);
        // Labels get a smoother version (half the overshoot) so they don't jitter
        const lp1y = (0.1 + 0.73 * b).toFixed(3);
        const labelEasing = `cubic-bezier(${p1x}, ${lp1y}, ${p2x}, 1)`;
        this.style.setProperty('--cdb-label-easing', labelEasing);
    }

    // ── Lifecycle ──

    connectedCallback() {
        if (!this.#domBuilt) {
            this.#buildDOM();
            this.#domBuilt = true;
        }
        this.#updateEasing();
        this.#syncArcYExtra();
        this.#applyTitleClasses();
        this.#attachResizeObserver();
        this.#attachMutationObserver();
        // Collect any data children already present
        this.#collectAndRebuild();
    }

    disconnectedCallback() {
        this.#cancelFlipAnimations();
        if (this.#scrollRaf) { cancelAnimationFrame(this.#scrollRaf); this.#scrollRaf = null; }
        if (this.#resizeObs) {
            this.#resizeObs.disconnect();
            this.#resizeObs = null;
        }
        if (this.#observer) {
            this.#observer.disconnect();
            this.#observer = null;
        }
    }

    // ── Data collection from child elements ──

    #collectItems() {
        const items = [];
        let sectionIndex = -1;
        for (const child of this.children) {
            if (child.matches?.('carousel-dropdown-browser-section')) {
                sectionIndex++;
                const sectionLabel = child.label || '';
                for (const card of child.querySelectorAll('carousel-dropdown-browser-card')) {
                    items.push({ ...readCard(card), section: sectionLabel, sectionIndex });
                }
            } else if (child.matches?.('carousel-dropdown-browser-card')) {
                items.push({ ...readCard(child), section: null, sectionIndex: -1 });
            }
        }
        return items;
    }

    #collectAndRebuild() {
        this.#items = this.#collectItems();
        this.#rebuild();
    }

    #removeDataChildren() {
        const dataEls = this.querySelectorAll('carousel-dropdown-browser-card, carousel-dropdown-browser-section');
        for (const el of dataEls) el.remove();
    }

    // ── MutationObserver ──

    #attachMutationObserver() {
        if (this.#observer) return;
        this.#observer = new MutationObserver((mutations) => this.#onMutation(mutations));
        this.#observer.observe(this, { childList: true, subtree: true });
    }

    #onMutation(mutations) {
        for (const m of mutations) {
            for (const n of [...m.addedNodes, ...m.removedNodes]) {
                if (n.nodeType === 1 && (
                    n.matches?.('carousel-dropdown-browser-card') ||
                    n.matches?.('carousel-dropdown-browser-section')
                )) {
                    this.requestUpdate();
                    return;
                }
            }
        }
    }

    // ── DOM construction (createElement, preserves data children) ──

    #buildDOM() {
        // Strip
        this.#strip = document.createElement('div');
        this.#strip.className = 'cdb-strip';

        // Controls
        this.#controls = document.createElement('div');
        this.#controls.className = 'cdb-controls';

        this.#navLeft = document.createElement('button');
        this.#navLeft.className = 'gallery-arrow cdb-arrow cdb-arrow-left';
        this.#navLeft.setAttribute('aria-label', 'Previous');
        this.#navLeft.setAttribute('data-tooltip', 'Scroll left');
        this.#navLeft.innerHTML = ARROW_LEFT;

        this.#toggle = document.createElement('button');
        this.#toggle.className = 'cdb-toggle';
        this.#toggle.style.display = 'none';
        this.#toggle.setAttribute('aria-label', 'View all');
        this.#toggle.setAttribute('data-tooltip', 'Expand');
        this.#toggle.innerHTML = '<span class="cdb-chevron"><span class="cdb-chevron-bar cdb-chevron-l"></span><span class="cdb-chevron-bar cdb-chevron-r"></span></span>';

        this.#navRight = document.createElement('button');
        this.#navRight.className = 'gallery-arrow cdb-arrow cdb-arrow-right';
        this.#navRight.setAttribute('aria-label', 'Next');
        this.#navRight.setAttribute('data-tooltip', 'Scroll right');
        this.#navRight.innerHTML = ARROW_RIGHT;

        this.#secNavLeft = document.createElement('button');
        this.#secNavLeft.className = 'gallery-arrow cdb-arrow cdb-sec-arrow';
        this.#secNavLeft.setAttribute('aria-label', 'Previous section');
        this.#secNavLeft.setAttribute('data-tooltip', 'Scroll (previous section)');
        this.#secNavLeft.textContent = '\u00AB';

        this.#secNavRight = document.createElement('button');
        this.#secNavRight.className = 'gallery-arrow cdb-arrow cdb-sec-arrow';
        this.#secNavRight.setAttribute('aria-label', 'Next section');
        this.#secNavRight.setAttribute('data-tooltip', 'Scroll (next section)');
        this.#secNavRight.textContent = '\u00BB';

        this.#controls.appendChild(this.#secNavLeft);
        this.#controls.appendChild(this.#navLeft);
        this.#controls.appendChild(this.#toggle);
        this.#controls.appendChild(this.#navRight);
        this.#controls.appendChild(this.#secNavRight);

        // Container > Viewport > Track
        this.#container = document.createElement('div');
        this.#container.className = 'cdb-container';

        this.#viewport = document.createElement('div');
        this.#viewport.className = 'cdb-viewport';

        this.#track = document.createElement('div');
        this.#track.className = 'cdb-track';

        this.#track.addEventListener('mousemove', (e) => this.#onTrackMouseMove(e));
        this.#track.addEventListener('mouseleave', () => this.#onTrackMouseLeave());
        this.#track.addEventListener('click', (e) => this.#onTrackClick(e));
        this.#track.addEventListener('transitionend', (e) => {
            if (this.#animatingExpand) return;
            if (e.target.classList?.contains('cdb-card') && e.propertyName === 'transform') {
                this.#isTransitioning = false;
                this.#track.classList.remove('cdb-transitioning');
                clearTimeout(this.#zoneTimer);
                this.#computeHoverZones();
            }
        });

        this.#viewport.appendChild(this.#track);
        // Section label container (per-section scrolling labels above track)
        this.#sectionLabelContainer = document.createElement('div');
        this.#sectionLabelContainer.className = 'cdb-section-label-container';

        this.#container.appendChild(this.#sectionLabelContainer);
        this.#container.appendChild(this.#viewport);

        // Dropdown
        this.#dropdown = document.createElement('div');
        this.#dropdown.className = 'cdb-dropdown';

        this.#flipLayout = document.createElement('flip-layout');

        this.#grid = document.createElement('div');
        this.#grid.className = 'cdb-grid';

        this.#flipLayout.appendChild(this.#grid);
        this.#dropdown.appendChild(this.#flipLayout);

        // Debug controls panel (only visible with debug-show-controls attribute)
        this.#debugPanel = document.createElement('div');
        this.#debugPanel.className = 'cdb-debug-controls';
        this.#debugPanel.style.display = this.#debugShowControls ? '' : 'none';

        const mkLabel = (text, input) => {
            const lbl = document.createElement('label');
            lbl.textContent = text + ' ';
            lbl.appendChild(input);
            return lbl;
        };

        // Controls position select
        const posSelect = document.createElement('select');
        for (const v of ['above', 'below']) {
            const opt = document.createElement('option');
            opt.value = v; opt.textContent = v.charAt(0).toUpperCase() + v.slice(1);
            if (v === this.#controlsPosition) opt.selected = true;
            posSelect.appendChild(opt);
        }
        posSelect.addEventListener('change', () => {
            this.#controlsPosition = posSelect.value === 'below' ? 'below' : 'above';
            this.#appendStripChildren();
        });
        this.#debugPanel.appendChild(mkLabel('Buttons:', posSelect));

        // Infinite checkbox
        const infCheck = document.createElement('input');
        infCheck.type = 'checkbox';
        infCheck.checked = this.#infinite;
        infCheck.addEventListener('change', () => { this.#infinite = infCheck.checked; });
        this.#debugPanel.appendChild(mkLabel('Infinite', infCheck));

        // Number input helper
        const mkNum = (value, min, max, step, onInput) => {
            const inp = document.createElement('input');
            inp.type = 'number'; inp.min = min; inp.max = max; inp.step = step;
            inp.value = value;
            inp.addEventListener('input', () => {
                const v = parseFloat(inp.value);
                if (isNaN(v)) return;
                onInput(Math.max(parseFloat(min), Math.min(parseFloat(max), v)));
            });
            inp.addEventListener('change', () => {
                const v = parseFloat(inp.value);
                if (isNaN(v)) { inp.value = value; return; }
                const clamped = Math.max(parseFloat(min), Math.min(parseFloat(max), v));
                inp.value = clamped;
            });
            return inp;
        };

        // Arc-Z
        this.#debugPanel.appendChild(mkLabel('Arc-Z:', mkNum(this.#arcZ, '0', '50', '1', (v) => {
            this.#arcZ = v;
            if (this.#domBuilt) this.#positionCards();
        })));

        // Arc-Y
        this.#debugPanel.appendChild(mkLabel('Arc-Y:', mkNum(this.#arcY, '-50', '50', '1', (v) => {
            this.#arcY = v;
            this.#syncArcYExtra();
            if (this.#domBuilt) this.#positionCards();
        })));

        // Bounce
        this.#debugPanel.appendChild(mkLabel('Bounce:', mkNum(this.#bounce, '0', '1', '0.05', (v) => {
            this.#bounce = v;
            this.#updateEasing();
        })));

        // Select helper
        const mkSelect = (options, selected, onChange) => {
            const sel = document.createElement('select');
            for (const [val, text] of options) {
                const opt = document.createElement('option');
                opt.value = val; opt.textContent = text;
                if (val === selected) opt.selected = true;
                sel.appendChild(opt);
            }
            sel.addEventListener('change', onChange);
            return sel;
        };

        // Title controls
        const titleOpts = [['none','None'],['above','Above'],['top','Top'],['center','Center'],['bottom','Bottom'],['below','Below'],['tooltip','Tooltip']];
        const alignOpts = [['left','Left'],['center','Center'],['right','Right']];

        const titleSel = mkSelect(titleOpts, 'none', () => updateTitles());
        const titleAlignSel = mkSelect(alignOpts, 'center', () => updateTitles());

        const updateTitles = () => {
            const hAlign = titleAlignSel.value;
            const v = titleSel.value;
            this.setAttribute('card-title', v === 'none' ? 'none' : `${v} ${hAlign}`);
        };

        this.#debugPanel.appendChild(mkLabel('Card title:', titleSel));
        this.#debugPanel.appendChild(mkLabel('Title align:', titleAlignSel));

        // Append rendered DOM — dropdown inside strip so controls-position="below" flows smoothly
        this.#appendStripChildren();
        this.appendChild(this.#strip);

        this.#toggle.addEventListener('click', () => this.toggle());

        // Event setup (once — never re-attached on rebuild)
        this.#setupDrag();
        this.#setupArrow(this.#navLeft, 1);
        this.#setupArrow(this.#navRight, -1);
        this.#setupSectionArrow(this.#secNavLeft, -1);
        this.#setupSectionArrow(this.#secNavRight, 1);
        this.#track.addEventListener('dragstart', (e) => e.preventDefault());
    }

    #attachResizeObserver() {
        if (this.#resizeObs) return;
        this.#resizeObs = new ResizeObserver(() => {
            if (this.#cards.length) this.#positionCards();
            this.#updateToggleVisibility();
        });
        if (this.#viewport) this.#resizeObs.observe(this.#viewport);
    }

    // ── Rebuild from items ──

    #rebuild() {
        if (!this.#track) return; // not yet connected
        this.#renderCarouselCards();
        this.#buildSectionLabels();
        const t = this.#parseTitlePos(this.#cardTitle);
        if (t.vAlign === 'tooltip') this.#applyTooltips(true);
        // If a selected key was set before rebuild, center on it
        if (this.#selectedKey) {
            const idx = this.#items.findIndex(it => it.key === this.#selectedKey);
            if (idx >= 0) this.#centerIdx = idx;
        }
        this.#positionCards();
        this.#updateToggleVisibility();
        this.#updateSectionNavVisibility();
        if (this.expanded) {
            this.collapse();
        }

        // Fade in on first render
        if (this.#isFirstRender && this.#cards.length > 0) {
            this.#isFirstRender = false;
            for (const { element } of this.#cards) {
                element.style.setProperty('--card-opacity', '0');
            }
            for (const sec of this.#sectionLabels) {
                sec.element.style.opacity = '0';
            }
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    for (const { element } of this.#cards) {
                        const layout = this.#cardLayout.get(element);
                        element.style.setProperty('--card-opacity', layout ? String(layout.opacity) : '0');
                    }
                    if (this.#lastFrame) this.#applySectionLabels(this.#lastFrame);
                });
            });
        }
    }

    #updateToggleVisibility() {
        if (!this.#toggle) return;
        this.#toggle.style.display = this.#expandable && this.#items.length > 0 ? '' : 'none';
    }

    // ── Carousel card rendering ──

    #renderCarouselCards() {
        this.#track.innerHTML = '';
        this.#cards = [];

        for (let i = 0; i < this.#items.length; i++) {
            const item = this.#items[i];
            const card = document.createElement('div');
            card.className = 'cdb-card';
            card.dataset.flipKey = item.key;

            const frame = document.createElement('div');
            frame.className = 'cdb-card-frame';
            frame.dataset.flipKey = item.key;

            const imgWrap = document.createElement('div');
            imgWrap.className = 'cdb-card-img';

            const img = document.createElement('img');
            img.alt = item.label;
            if (item.thumbSrc) img.src = item.thumbSrc;
            const markError = () => { img.onerror = null; img.removeAttribute('src'); imgWrap.classList.add('cdb-img-error'); };
            if (item.fallbackSrc) {
                img.onerror = () => { img.onerror = markError; img.src = item.fallbackSrc; };
            } else if (item.thumbSrc) {
                img.onerror = markError;
            } else {
                imgWrap.classList.add('cdb-img-error');
            }

            imgWrap.appendChild(img);

            const titleEl = document.createElement('div');
            titleEl.className = 'cdb-card-title';
            titleEl.textContent = item.label;

            frame.appendChild(titleEl);
            frame.appendChild(imgWrap);
            card.appendChild(frame);

            this.#track.appendChild(card);
            this.#cards.push({ element: card, index: i });
        }
    }

    #onCardClick(idx) {
        const item = this.#items[idx];
        if (!item) return;

        if (idx !== this.#centerIdx) {
            // Rotate to center first, then emit select
            this.#centerIdx = idx;
            this.#container.style.setProperty('--carousel-speed', '0.85s');
            this.#positionCards();
            this.#emitCenterChange();
            setTimeout(() => {
                this.dispatchEvent(new CustomEvent('item-select', {
                    detail: { key: item.key, index: idx, item }
                }));
            }, 700);
        } else {
            this.dispatchEvent(new CustomEvent('item-select', {
                detail: { key: item.key, index: idx, item }
            }));
        }
    }

    // ── Grid card rendering ──

    #renderGridCards() {
        this.#grid.innerHTML = '';
        let lastSectionIndex = -2; // sentinel

        for (let i = 0; i < this.#items.length; i++) {
            const item = this.#items[i];

            // Insert section header at section boundaries
            if (item.section != null && item.sectionIndex !== lastSectionIndex) {
                const header = document.createElement('div');
                header.className = 'cdb-grid-section-header';
                header.textContent = item.section;
                header.style.opacity = '0';
                this.#grid.appendChild(header);
                lastSectionIndex = item.sectionIndex;
            }

            const card = document.createElement('div');
            card.className = 'cdb-grid-card';
            card.dataset.flipKey = item.key;
            if (item.key === this.#selectedKey) card.classList.add('selected');

            const img = document.createElement('img');
            img.alt = item.label;
            if (item.thumbSrc) img.src = item.thumbSrc;
            const markGridError = () => { img.onerror = null; img.removeAttribute('src'); card.classList.add('cdb-img-error'); };
            if (item.fallbackSrc) {
                img.onerror = () => { img.onerror = markGridError; img.src = item.fallbackSrc; };
            } else if (item.thumbSrc) {
                img.onerror = markGridError;
            } else {
                card.classList.add('cdb-img-error');
            }
            card.appendChild(img);

            const nameEl = document.createElement('div');
            nameEl.className = 'cdb-grid-card-name';
            nameEl.textContent = item.label;
            nameEl.style.opacity = '0';
            card.appendChild(nameEl);

            if (item.deletable) {
                const actions = document.createElement('div');
                actions.className = 'cdb-grid-card-actions';
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'cdb-delete';
                deleteBtn.innerHTML = TRASH_SVG;
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.dispatchEvent(new CustomEvent('item-delete', {
                        detail: { key: item.key, index: i, item }
                    }));
                });
                actions.appendChild(deleteBtn);
                card.appendChild(actions);
            }

            card.addEventListener('click', () => {
                this.#centerIdx = i;
                // Check if grid overflows the scroll parent
                this.#scrollParent = this.closest('.gallery-main') || this.parentElement;
                const overflows = this.#scrollParent && this.#scrollParent.scrollHeight > this.#scrollParent.clientHeight;
                if (overflows) {
                    this.collapse();
                } else {
                    const prev = this.#grid.querySelector('.cdb-grid-card.selected');
                    if (prev) prev.classList.remove('selected');
                    card.classList.add('selected');
                }
                this.dispatchEvent(new CustomEvent('item-select', {
                    detail: { key: item.key, index: i, item }
                }));
            });

            this.#grid.appendChild(card);
        }
    }

    // ── Section helpers ──

    /** Count section boundaries between centerIdx and targetIdx along the given offset direction. */
    #countSectionBoundaries(centerIdx, targetIdx, offset) {
        if (offset === 0) return 0;
        const total = this.#items.length;
        const step = offset > 0 ? 1 : -1;
        let boundaries = 0;
        let pos = Math.round(centerIdx);
        const steps = Math.abs(Math.round(offset));
        for (let i = 0; i < steps; i++) {
            const next = this.#infinite
                ? ((pos + step) % total + total) % total
                : Math.max(0, Math.min(total - 1, pos + step));
            const curSec = this.#items[pos]?.sectionIndex;
            const nextSec = this.#items[next]?.sectionIndex;
            if (curSec != null && nextSec != null && curSec >= 0 && nextSec >= 0 && curSec !== nextSec) {
                boundaries++;
            }
            pos = next;
        }
        return boundaries;
    }

    #buildSectionLabels() {
        if (!this.#sectionLabelContainer) return;
        this.#sectionLabelContainer.innerHTML = '';
        this.#sectionLabels = [];
        const seen = new Set();
        for (const item of this.#items) {
            if (item.sectionIndex >= 0 && !seen.has(item.sectionIndex)) {
                seen.add(item.sectionIndex);
                const el = document.createElement('div');
                el.className = 'cdb-section-label';
                el.textContent = item.section;
                this.#sectionLabelContainer.appendChild(el);
                this.#sectionLabels.push({ element: el, sectionIndex: item.sectionIndex });
            }
        }
    }

    /** Capture carousel section label positions + underline widths.
     *  @param {Set<number>} [visibleSections] — if provided, only capture these sections.
     *         Otherwise falls back to skipping labels with inline opacity '0'. */
    #captureSectionLabelRects(visibleSections) {
        const rects = new Map();
        for (const sec of this.#sectionLabels) {
            if (visibleSections
                ? !visibleSections.has(sec.sectionIndex)
                : sec.element.style.opacity === '0') continue;
            const rect = sec.element.getBoundingClientRect();
            if (rect.width <= 0) continue;
            const uw = parseFloat(getComputedStyle(sec.element).getPropertyValue('--underline-width')) || rect.width;
            rects.set(sec.sectionIndex, { rect, underlineWidth: uw, text: sec.element.textContent });
        }
        return rects;
    }

    /** Capture grid section header positions. */
    #captureGridHeaderRects() {
        const rects = new Map();
        const headers = this.#grid.querySelectorAll('.cdb-grid-section-header');
        let secIdx = 0;
        for (const h of headers) {
            const item = this.#items.find(it => it.section === h.textContent && it.sectionIndex >= secIdx);
            if (item) {
                const rect = h.getBoundingClientRect();
                rects.set(item.sectionIndex, { rect, underlineWidth: rect.width, text: h.textContent });
                secIdx = item.sectionIndex + 1;
            }
        }
        return rects;
    }

    /** Animate phantom overlays from one set of section rects to another. */
    #morphSectionLabels(fromRects, toRects, duration, easing,
        fromStyle = { fontSize: '0.7rem', letterSpacing: '0.12em' },
        toStyle   = { fontSize: '0.65rem', letterSpacing: '0.15em' }) {
        const overlays = [];

        // Compute average motion direction from matched phantoms for unmatched drift
        let avgDx = 0, avgDy = 0, matchCount = 0;
        for (const [secIdx, from] of fromRects) {
            const to = toRects.get(secIdx);
            if (from && to) {
                avgDx += to.rect.left - from.rect.left;
                avgDy += to.rect.top - from.rect.top;
                matchCount++;
            }
        }
        if (matchCount > 0) { avgDx /= matchCount; avgDy /= matchCount; }

        // Position phantoms relative to the component so they scroll with content
        const hostRect = this.getBoundingClientRect();
        this.style.position = this.style.position || 'relative';

        for (const [secIdx, from] of fromRects) {
            if (!from) continue;
            const to = toRects.get(secIdx);

            const phantom = document.createElement('div');
            phantom.className = 'cdb-section-phantom';
            phantom.textContent = from.text;
            phantom.style.cssText = `
                position: absolute; z-index: 1000; pointer-events: none;
                left: ${from.rect.left - hostRect.left}px; top: ${from.rect.top - hostRect.top}px;
                font-size: ${fromStyle.fontSize}; text-transform: uppercase;
                letter-spacing: ${fromStyle.letterSpacing};
                color: var(--text-muted); white-space: nowrap; padding-bottom: 0.25rem;
            `;

            const fromUW = from.underlineWidth || from.rect.width;
            const bar = document.createElement('div');
            bar.className = 'cdb-section-phantom-bar';
            bar.style.cssText = `
                position: absolute; bottom: 0; left: 0;
                width: ${fromUW}px; height: 1px;
                background: var(--border);
            `;
            phantom.appendChild(bar);
            this.appendChild(phantom);
            overlays.push(phantom);

            if (to) {
                // Morph from source to target position
                const toUW = to.underlineWidth || to.rect.width;
                const dx = to.rect.left - from.rect.left;
                const dy = to.rect.top - from.rect.top;

                phantom.animate([
                    { transform: 'translate(0, 0)', opacity: 1 },
                    { transform: `translate(${dx}px, ${dy}px)`, opacity: 1 }
                ], { duration, easing, fill: 'both' });

                bar.animate([
                    { width: fromUW + 'px' },
                    { width: toUW + 'px' }
                ], { duration, easing, fill: 'both' });

                phantom.animate([
                    { fontSize: fromStyle.fontSize, letterSpacing: fromStyle.letterSpacing, color: 'var(--text-muted)' },
                    { fontSize: toStyle.fontSize, letterSpacing: toStyle.letterSpacing, color: 'var(--text-muted)' }
                ], { duration, easing, fill: 'both' });
            } else {
                // No matching carousel label — fade out with gentle bounded drift
                const maxDrift = 30;
                const driftDx = Math.max(-maxDrift, Math.min(maxDrift, avgDx || 0));
                const driftDy = Math.max(-maxDrift, Math.min(maxDrift, avgDy || -20));
                phantom.animate([
                    { transform: 'translate(0, 0)', opacity: 1 },
                    { transform: `translate(${driftDx}px, ${driftDy}px)`, opacity: 0 }
                ], { duration: duration * 0.6, easing, fill: 'both' });

                bar.animate([
                    { opacity: 1 },
                    { opacity: 0 }
                ], { duration: duration * 0.4, easing: 'ease-out', fill: 'both' });
            }
        }

        return overlays;
    }

    // ── Grid transition animations ──

    /**
     * FLIP-animate cards via Web Animations API.
     *
     * Each target describes a card's from/to positions. This avoids the fragile
     * `transition:none → reflow → transition+targets` CSS pattern entirely —
     * from and to keyframes are explicit, no reflow timing dependency.
     *
     * Stores created Animation objects in #flipAnimations for cleanup.
     *
     * @param {Array<{
     *   element: HTMLElement,
     *   img?: HTMLElement,
     *   fromCx: number, fromCy: number, fromRy: number, fromRx?: number, fromTz: number,
     *   fromSc: number, fromOpacity: number,
     *   toCx: number, toCy: number, toRy: number, toRx?: number, toTz: number,
     *   toSc: number, toOpacity: number,
     *   duration: number, delay?: number, easing: string,
     *   opacityDuration?: number, opacityEasing?: string,
     * }>} targets
     */
    #animateCardsWA(targets) {
        for (const t of targets) {
            const fromTransform = `translate(-50%, -50%) translateX(${t.fromCx}px) translateY(${t.fromCy}px)`;
            const toTransform = `translate(-50%, -50%) translateX(${t.toCx}px) translateY(${t.toCy}px)`;
            const delay = t.delay || 0;

            // Card wrapper: position + opacity
            if (t.opacityDuration != null && t.opacityDuration !== t.duration) {
                // Different timing for transform vs opacity — use two animations
                this.#flipAnimations.push(t.element.animate(
                    [{ transform: fromTransform }, { transform: toTransform }],
                    { duration: t.duration, delay, easing: t.easing, fill: 'both' }
                ));
                this.#flipAnimations.push(t.element.animate(
                    [{ opacity: t.fromOpacity }, { opacity: t.toOpacity }],
                    { duration: t.opacityDuration, delay, easing: t.opacityEasing || 'ease', fill: 'both' }
                ));
            } else {
                this.#flipAnimations.push(t.element.animate([
                    { transform: fromTransform, opacity: t.fromOpacity },
                    { transform: toTransform, opacity: t.toOpacity }
                ], { duration: t.duration, delay, easing: t.easing, fill: 'both' }));
            }

            // Card-img wrapper: 3D perspective transform
            if (t.img) {
                this.#flipAnimations.push(t.img.animate([
                    { transform: `perspective(1200px) rotateX(${t.fromRx || 0}deg) rotateY(${t.fromRy}deg) translateZ(${t.fromTz}px) scale(${t.fromSc})` },
                    { transform: `perspective(1200px) rotateX(${t.toRx || 0}deg) rotateY(${t.toRy}deg) translateZ(${t.toTz}px) scale(${t.toSc})` }
                ], { duration: t.duration, delay, easing: t.easing, fill: 'both' }));
            }

            // Set custom properties to target values immediately — CSS will use
            // these after the Web Animation is cancelled/finished in cleanup.
            this.#applyCardStyle(t.element, {
                cx: t.toCx, cy: t.toCy, ry: t.toRy, rx: t.toRx,
                tz: t.toTz, sc: t.toSc, opacity: t.toOpacity,
            });
        }
    }

    /** Cancel all FLIP Web Animations and clear the list. */
    #cancelFlipAnimations() {
        for (const a of this.#flipAnimations) a.cancel();
        this.#flipAnimations = [];
    }

    /** Read a card element's current custom property "from" state. */
    #readCardFromState(element) {
        return {
            cx: parseFloat(element.style.getPropertyValue('--cx')) || 0,
            cy: parseFloat(element.style.getPropertyValue('--cy')) || 0,
            ry: parseFloat(element.style.getPropertyValue('--ry')) || 0,
            rx: parseFloat(element.style.getPropertyValue('--rx')) || 0,
            tz: parseFloat(element.style.getPropertyValue('--tz')) || 0,
            sc: parseFloat(element.style.getPropertyValue('--sc')) || 1,
            opacity: parseFloat(element.style.getPropertyValue('--card-opacity')) ?? 1,
        };
    }

    /** Animate scrollTop of #scrollParent in sync with card animations. */
    #animateScroll(targetTop, duration) {
        if (!this.#scrollParent) return;
        if (this.#scrollRaf) cancelAnimationFrame(this.#scrollRaf);
        const from = this.#scrollParent.scrollTop;
        const delta = targetTop - from;
        if (Math.abs(delta) < 1) return;
        const start = performance.now();
        const tick = (now) => {
            const t = Math.min(1, (now - start) / duration);
            this.#scrollParent.scrollTop = from + delta * FLIP_EASE(t);
            if (t < 1) this.#scrollRaf = requestAnimationFrame(tick);
            else this.#scrollRaf = null;
        };
        this.#scrollRaf = requestAnimationFrame(tick);
    }

    #animateGridNamesIn(dur) {
        const names = this.#grid.querySelectorAll('.cdb-grid-card-name');
        names.forEach((n, i) => {
            n.animate([
                { opacity: 0 },
                { opacity: 1 }
            ], {
                duration: dur * 0.5,
                delay: dur * 0.45 + i * 15,
                easing: 'ease-out',
                fill: 'backwards',
            });
        });
    }

    #animateGridNamesOut(dur) {
        const names = this.#grid.querySelectorAll('.cdb-grid-card-name');
        for (const n of names) {
            n.animate([
                { opacity: 1 },
                { opacity: 0 }
            ], {
                duration: dur * 0.25,
                easing: 'ease-in',
                fill: 'both',
            });
        }
    }

    #cleanupGridAnimationStyles() {
        for (const h of this.#grid.querySelectorAll('.cdb-grid-section-header')) {
            h.style.opacity = '';
            h.style.transform = '';
            h.style.transition = '';
        }
        for (const n of this.#grid.querySelectorAll('.cdb-grid-card-name')) n.style.opacity = '';
    }

    #appendStripChildren() {
        if (!this.#strip) return;
        if (this.#controlsPosition === 'below') {
            this.#strip.appendChild(this.#container);
            this.#strip.appendChild(this.#dropdown);
            this.#strip.appendChild(this.#controls);
        } else {
            this.#strip.appendChild(this.#controls);
            this.#strip.appendChild(this.#container);
            this.#strip.appendChild(this.#dropdown);
        }
        if (this.#debugPanel) this.#strip.prepend(this.#debugPanel);
    }

    // ═══════════════════════════════════════════════════════
    // ── LAYOUT SYSTEM ──
    // ═══════════════════════════════════════════════════════

    /** Apply card transform CSS custom properties in one call. */
    #applyCardStyle(element, { cx, cy, ry, rx, tz, sc, opacity }) {
        const s = element.style;
        s.setProperty('--cx', cx + 'px');
        s.setProperty('--cy', cy + 'px');
        s.setProperty('--ry', ry + 'deg');
        s.setProperty('--rx', (rx || 0) + 'deg');
        s.setProperty('--tz', tz + 'px');
        s.setProperty('--sc', String(sc));
        s.setProperty('--card-opacity', String(opacity));
    }

    /** Read --card-w from CSS once per layout pass. */
    #readCardW() {
        return parseInt(
            getComputedStyle(document.documentElement).getPropertyValue('--card-w')
        ) || 180;
    }

    /** Compute arc parameters fitted to available viewport width. */
    #computeArcParams(cardW) {
        const viewportW = this.#viewport ? this.#viewport.clientWidth : window.innerWidth;

        // 1. Arc angle and mode
        const totalAngle = this.#arcZ * (ARC_Z_MAX_RAD / ARC_Z_RANGE);
        const linearMode = totalAngle < 0.01;

        // 2. Adaptive spacing: flat cards need more room, arc cards compress
        const arcFraction = Math.min(totalAngle / ARC_Z_MAX_RAD, 1);
        const minSpacing = cardW * (SPACING_FLAT - SPACING_ARC_ADJ * arcFraction);

        // 3. Visible count from available space
        const halfCount = Math.floor((viewportW - cardW) / (2 * minSpacing));
        const visibleCount = Math.max(3, 2 * Math.max(1, halfCount) + 1);
        const half = Math.floor(visibleCount / 2);

        // 4. Estimate outermost card's projected half-width to prevent overflow
        const outerSc = linearMode
            ? Math.max(SCALE_MIN_LINEAR, 1 - half * SCALE_RATE_LINEAR)
            : Math.max(SCALE_MIN_ARC, 1 - half * SCALE_RATE_ARC);
        const outerTz = linearMode ? 0 : -half * TZ_PER_POS;
        const outerRyRad = linearMode ? 0 : totalAngle;
        const outerHalfW = Math.abs(projOuterEdge(cardW, outerSc, outerTz, outerRyRad, PERSPECTIVE_D, 1));
        const maxCx = viewportW / 2 - outerHalfW - EDGE_MARGIN;

        // 5. Spacing and arc geometry
        const spacing = half > 0 ? maxCx / half : minSpacing;
        let R, dTheta;
        if (linearMode) {
            R = viewportW;
            dTheta = 0;
        } else {
            R = maxCx / Math.sin(totalAngle);
            dTheta = half > 0 ? totalAngle / half : 0;
        }
        return { R, dTheta, half, visibleCount, spacing, linearMode, maxCx, outerHalfW };
    }

    /**
     * Compute full geometry for one card. Pure — no DOM access.
     * Returns CardLayout object or null if fully hidden (|visualOffset| > half + 2).
     */
    #computeCardGeometry(index, element, centerIdx, arcParams, cardW, hasSections) {
        const { R, dTheta, half, spacing, linearMode } = arcParams;
        const total = this.#items.length;

        const wrapOff = (o) => {
            if (total > 1 && this.#infinite) {
                if (o > total / 2) o -= total;
                if (o < -total / 2) o += total;
            }
            return o;
        };

        let offset = wrapOff(index - centerIdx);

        let visualOffset = offset;
        if (hasSections && offset !== 0) {
            // Interpolate gap counts between floor/ceil of fractional center
            // to prevent discrete jumps when crossing section boundaries during drag
            const fc = Math.floor(centerIdx);
            const cc = Math.ceil(centerIdx);
            const frac = centerIdx - fc;
            const wrapIdx = (i) => this.#infinite
                ? ((i % total) + total) % total
                : Math.max(0, Math.min(total - 1, i));
            const gapF = this.#countSectionBoundaries(wrapIdx(fc), index, wrapOff(index - fc));
            const gapC = fc === cc ? gapF
                : this.#countSectionBoundaries(wrapIdx(cc), index, wrapOff(index - cc));
            const gapCount = gapF + (gapC - gapF) * frac;
            visualOffset = offset + gapCount * SECTION_GAP * Math.sign(offset);
        }

        const abs = Math.abs(visualOffset);
        if (abs > half + ZONE_CULL) return null;

        let cx, cy, ry, rx, tz, sc, opacity, zone;

        if (abs <= half) {
            zone = 1;
            if (linearMode) {
                cx = visualOffset * spacing;
                ry = 0;
            } else {
                const angle = visualOffset * dTheta;
                cx = R * Math.sin(angle);
                ry = Math.sign(visualOffset) * Math.min(Math.abs(angle) / DEG, RY_MAX_DEG);
            }
            tz = linearMode ? 0 : -abs * TZ_PER_POS;
            sc = linearMode
                ? Math.max(SCALE_MIN_LINEAR, 1 - abs * SCALE_RATE_LINEAR)
                : Math.max(SCALE_MIN_ARC, 1 - abs * SCALE_RATE_ARC);
            opacity = 1;
            const t = half > 0 ? abs / half : 0;
            cy = -this.#arcY * t * t;
            rx = this.#arcY !== 0 ? 0.5 * Math.atan2(-cy, PERSPECTIVE_D) / DEG : 0;
            cy += Math.min(this.#arcY, 0) / 2; // shift up only for frown curve (arcY < 0)
        } else {
            zone = 2;
            const t = Math.min((abs - half) / ZONE_CULL, 1);
            cx = linearMode
                ? half * spacing * Math.sign(visualOffset)
                : R * Math.sin(half * dTheta) * Math.sign(visualOffset);
            ry = linearMode ? 0 : Math.sign(visualOffset) * (RY_MAX_DEG + t * 40);
            tz = linearMode ? -t * ZONE2_TZ_EXTRA : -half * TZ_PER_POS - t * ZONE2_TZ_EXTRA;
            sc = (linearMode ? SCALE_MIN_LINEAR : SCALE_MIN_ARC) * (1 - t);
            opacity = abs > half + ZONE2_FADE ? 0 : 1;
            cy = -this.#arcY + Math.min(this.#arcY, 0) / 2;
            rx = this.#arcY !== 0 ? 0.5 * Math.atan2(this.#arcY, PERSPECTIVE_D) / DEG : 0;
        }

        // Hover parameters
        const hoverT = half > 0 ? Math.min(abs / half, 1) : 0;
        const hoverLift = HOVER_LIFT * (1 - hoverT);
        const hoverTzBoost = HOVER_TZ_BASE + hoverT * HOVER_TZ_EDGE;
        const hoverScBoost = HOVER_SC_BASE + hoverT * HOVER_SC_EDGE;
        const hoverRyOffset = ry * HOVER_RY_FACTOR;

        const side = Math.sign(visualOffset);
        let hoverCxShift = 0;
        if (side !== 0) {
            const edgeRest  = projOuterEdge(cardW, sc, tz, ry * DEG, PERSPECTIVE_D, side);
            const edgeHover = projOuterEdge(cardW, sc + hoverScBoost, tz + hoverTzBoost,
                                            (ry - hoverRyOffset) * DEG, PERSPECTIVE_D, side);
            hoverCxShift = edgeRest - edgeHover;
        }

        // Projected edges (rest state)
        const projLeftRest  = cx + projOuterEdge(cardW, sc, tz, ry * DEG, PERSPECTIVE_D, -1);
        const projRightRest = cx + projOuterEdge(cardW, sc, tz, ry * DEG, PERSPECTIVE_D, +1);

        // Projected edges (hover state)
        const projLeftHover  = cx + hoverCxShift + projOuterEdge(cardW, sc + hoverScBoost, tz + hoverTzBoost, (ry - hoverRyOffset) * DEG, PERSPECTIVE_D, -1);
        const projRightHover = cx + hoverCxShift + projOuterEdge(cardW, sc + hoverScBoost, tz + hoverTzBoost, (ry - hoverRyOffset) * DEG, PERSPECTIVE_D, +1);

        return {
            index, element,
            sectionIndex: this.#items[index].sectionIndex,
            offset, visualOffset, zone,
            cx, cy, ry, rx, tz, sc, opacity,
            zIndex: Math.max(0, 10 - Math.round(abs)),
            hoverLift, hoverTzBoost, hoverScBoost, hoverRyOffset, hoverCxShift,
            projLeftRest, projRightRest,
            projLeftHover, projRightHover,
        };
    }

    /** Compute per-section span data from #cardLayout.
     *  Zone 1 cards (|visualOffset| <= half) always contribute to edge positions.
     *  Zone 2 cards contribute edges only if they extend the span outward (further
     *  from center), which smooths the zone 1→2 boundary transition. Cards whose
     *  3D-projected positions fold back inward (phantom positions) are ignored. */
    #computeSectionSpans(half) {
        const spans = new Map();
        for (const [, layout] of this.#cardLayout) {
            if (!layout || layout.sectionIndex < 0) continue;
            const inArc = Math.abs(layout.visualOffset) <= half;

            if (!spans.has(layout.sectionIndex)) {
                spans.set(layout.sectionIndex, {
                    leftEdge: layout.projLeftRest,
                    rightEdge: layout.projRightRest,
                    visible: inArc,
                    extendsLeft: !inArc && layout.visualOffset < 0,
                    extendsRight: !inArc && layout.visualOffset > 0,
                });
            } else {
                const s = spans.get(layout.sectionIndex);
                if (inArc) {
                    if (!s.visible) {
                        s.leftEdge = layout.projLeftRest;
                        s.rightEdge = layout.projRightRest;
                        s.visible = true;
                    } else {
                        if (layout.projLeftRest < s.leftEdge) s.leftEdge = layout.projLeftRest;
                        if (layout.projRightRest > s.rightEdge) s.rightEdge = layout.projRightRest;
                    }
                } else {
                    // Zone 2: only extend edges outward (ignore phantom fold-back positions)
                    if (layout.visualOffset < 0 && layout.projLeftRest < s.leftEdge) {
                        s.leftEdge = layout.projLeftRest;
                    }
                    if (layout.visualOffset > 0 && layout.projRightRest > s.rightEdge) {
                        s.rightEdge = layout.projRightRest;
                    }
                }
                if (!inArc && layout.visualOffset < 0) s.extendsLeft = true;
                if (!inArc && layout.visualOffset > 0) s.extendsRight = true;
            }
        }
        return spans;
    }

    /**
     * Master layout computation. Produces FrameLayout and populates #cardLayout.
     * No DOM writes — purely computes data.
     */
    #computeLayout(centerOverride) {
        const centerIdx = centerOverride ?? this.#centerIdx;
        const cardW = this.#readCardW();
        const arcParams = this.#computeArcParams(cardW);
        const { half } = arcParams;
        const hasSections = this.#items.some(it => it.sectionIndex >= 0);

        this.#cardLayout.clear();
        for (const { element, index } of this.#cards) {
            const geo = this.#computeCardGeometry(index, element, centerIdx, arcParams, cardW, hasSections);
            this.#cardLayout.set(element, geo); // null for fully hidden cards
        }

        // Visible counts
        let numVisibleLeft = 0, numVisibleRight = 0;
        for (const [, layout] of this.#cardLayout) {
            if (!layout) continue;
            if (layout.visualOffset < 0 && Math.abs(layout.visualOffset) <= half) numVisibleLeft++;
            if (layout.visualOffset > 0 && Math.abs(layout.visualOffset) <= half) numVisibleRight++;
        }

        const sectionSpans = this.#computeSectionSpans(half);

        // Mark sections that extend beyond the computed layout range (null-layout cards)
        const total = this.#items.length;
        for (const { element, index } of this.#cards) {
            if (this.#cardLayout.get(element)) continue; // has layout, already handled
            const item = this.#items[index];
            if (!item || item.sectionIndex < 0) continue;
            const span = sectionSpans.get(item.sectionIndex);
            if (!span) continue;
            let off = index - centerIdx;
            if (total > 1 && this.#infinite) {
                if (off > total / 2) off -= total;
                if (off < -total / 2) off += total;
            }
            if (off < 0) span.extendsLeft = true;
            else if (off > 0) span.extendsRight = true;
        }

        // Stable section label boundaries from arc geometry (constant for a given arc-z)
        const theoreticalEdge = arcParams.maxCx + arcParams.outerHalfW;
        const arcBoundaryLeft = -theoreticalEdge;
        const arcBoundaryRight = theoreticalEdge;

        const frame = {
            ...arcParams, cardW,
            numVisibleLeft, numVisibleRight,
            sectionSpans,
            arcBoundaryLeft, arcBoundaryRight,
            arrowLeftDisabled: !this.#infinite && centerIdx <= 0,
            arrowRightDisabled: !this.#infinite && centerIdx >= this.#items.length - 1,
            secNavLeftDisabled: false,
            secNavRightDisabled: false,
        };

        // Section nav disabled state
        const curSecIdx = this.#items[centerIdx]?.sectionIndex ?? -1;
        if (!this.#infinite && curSecIdx >= 0) {
            const hasPrev = this.#items.some(it => it.sectionIndex >= 0 && it.sectionIndex < curSecIdx);
            const hasNext = this.#items.some(it => it.sectionIndex >= 0 && it.sectionIndex > curSecIdx);
            frame.secNavLeftDisabled = !hasPrev;
            frame.secNavRightDisabled = !hasNext;
        } else if (!this.#infinite) {
            frame.secNavLeftDisabled = true;
            frame.secNavRightDisabled = true;
        }
        this.#lastFrame = frame;
        return frame;
    }

    /** Apply computed layout to DOM elements. */
    #applyLayout(frame) {
        const { R, half, dTheta, spacing, linearMode } = frame;
        const offScreenCx = linearMode
            ? half * spacing + 200
            : R * Math.sin(half * dTheta) + 200;

        for (const { element, index } of this.#cards) {
            const layout = this.#cardLayout.get(element);

            element.classList.remove('active');

            if (!layout) {
                // Push off-screen in the correct direction so CSS transition scrolls them out
                const total = this.#items.length;
                let off = index - this.#centerIdx;
                if (total > 1 && this.#infinite) {
                    if (off > total / 2) off -= total;
                    if (off < -total / 2) off += total;
                }
                const side = off >= 0 ? 1 : -1;
                this.#applyCardStyle(element, {
                    cx: side * offScreenCx,
                    cy: -this.#arcY + Math.min(this.#arcY, 0) / 2,
                    ry: side * 90, rx: 0,
                    tz: -half * 20 - ZONE2_TZ_EXTRA, sc: 0, opacity: 0,
                });
                element.style.pointerEvents = 'none';
                element.style.zIndex = '0';
                continue;
            }

            this.#applyCardStyle(element, layout);
            element.style.zIndex = String(layout.zIndex);
            element.style.pointerEvents = layout.zone === 1 ? '' : 'none';

            element.style.setProperty('--hover-lift', layout.hoverLift + 'px');
            element.style.setProperty('--hover-ry', layout.hoverRyOffset + 'deg');
            element.style.setProperty('--hover-tz', layout.hoverTzBoost + 'px');
            element.style.setProperty('--hover-sc', String(layout.hoverScBoost));
            element.style.setProperty('--hover-cx', layout.hoverCxShift + 'px');

            if (item_key_matches(element.dataset.flipKey, this.#selectedKey)) {
                element.classList.add('active');
            }
        }

        // Arrow state
        this.#navLeft.disabled = frame.arrowLeftDisabled;
        this.#navRight.disabled = frame.arrowRightDisabled;
        if (this.#secNavLeft) this.#secNavLeft.disabled = frame.secNavLeftDisabled;
        if (this.#secNavRight) this.#secNavRight.disabled = frame.secNavRightDisabled;
        this.#numCardsVisibleLeft = frame.numVisibleLeft;
        this.#numCardsVisibleRight = frame.numVisibleRight;

        // Section labels
        this.#applySectionLabels(frame);

        // Schedule hover zone recomputation
        clearTimeout(this.#zoneTimer);
        this.#zoneTimer = setTimeout(() => this.#computeHoverZones(), HOVER_ZONE_DELAY);
    }

    /** Position section labels using projected edges from FrameLayout.
     *  Labels are "sticky" — when a section extends off-screen, the label pins
     *  to the arc boundary edge (where cards transition out of the visible arc).
     *  It only scrolls off when the last visible card exits. */
    #applySectionLabels(frame, skipOpacity = false) {
        const halfVP = (this.#viewport ? this.#viewport.clientWidth : window.innerWidth) / 2;
        // Pin points: projected edges of a card at the arc boundary.
        // arcBoundaryLeft is negative (left side), arcBoundaryRight is positive (right side).
        const boundL = frame.arcBoundaryLeft ?? -halfVP;
        const boundR = frame.arcBoundaryRight ?? halfVP;

        // First pass: compute clamped positions for all visible sections
        const positions = [];
        const visibleSections = new Set();
        for (const sec of this.#sectionLabels) {
            const span = frame.sectionSpans.get(sec.sectionIndex);
            if (!span || !span.visible) {
                if (!skipOpacity) sec.element.style.opacity = '0';
                continue;
            }

            const left = span.extendsLeft ? boundL : span.leftEdge;
            const right = span.extendsRight ? boundR : span.rightEdge;
            const clampedLeft = Math.max(left, boundL);
            const clampedRight = Math.min(right, boundR);

            if (clampedRight <= clampedLeft) {
                if (!skipOpacity) sec.element.style.opacity = '0';
                continue;
            }

            visibleSections.add(sec.sectionIndex);
            positions.push({ sec, clampedLeft, clampedRight });
        }

        // Sort by left edge so we can detect overlaps with the next label
        positions.sort((a, b) => a.clampedLeft - b.clampedLeft);

        // Second pass: apply positions and mask when adjacent labels overlap
        const FADE_PX = 30;
        for (let i = 0; i < positions.length; i++) {
            const { sec, clampedLeft, clampedRight } = positions[i];
            const spanWidth = clampedRight - clampedLeft;

            // Available width: section span, but capped if the next label intrudes
            let availableWidth = spanWidth;
            if (i + 1 < positions.length) {
                const gap = positions[i + 1].clampedLeft - clampedLeft;
                if (gap < availableWidth) availableWidth = gap;
            }

            if (!skipOpacity) sec.element.style.opacity = '';
            sec.element.style.transform = `translateX(${clampedLeft}px)`;
            sec.element.style.setProperty('--underline-width', spanWidth + 'px');

            // Apply fade mask if the label text would be meaningfully clipped
            const textWidth = sec.element.scrollWidth;
            const MASK_TOLERANCE = 20;
            if (availableWidth < textWidth - MASK_TOLERANCE && availableWidth > 0) {
                const fadeStart = Math.max(0, availableWidth - FADE_PX);
                const mask = `linear-gradient(to right, black ${fadeStart}px, transparent ${availableWidth}px)`;
                sec.element.style.maskImage = mask;
                sec.element.style.webkitMaskImage = mask;
            } else {
                sec.element.style.maskImage = '';
                sec.element.style.webkitMaskImage = '';
            }
        }

        return visibleSections;
    }

    // ── Coverflow layout entry point ──

    #positionCards() {
        const frame = this.#computeLayout();
        this.#isTransitioning = true;
        this.#track.classList.add('cdb-transitioning');
        this.#resetHoverState();
        this.#applyLayout(frame);
    }

    #updateActiveHighlight() {
        for (const { element } of this.#cards) {
            element.classList.toggle('active',
                item_key_matches(element.dataset.flipKey, this.#selectedKey));
        }
        // Also update grid selection if expanded
        if (this.expanded) {
            for (const card of this.#grid.querySelectorAll('.cdb-grid-card')) {
                card.classList.toggle('selected', item_key_matches(card.dataset.flipKey, this.#selectedKey));
            }
        }
    }

    #resetHoverState() {
        if (this.#hoveredCard) {
            this.#hoveredCard.classList.remove('cdb-hovered');
            this.#hoveredCard = null;
        }
        for (const c of this.#cards) {
            c.element.classList.remove('hover-displaced', 'active-shrunk', 'cdb-mask-left', 'cdb-mask-right', 'cdb-rest-mask');
            c.element.style.removeProperty('--mask-size');
            c.element.style.pointerEvents = '';
        }
    }

    // ── Zone-based hover ──

    #computeHoverZones() {
        // Clear hover before measuring so getBoundingClientRect() returns at-rest positions
        const wasHovered = this.#hoveredCard;
        if (wasHovered) wasHovered.classList.remove('cdb-hovered');

        const trackRect = this.#track.getBoundingClientRect();

        const visible = [];
        for (const { element } of this.#cards) {
            const opacity = parseFloat(element.style.getPropertyValue('--card-opacity'));
            if (opacity <= 0) continue;
            const img = element.querySelector('.cdb-card-frame');
            if (!img) continue;
            const imgRect = img.getBoundingClientRect();
            if (imgRect.width <= 0) continue;
            visible.push({
                element,
                leftEdge: imgRect.left,
                rightEdge: imgRect.right,
            });
        }

        visible.sort((a, b) => a.leftEdge - b.leftEdge);

        // Find center card in sorted array
        const centerEl = this.#cards.find(c => c.index === this.#centerIdx)?.element;
        const centerIdx = visible.findIndex(v => v.element === centerEl);

        // Build dividers:
        //   Left of center: divider at card's left edge
        //   Right of center: divider at previous card's right edge
        // This makes the center card's zone flush with its own edges.
        const dividers = [];
        for (let i = 1; i < visible.length; i++) {
            if (centerIdx >= 0 && i > centerIdx) {
                dividers.push(visible[i - 1].rightEdge);
            } else {
                dividers.push(visible[i].leftEdge);
            }
        }

        // Build zones from dividers
        this.#hoverZones = [];
        for (let i = 0; i < visible.length; i++) {
            const zoneLeft = i === 0 ? trackRect.left : dividers[i - 1];
            const zoneRight = i === visible.length - 1
                ? trackRect.right
                : dividers[i];
            this.#hoverZones.push({
                left: zoneLeft,
                right: zoneRight,
                element: visible[i].element,
            });
        }

        // Restore hover state after measurement
        if (wasHovered) wasHovered.classList.add('cdb-hovered');
    }

    #applyAdjacentMasks(hoveredEl) {
        // Clear existing masks
        for (const { element } of this.#cards) {
            element.classList.remove('cdb-mask-left', 'cdb-mask-right', 'cdb-rest-mask');
            element.style.removeProperty('--mask-size');
        }
        if (!hoveredEl) return;

        const hd = this.#cardLayout.get(hoveredEl);
        if (!hd) return;

        const BUFFER = 16;

        // Build sorted visible list from pre-computed layout
        const visible = [];
        for (const [, layout] of this.#cardLayout) {
            if (!layout) continue;
            visible.push(layout);
        }
        visible.sort((a, b) => a.cx - b.cx);

        const hIdx = visible.findIndex(v => v.element === hoveredEl);
        if (hIdx < 0) return;

        // Mask both left and right neighbors
        for (const side of [-1, +1]) {
            const nIdx = hIdx + side;
            if (nIdx < 0 || nIdx >= visible.length) continue;

            const nd = visible[nIdx];

            // Use pre-computed projected edges
            const hoveredEdge = side > 0 ? hd.projRightHover : hd.projLeftHover;
            const neighborEdge = side > 0 ? nd.projLeftRest : nd.projRightRest;
            const overlap = side * (hoveredEdge - neighborEdge);

            if (overlap > 0) {
                const nWidth = nd.projRightRest - nd.projLeftRest;
                const maskPx = overlap + BUFFER;
                const maskPct = nWidth > 0 ? Math.min(90, (maskPx / nWidth) * 100) : 35;

                nd.element.classList.add(side > 0 ? 'cdb-mask-left' : 'cdb-mask-right');
                nd.element.style.setProperty('--mask-size', maskPct.toFixed(1) + '%');
            }
        }
    }

    #onTrackMouseMove(e) {
        if (this.#isDragging || this.#isTransitioning) return;
        const x = e.clientX;
        let found = null;
        for (const zone of this.#hoverZones) {
            if (x >= zone.left && x < zone.right) {
                found = zone.element;
                break;
            }
        }
        if (found !== this.#hoveredCard) {
            if (this.#hoveredCard) this.#hoveredCard.classList.remove('cdb-hovered');
            this.#hoveredCard = found;
            if (found) found.classList.add('cdb-hovered');
            this.#applyAdjacentMasks(found);
        }
    }

    #onTrackMouseLeave() {
        if (this.#hoveredCard) {
            this.#hoveredCard.classList.remove('cdb-hovered');
            this.#hoveredCard = null;
        }
        this.#applyAdjacentMasks(null);
    }

    /** Find card element at a given clientX using fresh getBoundingClientRect positions. */
    #findCardAtX(clientX) {
        const visible = [];
        for (const { element } of this.#cards) {
            const opacity = parseFloat(element.style.getPropertyValue('--card-opacity'));
            if (opacity <= 0) continue;
            const img = element.querySelector('.cdb-card-frame');
            if (!img) continue;
            const imgRect = img.getBoundingClientRect();
            if (imgRect.width <= 0) continue;
            visible.push({ element, leftEdge: imgRect.left, rightEdge: imgRect.right });
        }
        if (visible.length === 0) return null;

        visible.sort((a, b) => a.leftEdge - b.leftEdge);

        const centerEl = this.#cards.find(c => c.index === this.#centerIdx)?.element;
        const centerIdx = visible.findIndex(v => v.element === centerEl);

        const dividers = [];
        for (let i = 1; i < visible.length; i++) {
            if (centerIdx >= 0 && i > centerIdx) {
                dividers.push(visible[i - 1].rightEdge);
            } else {
                dividers.push(visible[i].leftEdge);
            }
        }

        for (let i = 0; i < visible.length; i++) {
            const zoneLeft = i === 0 ? -Infinity : dividers[i - 1];
            const zoneRight = i === visible.length - 1 ? Infinity : dividers[i];
            if (clientX >= zoneLeft && clientX < zoneRight) {
                return visible[i].element;
            }
        }
        return null;
    }

    #onTrackClick(e) {
        if (this.#dragJustEnded) return;
        const found = this.#findCardAtX(e.clientX);
        if (!found) return;
        const entry = this.#cards.find(c => c.element === found);
        if (entry) this.#onCardClick(entry.index);
    }

    // ── Drag-to-scroll ──

    #setupDrag() {
        const track = this.#track;

        const wrapCenter = (c) => {
            const t = this.#items.length;
            if (this.#infinite) return ((c % t) + t) % t;
            return Math.max(0, Math.min(t - 1, c));
        };

        const cancelMomentum = () => {
            if (this.#momentumRaf) {
                cancelAnimationFrame(this.#momentumRaf);
                this.#momentumRaf = null;
            }
        };

        const snapToNearest = () => {
            const t = this.#items.length;
            const nearest = ((Math.round(this.#dragFractionalCenter) % t) + t) % t;
            this.#centerIdx = nearest;
            this.#container.style.setProperty('--carousel-speed', '0.85s');
            track.classList.remove('cdb-dragging');
            this.#positionCards();
            this.#emitCenterChange();
        };

        const startMomentum = () => {
            const { R, dTheta } = this.#lastFrame || this.#computeArcParams(this.#readCardW());
            const pxPerUnit = R * dTheta;
            let vel = this.#dragVelocity;
            let lastTime = performance.now();

            const tick = (now) => {
                const dt = Math.min(now - lastTime, 32);
                lastTime = now;

                this.#dragFractionalCenter += (-vel * dt) / pxPerUnit;
                this.#dragFractionalCenter = wrapCenter(this.#dragFractionalCenter);

                this.#container.style.setProperty('--carousel-speed', '0s');
                this.#positionCards_fractional(this.#dragFractionalCenter);

                // Slower decay for more graceful momentum
                vel *= Math.pow(MOMENTUM_DECAY, dt / FRAME_REF_MS);

                if (Math.abs(vel) < 0.05) {
                    this.#momentumRaf = null;
                    snapToNearest();
                    return;
                }
                this.#momentumRaf = requestAnimationFrame(tick);
            };
            this.#momentumRaf = requestAnimationFrame(tick);
        };

        const onDragMove = (e) => {
            if (!this.#isDragging) return;
            const { R, dTheta } = this.#lastFrame || this.#computeArcParams(this.#readCardW());
            const pxPerUnit = R * dTheta;

            const deltaX = e.clientX - this.#dragStartX;
            this.#dragFractionalCenter = wrapCenter(this.#dragStartCenter + (-deltaX / pxPerUnit));
            this.#positionCards_fractional(this.#dragFractionalCenter);

            const now = performance.now();
            const dt = now - this.#lastDragTime;
            if (dt > 0) {
                this.#dragVelocity = (e.clientX - this.#lastDragX) / dt;
            }
            this.#lastDragX = e.clientX;
            this.#lastDragTime = now;
        };

        const onDragEnd = (e) => {
            document.removeEventListener('pointermove', onDragMove);
            document.removeEventListener('pointerup', onDragEnd);
            document.removeEventListener('pointercancel', onDragEnd);

            if (!this.#isDragging) return;
            this.#isDragging = false;

            const totalDrag = Math.abs(e.clientX - this.#dragStartX);
            if (totalDrag > DRAG_INTENT_PX) {
                this.#dragJustEnded = true;
                requestAnimationFrame(() => { this.#dragJustEnded = false; });
            }

            if (Math.abs(this.#dragVelocity) > FLING_VEL_MIN) {
                startMomentum();
            } else {
                snapToNearest();
            }
        };

        track.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            cancelMomentum();
            this.#resetHoverState();

            this.#isTransitioning = false;
            this.#track.classList.remove('cdb-transitioning');
            this.#isDragging = true;
            this.#dragJustEnded = false;
            this.#dragStartX = e.clientX;
            this.#dragStartCenter = this.#centerIdx;
            this.#dragFractionalCenter = this.#centerIdx;
            this.#lastDragX = e.clientX;
            this.#lastDragTime = performance.now();
            this.#dragVelocity = 0;

            this.#container.style.setProperty('--carousel-speed', '0s');
            track.classList.add('cdb-dragging');
            document.addEventListener('pointermove', onDragMove);
            document.addEventListener('pointerup', onDragEnd);
            document.addEventListener('pointercancel', onDragEnd);

            this.dispatchEvent(new CustomEvent('center-change', {
                detail: { key: this.#items[this.#centerIdx]?.key, index: this.#centerIdx }
            }));
        });
    }

    /** Position cards with a fractional center index (for drag/momentum). */
    #positionCards_fractional(fractionalCenter) {
        const frame = this.#computeLayout(fractionalCenter);
        this.#applyLayout(frame);
    }

    // ── Arrow navigation ──

    #setupArrow(btn, direction) {
        if (!btn) return;
        let holdTimer = null;
        let holdInterval = null;
        let holdActive = false;
        let holdJustEnded = false;

        const navBy = (n) => {
            if (this.#momentumRaf) {
                cancelAnimationFrame(this.#momentumRaf);
                this.#momentumRaf = null;
            }
            this.#resetHoverState();
            const total = this.#items.length;
            if (total <= 1) return;
            if (this.#infinite) {
                this.#centerIdx = ((this.#centerIdx + n) % total + total) % total;
            } else {
                this.#centerIdx = Math.max(0, Math.min(total - 1, this.#centerIdx + n));
            }
            this.#track.classList.add('cdb-dragging');
            this.#container.style.setProperty('--carousel-speed', '0.85s');
            this.#positionCards();
            this.#emitCenterChange();
            setTimeout(() => this.#track.classList.remove('cdb-dragging'), 900);
        };

        btn.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            holdActive = false;
            holdTimer = setTimeout(() => {
                holdActive = true;
                this.#track.classList.add('cdb-dragging');
                navBy(-direction);
                holdInterval = setInterval(() => navBy(-direction), 400);
            }, 400);
        });

        btn.addEventListener('pointerup', (e) => {
            e.stopPropagation();
            clearTimeout(holdTimer);
            if (holdActive) {
                clearInterval(holdInterval);
                holdActive = false;
                holdJustEnded = true;
                this.#track.classList.remove('cdb-dragging');
                requestAnimationFrame(() => { holdJustEnded = false; });
            }
        });

        btn.addEventListener('pointerleave', () => {
            clearTimeout(holdTimer);
            if (holdActive) {
                clearInterval(holdInterval);
                holdActive = false;
                holdJustEnded = true;
                this.#track.classList.remove('cdb-dragging');
                requestAnimationFrame(() => { holdJustEnded = false; });
            }
        });

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (holdJustEnded) return;
            // Right arrow (direction=-1): rightmost visible → center
            // Left arrow (direction=1): leftmost visible → center
            const jump = direction < 0
                ? this.#numCardsVisibleRight
                : this.#numCardsVisibleLeft;
            navBy(-direction * Math.max(1, jump));
        });
    }

    #updateSectionNavVisibility() {
        const sectionCount = new Set(this.#items.filter(it => it.sectionIndex >= 0).map(it => it.sectionIndex)).size;
        const show = sectionCount > 1;
        if (this.#secNavLeft) this.#secNavLeft.style.display = show ? '' : 'none';
        if (this.#secNavRight) this.#secNavRight.style.display = show ? '' : 'none';
    }

    // ── Section arrow navigation ──

    #setupSectionArrow(btn, direction) {
        if (!btn) return;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const items = this.#items;
            const total = items.length;
            if (total <= 1) return;

            const curSecIdx = items[this.#centerIdx]?.sectionIndex ?? -1;
            let targetIdx = -1;

            if (direction > 0) {
                // Next section: find first item with sectionIndex > current
                for (let i = 0; i < total; i++) {
                    if (items[i].sectionIndex > curSecIdx && items[i].sectionIndex >= 0) {
                        targetIdx = i;
                        break;
                    }
                }
                // Infinite wrap: go to first section
                if (targetIdx < 0 && this.#infinite) {
                    targetIdx = items.findIndex(it => it.sectionIndex >= 0);
                }
            } else {
                // Previous section: find first item of the section before current
                let prevSecIdx = -1;
                for (let i = 0; i < total; i++) {
                    const si = items[i].sectionIndex;
                    if (si >= 0 && si < curSecIdx) prevSecIdx = si;
                }
                if (prevSecIdx >= 0) {
                    targetIdx = items.findIndex(it => it.sectionIndex === prevSecIdx);
                } else if (this.#infinite) {
                    // Wrap to last section
                    let maxSec = -1;
                    for (const it of items) {
                        if (it.sectionIndex > maxSec) maxSec = it.sectionIndex;
                    }
                    if (maxSec >= 0) {
                        targetIdx = items.findIndex(it => it.sectionIndex === maxSec);
                    }
                }
            }

            if (targetIdx < 0 || targetIdx === this.#centerIdx) return;

            if (this.#momentumRaf) {
                cancelAnimationFrame(this.#momentumRaf);
                this.#momentumRaf = null;
            }
            this.#resetHoverState();
            this.#centerIdx = targetIdx;
            this.#track.classList.add('cdb-dragging');
            this.#container.style.setProperty('--carousel-speed', '0.85s');
            this.#positionCards();
            this.#emitCenterChange();
            setTimeout(() => this.#track.classList.remove('cdb-dragging'), 900);
        });
    }

    // ── FLIP helpers ──

    #flattenCards() {
        for (const { element } of this.#cards) {
            element.style.setProperty('--ry', '0deg');
            element.style.setProperty('--rx', '0deg');
            element.style.setProperty('--tz', '0px');
            element.style.setProperty('--cy', '0px');
            element.style.setProperty('--sc', '0.45');
            element.style.setProperty('--card-opacity', '0');
            element.style.pointerEvents = 'none';
        }
        this.#strip.classList.add('cdb-flattened');
    }

    // ── Event helpers ──

    #emitCenterChange() {
        const item = this.#items[this.#centerIdx];
        this.dispatchEvent(new CustomEvent('center-change', {
            detail: { key: item?.key, index: this.#centerIdx }
        }));
    }
}

function item_key_matches(a, b) {
    return a != null && b != null && String(a) === String(b);
}

customElements.define('carousel-dropdown-browser', CarouselDropdownBrowser);

export { CarouselDropdownBrowser, CarouselDropdownBrowserCard, CarouselDropdownBrowserSection };
