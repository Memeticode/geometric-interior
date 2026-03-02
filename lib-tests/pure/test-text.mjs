/**
 * Tests for generateTitle, generateAltText, generateAnimAltText.
 */
import {
    generateTitle, generateAltText, generateAnimAltText,
    xmur3, mulberry32,
} from '../../dist/lib/geometric-interior.js';

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

test('generateAltText returns non-empty string', () => {
    const alt = generateAltText(MID, 150, 'Test Title');
    assert(typeof alt === 'string' && alt.length > 0, `empty alt text`);
});

test('generateAltText mentions node count', () => {
    const alt = generateAltText(MID, 247, 'Test Title');
    assert(alt.includes('247'), `alt text should mention node count 247: "${alt}"`);
});

/* ── New alt-text quadrant tests ── */

test('generateAltText is deterministic', () => {
    const a1 = generateAltText(MID, 150, 'T');
    const a2 = generateAltText(MID, 150, 'T');
    assert(a1 === a2, `non-deterministic: "${a1}" vs "${a2}"`);
});

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

test('generateAltText: high spectrum mentions prismatic quality', () => {
    const prism = generateAltText({ ...MID, spectrum: 0.90, chroma: 0.70 }, 150, 'T');
    assert(prism.toLowerCase().includes('prismatic'),
        `high spectrum should mention prismatic: "${prism}"`);
});

test('generateAltText: sparse vs dense population differ', () => {
    const sparse = generateAltText({ ...MID, density: 0.02 }, 30, 'T');
    const dense = generateAltText({ ...MID, density: 0.50 }, 500, 'T');
    assert(sparse !== dense, 'density extremes should differ');
});

test('generateAltText: high division mentions three/trifold', () => {
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

test('generateAltText: Spanish locale returns non-empty', () => {
    const alt = generateAltText(MID, 150, 'T', 'es');
    assert(typeof alt === 'string' && alt.length > 0, 'empty Spanish alt');
});

test('generateAltText: Spanish differs from English', () => {
    const en = generateAltText(MID, 150, 'T', 'en');
    const es = generateAltText(MID, 150, 'T', 'es');
    assert(en !== es, 'Spanish and English should differ');
});

test('generateAltText: exact node count appears', () => {
    const alt = generateAltText(MID, 347, 'T');
    assert(alt.includes('347'), `should contain 347: "${alt}"`);
});

test('generateAltText: every parameter affects output', () => {
    // hue uses 0.15 vs 0.70 since 0.01 and 0.99 both map to the ruby hue band
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

test('generateAltText: Night Bloom config uses new opener', () => {
    const nightBloom = {
        topology: 'flow-field', density: 0.08, luminosity: 0.12, bloom: 0.80,
        fracture: 0.45, coherence: 0.82, hue: 0.94, spectrum: 0.25,
        chroma: 0.55, scale: 0.5, division: 0.5, faceting: 0.5, flow: 0.28,
    };
    const alt = generateAltText(nightBloom, 87, 'Night Bloom');
    assert(!alt.includes('A dark field carries'), 'should not use old static opener');
    assert(alt.length > 100, 'should be substantial description');
});

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
