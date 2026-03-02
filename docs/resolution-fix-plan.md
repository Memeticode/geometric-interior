# Resolution Fix: Instanced Billboard Quads for Glow Dots

## Problem

Renders look visually different at different resolutions. The dominant cause is `GL_MAX_POINT_SIZE` clamping.

Glow dots use `THREE.Points` with `gl_PointSize`. The GPU hard-clamps this to **1024 pixels** (via ANGLE/WebGL). Hero dots need 3,000-30,000+ pixels depending on resolution and z-depth, so they *always* hit this ceiling. Since 1024px represents different screen fractions at different resolutions, the glow coverage changes dramatically:

| Resolution | Height | 1024px / height |
|---|---|---|
| Thumb | 180 | 5.7x |
| SD | 540 | **1.9x** (reference) |
| HD | 900 | 1.1x |
| FHD | 1080 | 0.95x |
| 4K | 2160 | 0.47x |

At SD, the clamped glow halos flood the screen with soft light. At 4K, the same dots cover 4x less relative area, producing a darker, sharper image. **The user likes the SD appearance.**

Bloom post-processing was tested (8 vs 10 vs 15 mip levels) and confirmed to have zero visual impact.

## Solution: Instanced Billboard Quads

Replace `THREE.Points` with `THREE.Mesh` using `InstancedBufferGeometry`. Each dot becomes a camera-facing quad (billboard) with vertices computed in view space. There is no `gl_PointSize` involved, so no GPU clamping.

To reproduce the SD appearance (which includes the 1024px clamp), the vertex shader explicitly clamps the equivalent reference-resolution pixel size, then converts to a view-space billboard extent. This makes the relative screen coverage identical at all resolutions.

### Key formula

```glsl
// What gl_PointSize would be at the SD reference resolution
float refPointSize = sz * 270.0 / -mvCenter.z;

// Explicit clamp (replaces GPU's implicit MAX_POINT_SIZE)
float clampedSize = min(refPointSize, 1024.0);

// View-space billboard extent (resolution-independent)
float billboardSize = clampedSize * 2.0 * (-mvCenter.z) / (540.0 * projectionMatrix[1][1]);
```

Verification: at any viewport height `H`, the projected pixel size of this billboard is `clampedSize * H / 540`, producing a relative coverage of `clampedSize / 540` — constant across resolutions.

---

## Files to Modify

| File | Change |
|---|---|
| `lib/engine/shaders/demo-glow.vert.glsl` | Rewrite: billboard vertex shader |
| `lib/engine/shaders/demo-glow.frag.glsl` | Minor: `vUv` replaces `gl_PointCoord` |
| `lib/engine/materials.ts` | Update uniforms (remove `uViewportHeight`) |
| `lib/engine/demo/build-scene.ts` | Create `InstancedBufferGeometry` + `Mesh` instead of `BufferGeometry` + `Points` |
| `lib/engine/demo/dot-matching.ts` | `buildMorphGlowGeometry` returns `InstancedBufferGeometry` |
| `lib/engine/create-renderer.ts` | Remove `updateGlowViewportHeight`; change `Points` refs to `Mesh`; remove uViewportHeight propagation from 5 call sites |
| `lib/types.ts` | Update `SceneRefs.glowPoints` type from `Points` to `Mesh` |

No changes needed to: dot generation (`dots.ts`), dot matching algorithm, morph controller, worker protocol, or any UI code.

---

## Detailed Changes

### 1. Vertex Shader (`lib/engine/shaders/demo-glow.vert.glsl`)

Complete replacement:

