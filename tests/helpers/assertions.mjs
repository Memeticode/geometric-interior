/**
 * Assertion helpers for Playwright tests.
 */

/**
 * Assert that a canvas screenshot has non-uniform pixels (not solid black).
 * Uses the raw PNG buffer — checks that not all bytes in the data portion are identical.
 */
export function assertCanvasNonEmpty(screenshotBuffer) {
    if (!screenshotBuffer || screenshotBuffer.length < 100) {
        throw new Error('Screenshot buffer is empty or too small');
    }
    // PNG data: just check that we have varied byte values beyond the header
    const bytes = new Uint8Array(screenshotBuffer);
    const sample = bytes.slice(100, Math.min(bytes.length, 2000));
    const unique = new Set(sample);
    if (unique.size < 3) {
        throw new Error(`Canvas appears empty/uniform (only ${unique.size} unique byte values in sample)`);
    }
}

/**
 * Assert two screenshot buffers are different.
 */
export function assertScreenshotsDiffer(bufA, bufB) {
    if (bufA.length === bufB.length) {
        const a = new Uint8Array(bufA);
        const b = new Uint8Array(bufB);
        let same = true;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) { same = false; break; }
        }
        if (same) {
            throw new Error('Screenshots are identical but expected to differ');
        }
    }
}

/**
 * Assert two screenshot buffers are identical.
 */
export function assertScreenshotsMatch(bufA, bufB) {
    if (bufA.length !== bufB.length) {
        throw new Error(`Screenshot sizes differ: ${bufA.length} vs ${bufB.length}`);
    }
    const a = new Uint8Array(bufA);
    const b = new Uint8Array(bufB);
    let diffCount = 0;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) diffCount++;
    }
    if (diffCount > 0) {
        throw new Error(`Screenshots differ in ${diffCount} bytes`);
    }
}

/**
 * Assert an element is not disabled.
 */
export async function assertEnabled(page, selector) {
    const disabled = await page.$eval(selector, el => el.disabled);
    if (disabled) throw new Error(`Expected ${selector} to be enabled but it is disabled`);
}

/**
 * Assert an element is disabled.
 */
export async function assertDisabled(page, selector) {
    const disabled = await page.$eval(selector, el => el.disabled);
    if (!disabled) throw new Error(`Expected ${selector} to be disabled but it is enabled`);
}

/**
 * Assert an element is visible (not hidden class, and has dimensions).
 */
export async function assertVisible(page, selector) {
    const info = await page.$eval(selector, el => ({
        hidden: el.classList.contains('hidden'),
        display: getComputedStyle(el).display,
        width: el.offsetWidth,
        height: el.offsetHeight,
    }));
    if (info.hidden || info.display === 'none' || (info.width === 0 && info.height === 0)) {
        throw new Error(`Expected ${selector} to be visible but it is not (hidden=${info.hidden}, display=${info.display}, ${info.width}x${info.height})`);
    }
}

/**
 * Assert an element is hidden.
 */
export async function assertHidden(page, selector) {
    const hidden = await page.$eval(selector, el =>
        el.classList.contains('hidden') || getComputedStyle(el).display === 'none'
    );
    if (!hidden) throw new Error(`Expected ${selector} to be hidden but it is visible`);
}

/**
 * Assert element's text content contains expected string.
 */
export async function assertTextContains(page, selector, expected) {
    const text = await page.$eval(selector, el => el.textContent);
    if (!text.includes(expected)) {
        throw new Error(`Expected ${selector} text to contain "${expected}" but got "${text.slice(0, 100)}"`);
    }
}

/**
 * Assert element's text content is non-empty.
 */
export async function assertTextNonEmpty(page, selector) {
    const text = await page.$eval(selector, el => el.textContent.trim());
    if (!text) throw new Error(`Expected ${selector} to have non-empty text`);
}

/**
 * Assert element has a specific class.
 */
export async function assertHasClass(page, selector, className) {
    const has = await page.$eval(selector, (el, cls) => el.classList.contains(cls), className);
    if (!has) throw new Error(`Expected ${selector} to have class "${className}"`);
}

/**
 * Assert element does NOT have a specific class.
 */
export async function assertNotHasClass(page, selector, className) {
    const has = await page.$eval(selector, (el, cls) => el.classList.contains(cls), className);
    if (has) throw new Error(`Expected ${selector} to NOT have class "${className}"`);
}

/**
 * Assert no page errors were collected.
 */
export function assertNoPageErrors(errors) {
    if (errors.length > 0) {
        throw new Error(`Page errors:\n  ${errors.join('\n  ')}`);
    }
}

/**
 * Assert a count of matching elements.
 */
export async function assertElementCount(page, selector, expected) {
    const count = await page.$$eval(selector, els => els.length);
    if (count !== expected) {
        throw new Error(`Expected ${expected} elements matching "${selector}" but found ${count}`);
    }
}

/**
 * Assert a value is within a range [min, max] inclusive.
 */
export function assertInRange(value, min, max, label = 'value') {
    if (value < min || value > max) {
        throw new Error(`Expected ${label} to be in [${min}, ${max}] but got ${value}`);
    }
}
