/**
 * Shared browser launch, page setup, and cleanup for all test files.
 */
import { chromium } from 'playwright';

export const BASE_URL = 'http://localhost:5204';
const VIEWPORT = { width: 1400, height: 900 };
const GOTO_RETRIES = 3;
const APP_READY_TIMEOUT = 30000;

/** Navigate to a URL with retry logic (handles transient ERR_ABORTED under parallel load). */
async function gotoWithRetry(page, url, opts = {}, retries = GOTO_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000, ...opts });
            return;
        } catch (err) {
            if (attempt === retries) throw err;
            console.log(`  (page.goto attempt ${attempt} failed, retrying in 2s...)`);
            await page.waitForTimeout(2000);
        }
    }
}

/**
 * Wait for the app to be fully initialized.
 * The export button is created at the end of main.js, so its existence
 * means all modules loaded and the app ran to completion.
 */
async function waitForAppReady(page, timeout = APP_READY_TIMEOUT) {
    await page.waitForFunction(
        () => document.getElementById('exportBtn') !== null,
        { timeout }
    );
}

/**
 * Create a test context with browser, page, error collector, and cleanup.
 * @param {object} [opts]
 * @param {boolean} [opts.clearStorage=true] Clear localStorage before tests
 * @returns {Promise<{ browser, page, errors: string[], cleanup: () => Promise<void> }>}
 */
export async function createTestContext({ clearStorage = true, animation = true } = {}) {
    const headed = process.env.HEADED === '1';
    const browser = await chromium.launch({
        headless: !headed,
        args: ['--use-gl=angle', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage({ viewport: VIEWPORT });

    // Block Vite HMR WebSocket to prevent mid-test page reloads.
    // Under parallel load, HMR reconnection attempts can destroy execution contexts.
    await page.routeWebSocket('**', ws => {
        // Intercept but don't connect — HMR stays in CONNECTING state harmlessly.
        // Vite's client handles this gracefully (just logs a warning).
    });

    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await gotoWithRetry(page, BASE_URL);
    await waitForAppReady(page);

    if (clearStorage) {
        await page.evaluate((anim) => {
            localStorage.clear();
            if (!anim) localStorage.setItem('geo-anim-enabled', 'false');
        }, animation);
        await gotoWithRetry(page, BASE_URL);
        await waitForAppReady(page);
    }

    async function cleanup() {
        await browser.close();
    }

    return { browser, page, errors, cleanup };
}

/**
 * Reset page state between sub-suites in group runners.
 * Clears errors, localStorage, and reloads the page.
 * @param {object} [opts]
 * @param {boolean} [opts.animation=true] - Set false to disable morph animation.
 */
export async function resetPage(page, errors, { animation = true } = {}) {
    errors.length = 0;
    await page.evaluate((anim) => {
        localStorage.clear();
        if (!anim) localStorage.setItem('geo-anim-enabled', 'false');
    }, animation);
    await gotoWithRetry(page, BASE_URL);
    await waitForAppReady(page);
}

/**
 * Reload the page with retry logic and wait for app readiness.
 * Use this in tests instead of raw page.goto() for resilience under parallel load.
 */
export async function reloadPage(page) {
    await gotoWithRetry(page, BASE_URL);
    await waitForAppReady(page);
}

/**
 * Navigate to an arbitrary URL with retry logic and wait for app readiness.
 * Use this for URL-state tests that need parameterized URLs.
 */
export async function navigateToURL(page, url) {
    await gotoWithRetry(page, url);
    await waitForAppReady(page);
}

/**
 * Get the canvas bounding box for screenshots.
 */
export async function getCanvasBox(page) {
    return page.$eval('#c', el => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
}

/**
 * Take a screenshot of just the canvas area.
 * Returns a Buffer.
 */
export async function screenshotCanvas(page) {
    const clip = await getCanvasBox(page);
    return page.screenshot({ clip });
}

/**
 * Open the panel if it's collapsed. Clicks the panel toggle button.
 */
export async function ensurePanelOpen(page) {
    const isOpen = await page.evaluate(() => {
        const p = document.querySelector('.panel');
        return p && !p.classList.contains('panel-collapsed');
    });
    if (!isOpen) {
        await page.click('#panelToggle');
        await page.waitForTimeout(400);
    }
}

/**
 * Expand the Active card's configuration section (palette, sliders, etc.)
 * by clicking the chevron toggle if not already expanded.
 * This reveals #configControls (palette selector, name, seed, sliders).
 */
export async function ensureConfigExpanded(page) {
    const expanded = await page.evaluate(() => {
        const toggle = document.getElementById('activeCardToggle');
        return toggle && toggle.getAttribute('aria-expanded') === 'true';
    });
    if (!expanded) {
        await page.click('#activeCardToggle');
        await page.waitForTimeout(300);
    }
}

/**
 * Scroll a panel element into view within the panel's scrollable area.
 */
export async function scrollToElement(page, selector) {
    await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    }, selector);
    await page.waitForTimeout(100);
}
