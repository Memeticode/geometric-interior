// ══════════════════════════════════════════════════════════════
// Static Animation Engine — lightweight RAF-driven animations
// for SVG icons that don't use the 16-primitive morph system
// ══════════════════════════════════════════════════════════════

import {
  ARROW_UP_SVG, ARROW_DOWN_SVG, ARROW_LEFT_SVG, ARROW_RIGHT_SVG,
  DBL_ARROW_LEFT_SVG, DBL_ARROW_RIGHT_SVG,
  TRASH_SVG, RESTORE_SVG, EDIT_SVG, ADD_SVG, CLOSE_SVG, FULLSCREEN_SVG,
  SAVE_SVG, UNDO_SVG, REDO_SVG, RANDOMIZE_SVG, RENDER_SVG, SETTINGS_SVG,
  DOWNLOAD_SVG, IMAGE_SVG, BUNDLE_SVG,
  ERROR_SVG, RETRY_SVG, WARNING_SVG,
  DOT_SVG, FIELD_DIAMOND_SVG,
  RES_270_SVG, RES_540_SVG, RES_900_SVG, RES_1080_SVG, RES_1620_SVG, RES_4K_SVG,
  SHARE_SVG, LINK_SVG, TEXT_SVG, EMAIL_SVG,
  BLUESKY_SVG, FACEBOOK_SVG, GOOGLE_SVG, LINKEDIN_SVG, REDDIT_SVG, TWITTER_SVG,
  GITHUB_SVG,
  ALT_TEXT_SVG, TEXT_SHORT_SVG, CREATE_SVG, CONSTRUCT_SVG,
} from './icons.js';

// ── Animation implementations ──

function breathe(children, config, now) {
  const period = config.period || 3000;
  const min = config.min || 0.65;
  const max = config.max || 1;
  const f = config._fade ?? 1;
  for (let i = 0; i < children.length; i++) {
    const phase = (i / children.length) * Math.PI * 0.6;
    const t = (Math.sin(now / period + phase) + 1) / 2;
    const o = min + (max - min) * t;
    children[i].setAttribute('opacity', 1 + (o - 1) * f);
  }
}

function pulse(children, config, now) {
  const period = config.period || 2500;
  const min = config.min || 0.96;
  const max = config.max || 1.04;
  const f = config._fade ?? 1;
  const t = (Math.sin(now / period) + 1) / 2;
  const s = 1 + (min + (max - min) * t - 1) * f;
  const o = 1 + (0.7 + 0.3 * t - 1) * f;
  for (const child of children) {
    child.setAttribute('transform', `translate(8 8) scale(${s}) translate(-8 -8)`);
    child.setAttribute('opacity', o);
  }
}

function shimmer(children, config, now) {
  const period = config.period || 2000;
  const speed = config.speed || 0.003;
  const f = config._fade ?? 1;
  for (let i = 0; i < children.length; i++) {
    const wave = Math.sin(now * speed - i * 0.5);
    const o = 0.55 + 0.45 * ((wave + 1) / 2);
    children[i].setAttribute('opacity', 1 + (o - 1) * f);
  }
}

function drift(children, config, now) {
  const amp = config.amp || 0.4;
  const period = config.period || 4000;
  const f = config._fade ?? 1;
  for (let i = 0; i < children.length; i++) {
    const px = (i + 1) * 1.7;
    const py = (i + 1) * 2.3;
    const dx = Math.sin(now / period + px) * amp * f;
    const dy = Math.cos(now / (period * 1.3) + py) * amp * f;
    children[i].setAttribute('transform', `translate(${dx} ${dy})`);
  }
}

function spin(children, config, now) {
  const period = config.period || 10000;
  const cx = config.cx || 8;
  const cy = config.cy || 8;
  const f = config._fade ?? 1;
  const angle = ((now / period) * 360 % 360) * f;
  for (const child of children) {
    child.setAttribute('transform', `rotate(${angle} ${cx} ${cy})`);
  }
}

