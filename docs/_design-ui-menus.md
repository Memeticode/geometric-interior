# UI Design: Image & Animation Configuration Menus

## Design Principles

The configuration interfaces should feel like they belong to the artwork — instruments for shaping light, not software controls. The existing visual language establishes the tone: near-black surfaces, purple accent glow, uppercase section labels with generous letter-spacing, subtle gradient slider tracks, and rounded containers that suggest glass or crystal.

**Restraint over decoration.** Every element earns its presence. Labels are terse. Tooltips carry the poetry. The controls themselves are quiet until touched.

**Vertical rhythm.** Sections breathe with consistent spacing. The eye should flow downward through the panel without snagging on visual clutter. Section borders are faint hairlines, not barriers.

**Progressive depth.** The panel starts collapsed to a compact card. Expanding it reveals controls in a natural hierarchy: identity (name, seed), then the parameter axes grouped by conceptual domain, then framing (camera). Each layer adds detail without disrupting what came before.

**Consistency across contexts.** The same slider, the same section header, the same select dropdown — wherever they appear (image editor, animation editor, gallery generation panel) they look and behave identically. Components are reused, not reinvented.

---

## Part 1: Image Editor Panel

The image editor panel occupies the left sidebar at 25rem width. It collapses to zero with an animated slide. The panel contains two main areas: the **active card** (always visible, compact summary) and the **gallery** (profile browsing). Expanding the active card reveals the full configuration controls.

### Active Card (Collapsed State)

The active card is the entry point. In its default collapsed state it shows:

```
┌─────────────────────────────────────┐
│ ┌──────┐  UNSAVED                   │
│ │      │  Violet Sanctum         ▸  │
│ │ thumb│  Swirling · Crystalline ·  │
│ │      │  Radiant                   │
│ └──────┘                       💾 ↺ │
└─────────────────────────────────────┘
```

- **Thumbnail**: 56×36px, 14:9 aspect ratio, rounded 6px corners
- **Status label**: 0.5625rem uppercase, muted color. States: Unsaved / Portrait / User / Portrait · unsaved / User · unsaved
- **Name**: 0.75rem, weight 500, primary text color
- **Seed label**: 0.6875rem, muted italic. Shows the localized seed tag words joined with ` · `. Three words always, one line. This replaces the old intent phrase.
- **Actions**: Save (floppy icon) and Reset (refresh icon) buttons, vertically stacked. Disabled when no changes.
- **Chevron**: Rotated -90° when collapsed, 0° when expanded. Click anywhere on the card to toggle.

### Active Card (Expanded State)

Expanding the card smoothly reveals the configuration controls below the card header. The controls area has a faint top border and the same accent-tinted background as the card.

The expanded content flows in this order:

```
┌─ Active ─────────────────────────────┐
│  [card header as above, chevron ▾]   │
│ ─────────────────────────────────── │
│                                      │
│  Name                                │
│  [ Violet Sanctum                 ]  │
│                                      │
│  Seed                                │
│  [Swirling   ▾] · [Crystal. ▾] ·    │
│  [Radiant    ▾]                      │
│                                      │
│  PARAMETERS                          │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  GEOMETRY                         ℹ  │
│  Density          ░░░░░▓░░░░  0.50   │
│  Fracture         ░░░▓░░░░░░  0.30   │
│  Scale            ░░░░░▓░░░░  0.50   │
│  Division         ░░░░░▓░░░░  0.50   │
│  Faceting         ░░░░░▓░░░░  0.50   │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  LIGHT                            ℹ  │
│  Luminosity       ░░░░░▓░░░░  0.50   │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  COLOR                            ℹ  │
│  Hue     🌈🌈🌈🌈🌈▓🌈🌈🌈🌈  0.78   │
│  Spectrum         ░░▓░░░░░░░  0.24   │
│  Chroma           ░░░░▓░░░░░  0.42   │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  SPACE                            ℹ  │
│  Coherence        ░░░░░▓░░░░  0.50   │
│  Flow             ░░░░░▓░░░░  0.50   │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  CAMERA                           ℹ  │
│  Zoom             ░░░░░▓░░░░  1.00   │
│  Rotation         ▓░░░░░░░░░  0°     │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  [ Export ]  [ Import ]              │
└──────────────────────────────────────┘
```

### Section Details

**Name field**: Single-line auto-growing textarea, 10px rounded border, muted placeholder. Label reads "Name" with tooltip "A name for this arrangement of light and form."

