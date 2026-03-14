import { buildMorphSVG, setState, applyState, EASE, STATE_GROUPS, STATES } from '@svg-icons';

const grid = document.getElementById('grid');
const sidebar = document.getElementById('matrix-sidebar');

// Converge ↔ dissipate cells should be blank
const BLANK_PAIRS = new Set(['converge|dissipate', 'dissipate|converge']);

// ── Sidebar: group visibility checkboxes ──
const groupVisibility = {};
for (const g of STATE_GROUPS) {
  groupVisibility[g.name] = true;
  const label = document.createElement('label');
  label.className = 'matrix-filter-label';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = true;
  cb.addEventListener('change', () => {
    groupVisibility[g.name] = cb.checked;
    buildGrid();
  });
  label.appendChild(cb);
  label.appendChild(document.createTextNode(' ' + g.name));
  sidebar.appendChild(label);
}

// ── Helper: create a small static icon SVG ──
function makeIconThumb(stateKey) {
  const wrap = document.createElement('div');
  wrap.className = 'icon-thumb';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  wrap.appendChild(svg);
  const elMap = buildMorphSVG(svg);
  setState(elMap, STATES[stateKey]);
  return wrap;
}

// ── Build / rebuild grid ──
function buildGrid() {
  grid.innerHTML = '';

  const visibleGroups = STATE_GROUPS.filter(g => groupVisibility[g.name]);
  const ordered = visibleGroups.flatMap(g => g.keys);
  const N = ordered.length;
  if (N < 2) return;

  // Group boundaries within filtered list
  const groupBounds = [];
  let gi = 0;
  for (const g of visibleGroups) {
    groupBounds.push({ name: g.name, start: gi, end: gi + g.keys.length });
    gi += g.keys.length;
  }

  function groupBoundaryAfter(i) {
    return groupBounds.find(b => b.end === i + 1 && i + 1 < N) || null;
  }

  // Column sizing: row-header + data columns with group gaps
  const colSizes = ['auto'];
  for (let c = 0; c < N - 1; c++) {
    if (c > 0 && groupBoundaryAfter(c - 1)) colSizes.push('8px');
    colSizes.push('44px');
  }
  grid.style.gridTemplateColumns = colSizes.join(' ');

  // Row sizing: col-header + data rows with group gaps
  const rowSizes = ['auto'];
  for (let r = 1; r < N; r++) {
    if (groupBoundaryAfter(r - 1)) rowSizes.push('8px');
    rowSizes.push('44px');
  }
  grid.style.gridTemplateRows = rowSizes.join(' ');

  const totalCols = colSizes.length;
  const colHeaders = {};
  const rowHeaders = {};

  // ── Row 0: column headers (stacked text + icon, centered) ──
  grid.appendChild(document.createElement('div')); // corner

  for (let c = 0; c < N - 1; c++) {
    if (c > 0 && groupBoundaryAfter(c - 1)) {
      const spacer = document.createElement('div');
      spacer.className = 'group-gap';
      grid.appendChild(spacer);
    }
    const wrap = document.createElement('div');
    wrap.className = 'col-header-wrap';
    const h = document.createElement('div');
    h.className = 'header col-header';
    h.textContent = ordered[c];
    wrap.appendChild(h);
    const icon = makeIconThumb(ordered[c]);
    wrap.appendChild(icon);
    wrap.dataset.col = c;
    grid.appendChild(wrap);
    colHeaders[c] = [h, icon];
  }

  // ── Data rows ──
  for (let r = 1; r < N; r++) {
    // Group gap row (spacers only, no labels inside)
    if (groupBoundaryAfter(r - 1)) {
      for (let i = 0; i < totalCols; i++) {
        const spacer = document.createElement('div');
        spacer.className = 'group-gap';
        grid.appendChild(spacer);
      }
    }

    // Row header (stacked text above icon, centered)
    const rhWrap = document.createElement('div');
    rhWrap.className = 'row-header-wrap';
    const rh = document.createElement('div');
    rh.className = 'header row-header';
    rh.textContent = ordered[r];
    rhWrap.appendChild(rh);
    const rowIcon = makeIconThumb(ordered[r]);
    rhWrap.appendChild(rowIcon);
    rhWrap.dataset.row = r;
    grid.appendChild(rhWrap);
    rowHeaders[r] = [rh, rowIcon];

    // Cells
    for (let c = 0; c < N - 1; c++) {
      if (c > 0 && groupBoundaryAfter(c - 1)) {
        const spacer = document.createElement('div');
        spacer.className = 'group-gap';
        grid.appendChild(spacer);
      }

      const keyR = ordered[r];
      const keyC = ordered[c];

      // Diagonal or blank pair (converge ↔ dissipate)
      if (c === r || BLANK_PAIRS.has(`${keyC}|${keyR}`)) {
        const diag = document.createElement('div');
        diag.className = 'cell diagonal';
        grid.appendChild(diag);
        continue;
      }

      // Morph cell
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.title = `${keyC} \u2194 ${keyR}`;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      cell.appendChild(svg);

      const elMap = buildMorphSVG(svg);
      const stateA = STATES[keyC];
      const stateB = STATES[keyR];
      setState(elMap, stateA);

      // Full cycle on click: A → B → A (2s total)
      let animating = false;
      cell.addEventListener('click', () => {
        if (animating) return;
        animating = true;
        const t0 = performance.now();
        const halfDur = 1000;
        (function tick(now) {
          const elapsed = now - t0;
          if (elapsed < halfDur) {
            const t = EASE(Math.min(elapsed / halfDur, 1));
            applyState(elMap, stateA, stateB, t);
          } else {
            const t = EASE(Math.min((elapsed - halfDur) / halfDur, 1));
            applyState(elMap, stateB, stateA, t);
          }
          if (elapsed < halfDur * 2) requestAnimationFrame(tick);
          else animating = false;
        })(performance.now());
      });

      // Hover: highlight corresponding row/col headers
      cell.addEventListener('mouseenter', () => {
        const ri = cell.dataset.row, ci = cell.dataset.col;
        for (const el of (rowHeaders[ri] || [])) el.classList.add('highlight');
        for (const el of (colHeaders[ci] || [])) el.classList.add('highlight');
      });
      cell.addEventListener('mouseleave', () => {
        const ri = cell.dataset.row, ci = cell.dataset.col;
        for (const el of (rowHeaders[ri] || [])) el.classList.remove('highlight');
        for (const el of (colHeaders[ci] || [])) el.classList.remove('highlight');
      });

      grid.appendChild(cell);
    }
  }
}

buildGrid();
