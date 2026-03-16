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
  SHARE_SVG, LINK_SVG, EMAIL_SVG,
  BLUESKY_SVG, FACEBOOK_SVG, GOOGLE_SVG, LINKEDIN_SVG, REDDIT_SVG, TWITTER_SVG,
  GITHUB_SVG,
  ALT_TEXT_SVG, CREATE_SVG, CONSTRUCT_SVG,
} from './icons.js';

// ── Animation implementations ──

function breathe(children, config, now) {
  const period = config.period || 3000;
  const min = config.min || 0.65;
  const max = config.max || 1;
  for (let i = 0; i < children.length; i++) {
    const phase = (i / children.length) * Math.PI * 0.6;
    const t = (Math.sin(now / period + phase) + 1) / 2;
    children[i].setAttribute('opacity', min + (max - min) * t);
  }
}

function pulse(children, config, now) {
  const period = config.period || 2500;
  const min = config.min || 0.96;
  const max = config.max || 1.04;
  const t = (Math.sin(now / period) + 1) / 2;
  const s = min + (max - min) * t;
  const o = 0.7 + 0.3 * t;
  for (const child of children) {
    child.setAttribute('transform', `translate(8 8) scale(${s}) translate(-8 -8)`);
    child.setAttribute('opacity', o);
  }
}

function shimmer(children, config, now) {
  const period = config.period || 2000;
  const speed = config.speed || 0.003;
  for (let i = 0; i < children.length; i++) {
    const wave = Math.sin(now * speed - i * 0.5);
    const o = 0.55 + 0.45 * ((wave + 1) / 2);
    children[i].setAttribute('opacity', o);
  }
}

function drift(children, config, now) {
  const amp = config.amp || 0.4;
  const period = config.period || 4000;
  for (let i = 0; i < children.length; i++) {
    const px = (i + 1) * 1.7;
    const py = (i + 1) * 2.3;
    const dx = Math.sin(now / period + px) * amp;
    const dy = Math.cos(now / (period * 1.3) + py) * amp;
    children[i].setAttribute('transform', `translate(${dx} ${dy})`);
  }
}

function spin(children, config, now) {
  const period = config.period || 10000;
  const cx = config.cx || 8;
  const cy = config.cy || 8;
  const angle = (now / period) * 360 % 360;
  for (const child of children) {
    child.setAttribute('transform', `rotate(${angle} ${cx} ${cy})`);
  }
}

function twinkle(children, config, now) {
  const period = config.period || 1800;
  for (let i = 0; i < children.length; i++) {
    const phase = i * 2.1 + i * i * 0.3;
    const t = (Math.sin(now / period + phase) + 1) / 2;
    children[i].setAttribute('opacity', 0.5 + 0.5 * t);
  }
}

// ── Social icon animations (unique per icon) ──

function radiate(children, config, now) {
  const period = config.period || 3000;
  for (let i = 0; i < children.length; i++) {
    const tag = children[i].tagName;
    if (tag === 'circle') {
      const phase = i * (Math.PI * 2 / 3);
      const t = (Math.sin(now / period + phase) + 1) / 2;
      const scale = 0.85 + 0.3 * t;
      const cx = parseFloat(children[i].getAttribute('cx'));
      const cy = parseFloat(children[i].getAttribute('cy'));
      children[i].setAttribute('transform', `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`);
      children[i].setAttribute('opacity', 0.6 + 0.4 * t);
    } else {
      const t = (Math.sin(now / (period * 0.7) + Math.PI) + 1) / 2;
      children[i].setAttribute('opacity', 0.5 + 0.5 * t);
    }
  }
}

function tug(children, config, now) {
  const period = config.period || 2500;
  const amp = config.amp || 0.6;
  const raw = (Math.sin(now / period) + 1) / 2;
  // Cubic ease for snappy reconnect
  const t = raw < 0.5
    ? 4 * raw * raw * raw
    : 1 - Math.pow(-2 * raw + 2, 3) / 2;
  const offset = t * amp;
  if (children.length >= 2) {
    children[0].setAttribute('transform', `translate(${-offset} ${-offset})`);
    children[1].setAttribute('transform', `translate(${offset} ${offset})`);
  }
}

