/**
 * <carousel-dropdown-browser> — reusable coverflow carousel + grid dropdown.
 *
 * Encapsulates the full carousel experience: arc layout, drag-to-scroll,
 * arrow navigation, hover effects, and FLIP-animated expand/collapse
 * to a grid "dropdown" view.
 *
 * @fires item-select   — { key, index, item } when a card is clicked
 * @fires center-change — { key, index } when carousel center changes (drag, arrow)
 * @fires item-delete   — { key, index, item } when grid delete button is clicked
 */

import { TRASH_SVG } from './icons.js';
import { flipAnimate } from './flip-layout.js';
import './flip-layout.js';

const ARROW_LEFT = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M10 3l-5 5 5 5"/></svg>`;
const ARROW_RIGHT = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M6 3l5 5-5 5"/></svg>`;

class CarouselDropdownBrowser extends HTMLElement {
    static observedAttributes = ['arc-angle', 'smile-px', 'flip-duration'];

    // ── Configuration ──
    #arcAngle = 0.85;
    #smilePx = 20;
    #flipDuration = 450;

    // ── Data ──
    #items = [];
    #selectedKey = null;

    // ── Carousel state ──
    #centerIdx = 0;
    #cards = [];           // [{element, index}]
    #dragJustEnded = false;

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

    // ── Public properties ──

