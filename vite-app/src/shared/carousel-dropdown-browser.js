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

const SECTION_GAP = 0.4; // extra card-widths of spacing at section boundaries

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
    static observedAttributes = ['arc-angle', 'smile-px', 'flip-duration', 'controls-position', 'section-label-position', 'section-label-align', 'infinite'];

    // ── Configuration ──
    #arcAngle = 0.85;
    #smilePx = 20;
    #flipDuration = 450;
    #controlsPosition = 'above'; // 'above' | 'below'
    #sectionLabelPosition = 'below'; // 'above' | 'below' (relative to carousel)
    #sectionLabelAlign = 'center'; // 'left' | 'center' | 'right'
    #infinite = true;              // wrap around or clamp at edges

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
    #cardLayout = new Map(); // element → { visualOffset, cx, ry, tz, sc, hoverTzBoost, hoverScBoost, hoverRyOffset, hoverCxShift }
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
    #sectionIndicator = null;
    #sectionNameEl = null;


    // ── MutationObserver ──
    #observer = null;
    #updatePending = false;
    #domBuilt = false;
    #currentSectionLabel = '';

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
        if (this.expanded) return;
        const firstRects = this.#captureCarouselRects();

        const dur = this.#flipDuration;

        this.#flipLayout.flip(() => {
            this.#renderGridCards();
            this.#flattenCards();
            this.#dropdown.classList.add('expanded', 'cdb-measuring');
            this.#toggle.classList.add('active');
            void this.#grid.offsetHeight;
            this.#dropdown.classList.remove('cdb-measuring');
        }, { firstRects });

        // Track 2: Section headers fade-slide in
        this.#animateGridHeadersIn(dur);

        // Track 3: Card name overlays fade in
        this.#animateGridNamesIn(dur);

        // Clean up inline opacity after all animations finish
        setTimeout(() => this.#cleanupGridAnimationStyles(), dur + 50);

        setTimeout(() => {
            this.#scrollParent = this.closest('.gallery-main') || this.parentElement;
            if (this.#scrollParent && this.#scrollParent.scrollHeight > this.#scrollParent.clientHeight) {
                this.#scrollParent.scrollTo({ top: this.#scrollParent.scrollHeight, behavior: 'smooth' });
            }
        }, dur + 30);

        this.dispatchEvent(new CustomEvent('expand-change', { detail: { expanded: true } }));
    }

    collapse() {
        if (!this.expanded) return;
        const dur = this.#flipDuration;

        // Phase 1: Fade out headers and names
        this.#animateGridHeadersOut(dur);
        this.#animateGridNamesOut(dur);

        // Phase 2: After brief delay, run card FLIP
        const cardDelay = Math.round(dur * 0.3);
        setTimeout(() => {
            // Capture grid positions
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

            // Animate carousel images from grid positions
            const imgs = [];
            for (const { element } of this.#cards) {
                const img = element.querySelector('.cdb-card-img');
                if (img) imgs.push(img);
            }
            flipAnimate(imgs, el => el.dataset.flipKey, firstRects, { duration: dur });

            this.dispatchEvent(new CustomEvent('expand-change', { detail: { expanded: false } }));
        }, cardDelay);
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
        if (name === 'section-label-position') {
            this.#sectionLabelPosition = val === 'above' ? 'above' : 'below';
            this.#appendStripChildren();
        }
        if (name === 'section-label-align') {
            this.#sectionLabelAlign = val === 'left' ? 'left' : val === 'right' ? 'right' : 'center';
            if (this.#sectionIndicator) this.#sectionIndicator.style.textAlign = this.#sectionLabelAlign;
        }
        if (name === 'infinite') {
            this.#infinite = val !== null && val !== 'false';
        }
    }

    // ── Lifecycle ──

    connectedCallback() {
        if (!this.#domBuilt) {
            this.#buildDOM();
            this.#domBuilt = true;
        }
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

        this.#viewport.appendChild(this.#track);
        this.#container.appendChild(this.#viewport);

        // Section indicator
        this.#sectionIndicator = document.createElement('div');
        this.#sectionIndicator.className = 'cdb-section-indicator';
        this.#sectionNameEl = document.createElement('span');
        this.#sectionNameEl.className = 'cdb-section-name';
        this.#sectionIndicator.appendChild(this.#sectionNameEl);
        this.#sectionIndicator.style.textAlign = this.#sectionLabelAlign;

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
        this.#positionCards();
        this.#updateToggleVisibility();
        this.#updateSectionIndicator();
        if (this.expanded) {
            this.collapse();
        }
    }

    #updateToggleVisibility() {
        if (this.#toggle) {
            this.#toggle.style.display = this.#items.length > this.#getVisibleCount() ? '' : 'none';
        }
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

    #updateSectionIndicator() {
        if (!this.#sectionNameEl) return;
        const item = this.#items[Math.round(this.#centerIdx)];
        const label = item?.section || '';
        if (label !== this.#currentSectionLabel) {
            // Fade out, update, fade in
            this.#sectionNameEl.classList.add('fading');
            setTimeout(() => {
                this.#sectionNameEl.textContent = label;
                this.#currentSectionLabel = label;
                this.#sectionNameEl.classList.remove('fading');
            }, 150);
        }
    }

    // ── Grid transition animations ──

    #animateGridHeadersIn(dur) {
        const headers = this.#grid.querySelectorAll('.cdb-grid-section-header');
        headers.forEach((h, i) => {
            h.animate([
                { opacity: 0, transform: 'translateY(-8px)' },
                { opacity: 1, transform: 'translateY(0)' }
            ], {
                duration: dur * 0.65,
                delay: dur * 0.2 + i * 50,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                fill: 'backwards',
            });
        });
    }

    #animateGridHeadersOut(dur) {
        const headers = this.#grid.querySelectorAll('.cdb-grid-section-header');
        headers.forEach((h, i) => {
            h.animate([
                { opacity: 1, transform: 'translateY(0)' },
                { opacity: 0, transform: 'translateY(-8px)' }
            ], {
                duration: dur * 0.35,
                delay: i * 30,
                easing: 'ease-in',
                fill: 'forwards',
            });
        });
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
                fill: 'forwards',
            });
        }
    }

    #cleanupGridAnimationStyles() {
        for (const h of this.#grid.querySelectorAll('.cdb-grid-section-header')) h.style.opacity = '';
        for (const n of this.#grid.querySelectorAll('.cdb-grid-card-name')) n.style.opacity = '';
    }

    #appendStripChildren() {
        if (!this.#strip) return;
        const above = this.#sectionLabelPosition === 'above';
        if (this.#controlsPosition === 'below') {
            if (above) this.#strip.appendChild(this.#sectionIndicator);
            this.#strip.appendChild(this.#container);
            if (!above) this.#strip.appendChild(this.#sectionIndicator);
            this.#strip.appendChild(this.#controls);
        } else {
            this.#strip.appendChild(this.#controls);
            if (above) this.#strip.appendChild(this.#sectionIndicator);
            this.#strip.appendChild(this.#container);
            if (!above) this.#strip.appendChild(this.#sectionIndicator);
        }
    }

    // ── Arc geometry ──

    #getArcParams() {
        const viewportW = this.#viewport ? this.#viewport.clientWidth : window.innerWidth;
        const visible = this.#getVisibleCount();
        const half = Math.floor(visible / 2);
        const dTheta = half > 0 ? this.#arcAngle / half : 0.25;
        const R = this.#arcAngle > 0.01
            ? viewportW / (2 * Math.sin(Math.min(this.#arcAngle, Math.PI / 2 - 0.05)))
            : viewportW;
        return { R, dTheta, half };
    }

    #getVisibleCount() {
        const cardW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-w')) || 180;
        const spacing = cardW * 0.55;
        const w = this.#viewport ? this.#viewport.clientWidth : window.innerWidth;
        const half = Math.floor((w - cardW) / (2 * spacing));
        return Math.max(3, 2 * Math.max(1, half) + 1);
    }

    #baseCx(offset) {
        const { R, dTheta } = this.#getArcParams();
        return R * Math.sin(offset * dTheta);
    }

    #baseCy(offset) {
        const { half } = this.#getArcParams();
        if (half <= 0) return 0;
        const t = Math.min(Math.abs(offset) / half, 1);
        return -this.#smilePx * t * t;
    }

    // ── Coverflow layout engine ──

    #positionCards() {
        const { R, dTheta, half } = this.#getArcParams();
        const total = this.#items.length;
        const hasSections = this.#items.some(it => it.sectionIndex >= 0);
        const cardW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-w')) || 180;
        this.#cardLayout.clear();

        for (const { element, index } of this.#cards) {
            let offset = index - this.#centerIdx;
            if (total > 1 && this.#infinite) {
                if (offset > total / 2) offset -= total;
                if (offset < -total / 2) offset += total;
            }

            // Add section gap
            let visualOffset = offset;
            if (hasSections && offset !== 0) {
                const gapCount = this.#countSectionBoundaries(this.#centerIdx, index, offset);
                visualOffset = offset + gapCount * SECTION_GAP * Math.sign(offset);
            }

            const abs = Math.abs(visualOffset);

            element.classList.remove('active');

            if (abs > half + 2) {
                element.style.setProperty('--card-opacity', '0');
                element.style.pointerEvents = 'none';
                element.style.zIndex = '0';
            } else {
                let cx, cy, ry, tz, sc, opacity;

                if (abs <= half) {
                    // Zone 1: Visible arc
                    const angle = visualOffset * dTheta;
                    cx = R * Math.sin(angle);
                    const ryDeg = Math.abs(angle) * (180 / Math.PI);
                    ry = Math.sign(visualOffset) * Math.min(ryDeg, 50);
                    tz = -abs * 20;
                    sc = Math.max(0.65, 1 - abs * 0.1);
                    opacity = 1;
                    const t = half > 0 ? abs / half : 0;
                    cy = -this.#smilePx * t * t;
                } else {
                    // Zone 2: Exit — clip instead of fade
                    const t = Math.min((abs - half) / 2, 1);
                    const edgeAngle = half * dTheta;
                    cx = R * Math.sin(edgeAngle) * Math.sign(visualOffset);
                    ry = Math.sign(visualOffset) * (50 + t * 40);
                    tz = -half * 20 - t * 30;
                    sc = 0.65 * (1 - t);
                    opacity = abs > half + 0.5 ? 0 : 1;  // sharp cutoff, no fade
                    cy = -this.#smilePx;
                }

                element.style.setProperty('--cx', cx + 'px');
                element.style.setProperty('--cy', cy + 'px');
                element.style.setProperty('--ry', ry + 'deg');
                element.style.setProperty('--tz', tz + 'px');
                element.style.setProperty('--sc', String(sc));
                element.style.setProperty('--card-opacity', String(opacity));
                element.style.zIndex = String(Math.max(0, 10 - Math.round(abs)));
                element.style.pointerEvents = abs <= half + 0.5 ? '' : 'none';

                // Hover intensity scales with distance from center
                const hoverT = half > 0 ? Math.min(abs / half, 1) : 0;
                const hoverLift = 4 * (1 - hoverT);          // 4px center → 0px edge
                const hoverTzBoost = 15 + hoverT * 35;       // 15px center → 50px edge
                const hoverScBoost = 0.03 + hoverT * 0.04;   // 0.03 center → 0.07 edge
                const hoverRyOffset = ry * 0.4;              // rotate 40% toward viewer
                // Exact projection: pin the outer edge in place so hover never overflows.
                const side = Math.sign(visualOffset);
                let hoverCxShift = 0;
                if (side !== 0) {
                    const DEG = Math.PI / 180;
                    const edgeRest  = projOuterEdge(cardW, sc, tz, ry * DEG, 1200, side);
                    const edgeHover = projOuterEdge(cardW, sc + hoverScBoost, tz + hoverTzBoost, (ry - hoverRyOffset) * DEG, 1200, side);
                    hoverCxShift = edgeRest - edgeHover;
                }
                element.style.setProperty('--hover-lift', hoverLift + 'px');
                element.style.setProperty('--hover-ry', hoverRyOffset + 'deg');
                element.style.setProperty('--hover-tz', hoverTzBoost + 'px');
                element.style.setProperty('--hover-sc', String(hoverScBoost));
                element.style.setProperty('--hover-cx', hoverCxShift + 'px');

                // Store layout data for mask computation during hover
                this.#cardLayout.set(element, {
                    visualOffset, cx, ry, tz, sc,
                    hoverTzBoost, hoverScBoost, hoverRyOffset, hoverCxShift,
                });

                // Highlight selected
                if (item_key_matches(element.dataset.flipKey, this.#selectedKey)) {
                    element.classList.add('active');
                }
            }
        }

        // Count visible cards on each side of center
        let nLeft = 0, nRight = 0;
        for (const [, d] of this.#cardLayout) {
            if (d.visualOffset < 0 && Math.abs(d.visualOffset) <= half) nLeft++;
            if (d.visualOffset > 0 && Math.abs(d.visualOffset) <= half) nRight++;
        }
        this.#numCardsVisibleLeft = nLeft;
        this.#numCardsVisibleRight = nRight;

        // Disable arrows at edges when not infinite
        if (!this.#infinite) {
            this.#navLeft.disabled = this.#centerIdx <= 0;
            this.#navRight.disabled = this.#centerIdx >= this.#items.length - 1;
        } else {
            this.#navLeft.disabled = false;
            this.#navRight.disabled = false;
        }

        this.#updateSectionIndicator();
        // Delay zone computation until card transitions settle (0.85s default)
        clearTimeout(this.#zoneTimer);
        this.#zoneTimer = setTimeout(() => this.#computeHoverZones(), 900);
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

    // ── Hover displacement ──

    #computeHoverDisplacement(hoveredIdx) {
        const result = new Map();
        const cardW = parseInt(
            getComputedStyle(document.documentElement).getPropertyValue('--card-w')
        ) || 180;
        const total = this.#items.length;

        const GAP = 8;
        const fullPerspSc = 1200 / (1200 - 40);
        const fullHalfW = (cardW / 2) * fullPerspSc;

        const wrapOffset = (idx) => {
            let d = idx - this.#centerIdx;
            if (total > 1) {
                if (d > total / 2) d -= total;
                if (d < -total / 2) d += total;
            }
            return d;
        };

        const halfWAtOffset = (off) => {
            if (off === 0) return fullHalfW;
            const abs = Math.abs(off);
            const sc = Math.max(0.65, 1 - abs * 0.1);
            const tz = -abs * 20;
            return (cardW / 2) * sc * (1200 / (1200 - tz));
        };

        const hoveredOffset = wrapOffset(hoveredIdx);
        if (hoveredOffset === 0) return result;

        const dir = hoveredOffset > 0 ? -1 : 1;
        const inwardCards = [];
        for (const c of this.#cards) {
            if (c.index === hoveredIdx) continue;
            const off = wrapOffset(c.index);
            const inward = off * dir;
            const hovInward = hoveredOffset * dir;
            if (inward >= -1 && inward < hovInward) {
                inwardCards.push({ index: c.index, offset: off });
            }
        }
        inwardCards.sort((a, b) => Math.abs(b.offset) - Math.abs(a.offset));

        const hoveredBaseCx = this.#baseCx(hoveredOffset);
        const positions = new Map();
        positions.set(hoveredIdx, hoveredBaseCx);

        let prevIdx = hoveredIdx;
        let prevHalfW = fullHalfW;

        for (const inner of inwardCards) {
            const innerBaseCx = this.#baseCx(inner.offset);
            const innerHW = halfWAtOffset(inner.offset);
            const prevCx = positions.get(prevIdx);

            const dist = Math.abs(innerBaseCx - prevCx);
            const minDist = prevHalfW + innerHW + GAP;

            if (dist < minDist) {
                const sign = innerBaseCx >= prevCx ? 1 : -1;
                const displaced = innerBaseCx + sign * (minDist - dist);
                result.set(inner.index, displaced);
                positions.set(inner.index, displaced);
            } else {
                positions.set(inner.index, innerBaseCx);
            }

            prevIdx = inner.index;
            prevHalfW = innerHW;
        }

        return result;
    }

    #resetHoverState() {
        if (this.#hoveredCard) {
            this.#hoveredCard.classList.remove('cdb-hovered');
            this.#hoveredCard = null;
        }
        for (const c of this.#cards) {
            c.element.classList.remove('hover-displaced', 'active-shrunk', 'cdb-mask-left', 'cdb-mask-right');
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
            element.classList.remove('cdb-mask-left', 'cdb-mask-right');
            element.style.removeProperty('--mask-size');
        }
        if (!hoveredEl) return;

        const hd = this.#cardLayout.get(hoveredEl);
        if (!hd) return;

        const cardW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-w')) || 180;
        const DEG = Math.PI / 180;
        const BUFFER = 16; // px extra fade beyond overlap

        // Build sorted visible list
        const visible = [];
        for (const { element } of this.#cards) {
            const d = this.#cardLayout.get(element);
            if (!d) continue;
            visible.push({ element, data: d });
        }
        visible.sort((a, b) => a.data.cx - b.data.cx);

        const hIdx = visible.findIndex(v => v.element === hoveredEl);
        if (hIdx < 0) return;

        // Mask both left and right neighbors
        for (const side of [-1, +1]) {
            const nIdx = hIdx + side;
            if (nIdx < 0 || nIdx >= visible.length) continue;

            const nd = visible[nIdx].data;
            const nel = visible[nIdx].element;

            // Hovered card's edge facing this neighbor
            const hoveredEdge = hd.cx
                + projOuterEdge(cardW, hd.sc + hd.hoverScBoost, hd.tz + hd.hoverTzBoost,
                    (hd.ry - hd.hoverRyOffset) * DEG, 1200, side)
                + hd.hoverCxShift;

            // Neighbor's edge facing the hovered card
            const neighborEdge = nd.cx
                + projOuterEdge(cardW, nd.sc, nd.tz, nd.ry * DEG, 1200, -side);

            // Overlap: how far the hovered card extends into the neighbor
            const overlap = side * (hoveredEdge - neighborEdge);

            if (overlap > 0) {
                const nLeftEdge = projOuterEdge(cardW, nd.sc, nd.tz, nd.ry * DEG, 1200, -1);
                const nRightEdge = projOuterEdge(cardW, nd.sc, nd.tz, nd.ry * DEG, 1200, +1);
                const nWidth = nRightEdge - nLeftEdge;
                const maskPx = overlap + BUFFER;
                const maskPct = nWidth > 0 ? Math.min(90, (maskPx / nWidth) * 100) : 35;

                // side > 0 → neighbor is to the right → mask its LEFT edge
                // side < 0 → neighbor is to the left → mask its RIGHT edge
                nel.classList.add(side > 0 ? 'cdb-mask-left' : 'cdb-mask-right');
                nel.style.setProperty('--mask-size', maskPct.toFixed(1) + '%');
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
    }

    #onTrackClick(e) {
        if (this.#dragJustEnded) return;
        const x = e.clientX;
        let found = null;
        for (const zone of this.#hoverZones) {
            if (x >= zone.left && x < zone.right) {
                found = zone.element;
                break;
            }
        }
        if (!found) return;
        // Find the card index from the element
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
            const { R, dTheta } = this.#getArcParams();
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
            const { R, dTheta } = this.#getArcParams();
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
