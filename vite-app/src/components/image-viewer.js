/**
 * <image-viewer> — unified image/canvas/video display with alt-text overlay,
 * controls bar, and fullscreen mode.
 *
 * Used for gallery image display and generate preview.
 * Light DOM — theme CSS cascades in naturally.
 *
 * @fires alt-text-toggle  { visible }           — alt-text visibility changed
 * @fires fullscreen-open  {}                    — fullscreen overlay opened
 * @fires fullscreen-close { wasAltVisible }     — fullscreen overlay closed
 * @fires context-action   { action, ... }       — fullscreen context menu action
 * @fires media-click      {}                    — click on media element
 * @fires media-loaded     {}                    — media finished loading after transition
 * @fires canvas-error     {}                    — WebGL/canvas error
 */

import { CLOSE_SVG, FULLSCREEN_SVG } from './icons.js';

class ImageViewer extends HTMLElement {

    // ── Internal state ──

    /** @type {'image'|'canvas'|'video'} */
    #mode = 'image';
    #altVisible = false;
    #fullscreen = false;
    #fsAltVisible = false;
    #transitioning = false;
    #loading = false;
    #error = false;
    /** @type {number|null} */
    #progress = null;
    #selectionFadeTimer = 0;
    #controlsTimer = 0;
    #controlsActive = false;
    #controlsHovered = false;   // mouse is over wrap
    #onDocClick = null;          // bound document click handler

    /** @type {HTMLElement|null} */
    #fullscreenOverlay = null;

    // ── DOM refs (populated in connectedCallback) ──
    /** @type {HTMLElement} */  #wrap;
    /** @type {HTMLImageElement} */  #img;
    /** @type {HTMLCanvasElement} */ #canvas;
    /** @type {HTMLVideoElement} */  #video;
    /** @type {HTMLElement} */  #altOverlay;
    /** @type {HTMLElement} */  #loadingOverlay;
    /** @type {HTMLElement} */  #errorOverlay;
    /** @type {HTMLElement} */  #progressOverlay;
    /** @type {HTMLElement} */  #controlsEl;

    // ── Context menu config ──
    /** @type {Array<{html: string, action: string}|'sep'|{label: string}|{html: string, group: string, items: Array}>} */
    #ctxMenuItems = [];
    /** @type {((action: string, data?: any) => void)|null} */
    #ctxMenuHandler = null;

    // ── Alt content builder (provided by page) ──
    /** @type {((opts: {wrapExtras?: boolean}) => DocumentFragment|null)|null} */
    #buildAltContent = null;

