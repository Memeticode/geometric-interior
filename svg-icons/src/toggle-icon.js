// ══════════════════════════════════════════════════════════════
// Toggle Icon — open / close state indicator for toggle buttons
// Supports coalesce (materialize) and dissipate (dematerialize)
// ══════════════════════════════════════════════════════════════

import {
  NS, EASE, buildMorphSVG, setState, applyState, readState, lerpColor,
} from './morph-engine.js';

import {
  altTextWaitingOpenState, altTextWaitingOpenEmphasizeState,
  altTextWaitingCloseState, altTextWaitingCloseEmphasizeState,
  fullscreenWaitingOpenState, fullscreenWaitingOpenEmphasizeState,
  fullscreenWaitingCloseState, fullscreenWaitingCloseEmphasizeState,
  textShortWaitingOpenState, textShortWaitingOpenEmphasizeState,
  textShortWaitingCloseState, textShortWaitingCloseEmphasizeState,
  convergeState, dissipateState,
  COL,
} from './morph-states.js';

import { S, HP, HC } from './morph-engine.js';

// ── Empty state: all primitives collapsed to center, invisible ──

const EMPTY_STATE = {
  L1: HP, L2: HP, L3: HP, L4: HP, L5: HP, L6: HP, L7: HP, L8: HP,
  C1: HC, C2: HC, C3: HC, C4: HC, C5: HC, C6: HC, C7: HC,
  P1: { cx: 12, cy: 12, r: 0, o: 0, sw: 0.75 },
};

// ── Factory ──

/**
 * createToggleIcon(container, config)
 *
 * config.size          — pixel size (default 24)
 * config.initialOpen   — start in open state? (default false)
 * config.startVisible  — start visible (true) or empty for coalesce (false, default)
 * config.states        — { waitingOpen, waitingOpenEmphasize, waitingClose, waitingCloseEmphasize }
 * config.col           — { bg: [r,g,b], bd: [r,g,b] } (optional — skips bg/border color if absent)
 *
 * Returns { el, state, logicalState, morphing, isOpen, morph, skip, set,
 *           emphasize, deemphasize, toggle, coalesce, dissipate }
 */
