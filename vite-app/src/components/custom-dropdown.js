/**
 * Reusable custom dropdown — replaces native <select> with styled button menu.
 * Supports upward (default) and downward (`.dropdown-down`) opening.
 *
 * When `animate: true`, uses "morph" mode: a single unified element containing
 * all items. Collapsed, it clips to one item height and translates to show the
 * active item. Expanding reveals all items with smooth transitions. No separate
 * trigger button — the element IS the button when collapsed.
 *
 * Standard (non-animate) HTML structure:
 *   <div class="custom-dropdown">
 *       <button class="custom-dropdown-trigger select-base" aria-haspopup="listbox" aria-expanded="false">
 *           <span class="custom-dropdown-label">Current</span>
 *       </button>
 *       <div class="custom-dropdown-menu hidden" role="listbox">
 *           <button class="custom-dropdown-item active" role="option" data-value="a">A</button>
 *           <button class="custom-dropdown-item" role="option" data-value="b">B</button>
 *       </div>
 *   </div>
 *
 * Morph (animate: true) HTML structure — single element, no trigger:
 *   <dd-morph class="select-base" aria-haspopup="listbox" aria-expanded="false" role="listbox">
 *       <button class="custom-dropdown-item active" role="option" data-value="a">A</button>
 *       <button class="custom-dropdown-item" role="option" data-value="b">B</button>
 *   </dd-morph>
 */

/**
 * @param {HTMLElement} dropdownEl - The wrapper (.custom-dropdown or dd-morph)
 * @param {object} opts
 * @param {string} [opts.initialValue] - Value to mark active on init
 * @param {string} [opts.labelText] - Override label text on init
 * @param {(value: string, label: string) => void} opts.onSelect - Called when an item is selected
 * @param {boolean} [opts.animate] - Enable morph-mode (dd-morph element)
 * @param {'down'|'up'|'left'|'right'} [opts.direction='down'] - Expansion direction
 * @param {boolean} [opts.stickyActive=false] - If true, collapsed view stays fixed (no translate to active item)
 */
export function initCustomDropdown(dropdownEl, { initialValue, labelText, onSelect, animate, direction, stickyActive }) {
    if (!dropdownEl) return;

    const isMorph = animate && dropdownEl.tagName === 'DD-MORPH';

    if (isMorph) {
        initMorph(dropdownEl, { initialValue, onSelect, direction, stickyActive });
        return;
    }

    // ── Standard dropdown path (non-animate) ──
    const trigger = dropdownEl.querySelector('.custom-dropdown-trigger');
    const menu = dropdownEl.querySelector('.custom-dropdown-menu');
    const label = dropdownEl.querySelector('.custom-dropdown-label');
    if (!trigger || !menu || !label) return;

    if (initialValue) syncActive(menu, initialValue);
    if (labelText) label.textContent = labelText;
    else if (initialValue) {
        const activeItem = menu.querySelector(`.custom-dropdown-item[data-value="${initialValue}"]`);
        if (activeItem) label.textContent = activeItem.dataset.label || activeItem.textContent;
    }

    function doOpen() {
        if (dropdownEl.classList.contains('open')) return;
        menu.classList.remove('hidden');
        dropdownEl.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
    }

    function doClose() {
        if (!dropdownEl.classList.contains('open')) return;
        close(trigger, menu, dropdownEl);
    }

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dropdownEl.classList.contains('open')) doClose();
        else doOpen();
    });

    menu.addEventListener('click', (e) => {
        const item = e.target.closest('.custom-dropdown-item');
        if (!item || item.classList.contains('disabled')) return;
        label.textContent = item.dataset.label || item.textContent;
        syncActive(menu, item.dataset.value);
        doClose();
        if (onSelect) onSelect(item.dataset.value, item.textContent);
    });

    document.addEventListener('click', (e) => {
        if (!dropdownEl.contains(e.target)) doClose();
    });

    trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            doClose();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            if (!dropdownEl.classList.contains('open')) doOpen();
            const items = [...menu.querySelectorAll('.custom-dropdown-item')];
            const first = e.key === 'ArrowUp' ? items[items.length - 1] : items[0];
            if (first) first.focus();
        }
    });

    menu.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            doClose();
            trigger.focus();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const items = [...menu.querySelectorAll('.custom-dropdown-item')];
            const idx = items.indexOf(document.activeElement);
            const next = e.key === 'ArrowUp'
                ? items[(idx - 1 + items.length) % items.length]
                : items[(idx + 1) % items.length];
            if (next) next.focus();
        }
    });
}

