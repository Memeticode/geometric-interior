# Design: Configuration Interfaces

A unified design for the image and animation configuration systems. The image editor creates the atomic unit (a still-image config). The animation editor composes these into sequences with camera, parameter, and focus overlay tracks.

---

## Part 1: Image Configuration

### The Image Config Unit

An **ImageConfig** is the complete specification for a single still image:

```
ImageConfig = {
    name: string,
    seed: SeedTag,               // [arrangement, structure, detail]
    controls: Controls,          // 11 continuous 0-1 axes
    camera: { zoom, rotation },  // static framing
}
```

This is the building block for everything. A saved profile is an ImageConfig. An animation event references an ImageConfig. The gallery displays ImageConfigs.

### Editor Panel Layout

The image editor panel (`image.html`, left sidebar) gets the following changes:

**Replace the Intent (seed) textarea** with the seed tag system:

```
Name        [ Violet Crystalline          ]

Seed
  Arrangement  [ Swirling      v ]
  Structure    [ Crystalline   v ]
  Detail       [ Radiant       v ]
```

Three `<select>` dropdowns, each with 18 localized options on a perceptual spectrum. This matches the pattern already implemented in the gallery generation panel (`generate-panel.js`). The seed tag is displayed as a subtitle below the name: "Swirling, Crystalline, Radiant".

**Add a Camera section** after Space:

```
Camera
  Zoom       |----o----------| 1.00
  Rotation   |o---------------| 0
```

- **Zoom**: Range 0.3-3.0 (not 0-1). Default 1.0. Below 1.0 = closer, above 1.0 = further.
- **Rotation**: Range 0-360 degrees. Default 0. Continuous wrap-around (360 = 0). The slider track could show a subtle compass/angle indicator.

Camera values are stored in the profile alongside controls and seed. They're applied to the renderer via `setCameraState()` for live preview. URL encoding: `z=1.2&r=45`.

**Section ordering in the panel**:

1. Name
2. Seed (3 dropdowns)
3. Parameters heading
4. Geometry (density, fracture, scale, division, faceting)
5. Light (luminosity)
6. Color (hue, spectrum, chroma)
7. Space (coherence, flow)
8. Camera (zoom, rotation)
9. Export / Import

The topology selector remains hidden (always `flow-field`).

### Seed Tag Integration

The seed tag system replaces string seeds throughout the image system:

- **Profiles**: `seed` field changes from `string` to `SeedTag` (3-number array)
- **URL state**: `s=3.12.8` (dot-separated integers, already designed)
- **Display**: Localized label below the name — "Swirling, Crystalline, Radiant" / "Arremolinado, Cristalino, Radiante"
- **Randomize**: Picks 3 random integers 0-17 for each slot
- **Backward compatibility**: Old string seeds continue to work via `parseSeed()` which hashes strings into 3 slots. Profiles with string seeds are converted on load.
- **Title/text generation**: The seed tag label replaces the old "intent" phrase as the subtitle. The title generation system (`text.ts`) already works with any seed via `seedToString()`.

### Camera in Live Preview

When the user adjusts zoom or rotation sliders:
1. `onControlChange()` fires (same as existing sliders)
2. Camera values are read from the new slider inputs
3. `setCameraState(zoom, 0, rotation)` is sent to the worker
4. Worker applies camera override and re-renders
5. The canvas shows the adjusted framing immediately

Camera does NOT trigger a scene rebuild (unlike the 11 control sliders). It only repositions the virtual camera. This means camera adjustments should feel instant — no morph transition needed.

### Profile Schema Update

```typescript
// Current
interface SavedProfile {
    seed: string;
    controls: Controls;
}

// New
interface SavedProfile {
    seed: SeedTag;
    controls: Controls;
    camera?: { zoom: number; rotation: number };  // optional for backward compat
}
```

Missing `camera` defaults to `{ zoom: 1.0, rotation: 0 }`.

---

## Part 2: Animation Configuration

### Overview

The animation editor (`animation.html`) is a **composition tool**. Users build animations by:

1. **Sequencing content events** that reference saved image configs (profiles)
2. **Overlaying camera movements** that can span single or multiple events
3. **Automating live parameters** (twinkle, dynamism) over time
4. **Automating focus/DOF** effects over time
5. **Choosing global settings** (fps, resolution, total duration readout)

The editor produces an `Animation` object (defined in `lib/core/timeline.ts`) that the worker renders frame-by-frame.

### Page Structure

The animation page replaces the current layout (which is a clone of the image editor with 3 animation sliders). The new layout:

