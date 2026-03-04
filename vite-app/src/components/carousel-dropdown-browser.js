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
 * @fires item-select   — { key, index, item } when a card is clicked
 * @fires center-change — { key, index } when carousel center changes (drag, arrow)
 * @fires item-delete   — { key, index, item } when grid delete button is clicked
 * @fires expand-change — { expanded } when grid dropdown opens/closes
 */

import { TRASH_SVG } from './icons.js';
import { flipAnimate } from './flip-layout.js';
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
const SECTION_GAP = 0.4;         // extra card-widths of spacing at section boundaries
const PERSPECTIVE_D = 1200;      // matches CSS perspective(1200px)
const DEG = Math.PI / 180;       // degrees-to-radians multiplier
const HOVER_ZONE_DELAY = 900;    // ms delay before recomputing hover zones after layout

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
    static observedAttributes = ['arc-angle', 'smile-px', 'flip-duration', 'controls-position', 'infinite', 'bounce', 'expandable'];

    // ── Configuration ──
    #arcAngle = 0.85;
    #smilePx = 20;
    #flipDuration = 1500;
    #controlsPosition = 'above'; // 'above' | 'below'
    #infinite = true;              // wrap around or clamp at edges
    #bounce = 0.35;                // overshoot amount (0 = smooth, 1 = pronounced bounce)
    #expandable = true;            // whether the grid-expand toggle is available
    #animatingExpand = false;       // guard against overlapping expand/collapse

    // ── Data ──
    #items = [];           // [{ key, label, thumbSrc, fallbackSrc, deletable, data, section, sectionIndex }]
    #selectedKey = null;

    // ── Carousel state ──
    #centerIdx = 0;
    #cards = [];           // [{element, index}]
    #dragJustEnded = false;
    #numCardsVisibleLeft = 0;
    #numCardsVisibleRight = 0;

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
    #activeHoverEl = null;
    #activeHoverRect = null;
    #activeMoveHandler = null;

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
    #sectionLabelContainer = null;
    #sectionLabels = [];


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

    async expand() {
        if (this.expanded || this.#animatingExpand) return;
        this.#animatingExpand = true;

        // Phase 1: slide controls up (only when positioned below)
        if (this.#controlsPosition === 'below') {
            await this.#animateControlsToTop(Math.round(this.#flipDuration * 0.5));
        }

        // Phase 2: FLIP cards to grid
        const firstRects = this.#captureCarouselRects();
        const sectionLabelRects = this.#captureSectionLabelRects();
        const dur = this.#flipDuration;
        const easing = 'cubic-bezier(0.4, 0, 0.2, 1)';

        this.#flipLayout.flip(() => {
            this.#renderGridCards();
            this.#flattenCards();
            this.#dropdown.classList.add('expanded', 'cdb-measuring');
            this.#toggle.classList.add('active');
            void this.#grid.offsetHeight;
            this.#dropdown.classList.remove('cdb-measuring');
        }, { firstRects });

        // Animate section headers from carousel label positions to grid positions
        // (direct FLIP on headers keeps them in sync with card movement)
        const headers = this.#grid.querySelectorAll('.cdb-grid-section-header');
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
                h.animate([{ opacity: 0 }, { opacity: 1 }], {
                    duration: dur * 0.6, delay: dur * 0.3, fill: 'forwards'
                });
            }
            headerSecIdx = item.sectionIndex + 1;
        }

        // Card name overlays fade in
        this.#animateGridNamesIn(dur);

        // Clean up inline opacity after all animations finish
        setTimeout(() => this.#cleanupGridAnimationStyles(), dur + 50);

        setTimeout(() => {
            this.#scrollParent = this.closest('.gallery-main') || this.parentElement;
            if (this.#scrollParent && this.#scrollParent.scrollHeight > this.#scrollParent.clientHeight) {
                this.#scrollParent.scrollTo({ top: this.#scrollParent.scrollHeight, behavior: 'smooth' });
            }
        }, dur + 30);

        this.#animatingExpand = false;
        this.dispatchEvent(new CustomEvent('expand-change', { detail: { expanded: true } }));
    }

    async collapse() {
        if (!this.expanded || this.#animatingExpand) return;
        this.#animatingExpand = true;

        const dur = this.#flipDuration;
        const easing = 'cubic-bezier(0.4, 0, 0.2, 1)';

        // Capture grid header positions BEFORE collapse
        const gridHeaderRects = this.#captureGridHeaderRects();

        // Fade out card names
        this.#animateGridNamesOut(dur);

        // Hide real grid headers — phantoms will cover during morph
        const headers = this.#grid.querySelectorAll('.cdb-grid-section-header');
        for (const h of headers) h.style.opacity = '0';

        // Phase 1: collapse grid back to carousel
        const cardDelay = Math.round(dur * 0.15);
        await new Promise(resolve => {
            setTimeout(() => {
                // Capture grid card positions
                const gridCards = this.#grid.querySelectorAll('.cdb-grid-card');
                const firstRects = new Map();
                for (const card of gridCards) {
                    firstRects.set(card.dataset.flipKey, card.getBoundingClientRect());
                }

                // Restore carousel (invisible for measurement)
                this.#container.style.transition = 'none';
                this.#container.style.opacity = '0';
                this.#strip.classList.remove('cdb-flattened');
                this.#positionCards();

                // Collapse grid
                this.#dropdown.classList.add('cdb-measuring');
                this.#dropdown.classList.remove('expanded');
                this.#toggle.classList.remove('active');
                void this.#track.offsetHeight;

                this.#dropdown.classList.remove('cdb-measuring');
                this.#container.style.transition = '';
                this.#container.style.opacity = '';

                // Capture carousel section label positions (now visible)
                const sectionLabelRects = this.#captureSectionLabelRects();

                // Morph grid headers → carousel section labels
                this.#morphSectionLabels(gridHeaderRects, sectionLabelRects, dur, easing);

                // FLIP-animate card images grid → carousel
                const imgs = [];
                for (const { element } of this.#cards) {
                    const img = element.querySelector('.cdb-card-img');
                    if (img) imgs.push(img);
                }
                flipAnimate(imgs, el => el.dataset.flipKey, firstRects, { duration: dur });

                setTimeout(resolve, dur + 20);
            }, cardDelay);
        });

        // Phase 2: slide controls back down (only when positioned below)
        if (this.#controlsPosition === 'below') {
            await this.#animateControlsToBottom(Math.round(dur * 0.5));
        }

        this.#animatingExpand = false;
        this.dispatchEvent(new CustomEvent('expand-change', { detail: { expanded: false } }));
    }

    toggle() {
        if (this.expanded) this.collapse();
        else this.expand();
    }

    // ── Attributes ──

    attributeChangedCallback(name, _old, val) {
        if (name === 'arc-angle') this.#arcAngle = parseFloat(val) || 0.85;
        if (name === 'smile-px') this.#smilePx = parseFloat(val) || 20;
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
    }

    /** Compute cubic-bezier from bounce parameter and set CSS custom properties. */
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
        this.#attachResizeObserver();
        this.#attachMutationObserver();
        // Collect any data children already present
        this.#collectAndRebuild();
    }

    disconnectedCallback() {
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
        this.#navLeft.innerHTML = ARROW_LEFT;

        this.#toggle = document.createElement('button');
        this.#toggle.className = 'cdb-toggle';
        this.#toggle.style.display = 'none';
        this.#toggle.setAttribute('aria-label', 'View all');
        this.#toggle.innerHTML = '<span class="cdb-chevron"><span class="cdb-chevron-bar cdb-chevron-l"></span><span class="cdb-chevron-bar cdb-chevron-r"></span></span>';

        this.#navRight = document.createElement('button');
        this.#navRight.className = 'gallery-arrow cdb-arrow cdb-arrow-right';
        this.#navRight.setAttribute('aria-label', 'Next');
        this.#navRight.innerHTML = ARROW_RIGHT;

        this.#controls.appendChild(this.#navLeft);
        this.#controls.appendChild(this.#toggle);
        this.#controls.appendChild(this.#navRight);

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
            if (e.target.classList?.contains('cdb-card') && e.propertyName === 'transform') {
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

        this.#appendStripChildren();

        // Dropdown
        this.#dropdown = document.createElement('div');
        this.#dropdown.className = 'cdb-dropdown';

        this.#flipLayout = document.createElement('flip-layout');

        this.#grid = document.createElement('div');
        this.#grid.className = 'cdb-grid';

        this.#flipLayout.appendChild(this.#grid);
        this.#dropdown.appendChild(this.#flipLayout);

        // Append rendered DOM to self
        this.appendChild(this.#strip);
        this.appendChild(this.#dropdown);

        this.#toggle.addEventListener('click', () => this.toggle());
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
        this.#positionCards();
        this.#updateToggleVisibility();
        if (this.expanded) {
            this.collapse();
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

            const imgWrap = document.createElement('div');
            imgWrap.className = 'cdb-card-img';
            imgWrap.dataset.flipKey = item.key;

            const img = document.createElement('img');
            img.alt = item.label;
            if (item.thumbSrc) img.src = item.thumbSrc;
            if (item.fallbackSrc) {
                img.onerror = () => { img.src = item.fallbackSrc; };
            }

            imgWrap.appendChild(img);
            card.appendChild(imgWrap);

            this.#track.appendChild(card);
            this.#cards.push({ element: card, index: i });
        }

        this.#setupDrag();
        this.#setupArrow(this.#navLeft, 1);
        this.#setupArrow(this.#navRight, -1);

        // Prevent native image drag
        this.#track.addEventListener('dragstart', (e) => e.preventDefault());
    }

    #onCardClick(idx) {
        const item = this.#items[idx];
        if (!item) return;

        if (idx !== this.#centerIdx) {
            // Rotate to center first, then emit select
            this.#centerIdx = idx;
            this.#track.style.setProperty('--carousel-speed', '0.85s');
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
            if (item.fallbackSrc) {
                img.onerror = () => { img.src = item.fallbackSrc; };
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

    /** Capture carousel section label positions + underline widths. */
    #captureSectionLabelRects() {
        const rects = new Map();
        for (const sec of this.#sectionLabels) {
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
    #morphSectionLabels(fromRects, toRects, duration, easing) {
        const overlays = [];
        for (const [secIdx, from] of fromRects) {
            const to = toRects.get(secIdx);
            if (!from || !to) continue;

            const phantom = document.createElement('div');
            phantom.className = 'cdb-section-phantom';
            phantom.textContent = from.text;
            phantom.style.cssText = `
                position: fixed; z-index: 1000; pointer-events: none;
                left: ${from.rect.left}px; top: ${from.rect.top}px;
                font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.15em;
                color: rgba(255, 255, 255, 0.3); white-space: nowrap;
            `;

            const fromUW = from.underlineWidth || from.rect.width;
            const bar = document.createElement('div');
            bar.className = 'cdb-section-phantom-bar';
            bar.style.cssText = `
                position: absolute; bottom: 0; left: 0;
                width: ${fromUW}px; height: 1px;
                background: rgba(255, 255, 255, 0.08);
            `;
            phantom.appendChild(bar);
            document.body.appendChild(phantom);
            overlays.push(phantom);

            const toUW = to.underlineWidth || to.rect.width;
            const dx = to.rect.left - from.rect.left;
            const dy = to.rect.top - from.rect.top;

            phantom.animate([
                { transform: 'translate(0, 0)', opacity: 1 },
                { transform: `translate(${dx}px, ${dy}px)`, opacity: 1 }
            ], { duration, easing, fill: 'forwards' });

            bar.animate([
                { width: fromUW + 'px' },
                { width: toUW + 'px' }
            ], { duration, easing, fill: 'forwards' });

            phantom.animate([
                { fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.3)' },
                { fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.35)' }
            ], { duration, easing, fill: 'forwards' });
        }

        setTimeout(() => {
            for (const o of overlays) o.remove();
        }, duration + 50);
    }

    // ── Grid transition animations ──

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
                fill: 'forwards',
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
            this.#strip.appendChild(this.#controls);
        } else {
            this.#strip.appendChild(this.#controls);
            this.#strip.appendChild(this.#container);
        }
    }

    // ── Controls FLIP animation (two-phase expand/collapse) ──

    /** FLIP-animate the controls bar from below to above the container. */
    async #animateControlsToTop(duration) {
        const firstRect = this.#controls.getBoundingClientRect();
        this.#strip.insertBefore(this.#controls, this.#container);
        void this.#controls.offsetHeight;
        const lastRect = this.#controls.getBoundingClientRect();

        const dx = firstRect.left - lastRect.left;
        const dy = firstRect.top - lastRect.top;
        const easing = 'cubic-bezier(0.4, 0, 0.2, 1)';

        this.#controls.style.transform = `translate(${dx}px, ${dy}px)`;
        this.#controls.style.transition = 'none';
        void this.#controls.offsetHeight;

        this.#controls.style.transition = `transform ${duration}ms ${easing}`;
        this.#controls.style.transform = '';

        await new Promise(r => setTimeout(r, duration + 20));
        this.#controls.style.transition = '';
    }

    /** FLIP-animate the controls bar from above back to below the container. */
    async #animateControlsToBottom(duration) {
        const firstRect = this.#controls.getBoundingClientRect();
        this.#strip.appendChild(this.#controls);
        void this.#controls.offsetHeight;
        const lastRect = this.#controls.getBoundingClientRect();

        const dx = firstRect.left - lastRect.left;
        const dy = firstRect.top - lastRect.top;
        const easing = 'cubic-bezier(0.4, 0, 0.2, 1)';

        this.#controls.style.transform = `translate(${dx}px, ${dy}px)`;
        this.#controls.style.transition = 'none';
        void this.#controls.offsetHeight;

        this.#controls.style.transition = `transform ${duration}ms ${easing}`;
        this.#controls.style.transform = '';

        await new Promise(r => setTimeout(r, duration + 20));
        this.#controls.style.transition = '';
    }

    // ═══════════════════════════════════════════════════════
    // ── LAYOUT SYSTEM ──
    // ═══════════════════════════════════════════════════════

    /** Read --card-w from CSS once per layout pass. */
    #readCardW() {
        return parseInt(
            getComputedStyle(document.documentElement).getPropertyValue('--card-w')
        ) || 180;
    }

    /** Compute arc parameters from viewport and card width. Replaces #getArcParams + #getVisibleCount. */
    #computeArcParams(cardW) {
        const viewportW = this.#viewport ? this.#viewport.clientWidth : window.innerWidth;
        const spacing = cardW * 0.55;
        const halfCount = Math.floor((viewportW - cardW) / (2 * spacing));
        const visibleCount = Math.max(3, 2 * Math.max(1, halfCount) + 1);
        const half = Math.floor(visibleCount / 2);
        const dTheta = half > 0 ? this.#arcAngle / half : 0.25;
        const R = this.#arcAngle > 0.01
            ? viewportW / (2 * Math.sin(Math.min(this.#arcAngle, Math.PI / 2 - 0.05)))
            : viewportW;
        return { R, dTheta, half, visibleCount };
    }

    /**
     * Compute full geometry for one card. Pure — no DOM access.
     * Returns CardLayout object or null if fully hidden (|visualOffset| > half + 2).
     */
    #computeCardGeometry(index, element, centerIdx, arcParams, cardW, hasSections) {
        const { R, dTheta, half } = arcParams;
        const total = this.#items.length;

        let offset = index - centerIdx;
        if (total > 1 && this.#infinite) {
            if (offset > total / 2) offset -= total;
            if (offset < -total / 2) offset += total;
        }

        let visualOffset = offset;
        if (hasSections && offset !== 0) {
            const gapCount = this.#countSectionBoundaries(Math.round(centerIdx), index, offset);
            visualOffset = offset + gapCount * SECTION_GAP * Math.sign(offset);
        }

        const abs = Math.abs(visualOffset);
        if (abs > half + 2) return null;

        let cx, cy, ry, tz, sc, opacity, zone;

        if (abs <= half) {
            zone = 1;
            const angle = visualOffset * dTheta;
            cx = R * Math.sin(angle);
            ry = Math.sign(visualOffset) * Math.min(Math.abs(angle) / DEG, 50);
            tz = -abs * 20;
            sc = Math.max(0.65, 1 - abs * 0.1);
            opacity = 1;
            const t = half > 0 ? abs / half : 0;
            cy = -this.#smilePx * t * t;
        } else {
            zone = 2;
            const t = Math.min((abs - half) / 2, 1);
            cx = R * Math.sin(half * dTheta) * Math.sign(visualOffset);
            ry = Math.sign(visualOffset) * (50 + t * 40);
            tz = -half * 20 - t * 30;
            sc = 0.65 * (1 - t);
            opacity = abs > half + 0.5 ? 0 : 1;
            cy = -this.#smilePx;
        }

        // Hover parameters
        const hoverT = half > 0 ? Math.min(abs / half, 1) : 0;
        const hoverLift = 4 * (1 - hoverT);
        const hoverTzBoost = 15 + hoverT * 35;
        const hoverScBoost = 0.03 + hoverT * 0.04;
        const hoverRyOffset = ry * 0.4;

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
            cx, cy, ry, tz, sc, opacity,
            zIndex: Math.max(0, 10 - Math.round(abs)),
            hoverLift, hoverTzBoost, hoverScBoost, hoverRyOffset, hoverCxShift,
            projLeftRest, projRightRest,
            projLeftHover, projRightHover,
        };
    }

    /** Compute per-section span data from #cardLayout. */
    #computeSectionSpans(half) {
        const spans = new Map();
        for (const [, layout] of this.#cardLayout) {
            if (!layout || layout.sectionIndex < 0) continue;
            const vis = Math.abs(layout.visualOffset) <= half;
            if (Math.abs(layout.visualOffset) > half + 2) continue;

            if (!spans.has(layout.sectionIndex)) {
                spans.set(layout.sectionIndex, {
                    leftEdge: layout.projLeftRest,
                    rightEdge: layout.projRightRest,
                    visible: vis,
                });
            } else {
                const s = spans.get(layout.sectionIndex);
                if (layout.projLeftRest < s.leftEdge) s.leftEdge = layout.projLeftRest;
                if (layout.projRightRest > s.rightEdge) s.rightEdge = layout.projRightRest;
                if (vis) s.visible = true;
            }
        }
        return spans;
    }

    /**
     * Master layout computation. Produces FrameLayout and populates #cardLayout.
     * No DOM writes — purely computes data.
     */
    #computeLayout() {
        const cardW = this.#readCardW();
        const arcParams = this.#computeArcParams(cardW);
        const { half } = arcParams;
        const hasSections = this.#items.some(it => it.sectionIndex >= 0);

        this.#cardLayout.clear();
        for (const { element, index } of this.#cards) {
            const geo = this.#computeCardGeometry(index, element, this.#centerIdx, arcParams, cardW, hasSections);
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

        const frame = {
            ...arcParams, cardW,
            numVisibleLeft, numVisibleRight,
            sectionSpans,
            arrowLeftDisabled: !this.#infinite && this.#centerIdx <= 0,
            arrowRightDisabled: !this.#infinite && this.#centerIdx >= this.#items.length - 1,
        };
        this.#lastFrame = frame;
        return frame;
    }

    /** Apply computed layout to DOM elements. */
    #applyLayout(frame) {
        for (const { element } of this.#cards) {
            const layout = this.#cardLayout.get(element);

            element.classList.remove('active');

            if (!layout) {
                element.style.setProperty('--card-opacity', '0');
                element.style.pointerEvents = 'none';
                element.style.zIndex = '0';
                continue;
            }

            element.style.setProperty('--cx', layout.cx + 'px');
            element.style.setProperty('--cy', layout.cy + 'px');
            element.style.setProperty('--ry', layout.ry + 'deg');
            element.style.setProperty('--tz', layout.tz + 'px');
            element.style.setProperty('--sc', String(layout.sc));
            element.style.setProperty('--card-opacity', String(layout.opacity));
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
        this.#numCardsVisibleLeft = frame.numVisibleLeft;
        this.#numCardsVisibleRight = frame.numVisibleRight;

        // Section labels
        this.#applySectionLabels(frame);

        // Schedule hover zone recomputation
        clearTimeout(this.#zoneTimer);
        this.#zoneTimer = setTimeout(() => this.#computeHoverZones(), HOVER_ZONE_DELAY);

        // Apply rest-state masks to center card (transitions with carousel speed)
        this.#applyRestMasks();
    }

    /** Position section labels using projected edges from FrameLayout. */
    #applySectionLabels(frame) {
        for (const sec of this.#sectionLabels) {
            const span = frame.sectionSpans.get(sec.sectionIndex);
            if (!span || !span.visible) {
                sec.element.style.opacity = '0';
                continue;
            }
            sec.element.style.opacity = '';
            sec.element.style.transform = `translateX(${span.leftEdge}px)`;
            sec.element.style.setProperty('--underline-width', (span.rightEdge - span.leftEdge) + 'px');
        }
    }

    // ── Coverflow layout entry point ──

    #positionCards() {
        const frame = this.#computeLayout();
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
                card.classList.toggle('selected', card.dataset.flipKey === this.#selectedKey);
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
        if (this.#activeMoveHandler) {
            document.removeEventListener('mousemove', this.#activeMoveHandler);
            this.#activeMoveHandler = null;
        }
        this.#activeHoverEl = null;
        this.#activeHoverRect = null;
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
            const img = element.querySelector('.cdb-card-img');
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

    /**
     * Apply gradient masks to the center card where adjacent cards' rest-state
     * edges overlap. Since --mask-size is a registered @property and cdb-rest-mask
     * transitions at --carousel-speed, the mask animates with card rotation.
     */
    #applyRestMasks() {
        const centerEl = this.#cards.find(c => c.index === this.#centerIdx)?.element;
        if (!centerEl) return;
        const cd = this.#cardLayout.get(centerEl);
        if (!cd) return;

        // Don't apply rest masks if a card is hovered (hover masks take priority)
        if (this.#hoveredCard) return;

        // Clear existing rest mask state on center card
        centerEl.classList.remove('cdb-mask-left', 'cdb-mask-right', 'cdb-rest-mask');
        centerEl.style.removeProperty('--mask-size');

        const BUFFER = 12;
        const visible = [];
        for (const [, layout] of this.#cardLayout) {
            if (!layout) continue;
            visible.push(layout);
        }
        visible.sort((a, b) => a.cx - b.cx);

        const cIdx = visible.findIndex(v => v.element === centerEl);
        if (cIdx < 0) return;

        for (const side of [-1, +1]) {
            const nIdx = cIdx + side;
            if (nIdx < 0 || nIdx >= visible.length) continue;
            const nd = visible[nIdx];

            // Check if neighbor's near edge projects past center's far edge
            const overlapPx = side > 0
                ? cd.projRightRest - nd.projLeftRest
                : nd.projRightRest - cd.projLeftRest;

            if (overlapPx > 0) {
                const cWidth = cd.projRightRest - cd.projLeftRest;
                const maskPx = overlapPx + BUFFER;
                const maskPct = cWidth > 0 ? Math.min(40, (maskPx / cWidth) * 100) : 0;

                if (maskPct > 0) {
                    centerEl.classList.add(side > 0 ? 'cdb-mask-right' : 'cdb-mask-left', 'cdb-rest-mask');
                    centerEl.style.setProperty('--mask-size', maskPct.toFixed(1) + '%');
                }
            }
        }
    }

    #onTrackMouseMove(e) {
        if (this.#isDragging) return;
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
        this.#applyRestMasks();
    }

    /** Find card element at a given clientX using fresh getBoundingClientRect positions. */
    #findCardAtX(clientX) {
        const visible = [];
        for (const { element } of this.#cards) {
            const opacity = parseFloat(element.style.getPropertyValue('--card-opacity'));
            if (opacity <= 0) continue;
            const img = element.querySelector('.cdb-card-img');
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
            track.style.setProperty('--carousel-speed', '0.85s');
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

                track.style.setProperty('--carousel-speed', '0s');
                this.#positionCards_fractional(this.#dragFractionalCenter);

                // Slower decay for more graceful momentum
                vel *= Math.pow(0.92, dt / 16.67);

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
            if (totalDrag > 5) {
                this.#dragJustEnded = true;
                requestAnimationFrame(() => { this.#dragJustEnded = false; });
            }

            if (Math.abs(this.#dragVelocity) > 0.15) {
                startMomentum();
            } else {
                snapToNearest();
            }
        };

        track.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            cancelMomentum();
            this.#resetHoverState();

            this.#isDragging = true;
            this.#dragJustEnded = false;
            this.#dragStartX = e.clientX;
            this.#dragStartCenter = this.#centerIdx;
            this.#dragFractionalCenter = this.#centerIdx;
            this.#lastDragX = e.clientX;
            this.#lastDragTime = performance.now();
            this.#dragVelocity = 0;

            track.style.setProperty('--carousel-speed', '0s');
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
        const savedCenter = this.#centerIdx;
        this.#centerIdx = fractionalCenter;
        this.#positionCards();
        this.#centerIdx = savedCenter;
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
            this.#track.style.setProperty('--carousel-speed', '0.85s');
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
            // Right arrow (direction=-1): jump by numCardsVisibleLeft
            // Left arrow (direction=1): jump by numCardsVisibleRight
            const jump = direction < 0
                ? this.#numCardsVisibleLeft
                : this.#numCardsVisibleRight;
            navBy(-direction * Math.max(1, jump));
        });
    }

    // ── FLIP helpers ──

    #captureCarouselRects() {
        const rects = new Map();
        for (const { element } of this.#cards) {
            const opacity = parseFloat(element.style.getPropertyValue('--card-opacity') || '1');
            if (opacity < 0.1) continue;
            const img = element.querySelector('.cdb-card-img');
            if (!img) continue;
            rects.set(img.dataset.flipKey, img.getBoundingClientRect());
        }
        return rects;
    }

    #flattenCards() {
        for (const { element } of this.#cards) {
            element.style.setProperty('--ry', '0deg');
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
    return a != null && b != null && a === b;
}

customElements.define('carousel-dropdown-browser', CarouselDropdownBrowser);

export { CarouselDropdownBrowser, CarouselDropdownBrowserCard, CarouselDropdownBrowserSection };
