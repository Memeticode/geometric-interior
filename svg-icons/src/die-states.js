// ══════════════════════════════════════════════════
// Die State Definitions — square frame + pip circles
// ══════════════════════════════════════════════════

import { S, HP, HC } from './morph-engine.js';

// Frame corners: (5,5) (19,5) (19,19) (5,19)
export const dieFrame = {
  L1: { ...S(5, 5, 19, 5), sw: 1.5, da: '100 0', o: 0.8 },
  L2: { ...S(19, 5, 19, 19), sw: 1.5, da: '100 0', o: 0.8 },
  L3: { ...S(19, 19, 5, 19), sw: 1.5, da: '100 0', o: 0.8 },
  L4: { ...S(5, 19, 5, 5), sw: 1.5, da: '100 0', o: 0.8 },
  L5: HP, L6: HP, L7: HP, L8: HP,
};

export const dieP1 = { cx: 12, cy: 12, r: 0, o: 0, sw: 0.75 };

// Pip positions: center, TL, BR, TR, BL, ML, MR
export const pipPos = [
  [12, 12], [8, 8], [16, 16], [16, 8], [8, 16], [8, 12], [16, 12]
];

export const PR = 1.25; // pip radius

export function makeDie(visible) {
  // visible: array of 7 booleans [C1..C7]
  const st = { ...dieFrame, P1: dieP1 };
  for (let i = 0; i < 7; i++) {
    const k = 'C' + (i + 1);
    st[k] = visible[i]
      ? { cx: pipPos[i][0], cy: pipPos[i][1], r: PR, o: 1 }
      : { cx: pipPos[i][0], cy: pipPos[i][1], r: 0, o: 0 };
  }
  return st;
}

//                   C1    C2    C3    C4    C5    C6    C7
export const die1 = makeDie([1,    0,    0,    0,    0,    0,    0]);
export const die2 = makeDie([0,    1,    1,    0,    0,    0,    0]);
export const die3 = makeDie([1,    1,    1,    0,    0,    0,    0]);
export const die4 = makeDie([0,    1,    1,    1,    1,    0,    0]);
export const die5 = makeDie([1,    1,    1,    1,    1,    0,    0]);
export const die6 = makeDie([0,    1,    1,    1,    1,    1,    1]);
export const dieStates = [die1, die2, die3, die4, die5, die6];

// Collapsed die (for roll animation midpoint)
export const dieCollapsed = (() => {
  const st = { ...dieFrame, P1: dieP1 };
  for (let i = 1; i <= 4; i++) st['L' + i] = { ...dieFrame['L' + i], o: 0.3 };
  for (let i = 0; i < 7; i++) {
    st['C' + (i + 1)] = { cx: pipPos[i][0], cy: pipPos[i][1], r: 0.4, o: 0.2 };
  }
  return st;
})();