```glsl
// Per-vertex (base quad corners)
attribute vec2 aQuadOffset;   // (-0.5,-0.5), (0.5,-0.5), (0.5,0.5), (-0.5,0.5)

// Per-instance
attribute vec3 aCenter;
attribute float aSize;
attribute vec3 aCenterTo;
attribute float aSizeTo;
attribute float aMatchFlag;
attribute float aFadeDir;

uniform float uMorphT;
uniform float uTime;
uniform float uWobbleAmp;

varying float vFadeDir;
varying vec2 vUv;

// Reference resolution constants (SD = 540px height)
#define REF_HALF_HEIGHT 270.0
#define MAX_POINT_SIZE 1024.0
#define REF_HEIGHT 540.0

void main() {
    vFadeDir = aFadeDir;
    vUv = aQuadOffset + 0.5;  // [0,1] for texture sampling (replaces gl_PointCoord)

    // Morph position/size blending (same logic as before)
    vec3 pos = mix(aCenter, aCenterTo, uMorphT * aMatchFlag);
    float sz = mix(aSize, aSizeTo, uMorphT * aMatchFlag);
    if (aMatchFlag < 0.5) sz = aSize;

    // Per-dot wobble (unchanged)
    float phase = fract(sin(dot(aCenter.xy, vec2(12.9898, 78.233))) * 43758.5453);
    float wobbleX = sin(uTime * 0.8 + phase * 6.283) * 0.008 * uWobbleAmp;
    float wobbleY = cos(uTime * 0.6 + phase * 6.283 + 1.57) * 0.006 * uWobbleAmp;
    float wobbleZ = sin(uTime * 0.5 + phase * 6.283 + 3.14) * 0.005 * uWobbleAmp;
    pos += vec3(wobbleX, wobbleY, wobbleZ);

    // Size pulse (unchanged)
    float sizePulse = 1.0 + 0.03 * uWobbleAmp * sin(uTime * 1.2 + phase * 6.283);
    sz *= sizePulse;

    // Transform dot center to view space
    vec4 mvCenter = modelViewMatrix * vec4(pos, 1.0);

    // Reference-resolution pixel size with explicit clamp
    float refPointSize = sz * REF_HALF_HEIGHT / -mvCenter.z;
    float clampedSize = min(refPointSize, MAX_POINT_SIZE);

    // View-space billboard extent (resolution-independent)
    float billboardSize = clampedSize * 2.0 * (-mvCenter.z)
                        / (REF_HEIGHT * projectionMatrix[1][1]);

    // Offset quad corners in view space (camera-facing billboard)
    mvCenter.xy += aQuadOffset * billboardSize;

    gl_Position = projectionMatrix * mvCenter;
}
```

**Attribute rename rationale:** `position` → `aCenter` because `position` is now used for the base quad vertex positions (the quad corner offsets). Three.js's `InstancedBufferGeometry` distinguishes per-vertex attributes (regular `BufferAttribute`) from per-instance attributes (`InstancedBufferAttribute`).

> **Note on `aQuadOffset` vs `position`:** An alternative is to put the quad corner offsets in the `position` attribute and have `aCenter` as the instance attribute. The plan uses `aQuadOffset` for the per-vertex quad corners to avoid any confusion with Three.js's built-in handling of `position`. Either approach works with `ShaderMaterial`.

### 2. Fragment Shader (`lib/engine/shaders/demo-glow.frag.glsl`)

Minimal change — replace `gl_PointCoord` with `vUv`:

```glsl
uniform sampler2D uGlowMap;
uniform float uMorphFade;
uniform float uMorphT;
uniform float uTime;
uniform float uFoldProgress;
uniform float uWobbleAmp;

varying float vFadeDir;
varying vec2 vUv;

void main() {
    vec4 glow = texture2D(uGlowMap, vUv);   // was: gl_PointCoord
    float fade = uMorphFade;
    if (vFadeDir < -0.5) fade *= (1.0 - uMorphT);
    else if (vFadeDir > 0.5) fade *= uMorphT;

    fade *= uFoldProgress;

    float pulse = 1.0 + 0.05 * uWobbleAmp * sin(uTime * 1.885);
    gl_FragColor = glow * fade * pulse;
}
```

### 3. Materials (`lib/engine/materials.ts`)

Update `createDemoGlowMaterial`:

```typescript
export function createDemoGlowMaterial(glowTexture: THREE.Texture): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        uniforms: {
            uGlowMap: { value: glowTexture },
            uMorphFade: { value: 1.0 },
            uMorphT: { value: 0.0 },
            uTime: { value: 0.0 },
            uFoldProgress: { value: 1.0 },
            uWobbleAmp: { value: 1.0 },
            // uViewportHeight removed — no longer needed
        },
        vertexShader: demoGlowVertSrc,
        fragmentShader: demoGlowFragSrc,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
}
```