function unfold(children, config, now) {
  const period = config.period || 3500;
  const maxAngle = config.maxAngle || 12;
  const t = (Math.sin(now / period) + 1) / 2;
  // child[0] = rect (body), child[1] = path (V flap)
  if (children.length >= 2) {
    children[1].setAttribute('transform', `rotate(${-maxAngle * t} 8 5)`);
    children[0].setAttribute('opacity', 0.8 + 0.2 * t);
  }
}

function flutter(children, config, now) {
  const period = config.period || 1200;
  const cx = config.cx || 8;
  const cy = config.cy || 8;
  const t = Math.sin(now / period);
  const sy = 0.88 + 0.12 * ((t + 1) / 2);
  const yBob = Math.sin(now / (period * 2)) * 0.5;
  for (const child of children) {
    child.setAttribute('transform', `translate(0 ${yBob}) translate(${cx} ${cy}) scale(1 ${sy}) translate(${-cx} ${-cy})`);
  }
}

function pop(children, config, now) {
  const period = config.period || 3000;
  const amp = config.amp || 1.2;
  const cycle = ((now / period) % 1 + 1) % 1;
  let dy = 0;
  if (cycle < 0.15) {
    // Rise up
    dy = -Math.sin(cycle / 0.15 * Math.PI) * amp;
  } else if (cycle < 0.25) {
    // Settle
    dy = -Math.sin((cycle - 0.15) / 0.1 * Math.PI) * amp * 0.3;
  }
  // Rest for remaining 75%
  for (const child of children) {
    child.setAttribute('transform', `translate(0 ${dy})`);
  }
}

function colorwheel(children, config, now) {
  const period = config.period || 2000;
  const n = children.length;
  if (n === 0) return;
  const pos = ((now / period) % 1) * n;
  for (let i = 0; i < n; i++) {
    const dist = Math.min(Math.abs(i - pos), n - Math.abs(i - pos));
    const o = 0.35 + 0.65 * Math.max(0, 1 - dist / 1.5);
    children[i].setAttribute('opacity', o);
  }
}

function emerge(children, config, now) {
  // LinkedIn: child[0]=dot circle, child[1]=I-bar, child[2]=in body
  const period = config.period || 3000;
  if (children.length < 3) return;
  const t0 = (Math.sin(now / period) + 1) / 2;
  const t1 = (Math.sin(now / period - Math.PI * 0.3) + 1) / 2;
  const t2 = (Math.sin(now / period - Math.PI * 0.6) + 1) / 2;
  // Dot: gentle bow — rotate around bottom edge of circle (2.35, 4.55)
  const bowAngle = (t0 - 0.5) * 16; // ±8°
  children[0].setAttribute('transform', `rotate(${bowAngle} 2.35 4.55)`);
  // I-bar: subtle opacity pulse
  children[1].setAttribute('opacity', 0.85 + 0.15 * t1);
  // "in" body: gentle slide-up + fade
  const dy = (1 - t2) * 0.3;
  children[2].setAttribute('transform', `translate(0 ${dy})`);
  children[2].setAttribute('opacity', 0.8 + 0.2 * t2);
}

function snoo(children, config, now) {
  // Reddit: child[0]=body, child[1]=left eye, child[2]=right eye, child[3]=mouth
  const period = config.period || 3000;
  if (children.length < 4) return;
  const angle = Math.sin(now / period) * 3;
  // Body + mouth: gentle dangle rotation around neck area (8, 10)
  children[0].setAttribute('transform', `rotate(${angle} 8 10)`);
  children[3].setAttribute('transform', `rotate(${angle} 8 10)`);
  // Left eye: follows body rotation, always visible
  children[1].setAttribute('transform', `rotate(${angle} 8 10)`);
  // Right eye: follows body rotation + periodic wink (scale to 0)
  const winkCycle = ((now / period) % 1 + 1) % 1;
  let eyeScale = 1;
  if (winkCycle > 0.7 && winkCycle < 0.85) {
    // Quick close and open
    const wt = (winkCycle - 0.7) / 0.15;
    eyeScale = wt < 0.5 ? 1 - wt * 2 : (wt - 0.5) * 2;
  }
  const ecx = 10.29, ecy = 9.36;
  children[2].setAttribute('transform',
    `rotate(${angle} 8 10) translate(${ecx} ${ecy}) scale(1 ${eyeScale}) translate(${-ecx} ${-ecy})`);
}

