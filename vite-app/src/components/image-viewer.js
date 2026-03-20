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

import { CLOSE_SVG, FULLSCREEN_SVG } from '@svg-icons';

class ImageViewer extends HTMLElement {

    static get observedAttributes() { return []; }

    // ── Internal state ──

    /** @type {'image'|'canvas'|'video'} */
    #mode = 'image';
    #altVisible = false;
    #fullscreen = false;
    #fsAltVisible = false;
    /** @type {Animation|null} */
    #fsAltAnim = null;
    /** @type {Animation|null} */
    #altAnim = null;
    /** @type {Animation|null} */
    #ctrlOpenAnim = null;
    #transitioning = false;
    #loading = false;
    #error = false;
    /** @type {number|null} */
    #progress = null;
    #selectionFadeTimer = 0;
    #mediaAnimating = false;
    #mediaSafetyTimer = 0;
    #mediaResolve = null;
    #controlsTimer = 0;
    #controlsActive = false;
    #controlsHovered = false;   // mouse is over wrap
    #onDocClick = null;          // bound document click handler

    /** @type {HTMLElement|null} */
    #fullscreenOverlay = null;

    // ── DOM refs (populated in connectedCallback) ──
    /** @type {HTMLElement} */  #wrap;
    /** @type {HTMLImageElement} */  #prevImg;
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

        this.#prevImg = document.createElement('img');
        this.#prevImg.className = 'iv-media iv-img iv-img-prev';
        this.#prevImg.alt = '';

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
            this.#prevImg, this.#img, this.#canvas, this.#video,
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

    attributeChangedCallback() {}

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

    /** Animation speed multiplier from `--t-speed` CSS variable (default 1). */
    get animSpeed() { return Math.max(0.1, parseFloat(getComputedStyle(this).getPropertyValue('--t-speed')) || 1); }

    /** Base durations (ms) scaled by animSpeed. */
    get #openDur()  { return 400 * this.animSpeed; }
    get #closeDur() { return 300 * this.animSpeed; }

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
        // Cancel any in-flight crossfade
        this.skipMedia();

        this.#mediaAnimating = true;

