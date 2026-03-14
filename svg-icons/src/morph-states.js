// ══════════════════════════════════════════════════
// Morph State Definitions + Color Map
// ══════════════════════════════════════════════════

import { S, HP, HC } from './morph-engine.js';

// ── Color themes per state ──
export const COL = {
  def:     { bg: [26, 26, 26], bd: [34, 34, 34] },
  glyph:  { bg: [26, 21, 32], bd: [42, 31, 53] },
  error:   { bg: [32, 21, 21], bd: [53, 31, 31] },
  loading: { bg: [21, 26, 32], bd: [31, 42, 53] },
  retry:   { bg: [21, 32, 26], bd: [31, 53, 42] },
  eye:     { bg: [26, 26, 30], bd: [34, 34, 48] },
  beacon:  { bg: [26, 30, 26], bd: [34, 48, 34] },
  hex:     { bg: [28, 26, 28], bd: [44, 34, 44] },
  orbit:   { bg: [24, 24, 30], bd: [36, 36, 50] },
  sigil:   { bg: [30, 26, 22], bd: [48, 38, 30] },
  fracture:{ bg: [32, 24, 24], bd: [50, 32, 32] },
  scan:    { bg: [22, 28, 28], bd: [30, 44, 44] },
  pulse:   { bg: [28, 22, 28], bd: [44, 30, 44] },
  bloom:   { bg: [28, 26, 22], bd: [44, 40, 30] },
  seer:    { bg: [24, 22, 30], bd: [36, 30, 50] },
  array:   { bg: [22, 28, 24], bd: [30, 44, 34] },
  heartbeat: { bg: [26, 22, 26], bd: [40, 30, 40] },
  void_:     { bg: [22, 22, 26], bd: [30, 30, 40] },
  dimension: { bg: [24, 22, 32], bd: [36, 30, 52] },
  thorn:     { bg: [32, 24, 22], bd: [52, 34, 30] },
  knot:      { bg: [22, 30, 28], bd: [30, 48, 44] },
  gate:      { bg: [30, 28, 22], bd: [50, 44, 30] },
  wave:      { bg: [22, 26, 32], bd: [30, 38, 52] },
  coil:      { bg: [30, 22, 28], bd: [48, 30, 44] },
  portal:    { bg: [26, 22, 30], bd: [40, 30, 50] },
  converge:  { bg: [17, 17, 17], bd: [22, 22, 22] },
  dissipate: { bg: [17, 17, 17], bd: [22, 22, 22] },
};

// ── State Definitions ──

export const dotsState = {
  L1: HP, L2: HP, L3: HP, L4: HP, L5: HP, L6: HP, L7: HP, L8: HP,
  C1: { cx: 12, cy: 4, r: 1.5, o: 1 },
  C2: { cx: 12, cy: 20, r: 1.5, o: 1 },
  C3: { cx: 4, cy: 12, r: 1.5, o: 1 },
  C4: { cx: 20, cy: 12, r: 1.5, o: 1 },
  C5: { cx: 12, cy: 12, r: 2, o: 1 },
  C6: HC, C7: HC,
  P1: { cx: 12, cy: 12, r: 4, o: 0.3, sw: 0.75 },
};

export const crossState = {
  L1: { ...S(12, 4, 12, 12), sw: 1.5, da: '100 0', o: 0.7 },
  L2: { ...S(12, 12, 12, 20), sw: 1.5, da: '100 0', o: 0.7 },
  L3: { ...S(4, 12, 12, 12), sw: 1.5, da: '100 0', o: 0.7 },
  L4: { ...S(12, 12, 20, 12), sw: 1.5, da: '100 0', o: 0.7 },
  L5: HP, L6: HP, L7: HP, L8: HP,
  C1: { cx: 12, cy: 4, r: 1.5, o: 1 },
  C2: { cx: 12, cy: 20, r: 1.5, o: 1 },
  C3: { cx: 4, cy: 12, r: 1.5, o: 1 },
  C4: { cx: 20, cy: 12, r: 1.5, o: 1 },
  C5: { cx: 12, cy: 12, r: 2, o: 1 },
  C6: HC, C7: HC,
  P1: { cx: 12, cy: 12, r: 4, o: 0.3, sw: 0.75 },
};

export const glyphState = {
  L1: { ...S(12, 5, 5.5, 10.75), sw: 1.25, da: '3.5 2', o: 0.55 },
  L2: { ...S(5.5, 10.75, 7.75, 17.6), sw: 1.25, da: '3.5 2', o: 0.55 },
  L3: { ...S(7.75, 17.6, 16.25, 17.6), sw: 1.25, da: '3.5 2', o: 0.55 },
  L4: { ...S(16.25, 17.6, 18.5, 10.75), sw: 1.25, da: '3.5 2', o: 0.55 },
  L5: { ...S(18.5, 10.75, 12, 5), sw: 1.25, da: '3.5 2', o: 0.55 },
  L6: { ...S(12, 12, 12, 5), sw: 0.75, da: '100 0', o: 0.25 },
  L7: { ...S(12, 12, 5.5, 10.75), sw: 0.75, da: '100 0', o: 0.25 },
  L8: { ...S(12, 12, 18.5, 10.75), sw: 0.75, da: '100 0', o: 0.25 },
  C1: { cx: 12, cy: 5, r: 1.5, o: 1 },
  C2: { cx: 5.5, cy: 10.75, r: 1.2, o: 0.6 },
  C3: { cx: 18.5, cy: 10.75, r: 1.2, o: 0.6 },
  C4: { cx: 7.75, cy: 17.6, r: 0.9, o: 0.3 },
  C5: { cx: 16.25, cy: 17.6, r: 0.9, o: 0.3 },
  C6: HC, C7: HC,
  P1: { cx: 12, cy: 5, r: 2.5, o: 0.4, sw: 0.75 },
};

// Error — warning triangle + exclamation mark
export const errorState = {
  L1: { ...S(12, 3, 3, 20), sw: 1.5, da: '100 0', o: 0.8 },
  L2: { ...S(3, 20, 21, 20), sw: 1.5, da: '100 0', o: 0.8 },
  L3: { ...S(21, 20, 12, 3), sw: 1.5, da: '100 0', o: 0.8 },
  L4: { ...S(12, 9, 12, 14.5), sw: 2, da: '100 0', o: 0.9 },
  L5: HP, L6: HP, L7: HP, L8: HP,
  C1: { cx: 12, cy: 17, r: 1.1, o: 0.9 },
  C2: HC, C3: HC, C4: HC, C5: HC, C6: HC, C7: HC,
  P1: { cx: 12, cy: 12, r: 0, o: 0, sw: 0.75 },
};