### 4. Static Glow Geometry (`lib/engine/demo/build-scene.ts`)

Replace the `BufferGeometry` + `Points` construction with `InstancedBufferGeometry` + `Mesh`:

```typescript
// Base quad (shared by all instances) — 4 vertices, 2 triangles
const QUAD_OFFSETS = new Float32Array([
    -0.5, -0.5,
     0.5, -0.5,
     0.5,  0.5,
    -0.5,  0.5,
]);
const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3]);

// ... inside the scene build function:

if (glowPointData.length > 0) {
    const count = glowPointData.length;
    const centers = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        centers[i * 3]     = glowPointData[i].position.x;
        centers[i * 3 + 1] = glowPointData[i].position.y;
        centers[i * 3 + 2] = glowPointData[i].position.z;
        sizes[i]           = glowPointData[i].size;
    }

    const glowGeom = new THREE.InstancedBufferGeometry();

    // Per-vertex: quad corner offsets
    glowGeom.setAttribute('aQuadOffset',
        new THREE.BufferAttribute(QUAD_OFFSETS, 2));
    glowGeom.setIndex(new THREE.BufferAttribute(QUAD_INDICES, 1));

    // Per-instance: dot data
    glowGeom.setAttribute('aCenter',
        new THREE.InstancedBufferAttribute(centers, 3));
    glowGeom.setAttribute('aSize',
        new THREE.InstancedBufferAttribute(sizes, 1));

    // Morph attributes (defaults for static rendering — shader handles aMatchFlag < 0.5)
    glowGeom.setAttribute('aCenterTo',
        new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3));
    glowGeom.setAttribute('aSizeTo',
        new THREE.InstancedBufferAttribute(new Float32Array(count), 1));
    glowGeom.setAttribute('aMatchFlag',
        new THREE.InstancedBufferAttribute(new Float32Array(count), 1));  // all 0
    glowGeom.setAttribute('aFadeDir',
        new THREE.InstancedBufferAttribute(new Float32Array(count), 1));  // all 0

    glowMat = createDemoGlowMaterial(glowTexture);
    glowPoints = new THREE.Mesh(glowGeom, glowMat);   // was THREE.Points
    glowPoints.frustumCulled = false;
    glowPoints.renderOrder = 0;
    scene.add(glowPoints);
}
```

**Note:** The default morph attributes (all zeros) are required because the vertex shader always reads them. `aMatchFlag = 0` triggers the `if (aMatchFlag < 0.5) sz = aSize;` branch, which is the correct static behavior.

### 5. Morph Glow Geometry (`lib/engine/demo/dot-matching.ts`)

Update `buildMorphGlowGeometry` to return `InstancedBufferGeometry`:

```typescript
export function buildMorphGlowGeometry(
    fromDots: GlowPointDatum[],
    toDots: GlowPointDatum[],
    matching: DotMatching,
): THREE.InstancedBufferGeometry {
    const total = matching.matched.length
                + matching.unmatchedFrom.length
                + matching.unmatchedTo.length;

    const center   = new Float32Array(total * 3);
    const centerTo = new Float32Array(total * 3);
    const size     = new Float32Array(total);
    const sizeTo   = new Float32Array(total);
    const matchFlag = new Float32Array(total);
    const fadeDir  = new Float32Array(total);

    let idx = 0;

    // Matched dots
    for (const { fromIdx, toIdx } of matching.matched) {
        const fp = fromDots[fromIdx].position;
        const tp = toDots[toIdx].position;
        center[idx * 3]     = fp.x;
        center[idx * 3 + 1] = fp.y;
        center[idx * 3 + 2] = fp.z;
        centerTo[idx * 3]     = tp.x;
        centerTo[idx * 3 + 1] = tp.y;
        centerTo[idx * 3 + 2] = tp.z;
        size[idx]     = fromDots[fromIdx].size;
        sizeTo[idx]   = toDots[toIdx].size;
        matchFlag[idx] = 1.0;
        fadeDir[idx]   = 0.0;
        idx++;
    }

    // Unmatched from-dots (dying)
    for (const fi of matching.unmatchedFrom) {
        const fp = fromDots[fi].position;
        center[idx * 3]     = fp.x;
        center[idx * 3 + 1] = fp.y;
        center[idx * 3 + 2] = fp.z;
        centerTo[idx * 3]     = fp.x;
        centerTo[idx * 3 + 1] = fp.y;
        centerTo[idx * 3 + 2] = fp.z;
        size[idx]     = fromDots[fi].size;
        sizeTo[idx]   = fromDots[fi].size;
        matchFlag[idx] = 0.0;
        fadeDir[idx]   = -1.0;
        idx++;
    }

    // Unmatched to-dots (spawning)
    for (const ti of matching.unmatchedTo) {
        const tp = toDots[ti].position;
        center[idx * 3]     = tp.x;
        center[idx * 3 + 1] = tp.y;
        center[idx * 3 + 2] = tp.z;
        centerTo[idx * 3]     = tp.x;
        centerTo[idx * 3 + 1] = tp.y;
        centerTo[idx * 3 + 2] = tp.z;
        size[idx]     = toDots[ti].size;
        sizeTo[idx]   = toDots[ti].size;
        matchFlag[idx] = 0.0;
        fadeDir[idx]   = 1.0;
        idx++;
    }

    // Base quad (same for all instances)
    const QUAD_OFFSETS = new Float32Array([
        -0.5, -0.5,  0.5, -0.5,  0.5, 0.5,  -0.5, 0.5,
    ]);
    const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3]);

    const geom = new THREE.InstancedBufferGeometry();
    geom.setAttribute('aQuadOffset',
        new THREE.BufferAttribute(QUAD_OFFSETS, 2));
    geom.setIndex(new THREE.BufferAttribute(QUAD_INDICES, 1));

    geom.setAttribute('aCenter',
        new THREE.InstancedBufferAttribute(center, 3));
    geom.setAttribute('aCenterTo',
        new THREE.InstancedBufferAttribute(centerTo, 3));
    geom.setAttribute('aSize',
        new THREE.InstancedBufferAttribute(size, 1));
    geom.setAttribute('aSizeTo',
        new THREE.InstancedBufferAttribute(sizeTo, 1));
    geom.setAttribute('aMatchFlag',
        new THREE.InstancedBufferAttribute(matchFlag, 1));
    geom.setAttribute('aFadeDir',
        new THREE.InstancedBufferAttribute(fadeDir, 1));

    return geom;
}
```

**Attribute renames:**
- `position` → `aCenter` (per-instance)
- `aPosTo` → `aCenterTo` (per-instance)
- New: `aQuadOffset` (per-vertex, the base quad)

### 6. Renderer (`lib/engine/create-renderer.ts`)

#### Remove `uViewportHeight` propagation

Delete the entire `updateGlowViewportHeight()` function and all 5 call sites:

- `resize()`: remove `updateGlowViewportHeight(height)`
- `syncSize()`: remove `updateGlowViewportHeight(displayH)`
- `setDPR()`: remove `updateGlowViewportHeight(_sizeVec.y)`
- `renderWith()`: remove the `uViewportHeight` assignment block
- `morphPrepare()`: remove the `uViewportHeight` assignments on refsA/refsB/morphGlowMat

#### Change `THREE.Points` → `THREE.Mesh`

In `morphPrepare()`, change:

```typescript
// Before
morphGlow = new THREE.Points(morphGlowGeom, morphGlowMat);

// After
morphGlow = new THREE.Mesh(morphGlowGeom, morphGlowMat);
```

Update the `morphState` type:

```typescript
let morphState: {
    // ...
    morphGlow: THREE.Mesh | null;      // was THREE.Points | null
    morphGlowMat: THREE.ShaderMaterial | null;
} | null = null;
```

### 7. Types (`lib/types.ts`)