**Seed field**: Three `<select>` dropdowns in a flex row, separated by `·` characters in muted text. Each select shows the localized word from its perceptual spectrum (18 options). The selects use the compact styling from `generate.css`: 0.6875rem font, 6px border-radius, no custom arrow decoration beyond the native SVG chevron.

Label reads "Seed" with tooltip "A three-word compositional seed. Each word controls an independent random stream and visual bias."

**Parameter sections**: Uppercase 0.625rem headers with letter-spacing 0.4px. Each separated by a 1px `var(--border)` hairline. The info icon (ℹ) opens a tooltip with the section description from `parameters-content.md`.

**Slider rows**: Each row contains a label (0.75rem, left-aligned), a value readout (0.6875rem, tabular-nums, right-aligned, muted), and below them the engine slider. The slider has a 6px gradient track and a 13px round thumb with the characteristic purple glow shadow.

**Gradient tracks**: Each slider has a unique gradient background hinting at its visual effect:
- Density: sparse blue → dense blue
- Luminosity: dark → warm white
- Fracture: faint blue → pink
- Coherence: warm orange → cool blue
- Hue: full rainbow (already exists)
- Zoom: warm gold → cool blue
- Rotation: blue → purple → blue (cyclical)

**Camera section**: Zoom uses range 0.3–3.0 with step 0.01, displayed as "1.00". Rotation uses range 0–360 with step 1, displayed as "0°" (with degree symbol). Both use gradient tracks. Camera adjustments do NOT trigger scene rebuilds — only camera repositioning. This should feel notably faster than parameter changes.

**Export/Import**: Two compact buttons at the bottom, flex row, 6px radius, faint border. These export/import the full ImageConfig (seed + controls + camera) as JSON.

### Gallery Section

Below the active card, the gallery section remains as-is: a collapsible header ("Image Gallery") with Portraits and Saved (local) subsections, each showing profile cards with thumbnails. Clicking a profile loads it into the active card (with morph transition if enabled).

---

## Part 2: Animation Editor

The animation editor is a fundamentally different interface. Where the image editor is a single panel of sliders, the animation editor is a **composition workspace** for arranging scenes in time.

### Page Layout

```
┌──────────────────────────────────────────────────────────┐
│ Header   Gallery · Image Editor · Animation Editor       │
├──────────┬───────────────────────────────────────────────┤
│          │                                               │
│  Scene   │     Preview Canvas                            │
│  List    │     (renders the selected event's config)     │
│          │                                               │
│  ┌────┐  │                                               │
│  │ E1 │  ├───────────────────────────────────────────────┤
│  └────┘  │                                               │
│  ┌────┐  │     Timeline                                  │
│  │ E2 │  │     ┌─────┬──────┬──────────┬─────┐          │
│  └────┘  │     │ exp │pause │transition│ col │  Events   │
│  ┌────┐  │     ├─────┴──┬───┴──┬───────┴─────┤          │
│  │ E3 │  │     │  zoom  │      │    orbit     │  Camera  │
│  └────┘  │     ├────────┴──────┴──────────────┤          │
│  ┌────┐  │     │  twinkle 0→0.8               │  Params  │
│  │ E4 │  │     └──────────────────────────────┘          │
│  └────┘  │                                               │
│          │                                               │
│  [+Add]  │  ┌────────────────────────────────────────┐   │
│          │  │ Templates ▾  │  ▶ Preview │  ● Render  │   │
│ Settings │  └────────────────────────────────────────┘   │
│ FPS: 30  │                                               │
│ 15.0s    │                                               │
│ 450 fr   │                                               │
│          │                                               │
├──────────┴───────────────────────────────────────────────┤
│ Footer                                                   │
└──────────────────────────────────────────────────────────┘
```

The animation editor uses the same `app-body` grid as the image editor: left panel + main stage. The panel contains the scene list. The stage is split vertically: preview canvas on top, timeline below, action bar at the bottom.

### Scene List (Left Panel)

The scene list replaces the image editor's controls panel. Same 25rem width, same collapse behavior. Contains:

1. **Scene cards** — vertical stack of content events
2. **Add Event button** — below the stack
3. **Settings** — FPS, computed duration, computed frame count

#### Scene Card

Each card represents one ContentEvent. The card design varies by type:

**Expand / Transition card** (references a profile):

