# Prompt: Reimagine the Parameter System

## Overview

Replace the current 5-slider + palette-dropdown system with a unified 11-dimensional continuous parameter space. Every parameter is a 0–1 scaling axis. The discrete palette selector is eliminated — color becomes integral to the continuous space. New geometric dimensions (division, scale, faceting) are added. The flow field pattern becomes parameterizable. Depth is removed (it's a camera/composition control, not core geometry).

The goal is a system where every parameter is conceptually distinct, thematically aligned with the project's core themes (luminous geometric forms emerging from darkness, order/chaos tension, scale hierarchy, symmetry breaking), and where the entire space is smoothly navigable and morphable.

## The 11 Parameters

All parameters are 0–1 continuous scaling axes.

### Existing (4 retained, unchanged conceptually)

| # | Name | Theme | What it controls |
|---|------|-------|-----------------|
| 1 | **density** | Abundance | Element counts across all tiers |
| 2 | **fracture** | Fragmentation | Geometric scatter, spread, envelope radii, chromatic aberration |
| 3 | **coherence** | Organization | Flow field alignment strength, color patch coherence. How strongly elements obey the flow pattern. |
| 4 | **luminosity** | Energy | Brightness, glow intensity, bloom strength |

### New color parameters (3, replace palette dropdown)

| # | Name | Theme | What it controls | Internal mapping |
|---|------|-------|-----------------|-----------------|
| 5 | **hue** | Color identity | Dominant wavelength of emitted light | `baseHue = hue * 360` (degrees) |
| 6 | **spectrum** | Color range | Width of hue variation (monochrome → prismatic) | `hueRange = 10 + 350 * spectrum²` (quadratic for perceptual evenness) |
| 7 | **chroma** | Color intensity | Saturation + fog tinting. "How much color identity does the light have?" | `saturation = cl(chroma, 0.05, 0.65, 1.0)` |

### New spatial parameter (1)

| # | Name | Theme | What it controls |
|---|------|-------|-----------------|
| 8 | **flow** | Spatial pattern | The shape of the directional field that organizes chain orientations. Radial (divergent starburst) → Noise (entropic, current default) → Orbital (convergent bands/rings). |

**flow** and **coherence** form an independent pair:
- **coherence** = *how strongly* elements follow the flow (strength of alignment)
- **flow** = *what spatial pattern* they're aligning TO (shape of the current)

At low coherence, flow is irrelevant — chains orient randomly regardless of the field. At high coherence, flow dramatically changes the spatial structure:
- coherence=1 + flow=0: radiant starburst (chains radiate outward from core)
- coherence=1 + flow=0.5: noise-organized (current max-coherence look)
- coherence=1 + flow=1: orbital bands (chains wrap around the form like rings)

**Implementation**: Blend three vector fields based on the flow parameter:

```
radialField(pos)  = normalize(pos)                      // divergent: points outward from origin
noiseField(pos)   = flowFieldNormal(pos, flowScale)     // current Perlin noise
orbitalField(pos) = normalize(cross(Y_axis, pos))       // convergent: tangent to circles around Y
```

Blending: `flow ∈ [0, 0.5]` lerps radial→noise, `flow ∈ [0.5, 1]` lerps noise→orbital. Handle the degenerate case where pos is aligned with Y-axis (orbital becomes undefined) by falling back to a fixed tangent direction.

This replaces `flowFieldNormal()` with a `compositeFlowField(pos, noiseScale, flowType)` function in `flow-field.ts`.

### New geometric parameters (3)

| # | Name | Theme | What it controls |
|---|------|-------|-----------------|
| 9 | **scale** | Granularity | Size distribution — few large monumental forms vs many small atmospheric particles. Shifts weight between primary/secondary/tertiary tiers without changing total element count. |
| 10 | **division** | Topology | Envelope symmetry breaking — 1 lobe (unified) → 2 lobes (bifurcated, current default) → 3 lobes (trifurcated). Controls groove depth and count. |
| 11 | **faceting** | Crystal character | Individual shard geometry — broad flat panels vs sharp angular shards. Controls quad/tri ratio, dihedral fold angle, and fold tightness. |

### Removed

- **depth** — camera/composition control, not core geometry. Remove from Controls entirely.
- **palette** (PaletteKey) — replaced by hue/spectrum/chroma. The discrete selector is gone.

## Existing Presets as Coordinates

Every former palette maps to a point in the (hue, spectrum, chroma) subspace. These become named presets that set ALL 11 parameters (color + geometry defaults):

```
violet-depth:      hue=0.783  spectrum=0.24  chroma=0.53   (+ all geometric/spatial defaults at 0.5)
warm-spectrum:     hue=0.061  spectrum=0.22  chroma=0.97
teal-volumetric:   hue=0.514  spectrum=0.21  chroma=0.58
sapphire:          hue=0.625  spectrum=0.24  chroma=0.89
amethyst:          hue=0.867  spectrum=0.27  chroma=0.53
crystal-lattice:   hue=0.586  spectrum=0.0   chroma=0.0
prismatic:         hue=0.5    spectrum=1.0   chroma=1.0
```

Notes on the hue mapping: `hue * 360` gives degrees. So hue=0.783 → 282° (violet), hue=0.061 → 22° (warm amber), etc.

Notes on the spectrum mapping: `10 + 350 * spectrum²`. So spectrum=0.24 → 10+350*0.058 = 30° (matches violet-depth's hueRange=30). spectrum=1.0 → 360° (prismatic). The quadratic curve means most slider travel covers the useful 10–100° range.

**Verification**: Plug these coordinates back through the derivation and confirm the output matches the original palette's visual character. The exact fog/bg RGB values may differ slightly from the hand-tuned originals (see fog derivation below), but the visual effect should be equivalent.

## Implementation

### File: `lib/types.ts`

Replace the Controls interface:

```typescript
export interface Controls {
    topology: 'flow-field';
    // Geometric form
    density: number;      // 0-1: element count / population
    fracture: number;     // 0-1: scatter / fragmentation
    coherence: number;    // 0-1: flow alignment strength
    // Light
    luminosity: number;   // 0-1: brightness / energy
    // Color
    hue: number;          // 0-1: dominant hue (maps to 0-360°)
    spectrum: number;     // 0-1: hue range (monochrome → prismatic)
    chroma: number;       // 0-1: color intensity (gray → vivid)
    // Spatial
    flow: number;         // 0-1: flow pattern (radial → noise → orbital)
    // Geometric dimensions
    scale: number;        // 0-1: size distribution (monumental → atmospheric)
    division: number;     // 0-1: form topology (1 lobe → 2 → 3)
    faceting: number;     // 0-1: shard character (broad/flat → sharp/angular)
}
```

Remove `PaletteKey` from Controls. Keep the PaletteKey type for preset identification, but it's no longer part of the runtime control interface.

Add to DerivedParams any new fields needed (faceting params, division params, scale weights, etc.).

### File: `lib/core/params.ts` — deriveParams() rewrite

This is the heart of the change. The function signature stays the same but the internals change substantially.

**Color derivation** (replaces getPalette() call):

```typescript
const baseHue = c.hue * 360;
const hueRange = 10 + 350 * c.spectrum * c.spectrum;
const saturation = cl(c.chroma, 0.05, 0.65, 1.0);
const lumScale = cl(c.luminosity, 0.65, 1.0, 1.5);

// Fog/bg/edge derived from hue + chroma + luminosity
// Key: fogColor and bgColor MUST be near-black (0.001–0.006 range)
// The derivation uses very low lightness values to stay in this range
const fogSaturation = 0.3 * Math.max(saturation, 0.15);
const fogLightness = 0.004 * lumScale;
const bgLightness = 0.002 * lumScale;
const fogColor = hslToRgb01(baseHue, fogSaturation, fogLightness);
const bgColor = hslToRgb01(baseHue, fogSaturation * 0.6, bgLightness);
const bgInnerColor = [fogColor[0], fogColor[1], fogColor[2]];
const bgOuterColor = [0, 0, 0];
const edgeColor = hslToRgb01(baseHue, saturation * 0.7, 0.75);
```

NOTE: The `hslToRgb01` function already exists in `palettes.ts`. Import it, or move it to a shared utility. The key constraint is that fogColor/bgColor values stay in the 0.001–0.006 range — verify this for all hue/chroma/luminosity combinations. If any combination produces values outside this range, clamp.

**Scale derivation** (tier weight redistribution):

```typescript
// Scale shifts weight between tiers: 0 = monumental (few large), 1 = atmospheric (many small)
const primaryScale = cl(c.scale, 1.4, 1.0, 0.4);
const secondaryScale = cl(c.scale, 1.15, 1.0, 0.85);
const tertiaryScale = cl(c.scale, 0.6, 1.0, 1.8);

// Apply to chain config (multiply chainLenBase, scaleBase)
// In the chains object:
chains.primary.chainLenBase = Math.round(cl(c.density, 5, 8, 11) * primaryScale);
chains.primary.scaleBase = 0.95 * cl(c.scale, 1.2, 1.0, 0.7);
// ... similar for secondary, tertiary

// Apply to dot config
dotConfig.heroDotCount = Math.round(cl(c.density, 3, 5, 9) * primaryScale);
dotConfig.microDotCount = Math.round(cl(c.density, 70, 220, 800) * tertiaryScale);
// ... similar for medium, small, interior

// Apply to atmospheric chains
const atmosphericCount = Math.round(cl(c.density, 4, 8, 14) * tertiaryScale);
```

The goal: at scale=0.5 (midpoint), the output is identical to the current system. At scale=0 (monumental), primary elements dominate. At scale=1 (atmospheric), tertiary/micro elements dominate. Total element count stays roughly similar (density controls that).

**Division derivation**:

```typescript
// Division is passed through to DerivedParams for envelope.ts to consume
const divisionParams = {
    primaryGrooveDepth: cl(c.division, 0.0, 0.2, 0.35),
    primaryGrooveWidth: cl(c.division, 0.25, 0.18, 0.14),
    secondaryGrooveDepth: cl(c.division, 0.0, 0.0, 0.25),  // only appears in upper half of range
    secondaryGrooveAngle: 2.094,  // 120° in radians (for trifurcation)
    noiseAmplitude: cl(c.division, 0.03, 0.06, 0.09),
};
```

At division=0: no groove (single lobe), minimal noise. At division=0.5: current dual-lobe. At division=1.0: deep primary groove + secondary groove at 120° creating trifurcation, more noise for organic separation.

**Faceting derivation**:

```typescript
const facetingParams = {
    quadProbability: cl(c.faceting, 0.90, 0.70, 0.30),   // low faceting = broad quads
    dihedralBase: cl(c.faceting, 0.01, 0.02, 0.05),      // fold angle base (radians)
    dihedralRange: cl(c.faceting, 0.03, 0.08, 0.14),     // fold angle variation
    contractionBase: cl(c.faceting, 0.96, 0.92, 0.86),   // scale-down per link
    contractionRange: cl(c.faceting, 0.05, 0.12, 0.18),  // contraction variation
};
```

At faceting=0: mostly quads, gentle folds, minimal contraction → broad flat panels.
At faceting=0.5: current mix (70% quads, moderate dihedral).
At faceting=1: mostly tris, aggressive folds, strong contraction → tight angular spirals.

**Flow derivation**:

```typescript
// Flow type: 0 = radial, 0.5 = noise, 1.0 = orbital
// Passed through to DerivedParams for flow-field.ts to consume
const flowType = c.flow;
```

**Color field coupling** (link to flow field for coherence→color):

```typescript
// Coherence drives both geometric alignment AND chromatic coherence
const colorFieldScale = flowScale * 0.8;
// This value is passed to build-scene, which passes it to colorFieldHue()
```

At coherence=0.5: flowScale=1.5, colorFieldScale=1.2 (matches current hardcoded value — backward compatible).
At coherence=1.0: flowScale=0.5, colorFieldScale=0.4 → large coherent color patches.
At coherence=0.0: flowScale=5.0, colorFieldScale=4.0 → per-element color chaos.

**Remove depth**: Delete all depth-derived values (cameraZ, cameraFov, vignetteStrength). Use fixed sensible defaults:

```typescript
const cameraZ = 3.5;
const cameraFov = 50;
const vignetteStrength = 0.50;
```

These were the midpoint (depth=0.5) values. If depth is re-added later as a camera control, these become overridable.

### File: `lib/engine/demo/envelope.ts`

Modify `envelopeSDF` to accept division parameters instead of using hardcoded groove values.

Current (hardcoded):
```typescript
const grooveDepth = 0.2;
const grooveWidth = 0.18;
const topBias = Math.max(0, p.y / radii.y);
const groove = grooveDepth * Math.exp(-p.x * p.x / (grooveWidth * grooveWidth)) * topBias;
const n = Math.sin(p.x * 1.1 + 7.3) * Math.sin(p.y * 1.3 + 2.1) * Math.sin(p.z * 0.9 + 5.7);
return ellipsoid + groove + n * 0.06;
```

New (parameterized):
```typescript
// Primary groove (current style, along x-axis)
const topBias = Math.max(0, p.y / radii.y);
const primaryGroove = divParams.primaryGrooveDepth
    * Math.exp(-p.x * p.x / (divParams.primaryGrooveWidth * divParams.primaryGrooveWidth))
    * topBias;

// Secondary groove (for trifurcation, rotated 120° around Y)
let secondaryGroove = 0;
if (divParams.secondaryGrooveDepth > 0.001) {
    const angle = divParams.secondaryGrooveAngle;  // 2.094 rad = 120°
    const cos_a = Math.cos(angle);
    const sin_a = Math.sin(angle);
    const rx = p.x * cos_a + p.z * sin_a;  // rotated x coordinate
    secondaryGroove = divParams.secondaryGrooveDepth
        * Math.exp(-rx * rx / (divParams.primaryGrooveWidth * divParams.primaryGrooveWidth))
        * topBias;
}

const n = Math.sin(p.x * 1.1 + 7.3) * Math.sin(p.y * 1.3 + 2.1) * Math.sin(p.z * 0.9 + 5.7);
return ellipsoid + primaryGroove + secondaryGroove + n * divParams.noiseAmplitude;
```

The function signature needs to change to accept the division parameters. Either:
- Pass the full DerivedParams (or a subset) to envelopeSDF
- Or pass individual values

I'd recommend passing a `DivisionParams` object alongside the existing `radii` parameter.

**Critical**: The `envelopeSDF` function is called from `build-scene.ts` and from `guide-curves.ts`. All call sites need to be updated to pass the division params.

### File: `lib/engine/demo/folding-chains.ts`

Modify the chain generation to accept faceting parameters.

Current (hardcoded, at line 377):
```typescript
const makeQuad = rng() < 0.7;
```

New:
```typescript
const makeQuad = rng() < facetingParams.quadProbability;
```

Current (hardcoded, at line 441):
```typescript
const dihedral = (0.02 + rng() * 0.08) * (rng() < 0.5 ? 1 : -1);
```

New:
```typescript
const dihedral = (facetingParams.dihedralBase + rng() * facetingParams.dihedralRange) * (rng() < 0.5 ? 1 : -1);
```

Current (hardcoded, at line 446):
```typescript
const scaleFactor = 0.92 + rng() * 0.12;
```

New:
```typescript
const scaleFactor = facetingParams.contractionBase + rng() * facetingParams.contractionRange;
```

The faceting params need to be threaded through the call chain: `build-scene.ts` → `createFoldingChain()`.

### File: `lib/engine/demo/flow-field.ts`

Add a composite flow field function that blends between radial, noise, and orbital fields:

```typescript
import { Vector3 } from 'three';

// Existing flowFieldNormal and colorFieldHue stay as-is (noise is one of the three fields).

const Y_AXIS = new Vector3(0, 1, 0);

/**
 * Composite flow field: blends radial → noise → orbital based on flowType.
 * flowType=0: radial (divergent starburst from origin)
 * flowType=0.5: noise (current Perlin-noise field)
 * flowType=1: orbital (tangent to circles around Y axis)
 */
export function compositeFlowField(pos: Vector3, noiseScale: number, flowType: number): Vector3 {
    // Radial: points outward from origin
    const radial = pos.clone().normalize();

    // Noise: current hash-based Perlin noise
    const noise = flowFieldNormal(pos, noiseScale);

    // Orbital: tangent to circles around Y axis = cross(Y, pos)
    const orbital = new Vector3().crossVectors(Y_AXIS, pos);
    if (orbital.lengthSq() < 0.001) {
        // Degenerate case: pos aligned with Y axis. Use arbitrary tangent.
        orbital.set(1, 0, 0);
    }
    orbital.normalize();

    // Blend
    if (flowType <= 0.5) {
        // 0.0 → 0.5: radial → noise
        const t = flowType * 2;  // maps [0, 0.5] → [0, 1]
        return radial.lerp(noise, t).normalize();
    } else {
        // 0.5 → 1.0: noise → orbital
        const t = (flowType - 0.5) * 2;  // maps [0.5, 1] → [0, 1]
        return noise.lerp(orbital, t).normalize();
    }
}
```

Then in `build-scene.ts`, replace all calls to `flowFieldNormal(pos, params.flowScale)` with `compositeFlowField(pos, params.flowScale, params.flowType)`.

### File: `lib/engine/demo/build-scene.ts`

Several changes:

1. **Use composite flow field**: Replace `flowFieldNormal(pos, params.flowScale)` with `compositeFlowField(pos, params.flowScale, params.flowType)` everywhere it appears — both for atmospheric scatter chains and for the curve-based chain flow influence.

2. **Color field coupling**: Replace hardcoded color field scale with `params.colorFieldScale`:

```typescript
// Where colorFieldHue is called (search for "colorFieldHue"):
// Was: colorFieldHue(pos, 1.2, params.baseHue, params.hueRange)
// Now:
colorFieldHue(pos, params.colorFieldScale, params.baseHue, params.hueRange)
```

3. **Pass division params to envelope/guide-curves**: The envelopeSDF call sites need the division parameters.

4. **Pass faceting params to createFoldingChain**: Thread through all call sites.

5. **Scale is already handled in params.ts** (the tier counts and sizes are adjusted there), so build-scene.ts doesn't need scale-specific changes — it just consumes the already-adjusted params.

### File: `lib/core/palettes.ts`

Add preset coordinate mappings. The existing PALETTES object can remain for reference/backward-compat, but add:

```typescript
export interface PresetCoordinates {
    hue: number;
    spectrum: number;
    chroma: number;
    // Spatial and geometric params can optionally be included for "full scene" presets
    flow?: number;
    density?: number;
    fracture?: number;
    coherence?: number;
    luminosity?: number;
    scale?: number;
    division?: number;
    faceting?: number;
}

export const PRESETS: Record<string, PresetCoordinates> = {
    'violet-depth':    { hue: 0.783, spectrum: 0.24, chroma: 0.53 },
    'warm-spectrum':   { hue: 0.061, spectrum: 0.22, chroma: 0.97 },
    'teal-volumetric': { hue: 0.514, spectrum: 0.21, chroma: 0.58 },
    'sapphire':        { hue: 0.625, spectrum: 0.24, chroma: 0.89 },
    'amethyst':        { hue: 0.867, spectrum: 0.27, chroma: 0.53 },
    'crystal-lattice': { hue: 0.586, spectrum: 0.0,  chroma: 0.0  },
    'prismatic':       { hue: 0.5,   spectrum: 1.0,  chroma: 1.0  },
};
```

Move `hslToRgb01` to an exported utility (it's currently module-private). It's needed by params.ts for fog/bg derivation.

### File: `src/engine/render-worker.js`

Update to use new Controls format:
- Remove palette key handling from `renderWith`
- Remove palette key handling from `morph-prepare` / `morph-update`
- All 11 parameters are numeric → morph interpolation is just `lerp` for all of them
- **Hue wrap-around**: When morphing hue, use circular interpolation (shortest arc on the 0–1 circle). If `|hueA - hueB| > 0.5`, wrap. Example: morphing from hue=0.95 to hue=0.05 should go 0.95→1.0→0.05, not 0.95→0.5→0.05.

### File: `src/main.js`

- Update control initialization to use new parameter names
- Replace palette dropdown with placeholder (the full UI redesign is a separate task)
- For now, can use simple sliders for hue/spectrum/chroma
- Remove depth slider
- Add sliders for scale, division, faceting

### File: `sampler.html`

Update to use new Controls format for testing. The axis dropdowns should include all 10 parameters. This is the primary verification tool — render grids across the new dimensions.

### File: `src/core/params.js` and `src/core/palettes.js` (if these exist as JS mirrors of lib/)

Mirror the changes from the lib/ TypeScript files. Check if these are separate implementations or if they import from lib/.

## Backward Compatibility

### Profile migration

Old profiles have `{ palette: "violet-depth", depth: 0.5, density: 0.5, ... }`. Detect and convert:

```typescript
function migrateControls(old: any): Controls {
    if ('palette' in old) {
        const preset = PRESETS[old.palette] || PRESETS['violet-depth'];
        return {
            topology: 'flow-field',
            density: old.density ?? 0.5,
            fracture: old.fracture ?? 0.5,
            coherence: old.coherence ?? 0.5,
            luminosity: old.luminosity ?? 0.5,
            hue: preset.hue,
            spectrum: preset.spectrum,
            chroma: preset.chroma,
            flow: 0.5,
            scale: 0.5,
            division: 0.5,
            faceting: 0.5,
        };
    }
    return old as Controls;
}
```

### Default controls

The default state should produce output visually similar to the current violet-depth midpoint:

```typescript
const DEFAULT_CONTROLS: Controls = {
    topology: 'flow-field',
    density: 0.5,
    fracture: 0.5,
    coherence: 0.5,
    luminosity: 0.5,
    hue: 0.783,       // 282° (violet)
    spectrum: 0.24,    // hueRange ≈ 30
    chroma: 0.53,      // saturation ≈ 0.55
    flow: 0.5,         // noise (current default behavior)
    scale: 0.5,        // balanced tier distribution
    division: 0.5,     // dual-lobe (current default)
    faceting: 0.5,     // current shard character
};
```

## Constraints & Priorities

### Must preserve
- At default controls (all 0.5, violet hue), output should look very similar to current violet-depth midpoint
- fogColor/bgColor must stay in 0.001–0.006 range for ALL parameter combinations (verify and clamp if needed)
- Morph interpolation must be smooth across all 10 axes (circular interpolation for hue)
- All non-color derivations for density/fracture/coherence/luminosity remain unchanged at their midpoints

### Implementation priority
1. **Critical**: New Controls type + deriveParams color derivation (hue/spectrum/chroma). This replaces the palette system and is needed for everything else.
2. **Critical**: Flow parameter — compositeFlowField in flow-field.ts + usage in build-scene.ts. New spatial dimension.
3. **Critical**: Division parameter in envelope.ts. Creates the 1/2/3 lobe topology.
4. **Important**: Scale parameter (tier weighting). Enables monumental↔atmospheric exploration.
5. **Important**: Color field coupling (colorFieldScale from flowScale). One-line change with big impact.
6. **Important**: Faceting parameter in folding-chains.ts. Changes shard character.
7. **Nice-to-have**: Preset coordinate mappings in palettes.ts.

If time is limited, implement priorities 1–5 and leave 6–7 for a follow-up.

### What NOT to change
- The shader code (GLSL files) — shaders receive derived values, not control values
- The rendering pipeline (EffectComposer, tone mapping, etc.)
- The fold-in/fold-out animation system
- The existing `flowFieldNormal` and `colorFieldHue` functions in flow-field.ts (keep them, add `compositeFlowField` alongside)
- The guide curve generation algorithm (guide-curves.ts internals)
- The dot generation algorithm (dots.ts internals)

## Verification

After implementation, verify with sampler.html:

1. **Default render**: All params at 0.5, hue=0.783 → should look like current violet-depth midpoint
2. **Hue sweep**: hue 0→1 at fixed other params → smooth color progression through the spectrum
3. **Spectrum sweep**: spectrum 0→1 → monochrome to prismatic transition
4. **Chroma sweep**: chroma 0→1 → gray/achromatic to vivid color
5. **Preset recreation**: Set hue/spectrum/chroma to each preset's coordinates → should match the former palette's character
6. **Flow sweep**: flow 0→1 at high coherence → radial starburst → noise → orbital bands
7. **Flow × coherence**: flow=0 at coherence=0 vs coherence=1 → should be dramatic difference (random vs starburst)
8. **Division sweep**: division 0→1 → single lobe → dual lobe → triple lobe
9. **Scale sweep**: scale 0→1 → few large forms → many small particles (same seed, same total density)
10. **Faceting sweep**: faceting 0→1 → broad flat panels → sharp angular shards
11. **Coherence still works**: coherence 0→1 → scattered → aligned (geometric + chromatic)
12. **Fog colors**: verify fogColor stays in 0.001–0.006 range across all hue/chroma/luminosity combinations
13. **TypeScript compiles**: `npx tsc --noEmit` — clean

## Summary

The parameter space goes from 5 sliders + 1 dropdown → 11 continuous 0–1 axes. Every axis is conceptually distinct and thematically grounded:

- **density**: how much exists
- **fracture**: how broken it is
- **coherence**: how strongly things align
- **luminosity**: how much energy it has
- **hue**: what color the light is
- **spectrum**: how varied the colors are
- **chroma**: how vivid the colors are
- **flow**: what spatial pattern organizes the geometry
- **scale**: how fine or coarse the geometry is
- **division**: whether the form is unified or split
- **faceting**: how angular or smooth the crystal faces are

No parameter is redundant. No important dimension is hardcoded. Color is integral, not bolted on. Spatial organization is parameterizable. The entire space is smoothly morphable.
