/**
 * Thumbnail tests: rendering, caching, display on profile cards.
 */
import { createTestContext, ensurePanelOpen, ensureConfigExpanded } from './helpers/browser.mjs';
import { setSeed, setSlider, setProfileName } from './helpers/controls.mjs';
import { waitForStillRendered, sleep } from './helpers/waits.mjs';
import { assertNoPageErrors } from './helpers/assertions.mjs';

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

console.log('\n=== Thumbnail Tests ===\n');

const { page, errors, cleanup } = await createTestContext();

try {
    await waitForStillRendered(page);
    await ensurePanelOpen(page);
    await ensureConfigExpanded(page);

    // Wait extra time for thumbnail queue to drain (10 portraits, each rendered via WebGL worker)
    await sleep(10000);

    // ── Test: Portrait cards have thumbnails ──
    await test('Portrait gallery cards have thumbnail images with src', async () => {
        const thumbs = await page.$$eval(
            '#portraitGallery .profile-thumb',
            imgs => imgs.map(img => ({
                src: img.src,
                hasSrc: !!img.src && img.src !== '' && !img.src.endsWith('/'),
            }))
        );

        if (thumbs.length === 0) {
            throw new Error('No thumbnail images found in portrait gallery');
        }

        const withSrc = thumbs.filter(t => t.hasSrc);
        if (withSrc.length === 0) {
            throw new Error(`None of ${thumbs.length} portrait thumbnails have a src attribute`);
        }

        // At least 3 should have loaded (worker renders thumbnails sequentially)
        if (withSrc.length < 3) {
            throw new Error(`Only ${withSrc.length}/${thumbs.length} thumbnails loaded (expected at least 3)`);
        }
    });

    // ── Test: Active preview has thumbnail ──
    await test('Active preview thumbnail has non-empty src', async () => {
        await sleep(2000); // Extra time for active preview thumbnail

        const src = await page.$eval('#activePreviewThumb', img => img.src);
        if (!src || src === '' || src.endsWith('/')) {
            throw new Error(`Active preview thumb has no src: "${src}"`);
        }
    });

    // ── Test: thumb-loading class removed after render ──
    await test('thumb-loading class removed after thumbnails render', async () => {
        await sleep(3000); // Wait for all thumbnails to process

        const loadingCount = await page.$$eval(
            '#portraitGallery .thumb-wrap.thumb-loading',
            els => els.length
        );

        const totalCount = await page.$$eval(
            '#portraitGallery .thumb-wrap',
            els => els.length
        );

        // Most should have finished loading
        if (loadingCount > totalCount / 2) {
            throw new Error(`${loadingCount}/${totalCount} thumbnails still loading`);
        }
    });

    // ── Test: Newly saved profile gets thumbnail ──
    await test('Newly saved profile gets a thumbnail', async () => {
        await setSeed(page, 'thumb-test-seed');
        await setProfileName(page, 'Thumb Test Profile');
        await setSlider(page, 'density', 0.6);
        await sleep(300);

        // Use evaluate to bypass any modal overlay
        await page.evaluate(() => document.getElementById('saveProfile').click());
        await sleep(300);
        // Dismiss overwrite confirm if it appears
        await page.evaluate(() => {
            const modal = document.getElementById('confirmModal');
            if (modal && !modal.classList.contains('hidden')) {
                const primary = modal.querySelector('.primary') || modal.querySelector('#confirmActions button');
                if (primary) primary.click();
            }
        });
        await sleep(3000); // Wait for gallery refresh + thumbnail render

        // Find the new profile card's thumbnail
        const thumbSrc = await page.evaluate(() => {
            const cards = document.querySelectorAll('#userGallery .profile-card');
            for (const card of cards) {
                const name = card.querySelector('.profile-card-name');
                if (name && name.textContent === 'Thumb Test Profile') {
                    const img = card.querySelector('.profile-thumb');
                    return img ? img.src : null;
                }
            }
            return null;
        });

        if (!thumbSrc || thumbSrc === '' || thumbSrc.endsWith('/')) {
            throw new Error(`Saved profile thumbnail has no src: "${thumbSrc}"`);
        }
    });

    // ── Final ──
    await test('No uncaught page errors', async () => {
        assertNoPageErrors(errors);
    });

} finally {
    await cleanup();
}

console.log(`\nThumbnails: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