    connectedCallback() {
        if (this.#wrap) return; // already initialized

        // Build internal DOM
        this.#wrap = document.createElement('div');
        this.#wrap.className = 'iv-wrap';

        this.#img = document.createElement('img');
        this.#img.className = 'iv-media iv-img';
        this.#img.alt = '';

        this.#canvas = document.createElement('canvas');
        this.#canvas.className = 'iv-media iv-canvas hidden';

        this.#video = document.createElement('video');
        this.#video.className = 'iv-media iv-video hidden';
        this.#video.controls = true;
        this.#video.loop = true;
        this.#video.playsInline = true;

        this.#altOverlay = document.createElement('div');
        this.#altOverlay.className = 'iv-overlay iv-alt-text';

        this.#loadingOverlay = document.createElement('div');
        this.#loadingOverlay.className = 'iv-overlay iv-loading hidden';
        this.#loadingOverlay.innerHTML = '<div class="iv-spinner"></div>';

        this.#errorOverlay = document.createElement('div');
        this.#errorOverlay.className = 'iv-overlay iv-error hidden';

        this.#progressOverlay = document.createElement('div');
        this.#progressOverlay.className = 'iv-overlay iv-progress hidden';
        this.#progressOverlay.innerHTML =
            '<div class="iv-progress-bar"><div class="iv-progress-fill"></div></div>' +
            '<div class="iv-progress-label"></div>';

        this.#wrap.append(
            this.#img, this.#canvas, this.#video,
            this.#altOverlay, this.#loadingOverlay, this.#errorOverlay, this.#progressOverlay
        );

        this.#controlsEl = document.createElement('div');
        this.#controlsEl.className = 'iv-controls';

        this.append(this.#wrap, this.#controlsEl);

        // Set initial mode from attribute
        const attrMode = this.getAttribute('mode');
        if (attrMode === 'canvas' || attrMode === 'video') {
            this.#mode = attrMode;
            this.#syncModeVisibility();
        }

        this.#attachListeners();
    }

    disconnectedCallback() {
        clearTimeout(this.#selectionFadeTimer);
        clearTimeout(this.#controlsTimer);
        if (this.#onDocClick) {
            document.removeEventListener('mousedown', this.#onDocClick);
            this.#onDocClick = null;
        }
        if (this.#fullscreenOverlay) {
            if (this.#fullscreenOverlay._fsResSync) {
                document.removeEventListener('resolutionchange', this.#fullscreenOverlay._fsResSync);
            }
            this.#fullscreenOverlay.remove();
            this.#fullscreenOverlay = null;
            this.#fullscreen = false;
        }
    }

    // ── Public properties ──

    get src() { return this.#img.src; }
    set src(v) { this.#img.src = v; }

    get alt() { return this.#img.alt; }
    set alt(v) { this.#img.alt = v; }

    /** Descriptive text shown in alt-text overlay (set via property, not attribute). */
    #altText = '';
    get altText() { return this.#altText; }
    set altText(v) {
        this.#altText = v || '';
        if (this.#altVisible) this.#renderAltText();
    }

    get mode() { return this.#mode; }
    set mode(v) {
        if (v !== 'image' && v !== 'canvas' && v !== 'video') return;
        this.#mode = v;
        this.#syncModeVisibility();
    }

    get loading() { return this.#loading; }
    set loading(v) {
        this.#loading = !!v;
        this.#loadingOverlay.classList.toggle('hidden', !this.#loading);
    }

    get error() { return this.#error; }
    set error(v) {
        this.#error = !!v;
        this.#errorOverlay.classList.toggle('hidden', !this.#error);
    }

    get progress() { return this.#progress; }
    set progress(v) {
        this.#progress = v;
        if (v == null) {
            this.#progressOverlay.classList.add('hidden');
        } else {
            this.#progressOverlay.classList.remove('hidden');
            const fill = this.#progressOverlay.querySelector('.iv-progress-fill');
            if (fill) fill.style.width = v + '%';
        }
    }

    get altVisible() { return this.#altVisible; }
    get isFullscreen() { return this.#fullscreen; }

    // ── Public methods ──

    /**
     * Fade-transition to new media. Used by gallery for selection changes.
     * @param {object} opts
     * @param {string} opts.src — image source
     * @param {string} [opts.alt] — alt attribute
     * @param {string} [opts.altText] — descriptive overlay text
     * @param {string} [opts.video] — if provided, switches to video mode
     * @param {number} [opts.fadeDuration=250] — fade-out duration in ms
     * @param {() => void} [opts.onSwap] — called at the midpoint when content is hidden
     * @returns {Promise<void>} resolves when fade-in completes
     */
    setMedia({ src, alt, altText, video, fadeDuration = 250, onSwap } = {}) {
        return new Promise((resolve) => {
            // Fade out
            this.#img.style.opacity = '0';
            if (this.#altVisible) this.#altOverlay.classList.add('fading');

            clearTimeout(this.#selectionFadeTimer);

            this.#selectionFadeTimer = setTimeout(() => {
                // Swap content
                if (alt !== undefined) this.#img.alt = alt;
                if (altText !== undefined) this.#altText = altText;
                if (this.#altVisible) this.#renderAltText();

                if (video) {
                    this.mode = 'video';
                    this.#video.src = video;
                } else {
                    this.mode = 'image';
                }

                if (onSwap) onSwap();

                // Set src and wait for load
                this.#img.addEventListener('load', () => {
                    this.#img.style.opacity = '1';
                    if (this.#altVisible) this.#altOverlay.classList.remove('fading');
                    this.dispatchEvent(new CustomEvent('media-loaded'));
                    resolve();
                }, { once: true });

                if (src) this.#img.src = src;

                // Sync fullscreen if open
                if (this.#fullscreen) this.#syncFullscreenMedia();
            }, fadeDuration);
        });
    }

    /** Show or set video source. Pass null to switch back to image. */
    setVideo(src) {
        if (src) {
            this.#video.src = src;
            this.mode = 'video';
        } else {
            this.mode = 'image';
        }
    }

    /** Get the internal canvas element (for worker bridge). */
    getCanvas() { return this.#canvas; }

    /** Get the internal img element. */
    getImg() { return this.#img; }

    /** Get the internal video element. */
    getVideo() { return this.#video; }

    /** Get the visual wrap element. */
    getWrap() { return this.#wrap; }

    /** Get the alt-text overlay element. */
    getAltOverlay() { return this.#altOverlay; }

    /** Get the loading overlay element. */
    getLoadingOverlay() { return this.#loadingOverlay; }

    /** Get the error overlay element. */
    getErrorOverlay() { return this.#errorOverlay; }

    /** Replace canvas with a fresh one (WebGL context recovery). Returns the new canvas. */
    replaceCanvas() {
        const fresh = document.createElement('canvas');
        fresh.className = this.#canvas.className;
        this.#canvas.replaceWith(fresh);
        this.#canvas = fresh;
        this.#canvas.setAttribute('data-tooltip-click', '');
        return fresh;
    }

    /** Show alt-text overlay. */
    showAltText() {
        if (!this.#altText) return;
        this.#renderAltText();
        this.#altOverlay.classList.add('visible');
        this.#altVisible = true;
        this.classList.add('alt-text-shown');
        this.dispatchEvent(new CustomEvent('alt-text-toggle', { detail: { visible: true } }));
    }

    /** Hide alt-text overlay. */
    dismissAltText(resetScroll = false) {
        this.#altOverlay.classList.remove('visible');
        if (resetScroll) this.#altOverlay.scrollTop = 0;
        this.#altVisible = false;
        this.classList.remove('alt-text-shown');
        if (this.#controlsHovered) this.#showControlsPersistent();
        this.dispatchEvent(new CustomEvent('alt-text-toggle', { detail: { visible: false } }));
    }

    /** Inject controls (fullscreen btn, resolution dropdown, etc.) into the controls bar. */
    setControls(...elements) {
        this.#controlsEl.replaceChildren(...elements);
    }

    /** Provide the alt-content builder function (for fullscreen structured alt text). */
    setBuildAltContent(fn) {
        this.#buildAltContent = fn;
    }

    /**
     * Configure fullscreen context menu.
     * @param {Array} items — menu item configs
     * @param {(action: string, data?: any) => void} handler — action handler
     */
    setContextMenu(items, handler) {
        this.#ctxMenuItems = items;
        this.#ctxMenuHandler = handler;
    }

    /** Get the bounding rect of the visual wrap (for external FLIP calculations). */
    getBoundingMediaRect() {
        return this.#wrap.getBoundingClientRect();
    }

    /** Get the current media element (img, canvas, or video). */
    getActiveMedia() {
        if (this.#mode === 'video') return this.#video;
        if (this.#mode === 'canvas') return this.#canvas;
        return this.#img;
    }

    /** Set error overlay HTML content. */
    setErrorContent(html) {
        this.#errorOverlay.innerHTML = html;
    }

    /** Set progress label text. */
    setProgressLabel(text) {
        const label = this.#progressOverlay.querySelector('.iv-progress-label');
        if (label) label.textContent = text;
    }

    // ── Fullscreen ──

    async openFullscreen(opts = {}) {
        if (this.#fullscreenOverlay) return;

        const wrapRect = this.#wrap.getBoundingClientRect();
        const aspectRatio = wrapRect.width / wrapRect.height;
        const finalRect = this.#computeContainedRect(aspectRatio);

        const overlay = document.createElement('div');
        overlay.className = 'fullscreen-overlay';

        // Clone or create media
        const isVideo = this.#mode === 'video';
        let media;
        if (isVideo) {
            media = document.createElement('video');
            media.src = this.#video.src;
            media.controls = true;
            media.loop = true;
            media.autoplay = true;
            media.playsInline = true;
        } else if (opts.captureFrame) {
            media = document.createElement('img');
            media.src = typeof opts.captureFrame === 'string'
                ? opts.captureFrame
                : URL.createObjectURL(opts.captureFrame);
            try { await media.decode(); } catch {}
        } else {
            media = document.createElement('img');
            media.src = this.#img.src;
            media.alt = this.#img.alt;
            try { await media.decode(); } catch {}
        }
        media.id = 'fullscreenMedia';

        // Position at final contained rect
        media.style.top = finalRect.top + 'px';
        media.style.left = finalRect.left + 'px';
        media.style.width = finalRect.width + 'px';
        media.style.height = finalRect.height + 'px';

        // FLIP: inverse transform to gallery position
        const dx = wrapRect.left - finalRect.left;
        const dy = wrapRect.top - finalRect.top;
        const sx = wrapRect.width / finalRect.width;
        const sy = wrapRect.height / finalRect.height;
        media.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'fullscreen-close';
        closeBtn.innerHTML = CLOSE_SVG;
        closeBtn.setAttribute('aria-label', 'Close fullscreen');
        closeBtn.addEventListener('click', (e) => { e.stopPropagation(); this.closeFullscreen(); });

        // Alt text overlay
        const altOverlay = document.createElement('div');
        altOverlay.className = 'fullscreen-alt-overlay';

        // Click media to toggle alt text
        media.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.#fsAltVisible) this.#hideFsAlt();
            else this.#showFsAlt();
        });

        // Click alt overlay to dismiss
        altOverlay.addEventListener('click', (e) => {
            e.stopPropagation();
            this.#hideFsAlt();
        });

        // Context menu
        const fsCtxMenu = this.#buildContextMenu(overlay, media);

        overlay.append(media, closeBtn, altOverlay);
        if (fsCtxMenu) overlay.appendChild(fsCtxMenu);

        // Click backdrop to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeFullscreen();
        });

        // Capture alt text state before DOM changes
        const wasAltVisible = this.#altVisible;
        let altFlipFrom = null;
        if (wasAltVisible) {
            altFlipFrom = this.#altOverlay.getBoundingClientRect();
            this.dismissAltText();
        }

        document.body.appendChild(overlay);
        this.#fullscreenOverlay = overlay;
        this.#fullscreen = true;

        // FLIP alt text from inline to fullscreen position
        if (wasAltVisible && altFlipFrom) {
            altOverlay.innerHTML = '';
            const content = this.#buildAltContent
                ? this.#buildAltContent({ wrapExtras: true })
                : this.#buildSimpleAltContent();
            if (content) altOverlay.appendChild(content);
            altOverlay.style.transition = 'none';
            altOverlay.classList.add('visible');
            this.#fsAltVisible = true;

            altOverlay.offsetHeight; // force layout
            const toRect = altOverlay.getBoundingClientRect();
            const adx = (altFlipFrom.left + altFlipFrom.width / 2) - (toRect.left + toRect.width / 2);
            const ady = (altFlipFrom.top + altFlipFrom.height / 2) - (toRect.top + toRect.height / 2);

            const altAnim = altOverlay.animate([
                { transform: `translateX(-50%) translate(${adx}px, ${ady}px)` },
                { transform: 'translateX(-50%)' }
            ], { duration: 400, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'none' });
            altAnim.finished.then(() => {
                altOverlay.style.transition = '';
                altOverlay.classList.add('fs-alt-expanded');
            });
        } else {
            this.#fsAltVisible = false;
        }

        // Hide source media
        this.#img.style.visibility = 'hidden';
        this.#video.style.visibility = 'hidden';

        // Animate in
        media.offsetHeight;
        overlay.classList.add('fs-visible');
        media.classList.add('fs-animating');
        media.style.transform = 'none';

        this.dispatchEvent(new CustomEvent('fullscreen-open'));
    }

    closeFullscreen() {
        if (!this.#fullscreenOverlay) return;
        const overlay = this.#fullscreenOverlay;
        this.#fullscreenOverlay = null;
        this.#fullscreen = false;
        const wasFsAltVisible = this.#fsAltVisible;
        this.#fsAltVisible = false;

        // Cleanup listeners
        if (overlay._fsResSync) document.removeEventListener('resolutionchange', overlay._fsResSync);

        const media = overlay.querySelector('#fullscreenMedia');
        if (!media) { overlay.remove(); return; }

        const wrapRect = this.#wrap.getBoundingClientRect();
        const finalRect = {
            top: parseFloat(media.style.top),
            left: parseFloat(media.style.left),
            width: parseFloat(media.style.width),
            height: parseFloat(media.style.height),
        };

        const dx = wrapRect.left - finalRect.left;
        const dy = wrapRect.top - finalRect.top;
        const sx = wrapRect.width / finalRect.width;
        const sy = wrapRect.height / finalRect.height;

        const altEl = overlay.querySelector('.fullscreen-alt-overlay');

        if (wasFsAltVisible && altEl) {
            altEl.classList.remove('fs-alt-expanded');
            const targetCenterX = wrapRect.left + wrapRect.width / 2;
            const targetCenterY = wrapRect.top + wrapRect.height / 2;
            const fromRect = altEl.getBoundingClientRect();
            const fromCenterX = fromRect.left + fromRect.width / 2;
            const fromCenterY = fromRect.top + fromRect.height / 2;
            const altDx = targetCenterX - fromCenterX;
            const altDy = targetCenterY - fromCenterY;

            altEl.style.transition = 'none';
            altEl.animate([
                { transform: 'translateX(-50%)', opacity: 1 },
                { transform: `translateX(-50%) translate(${altDx}px, ${altDy}px)`, opacity: 1 }
            ], { duration: 300, easing: 'ease-in', fill: 'forwards' });
        } else if (altEl) {
            altEl.classList.remove('visible');
        }

        overlay.classList.remove('fs-visible');
        media.classList.remove('fs-animating');
        media.classList.add('fs-closing');
        media.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

        media.addEventListener('transitionend', () => {
            overlay.remove();
            this.#img.style.visibility = '';
            this.#video.style.visibility = '';

            // Hand off to inline alt text
            if (wasFsAltVisible && this.#altText) {
                this.#altOverlay.style.transition = 'none';
                this.showAltText();
                requestAnimationFrame(() => { this.#altOverlay.style.transition = ''; });
            }

            this.dispatchEvent(new CustomEvent('fullscreen-close', {
                detail: { wasAltVisible: wasFsAltVisible }
            }));
        }, { once: true });
    }

    // ── Private methods ──

    #attachListeners() {
        // Click media → fire event (alt-text dismiss handled by document listener)
        this.#img.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('media-click'));
        });
        this.#canvas.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('media-click'));
        });

        // Suppress hover tooltips
        this.#img.setAttribute('data-tooltip-click', '');
        this.#canvas.setAttribute('data-tooltip-click', '');

        // ── Controls visibility ──

        // Mouse: show while hovering viewer (no timer), hide on leave
        this.addEventListener('pointerenter', (e) => {
            if (e.pointerType === 'mouse') {
                this.#controlsHovered = true;
                if (!this.#altVisible) this.#showControlsPersistent();
            }
        });
        this.addEventListener('pointerleave', (e) => {
            if (e.pointerType === 'mouse') {
                this.#controlsHovered = false;
                this.#hideControls();
            }
        });

        // Touch: show on tap with 2.5s auto-hide
        this.#wrap.addEventListener('pointerup', (e) => {
            if (e.pointerType === 'touch') this.#showControlsTimed();
        });

        // Button click in controls resets touch timer
        this.#controlsEl.addEventListener('click', () => {
            if (this.#controlsActive && !this.#controlsHovered) this.#resetControlsTimer();
        });

        // Keep controls visible while a control has focus
        this.#controlsEl.addEventListener('focusin', () => this.#showControlsPersistent());
        this.#controlsEl.addEventListener('focusout', (e) => {
            if (!this.#controlsEl.contains(e.relatedTarget) && !this.#controlsHovered) {
                this.#hideControls();
            }
        });

        // Alt-text interaction hides controls
        this.#altOverlay.addEventListener('pointerenter', () => {
            this.#hideControls();
        });
        this.#altOverlay.addEventListener('click', () => {
            this.#hideControls();
        });
        this.#altOverlay.addEventListener('scroll', () => {
            this.#hideControls();
        });

        // Click outside alt-text overlay dismisses it
        this.#onDocClick = (e) => {
            if (this.#altVisible && !this.#altOverlay.contains(e.target)) {
                this.dismissAltText();
            }
        };
        document.addEventListener('mousedown', this.#onDocClick);
    }

    #syncModeVisibility() {
        this.#img.classList.toggle('hidden', this.#mode !== 'image');
        this.#canvas.classList.toggle('hidden', this.#mode !== 'canvas');
        this.#video.classList.toggle('hidden', this.#mode !== 'video');
    }

    /** Show controls and keep visible (mouse hover / focus). */
    #showControlsPersistent() {
        clearTimeout(this.#controlsTimer);
        if (!this.#controlsActive) {
            this.#controlsActive = true;
            this.classList.add('iv-controls-active');
        }
    }

    /** Show controls with 2.5s auto-hide (touch). */
    #showControlsTimed() {
        if (!this.#controlsActive) {
            this.#controlsActive = true;
            this.classList.add('iv-controls-active');
        }
        this.#resetControlsTimer();
    }

    #hideControls() {
        clearTimeout(this.#controlsTimer);
        this.#controlsTimer = 0;
        this.#controlsActive = false;
        this.classList.remove('iv-controls-active');
    }

    #resetControlsTimer() {
        clearTimeout(this.#controlsTimer);
        this.#controlsTimer = setTimeout(() => this.#hideControls(), 2500);
    }

    #renderAltText() {
        this.#altOverlay.innerHTML = '';
        const frag = document.createDocumentFragment();
        const sep1 = document.createElement('div');
        sep1.className = 'fullscreen-alt-sep';
        frag.appendChild(sep1);
        const bodyEl = document.createElement('div');
        bodyEl.className = 'fullscreen-alt-body';
        bodyEl.textContent = this.#altText;
        frag.appendChild(bodyEl);
        const sep2 = document.createElement('div');
        sep2.className = 'fullscreen-alt-sep';
        frag.appendChild(sep2);
        this.#altOverlay.appendChild(frag);
    }

    #computeContainedRect(aspectRatio) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let w, h;
        if (vw / vh > aspectRatio) {
            h = vh; w = h * aspectRatio;
        } else {
            w = vw; h = w / aspectRatio;
        }
        return { top: (vh - h) / 2, left: (vw - w) / 2, width: w, height: h };
    }

    #showFsAlt() {
        if (!this.#fullscreenOverlay) return;
        const el = this.#fullscreenOverlay.querySelector('.fullscreen-alt-overlay');
        if (!el) return;
        el.innerHTML = '';
        const content = this.#buildAltContent
            ? this.#buildAltContent({ wrapExtras: true })
            : this.#buildSimpleAltContent();
        if (content) el.appendChild(content);
        el.classList.add('visible', 'fs-alt-expanded');
        this.#fsAltVisible = true;
    }

    #hideFsAlt() {
        if (!this.#fullscreenOverlay) return;
        const el = this.#fullscreenOverlay.querySelector('.fullscreen-alt-overlay');
        if (el) el.classList.remove('visible', 'fs-alt-expanded');
        this.#fsAltVisible = false;
    }

    #buildSimpleAltContent() {
        if (!this.#altText) return null;
        const frag = document.createDocumentFragment();
        const sep1 = document.createElement('div');
        sep1.className = 'fullscreen-alt-sep';
        frag.appendChild(sep1);
        const bodyEl = document.createElement('div');
        bodyEl.className = 'fullscreen-alt-body';
        bodyEl.textContent = this.#altText;
        frag.appendChild(bodyEl);
        const sep2 = document.createElement('div');
        sep2.className = 'fullscreen-alt-sep';
        frag.appendChild(sep2);
        return frag;
    }

    #syncFullscreenMedia() {
        if (!this.#fullscreenOverlay) return;
        const media = this.#fullscreenOverlay.querySelector('#fullscreenMedia');
        if (!media) return;

        this.#hideFsAlt();
        const isVideo = this.#mode === 'video';

        media.classList.add('fs-fading');
        media.addEventListener('transitionend', () => {
            if (isVideo && media.tagName === 'VIDEO') {
                media.src = this.#video.src;
                media.classList.remove('fs-fading');
            } else if (!isVideo && media.tagName === 'IMG') {
                media.src = this.#img.src;
                media.alt = this.#img.alt;
                media.addEventListener('load', () => {
                    media.classList.remove('fs-fading');
                }, { once: true });
                setTimeout(() => media.classList.remove('fs-fading'), 300);
            } else {
                media.classList.remove('fs-fading');
            }
        }, { once: true });
    }

    /**
     * Build the fullscreen context menu from #ctxMenuItems config.
     * @returns {HTMLElement|null}
     */
    #buildContextMenu(overlay, media) {
        if (!this.#ctxMenuItems.length) return null;

        const menu = document.createElement('div');
        menu.className = 'gallery-ctx-menu';
        menu.setAttribute('role', 'menu');

        let html = '';
        for (const item of this.#ctxMenuItems) {
            if (item === 'sep') {
                html += '<div class="gallery-ctx-sep"></div>';
            } else if (item.label && !item.action) {
                html += `<div class="gallery-ctx-label">${item.label}</div>`;
            } else if (item.group) {
                html += `<div class="gallery-ctx-res-group" role="group" data-group="${item.group}">${item.html}</div>`;
            } else {
                html += `<button class="gallery-ctx-item" role="menuitem" data-action="${item.action}">${item.html}</button>`;
            }
        }
        menu.innerHTML = html;

        const allFocusable = [...menu.querySelectorAll('.gallery-ctx-item')];
        let ctxVisible = false;

        const showMenu = (x, y) => {
            menu.style.left = '0';
            menu.style.top = '0';
            menu.classList.add('visible');
            const rect = menu.getBoundingClientRect();
            menu.style.left = Math.min(x, window.innerWidth - rect.width - 4) + 'px';
            menu.style.top = Math.min(y, window.innerHeight - rect.height - 4) + 'px';
            ctxVisible = true;
            if (allFocusable[0]) allFocusable[0].focus();
        };

        const hideMenu = () => {
            menu.classList.remove('visible');
            ctxVisible = false;
        };

        // Click handlers
        menu.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            hideMenu();
            if (this.#ctxMenuHandler) {
                this.#ctxMenuHandler(btn.dataset.action, btn.dataset);
            }
            this.dispatchEvent(new CustomEvent('context-action', {
                detail: { action: btn.dataset.action, data: btn.dataset }
            }));
        });

        // Keyboard
        menu.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { hideMenu(); return; }
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const btn = e.target.closest('[data-action]');
                if (btn) btn.click();
                return;
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const idx = allFocusable.indexOf(e.target);
                const next = e.key === 'ArrowDown'
                    ? allFocusable[(idx + 1) % allFocusable.length]
                    : allFocusable[(idx - 1 + allFocusable.length) % allFocusable.length];
                if (next) next.focus();
            }
        });

        // Context menu on media/overlay
        let allowNativeCtx = false;
        const browserItem = menu.querySelector('.gallery-ctx-browser');
        if (browserItem) {
            browserItem.addEventListener('contextmenu', () => hideMenu());
            browserItem.addEventListener('click', () => { hideMenu(); allowNativeCtx = true; });
        }

        const ctxHandler = (e) => {
            if (allowNativeCtx) { allowNativeCtx = false; return; }
            e.preventDefault();
            e.stopPropagation();
            if (ctxVisible) { hideMenu(); return; }
            showMenu(e.clientX, e.clientY);
        };
        media.addEventListener('contextmenu', ctxHandler);
        overlay.addEventListener('contextmenu', (e) => {
            if (e.target === overlay) ctxHandler(e);
        });

        // Dismiss on click outside
        overlay.addEventListener('mousedown', (e) => {
            if (!menu.contains(e.target)) hideMenu();
        });

        // Expose hideMenu for external use
        overlay._hideCtxMenu = hideMenu;

        return menu;
    }
}

customElements.define('image-viewer', ImageViewer);

export { ImageViewer };
