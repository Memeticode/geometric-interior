import {
  DURATION, EASE,
  buildMorphSVG, applyState, setState, lerpColor,
  COL, STATES, STATE_GROUPS,
  convergeState, dissipateState,
} from '@svg-icons';

const browser = document.getElementById('browser');
const STAGE_SIZE = 48;

function colFor(key) {
  if (key === 'dots' || key === 'cross') return COL.def;
  if (key === 'void') return COL.void_;
  return COL[key];
}

// ── Animation helpers ──

function modEl(elMap, state, key, mod) {
  const baseO = state[key]?.o;
  if (baseO > 0) elMap[key].setAttribute('opacity', baseO * mod);
}

function modAllOpacity(elMap, state, mod) {
  for (let i = 1; i <= 8; i++) modEl(elMap, state, 'L' + i, mod);
  for (let i = 1; i <= 7; i++) modEl(elMap, state, 'C' + i, mod);
  modEl(elMap, state, 'P1', mod);
}

function modCircleR(elMap, state, key, mod) {
  const baseR = state[key]?.r;
  if (baseR > 0) elMap[key].setAttribute('r', baseR * mod);
}

function modLineSW(elMap, state, key, mod) {
  const baseSW = state[key]?.sw;
  if (baseSW > 0) elMap[key].setAttribute('stroke-width', baseSW * mod);
}

function resetAnim(elMap, state) {
  for (let i = 1; i <= 8; i++) {
    const s = state['L' + i];
    if (s?.o !== undefined) elMap['L' + i].setAttribute('opacity', s.o);
    if (s?.sw !== undefined) elMap['L' + i].setAttribute('stroke-width', s.sw);
  }
  for (let i = 1; i <= 7; i++) {
    const s = state['C' + i];
    if (s?.o !== undefined) elMap['C' + i].setAttribute('opacity', s.o);
    if (s?.r !== undefined) elMap['C' + i].setAttribute('r', s.r);
  }
  if (state.P1?.o !== undefined) elMap.P1.setAttribute('opacity', state.P1.o);
  if (state.P1?.sw !== undefined) elMap.P1.setAttribute('stroke-width', state.P1.sw);
  if (state.P1?.r !== undefined) elMap.P1.setAttribute('r', state.P1.r);
}

// ── Custom animation definitions ──

