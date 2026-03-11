# UI Design: Image & Animation Configuration Menus

> Updated March 2026 to reflect current implementation state and revised design thinking.

## Design Principles

The configuration interfaces should feel like they belong to the artwork — instruments for shaping light, not software controls. The existing visual language establishes the tone: near-black surfaces, purple accent glow, uppercase section labels with generous letter-spacing, subtle gradient slider tracks, and rounded containers that suggest glass or crystal.

**Restraint over decoration.** Every element earns its presence. Labels are terse. Tooltips carry the poetry. The controls themselves are quiet until touched.

**Vertical rhythm.** Sections breathe with consistent spacing. The eye should flow downward through the panel without snagging on visual clutter. Section borders are faint hairlines, not barriers.

**Direct manipulation.** The user sees the image they are editing on the canvas. The sidebar controls are just that — controls. No intermediary abstractions like collapsed cards or thumbnail summaries. Change a slider, see the result immediately.

**Consistency across contexts.** The same slider, the same section header, the same select dropdown — wherever they appear (image editor, animation editor, gallery generation panel) they look and behave identically. Components are reused, not reinvented.

---

## Part 1: Image Editor Panel

### Current State

The image editor panel (`image.html`) occupies the left sidebar at 25rem width. It collapses to zero with an animated slide. Seed tag dropdowns and camera sliders (zoom, rotation, elevation) are implemented in the HTML and wired through `editor-main.js`.

**Key files**: `image.html`, `src/editor/editor-main.js`, `src/editor/config-controls.js`, `css/controls.css`, `css/active-card.css`, `css/panel.css`

### Design Direction: Composable Control Groups

The panel is a direct controls surface — open it, and everything is right there. No collapsed cards, no intermediate states to expand past.

The controls are organized into four composable groups, each a visually distinct container. "General purpose" groups (Import/Export, Config Utility) are reusable across contexts (image editor, animation editor, gallery generation panel). The scene-specific groups (Geometric Interior Configuration, Camera Position) carry the parameters that define a render.

This composability means contexts can mix and match: the gallery generation panel might use Config Utility + Geometric Interior Configuration without Import/Export or Camera. The animation editor might show Camera Position on its own in a span properties popover.

### Panel Layout

```


Import/Export Config (general purpose)
┌─────────────────────────────────┐
│ [Import Config] [Export Config] │
└─────────────────────────────────┘

Config Utility (general purpose)
┌─────────────────────────────────┐
│  [💾 Save]  [↺ Reset] [↺ Randomize] │
└─────────────────────────────────┘

Geometric Interior (Previously called image configuration) Configuration 
┌─────────────────────────────────┐
│  (i) Name                           │
│  [ Violet Sanctum            ]  │
│                                 │
│  (i) Seed                           │
│  [Swirling ▾] · [Crystal. ▾]   │
│  · [Radiant ▾]                  │
│                                 │
│                                 │
│  (i) GEOMETRY                      │
│   (i) Density        ░░░░░▓░░░░     │
│   (i) Fracture       ░░░▓░░░░░░     │
│   (i) Scale          ░░░░░▓░░░░     │
│   (i) Division       ░░░░░▓░░░░     │
│   (i) Faceting       ░░░░░▓░░░░     │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  (i) LIGHT                         │
│   (i) Luminosity     ░░░░░▓░░░░     │
│   (i) Bloom          ░░░░░▓░░░░     │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  (i) COLOR                         │
│   (i) Hue    🌈🌈🌈🌈🌈▓🌈🌈🌈🌈   │
│   (i) Spectrum       ░░▓░░░░░░░     │
│   (i) Chroma         ░░░░▓░░░░░     │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  (i) SPACE                         │
│   (i) Coherence      ░░░░░▓░░░░     │
│   (i) Flow           ░░░░░▓░░░░     │
└─────────────────────────────────┘

Camera Position (included with image config)
┌─────────────────────────────────┐
│  (i) CAMERA                        │
│   (i) Rotation       ▓░░░░░░░░░     │
│   (i) Elevation       ▓░░░░░░░░░     │
│   (i) Zoom           ░░░░░▓░░░░     │
└─────────────────────────────────┘


```

The controls are always visible when the panel is open. No collapsed/expanded card toggle. The stage header (above the canvas) continues to show the read-only identity: profile name, seed label, history arrows, randomize, settings, and share buttons.

### Component Groups

The panel is composed of four distinct groups, rendered top to bottom:

