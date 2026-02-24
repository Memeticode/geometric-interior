/**
 * Async wait utilities for Playwright tests.
 */

/**
 * Simple sleep.
 */
export function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

/**
 * Wait until stillRendered is true (export button enabled).
 * This is the canonical signal that a render cycle has completed.
 */
export async function waitForStillRendered(page, timeout = 8000) {
    await page.waitForFunction(
        () => {
            const btn = document.getElementById('exportBtn');
            return btn && !btn.disabled;
        },
        { timeout }
    );
}

/**
 * Wait for a morph to complete: MORPH_DURATION_MS (1500) + buffer,
 * then verify render is done via export button.
 */
export async function waitForMorphComplete(page, timeout = 5000) {
    await sleep(2000); // 1500ms morph + 500ms buffer
    await waitForStillRendered(page, timeout);
}

/**
 * Wait for a toast message to appear with the given text.
 */
export async function waitForToast(page, text, timeout = 5000) {
    await page.waitForFunction(
        (t) => {
            const toasts = document.querySelectorAll('.toast');
            return Array.from(toasts).some(el =>
                el.textContent.includes(t) && el.classList.contains('visible')
            );
        },
        text,
        { timeout }
    );
}

/**
 * Wait until a modal is visible (not hidden).
 */
export async function waitForModalOpen(page, selector, timeout = 3000) {
    await page.waitForFunction(
        (sel) => {
            const el = document.querySelector(sel);
            return el && !el.classList.contains('hidden');
        },
        selector,
        { timeout }
    );
}

/**
 * Wait until a modal is hidden.
 */
export async function waitForModalClosed(page, selector, timeout = 3000) {
    await page.waitForFunction(
        (sel) => {
            const el = document.querySelector(sel);
            return el && el.classList.contains('hidden');
        },
        selector,
        { timeout }
    );
}

/**
 * Wait a fixed time for slider-triggered renders (which don't set stillRendered).
 */
export async function waitForRender(page, ms = 2000) {
    await sleep(ms);
}