```
┌─ EXPAND ──────────────────────────┐
│ ┌──────┐  Violet Sanctum          │
│ │      │  Swirling · Crystal. ·   │
│ │ thumb│  Radiant                  │
│ │      │                           │
│ └──────┘  3.0s    ease-out    ▾   │
│                           ▲ ▼  ✕  │
└───────────────────────────────────┘
```

**Pause / Collapse card** (uses current scene):

```
┌─ PAUSE ───────────────────────────┐
│  (holds current scene)            │
│  5.0s    linear               ▾   │
│                           ▲ ▼  ✕  │
└───────────────────────────────────┘
```

**Card anatomy**:

- **Type badge**: Top-left, uppercase 0.5625rem, letter-spacing 0.5px. Color-coded:
  - Expand: `var(--accent-text)` (purple) — emergence
  - Pause: `var(--text-muted)` — stillness
  - Transition: a warm accent (amber/gold) — transformation
  - Collapse: `var(--text-muted)` — dissolution

- **Thumbnail**: 48×31px (14:9 ratio), 4px radius. Only for expand and transition. Shows the referenced profile's cached thumbnail.

- **Profile name**: 0.75rem, weight 500. For pause/collapse, shows "(holds current scene)" in muted italic.

- **Seed label**: 0.625rem, muted. Localized seed tag words. Only for expand/transition.

- **Duration**: Inline number, editable on click. Displayed as "3.0s". Range 0.5–30.0, step 0.5.

- **Easing**: Small dropdown, inline. Options: linear, ease-in, ease-out, ease-in-out.

- **Reorder buttons**: Small ▲/▼ arrows. Swap with adjacent event.

- **Delete button**: ✕, small. Confirms before deleting.

- **Card styling**: 1px `var(--border)` border, 10px radius, `var(--surface)` background. Selected card gets `var(--accent)` border and `var(--accent-bg)` background (same treatment as the active card in the image editor). Hover shows `var(--surface-hover)`.

#### Selected Card Expansion

When a card is selected (clicked), it gains the accent border and optionally shows additional details inline:

- For **expand/transition**: a "Change Profile" button that opens the profile picker
- For **transition**: shows the from→to as two small thumbnails side by side

This expansion is subtle — a single row of additional controls, not a full sub-panel.

#### Add Event

The `+ Add Event` button is below the last card. It uses the compact button style (0.75rem, `var(--border)`, `var(--surface)`). Clicking opens an inline picker:

```
┌─ Add Event ───────────────────────┐
│  ◉ Expand      ○ Pause            │
│  ○ Transition  ○ Collapse         │
│                                    │
│  [Cancel]  [Next →]               │
└───────────────────────────────────┘
```

For expand/transition, "Next" opens the profile picker. For pause/collapse, "Next" adds the event directly with default duration/easing.

**Constraint enforcement**: The picker only shows valid options for the current position. If the previous event was `collapse` or the list is empty, only `expand` is offered. If there's no prior expand/transition, `pause` and `collapse` are disabled.

#### Profile Picker

A modal that shows available profiles in a grid:

```
┌─ Select Profile ──────────── ✕ ─┐
│                                  │
│  Portraits                       │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌───┐ │
│  │     │ │     │ │     │ │   │  │
│  │     │ │     │ │     │ │   │  │
│  └─────┘ └─────┘ └─────┘ └───┘ │
│  Violet   Sapph.  Rose    ...   │
│                                  │
│  Saved                           │
│  ┌─────┐ ┌─────┐                │
│  │     │ │     │                 │
│  │     │ │     │                 │
│  └─────┘ └─────┘                │
│  Custom1  Custom2                │
│                                  │
└──────────────────────────────────┘
```

Each cell is a 100×64px thumbnail (14:9) with the profile name below in 0.6875rem. Hover shows accent border. Click selects and closes the modal.

Uses the same modal styling as the existing import/view-all modals: `var(--modal-backdrop)` overlay, centered `var(--modal-bg)` box with rounded corners.

#### Settings

Below the scene list, a compact settings area:

```
  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
  FPS        [ 30    ▾]
  Duration    15.0s
  Frames      450
```

- **FPS**: Select dropdown. Options: 12, 24, 30, 60. Default 30.
- **Duration**: Computed, read-only. Sum of all event durations. Displayed in 0.6875rem muted.
- **Frames**: Computed, read-only. `duration × fps`. Displayed the same.

These use the same `.anim-config-info` styling as the existing animation settings: label on the left (muted, 0.675rem), value on the right, low opacity.

### Preview Canvas