#### 1. Import/Export Config (general purpose)

Two compact buttons in a flex row, 6px radius, faint border. Import loads a JSON config file; Export saves the current full config (seed + controls + camera) as JSON. This component is reusable anywhere a config needs to be serialized.

#### 2. Config Utility (general purpose)

Action buttons for managing the current config state:

- **Save**: Persists the current config. Disabled until changes are made (`dirty` flag).
- **Reset**: Reverts to last saved state. Disabled until the user has edited (`userEdited` flag).
- **Randomize**: Randomizes all 3 seed slots + 11 controls + camera. Triggers a morph transition if enabled.

This group replaces the save/reset icons that were in the old active card header, and centralizes randomize (previously only accessible from the stage header).

#### 3. Geometric Interior Configuration

The core scene parameters. Previously called "image configuration" — renamed because these parameters define the geometric interior itself, independent of how it's used (still image, animation keyframe, gallery generation).

**Name field**: Single-line auto-growing textarea, 10px rounded border, muted placeholder. A name for this arrangement of light and form.

**Seed field**: Three `<select>` dropdowns in a flex row, separated by `·` characters in muted text. Each select shows the localized word from its perceptual spectrum (18 options). Already implemented in the HTML with `#seedTagArr`, `#seedTagStr`, `#seedTagDet`.

**Parameter sections** (Geometry, Light, Color, Space): Uppercase 0.625rem headers with letter-spacing 0.4px. Each separated by a 1px `var(--border)` hairline. See the Tooltip Reference and Gradient Tracks tables below for per-parameter details.

**Info tooltips**: Every section header and parameter label has an `(i)` info icon that shows a tooltip on hover. The tooltips are poetic and thematic, rewarding curiosity. See the tooltip reference table below.

**Slider rows**: Each row contains a label (0.75rem, left-aligned), a value readout (0.6875rem, tabular-nums, right-aligned, muted), and below them the engine slider. The slider has a 6px gradient track and a 13px round thumb with the characteristic purple glow shadow.

#### 4. Camera Position (included with image config)

Camera framing controls that adjust the viewpoint without triggering a scene rebuild — feels instant. Visually separated from the Geometric Interior Configuration but part of the same config object. In contexts where camera is edited independently (e.g., animation camera spans), this group can appear on its own.

- **Rotation**: Range 0–360, step 1, displayed as "0°". Gradient track: blue → purple → blue (cyclical).
- **Elevation**: Range -90–90, step 1, displayed as "0°".
- **Zoom**: Range 0.3–3.0, step 0.01, displayed as "1.00". Gradient track: warm gold → cool blue.

### Tooltip Reference

All tooltip text is localized via `data-i18n-tooltip` keys. English defaults:

| Element | Tooltip |
|---------|---------|
| **Name** | A name for this arrangement of light and form. |
| **Seed** | A three-word compositional seed. Each word controls an independent random stream and visual bias. |
| **Geometry** (section) | The physical character of forms &mdash; their abundance, fragmentation, granularity, topology, and crystal quality. |
| Density | How thickly forms crowd the void. |
| Fracture | How forms break and splinter through space. |
| Scale | The relative magnitude of forms &mdash; monumental to atmospheric. |
| Division | How the envelope subdivides into lobes and grooves. |
| Faceting | The angularity of folded surfaces &mdash; flat panels to sharp shards. |
| **Light** (section) | The energy and radiance of the scene. |
| Luminosity | The inner radiance of the scene. |
| Bloom | How far light reaches beyond its sources &mdash; tight crystal points to soft atmospheric halos. |
| **Color** (section) | The chromatic identity of the emitted light &mdash; hue, spectral range, and intensity. |
| Hue | Where on the spectrum the light begins. |
| Spectrum | How far color is allowed to wander from its origin. |
| Chroma | The purity of pigment &mdash; dusty whisper to liquid jewel. |
| **Space** (section) | The directional organization of forms &mdash; flow patterns and structural coherence. |
| Coherence | The discipline binding form to structure. |
| Flow | The directional field pattern &mdash; radial starburst to noise to orbital bands. |
| **Camera** (section) | Static framing of the scene &mdash; zoom level and orbital rotation angle. |
| Rotation | Orbital rotation angle around the scene center, in degrees. 360&deg; wraps back to 0&deg;. |
| Elevation | Vertical viewing angle &mdash; look up from below or down from above. |
| Zoom | How close or far the viewpoint is. Below 1.0 moves closer to the forms, above 1.0 moves further away. |

