// ══════════════════════════════════════════════════════════════
// Toggle Icon — open / close state indicator for toggle buttons
// Copy-paste friendly: imports only from @svg-icons
// ══════════════════════════════════════════════════════════════

import {
  NS, EASE, buildMorphSVG, setState, applyState, readState, lerpColor,
} from '@svg-icons';

import {
  altTextWaitingOpenState, altTextWaitingOpenEmphasizeState,
  altTextWaitingCloseState, altTextWaitingCloseEmphasizeState,
  fullscreenWaitingOpenState, fullscreenWaitingOpenEmphasizeState,
  fullscreenWaitingCloseState, fullscreenWaitingCloseEmphasizeState,
  COL,
} from '@svg-icons';

// ── Factory ──

/**
 * createToggleIcon(container, config)
 *
 * config.size          — pixel size (default 24)
 * config.initialOpen   — start in open state? (default false)
 * config.states        — { waitingOpen, waitingOpenEmphasize, waitingClose, waitingCloseEmphasize }
 * config.col           — { bg: [r,g,b], bd: [r,g,b] }
 *
 * Returns { el, state, morphing, isOpen, morph, skip, set, emphasize, deemphasize, toggle }
 */
export function createToggleIcon(container, config) {
  const size = config.size ?? 24;
  const col = config.col;

  const MORPH_STATES = {
    'waiting-open': config.states.waitingOpen,
    'waiting-open-emphasize': config.states.waitingOpenEmphasize,
    'waiting-close': config.states.waitingClose,
    'waiting-close-emphasize': config.states.waitingCloseEmphasize,
  };

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
  let currentState = config.initialOpen ? 'waiting-close' : 'waiting-open';
  let morphing = false;
  let animId = null;
  let skipResolve = null;
  let targetState = null;
  let targetMorphState = null;

  // Apply initial state
  const initMS = MORPH_STATES[currentState];
  setState(elMap, initMS);
  stage.style.background = lerpColor(col.bg, col.bg, 0);
  stage.style.borderColor = lerpColor(col.bd, col.bd, 0);

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
  function morph(to, { duration = 300 } = {}) {
    if (morphing) skip();

    const toMorphState = MORPH_STATES[to];
    if (!toMorphState) return Promise.resolve();

    // Capture current visual as "from"
    const refState = MORPH_STATES[currentState];
    const fromSnap = readState(elMap, refState);

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
  function set(to) {
    if (morphing) skip();
    const ms = MORPH_STATES[to];
    if (!ms) return;
    setState(elMap, ms);
    currentState = to;
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

  return {
    el: stage,
    morph,
    skip,
    set,
    emphasize,
    deemphasize,
    toggle,
    get state() { return currentState; },
    get morphing() { return morphing; },
    get isOpen() { return currentState.startsWith('waiting-close'); },
  };
}

// ── Preconfigured factories ──

export function createAltTextToggle(container, opts = {}) {
  return createToggleIcon(container, {
    size: opts.size ?? 24,
    initialOpen: opts.initialOpen ?? false,
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
    col: COL['fullscreen-waiting-open'],
    states: {
      waitingOpen: fullscreenWaitingOpenState,
      waitingOpenEmphasize: fullscreenWaitingOpenEmphasizeState,
      waitingClose: fullscreenWaitingCloseState,
      waitingCloseEmphasize: fullscreenWaitingCloseEmphasizeState,
    },
  });
}
