/**
 * Confirm modal and Info modal — shared, reusable modal utilities.
 * Self-contained, looks up DOM elements by ID.
 */

/* ---------------------------
 * Confirm modal
 * ---------------------------
 */
function closeConfirm() {
    const modal = document.getElementById('confirmModal');
    modal.classList.add('modal-leaving');
    const box = modal.querySelector('.modal-box');
    box.addEventListener('animationend', () => {
        modal.classList.add('hidden');
        modal.classList.remove('modal-leaving');
    }, { once: true });
}

/**
 * Show a confirmation dialog with custom action buttons.
 * @param {string} title
 * @param {string} message
 * @param {Array<{label: string, value: any, primary?: boolean}>} actions
 * @returns {Promise<any>} resolves with the chosen action's value
 */
export function showConfirm(title, message, actions) {
    return new Promise(resolve => {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmBody').textContent = message;
        const actionsEl = document.getElementById('confirmActions');
        actionsEl.innerHTML = '';
        actions.forEach(({ label, value, primary }) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            if (primary) btn.classList.add('primary');
            btn.addEventListener('click', () => { closeConfirm(); resolve(value); });
            actionsEl.appendChild(btn);
        });
        modal.classList.remove('hidden');
        modal.classList.add('modal-entering');
        const box = modal.querySelector('.modal-box');
        box.addEventListener('animationend', () => modal.classList.remove('modal-entering'), { once: true });
    });
}

/* ---------------------------
 * Info modal
 * ---------------------------
 */
let infoModalEl = null;
let infoModalTitleEl = null;
let infoModalBodyEl = null;

export function openInfoModal(title, body) {
    infoModalTitleEl.textContent = title;
    infoModalBodyEl.textContent = body;
    infoModalEl.classList.remove('hidden');
}

export function closeInfoModal() {
    infoModalEl.classList.add('hidden');
}

/**
 * Initialize info modal, label-info click delegation, info-modal close handlers,
 * and the Escape key handler.
 *
 * @param {Object} opts
 * @param {HTMLElement} opts.infoModal
 * @param {HTMLElement} opts.infoModalTitle
 * @param {HTMLElement} opts.infoModalBody
 * @param {HTMLElement} opts.infoModalClose
 * @param {Array<() => boolean>} opts.escapeHandlers - ordered list of callbacks to try on Escape.
 *   Each returns true if it handled the key (e.g. closed a modal).
 */
export function initModals({ infoModal, infoModalTitle, infoModalBody, infoModalClose, escapeHandlers = [] }) {
    infoModalEl = infoModal;
    infoModalTitleEl = infoModalTitle;
    infoModalBodyEl = infoModalBody;

    infoModalClose.addEventListener('click', closeInfoModal);
    infoModal.addEventListener('click', (e) => { if (e.target === infoModal) closeInfoModal(); });

    /* Click delegation for .label-info elements (opens info modal) */
    document.addEventListener('click', (e) => {
        const labelInfo = e.target.closest('.label-info');
        if (labelInfo) {
            const title = labelInfo.getAttribute('data-label') || '';
            const body = labelInfo.getAttribute('data-tooltip') || '';
            openInfoModal(title, body);
        }
    });

    /* Escape key — try each handler in order */
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        for (const handler of escapeHandlers) {
            if (handler()) return;
        }
    });
}
