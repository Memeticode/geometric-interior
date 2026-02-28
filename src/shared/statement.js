/**
 * Statement modal — artist / developer / governance statement viewer
 * with coin-flip tab animation and content loading.
 *
 * Call initStatementModal(domRefs) to set up. Returns { loadContent, closeStatementModal }.
 */

import { t, getLocale } from '../i18n/locale.js';

const STATEMENT_TITLES = { developer: '', artist: '', governance: '' };

function simpleMarkdownToHtml(md) {
    return md
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^---$/gm, '<hr>')
        .split(/\n\n+/)
        .map(block => {
            block = block.trim();
            if (!block || block.startsWith('<h2>') || block === '<hr>') return block;
            return `<p>${block}</p>`;
        })
        .join('\n');
}

/**
 * @param {Object} dom - DOM element references:
 *   statementModal, statementModalClose, statementTabSelect, statementTitle,
 *   developerBody, artistBody, governanceBody,
 *   developerStatement, artistStatement, governanceStatement
 *
 * @returns {{ loadContent: () => Promise<void>, closeStatementModal: () => void }}
 */
export function initStatementModal(dom) {
    let statementContentReady = null;
    let statementFlipping = false;
    let statementClosing = false;

    async function loadStatementContent() {
        const locale = getLocale();
        const files = {
            developerTitle: `/txt/${locale}/developer-statement-title.txt`,
            artistTitle: `/txt/${locale}/artist-statement-title.txt`,
            developerContent: `/txt/${locale}/developer-statement-content.txt`,
            artistContent: `/txt/${locale}/artist-statement-content.txt`,
            developerFooter: `/txt/${locale}/developer-statement-footer.txt`,
            governanceTitle: `/txt/${locale}/governance-framework-title.txt`,
            governanceContent: `/md/${locale}/governance-framework-content.md`,
        };
        try {
            // Fetch with English fallback for missing locale files
            const fetchWithFallback = (path) =>
                fetch(path).then(r => {
                    if (r.ok) return r.text();
                    if (locale !== 'en') return fetch(path.replace(`/${locale}/`, '/en/')).then(r2 => {
                        if (r2.ok) return r2.text();
                        throw new Error(`Missing: ${path}`);
                    });
                    throw new Error(`Missing: ${path}`);
                });
            const [devTitle, artTitle, devContent, artContent, devFooter, govTitle, govContent] = await Promise.all(
                Object.values(files).map(fetchWithFallback)
            );
            STATEMENT_TITLES.developer = devTitle.trim();
            STATEMENT_TITLES.artist = artTitle.trim();
            STATEMENT_TITLES.governance = govTitle.trim();
            dom.developerBody.querySelector('.manifesto').textContent = devContent.trim();
            dom.artistBody.querySelector('.manifesto').textContent = artContent.trim();
            dom.governanceBody.querySelector('.manifesto').innerHTML = simpleMarkdownToHtml(govContent.trim());
            const noteEl = dom.artistBody.querySelector('.manifesto-note');
            if (noteEl) noteEl.textContent = devFooter.trim();
        } catch (err) {
            console.error('Failed to load statement content:', err);
        }
    }

    function switchStatementTab(tab, animate = true) {
        const bodyMap = { developer: dom.developerBody, artist: dom.artistBody, governance: dom.governanceBody };
        const currentTab = Object.keys(bodyMap).find(k => !bodyMap[k].classList.contains('hidden')) || 'artist';

        dom.statementModal.querySelectorAll('.modal-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        /* Sync custom dropdown */
        const selectLabel = dom.statementTabSelect.querySelector('.modal-tab-select-label');
        if (selectLabel) {
            const labelKeys = { artist: 'statement.artist', developer: 'statement.developer', governance: 'statement.governance' };
            selectLabel.textContent = t(labelKeys[tab]) || tab;
        }
        dom.statementTabSelect.querySelectorAll('.modal-tab-select-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        if (!animate || currentTab === tab || statementFlipping) {
            dom.statementTitle.textContent = STATEMENT_TITLES[tab] || '';
            for (const [k, body] of Object.entries(bodyMap)) {
                body.classList.toggle('hidden', k !== tab);
            }
            return;
        }

        statementFlipping = true;
        const outgoing = bodyMap[currentTab];
        const incoming = bodyMap[tab];
        const modalBody = dom.statementModal.querySelector('.modal-body');
        const modalBox = dom.statementModal.querySelector('.modal-box');
        const FLIP_OUT_MS = 300;

        /* Hide scrollbar for the entire transition (flip-out + flip-in) */
        modalBody.style.overflow = 'hidden';

        /* Flip the modal body (content area), keeping the header/tabs static */
        modalBody.classList.add('coin-flip-out');

        setTimeout(() => {
            modalBody.classList.remove('coin-flip-out');

            /* Suppress the modal-box height transition so it snaps instantly */
            modalBox.style.transition = 'none';

            outgoing.classList.add('hidden');
            dom.statementTitle.textContent = STATEMENT_TITLES[tab] || '';
            incoming.classList.remove('hidden');

            modalBody.scrollTop = 0;

            /* Force reflow so the box settles at its new height before
               re-enabling transitions */
            void modalBox.offsetHeight;
            modalBox.style.transition = '';

            modalBody.classList.add('coin-flip-in');

            const cleanup = () => {
                modalBody.classList.remove('coin-flip-in');
                modalBody.style.overflow = '';
                statementFlipping = false;
            };
            modalBody.addEventListener('animationend', cleanup, { once: true });
        }, FLIP_OUT_MS);
    }

    async function openStatementModal(tab) {
        if (statementClosing) return;
        if (statementContentReady) await statementContentReady;
        dom.statementModal.classList.remove('hidden');
        dom.statementModal.classList.remove('modal-leaving');
        dom.statementModal.classList.add('modal-entering');
        const box = dom.statementModal.querySelector('.modal-box');
        box.addEventListener('animationend', () => {
            dom.statementModal.classList.remove('modal-entering');
        }, { once: true });
        switchStatementTab(tab, false);
    }

    function closeStatementModal() {
        if (statementClosing) return;
        statementClosing = true;
        statementFlipping = false;
        dom.statementModal.classList.remove('modal-entering');
        dom.statementModal.classList.add('modal-leaving');
        const box = dom.statementModal.querySelector('.modal-box');
        box.addEventListener('animationend', () => {
            dom.statementModal.classList.add('hidden');
            dom.statementModal.classList.remove('modal-leaving');
            statementClosing = false;
        }, { once: true });
    }

    /* Wire up trigger buttons */
    dom.developerStatement.addEventListener('click', () => openStatementModal('developer'));
    dom.artistStatement.addEventListener('click', () => openStatementModal('artist'));
    dom.governanceStatement.addEventListener('click', () => openStatementModal('governance'));
    dom.statementModalClose.addEventListener('click', closeStatementModal);

    /* Custom dropdown for mobile tab select */
    const tabSelectTrigger = dom.statementTabSelect.querySelector('.modal-tab-select-trigger');
    const tabSelectMenu = dom.statementTabSelect.querySelector('.modal-tab-select-menu');
    if (tabSelectTrigger && tabSelectMenu) {
        tabSelectTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = !tabSelectMenu.classList.contains('hidden');
            tabSelectMenu.classList.toggle('hidden', isOpen);
            dom.statementTabSelect.classList.toggle('open', !isOpen);
        });
        tabSelectMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.modal-tab-select-item');
            if (!item) return;
            switchStatementTab(item.dataset.tab);
            dom.statementTabSelect.classList.remove('open');
            tabSelectMenu.classList.add('closing');
            tabSelectMenu.addEventListener('transitionend', () => {
                tabSelectMenu.classList.remove('closing');
                tabSelectMenu.classList.add('hidden');
            }, { once: true });
        });
        /* Close dropdown when clicking anywhere else in the modal */
        dom.statementModal.addEventListener('click', (e) => {
            if (!dom.statementTabSelect.contains(e.target)) {
                tabSelectMenu.classList.add('hidden');
                dom.statementTabSelect.classList.remove('open');
            }
        });
    }

    dom.statementModal.addEventListener('click', (e) => {
        if (e.target === dom.statementModal) closeStatementModal();
        const tab = e.target.closest('.modal-tab');
        if (tab) switchStatementTab(tab.dataset.tab);
    });

    /* Reload statement content on locale change */
    document.addEventListener('localechange', () => {
        statementContentReady = loadStatementContent();
    });

    return {
        loadContent() {
            statementContentReady = loadStatementContent();
            return statementContentReady;
        },
        closeStatementModal,
    };
}
