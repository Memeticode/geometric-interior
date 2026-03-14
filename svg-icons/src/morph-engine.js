// ══════════════════════════════════════════════════════════════════
// Universal Morph Engine — 16 primitives (8 paths + 7 circles + 1 ring)
// All custom SVGs composed from the same elements so any→any morph works
// ══════════════════════════════════════════════════════════════════

export const NS = 'http://www.w3.org/2000/svg';
export const DURATION = 3000;
export const EASE = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

// ── Helpers ──
export function parseDa(s) { return s.split(' ').map(Number); }
export function lerpDa(a, b, t) { return a.map((v, i) => v + (b[i] - v) * t).join(' '); }
export function lerpColor(a, b, t) {
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}

// Straight path: control point at midpoint (visually straight line)
export function S(x1, y1, x2, y2) {
  return { x1, y1, qx: (x1 + x2) / 2, qy: (y1 + y2) / 2, x2, y2 };
}

// Hidden path (collapsed at center, invisible)
export const HP = { ...S(12, 12, 12, 12), sw: 1, da: '100 0', o: 0 };
// Hidden circle (at center, zero radius)
export const HC = { cx: 12, cy: 12, r: 0, o: 0 };

// ── Build & Apply ──

export function buildMorphSVG(svgEl) {
  const elMap = {};
  const pathEl = (id) => {
    const el = document.createElementNS(NS, 'path');
    el.setAttribute('stroke', 'currentColor');
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke-linecap', 'butt');
    svgEl.appendChild(el);
    elMap[id] = el;
  };
  const circle = (id, fill) => {
    const el = document.createElementNS(NS, 'circle');
    el.setAttribute('fill', fill ? 'currentColor' : 'none');
    if (!fill) el.setAttribute('stroke', 'currentColor');
    svgEl.appendChild(el);
    elMap[id] = el;
  };
  for (let i = 1; i <= 8; i++) pathEl('L' + i);
  for (let i = 1; i <= 7; i++) circle('C' + i, true);
  circle('P1', false);
  return elMap;
}

export function applyState(elMap, from, to, t) {
  for (const key of Object.keys(from)) {
    const el = elMap[key], a = from[key], b = to[key];
    if ('x1' in a) {
      const x1 = a.x1 + (b.x1 - a.x1) * t, y1 = a.y1 + (b.y1 - a.y1) * t;
      const qx = a.qx + (b.qx - a.qx) * t, qy = a.qy + (b.qy - a.qy) * t;
      const x2 = a.x2 + (b.x2 - a.x2) * t, y2 = a.y2 + (b.y2 - a.y2) * t;
      el.setAttribute('d', `M${x1} ${y1}Q${qx} ${qy} ${x2} ${y2}`);
    }
    if ('cx' in a) {
      el.setAttribute('cx', a.cx + (b.cx - a.cx) * t);
      el.setAttribute('cy', a.cy + (b.cy - a.cy) * t);
      el.setAttribute('r', Math.max(0, a.r + (b.r - a.r) * t));
    }
    if ('da' in a) el.setAttribute('stroke-dasharray', lerpDa(parseDa(a.da), parseDa(b.da), t));
    if ('sw' in a) el.setAttribute('stroke-width', a.sw + (b.sw - a.sw) * t);
    el.setAttribute('opacity', a.o + (b.o - a.o) * t);
  }
}

// Apply a state instantly (no interpolation)
export function setState(elMap, state) { applyState(elMap, state, state, 0); }

// Promise-based morph animation
export function morphAnim(elMap, from, to, dur, stage, colFrom, colTo) {
  return new Promise(resolve => {
    const t0 = performance.now();
    (function tick(now) {
      const raw = Math.min((now - t0) / dur, 1);
      const t = EASE(raw);
      applyState(elMap, from, to, t);
      if (stage && colFrom && colTo) {
        stage.style.background = lerpColor(colFrom.bg, colTo.bg, t);
        stage.style.borderColor = lerpColor(colFrom.bd, colTo.bd, t);
      }
      if (raw < 1) requestAnimationFrame(tick);
      else resolve();
    })(performance.now());
  });
}

// Click-to-toggle morph on a DOM element
export function createMorph(itemId, stateA, stateB, colA, colB, initAt) {
  const item = document.getElementById(itemId);
  const stage = item.querySelector('.morph-stage');
  const svg = stage.querySelector('svg');
  const elMap = buildMorphSVG(svg);
  let atB = initAt === 1, animId = null;

  setState(elMap, atB ? stateB : stateA);
  if (colA && colB) {
    const c = atB ? colB : colA;
    stage.style.background = lerpColor(c.bg, c.bg, 0);
    stage.style.borderColor = lerpColor(c.bd, c.bd, 0);
  }

  item.addEventListener('click', () => {
    if (animId) cancelAnimationFrame(animId);
    const from = atB ? stateB : stateA;
    const to = atB ? stateA : stateB;
    const cF = atB ? colB : colA;
    const cT = atB ? colA : colB;
    atB = !atB;
    const t0 = performance.now();
    (function tick(now) {
      const raw = Math.min((now - t0) / DURATION, 1);
      const t = EASE(raw);
      applyState(elMap, from, to, t);
      if (cF && cT) {
        stage.style.background = lerpColor(cF.bg, cT.bg, t);
        stage.style.borderColor = lerpColor(cF.bd, cT.bd, t);
      }
      if (raw < 1) animId = requestAnimationFrame(tick);
      else animId = null;
    })(performance.now());
  });
}
