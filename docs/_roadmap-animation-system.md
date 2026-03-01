# Roadmap: Animation Composition System

## Overview

A layered timeline system for composing generative art animations. Users build animations by sequencing **content events** (expand, pause, transition, collapse), overlaying **camera movements** (zoom, rotate, blur) that can span multiple events, and modulating **live animatable parameters** (twinkle, dynamism) over time. The system renders frame-by-frame to produce deterministic video output.

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
- First event must be `expand` (nothing → something) or could start mid-scene
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

    // Frame clock
    time: number;               // seconds (for deterministic shader animation)
}
```

### Camera Movement Properties

Camera moves are defined by absolute time ranges, independent of event boundaries:

- **Zoom**: Camera Z position multiplier. `from: { zoom: 1.0 }, to: { zoom: 0.7 }` = zoom in 30%.
- **Rotate**: Orbit around the scene center. `from: { orbitY: 0 }, to: { orbitY: 90 }` = quarter orbit.
- **Blur / Rack Focus**: Depth-of-field effect (Phase 6). Post-processing pass.

Multiple camera moves can be active simultaneously (e.g., slow zoom + gentle rotation). Their effects compose additively.

### Live Animatable Parameters

These modulate the existing scene in real-time via shader uniforms — no scene rebuild required:

- **Twinkle**: Glow dot oscillation and sparkle. Maps to existing `uWobbleAmp` (glow dot position/size wobble) and `uSparkleIntensity` (face sparkle flicker). Intensity 0 = static, 1 = full oscillation.
- **Dynamism**: Face surface animation. Maps to existing `uDriftSpeed` (face crack/dust pattern movement). Intensity 0 = frozen, 1 = full drift.

These build on the existing `sparkle`, `drift`, `wobble` system in the animation page but are exposed as timeline-automatable parameters with clearer naming.

## Architecture

### Frame Renderer (Deterministic)

The core rendering loop for video export is **time-driven, not RAF-driven**:

```
for each frame at time t:
  1. Evaluate content track → scene state (config, fold progress, morph t)
  2. Evaluate camera track → camera zoom, orbit angles
  3. Evaluate param track → twinkle intensity, dynamism intensity
  4. Push all state to renderer
  5. renderer.renderFrame()
  6. Capture pixels → frame buffer