```
+------------------------------------------+
| Header                                   |
+----------+-------------------------------+
|          |                               |
| Event    |    Preview Canvas             |
| List     |    (live or static preview)   |
| (panel)  |                               |
|          +-------------------------------+
|          |                               |
|          |    Timeline Track Area        |
|          |    (camera, params, focus)    |
|          |                               |
+----------+-------------------------------+
|          |    Render Bar / Actions       |
+----------+-------------------------------+
```

**Left panel**: Event list + global settings. Scrollable. Same position as the existing editor panel.

**Main area, top**: Preview canvas showing the current frame. Either a static preview of the selected event's config, or a low-res real-time playback.

**Main area, bottom**: Horizontal timeline visualization showing event blocks and overlay tracks. This area appears below the canvas.

**Bottom bar**: Total duration readout, render button, template selector.

### Event List (Left Panel)

The event list is a vertical stack of event cards. Each card represents one `ContentEvent`:

```
+-- Event 1: Expand ──────────────+
| [thumb] Violet Sanctum          |
|   3.0s  ease-out                |
|   [reorder] [delete]            |
+---------------------------------+
+-- Event 2: Pause ───────────────+
|   (current scene)               |
|   5.0s  linear                  |
|   [reorder] [delete]            |
+---------------------------------+
+-- Event 3: Transition ──────────+
| [thumb] Sapphire Lattice        |
|   4.0s  ease-in-out             |
|   [reorder] [delete]            |
+---------------------------------+
+-- Event 4: Collapse ────────────+
|   (current scene)               |
|   3.0s  ease-in                 |
|   [reorder] [delete]            |
+---------------------------------+
        [ + Add Event ]
```

**Event card anatomy**:
- **Type badge**: expand / pause / transition / collapse (colored pill or icon)
- **Thumbnail**: Small preview of the referenced config (for expand/transition). For pause/collapse, shows "(current scene)" text.
- **Profile name**: The name of the referenced saved profile
- **Duration**: Editable number input, in seconds (e.g., `3.0s`)
- **Easing**: Dropdown — linear, ease-in, ease-out, ease-in-out
- **Actions**: Reorder (drag or up/down buttons), delete

**Adding an event**: The `+ Add Event` button opens a small popover:
- Choose type: expand / pause / transition / collapse
- For expand/transition: opens a **profile picker** (grid of portrait + user profile thumbnails, same data source as the gallery). Selecting a profile fills in the config + seed.
- Duration defaults: expand 3s, pause 5s, transition 4s, collapse 3s
- Easing defaults: expand ease-out, pause linear, transition ease-in-out, collapse ease-in

**Constraints enforced by UI**:
- First event must be `expand` (the add-event menu for position 0 only shows expand)
- `pause` and `collapse` don't show a profile picker (they use the current scene)
- `transition` requires a profile selection (target config)
- After a `collapse`, only `expand` is offered (nothing → something)

**Selecting an event**: Clicking an event card selects it. The preview canvas shows that event's config as a still image. For transitions, it could show a side-by-side or the midpoint.

### Profile Picker

When adding an expand or transition event, the user needs to choose a profile. The profile picker is a modal or inline panel showing:

```
+-- Select Profile ───────────────+
| Portraits                       |
| [thumb] [thumb] [thumb] ...     |
|                                 |
| Saved (local)                   |
| [thumb] [thumb] ...             |
|                                 |
| Generated                       |
| [thumb] [thumb] ...             |
+---------------------------------+
```

Each thumbnail shows the profile name on hover. Clicking selects it and closes the picker. This reuses the existing profile/gallery data and thumbnail infrastructure.

### Timeline Track Area

Below the preview canvas, a horizontal timeline visualization:

```
Time:   0s        3s        8s        12s       15s
        |---------|---------|---------|---------|
Events: [ expand  ][  pause  ][ transition ][ col ]

Camera: [====== slow zoom 1.0 → 0.7 =========]
             [=== orbit 0° → 90° ===]

Params: [=== twinkle 0 → 0.8 =====]
                    [====== dynamism 0.3 → 0.7 ======]

Focus:        [=== focal shift near → far ===]
```

**Event track** (top): Read-only blocks sized proportionally to duration. Labels show type. Colored by type. This mirrors the event list but in horizontal time-proportional form.

**Camera track**: Editable spans. Each span is a camera move with start/end time, from/to state, and easing. Multiple spans can overlap (effects compose). Click to select, drag edges to resize, double-click to edit properties.

**Param track**: Similar editable spans for twinkle and dynamism. Each span has start/end time, from/to values (0-1), and easing.