**Gradient tracks**: Each slider has a unique gradient background hinting at its visual effect:
- Density: sparse blue → dense blue
- Fracture: faint blue → pink
- Luminosity: dark → warm white
- Bloom: crystal blue → soft warm haze
- Coherence: warm orange → cool blue
- Hue: full rainbow
- Zoom: warm gold → cool blue
- Rotation: blue → purple → blue (cyclical)

---

## Part 2: Gallery Generate Panel

### Current State

The gallery generate panel (`/gallery/images/generate`) provides a dedicated configuration and rendering interface for creating new images. It uses the composable control group pattern from the image editor panel.

**Key files**: `index.html` (generate panel HTML), `src/gallery/generate-panel.js`, `src/gallery/gallery-main.js`, `src/gallery/gallery-worker-bridge.js`, `css/generate.css`

### Layout

The panel has two layers: a full-width header bar and a 3-column body.

```
Name + Seed Header (full-width)
┌──────────────────────────────────────────────────────────┐
│ NAME                     SEED                            │
│ [Auto-generated title ]  [Swirling▾] · [Crystal▾] ·     │
│                          [Radiant▾]                      │
└──────────────────────────────────────────────────────────┘

┌──── Config (280px) ──┬──── Preview (flex:1) ──┬── Queue (280px) ──┐
│                      │                        │                   │
│  Config Utility      │   ┌──────────────┐     │   job items...    │
│  [Save][Reset][Rand] │   │  canvas      │     │                   │
│                      │   │  420 × 270   │     │                   │
│  PARAMETERS          │   └──────────────┘     │                   │
│  GEOMETRY            │                        │                   │
│   Density   ░░░▓░░   │                        │                   │
│   Fracture  ░░▓░░░   │                        │                   │
│   Scale     ░░░▓░░   │                        │                   │
│   Division  ░░░▓░░   │                        │                   │
│   Faceting  ░░░▓░░   │                        │                   │
│  LIGHT               │                        │                   │
│   Luminosity ░░▓░░   │                        │                   │
│   Bloom      ░░▓░░   │                        │                   │
│  COLOR               │                        │                   │
│   Hue       🌈▓🌈    │                        │                   │
│   Spectrum  ░░▓░░    │                        │                   │
│   Chroma    ░░▓░░    │                        │                   │
│  SPACE               │                        │                   │
│   Coherence ░░▓░░    │                        │                   │
│   Flow      ░░▓░░    │                        │                   │
│  CAMERA              │                        │                   │
│   Rotation  ▓░░░░    │                        │                   │
│   Elevation ░░▓░░    │                        │                   │
│   Zoom      ░░░▓░    │                        │                   │
│                      │                        │                   │
│  [     Render     ]  │                        │                   │
└──────────────────────┴────────────────────────┴───────────────────┘
```

### Components

**Name + Seed Header**: Full-width bar above the 3-column body, mirroring the gallery browse mode's `gallery-selection-header-container` pattern. Name is an editable textarea that auto-populates via `generateTitle()` when seed/controls change. User edits override auto-generation. Seed is the standard 3-dropdown row.

**Config Utility**: Reuses the `.control-group-utility` pattern from the image editor. Save persists as a user profile, Reset randomizes, Randomize randomizes seed + all sliders + resets camera to defaults.

**Parameter Sliders**: Same 4 grouped sections (Geometry, Light, Color, Space) with 11 total sliders, built dynamically by `generate-panel.js`.

**Camera Sliders**: Rotation (0–360°), Elevation (-90–90°), Zoom (0.30–3.00). Camera state is sent to the worker via `sendCameraState()`.

**Render Button**: Dispatches the current configuration (seed + controls + camera + name) to the render queue. The name from the Name field is passed through to the render job.

**Preview Canvas**: 420×270 live preview, updated on every control change via debounced `sendRender` + `sendCameraState`.

**Render Queue**: Right column showing queued/active/completed render jobs.

---

## Part 3: Animation Editor

### Current State

The animation editor (`animation.html`) is implemented as a composition workspace. The page layout, event list, profile picker, timeline tracks, templates, and preview player all exist as working code.