function twinkle(children, config, now) {
  const period = config.period || 1800;
  const f = config._fade ?? 1;
  for (let i = 0; i < children.length; i++) {
    const phase = i * 2.1 + i * i * 0.3;
    const t = (Math.sin(now / period + phase) + 1) / 2;
    const o = 0.5 + 0.5 * t;
    children[i].setAttribute('opacity', 1 + (o - 1) * f);
  }
}

// ── Social icon animations (unique per icon) ──

function radiate(children, config, now) {
  const period = config.period || 3000;
  const f = config._fade ?? 1;
  for (let i = 0; i < children.length; i++) {
    const tag = children[i].tagName;
    if (tag === 'circle') {
      const phase = i * (Math.PI * 2 / 3);
      const t = (Math.sin(now / period + phase) + 1) / 2;
      const scale = 1 + (0.85 + 0.3 * t - 1) * f;
      const cx = parseFloat(children[i].getAttribute('cx'));
      const cy = parseFloat(children[i].getAttribute('cy'));
      children[i].setAttribute('transform', `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`);
      children[i].setAttribute('opacity', 1 + (0.6 + 0.4 * t - 1) * f);
    } else {
      const t = (Math.sin(now / (period * 0.7) + Math.PI) + 1) / 2;
      const o = 0.5 + 0.5 * t;
      children[i].setAttribute('opacity', 1 + (o - 1) * f);
    }
  }
}

function tug(children, config, now) {
  const period = config.period || 2500;
  const amp = config.amp || 0.6;
  const f = config._fade ?? 1;
  const raw = (Math.sin(now / period) + 1) / 2;
  const t = raw < 0.5
    ? 4 * raw * raw * raw
    : 1 - Math.pow(-2 * raw + 2, 3) / 2;
  const offset = t * amp * f;
  const rot = t * 4 * f; // slight rotation as links separate
  if (children.length >= 2) {
    // Pull apart diagonally: upper-right link goes up-right, lower-left goes down-left
    children[0].setAttribute('transform', `translate(${offset} ${-offset}) rotate(${-rot} 8 8)`);
    children[1].setAttribute('transform', `translate(${-offset} ${offset}) rotate(${rot} 8 8)`);
  }
}

function unfold(children, config, now) {
  const period = config.period || 3500;
  const maxAngle = config.maxAngle || 12;
  const f = config._fade ?? 1;
  const t = (Math.sin(now / period) + 1) / 2;
  if (children.length >= 3) {
    // 3-part envelope: [0] body, [1] inner V, [2] flap
    // Flap opens (rotates around top edge), inner V fades in as flap lifts
    children[2].setAttribute('transform', `rotate(${-maxAngle * t * f} 8 5)`);
    children[1].setAttribute('opacity', 1 + (0.3 + 0.7 * t - 1) * f);
    children[0].setAttribute('opacity', 1 + (0.85 + 0.15 * t - 1) * f);
  } else if (children.length >= 2) {
    children[1].setAttribute('transform', `rotate(${-maxAngle * t * f} 8 5)`);
    children[0].setAttribute('opacity', 1 + (0.8 + 0.2 * t - 1) * f);
  }
}

function flutter(children, config, now) {
  const period = config.period || 1200;
  const cx = config.cx || 8;
  const cy = config.cy || 8;
  const f = config._fade ?? 1;
  // Asymmetric bob: gentle lift on downstroke, slower descent
  const bobPhase = (now / (period * 1.7)) % (Math.PI * 2);
  const yBob = (Math.sin(bobPhase) * 0.5 + Math.sin(bobPhase * 2.3) * 0.2) * f;
  // Slight body tilt follows the bob
  const tilt = Math.sin(bobPhase * 0.8) * 1.5 * f;
  if (children.length === 2) {
    // Asymmetric flap: quick downstroke (scaleX→0.55), slow upstroke (→1.0)
    const raw = (now / period) % (Math.PI * 2);
    // Saw-bias: spend 35% going down, 65% coming up (like real wings)
    const phase = raw / (Math.PI * 2);
    const flap = phase < 0.35
      ? 1 - (1 - Math.cos(phase / 0.35 * Math.PI)) / 2  // fast down
      : (1 - Math.cos((phase - 0.35) / 0.65 * Math.PI)) / 2; // slow up
    const sx = 1 + (0.5 + 0.5 * flap - 1) * f;
    children[0].setAttribute('transform',
      `translate(0 ${yBob}) rotate(${tilt} ${cx} ${cy}) translate(${cx} ${cy}) scale(${sx} 1) translate(${-cx} ${-cy})`);
    children[1].setAttribute('transform',
      `translate(0 ${yBob}) rotate(${tilt} ${cx} ${cy}) translate(${cx} ${cy}) scale(${sx} 1) translate(${-cx} ${-cy})`);
  } else {
    const t = Math.sin(now / period);
    const sy = 1 + (0.88 + 0.12 * ((t + 1) / 2) - 1) * f;
    for (const child of children) {
      child.setAttribute('transform', `translate(0 ${yBob}) rotate(${tilt} ${cx} ${cy}) translate(${cx} ${cy}) scale(1 ${sy}) translate(${-cx} ${-cy})`);
    }
  }
}