// Retry — two curved arrows forming a cycle
export const retryState = {
  // Upper arc (left → right, curving up)
  L1: { x1: 5.5, y1: 14, qx: 2.5, qy: 8, x2: 8, y2: 5, sw: 1.5, da: '100 0', o: 0.7 },
  L2: { x1: 8, y1: 5, qx: 14, qy: 2.5, x2: 18, y2: 7, sw: 1.5, da: '100 0', o: 0.7 },
  // Arrowhead 1
  L3: { ...S(18, 7, 15.5, 5), sw: 1.5, da: '100 0', o: 0.7 },
  L7: { ...S(18, 7, 19, 4.5), sw: 1.5, da: '100 0', o: 0.7 },
  // Lower arc (right → left, curving down)
  L4: { x1: 18.5, y1: 10, qx: 21.5, qy: 16, x2: 16, y2: 19, sw: 1.5, da: '100 0', o: 0.7 },
  L5: { x1: 16, y1: 19, qx: 10, qy: 21.5, x2: 6, y2: 17, sw: 1.5, da: '100 0', o: 0.7 },
  // Arrowhead 2
  L6: { ...S(6, 17, 8.5, 19), sw: 1.5, da: '100 0', o: 0.7 },
  L8: { ...S(6, 17, 5, 19.5), sw: 1.5, da: '100 0', o: 0.7 },
  C1: HC, C2: HC, C3: HC, C4: HC, C5: HC, C6: HC, C7: HC,
  P1: { cx: 12, cy: 12, r: 0, o: 0, sw: 0.75 },
};

// Loading — 8 radial spokes at 45deg intervals
export const loadingState = {
  L1: { ...S(16, 12, 20, 12), sw: 1.5, da: '100 0', o: 0.3 },
  L2: { ...S(14.83, 14.83, 17.66, 17.66), sw: 1.5, da: '100 0', o: 0.3 },
  L3: { ...S(12, 16, 12, 20), sw: 1.5, da: '100 0', o: 0.3 },
  L4: { ...S(9.17, 14.83, 6.34, 17.66), sw: 1.5, da: '100 0', o: 0.3 },
  L5: { ...S(8, 12, 4, 12), sw: 1.5, da: '100 0', o: 0.3 },
  L6: { ...S(9.17, 9.17, 6.34, 6.34), sw: 1.5, da: '100 0', o: 0.3 },
  L7: { ...S(12, 8, 12, 4), sw: 1.5, da: '100 0', o: 0.3 },
  L8: { ...S(14.83, 9.17, 17.66, 6.34), sw: 1.5, da: '100 0', o: 0.3 },
  C1: HC, C2: HC, C3: HC, C4: HC, C5: HC, C6: HC, C7: HC,
  P1: { cx: 12, cy: 12, r: 9, o: 0.1, sw: 0.75 },
};

// ── Alien States ──

// Eye — almond-shaped lids, iris ring, pupil
export const eyeState = {
  L1: { x1: 4, y1: 12, qx: 7, qy: 5.5, x2: 12, y2: 6.5, sw: 1.25, da: '100 0', o: 0.7 },
  L2: { x1: 12, y1: 6.5, qx: 17, qy: 5.5, x2: 20, y2: 12, sw: 1.25, da: '100 0', o: 0.7 },
  L3: { x1: 4, y1: 12, qx: 7, qy: 18.5, x2: 12, y2: 17.5, sw: 1.25, da: '100 0', o: 0.7 },
  L4: { x1: 12, y1: 17.5, qx: 17, qy: 18.5, x2: 20, y2: 12, sw: 1.25, da: '100 0', o: 0.7 },
  L5: { ...S(3, 12, 5, 12), sw: 0.75, da: '2 2', o: 0.4 },
  L6: { ...S(19, 12, 21, 12), sw: 0.75, da: '2 2', o: 0.4 },
  L7: HP, L8: HP,
  C1: { cx: 12, cy: 12, r: 2, o: 1 },
  C2: { cx: 4, cy: 12, r: 0.6, o: 0.5 },
  C3: { cx: 20, cy: 12, r: 0.6, o: 0.5 },
  C4: HC, C5: HC, C6: HC, C7: HC,
  P1: { cx: 12, cy: 12, r: 4, o: 0.5, sw: 0.75 },
};

// Beacon — three radiating arms at 120 with tip nodes
export const beaconState = {
  L1: { ...S(12, 10, 12, 4), sw: 1.25, da: '4 3', o: 0.6 },
  L2: { ...S(13.73, 13, 18.93, 16), sw: 1.25, da: '4 3', o: 0.6 },
  L3: { ...S(10.27, 13, 5.07, 16), sw: 1.25, da: '4 3', o: 0.6 },
  L4: { ...S(10, 5, 14, 5), sw: 0.75, da: '100 0', o: 0.3 },
  L5: { ...S(17.5, 14.5, 20, 17.5), sw: 0.75, da: '100 0', o: 0.3 },
  L6: { ...S(6.5, 14.5, 4, 17.5), sw: 0.75, da: '100 0', o: 0.3 },
  L7: HP, L8: HP,
  C1: { cx: 12, cy: 12, r: 2, o: 1 },
  C2: { cx: 12, cy: 4, r: 1.2, o: 0.7 },
  C3: { cx: 18.93, cy: 16, r: 1.2, o: 0.7 },
  C4: { cx: 5.07, cy: 16, r: 1.2, o: 0.7 },
  C5: HC, C6: HC, C7: HC,
  P1: { cx: 12, cy: 12, r: 8, o: 0.25, sw: 0.75 },
};