**Key files**:
- `animation.html` — page structure
- `src/animation/anim-main.js` — entry point + orchestrator
- `src/animation/event-list.js` — event card UI component
- `src/animation/profile-picker.js` — profile selection modal
- `src/animation/timeline-tracks.js` — timeline visualization + overlay track editor
- `src/animation/templates.js` — template definitions + application logic
- `src/animation/preview.js` — playback preview controller
- `css/animation-editor.css` — event list + scene card styling
- `css/timeline.css` — timeline track visualization
- `css/animation-page.css` — page-level CSS aggregator

### Page Layout (Implemented)

```
┌──────────────────────────────────────────────────────────┐
│ Header   Gallery · Image Editor · Animation Editor       │
├──────────┬───────────────────────────────────────────────┤
│          │  Preview Header                               │
│  Scenes  │  Violet Sanctum — Swirling · Crystal. · Rad.  │
│          │                                               │
│  ┌────┐  │  ┌─────────────────────────────────┐          │
│  │ E1 │  │  │                                 │          │
│  └────┘  │  │       Preview Canvas            │          │
│  ┌────┐  │  │                                 │          │
│  │ E2 │  │  └─────────────────────────────────┘          │
│  └────┘  │                                               │
│  ┌────┐  │  Timeline Area                                │
│  │ E3 │  │  ┌─────┬──────┬──────────┬─────┐             │
│  └────┘  │  │ exp │pause │transition│ col │  Events      │
│  ┌────┐  │  ├─────┴──┬───┴──┬───────┴─────┤             │
│  │ E4 │  │  │  zoom  │      │    orbit     │  Camera     │
│  └────┘  │  ├────────┴──────┴──────────────┤             │
│          │  │  twinkle 0→0.8               │  Params     │
│  [+Add]  │  └──────────────────────────────┘             │
│          │                                               │
│ Settings │  ┌──────────────────────────────────────────┐ │
│ FPS: 30  │  │ 15.0s · 450 frames  ▶ Preview  ● Render │ │
│ HD       │  └──────────────────────────────────────────┘ │
│ 15.0s    │                                               │
│ 450 fr   │                                               │
├──────────┴───────────────────────────────────────────────┤
│ Footer                                                   │
└──────────────────────────────────────────────────────────┘
```

Uses the same `app-body` grid as the image editor: left panel + main stage. The panel contains the scene list. The stage is split vertically: preview canvas on top, timeline below, action bar at the bottom.

### Scene List (Left Panel) — Implemented

The scene list replaces the image editor's controls panel. Same 25rem width, same collapse behavior. Contains:

1. **Scene cards** — vertical stack of content events
2. **Add Event button** — below the stack
3. **Settings** — FPS, resolution, computed duration, computed frame count

#### Scene Card

Each card represents one ContentEvent. Cards vary by type:

**Expand / Transition card** (references a profile, shows thumbnail + name + seed label):

```
┌─ EXPAND ──────────────────────────┐
│ ┌──────┐  Violet Sanctum          │
│ │      │  Swirling · Crystal. ·   │
│ │ thumb│  Radiant                  │
│ └──────┘  3.0s    ease-out    ▾   │
│                           ▲ ▼  ✕  │
└───────────────────────────────────┘
```

**Pause / Collapse card** (uses current scene, compact):

```
┌─ PAUSE ───────────────────────────┐
│  (holds current scene)            │
│  5.0s    linear               ▾   │
│                           ▲ ▼  ✕  │
└───────────────────────────────────┘
```

**Card anatomy**:

- **Type badge**: Top-left, uppercase 0.5625rem, letter-spacing 0.5px. Color-coded by event type (see Part 5).
- **Thumbnail**: Only for expand/transition. Shows the referenced profile's cached thumbnail.
- **Profile name**: 0.75rem, weight 500. For pause/collapse, shows "(holds current scene)" in muted italic.
- **Seed label**: Muted. Localized seed tag words. Only for expand/transition.
- **Duration**: Inline editable number displayed as "3.0s". Range 0.5–30.0, step 0.5.
- **Easing**: Small dropdown. Options: linear, ease-in, ease-out, ease-in-out.
- **Reorder buttons**: Small ▲/▼ arrows. Swap with adjacent event.
- **Delete button**: ✕, small.
- **Selected state**: Accent border + accent background. Selecting a card renders its config in the preview canvas.

#### Add Event — Implemented

The `+ Add Event` button opens an inline picker with type selection. For expand/transition, it opens the profile picker modal. For pause/collapse, it adds the event directly with default duration/easing.

**Constraint enforcement**: The picker only shows valid options. If the list is empty or the previous event was `collapse`, only `expand` is offered. Pause and collapse are disabled when there's no prior expand/transition.