```

Renderer methods:
- `setFoldImmediate(progress)` — exists, used by worker for expand/collapse
- `morphPrepare(seedA, controlsA, seedB, controlsB)` — exists, used by worker for transition start
- `morphUpdate(t)` — exists, used by worker for transition interpolation
- `morphEnd()` — exists, used by worker for transition cleanup
- `updateTime(seconds)` — exists, drives shader time uniforms deterministically
- `renderFrame()` — exists, renders one frame
- **Need**: `setCameraState(zoom, orbitY, orbitX)` — override camera position (Phase 3)
- **Need**: `setLiveParams({ twinkle, dynamism })` — set shader modulation values (Phase 4)

### Timeline Evaluator

Implemented as a pure function in `lib/core/timeline.ts`:

```typescript
evaluateTimeline(animation: Animation, timeSeconds: number): FrameState
```

Stateless — can seek to any frame without sequential playback. Trivially testable. The worker's `doGenerateAnimation` handler manages the stateful event boundary transitions (scene builds, morph prepare/end) based on changes in `eventIndex` between frames.

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

**Delivered:**
- `lib/core/easing.ts` — `applyEasing(t, easing)` with 4 CSS-style types, monotonic, clamped [0,1]
- `lib/core/timeline.ts` — Full data model types + pure `evaluateTimeline()` function
- `lib-tests/pure/test-timeline.mjs` — 29 tests covering easing, duration/frame helpers, expand/pause/collapse fold progression, camera moves, param tracks, edge cases
- `lib/types.ts` — re-exports all animation timeline types
- `lib/index.ts` — exports `evaluateTimeline`, `totalDuration`, `totalFrames`, `applyEasing` + all types

**Worker implementation:**
- `src/engine/render-worker.js` — `doGenerateAnimation` handler with event boundary state machine, frame-clock `updateTime()`, `ImageBitmap[]` capture via transferable postMessage, progress every 5 frames, cancellation support

**Test results:** 152 pure tests pass (29 new + 123 existing), 0 failures. TypeScript compiles cleanly.

---

### Phase 2: Transitions (Morph Between Configurations) ✅ COMPLETE

**Delivered (in same session as Phase 1):**
- Timeline evaluator handles `transition` events: provides `morphFromConfig`, `morphFromSeed`, `morphToConfig`, `morphToSeed`, `morphT` in FrameState
- Worker state machine detects event boundary changes: calls `renderWith()` for expand, `morphPrepare()`/`morphUpdate()`/`morphEnd()` for transitions
- Deterministic morph interpolation driven by eased `eventProgress` from the evaluator
- Full test coverage of transition morph state in `test-timeline.mjs`

---

### Phase 3: Camera System ✅ COMPLETE

**Delivered:**
- `setCameraState(zoom, orbitY, orbitX)` + `clearCameraState()` on renderer
- Internal `applyCameraOverride()` applies zoom (distance scaling), Y-orbit rotation, X-tilt rotation via rotation matrices, then `lookAt(0,0,0)`
- Wired into both `renderFrame()` (non-morph) and `morphUpdate()` (during morph) code paths
- Worker `doGenerateAnimation` reads `cameraZoom`, `cameraOrbitY`, `cameraOrbitX` from FrameState each frame
- `Renderer` interface in `lib/types.ts` extended with `setCameraState` and `clearCameraState`
- 8 new tests in `test-timeline.mjs`: zoom endpoints, orbit Y, simultaneous zoom+rotate composition, easing, event boundary spanning

**Test results:** 160 pure tests pass (37 timeline tests), 0 failures.

---

### Phase 4: Live Animatable Parameters ✅ COMPLETE

**Delivered (in same session as Phase 3):**
- `setLiveParams({ twinkle, dynamism })` on renderer
- Mapping: `twinkle` → sparkle + wobble shader uniforms, `dynamism` → drift shader uniform
- Values 0 = static, 1 = full animation intensity
- Worker `doGenerateAnimation` reads `twinkle`, `dynamism` from FrameState each frame
- `Renderer` interface in `lib/types.ts` extended with `setLiveParams`
- 6 new tests in `test-timeline.mjs`: twinkle endpoints, dynamism, easing, multiple simultaneous tracks, event boundary spanning

**Test results:** 160 pure tests pass (37 timeline tests), 0 failures. TypeScript compiles cleanly.

---

### Phase 5: Animation Render Queue + Storage
**Goal**: Integrate animation rendering with the process queue and persist results.

**Work:**
- Animation render jobs in the queue (alongside image generation jobs from `_prompt-generation-ux.md`)
- Progress reporting: frame-by-frame progress with ETA
- Video encoding: WebCodecs API (H.264/VP9) or fallback to frame sequence ZIP
- Store completed animations in IndexedDB (video blob + animation definition + thumbnail)
- Gallery integration: animation entries appear alongside image entries
- Cancellation support for long-running animation renders (worker cancel message already exists)

**Note**: This phase depends on the image generation queue infrastructure from `_prompt-generation-ux.md`. If that's not implemented yet, this phase should include the shared queue/storage layer.

**Check-in**: Can queue an animation render from code, see progress bar, get a playable video file when done. Can cancel mid-render. Results persist in IndexedDB and appear in gallery.

**Does NOT include**: UI for composing animations.

---

### Phase 6: Blur / Rack Focus + Additional Camera Effects
**Goal**: Depth-of-field and other post-processing camera effects.

**Work:**
- Depth-of-field post-processing pass (bokeh or gaussian) via the existing `postprocessing` library EffectComposer
- Rack focus: animate focal depth over time (new `CameraMove` type or extension to `CameraState`)
- Motion blur: accumulate sub-frames for smooth movement blur during fast camera moves
- Integration with camera track evaluation
- Add `blur` type to `CameraMove` and `focalDepth`/`blurAmount` to `CameraState`

**Check-in**: Can render an animation where focus shifts between foreground geometry and background, with natural bokeh blur on out-of-focus elements.

**Does NOT include**: UI for composing animations.

---

### Phase 7: Animation Composition UI
**Goal**: User-facing interface for building animations.

**Work:**
- Timeline visualization (horizontal track with event blocks)
- Event sequencing: add/remove/reorder events
- Per-event configuration: duration slider, easing picker, config selector (from saved profiles or custom)
- Camera track editor: visual spans overlaid on timeline
- Live param track editor: similar visual spans
- Preview playback: low-res real-time preview of the animation
- "Render" button dispatches to the queue

**Note**: This is the largest phase and could be split further. The timeline visualization alone is a significant UI component. Consider whether a simplified "wizard" flow (step-by-step event configuration) might be a better first UI than a full timeline editor.

**Check-in**: User can compose a multi-event animation with camera movements in the UI, preview it, and render to video.

---

## Cross-Cutting Concerns

### Determinism
Every aspect of animation rendering must be deterministic. Same animation definition + same renderer = identical frame output every time. This means:
- No `Date.now()` or `performance.now()` in the render path — only the frame clock
- Shader `time` uniforms driven by frame number × (1/fps), not wall time (implemented via `updateTime()`)
- PRNG streams seeded from animation definition, not random
- Live param modulation (twinkle sine waves) use frame-clock time

### Morph State Management
The worker's `doGenerateAnimation` handler manages scene state transitions at event boundaries:
- At `expand` start: `renderWith(seed, controls)` builds scene
- At `transition` start: `morphPrepare(seedA, controlsA, seedB, controlsB)` builds both scenes
- During `transition`: `morphUpdate(t)` interpolates (t from evaluator, easing already applied)
- At `transition` end: `morphEnd()` disposes source scene
- At `collapse` end: scene remains (fold animates to 0)

This is a state machine driven by `eventIndex` changes between frames.

### Memory and Performance
- Animation rendering is CPU/GPU bound, not I/O bound
- For a 30-second animation at 30fps = 900 frames
- Each frame: evaluate timeline (instant) + render (10-50ms) + capture (5-20ms)
- Total render time: ~15-60 seconds for a 30-second animation
- Current implementation returns `ImageBitmap[]` — for long animations, incremental video encoding (Phase 5) will be needed to avoid holding all frames in memory

### Easing Functions
Implemented in `lib/core/easing.ts`. Standard CSS-style cubic bezier curves:
- `linear` — constant speed
- `ease-in` — cubic-bezier(0.42, 0, 1, 1)
- `ease-out` — cubic-bezier(0, 0, 0.58, 1)
- `ease-in-out` — cubic-bezier(0.42, 0, 0.58, 1)

All monotonic, clamped to [0, 1].

## Key Files

### Implemented:
- **`lib/core/easing.ts`** — `applyEasing(t, easing)`, 4 easing types
- **`lib/core/timeline.ts`** — Animation data model types + `evaluateTimeline()` + `totalDuration()` + `totalFrames()`
- **`lib/core/seed-tags.ts`** — Compositional seed system: `SeedTag`, `parseSeed()`, `createTagStreams()`, `seedTagToLabel()`, word lists with Spanish translations
- **`lib/types.ts`** — Re-exports animation types
- **`lib/index.ts`** — Public API exports
- **`src/engine/render-worker.js`** — `doGenerateAnimation` handler with state machine, progress, cancellation
- **`lib-tests/pure/test-timeline.mjs`** — 37 tests (easing, duration/frames, expand/pause/collapse, transitions, camera moves, param tracks)
- **`lib/engine/create-renderer.ts`** — `setCameraState()`, `clearCameraState()`, `setLiveParams()`, `applyCameraOverride()` internal helper
- **`lib/types.ts`** — Renderer interface includes `setCameraState`, `clearCameraState`, `setLiveParams`

### To be modified (future phases):
- **Shaders** — twinkle glow-alpha modulation (optional enhancement)

### Reference:
- **`scripts/gen-fold-anims.mjs`** — existing fold sprite frame capture approach
- **`src/export/export.js`** — existing video/frame packaging
- **`src/animation/anim-main.js`** — existing sparkle/drift/wobble UI
- **`public/md/en/parameters-content.md`** — parameter documentation including camera + animation params
