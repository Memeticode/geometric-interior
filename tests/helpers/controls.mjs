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
 * Bulk-set all controls in a single evaluate call.
 * @param {object} config - { seed, topology, density, luminosity, fracture, coherence, hue, spectrum, chroma, scale, division, faceting }
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
        for (const key of ['density', 'luminosity', 'fracture', 'coherence', 'hue', 'spectrum', 'chroma', 'scale', 'division', 'faceting', 'flow']) {
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
        density: parseFloat(document.getElementById('density').value),
        luminosity: parseFloat(document.getElementById('luminosity').value),
        fracture: parseFloat(document.getElementById('fracture').value),
        coherence: parseFloat(document.getElementById('coherence').value),
        hue: parseFloat(document.getElementById('hue').value),
        spectrum: parseFloat(document.getElementById('spectrum').value),
        chroma: parseFloat(document.getElementById('chroma').value),
        scale: parseFloat(document.getElementById('scale').value),
        division: parseFloat(document.getElementById('division').value),
        faceting: parseFloat(document.getElementById('faceting').value),
        flow: parseFloat(document.getElementById('flow').value),
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
