import { NS, EASE } from '@svg-icons';

// ── Cube geometry ──
const CV = [
  [-1,-1, 1],[ 1,-1, 1],[ 1, 1, 1],[-1, 1, 1],  // front
  [-1,-1,-1],[ 1,-1,-1],[ 1, 1,-1],[-1, 1,-1],  // back
];

// Faces: vertex indices (CCW from outside), outward normal, die face number
// Opposite faces sum to 7: 1/6, 2/5, 3/4
const CF = [
  { vi:[0,1,2,3], n:[ 0, 0, 1], die:1 },
  { vi:[5,4,7,6], n:[ 0, 0,-1], die:6 },
  { vi:[1,5,6,2], n:[ 1, 0, 0], die:3 },
  { vi:[4,0,3,7], n:[-1, 0, 0], die:4 },
  { vi:[4,5,1,0], n:[ 0,-1, 0], die:2 },
  { vi:[3,2,6,7], n:[ 0, 1, 0], die:5 },
];

// Pip UV positions per die face
const PUV = {
  1: [[.5,.5]],
  2: [[.28,.28],[.72,.72]],
  3: [[.28,.28],[.5,.5],[.72,.72]],
  4: [[.28,.28],[.72,.28],[.28,.72],[.72,.72]],
  5: [[.28,.28],[.72,.28],[.5,.5],[.28,.72],[.72,.72]],
  6: [[.28,.28],[.72,.28],[.28,.5],[.72,.5],[.28,.72],[.72,.72]],
};

// ── 3x3 matrix math ──
const mmul = (A, B) => {
  const R = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++)
        R[i][j] += A[i][k] * B[k][j];
  return R;
};
const mv = (M, v) => [
  M[0][0]*v[0] + M[0][1]*v[1] + M[0][2]*v[2],
  M[1][0]*v[0] + M[1][1]*v[1] + M[1][2]*v[2],
  M[2][0]*v[0] + M[2][1]*v[1] + M[2][2]*v[2],
];
const mRx = a => { const c = Math.cos(a), s = Math.sin(a); return [[1,0,0],[0,c,-s],[0,s,c]]; };
const mRy = a => { const c = Math.cos(a), s = Math.sin(a); return [[c,0,s],[0,1,0],[-s,0,c]]; };
const I3 = [[1,0,0],[0,1,0],[0,0,1]];

// ── Perspective ──
const CDIST = 4.8, SC = 5.2;
const proj = v => {
  const s = CDIST / (CDIST - v[2]);
  return [12 + v[0] * s * SC, 12 + v[1] * s * SC];
};
const bilerp = (a, b, c, d, u, v) => [
  a[0]*(1-u)*(1-v) + b[0]*u*(1-v) + c[0]*u*v + d[0]*(1-u)*v,
  a[1]*(1-u)*(1-v) + b[1]*u*(1-v) + c[1]*u*v + d[1]*(1-u)*v,
  a[2]*(1-u)*(1-v) + b[2]*u*(1-v) + c[2]*u*v + d[2]*(1-u)*v,
];

const VIEW = mmul(mRx(-0.35), mRy(0.45));

/**
 * Create a 3D die renderer on an SVG element.
 * @param {SVGSVGElement} svg
 * @param {object} options
 * @param {boolean} [options.carved=false] - V2 carved pips (dark fill + bevel stroke)
 * @param {number} [options.strokeWidth=0.4] - Edge stroke width
 * @param {number} [options.pipRadius=0.55] - Pip perspective radius multiplier
 * @returns {{ renderCube, frontFace, findRotTo, animRot, roll, bindControls }}
 */
