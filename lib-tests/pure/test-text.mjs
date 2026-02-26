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
    topology: 'flow-field', palette: 'violet-depth',
    density: 0.5, luminosity: 0.5, fracture: 0.5, depth: 0.5, coherence: 0.5,
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

test('generateTitle works for all palette keys', () => {
    const palettes = ['violet-depth', 'warm-spectrum', 'teal-volumetric', 'prismatic', 'crystal-lattice', 'sapphire', 'amethyst'];
    for (const p of palettes) {
        const title = generateTitle({ ...MID, palette: p }, mkRng());
        assert(title.length > 0, `empty title for palette ${p}`);
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
