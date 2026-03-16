// ══════════════════════════════════════════════════════════════
// Card Icon — viewing / editing state indicator for image cards
// ══════════════════════════════════════════════════════════════

import {
  NS, EASE, buildMorphSVG, setState, applyState, readState, lerpColor, S, HP, HC,
} from './morph-engine.js';

import {
  createState, constructState, convergeState, dissipateState, COL,
} from './morph-states.js';

// ── Viewing-emphasis state (expanded create) ──

const viewingEmphasisState = {
  L1: { ...S(12, 3.5, 12, 12), sw: 1.5, da: '100 0', o: 1 },
  L2: { ...S(12, 12, 12, 20.5), sw: 1.5, da: '100 0', o: 1 },
  L3: { ...S(3.5, 12, 12, 12), sw: 1.5, da: '100 0', o: 1 },
  L4: { ...S(12, 12, 20.5, 12), sw: 1.5, da: '100 0', o: 1 },
  L5: HP, L6: HP, L7: HP, L8: HP,
  C1: { cx: 12, cy: 12, r: 2.3, o: 1 },
  C2: { cx: 12, cy: 3.5, r: 1.5, o: 1 },
  C3: { cx: 12, cy: 20.5, r: 1.5, o: 1 },
  C4: { cx: 3.5, cy: 12, r: 1.5, o: 1 },
  C5: { cx: 20.5, cy: 12, r: 1.5, o: 1 },
  C6: HC, C7: HC,
  P1: { cx: 12, cy: 12, r: 0, o: 0, sw: 0.75 },
};

// ── State + color maps ──

const MORPH_STATES = {
  empty: convergeState,
  viewing: createState,
  'viewing-emphasis': viewingEmphasisState,
  editing: constructState,
};

const EMPTY_MODES = { converge: convergeState, dissipate: dissipateState };

const COL_MAP = {
  empty: COL.converge,
  viewing: COL.create,
  'viewing-emphasis': COL.create,
  editing: COL.construct,
};

// ── Factory ──

export function createCardIcon(container, opts = {}) {
  const size = opts.size ?? 24;
  const initialState = opts.initialState ?? 'empty';

  // Build DOM
  const stage = document.createElement('div');
  stage.className = 'morph-stage';
  stage.style.width = size + 'px';
  stage.style.height = size + 'px';
  stage.style.minWidth = size + 'px';
  stage.style.position = 'relative';
  stage.style.overflow = 'hidden';

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  stage.appendChild(svg);
  container.appendChild(stage);

  const elMap = buildMorphSVG(svg);

  // Internal state
  let currentState = initialState;
  let currentEmptyMode = 'converge';
  let morphing = false;
  let animId = null;
  let skipResolve = null;
  let targetState = null;
  let targetMorphState = null;

  // Resolve the morph state for a given key + mode
  function resolve(key, mode) {
    if (key === 'empty') return EMPTY_MODES[mode || currentEmptyMode] || convergeState;
    return MORPH_STATES[key];
  }

  // Apply initial state
  const initMorphState = resolve(initialState);
  setState(elMap, initMorphState);
  const initCol = COL_MAP[initialState];
  stage.style.background = lerpColor(initCol.bg, initCol.bg, 0);
  stage.style.borderColor = lerpColor(initCol.bd, initCol.bd, 0);

  // ── Skip: snap to target state instantly ──
  function skip() {
    if (!morphing) return;
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    setState(elMap, targetMorphState);
    const col = COL_MAP[targetState];
    stage.style.background = lerpColor(col.bg, col.bg, 0);
    stage.style.borderColor = lerpColor(col.bd, col.bd, 0);
    currentState = targetState;
    morphing = false;
    if (skipResolve) { skipResolve(); skipResolve = null; }
  }

  // ── Morph to a new state ──
  function morph(to, { duration = 300, mode } = {}) {
    if (morphing) skip();

    // When mode is specified, update the empty mode for whichever direction uses it
    if (mode) currentEmptyMode = mode;
    const toMorphState = resolve(to, mode);
    const toCol = COL_MAP[to];

    // Capture current visual as "from"
    const refState = resolve(currentState, mode);
    const fromSnap = readState(elMap, refState);
    const fromCol = COL_MAP[currentState];

    targetState = to;
    targetMorphState = toMorphState;
    morphing = true;

    return new Promise(res => {
      skipResolve = res;
      const t0 = performance.now();
      (function tick(now) {
        if (!morphing) return;
        const raw = Math.min((now - t0) / duration, 1);
        const t = EASE(raw);
        applyState(elMap, fromSnap, toMorphState, t);
        stage.style.background = lerpColor(fromCol.bg, toCol.bg, t);
        stage.style.borderColor = lerpColor(fromCol.bd, toCol.bd, t);
        if (raw < 1) {
          animId = requestAnimationFrame(tick);
        } else {
          animId = null;
          currentState = to;
          morphing = false;
          skipResolve = null;
          res();
        }
      })(performance.now());
    });
  }

  // ── Set state instantly (no animation) ──
  function set(to, { mode } = {}) {
    if (morphing) skip();
    if (to === 'empty' && mode) currentEmptyMode = mode;
    const ms = resolve(to, mode);
    setState(elMap, ms);
    const col = COL_MAP[to];
    stage.style.background = lerpColor(col.bg, col.bg, 0);
    stage.style.borderColor = lerpColor(col.bd, col.bd, 0);
    currentState = to;
  }

  return {
    el: stage,
    morph,
    skip,
    set,
    get state() { return currentState; },
    get morphing() { return morphing; },
  };
}
