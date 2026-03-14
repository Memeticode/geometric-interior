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
    anim: (elMap, state, now) => {
      // Stability envelope: mostly stable, brief flicker bursts
      const envCycle = 8000;
      const envPhase = (now % envCycle) / envCycle;
      let brightness;
      if (envPhase < 0.70) {
        // Stable — near-full brightness with tiny tremor
        brightness = 0.92 + 0.08 * Math.sin(now / 3000 * Math.PI * 2);
      } else if (envPhase < 0.85) {
        // Flicker burst
        const burstT = (envPhase - 0.70) / 0.15;
        const flickerAmp = Math.sin(burstT * Math.PI);
        const f1 = Math.sin(now / 137 * Math.PI * 2);
        const f2 = Math.sin(now / 293 * Math.PI * 2) * 0.7;
        const f3 = Math.sin(now / 571 * Math.PI * 2) * 0.4;
        const flicker = (f1 + f2 + f3) / 2.1;
        brightness = Math.max(0.04, 0.5 + 0.5 * flicker * flickerAmp);
      } else {
        // Brief dim/recovery — ramp back up
        const recovT = (envPhase - 0.85) / 0.15;
        brightness = 0.3 + 0.62 * recovT;
      }
      modAllOpacity(elMap, state, brightness);
      const swM = 0.6 + 0.6 * brightness;
      for (let i = 1; i <= 4; i++) modLineSW(elMap, state, 'L' + i, swM);
      // Rare earthquake: 3 very slow waves must align
      const quake1 = Math.sin(now / 4100 * Math.PI * 2);
      const quake2 = Math.sin(now / 6700 * Math.PI * 2);
      const quake3 = Math.sin(now / 9300 * Math.PI * 2);
      const quakeIntensity = Math.max(0, (quake1 + quake2 + quake3 - 1.8)) / 1.2;
      const jx = (Math.sin(now / 83) * 0.5 + Math.sin(now / 197) * 0.3) * quakeIntensity;
      const jy = (Math.sin(now / 109) * 0.5 + Math.cos(now / 167) * 0.3) * quakeIntensity;
      // Rebuild arm paths with intermittent jitter
      elMap.L1.setAttribute('d', `M${12+jx} ${4+jy}Q${12+jx} ${8+jy} ${12+jx} ${12+jy}`);
      elMap.L2.setAttribute('d', `M${12+jx} ${12+jy}Q${12+jx} ${16+jy} ${12+jx} ${20+jy}`);
      elMap.L3.setAttribute('d', `M${4+jx} ${12+jy}Q${8+jx} ${12+jy} ${12+jx} ${12+jy}`);
      elMap.L4.setAttribute('d', `M${12+jx} ${12+jy}Q${16+jx} ${12+jy} ${20+jx} ${12+jy}`);
      // Tip nodes jitter with arms
      elMap.C1.setAttribute('cx', 12 + jx); elMap.C1.setAttribute('cy', 4 + jy);
      elMap.C2.setAttribute('cx', 12 + jx); elMap.C2.setAttribute('cy', 20 + jy);
      elMap.C3.setAttribute('cx', 4 + jx); elMap.C3.setAttribute('cy', 12 + jy);
      elMap.C4.setAttribute('cx', 20 + jx); elMap.C4.setAttribute('cy', 12 + jy);
      elMap.C5.setAttribute('cx', 12 + jx); elMap.C5.setAttribute('cy', 12 + jy);
      // Node radii twitch with brightness
      for (let i = 1; i <= 4; i++) modCircleR(elMap, state, 'C' + i, 0.8 + 0.3 * brightness);
      modCircleR(elMap, state, 'C5', 0.85 + 0.25 * brightness);
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
      // Subdued breathing — very subtle scale pulse
      const s1 = Math.sin(now / 2700 * Math.PI * 2);
      const s2 = Math.sin(now / 4300 * Math.PI * 2) * 0.6;
      const s3 = Math.sin(now / 1100 * Math.PI * 2) * 0.15;
      const raw = (s1 + s2 + s3) / 1.75;
      const scale = 1.0 + 0.04 * raw; // very subdued range (0.96–1.04)
      // Scale vertices and rebuild edge paths
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
      // Lifelike shimmer: per-edge independent twinkle layered with shared pulse
      const baseOM = 0.85 + 0.15 * raw;
      for (let i = 1; i <= 6; i++) {
        const shimmer = Math.sin(now / (1200 + i * 300) * Math.PI * 2 + i * 2.3) * 0.5 + 0.5;
        modEl(elMap, state, 'L' + i, baseOM * (0.7 + 0.3 * shimmer));
        modLineSW(elMap, state, 'L' + i, 0.8 + 0.3 * shimmer);
      }
      // Corner nodes: independent shimmer + radius micro-pulse
      for (let i = 2; i <= 7; i++) {
        const ns = Math.sin(now / (1500 + i * 400) * Math.PI * 2 + i * 1.7) * 0.5 + 0.5;
        modEl(elMap, state, 'C' + i, baseOM * (0.6 + 0.4 * ns));
        modCircleR(elMap, state, 'C' + i, 0.85 + 0.25 * ns);
      }
      // Center C1: slow deep breathing on its own rhythm
      const cBreath = Math.sin(now / 3800 * Math.PI * 2) * 0.5 + 0.5;
      modEl(elMap, state, 'C1', 0.7 + 0.3 * cBreath);
      modCircleR(elMap, state, 'C1', 0.85 + 0.25 * cBreath);
      // P1 ring: scale + independent sw shimmer
      const baseR = state.P1?.r ?? 3;
      const ringShim = Math.sin(now / 2200 * Math.PI * 2) * 0.5 + 0.5;
      if (state.P1?.o > 0) {
        elMap.P1.setAttribute('r', baseR * scale);
        elMap.P1.setAttribute('stroke-width', (state.P1.sw ?? 0.75) * (0.7 + 0.5 * ringShim));
      }
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
    desc: 'runic dissolution',
    // Base debris shard coords for physical drift
    _paths: {
      L6: { x1: 18, y1: 12, x2: 20, y2: 10 },
      L7: { x1: 5, y1: 11, x2: 3, y2: 9 },
      L8: { x1: 14, y1: 19, x2: 15, y2: 21 },
    },
    // Branch base coords for sway
    _branches: {
      L2: { bx: 12, by: 7, tipX: 18, tipY: 4 },
      L3: { bx: 12, by: 7, tipX: 6, tipY: 4 },
    },
    anim: (elMap, state, now) => {
      const info = ICON_INFO.pulse;
      // Intact rune strokes L1-L3: phase-offset breathing (spine + branches)
      const s1base = Math.sin(now / 3200 * Math.PI * 2);
      const s2base = Math.sin(now / 5100 * Math.PI * 2) * 0.5;
      const intactPulse = (s1base + s2base) / 1.5;
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
      // Branches L2-L3: sway like tree limbs
      const b2 = info._branches.L2;
      const b2tx = b2.tipX + Math.sin(now / 6000) * 1.5;
      const b2ty = b2.tipY + Math.sin(now / 7500) * 0.8;
      const b2mx = (b2.bx + b2tx) / 2, b2my = (b2.by + b2ty) / 2;
      const b2dx = b2tx - b2.bx, b2dy = b2ty - b2.by;
      const b2len = Math.sqrt(b2dx * b2dx + b2dy * b2dy) || 1;
      const b2px = -b2dy / b2len, b2py = b2dx / b2len;
      const b2bow = Math.sin(now / 5000) * 0.6;
      const b2qx = b2mx + b2px * b2bow, b2qy = b2my + b2py * b2bow;
      elMap.L2.setAttribute('d', `M${b2.bx} ${b2.by}Q${b2qx} ${b2qy} ${b2tx} ${b2ty}`);
      const b3 = info._branches.L3;
      const b3tx = b3.tipX + Math.sin(now / 7000) * 1.5;
      const b3ty = b3.tipY + Math.sin(now / 6500) * 0.8;
      const b3mx = (b3.bx + b3tx) / 2, b3my = (b3.by + b3ty) / 2;
      const b3dx = b3tx - b3.bx, b3dy = b3ty - b3.by;
      const b3len = Math.sqrt(b3dx * b3dx + b3dy * b3dy) || 1;
      const b3px = -b3dy / b3len, b3py = b3dx / b3len;
      const b3bow = Math.sin(now / 5500) * 0.6;
      const b3qx = b3mx + b3px * b3bow, b3qy = b3my + b3py * b3bow;
      elMap.L3.setAttribute('d', `M${b3.bx} ${b3.by}Q${b3qx} ${b3qy} ${b3tx} ${b3ty}`);
      // Fractured branches L4-L5: slow independent drift
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
        const dx = mx - 12, dy = my - 12;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / len, ny = dy / len;
        const driftPos = Math.sin(now / (5000 + i * 800) * Math.PI * 2 + i * 1.5) * 0.5 + 0.5;
        const offset = driftPos * 1.5;
        const ox = nx * offset, oy = ny * offset;
        const x1 = p.x1 + ox, y1 = p.y1 + oy;
        const x2 = p.x2 + ox, y2 = p.y2 + oy;
        elMap['L' + i].setAttribute('d', `M${x1} ${y1}Q${(x1+x2)/2} ${(y1+y2)/2} ${x2} ${y2}`);
        const period = 3000 + i * 500;
        const driftO = Math.sin(now / period * Math.PI * 2 + i * 2.5) * 0.5 + 0.5;
        modEl(elMap, state, 'L' + i, 0.15 + 0.7 * driftO);
        modLineSW(elMap, state, 'L' + i, 0.4 + 0.9 * driftO);
      }
      // Junction/stress points C1-C3: strain-responsive at rune intersections
      for (let i = 1; i <= 3; i++) {
        const flicker = Math.sin(now / (1800 + i * 600) * Math.PI * 2 + i * 2.7) * 0.5 + 0.5;
        const strain = Math.max(0, -edgePulses[i - 1]);
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
    _edgeNodeOrder: [1, 3, 5, 2, 4], // node index hit after each edge
    _verts: [[12, 4], [16.7, 18.5], [4.4, 9.5], [19.6, 9.5], [7.3, 18.5]],
    // SVG stroke positions of each vertex on P1 ring (circumf ≈ 50.27)
    // SVG circle stroke starts at 3 o'clock (east) and goes clockwise
    _vertArcPos: (() => {
      const verts = [[12, 4], [16.7, 18.5], [4.4, 9.5], [19.6, 9.5], [7.3, 18.5]];
      const circumf = 2 * Math.PI * 8;
      return verts.map(([vx, vy]) => {
        let angle = Math.atan2(vy - 12, vx - 12); // clockwise from +X in SVG coords
        if (angle < 0) angle += Math.PI * 2;
        return angle / (Math.PI * 2) * circumf;
      });
    })(),
    anim: (elMap, state, now) => {
      const cycle = 1200;
      const t = (now % cycle) / cycle;
      const headPos = t * 5;
      const tailLen = 3;
      const nodeOrder = ICON_INFO.sigil._edgeNodeOrder;
      const verts = ICON_INFO.sigil._verts;
      const vertArcPos = ICON_INFO.sigil._vertArcPos;
      const circumf = 2 * Math.PI * 8;
      // Edge lighting: localized glow near ball
      const currentEdge = Math.floor(headPos) % 5;
      for (let i = 1; i <= 5; i++) {
        const edgeComplete = i;
        const onThisEdge = currentEdge === (i - 1);
        let m;
        if (onThisEdge) {
          m = 0.08;
        } else {
          let dist = headPos - edgeComplete;
          if (dist < 0) dist += 5;
          if (dist < tailLen) {
            const fade = 1 - dist / tailLen;
            m = 0.08 + 0.92 * fade * fade;
          } else {
            m = 0.08;
          }
        }
        modEl(elMap, state, 'L' + i, m);
        modLineSW(elMap, state, 'L' + i, 0.4 + 0.8 * m);
      }
      // Vertex nodes: tight flash at impact
      for (let ei = 0; ei < 5; ei++) {
        const nodeIdx = nodeOrder[ei];
        const vertexPos = ei + 1;
        let dist = headPos - vertexPos;
        if (dist < 0) dist += 5;
        let m;
        if (dist < 0.1) m = 1;
        else if (dist < tailLen) {
          const fade = 1 - (dist - 0.1) / (tailLen - 0.1);
          m = 0.08 + 0.92 * fade * fade;
        } else m = 0.08;
        modEl(elMap, state, 'C' + nodeIdx, m);
        modCircleR(elMap, state, 'C' + nodeIdx, 0.3 + 0.9 * m);
      }
      // Ball position with perpendicular wobble
      const edgeIdx = currentEdge;
      const edgeFrac = headPos - Math.floor(headPos);
      const fromVert = verts[edgeIdx];
      const toVert = verts[(edgeIdx + 1) % 5];
      const ex = toVert[0] - fromVert[0], ey = toVert[1] - fromVert[1];
      const eLen = Math.sqrt(ex * ex + ey * ey) || 1;
      // Perpendicular direction (rotate edge 90°)
      const px = -ey / eLen, py = ex / eLen;
      // Wobble: sine arc, zero at vertices, peaks mid-edge
      const wobble = Math.sin(edgeFrac * Math.PI) * 0.4;
      const dotX = fromVert[0] + ex * edgeFrac + px * wobble;
      const dotY = fromVert[1] + ey * edgeFrac + py * wobble;
      elMap.C6.setAttribute('cx', dotX);
      elMap.C6.setAttribute('cy', dotY);
      elMap.C6.setAttribute('r', 0.8);
      elMap.C6.setAttribute('opacity', 1);
      // P1: multi-segment arc gradient at nearest vertex impact
      const hitVertIdx = ((Math.round(headPos) % 5) + 5) % 5;
      const vertDist = Math.abs(headPos - Math.round(headPos));
      const vertFlash = vertDist < 0.2 ? 1 - vertDist / 0.2 : 0;
      const baseO = state.P1?.o ?? 0.2;
      const baseSW = state.P1?.sw ?? 0.75;
      if (baseO > 0) {
        // Arc position of the hit vertex
        const arcPos = vertArcPos[hitVertIdx];
        // 3-segment gradient: primary bright arc + 2 dimmer flanking arcs
        const mainArc = 2 + 8 * vertFlash;
        const sideArc = 1 + 3 * vertFlash;
        const gap1 = 0.5;
        const gap2 = 0.5;
        const totalUsed = mainArc + sideArc * 2 + gap1 * 2 + gap2 * 2;
        const gap3 = Math.max(0.5, circumf - totalUsed);
        elMap.P1.setAttribute('stroke-dasharray',
          `${sideArc.toFixed(1)} ${gap2.toFixed(1)} ${mainArc.toFixed(1)} ${gap1.toFixed(1)} ${sideArc.toFixed(1)} ${gap3.toFixed(1)}`);
        // Offset so pattern centers on vertex (main arc in middle)
        const patternOffset = sideArc + gap2 + mainArc / 2;
        elMap.P1.setAttribute('stroke-dashoffset', -(arcPos - patternOffset).toFixed(1));
        elMap.P1.setAttribute('opacity', baseO + (1 - baseO) * vertFlash * 0.8);
        elMap.P1.setAttribute('stroke-width', baseSW * (1 + 1.5 * vertFlash));
      }
      // Guide lines L6-L8 — shinier, faster shimmer, independent phases
      for (let i = 6; i <= 8; i++) {
        const linePhase = (i - 6) * 2.1;
        const guideM = 0.5 + 0.25 * Math.sin(now / 1200 * Math.PI * 2 + linePhase);
        modEl(elMap, state, 'L' + i, guideM);
        modLineSW(elMap, state, 'L' + i, 0.6 + 0.5 * guideM);
      }
    },
  },
  void: {
    desc: 'nebular vortex',
    // Spiral arm base coordinates — scaled 1.35× from center (12,12)
    _spirals: {
      L1: { x1: 7.95, y1: 6.6, qx: 5.25, qy: 10, x2: 7.95, y2: 13.35 },
      L2: { x1: 7.95, y1: 13.35, qx: 10.65, qy: 16.05, x2: 12.7, y2: 12.7 },
      L3: { x1: 16.05, y1: 17.4, qx: 18.75, qy: 14, x2: 16.05, y2: 10.65 },
      L4: { x1: 16.05, y1: 10.65, qx: 13.35, qy: 7.95, x2: 11.3, y2: 11.3 },
    },
    // Gas wisp base coordinates — scaled 1.35×
    _wisps: {
      L5: { x1: 9.3, y1: 9.3, qx: 11.3, qy: 6.6, x2: 13.35, y2: 9.3 },
      L6: { x1: 10.65, y1: 14.7, qx: 12.7, qy: 17.4, x2: 14.7, y2: 14.7 },
      L7: { x1: 7.95, y1: 11.3, qx: 9.3, qy: 13.35, x2: 10, y2: 11.3 },
      L8: { x1: 14, y1: 12.7, qx: 14.7, qy: 10.65, x2: 16.05, y2: 12.7 },
    },
    _nodes: {
      C2: [8.6, 8.6], C3: [15.4, 15.4], C4: [9.3, 14.7], C5: [14.7, 9.3],
    },
    anim: (elMap, state, now) => {
      const info = ICON_INFO.void;
      // Swell: mostly compact, periodically expands
      const swellPhase = (now % 8000) / 8000;
      const swellRaw = Math.max(0, Math.cos(swellPhase * Math.PI * 2));
      const swell = swellRaw > 0.6 ? (swellRaw - 0.6) / 0.4 : 0;
      const scale = 0.85 + 0.15 * swell;
      const sc = (x, y) => [12 + (x - 12) * scale, 12 + (y - 12) * scale];
      // Slow rotation for spirals
      const spiralAngle = (now / 15000) * Math.PI * 2;
      const wispAngle = -(now / 10000) * Math.PI * 2;
      const rot = (x, y, angle) => {
        const c = Math.cos(angle), s = Math.sin(angle);
        return sc(12 + (x - 12) * c - (y - 12) * s, 12 + (x - 12) * s + (y - 12) * c);
      };
      // Spiral arms L1-L4: rotate + undulate control points
      for (let i = 1; i <= 4; i++) {
        const p = info._spirals['L' + i];
        // Undulation: control point drifts perpendicular to arm
        const undPhase = now / (3500 + i * 500) * Math.PI * 2 + i * 1.2;
        const undAmt = 1.5 * Math.sin(undPhase);
        // Perpendicular to midpoint-center direction
        const mx = (p.x1 + p.x2) / 2, my = (p.y1 + p.y2) / 2;
        const dx = mx - 12, dy = my - 12;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const px = -dy / len * undAmt, py = dx / len * undAmt;
        const [x1, y1] = rot(p.x1, p.y1, spiralAngle);
        const [qx, qy] = rot(p.qx + px, p.qy + py, spiralAngle);
        const [x2, y2] = rot(p.x2, p.y2, spiralAngle);
        elMap['L' + i].setAttribute('d', `M${x1} ${y1}Q${qx} ${qy} ${x2} ${y2}`);
      }
      // Gas wisps L5-L8: counter-rotate + drift + undulate
      for (let i = 5; i <= 8; i++) {
        const p = info._wisps['L' + i];
        // Wisp undulation: all 3 points drift gaseously
        const phase1 = now / (2800 + i * 400) * Math.PI * 2 + i * 2.1;
        const phase2 = now / (4200 + i * 300) * Math.PI * 2 + i * 0.7;
        const dqx = Math.sin(phase1) * 1.2;
        const dqy = Math.cos(phase2) * 1.0;
        const [x1, y1] = rot(p.x1, p.y1, wispAngle);
        const [qx, qy] = rot(p.qx + dqx, p.qy + dqy, wispAngle);
        const [x2, y2] = rot(p.x2, p.y2, wispAngle);
        elMap['L' + i].setAttribute('d', `M${x1} ${y1}Q${qx} ${qy} ${x2} ${y2}`);
      }
      // Spiral arms: trailing brightness + opacity pulse
      const trailCycle = 6000;
      const trailPhase = (now % trailCycle) / trailCycle;
      for (let i = 1; i <= 4; i++) {
        const pos = (i - 1) / 4;
        const dist = ((trailPhase - pos) + 1) % 1;
        const trail = 0.3 + 0.7 * Math.max(0, 1 - dist * 2);
        modEl(elMap, state, 'L' + i, trail);
        modLineSW(elMap, state, 'L' + i, 0.5 + 0.7 * trail);
      }
      // Gas wisps: independent gaseous flickering
      for (let i = 5; i <= 8; i++) {
        const g1 = Math.sin(now / (2200 + i * 600) * Math.PI * 2 + i * 1.8);
        const g2 = Math.sin(now / (3800 + i * 400) * Math.PI * 2 + i * 0.5) * 0.4;
        const m = 0.25 + 0.75 * ((g1 + g2) / 1.4 * 0.5 + 0.5);
        modEl(elMap, state, 'L' + i, m);
        modLineSW(elMap, state, 'L' + i, 0.3 + 0.9 * m);
        // Gaseous dash texture — soft, shifting
        const gap = 1.5 + Math.sin(now / (1800 + i * 250) * Math.PI * 2) * 1;
        elMap['L' + i].setAttribute('stroke-dasharray', `2 ${Math.max(0.5, gap).toFixed(1)}`);
        elMap['L' + i].setAttribute('stroke-dashoffset', (now / (500 + i * 60)) % 10);
      }
      // Gas knot nodes C2-C5: drift with rotation + swell/pulse
      for (const [key, [bx, by]] of Object.entries(info._nodes)) {
        const idx = parseInt(key[1]);
        const [rx, ry] = rot(bx, by, spiralAngle);
        // Gaseous drift: small sinusoidal wander
        const wx = Math.sin(now / (3000 + idx * 700) * Math.PI * 2 + idx) * 0.8;
        const wy = Math.cos(now / (3500 + idx * 500) * Math.PI * 2 + idx * 1.3) * 0.8;
        elMap[key].setAttribute('cx', rx + wx);
        elMap[key].setAttribute('cy', ry + wy);
        const gm = Math.sin(now / (2500 + idx * 400) * Math.PI * 2 + idx * 2) * 0.5 + 0.5;
        modEl(elMap, state, key, 0.3 + 0.7 * gm);
        modCircleR(elMap, state, key, 0.5 + 0.8 * gm);
      }
      // Inner mist C6: orbits tightly around vortex eye
      const c6Angle = (now / 4000) * Math.PI * 2;
      const c6R = 2.5 * scale;
      elMap.C6.setAttribute('cx', 12 + Math.cos(c6Angle) * c6R);
      elMap.C6.setAttribute('cy', 12 + Math.sin(c6Angle) * c6R);
      const c6m = Math.sin(now / 1800 * Math.PI * 2) * 0.5 + 0.5;
      modEl(elMap, state, 'C6', 0.3 + 0.7 * c6m);
      modCircleR(elMap, state, 'C6', 0.5 + 0.8 * c6m);
      // Vortex eye C1: deep throb with swell intensity
      const eye = 0.4 + 0.3 * Math.sin(now / 2100 * Math.PI * 2)
                      + 0.3 * Math.sin(now / 3300 * Math.PI * 2);
      const eyeBoost = 1 + swell * 0.4; // brighter during swell
      modEl(elMap, state, 'C1', Math.min(1, (0.4 + 0.6 * eye) * eyeBoost));
      modCircleR(elMap, state, 'C1', (0.6 + 0.6 * eye) * (0.9 + 0.2 * swell));
      // Containment ring P1: scales with swell + gaseous breathing
      const baseSW = state.P1?.sw ?? 0.4;
      const baseR = state.P1?.r ?? 5;
      const breath = Math.sin(now / 4500 * Math.PI * 2) * 0.5 + 0.5;
      const breathFast = Math.sin(now / 2000 * Math.PI * 2) * 0.1;
      if (state.P1?.o > 0) {
        elMap.P1.setAttribute('r', baseR * scale * (0.9 + 0.15 * breath + breathFast));
        elMap.P1.setAttribute('stroke-width', baseSW * (0.5 + 0.8 * breath));
        elMap.P1.setAttribute('stroke-dasharray', '3 2 1 2');
        elMap.P1.setAttribute('stroke-dashoffset', -(now / 250) % 16);
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

  // ── New alien icons ──

  dimension: {
    desc: 'dimensional overlay',
    _rings: [
      // Outer ring endpoints
      { ax: 4, ay: 13, bx: 20, by: 11 },
      // Middle ring endpoints
      { ax: 6, ay: 14, bx: 18, by: 10 },
      // Inner ring endpoints
      { ax: 9, ay: 10, bx: 15, by: 14 },
    ],
    _wisps: {
      L7: { x1: 12, y1: 11, qx: 4, qy: 7, x2: 3, y2: 4 },
      L8: { x1: 12, y1: 13, qx: 20, qy: 17, x2: 21, y2: 20 },
    },
    anim: (elMap, state, now) => {
      const info = ICON_INFO.dimension;
      // Each ring wobbles at a different rate, creating dimensional distortion
      const rates = [7000, 5300, 3700];
      const amps = [1.5, 2.0, 2.5];
      for (let r = 0; r < 3; r++) {
        const ring = info._rings[r];
        const phase = Math.sin(now / rates[r] * Math.PI * 2);
        const drift = phase * amps[r];
        // Wobble the control point Y (arc height) to make rings breathe
        const baseQyTop = r === 0 ? 3 : r === 1 ? 5 : 7;
        const baseQyBot = r === 0 ? 21 : r === 1 ? 19 : 17;
        const qyTop = baseQyTop + drift;
        const qyBot = baseQyBot - drift;
        // Also shift endpoints slightly
        const lateralShift = Math.sin(now / (rates[r] * 0.7)) * (1 + r * 0.3);
        const ax = ring.ax + lateralShift * 0.5;
        const ay = ring.ay + drift * 0.3;
        const bx = ring.bx - lateralShift * 0.5;
        const by = ring.by - drift * 0.3;
        const i1 = r * 2 + 1;
        const i2 = r * 2 + 2;
        elMap['L' + i1].setAttribute('d', `M${ax} ${ay}Q12 ${qyTop} ${bx} ${by}`);
        elMap['L' + i2].setAttribute('d', `M${bx} ${by}Q12 ${qyBot} ${ax} ${ay}`);
        // Per-ring opacity shimmer
        const shimmer = 0.7 + 0.3 * Math.sin(now / (rates[r] * 0.4));
        modEl(elMap, state, 'L' + i1, shimmer);
        modEl(elMap, state, 'L' + i2, shimmer);
      }
      // Energy wisps drift and flicker
      for (const [key, p] of Object.entries(info._wisps)) {
        const t = now / 4000;
        const drift = Math.sin(t * Math.PI * 2) * 1.5;
        elMap[key].setAttribute('d',
          `M${p.x1} ${p.y1}Q${p.qx + drift * 0.5} ${p.qy + drift} ${p.x2 + drift} ${p.y2 + drift * 0.8}`);
        const flick = Math.sin(now / 1700 + (key === 'L7' ? 0 : 2)) * 0.5 + 0.5;
        modEl(elMap, state, key, 0.3 + 0.7 * flick);
      }
      // Center pulses with dimensional energy
      const pulse = Math.sin(now / 2000 * Math.PI * 2) * 0.3 + 0.7;
      modCircleR(elMap, state, 'C1', 0.7 + 0.5 * pulse);
      modEl(elMap, state, 'C1', pulse);
      // Anchor nodes dim pulse
      for (let i = 2; i <= 5; i++) {
        const s = Math.sin(now / (3000 + i * 500)) * 0.5 + 0.5;
        modEl(elMap, state, 'C' + i, 0.3 + 0.7 * s);
      }
      // Ring breathes
      const ringBreath = Math.sin(now / 6000 * Math.PI * 2) * 0.5 + 0.5;
      elMap.P1.setAttribute('r', 9 + ringBreath * 1);
      modEl(elMap, state, 'P1', 0.1 + 0.1 * ringBreath);
    },
  },

  thorn: {
    desc: 'organic thorny growth',
    // Branch definitions: origin, base tip, control point, phase delay, line index
    _branches: [
      { ox: 12, oy: 10, tx: 20, ty: 5, qx: 16, qy: 8, phase: 0, li: 2 },       // right branch
      { ox: 11.5, oy: 14, tx: 3, ty: 10, qx: 7, qy: 13, phase: 0.15, li: 3 },   // left branch
      { ox: 11.8, oy: 16, tx: 18, ty: 19, qx: 15, qy: 17, phase: 0.25, li: 4 },  // secondary right
    ],
    _barbs: [
      { parent: 0, bx: 20, by: 5, tx: 17, ty: 4, qx: 19, qy: 3, li: 5 },
      { parent: 1, bx: 3, by: 10, tx: 4, ty: 13, qx: 2.5, qy: 12, li: 6 },
    ],
    anim: (elMap, state, now) => {
      const info = ICON_INFO.thorn;
      const cycle = 6000;
      const t = (now % cycle) / cycle;
      // Asymmetric growth: 40% rise, 60% slow retract
      const masterGrowth = t < 0.4
        ? 0.5 * (1 - Math.cos(Math.PI * t / 0.4))
        : 0.5 * (1 + Math.cos(Math.PI * (t - 0.4) / 0.6));

      // Stem L1 — organic sway
      const stemSway = Math.sin(now / 4000) * 0.8;
      elMap.L1.setAttribute('d', `M11 20Q${11.5 + stemSway * 0.3} 14 12 ${6 - masterGrowth * 1.5}`);
      modEl(elMap, state, 'L1', 0.55 + 0.2 * masterGrowth);

      // Per-branch staggered growth + perpendicular sway
      for (const b of info._branches) {
        const localT = ((now / cycle) - b.phase + 100) % 1;
        const lg = localT < 0.4
          ? 0.5 * (1 - Math.cos(Math.PI * localT / 0.4))
          : 0.5 * (1 + Math.cos(Math.PI * (localT - 0.4) / 0.6));
        const ext = 0.7 + 0.3 * lg;
        const sway = Math.sin(now / (3000 + b.phase * 4000)) * 0.6;
        const dx = b.ty - b.oy, dy = -(b.tx - b.ox);
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const tipX = b.ox + (b.tx - b.ox) * ext + (dx / len) * sway;
        const tipY = b.oy + (b.ty - b.oy) * ext + (dy / len) * sway;
        const qx = b.ox + (b.qx - b.ox) * ext + (dx / len) * sway * 0.5;
        const qy = b.oy + (b.qy - b.oy) * ext + (dy / len) * sway * 0.5;
        elMap['L' + b.li].setAttribute('d', `M${b.ox} ${b.oy}Q${qx} ${qy} ${tipX} ${tipY}`);
        modEl(elMap, state, 'L' + b.li, 0.35 + 0.4 * lg);
        elMap['C' + b.li].setAttribute('cx', tipX);
        elMap['C' + b.li].setAttribute('cy', tipY);
        modCircleR(elMap, state, 'C' + b.li, 0.3 + 0.5 * lg);
        modEl(elMap, state, 'C' + b.li, 0.2 + 0.5 * lg);
      }

      // Barb hooks — lag behind parent branch
      for (const barb of info._barbs) {
        const pb = info._branches[barb.parent];
        const pT = ((now / cycle) - pb.phase + 100) % 1;
        const pg = pT < 0.4 ? 0.5 * (1 - Math.cos(Math.PI * pT / 0.4))
          : 0.5 * (1 + Math.cos(Math.PI * (pT - 0.4) / 0.6));
        const barbExt = pg > 0.3 ? (pg - 0.3) / 0.7 : 0;
        const bx = barb.bx + (barb.tx - barb.bx) * barbExt;
        const by = barb.by + (barb.ty - barb.by) * barbExt;
        const bqx = barb.bx + (barb.qx - barb.bx) * barbExt;
        const bqy = barb.by + (barb.qy - barb.by) * barbExt;
        elMap['L' + barb.li].setAttribute('d', `M${barb.bx} ${barb.by}Q${bqx} ${bqy} ${bx} ${by}`);
        modEl(elMap, state, 'L' + barb.li, 0.15 + 0.4 * barbExt);
      }

      // Spur L7
      const spurExt = 0.6 + 0.4 * masterGrowth;
      const spurTX = 11.8 + (15.5 - 11.8) * spurExt;
      const spurTY = 8 + (4 - 8) * spurExt;
      elMap.L7.setAttribute('d', `M11.8 8Q14 6 ${spurTX} ${spurTY}`);
      modEl(elMap, state, 'L7', 0.15 + 0.25 * masterGrowth);
      elMap.C5.setAttribute('cx', spurTX);
      elMap.C5.setAttribute('cy', spurTY);
      modEl(elMap, state, 'C5', 0.1 + 0.25 * masterGrowth);

      // Root tendril L8
      const rootSway = Math.sin(now / 5000) * 1.2;
      elMap.L8.setAttribute('d', `M11 20Q${8 + rootSway} 21 ${6 + rootSway * 0.5} 20`);
      modEl(elMap, state, 'L8', 0.15 + 0.15 * (Math.sin(now / 3500) * 0.5 + 0.5));
      elMap.C6.setAttribute('cx', 6 + rootSway * 0.5);
      modEl(elMap, state, 'C6', 0.1 + 0.15 * masterGrowth);

      // Central node C1 breathes with growth
      modCircleR(elMap, state, 'C1', 0.8 + 0.4 * masterGrowth + 0.2 * Math.sin(now / 2000));
      modEl(elMap, state, 'C1', 0.5 + 0.3 * masterGrowth);
      // P1 ring
      modEl(elMap, state, 'P1', 0.08 + 0.1 * masterGrowth);
    },
  },

  knot: {
    desc: 'figure-8 infinity knot',
    // 4-segment figure-8 loop: L1(over) → L2(under) → L3(over) → L4(under)
    _segs: [
      { x1: 12, y1: 10, qx: 6, qy: 4, x2: 5, y2: 10, baseO: 0.7 },     // left top OVER
      { x1: 5, y1: 10, qx: 4, qy: 16, x2: 12, y2: 14, baseO: 0.35 },    // left bottom UNDER
      { x1: 12, y1: 14, qx: 18, qy: 20, x2: 19, y2: 14, baseO: 0.7 },   // right bottom OVER
      { x1: 19, y1: 14, qx: 20, qy: 8, x2: 12, y2: 10, baseO: 0.35 },   // right top UNDER
    ],
    anim: (elMap, state, now) => {
      const info = ICON_INFO.knot;
      const segs = info._segs;
      // Energy pulse travels 4-segment loop (3000ms)
      const cycle = 3000;
      const t = (now % cycle) / cycle;
      const headPos = t * 4;

      // Gentle tighten/loosen — control points breathe toward/away from center
      const breathe = Math.sin(now / 5000 * Math.PI * 2) * 0.12;

      for (let i = 0; i < 4; i++) {
        const s = segs[i];
        // Pulse brightness for this segment
        let dist = headPos - i;
        if (dist < 0) dist += 4;
        const pulse = dist < 1.5 ? Math.max(0, 1 - dist / 1.5) : 0;
        // Over segments stay bright, under stay dim; pulse adds on top
        const opacity = s.baseO + 0.3 * pulse;
        modEl(elMap, state, 'L' + (i + 1), opacity);
        modLineSW(elMap, state, 'L' + (i + 1), 0.9 + 0.4 * pulse);

        // Breathe control points toward/away from center (12,12)
        const qx = s.qx + (12 - s.qx) * breathe;
        const qy = s.qy + (12 - s.qy) * breathe;
        elMap['L' + (i + 1)].setAttribute('d',
          `M${s.x1} ${s.y1}Q${qx} ${qy} ${s.x2} ${s.y2}`);
      }

      // Inner traces L5-L8 follow pulse with slight delay
      for (let i = 0; i < 4; i++) {
        let dist = headPos - i - 0.3; // slight delay
        if (dist < 0) dist += 4;
        const pulse = dist < 1.2 ? Math.max(0, 1 - dist / 1.2) : 0;
        modEl(elMap, state, 'L' + (i + 5), 0.12 + 0.25 * pulse);
      }

      // Crossing nodes flash as pulse passes
      // C1 center — flashes twice per cycle (at crossings)
      const c1dist1 = headPos < 1 ? headPos : (headPos > 2 && headPos < 3 ? headPos - 2 : 2);
      const c1flash = Math.max(
        headPos < 0.8 ? 1 - headPos / 0.8 : 0,
        (headPos > 2 && headPos < 2.8) ? 1 - (headPos - 2) / 0.8 : 0
      );
      modCircleR(elMap, state, 'C1', 0.7 + 0.6 * c1flash);
      modEl(elMap, state, 'C1', 0.5 + 0.4 * c1flash);

      // C2 left apex — flashes when pulse at segment 0-1 junction
      let d2 = Math.abs(headPos - 1);
      if (d2 > 2) d2 = 4 - d2;
      const c2flash = d2 < 0.6 ? 1 - d2 / 0.6 : 0;
      modCircleR(elMap, state, 'C2', 0.4 + 0.4 * c2flash);
      modEl(elMap, state, 'C2', 0.3 + 0.4 * c2flash);

      // C3 right apex — flashes when pulse at segment 2-3 junction
      let d3 = Math.abs(headPos - 3);
      if (d3 > 2) d3 = 4 - d3;
      const c3flash = d3 < 0.6 ? 1 - d3 / 0.6 : 0;
      modCircleR(elMap, state, 'C3', 0.4 + 0.4 * c3flash);
      modEl(elMap, state, 'C3', 0.3 + 0.4 * c3flash);

      // Strand markers C4-C5 — subtle shimmer
      modEl(elMap, state, 'C4', 0.15 + 0.15 * Math.sin(now / 2000));
      modEl(elMap, state, 'C5', 0.15 + 0.15 * Math.sin(now / 2300 + 1));

      // P1 ring subtle glow
      modEl(elMap, state, 'P1', 0.08 + 0.06 * Math.sin(now / 3000));
    },
  },

  gate: {
    desc: 'dimensional threshold',
    anim: (elMap, state, now) => {
      // Master open/close cycle — ~12s
      const openness = Math.sin(now / 12000 * Math.PI * 2) * 0.5 + 0.5;
      // Pillar shimmer — intensifies when open
      const shimAmp = 0.1 + 0.15 * openness;
      const pillarShimmer = Math.sin(now / 3500 * Math.PI * 2) * shimAmp;
      modEl(elMap, state, 'L1', 0.65 + pillarShimmer);
      modEl(elMap, state, 'L2', 0.65 - pillarShimmer);
      // Arch breathes — stronger when open
      const archBreath = Math.sin(now / 4000 * Math.PI * 2) * 0.5 + 0.5;
      modEl(elMap, state, 'L3', 0.4 + 0.2 * archBreath + 0.2 * openness);
      modLineSW(elMap, state, 'L3', 0.8 + 0.4 * archBreath);
      // Door swing — L4 left door, L5 right door
      // Left door: hinge at (7,20), tip swings from (12,13) → (4,13)
      const leftTipX = 12 - openness * 8;
      const leftQx = 7 + (leftTipX - 7) * 0.5;
      const leftQy = 20 + (13 - 20) * 0.5;
      elMap.L4.setAttribute('d', `M7 20Q${leftQx} ${leftQy} ${leftTipX} 13`);
      elMap.L4.setAttribute('opacity', 0.5 - 0.3 * openness);
      // Right door: hinge at (17,20), tip swings from (12,13) → (20,13)
      const rightTipX = 12 + openness * 8;
      const rightQx = 17 + (rightTipX - 17) * 0.5;
      const rightQy = 20 + (13 - 20) * 0.5;
      elMap.L5.setAttribute('d', `M17 20Q${rightQx} ${rightQy} ${rightTipX} 13`);
      elMap.L5.setAttribute('opacity', 0.5 - 0.3 * openness);
      // Inner energy line L6 — appears when open, drifts upward
      const enT = (now % 5000) / 5000;
      const enY = 16 - enT * 8 * openness;
      const enFade = enT < 0.7 ? 1 : 1 - (enT - 0.7) / 0.3;
      elMap.L6.setAttribute('d', `M9 ${enY}Q12 ${enY} 15 ${enY}`);
      elMap.L6.setAttribute('opacity', openness * 0.3 * enFade);
      // Rune marks — brighter when open
      const r7 = Math.sin(now / 2700 + 0.5) * 0.5 + 0.5;
      const r8 = Math.sin(now / 3100 + 1.5) * 0.5 + 0.5;
      modEl(elMap, state, 'L7', 0.15 + 0.25 * r7 * (0.5 + 0.5 * openness));
      modEl(elMap, state, 'L8', 0.15 + 0.25 * r8 * (0.5 + 0.5 * openness));
      // Keystone — dim when closed, bright beacon when open
      const keyPulse = Math.sin(now / 2500 * Math.PI * 2) * 0.5 + 0.5;
      const keyBright = 0.3 + 0.7 * openness;
      modCircleR(elMap, state, 'C1', 0.5 + 0.7 * keyPulse * keyBright);
      modEl(elMap, state, 'C1', keyBright * (0.5 + 0.5 * keyPulse));
      // Base nodes steady
      modEl(elMap, state, 'C2', 0.4 + 0.15 * Math.sin(now / 4000));
      modEl(elMap, state, 'C3', 0.4 + 0.15 * Math.sin(now / 4300));
      // Inner void C4 — appears when open
      const voidPulse = Math.sin(now / 6000 * Math.PI * 2) * 0.5 + 0.5;
      modCircleR(elMap, state, 'C4', openness * (0.5 + 0.6 * voidPulse));
      modEl(elMap, state, 'C4', openness * (0.2 + 0.35 * voidPulse));
      // Floating node C5 — drifts upward only when open
      if (openness > 0.3) {
        const floatT = (now % 7000) / 7000;
        const floatY = 17 - floatT * 10;
        const floatFade = floatT < 0.8 ? Math.min(1, floatT * 4) : 1 - (floatT - 0.8) / 0.2;
        elMap.C5.setAttribute('cy', floatY);
        elMap.C5.setAttribute('opacity', openness * 0.2 * floatFade);
        elMap.C5.setAttribute('r', 0.3 + 0.2 * floatFade);
      } else {
        elMap.C5.setAttribute('opacity', 0);
      }
      // P1 inner glow — grows with openness
      elMap.P1.setAttribute('opacity', 0.08 + 0.2 * openness);
      elMap.P1.setAttribute('stroke-width', 0.3 + 0.3 * openness);
    },
  },

  portal: {
    desc: 'dimensional rift',
    // Base rift edge coordinates for left (L1-L3) and right (L4-L6) sides
    _leftEdge: [
      { x1: 10, y1: 3, qx: 8, qy: 6, x2: 11, y2: 8 },
      { x1: 11, y1: 8, qx: 9, qy: 12, x2: 10.5, y2: 14 },
      { x1: 10.5, y1: 14, qx: 8.5, qy: 18, x2: 11, y2: 21 },
    ],
    _rightEdge: [
      { x1: 14, y1: 3, qx: 16, qy: 6, x2: 13, y2: 8 },
      { x1: 13, y1: 8, qx: 15, qy: 12, x2: 13.5, y2: 14 },
      { x1: 13.5, y1: 14, qx: 15.5, qy: 18, x2: 13, y2: 21 },
    ],
    anim: (elMap, state, now) => {
      const info = ICON_INFO.portal;
      // Master open/close cycle — ~14s
      const openness = Math.sin(now / 14000 * Math.PI * 2) * 0.5 + 0.5;
      const sep = openness * 3; // edge separation distance

      // Left rift edge L1-L3 — shift left, add jitter
      for (let i = 0; i < 3; i++) {
        const e = info._leftEdge[i];
        const jit = openness * Math.sin(now / (200 + i * 70)) * 0.4;
        const off = -sep + jit;
        elMap['L' + (i + 1)].setAttribute('d',
          `M${e.x1 + off} ${e.y1}Q${e.qx + off} ${e.qy} ${e.x2 + off} ${e.y2}`);
        modEl(elMap, state, 'L' + (i + 1), 0.45 + 0.25 * openness);
      }

      // Right rift edge L4-L6 — shift right, add jitter
      for (let i = 0; i < 3; i++) {
        const e = info._rightEdge[i];
        const jit = openness * Math.sin(now / (220 + i * 80)) * 0.4;
        const off = sep + jit;
        elMap['L' + (i + 4)].setAttribute('d',
          `M${e.x1 + off} ${e.y1}Q${e.qx + off} ${e.qy} ${e.x2 + off} ${e.y2}`);
        modEl(elMap, state, 'L' + (i + 4), 0.45 + 0.25 * openness);
      }

      // Seal marks L7-L8 — fade out with opening; become energy wisps when open
      if (openness < 0.4) {
        // Sealed: show seal marks
        const sealO = (1 - openness / 0.4);
        const flick = Math.sin(now / 1500) * 0.08;
        elMap.L7.setAttribute('opacity', 0.4 * sealO + flick);
        elMap.L8.setAttribute('opacity', 0.35 * sealO - flick);
        // Reset seal positions
        elMap.L7.setAttribute('d', `M${10.5 - sep} 9Q12 9 ${13.5 + sep} 9`);
        elMap.L8.setAttribute('d', `M${10 - sep} 15Q12 15 ${14 + sep} 15`);
      } else {
        // Open: energy wisps escaping upward/downward
        const wispT = (openness - 0.4) / 0.6;
        const drift1 = Math.sin(now / 2500) * 2 * wispT;
        const drift2 = Math.sin(now / 3200 + 1) * 2 * wispT;
        elMap.L7.setAttribute('d',
          `M12 ${9 - drift1 * 2}Q${9 + drift1} ${6 - drift1} ${7 + drift1} ${3 - drift1}`);
        elMap.L7.setAttribute('opacity', 0.35 * wispT);
        elMap.L7.setAttribute('stroke-dasharray', '2 3');
        elMap.L8.setAttribute('d',
          `M12 ${15 + drift2 * 2}Q${15 - drift2} ${18 + drift2} ${17 - drift2} ${21 + drift2}`);
        elMap.L8.setAttribute('opacity', 0.3 * wispT);
        elMap.L8.setAttribute('stroke-dasharray', '2 3');
      }

      // Center void C1 — grows bright as rift opens
      const voidR = 0.5 + 2 * openness;
      const voidO = 0.15 + 0.7 * openness;
      const voidPulse = Math.sin(now / 2000 * Math.PI * 2) * 0.15 * openness;
      elMap.C1.setAttribute('r', voidR + voidPulse);
      elMap.C1.setAttribute('opacity', voidO + voidPulse);

      // Rift tip nodes C2-C5 shift with their edges
      elMap.C2.setAttribute('cx', 10 - sep);
      elMap.C3.setAttribute('cx', 14 + sep);
      elMap.C4.setAttribute('cx', 11 - sep);
      elMap.C5.setAttribute('cx', 13 + sep);
      for (let i = 2; i <= 5; i++) {
        const s = Math.sin(now / (2200 + i * 300) + i) * 0.5 + 0.5;
        modEl(elMap, state, 'C' + i, 0.3 + 0.25 * openness * s);
      }

      // Seal nodes C6-C7 — dissolve with seals
      const sealNodeO = Math.max(0, 1 - openness * 2.5);
      modEl(elMap, state, 'C6', 0.3 * sealNodeO);
      modEl(elMap, state, 'C7', 0.3 * sealNodeO);

      // P1 containment ring
      elMap.P1.setAttribute('opacity', 0.06 + 0.15 * openness);
      elMap.P1.setAttribute('stroke-width', 0.3 + 0.3 * openness);
    },
  },

  wave: {
    desc: 'flowing current',
    // Base control point Y offsets for each wave pair — staggered junction x
    _waves: [
      { y: 7, qyUp: 3, qyDown: 11, sw: 1.2, jx: 11.5 },   // top wave
      { y: 12, qyUp: 8, qyDown: 16, sw: 1.0, jx: 12 },     // middle wave
      { y: 17, qyUp: 13, qyDown: 21, sw: 0.8, jx: 12.5 },   // bottom wave
    ],
    anim: (elMap, state, now) => {
      const info = ICON_INFO.wave;
      // Waves travel horizontally — phase shifts create motion
      for (let w = 0; w < 3; w++) {
        const wv = info._waves[w];
        const speed = 3000 + w * 400;
        const phase = now / speed * Math.PI * 2;
        const shift = Math.sin(phase) * 2;
        const ampMod = 0.8 + 0.2 * Math.sin(now / (5000 + w * 700));
        const qyUp = wv.y - (wv.y - wv.qyUp) * ampMod + shift * 0.3;
        const qyDown = wv.y + (wv.qyDown - wv.y) * ampMod - shift * 0.3;
        const hShift = Math.sin(phase * 0.7) * 1;
        const i1 = w * 2 + 1;
        const i2 = w * 2 + 2;
        const jx = wv.jx; // staggered junction x
        elMap['L' + i1].setAttribute('d',
          `M3 ${wv.y + shift * 0.5}Q${7.5 + hShift} ${qyUp} ${jx} ${wv.y}`);
        elMap['L' + i2].setAttribute('d',
          `M${jx} ${wv.y}Q${16.5 - hShift} ${qyDown} 21 ${wv.y - shift * 0.5}`);
        // Traveling brightness
        const brightPhase = Math.sin(phase + w * 0.6) * 0.5 + 0.5;
        modEl(elMap, state, 'L' + i1, 0.3 + 0.5 * brightPhase);
        modEl(elMap, state, 'L' + i2, 0.3 + 0.5 * (1 - brightPhase));
        modLineSW(elMap, state, 'L' + i1, 0.8 + 0.3 * brightPhase);
        modLineSW(elMap, state, 'L' + i2, 0.8 + 0.3 * (1 - brightPhase));
      }
      // Connecting wisps drift gently
      const wispDrift = Math.sin(now / 3500) * 1;
      elMap.L7.setAttribute('d',
        `M7 ${9 + wispDrift}Q${8 + wispDrift * 0.3} 10 7 ${14 - wispDrift}`);
      elMap.L8.setAttribute('d',
        `M17 ${9 - wispDrift}Q${16 - wispDrift * 0.3} 10 17 ${14 + wispDrift}`);
      modEl(elMap, state, 'L7', 0.1 + 0.15 * Math.sin(now / 2200));
      modEl(elMap, state, 'L8', 0.1 + 0.15 * Math.sin(now / 2600));
      // Center node throbs
      const throb = Math.sin(now / 3000 * Math.PI * 2) * 0.5 + 0.5;
      modCircleR(elMap, state, 'C1', 0.6 + 0.5 * throb);
      modEl(elMap, state, 'C1', 0.4 + 0.4 * throb);
      // Origin/endpoint nodes — subtle independent pulse
      for (let i = 2; i <= 6; i++) {
        const s = Math.sin(now / (2500 + i * 300) + i) * 0.5 + 0.5;
        modEl(elMap, state, 'C' + i, 0.2 + 0.3 * s);
      }
      // Ring subtle breathing
      modEl(elMap, state, 'P1', 0.08 + 0.06 * throb);
    },
  },

  coil: {
    desc: 'helix rune',
    // Base strand endpoints for full rotation
    _baseA: { topX: 8, botX: 16 },  // strand A: top-left → bottom-right
    _baseB: { topX: 16, botX: 8 },  // strand B: top-right → bottom-left
    _rungYs: [6, 10, 14, 18],
    anim: (elMap, state, now) => {
      const PI2 = Math.PI * 2;
      // Full rotation angle — endpoints swap positions sinusoidally
      const twist = now / 4000 * PI2;
      const sin = Math.sin(twist);
      const cos = Math.cos(twist);
      // Strand A top x rotates: 8→12→16→12→8 (sinusoidal around center 12)
      const aTopX = 12 + sin * -4;    // starts at 8 (sin=0→ -4+12=8... wait, need offset)
      const aBotX = 12 + sin * 4;     // mirrors: starts at 16
      // Strand B mirrors: top at 16→12→8→12→16
      const bTopX = 12 + sin * 4;
      const bBotX = 12 + sin * -4;
      // Control points curve opposite to endpoint motion
      const aTopQx = 12 - cos * 6;    // when endpoint right, ctrl curves left
      const aBotQx = 12 + cos * 6;
      const bTopQx = 12 + cos * 6;
      const bBotQx = 12 - cos * 6;
      // Build strand paths — each strand is two halves meeting at center
      elMap.L1.setAttribute('d', `M${aTopX} 3Q${aTopQx} 8 12 12`);
      elMap.L2.setAttribute('d', `M12 12Q${aBotQx} 16 ${aBotX} 21`);
      elMap.L3.setAttribute('d', `M${bTopX} 3Q${bTopQx} 8 12 12`);
      elMap.L4.setAttribute('d', `M12 12Q${bBotQx} 16 ${bBotX} 21`);
      // Opacity crossfade — one strand appears "in front" while other dims
      const crossFade = sin * 0.5 + 0.5;
      modEl(elMap, state, 'L1', 0.25 + 0.55 * crossFade);
      modEl(elMap, state, 'L2', 0.25 + 0.55 * crossFade);
      modEl(elMap, state, 'L3', 0.25 + 0.55 * (1 - crossFade));
      modEl(elMap, state, 'L4', 0.25 + 0.55 * (1 - crossFade));
      // Cross-rungs track strand positions at each y-level
      // Evaluate quadratic bezier x at parameter t for given y
      const rungYs = ICON_INFO.coil._rungYs;
      for (let i = 0; i < 4; i++) {
        const y = rungYs[i];
        // Parameter along strand for this y (top=3, mid=12, bot=21)
        const tParam = (y - 3) / 18;
        // Strand A x at this y: lerp top→12→bot based on which half
        let axAtY, bxAtY;
        if (tParam <= 0.5) {
          const lt = tParam * 2;
          axAtY = aTopX * (1-lt)*(1-lt) + aTopQx * 2*lt*(1-lt) + 12 * lt*lt;
          bxAtY = bTopX * (1-lt)*(1-lt) + bTopQx * 2*lt*(1-lt) + 12 * lt*lt;
        } else {
          const lt = (tParam - 0.5) * 2;
          axAtY = 12 * (1-lt)*(1-lt) + aBotQx * 2*lt*(1-lt) + aBotX * lt*lt;
          bxAtY = 12 * (1-lt)*(1-lt) + bBotQx * 2*lt*(1-lt) + bBotX * lt*lt;
        }
        const mx = (axAtY + bxAtY) / 2;
        elMap['L' + (i + 5)].setAttribute('d',
          `M${axAtY} ${y}Q${mx} ${y} ${bxAtY} ${y}`);
        // Rungs pulse sequentially
        const rungPhase = Math.sin(now / 2500 * PI2 + i * PI2 / 4) * 0.5 + 0.5;
        modEl(elMap, state, 'L' + (i + 5), 0.15 + 0.5 * rungPhase);
        modLineSW(elMap, state, 'L' + (i + 5), 0.5 + 0.6 * rungPhase);
      }
      // End nodes follow strand endpoints
      elMap.C2.setAttribute('cx', aTopX);
      elMap.C3.setAttribute('cx', bTopX);
      elMap.C4.setAttribute('cx', aBotX);
      elMap.C5.setAttribute('cx', bBotX);
      for (let i = 2; i <= 5; i++) {
        const s = Math.sin(now / (2000 + i * 400) + i) * 0.5 + 0.5;
        modEl(elMap, state, 'C' + i, 0.3 + 0.4 * s);
      }
      // Center crossing throbs
      const throb = Math.sin(now / 2000 * PI2) * 0.5 + 0.5;
      modCircleR(elMap, state, 'C1', 0.7 + 0.5 * throb);
      modEl(elMap, state, 'C1', 0.5 + 0.5 * throb);
      // P1 ring
      modEl(elMap, state, 'P1', 0.1 + 0.08 * throb);
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

  arrive(method) {
    if (this.status !== 'gone') return;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.status = 'arriving';
    this._notify();

    const arriveMethod = method || this.departMethod;
    const from = arriveMethod === 'converge' ? convergeState : dissipateState;
    const colFrom = arriveMethod === 'converge' ? COL.converge : COL.dissipate;

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

    const card = document.createElement('div');
    card.className = 'browser-card';

    // Stage on top
    const { div: stage, svg } = makeStage();
    const elMap = buildMorphSVG(svg);
    const ctrl = new IconCtrl(key, stage, elMap);
    card.appendChild(stage);

    // Info
    const infoDiv = document.createElement('div');
    infoDiv.className = 'browser-card-info';
    const nameEl = document.createElement('span');
    nameEl.className = 'browser-name';
    nameEl.textContent = key;
    const descEl = document.createElement('span');
    descEl.className = 'browser-desc';
    descEl.textContent = info.desc;
    infoDiv.appendChild(nameEl);
    infoDiv.appendChild(descEl);
    card.appendChild(infoDiv);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'browser-controls';

    const playBtn = btn('\u25b6', () => ctrl.togglePlay());
    const convBtn = btn('\u21d3', () => ctrl.depart('converge'));
    const dissBtn = btn('\u21d1', () => ctrl.depart('dissipate'));
    // Two return buttons — one for each return method
    const retConvBtn = btn('\u21d3\u21bb', () => ctrl.arrive('converge'));
    const retDissBtn = btn('\u21d1\u21bb', () => ctrl.arrive('dissipate'));
    retConvBtn.style.display = 'none';
    retDissBtn.style.display = 'none';

    controls.appendChild(playBtn);
    controls.appendChild(convBtn);
    controls.appendChild(dissBtn);
    controls.appendChild(retConvBtn);
    controls.appendChild(retDissBtn);
    card.appendChild(controls);

    // State machine → update controls
    ctrl.onUpdate = (status) => {
      const visible = status === 'idle' || status === 'playing';
      const gone = status === 'gone';
      const busy = status === 'departing' || status === 'arriving';

      playBtn.textContent = status === 'playing' ? '\u23f8' : '\u25b6';
      playBtn.style.display = visible ? '' : 'none';
      convBtn.style.display = visible ? '' : 'none';
      dissBtn.style.display = visible ? '' : 'none';
      retConvBtn.style.display = gone ? '' : 'none';
      retDissBtn.style.display = gone ? '' : 'none';

      playBtn.disabled = busy;
      convBtn.disabled = busy;
      dissBtn.disabled = busy;
      retConvBtn.disabled = busy;
      retDissBtn.disabled = busy;
    };

    list.appendChild(card);
  }

  details.appendChild(list);
  browser.appendChild(details);
}