// Hex — hexagonal frame with corner nodes
export const hexState = {
  L1: { ...S(12, 4, 18.93, 8), sw: 1, da: '3 2', o: 0.55 },
  L2: { ...S(18.93, 8, 18.93, 16), sw: 1, da: '3 2', o: 0.55 },
  L3: { ...S(18.93, 16, 12, 20), sw: 1, da: '3 2', o: 0.55 },
  L4: { ...S(12, 20, 5.07, 16), sw: 1, da: '3 2', o: 0.55 },
  L5: { ...S(5.07, 16, 5.07, 8), sw: 1, da: '3 2', o: 0.55 },
  L6: { ...S(5.07, 8, 12, 4), sw: 1, da: '3 2', o: 0.55 },
  L7: { ...S(5.07, 8, 18.93, 16), sw: 0.5, da: '100 0', o: 0.15 },
  L8: { ...S(18.93, 8, 5.07, 16), sw: 0.5, da: '100 0', o: 0.15 },
  C1: { cx: 12, cy: 12, r: 1.5, o: 1 },
  C2: { cx: 12, cy: 4, r: 0.9, o: 0.5 },
  C3: { cx: 18.93, cy: 8, r: 0.9, o: 0.5 },
  C4: { cx: 18.93, cy: 16, r: 0.9, o: 0.5 },
  C5: { cx: 12, cy: 20, r: 0.9, o: 0.5 },
  C6: { cx: 5.07, cy: 16, r: 0.9, o: 0.5 },
  C7: { cx: 5.07, cy: 8, r: 0.9, o: 0.5 },
  P1: { cx: 12, cy: 12, r: 3, o: 0.3, sw: 0.75 },
};

// Orbit — curved orbital paths with satellite dots
export const orbitState = {
  L1: { x1: 4, y1: 11, qx: 6, qy: 5, x2: 12, y2: 6, sw: 1, da: '100 0', o: 0.4 },
  L2: { x1: 12, y1: 6, qx: 18, qy: 5, x2: 20, y2: 11, sw: 1, da: '100 0', o: 0.4 },
  L3: { x1: 6, y1: 18, qx: 5, qy: 12, x2: 8, y2: 7, sw: 1, da: '100 0', o: 0.35 },
  L4: { x1: 16, y1: 7, qx: 19, qy: 12, x2: 18, y2: 18, sw: 1, da: '100 0', o: 0.35 },
  L5: { x1: 5, y1: 15, qx: 8, qy: 20, x2: 12, y2: 19, sw: 1, da: '100 0', o: 0.3 },
  L6: { x1: 12, y1: 19, qx: 16, qy: 20, x2: 19, y2: 15, sw: 1, da: '100 0', o: 0.3 },
  L7: HP, L8: HP,
  C1: { cx: 12, cy: 12, r: 2.5, o: 1 },
  C2: { cx: 4, cy: 11, r: 1, o: 0.7 },
  C3: { cx: 18, cy: 18, r: 1, o: 0.6 },
  C4: { cx: 8, cy: 7, r: 0.8, o: 0.5 },
  C5: HC, C6: HC, C7: HC,
  P1: { cx: 12, cy: 12, r: 9, o: 0.1, sw: 0.75 },
};

// Sigil — pentagram star, luminous tip nodes
export const sigilState = {
  L1: { ...S(12, 4, 16.7, 18.5), sw: 1, da: '100 0', o: 0.5 },
  L2: { ...S(16.7, 18.5, 4.4, 9.5), sw: 1, da: '100 0', o: 0.5 },
  L3: { ...S(4.4, 9.5, 19.6, 9.5), sw: 1, da: '100 0', o: 0.5 },
  L4: { ...S(19.6, 9.5, 7.3, 18.5), sw: 1, da: '100 0', o: 0.5 },
  L5: { ...S(7.3, 18.5, 12, 4), sw: 1, da: '100 0', o: 0.5 },
  L6: { ...S(12, 12, 12, 4), sw: 0.5, da: '100 0', o: 0.15 },
  L7: { ...S(12, 12, 4.4, 9.5), sw: 0.5, da: '100 0', o: 0.15 },
  L8: { ...S(12, 12, 19.6, 9.5), sw: 0.5, da: '100 0', o: 0.15 },
  C1: { cx: 12, cy: 4, r: 1.1, o: 1 },
  C2: { cx: 19.6, cy: 9.5, r: 1.1, o: 0.7 },
  C3: { cx: 16.7, cy: 18.5, r: 1.1, o: 0.5 },
  C4: { cx: 7.3, cy: 18.5, r: 1.1, o: 0.5 },
  C5: { cx: 4.4, cy: 9.5, r: 1.1, o: 0.7 },
  C6: HC, C7: HC,
  P1: { cx: 12, cy: 12, r: 8, o: 0.2, sw: 0.75 },
};

// Fracture — shattered hexagon with debris
export const fractureState = {
  L1: { ...S(12, 4, 18.93, 8), sw: 1.5, da: '4 3', o: 0.7 },
  L2: { ...S(18.93, 8, 18.93, 16), sw: 1.5, da: '4 3', o: 0.7 },
  L3: { ...S(18.93, 16, 12, 20), sw: 1.5, da: '4 3', o: 0.7 },
  L4: { ...S(12, 4, 8, 6), sw: 0.75, da: '100 0', o: 0.5 },
  L5: { ...S(12, 20, 8, 18), sw: 0.75, da: '100 0', o: 0.5 },
  L6: { ...S(5.07, 8, 3, 5), sw: 0.75, da: '100 0', o: 0.4 },
  L7: { ...S(5.07, 16, 2.5, 18.5), sw: 0.75, da: '100 0', o: 0.4 },
  L8: { ...S(5.07, 8, 5.07, 16), sw: 0.75, da: '3 4', o: 0.15 },
  C1: { cx: 3, cy: 5, r: 0.8, o: 0.6 },
  C2: { cx: 2.5, cy: 18.5, r: 0.8, o: 0.5 },
  C3: { cx: 8, cy: 12, r: 0.6, o: 0.4 },
  C4: { cx: 10, cy: 10, r: 0.6, o: 0.3 },
  C5: { cx: 6, cy: 14, r: 0.5, o: 0.25 },
  C6: HC, C7: HC,
  P1: { cx: 12, cy: 12, r: 7, o: 0.15, sw: 0.5 },
};

