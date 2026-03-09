/**
 * Sidebar tests: open/close, persistence, control visibility, mobile backdrop.
 */
import { fileURLToPath } from 'url';
import path from 'path';
import { ensureConfigExpanded, scrollToElement } from './helpers/browser.mjs';
import { waitForStillRendered } from './helpers/waits.mjs';
import { assertVisible, assertHasClass, assertNotHasClass } from './helpers/assertions.mjs';
import { getSidebarCollapsedState } from './helpers/profiles.mjs';

export async function runTests(page, errors) {
    let passed = 0, failed = 0;

    async function test(name, fn) {
        try {
            await fn();
            passed++;
            console.log(`  PASS: ${name}`);
        } catch (err) {
            failed++;
            console.error(`  FAIL: ${name}`);
            console.error(`    ${err.message}`);
        }
    }

    console.log('\n=== Sidebar Tests ===\n');

    await waitForStillRendered(page);

    async function isSidebarOpen() {
        return page.evaluate(() => {
            const sidebar = document.querySelector('.sidebar');
            return sidebar && !sidebar.classList.contains('sidebar-collapsed');
        });
    }

    // ── Test: Sidebar opens on toggle click ──
    await test('Sidebar opens when toggle is clicked', async () => {
        const open = await isSidebarOpen();
        if (open) {
            await page.click('#sidebarToggle');
            await page.waitForTimeout(400);
        }
        await page.click('#sidebarToggle');
        await page.waitForTimeout(400);
        const nowOpen = await isSidebarOpen();
        if (!nowOpen) throw new Error('Sidebar did not open after click');
    });

    // ── Test: Sidebar closes on second toggle click ──
    await test('Sidebar closes when toggle is clicked again', async () => {
        if (!(await isSidebarOpen())) {
            await page.click('#sidebarToggle');
            await page.waitForTimeout(400);
        }
        await page.click('#sidebarToggle');
        await page.waitForTimeout(400);
        const nowOpen = await isSidebarOpen();
        if (nowOpen) throw new Error('Sidebar did not close after second click');
    });

    // ── Test: Sidebar state persists to localStorage ──
    await test('Sidebar state persists to localStorage', async () => {
        if (!(await isSidebarOpen())) {
            await page.click('#sidebarToggle');
            await page.waitForTimeout(400);
        }
        const openState = await getSidebarCollapsedState(page);
        if (openState === 'true') throw new Error('localStorage says collapsed when sidebar is open');

        await page.click('#sidebarToggle');
        await page.waitForTimeout(400);
        const closedState = await getSidebarCollapsedState(page);
        if (closedState !== 'true') throw new Error(`Expected localStorage collapsed=true, got "${closedState}"`);
    });

    // ── Test: Sliders visible when sidebar is open and config expanded ──
    await test('Sliders are visible when sidebar is open and config expanded', async () => {
        if (!(await isSidebarOpen())) {
            await page.click('#sidebarToggle');
            await page.waitForTimeout(400);
        }
        await ensureConfigExpanded(page);

        for (const id of ['density', 'luminosity', 'fracture', 'coherence', 'hue', 'spectrum', 'chroma', 'scale', 'division', 'faceting', 'flow']) {
            await scrollToElement(page, `#${id}`);
            const visible = await page.$eval(`#${id}`, el => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
            });
            if (!visible) throw new Error(`Slider #${id} is not visible when sidebar is open`);
        }
    });

    // ── Test: Sidebar toggle works on mobile viewport ──
    await test('Sidebar toggle works on mobile viewport', async () => {
        await page.setViewportSize({ width: 768, height: 900 });
        await page.waitForTimeout(300);

        if (!(await isSidebarOpen())) {
            await page.click('#sidebarToggle');
            await page.waitForTimeout(400);
        }
        if (!(await isSidebarOpen())) throw new Error('Sidebar did not open on mobile');

        await page.click('#sidebarToggle');
        await page.waitForTimeout(400);
        if (await isSidebarOpen()) throw new Error('Sidebar did not close on mobile');

        // Restore viewport
        await page.setViewportSize({ width: 1400, height: 900 });
        await page.waitForTimeout(300);
    });

    return { passed, failed };
}

// ── Standalone entry ──
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith(path.basename(__filename))) {
    const { createTestContext } = await import('./helpers/browser.mjs');
    const { page, errors, cleanup } = await createTestContext();
    try {
        const r = await runTests(page, errors);
        console.log(`\nSidebar: ${r.passed} passed, ${r.failed} failed\n`);
        process.exit(r.failed > 0 ? 1 : 0);
    } finally {
        await cleanup();
    }
}
