/**
 * Tests for generateTitle, generateAltText, generateAnimAltText.
 */
import {
    generateTitle, generateAltText, generateAnimAltText,
    xmur3, mulberry32,
} from '../../dist/geometric-interior.js';

let passed = 0, failed = 0;

function test(name, fn) {
    try { fn(); passed++; console.log(`  PASS: ${name}`); }
    catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${e.message}`); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function mkRng(seed = 'test') {
    return mulberry32(xmur3(seed)());
}

const MID = {
    topology: 'flow-field',
    density: 0.5, luminosity: 0.5, bloom: 0.5, fracture: 0.5, coherence: 0.5,
    hue: 0.783, spectrum: 0.239, chroma: 0.417,
    scale: 0.5, division: 0.5, faceting: 0.5, flow: 0.5,
};

console.log('\n=== Text Tests ===\n');

/* ── Title tests (unchanged) ── */

test('generateTitle returns non-empty string', () => {
    const title = generateTitle(MID, mkRng());
    assert(typeof title === 'string' && title.length > 0, `empty title: "${title}"`);
});

test('generateTitle is deterministic', () => {
    const t1 = generateTitle(MID, mkRng('abc'));
    const t2 = generateTitle(MID, mkRng('abc'));
    assert(t1 === t2, `non-deterministic: "${t1}" vs "${t2}"`);
});

test('generateTitle produces different titles for different seeds', () => {
    const titles = new Set();
    for (let i = 0; i < 20; i++) {
        titles.add(generateTitle(MID, mkRng(`seed-${i}`)));
    }
    assert(titles.size > 5, `too few unique titles: ${titles.size} out of 20`);
});

test('generateTitle works for various hue values', () => {
    const hues = [0.0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0];
    for (const h of hues) {
        const title = generateTitle({ ...MID, hue: h }, mkRng());
        assert(title.length > 0, `empty title for hue ${h}`);
    }
});

/* ── Alt-text format tests ── */

test('generateAltText returns non-empty string', () => {
    const alt = generateAltText(MID, 150, 'Test Title');
    assert(typeof alt === 'string' && alt.length > 0, `empty alt text`);
});

test('generateAltText has summary + expanded format', () => {
    const alt = generateAltText(MID, 150, 'T');
    assert(alt.includes('\n\nExpanded Description: '),
        `missing format separator: "${alt.slice(0, 200)}..."`);
});

test('generateAltText summary is ≤140 chars', () => {
    const alt = generateAltText(MID, 150, 'T');
    const summary = alt.split('\n\n')[0];
    assert(summary.length <= 140,
        `summary too long (${summary.length} chars): "${summary}"`);
});

test('generateAltText total ≤2000 chars', () => {
    // Test with extreme parameters that could produce long text
    const extreme = { ...MID, density: 0.99, bloom: 0.99, chroma: 0.99, spectrum: 0.99 };
    const alt = generateAltText(extreme, 999, 'T', 'en', [17, 17, 17]);
    assert(alt.length <= 2000,
        `total too long (${alt.length} chars)`);
});

test('generateAltText mentions node count', () => {
    const alt = generateAltText(MID, 247, 'Test Title');
    assert(alt.includes('247'), `alt text should mention node count 247`);
});

/* ── Determinism ── */

test('generateAltText is deterministic', () => {
    const a1 = generateAltText(MID, 150, 'T');
    const a2 = generateAltText(MID, 150, 'T');
    assert(a1 === a2, `non-deterministic`);
});

/* ── Parameter sensitivity ── */

test('generateAltText: luminosity extremes produce different text', () => {
    const dark = generateAltText({ ...MID, luminosity: 0.05 }, 150, 'T');
    const bright = generateAltText({ ...MID, luminosity: 0.90 }, 150, 'T');
    assert(dark !== bright, 'dark and bright should differ');
});

test('generateAltText: dark×tight vs dark×atmospheric differ', () => {
    const jewel = generateAltText({ ...MID, luminosity: 0.08, bloom: 0.10 }, 50, 'T');
    const bloom = generateAltText({ ...MID, luminosity: 0.08, bloom: 0.80 }, 50, 'T');
    assert(jewel !== bloom, 'dark-jewel and dark-bloom should differ');
});

test('generateAltText: achromatic vs vivid chroma differ', () => {
    const gray = generateAltText({ ...MID, chroma: 0.05 }, 150, 'T');
    const vivid = generateAltText({ ...MID, chroma: 0.85 }, 150, 'T');
    assert(gray !== vivid, 'chroma extremes should differ');
});

test('generateAltText: sparse vs dense population differ', () => {
    const sparse = generateAltText({ ...MID, density: 0.02 }, 30, 'T');
    const dense = generateAltText({ ...MID, density: 0.50 }, 500, 'T');
    assert(sparse !== dense, 'density extremes should differ');
});

test('generateAltText: high division mentions three', () => {
    const tri = generateAltText({ ...MID, division: 0.90 }, 150, 'T');
    assert(tri.toLowerCase().includes('three'),
        `high division should mention three: "${tri}"`);
});

test('generateAltText: orbital vs radial flow differ at high coherence', () => {
    const radial = generateAltText({ ...MID, flow: 0.0, coherence: 0.80 }, 150, 'T');
    const orbital = generateAltText({ ...MID, flow: 1.0, coherence: 0.80 }, 150, 'T');
    assert(radial !== orbital, 'flow extremes should differ');
});

test('generateAltText: smooth vs angular faceting differ', () => {
    const smooth = generateAltText({ ...MID, faceting: 0.0, fracture: 0.15 }, 150, 'T');
    const angular = generateAltText({ ...MID, faceting: 1.0, fracture: 0.90 }, 150, 'T');
    assert(smooth !== angular, 'faceting extremes should differ');
});

test('generateAltText: every parameter affects output', () => {
    const extremes = {
        hue: [0.15, 0.70], spectrum: [0.01, 0.99], chroma: [0.01, 0.99],
        density: [0.01, 0.99], fracture: [0.01, 0.99], coherence: [0.01, 0.99],
        luminosity: [0.01, 0.99], bloom: [0.01, 0.99], scale: [0.01, 0.99],
        division: [0.01, 0.99], faceting: [0.01, 0.99], flow: [0.01, 0.99],
    };
    for (const [p, [lo, hi]] of Object.entries(extremes)) {
        const low = generateAltText({ ...MID, [p]: lo }, 150, 'T');
        const high = generateAltText({ ...MID, [p]: hi }, 150, 'T');
        assert(low !== high, `${p} extremes (${lo} vs ${hi}) should produce different text`);
    }
});

/* ── Locale tests ── */

test('generateAltText: Spanish locale returns non-empty', () => {
    const alt = generateAltText(MID, 150, 'T', 'es');
    assert(typeof alt === 'string' && alt.length > 0, 'empty Spanish alt');
});

test('generateAltText: Spanish differs from English', () => {
    const en = generateAltText(MID, 150, 'T', 'en');
    const es = generateAltText(MID, 150, 'T', 'es');
    assert(en !== es, 'Spanish and English should differ');
});

test('generateAltText: Spanish has correct format marker', () => {
    const es = generateAltText(MID, 150, 'T', 'es');
    assert(es.includes('Descripción Ampliada: '),
        `Spanish should use "Descripción Ampliada: " marker`);
});

test('generateAltText: Spanish total ≤2000 chars', () => {
    const extreme = { ...MID, density: 0.99, bloom: 0.99, chroma: 0.99, spectrum: 0.99 };
    const alt = generateAltText(extreme, 999, 'T', 'es', [17, 17, 17]);
    assert(alt.length <= 2000,
        `Spanish total too long (${alt.length} chars)`);
});

/* ── Seed tests ── */

test('generateAltText: with seed differs from without seed', () => {
    const withSeed = generateAltText(MID, 150, 'T', 'en', [4, 12, 8]);
    const noSeed = generateAltText(MID, 150, 'T', 'en');
    assert(withSeed !== noSeed, 'seed should change output');
});

test('generateAltText: different seeds produce different text', () => {
    const a = generateAltText(MID, 150, 'T', 'en', [0, 0, 0]);
    const b = generateAltText(MID, 150, 'T', 'en', [17, 17, 17]);
    assert(a !== b, 'different seeds should produce different text');
});

/* ── Quality tests ── */

test('generateAltText: no template artifacts in output', () => {
    const alt = generateAltText(MID, 150, 'T', 'en', [5, 5, 5]);
    assert(!alt.includes('{N}'), `template artifact {N} found`);
    assert(!alt.includes('{color}'), `template artifact {color} found`);
    assert(!alt.includes('{Color}'), `template artifact {Color} found`);
    assert(!alt.includes('{bloom_adj}'), `template artifact {bloom_adj} found`);
});

test('generateAltText: expanded section has multiple sentences', () => {
    const alt = generateAltText(MID, 150, 'T');
    const expanded = alt.split('Expanded Description: ')[1] || '';
    const periods = (expanded.match(/\./g) || []).length;
    assert(periods >= 3, `expected ≥3 sentences, got ${periods} periods in expanded`);
});

test('generateAltText: node count appears as exact number', () => {
    const alt = generateAltText(MID, 347, 'T');
    assert(alt.includes('347'), `should contain exact count 347`);
});

/* ── Uniqueness tests ── */

test('generateAltText: 200 random configs produce ≥195 unique texts', () => {
    const rng = mulberry32(xmur3('uniqueness-test')());
    const texts = new Set();
    for (let i = 0; i < 200; i++) {
        const controls = {
            topology: 'flow-field',
            hue: rng(), spectrum: rng(), chroma: rng(),
            density: rng(), fracture: rng(), coherence: rng(),
            luminosity: rng(), bloom: rng(), scale: rng(),
            division: rng(), faceting: rng(), flow: rng(),
        };
        const seed = [Math.floor(rng() * 18), Math.floor(rng() * 18), Math.floor(rng() * 18)];
        texts.add(generateAltText(controls, Math.floor(rng() * 500) + 50, 'T', 'en', seed));
    }
    assert(texts.size >= 195, `only ${texts.size}/200 unique (expected ≥195)`);
});

test('generateAltText: same params, different seeds → different text', () => {
    const texts = new Set();
    for (let a = 0; a < 18; a += 6) {
        for (let s = 0; s < 18; s += 6) {
            for (let d = 0; d < 18; d += 6) {
                texts.add(generateAltText(MID, 150, 'T', 'en', [a, s, d]));
            }
        }
    }
    // 3×3×3 = 27 seed combos → should be mostly unique
    assert(texts.size >= 20, `only ${texts.size}/27 unique across seed variations`);
});

/* ── Animation alt-text tests ── */

test('generateAnimAltText returns non-empty string', () => {
    const landmarks = [
        { name: 'A', controls: MID },
        { name: 'B', controls: { ...MID, density: 0.8 } },
    ];
    const keyframeTexts = [
        { name: 'A', title: 'Title A' },
        { name: 'B', title: 'Title B' },
    ];
    const alt = generateAnimAltText(landmarks, 5.0, keyframeTexts);
    assert(typeof alt === 'string' && alt.length > 0, `empty anim alt text`);
});

test('generateAnimAltText mentions duration', () => {
    const landmarks = [
        { name: 'A', controls: MID },
        { name: 'B', controls: { ...MID, density: 0.8 } },
    ];
    const keyframeTexts = [
        { name: 'A', title: 'Title A' },
        { name: 'B', title: 'Title B' },
    ];
    const alt = generateAnimAltText(landmarks, 5.0, keyframeTexts);
    assert(alt.includes('5'), `anim alt text should mention duration: "${alt}"`);
});

export { passed, failed };