// Scan — horizontal sweep lines, crosshair, data nodes
export const scanState = {
  L1: { ...S(3, 7, 21, 7), sw: 0.75, da: '2 3', o: 0.4 },
  L2: { ...S(3, 10, 21, 10), sw: 0.75, da: '2 3', o: 0.5 },
  L3: { ...S(3, 14, 21, 14), sw: 0.75, da: '2 3', o: 0.5 },
  L4: { ...S(3, 17, 21, 17), sw: 0.75, da: '2 3', o: 0.4 },
  L5: { ...S(12, 3, 12, 12), sw: 0.5, da: '100 0', o: 0.3 },
  L6: { ...S(12, 12, 12, 21), sw: 0.5, da: '100 0', o: 0.3 },
  L7: { ...S(8, 8, 12, 12), sw: 0.5, da: '100 0', o: 0.2 },
  L8: { ...S(12, 12, 16, 16), sw: 0.5, da: '100 0', o: 0.2 },
  C1: { cx: 12, cy: 12, r: 1.5, o: 0.8 },
  C2: { cx: 7, cy: 7, r: 0.8, o: 0.5 },
  C3: { cx: 17, cy: 10, r: 0.8, o: 0.5 },
  C4: { cx: 9, cy: 14, r: 0.8, o: 0.5 },
  C5: { cx: 15, cy: 17, r: 0.8, o: 0.5 },
  C6: HC, C7: HC,
  P1: { cx: 12, cy: 12, r: 8, o: 0.3, sw: 0.75 },
};

// Heartbeat — ECG waveform with peak markers (utility)
export const heartbeatState = {
  L1: { ...S(3, 12, 7, 12), sw: 1.25, da: '100 0', o: 0.5 },
  L2: { ...S(7, 12, 9.5, 5), sw: 1.25, da: '100 0', o: 0.7 },
  L3: { ...S(9.5, 5, 11.5, 19), sw: 1.25, da: '100 0', o: 0.7 },
  L4: { ...S(11.5, 19, 14, 10), sw: 1.25, da: '100 0', o: 0.7 },
  L5: { ...S(14, 10, 21, 12), sw: 1.25, da: '100 0', o: 0.5 },
  L6: HP, L7: HP, L8: HP,
  C1: { cx: 9.5, cy: 5, r: 1.2, o: 0.9 },
  C2: { cx: 11.5, cy: 19, r: 0.8, o: 0.6 },
  C3: { cx: 3, cy: 12, r: 0.6, o: 0.4 },
  C4: { cx: 21, cy: 12, r: 0.6, o: 0.4 },
  C5: HC, C6: HC, C7: HC,
  P1: { cx: 12, cy: 12, r: 0, o: 0, sw: 0.75 },
};

// Bloom — flower/starburst, radiating petal curves
export const bloomState = {
  L1: { x1: 10, y1: 10, qx: 12, qy: 3, x2: 14, y2: 10, sw: 1.25, da: '100 0', o: 0.6 },
  L2: { x1: 14, y1: 10, qx: 21, qy: 12, x2: 14, y2: 14, sw: 1.25, da: '100 0', o: 0.6 },
  L3: { x1: 14, y1: 14, qx: 12, qy: 21, x2: 10, y2: 14, sw: 1.25, da: '100 0', o: 0.6 },
  L4: { x1: 10, y1: 14, qx: 3, qy: 12, x2: 10, y2: 10, sw: 1.25, da: '100 0', o: 0.6 },
  L5: { ...S(12, 12, 15, 9), sw: 0.75, da: '100 0', o: 0.3 },
  L6: { ...S(12, 12, 15, 15), sw: 0.75, da: '100 0', o: 0.3 },
  L7: { ...S(12, 12, 9, 15), sw: 0.75, da: '100 0', o: 0.3 },
  L8: { ...S(12, 12, 9, 9), sw: 0.75, da: '100 0', o: 0.3 },
  C1: { cx: 12, cy: 12, r: 2, o: 1 },
  C2: { cx: 12, cy: 3, r: 1, o: 0.7 },
  C3: { cx: 21, cy: 12, r: 1, o: 0.7 },
  C4: { cx: 12, cy: 21, r: 1, o: 0.7 },
  C5: { cx: 3, cy: 12, r: 1, o: 0.7 },
  C6: HC, C7: HC,
  P1: { cx: 12, cy: 12, r: 7, o: 0.3, sw: 0.75 },
};

// Void — nebular vortex: gaseous wisps (scaled 1.2× from center)
export const voidState = {
  // Spiral arms — scaled 1.35× from center (12,12)
  L1: { x1: 7.95, y1: 6.6, qx: 5.25, qy: 10, x2: 7.95, y2: 13.35, sw: 0.8, da: '2 2', o: 0.4 },
  L2: { x1: 7.95, y1: 13.35, qx: 10.65, qy: 16.05, x2: 12.7, y2: 12.7, sw: 0.8, da: '2 2', o: 0.35 },
  // Second arm — opposite side
  L3: { x1: 16.05, y1: 17.4, qx: 18.75, qy: 14, x2: 16.05, y2: 10.65, sw: 0.8, da: '2 2', o: 0.4 },
  L4: { x1: 16.05, y1: 10.65, qx: 13.35, qy: 7.95, x2: 11.3, y2: 11.3, sw: 0.8, da: '2 2', o: 0.35 },
  // Gas wisps — puffier
  L5: { x1: 9.3, y1: 9.3, qx: 11.3, qy: 6.6, x2: 13.35, y2: 9.3, sw: 0.5, da: '2 2', o: 0.25 },
  L6: { x1: 10.65, y1: 14.7, qx: 12.7, qy: 17.4, x2: 14.7, y2: 14.7, sw: 0.5, da: '2 2', o: 0.22 },
  L7: { x1: 7.95, y1: 11.3, qx: 9.3, qy: 13.35, x2: 10, y2: 11.3, sw: 0.4, da: '2 3', o: 0.18 },
  L8: { x1: 14, y1: 12.7, qx: 14.7, qy: 10.65, x2: 16.05, y2: 12.7, sw: 0.4, da: '2 3', o: 0.18 },
  C1: { cx: 12, cy: 12, r: 1.4, o: 0.85 },      // vortex eye
  C2: { cx: 8.6, cy: 8.6, r: 1.2, o: 0.28 },    // gas knot
  C3: { cx: 15.4, cy: 15.4, r: 1, o: 0.25 },    // gas knot
  C4: { cx: 9.3, cy: 14.7, r: 0.7, o: 0.18 },   // wisp node
  C5: { cx: 14.7, cy: 9.3, r: 0.7, o: 0.18 },   // wisp node
  C6: { cx: 13.35, cy: 10.65, r: 0.5, o: 0.15 }, // inner mist
  C7: HC,
  P1: { cx: 12, cy: 12, r: 6.8, o: 0.18, sw: 0.4 },
};

