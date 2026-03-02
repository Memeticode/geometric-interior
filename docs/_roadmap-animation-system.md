# Roadmap: Animation Composition System

> Updated March 2026 to reflect current implementation state.

## Overview

A layered timeline system for composing generative art animations. Users build animations by sequencing **content events** (expand, pause, transition, collapse), overlaying **camera movements** (zoom, rotate), modulating **live animatable parameters** (twinkle, dynamism) over time, and automating **depth-of-field** (focal depth, blur). The system renders frame-by-frame to produce deterministic video output.

## Implemented Data Model

Types are defined in `lib/core/timeline.ts` and exported via `lib/types.ts` and `lib/index.ts`.

```typescript
interface ContentEvent {
    type: 'expand' | 'pause' | 'transition' | 'collapse';
    duration: number;          // seconds
    easing: EasingType;        // 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
    config?: Controls;         // required for expand, transition
    seed?: Seed;               // required for expand, transition (string | [number, number, number])
}

interface CameraState {
    zoom?: number;             // multiplier on camera Z (1.0 = default)
    orbitY?: number;           // degrees of Y-axis orbit
    orbitX?: number;           // degrees of X-axis tilt
}

interface CameraMove {
    type: 'zoom' | 'rotate';
    startTime: number;         // seconds from animation start
    endTime: number;
    easing: EasingType;
    from: CameraState;
    to: CameraState;
}

interface ParamTrack {
    param: 'twinkle' | 'dynamism';
    startTime: number;
    endTime: number;
    easing: EasingType;
    from: number;              // 0-1
    to: number;                // 0-1
}

interface FocusState {
    focalDepth: number;        // 0-1 (0 = near, 1 = far)
    blurAmount: number;        // 0-1 (0 = no blur, 1 = max blur)
}

interface FocusTrack {
    startTime: number;
    endTime: number;
    easing: EasingType;
    from: FocusState;
    to: FocusState;
}

interface AnimationSettings {
    fps: number;
    width: number;
    height: number;
}

interface Animation {
    settings: AnimationSettings;
    events: ContentEvent[];
    cameraMoves: CameraMove[];
    paramTracks: ParamTrack[];
    focusTracks?: FocusTrack[];
}
```

### Content Event Semantics

| Event | Description | Scene state |
|-------|-------------|-------------|
| `expand` | Fold-in from nothing. Requires config + seed. | Builds scene, animates fold 0→1 |
| `pause` | Hold current image. No config change. | Static scene, fold=1 |
| `transition` | Morph to a different configuration. Requires target config + seed. | Dual-scene morph from current → target |
| `collapse` | Fold-out to nothing. No config change. | Animates fold 1→0 |

**Constraints:**
- First event must be `expand` (nothing → something)
- Last event should typically be `collapse` (something → nothing) for clean loops
- `transition` implicitly starts from whatever config the previous event established
- `pause` and `collapse` don't need configs — they use the current scene

### Implemented FrameState

The timeline evaluator returns this for any point in time:

```typescript
interface FrameState {
    eventIndex: number;
    eventProgress: number;      // 0-1, easing already applied
    eventType: ContentEvent['type'];

    // Content
    currentConfig: Controls;
    currentSeed: Seed;
    foldProgress: number;       // 0-1 (1 = fully expanded)

    // Morph (transition events only)
    morphFromConfig?: Controls;
    morphFromSeed?: Seed;
    morphToConfig?: Controls;
    morphToSeed?: Seed;
    morphT?: number;            // 0-1, eased

    // Camera
    cameraZoom: number;         // multiplier (1.0 = default)
    cameraOrbitY: number;       // degrees
    cameraOrbitX: number;       // degrees

    // Live params
    twinkle: number;            // 0-1
    dynamism: number;           // 0-1

    // Focus / DOF
    focalDepth: number;         // 0-1 (0.5 = default mid-range)
    blurAmount: number;         // 0-1 (0 = no blur)

    // Frame clock
    time: number;               // seconds (for deterministic shader animation)
}
```

### Camera Movement Properties

Camera moves are defined by absolute time ranges, independent of event boundaries:

- **Zoom**: Camera Z position multiplier. `from: { zoom: 1.0 }, to: { zoom: 0.7 }` = zoom in 30%.
- **Rotate**: Orbit around the scene center. `from: { orbitY: 0 }, to: { orbitY: 90 }` = quarter orbit.

Multiple camera moves can be active simultaneously. Zoom composes multiplicatively, orbit composes additively.

### Live Animatable Parameters

Modulate the existing scene in real-time via shader uniforms — no scene rebuild required:

- **Twinkle**: Glow dot oscillation and sparkle. Maps to `uWobbleAmp` + `uSparkleIntensity`. 0 = static, 1 = full oscillation.
- **Dynamism**: Face surface animation. Maps to `uDriftSpeed`. 0 = frozen, 1 = full drift.

### Depth of Field

Post-processing focus effects via `setFocusState(focalDepth, blurAmount)`:

- **Focal depth**: 0–1 where 0 = near plane, 1 = far plane. Default 0.5.
- **Blur amount**: 0–1 where 0 = no blur (everything sharp), 1 = maximum blur on out-of-focus regions. Default 0.

Focus tracks compose by averaging when multiple tracks overlap at the same time.

## Architecture

### Frame Renderer (Deterministic)

The core rendering loop for video export is **time-driven, not RAF-driven**:

```
for each frame at time t:
  1. Evaluate content track → scene state (config, fold progress, morph t)
  2. Evaluate camera track → camera zoom, orbit angles
  3. Evaluate param track → twinkle intensity, dynamism intensity
  4. Evaluate focus track → focal depth, blur amount
  5. Push all state to renderer
  6. renderer.renderFrame()
  7. Capture pixels → frame buffer
```

Renderer methods:
- `setFoldImmediate(progress)` — expand/collapse fold level
- `morphPrepare(seedA, controlsA, seedB, controlsB)` — start transition
- `morphUpdate(t)` — interpolate transition
- `morphEnd()` — cleanup transition
- `updateTime(seconds)` — deterministic shader time
- `renderFrame()` — render one frame
- `setCameraState(zoom, orbitY, orbitX)` — camera override
- `setLiveParams({ twinkle, dynamism })` — shader modulation
- `setFocusState(focalDepth, blurAmount)` — depth-of-field

### Timeline Evaluator

Pure function in `lib/core/timeline.ts`:

```typescript
evaluateTimeline(animation: Animation, timeSeconds: number): FrameState
```

Stateless — can seek to any frame without sequential playback. The worker's `doGenerateAnimation` handler manages the stateful event boundary transitions (scene builds, morph prepare/end) based on changes in `eventIndex` between frames.

### Worker Protocol

Implemented in `src/engine/render-worker.js`:

**Main → Worker:**
- `{ type: 'generate-animation', animation: Animation }` — start rendering

**Worker → Main:**
- `{ type: 'generate-animation-progress', frame, totalFrames, label }` — every 5 frames
- `{ type: 'generate-animation-complete', frames: ImageBitmap[] }` — all frames as transferables
- `{ type: 'generate-animation-cancelled' }` — if cancelled

**Main → Worker (cancel):**
- `{ type: 'cancel-generate-animation' }` — abort in-progress render

---

## Phased Implementation

### Phase 1: Timeline Data Model + Deterministic Frame Renderer ✅ COMPLETE

- `lib/core/easing.ts` — `applyEasing(t, easing)` with 4 CSS-style types
- `lib/core/timeline.ts` — Full data model types + pure `evaluateTimeline()` function
- `src/engine/render-worker.js` — `doGenerateAnimation` handler with event boundary state machine
- `lib-tests/pure/test-timeline.mjs` — 29 tests

### Phase 2: Transitions (Morph Between Configurations) ✅ COMPLETE

- Timeline evaluator handles `transition` events with morph state in FrameState
- Worker state machine: `renderWith()` for expand, `morphPrepare()/morphUpdate()/morphEnd()` for transitions
- Full test coverage of transition morph state

### Phase 3: Camera System ✅ COMPLETE

- `setCameraState(zoom, orbitY, orbitX)` + `clearCameraState()` on renderer
- Internal `applyCameraOverride()`: zoom distance scaling, Y-orbit rotation, X-tilt rotation
- Worker reads camera from FrameState each frame
- 8 new tests for zoom, orbit, composition, easing, event boundary spanning

### Phase 4: Live Animatable Parameters ✅ COMPLETE

- `setLiveParams({ twinkle, dynamism })` on renderer
- Mapping: twinkle → sparkle + wobble uniforms, dynamism → drift uniform
- Worker reads from FrameState each frame
- 6 new tests

### Phase 5: Depth of Field ✅ COMPLETE

- `setFocusState(focalDepth, blurAmount)` on renderer
- `FocusState`, `FocusTrack` types added to timeline data model
- `evaluateTimeline()` evaluates focus tracks with averaging for overlapping tracks
- Worker reads `focalDepth`, `blurAmount` from FrameState each frame

### Phase 6: Animation Composition UI ✅ COMPLETE (core)

The user-facing animation editor is built and functional:

