/**
 * Thumbnail tests: rendering, caching, display on profile cards.
 */
import { fileURLToPath } from 'url';
import path from 'path';
import { ensurePanelOpen, ensureConfigExpanded } from './helpers/browser.mjs';
import { setSeed, setSlider, setProfileName } from './helpers/controls.mjs';
import { waitForStillRendered, waitFor, sleep } from './helpers/waits.mjs';
import { assertNoPageErrors } from './helpers/assertions.mjs';

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

    console.log('\n=== Thumbnail Tests ===\n');

    await waitForStillRendered(page);
    await ensurePanelOpen(page);
    await ensureConfigExpanded(page);

    // Poll for thumbnail queue to drain instead of fixed 10s sleep
    await waitFor(async () => {
        const count = await page.$$eval(
            '#portraitGallery .profile-thumb',
            imgs => imgs.filter(img => img.src && img.src !== '' && !img.src.endsWith('/')).length
        );
        return count >= 3;
    }, { timeout: 15000, interval: 500, label: 'portrait thumbnails loaded' });

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

        if (withSrc.length < 3) {
            throw new Error(`Only ${withSrc.length}/${thumbs.length} thumbnails loaded (expected at least 3)`);
        }
    });

    // ── Test: Active preview has thumbnail ──
    await test('Active preview thumbnail has non-empty src', async () => {
        await waitFor(async () => {
            const src = await page.$eval('#activePreviewThumb', img => img.src);
            return src && src !== '' && !src.endsWith('/');
        }, { timeout: 5000, interval: 300, label: 'active preview thumb loaded' });

        const src = await page.$eval('#activePreviewThumb', img => img.src);
        if (!src || src === '' || src.endsWith('/')) {
            throw new Error(`Active preview thumb has no src: "${src}"`);
        }
    });

    // ── Test: thumb-loading class removed after render ──
    await test('thumb-loading class removed after thumbnails render', async () => {
        await waitFor(async () => {
            const counts = await page.evaluate(() => {
                const loading = document.querySelectorAll('#portraitGallery .thumb-wrap.thumb-loading').length;
                const total = document.querySelectorAll('#portraitGallery .thumb-wrap').length;
                return { loading, total };
            });
            return counts.loading <= Math.floor(counts.total / 2);
        }, { timeout: 8000, interval: 500, label: 'thumbnails processed' });

        const loadingCount = await page.$$eval(
            '#portraitGallery .thumb-wrap.thumb-loading', els => els.length
        );
        const totalCount = await page.$$eval(
            '#portraitGallery .thumb-wrap', els => els.length
        );

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

        await page.evaluate(() => document.getElementById('saveProfile').click());
        await sleep(300);
        await page.evaluate(() => {
            const modal = document.getElementById('confirmModal');
            if (modal && !modal.classList.contains('hidden')) {
                const primary = modal.querySelector('.primary') || modal.querySelector('#confirmActions button');
                if (primary) primary.click();
            }
        });

        // Poll for new card thumbnail instead of fixed 3s sleep
        await waitFor(async () => {
            return page.evaluate(() => {
                const cards = document.querySelectorAll('#userGallery .profile-card');
                for (const card of cards) {
                    const name = card.querySelector('.profile-card-name');
                    if (name && name.textContent === 'Thumb Test Profile') {
                        const img = card.querySelector('.profile-thumb');
                        return img && img.src && img.src !== '' && !img.src.endsWith('/');
                    }
                }
                return false;
            });
        }, { timeout: 8000, interval: 500, label: 'new profile thumbnail rendered' });

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

    return { passed, failed };
}

// ── Standalone entry ──
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith(path.basename(__filename))) {
    const { createTestContext } = await import('./helpers/browser.mjs');
    const { page, errors, cleanup } = await createTestContext();
    try {
        const r = await runTests(page, errors);
        console.log(`\nThumbnails: ${r.passed} passed, ${r.failed} failed\n`);
        process.exit(r.failed > 0 ? 1 : 0);
    } finally {
        await cleanup();
    }
}
