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
 */
export function initCustomDropdown(dropdownEl, { initialValue, labelText, onSelect, animate }) {
    if (!dropdownEl) return;

    const isMorph = animate && dropdownEl.tagName === 'DD-MORPH';

    if (isMorph) {
        initMorph(dropdownEl, { initialValue, onSelect });
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

/**
 * Initialize a <dd-morph> element. All items live inside it directly.
 * Collapsed: clips to one item height, inner wrapper translates to show active.
 * Expanded: full height, all items visible.
 */
function initMorph(el, { initialValue, onSelect }) {
    // Wrap items in an inner container for translateY animation
    const inner = document.createElement('div');
    inner.className = 'ddm-inner';
    while (el.firstChild) inner.appendChild(el.firstChild);
    el.appendChild(inner);

    if (initialValue) syncActive(el, initialValue);

    const isTop = () => !!el.closest('image-viewer[controls-pos^="top"]');

    // ── Measure & set collapsed state ──
    el.style.transition = 'none';
    inner.style.transition = 'none';
    el.classList.add('open'); // expand to measure
    el.offsetHeight;

    const activeItem = inner.querySelector('.custom-dropdown-item.active');
    const anyItem = inner.querySelector('.custom-dropdown-item');
    const itemH = activeItem?.offsetHeight || anyItem?.offsetHeight || 24;

    const offset = activeItem ? morphOffset(inner, activeItem, isTop()) : 0;
    inner.style.transform = `translateY(${offset}px)`;

    el.classList.remove('open');
    el.style.maxHeight = itemH + 'px'; // explicit px — drives transition
    el.offsetHeight;
    el.style.removeProperty('transition');
    inner.style.removeProperty('transition');

    // ── Open / close with fade ──
    const FADE_MS = 120;
    let fadeTimer = 0;

    function doOpen() {
        if (el.classList.contains('open')) return;
        clearTimeout(fadeTimer);
        // Phase 1: fade out current visible text
        inner.style.opacity = '0';
        fadeTimer = setTimeout(() => {
            // Phase 2: expand + reset translateY
            el.classList.add('open');
            inner.style.transform = 'translateY(0)';
            el.setAttribute('aria-expanded', 'true');
            el.style.maxHeight = (inner.scrollHeight + 8) + 'px'; // explicit px
            // Phase 3: fade items in (next frame so opacity:0 registers)
            requestAnimationFrame(() => { inner.style.opacity = ''; });
        }, FADE_MS);
    }

    function doClose() {
        if (!el.classList.contains('open')) return;
        clearTimeout(fadeTimer);
        // Phase 1: fade out items
        inner.style.opacity = '0';
        fadeTimer = setTimeout(() => {
            // Phase 2: collapse + offset to active item
            const active = inner.querySelector('.custom-dropdown-item.active');
            const off = active ? morphOffset(inner, active, isTop()) : 0;
            el.classList.remove('open');
            inner.style.transform = `translateY(${off}px)`;
            el.setAttribute('aria-expanded', 'false');
            el.style.maxHeight = itemH + 'px'; // back to single item
            // Phase 3: fade active item back in
            requestAnimationFrame(() => { inner.style.opacity = ''; });
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
 * Calculate translateY offset to position the active item at the
 * visible edge of the collapsed element.
 */
function morphOffset(inner, activeItem, isTop) {
    if (isTop) return -activeItem.offsetTop;
    return inner.offsetHeight - activeItem.offsetHeight - activeItem.offsetTop;
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
    const isTop = !!el.closest('image-viewer[controls-pos^="top"]');
    // Let the CSS transition handle the smooth slide
    inner.style.transform = `translateY(${morphOffset(inner, active, isTop)}px)`;
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