// Seer — double-layered alien eye with inner iris aperture
export const seerState = {
  // Outer lids — wide almond
  L1: { x1: 3, y1: 12, qx: 6, qy: 4, x2: 12, y2: 5, sw: 1.25, da: '100 0', o: 0.6 },
  L2: { x1: 12, y1: 5, qx: 18, qy: 4, x2: 21, y2: 12, sw: 1.25, da: '100 0', o: 0.6 },
  L3: { x1: 3, y1: 12, qx: 6, qy: 20, x2: 12, y2: 19, sw: 1.25, da: '100 0', o: 0.6 },
  L4: { x1: 12, y1: 19, qx: 18, qy: 20, x2: 21, y2: 12, sw: 1.25, da: '100 0', o: 0.6 },
  // Inner iris blades — tighter, dashed
  L5: { x1: 7, y1: 12, qx: 9, qy: 8, x2: 12, y2: 8, sw: 0.75, da: '3 2', o: 0.4 },
  L6: { x1: 12, y1: 8, qx: 15, qy: 8, x2: 17, y2: 12, sw: 0.75, da: '3 2', o: 0.4 },
  L7: { x1: 7, y1: 12, qx: 9, qy: 16, x2: 12, y2: 16, sw: 0.75, da: '3 2', o: 0.4 },
  L8: { x1: 12, y1: 16, qx: 15, qy: 16, x2: 17, y2: 12, sw: 0.75, da: '3 2', o: 0.4 },
  C1: { cx: 12, cy: 12, r: 2, o: 1 },      // pupil
  C2: { cx: 3, cy: 12, r: 0.7, o: 0.4 },   // left corner
  C3: { cx: 21, cy: 12, r: 0.7, o: 0.4 },  // right corner
  C4: { cx: 12, cy: 5, r: 0.5, o: 0.3 },   // upper apex
  C5: { cx: 12, cy: 19, r: 0.5, o: 0.3 },  // lower apex
  C6: HC, C7: HC,
  P1: { cx: 12, cy: 12, r: 4.5, o: 0.35, sw: 0.75 },
};

// Pulse — runic dissolution: carved rune fracturing apart
export const pulseState = {
  // Rune spine — central vertical stroke
  L1: { ...S(12, 4, 12, 20), sw: 1.5, da: '100 0', o: 0.65 },
  // Upper branches — angled from spine (intact)
  L2: { ...S(12, 7, 18, 4), sw: 1.25, da: '3 2', o: 0.55 },
  L3: { ...S(12, 7, 6, 4), sw: 1.25, da: '3 2', o: 0.55 },
  // Lower branches — fracturing away
  L4: { x1: 13, y1: 14, qx: 16, qy: 15, x2: 19, y2: 17, sw: 1, da: '4 3', o: 0.4 },
  L5: { x1: 11, y1: 14, qx: 8, qy: 15, x2: 5, y2: 17, sw: 1, da: '4 3', o: 0.35 },
  // Flying debris shards (pulled inward)
  L6: { ...S(18, 12, 20, 10), sw: 0.75, da: '100 0', o: 0.3 },
  L7: { ...S(5, 11, 3, 9), sw: 0.75, da: '100 0', o: 0.25 },
  L8: { ...S(14, 19, 15, 21), sw: 0.5, da: '100 0', o: 0.2 },
  C1: { cx: 12, cy: 7, r: 0.5, o: 0.6 },       // upper junction
  C2: { cx: 12, cy: 14, r: 0.4, o: 0.45 },     // fracture point
  C3: { cx: 12, cy: 4, r: 0.3, o: 0.35 },      // spine tip
  C4: { cx: 17, cy: 16, r: 0.3, o: 0.2 },      // break point
  C5: { cx: 7, cy: 16, r: 0.3, o: 0.2 },       // break point
  C6: HC, C7: HC,
  P1: { cx: 12, cy: 12, r: 7, o: 0.2, sw: 0.75 },
};

// Array — runic array, scattered carved marks with depth
export const arrayState = {
  // Primary runic strokes — irregular angles like carved marks
  L1: { x1: 5, y1: 4, qx: 8, qy: 6, x2: 11, y2: 5, sw: 1.25, da: '100 0', o: 0.6 },
  L2: { x1: 14, y1: 3, qx: 16, qy: 7, x2: 19, y2: 6, sw: 1, da: '100 0', o: 0.5 },
  L3: { x1: 3, y1: 10, qx: 7, qy: 14, x2: 10, y2: 13, sw: 1.25, da: '100 0', o: 0.55 },
  L4: { x1: 15, y1: 11, qx: 17, qy: 15, x2: 20, y2: 14, sw: 1, da: '100 0', o: 0.5 },
  // Smaller fragment strokes — debris/accent marks
  L5: { ...S(6, 17, 10, 19), sw: 0.75, da: '4 3', o: 0.35 },
  L6: { ...S(13, 17, 18, 20), sw: 0.75, da: '4 3', o: 0.3 },
  L7: { ...S(8, 8, 14, 10), sw: 0.5, da: '3 4', o: 0.2 },
  L8: { ...S(11, 15, 16, 17), sw: 0.5, da: '3 4', o: 0.2 },
  C1: { cx: 12, cy: 12, r: 1.2, o: 0.8 },
  C2: { cx: 5, cy: 4, r: 0.8, o: 0.5 },
  C3: { cx: 19, cy: 6, r: 0.7, o: 0.45 },
  C4: { cx: 3, cy: 10, r: 0.7, o: 0.4 },
  C5: { cx: 20, cy: 14, r: 0.6, o: 0.35 },
  C6: { cx: 10, cy: 19, r: 0.5, o: 0.3 },
  C7: { cx: 18, cy: 20, r: 0.5, o: 0.25 },
  P1: { cx: 12, cy: 12, r: 9, o: 0.15, sw: 0.5 },
};