Update `SceneRefs`:

```typescript
export interface SceneRefs {
    glowPoints: THREE.Mesh | null;  // was THREE.Points | null
    // ... rest unchanged
}
```

Or optionally rename to `glowMesh` for clarity (requires updating all references).

---

## Attribute Summary

### Per-vertex (base quad — shared)

| Attribute | Type | Values |
|---|---|---|
| `aQuadOffset` | vec2 | `(-0.5,-0.5), (0.5,-0.5), (0.5,0.5), (-0.5,0.5)` |
| index | uint16 | `[0,1,2, 0,2,3]` |

### Per-instance (one per dot)

| Attribute | Type | Static default | Morph |
|---|---|---|---|
| `aCenter` | vec3 | dot position | from-position |
| `aSize` | float | dot size | from-size |
| `aCenterTo` | vec3 | zeros | to-position |
| `aSizeTo` | float | zeros | to-size |
| `aMatchFlag` | float | 0.0 | 1.0 (matched) / 0.0 (unmatched) |
| `aFadeDir` | float | 0.0 | 0.0 / -1.0 (dying) / +1.0 (spawning) |

---

## Constants

Hardcoded in the vertex shader as `#define`:

| Constant | Value | Derivation |
|---|---|---|
| `REF_HALF_HEIGHT` | 270.0 | SD height (540) × 0.5 |
| `MAX_POINT_SIZE` | 1024.0 | `GL_ALIASED_POINT_SIZE_RANGE[1]` measured in ANGLE/WebGL |
| `REF_HEIGHT` | 540.0 | SD reference resolution height |

If future GPUs or browsers change `MAX_POINT_SIZE`, the constant can be updated or queried at init time and passed as a uniform.

---

## Verification Plan

### 1. Visual match at SD (regression test)

Render Meditation at 840×540 before and after. The images should be pixel-identical (or nearly so — minor floating-point differences acceptable).

### 2. Resolution independence

Render Meditation at all 6 resolution tiers. Compare relative glow coverage:

```
node workflows/update-cached-renders/render.mjs --profile="Meditation"
```

The glow halos should appear the same relative size across thumb, SD, HD, FHD, QHD, and 4K. All should match the current SD appearance.

### 3. Morph transitions

Start a morph between two profiles in the browser at different window sizes. Verify:
- Matched dots smoothly interpolate position and size
- Dying dots fade out
- Spawning dots fade in
- No visual discontinuities

### 4. DPR handling

Render at 540px CSS height with DPR=1 and DPR=2. Should look identical (billboard math doesn't depend on viewport height).

### 5. Fold animation

Verify that fold-in and fold-out still work (dots fade via `uFoldProgress`). The fold animation doesn't interact with sizing.

### 6. Performance

`InstancedBufferGeometry` with ~200-500 instances and a 4-vertex quad is extremely lightweight. Performance should be equal to or better than Points (fewer GPU state changes, no point sprite expansion). The typical dot count for Meditation is ~200-400, so this is 800-1600 vertices — trivial.

---

## Migration Checklist

1. [ ] Update vertex shader (`demo-glow.vert.glsl`)
2. [ ] Update fragment shader (`demo-glow.frag.glsl`)
3. [ ] Update material factory (`materials.ts`) — remove `uViewportHeight`
4. [ ] Update static geometry creation (`build-scene.ts`) — `InstancedBufferGeometry` + `Mesh`
5. [ ] Update morph geometry builder (`dot-matching.ts`) — `InstancedBufferGeometry`
6. [ ] Update renderer (`create-renderer.ts`):
   - Remove `updateGlowViewportHeight()` and all 5 call sites
   - Change `THREE.Points` → `THREE.Mesh` in `morphPrepare()`
   - Update `morphState` type
7. [ ] Update types (`types.ts`) — `SceneRefs.glowPoints` type
8. [ ] Render SD before/after comparison
9. [ ] Render all 6 resolution tiers and compare
10. [ ] Test morph transitions at multiple resolutions
11. [ ] Test fold animation
12. [ ] Run existing test suite (`tests/run-all.mjs`)