function pop(children, config, now) {
  const period = config.period || 3000;
  const amp = config.amp || 1.2;
  const f = config._fade ?? 1;
  const cycle = ((now / period) % 1 + 1) % 1;
  let dy = 0;
  if (cycle < 0.6) {
    // Elastic bounce: sharp rise then decaying oscillation
    const t = cycle / 0.6; // 0→1 over the active window
    // Envelope: fast attack, smooth decay
    const envelope = t < 0.15
      ? t / 0.15  // rise
      : Math.exp(-(t - 0.15) * 4); // exponential decay
    // Oscillation: 2.5 bounces within the window
    const bounce = Math.sin(t * Math.PI * 5);
    dy = -envelope * bounce * amp * f;
  }
  for (const child of children) {
    child.setAttribute('transform', `translate(0 ${dy})`);
  }
}

function colorwheel(children, config, now) {
  const period = config.period || 2000;
  const f = config._fade ?? 1;
  const n = children.length;
  if (n === 0) return;
  const pos = ((now / period) % 1) * n;
  for (let i = 0; i < n; i++) {
    const dist = Math.min(Math.abs(i - pos), n - Math.abs(i - pos));
    const o = 0.35 + 0.65 * Math.max(0, 1 - dist / 1.5);
    children[i].setAttribute('opacity', 1 + (o - 1) * f);
  }
}

function emerge(children, config, now) {
  // LinkedIn: child[0]=defs, child[1]=clipped <g> (dot+bar), child[2]="in" body
  // The "i" group bows toward "n"; the dot nods extra like looking down
  const period = config.period || 3000;
  const f = config._fade ?? 1;
  if (children.length < 3) return;
  const t0 = (Math.sin(now / period) + 1) / 2;
  const t2 = (Math.sin(now / period - Math.PI * 0.6) + 1) / 2;
  const iGroup = children[1];
  // Bow the whole "i" group (clip-path prevents overlap with "n")
  const bowAngle = t0 * 8 * f;
  iGroup.setAttribute('transform', `rotate(${bowAngle} 2.35 13.5)`);
  // Dot inside group: extra nod around its bottom edge
  const dot = iGroup.children?.[0];
  if (dot) {
    const nodAngle = t0 * 22 * f;
    dot.setAttribute('transform', `rotate(${nodAngle} 2.35 4.55)`);
  }
  // "in" body: gentle slide-up + fade
  const dy = (1 - t2) * 0.3 * f;
  children[2].setAttribute('transform', `translate(0 ${dy})`);
  children[2].setAttribute('opacity', 1 + (0.8 + 0.2 * t2 - 1) * f);
}

