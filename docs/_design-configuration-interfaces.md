# Design: Configuration Interfaces

> Updated March 2026 to reflect current implementation state and revised design thinking.

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

### Editor Panel Layout (Implemented)

The image editor panel (`image.html`, left sidebar) has:

- **Seed tag system**: Three `<select>` dropdowns (`#seedTagArr`, `#seedTagStr`, `#seedTagDet`) with 18 localized options per perceptual spectrum (arrangement, structure, detail). This replaced the old intent/seed textarea.

- **Camera section**: Two sliders after the Space section:
  - **Zoom**: Range 0.3–3.0 with step 0.01. Below 1.0 = closer, above 1.0 = further.
  - **Rotation**: Range 0–360 degrees with step 1. Continuous wrap-around.
  - Camera values are stored in the profile alongside controls and seed. Applied to the renderer via `setCameraState()` for live preview.

**Section ordering in the panel**:

1. Name
2. Seed (3 dropdowns)
3. Save / Reset actions
4. Geometry (density, fracture, scale, division, faceting)
5. Light (luminosity)
6. Color (hue, spectrum, chroma)
7. Space (coherence, flow)
8. Camera (zoom, rotation)
9. Export / Import

### Design Direction: Remove Active Card

The current implementation wraps the controls inside an "active card" with a thumbnail, status badge, chevron toggle, and collapsed/expanded states. Since the user always sees the full render on the canvas, this card abstraction is unnecessary. The panel should be a direct controls surface — open it, and all controls are immediately available. See `_design-ui-menus.md` Part 1 for the detailed layout.

### Seed Tag Integration (Implemented)

The seed tag system replaces string seeds throughout:

- **Profiles**: `seed` field is `SeedTag` (3-number array) or legacy `string`
- **URL state**: `s=3.12.8` (dot-separated integers)
- **Display**: Localized label — "Swirling, Crystalline, Radiant"
- **Randomize**: Picks 3 random integers 0–17 for each slot
- **Backward compatibility**: Old string seeds work via `parseSeed()` which hashes strings into 3 slots
- **Title/text generation**: Works with any seed via `seedToString()`

### Camera in Live Preview (Implemented)

When the user adjusts zoom or rotation sliders:
1. `onControlChange()` fires
2. Camera values are read from the slider inputs
3. `setCameraState(zoom, 0, rotation)` is sent to the worker
4. Worker applies camera override and re-renders
5. The canvas shows the adjusted framing immediately

Camera does NOT trigger a scene rebuild. Only camera repositioning. This feels instant.

### Profile Schema

```typescript
interface SavedProfile {
    seed: SeedTag | string;   // SeedTag preferred, string for legacy compat
    controls: Controls;
    camera?: { zoom: number; rotation: number };  // defaults to { zoom: 1.0, rotation: 0 }
}
```

---

## Part 2: Animation Configuration

### Overview

The animation editor (`animation.html`) is a composition workspace. Users build animations by:

1. **Sequencing content events** that reference saved image configs (profiles)
2. **Overlaying camera movements** that can span single or multiple events
3. **Automating live parameters** (twinkle, dynamism) over time
4. **Automating focus/DOF** effects over time
5. **Choosing global settings** (fps, resolution, total duration readout)

The editor produces an `Animation` object (defined in `lib/core/timeline.ts`) that the worker renders frame-by-frame.

### Current Implementation

The animation editor is built and functional:

- **`src/animation/anim-main.js`** — entry point + state management
- **`src/animation/event-list.js`** — event card UI (add/remove/reorder/edit)
- **`src/animation/profile-picker.js`** — modal for selecting profiles
- **`src/animation/timeline-tracks.js`** — timeline visualization + overlay track editor
- **`src/animation/templates.js`** — template definitions + application logic
- **`src/animation/preview.js`** — playback preview with playhead sync

### Page Structure (Implemented)

Left panel (scene list + settings) + main stage (preview canvas + timeline + action bar). See `_design-ui-menus.md` Part 2 for the detailed layout.

### Event List

A vertical stack of event cards. Each card shows type badge, profile thumbnail (for expand/transition), name, seed label, duration, easing, and reorder/delete controls.

**Adding events**: `+ Add Event` → type picker (with constraint enforcement) → profile picker (for expand/transition) → card added with defaults.

**Constraints**:
- First event must be `expand`
- After `collapse`, only `expand` is offered
- `pause` and `collapse` don't need a profile (they use current scene)

### Profile Picker

Modal showing portraits + user profiles as a thumbnail grid. Click to select. Profiles are the same data source as the image editor gallery.

**Key design decision**: Animations reference profile snapshots — editing a profile in the image editor does NOT retroactively change existing animations. The animation stores a copy of the config at the time the event was added.

### Timeline Track Area

Horizontal timeline visualization with:
- **Event track**: Read-only colored blocks sized proportionally to duration
- **Camera track**: Editable spans for camera moves (zoom, orbit)
- **Params track**: Editable spans for twinkle and dynamism
- **Focus track**: Editable spans for focal depth and blur amount
- **Time ruler**: Tick marks at event boundaries
- **Playhead**: Scrubable vertical line for time-based seeking

### Templates (Implemented)

Templates are pre-filled `Animation` objects providing a quick-start workflow. Available templates:

| Template | Profile Slots | Description |
|----------|--------------|-------------|
| Gentle Reveal | 1 | Expand → pause → collapse with slow zoom |
| Morph Journey | 3 | Multi-transition sequence with camera orbit |
| Orbital Showcase | 1 | Long hold with full 360° orbit |
| Quick Morph | 2 | Fast expand → transition → collapse |
| Contemplative | 1 | Extended slow reveal with subtle zoom |
| Rack Focus | 1 | Static camera, depth-of-field sweep |

