// ══════════════════════════════════════════════════════════════
// Custom Buttons Demo Page
// ══════════════════════════════════════════════════════════════

import { createCardIcon } from './buttons/card-icon.js';
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

// ── Mount ──
app.appendChild(buildCardIconDemo());