The preview canvas occupies the upper portion of the main stage. It renders at the canvas resolution but displays responsively within the available space. Below the canvas, a header shows the selected event's profile info:

```
  Violet Sanctum — Swirling · Crystalline · Radiant
```

When no event is selected, it shows the first event's config. The preview updates live when the user selects different event cards.

The canvas uses the same rendering pipeline as the image editor — worker renders the config, canvas displays the result. Camera state from the config is applied.

### Timeline Area

The timeline sits below the preview canvas. It is a horizontal visualization of the animation's time structure.

#### Event Track

The top row shows content events as proportionally-sized blocks:

```
  0s        3s        8s        12s       15s
  ├─────────┼─────────┼─────────┼─────────┤
  │ expand  │  pause  │ transition  │ col │
  │ 3.0s    │  5.0s   │    4.0s     │ 3.0s│
```

Each block:
- Background: faint fill matching the event type color
- Text: event type label in 0.5625rem uppercase, duration below
- Height: ~28px
- Borders between blocks: 1px `var(--border)`
- Block widths proportional to duration
- Read-only — editing happens in the scene list

This track establishes the time axis that all overlay tracks align to.

#### Overlay Tracks

Below the event track, each overlay type has its own horizontal lane:

```
  Camera  │▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐│  zoom 1.0→0.7
          │         ▐▐▐▐▐▐▐▐▐│         orbit 0°→90°

  Params  │▐▐▐▐▐▐▐▐▐▐▐▐▐▐│              twinkle 0→0.8
          │              ▐▐▐▐▐▐▐▐▐▐▐▐│  dynamism 0.3→0.7

  Focus   │         ▐▐▐▐▐▐▐▐▐▐▐│        near→far
```

Each lane is ~20px tall. Track labels on the left margin (0.625rem uppercase muted).

**Spans**: Each overlay span is a horizontal bar:
- Background: `var(--accent-bg)` with 1px `var(--accent)` border (top and bottom only, not sides — creates a ribbon feel)
- On hover: brightens to `var(--accent)` fill
- Selected: solid `var(--accent)` fill with glow shadow
- Rounded ends: 4px radius
- Label: small text inside or to the right showing the from→to values

**Interactions**:
- Click a span to select it → shows properties in a popover below the timeline
- Drag the left/right edges to resize (change start/end time)
- Double-click empty space in a track lane to create a new span
- Delete key removes the selected span

**Span properties popover**: Appears below the timeline when a span is selected:

```
┌─ Camera Move ─────────────────────┐
│  Start   [ 0.0  ]s  End  [ 8.0 ]s│
│  Zoom    [1.0] → [0.7]           │
│  Orbit Y [0  ] → [90 ]°          │
│  Easing  [ease-in-out ▾]         │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│           [Delete]  [Done]        │
└───────────────────────────────────┘
```

Number inputs are compact inline fields (4rem wide, same styling as the duration input on scene cards). The popover uses `var(--surface)` background, `var(--border)` border, 10px radius.

#### Track Lane Headers

To the left of each track lane, a header column:

```
  ┌──────┐
  │Camera │  [+]
  ├──────┤
  │Params│  [+]
  ├──────┤
  │Focus │  [+]
  └──────┘
```

The `[+]` button adds a new span to that track, defaulting to the full animation duration. The header column is ~60px wide, text in 0.5625rem uppercase.

#### Time Ruler

Above the event track, a thin time ruler:

```
  0         3         8         12        15s
  ┊─────────┊─────────┊─────────┊─────────┊
```

Tick marks at event boundaries and at regular intervals (every second or every 5 seconds depending on zoom). Labels in 0.5rem muted. The ruler provides context for the overlay span positioning.

A thin vertical **playhead** line (1px, `var(--accent-text)`) can be scrubbed horizontally to seek through the animation. Its position updates during preview playback.

### Action Bar

Below the timeline, a compact action bar:

```
┌──────────────────────────────────────────┐
│  [Templates ▾]  │  [▶ Preview]  [● Render]  │
└──────────────────────────────────────────┘
```

- **Templates dropdown**: Select from preset animation structures. Selecting one prompts for profile assignment, then fills the scene list and tracks. Uses `<select>` styling.
- **Preview button**: Renders at SD resolution into the preview canvas. Play/pause toggle. During playback, the playhead moves across the timeline.
- **Render button**: Primary button style (accent border + bg). Dispatches to the render queue at the selected resolution. Shows a confirmation with estimated render time first.

### Empty State

