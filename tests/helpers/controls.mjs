/**
 * UI control manipulation helpers for Playwright tests.
 */

/**
 * Set a slider value and dispatch 'input' event to trigger onControlChange.
 */
export async function setSlider(page, sliderId, value) {
    await page.evaluate(({ id, val }) => {
        const el = document.getElementById(id);
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }, { id: sliderId, val: value });
}

/**
 * Set the seed/intent field and dispatch 'change' event.
 */
export async function setSeed(page, text) {
    await page.evaluate((val) => {
        const el = document.getElementById('profileName');
        el.value = val;
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, text);
}

/**
 * Set the profile name field and dispatch 'input' event.
 */
export async function setProfileName(page, name) {
    await page.evaluate((val) => {
        const el = document.getElementById('profileNameField');
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }, name);
}

/**
 * Click a palette chip by its data-value attribute.
 * Panel must be open for this to work (use ensurePanelOpen first).
 */
export async function selectPalette(page, paletteKey) {
    await page.click(`.pal-chip[data-value="${paletteKey}"]`);
}

/**
 * Set custom palette slider values and dispatch input events.
 */
export async function setCustomPalette(page, { hue, range, sat }) {
    await page.evaluate(({ h, r, s }) => {
        const hueEl = document.getElementById('customHue');
        const rangeEl = document.getElementById('customHueRange');
        const satEl = document.getElementById('customSat');
        if (h !== undefined) { hueEl.value = h; hueEl.dispatchEvent(new Event('input', { bubbles: true })); }
        if (r !== undefined) { rangeEl.value = r; rangeEl.dispatchEvent(new Event('input', { bubbles: true })); }
        if (s !== undefined) { satEl.value = s; satEl.dispatchEvent(new Event('input', { bubbles: true })); }
    }, { h: hue, r: range, s: sat });
}

/**
 * Bulk-set all controls in a single evaluate call.
 * @param {object} config - { seed, topology, palette, density, luminosity, fracture, depth, coherence }
 */
export async function setAllControls(page, config) {
    await page.evaluate((c) => {
        if (c.seed !== undefined) {
            document.getElementById('profileName').value = c.seed;
        }
        if (c.topology !== undefined) {
            document.getElementById('topology').value = c.topology;
            document.querySelectorAll('.topo-tile').forEach(t =>
                t.classList.toggle('active', t.dataset.value === c.topology)
            );
        }
        if (c.palette !== undefined) {
            document.getElementById('palette').value = c.palette;
            document.querySelectorAll('.pal-chip').forEach(t =>
                t.classList.toggle('active', t.dataset.value === c.palette)
            );
        }
        for (const key of ['density', 'luminosity', 'fracture', 'depth', 'coherence']) {
            if (c[key] !== undefined) {
                document.getElementById(key).value = c[key];
            }
        }
    }, config);
}

/**
 * Trigger a render by dispatching an input event on the coherence slider.
 * This matches the pattern from the original test-render.mjs.
 */
export async function triggerRender(page) {
    await page.evaluate(() => {
        const el = document.getElementById('coherence');
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

/**
 * Read all current control values from the DOM.
 */
export async function readControlsFromPage(page) {
    return page.evaluate(() => ({
        topology: document.getElementById('topology').value,
        palette: document.getElementById('palette').value,
        density: parseFloat(document.getElementById('density').value),
        luminosity: parseFloat(document.getElementById('luminosity').value),
        fracture: parseFloat(document.getElementById('fracture').value),
        depth: parseFloat(document.getElementById('depth').value),
        coherence: parseFloat(document.getElementById('coherence').value),
    }));
}

/**
 * Read custom palette tweak values from the DOM.
 */
export async function readPaletteTweaksFromPage(page) {
    return page.evaluate(() => ({
        baseHue: parseFloat(document.getElementById('customHue').value),
        hueRange: parseFloat(document.getElementById('customHueRange').value),
        saturation: parseFloat(document.getElementById('customSat').value),
    }));
}

/**
 * Read the seed value from the DOM.
 */
export async function readSeed(page) {
    return page.$eval('#profileName', el => el.value);
}

/**
 * Read the profile name value from the DOM.
 */
export async function readProfileName(page) {
    return page.$eval('#profileNameField', el => el.value);
}