const ICON_INFO = {
  // ── Alien ──
  array: {
    desc: 'crumbling glyphs',
    // Base path coords for physical drift
    _paths: {
      L1: { x1: 5, y1: 4, qx: 8, qy: 6, x2: 11, y2: 5 },
      L2: { x1: 14, y1: 3, qx: 16, qy: 7, x2: 19, y2: 6 },
      L3: { x1: 3, y1: 10, qx: 7, qy: 14, x2: 10, y2: 13 },
      L4: { x1: 15, y1: 11, qx: 17, qy: 15, x2: 20, y2: 14 },
      L5: { x1: 6, y1: 17, qx: 8, qy: 18, x2: 10, y2: 19 },
      L6: { x1: 13, y1: 17, qx: 15.5, qy: 18.5, x2: 18, y2: 20 },
      L7: { x1: 8, y1: 8, qx: 11, qy: 9, x2: 14, y2: 10 },
      L8: { x1: 11, y1: 15, qx: 13.5, qy: 16, x2: 16, y2: 17 },
    },
    _nodes: [
      [12, 12], [5, 4], [19, 6], [3, 10], [20, 14], [10, 19], [18, 20],
    ],
    anim: (elMap, state, now) => {
      const info = ICON_INFO.array;
      // Each path drifts independently — slow wandering like crumbling stone
      for (let i = 1; i <= 8; i++) {
        const p = info._paths['L' + i];
        // Two perpendicular drift axes per element, long periods
        const px = 7000 + i * 1300;
        const py = 8500 + i * 900;
        const dx = Math.sin(now / px * Math.PI * 2 + i * 2.1) * 1.5;
        const dy = Math.sin(now / py * Math.PI * 2 + i * 0.7) * 1.2;
        // Also subtle rotation per fragment
        const ra = Math.sin(now / (10000 + i * 1500) * Math.PI * 2 + i) * 0.15;
        const cos = Math.cos(ra), sin = Math.sin(ra);
        // Midpoint of the path for rotation pivot
        const mx = (p.x1 + p.x2) / 2, my = (p.y1 + p.y2) / 2;
        const rotD = (x, y) => [mx + (x - mx) * cos - (y - my) * sin + dx, my + (x - mx) * sin + (y - my) * cos + dy];
        const [x1, y1] = rotD(p.x1, p.y1);
        const [qx, qy] = rotD(p.qx, p.qy);
        const [x2, y2] = rotD(p.x2, p.y2);
        elMap['L' + i].setAttribute('d', `M${x1} ${y1}Q${qx} ${qy} ${x2} ${y2}`);
        // Opacity drift + sw fluctuation
        const period = 4000 + i * 700;
        const drift = Math.sin(now / period * Math.PI * 2 + i * 1.7) * 0.5 + 0.5;
        modEl(elMap, state, 'L' + i, 0.3 + 0.7 * drift);
        modLineSW(elMap, state, 'L' + i, 0.5 + 0.8 * drift);
      }
      // Nodes wander independently
      const nodes = info._nodes;
      for (let i = 0; i < nodes.length; i++) {
        const [bx, by] = nodes[i];
        const key = 'C' + (i + 1);
        const ndx = Math.sin(now / (6000 + i * 1400) * Math.PI * 2 + i * 3.1) * 1.8;
        const ndy = Math.sin(now / (7500 + i * 1000) * Math.PI * 2 + i * 1.9) * 1.4;
        elMap[key].setAttribute('cx', bx + ndx);
        elMap[key].setAttribute('cy', by + ndy);
        // Opacity + radius drift
        const s = Math.sin(now / (5000 + i * 900) * Math.PI * 2 + i * 2.3) * 0.5 + 0.5;
        modEl(elMap, state, key, 0.2 + 0.7 * s);
        modCircleR(elMap, state, key, 0.5 + 0.7 * s);
      }
      // P1 ring drifts slowly
      const baseR = state.P1?.r ?? 9;
      const rd = Math.sin(now / 9000 * Math.PI * 2) * 0.5 + 0.5;
      if (state.P1?.o > 0) {
        elMap.P1.setAttribute('r', baseR * (0.88 + 0.18 * rd));
        elMap.P1.setAttribute('stroke-width', (state.P1.sw ?? 0.5) * (0.5 + 0.8 * rd));
      }
    },
  },
  beacon: {
    desc: 'signal broadcast',
    anim: (elMap, state, now) => {
      // Broadcast: arms brighten in staggered wave, tips swell, ring breathes
      const phase = (now % 2500) / 2500 * Math.PI * 2;
      for (let i = 1; i <= 3; i++) {
        const offset = (i - 1) / 3 * Math.PI * 2;
        const m = 0.3 + 0.7 * Math.max(0, Math.cos(phase - offset));
        modEl(elMap, state, 'L' + i, m);
        modLineSW(elMap, state, 'L' + i, 0.7 + 0.5 * m);
      }
      // Tip nodes C2-C4 swell when their arm brightens
      for (let i = 2; i <= 4; i++) {
        const offset = (i - 2) / 3 * Math.PI * 2;
        const m = Math.max(0, Math.cos(phase - offset));
        modCircleR(elMap, state, 'C' + i, 0.8 + 0.4 * m);
      }
      // Ring breathes
      const baseSW = state.P1?.sw ?? 0.75;
      const breath = Math.sin(now / 3000 * Math.PI * 2) * 0.5 + 0.5;
      if (state.P1?.o > 0) elMap.P1.setAttribute('stroke-width', baseSW * (0.6 + 0.8 * breath));
    },
  },
  bloom: {
    desc: 'organic expansion',
    anim: (elMap, state, now) => {
      // Breathe: petals phase-offset, center swells, ring oscillates
      for (let i = 1; i <= 4; i++) {
        const phase = now / 2500 * Math.PI * 2 + (i - 1) * Math.PI / 2;
        const m = 0.4 + 0.6 * (Math.sin(phase) * 0.5 + 0.5);
        modEl(elMap, state, 'L' + i, m);
        modLineSW(elMap, state, 'L' + i, 0.8 + 0.4 * m);
      }
      // Petal tip nodes C2-C5 swell with their petal
      for (let i = 2; i <= 5; i++) {
        const phase = now / 2500 * Math.PI * 2 + (i - 2) * Math.PI / 2;
        const m = Math.sin(phase) * 0.5 + 0.5;
        modCircleR(elMap, state, 'C' + i, 0.8 + 0.4 * m);
      }
      // Center C1 slowly breathes
      const cb = Math.sin(now / 5000 * Math.PI * 2) * 0.5 + 0.5;
      modCircleR(elMap, state, 'C1', 0.85 + 0.3 * cb);
      // Ring sw oscillates
      const baseSW = state.P1?.sw ?? 0.75;
      if (state.P1?.o > 0) elMap.P1.setAttribute('stroke-width', baseSW * (0.7 + 0.6 * cb));
    },
  },
  cross: {
    desc: 'negation mark',
    // Arm endpoints: L1(up 12,4→12,12), L2(down 12,12→12,20), L3(left 4,12→12,12), L4(right 12,12→20,12)
    // Tip nodes: C1(12,4), C2(12,20), C3(4,12), C4(20,12)
    anim: (elMap, state, now) => {
      // Flash strobe
      const t = (now % 3000) / 3000;
      let flash = 0;
      if (t < 0.025) flash = Math.sin(t / 0.025 * Math.PI);
      const m = 0.55 + 0.45 * flash;
      modAllOpacity(elMap, state, m);
      // Arms extend outward on flash: tips push further from center
      const extend = 1 + 0.35 * flash;
      // L1: up arm — endpoint y moves from 4 toward further out
      const tipUp = 12 - (12 - 4) * extend;
      elMap.L1.setAttribute('d', `M12 ${tipUp}Q12 ${(tipUp + 12) / 2} 12 12`);
      elMap.C1.setAttribute('cy', tipUp);
      // L2: down arm
      const tipDown = 12 + (20 - 12) * extend;
      elMap.L2.setAttribute('d', `M12 12Q12 ${(12 + tipDown) / 2} 12 ${tipDown}`);
      elMap.C2.setAttribute('cy', tipDown);
      // L3: left arm
      const tipLeft = 12 - (12 - 4) * extend;
      elMap.L3.setAttribute('d', `M${tipLeft} 12Q${(tipLeft + 12) / 2} 12 12 12`);
      elMap.C3.setAttribute('cx', tipLeft);
      // L4: right arm
      const tipRight = 12 + (20 - 12) * extend;
      elMap.L4.setAttribute('d', `M12 12Q${(12 + tipRight) / 2} 12 ${tipRight} 12`);
      elMap.C4.setAttribute('cx', tipRight);
      // SW spikes on flash
      const swM = 1 + 0.6 * flash;
      for (let i = 1; i <= 4; i++) modLineSW(elMap, state, 'L' + i, swM);
      // Center + tip nodes swell on flash
      modCircleR(elMap, state, 'C5', 1 + 0.5 * flash);
      for (let i = 1; i <= 4; i++) modCircleR(elMap, state, 'C' + i, 1 + 0.3 * flash);
      // Subtle idle breathing between flashes
      const idle = Math.sin(now / 4000 * Math.PI * 2) * 0.5 + 0.5;
      modCircleR(elMap, state, 'C5', (1 + 0.5 * flash) * (0.9 + 0.15 * idle));
    },
  },
  dots: {
    desc: 'particle constellation',
    anim: (elMap, state, now) => {
      // Constellation: each circle twinkles + radii breathe independently
      for (let i = 1; i <= 5; i++) {
        const rate = 1500 + i * 400;
        const s = Math.sin(now / rate * Math.PI * 2 + i * 1.7) * 0.5 + 0.5;
        modEl(elMap, state, 'C' + i, 0.25 + 0.75 * s);
        modCircleR(elMap, state, 'C' + i, 0.7 + 0.5 * s);
      }
      // Ring sw breathes on slow cycle
      const baseSW = state.P1?.sw ?? 0.75;
      const b = Math.sin(now / 4000 * Math.PI * 2) * 0.5 + 0.5;
      if (state.P1?.o > 0) elMap.P1.setAttribute('stroke-width', baseSW * (0.6 + 0.8 * b));
    },
  },
  fracture: {
    desc: 'shattered form',
    anim: (elMap, state, now) => {
      // Drift: fragments float independently, sw fluctuates like stress
      for (let i = 1; i <= 8; i++) {
        const period = 4000 + i * 600;
        const phase = i * 1.3;
        const s = Math.sin(now / period * Math.PI * 2 + phase) * 0.5 + 0.5;
        modEl(elMap, state, 'L' + i, 0.3 + 0.7 * s);
        modLineSW(elMap, state, 'L' + i, 0.6 + 0.6 * s);
      }
      for (let i = 1; i <= 5; i++) {
        const period = 6000 + i * 800;
        const phase = i * 2.1;
        const s = Math.sin(now / period * Math.PI * 2 + phase) * 0.5 + 0.5;
        modEl(elMap, state, 'C' + i, 0.25 + 0.75 * s);
        modCircleR(elMap, state, 'C' + i, 0.6 + 0.6 * s);
      }
      // P1 ring radius drifts
      const baseR = state.P1?.r ?? 7;
      const rd = Math.sin(now / 8000 * Math.PI * 2) * 0.5 + 0.5;
      if (state.P1?.o > 0) elMap.P1.setAttribute('r', baseR * (0.85 + 0.3 * rd));
    },
  },
  glyph: {
    desc: 'etched symbol',
    anim: (elMap, state, now) => {
      // Trace: edges reveal with sw growth, nodes swell, hold, fade
      const cycle = 4000;
      const t = (now % cycle) / cycle;
      const edgePhase = 0.45;
      const nodePhase = 0.2;
      const holdEnd = 0.8;
      for (let i = 1; i <= 5; i++) {
        const start = ((i - 1) / 5) * edgePhase;
        const end = start + edgePhase / 5;
        let m;
        if (t < start) m = 0.08;
        else if (t < end) m = 0.08 + 0.92 * ((t - start) / (end - start));
        else if (t < holdEnd) m = 1;
        else m = Math.max(0.08, 1 - (t - holdEnd) / (1 - holdEnd));
        modEl(elMap, state, 'L' + i, m);
        modLineSW(elMap, state, 'L' + i, 0.5 + 0.7 * m);
      }
      for (let i = 1; i <= 5; i++) {
        const start = edgePhase + ((i - 1) / 5) * nodePhase;
        const end = start + nodePhase / 5;
        let m;
        if (t < start) m = 0.05;
        else if (t < end) m = 0.05 + 0.95 * ((t - start) / (end - start));
        else if (t < holdEnd) m = 1;
        else m = Math.max(0.05, 1 - (t - holdEnd) / (1 - holdEnd));
        modEl(elMap, state, 'C' + i, m);
        modCircleR(elMap, state, 'C' + i, 0.4 + 0.8 * m);
      }
      // Guide lines L6-L8 glow + thicken during hold
      const guideM = t > edgePhase + nodePhase && t < holdEnd ? 0.35 : 0.08;
      for (let i = 6; i <= 8; i++) {
        modEl(elMap, state, 'L' + i, guideM);
        modLineSW(elMap, state, 'L' + i, 0.5 + 1.5 * guideM);
      }
      // P1 sw pulses during hold
      const baseSW = state.P1?.sw ?? 0.75;
      const holdActive = t > edgePhase + nodePhase && t < holdEnd;
      if (state.P1?.o > 0) elMap.P1.setAttribute('stroke-width', baseSW * (holdActive ? 1.3 : 0.8));
    },
  },
  hex: {
    desc: 'crystalline lattice',
    // Hex vertex coords (center = 12,12)
    _verts: [[12,4],[18.93,8],[18.93,16],[12,20],[5.07,16],[5.07,8]],
    anim: (elMap, state, now) => {
      const info = ICON_INFO.hex;
      const verts = info._verts;
      // Irregular squelching pulse — overlapping sines, mostly expanded
      const s1 = Math.sin(now / 2700 * Math.PI * 2);
      const s2 = Math.sin(now / 4300 * Math.PI * 2) * 0.6;
      const s3 = Math.sin(now / 1100 * Math.PI * 2) * 0.15;
      const raw = (s1 + s2 + s3) / 1.75; // range ~[-1, 1]
      const scale = 1.06 + 0.12 * raw; // mostly bigger (0.94–1.18), centered above 1
      // Scale vertices from center and rebuild edge paths
      const sv = verts.map(([x, y]) => [12 + (x - 12) * scale, 12 + (y - 12) * scale]);
      for (let i = 0; i < 6; i++) {
        const [x1, y1] = sv[i];
        const [x2, y2] = sv[(i + 1) % 6];
        const qx = (x1 + x2) / 2, qy = (y1 + y2) / 2;
        elMap['L' + (i + 1)].setAttribute('d', `M${x1} ${y1}Q${qx} ${qy} ${x2} ${y2}`);
      }
      // Diagonal braces L7-L8 scale too
      const [x7a, y7a] = sv[5]; const [x7b, y7b] = sv[2];
      elMap.L7.setAttribute('d', `M${x7a} ${y7a}Q${(x7a+x7b)/2} ${(y7a+y7b)/2} ${x7b} ${y7b}`);
      const [x8a, y8a] = sv[1]; const [x8b, y8b] = sv[4];
      elMap.L8.setAttribute('d', `M${x8a} ${y8a}Q${(x8a+x8b)/2} ${(y8a+y8b)/2} ${x8b} ${y8b}`);
      // Corner nodes move with vertices
      for (let i = 0; i < 6; i++) {
        const key = 'C' + (i + 2);
        elMap[key].setAttribute('cx', sv[i][0]);
        elMap[key].setAttribute('cy', sv[i][1]);
      }
      // Subtle opacity hum synced with expansion
      const oM = 0.75 + 0.25 * raw;
      for (let i = 1; i <= 6; i++) modEl(elMap, state, 'L' + i, oM);
      for (let i = 2; i <= 7; i++) modEl(elMap, state, 'C' + i, oM);
      // P1 ring radius follows the scale
      const baseR = state.P1?.r ?? 3;
      if (state.P1?.o > 0) elMap.P1.setAttribute('r', baseR * scale);
    },
  },
  orbit: {
    desc: 'celestial path',
    anim: (elMap, state, now) => {
      // Orbital trails: highlight sweeps through paths, satellites swell at position
      const cycle = 4000;
      const phase = (now % cycle) / cycle;
      for (let i = 1; i <= 6; i++) {
        const pos = (i - 1) / 6;
        const dist = ((phase - pos) + 1) % 1;
        const m = 0.15 + 0.85 * Math.max(0, 1 - dist * 3);
        modEl(elMap, state, 'L' + i, m);
        modLineSW(elMap, state, 'L' + i, 0.6 + 0.8 * m);
      }
      for (let i = 2; i <= 4; i++) {
        const satPos = (i - 1) / 4;
        const dist = Math.abs(((phase - satPos) + 1.5) % 1 - 0.5);
        const m = 0.2 + 0.8 * Math.max(0, 1 - dist * 5);
        modEl(elMap, state, 'C' + i, m);
        modCircleR(elMap, state, 'C' + i, 0.6 + 0.8 * m);
      }
      // Center body slow pulse + radius swell
      const cb = Math.sin(now / 3000 * Math.PI * 2) * 0.5 + 0.5;
      modEl(elMap, state, 'C1', 0.6 + 0.4 * cb);
      modCircleR(elMap, state, 'C1', 0.85 + 0.3 * cb);
    },
  },
  pulse: {
    desc: 'crystalline dissolution',
    // Base debris shard coords for physical drift
    _paths: {
      L6: { x1: 3, y1: 14, x2: 2, y2: 11 },
      L7: { x1: 21, y1: 13, x2: 22.5, y2: 10 },
      L8: { x1: 14, y1: 22, x2: 16, y2: 23.5 },
    },
    anim: (elMap, state, now) => {
      const info = ICON_INFO.pulse;
      // Intact edges L1-L3: phase-offset squelch (organic, not in unison)
      const s1base = Math.sin(now / 3200 * Math.PI * 2);
      const s2base = Math.sin(now / 5100 * Math.PI * 2) * 0.5;
      const intactPulse = (s1base + s2base) / 1.5; // keep for P1 ring
      const edgePulses = [];
      for (let i = 1; i <= 3; i++) {
        const phaseOff = (i - 1) * 0.4;
        const s1i = Math.sin(now / 3200 * Math.PI * 2 + phaseOff);
        const s2i = Math.sin(now / 5100 * Math.PI * 2 + phaseOff * 1.3) * 0.5;
        const iPulse = (s1i + s2i) / 1.5;
        edgePulses.push(iPulse);
        const iM = 0.7 + 0.3 * iPulse;
        modEl(elMap, state, 'L' + i, iM);
        modLineSW(elMap, state, 'L' + i, 0.6 + 0.8 * iM);
      }
      // Displaced edges L4-L5: slow independent drift
      for (let i = 4; i <= 5; i++) {
        const period = 4500 + i * 700;
        const drift = Math.sin(now / period * Math.PI * 2 + i * 1.8) * 0.5 + 0.5;
        modEl(elMap, state, 'L' + i, 0.25 + 0.6 * drift);
        modLineSW(elMap, state, 'L' + i, 0.5 + 0.8 * drift);
      }
      // Debris shards L6-L8: physical outward drift + opacity
      for (let i = 6; i <= 8; i++) {
        const p = info._paths['L' + i];
        const mx = (p.x1 + p.x2) / 2, my = (p.y1 + p.y2) / 2;
        // Direction away from center (12,12)
        const dx = mx - 12, dy = my - 12;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / len, ny = dy / len;
        // Slow outward drift
        const driftPos = Math.sin(now / (5000 + i * 800) * Math.PI * 2 + i * 1.5) * 0.5 + 0.5;
        const offset = driftPos * 1.5;
        const ox = nx * offset, oy = ny * offset;
        const x1 = p.x1 + ox, y1 = p.y1 + oy;
        const x2 = p.x2 + ox, y2 = p.y2 + oy;
        elMap['L' + i].setAttribute('d', `M${x1} ${y1}Q${(x1+x2)/2} ${(y1+y2)/2} ${x2} ${y2}`);
        // Opacity/sw drift
        const period = 3000 + i * 500;
        const driftO = Math.sin(now / period * Math.PI * 2 + i * 2.5) * 0.5 + 0.5;
        modEl(elMap, state, 'L' + i, 0.15 + 0.7 * driftO);
        modLineSW(elMap, state, 'L' + i, 0.4 + 0.9 * driftO);
      }
      // Stress points C1-C3: flicker + strain response from nearby edges
      for (let i = 1; i <= 3; i++) {
        const flicker = Math.sin(now / (1800 + i * 600) * Math.PI * 2 + i * 2.7) * 0.5 + 0.5;
        const strain = Math.max(0, -edgePulses[i - 1]); // flare at peak compression
        const combined = Math.min(1, 0.2 + 0.5 * flicker + 0.6 * strain);
        modEl(elMap, state, 'C' + i, combined);
      }
      // Break points C4-C5 pulse dimly
      for (let i = 4; i <= 5; i++) {
        const d = Math.sin(now / (4000 + i * 500) * Math.PI * 2 + i * 1.3) * 0.5 + 0.5;
        modEl(elMap, state, 'C' + i, 0.1 + 0.5 * d);
      }
      // P1 ring breathes with overall structure pulse
      const baseR = state.P1?.r ?? 7;
      const baseSW = state.P1?.sw ?? 0.75;
      const intactM = 0.7 + 0.3 * intactPulse;
      if (state.P1?.o > 0) {
        elMap.P1.setAttribute('r', baseR * (0.92 + 0.12 * intactPulse));
        elMap.P1.setAttribute('stroke-width', baseSW * (0.5 + 0.5 * intactM));
      }
    },
  },
  seer: {
    desc: 'omniscient gaze',
    // Base lid curve control points: [qy_open, qy_closed] for upper/lower
    // Upper lids L1,L2: qy=4 open, qy=12 closed (move down to center)
    // Lower lids L3,L4: qy=20 open, qy=12 closed (move up to center)
    // Inner upper L5,L6: qy=8 open, qy=12 closed
    // Inner lower L7,L8: qy=16 open, qy=12 closed
    anim: (elMap, state, now) => {
      // Irregular blink timing — two overlapping slow cycles create aperiodic blinks
      const b1 = Math.sin(now / 4700 * Math.PI * 2);
      const b2 = Math.sin(now / 3100 * Math.PI * 2);
      const blinkTrigger = b1 + b2; // blink when both align negative (range -2 to 2)
      // Blink closure amount: 0 = open, 1 = fully closed
      let closure = 0;
      if (blinkTrigger < -1.4) {
        closure = Math.min(1, (-1.4 - blinkTrigger) / 0.4); // ramp to closed
      }
      // Physically move lid curves toward center (y=12) during blink
      // Upper lids: qy lerps from open position toward 12
      const uOuter = 4 + closure * 8;   // 4 → 12
      const uInner = 8 + closure * 4;   // 8 → 12
      const lOuter = 20 - closure * 8;  // 20 → 12
      const lInner = 16 - closure * 4;  // 16 → 12
      // Also move endpoints toward center: upper apex y lerps 5→12, lower 19→12
      const uApexY = 5 + closure * 7;
      const lApexY = 19 - closure * 7;
      const uIrisY = 8 + closure * 4;
      const lIrisY = 16 - closure * 4;
      // Rebuild outer lid paths with moved control points
      elMap.L1.setAttribute('d', `M3 12Q6 ${uOuter} 12 ${uApexY}`);
      elMap.L2.setAttribute('d', `M12 ${uApexY}Q18 ${uOuter} 21 12`);
      elMap.L3.setAttribute('d', `M3 12Q6 ${lOuter} 12 ${lApexY}`);
      elMap.L4.setAttribute('d', `M12 ${lApexY}Q18 ${lOuter} 21 12`);
      // Rebuild inner iris paths
      elMap.L5.setAttribute('d', `M7 12Q9 ${uIrisY} 12 ${uIrisY}`);
      elMap.L6.setAttribute('d', `M12 ${uIrisY}Q15 ${uIrisY} 17 12`);
      elMap.L7.setAttribute('d', `M7 12Q9 ${lIrisY} 12 ${lIrisY}`);
      elMap.L8.setAttribute('d', `M12 ${lIrisY}Q15 ${lIrisY} 17 12`);
      // Move apex nodes toward center during blink
      elMap.C4.setAttribute('cy', uApexY);
      elMap.C5.setAttribute('cy', lApexY);
      // Opacity dims slightly during blink
      const oM = 1 - closure * 0.3;
      for (let i = 1; i <= 4; i++) {
        modEl(elMap, state, 'L' + i, oM);
        modLineSW(elMap, state, 'L' + i, 0.7 + 0.5 * oM);
      }
      for (let i = 5; i <= 8; i++) {
        modEl(elMap, state, 'L' + i, oM * 0.9);
        modLineSW(elMap, state, 'L' + i, 0.6 + 0.6 * oM);
      }
      // Pupil C1 contracts and fades during blink — fully hidden when closed
      modCircleR(elMap, state, 'C1', Math.max(0.01, 1 - closure));
      modEl(elMap, state, 'C1', Math.max(0.01, 1 - closure));
      // Between blinks: iris P1 ring radius breathes
      const irisBreath = Math.sin(now / 3500 * Math.PI * 2) * 0.5 + 0.5;
      const baseR = state.P1?.r ?? 4.5;
      if (state.P1?.o > 0) elMap.P1.setAttribute('r', baseR * (0.85 + 0.3 * irisBreath));
      // Corner nodes C2-C3 gently pulse
      const cornerM = 0.7 + 0.3 * (Math.sin(now / 2800 * Math.PI * 2) * 0.5 + 0.5);
      modEl(elMap, state, 'C2', cornerM);
      modEl(elMap, state, 'C3', cornerM);
      modCircleR(elMap, state, 'C2', 0.8 + 0.4 * cornerM);
      modCircleR(elMap, state, 'C3', 0.8 + 0.4 * cornerM);
    },
  },
  sigil: {
    desc: 'arcane inscription',
    // Pentagram edge order: L1(top→BR), L2(BR→UL), L3(UL→UR), L4(UR→BL), L5(BL→top)
    // Vertex coords in edge traversal order: top, BR, UL, UR, BL
    _edgeNodeOrder: [1, 3, 5, 2, 4], // node index hit after each edge
    _verts: [[12, 4], [16.7, 18.5], [4.4, 9.5], [19.6, 9.5], [7.3, 18.5]],
    anim: (elMap, state, now) => {
      const cycle = 2000; // faster ball
      const t = (now % cycle) / cycle;
      const headPos = t * 5;
      const tailLen = 4;
      const nodeOrder = ICON_INFO.sigil._edgeNodeOrder;
      const verts = ICON_INFO.sigil._verts;
      // Completion-based edge lighting: edge stays dim while ball traverses it,
      // lights up only after ball reaches the far vertex
      const currentEdge = Math.floor(headPos) % 5;
      for (let i = 1; i <= 5; i++) {
        const edgeComplete = i; // edge i completes at position i
        const onThisEdge = currentEdge === (i - 1);
        let m;
        if (onThisEdge) {
          m = 0.1; // ball is traversing — stay dim
        } else {
          let dist = headPos - edgeComplete;
          if (dist < 0) dist += 5;
          if (dist < tailLen) {
            m = 0.1 + 0.9 * (1 - dist / tailLen);
          } else {
            m = 0.1;
          }
        }
        modEl(elMap, state, 'L' + i, m);
        modLineSW(elMap, state, 'L' + i, 0.5 + 0.7 * m);
      }
      // Vertex nodes flash as the energy passes through them
      for (let ei = 0; ei < 5; ei++) {
        const nodeIdx = nodeOrder[ei];
        const vertexPos = ei + 1;
        let dist = headPos - vertexPos;
        if (dist < 0) dist += 5;
        let m;
        if (dist < 0.15) m = 1;
        else if (dist < tailLen * 0.8) m = 0.1 + 0.9 * (1 - (dist - 0.15) / (tailLen * 0.8 - 0.15));
        else m = 0.1;
        modEl(elMap, state, 'C' + nodeIdx, m);
        modCircleR(elMap, state, 'C' + nodeIdx, 0.4 + 0.8 * m);
      }
      // Solid ball — use C6 (filled circle, currently HC)
      const edgeIdx = currentEdge;
      const edgeFrac = headPos - Math.floor(headPos);
      const fromVert = verts[edgeIdx];
      const toVert = verts[(edgeIdx + 1) % 5];
      const dotX = fromVert[0] + (toVert[0] - fromVert[0]) * edgeFrac;
      const dotY = fromVert[1] + (toVert[1] - fromVert[1]) * edgeFrac;
      elMap.C6.setAttribute('cx', dotX);
      elMap.C6.setAttribute('cy', dotY);
      elMap.C6.setAttribute('r', 0.8);
      elMap.C6.setAttribute('opacity', 1);
      // P1 returns to outer ring — flashes at vertex crossings
      const vertDist = Math.abs(headPos - Math.round(headPos));
      const vertFlash = vertDist < 0.25 ? 1 - vertDist / 0.25 : 0;
      const baseO = state.P1?.o ?? 0.2;
      const baseSW = state.P1?.sw ?? 0.75;
      if (baseO > 0) {
        elMap.P1.setAttribute('opacity', baseO + (1 - baseO) * vertFlash);
        elMap.P1.setAttribute('stroke-width', baseSW * (1 + 1.5 * vertFlash));
      }
      // Guide lines L6-L8 dim glow with subtle pulse
      const guideM = 0.3 + 0.15 * Math.sin(now / 2000 * Math.PI * 2);
      for (let i = 6; i <= 8; i++) {
        modEl(elMap, state, 'L' + i, guideM);
        modLineSW(elMap, state, 'L' + i, 0.6 + 0.5 * guideM);
      }
    },
  },
  void: {
    desc: 'runic vortex',
    // Base coordinates for rotation
    _paths: {
      L1: { x1: 3, y1: 6, qx: 6, qy: 2, x2: 14, y2: 3 },
      L2: { x1: 18, y1: 3, qx: 22, qy: 8, x2: 20, y2: 14 },
      L3: { x1: 21, y1: 18, qx: 17, qy: 22, x2: 10, y2: 21 },
      L4: { x1: 6, y1: 21, qx: 2, qy: 16, x2: 3, y2: 10 },
      L5: { x1: 10, y1: 8, qx: 11, qy: 10, x2: 12, y2: 10.5 },
      L6: { x1: 14.5, y1: 9, qx: 13, qy: 10.5, x2: 12.5, y2: 11 },
      L7: { x1: 15, y1: 14, qx: 13.5, qy: 13, x2: 12.5, y2: 12.5 },
      L8: { x1: 9, y1: 15, qx: 10.5, qy: 13.5, x2: 11.5, y2: 12.5 },
    },
    _nodes: {
      C2: [3, 6], C3: [20, 14], C4: [10, 21], C5: [18, 3],
    },
    anim: (elMap, state, now) => {
      const info = ICON_INFO.void;
      // Rotation — outer arcs spin at 12s, inner runes spin faster at 8s (counter)
      const outerAngle = (now / 12000) * Math.PI * 2;
      const innerAngle = -(now / 8000) * Math.PI * 2;
      const rotOuter = (x, y) => {
        const c = Math.cos(outerAngle), s = Math.sin(outerAngle);
        return [12 + (x - 12) * c - (y - 12) * s, 12 + (x - 12) * s + (y - 12) * c];
      };
      const rotInner = (x, y) => {
        const c = Math.cos(innerAngle), s = Math.sin(innerAngle);
        return [12 + (x - 12) * c - (y - 12) * s, 12 + (x - 12) * s + (y - 12) * c];
      };
      // Rotate outer arcs L1-L4
      for (let i = 1; i <= 4; i++) {
        const p = info._paths['L' + i];
        const [x1, y1] = rotOuter(p.x1, p.y1);
        const [qx, qy] = rotOuter(p.qx, p.qy);
        const [x2, y2] = rotOuter(p.x2, p.y2);
        elMap['L' + i].setAttribute('d', `M${x1} ${y1}Q${qx} ${qy} ${x2} ${y2}`);
      }
      // Rotate inner runes L5-L8 (counter-rotation for drama)
      for (let i = 5; i <= 8; i++) {
        const p = info._paths['L' + i];
        const [x1, y1] = rotInner(p.x1, p.y1);
        const [qx, qy] = rotInner(p.qx, p.qy);
        const [x2, y2] = rotInner(p.x2, p.y2);
        elMap['L' + i].setAttribute('d', `M${x1} ${y1}Q${qx} ${qy} ${x2} ${y2}`);
      }
      // Rotate anchor nodes with outer arcs
      for (const [key, [bx, by]] of Object.entries(info._nodes)) {
        const [rx, ry] = rotOuter(bx, by);
        elMap[key].setAttribute('cx', rx);
        elMap[key].setAttribute('cy', ry);
      }
      // Outer arcs: sequential trailing brightness + animated dash texture
      const cycle = 6000;
      const phase = (now % cycle) / cycle;
      for (let i = 1; i <= 4; i++) {
        const pos = (i - 1) / 4;
        const dist = ((phase - pos) + 1) % 1;
        const trail = 0.2 + 0.8 * Math.max(0, 1 - dist * 2);
        modEl(elMap, state, 'L' + i, trail);
        modLineSW(elMap, state, 'L' + i, 0.5 + 0.8 * trail);
        // Animated dash-array: dashes crawl along the arc
        const dashOff = (now / (600 + i * 100)) % 20;
        elMap['L' + i].setAttribute('stroke-dasharray', '4 3');
        elMap['L' + i].setAttribute('stroke-dashoffset', dashOff);
      }
      // Inner runes: independent irregular pulse + flickering dash texture
      for (let i = 5; i <= 8; i++) {
        const r1 = Math.sin(now / (2000 + i * 700) * Math.PI * 2 + i * 1.5);
        const r2 = Math.sin(now / (3500 + i * 400) * Math.PI * 2 + i * 0.8) * 0.5;
        const m = 0.3 + 0.7 * ((r1 + r2) / 1.5 * 0.5 + 0.5);
        modEl(elMap, state, 'L' + i, m);
        modLineSW(elMap, state, 'L' + i, 0.4 + 0.8 * m);
        // Dash pattern shifts — runes appear to crackle
        const gap = 2 + Math.sin(now / (1500 + i * 300) * Math.PI * 2) * 1.5;
        elMap['L' + i].setAttribute('stroke-dasharray', `3 ${Math.max(0.5, gap).toFixed(1)}`);
        elMap['L' + i].setAttribute('stroke-dashoffset', (now / (400 + i * 80)) % 12);
      }
      // Anchor nodes trail with their arcs
      for (let i = 2; i <= 5; i++) {
        const pos = (i - 2) / 4;
        const dist = ((phase - pos) + 1) % 1;
        const m = 0.15 + 0.5 * Math.max(0, 1 - dist * 2.5);
        modEl(elMap, state, 'C' + i, m);
        modCircleR(elMap, state, 'C' + i, 0.5 + 0.7 * m);
      }
      // Singularity C1: intense irregular throb
      const c = 0.4 + 0.3 * Math.sin(now / 2100 * Math.PI * 2)
                     + 0.3 * Math.sin(now / 3300 * Math.PI * 2);
      modEl(elMap, state, 'C1', 0.4 + 0.6 * c);
      modCircleR(elMap, state, 'C1', 0.6 + 0.8 * c);
      // Binding circle: rhythmic contraction + crawling dash texture
      const baseSW = state.P1?.sw ?? 0.75;
      const baseR = state.P1?.r ?? 8.5;
      const pull = Math.sin(now / 4000 * Math.PI * 2) * 0.5 + 0.5;
      const pullFast = Math.sin(now / 1800 * Math.PI * 2) * 0.15;
      if (state.P1?.o > 0) {
        elMap.P1.setAttribute('r', baseR * (0.85 + 0.2 * pull + pullFast));
        elMap.P1.setAttribute('stroke-width', baseSW * (0.6 + 0.8 * pull));
        // Binding circle dashes crawl (ritual inscription rotating)
        elMap.P1.setAttribute('stroke-dasharray', '5 3 2 3');
        elMap.P1.setAttribute('stroke-dashoffset', -(now / 200) % 26);
      }
    },
  },

  // ── Utility ──
  error: {
    desc: 'warning alert',
    anim: (elMap, state, now) => {
      // Alarm: urgent double-flash with sw spike
      const cycle = 2000;
      const t = (now % cycle) / cycle;
      let m = 0.35;
      if (t < 0.05) m = 0.35 + 0.65 * Math.sin(t / 0.05 * Math.PI);
      else if (t > 0.09 && t < 0.14) m = 0.35 + 0.5 * Math.sin((t - 0.09) / 0.05 * Math.PI);
      modAllOpacity(elMap, state, m);
      // Exclamation line L4 sw spikes on flash
      const swM = m > 0.5 ? 1 + 0.5 * (m - 0.5) / 0.5 : 1;
      modLineSW(elMap, state, 'L4', swM);
      // Dot C1 radius pulses
      modCircleR(elMap, state, 'C1', 0.7 + 0.6 * (m - 0.35) / 0.65);
    },
  },
  eye: {
    desc: 'watchful observer',
    anim: (elMap, state, now) => {
      // Subtle blink + pupil contraction + iris sw modulation
      const drift = 0.92 + 0.08 * (Math.sin(now / 3000 * Math.PI * 2) * 0.5 + 0.5);
      const t = (now % 4000) / 4000;
      let m = drift;
      if (t > 0.85 && t < 0.89) {
        m = drift * (1 - ((t - 0.85) / 0.04) * 0.85);
      } else if (t >= 0.89 && t < 0.95) {
        m = drift * (0.15 + ((t - 0.89) / 0.06) * 0.85);
      }
      if (m < 1) modAllOpacity(elMap, state, m);
      // Pupil C1 contracts during blink
      modCircleR(elMap, state, 'C1', 0.6 + 0.4 * m);
      // P1 iris sw breathes between blinks
      const baseSW = state.P1?.sw ?? 0.75;
      if (state.P1?.o > 0) elMap.P1.setAttribute('stroke-width', baseSW * (0.7 + 0.5 * drift));
    },
  },
  heartbeat: {
    desc: 'vital rhythm',
    anim: (elMap, state, now) => {
      // Signal propagation along waveform + sw thickening at leading edge
      const cycle = 2000;
      const t = (now % cycle) / cycle;
      for (let i = 1; i <= 5; i++) {
        const seg = (i - 1) / 5;
        const dist = ((t - seg) + 1) % 1;
        const m = dist < 0.15 ? 0.2 + 0.8 * (1 - dist / 0.15) : 0.2;
        modEl(elMap, state, 'L' + i, m);
        modLineSW(elMap, state, 'L' + i, 0.7 + 0.6 * m);
      }
      // Peak marker C1 flashes + swells as signal passes spike
      const peakPos = 0.15;
      const peakDist = Math.abs(((t - peakPos) + 1.5) % 1 - 0.5);
      const peakM = peakDist < 0.08 ? 1 - peakDist / 0.08 : 0;
      modEl(elMap, state, 'C1', 0.15 + 0.85 * peakM);
      modCircleR(elMap, state, 'C1', 0.6 + 0.7 * peakM);
      // Trough C2 glimmers
      modEl(elMap, state, 'C2', 0.15 + 0.2 * (Math.sin(now / 2500 * Math.PI * 2) * 0.5 + 0.5));
    },
  },
  loading: {
    desc: 'process indicator',
    anim: (elMap, state, now) => {
      // Chase: spoke spinner with sw thickening at leading spoke
      const phase = (now / 800) * Math.PI * 2;
      for (let i = 1; i <= 8; i++) {
        const angle = (i - 1) * Math.PI / 4;
        const m = 0.15 + 0.85 * Math.max(0, Math.cos(phase - angle));
        modEl(elMap, state, 'L' + i, m);
        modLineSW(elMap, state, 'L' + i, 0.6 + 0.8 * m);
      }
      // P1 ring sw follows rotation subtly
      const baseSW = state.P1?.sw ?? 0.75;
      const ringSW = 0.8 + 0.4 * (Math.sin(phase * 0.5) * 0.5 + 0.5);
      if (state.P1?.o > 0) elMap.P1.setAttribute('stroke-width', baseSW * ringSW);
    },
  },
  retry: {
    desc: 'renewal cycle',
    anim: (elMap, state, now) => {
      // Charge: buildup with increasing sw, snap back
      const cycle = 2500;
      const t = (now % cycle) / cycle;
      const m = t < 0.85 ? 0.2 + 0.8 * (t / 0.85) : 0.2;
      modAllOpacity(elMap, state, m);
      // Stroke-width ramps up with the charge
      for (let i = 1; i <= 8; i++) modLineSW(elMap, state, 'L' + i, 0.5 + 0.8 * m);
    },
  },
  scan: {
    desc: 'sweeping detector',
    anim: (elMap, state, now) => {
      // Atmospheric sensing: scan lines breathe + sw undulates
      for (let i = 1; i <= 4; i++) {
        const phase = (i - 1) * 0.4;
        const s = Math.sin(now / 5000 * Math.PI * 2 + phase) * 0.5 + 0.5;
        modEl(elMap, state, 'L' + i, 0.2 + 0.6 * s);
        modLineSW(elMap, state, 'L' + i, 0.6 + 0.7 * s);
      }
      // Data nodes emerge and swell on independent slow cycles
      for (let i = 2; i <= 5; i++) {
        const period = 6000 + i * 900;
        const phase = i * 1.9;
        const s = Math.sin(now / period * Math.PI * 2 + phase) * 0.5 + 0.5;
        modEl(elMap, state, 'C' + i, 0.1 + 0.7 * s);
        modCircleR(elMap, state, 'C' + i, 0.5 + 0.7 * s);
      }
      // Crosshair lines L5-L8 dim + center C1 radius breathes
      for (let i = 5; i <= 8; i++) modEl(elMap, state, 'L' + i, 0.3);
      const cb = Math.sin(now / 4000 * Math.PI * 2) * 0.5 + 0.5;
      modCircleR(elMap, state, 'C1', 0.8 + 0.4 * cb);
    },
  },
};

