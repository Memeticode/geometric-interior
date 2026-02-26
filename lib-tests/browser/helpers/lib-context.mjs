/**
 * Playwright context for library test page.
 * Mirrors tests/helpers/browser.mjs but targets lib-test.html.
 */
import { chromium } from 'playwright';

export const LIB_TEST_URL = 'http://localhost:5204/lib-test.html';
const VIEWPORT = { width: 1000, height: 800 };
const GOTO_RETRIES = 3;

async function gotoWithRetry(page, url, retries = GOTO_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            return;
        } catch (err) {
            if (attempt === retries) throw err;
            console.log(`  (page.goto attempt ${attempt} failed, retrying in 2s...)`);
            await page.waitForTimeout(2000);
        }
    }
}

export async function createLibTestContext() {
    const headed = process.env.HEADED === '1';
    const browser = await chromium.launch({
        headless: !headed,
        args: ['--use-gl=angle', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });

    // Block Vite HMR WebSocket
    await page.routeWebSocket('**', _ws => {});

    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await gotoWithRetry(page, LIB_TEST_URL);

    // Wait for testLib to be initialized
    await page.waitForFunction(
        () => (window).testLib && (window).testLib.getInfo().initialized,
        { timeout: 30000 },
    );

    async function cleanup() {
        await browser.close();
    }

    return { browser, page, errors, cleanup };
}

/** Standard midpoint controls for tests. */
export const MID_CONTROLS = {
    topology: 'flow-field',
    palette: 'violet-depth',
    density: 0.5,
    luminosity: 0.5,
    fracture: 0.5,
    depth: 0.5,
    coherence: 0.5,
};

/** All 7 built-in palette keys. */
export const BUILTIN_PALETTES = [
    'violet-depth', 'warm-spectrum', 'teal-volumetric', 'prismatic',
    'crystal-lattice', 'sapphire', 'amethyst',
];