function snoo(children, config, now) {
  // children[0]=defs, [1]=body (masked), [2]=antenna, [3]=mouth
  const period = config.period || 3000;
  const amp = config.amp || 3;
  const f = config._fade ?? 1;
  if (children.length < 4) return;

  // Head tilt — smooth sinusoidal
  const phase = now / period;
  const angle = Math.sin(phase) * amp * f;
  children[1].setAttribute('transform', `rotate(${angle} 8 10)`);
  children[3].setAttribute('transform', `rotate(${angle} 8 10)`);

  // Antenna: follows body tilt + jaunty springy overshoot
  // Faster oscillation with decaying secondary bounce for a whippy feel
  const antBase = angle;
  const antExtra = (Math.sin(phase * 2.3) * 1.4 + Math.sin(phase * 3.7) * 0.6) * amp * 0.5 * f;
  const px = 8.2, py = 5.8; // antenna pivot (top of head)
  children[2].setAttribute('transform',
    `rotate(${antBase} 8 10) rotate(${antExtra} ${px} ${py})`);

  // Eyes in mask — rotate with body
  const svg = children[0].closest('svg');
  const leftEye = svg?.querySelector('.snoo-leye');
  const rightEye = svg?.querySelector('.snoo-reye');
  if (!leftEye || !rightEye) return;

  leftEye.setAttribute('transform', `rotate(${angle} 8 10)`);

  // Right eye wink — fires once per play
  // _animStart is reset to null in play(), so first frame sets it
  if (!config._animStart) {
    config._animStart = now;
  }
  const elapsed = now - config._animStart;
  const winkStart = period * 0.15; // start wink early in the cycle
  const winkDur = period * 0.23;
  let eyeScale = 1;
  if (elapsed > winkStart && elapsed < winkStart + winkDur) {
    const wt = (elapsed - winkStart) / winkDur;
    if (wt < 0.25) {
      eyeScale = 1 - wt / 0.25; // smooth close
    } else if (wt < 0.55) {
      eyeScale = 0; // hold shut (cheeky pause)
    } else {
      const open = (wt - 0.55) / 0.45;
      eyeScale = open * open; // ease-in open (slow start, quick finish)
    }
  }
  eyeScale = 1 + (eyeScale - 1) * f;
  const ecx = 10.29, ecy = 9.36;
  rightEye.setAttribute('transform',
    `rotate(${angle} 8 10) translate(${ecx} ${ecy}) scale(1 ${eyeScale}) translate(${-ecx} ${-ecy})`);
}

function stamp(children, config, now) {
  const period = config.period || 3000;
  const maxAngle = config.maxAngle || 12;
  const f = config._fade ?? 1;
  const cycle = ((now / period) % 1 + 1) % 1;
  let angle = 0;
  if (cycle < 0.08) {
    angle = Math.sin(cycle / 0.08 * Math.PI / 2) * maxAngle;
  } else if (cycle < 0.2) {
    const st = (cycle - 0.08) / 0.12;
    angle = maxAngle * Math.cos(st * Math.PI * 1.5) * (1 - st);
  }
  angle *= f;
  for (const child of children) {
    child.setAttribute('transform', `rotate(${angle} 8 8)`);
  }
}

function sway(children, config, now) {
  const period = config.period || 4000;
  const amp = config.amp || 3;
  const f = config._fade ?? 1;
  const angle = Math.sin(now / period) * amp * f;
  const dx = Math.sin(now / (period * 0.7)) * (amp * 0.1) * f;
  for (const child of children) {
    child.setAttribute('transform', `translate(${dx} 0) rotate(${angle} 8 14)`);
  }
}