// ── Stage factory ──

function makeStage() {
  const div = document.createElement('div');
  div.className = 'svg-display morph-stage';
  div.style.width = STAGE_SIZE + 'px';
  div.style.height = STAGE_SIZE + 'px';
  div.style.minWidth = STAGE_SIZE + 'px';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  div.appendChild(svg);
  return { div, svg };
}

// ── Icon Controller (state machine) ──

class IconCtrl {
  constructor(key, stage, elMap) {
    this.key = key;
    this.state = STATES[key];
    this.col = colFor(key);
    this.stage = stage;
    this.elMap = elMap;
    this.animFn = ICON_INFO[key].anim;
    this.status = 'idle'; // idle | playing | departing | gone | arriving
    this.departMethod = null;
    this.animId = null;
    this.timer = null;
    this.onUpdate = null;

    // Initialize
    setState(elMap, this.state);
    stage.style.background = lerpColor(this.col.bg, this.col.bg, 0);
    stage.style.borderColor = lerpColor(this.col.bd, this.col.bd, 0);
  }

  togglePlay() {
    if (this.status === 'playing') this.pause();
    else if (this.status === 'idle') this.play();
  }

  play() {
    if (this.status !== 'idle') return;
    this.status = 'playing';
    this._notify();
    this._startAnim();
  }