When the animation editor opens with no events:

```
┌──────────────────────────────────────────┐
│                                          │
│           Start with a template          │
│                                          │
│    ┌──────────┐  ┌──────────┐            │
│    │  Gentle  │  │  Morph   │            │
│    │  Reveal  │  │  Journey │            │
│    └──────────┘  └──────────┘            │
│    ┌──────────┐  ┌──────────┐            │
│    │ Orbital  │  │  Quick   │            │
│    │ Showcase │  │  Morph   │            │
│    └──────────┘  └──────────┘            │
│                                          │
│        or add your first event           │
│            [ + Expand ]                  │
│                                          │
└──────────────────────────────────────────┘
```

Template cards are larger here (120×80px), with a name and a brief description (e.g., "Fade in, hold, fade out"). Selecting one starts the template application flow.

---

## Part 3: Component Specifications

### Seed Tag Select

Reused in: image editor panel, gallery generation panel, animation event cards (read-only display).

```css
/* Container */
.seed-tag-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
}

/* Each select */
.seed-tag-select {
    flex: 1;
    min-width: 0;
    padding: 0.4375rem 1.75rem 0.4375rem 0.625rem;
    border-radius: 10px;                /* matches other selects */
    border: 1px solid var(--border-strong);
    background: var(--surface);
    color: var(--text);
    font-size: 0.75rem;
    cursor: pointer;
    appearance: none;
    background-image: url("...chevron...");
    background-repeat: no-repeat;
    background-position: right 0.625rem center;
}

/* Separators */
.seed-tag-sep {
    color: var(--text-muted);
    font-size: 0.75rem;
    user-select: none;
}
```

### Scene Card

New component for the animation editor.

```css
.scene-card {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    padding: 0.5rem;
    transition: border-color 0.2s, background-color 0.2s;
    cursor: pointer;
}

.scene-card:hover {
    background: var(--surface-hover);
    border-color: var(--border-strong);
}

.scene-card.selected {
    border-color: var(--accent);
    background: var(--accent-bg);
}

.scene-card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.scene-type-badge {
    font-size: 0.5625rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    background: var(--surface-active);
}

.scene-type-badge[data-type="expand"] {
    color: var(--accent-text);
    background: var(--accent-bg);
}

.scene-type-badge[data-type="transition"] {
    color: rgb(255, 190, 100);
    background: rgba(255, 190, 100, 0.12);
}
```

### Timeline Span

New component for overlay tracks.

```css
.timeline-span {
    position: absolute;
    height: 16px;
    border-radius: 4px;
    background: var(--accent-bg);
    border-top: 1px solid var(--accent);
    border-bottom: 1px solid var(--accent);
    cursor: pointer;
    transition: background-color 0.15s;
    font-size: 0.5rem;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    padding: 0 0.375rem;
    overflow: hidden;
    white-space: nowrap;
}

.timeline-span:hover {
    background: var(--accent);
    color: var(--text);
}

.timeline-span.selected {
    background: var(--accent);
    box-shadow: 0 0 8px var(--accent);
    color: var(--text);
    z-index: 2;
}

/* Resize handles at edges */
.timeline-span::before,
.timeline-span::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 6px;
    cursor: ew-resize;
}
.timeline-span::before { left: 0; }
.timeline-span::after { right: 0; }
```

### Duration Input

Inline editable number for event durations.

```css
.duration-input {
    width: 3.5rem;
    padding: 0.1875rem 0.25rem;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: var(--text);
    font-size: 0.6875rem;
    font-variant-numeric: tabular-nums;
    text-align: right;
    transition: border-color 0.15s, background-color 0.15s;
}

.duration-input:hover {
    border-color: var(--border);
    background: var(--surface);
}

.duration-input:focus {
    border-color: var(--accent);
    background: var(--surface);
    outline: none;
}
```

### Easing Dropdown

Compact inline select for easing type.

```css
.easing-select {
    padding: 0.1875rem 1.25rem 0.1875rem 0.375rem;
    border-radius: 4px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.625rem;
    cursor: pointer;
    appearance: none;
    background-image: url("...chevron...");
    background-repeat: no-repeat;
    background-position: right 0.25rem center;
    transition: border-color 0.15s, background-color 0.15s;
}

.easing-select:hover {
    border-color: var(--border);
    background: var(--surface);
}
```

---

## Part 4: Interaction Patterns

### Image Editor