#### Profile Picker — Implemented

A modal showing available profiles in a grid with thumbnails:
- **Portraits**: Built-in starter profiles (read-only)
- **Saved (local)**: User-created profiles

Each cell shows a thumbnail with the profile name below. Click selects and closes the modal.

#### Settings — Implemented

Below the scene list:
- **FPS**: Select dropdown (12, 24, 30, 60). Default 30.
- **Resolution**: Select dropdown (SD 840×540, HD 1400×900, FHD 1680×1080, QHD 2520×1620, 4K 3360×2160). Default HD.
- **Duration**: Computed, read-only. Sum of all event durations.
- **Frames**: Computed, read-only. `duration × fps`.

### Preview Canvas — Implemented

The preview canvas renders the selected event's config as a static image. Above the canvas, a header shows the profile name and seed label:

```
  Violet Sanctum — Swirling · Crystalline · Radiant
```

When no event is selected, it shows the first event's config. The preview updates when the user selects different event cards.

### Timeline Area — Implemented

The timeline (`timeline-tracks.js`) sits below the preview canvas.

#### Event Track

Top row shows content events as proportionally-sized colored blocks. Read-only — editing happens in the scene list. The event track establishes the time axis that all overlay tracks align to.

#### Overlay Tracks

Below the event track, each overlay type has its own horizontal lane: Camera, Params, Focus. Spans are horizontal bars with from→to labels. The track supports:
- Adding spans
- Selecting spans
- Editing span properties (start/end time, from/to values, easing)
- A scrubable playhead line for time-based seeking

#### Time Ruler

Above the event track. Tick marks at event boundaries and regular intervals.

### Action Bar — Implemented

Below the timeline:
- **Duration/frame info**: Total duration and frame count
- **Preview button**: Renders frames into the preview canvas with playhead sync. Play/pause toggle.
- **Render button**: Dispatches the Animation to the worker for full-resolution rendering.

### Empty State — Implemented

When the animation editor opens with no events, the main stage shows template cards:

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

Selecting a template opens the profile picker for each required profile slot, then populates the event list and overlay tracks.

### Work Remaining (Animation Editor)

The animation editor is functional but has refinement opportunities:

1. **Visual polish**: Scene cards, timeline spans, and event track blocks may need CSS refinement against the design spec colors and spacing
2. **Span drag-resize**: Verify edge-drag behavior for timeline spans is smooth
3. **Selected card expansion**: When a card is selected, consider showing a "Change Profile" button inline for expand/transition events
4. **Transition from→to display**: Show two small thumbnails side by side when a transition card is selected
5. **Animation save/load**: Save animation definitions to localStorage, load them back
6. **Animation export/import**: Export as JSON for sharing
7. **Gallery integration**: Rendered animations appear in the gallery's Animations section
8. **Per-config camera in animations**: When no camera moves are active, inherit the camera framing from each event's profile config

---

## Part 4: Component Specifications

### Label Info — Implemented

Reused on: every section header and parameter label in the image editor panel.

The `label-info` pattern pairs a text label with a small `(i)` icon that reveals a tooltip on hover/focus. The tooltip text is poetic and thematic — it rewards curiosity without cluttering the interface.

**HTML pattern (section header)**:
```html
<div class="param-section-header">
    <span class="label-info"
          data-tooltip="The energy and radiance of the scene."
          data-i18n="section.light"
          data-i18n-tooltip="section.light.tooltip">
        Light<span class="info-icon">i</span>
    </span>
</div>
```

**HTML pattern (parameter label)**:
```html
<label>
    <span class="label-info"
          data-tooltip="How thickly forms crowd the void."
          data-label="Density"
          data-i18n="control.density"
          data-i18n-tooltip="control.density.tooltip"
          data-i18n-label="control.density">
        Density<span class="info-icon">i</span>
    </span>
    <span id="densityLabel" class="slider-value"></span>
</label>
```

**Attributes**:
- `data-tooltip`: Default (English) tooltip text
- `data-label`: Short label for accessibility (parameter labels only)
- `data-i18n`: i18n key for the label text
- `data-i18n-tooltip`: i18n key for the tooltip text
- `data-i18n-label`: i18n key for the short label (parameter labels only)

### Seed Tag Select — Implemented

Reused in: image editor panel, gallery generation panel, animation event cards (read-only display).