        // Copy current to prev for crossfade backdrop
        if (this.#img.src) this.#prevImg.src = this.#img.src;
        // Suppress transition, snap to transparent, then re-enable for fade-in
        this.#img.style.transition = 'none';
        this.#img.style.opacity = '0';
        if (this.#altVisible) this.#altOverlay.classList.add('fading');

        clearTimeout(this.#selectionFadeTimer);

        const promise = new Promise(resolve => { this.#mediaResolve = resolve; });

        // Swap metadata immediately
        if (alt !== undefined) this.#img.alt = alt;
        if (altText !== undefined) { this.#altText = altText; if (this.#altVisible) this.#renderAltText(); }
        if (video) { this.mode = 'video'; this.#video.src = video; } else { this.mode = 'image'; }
        onSwap?.();

        // Same-URL: start crossfade immediately
        if (!src || src === this.#img.src) {
            requestAnimationFrame(() => {
                this.#img.style.transition = '';
                this.#img.style.opacity = '1';
                this.#selectionFadeTimer = setTimeout(() => this.#mediaComplete(), fadeDuration);
            });
            return promise;
        }

        // Load new image, then crossfade
        const done = () => {
            requestAnimationFrame(() => {
                this.#img.style.transition = '';
                this.#img.style.opacity = '1';
                this.#selectionFadeTimer = setTimeout(() => this.#mediaComplete(), fadeDuration);
            });
        };
        this.#img.addEventListener('load', done, { once: true });
        this.#img.addEventListener('error', done, { once: true });
        this.#mediaSafetyTimer = setTimeout(done, 2000);

        this.#img.src = src;
        if (this.#fullscreen) this.#syncFullscreenMedia();

        return promise;
    }

    get animating() { return this.#mediaAnimating; }

    skipMedia() {
        if (!this.#mediaAnimating) return;
        clearTimeout(this.#selectionFadeTimer);
        clearTimeout(this.#mediaSafetyTimer);
        this.#mediaComplete();
    }

    #mediaComplete() {
        clearTimeout(this.#mediaSafetyTimer);
        this.#img.style.opacity = '1';
        if (this.#altVisible) this.#altOverlay.classList.remove('fading');
        this.#mediaAnimating = false;
        this.dispatchEvent(new CustomEvent('media-loaded'));
        this.#mediaResolve?.();
        this.#mediaResolve = null;
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

    /** Get the crossfade background img element. */
    getPrevImg() { return this.#prevImg; }

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

    /** Show alt-text overlay with CSS scale+fade transition. */
    showAltText() {
        if (!this.#altText) return;
        if (this.#altAnim) { this.#altAnim.cancel(); this.#altAnim = null; }

        this.#renderAltText();
        this.#altOverlay.classList.add('visible');
        this.#altVisible = true;
        this.classList.add('alt-text-shown');

        // Keep controls visible while alt text is open
        this.#showControlsPersistent();

        this.dispatchEvent(new CustomEvent('alt-text-toggle', { detail: { visible: true } }));
    }

    /** Hide alt-text overlay with CSS scale+fade transition. */
    dismissAltText(resetScroll = false) {
        if (this.#altAnim) { this.#altAnim.cancel(); this.#altAnim = null; }

        this.#altOverlay.classList.remove('visible');
        if (resetScroll) this.#altOverlay.scrollTop = 0;
        this.#altVisible = false;
        this.classList.remove('alt-text-shown');

        // Re-evaluate controls visibility
        if (this.#controlsHovered) {
            this.#showControlsPersistent();
        } else {
            this.#resetControlsTimer();
        }

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

        // Media wrapper — holds media + controls, receives FLIP transform
        const fsWrap = document.createElement('div');
        fsWrap.className = 'fs-media-wrap';
        const ctrlPos = this.getAttribute('controls-pos');
        if (ctrlPos) fsWrap.setAttribute('controls-pos', ctrlPos);
        if (finalRect.top < 34) fsWrap.classList.add('fs-controls-inset');
        fsWrap.style.top = finalRect.top + 'px';
        fsWrap.style.left = finalRect.left + 'px';
        fsWrap.style.width = finalRect.width + 'px';
        fsWrap.style.height = finalRect.height + 'px';

        // FLIP: inverse transform to gallery position
        const dx = wrapRect.left - finalRect.left;
        const dy = wrapRect.top - finalRect.top;
        const sx = wrapRect.width / finalRect.width;
        const sy = wrapRect.height / finalRect.height;
        fsWrap.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

        // Capture controls position before DOM move
        const ctrlStartRect = this.#controlsEl.getBoundingClientRect();
        // Morph fullscreen icon to close state
        const fsBtn = this.#controlsEl.querySelector('[aria-label="Fullscreen"]');
        if (fsBtn?.morphIcon) { fsBtn.morphIcon.morph('waiting-close'); fsBtn.setAttribute('aria-label', 'Exit fullscreen'); }
        else if (fsBtn) { fsBtn.innerHTML = CLOSE_SVG; fsBtn.setAttribute('aria-label', 'Exit fullscreen'); }
        this.classList.add('iv-controls-active');
        fsWrap.append(media);

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

        overlay.append(fsWrap, this.#controlsEl, altOverlay);
        if (fsCtxMenu) overlay.appendChild(fsCtxMenu);
        // Fix controls at their viewer position during expansion
        this.#controlsEl.style.cssText = `position:fixed;top:${ctrlStartRect.top}px;left:${ctrlStartRect.left}px;right:auto;bottom:auto;z-index:1;opacity:1;pointer-events:auto;`;

        // Click backdrop to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeFullscreen();
        });

        // Capture alt text state before DOM changes
        const wasAltVisible = this.#altVisible;
        let inlineAltRect = null;
        if (wasAltVisible) {
            inlineAltRect = this.#altOverlay.getBoundingClientRect();
            this.dismissAltText();
        }

        document.body.appendChild(overlay);
        this.#fullscreenOverlay = overlay;
        this.#fullscreen = true;

        // Show fullscreen alt text if it was visible inline
        if (wasAltVisible) {
            altOverlay.innerHTML = '';
            const content = this.#buildAltContent
                ? this.#buildAltContent({ wrapExtras: true })
                : this.#buildSimpleAltContent();
            if (content) altOverlay.appendChild(content);
            altOverlay.classList.add('visible');
            altOverlay.classList.add('fs-alt-expanded');
            this.#fsAltVisible = true;

            // FLIP morph from inline alt position
            if (inlineAltRect) {
                const fsAltRect = altOverlay.getBoundingClientRect();
                const dx = (inlineAltRect.left + inlineAltRect.width / 2) - (fsAltRect.left + fsAltRect.width / 2);
                const dy = (inlineAltRect.top + inlineAltRect.height / 2) - (fsAltRect.top + fsAltRect.height / 2);
                const sx = inlineAltRect.width / fsAltRect.width;
                const sy = inlineAltRect.height / fsAltRect.height;
                altOverlay.animate([
                    { transform: `translateX(-50%) translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.5 },
                    { transform: 'translateX(-50%)', opacity: 1 }
                ], { duration: this.#openDur, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
            }
        } else {
            this.#fsAltVisible = false;
        }

        // Hide source media
        this.#img.style.visibility = 'hidden';
        this.#video.style.visibility = 'hidden';

        // Animate in
        fsWrap.offsetHeight;

        // Measure actual fullscreen target by temporarily placing controls in fsWrap
        // (fsWrap has no transform yet since we haven't started the transition)
        const savedCtrlCss = this.#controlsEl.style.cssText;
        this.#controlsEl.style.cssText = '';
        fsWrap.style.transform = 'none';
        fsWrap.prepend(this.#controlsEl);
        fsWrap.offsetHeight;
        const ctrlEndRect = this.#controlsEl.getBoundingClientRect();
        const ctrlTargetTop = ctrlEndRect.top;
        const ctrlTargetLeft = ctrlEndRect.left;
        // Move controls back to overlay
        overlay.append(this.#controlsEl);
        this.#controlsEl.style.cssText = savedCtrlCss;
        // Reset fsWrap transform for FLIP
        fsWrap.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
        fsWrap.offsetHeight;

        // FLIP controls from viewer position to fullscreen position
        this.#ctrlOpenAnim = this.#controlsEl.animate([
            { top: ctrlStartRect.top + 'px', left: ctrlStartRect.left + 'px' },
            { top: ctrlTargetTop + 'px', left: ctrlTargetLeft + 'px' }
        ], { duration: this.#openDur, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' });
        this.#ctrlOpenAnim.finished.then(() => {
            // Update inline style to target before cancelling animation layer
            this.#controlsEl.style.top = ctrlTargetTop + 'px';
            this.#controlsEl.style.left = ctrlTargetLeft + 'px';
            this.#ctrlOpenAnim.cancel();
            this.#ctrlOpenAnim = null;
            fsWrap.prepend(this.#controlsEl);
            this.#controlsEl.style.cssText = '';
        }).catch(() => {});

        overlay.classList.add('fs-visible');
        fsWrap.style.transition = `transform ${this.#openDur}ms cubic-bezier(0.16, 1, 0.3, 1)`;
        fsWrap.classList.add('fs-animating');
        fsWrap.style.transform = 'none';

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

        const fsWrap = overlay.querySelector('.fs-media-wrap');
        if (!fsWrap) { overlay.remove(); return; }

        // Cancel any in-flight controls open animation
        if (this.#ctrlOpenAnim) {
            this.#ctrlOpenAnim.cancel();
            this.#ctrlOpenAnim = null;
            this.#controlsEl.style.cssText = '';
            fsWrap.prepend(this.#controlsEl);
        }

        const wrapRect = this.#wrap.getBoundingClientRect();
        const finalRect = {
            top: parseFloat(fsWrap.style.top),
            left: parseFloat(fsWrap.style.left),
            width: parseFloat(fsWrap.style.width),
            height: parseFloat(fsWrap.style.height),
        };

        const dx = wrapRect.left - finalRect.left;
        const dy = wrapRect.top - finalRect.top;
        const sx = wrapRect.width / finalRect.width;
        const sy = wrapRect.height / finalRect.height;

        const altEl = overlay.querySelector('.fullscreen-alt-overlay');

        // Cancel any in-flight alt animation
        if (this.#fsAltAnim) { this.#fsAltAnim.cancel(); this.#fsAltAnim = null; }

        if (wasFsAltVisible && altEl) {
            altEl.classList.remove('fs-alt-expanded');
            const fromRect = altEl.getBoundingClientRect();
            const fromCX = fromRect.left + fromRect.width / 2;
            const fromCY = fromRect.top + fromRect.height / 2;
            // Target: bottom-center of inline viewer (approximate inline alt position)
            const targetW = Math.min(wrapRect.width - 16, 800);
            const targetCX = wrapRect.left + wrapRect.width / 2;
            const s = targetW / fromRect.width;
            const targetBottom = wrapRect.bottom - 8;
            const targetCY = targetBottom - (fromRect.height * s) / 2;
            const altDx = targetCX - fromCX;
            const altDy = targetCY - fromCY;

            altEl.style.transition = 'none';
            altEl.animate([
                { transform: 'translateX(-50%)', opacity: 1 },
                { transform: `translateX(-50%) translate(${altDx}px, ${altDy}px) scale(${s})`, opacity: 0 }
            ], { duration: this.#closeDur, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', fill: 'forwards' });
        } else if (altEl) {
            altEl.classList.remove('visible');
        }

        // FLIP controls: move from fsWrap to overlay with fixed positioning
        const ctrlFromRect = this.#controlsEl.getBoundingClientRect();
        const fsBtnEl = this.#controlsEl.querySelector('[aria-label="Exit fullscreen"]');
        if (fsBtnEl?.morphIcon) { fsBtnEl.morphIcon.morph('waiting-open'); fsBtnEl.setAttribute('aria-label', 'Fullscreen'); }
        else if (fsBtnEl) { fsBtnEl.innerHTML = FULLSCREEN_SVG; fsBtnEl.setAttribute('aria-label', 'Fullscreen'); }
        overlay.append(this.#controlsEl);
        this.#controlsEl.style.cssText = `position:fixed;top:${ctrlFromRect.top}px;left:${ctrlFromRect.left}px;right:auto;bottom:auto;z-index:1;opacity:1;pointer-events:auto;`;

        // Measure viewer target: briefly place controls in viewer
        this.#controlsActive = true;
        this.classList.add('iv-controls-active');
        const savedCss = this.#controlsEl.style.cssText;
        this.#controlsEl.style.cssText = 'visibility:hidden;';
        this.append(this.#controlsEl);
        const ctrlTargetRect = this.#controlsEl.getBoundingClientRect();
        overlay.append(this.#controlsEl);
        this.#controlsEl.style.cssText = savedCss;

        // Animate controls from fullscreen to viewer position
        let ctrlsDone = false;
        const ctrlCloseAnim = this.#controlsEl.animate([
            { top: ctrlFromRect.top + 'px', left: ctrlFromRect.left + 'px' },
            { top: ctrlTargetRect.top + 'px', left: ctrlTargetRect.left + 'px' }
        ], { duration: this.#closeDur, easing: 'ease-in', fill: 'forwards' });
        ctrlCloseAnim.finished.then(() => { ctrlCloseAnim.cancel(); ctrlsDone = true; }).catch(() => { ctrlsDone = true; });

        overlay.classList.remove('fs-visible');
        fsWrap.classList.remove('fs-animating');
        fsWrap.style.transition = `transform ${this.#closeDur}ms ease-in`;
        fsWrap.classList.add('fs-closing');
        fsWrap.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

        fsWrap.addEventListener('transitionend', () => {
            const finish = () => {
                // Move controls back to viewer
                this.append(this.#controlsEl);
                this.#controlsEl.style.cssText = '';
                this.#controlsHovered = false;
                this.#resetControlsTimer();

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
            };
            if (ctrlsDone) finish();
            else ctrlCloseAnim.finished.then(finish).catch(finish);
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

        // Click alt-text overlay to dismiss
        this.#altOverlay.addEventListener('click', () => {
            if (this.#altVisible) this.dismissAltText();
        });

        // Click outside alt-text overlay dismisses it
        // (exclude controls bar so the text-button toggle works correctly)
        this.#onDocClick = (e) => {
            if (this.#altVisible
                && !this.#altOverlay.contains(e.target)
                && !this.#controlsEl.contains(e.target)) {
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
            this.dispatchEvent(new CustomEvent('controls-show'));
        }
    }

    /** Show controls with 2.5s auto-hide (touch). */
    #showControlsTimed() {
        if (!this.#controlsActive) {
            this.#controlsActive = true;
            this.classList.add('iv-controls-active');
            this.dispatchEvent(new CustomEvent('controls-show'));
        }
        this.#resetControlsTimer();
    }

    #hideControls() {
        if (this.#altVisible) return;
        if (this.#controlsEl.querySelector('.custom-dropdown.open, dd-morph.open')) return;
        clearTimeout(this.#controlsTimer);
        this.#controlsTimer = 0;
        this.#controlsActive = false;
        this.classList.remove('iv-controls-active');
        this.dispatchEvent(new CustomEvent('controls-hide'));
    }

    #resetControlsTimer() {
        clearTimeout(this.#controlsTimer);
        if (this.#controlsEl.querySelector('.custom-dropdown.open, dd-morph.open')) return;
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
        if (this.#fsAltAnim) { this.#fsAltAnim.cancel(); this.#fsAltAnim = null; }

        el.innerHTML = '';
        const content = this.#buildAltContent
            ? this.#buildAltContent({ wrapExtras: true })
            : this.#buildSimpleAltContent();
        if (content) el.appendChild(content);

        el.classList.add('visible');
        requestAnimationFrame(() => el.classList.add('fs-alt-expanded'));
        this.#fsAltVisible = true;
    }

    #hideFsAlt() {
        if (!this.#fullscreenOverlay) return;
        const el = this.#fullscreenOverlay.querySelector('.fullscreen-alt-overlay');
        if (!el) { this.#fsAltVisible = false; return; }
        if (this.#fsAltAnim) { this.#fsAltAnim.cancel(); this.#fsAltAnim = null; }

        el.classList.remove('fs-alt-expanded');
        el.classList.remove('visible');
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
        menu.className = 'ctx-menu';
        menu.setAttribute('role', 'menu');

        let html = '';
        for (const item of this.#ctxMenuItems) {
            if (item === 'sep') {
                html += '<div class="ctx-sep"></div>';
            } else if (item.label && !item.action) {
                html += `<div class="ctx-label">${item.label}</div>`;
            } else if (item.group) {
                html += `<div class="ctx-res-group" role="group" data-group="${item.group}">${item.html}</div>`;
            } else {
                html += `<button class="ctx-item" role="menuitem" data-action="${item.action}">${item.html}</button>`;
            }
        }
        menu.innerHTML = html;

        const allFocusable = [...menu.querySelectorAll('.ctx-item')];
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
        const browserItem = menu.querySelector('.ctx-browser');
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
