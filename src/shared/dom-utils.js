/**
 * Small shared DOM utilities.
 */

/* Auto-grow textareas (fallback for browsers without field-sizing: content) */
export function autoGrow(ta) {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
}

/** Attach auto-grow behaviour to all `textarea.auto-grow` elements on the page. */
export function initAutoGrowTextareas() {
    for (const ta of document.querySelectorAll('textarea.auto-grow')) {
        ta.addEventListener('input', () => autoGrow(ta));
        autoGrow(ta);
    }
}