    get items() { return this.#items; }
    set items(list) {
        this.#items = Array.isArray(list) ? list : [];
        this.#rebuild();
    }

    get selectedKey() { return this.#selectedKey; }
    set selectedKey(key) {
        this.#selectedKey = key;
        this.#updateActiveHighlight();
    }

    get centerIndex() { return this.#centerIdx; }
    get expanded() { return this.#dropdown?.classList.contains('expanded') ?? false; }

    // ── Attributes ──

    attributeChangedCallback(name, _old, val) {
        if (name === 'arc-angle') this.#arcAngle = parseFloat(val) || 0.85;
        if (name === 'smile-px') this.#smilePx = parseFloat(val) || 20;
        if (name === 'flip-duration') this.#flipDuration = parseInt(val, 10) || 450;
    }

    // ── Lifecycle ──

    connectedCallback() {
        this.#buildDOM();
        this.#attachResizeObserver();
    }

    disconnectedCallback() {
        if (this.#resizeObs) {
            this.#resizeObs.disconnect();
            this.#resizeObs = null;
        }
    }

    // ── Public methods ──

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

        this.#flipLayout.flip(() => {
            this.#renderGridCards();
            this.#flattenCards();
            this.#container.style.transition = 'none';
            this.#dropdown.classList.add('expanded', 'cdb-measuring');
            this.#toggle.classList.add('active');
            void this.#grid.offsetHeight;
            this.#container.style.transition = '';
            this.#dropdown.classList.remove('cdb-measuring');
        }, { firstRects });

        setTimeout(() => {
            this.#scrollParent = this.closest('.gallery-main') || this.parentElement;
            if (this.#scrollParent && this.#scrollParent.scrollHeight > this.#scrollParent.clientHeight) {
                this.#scrollParent.scrollTo({ top: this.#scrollParent.scrollHeight, behavior: 'smooth' });
            }
        }, this.#flipDuration + 30);

        this.dispatchEvent(new CustomEvent('expand-change', { detail: { expanded: true } }));
    }

    collapse() {
        if (!this.expanded) return;

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
        flipAnimate(imgs, el => el.dataset.flipKey, firstRects, {
            duration: this.#flipDuration,
        });

        this.dispatchEvent(new CustomEvent('expand-change', { detail: { expanded: false } }));
    }

    toggle() {
        if (this.expanded) this.collapse();
        else this.expand();
    }

    // ── DOM construction ──

    #buildDOM() {
        this.innerHTML = `
            <div class="cdb-strip">
                <div class="cdb-controls">
                    <button class="gallery-arrow cdb-arrow cdb-arrow-left" aria-label="Previous">${ARROW_LEFT}</button>
                    <button class="cdb-toggle" style="display:none" aria-label="View all">
                        <span class="cdb-chevron"><span class="cdb-chevron-bar cdb-chevron-l"></span><span class="cdb-chevron-bar cdb-chevron-r"></span></span>
                    </button>
                    <button class="gallery-arrow cdb-arrow cdb-arrow-right" aria-label="Next">${ARROW_RIGHT}</button>
                </div>
                <div class="cdb-container">
                    <div class="cdb-viewport">
                        <div class="cdb-track"></div>
                    </div>
                </div>
            </div>
            <div class="cdb-dropdown">
                <flip-layout>
                    <div class="cdb-grid"></div>
                </flip-layout>
            </div>`;

        this.#strip = this.querySelector('.cdb-strip');
        this.#controls = this.querySelector('.cdb-controls');
        this.#container = this.querySelector('.cdb-container');
        this.#viewport = this.querySelector('.cdb-viewport');
        this.#track = this.querySelector('.cdb-track');
        this.#navLeft = this.querySelector('.cdb-arrow-left');
        this.#navRight = this.querySelector('.cdb-arrow-right');
        this.#toggle = this.querySelector('.cdb-toggle');
        this.#dropdown = this.querySelector('.cdb-dropdown');
        this.#grid = this.querySelector('.cdb-grid');
        this.#flipLayout = this.querySelector('flip-layout');

        this.#toggle.addEventListener('click', () => this.toggle());
    }

    #attachResizeObserver() {
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

            card.addEventListener('click', () => {
                if (this.#dragJustEnded) return;
                this.#onCardClick(i);
            });

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

        for (let i = 0; i < this.#items.length; i++) {
            const item = this.#items[i];
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

        for (const { element, index } of this.#cards) {
            let offset = index - this.#centerIdx;
            if (total > 1) {
                if (offset > total / 2) offset -= total;
                if (offset < -total / 2) offset += total;
            }
            const abs = Math.abs(offset);

            element.classList.remove('active');

            if (abs > half + 2) {
                element.style.setProperty('--card-opacity', '0');
                element.style.pointerEvents = 'none';
                element.style.zIndex = '0';
            } else {
                let cx, cy, ry, tz, sc, opacity;

                if (abs <= half) {
                    // Zone 1: Visible arc
                    const angle = offset * dTheta;
                    cx = R * Math.sin(angle);
                    const ryDeg = Math.abs(angle) * (180 / Math.PI);
                    ry = Math.sign(offset) * Math.min(ryDeg, 50);
                    tz = abs < 1 ? 40 - 60 * abs : -abs * 20;
                    sc = Math.max(0.65, 1 - abs * 0.1);
                    opacity = 1;
                    const t = half > 0 ? abs / half : 0;
                    cy = -this.#smilePx * t * t;
                } else {
                    // Zone 2: Exit — clip instead of fade
                    const t = Math.min((abs - half) / 2, 1);
                    const edgeAngle = half * dTheta;
                    cx = R * Math.sin(edgeAngle) * Math.sign(offset);
                    ry = Math.sign(offset) * (50 + t * 40);
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

                // Highlight selected
                if (item_key_matches(element.dataset.flipKey, this.#selectedKey)) {
                    element.classList.add('active');
                }
            }
        }
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
        for (const c of this.#cards) {
            c.element.classList.remove('hover-displaced', 'active-shrunk');
            c.element.style.pointerEvents = '';
        }
        if (this.#activeMoveHandler) {
            document.removeEventListener('mousemove', this.#activeMoveHandler);
            this.#activeMoveHandler = null;
        }
        this.#activeHoverEl = null;
        this.#activeHoverRect = null;
    }

    // ── Drag-to-scroll ──

    #setupDrag() {
        const track = this.#track;

        const wrapCenter = (c) => {
            const t = this.#items.length;
            return ((c % t) + t) % t;
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
            this.#centerIdx = ((this.#centerIdx + n) % total + total) % total;
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
            const { half } = this.#getArcParams();
            navBy(direction * Math.min(half, 3));
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

export { CarouselDropdownBrowser };
