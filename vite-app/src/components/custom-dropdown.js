/**
 * Reusable custom dropdown — replaces native <select> with styled button menu.
 * Supports upward (default) and downward (`.dropdown-down`) opening.
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
 */
export function initCustomDropdown(dropdownEl, { initialValue, labelText, onSelect }) {
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

    // Toggle menu
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !menu.classList.contains('hidden');
        if (isOpen) {
            close(trigger, menu, dropdownEl);
        } else {
            menu.classList.remove('hidden');
            dropdownEl.classList.add('open');
            trigger.setAttribute('aria-expanded', 'true');
        }
    });

    // Item selection
    menu.addEventListener('click', (e) => {
        const item = e.target.closest('.custom-dropdown-item');
        if (!item || item.classList.contains('disabled')) return;
        const value = item.dataset.value;
        label.textContent = item.dataset.label || item.textContent;
        syncActive(menu, value);
        close(trigger, menu, dropdownEl);
        if (onSelect) onSelect(value, item.textContent);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!dropdownEl.contains(e.target)) {
            close(trigger, menu, dropdownEl);
        }
    });

    // Keyboard
    trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            close(trigger, menu, dropdownEl);
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            if (menu.classList.contains('hidden')) {
                menu.classList.remove('hidden');
                dropdownEl.classList.add('open');
                trigger.setAttribute('aria-expanded', 'true');
            }
            const items = [...menu.querySelectorAll('.custom-dropdown-item')];
            const first = e.key === 'ArrowUp' ? items[items.length - 1] : items[0];
            if (first) first.focus();
        }
    });

    menu.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            close(trigger, menu, dropdownEl);
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
