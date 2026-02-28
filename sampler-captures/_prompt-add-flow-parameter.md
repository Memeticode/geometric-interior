# Prompt: Add the Flow Parameter (11th Axis)

## Context

The parameter reimagining is complete — 10 of 11 parameters are implemented. The missing piece is the **flow** parameter, which controls the *spatial pattern* of the directional field that organizes chain orientations.

Currently, coherence controls *how strongly* chains align to a Perlin noise flow field. But the flow field itself is always the same noise function. The flow parameter makes the field pattern itself variable: radial starburst → noise (current) → orbital bands.

**flow** and **coherence** form an independent pair:
- **coherence** = how strongly elements follow the flow (alignment strength)
- **flow** = what spatial pattern they're aligning TO (field shape)

## What to Implement

### 1. Add `flow` to Controls (`lib/types.ts`)

Add `flow: number;` to the Controls interface alongside the other axes:

```typescript
export interface Controls {
    topology: 'flow-field';
    hue: number;
    spectrum: number;
    chroma: number;
    density: number;
    fracture: number;
    coherence: number;
    luminosity: number;
    flow: number;         // 0-1: flow pattern (radial → noise → orbital)
    scale: number;
    division: number;
    faceting: number;
}
```

### 2. Add `compositeFlowField` to `lib/engine/demo/flow-field.ts`

Add this function alongside the existing `flowFieldNormal` (keep that function — it's used internally by the composite):

```typescript
const Y_AXIS = new Vector3(0, 1, 0);

/**
 * Composite flow field blending radial → noise → orbital based on flowType.
 * flowType=0.0: radial (divergent — chains emanate outward from origin)
 * flowType=0.5: noise (current Perlin noise behavior)
 * flowType=1.0: orbital (convergent — chains wrap tangentially around Y axis)
 */
export function compositeFlowField(pos: Vector3, noiseScale: number, flowType: number): Vector3 {
    // Radial: points outward from origin
    const radial = pos.clone().normalize();

    // Noise: current hash-based Perlin noise
    const noise = flowFieldNormal(pos, noiseScale);

    // Orbital: tangent to circles around Y axis = cross(Y, pos)
    const orbital = new Vector3().crossVectors(Y_AXIS, pos);
    if (orbital.lengthSq() < 0.001) {
        // Degenerate case: pos is on Y axis. Use arbitrary tangent.
        orbital.set(1, 0, 0);
    }
    orbital.normalize();

    // Piecewise blend
    if (flowType <= 0.5) {
        const t = flowType * 2;  // [0, 0.5] → [0, 1]
        return radial.lerp(noise, t).normalize();
    } else {
        const t = (flowType - 0.5) * 2;  // [0.5, 1] → [0, 1]
        return noise.lerp(orbital, t).normalize();
    }
}
```

### 3. Pass `flowType` through `deriveParams` (`lib/core/params.ts`)

Add `flowType: c.flow` to the return object (pass through directly, the composite function consumes it):

```typescript
// In the return object, add:
flowType: c.flow,
```

Also add `flowType: number` to the `DerivedParams` interface in `lib/types.ts`.

### 4. Use `compositeFlowField` in `lib/engine/demo/build-scene.ts`

Replace the import:
```typescript
// Was:
import { flowFieldNormal, colorFieldHue } from './flow-field.js';
// Now:
import { compositeFlowField, colorFieldHue } from './flow-field.js';
```

Replace ALL calls to `flowFieldNormal(pos, params.flowScale)` with `compositeFlowField(pos, params.flowScale, params.flowType)`. There are two groups of call sites:

**a) Atmospheric scatter chains** (~line 163):
```typescript
// Was: const flowNorm = flowFieldNormal(pos, params.flowScale);
const flowNorm = compositeFlowField(pos, params.flowScale, params.flowType);
```

**b) Curve-based chain flow influence** (~lines 123-128, 140-143):
```typescript
// Was: const flow = flowFieldNormal(sample.pos, params.flowScale);
const flow = compositeFlowField(sample.pos, params.flowScale, params.flowType);
```

### 5. Update defaults and UI

**Default value**: `flow: 0.5` (noise — preserves current behavior at midpoint).

**`src/main.js`**: Add flow to DEFAULT_CONTROLS and slider setup.

**`sampler.html`**: Add 'flow' to the AXES array and DEFAULTS object.

**Test fixtures**: Add `flow: 0.5` to any test control objects.

### 6. Morph interpolation

Flow is a standard 0-1 numeric axis — it lerps normally like all other parameters. No circular interpolation needed (unlike hue).

## Verification

After implementation:

1. **Default render** (flow=0.5): Should look identical to current output (noise is the midpoint)
2. **Flow=0 + coherence=1**: Radial starburst — chains emanate outward from core
3. **Flow=1 + coherence=1**: Orbital bands — chains wrap around the form
4. **Flow=0 + coherence=0**: Random — indistinguishable from flow=0.5 + coherence=0 (low coherence means flow doesn't matter)
5. **Flow sweep** at coherence=0.8, ghost params (d=0.14, f=0.86): Most dramatic visual range
6. **TypeScript compiles**: `npx tsc --noEmit` — clean

## Scope

This is a small, focused change:
- `lib/types.ts` — add `flow` to Controls, `flowType` to DerivedParams
- `lib/engine/demo/flow-field.ts` — add `compositeFlowField` function (~25 lines)
- `lib/core/params.ts` — add `flowType: c.flow` to return
- `lib/engine/demo/build-scene.ts` — change import + replace 2-3 call sites
- `src/main.js` — add flow to defaults/sliders
- `sampler.html` — add flow to AXES/DEFAULTS
- Test fixtures — add `flow: 0.5`

The existing `flowFieldNormal` function stays unchanged. The `colorFieldHue` function stays unchanged (it uses its own scale, already coupled via `colorFieldScale`).