export function createToggleIcon(container, config) {
  const size = config.size ?? 24;
  const col = config.col;

  const EMPTY_MODES = { converge: convergeState, dissipate: dissipateState };
  let emptyMode = 'converge';

  const MORPH_STATES = {
    'waiting-open': config.states.waitingOpen,
    'waiting-open-emphasize': config.states.waitingOpenEmphasize,
    'waiting-close': config.states.waitingClose,
    'waiting-close-emphasize': config.states.waitingCloseEmphasize,
  };

  function resolveState(key) {
    if (key === 'empty') return EMPTY_MODES[emptyMode];
    return MORPH_STATES[key];
  }

  // Build DOM
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.style.cssText = 'width:100%;height:100%;display:block';
  container.appendChild(svg);

  const elMap = buildMorphSVG(svg);

  // logicalState = what the icon "means" (never 'empty')
  // currentState = visual state (can be 'empty')
  let logicalState = config.initialOpen ? 'waiting-close' : 'waiting-open';
  let currentState = config.startVisible ? logicalState : 'empty';
  let morphing = false;
  let animId = null;
  let skipResolve = null;
  let targetState = null;
  let targetMorphState = null;

  // Apply initial state
  setState(elMap, resolveState(currentState));

  // ── Skip: snap to target state instantly ──
  function skip() {
    if (!morphing) return;
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    setState(elMap, targetMorphState);
    currentState = targetState;
    morphing = false;
    if (skipResolve) { skipResolve(); skipResolve = null; }
  }

  // ── Morph to a new state ──
  function morph(to, { duration = 300, mode } = {}) {
    if (morphing) skip();
    if (to === 'empty' && mode) emptyMode = mode;
    const toMorphState = resolveState(to);
    if (!toMorphState) return Promise.resolve();

    const refState = resolveState(currentState);
    const fromSnap = readState(elMap, refState);

    targetState = to;
    targetMorphState = toMorphState;
    morphing = true;

    // Update logical state for non-empty targets
    if (to !== 'empty') logicalState = to;

    return new Promise(res => {
      skipResolve = res;
      const t0 = performance.now();
      (function tick(now) {
        if (!morphing) return;
        const raw = Math.min((now - t0) / duration, 1);
        const t = EASE(raw);
        applyState(elMap, fromSnap, toMorphState, t);
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
    if (to === 'empty' && mode) emptyMode = mode;
    const ms = resolveState(to);
    if (!ms) return;
    setState(elMap, ms);
    currentState = to;
    if (to !== 'empty') logicalState = to;
  }

  // ── Convenience: emphasize / deemphasize ──
  function emphasize(opts) {
    const base = currentState.replace(/-emphasize$/, '');
    const emph = base + '-emphasize';
    if (emph !== currentState) return morph(emph, { duration: 150, ...opts });
    return Promise.resolve();
  }

  function deemphasize(opts) {
    const base = currentState.replace(/-emphasize$/, '');
    if (base !== currentState) return morph(base, { duration: 150, ...opts });
    return Promise.resolve();
  }

  // ── Toggle open <-> close ──
  function toggle(opts) {
    const base = currentState.replace(/-emphasize$/, '');
    const next = base === 'waiting-open' ? 'waiting-close' : 'waiting-open';
    return morph(next, opts);
  }

  /** Materialize from empty → current logical state. */
  function coalesce(opts = {}) {
    if (opts.mode) emptyMode = opts.mode;
    return morph(logicalState, { duration: 250, ...opts });
  }

  /** Dematerialize from current → empty. */
  function dissipate(opts = {}) {
    if (currentState === 'empty') return Promise.resolve();
    if (opts.mode) emptyMode = opts.mode;
    return morph('empty', { duration: 200, ...opts });
  }

  // ── Ambient shimmer ──
  let shimmerOn = false;
  let shimmerRaf = null;

  function startShimmer() {
    if (shimmerOn) return;
    shimmerOn = true;
    (function tick(now) {
      if (!shimmerOn) return;
      if (!morphing && currentState !== 'empty') {
        const st = resolveState(currentState);
        for (let i = 1; i <= 8; i++) {
          const k = 'L' + i;
          const s = Math.sin(now / (1200 + i * 300) * Math.PI * 2 + i * 2.3) * 0.5 + 0.5;
          const bo = st[k]?.o ?? 0;
          if (bo > 0) {
            elMap[k].setAttribute('opacity', bo * (0.75 + 0.25 * s));
            const bsw = st[k]?.sw ?? 0;
            if (bsw > 0) elMap[k].setAttribute('stroke-width', bsw * (0.85 + 0.15 * s));
          }
        }
        for (let i = 1; i <= 4; i++) {
          const k = 'C' + i;
          const s = Math.sin(now / (1500 + i * 400) * Math.PI * 2 + i * 1.7) * 0.5 + 0.5;
          const bo = st[k]?.o ?? 0;
          if (bo > 0) elMap[k].setAttribute('opacity', bo * (0.7 + 0.3 * s));
        }
      }
      shimmerRaf = requestAnimationFrame(tick);
    })(performance.now());
  }

  function stopShimmer() {
    shimmerOn = false;
    if (shimmerRaf) { cancelAnimationFrame(shimmerRaf); shimmerRaf = null; }
    if (currentState !== 'empty') setState(elMap, resolveState(currentState));
  }

  return {
    el: svg,
    morph,
    skip,
    set,
    emphasize,
    deemphasize,
    toggle,
    coalesce,
    dissipate,
    startShimmer,
    stopShimmer,
    get state() { return currentState; },
    get logicalState() { return logicalState; },
    get morphing() { return morphing; },
    get isOpen() { return logicalState.startsWith('waiting-close'); },
  };
}

// ── Preconfigured factories ──

export function createTextToggle(container, opts = {}) {
  return createToggleIcon(container, {
    size: opts.size ?? 24,
    initialOpen: opts.initialOpen ?? false,
    startVisible: opts.startVisible ?? false,
    col: COL['alt-text-waiting-open'],
    states: {
      waitingOpen: altTextWaitingOpenState,
      waitingOpenEmphasize: altTextWaitingOpenEmphasizeState,
      waitingClose: altTextWaitingCloseState,
      waitingCloseEmphasize: altTextWaitingCloseEmphasizeState,
    },
  });
}

export function createFullscreenToggle(container, opts = {}) {
  return createToggleIcon(container, {
    size: opts.size ?? 24,
    initialOpen: opts.initialOpen ?? false,
    startVisible: opts.startVisible ?? false,
    col: COL['fullscreen-waiting-open'],
    states: {
      waitingOpen: fullscreenWaitingOpenState,
      waitingOpenEmphasize: fullscreenWaitingOpenEmphasizeState,
      waitingClose: fullscreenWaitingCloseState,
      waitingCloseEmphasize: fullscreenWaitingCloseEmphasizeState,
    },
  });
}

export function createTextShortToggle(container, opts = {}) {
  return createToggleIcon(container, {
    size: opts.size ?? 24,
    initialOpen: opts.initialOpen ?? false,
    startVisible: opts.startVisible ?? false,
    col: COL['text-short-waiting-open'],
    states: {
      waitingOpen: textShortWaitingOpenState,
      waitingOpenEmphasize: textShortWaitingOpenEmphasizeState,
      waitingClose: textShortWaitingCloseState,
      waitingCloseEmphasize: textShortWaitingCloseEmphasizeState,
    },
  });
}