- **`animation.html`** — page layout with scene list panel, preview canvas, timeline area, action bar
- **`src/animation/anim-main.js`** — entry point, state management, worker integration
- **`src/animation/event-list.js`** — event card UI (add/remove/reorder, type constraints, duration/easing editing)
- **`src/animation/profile-picker.js`** — modal for selecting profiles (portraits + user saved)
- **`src/animation/timeline-tracks.js`** — timeline visualization with event track + overlay tracks (camera, params, focus)
- **`src/animation/templates.js`** — 6 template definitions with profile slot assignment flow
- **`src/animation/preview.js`** — playback preview with playhead sync
- **`css/animation-editor.css`**, **`css/timeline.css`** — styling

**What works**: Building multi-event animations from profiles, adjusting durations/easings, adding overlay tracks, template-based quick-start, preview playback, full-resolution rendering to video download.

---

## Remaining Work

### Animation Persistence & Sharing
- Save animation definitions to localStorage (`geo-animation-projects`)
- Load saved animations on page revisit
- Export animation definitions as JSON for sharing
- Import animations from JSON (requires referenced profiles to exist or be included)

### Gallery Integration
- Rendered animation videos stored in IndexedDB (`geo-animation-store`)
- Animations appear in the gallery's Animations section with thumbnails
- Video playback in gallery view
- Download rendered videos from gallery

### Per-Config Camera in Animations
- When no camera moves are active, inherit the camera framing from each event's profile config
- During transitions with no camera moves: interpolate between from-config camera and to-config camera
- Requires extending `evaluateTimeline()` to access event config camera values
- Optional: per-event camera override (modify camera just for this event without changing the saved profile)

### Visual Polish
- Scene card styling refinement (event type color badges per the design spec)
- Timeline span visual refinement (ribbon-style borders, glow on selected)
- Event track block color fills matching the event type palette
- Selected card expansion: "Change Profile" button for expand/transition events
- Transition from→to preview: two small thumbnails side by side

### Future Considerations

**Preset management**: Save custom templates. Share templates.

**Extended param tracks**: If new animatable parameters are added to the renderer (e.g., color temperature shift, bloom intensity), they slot into the same overlay track system.

**Keyframe curves**: Replace linear from/to spans with multi-point keyframe curves for more expressive automation.

**Audio sync**: Align events and tracks to audio beats/markers.

---

## Cross-Cutting Concerns

### Determinism
Every aspect of animation rendering is deterministic. Same animation definition + same renderer = identical frame output. No `Date.now()` or `performance.now()` in the render path — only the frame clock. Shader `time` uniforms driven by frame number × (1/fps). PRNG streams seeded from animation definition.

### Morph State Management
The worker's `doGenerateAnimation` handler manages scene state transitions at event boundaries:
- At `expand` start: `renderWith(seed, controls)` builds scene
- At `transition` start: `morphPrepare(seedA, controlsA, seedB, controlsB)` builds both scenes
- During `transition`: `morphUpdate(t)` interpolates (easing already applied by evaluator)
- At `transition` end: `morphEnd()` disposes source scene
- At `collapse` end: scene remains (fold animates to 0)

### Memory and Performance
- For a 30-second animation at 30fps = 900 frames
- Each frame: evaluate timeline (instant) + render (10–50ms) + capture (5–20ms)
- Total render time: ~15–60 seconds for a 30-second animation
- Current implementation returns `ImageBitmap[]` — for long animations, incremental video encoding is needed to avoid holding all frames in memory

### Easing Functions
Implemented in `lib/core/easing.ts`. Standard CSS-style curves: `linear`, `ease-in`, `ease-out`, `ease-in-out`. All monotonic, clamped to [0, 1].

## Key Files

### Implemented:
- **`lib/core/easing.ts`** — `applyEasing(t, easing)`, 4 easing types
- **`lib/core/timeline.ts`** — Animation data model types + `evaluateTimeline()` + `totalDuration()` + `totalFrames()`
- **`lib/core/seed-tags.ts`** — Compositional seed system
- **`lib/types.ts`** — Re-exports animation types
- **`lib/index.ts`** — Public API exports
- **`src/engine/render-worker.js`** — `doGenerateAnimation` handler
- **`lib/engine/create-renderer.ts`** — `setCameraState()`, `clearCameraState()`, `setLiveParams()`, `setFocusState()`
- **`lib-tests/pure/test-timeline.mjs`** — 37+ tests

### Animation Editor:
- **`animation.html`** — page structure
- **`src/animation/anim-main.js`** — entry point + orchestrator
- **`src/animation/event-list.js`** — event card UI
- **`src/animation/profile-picker.js`** — profile selection modal
- **`src/animation/timeline-tracks.js`** — timeline + overlay track editor
- **`src/animation/templates.js`** — template definitions
- **`src/animation/preview.js`** — playback preview
- **`css/animation-editor.css`**, **`css/timeline.css`**, **`css/animation-page.css`**