```css
.seed-tag-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
}

.seed-tag-select {
    flex: 1;
    min-width: 0;
    padding: 0.4375rem 1.75rem 0.4375rem 0.625rem;
    border-radius: 10px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    color: var(--text);
    font-size: 0.75rem;
    cursor: pointer;
    appearance: none;
}

.seed-tag-sep {
    color: var(--text-muted);
    font-size: 0.75rem;
    user-select: none;
}
```

### Scene Card — Implemented

In `css/animation-editor.css`. Event cards in the animation editor scene list.

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

.scene-type-badge {
    font-size: 0.5625rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
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

### Timeline Span — Implemented

In `css/timeline.css`. Horizontal bars in overlay tracks.

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
}

.timeline-span:hover {
    background: var(--accent);
    color: var(--text);
}

.timeline-span.selected {
    background: var(--accent);
    box-shadow: 0 0 8px var(--accent);
    z-index: 2;
}

/* Resize handles at edges */
.timeline-span::before,
.timeline-span::after {
    content: '';
    position: absolute;
    top: 0; bottom: 0;
    width: 6px;
    cursor: ew-resize;
}
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
}

.easing-select:hover {
    border-color: var(--border);
    background: var(--surface);
}
```

---

## Part 5: Interaction Patterns

### Image Editor — Implemented

**Slider adjustment flow**:
1. User drags a control slider (density, fracture, etc.)
2. Scene rebuilds on the worker (throttled 150ms)
3. Canvas updates with the new render
4. If a camera slider is moved instead, only camera repositions (no rebuild) — feels instant

**Seed change flow**:
1. User changes a seed tag dropdown
2. Scene rebuilds with the new seed (same controls)
3. The seed label updates in the stage header
4. This triggers a morph transition if transitions are enabled

**Randomize flow**:
1. Click the randomize button (in stage header)
2. All 3 seed slots + 11 controls + camera randomized
3. Morph transition from old → new (if enabled)
4. Name auto-generated from the new config

**Profile load flow**:
1. Click a profile card in the gallery
2. If unsaved changes, prompt: "Save changes to [name]?"
3. Controls update with new profile data (seed tags, controls, camera)
4. Canvas renders the new config (with morph transition if enabled)

### Animation Editor — Implemented

**Building an animation**:
1. Click `+ Add Event` → choose type → (for expand/transition) pick profile → card added
2. Repeat to build the scene sequence
3. Adjust durations and easings inline on each card
4. Click event cards to see their config in the preview canvas
5. Add camera/param/focus spans in the timeline tracks
6. Click Preview for real-time playback with playhead sync
7. Click Render Animation to dispatch to the worker

**Template flow**:
1. Select a template card from the empty state (or use Templates dropdown)
2. Profile picker opens sequentially for each required profile slot
3. Scene list, overlay tracks, and settings populate from the template
4. User can modify anything — template is just a starting point

**Preview playback**:
1. Click ▶ Preview → renders frames at SD into the preview canvas
2. Playhead moves across the timeline in sync
3. Click again (now ⏸) to pause
4. Drag playhead to scrub to any time

---

## Part 5: Color Palette for Event Types

Event types are visually distinct but harmonious with the purple accent palette:

| Type | Color | Meaning |
|------|-------|---------|
| Expand | `var(--accent-text)` — purple | Emergence, creation |
| Pause | `var(--text-muted)` — gray | Stillness, breath |
| Transition | `rgb(255, 190, 100)` — amber | Transformation, journey |
| Collapse | `rgba(130, 200, 255, 0.7)` — ice blue | Dissolution, release |

These colors appear in scene card type badges, event track blocks (as faint fills), and the add-event type picker.

The amber for transitions is warm against the cool purple/blue palette — it draws attention to the most creatively significant event type.

---

## Part 6: Responsive Considerations

### Tablet (768–1024px)

**Image editor**: Panel becomes a sliding drawer (overlay, not push). Same content, same width (25rem). Backdrop overlay when open. This already works.

**Animation editor**: The scene list panel becomes a sliding drawer. The timeline area stacks below the preview canvas (horizontal scroll if needed). The action bar sticks to the bottom.

### Mobile (< 768px)

**Image editor**: Panel is a full-width drawer. Controls get slightly more padding for touch targets. Slider thumbs enlarge to 16px.

**Animation editor**: Only template-based flow on mobile. No timeline track editing (drag-to-resize spans is inherently a desktop interaction). Users pick a template, assign profiles, set duration, render. Advanced editing requires desktop. This covers the majority of use cases.

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
