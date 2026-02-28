# Prompt: Integrate Color as a Continuous Parameter

## Goal

Replace the discrete palette dropdown with a continuous "warmth" slider, derive hue range from fracture, and link the color noise field to the flow field scale. This makes color an integral part of the continuous parameter space rather than a bolt-on selector.

## Background

The parameter space currently has 5 continuous controls + 1 discrete palette dropdown. Through extensive parameter-space sampling (~100 renders across grids and targeted combinations), we found that:

1. The most interesting renders often need color characteristics that don't match any single preset palette
2. The morph system can't smoothly transition between palette keys — it's a discrete jump in an otherwise continuous space
3. Fracture already controls "how varied/broken is everything" (geometry, scattering, spread) — it's the natural home for color variety too
4. The coherence → flow field pipeline creates color regionalization when chains align to sample similar hue-field positions — but only accidentally, because the color field (scale 1.2) is decorrelated from the flow field (variable scale)

The infrastructure for continuous color already exists: `deriveCustomColors(baseHue)` derives fogColor/bgColor/edgeColor from any hue, `PaletteTweaks` supports {baseHue, hueRange, saturation}, and `StillConfig` already treats palette as continuous `{hue, range, saturation}`.

## Changes

### 1. Add "warmth" to Controls, derive hueRange from fracture

**`lib/types.ts`**: Replace `palette: PaletteKey` in Controls with `warmth: number` (0-1 range). Keep PaletteKey type for backward compat but it becomes a preset identifier, not a runtime control.

```typescript
export interface Controls {
    topology: 'flow-field';
    warmth: number;      // 0-1: cool teal → blue → violet → magenta → warm amber
    density: number;
    luminosity: number;
    fracture: number;
    depth: number;
    coherence: number;
}
```

**`lib/core/params.ts`**: Derive all color values from warmth + fracture + luminosity:

```typescript
// Warmth → baseHue: piecewise mapping through perceptually-spaced hue stops
// 0.0 = teal (185), 0.25 = sapphire (225), 0.5 = violet (282), 0.75 = magenta (312), 1.0 = warm (382→22)
const baseHue = warmthToHue(c.warmth);  // see helper below

// Fracture → hueRange: "how varied" — monochrome to prismatic
const hueRange = cl(c.fracture, 15, 40, 180);

// Saturation: moderate baseline, slightly higher at warm temperatures
const saturation = cl(c.luminosity, 0.5, 0.65, 0.85);

// Derive fog/bg/edge colors from baseHue (already implemented in palettes.ts)
const { fogColor, bgColor, edgeColor, accentHue } = deriveCustomColors(baseHue);
```

The `warmthToHue` function should use smooth interpolation through these waypoints:
- 0.00 → 185 (teal)
- 0.20 → 220 (sapphire blue)
- 0.40 → 270 (indigo-violet)
- 0.60 → 295 (amethyst-magenta)
- 0.80 → 330 (rose)
- 1.00 → 382 (= 22°, warm amber — wraps around)

Use a smooth cubic or Catmull-Rom spline through these points, NOT linear segments (linear creates perceptual jumps). The hue circle wraps, so the 330→382 segment crosses 360.

### 2. Link color field scale to flow field scale

**`lib/engine/demo/build-scene.ts`**: Where `colorFieldHue()` is called, replace the hardcoded scale 1.2 with a value derived from `params.flowScale`:

```typescript
// Was: colorFieldHue(pos, 1.2, params.baseHue, params.hueRange)
// Now: color noise tracks flow field for coherence → color coupling
const colorScale = params.flowScale * 0.8;
colorFieldHue(pos, colorScale, params.baseHue, params.hueRange)
```

This means:
- High coherence → low flowScale (0.5) → low colorScale (0.4) → large coherent color patches
- Low coherence → high flowScale (5.0) → high colorScale (4.0) → per-element color variation
- At the default midpoint (coherence=0.5, flowScale=1.5): colorScale=1.2 (identical to current)

### 3. Convert palette presets to parameter snapshots

**`lib/core/palettes.ts`**: Keep the existing palette definitions but add a function that maps each named palette to a `{warmth, fracture}` pair (plus any other control overrides if desired):

```typescript
export const PALETTE_PRESETS: Record<string, { warmth: number, hueRange?: number }> = {
    'violet-depth':    { warmth: 0.48 },  // baseHue ≈ 282
    'warm-spectrum':   { warmth: 0.97 },  // baseHue ≈ 22
    'teal-volumetric': { warmth: 0.02 },  // baseHue ≈ 185
    'prismatic':       { warmth: 0.48 },  // any warmth works, fracture drives the range
    'crystal-lattice': { warmth: 0.24 },  // baseHue ≈ 211
    'sapphire':        { warmth: 0.20 },  // baseHue ≈ 225
    'amethyst':        { warmth: 0.62 },  // baseHue ≈ 312
};
```