function ripple(children, config, now) {
  const period = config.period || 600;
  const f = config._fade ?? 1;
  const n = children.length;
  if (n === 0) return;

  // Cache rect centers on first call
  if (!config._centers) {
    config._centers = [];
    for (const child of children) {
      const x = parseFloat(child.getAttribute('x') || 0);
      const y = parseFloat(child.getAttribute('y') || 0);
      const w = parseFloat(child.getAttribute('width') || 0);
      const h = parseFloat(child.getAttribute('height') || 0);
      config._centers.push({ cx: x + w / 2, cy: y + h / 2 });
    }
    // Diagonal from upper-left: use (cx + cy) so top-left is smallest
    const diags = config._centers.map(c => c.cx + c.cy);
    config._diagMin = Math.min(...diags);
    config._diagRange = (Math.max(...diags) - config._diagMin) || 1;
  }

  // Looping sweep with pause between cycles
  if (!config._animStart) config._animStart = now;
  const elapsed = now - config._animStart;
  const pause = config.pause ?? period * 2;
  const cycleLen = period + pause;
  const cyclePos = elapsed % cycleLen;
  // Extend range so wave fully enters and exits
  const wave = Math.min(cyclePos / period, 1);
  const wavePos = -0.3 + wave * 1.6; // -0.3 to 1.3
  const waveWidth = 0.3;

  for (let i = 0; i < n; i++) {
    const c = config._centers[i];
    // Normalized diagonal position [0,1] — upper-left = 0, lower-right = 1
    const d = (c.cx + c.cy - config._diagMin) / config._diagRange;
    const dist = Math.abs(d - wavePos);
    if (dist < waveWidth) {
      const t = 1 - dist / waveWidth;
      const intensity = t * t * (3 - 2 * t); // smoothstep
      const s = 1 + intensity * 0.15 * f;
      const o = 1 - intensity * 0.4 * f;
      children[i].setAttribute('transform',
        `translate(${c.cx} ${c.cy}) scale(${s}) translate(${-c.cx} ${-c.cy})`);
      children[i].setAttribute('opacity', o);
    } else {
      children[i].removeAttribute('transform');
      children[i].setAttribute('opacity', 1);
    }
  }
}

function wipe(children, config, now) {
  const period = config.period || 600;
  const f = config._fade ?? 1;
  if (children.length === 0) return;

  // One-shot wipe: set up clip-path on first call
  if (!config._animStart) {
    config._animStart = now;
    // Create a clip-path rect that sweeps across to reveal a flash
    const svg = children[0].closest('svg');
    if (svg && !svg.querySelector('#wipe-flash')) {
      const x = parseFloat(children[0].getAttribute('x') || 0);
      const y = parseFloat(children[0].getAttribute('y') || 0);
      const w = parseFloat(children[0].getAttribute('width') || 0);
      const h = parseFloat(children[0].getAttribute('height') || 0);
      config._rect = { x, y, w, h };
      // Add a semi-transparent flash overlay rect
      const flash = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      flash.id = 'wipe-flash';
      flash.setAttribute('x', x);
      flash.setAttribute('y', y);
      flash.setAttribute('width', '0');
      flash.setAttribute('height', h);
      flash.setAttribute('fill', 'currentColor');
      flash.setAttribute('opacity', '0');
      svg.appendChild(flash);
      config._flash = flash;
    }
  }

  const elapsed = now - config._animStart;
  const t = Math.min(elapsed / period, 1);
  const r = config._rect;
  if (!r) return;

  // Wipe band sweeps left to right across the rect
  const bandWidth = r.w * 0.25;
  const bandLeft = r.x + t * (r.w + bandWidth) - bandWidth;
  const bandRight = bandLeft + bandWidth;
  // Clamp to rect bounds
  const visLeft = Math.max(bandLeft, r.x);
  const visRight = Math.min(bandRight, r.x + r.w);
  const visW = Math.max(0, visRight - visLeft);

  // Flash overlay: bright band that sweeps across
  if (config._flash) {
    const intensity = t < 0.1 ? t / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 1;
    config._flash.setAttribute('x', visLeft);
    config._flash.setAttribute('width', visW);
    config._flash.setAttribute('opacity', 0.35 * intensity * f);
  }

  // Main rect: subtle scale bump as the wipe passes center
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const centerProx = 1 - Math.abs(t - 0.5) * 2; // peaks at midpoint
  const s = 1 + centerProx * 0.04 * f;
  children[0].setAttribute('transform',
    `translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`);
}

