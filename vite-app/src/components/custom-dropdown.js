/**
 * Reusable custom dropdown — replaces native <select> with styled button menu.
 * Supports upward (default) and downward (`.dropdown-down`) opening.
 *
 * When `animate: true`, uses a resize-based animation: an inner wrapper
 * translates so the active item aligns with the trigger when collapsed,
 * and the menu expands/collapses via max-height transition.
 *
 * Expected HTML structure:
 *   <div class="custom-dropdown" id="myDropdown">
 *       <button class="custom-dropdown-trigger select-base" aria-haspopup="listbox" aria-expanded="false">
 *           <span class="custom-dropdown-label">Current</span>
 *       </button>
 *       <div class="custom-dropdown-menu hidden" role="listbox">
 *           <button class="custom-dropdown-item active" role="option" data-value="a">A</button>
 *           <button class="custom-dropdown-item" role="option" data-value="b">B</button>
 *       </div>
 *   </div>
 */

/**
 * @param {HTMLElement} dropdownEl - The .custom-dropdown wrapper
 * @param {object} opts
 * @param {string} [opts.initialValue] - Value to mark active on init
 * @param {string} [opts.labelText] - Override label text on init
 * @param {(value: string, label: string) => void} opts.onSelect - Called when an item is selected
 * @param {boolean} [opts.animate] - Enable resize-based animated open/close
 */
export function initCustomDropdown(dropdownEl, { initialValue, labelText, onSelect, animate }) {
    if (!dropdownEl) return;

    const trigger = dropdownEl.querySelector('.custom-dropdown-trigger');
    const menu = dropdownEl.querySelector('.custom-dropdown-menu');
    const label = dropdownEl.querySelector('.custom-dropdown-label');
    if (!trigger || !menu || !label) return;

    // Set initial state
    if (initialValue) syncActive(menu, initialValue);
    if (labelText) label.textContent = labelText;
    else if (initialValue) {
        const activeItem = menu.querySelector(`.custom-dropdown-item[data-value="${initialValue}"]`);
        if (activeItem) label.textContent = activeItem.dataset.label || activeItem.textContent;
    }

    /** @type {HTMLElement|null} inner wrapper (animate mode only) */
    let inner = null;
    /** @type {boolean} whether menu anchors at top (top controls) */
    let isTop = false;

    // ── Animate mode: create inner wrapper and set up collapsed state ──
    if (animate) {
        inner = document.createElement('div');
        inner.className = 'dd-inner';
        while (menu.firstChild) inner.appendChild(menu.firstChild);
        menu.appendChild(inner);

        dropdownEl.classList.add('dd-animate');
        isTop = !!dropdownEl.closest('image-viewer[controls-pos^="top"]');

        // Measure with menu expanded (transitions disabled)
        menu.style.transition = 'none';
        inner.style.transition = 'none';
        menu.classList.remove('hidden');
        dropdownEl.classList.add('open');
        menu.offsetHeight; // force layout

        const activeItem = inner.querySelector('.custom-dropdown-item.active');
        const anyItem = inner.querySelector('.custom-dropdown-item');
        const itemH = activeItem?.offsetHeight || anyItem?.offsetHeight || 24;

        // Set collapsed max-height — just the item height (padding is 0 when collapsed)
        dropdownEl.style.setProperty('--dd-collapsed-h', itemH + 'px');

        // Calculate and apply collapsed offset
        const offset = activeItem ? calcOffset(inner, activeItem, isTop) : 0;
        inner.style.transform = `translateY(${offset}px)`;

        // Revert to collapsed state
        dropdownEl.classList.remove('open');
        menu.offsetHeight; // force layout

        // Restore transitions
        menu.style.transition = '';
        inner.style.transition = '';
    }

    function doOpen() {
        if (dropdownEl.classList.contains('open')) return;
        if (animate && inner) {
            dropdownEl.classList.add('open');
            inner.style.transform = 'translateY(0px)';
            trigger.setAttribute('aria-expanded', 'true');
        } else {
            menu.classList.remove('hidden');
            dropdownEl.classList.add('open');
            trigger.setAttribute('aria-expanded', 'true');
        }
    }

    function doClose() {
        if (!dropdownEl.classList.contains('open')) return;
        if (animate && inner) {
            const activeItem = inner.querySelector('.custom-dropdown-item.active');
            const offset = activeItem ? calcOffset(inner, activeItem, isTop) : 0;
            dropdownEl.classList.remove('open');
            inner.style.transform = `translateY(${offset}px)`;
            trigger.setAttribute('aria-expanded', 'false');
        } else {
            close(trigger, menu, dropdownEl);
        }
    }

    // Toggle menu
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dropdownEl.classList.contains('open')) {
            doClose();
        } else {
            doOpen();
        }
    });

    // Item selection
    menu.addEventListener('click', (e) => {
        const item = e.target.closest('.custom-dropdown-item');
        if (!item || item.classList.contains('disabled')) return;
        const value = item.dataset.value;
        label.textContent = item.dataset.label || item.textContent;
        syncActive(menu, value);
        doClose();
        if (onSelect) onSelect(value, item.textContent);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!dropdownEl.contains(e.target)) {
            doClose();
        }
    });

    // Keyboard
    trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            doClose();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            if (!dropdownEl.classList.contains('open')) {
                doOpen();
            }
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

/**
 * Calculate the translateY offset to position the active item at the
 * visible edge of the collapsed menu.
 *
 * Bottom controls (flex-end): active item at bottom → positive offset
 * Top controls (flex-start): active item at top → negative offset
 */
function calcOffset(inner, activeItem, isTop) {
    if (isTop) {
        return -activeItem.offsetTop;
    }
    return inner.offsetHeight - activeItem.offsetHeight - activeItem.offsetTop;
}

/**
 * Recalculate the collapsed offset after external active-item changes
 * (e.g. syncDropdown in resolution.js). No-op if not in animate mode.
 */
export function syncAnimateOffset(dropdownEl) {
    if (!dropdownEl?.classList.contains('dd-animate')) return;
    if (dropdownEl.classList.contains('open')) return;
    const inner = dropdownEl.querySelector('.dd-inner');
    if (!inner) return;
    const activeItem = inner.querySelector('.custom-dropdown-item.active');
    if (!activeItem) return;
    const isTop = !!dropdownEl.closest('image-viewer[controls-pos^="top"]');
    inner.style.transition = 'none';
    inner.style.transform = `translateY(${calcOffset(inner, activeItem, isTop)}px)`;
    inner.offsetHeight;
    inner.style.transition = '';
}

function close(trigger, menu, dropdownEl) {
    dropdownEl.classList.remove('open');
    menu.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
}

function syncActive(menu, value) {
    menu.querySelectorAll('.custom-dropdown-item').forEach(item => {
        const isActive = item.dataset.value === value;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-selected', String(isActive));
    });
}
