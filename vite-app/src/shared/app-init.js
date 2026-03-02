/**
 * Shared application initialization — called once by each page entry point.
 *
 * Creates shared DOM elements (modals, toast, tooltip), initializes
 * locale, tooltips, toast, and statement modal.
 *
 * @param {{ page: 'gallery' | 'image' | 'animation' }} opts
 * @returns {{ statement: { loadContent, closeStatementModal }, favicon }}
 */

import { createSharedDOM } from './create-shared-dom.js';
import { initLocale } from '../i18n/locale.js';
import { initTooltips } from './tooltips.js';
import { initToastClose } from './toast.js';
import { initStatementModal } from './statement.js';
import { createFaviconAnimation } from '../ui/animated-favicon.js';

export function initApp({ page } = {}) {
    // 1. Create shared DOM (modals, toast, tooltip container)
    const { statementRefs, infoModalRefs } = createSharedDOM();

    // 2. Init locale system
    initLocale();

    // 3. Init tooltips (delegation on document, uses #paramTooltip)
    initTooltips();

    // 4. Init toast close button
    initToastClose();

    // 5. Init statement modal — merge modal refs with page-specific trigger buttons
    const statement = initStatementModal({
        ...statementRefs,
        developerStatement: document.getElementById('developerStatement'),
        artistStatement: document.getElementById('artistStatement'),
        governanceStatement: document.getElementById('governanceStatement'),
    });

    // 6. Animated favicon
    const favicon = createFaviconAnimation();

    return { statement, favicon, infoModalRefs };
}