function typewrite(children, config, now) {
  // 3 children: [0]=bubble, [1]=line1, [2]=line2
  // 2 children: [0]=line1, [1]=line2 (no bubble)
  const period = config.period || 1200;
  const f = config._fade ?? 1;
  const hasBubble = children.length >= 3;
  const li1 = hasBubble ? 1 : 0;
  const li2 = hasBubble ? 2 : 1;
  if (children.length < 2) return;

  // Set up stroke-dasharray on first call
  if (!config._lineSetup) {
    config._lineSetup = true;
    config._l1 = children[li1].getTotalLength?.() || 9;
    config._l2 = children[li2].getTotalLength?.() || 9;
    children[li1].setAttribute('stroke-dasharray', config._l1);
    children[li2].setAttribute('stroke-dasharray', config._l2);
  }

  const { _l1: l1, _l2: l2 } = config;

  // One-shot draw: lines extend then stay
  if (!config._animStart) config._animStart = now;
  const elapsed = now - config._animStart;
  const d1 = Math.min(elapsed / (period * 0.25), 1);
  const d2 = Math.min(Math.max((elapsed - period * 0.15) / (period * 0.25), 0), 1);
  children[li1].setAttribute('stroke-dashoffset', l1 * (1 - d1) * f);
  children[li2].setAttribute('stroke-dashoffset', l2 * (1 - d2) * f);

  // Subtle breathe on bubble (if present)
  if (hasBubble) {
    const bo = 1 + (0.85 + 0.15 * ((Math.sin(now / 3000) + 1) / 2) - 1) * f;
    children[0].setAttribute('opacity', bo);
  }
}

const ANIM_FNS = {
  breathe, pulse, shimmer, drift, spin, twinkle,
  radiate, tug, unfold, flutter, pop, colorwheel, emerge, snoo, stamp, sway, typewrite,
  ripple, wipe,
};

// ── Icon registry ──

