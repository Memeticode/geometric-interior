/**
 * URL state and social share tests: decode from URL, share popover, encode round-trip.
 */
import { fileURLToPath } from 'url';
import path from 'path';
import { BASE_URL, navigateToURL, ensurePanelOpen, ensureConfigExpanded, scrollToElement } from './helpers/browser.mjs';
import { readControlsFromPage, readPaletteTweaksFromPage, readSeed, readProfileName, setSlider } from './helpers/controls.mjs';
import { waitForStillRendered, sleep } from './helpers/waits.mjs';
import { assertNoPageErrors, assertEnabled, assertDisabled, assertHidden, assertVisible } from './helpers/assertions.mjs';

/** Build a full test URL from params object. */
function buildTestURL(params) {
    const url = new URL(BASE_URL);
    for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, String(v));
    }
    return url.toString();
}

/** Assert a numeric value is close to expected (within tolerance). */
function assertClose(actual, expected, tolerance, label) {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`${label}: expected ~${expected}, got ${actual} (tolerance ${tolerance})`);
    }
}

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

    console.log('\n=== URL State Tests ===\n');

    // ════════════════════════════════════════
    // Cluster 1: URL Decode
    // ════════════════════════════════════════

    await test('Full URL params populate all controls correctly', async () => {
        const url = buildTestURL({
            n: 'TestName', s: 'test-seed-42', p: 'warm-spectrum',
            d: '0.33', l: '0.88', f: '0.15', z: '0.72', c: '0.61',
            h: '120', r: '45', a: '0.80',
        });
        await navigateToURL(page, url);
        await waitForStillRendered(page);

        const seed = await readSeed(page);
        if (seed !== 'test-seed-42') throw new Error(`Seed: expected "test-seed-42", got "${seed}"`);

        const name = await readProfileName(page);
        if (name !== 'TestName') throw new Error(`Name: expected "TestName", got "${name}"`);

        const c = await readControlsFromPage(page);
        if (c.palette !== 'warm-spectrum') throw new Error(`Palette: expected "warm-spectrum", got "${c.palette}"`);
        assertClose(c.density, 0.33, 0.02, 'density');
        assertClose(c.luminosity, 0.88, 0.02, 'luminosity');
        assertClose(c.fracture, 0.15, 0.02, 'fracture');
        assertClose(c.depth, 0.72, 0.02, 'depth');
        assertClose(c.coherence, 0.61, 0.02, 'coherence');

        const t = await readPaletteTweaksFromPage(page);
        assertClose(t.baseHue, 120, 1, 'baseHue');
        assertClose(t.hueRange, 45, 1, 'hueRange');
        assertClose(t.saturation, 0.80, 0.02, 'saturation');
    });

    await test('Seed-only URL uses default values for missing params', async () => {
        await navigateToURL(page, `${BASE_URL}/?s=minimal-seed`);
        await waitForStillRendered(page);

        const seed = await readSeed(page);
        if (seed !== 'minimal-seed') throw new Error(`Seed: expected "minimal-seed", got "${seed}"`);

        const c = await readControlsFromPage(page);
        if (c.palette !== 'violet-depth') throw new Error(`Palette: expected "violet-depth", got "${c.palette}"`);
        assertClose(c.density, 0.65, 0.02, 'density');
        assertClose(c.luminosity, 0.70, 0.02, 'luminosity');
        assertClose(c.fracture, 0.35, 0.02, 'fracture');
        assertClose(c.depth, 0.40, 0.02, 'depth');
        assertClose(c.coherence, 0.50, 0.02, 'coherence');
    });

    await test('Name auto-generated when n param absent', async () => {
        const url = buildTestURL({
            s: 'auto-name-seed', p: 'violet-depth',
            d: '0.50', l: '0.50', f: '0.50', z: '0.50', c: '0.50',
        });
        await navigateToURL(page, url);
        await waitForStillRendered(page);

        const name1 = await readProfileName(page);
        if (!name1 || name1.trim().length === 0) throw new Error('Auto-generated name is empty');

        // Reload same URL — name should be deterministic
        await navigateToURL(page, url);
        await waitForStillRendered(page);

        const name2 = await readProfileName(page);
        if (name1 !== name2) {
            throw new Error(`Name not deterministic: "${name1}" vs "${name2}"`);
        }
    });

    // ════════════════════════════════════════
    // Cluster 2: Validation & Edge Cases
    // ════════════════════════════════════════

    await test('Out-of-range values are clamped', async () => {
        const url = buildTestURL({
            s: 'clamp-test',
            d: '-0.5', l: '2.0', f: '0.50', z: '-1', c: '999',
            h: '-50', r: '0', a: '5.0',
        });
        await navigateToURL(page, url);
        await waitForStillRendered(page);

        const c = await readControlsFromPage(page);
        assertClose(c.density, 0, 0.02, 'density (clamped from -0.5)');
        assertClose(c.luminosity, 1, 0.02, 'luminosity (clamped from 2.0)');
        assertClose(c.fracture, 0.50, 0.02, 'fracture');
        assertClose(c.depth, 0, 0.02, 'depth (clamped from -1)');
        assertClose(c.coherence, 1, 0.02, 'coherence (clamped from 999)');

        const t = await readPaletteTweaksFromPage(page);
        assertClose(t.baseHue, 0, 1, 'baseHue (clamped from -50)');
        assertClose(t.hueRange, 5, 1, 'hueRange (clamped from 0)');
        assertClose(t.saturation, 1, 0.02, 'saturation (clamped from 5.0)');
    });

    await test('Invalid palette key falls back to violet-depth', async () => {
        await navigateToURL(page, buildTestURL({ s: 'bad-palette', p: 'nonexistent-palette' }));
        await waitForStillRendered(page);

        const c = await readControlsFromPage(page);
        if (c.palette !== 'violet-depth') {
            throw new Error(`Palette: expected "violet-depth" fallback, got "${c.palette}"`);
        }
    });

    await test('Non-numeric param values fall back to defaults', async () => {
        await navigateToURL(page, buildTestURL({ s: 'nan-test', d: 'abc', l: 'xyz', f: '!@#' }));
        await waitForStillRendered(page);

        const c = await readControlsFromPage(page);
        assertClose(c.density, 0.65, 0.02, 'density (NaN fallback)');
        assertClose(c.luminosity, 0.70, 0.02, 'luminosity (NaN fallback)');
        assertClose(c.fracture, 0.35, 0.02, 'fracture (NaN fallback)');
    });

    await test('No URL params loads default randomized state', async () => {
        await navigateToURL(page, BASE_URL);
        await waitForStillRendered(page);

        const seed = await readSeed(page);
        if (!seed || seed.trim().length === 0) throw new Error('Seed is empty with no URL params');
        // Seed should be set (randomized by the app, not from URL)
    });

    // ════════════════════════════════════════
    // Cluster 3: Share Popover UI
    // ════════════════════════════════════════

    await test('Share button disabled/enabled tracks stillRendered', async () => {
        await navigateToURL(page, BASE_URL);
        await waitForStillRendered(page);

        await assertEnabled(page, '#shareBtn');

        // Slider change sets stillRendered = false
        await ensurePanelOpen(page);
        await ensureConfigExpanded(page);
        await scrollToElement(page, '#density');
        await setSlider(page, 'density', 0.42);
        await sleep(300);

        await assertDisabled(page, '#shareBtn');
    });

    await test('Share popover toggles on click, closes on outside click and Escape', async () => {
        await navigateToURL(page, BASE_URL);
        await waitForStillRendered(page);

        // Initially hidden
        await assertHidden(page, '#sharePopover');

        // Click share button — opens
        await page.click('#shareBtn');
        await sleep(200);
        await assertVisible(page, '#sharePopover');

        // Click again — closes (toggle)
        await page.click('#shareBtn');
        await sleep(200);
        await assertHidden(page, '#sharePopover');

        // Re-open, then click outside — closes
        await page.click('#shareBtn');
        await sleep(200);
        await assertVisible(page, '#sharePopover');
        await page.click('body', { position: { x: 10, y: 10 } });
        await sleep(200);
        await assertHidden(page, '#sharePopover');

        // Re-open, then press Escape — closes
        await page.click('#shareBtn');
        await sleep(200);
        await assertVisible(page, '#sharePopover');
        await page.keyboard.press('Escape');
        await sleep(200);
        await assertHidden(page, '#sharePopover');
    });

    await test('Copy Link writes correct URL to clipboard', async () => {
        const url = buildTestURL({
            s: 'clipboard-seed', p: 'sapphire',
            d: '0.40', l: '0.60', f: '0.20', z: '0.80', c: '0.55',
        });
        await navigateToURL(page, url);
        await waitForStillRendered(page);

        // Spy on clipboard.writeText
        await page.evaluate(() => {
            window.__clipboardText = null;
            navigator.clipboard.writeText = (text) => {
                window.__clipboardText = text;
                return Promise.resolve();
            };
        });

        await page.click('#shareBtn');
        await sleep(200);
        await page.click('#shareCopyLink');
        await sleep(300);

        const clipURL = await page.evaluate(() => window.__clipboardText);
        if (!clipURL) throw new Error('Clipboard writeText was not called');

        const params = new URL(clipURL).searchParams;
        if (params.get('s') !== 'clipboard-seed') throw new Error(`Seed: expected "clipboard-seed", got "${params.get('s')}"`);
        if (params.get('p') !== 'sapphire') throw new Error(`Palette: expected "sapphire", got "${params.get('p')}"`);
        assertClose(parseFloat(params.get('d')), 0.40, 0.02, 'density in URL');
        assertClose(parseFloat(params.get('l')), 0.60, 0.02, 'luminosity in URL');
        assertClose(parseFloat(params.get('f')), 0.20, 0.02, 'fracture in URL');
        assertClose(parseFloat(params.get('z')), 0.80, 0.02, 'depth in URL');
        assertClose(parseFloat(params.get('c')), 0.55, 0.02, 'coherence in URL');

        // Popover should close after copy
        await assertHidden(page, '#sharePopover');
    });

    await test('Twitter share opens correct intent URL', async () => {
        await navigateToURL(page, buildTestURL({ s: 'twitter-test', p: 'violet-depth', d: '0.50', l: '0.50', f: '0.50', z: '0.50', c: '0.50' }));
        await waitForStillRendered(page);

        // Spy on window.open
        await page.evaluate(() => {
            window.__openedURL = null;
            window.open = (url) => { window.__openedURL = url; return null; };
        });

        await page.click('#shareBtn');
        await sleep(200);
        await page.click('#shareTwitter');
        await sleep(200);

        const openedURL = await page.evaluate(() => window.__openedURL);
        if (!openedURL) throw new Error('window.open was not called');
        if (!openedURL.includes('twitter.com/intent/tweet')) {
            throw new Error(`Expected Twitter intent URL, got: ${openedURL.slice(0, 100)}`);
        }
        if (!openedURL.includes('Geometric+Interior') && !openedURL.includes('Geometric%20Interior')) {
            throw new Error('Twitter text does not contain "Geometric Interior"');
        }

        await assertHidden(page, '#sharePopover');
    });

    await test('Facebook share opens correct sharer URL', async () => {
        await navigateToURL(page, buildTestURL({ s: 'fb-test', p: 'violet-depth', d: '0.50', l: '0.50', f: '0.50', z: '0.50', c: '0.50' }));
        await waitForStillRendered(page);

        // Spy on window.open
        await page.evaluate(() => {
            window.__openedURL = null;
            window.open = (url) => { window.__openedURL = url; return null; };
        });

        await page.click('#shareBtn');
        await sleep(200);
        await page.click('#shareFacebook');
        await sleep(200);

        const openedURL = await page.evaluate(() => window.__openedURL);
        if (!openedURL) throw new Error('window.open was not called');
        if (!openedURL.includes('facebook.com/sharer/sharer.php')) {
            throw new Error(`Expected Facebook sharer URL, got: ${openedURL.slice(0, 100)}`);
        }
        // Verify the URL param contains our share URL with seed
        if (!openedURL.includes('s%3D') && !openedURL.includes('s=')) {
            throw new Error('Facebook sharer URL does not contain the share link with seed param');
        }

        await assertHidden(page, '#sharePopover');
    });

    await test('Bluesky share opens correct intent URL', async () => {
        await navigateToURL(page, buildTestURL({ s: 'bsky-test', p: 'violet-depth', d: '0.50', l: '0.50', f: '0.50', z: '0.50', c: '0.50' }));
        await waitForStillRendered(page);

        await page.evaluate(() => {
            window.__openedURL = null;
            window.open = (url) => { window.__openedURL = url; return null; };
        });

        await page.click('#shareBtn');
        await sleep(200);
        await page.click('#shareBluesky');
        await sleep(200);

        const openedURL = await page.evaluate(() => window.__openedURL);
        if (!openedURL) throw new Error('window.open was not called');
        if (!openedURL.includes('bsky.app/intent/compose')) {
            throw new Error(`Expected Bluesky intent URL, got: ${openedURL.slice(0, 100)}`);
        }
        if (!openedURL.includes('Geometric') && !openedURL.includes('geometric')) {
            throw new Error('Bluesky text does not contain project name');
        }

        await assertHidden(page, '#sharePopover');
    });

    await test('Reddit share opens correct submit URL', async () => {
        await navigateToURL(page, buildTestURL({ s: 'reddit-test', p: 'violet-depth', d: '0.50', l: '0.50', f: '0.50', z: '0.50', c: '0.50' }));
        await waitForStillRendered(page);

        await page.evaluate(() => {
            window.__openedURL = null;
            window.open = (url) => { window.__openedURL = url; return null; };
        });

        await page.click('#shareBtn');
        await sleep(200);
        await page.click('#shareReddit');
        await sleep(200);

        const openedURL = await page.evaluate(() => window.__openedURL);
        if (!openedURL) throw new Error('window.open was not called');
        if (!openedURL.includes('reddit.com/submit')) {
            throw new Error(`Expected Reddit submit URL, got: ${openedURL.slice(0, 100)}`);
        }
        if (!openedURL.includes('title=')) {
            throw new Error('Reddit URL missing title parameter');
        }
        if (!openedURL.includes('url=')) {
            throw new Error('Reddit URL missing url parameter');
        }

        await assertHidden(page, '#sharePopover');
    });

    await test('LinkedIn share opens correct share URL', async () => {
        await navigateToURL(page, buildTestURL({ s: 'linkedin-test', p: 'violet-depth', d: '0.50', l: '0.50', f: '0.50', z: '0.50', c: '0.50' }));
        await waitForStillRendered(page);

        await page.evaluate(() => {
            window.__openedURL = null;
            window.open = (url) => { window.__openedURL = url; return null; };
        });

        await page.click('#shareBtn');
        await sleep(200);
        await page.click('#shareLinkedIn');
        await sleep(200);

        const openedURL = await page.evaluate(() => window.__openedURL);
        if (!openedURL) throw new Error('window.open was not called');
        if (!openedURL.includes('linkedin.com/sharing/share-offsite')) {
            throw new Error(`Expected LinkedIn share URL, got: ${openedURL.slice(0, 100)}`);
        }
        if (!openedURL.includes('url=')) {
            throw new Error('LinkedIn URL missing url parameter');
        }

        await assertHidden(page, '#sharePopover');
    });

    await test('Email share sets correct mailto link', async () => {
        await navigateToURL(page, buildTestURL({ s: 'email-test', p: 'violet-depth', d: '0.50', l: '0.50', f: '0.50', z: '0.50', c: '0.50' }));
        await waitForStillRendered(page);

        // Spy on window.open (email handler uses window.open for mailto:)
        await page.evaluate(() => {
            window.__openedURL = null;
            window.open = (url) => { window.__openedURL = url; return null; };
        });

        await page.click('#shareBtn');
        await sleep(200);
        await page.click('#shareEmail');
        await sleep(200);

        const openedURL = await page.evaluate(() => window.__openedURL);
        if (!openedURL) throw new Error('window.open was not called');
        if (!openedURL.startsWith('mailto:?')) {
            throw new Error(`Expected mailto: URL, got: ${openedURL.slice(0, 80)}`);
        }
        if (!openedURL.includes('subject=')) {
            throw new Error('mailto: link missing subject');
        }
        if (!openedURL.includes('body=')) {
            throw new Error('mailto: link missing body');
        }
        if (!openedURL.includes('Geometric') && !openedURL.includes('geometric')) {
            throw new Error('mailto: subject does not contain project name');
        }

        await assertHidden(page, '#sharePopover');
    });

    // ════════════════════════════════════════
    // Cluster 4: Smart Encoding
    // ════════════════════════════════════════

    await test('Palette tweaks omitted from URL when matching defaults', async () => {
        // Navigate with violet-depth defaults (no h/r/a in URL → uses palette defaults)
        await navigateToURL(page, buildTestURL({
            s: 'encode-test', p: 'violet-depth',
            d: '0.50', l: '0.50', f: '0.50', z: '0.50', c: '0.50',
        }));
        await waitForStillRendered(page);

        // Spy on clipboard
        await page.evaluate(() => {
            window.__clipboardText = null;
            navigator.clipboard.writeText = (text) => {
                window.__clipboardText = text;
                return Promise.resolve();
            };
        });

        await page.click('#shareBtn');
        await sleep(200);
        await page.click('#shareCopyLink');
        await sleep(300);

        const url1 = await page.evaluate(() => window.__clipboardText);
        if (!url1) throw new Error('Clipboard not written');
        const params1 = new URL(url1).searchParams;

        // Palette tweaks should NOT be present (they match violet-depth defaults)
        if (params1.has('h') || params1.has('r') || params1.has('a')) {
            throw new Error(`Palette tweaks should be omitted for default values, got: h=${params1.get('h')}, r=${params1.get('r')}, a=${params1.get('a')}`);
        }

        // Now navigate with custom tweaks that differ from defaults
        await navigateToURL(page, buildTestURL({
            s: 'encode-test', p: 'violet-depth',
            d: '0.50', l: '0.50', f: '0.50', z: '0.50', c: '0.50',
            h: '100', r: '60', a: '0.90',
        }));
        await waitForStillRendered(page);

        // Re-spy clipboard
        await page.evaluate(() => {
            window.__clipboardText = null;
            navigator.clipboard.writeText = (text) => {
                window.__clipboardText = text;
                return Promise.resolve();
            };
        });

        await page.click('#shareBtn');
        await sleep(200);
        await page.click('#shareCopyLink');
        await sleep(300);

        const url2 = await page.evaluate(() => window.__clipboardText);
        if (!url2) throw new Error('Clipboard not written (second check)');
        const params2 = new URL(url2).searchParams;

        // Palette tweaks SHOULD be present (they differ from violet-depth defaults)
        if (!params2.has('h') || !params2.has('r') || !params2.has('a')) {
            throw new Error('Palette tweaks should be included when they differ from defaults');
        }
        if (params2.get('h') !== '100') throw new Error(`Expected h=100, got h=${params2.get('h')}`);
        if (params2.get('r') !== '60') throw new Error(`Expected r=60, got r=${params2.get('r')}`);
        if (params2.get('a') !== '0.90') throw new Error(`Expected a=0.90, got a=${params2.get('a')}`);
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
        console.log(`\nURL State: ${r.passed} passed, ${r.failed} failed\n`);
        process.exit(r.failed > 0 ? 1 : 0);
    } finally {
        await cleanup();
    }
}
