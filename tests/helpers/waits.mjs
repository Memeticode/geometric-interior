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
 * Generic polling utility. Calls conditionFn repeatedly until it returns true.
 * @param {() => Promise<boolean>} conditionFn
 * @param {object} [opts]
 * @param {number} [opts.timeout=10000]
 * @param {number} [opts.interval=200]
 * @param {string} [opts.label='']
 */
export async function waitFor(conditionFn, { timeout = 10000, interval = 200, label = '' } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (await conditionFn()) return;
        await sleep(interval);
    }
    throw new Error(`waitFor timed out after ${timeout}ms${label ? ': ' + label : ''}`);
}

/**
 * Wait until stillRendered is true (export button enabled).
 * This is the canonical signal that a render cycle has completed.
 */
export async function waitForStillRendered(page, timeout = 30000) {
    await page.waitForFunction(
        () => {
            const btn = document.getElementById('exportBtn');
            return btn && !btn.disabled;
        },
        null,
        { timeout }
    );
}

/**
 * Wait for a morph to complete. Polls exportBtn.disabled === false
 * which maps to stillRendered=true set by morph onComplete handler.
 * Uses generous timeout since scene building is slow in headless Chrome.
 */
export async function waitForMorphComplete(page, timeout = 90000) {
    await page.waitForFunction(
        () => {
            const btn = document.getElementById('exportBtn');
            return btn && !btn.disabled;
        },
        null,
        { timeout }
    );
}

/**
 * Wait for a toast message to appear with the given text.
 */
export async function waitForToast(page, text, timeout = 10000) {
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
export async function waitForModalOpen(page, selector, timeout = 5000) {
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
export async function waitForModalClosed(page, selector, timeout = 5000) {
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