**Focus track**: Spans for focal depth and blur amount animation.

**Adding an overlay span**: A `+` button on each track row, or click-drag on empty space to create a new span at that time range.

**Editing a span**: Selecting a span shows a small properties panel (popover or inline below the timeline):
- Start time / end time (editable, snaps to event boundaries optionally)
- From / to values (sliders or number inputs)
- Easing dropdown

### Templates

Templates are pre-filled `Animation` objects. They provide the **simple mode** entry point.

**Template selector**: A dropdown or button row at the top of the event list or in the bottom action bar:

```
Templates: [ Gentle Reveal v ]   [ Apply ]
```

Selecting a template and clicking Apply populates the entire event list and overlay tracks. The user can then customize.

**Template types**:

| Template | Events | Camera | Params |
|----------|--------|--------|--------|
| **Gentle Reveal** | expand(3s) → pause(8s) → collapse(3s) | Slow zoom 1.0→0.85 over full duration | Twinkle ramps 0→0.6 over pause |
| **Morph Journey** | expand(3s) → transition(4s) → pause(5s) → transition(4s) → pause(5s) → collapse(3s) | Gentle orbit 0°→60° | Twinkle 0.4 steady, dynamism ramps |
| **Orbital Showcase** | expand(3s) → pause(20s) → collapse(3s) | Full 360° orbit over pause | Twinkle 0.5 + dynamism 0.3 steady |
| **Quick Morph** | expand(2s) → transition(3s) → collapse(2s) | Zoom in during transition | None |
| **Contemplative** | expand(4s) → pause(15s) → collapse(4s) | Very slow zoom 1.0→0.9 | Low twinkle 0.2, no dynamism |
| **Rack Focus** | expand(3s) → pause(10s) → collapse(3s) | Static | Focus: near→far→near sweep |

Templates reference **placeholder profile slots** (e.g., "Profile A", "Profile B") that the user fills by selecting from their saved profiles. A template that uses 2 transitions needs 3 profiles (initial + 2 targets).

**Template application flow**:
1. User selects template
2. If template needs profiles, profile picker(s) appear for each slot
3. Event list and tracks populate
4. User can modify anything — template is just a starting point

### Global Settings

At the top or bottom of the event list panel:

```
Settings
  FPS        [ 30 v ]       (12, 24, 30, 60)
  Resolution [ HD  v ]      (SD, HD, FHD, QHD, 4K)
  Duration   15.0s           (computed, read-only)
  Frames     450             (computed, read-only)
```

### Preview Playback

The preview canvas supports two modes:

**Static preview** (default): Shows a rendered still of the currently selected event's config. Fast — uses the existing render worker. Good for reviewing individual scenes.

**Playback preview**: Low-resolution real-time playback of the full animation. Uses the existing `evaluateTimeline()` + worker `doGenerateAnimation` infrastructure at reduced resolution (e.g., SD). A play/pause button and scrub bar below the canvas. Frame counter display.

Playback preview is computationally expensive (renders every frame). It should be explicitly triggered (play button), not automatic. The preview resolution should be fixed at SD regardless of the render resolution setting.

### Render Action

The render button dispatches the `Animation` object to the render queue:

```
[ Preview (SD) ]  [ Render Animation ]
```

- **Preview**: Renders at SD into the preview canvas for quick review
- **Render Animation**: Dispatches to the render queue at the selected resolution. Shows progress in the render queue popover (frame count, ETA). When complete, the result (video blob) is stored in IndexedDB and appears in the gallery's Animations section.

The render queue infrastructure (`render-queue.js`) already exists for image generation. Animation rendering adds a new job type with frame-by-frame progress.

---

## Part 3: Shared Infrastructure

### Profile as the Shared Building Block

Both image and animation systems reference the same profile store:

```
Profile Store
  ├── Portraits (built-in, read-only)
  ├── User Profiles (localStorage)
  └── Generated Profiles (IndexedDB)
```

The image editor creates and modifies profiles. The animation editor references them. This means:
- Editing a profile in the image editor does NOT retroactively change existing animations (animations store a snapshot of the config at the time the event was added)
- The profile picker in the animation editor shows the current saved profiles
- If a user wants a custom config for an animation, they create it in the image editor first, save it, then reference it in the animation editor

### Camera: Two Layers

**Layer 1 — Static camera** (per-config): Part of the ImageConfig. Applied when viewing a still image. Stored in the profile.

**Layer 2 — Animated camera** (per-animation): CameraMove tracks with absolute time ranges. Applied during animation rendering, overriding the per-config camera.