// Dimension — dimensional overlay: concentric tilted rings suggesting depth
export const dimensionState = {
  // Outer ring (two arcs, slight tilt)
  L1: { x1: 4, y1: 13, qx: 12, qy: 3, x2: 20, y2: 11, sw: 1, da: '100 0', o: 0.5 },
  L2: { x1: 20, y1: 11, qx: 12, qy: 21, x2: 4, y2: 13, sw: 1, da: '100 0', o: 0.5 },
  // Middle ring (more tilted, offset)
  L3: { x1: 6, y1: 14, qx: 12, qy: 5, x2: 18, y2: 10, sw: 0.9, da: '100 0', o: 0.45 },
  L4: { x1: 18, y1: 10, qx: 12, qy: 19, x2: 6, y2: 14, sw: 0.9, da: '100 0', o: 0.45 },
  // Inner ring (counter-tilted, dashed)
  L5: { x1: 9, y1: 10, qx: 12, qy: 7, x2: 15, y2: 14, sw: 0.75, da: '3 2', o: 0.4 },
  L6: { x1: 15, y1: 14, qx: 12, qy: 17, x2: 9, y2: 10, sw: 0.75, da: '3 2', o: 0.4 },
  // Energy wisps leaking from rift
  L7: { x1: 12, y1: 11, qx: 4, qy: 7, x2: 3, y2: 4, sw: 0.5, da: '2 3', o: 0.25 },
  L8: { x1: 12, y1: 13, qx: 20, qy: 17, x2: 21, y2: 20, sw: 0.5, da: '2 3', o: 0.25 },
  C1: { cx: 12, cy: 12, r: 1.5, o: 0.85 },   // rift center
  C2: { cx: 4, cy: 13, r: 0.5, o: 0.35 },    // outer ring anchor
  C3: { cx: 20, cy: 11, r: 0.5, o: 0.35 },   // outer ring anchor
  C4: { cx: 3, cy: 4, r: 0.4, o: 0.25 },     // wisp tip
  C5: { cx: 21, cy: 20, r: 0.4, o: 0.25 },   // wisp tip
  C6: HC, C7: HC,
  P1: { cx: 12, cy: 12, r: 9, o: 0.15, sw: 0.5 },
};

// Thorn — radiating ward: aggressive spikes from central mass
export const thornState = {
  // Central stem — slight curve, asymmetric
  L1: { x1: 11, y1: 20, qx: 11.5, qy: 14, x2: 12, y2: 6, sw: 1.4, da: '100 0', o: 0.65 },
  // Main right branch
  L2: { x1: 12, y1: 10, qx: 16, qy: 8, x2: 20, y2: 5, sw: 1.1, da: '100 0', o: 0.55 },
  // Main left branch
  L3: { x1: 11.5, y1: 14, qx: 7, qy: 13, x2: 3, y2: 10, sw: 1.1, da: '100 0', o: 0.5 },
  // Secondary right-lower branch
  L4: { x1: 11.8, y1: 16, qx: 15, qy: 17, x2: 18, y2: 19, sw: 0.8, da: '100 0', o: 0.4 },
  // Barb hook on right branch tip
  L5: { x1: 20, y1: 5, qx: 19, qy: 3, x2: 17, y2: 4, sw: 0.7, da: '100 0', o: 0.45 },
  // Barb hook on left branch tip
  L6: { x1: 3, y1: 10, qx: 2.5, qy: 12, x2: 4, y2: 13, sw: 0.6, da: '100 0', o: 0.35 },
  // Small spur from stem
  L7: { x1: 11.8, y1: 8, qx: 14, qy: 6, x2: 15.5, y2: 4, sw: 0.5, da: '3 2', o: 0.3 },
  // Root tendril at base
  L8: { x1: 11, y1: 20, qx: 8, qy: 21, x2: 6, y2: 20, sw: 0.6, da: '2 2', o: 0.25 },
  C1: { cx: 12, cy: 12, r: 1.2, o: 0.7 },       // central growth node
  C2: { cx: 20, cy: 5, r: 0.6, o: 0.5 },        // right branch tip
  C3: { cx: 3, cy: 10, r: 0.5, o: 0.4 },        // left branch tip
  C4: { cx: 18, cy: 19, r: 0.4, o: 0.3 },       // lower-right tip
  C5: { cx: 15.5, cy: 4, r: 0.35, o: 0.25 },    // spur tip
  C6: { cx: 6, cy: 20, r: 0.3, o: 0.2 },        // root tip
  C7: HC,
  P1: { cx: 11.5, cy: 12, r: 7, o: 0.1, sw: 0.3 },
};

// Knot — figure-8 infinity knot: continuous strand with over/under crossings
export const knotState = {
  // Main strand — 4 segments forming figure-8 loop
  L1: { x1: 12, y1: 10, qx: 6, qy: 4, x2: 5, y2: 10, sw: 1.3, da: '100 0', o: 0.7 },     // left lobe top (OVER)
  L2: { x1: 5, y1: 10, qx: 4, qy: 16, x2: 12, y2: 14, sw: 1.3, da: '100 0', o: 0.35 },    // left lobe bottom (UNDER)
  L3: { x1: 12, y1: 14, qx: 18, qy: 20, x2: 19, y2: 14, sw: 1.3, da: '100 0', o: 0.7 },   // right lobe bottom (OVER)
  L4: { x1: 19, y1: 14, qx: 20, qy: 8, x2: 12, y2: 10, sw: 1.3, da: '100 0', o: 0.35 },   // right lobe top (UNDER)
  // Inner parallel traces for thickness illusion
  L5: { x1: 12, y1: 10.5, qx: 7, qy: 5, x2: 6, y2: 10, sw: 0.6, da: '3 2', o: 0.25 },
  L6: { x1: 6, y1: 10, qx: 5, qy: 15, x2: 12, y2: 13.5, sw: 0.6, da: '3 2', o: 0.2 },
  L7: { x1: 12, y1: 13.5, qx: 17, qy: 19, x2: 18, y2: 14, sw: 0.6, da: '3 2', o: 0.25 },
  L8: { x1: 18, y1: 14, qx: 19, qy: 9, x2: 12, y2: 10.5, sw: 0.6, da: '3 2', o: 0.2 },
  C1: { cx: 12, cy: 12, r: 1, o: 0.65 },       // center crossing nexus
  C2: { cx: 5, cy: 10, r: 0.6, o: 0.45 },      // left apex
  C3: { cx: 19, cy: 14, r: 0.6, o: 0.45 },     // right apex
  C4: { cx: 8, cy: 6, r: 0.35, o: 0.25 },      // upper-left strand marker
  C5: { cx: 16, cy: 18, r: 0.35, o: 0.25 },    // lower-right strand marker
  C6: HC, C7: HC,
  P1: { cx: 12, cy: 12, r: 8, o: 0.12, sw: 0.4 },
};