export const STATIC_ICON_REGISTRY = {
  // Geometric Interior
  'alt-text':       { svg: ALT_TEXT_SVG, anim: 'breathe', desc: 'alt-text lines' },
  'text-short':     { svg: TEXT_SHORT_SVG, anim: 'typewrite', config: { period: 1200 }, desc: 'text — 2 lines type in' },
  'create':         { svg: CREATE_SVG, anim: 'pulse', desc: 'create / add' },
  'construct':      { svg: CONSTRUCT_SVG, anim: 'twinkle', desc: 'construct scene' },
  // Navigation
  'arrow-up':       { svg: ARROW_UP_SVG, anim: 'breathe', desc: 'arrow up' },
  'arrow-down':     { svg: ARROW_DOWN_SVG, anim: 'breathe', desc: 'arrow down' },
  'arrow-left':     { svg: ARROW_LEFT_SVG, anim: 'breathe', desc: 'arrow left' },
  'arrow-right':    { svg: ARROW_RIGHT_SVG, anim: 'breathe', desc: 'arrow right' },
  'dbl-arrow-left': { svg: DBL_ARROW_LEFT_SVG, anim: 'breathe', desc: 'double arrow left' },
  'dbl-arrow-right':{ svg: DBL_ARROW_RIGHT_SVG, anim: 'breathe', desc: 'double arrow right' },
  // Actions
  'trash':          { svg: TRASH_SVG, anim: 'pulse', desc: 'delete' },
  'restore':        { svg: RESTORE_SVG, anim: 'pulse', desc: 'restore' },
  'edit':           { svg: EDIT_SVG, anim: 'pulse', desc: 'edit' },
  'add':            { svg: ADD_SVG, anim: 'pulse', desc: 'add' },
  'close':          { svg: CLOSE_SVG, anim: 'breathe', desc: 'close' },
  'fullscreen':     { svg: FULLSCREEN_SVG, anim: 'breathe', desc: 'fullscreen' },
  'save':           { svg: SAVE_SVG, anim: 'pulse', desc: 'save' },
  'undo':           { svg: UNDO_SVG, anim: 'pulse', desc: 'undo' },
  'redo':           { svg: REDO_SVG, anim: 'pulse', desc: 'redo' },
  'randomize':      { svg: RANDOMIZE_SVG, anim: 'twinkle', desc: 'randomize' },
  'render':         { svg: RENDER_SVG, anim: 'twinkle', desc: 'render' },
  'settings':       { svg: SETTINGS_SVG, anim: 'spin', desc: 'settings' },
  'download':       { svg: DOWNLOAD_SVG, anim: 'pulse', desc: 'download' },
  'image':          { svg: IMAGE_SVG, anim: 'breathe', desc: 'image' },
  'bundle':         { svg: BUNDLE_SVG, anim: 'breathe', desc: 'bundle' },
  // Status
  'error':          { svg: ERROR_SVG, anim: 'pulse', config: { period: 1500 }, desc: 'error' },
  'retry':          { svg: RETRY_SVG, anim: 'spin', desc: 'retry' },
  'warning':        { svg: WARNING_SVG, anim: 'breathe', desc: 'warning' },
  // Separators
  'dot':            { svg: DOT_SVG, anim: 'breathe', config: { min: 0.4, max: 0.8, period: 4000 }, desc: 'dot separator' },
  // Field markers
  'field-diamond':  { svg: FIELD_DIAMOND_SVG, anim: 'twinkle', desc: 'field diamond' },
  // Resolution
  'res-270':        { svg: RES_270_SVG, anim: 'ripple', config: { period: 600 }, desc: '270p \u2014 2\u00d72 blocks' },
  'res-540':        { svg: RES_540_SVG, anim: 'ripple', config: { period: 600 }, desc: '540p \u2014 3\u00d73 grid' },
  'res-900':        { svg: RES_900_SVG, anim: 'ripple', config: { period: 600 }, desc: '900p \u2014 4\u00d74 grid' },
  'res-1080':       { svg: RES_1080_SVG, anim: 'ripple', config: { period: 600 }, desc: '1080p \u2014 5\u00d75 grid' },
  'res-1620':       { svg: RES_1620_SVG, anim: 'ripple', config: { period: 600 }, desc: '1620p \u2014 6\u00d76 grid' },
  'res-4k':         { svg: RES_4K_SVG, anim: 'ripple', config: { period: 600 }, desc: '4K \u2014 7\u00d77 grid' },
  // Social / sharing — each with a unique animation (short periods for one-shot playFor)
  'share':          { svg: SHARE_SVG, anim: 'radiate', config: { period: 800 }, desc: 'share — broadcast ripple' },
  'link':           { svg: LINK_SVG, anim: 'tug', config: { period: 600, amp: 0.8 }, desc: 'link — chain tug' },
  'text':           { svg: TEXT_SVG, anim: 'typewrite', config: { period: 1200 }, desc: 'text — lines type in' },
  'email':          { svg: EMAIL_SVG, anim: 'unfold', config: { period: 700, maxAngle: 25 }, desc: 'email — envelope open' },
  'bluesky':        { svg: BLUESKY_SVG, anim: 'flutter', config: { cx: 12, cy: 11.5, period: 500 }, desc: 'Bluesky — butterfly flap' },
  'facebook':       { svg: FACEBOOK_SVG, anim: 'pop', config: { period: 600, amp: 2.5 }, desc: 'Facebook — notification pop' },
  'google':         { svg: GOOGLE_SVG, anim: 'colorwheel', config: { period: 700 }, desc: 'Google — segment sweep' },
  'linkedin':       { svg: LINKEDIN_SVG, anim: 'emerge', config: { period: 800 }, desc: 'LinkedIn — dot bow' },
  'reddit':         { svg: REDDIT_SVG, anim: 'snoo', config: { period: 800, amp: 6 }, desc: 'Reddit — dangle + wink' },
  'twitter':        { svg: TWITTER_SVG, anim: 'stamp', config: { period: 500, maxAngle: 18 }, desc: 'Twitter / X — rotation snap' },
  'github':         { svg: GITHUB_SVG, anim: 'sway', config: { period: 800, amp: 6 }, desc: 'GitHub — cat sway' },
};

// ── Public API ──

/**
 * Inject an animated SVG into a container.
 *
 * @param {HTMLElement} container — parent element
 * @param {string} svgString — raw SVG markup
 * @param {string} animType — animation name (breathe, pulse, shimmer, drift, spin, twinkle)
 * @param {object} [config] — animation-specific overrides (period, min, max, amp, cx, cy)
 * @returns {{ el: SVGElement, play: Function, pause: Function, destroy: Function }}
 */