**How they interact in animation**:
- When no camera moves are active at time `t`, the camera uses the current event's config camera (zoom, rotation). During a transition, it interpolates between the from-config camera and to-config camera.
- When camera moves ARE active, they override. The evaluator already handles this — camera moves produce absolute zoom/orbit values.
- This means: if a user sets up profiles with specific camera framings, those framings are respected during pauses. Camera moves override when you want dynamic movement.

**Implementation note**: The current `evaluateTimeline()` defaults to `cameraZoom=1.0, cameraOrbitY=0, cameraOrbitX=0` when no camera moves are active. To respect per-config camera, the evaluator would need access to each event's config camera values and interpolate them during transitions. This is a small extension to the evaluator.

### Render Queue

The render queue handles both image and animation jobs:

```typescript
type RenderJob = {
    type: 'image' | 'animation';
    id: string;
    // For image: seed + controls + camera
    // For animation: full Animation object
    status: 'queued' | 'rendering' | 'complete' | 'error' | 'cancelled';
    progress?: { frame: number; totalFrames: number };
};
```

Animation jobs report per-frame progress. The queue UI shows:
- For images: "Rendering... (building scene / rendering / capturing)"
- For animations: "Rendering frame 142 / 450 (31%)" with ETA

### Storage

- **Image profiles**: localStorage (`geo_self_portrait_profiles_v3`) — same as current
- **Generated image assets**: IndexedDB `geo-asset-store` — same as current
- **Animation definitions**: localStorage (`geo-animation-projects`) — the `Animation` objects themselves are small (JSON)
- **Rendered animation videos**: IndexedDB `geo-asset-store` — video blob + thumbnail + animation definition reference

### URL State

Image configs can be fully encoded in the URL for sharing:

```
/image.html?d=0.5&f=0.3&sc=0.5&...&s=3.12.8&z=1.2&r=45
```

Animation definitions are too complex for URL encoding. They're saved locally and exported as JSON files for sharing.

---

## Part 4: Implementation Roadmap

### Phase A: Image Editor — Seed Tags + Camera

**Goal**: Update the image editor to use seed tags and camera controls.

**Work**:
- Replace the intent/seed textarea with 3 `<select>` dropdowns (reuse pattern from `generate-panel.js`)
- Add Camera section with zoom (0.3-3.0) and rotation (0-360) sliders
- Update `editor-main.js` to read/write seed tags and camera values
- Wire camera sliders to `setCameraState()` on the worker (no scene rebuild, instant preview)
- Update profile save/load to include `camera` field
- Update URL state to include `s=3.12.8&z=1.2&r=45`
- Migrate old string seeds on profile load via `parseSeed()`
- Update starter profiles (`starter-profiles.json`) from string seeds to seed tags
- Update `active-preview-seed` display to show localized seed tag label

**Does NOT include**: Animation editor changes.

**Check-in**: Image editor has 3 seed tag dropdowns, 2 camera sliders, live camera preview, profiles save/load with new fields.

---

### Phase B: Animation Editor — Event Sequencer

**Goal**: Replace the current animation page with an event list editor. No overlay tracks yet.

**Work**:
- New page layout: left panel (event list + settings), main area (preview canvas)
- Event list: add/remove/reorder event cards
- Event types: expand, pause, transition, collapse with proper constraints
- Profile picker modal for expand/transition events (shows portraits + user profiles)
- Duration + easing controls per event
- Global settings: FPS dropdown, resolution dropdown, computed duration/frame count
- Static preview: selecting an event shows its config rendered on the canvas
- The event list produces a valid `Animation.events` array
- Render button dispatches `Animation` to the worker via `generate-animation` message
- Connect to existing render queue for progress + storage

**Does NOT include**: Timeline visualization, overlay tracks, templates, playback preview.

**Check-in**: User can build a multi-event animation from saved profiles, see static previews, adjust durations/easings, and render to a video file stored in IndexedDB. Basic but functional.

---

### Phase C: Timeline Visualization + Overlay Tracks

**Goal**: Add the horizontal timeline area and camera/param/focus track editing.

**Work**:
- Timeline area below the canvas: horizontal bar proportional to total duration
- Event blocks displayed as read-only segments on the timeline
- Camera track: add/edit/delete camera move spans (start/end time, from/to zoom/orbit, easing)
- Param tracks: add/edit/delete twinkle and dynamism spans
- Focus track: add/edit/delete focus spans (focalDepth, blurAmount)
- Span interaction: click to select, drag edges to resize, double-click for properties popover
- Time snapping to event boundaries (optional, with snap toggle)
- Playhead scrubber for time-based navigation
- The overlay tracks populate `Animation.cameraMoves`, `Animation.paramTracks`, `Animation.focusTracks`