// Gate — dimensional threshold: gothic arch doorway, closed static, opens in animation
export const gateState = {
  // Pillars
  L1: { ...S(7, 20, 7, 7), sw: 1.5, da: '100 0', o: 0.65 },
  L2: { ...S(17, 20, 17, 7), sw: 1.5, da: '100 0', o: 0.65 },
  // Pointed arch connecting pillars
  L3: { x1: 7, y1: 7, qx: 12, qy: 2, x2: 17, y2: 7, sw: 1.5, da: '100 0', o: 0.6 },
  // Left door — curves from left pillar base to center (closed)
  L4: { x1: 7, y1: 20, qx: 9.5, qy: 16.5, x2: 12, y2: 13, sw: 1, da: '100 0', o: 0.5 },
  // Right door — curves from right pillar base to center (closed)
  L5: { x1: 17, y1: 20, qx: 14.5, qy: 16.5, x2: 12, y2: 13, sw: 1, da: '100 0', o: 0.5 },
  // Inner energy line — hidden when closed
  L6: { ...S(9, 16, 15, 16), sw: 0.5, da: '2 3', o: 0.05 },
  // Pillar rune marks
  L7: { ...S(5, 14, 7, 14), sw: 0.4, da: '100 0', o: 0.15 },
  L8: { ...S(17, 14, 19, 14), sw: 0.4, da: '100 0', o: 0.15 },
  C1: { cx: 12, cy: 4, r: 0.7, o: 0.5 },     // keystone (dim when closed)
  C2: { cx: 7, cy: 20, r: 0.5, o: 0.5 },     // left base
  C3: { cx: 17, cy: 20, r: 0.5, o: 0.5 },    // right base
  C4: { cx: 12, cy: 12, r: 0.8, o: 0.05 },   // inner void (hidden when closed)
  C5: { cx: 12, cy: 17, r: 0.4, o: 0.05 },   // floating node (hidden when closed)
  C6: HC, C7: HC,
  P1: { cx: 12, cy: 13, r: 4, o: 0.08, sw: 0.3 },
};

// Wave — flowing current: parallel sinusoidal energy lines
export const waveState = {
  // Top wave (two halves) — meets at x=11.5
  L1: { x1: 3, y1: 7, qx: 7, qy: 3, x2: 11.5, y2: 7, sw: 1.2, da: '100 0', o: 0.6 },
  L2: { x1: 11.5, y1: 7, qx: 16, qy: 11, x2: 21, y2: 7, sw: 1.2, da: '100 0', o: 0.6 },
  // Middle wave — meets at x=12
  L3: { x1: 3, y1: 12, qx: 7.5, qy: 8, x2: 12, y2: 12, sw: 1, da: '100 0', o: 0.5 },
  L4: { x1: 12, y1: 12, qx: 16.5, qy: 16, x2: 21, y2: 12, sw: 1, da: '100 0', o: 0.5 },
  // Bottom wave — meets at x=12.5
  L5: { x1: 3, y1: 17, qx: 8, qy: 13, x2: 12.5, y2: 17, sw: 0.8, da: '100 0', o: 0.4 },
  L6: { x1: 12.5, y1: 17, qx: 17, qy: 21, x2: 21, y2: 17, sw: 0.8, da: '100 0', o: 0.4 },
  // Vertical connecting wisps
  L7: { x1: 7, y1: 9, qx: 8, qy: 10, x2: 7, y2: 14, sw: 0.4, da: '2 3', o: 0.18 },
  L8: { x1: 17, y1: 9, qx: 16, qy: 10, x2: 17, y2: 14, sw: 0.4, da: '2 3', o: 0.18 },
  C1: { cx: 12, cy: 12, r: 0.3, o: 0.12 },   // very dim center
  C2: { cx: 3, cy: 7, r: 0.4, o: 0.35 },     // wave origins
  C3: { cx: 3, cy: 12, r: 0.35, o: 0.3 },
  C4: { cx: 3, cy: 17, r: 0.3, o: 0.25 },
  C5: { cx: 21, cy: 7, r: 0.4, o: 0.35 },    // wave endpoints
  C6: { cx: 21, cy: 12, r: 0.35, o: 0.3 },
  C7: HC,
  P1: { cx: 12, cy: 12, r: 9, o: 0.12, sw: 0.4 },
};

// Coil — helix rune: intertwined double-strand with cross-rungs
export const coilState = {
  // Strand A — S-curve (top-left to bottom-right)
  L1: { x1: 8, y1: 3, qx: 4, qy: 8, x2: 12, y2: 12, sw: 1.1, da: '100 0', o: 0.55 },
  L2: { x1: 12, y1: 12, qx: 20, qy: 16, x2: 16, y2: 21, sw: 1.1, da: '100 0', o: 0.55 },
  // Strand B — reverse S-curve (top-right to bottom-left)
  L3: { x1: 16, y1: 3, qx: 20, qy: 8, x2: 12, y2: 12, sw: 1.1, da: '100 0', o: 0.55 },
  L4: { x1: 12, y1: 12, qx: 4, qy: 16, x2: 8, y2: 21, sw: 1.1, da: '100 0', o: 0.55 },
  // Cross-rungs connecting strands
  L5: { ...S(9, 6, 15, 6), sw: 0.6, da: '3 2', o: 0.3 },
  L6: { ...S(7, 10, 17, 10), sw: 0.5, da: '3 2', o: 0.25 },
  L7: { ...S(7, 14, 17, 14), sw: 0.5, da: '3 2', o: 0.25 },
  L8: { ...S(9, 18, 15, 18), sw: 0.6, da: '3 2', o: 0.3 },
  C1: { cx: 12, cy: 12, r: 1, o: 0.7 },      // center crossing
  C2: { cx: 8, cy: 3, r: 0.5, o: 0.45 },     // strand A top
  C3: { cx: 16, cy: 3, r: 0.5, o: 0.45 },    // strand B top
  C4: { cx: 16, cy: 21, r: 0.5, o: 0.45 },   // strand A bottom
  C5: { cx: 8, cy: 21, r: 0.5, o: 0.45 },    // strand B bottom
  C6: HC, C7: HC,
  P1: { cx: 12, cy: 12, r: 8, o: 0.15, sw: 0.5 },
};

