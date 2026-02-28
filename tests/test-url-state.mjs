/**
 * URL state and social share tests: decode from URL, share popover, encode round-trip.
 */
import { fileURLToPath } from 'url';
import path from 'path';
import { BASE_URL, navigateToURL, ensurePanelOpen, ensureConfigExpanded, scrollToElement } from './helpers/browser.mjs';
import { readControlsFromPage, readSeed, readProfileName, setSlider } from './helpers/controls.mjs';
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
    // Cluster 1: URL Decode (v2 format)
    // ════════════════════════════════════════

    await test('Full v2 URL params populate all controls correctly', async () => {
        const url = buildTestURL({
            n: 'TestName', s: 'test-seed-42',
            d: '0.33', l: '0.88', f: '0.15', c: '0.61',
            h: '0.500', sp: '0.400', ch: '0.600',
            sc: '0.70', dv: '0.30', ft: '0.80', fl: '0.65',
        });
        await navigateToURL(page, url);
        await waitForStillRendered(page);

        const seed = await readSeed(page);
        if (seed !== 'test-seed-42') throw new Error(`Seed: expected "test-seed-42", got "${seed}"`);

        const name = await readProfileName(page);
        if (name !== 'TestName') throw new Error(`Name: expected "TestName", got "${name}"`);

        const c = await readControlsFromPage(page);
        assertClose(c.density, 0.33, 0.02, 'density');
        assertClose(c.luminosity, 0.88, 0.02, 'luminosity');
        assertClose(c.fracture, 0.15, 0.02, 'fracture');
        assertClose(c.coherence, 0.61, 0.02, 'coherence');
        assertClose(c.hue, 0.500, 0.01, 'hue');
        assertClose(c.spectrum, 0.400, 0.01, 'spectrum');
        assertClose(c.chroma, 0.600, 0.01, 'chroma');
        assertClose(c.scale, 0.70, 0.02, 'scale');
        assertClose(c.division, 0.30, 0.02, 'division');
        assertClose(c.faceting, 0.80, 0.02, 'faceting');
        assertClose(c.flow, 0.65, 0.02, 'flow');
    });

    await test('Seed-only URL uses default values for missing params', async () => {
        await navigateToURL(page, `${BASE_URL}/?s=minimal-seed`);
        await waitForStillRendered(page);

        const seed = await readSeed(page);
        if (seed !== 'minimal-seed') throw new Error(`Seed: expected "minimal-seed", got "${seed}"`);

        const c = await readControlsFromPage(page);
        assertClose(c.density, 0.50, 0.02, 'density');
        assertClose(c.luminosity, 0.50, 0.02, 'luminosity');
        assertClose(c.fracture, 0.50, 0.02, 'fracture');
        assertClose(c.coherence, 0.50, 0.02, 'coherence');
        assertClose(c.hue, 0.783, 0.01, 'hue');
        assertClose(c.spectrum, 0.239, 0.01, 'spectrum');
        assertClose(c.chroma, 0.417, 0.01, 'chroma');
        assertClose(c.scale, 0.50, 0.02, 'scale');
        assertClose(c.division, 0.50, 0.02, 'division');
        assertClose(c.faceting, 0.50, 0.02, 'faceting');
        assertClose(c.flow, 0.50, 0.02, 'flow');
    });

    await test('Legacy v1 URL (with palette param) migrates to v2 controls', async () => {
        const url = buildTestURL({
            s: 'legacy-test', p: 'warm-spectrum',
            d: '0.33', l: '0.88', f: '0.15', z: '0.72', c: '0.61',
        });
        await navigateToURL(page, url);
        await waitForStillRendered(page);

        const c = await readControlsFromPage(page);
        // warm-spectrum preset: hue≈0.061, spectrum≈0.220, chroma≈0.957
        assertClose(c.hue, 0.061, 0.02, 'hue (from warm-spectrum preset)');
        assertClose(c.spectrum, 0.220, 0.05, 'spectrum (from warm-spectrum preset)');
        assertClose(c.chroma, 0.957, 0.05, 'chroma (from warm-spectrum preset)');
        assertClose(c.density, 0.33, 0.02, 'density');
        assertClose(c.luminosity, 0.88, 0.02, 'luminosity');
    });

    await test('Name auto-generated when n param absent', async () => {
        const url = buildTestURL({
            s: 'auto-name-seed',
            d: '0.50', l: '0.50', f: '0.50', c: '0.50',
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
            d: '-0.5', l: '2.0', f: '0.50', c: '999',
            h: '-0.5', sp: '5.0', ch: '-1.0',
            sc: '2.0', dv: '-0.5', ft: '3.0', fl: '-1.0',
        });
        await navigateToURL(page, url);
        await waitForStillRendered(page);

        const c = await readControlsFromPage(page);
        assertClose(c.density, 0, 0.02, 'density (clamped from -0.5)');
        assertClose(c.luminosity, 1, 0.02, 'luminosity (clamped from 2.0)');
        assertClose(c.fracture, 0.50, 0.02, 'fracture');
        assertClose(c.coherence, 1, 0.02, 'coherence (clamped from 999)');
        assertClose(c.hue, 0, 0.02, 'hue (clamped from -0.5)');
        assertClose(c.spectrum, 1, 0.02, 'spectrum (clamped from 5.0)');
        assertClose(c.chroma, 0, 0.02, 'chroma (clamped from -1.0)');
        assertClose(c.scale, 1, 0.02, 'scale (clamped from 2.0)');
        assertClose(c.division, 0, 0.02, 'division (clamped from -0.5)');
        assertClose(c.faceting, 1, 0.02, 'faceting (clamped from 3.0)');
        assertClose(c.flow, 0, 0.02, 'flow (clamped from -1.0)');
    });

    await test('Non-numeric param values fall back to defaults', async () => {
        await navigateToURL(page, buildTestURL({ s: 'nan-test', d: 'abc', l: 'xyz', f: '!@#' }));
        await waitForStillRendered(page);

        const c = await readControlsFromPage(page);
        assertClose(c.density, 0.50, 0.02, 'density (NaN fallback)');
        assertClose(c.luminosity, 0.50, 0.02, 'luminosity (NaN fallback)');
        assertClose(c.fracture, 0.50, 0.02, 'fracture (NaN fallback)');
    });

    await test('No URL params loads default randomized state', async () => {
        await navigateToURL(page, BASE_URL);
        await waitForStillRendered(page);

        const seed = await readSeed(page);
        if (!seed || seed.trim().length === 0) throw new Error('Seed is empty with no URL params');
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

        await assertHidden(page, '#sharePopover');

        await page.click('#shareBtn');
        await sleep(200);
        await assertVisible(page, '#sharePopover');

        await page.click('#shareBtn');
        await sleep(200);
        await assertHidden(page, '#sharePopover');

        await page.click('#shareBtn');
        await sleep(200);
        await assertVisible(page, '#sharePopover');
        await page.click('body', { position: { x: 10, y: 10 } });
        await sleep(200);
        await assertHidden(page, '#sharePopover');

        await page.click('#shareBtn');
        await sleep(200);
        await assertVisible(page, '#sharePopover');
        await page.keyboard.press('Escape');
        await sleep(200);
        await assertHidden(page, '#sharePopover');
    });

    await test('Copy Link writes correct v2 URL to clipboard', async () => {
        const url = buildTestURL({
            s: 'clipboard-seed',
            d: '0.40', l: '0.60', f: '0.20', c: '0.55',
            h: '0.500', sp: '0.300', ch: '0.700',
            sc: '0.60', dv: '0.40', ft: '0.80', fl: '0.35',
        });
        await navigateToURL(page, url);
        await waitForStillRendered(page);

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
        assertClose(parseFloat(params.get('d')), 0.40, 0.02, 'density in URL');
        assertClose(parseFloat(params.get('l')), 0.60, 0.02, 'luminosity in URL');
        assertClose(parseFloat(params.get('f')), 0.20, 0.02, 'fracture in URL');
        assertClose(parseFloat(params.get('c')), 0.55, 0.02, 'coherence in URL');
        assertClose(parseFloat(params.get('h')), 0.500, 0.01, 'hue in URL');
        assertClose(parseFloat(params.get('sp')), 0.300, 0.02, 'spectrum in URL');
        assertClose(parseFloat(params.get('ch')), 0.700, 0.02, 'chroma in URL');
        assertClose(parseFloat(params.get('sc')), 0.60, 0.02, 'scale in URL');
        assertClose(parseFloat(params.get('dv')), 0.40, 0.02, 'division in URL');
        assertClose(parseFloat(params.get('ft')), 0.80, 0.02, 'faceting in URL');
        assertClose(parseFloat(params.get('fl')), 0.35, 0.02, 'flow in URL');

        // v2 URL should NOT have legacy params
        if (params.has('p')) throw new Error('v2 URL should not have legacy "p" param');
        if (params.has('z')) throw new Error('v2 URL should not have legacy "z" param');

        await assertHidden(page, '#sharePopover');
    });

    await test('Twitter share opens correct intent URL', async () => {
        await navigateToURL(page, buildTestURL({ s: 'twitter-test', d: '0.50', l: '0.50', f: '0.50', c: '0.50' }));
        await waitForStillRendered(page);

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
        await navigateToURL(page, buildTestURL({ s: 'fb-test', d: '0.50', l: '0.50', f: '0.50', c: '0.50' }));
        await waitForStillRendered(page);

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
        if (!openedURL.includes('s%3D') && !openedURL.includes('s=')) {
            throw new Error('Facebook sharer URL does not contain the share link with seed param');
        }

        await assertHidden(page, '#sharePopover');
    });

    await test('Bluesky share opens correct intent URL', async () => {
        await navigateToURL(page, buildTestURL({ s: 'bsky-test', d: '0.50', l: '0.50', f: '0.50', c: '0.50' }));
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
        await navigateToURL(page, buildTestURL({ s: 'reddit-test', d: '0.50', l: '0.50', f: '0.50', c: '0.50' }));
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
        await navigateToURL(page, buildTestURL({ s: 'linkedin-test', d: '0.50', l: '0.50', f: '0.50', c: '0.50' }));
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
        await navigateToURL(page, buildTestURL({ s: 'email-test', d: '0.50', l: '0.50', f: '0.50', c: '0.50' }));
        await waitForStillRendered(page);

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