**Does NOT include**: Playback preview, templates.

**Check-in**: User can define camera movements, parameter automation, and focus effects on a visual timeline. Full `Animation` object is produced and renderable.

---

### Phase D: Templates + Playback Preview

**Goal**: Templates for quick-start workflows, and real-time preview playback.

**Work**:
- Template library: 5-8 pre-defined Animation structures (see table in Part 2)
- Template selector UI (dropdown or card grid)
- Template application: fills event list + tracks, prompts for profile selection per slot
- Playback preview: render animation frames in real-time at SD resolution into the preview canvas
- Play/pause/stop controls and scrub bar
- Frame counter and time display during playback
- Playback uses the existing worker `generate-animation` protocol at reduced resolution

**Check-in**: User can pick a template, assign profiles to slots, preview the animation in real-time, and render the final version at full resolution.

---

### Phase E: Per-Config Camera in Animation

**Goal**: Animation respects each event's per-config camera framing when no camera moves override.

**Work**:
- Extend `evaluateTimeline()` to read each event's config camera values (zoom, rotation)
- When no camera moves are active: use the current event's config camera
- During transitions with no camera moves: interpolate between from-config camera and to-config camera
- Camera moves override when active (current behavior preserved)
- Event cards in the animation editor show camera values from the referenced profile
- Optional: per-event camera override (modify the config's camera just for this event without changing the saved profile)

**Check-in**: Animations naturally inherit the camera framing from each profile, creating smooth camera transitions even without explicit camera move tracks.

---

### Future Considerations

**Animation sharing**: Export animation definitions as JSON. Import on another device (requires the referenced profiles to also be imported or available as portraits).

**Animation gallery**: Rendered animations appear in the gallery's Animation section. Thumbnails, playback, download.

**Preset management**: Save custom templates. Share templates.

**Extended param tracks**: If new animatable parameters are added to the renderer (e.g., color temperature shift, bloom intensity), they slot into the same overlay track system.

**Keyframe curves**: Replace linear from/to spans with multi-point keyframe curves for more expressive automation. Same track UI, more control points.

**Audio sync**: Align events and tracks to audio beats/markers. Speculative — depends on whether audio is ever part of the project.

---

## Key Files (Reference)

### Existing (to be modified):
- `image.html` — Add seed tag dropdowns + camera sliders to configControls
- `animation.html` — Replace entire page layout
- `src/editor/editor-main.js` — Seed tag integration, camera slider handling
- `src/image/image-main.js` — Thin entry point (minimal changes)
- `src/animation/anim-main.js` — Rewrite for new animation editor
- `src/core/url-state.js` — Add `s`, `z`, `r` params for seed tag + camera
- `src/core/starter-profiles.json` — Convert string seeds to seed tags
- `src/ui/profiles.js` — Schema migration for camera field + seed tag format
- `src/engine/render-worker.js` — Already has `doGenerateAnimation`, may need camera-from-config extension

### Existing (used as-is):
- `lib/core/timeline.ts` — Animation data model + `evaluateTimeline()`
- `lib/core/easing.ts` — Easing functions
- `lib/core/seed-tags.ts` — Seed tag system (types, parsing, labels, streams)
- `lib/engine/create-renderer.ts` — `setCameraState()`, `setLiveParams()`, `setFocusState()`
- `src/gallery/generate-panel.js` — Reference pattern for seed tag UI
- `src/gallery/render-queue.js` — Render queue (extend for animation jobs)
- `src/ui/asset-store.js` — IndexedDB storage (extend for animation videos)

### New files to create:
- `src/animation/event-list.js` — Event list UI component
- `src/animation/profile-picker.js` — Profile selection modal
- `src/animation/timeline-tracks.js` — Timeline visualization + overlay track editor
- `src/animation/templates.js` — Template definitions + application logic
- `src/animation/preview.js` — Playback preview controller
- `css/animation-editor.css` — Styles for the new animation editor layout
- `css/timeline.css` — Styles for the timeline track visualization

### Data model (existing, in `lib/core/timeline.ts`):
- `Animation` — top-level: settings + events + cameraMoves + paramTracks + focusTracks
- `ContentEvent` — type, duration, easing, config?, seed?
- `CameraMove` — type, startTime, endTime, easing, from, to
- `ParamTrack` — param, startTime, endTime, easing, from, to
- `FocusTrack` — startTime, endTime, easing, from, to
- `FrameState` — complete per-frame render state (returned by evaluateTimeline)
