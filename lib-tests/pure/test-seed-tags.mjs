/**
 * Tests for the compositional seed tag system.
 */
import {
    parseSeed, createTagStreams, seedTagToLabel, serializeSeedTag,
    deserializeSeedTag, isSeedTag, seedToString, slotBias,
    ARRANGEMENT_WORDS, STRUCTURE_WORDS, DETAIL_WORDS, TAG_LIST_LENGTH,
} from '../../dist/lib/geometric-interior.js';

let passed = 0, failed = 0;

function test(name, fn) {
    try { fn(); passed++; console.log(`  PASS: ${name}`); }
    catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${e.message}`); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) {
    if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function assertDeepEqual(a, b, msg) {
    const sa = JSON.stringify(a), sb = JSON.stringify(b);
    if (sa !== sb) throw new Error(msg || `expected ${sb}, got ${sa}`);
}

console.log('\n=== Seed Tag Tests ===\n');

// ── Constants ──

test('TAG_LIST_LENGTH is 18', () => {
    assertEqual(TAG_LIST_LENGTH, 18);
});

test('Word lists each have TAG_LIST_LENGTH entries', () => {
    assertEqual(ARRANGEMENT_WORDS.length, TAG_LIST_LENGTH);
    assertEqual(STRUCTURE_WORDS.length, TAG_LIST_LENGTH);
    assertEqual(DETAIL_WORDS.length, TAG_LIST_LENGTH);
});

// ── parseSeed ──

test('parseSeed: array input is passed through', () => {
    const tag = parseSeed([3, 12, 8]);
    assertDeepEqual(tag, [3, 12, 8]);
});

test('parseSeed: array input is clamped to valid range', () => {
    const tag = parseSeed([-1, 20, 99]);
    assertEqual(tag[0], 0, 'negative clamped to 0');
    assertEqual(tag[1], 17, 'over max clamped to 17');
    assertEqual(tag[2], 17, 'way over max clamped to 17');
});

test('parseSeed: array input rounds floats', () => {
    const tag = parseSeed([3.7, 5.2, 10.5]);
    assertEqual(tag[0], 4, '3.7 rounds to 4');
    assertEqual(tag[1], 5, '5.2 rounds to 5');
    assertEqual(tag[2], 11, '10.5 rounds to 11');
});

test('parseSeed: string seed is deterministic', () => {
    const a = parseSeed('hello world');
    const b = parseSeed('hello world');
    assertDeepEqual(a, b);
});

test('parseSeed: different strings produce different tags', () => {
    const a = parseSeed('alpha');
    const b = parseSeed('beta');
    // At least one slot should differ (probabilistically guaranteed for distinct strings)
    assert(a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2],
        `expected different tags for different strings: ${a} vs ${b}`);
});

test('parseSeed: string tag values are in valid range', () => {
    const seeds = ['test', 'another', '', 'a very long seed string with lots of characters'];
    for (const s of seeds) {
        const tag = parseSeed(s);
        for (let i = 0; i < 3; i++) {
            assert(tag[i] >= 0 && tag[i] < TAG_LIST_LENGTH,
                `slot ${i} out of range for seed "${s}": ${tag[i]}`);
            assert(Number.isInteger(tag[i]), `slot ${i} not integer for seed "${s}": ${tag[i]}`);
        }
    }
});

// ── slotBias ──

test('slotBias: slot 0 → bias 0', () => {
    assertEqual(slotBias(0), 0);
});

test('slotBias: slot 17 → bias 1', () => {
    assertEqual(slotBias(17), 1);
});

test('slotBias: slot 9 → bias ~0.529', () => {
    const b = slotBias(9);
    assert(Math.abs(b - 9 / 17) < 0.001, `expected ~0.529, got ${b}`);
});

// ── createTagStreams ──

test('createTagStreams: returns all required fields', () => {
    const streams = createTagStreams([5, 10, 3]);
    assert(typeof streams.arrangementRng === 'function', 'arrangementRng not function');
    assert(typeof streams.structureRng === 'function', 'structureRng not function');
    assert(typeof streams.detailRng === 'function', 'detailRng not function');
    assert(typeof streams.arrangementBias === 'number', 'arrangementBias not number');
    assert(typeof streams.structureBias === 'number', 'structureBias not number');
    assert(typeof streams.detailBias === 'number', 'detailBias not number');
});

test('createTagStreams: RNG produces values in [0, 1)', () => {
    const streams = createTagStreams([5, 10, 3]);
    for (let i = 0; i < 100; i++) {
        const a = streams.arrangementRng();
        const s = streams.structureRng();
        const d = streams.detailRng();
        assert(a >= 0 && a < 1, `arrangementRng out of range: ${a}`);
        assert(s >= 0 && s < 1, `structureRng out of range: ${s}`);
        assert(d >= 0 && d < 1, `detailRng out of range: ${d}`);
    }
});

test('createTagStreams: biases match slotBias', () => {
    const streams = createTagStreams([5, 10, 3]);
    assertEqual(streams.arrangementBias, slotBias(5));
    assertEqual(streams.structureBias, slotBias(10));
    assertEqual(streams.detailBias, slotBias(3));
});

test('createTagStreams: streams are deterministic', () => {
    const a = createTagStreams([5, 10, 3]);
    const b = createTagStreams([5, 10, 3]);
    // Read 10 values from each stream
    for (let i = 0; i < 10; i++) {
        assertEqual(a.arrangementRng(), b.arrangementRng(), `arrangement diverged at step ${i}`);
        assertEqual(a.structureRng(), b.structureRng(), `structure diverged at step ${i}`);
        assertEqual(a.detailRng(), b.detailRng(), `detail diverged at step ${i}`);
    }
});

test('createTagStreams: changing slot 0 only affects arrangement stream', () => {
    const a = createTagStreams([0, 10, 3]);
    const b = createTagStreams([17, 10, 3]);
    // Structure and detail streams should be identical
    for (let i = 0; i < 10; i++) {
        assertEqual(a.structureRng(), b.structureRng(), `structure diverged at step ${i}`);
        assertEqual(a.detailRng(), b.detailRng(), `detail diverged at step ${i}`);
    }
    // Arrangement streams should differ (re-create since we consumed values above)
    const c = createTagStreams([0, 10, 3]);
    const d = createTagStreams([17, 10, 3]);
    let anyDifferent = false;
    for (let i = 0; i < 10; i++) {
        if (c.arrangementRng() !== d.arrangementRng()) anyDifferent = true;
    }
    assert(anyDifferent, 'arrangement streams should differ when slot 0 changes');
});

test('createTagStreams: changing slot 1 only affects structure stream', () => {
    const a = createTagStreams([5, 0, 3]);
    const b = createTagStreams([5, 17, 3]);
    for (let i = 0; i < 10; i++) {
        assertEqual(a.arrangementRng(), b.arrangementRng(), `arrangement diverged at step ${i}`);
        assertEqual(a.detailRng(), b.detailRng(), `detail diverged at step ${i}`);
    }
    const c = createTagStreams([5, 0, 3]);
    const d = createTagStreams([5, 17, 3]);
    let anyDifferent = false;
    for (let i = 0; i < 10; i++) {
        if (c.structureRng() !== d.structureRng()) anyDifferent = true;
    }
    assert(anyDifferent, 'structure streams should differ when slot 1 changes');
});

test('createTagStreams: changing slot 2 only affects detail stream', () => {
    const a = createTagStreams([5, 10, 0]);
    const b = createTagStreams([5, 10, 17]);
    for (let i = 0; i < 10; i++) {
        assertEqual(a.arrangementRng(), b.arrangementRng(), `arrangement diverged at step ${i}`);
        assertEqual(a.structureRng(), b.structureRng(), `structure diverged at step ${i}`);
    }
    const c = createTagStreams([5, 10, 0]);
    const d = createTagStreams([5, 10, 17]);
    let anyDifferent = false;
    for (let i = 0; i < 10; i++) {
        if (c.detailRng() !== d.detailRng()) anyDifferent = true;
    }
    assert(anyDifferent, 'detail streams should differ when slot 2 changes');
});

// ── seedTagToLabel ──

test('seedTagToLabel: produces expected format', () => {
    const label = seedTagToLabel([3, 5, 9]);
    // slot 3 = "settled", slot 5 = "woven", slot 9 = "warm"
    assertEqual(label, 'Settled, woven, warm');
});

test('seedTagToLabel: first word is capitalized', () => {
    const label = seedTagToLabel([0, 0, 0]);
    assert(label[0] === label[0].toUpperCase(), `first char not uppercase: "${label}"`);
});

test('seedTagToLabel: edge indices (0, 0, 0)', () => {
    const label = seedTagToLabel([0, 0, 0]);
    assertEqual(label, 'Anchored, silken, frozen');
});

test('seedTagToLabel: edge indices (17, 17, 17)', () => {
    const label = seedTagToLabel([17, 17, 17]);
    assertEqual(label, 'Turbulent, jagged, burning');
});

test('seedTagToLabel: Spanish locale', () => {
    const label = seedTagToLabel([0, 0, 0], 'es');
    assertEqual(label, 'Anclado, sedoso, congelado');
});

test('seedTagToLabel: unknown locale falls back to English', () => {
    const label = seedTagToLabel([0, 0, 0], 'xx');
    assertEqual(label, 'Anchored, silken, frozen');
});

// ── serializeSeedTag / deserializeSeedTag ──

test('serializeSeedTag: produces dot-separated string', () => {
    assertEqual(serializeSeedTag([3, 12, 8]), '3.12.8');
});

test('serializeSeedTag: single-digit values', () => {
    assertEqual(serializeSeedTag([0, 0, 0]), '0.0.0');
});

test('deserializeSeedTag: valid input', () => {
    assertDeepEqual(deserializeSeedTag('3.12.8'), [3, 12, 8]);
});

test('deserializeSeedTag: returns null for wrong element count', () => {
    assertEqual(deserializeSeedTag('3.12'), null);
    assertEqual(deserializeSeedTag('3.12.8.1'), null);
    assertEqual(deserializeSeedTag(''), null);
});

test('deserializeSeedTag: returns null for non-numeric elements', () => {
    assertEqual(deserializeSeedTag('a.b.c'), null);
    assertEqual(deserializeSeedTag('3.x.8'), null);
});

test('deserializeSeedTag: returns null for out-of-range values', () => {
    assertEqual(deserializeSeedTag('-1.5.5'), null);
    assertEqual(deserializeSeedTag('5.18.5'), null);
    assertEqual(deserializeSeedTag('5.5.99'), null);
});

test('deserializeSeedTag: returns null for floating-point values', () => {
    assertEqual(deserializeSeedTag('3.5.12.8'), null);
    assertEqual(deserializeSeedTag('3.12.8.0'), null);
});

test('serialize/deserialize roundtrip', () => {
    const tags = [[0, 0, 0], [17, 17, 17], [3, 12, 8], [9, 0, 17]];
    for (const tag of tags) {
        const serialized = serializeSeedTag(tag);
        const deserialized = deserializeSeedTag(serialized);
        assertDeepEqual(deserialized, tag, `roundtrip failed for ${tag}`);
    }
});

// ── isSeedTag ──

test('isSeedTag: true for valid tag', () => {
    assert(isSeedTag([3, 12, 8]) === true);
});

test('isSeedTag: false for string', () => {
    assert(isSeedTag('hello') === false);
});

test('isSeedTag: false for wrong-length array', () => {
    assert(isSeedTag([1, 2]) === false);
    assert(isSeedTag([1, 2, 3, 4]) === false);
});

test('isSeedTag: false for array with non-numbers', () => {
    assert(isSeedTag(['a', 'b', 'c']) === false);
});

// ── seedToString ──

test('seedToString: array seed → dot-joined', () => {
    assertEqual(seedToString([3, 12, 8]), '3.12.8');
});

test('seedToString: string seed → pass-through', () => {
    assertEqual(seedToString('hello world'), 'hello world');
});

export { passed, failed };