// ═══════════════════════════════════════════════════════
// ── dd-morph: unified single-element dropdown ──
// ═══════════════════════════════════════════════════════

/** @type {WeakMap<HTMLElement, {horiz: boolean, isStart: boolean, stickyActive: boolean}>} */
const morphConfigs = new WeakMap();

/**
 * Initialize a <dd-morph> element. All items live inside it directly.
 * Collapsed: clips to one item size, inner wrapper translates to show active.
 * Expanded: full size, all items visible.
 *
 * @param {HTMLElement} el
 * @param {object} opts
 * @param {string} [opts.initialValue]
 * @param {(value: string, label: string) => void} [opts.onSelect]
 * @param {'down'|'up'|'left'|'right'} [opts.direction='down'] - Expansion direction
 * @param {boolean} [opts.stickyActive=false] - If true, collapsed view stays fixed
 */
function initMorph(el, { initialValue, onSelect, direction = 'down', stickyActive = false }) {
    // Wrap items in an inner container for translate animation
    const inner = document.createElement('div');
    inner.className = 'ddm-inner';
    while (el.firstChild) inner.appendChild(el.firstChild);
    el.appendChild(inner);

    if (initialValue) syncActive(el, initialValue);

    // Derive axis and alignment from direction
    const horiz = direction === 'left' || direction === 'right';
    const isStart = direction === 'down' || direction === 'right';

    // Add CSS classes for axis and direction
    if (horiz) el.classList.add('morph-horizontal');
    if (direction === 'left') el.classList.add('morph-expand-left');
    if (direction === 'up') el.classList.add('morph-expand-up');

    // Store config for syncMorph
    morphConfigs.set(el, { horiz, isStart, stickyActive });

    // Overlay mode: inner overflows el's fixed size, expanding over content.
    // Content wrapper inside inner receives translate so the pill stays fixed.
    const overlay = el.classList.contains('morph-overlay');
    const sizeTarget = overlay ? inner : el;
    let transformTarget = inner;
    if (overlay) {
        const content = document.createElement('div');
        content.className = 'ddm-content';
        while (inner.firstChild) content.appendChild(inner.firstChild);
        inner.appendChild(content);
        transformTarget = content;
    }

    // ── Axis helpers ──
    const sizeProp = horiz ? 'maxWidth' : 'maxHeight';
    const layoutProp = horiz ? 'width' : 'height';
    const scrollDim = horiz ? 'scrollWidth' : 'scrollHeight';
    const translate = (v) => horiz ? `translateX(${v}px)` : `translateY(${v}px)`;
    const measureItem = (item) => horiz
        ? (item?.offsetWidth || 24)
        : (item?.offsetHeight || 24);

    function calcOffset(inner, active) {
        if (horiz) {
            return isStart ? -active.offsetLeft : (inner.offsetWidth - active.offsetWidth - active.offsetLeft);
        }
        return isStart ? -active.offsetTop : (inner.offsetHeight - active.offsetHeight - active.offsetTop);
    }

    function collapsedOffset(inner, active) {
        return stickyActive ? 0 : calcOffset(inner, active);
    }

    // ── Measure & set collapsed state ──
    el.style.transition = 'none';
    inner.style.transition = 'none';
    if (overlay) transformTarget.style.transition = 'none';
    el.classList.add('open'); // expand to measure
    el.offsetHeight;

    const activeItem = inner.querySelector('.custom-dropdown-item.active');
    const anyItem = inner.querySelector('.custom-dropdown-item');
    const itemSize = measureItem(activeItem || anyItem);

    const offset = activeItem ? collapsedOffset(inner, activeItem) : 0;
    transformTarget.style.transform = translate(offset);

    el.classList.remove('open');
    sizeTarget.style[sizeProp] = itemSize + 'px'; // explicit px — drives transition
    if (overlay) el.style[layoutProp] = itemSize + 'px'; // hold layout space
    el.offsetHeight;
    el.style.removeProperty('transition');
    inner.style.removeProperty('transition');
    if (overlay) transformTarget.style.removeProperty('transition');

    // ── Open / close with fade ──
    const FADE_MS = 120;
    let fadeTimer = 0;
    // In overlay mode, fade .ddm-content so .ddm-inner background stays opaque
    const fadeTarget = overlay ? transformTarget : inner;

    function doOpen() {
        if (el.classList.contains('open')) return;
        clearTimeout(fadeTimer);
        // Phase 1: fade out current visible text
        fadeTarget.style.opacity = '0';
        fadeTimer = setTimeout(() => {
            // Phase 2: expand + reset translate
            el.classList.add('open');
            transformTarget.style.transform = translate(0);
            el.setAttribute('aria-expanded', 'true');
            sizeTarget.style[sizeProp] = (inner[scrollDim] + 8) + 'px'; // explicit px
            // Phase 3: fade items in (next frame so opacity:0 registers)
            requestAnimationFrame(() => { fadeTarget.style.opacity = ''; });
        }, FADE_MS);
    }

    function doClose() {
        if (!el.classList.contains('open')) return;
        clearTimeout(fadeTimer);
        // Phase 1: fade out items
        fadeTarget.style.opacity = '0';
        fadeTimer = setTimeout(() => {
            // Phase 2: collapse + offset to active item
            const active = inner.querySelector('.custom-dropdown-item.active');
            const off = active ? collapsedOffset(inner, active) : 0;
            el.classList.remove('open');
            transformTarget.style.transform = translate(off);
            el.setAttribute('aria-expanded', 'false');
            sizeTarget.style[sizeProp] = itemSize + 'px'; // back to single item
            // Phase 3: fade active item back in
            requestAnimationFrame(() => { fadeTarget.style.opacity = ''; });
        }, FADE_MS);
    }

    // Click on element itself toggles when collapsed (acts as button)
    el.addEventListener('click', (e) => {
        const item = e.target.closest('.custom-dropdown-item');
        if (!el.classList.contains('open')) {
            // Collapsed — open on any click
            e.stopPropagation();
            doOpen();
            return;
        }
        // Open — handle item selection
        if (item && !item.classList.contains('disabled')) {
            e.stopPropagation();
            syncActive(el, item.dataset.value);
            doClose();
            if (onSelect) onSelect(item.dataset.value, item.textContent);
        }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!el.contains(e.target)) doClose();
    });

    // Keyboard
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            doClose();
            el.focus();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            if (!el.classList.contains('open')) doOpen();
            const items = [...inner.querySelectorAll('.custom-dropdown-item')];
            const idx = items.indexOf(document.activeElement);
            const next = e.key === 'ArrowUp'
                ? items[(idx - 1 + items.length) % items.length]
                : items[(idx + 1) % items.length];
            if (next) next.focus();
        } else if (e.key === 'Enter' || e.key === ' ') {
            if (!el.classList.contains('open')) {
                e.preventDefault();
                doOpen();
            }
        }
    });
}

