/**
 * Tests for the animation timeline evaluator and easing functions.
 */
import {
    evaluateTimeline, totalDuration, totalFrames, applyEasing,
} from '../../dist/lib/geometric-interior.js';

let passed = 0, failed = 0;

function test(name, fn) {
    try { fn(); passed++; console.log(`  PASS: ${name}`); }
    catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${e.message}`); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertClose(a, b, eps = 1e-6, msg) {
    if (Math.abs(a - b) > eps) throw new Error(msg || `expected ${a} close to ${b} (eps=${eps})`);
}

console.log('\n=== Timeline Tests ===\n');

/* ── Easing ── */

test('applyEasing linear is identity', () => {
    for (let t = 0; t <= 1; t += 0.1) {
        assertClose(applyEasing(t, 'linear'), t, 1e-6);
    }
});

test('applyEasing ease-in: starts slow', () => {
    assertClose(applyEasing(0, 'ease-in'), 0);
    assertClose(applyEasing(1, 'ease-in'), 1);
    // At t=0.5, ease-in should be < 0.5 (slow start)
    assert(applyEasing(0.5, 'ease-in') < 0.5, 'ease-in at 0.5 should be < 0.5');
});

test('applyEasing ease-out: starts fast', () => {
    assertClose(applyEasing(0, 'ease-out'), 0);
    assertClose(applyEasing(1, 'ease-out'), 1);
    // At t=0.5, ease-out should be > 0.5 (fast start)
    assert(applyEasing(0.5, 'ease-out') > 0.5, 'ease-out at 0.5 should be > 0.5');
});

test('applyEasing ease-in-out: symmetric', () => {
    assertClose(applyEasing(0, 'ease-in-out'), 0);
    assertClose(applyEasing(1, 'ease-in-out'), 1);
    assertClose(applyEasing(0.5, 'ease-in-out'), 0.5, 0.01);
});

test('applyEasing clamps to [0,1]', () => {
    assertClose(applyEasing(-0.5, 'linear'), 0);
    assertClose(applyEasing(1.5, 'linear'), 1);
});

test('all easing types are monotonic', () => {
    for (const easing of ['linear', 'ease-in', 'ease-out', 'ease-in-out']) {
        let prev = 0;
        for (let t = 0.01; t <= 1; t += 0.01) {
            const v = applyEasing(t, easing);
            assert(v >= prev - 1e-10, `${easing} non-monotonic at t=${t}: ${v} < ${prev}`);
            prev = v;
        }
    }
});

/* ── Helper: build Controls object ── */

function makeControls(overrides = {}) {
    return {
        topology: 'flow-field',
        density: 0.5, luminosity: 0.5, fracture: 0.5, coherence: 0.5,
        hue: 0.5, spectrum: 0.3, chroma: 0.4,
        scale: 0.5, division: 0.5, faceting: 0.5, flow: 0.5,
        ...overrides,
    };
}

/* ── totalDuration / totalFrames ── */

test('totalDuration sums event durations', () => {
    const anim = {
        settings: { fps: 30, width: 640, height: 480 },
        events: [
            { type: 'expand', duration: 1, easing: 'linear', config: makeControls(), seed: 'a' },
            { type: 'pause', duration: 2, easing: 'linear' },
            { type: 'collapse', duration: 1, easing: 'linear' },
        ],
        cameraMoves: [],
        paramTracks: [],
    };
    assertClose(totalDuration(anim), 4.0);
});

test('totalFrames computes fps * duration', () => {
    const anim = {
        settings: { fps: 30, width: 640, height: 480 },
        events: [
            { type: 'expand', duration: 2, easing: 'linear', config: makeControls(), seed: 'a' },
            { type: 'pause', duration: 3, easing: 'linear' },
        ],
        cameraMoves: [],
        paramTracks: [],
    };
    assert(totalFrames(anim) === 150, `expected 150, got ${totalFrames(anim)}`);
});

/* ── evaluateTimeline: expand → pause → collapse ── */

const basicAnim = {
    settings: { fps: 30, width: 640, height: 480 },
    events: [
        { type: 'expand', duration: 1, easing: 'linear', config: makeControls({ density: 0.7 }), seed: 'test-seed' },
        { type: 'pause', duration: 2, easing: 'linear' },
        { type: 'collapse', duration: 1, easing: 'linear' },
    ],
    cameraMoves: [],
    paramTracks: [],
};

test('evaluateTimeline: expand start (t=0) has foldProgress=0', () => {
    const state = evaluateTimeline(basicAnim, 0);
    assertClose(state.foldProgress, 0, 0.01);
    assert(state.eventType === 'expand', `expected expand, got ${state.eventType}`);
    assert(state.eventIndex === 0, `expected eventIndex=0, got ${state.eventIndex}`);
});

test('evaluateTimeline: expand midpoint (t=0.5) has foldProgress≈0.5', () => {
    const state = evaluateTimeline(basicAnim, 0.5);
    assertClose(state.foldProgress, 0.5, 0.01);
    assert(state.eventType === 'expand');
});

test('evaluateTimeline: expand end / pause start (t=1) has foldProgress=1', () => {
    const state = evaluateTimeline(basicAnim, 1.0);
    assert(state.eventType === 'pause', `expected pause, got ${state.eventType}`);
    assertClose(state.foldProgress, 1.0, 0.01);
});

test('evaluateTimeline: pause middle (t=2) has foldProgress=1', () => {
    const state = evaluateTimeline(basicAnim, 2.0);
    assert(state.eventType === 'pause');
    assertClose(state.foldProgress, 1.0);
});

test('evaluateTimeline: collapse start (t=3) has foldProgress=1', () => {
    const state = evaluateTimeline(basicAnim, 3.0);
    assert(state.eventType === 'collapse', `expected collapse, got ${state.eventType}`);
    assertClose(state.foldProgress, 1.0, 0.01);
});

test('evaluateTimeline: collapse midpoint (t=3.5) has foldProgress≈0.5', () => {
    const state = evaluateTimeline(basicAnim, 3.5);
    assertClose(state.foldProgress, 0.5, 0.01);
    assert(state.eventType === 'collapse');
});

test('evaluateTimeline: collapse end (t≈4) has foldProgress≈0', () => {
    const state = evaluateTimeline(basicAnim, 3.999);
    assertClose(state.foldProgress, 0, 0.01);
});

test('evaluateTimeline: config resolved correctly', () => {
    const state = evaluateTimeline(basicAnim, 2.0);
    assertClose(state.currentConfig.density, 0.7);
    assert(state.currentSeed === 'test-seed');
});

test('evaluateTimeline: time tracks absolute time', () => {
    const state = evaluateTimeline(basicAnim, 2.5);
    assertClose(state.time, 2.5, 0.001);
});

test('evaluateTimeline: no morph state for non-transition events', () => {
    const state = evaluateTimeline(basicAnim, 2.0);
    assert(state.morphT === undefined, 'expected no morphT');
    assert(state.morphFromConfig === undefined, 'expected no morphFromConfig');
});

/* ── evaluateTimeline: transition ── */

const transitionAnim = {
    settings: { fps: 30, width: 640, height: 480 },
    events: [
        { type: 'expand', duration: 1, easing: 'linear', config: makeControls({ density: 0.2 }), seed: 'seed-a' },
        { type: 'pause', duration: 1, easing: 'linear' },
        { type: 'transition', duration: 2, easing: 'linear', config: makeControls({ density: 0.9 }), seed: 'seed-b' },
        { type: 'pause', duration: 1, easing: 'linear' },
        { type: 'collapse', duration: 1, easing: 'linear' },
    ],
    cameraMoves: [],
    paramTracks: [],
};

test('evaluateTimeline: transition has morph state', () => {
    const state = evaluateTimeline(transitionAnim, 3.0); // midpoint of transition (2-4s)
    assert(state.eventType === 'transition', `expected transition, got ${state.eventType}`);
    assert(state.morphT !== undefined, 'expected morphT');
    assertClose(state.morphT, 0.5, 0.01);
});

test('evaluateTimeline: transition from/to configs correct', () => {
    const state = evaluateTimeline(transitionAnim, 2.5);
    assertClose(state.morphFromConfig.density, 0.2);
    assert(state.morphFromSeed === 'seed-a');
    assertClose(state.morphToConfig.density, 0.9);
    assert(state.morphToSeed === 'seed-b');
});

test('evaluateTimeline: after transition, current config is target', () => {
    const state = evaluateTimeline(transitionAnim, 4.5); // in pause after transition
    assert(state.eventType === 'pause');
    assertClose(state.currentConfig.density, 0.9);
    assert(state.currentSeed === 'seed-b');
});

test('evaluateTimeline: transition with easing', () => {
    const easedAnim = {
        ...transitionAnim,
        events: [
            ...transitionAnim.events.slice(0, 2),
            { ...transitionAnim.events[2], easing: 'ease-in' },
            ...transitionAnim.events.slice(3),
        ],
    };
    const state = evaluateTimeline(easedAnim, 3.0); // midpoint
    // ease-in at 0.5 → 0.125 (t³), so morphT should be < 0.5
    assert(state.morphT < 0.5, `ease-in morphT at midpoint should be < 0.5, got ${state.morphT}`);
});

/* ── evaluateTimeline: camera moves (Phase 3) ── */

test('evaluateTimeline: default camera state', () => {
    const state = evaluateTimeline(basicAnim, 2.0);
    assertClose(state.cameraZoom, 1.0);
    assertClose(state.cameraOrbitY, 0);
    assertClose(state.cameraOrbitX, 0);
});

test('evaluateTimeline: zoom camera move at endpoints', () => {
    const camAnim = {
        ...basicAnim,
        cameraMoves: [
            { type: 'zoom', startTime: 1.0, endTime: 3.0, easing: 'linear', from: { zoom: 1.0 }, to: { zoom: 0.5 } },
        ],
    };
    // Before move starts: default
    assertClose(evaluateTimeline(camAnim, 0.5).cameraZoom, 1.0);
    // At move start
    assertClose(evaluateTimeline(camAnim, 1.0).cameraZoom, 1.0, 0.01);
    // At move midpoint
    assertClose(evaluateTimeline(camAnim, 2.0).cameraZoom, 0.75, 0.01);
    // At move end
    assertClose(evaluateTimeline(camAnim, 3.0).cameraZoom, 0.5, 0.01);
    // After move ends: stays at end value? No — returns to default since move is no longer active
    assertClose(evaluateTimeline(camAnim, 3.5).cameraZoom, 1.0);
});

test('evaluateTimeline: orbit Y camera move', () => {
    const camAnim = {
        ...basicAnim,
        cameraMoves: [
            { type: 'rotate', startTime: 0, endTime: 4.0, easing: 'linear', from: { orbitY: 0 }, to: { orbitY: 90 } },
        ],
    };
    assertClose(evaluateTimeline(camAnim, 0).cameraOrbitY, 0);
    assertClose(evaluateTimeline(camAnim, 2.0).cameraOrbitY, 45, 0.1);
    assertClose(evaluateTimeline(camAnim, 4.0).cameraOrbitY, 90, 0.1);
});

test('evaluateTimeline: simultaneous zoom + rotate compose', () => {
    const camAnim = {
        ...basicAnim,
        cameraMoves: [
            { type: 'zoom', startTime: 0, endTime: 4.0, easing: 'linear', from: { zoom: 1.0 }, to: { zoom: 0.5 } },
            { type: 'rotate', startTime: 0, endTime: 4.0, easing: 'linear', from: { orbitY: 0 }, to: { orbitY: 60 } },
        ],
    };
    const state = evaluateTimeline(camAnim, 2.0);
    // Zoom composes multiplicatively: 1.0 * 0.75 = 0.75
    assertClose(state.cameraZoom, 0.75, 0.01);
    // Orbit composes additively: 0 + 30 = 30
    assertClose(state.cameraOrbitY, 30, 0.1);
});

test('evaluateTimeline: camera move with easing', () => {
    const camAnim = {
        ...basicAnim,
        cameraMoves: [
            { type: 'zoom', startTime: 1.0, endTime: 3.0, easing: 'ease-in', from: { zoom: 1.0 }, to: { zoom: 0.5 } },
        ],
    };
    const state = evaluateTimeline(camAnim, 2.0); // midpoint, ease-in
    // ease-in at t=0.5: 0.5³ = 0.125, so zoom = lerp(1.0, 0.5, 0.125) = 0.9375
    assertClose(state.cameraZoom, 0.9375, 0.01);
});

test('evaluateTimeline: camera move spans event boundaries', () => {
    // Camera zoom that starts in expand and ends in pause — should work
    const camAnim = {
        ...basicAnim,
        cameraMoves: [
            { type: 'zoom', startTime: 0.5, endTime: 2.5, easing: 'linear', from: { zoom: 1.0 }, to: { zoom: 0.6 } },
        ],
    };
    // In expand event (t=0.5-1.0) and pause event (t=1.0-3.0) — camera spans both
    assertClose(evaluateTimeline(camAnim, 1.5).cameraZoom, 0.8, 0.01);
});

/* ── evaluateTimeline: param tracks (Phase 4) ── */

test('evaluateTimeline: default live params', () => {
    const state = evaluateTimeline(basicAnim, 2.0);
    assertClose(state.twinkle, 0);
    assertClose(state.dynamism, 0);
});

test('evaluateTimeline: twinkle param track at endpoints', () => {
    const paramAnim = {
        ...basicAnim,
        paramTracks: [
            { param: 'twinkle', startTime: 1.0, endTime: 3.0, easing: 'linear', from: 0, to: 1.0 },
        ],
    };
    // Before track: default 0
    assertClose(evaluateTimeline(paramAnim, 0.5).twinkle, 0);
    // At track start
    assertClose(evaluateTimeline(paramAnim, 1.0).twinkle, 0, 0.01);
    // At midpoint
    assertClose(evaluateTimeline(paramAnim, 2.0).twinkle, 0.5, 0.01);
    // At end
    assertClose(evaluateTimeline(paramAnim, 3.0).twinkle, 1.0, 0.01);
    // After track: default 0
    assertClose(evaluateTimeline(paramAnim, 3.5).twinkle, 0);
});

test('evaluateTimeline: dynamism param track', () => {
    const paramAnim = {
        ...basicAnim,
        paramTracks: [
            { param: 'dynamism', startTime: 0, endTime: 4.0, easing: 'linear', from: 0.2, to: 0.8 },
        ],
    };
    assertClose(evaluateTimeline(paramAnim, 2.0).dynamism, 0.5, 0.01);
});

test('evaluateTimeline: param track with easing', () => {
    const paramAnim = {
        ...basicAnim,
        paramTracks: [
            { param: 'twinkle', startTime: 1.0, endTime: 3.0, easing: 'ease-out', from: 0, to: 1.0 },
        ],
    };
    const state = evaluateTimeline(paramAnim, 2.0); // midpoint, ease-out
    // ease-out at t=0.5: 1 - (1-0.5)³ = 1 - 0.125 = 0.875
    assertClose(state.twinkle, 0.875, 0.01);
});

test('evaluateTimeline: multiple param tracks simultaneously', () => {
    const paramAnim = {
        ...basicAnim,
        paramTracks: [
            { param: 'twinkle', startTime: 0, endTime: 4.0, easing: 'linear', from: 0, to: 1.0 },
            { param: 'dynamism', startTime: 1.0, endTime: 3.0, easing: 'linear', from: 0.5, to: 1.0 },
        ],
    };
    const state = evaluateTimeline(paramAnim, 2.0);
    assertClose(state.twinkle, 0.5, 0.01);
    assertClose(state.dynamism, 0.75, 0.01);
});

test('evaluateTimeline: param track spans event boundaries', () => {
    const paramAnim = {
        ...basicAnim,
        paramTracks: [
            { param: 'twinkle', startTime: 0.5, endTime: 3.5, easing: 'linear', from: 0, to: 1.0 },
        ],
    };
    // Track spans expand + pause + into collapse
    assertClose(evaluateTimeline(paramAnim, 2.0).twinkle, 0.5, 0.01);
});

/* ── Edge cases ── */

test('evaluateTimeline: clamped to start', () => {
    const state = evaluateTimeline(basicAnim, -1);
    assert(state.eventIndex === 0);
    assertClose(state.time, 0);
});

test('evaluateTimeline: clamped to end', () => {
    const state = evaluateTimeline(basicAnim, 100);
    assert(state.eventIndex === basicAnim.events.length - 1);
});

test('evaluateTimeline: throws on empty events', () => {
    try {
        evaluateTimeline({ settings: { fps: 30, width: 1, height: 1 }, events: [], cameraMoves: [], paramTracks: [] }, 0);
        assert(false, 'should have thrown');
    } catch (e) {
        assert(e.message.includes('no events'), `unexpected error: ${e.message}`);
    }
});

/* ── evaluateTimeline: focus tracks (Phase 6) ── */

test('evaluateTimeline: default focus state', () => {
    const state = evaluateTimeline(basicAnim, 2.0);
    assertClose(state.focalDepth, 0.5); // default mid-range
    assertClose(state.blurAmount, 0);   // no blur by default
});

test('evaluateTimeline: focus track at endpoints', () => {
    const focusAnim = {
        ...basicAnim,
        focusTracks: [
            {
                startTime: 1.0, endTime: 3.0, easing: 'linear',
                from: { focalDepth: 0.0, blurAmount: 0.0 },
                to: { focalDepth: 1.0, blurAmount: 0.8 },
            },
        ],
    };
    // Before track: defaults
    assertClose(evaluateTimeline(focusAnim, 0.5).focalDepth, 0.5);
    assertClose(evaluateTimeline(focusAnim, 0.5).blurAmount, 0);
    // At start
    assertClose(evaluateTimeline(focusAnim, 1.0).focalDepth, 0.0, 0.01);
    assertClose(evaluateTimeline(focusAnim, 1.0).blurAmount, 0.0, 0.01);
    // Midpoint
    assertClose(evaluateTimeline(focusAnim, 2.0).focalDepth, 0.5, 0.01);
    assertClose(evaluateTimeline(focusAnim, 2.0).blurAmount, 0.4, 0.01);
    // At end
    assertClose(evaluateTimeline(focusAnim, 3.0).focalDepth, 1.0, 0.01);
    assertClose(evaluateTimeline(focusAnim, 3.0).blurAmount, 0.8, 0.01);
    // After track: defaults again
    assertClose(evaluateTimeline(focusAnim, 3.5).focalDepth, 0.5);
    assertClose(evaluateTimeline(focusAnim, 3.5).blurAmount, 0);
});

test('evaluateTimeline: focus track with easing', () => {
    const focusAnim = {
        ...basicAnim,
        focusTracks: [
            {
                startTime: 1.0, endTime: 3.0, easing: 'ease-in',
                from: { focalDepth: 0.2, blurAmount: 0.0 },
                to: { focalDepth: 0.8, blurAmount: 1.0 },
            },
        ],
    };
    const state = evaluateTimeline(focusAnim, 2.0); // midpoint, ease-in
    // ease-in at t=0.5: 0.5³ = 0.125
    // focalDepth = lerp(0.2, 0.8, 0.125) = 0.275
    assertClose(state.focalDepth, 0.275, 0.01);
    // blurAmount = lerp(0, 1, 0.125) = 0.125
    assertClose(state.blurAmount, 0.125, 0.01);
});

test('evaluateTimeline: multiple focus tracks compose by averaging', () => {
    const focusAnim = {
        ...basicAnim,
        focusTracks: [
            {
                startTime: 1.0, endTime: 3.0, easing: 'linear',
                from: { focalDepth: 0.0, blurAmount: 0.4 },
                to: { focalDepth: 1.0, blurAmount: 0.4 },
            },
            {
                startTime: 1.0, endTime: 3.0, easing: 'linear',
                from: { focalDepth: 1.0, blurAmount: 0.8 },
                to: { focalDepth: 0.0, blurAmount: 0.8 },
            },
        ],
    };
    const state = evaluateTimeline(focusAnim, 2.0); // midpoint
    // Track 1: focalDepth=0.5, blurAmount=0.4
    // Track 2: focalDepth=0.5, blurAmount=0.8
    // Average: focalDepth=0.5, blurAmount=0.6
    assertClose(state.focalDepth, 0.5, 0.01);
    assertClose(state.blurAmount, 0.6, 0.01);
});

test('evaluateTimeline: focus track without focusTracks field uses defaults', () => {
    // basicAnim has no focusTracks field at all
    const state = evaluateTimeline(basicAnim, 2.0);
    assertClose(state.focalDepth, 0.5);
    assertClose(state.blurAmount, 0);
});

export { passed, failed };
