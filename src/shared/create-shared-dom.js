/**
 * Programmatically creates shared DOM elements (modals, toast, tooltip)
 * that were previously duplicated across all HTML entry points.
 *
 * Call createSharedDOM() once on page load, before initializing
 * statement modal, confirm modal, toast, or tooltips.
 */

function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k.startsWith('data-')) e.setAttribute(k, v);
        else if (k === 'style') e.setAttribute('style', v);
        else e.setAttribute(k, v);
    }
    for (const child of children) {
        if (typeof child === 'string') e.appendChild(document.createTextNode(child));
        else e.appendChild(child);
    }
    return e;
}

function panelToggleIcon() {
    return el('div', { class: 'panel-toggle-icon' }, [
        el('span', { class: 'bar bar-top' }),
        el('span', { class: 'bar bar-mid' }),
        el('span', { class: 'bar bar-bot' }),
    ]);
}

function createStatementModal() {
    const tabs = ['artist', 'developer', 'governance'];
    const i18nKeys = {
        artist: 'statement.artist',
        developer: 'statement.developer',
        governance: 'statement.governance',
    };
    const defaultLabels = {
        artist: 'Artist Statement',
        developer: 'Developer Statement',
        governance: 'Governance Framework',
    };

    // Desktop tabs
    const tabBtns = tabs.map((tab, i) =>
        el('button', {
            class: i === 0 ? 'modal-tab active' : 'modal-tab',
            'data-tab': tab,
            'data-i18n': i18nKeys[tab],
            text: defaultLabels[tab],
        })
    );

    // Mobile tab select
    const selectItems = tabs.map((tab, i) =>
        el('button', {
            class: i === 0 ? 'modal-tab-select-item active' : 'modal-tab-select-item',
            'data-tab': tab,
            'data-i18n': i18nKeys[tab],
            text: defaultLabels[tab],
        })
    );

    const tabSelect = el('div', { id: 'statementTabSelect', class: 'modal-tab-select', 'aria-label': 'Select section' }, [
        el('button', { class: 'modal-tab-select-trigger', type: 'button' }, [
            el('span', { class: 'modal-tab-select-label', 'data-i18n': 'statement.artist', text: 'Artist Statement' }),
            el('span', { class: 'modal-tab-select-chevron', html: '&#9662;' }),
        ]),
        el('div', { class: 'modal-tab-select-menu hidden' }, selectItems),
    ]);

    const closeBtn = el('button', { id: 'statementModalClose', class: 'modal-close', 'aria-label': 'Close', 'data-i18n-aria': 'aria.close' }, [
        panelToggleIcon(),
    ]);

    const developerBody = el('div', { id: 'developerBody', class: 'modal-tab-content' }, [
        el('pre', { class: 'manifesto' }),
    ]);
    const artistBody = el('div', { id: 'artistBody', class: 'modal-tab-content hidden' }, [
        el('pre', { class: 'manifesto' }),
        el('div', { class: 'manifesto-note' }),
    ]);
    const governanceBody = el('div', { id: 'governanceBody', class: 'modal-tab-content hidden' }, [
        el('div', { class: 'manifesto' }),
    ]);

    const modal = el('div', { id: 'statementModal', class: 'modal-overlay hidden', role: 'dialog', 'aria-modal': 'true' }, [
        el('div', { class: 'modal-box' }, [
            el('div', { class: 'modal-header' }, [
                el('div', { class: 'modal-tabs' }, tabBtns),
                tabSelect,
                closeBtn,
            ]),
            el('div', { class: 'modal-body' }, [
                el('div', { class: 'modal-tab-title', id: 'statementTitle' }),
                developerBody,
                artistBody,
                governanceBody,
            ]),
        ]),
    ]);

    return {
        modal,
        refs: {
            statementModal: modal,
            statementModalClose: closeBtn,
            statementTabSelect: tabSelect,
            statementTitle: modal.querySelector('#statementTitle'),
            developerBody,
            artistBody,
            governanceBody,
        },
    };
}

function createConfirmModal() {
    const modal = el('div', { id: 'confirmModal', class: 'modal-overlay hidden', role: 'dialog', 'aria-modal': 'true' }, [
        el('div', { class: 'modal-box', style: 'max-width: 24rem;' }, [
            el('div', { class: 'modal-header' }, [
                el('span', { class: 'modal-title', id: 'confirmTitle' }),
            ]),
            el('div', { class: 'modal-body', id: 'confirmBody', style: 'text-align: center; padding: 1.25rem;' }),
            el('div', { class: 'confirm-actions', id: 'confirmActions' }),
        ]),
    ]);
    return modal;
}

function createInfoModal() {
    const modal = el('div', { id: 'infoModal', class: 'info-modal-overlay hidden', role: 'dialog', 'aria-modal': 'true' }, [
        el('div', { class: 'info-modal-box' }, [
            el('div', { class: 'info-modal-title', id: 'infoModalTitle' }),
            el('div', { class: 'info-modal-body', id: 'infoModalBody' }),
            el('button', { id: 'infoModalClose', class: 'info-modal-close', html: '&times;' }),
        ]),
    ]);
    return modal;
}

function createToast() {
    const closeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    closeSvg.setAttribute('viewBox', '0 0 16 16');
    closeSvg.setAttribute('fill', 'none');
    closeSvg.setAttribute('stroke', 'currentColor');
    closeSvg.setAttribute('stroke-width', '1.5');
    closeSvg.setAttribute('stroke-linecap', 'round');
    closeSvg.setAttribute('width', '12');
    closeSvg.setAttribute('height', '12');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M4 4l8 8M12 4l-8 8');
    closeSvg.appendChild(path);

    const closeBtn = el('button', { class: 'toast-close', id: 'toastClose', 'aria-label': 'Close' });
    closeBtn.appendChild(closeSvg);

    return el('div', { class: 'toast', id: 'toast' }, [
        el('span', { id: 'toastMsg' }),
        closeBtn,
    ]);
}

/**
 * Create and inject all shared DOM elements into document.body.
 * Returns references needed by initStatementModal() and initModals().
 */
export function createSharedDOM() {
    const statement = createStatementModal();
    const confirmModal = createConfirmModal();
    const infoModal = createInfoModal();
    const toast = createToast();
    const paramTooltip = el('div', { id: 'paramTooltip' });

    document.body.appendChild(statement.modal);
    document.body.appendChild(confirmModal);
    document.body.appendChild(infoModal);
    document.body.appendChild(toast);
    document.body.appendChild(paramTooltip);

    return {
        statementRefs: statement.refs,
        infoModalRefs: {
            infoModal,
            infoModalTitle: infoModal.querySelector('#infoModalTitle'),
            infoModalBody: infoModal.querySelector('#infoModalBody'),
            infoModalClose: infoModal.querySelector('#infoModalClose'),
        },
    };
}