// Portal — dimensional rift: jagged vertical tear, sealed/open cycle
export const portalState = {
  // Left rift edge (top to bottom)
  L1: { x1: 10, y1: 3, qx: 8, qy: 6, x2: 11, y2: 8, sw: 1.1, da: '100 0', o: 0.55 },
  L2: { x1: 11, y1: 8, qx: 9, qy: 12, x2: 10.5, y2: 14, sw: 1.1, da: '100 0', o: 0.5 },
  L3: { x1: 10.5, y1: 14, qx: 8.5, qy: 18, x2: 11, y2: 21, sw: 1.1, da: '100 0', o: 0.55 },
  // Right rift edge (mirrors left)
  L4: { x1: 14, y1: 3, qx: 16, qy: 6, x2: 13, y2: 8, sw: 1.1, da: '100 0', o: 0.55 },
  L5: { x1: 13, y1: 8, qx: 15, qy: 12, x2: 13.5, y2: 14, sw: 1.1, da: '100 0', o: 0.5 },
  L6: { x1: 13.5, y1: 14, qx: 15.5, qy: 18, x2: 13, y2: 21, sw: 1.1, da: '100 0', o: 0.55 },
  // Seal marks crossing the gap
  L7: { ...S(10.5, 9, 13.5, 9), sw: 0.7, da: '2 1.5', o: 0.4 },
  L8: { ...S(10, 15, 14, 15), sw: 0.7, da: '2 1.5', o: 0.35 },
  C1: { cx: 12, cy: 12, r: 0.5, o: 0.15 },    // center void (dim when sealed)
  C2: { cx: 10, cy: 3, r: 0.4, o: 0.4 },      // top-left rift tip
  C3: { cx: 14, cy: 3, r: 0.4, o: 0.4 },      // top-right rift tip
  C4: { cx: 11, cy: 21, r: 0.4, o: 0.35 },    // bottom-left tip
  C5: { cx: 13, cy: 21, r: 0.4, o: 0.35 },    // bottom-right tip
  C6: { cx: 12, cy: 9, r: 0.3, o: 0.3 },      // upper seal node
  C7: { cx: 12, cy: 15, r: 0.3, o: 0.3 },     // lower seal node
  P1: { cx: 12, cy: 12, r: 9, o: 0.08, sw: 0.3 },
};

// Converge — all primitives collapse to center point (materialize/dematerialize)
export const convergeState = {
  L1: HP, L2: HP, L3: HP, L4: HP, L5: HP, L6: HP, L7: HP, L8: HP,
  C1: HC, C2: HC, C3: HC, C4: HC, C5: HC, C6: HC, C7: HC,
  P1: { cx: 12, cy: 12, r: 0, o: 0, sw: 0.75 },
};

// Dissipate — elements scatter outward beyond viewBox and fade (coalesce/dissipate)
export const dissipateState = {
  L1: { ...S(-4, -4, -8, -8), sw: 1, da: '100 0', o: 0 },
  L2: { ...S(28, -4, 32, -8), sw: 1, da: '100 0', o: 0 },
  L3: { ...S(28, 28, 32, 32), sw: 1, da: '100 0', o: 0 },
  L4: { ...S(-4, 28, -8, 32), sw: 1, da: '100 0', o: 0 },
  L5: { ...S(-6, 12, -10, 12), sw: 1, da: '100 0', o: 0 },
  L6: { ...S(30, 12, 34, 12), sw: 1, da: '100 0', o: 0 },
  L7: { ...S(12, -6, 12, -10), sw: 1, da: '100 0', o: 0 },
  L8: { ...S(12, 30, 12, 34), sw: 1, da: '100 0', o: 0 },
  C1: { cx: -6, cy: -6, r: 0, o: 0 },
  C2: { cx: 30, cy: -6, r: 0, o: 0 },
  C3: { cx: 30, cy: 30, r: 0, o: 0 },
  C4: { cx: -6, cy: 30, r: 0, o: 0 },
  C5: { cx: -6, cy: 12, r: 0, o: 0 },
  C6: { cx: 30, cy: 12, r: 0, o: 0 },
  C7: { cx: 12, cy: -6, r: 0, o: 0 },
  P1: { cx: 12, cy: 12, r: 20, o: 0, sw: 0.75 },
};

// ── Registry for programmatic iteration ──

export const STATES = {
  converge: convergeState, dissipate: dissipateState,
  dots: dotsState, cross: crossState, glyph: glyphState,
  error: errorState, retry: retryState, loading: loadingState,
  eye: eyeState, heartbeat: heartbeatState, scan: scanState,
  beacon: beaconState, hex: hexState, orbit: orbitState,
  sigil: sigilState, fracture: fractureState, bloom: bloomState,
  void: voidState, seer: seerState, pulse: pulseState,
  array: arrayState, dimension: dimensionState, thorn: thornState,
  knot: knotState, gate: gateState, wave: waveState, coil: coilState,
  portal: portalState,
};

// ── Subgroups for organized display ──
export const STATE_GROUPS = [
  { name: 'transitions', keys: ['converge', 'dissipate'] },
  { name: 'utility', keys: ['error', 'eye', 'heartbeat', 'loading', 'retry', 'scan'] },
  { name: 'alien', keys: ['array', 'beacon', 'bloom', 'coil', 'cross', 'dots', 'fracture', 'gate', 'glyph', 'hex', 'knot', 'orbit', 'portal', 'pulse', 'seer', 'sigil', 'thorn', 'void', 'dimension', 'wave'] },
];

// Resolve COL key for a state key
export function colForKey(key) {
  if (key === 'dots' || key === 'cross') return COL.def;
  if (key === 'void') return COL.void_;
  return COL[key];
}

// Maps state key → display name, state object, COL entry
export const STATE_META = Object.keys(STATES).map(key => ({
  key,
  name: key,
  state: STATES[key],
  col: colForKey(key),
}));