  pause() {
    if (this.status !== 'playing') return;
    this._stopAnim();
    this.status = 'idle';
    setState(this.elMap, this.state);
    this._notify();
  }

  depart(method) {
    if (this.status === 'departing' || this.status === 'arriving' || this.status === 'gone') return;
    this._stopAnim();
    setState(this.elMap, this.state);
    this.departMethod = method;
    this.status = 'departing';
    this._notify();

    const target = method === 'converge' ? convergeState : dissipateState;
    const colTarget = method === 'converge' ? COL.converge : COL.dissipate;

    this._morph(this.state, target, this.col, colTarget, () => {
      this.status = 'gone';
      this._notify();
      this.timer = setTimeout(() => this.arrive(), 9000);
    });
  }

  arrive() {
    if (this.status !== 'gone') return;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.status = 'arriving';
    this._notify();

    const from = this.departMethod === 'converge' ? convergeState : dissipateState;
    const colFrom = this.departMethod === 'converge' ? COL.converge : COL.dissipate;

    this._morph(from, this.state, colFrom, this.col, () => {
      this.status = 'idle';
      this.departMethod = null;
      this._notify();
    });
  }

  _startAnim() {
    const self = this;
    (function tick(now) {
      if (self.status !== 'playing') return;
      resetAnim(self.elMap, self.state);
      self.animFn(self.elMap, self.state, now);
      self.animId = requestAnimationFrame(tick);
    })(performance.now());
  }