**Slider adjustment flow**:
1. User drags a control slider (density, fracture, etc.)
2. Scene rebuilds on the worker (throttled 150ms)
3. Canvas updates with the new render
4. If a camera slider is moved instead, only camera repositions (no rebuild) — feels instant

**Seed change flow**:
1. User changes a seed tag dropdown
2. Scene rebuilds with the new seed (same controls)
3. The seed label updates below the name
4. This is equivalent to a morph transition if transitions are enabled

**Randomize flow**:
1. Click the randomize button (in stage header)
2. All 3 seed slots + 11 controls + camera randomized
3. Morph transition from old → new (if enabled)
4. Name auto-generated from the new config

**Profile load flow**:
1. Click a profile card in the gallery
2. If unsaved changes, prompt: "Save changes to [name]?"
3. Active card updates with new profile data (seed tags, controls, camera)
4. Canvas renders the new config (with morph transition if enabled)

### Animation Editor

**Building an animation**:
1. Click `+ Add Event` → choose type → (for expand/transition) pick profile → card added
2. Repeat to build the scene sequence
3. Adjust durations and easings inline on each card
4. Click event cards to see their config in the preview canvas
5. Add camera/param/focus spans in the timeline tracks
6. Click Preview to see a low-res real-time playback
7. Click Render to dispatch to the render queue

**Template flow**:
1. Select a template from the dropdown
2. Template shows profile slots: "This template uses 2 profiles"
3. Profile picker opens for slot 1 → select
4. Profile picker opens for slot 2 → select
5. Scene list and tracks populate with the template's events and overlay spans
6. User can modify anything from here

**Timeline span editing**:
1. Click empty space in a track lane or click `+` → new span appears covering the full duration
2. Drag edges to set start/end time
3. Click the span → properties popover appears below
4. Edit from/to values, easing
5. Click "Done" or click away to dismiss
6. The span updates visually

**Preview playback**:
1. Click ▶ Preview → renders frames at SD into the preview canvas
2. Playhead moves across the timeline in sync
3. Click again (now showing ⏸) to pause
4. Drag playhead to scrub to any time
5. Preview is approximate — final render at full resolution may differ slightly

---

## Part 5: Color Palette for Event Types

Event types should be visually distinct but harmonious with the purple accent palette:

| Type | Color | Meaning |
|------|-------|---------|
| Expand | `var(--accent-text)` — purple | Emergence, creation |
| Pause | `var(--text-muted)` — gray | Stillness, breath |
| Transition | `rgb(255, 190, 100)` — amber | Transformation, journey |
| Collapse | `rgba(130, 200, 255, 0.7)` — ice blue | Dissolution, release |

These colors appear in:
- Scene card type badges
- Event track blocks (as faint fills)
- The scene list add-event picker

The amber for transitions is warm against the cool purple/blue palette — it draws attention to the most creatively significant event type.

---

## Part 6: Responsive Considerations

### Tablet (768–1024px)

**Image editor**: Panel becomes a sliding drawer (overlay, not push). Same content, same width (25rem). Backdrop overlay when open. This already works in the existing design.

**Animation editor**: The scene list panel becomes a sliding drawer. The timeline area stacks below the preview canvas (horizontal scroll if needed). The action bar sticks to the bottom.

### Mobile (< 768px)

**Image editor**: Panel is a full-width drawer. Controls get slightly more padding for touch targets. Slider thumbs enlarge to 16px.

**Animation editor**: Mobile is the most constrained. Two possible approaches:
- **Stacked**: Scene list fills the screen. Tapping a card opens the preview. Timeline becomes a separate view (tab/swipe).
- **Simplified**: Only template-based flow. No timeline track editing on mobile. Users pick a template, assign profiles, set duration, render. Advanced editing requires desktop.

The second approach is pragmatic — timeline editing with drag-to-resize spans is inherently a desktop interaction. Mobile users get the template UX, which covers 80% of use cases.

---

## Part 7: Accessibility

- All interactive elements have visible focus indicators (2px `var(--accent)` outline)
- Slider values are announced by screen readers via `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`
- Seed tag selects use proper `<label>` associations
- Scene cards are keyboard navigable (arrow keys to move between cards, Enter to select, Delete to remove)
- Timeline spans are keyboard accessible: Tab to focus, arrow keys to move position, Shift+arrow to resize, Enter to open properties, Delete to remove
- Event track blocks have `aria-label` describing type and duration
- Color coding is always accompanied by text labels (no color-only communication)
- Modals trap focus and close on Escape