export function injectAnimatedSVG(container, svgString, animType, config = {}) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = svgString;
  const svgEl = wrapper.firstElementChild;
  container.appendChild(svgEl);

  const animFn = ANIM_FNS[animType];
  let running = false;
  let rafId = null;
  // Fade state: 'in' = ramping up, 'out' = settling down, null = full strength
  let fadeMode = null;
  let fadeStart = 0;
  const FADE_IN_DUR = 300;
  const FADE_OUT_DUR = 350;

  function getChildren() {
    return Array.from(svgEl.children);
  }

  const fadeConfig = { ...config };

  function tick(now) {
    if (!running) return;
    const children = getChildren();
    if (fadeMode === 'out') {
      const raw = Math.min((now - fadeStart) / FADE_OUT_DUR, 1);
      fadeConfig._fade = 1 - raw * raw; // 1 → 0 quadratic
      animFn(children, fadeConfig, now);
      if (raw >= 1) {
        running = false;
        fadeMode = null;
        for (const child of children) {
          child.removeAttribute('transform');
          child.removeAttribute('opacity');
        }
        // Clean up dynamically added elements (e.g. wipe flash)
        const flash = svgEl.querySelector('#wipe-flash');
        if (flash) flash.remove();
        fadeConfig._flash = null;
        return;
      }
    } else if (fadeMode === 'in') {
      const raw = Math.min((now - fadeStart) / FADE_IN_DUR, 1);
      fadeConfig._fade = raw * raw; // 0 → 1 quadratic
      animFn(children, fadeConfig, now);
      if (raw >= 1) fadeMode = null;
    } else {
      fadeConfig._fade = 1;
      animFn(children, fadeConfig, now);
    }
    rafId = requestAnimationFrame(tick);
  }

  function play() {
    if (fadeMode === 'out' && running) {
      // Reverse the settle-out into a fade-in from current fade level
      const now = performance.now();
      const outRaw = Math.min((now - fadeStart) / FADE_OUT_DUR, 1);
      const currentFade = 1 - outRaw * outRaw;
      // Start fade-in from where we are: set fadeStart so that raw² = currentFade
      fadeMode = 'in';
      fadeStart = now - Math.sqrt(currentFade) * FADE_IN_DUR;
      return;
    }
    if (running || !animFn) return;
    running = true;
    fadeMode = 'in';
    fadeStart = performance.now();
    fadeConfig._animStart = null; // reset one-shot state for new play
    rafId = requestAnimationFrame(tick);
  }

  function pause() {
    running = false;
    fadeMode = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  /** Gracefully fade animation to rest over ~350ms, then stop. */
  function settleOut() {
    if (!running || !animFn) return;
    const now = performance.now();
    if (fadeMode === 'in') {
      // Reverse the fade-in: start settle from current fade level
      const inRaw = Math.min((now - fadeStart) / FADE_IN_DUR, 1);
      const currentFade = inRaw * inRaw;
      // Set fadeStart so that 1 - raw² = currentFade → raw = sqrt(1 - currentFade)
      fadeMode = 'out';
      fadeStart = now - Math.sqrt(1 - currentFade) * FADE_OUT_DUR;
    } else {
      fadeMode = 'out';
      fadeStart = now;
    }
  }

  let playForTimer = null;

  /** Play animation for `ms` milliseconds, then gracefully settle to rest. */
  function playFor(ms) {
    if (playForTimer) { clearTimeout(playForTimer); playForTimer = null; }
    play();
    const settleDelay = Math.max(0, ms - FADE_OUT_DUR);
    playForTimer = setTimeout(() => { playForTimer = null; settleOut(); }, settleDelay);
  }

  function destroy() {
    if (playForTimer) { clearTimeout(playForTimer); playForTimer = null; }
    pause();
    svgEl.remove();
  }

  return { el: svgEl, play, pause, settleOut, playFor, destroy };
}

/**
 * Convenience: inject an icon from the registry by key.
 *
 * @param {HTMLElement} container
 * @param {string} key — registry key (e.g. 'trash', 'res-270', 'github')
 * @param {object} [configOverrides]
 * @returns {{ el: SVGElement, play: Function, pause: Function, destroy: Function } | null}
 */
export function injectRegistryIcon(container, key, configOverrides = {}) {
  const entry = STATIC_ICON_REGISTRY[key];
  if (!entry) return null;
  const config = { ...entry.config, ...configOverrides };
  return injectAnimatedSVG(container, entry.svg, entry.anim, config);
}
