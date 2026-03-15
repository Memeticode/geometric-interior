// ══════════════════════════════════════════════════════════════
// State Diagram — clean grid of clickable state cells
// Pure DOM, no external imports
// ══════════════════════════════════════════════════════════════

const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/**
 * createStateDiagram(config)
 *
 * config.states      — { key: { label } }
 * config.transitions — { fromKey: [ [label, toKey, opts?], ... ] }
 * config.grid        — 2D array of state keys, e.g. [['a','b'],['c','d']]
 * config.onTransition(toKey, opts) — called when user clicks a reachable state
 *
 * When multiple transitions lead to the same target, sub-buttons appear
 * inside that cell so the user can pick a specific transition.
 *
 * Returns { el, update(currentState) }
 */
export function createStateDiagram(config) {
  const { states, transitions, grid, onTransition } = config;

  const CELL_W = 86, CELL_H = 38;
  const GAP_X = 10, GAP_Y = 8;
  const rows = grid.length, cols = Math.max(...grid.map(r => r.length));
  const width = cols * CELL_W + (cols - 1) * GAP_X;
  const height = rows * CELL_H + (rows - 1) * GAP_Y;

  const positions = {};
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const key = grid[r][c];
      if (!key) continue;
      positions[key] = {
        cx: c * (CELL_W + GAP_X) + CELL_W / 2,
        cy: r * (CELL_H + GAP_Y) + CELL_H / 2,
      };
    }
  }

  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`,
    fill: 'none',
    style: 'width:100%;height:auto;display:block',
  });

  // ── Build cells ──
  const nodeEls = {};

  for (const [key, st] of Object.entries(states)) {
    const pos = positions[key];
    if (!pos) continue;

    const g = svgEl('g', {});
    const node = { g, pos, singleAction: null, subEls: [] };

    const rect = svgEl('rect', {
      x: pos.cx - CELL_W / 2, y: pos.cy - CELL_H / 2,
      width: CELL_W, height: CELL_H,
      rx: 4, fill: 'transparent', stroke: '#222', 'stroke-width': '1',
    });

    const label = svgEl('text', {
      x: pos.cx, y: pos.cy + 1,
      fill: '#444', 'font-size': '9', 'text-anchor': 'middle',
      'dominant-baseline': 'central',
      style: 'font-family:system-ui,sans-serif;pointer-events:none',
    });
    label.textContent = st.label;

    g.append(rect, label);
    svg.appendChild(g);

    // Whole-cell click (for single-transition targets)
    g.addEventListener('click', () => {
      if (node.singleAction) node.singleAction();
    });

    g.addEventListener('mouseenter', () => {
      if (node.singleAction) {
        rect.setAttribute('stroke', '#444');
        label.setAttribute('fill', '#999');
      }
    });

    g.addEventListener('mouseleave', () => update(currentState));

    node.rect = rect;
    node.label = label;
    nodeEls[key] = node;
  }

  // ── Update ──
  let currentState = null;

  function update(state) {
    currentState = state;

    // Group transitions by target
    const byTarget = {};
    for (const [lbl, target, opts] of (transitions[state] || [])) {
      if (!byTarget[target]) byTarget[target] = [];
      byTarget[target].push({ label: lbl, opts });
    }

    for (const [key, n] of Object.entries(nodeEls)) {
      const active = key === state;
      const txns = byTarget[key];
      const canReach = !!txns;

      // Clear previous sub-buttons
      for (const el of n.subEls) el.remove();
      n.subEls = [];
      n.singleAction = null;

      if (active) {
        n.rect.setAttribute('stroke', '#555');
        n.rect.setAttribute('fill', '#1a1a1a');
        n.label.setAttribute('fill', '#aaa');
        n.label.setAttribute('y', n.pos.cy + 1);
        n.g.style.cursor = 'default';
      } else if (canReach && txns.length === 1) {
        // Single transition — whole cell clickable
        n.rect.setAttribute('stroke', '#2a2a2a');
        n.rect.setAttribute('fill', 'transparent');
        n.label.setAttribute('fill', '#555');
        n.label.setAttribute('y', n.pos.cy + 1);
        n.g.style.cursor = 'pointer';
        n.singleAction = () => {
          if (onTransition) onTransition(key, txns[0].opts);
        };
      } else if (canReach) {
        // Multiple transitions — show sub-buttons
        n.rect.setAttribute('stroke', '#2a2a2a');
        n.rect.setAttribute('fill', 'transparent');
        n.label.setAttribute('fill', '#555');
        n.label.setAttribute('y', n.pos.cy - 6);
        n.g.style.cursor = 'default';

        const spacing = CELL_W / (txns.length + 1);
        txns.forEach((txn, i) => {
          const bx = n.pos.cx - CELL_W / 2 + spacing * (i + 1);
          const btn = svgEl('text', {
            x: bx, y: n.pos.cy + 9,
            fill: '#333', 'font-size': '7', 'text-anchor': 'middle',
            'dominant-baseline': 'central',
            style: 'font-family:system-ui,sans-serif;cursor:pointer',
          });
          btn.textContent = txn.label;
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (onTransition) onTransition(key, txn.opts);
          });
          btn.addEventListener('mouseenter', () => btn.setAttribute('fill', '#999'));
          btn.addEventListener('mouseleave', () => btn.setAttribute('fill', '#333'));
          n.g.appendChild(btn);
          n.subEls.push(btn);
        });
      } else {
        // Unreachable
        n.rect.setAttribute('stroke', '#1a1a1a');
        n.rect.setAttribute('fill', 'transparent');
        n.label.setAttribute('fill', '#262626');
        n.label.setAttribute('y', n.pos.cy + 1);
        n.g.style.cursor = 'default';
      }
    }
  }

  return { el: svg, update };
}
