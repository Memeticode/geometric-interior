// ══════════════════════════════════════════════════════════════
// Custom Buttons Demo Page
// ══════════════════════════════════════════════════════════════

import { createCardIcon } from './buttons/card-icon.js';
import { createAltTextToggle, createFullscreenToggle } from './buttons/toggle-icon.js';
import { createStateDiagram } from './buttons/state-diagram.js';

const app = document.getElementById('app');

// ── Helpers ──

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

// ══════════════════════════════════════════════════════════════
// Card Icon Demo
// ══════════════════════════════════════════════════════════════

// Transitions available from each state.
// Each entry: [label, targetState, opts?]
const TRANSITIONS = {
  viewing: [
    ['editing', 'editing'],
    ['emphasis', 'viewing-emphasis'],
    ['dissipate', 'empty', { mode: 'dissipate' }],
    ['collapse', 'empty', { mode: 'converge' }],
  ],
  'viewing-emphasis': [
    ['viewing', 'viewing'],
    ['editing', 'editing'],
    ['collapse', 'empty', { mode: 'converge' }],
  ],
  editing: [
    ['viewing', 'viewing'],
    ['dissipate', 'empty', { mode: 'dissipate' }],
    ['collapse', 'empty', { mode: 'converge' }],
  ],
  empty: [
    ['coalesce', 'viewing', { mode: 'dissipate' }],
    ['expand', 'viewing', { mode: 'converge' }],
    ['coalesce', 'editing', { mode: 'dissipate' }],
    ['expand', 'editing', { mode: 'converge' }],
  ],
};

const STATE_DISPLAY = {
  empty: 'empty', viewing: 'viewing',
  'viewing-emphasis': 'emphasis', editing: 'editing',
};

function modeVerb(mode, toEmpty) {
  if (mode === 'converge') return toEmpty ? 'collapse' : 'expand';
  return toEmpty ? 'dissipate' : 'coalesce';
}