Note: "prismatic" is no longer a palette — it's what happens at high fracture (hueRange expands). At warmth=0.48 + fracture=0.9, you get the prismatic look. At warmth=0.48 + fracture=0.2, you get violet-depth.

### 4. Update the UI

**`src/ui/`**: Replace the palette dropdown with a warmth slider. The slider should have a gradient track showing the hue mapping (teal → blue → violet → magenta → warm). Keep palette names as preset buttons that set warmth (and optionally other sliders) — like "Violet Depth" sets warmth=0.48 and density/fracture to their defaults.

The gradient track for the warmth slider should show the actual hue at each position, painted as a horizontal gradient. This makes the control intuitive — the user slides to the color they want.

### 5. Update morph system

**`src/engine/render-worker.js`**: The morph-prepare handler currently takes two full `Controls` objects. Since `warmth` is now a number (not a discrete key), the interpolation in `morph-update` will naturally lerp it along with all other controls. **This should just work** — the morph system interpolates all numeric controls already.

The only thing to verify: `morphPrepare` currently may handle palette-key differences specially. With continuous warmth, that special handling can be removed — warmth lerps like any other parameter.

### 6. Update StillConfig and Profile

**`lib/types.ts`**: `StillConfig` already has `palette: { hue, range, saturation }` which is essentially the continuous version. Map it:
- `hue` → derive from `warmth` via `warmthToHue()`
- `range` → derive from `fracture` via `cl(fracture, 15, 40, 180)`
- `saturation` → derive from `luminosity`

**Profile**: `controls.warmth` replaces `controls.palette`. The `paletteTweaks` field on Profile becomes unnecessary (the tweaks are now just the warmth value). You may want to keep it for backward compat with saved profiles — detect old format (has `palette` key) and convert to warmth.

## Files to Modify

| File | Change |
|------|--------|
| `lib/types.ts` | Controls: `palette` → `warmth`; may simplify PaletteTweaks |
| `lib/core/params.ts` | Derive baseHue from warmth, hueRange from fracture, saturation from luminosity. Add `warmthToHue()`. Remove getPalette() call, use deriveCustomColors() |
| `lib/core/palettes.ts` | Add PALETTE_PRESETS mapping. Keep existing palette data for reference/presets. |
| `lib/engine/demo/build-scene.ts` | Change colorFieldHue() scale to `params.flowScale * 0.8` |
| `lib/engine/create-renderer.ts` | Update any palette key references |
| `src/engine/render-worker.js` | Update morph handling — simplify palette interpolation |
| `src/main.js` | Update control setup, palette preset UI |
| `src/ui/controls.js` or similar | Replace palette dropdown with warmth slider + preset buttons |
| `src/ui/profiles.js` | Update profile save/load for warmth instead of palette key |
| `src/core/palettes.js` (src/) | Mirror changes from lib/ if this is the JS version |
| `src/core/params.js` (src/) | Mirror changes from lib/ |

## Constraints

- **Preserve midpoint values**: At warmth=0.48 (violet), fracture=0.5, the output should be close to current violet-depth defaults. Don't break the most common configuration.
- **bgColor/fogColor must stay near-black**: The `deriveCustomColors` function produces values in the 0.001-0.006 range — verify this is still true for all warmth values. If not, clamp.
- **hueRange at fracture=0.5 should be ~40**: This matches violet-depth's current hueRange=30 closely enough. The jump from 30→40 is perceptually small.
- **Backward compat for saved profiles**: Detect old `{ palette: "violet-depth" }` format and convert to `{ warmth: 0.48 }`.
- **Test with `sampler.html`**: After changes, render a warmth sweep at the sampler to verify the hue mapping looks smooth and the full range is usable. Also render a fracture sweep on prismatic-equivalent params to verify the hueRange derivation.

## Verification

1. TypeScript compiles clean (`npx tsc --noEmit`)
2. At warmth=0.48, fracture=0.5, density=0.5, luminosity=0.5, coherence=0.5, depth=0.5 — output should look very similar to current violet-depth midpoint
3. Warmth sweep from 0→1 at fixed other params shows smooth hue progression (no jumps)
4. High fracture produces prismatic-like color variety at any warmth
5. Low fracture produces near-monochrome at any warmth
6. High coherence creates visible color patches (not just geometric alignment)
7. Morph between different warmth values is smooth
8. All existing tests pass (may need control object updates in test fixtures)

## What NOT to Change

- The 5 geometric controls (density, fracture, luminosity, coherence, depth) keep their current derivation logic for all non-color parameters
- The flow field functions in `flow-field.ts` are unchanged
- The shader code is unchanged (it receives derived colors, not control values)
- The fold-in/fold-out animation system is unchanged
- The rendering pipeline (EffectComposer, tone mapping, etc.) is unchanged