export function createDie3D(svg, options = {}) {
  const carved = options.carved || false;
  const edgeSW = options.strokeWidth || (carved ? 0.8 : 0.4);
  const pipRM = options.pipRadius || (carved ? 0.65 : 0.55);

  svg.innerHTML = '';

  // Face polygons (3 visible max)
  const faceEls = [];
  for (let i = 0; i < 3; i++) {
    const el = document.createElementNS(NS, 'path');
    el.setAttribute('stroke', 'currentColor');
    el.setAttribute('stroke-width', String(edgeSW));
    el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('opacity', '0');
    svg.appendChild(el);
    faceEls.push(el);
  }

  // Pip circles
  const pipEls = [];
  for (let i = 0; i < 18; i++) {
    const el = document.createElementNS(NS, 'circle');
    if (!carved) el.setAttribute('fill', 'currentColor');
    el.setAttribute('r', '0');
    svg.appendChild(el);
    pipEls.push(el);
  }

  let orient = I3.map(r => [...r]);

  function renderCube(mat) {
    const rv = CV.map(v => mv(mat, v));
    const vis = [];
    for (const f of CF) {
      const rn = mv(mat, f.n);
      if (rn[2] > 0.01) {
        const avgZ = f.vi.reduce((s, i) => s + rv[i][2], 0) / 4;
        vis.push({ ...f, rn, avgZ });
      }
    }
    vis.sort((a, b) => a.avgZ - b.avgZ);

    for (const el of faceEls) el.setAttribute('opacity', '0');
    for (const el of pipEls) { el.setAttribute('r', '0'); el.setAttribute('opacity', '0'); }

    let pi = 0;
    for (let fi = 0; fi < vis.length && fi < 3; fi++) {
      const f = vis[fi];
      const pts = f.vi.map(i => proj(rv[i]));

      faceEls[fi].setAttribute('d',
        `M${pts[0][0]} ${pts[0][1]}L${pts[1][0]} ${pts[1][1]}L${pts[2][0]} ${pts[2][1]}L${pts[3][0]} ${pts[3][1]}Z`);
      const bright = Math.round(Math.max(16, f.rn[2] * 36));
      faceEls[fi].setAttribute('fill', `rgb(${bright},${bright},${bright})`);
      faceEls[fi].setAttribute('stroke-opacity', carved ? '0.5' : '0.4');
      faceEls[fi].setAttribute('opacity', '1');

      const fv = f.vi.map(i => rv[i]);
      const pipR = (CDIST / (CDIST - f.avgZ)) * pipRM;
      for (const [u, v] of PUV[f.die]) {
        if (pi >= pipEls.length) break;
        const p3 = bilerp(fv[0], fv[1], fv[2], fv[3], u, v);
        const [px, py] = proj(p3);
        pipEls[pi].setAttribute('cx', px);
        pipEls[pi].setAttribute('cy', py);
        pipEls[pi].setAttribute('r', pipR);

        if (carved) {
          const pipFill = Math.round(bright * 0.3);
          const pipStroke = Math.min(255, Math.round(bright * 1.3));
          pipEls[pi].setAttribute('fill', `rgb(${pipFill},${pipFill},${pipFill})`);
          pipEls[pi].setAttribute('stroke', `rgb(${pipStroke},${pipStroke},${pipStroke})`);
          pipEls[pi].setAttribute('stroke-width', '0.3');
        }

        pipEls[pi].setAttribute('opacity', '0.9');
        pi++;
      }
    }

    for (const el of faceEls) svg.appendChild(el);
    for (const el of pipEls) svg.appendChild(el);
  }

  function frontFace(mat) {
    let best = -Infinity, f = 1;
    for (const cf of CF) {
      const z = mv(mat, cf.n)[2];
      if (z > best) { best = z; f = cf.die; }
    }
    return f;
  }

  function findRotTo(target) {
    const tries = [
      ['X', Math.PI / 2], ['X', -Math.PI / 2], ['X', Math.PI],
      ['Y', Math.PI / 2], ['Y', -Math.PI / 2], ['Y', Math.PI],
    ];
    for (const [axis, angle] of tries) {
      const rot = axis === 'X' ? mRx(angle) : mRy(angle);
      if (frontFace(mmul(VIEW, mmul(rot, orient))) === target) {
        return { axis, angle };
      }
    }
    return null;
  }

  function animRot(axis, angle, dur) {
    return new Promise(resolve => {
      const base = orient.map(r => [...r]);
      const t0 = performance.now();
      (function tick(now) {
        const raw = Math.min((now - t0) / dur, 1);
        const t = EASE(raw);
        const rot = axis === 'X' ? mRx(angle * t) : mRy(angle * t);
        renderCube(mmul(VIEW, mmul(rot, base)));
        if (raw < 1) requestAnimationFrame(tick);
        else {
          orient = mmul(axis === 'X' ? mRx(angle) : mRy(angle), base);
          resolve();
        }
      })(performance.now());
    });
  }

  // Initial render
  renderCube(mmul(VIEW, orient));

  /**
   * Bind die controls and click-to-roll.
   * @param {HTMLElement} stage - clickable stage element
   * @param {object} ids - { dur, durVal, tumbles, tumblesVal, loop }
   */
  function bindControls(stage, ids) {
    let rolling = false, loopTimer = null;
    const durSlider = document.getElementById(ids.dur);
    const durVal = document.getElementById(ids.durVal);
    const tumblesSlider = document.getElementById(ids.tumbles);
    const tumblesVal = document.getElementById(ids.tumblesVal);
    const loopCheck = document.getElementById(ids.loop);

    durSlider.addEventListener('input', () => { durVal.textContent = durSlider.value + 'ms'; });
    tumblesSlider.addEventListener('input', () => { tumblesVal.textContent = tumblesSlider.value; });

    async function roll() {
      if (rolling) return;
      rolling = true;

      const duration = parseInt(durSlider.value);
      const tumbles = parseInt(tumblesSlider.value);
      const curFace = frontFace(mmul(VIEW, orient));

      let target;
      do { target = Math.floor(Math.random() * 6) + 1; } while (target === curFace);

      const phases = tumbles + 1;
      const phaseTime = duration / phases;

      for (let i = 0; i < tumbles; i++) {
        const axis = Math.random() < 0.5 ? 'X' : 'Y';
        const dir = Math.random() < 0.5 ? 1 : -1;
        await animRot(axis, dir * Math.PI / 2, Math.max(phaseTime, 50));
      }

      const r = findRotTo(target);
      if (r) {
        if (Math.abs(r.angle) > Math.PI / 2 + 0.1) {
          await animRot(r.axis, r.angle / 2, Math.max(phaseTime / 2, 40));
          await animRot(r.axis, r.angle / 2, Math.max(phaseTime / 2, 40));
        } else {
          await animRot(r.axis, r.angle, Math.max(phaseTime, 50));
        }
      }

      rolling = false;
      if (loopCheck.checked) loopTimer = setTimeout(roll, 200);
    }

    stage.addEventListener('click', roll);

    loopCheck.addEventListener('change', () => {
      if (loopCheck.checked) roll();
      else if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
    });
  }

  return { renderCube, frontFace, findRotTo, animRot, bindControls };
}