**Template application flow**: User selects template → profile picker opens for each slot → event list and tracks populate → user can modify anything.

### Global Settings (Implemented)

- FPS: 12, 24, 30 (default), 60
- Resolution: SD, HD (default), FHD, QHD, 4K
- Duration: computed from event durations (read-only)
- Frames: computed from duration × fps (read-only)

### Preview Playback (Implemented)

Play/pause button renders frames at current resolution into the preview canvas. Playhead moves across the timeline in sync. Frame-by-frame rendering using `evaluateTimeline()` + worker render pipeline.

### Render

Dispatches the full `Animation` object to the worker via `generate-animation` message. Progress reported per-frame. Result is a video blob downloaded to the user's machine.

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

The image editor creates and modifies profiles. The animation editor references them (as snapshots).

### Camera: Two Layers

**Layer 1 — Static camera** (per-config): Part of the ImageConfig. Applied when viewing a still image. Stored in the profile.

**Layer 2 — Animated camera** (per-animation): CameraMove tracks with absolute time ranges. Applied during animation rendering, overriding the per-config camera.

**How they interact**: When no camera moves are active at time `t`, the camera defaults to zoom=1.0, orbitY=0, orbitX=0. Camera moves override when active. A future enhancement would have the evaluator read each event's config camera values so profiles' static framing is respected during pauses.

### Render Queue

The render queue handles both image and animation jobs. Animation jobs report per-frame progress. Currently, animation renders download directly as video blobs. Future: integrate with IndexedDB asset storage and gallery display.

### Storage

- **Image profiles**: localStorage (`geo_self_portrait_profiles_v3`)
- **Generated image assets**: IndexedDB `geo-asset-store`
- **Animation definitions**: Not yet persisted (future: localStorage `geo-animation-projects`)
- **Rendered animation videos**: Download directly (future: IndexedDB `geo-animation-store`)

### URL State (Implemented for Images)

Image configs are fully URL-encoded for sharing:
```
/image.html?d=0.5&f=0.3&sc=0.5&...&s=3.12.8&z=1.2&r=45
```

Animation definitions are too complex for URL encoding. They'll be saved locally and exported as JSON files for sharing.

---

## Part 4: Implementation Status

### Completed

- **Seed tags in image editor**: 3 `<select>` dropdowns, wired through editor-main.js
- **Camera sliders in image editor**: Zoom (0.3–3.0) and rotation (0–360), instant preview via `setCameraState()`
- **URL state for seed + camera**: `s=3.12.8&z=1.2&r=45`
- **Profile schema with camera**: `camera?: { zoom, rotation }` field
- **Starter profiles with seed tags**: Converted from string seeds
- **Animation event sequencer**: Event list with add/remove/reorder, type constraints, profile picker
- **Timeline visualization + overlay tracks**: Camera, params, focus track editing
- **Templates**: 6 template definitions with profile slot assignment flow
- **Preview playback**: Play/pause with playhead sync
- **Animation rendering**: Worker-based frame-by-frame with progress, video blob download

### Remaining Work

1. **Image editor: remove active card** — flatten controls into direct panel surface (see `_design-ui-menus.md` Part 1)
2. **Animation: save/load definitions** — persist animation projects to localStorage
3. **Animation: export/import JSON** — share animation definitions as files
4. **Animation: gallery integration** — rendered animations appear in the gallery's Animations section with thumbnails and playback
5. **Animation: per-config camera** — when no camera moves are active, inherit the camera framing from each event's profile config. Requires extending `evaluateTimeline()`.
6. **Animation: visual polish** — scene cards, timeline spans, event track blocks may need CSS refinement for the event type color palette
7. **Animation: selected card details** — "Change Profile" button inline for expand/transition cards
8. **Animation: transition from→to preview** — show two small thumbnails side by side for transition events

---

## Key Files

### Image Editor:
- `image.html` — page structure with seed tag dropdowns + camera sliders
- `src/image/image-main.js` — thin entry point calling `initEditor()`
- `src/editor/editor-main.js` — shared editor orchestrator
- `src/editor/config-controls.js` — slider + seed tag + camera wiring
- `src/core/url-state.js` — URL encoding/decoding (seed, camera, controls)
- `src/ui/profiles.js` — profile save/load with schema migration
- `src/core/starter-profiles.json` — built-in profiles with seed tags
- `css/controls.css`, `css/active-card.css`, `css/panel.css`

### Animation Editor:
- `animation.html` — page structure with event list, canvas, timeline, action bar
- `src/animation/anim-main.js` — entry point + state management
- `src/animation/event-list.js` — event card UI component
- `src/animation/profile-picker.js` — profile selection modal
- `src/animation/timeline-tracks.js` — timeline visualization + overlay track editor
- `src/animation/templates.js` — template definitions + application logic
- `src/animation/preview.js` — playback preview controller
- `css/animation-editor.css`, `css/timeline.css`, `css/animation-page.css`

### Shared:
- `lib/core/timeline.ts` — Animation data model + `evaluateTimeline()`
- `lib/core/easing.ts` — easing functions
- `lib/core/seed-tags.ts` — seed tag system (types, parsing, labels, streams)
- `lib/engine/create-renderer.ts` — `setCameraState()`, `setLiveParams()`, `setFocusState()`
- `src/engine/render-worker.js` — `doGenerateAnimation` handler
- `src/gallery/gallery-worker-bridge.js` — worker communication
- `src/ui/profiles.js` — profile store (portraits + user profiles)
