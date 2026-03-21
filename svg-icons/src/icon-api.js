/**
 * Unified icon catalog and hierarchical grouping.
 *
 * Programmatic API for discovering all icons, their types,
 * capabilities, and animation configs.
 */

import { STATIC_ICON_REGISTRY } from './static-anim.js';
import { STATES } from './morph-states.js';
import {
  altTextWaitingOpenState, altTextWaitingCloseState,
  fullscreenWaitingOpenState, fullscreenWaitingCloseState,
  textShortWaitingOpenState, textShortWaitingCloseState,
  createState, constructState,
} from './morph-states.js';

// ── Build ICON_CATALOG from existing registries ──

/** @type {Record<string, IconDescriptor>} */
export const ICON_CATALOG = {};

// Static icons — from STATIC_ICON_REGISTRY
const PLAYFOR_KEYS = new Set([
  'res-270', 'res-540', 'res-900', 'res-1080', 'res-1620', 'res-4k',
  'share', 'link', 'text', 'text-short', 'email', 'bluesky', 'facebook', 'google',
  'linkedin', 'reddit', 'twitter', 'github',
]);

for (const [key, entry] of Object.entries(STATIC_ICON_REGISTRY)) {
  ICON_CATALOG[key] = {
    type: 'static',
    desc: entry.desc,
    capabilities: {
      animate: true,
      morph: false,
      converge: true,
      dissipate: true,
      playFor: PLAYFOR_KEYS.has(key),
    },
    animType: entry.anim,
    animConfig: entry.config || null,
  };
}

// Morph icons — from STATES (exclude converge/dissipate and waiting states)
const MORPH_EXCLUDE = new Set(['converge', 'dissipate']);
const WAITING_RE = /^(alt-text-waiting|fullscreen-waiting|text-short-waiting)/;

for (const key of Object.keys(STATES)) {
  if (MORPH_EXCLUDE.has(key) || WAITING_RE.test(key)) continue;
  // Skip morph keys that are also in the static registry (they appear as static)
  if (ICON_CATALOG[key]) continue;
  ICON_CATALOG[key] = {
    type: 'morph',
    desc: key,
    capabilities: {
      animate: true,
      morph: true,
      converge: true,
      dissipate: true,
      playFor: false,
    },
  };
}

// Toggle icons — preconfigured multi-state morph icons
ICON_CATALOG['text-toggle'] = {
  type: 'toggle',
  desc: 'text overlay toggle',
  factory: 'createTextToggle',
  states: ['waiting-open', 'waiting-close'],
  capabilities: { animate: true, morph: true, converge: true, dissipate: true, playFor: false },
};

ICON_CATALOG['fullscreen-toggle'] = {
  type: 'toggle',
  desc: 'fullscreen toggle',
  factory: 'createFullscreenToggle',
  states: ['waiting-open', 'waiting-close'],
  capabilities: { animate: true, morph: true, converge: true, dissipate: true, playFor: false },
};

ICON_CATALOG['text-short-toggle'] = {
  type: 'toggle',
  desc: 'text-short toggle (2 lines / X)',
  factory: 'createTextShortToggle',
  states: ['waiting-open', 'waiting-close'],
  capabilities: { animate: true, morph: true, converge: true, dissipate: true, playFor: false },
};

ICON_CATALOG['card-icon'] = {
  type: 'toggle',
  desc: 'card viewing/editing indicator',
  factory: 'createCardIcon',
  states: ['viewing', 'editing'],
  capabilities: { animate: false, morph: true, converge: true, dissipate: true, playFor: false },
};

// ── State data map for rendering toggle state thumbnails ──

export const TOGGLE_STATE_MAP = {
  'text-toggle': {
    'waiting-open': altTextWaitingOpenState,
    'waiting-close': altTextWaitingCloseState,
  },
  'fullscreen-toggle': {
    'waiting-open': fullscreenWaitingOpenState,
    'waiting-close': fullscreenWaitingCloseState,
  },
  'text-short-toggle': {
    'waiting-open': textShortWaitingOpenState,
    'waiting-close': textShortWaitingCloseState,
  },
  'card-icon': {
    'viewing': createState,
    'editing': constructState,
  },
};

// ── Hierarchical display grouping ──

export const ICON_GROUPS = [
  {
    name: 'Geometric Interior',
    subsections: [
      {
        name: 'Viewer Control',
        behavior: 'mixed',
        keys: ['text-toggle', 'text-short-toggle', 'res-270', 'res-540', 'res-900', 'res-1080', 'res-1620', 'res-4k', 'fullscreen-toggle'],
      },
      {
        name: 'Viewer Menu',
        behavior: 'playFor',
        keys: ['share', 'download', 'edit', 'add'],
      },
      {
        name: 'Menu \u2014 Share',
        behavior: 'playFor',
        keys: ['link', 'text', 'text-short', 'email', 'bluesky', 'facebook', 'google', 'linkedin', 'reddit', 'twitter'],
      },
      {
        name: 'Menu \u2014 Download',
        behavior: 'playFor',
        keys: ['image', 'settings', 'bundle'],
      },
      {
        name: 'Carousel',
        behavior: 'auto',
        keys: ['dbl-arrow-left', 'arrow-left', 'arrow-right', 'dbl-arrow-right'],
      },
      {
        name: 'Edit Controls',
        behavior: 'auto',
        keys: ['save', 'randomize', 'undo', 'redo', 'render'],
      },
      {
        name: 'Status',
        behavior: 'auto',
        keys: ['error', 'retry', 'warning'],
      },
      {
        name: 'Misc',
        behavior: 'mixed',
        keys: [
          'create', 'construct', 'card-icon',
          'trash', 'restore', 'close', 'fullscreen',
          'arrow-up', 'arrow-down', 'dot', 'field-diamond', 'github',
        ],
      },
    ],
  },
  {
    name: 'Morph Primitives',
    subsections: [
      {
        name: 'Utility',
        behavior: 'auto',
        keys: ['error', 'eye', 'heartbeat', 'loading', 'retry', 'scan'],
      },
      {
        name: 'Alien',
        behavior: 'auto',
        keys: [
          'array', 'beacon', 'bloom', 'coil', 'cross', 'dots',
          'fracture', 'gate', 'glyph', 'hex', 'knot', 'orbit',
          'portal', 'pulse', 'seer', 'sigil', 'thorn', 'void',
          'dimension', 'wave',
        ],
      },
    ],
  },
];
