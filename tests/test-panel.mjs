/**
 * Panel tests: open/close, persistence, control visibility, mobile backdrop.
 */
import { createTestContext, ensureConfigExpanded, scrollToElement } from './helpers/browser.mjs';
import { waitForStillRendered } from './helpers/waits.mjs';
import { assertVisible, assertHasClass, assertNotHasClass } from './helpers/assertions.mjs';
import { getPanelCollapsedState } from './helpers/profiles.mjs';

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

console.log('\n=== Panel Tests ===\n');

const { page, cleanup } = await createTestContext();

try {
    await waitForStillRendered(page);

    // Helper: check panel state
    async function isPanelOpen() {
        return page.evaluate(() => {
            const panel = document.querySelector('.panel');
            return panel && !panel.classList.contains('panel-collapsed');
        });
    }

    // ── Test: Panel opens on toggle click ──
    await test('Panel opens when toggle is clicked', async () => {
        // Ensure panel is closed first
        const open = await isPanelOpen();
        if (open) {
            await page.click('#panelToggle');
            await page.waitForTimeout(400);
        }
        // Now open it
        await page.click('#panelToggle');
        await page.waitForTimeout(400);
        const nowOpen = await isPanelOpen();
        if (!nowOpen) throw new Error('Panel did not open after click');
    });

    // ── Test: Panel closes on second toggle click ──
    await test('Panel closes when toggle is clicked again', async () => {
        // Ensure panel is open
        if (!(await isPanelOpen())) {
            await page.click('#panelToggle');
            await page.waitForTimeout(400);
        }
        // Close it
        await page.click('#panelToggle');
        await page.waitForTimeout(400);
        const nowOpen = await isPanelOpen();
        if (nowOpen) throw new Error('Panel did not close after second click');
    });

    // ── Test: Panel state persists to localStorage ──
    await test('Panel state persists to localStorage', async () => {
        // Open panel
        if (!(await isPanelOpen())) {
            await page.click('#panelToggle');
            await page.waitForTimeout(400);
        }
        const openState = await getPanelCollapsedState(page);
        if (openState === 'true') throw new Error('localStorage says collapsed when panel is open');

        // Close panel
        await page.click('#panelToggle');
        await page.waitForTimeout(400);
        const closedState = await getPanelCollapsedState(page);
        if (closedState !== 'true') throw new Error(`Expected localStorage collapsed=true, got "${closedState}"`);
    });

    // ── Test: Sliders visible when panel is open and config expanded ──
    await test('Sliders are visible when panel is open and config expanded', async () => {
        // Open panel
        if (!(await isPanelOpen())) {
            await page.click('#panelToggle');
            await page.waitForTimeout(400);
        }
        // Expand config section
        await ensureConfigExpanded(page);

        // Check sliders are visible (scroll to each one)
        for (const id of ['density', 'luminosity', 'fracture', 'depth', 'coherence']) {
            await scrollToElement(page, `#${id}`);
            const visible = await page.$eval(`#${id}`, el => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
            });
            if (!visible) throw new Error(`Slider #${id} is not visible when panel is open`);
        }
    });

    // ── Test: Panel toggle works on mobile viewport ──
    await test('Panel toggle works on mobile viewport', async () => {
        // Resize to mobile
        await page.setViewportSize({ width: 768, height: 900 });
        await page.waitForTimeout(300);

        // Open panel
        if (!(await isPanelOpen())) {
            await page.click('#panelToggle');
            await page.waitForTimeout(400);
        }
        if (!(await isPanelOpen())) throw new Error('Panel did not open on mobile');

        // Close panel via toggle
        await page.click('#panelToggle');
        await page.waitForTimeout(400);
        if (await isPanelOpen()) throw new Error('Panel did not close on mobile');

        // Restore viewport
        await page.setViewportSize({ width: 1400, height: 900 });
        await page.waitForTimeout(300);
    });

} finally {
    await cleanup();
}

console.log(`\nPanel: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