/**
 * Sync a <dd-morph> element's visual state after an external value change.
 * Smoothly transitions the inner wrapper to show the new active item.
 */
export function syncMorph(el, activeKey) {
    if (!el || el.tagName !== 'DD-MORPH') return;
    syncActive(el, activeKey);
    if (el.classList.contains('open')) return;
    const inner = el.querySelector('.ddm-inner');
    if (!inner) return;
    const active = inner.querySelector('.custom-dropdown-item.active');
    if (!active) return;
    const cfg = morphConfigs.get(el);
    if (!cfg) return;
    if (cfg.stickyActive) return; // no translate needed
    const target = inner.querySelector('.ddm-content') || inner;
    if (cfg.horiz) {
        const off = cfg.isStart ? -active.offsetLeft : (inner.offsetWidth - active.offsetWidth - active.offsetLeft);
        target.style.transform = `translateX(${off}px)`;
    } else {
        const off = cfg.isStart ? -active.offsetTop : (inner.offsetHeight - active.offsetHeight - active.offsetTop);
        target.style.transform = `translateY(${off}px)`;
    }
}

// ═══════════════════════════════════════════════════════
// ── Shared helpers ──
// ═══════════════════════════════════════════════════════

function close(trigger, menu, dropdownEl) {
    dropdownEl.classList.remove('open');
    menu.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
}

function syncActive(root, value) {
    root.querySelectorAll('.custom-dropdown-item').forEach(item => {
        const isActive = item.dataset.value === value;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-selected', String(isActive));
    });
}