function stamp(children, config, now) {
  // Twitter/X: single-path quick rotation snap with settle
  const period = config.period || 3000;
  const maxAngle = config.maxAngle || 12;
  const cycle = ((now / period) % 1 + 1) % 1;
  let angle = 0;
  if (cycle < 0.08) {
    // Quick snap to max angle
    angle = Math.sin(cycle / 0.08 * Math.PI / 2) * maxAngle;
  } else if (cycle < 0.2) {
    // Elastic settle back with overshoot
    const st = (cycle - 0.08) / 0.12;
    angle = maxAngle * Math.cos(st * Math.PI * 1.5) * (1 - st);
  }
  // Rest for remaining 80%
  for (const child of children) {
    child.setAttribute('transform', `rotate(${angle} 8 8)`);
  }
}

function sway(children, config, now) {
  // GitHub: cat rocks side to side around bottom center
  const period = config.period || 4000;
  const angle = Math.sin(now / period) * 3;
  const dx = Math.sin(now / (period * 0.7)) * 0.3;
  for (const child of children) {
    child.setAttribute('transform', `translate(${dx} 0) rotate(${angle} 8 14)`);
  }
}

const ANIM_FNS = {
  breathe, pulse, shimmer, drift, spin, twinkle,
  radiate, tug, unfold, flutter, pop, colorwheel, emerge, snoo, stamp, sway,
};

// ── Icon registry ──

export const STATIC_ICON_REGISTRY = {
  // Geometric Interior
  'alt-text':       { svg: ALT_TEXT_SVG, anim: 'breathe', desc: 'alt-text lines' },
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
  'res-270':        { svg: RES_270_SVG, anim: 'shimmer', desc: '270p \u2014 2\u00d72 blocks' },
  'res-540':        { svg: RES_540_SVG, anim: 'shimmer', desc: '540p \u2014 3\u00d73 grid' },
  'res-900':        { svg: RES_900_SVG, anim: 'shimmer', desc: '900p \u2014 4\u00d74 grid' },
  'res-1080':       { svg: RES_1080_SVG, anim: 'shimmer', desc: '1080p \u2014 5\u00d75 grid' },
  'res-1620':       { svg: RES_1620_SVG, anim: 'shimmer', desc: '1620p \u2014 6\u00d76 grid' },
  'res-4k':         { svg: RES_4K_SVG, anim: 'pulse', config: { min: 0.98, max: 1.02 }, desc: '4K \u2014 smooth' },
  // Social / sharing — each with a unique animation
  'share':          { svg: SHARE_SVG, anim: 'radiate', desc: 'share — broadcast ripple' },
  'link':           { svg: LINK_SVG, anim: 'tug', desc: 'link — chain tug' },
  'email':          { svg: EMAIL_SVG, anim: 'unfold', desc: 'email — envelope peek' },
  'bluesky':        { svg: BLUESKY_SVG, anim: 'flutter', config: { cx: 12, cy: 10.5 }, desc: 'Bluesky — butterfly flutter' },
  'facebook':       { svg: FACEBOOK_SVG, anim: 'pop', desc: 'Facebook — notification pop' },
  'google':         { svg: GOOGLE_SVG, anim: 'colorwheel', config: { period: 2000 }, desc: 'Google — segment sweep' },
  'linkedin':       { svg: LINKEDIN_SVG, anim: 'emerge', desc: 'LinkedIn — dot bow' },
  'reddit':         { svg: REDDIT_SVG, anim: 'snoo', desc: 'Reddit — dangle + wink' },
  'twitter':        { svg: TWITTER_SVG, anim: 'stamp', desc: 'Twitter / X — rotation snap' },
  'github':         { svg: GITHUB_SVG, anim: 'sway', desc: 'GitHub — cat sway' },
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

  function getChildren() {
    return Array.from(svgEl.children);
  }

  function tick(now) {
    if (!running) return;
    animFn(getChildren(), config, now);
    rafId = requestAnimationFrame(tick);
  }

  function play() {
    if (running || !animFn) return;
    running = true;
    rafId = requestAnimationFrame(tick);
  }

  function pause() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function destroy() {
    pause();
    svgEl.remove();
  }

  return { el: svgEl, play, pause, destroy };
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
