/**
 * Shared browser launch, page setup, and cleanup for all test files.
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5204';
const VIEWPORT = { width: 1400, height: 900 };
const INIT_WAIT_MS = 3000;

/**
 * Create a test context with browser, page, error collector, and cleanup.
 * @param {object} [opts]
 * @param {boolean} [opts.clearStorage=true] Clear localStorage before tests
 * @returns {Promise<{ browser, page, errors: string[], cleanup: () => Promise<void> }>}
 */
export async function createTestContext({ clearStorage = true } = {}) {
    const headed = process.env.HEADED === '1';
    const browser = await chromium.launch({
        headless: !headed,
        args: ['--use-gl=angle'],
    });
    const page = await browser.newPage({ viewport: VIEWPORT });

    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(INIT_WAIT_MS);

    if (clearStorage) {
        await page.evaluate(() => localStorage.clear());
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(INIT_WAIT_MS);
    }

    async function cleanup() {
        await browser.close();
    }

    return { browser, page, errors, cleanup };
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