  _stopAnim() {
    if (this.animId) { cancelAnimationFrame(this.animId); this.animId = null; }
  }

  _morph(fromState, toState, colFrom, colTo, onDone) {
    const t0 = performance.now();
    const self = this;
    (function tick(now) {
      const raw = Math.min((now - t0) / DURATION, 1);
      const t = EASE(raw);
      applyState(self.elMap, fromState, toState, t);
      self.stage.style.background = lerpColor(colFrom.bg, colTo.bg, t);
      self.stage.style.borderColor = lerpColor(colFrom.bd, colTo.bd, t);
      if (raw < 1) self.animId = requestAnimationFrame(tick);
      else { self.animId = null; onDone(); }
    })(performance.now());
  }

  _notify() {
    if (this.onUpdate) this.onUpdate(this.status);
  }
}

// ── Button helper ──

function btn(text, onClick) {
  const b = document.createElement('button');
  b.className = 'browser-btn';
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

// ── Build browser ──

for (const group of STATE_GROUPS) {
  const keys = group.keys.filter(k => k !== 'converge' && k !== 'dissipate');
  if (!keys.length) continue;
  keys.sort();

  const details = document.createElement('details');
  details.open = true;
  details.className = 'browser-group';

  const summary = document.createElement('summary');
  summary.className = 'browser-group-title';
  summary.textContent = group.name;
  details.appendChild(summary);

  const list = document.createElement('div');
  list.className = 'browser-list';

  for (const key of keys) {
    const info = ICON_INFO[key];
    if (!info) continue;

    const row = document.createElement('div');
    row.className = 'browser-row';

    // Info
    const infoDiv = document.createElement('div');
    infoDiv.className = 'browser-info';
    const nameEl = document.createElement('span');
    nameEl.className = 'browser-name';
    nameEl.textContent = key;
    const descEl = document.createElement('span');
    descEl.className = 'browser-desc';
    descEl.textContent = info.desc;
    infoDiv.appendChild(nameEl);
    infoDiv.appendChild(descEl);
    row.appendChild(infoDiv);

    // Stage
    const { div: stage, svg } = makeStage();
    const elMap = buildMorphSVG(svg);
    const ctrl = new IconCtrl(key, stage, elMap);
    row.appendChild(stage);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'browser-controls';

    const playBtn = btn('\u25b6', () => ctrl.togglePlay());
    const convBtn = btn('\u21d3', () => ctrl.depart('converge'));
    const dissBtn = btn('\u21d1', () => ctrl.depart('dissipate'));
    const retBtn = btn('\u21bb', () => ctrl.arrive());
    retBtn.style.display = 'none';

    controls.appendChild(playBtn);
    controls.appendChild(convBtn);
    controls.appendChild(dissBtn);
    controls.appendChild(retBtn);
    row.appendChild(controls);

    // State machine → update controls
    ctrl.onUpdate = (status) => {
      const visible = status === 'idle' || status === 'playing';
      const gone = status === 'gone';
      const busy = status === 'departing' || status === 'arriving';

      playBtn.textContent = status === 'playing' ? '\u23f8' : '\u25b6';
      playBtn.style.display = visible ? '' : 'none';
      convBtn.style.display = visible ? '' : 'none';
      dissBtn.style.display = visible ? '' : 'none';
      retBtn.style.display = gone ? '' : 'none';

      playBtn.disabled = busy;
      convBtn.disabled = busy;
      dissBtn.disabled = busy;
      retBtn.disabled = busy;
    };

    list.appendChild(row);
  }

  details.appendChild(list);
  browser.appendChild(details);
}