function buildCardIconDemo() {
  const section = el('div', 'demo-section');

  // Title
  const title = el('div', 'demo-title');
  title.innerHTML = 'Card Icon <span>viewing & editing indicator</span>';
  section.appendChild(title);

  // ── Top row: icon + diagram ──
  const topRow = el('div', 'demo-top-row');

  // Icon
  const iconFrame = el('div', 'demo-icon-frame');
  const icon = createCardIcon(iconFrame, { size: 48, initialState: 'viewing' });

  // Click icon to toggle viewing ↔ editing
  iconFrame.addEventListener('click', () => {
    const next = icon.state === 'viewing' ? 'editing' : 'viewing';
    morphTo(next);
  });

  // Diagram
  const diagramWrap = el('div', 'demo-diagram-wrap');
  const diagram = createStateDiagram({
    states: {
      viewing:            { label: 'viewing' },
      editing:            { label: 'editing' },
      'viewing-emphasis': { label: 'emphasis' },
      empty:              { label: 'empty' },
    },
    grid: [
      ['viewing', 'editing'],
      ['viewing-emphasis', 'empty'],
    ],
    transitions: TRANSITIONS,
    onTransition: (to, opts) => morphTo(to, opts),
  });
  diagramWrap.appendChild(diagram.el);

  topRow.append(iconFrame, diagramWrap);
  section.appendChild(topRow);

  // ── Settings: duration + skip ──
  const settings = el('div', 'demo-settings');

  const durSetting = el('div', 'demo-setting');
  const durLabel = el('label', null, 'Duration');
  const durSlider = document.createElement('input');
  durSlider.type = 'range';
  durSlider.min = '50';
  durSlider.max = '4000';
  durSlider.value = '2000';
  durSlider.step = '50';
  const durVal = el('span', 'val', '2000ms');
  durSetting.append(durLabel, durSlider, durVal);

  let duration = 2000;
  durSlider.addEventListener('input', () => {
    duration = +durSlider.value;
    durVal.textContent = duration + 'ms';
  });

  const skipBtn = el('button', 'demo-skip-btn hidden', 'skip');

  settings.append(durSetting, skipBtn);
  section.appendChild(settings);

  // ── Log ──
  const log = el('div', 'demo-log');
  section.appendChild(log);

  // ── Shared state management ──

  function logEntry(from, to, dur, modeLabel) {
    const entry = el('div', 'entry');
    let html = `${STATE_DISPLAY[from]} <span class="arrow">\u2192</span> ${STATE_DISPLAY[to]}`;
    if (modeLabel) html += ` <span class="mode">${modeLabel}</span>`;
    html += ` <span class="mode">${dur}ms</span>`;
    entry.innerHTML = html;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  function updateUI() {
    skipBtn.classList.toggle('hidden', !icon.morphing);
    diagram.update(icon.state);
  }

  function morphTo(to, opts = {}) {
    const from = icon.state;
    if (from === to) return;
    const mergedOpts = { duration, ...opts };
    const label = opts.mode ? modeVerb(opts.mode, to === 'empty') : null;
    icon.morph(to, mergedOpts).then(updateUI);
    logEntry(from, to, duration, label);
    updateUI();
  }

  // Skip
  skipBtn.addEventListener('click', () => {
    icon.skip();
    const entry = el('div', 'entry');
    entry.innerHTML = '<span class="mode">skipped</span>';
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    updateUI();
  });

  updateUI();
  return section;
}

// ══════════════════════════════════════════════════════════════
// Alt-Text Toggle Demo
// ══════════════════════════════════════════════════════════════

const ALT_TEXT_TRANSITIONS = {
  'waiting-open': [
    ['toggle', 'waiting-close'],
    ['emphasize', 'waiting-open-emphasize'],
  ],
  'waiting-open-emphasize': [
    ['normal', 'waiting-open'],
    ['toggle', 'waiting-close'],
  ],
  'waiting-close': [
    ['toggle', 'waiting-open'],
    ['emphasize', 'waiting-close-emphasize'],
  ],
  'waiting-close-emphasize': [
    ['normal', 'waiting-close'],
    ['toggle', 'waiting-open'],
  ],
};

const ALT_TEXT_STATE_DISPLAY = {
  'waiting-open': 'open',
  'waiting-open-emphasize': 'open-emph',
  'waiting-close': 'close',
  'waiting-close-emphasize': 'close-emph',
};

function buildAltTextToggleDemo() {
  const section = el('div', 'demo-section');

  const title = el('div', 'demo-title');
  title.innerHTML = 'Alt-Text Toggle <span>text overlay indicator</span>';
  section.appendChild(title);

  const topRow = el('div', 'demo-top-row');

  const iconFrame = el('div', 'demo-icon-frame');
  const icon = createAltTextToggle(iconFrame, { size: 48 });

  iconFrame.addEventListener('click', () => {
    altTextMorphTo(icon.isOpen ? 'waiting-open' : 'waiting-close');
  });

  const diagramWrap = el('div', 'demo-diagram-wrap');
  const diagram = createStateDiagram({
    states: {
      'waiting-open':            { label: 'open' },
      'waiting-close':           { label: 'close' },
      'waiting-open-emphasize':  { label: 'open-emph' },
      'waiting-close-emphasize': { label: 'close-emph' },
    },
    grid: [
      ['waiting-open', 'waiting-close'],
      ['waiting-open-emphasize', 'waiting-close-emphasize'],
    ],
    transitions: ALT_TEXT_TRANSITIONS,
    onTransition: (to) => altTextMorphTo(to),
  });
  diagramWrap.appendChild(diagram.el);

  topRow.append(iconFrame, diagramWrap);
  section.appendChild(topRow);

  // Settings
  const settings = el('div', 'demo-settings');

  const durSetting = el('div', 'demo-setting');
  const durLabel = el('label', null, 'Duration');
  const durSlider = document.createElement('input');
  durSlider.type = 'range'; durSlider.min = '50'; durSlider.max = '4000';
  durSlider.value = '2000'; durSlider.step = '50';
  const durVal = el('span', 'val', '2000ms');
  durSetting.append(durLabel, durSlider, durVal);

  let altDuration = 2000;
  durSlider.addEventListener('input', () => {
    altDuration = +durSlider.value;
    durVal.textContent = altDuration + 'ms';
  });

  const skipBtn = el('button', 'demo-skip-btn hidden', 'skip');
  settings.append(durSetting, skipBtn);
  section.appendChild(settings);

  // Log
  const log = el('div', 'demo-log');
  section.appendChild(log);

  function altTextLogEntry(from, to, dur) {
    const entry = el('div', 'entry');
    entry.innerHTML = `${ALT_TEXT_STATE_DISPLAY[from]} <span class="arrow">\u2192</span> ${ALT_TEXT_STATE_DISPLAY[to]} <span class="mode">${dur}ms</span>`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  function altTextUpdateUI() {
    skipBtn.classList.toggle('hidden', !icon.morphing);
    diagram.update(icon.state);
  }

  function altTextMorphTo(to) {
    const from = icon.state;
    if (from === to) return;
    icon.morph(to, { duration: altDuration }).then(altTextUpdateUI);
    altTextLogEntry(from, to, altDuration);
    altTextUpdateUI();
  }

  skipBtn.addEventListener('click', () => {
    icon.skip();
    const entry = el('div', 'entry');
    entry.innerHTML = '<span class="mode">skipped</span>';
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    altTextUpdateUI();
  });

  altTextUpdateUI();
  return section;
}

// ══════════════════════════════════════════════════════════════
// Fullscreen Toggle Demo
// ══════════════════════════════════════════════════════════════

const FS_TRANSITIONS = {
  'waiting-open': [
    ['toggle', 'waiting-close'],
    ['emphasize', 'waiting-open-emphasize'],
  ],
  'waiting-open-emphasize': [
    ['normal', 'waiting-open'],
    ['toggle', 'waiting-close'],
  ],
  'waiting-close': [
    ['toggle', 'waiting-open'],
    ['emphasize', 'waiting-close-emphasize'],
  ],
  'waiting-close-emphasize': [
    ['normal', 'waiting-close'],
    ['toggle', 'waiting-open'],
  ],
};

const FS_STATE_DISPLAY = {
  'waiting-open': 'open',
  'waiting-open-emphasize': 'open-emph',
  'waiting-close': 'close',
  'waiting-close-emphasize': 'close-emph',
};

function buildFullscreenToggleDemo() {
  const section = el('div', 'demo-section');

  const title = el('div', 'demo-title');
  title.innerHTML = 'Fullscreen Toggle <span>enter / exit fullscreen</span>';
  section.appendChild(title);

  const topRow = el('div', 'demo-top-row');

  const iconFrame = el('div', 'demo-icon-frame');
  const icon = createFullscreenToggle(iconFrame, { size: 48 });

  iconFrame.addEventListener('click', () => {
    fsMorphTo(icon.isOpen ? 'waiting-open' : 'waiting-close');
  });

  const diagramWrap = el('div', 'demo-diagram-wrap');
  const diagram = createStateDiagram({
    states: {
      'waiting-open':            { label: 'open' },
      'waiting-close':           { label: 'close' },
      'waiting-open-emphasize':  { label: 'open-emph' },
      'waiting-close-emphasize': { label: 'close-emph' },
    },
    grid: [
      ['waiting-open', 'waiting-close'],
      ['waiting-open-emphasize', 'waiting-close-emphasize'],
    ],
    transitions: FS_TRANSITIONS,
    onTransition: (to) => fsMorphTo(to),
  });
  diagramWrap.appendChild(diagram.el);

  topRow.append(iconFrame, diagramWrap);
  section.appendChild(topRow);

  // Settings
  const settings = el('div', 'demo-settings');

  const durSetting = el('div', 'demo-setting');
  const durLabel = el('label', null, 'Duration');
  const durSlider = document.createElement('input');
  durSlider.type = 'range'; durSlider.min = '50'; durSlider.max = '4000';
  durSlider.value = '2000'; durSlider.step = '50';
  const durVal = el('span', 'val', '2000ms');
  durSetting.append(durLabel, durSlider, durVal);

  let fsDuration = 2000;
  durSlider.addEventListener('input', () => {
    fsDuration = +durSlider.value;
    durVal.textContent = fsDuration + 'ms';
  });

  const skipBtn = el('button', 'demo-skip-btn hidden', 'skip');
  settings.append(durSetting, skipBtn);
  section.appendChild(settings);

  // Log
  const log = el('div', 'demo-log');
  section.appendChild(log);

  function fsLogEntry(from, to, dur) {
    const entry = el('div', 'entry');
    entry.innerHTML = `${FS_STATE_DISPLAY[from]} <span class="arrow">\u2192</span> ${FS_STATE_DISPLAY[to]} <span class="mode">${dur}ms</span>`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  function fsUpdateUI() {
    skipBtn.classList.toggle('hidden', !icon.morphing);
    diagram.update(icon.state);
  }

  function fsMorphTo(to) {
    const from = icon.state;
    if (from === to) return;
    icon.morph(to, { duration: fsDuration }).then(fsUpdateUI);
    fsLogEntry(from, to, fsDuration);
    fsUpdateUI();
  }

  skipBtn.addEventListener('click', () => {
    icon.skip();
    const entry = el('div', 'entry');
    entry.innerHTML = '<span class="mode">skipped</span>';
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    fsUpdateUI();
  });

  fsUpdateUI();
  return section;
}

// ── Mount ──
app.appendChild(buildCardIconDemo());
app.appendChild(buildAltTextToggleDemo());
app.appendChild(buildFullscreenToggleDemo());
