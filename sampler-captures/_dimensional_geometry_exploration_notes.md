# Dimensional Geometry Exploration Notes

Session started 2026-02-27. Tool: `sampler.html` (8x8 parameter grid renderer).

---

## Mathematical Architecture (Summary)

The scene pipeline has four geometric layers, each with distinct math:

1. **Envelope SDF** — Perturbed ellipsoid: `ellipsoid + groove + noise`. Groove breaks vertical symmetry via Gaussian crease gated to upper hemisphere. Noise uses three incommensurable sinusoidal frequencies to break all remaining symmetry. C1 discontinuity at y=0 equator from `max(0, y/ry)`.

2. **Guide Curves** — Constrained random walks on the envelope surface. Not geodesics or streamlines — stochastic walks with inter-curve repulsion (inverse-square, projected to tangent plane). Seeded by Fibonacci spiral. Many-body problem: each curve's path depends on all others.

3. **Dots** — Five tiers (hero, medium, small, interior, micro). No packing algorithm — just Gaussian scatter with SDF rejection sampling. Color mapping is a radial-to-hue transducer: center = pale/desaturated, edge = warm/vivid. Creates depth appearance without depth-of-field.

4. **Folding Chains** — Iterated function system on SO(3). Reflect vertex across shared edge, apply small random dihedral rotation (±1-5°), scale from centroid (~0.98×). Emergent inward spiraling from contraction. Random walk on the rotation group.

**Key insight**: The flow field (hash-based Perlin noise at scale 1.5) orients chain principal axes but is completely independent of the SDF, curves, and dots. It's the only geometric subsystem with zero user control.

---

## Parameter Coupling Structure

### The `cl()` function
Piecewise-linear ramp: `cl(t, lo, mid, hi)` with midpoint at t=0.5 (the hand-tuned demo default). Asymmetric slopes above/below center.

### Control → Layer Matrix

|              | Envelope | Curves    | Dots          | Chains        | Lighting      | Post-FX      |
|--------------|----------|-----------|---------------|---------------|---------------|--------------|
| **density**  | —        | maxCount  | ALL counts    | chainLen      | glow÷scale    | bloom÷atten  |
| **fracture** | radii    | steps,curv| spread(int,µ) | scaleRng,sprd | edgeOpac      | chrom.aberr  |
| **coherence**| —        | seeds,step| —             | spacing       | —             | bloomThresh  |
| **luminosity**| —       | —         | glow,light    | —             | ALL factors   | bloomStr     |
| **depth**    | —        | —         | —             | —             | —             | cam,FOV,vig  |
| **palette**  | —        | —         | hue,range     | —             | bg,fog        | —            |

### Three Coherence Mechanisms
1. **densityScale compensator**: `cl(density, 0.35, 1.0, 5.5)` divides all glow — energy conservation by construction
2. **Fracture-spread correlation**: All subsystems answer "how broken?" in the same direction
3. **Coherence-spacing inverse**: More seeds + finer steps + tighter spacing = denser but more ordered

### Surprising Decouplings
- Coherence doesn't affect dots
- Luminosity doesn't affect geometry
- Depth doesn't affect the scene at all (pure camera/post-fx)
- **Flow field is controlled by nothing** — hardcoded scale=1.5, no UI

---

## Grid Exploration Results

### Grid 1: density × fracture

Node count range: 105 – 1443 (13:1 ratio). Density dominates.

```
         d=0.00  0.14  0.29  0.43  0.57  0.71  0.86  1.00
f=1.00 |   107   174   241   310   481   717   930  1144
f=0.86 |   105   169   228   302   445   678   901  1125
f=0.71 |   105   172   237   303   456   681   915  1135
f=0.57 |   106   176   246   321   502   745   980  1206
f=0.43 |   106   172   242   311   489   756  1001  1238
f=0.29 |   117   192   257   381   545   819  1052  1353
f=0.14 |   116   196   279   394   578   848  1105  1399
f=0.00 |   118   196   279   397   595   860  1124  1443
```

Fracture has mild effect on node count (low fracture = slightly more nodes, ~25% increase at max density). But visual character change from fracture is dramatic: compact blob vs scattered shards.

### Grid 2: coherence × density

Coherence barely affects node counts (< 10% variation across full range at any density level). Visually subtle — slight change in clustering tightness.

### Grid 3: luminosity × fracture

Luminosity is purely optical — same geometry at every luminosity level. Useful range is roughly 0.15–0.65; outside that, either invisible or blown out.

### Grid 4: coherence × fracture

More variation than coherence × density, but coherence remains the weakest axis.

---

## Key Findings

### 1. The densityScale compensator preserves total brightness but not structural legibility
High density merges elements into indistinct glow. The compensator reduces per-element brightness proportionally, but doesn't account for spatial overlap from additive blending. Most visually interesting renders: density 0.14–0.57.

### 2. Fracture is the most coherently designed parameter
Controls envelope radii + curve curvature + chain spread + dot spread + chromatic aberration simultaneously. Everything moves in the same perceptual direction. Low fracture = soft/organic, high fracture = angular/crystalline.

### 3. Coherence is nearly invisible
Smallest perceptual bandwidth of all five controls. Only affects curve seed counts and chain spacing — second-order effects.

### 4. Lower density reveals more structure
The best renders (ghost-prismatic, prismatic-dark-sparse, all-zero, sparse-ghost) all have density ≤ 0.20. Suggests additive blending works against legibility at higher element counts.

### 5. Prismatic palette benefits most from low density + high fracture
Color variation only visible when faces are spatially separated and per-element brightness is low enough to avoid white washout.

### 6. Luminosity range too aggressive
Useful slider travel ~40%. Could retune cl() bounds.

### 7. Seed variation is contained
Different seeds at same params produce recognizably different compositions but same overall character. Parameters control statistics; seed controls realization.

---

## Flow Field: The Untunable Axis

Current state in `lib/engine/demo/flow-field.ts`:
- `flowFieldNormal(pos, scale=1.5)` — 3D vector field from hash-based Perlin noise
- `colorFieldHue(pos, scale=1.2, baseHue, hueRange)` — scalar hue field (separate noise phase)
- Hermite smoothstep interpolation (C1 continuity)
- Completely decoupled from envelope SDF
- Used ONLY for atmospheric chain orientation (tendril direction)
- Scale 1.5 is hardcoded — no user control

### What a flow field control could affect
- **Scale**: Low scale = large coherent flow regions (chains align in bands). High scale = high-frequency chaos (each chain points differently).
- **Offset/seed**: Shift the noise field to get different orientations without changing frequency.
- **Strength**: Blend between flow-field orientation and surface-normal orientation. At 0 = chains radiate outward from envelope. At 1 = chains follow the noise field.
- **Type**: Could add curl noise, divergence-free fields, or SDF-gradient-derived flow.

### Open questions
- Would SDF-gradient-derived flow produce more coherent results than random noise?
- Does the color field (scale 1.2) need to track the flow field, or is decorrelation good?

### Flow field coherence by scale (measured)
Neighbor vector dot product across 32x32 sample grid in envelope range:
```
scale=0.30  coh=0.9997  (nearly uniform — all chains same direction)
scale=0.50  coh=0.9923
scale=0.75  coh=0.9889
scale=1.00  coh=0.9738
scale=1.50  coh=0.9614  ← current hardcoded value
scale=2.00  coh=0.9090
scale=3.00  coh=0.8405
scale=5.00  coh=0.6414  (visible per-chain variation)
scale=8.00  coh=0.3841  (chaotic)
scale=12.0  coh=0.1320  (nearly random)
```

### Implementation (done)
Two new derived params from coherence:
- `flowScale = cl(coherence, 5.0, 1.5, 0.5)` — high coherence → low scale (large aligned regions)
- `flowInfluence = cl(coherence, 0.0, 0.15, 0.35)` — high coherence → stronger flow bias on curve chains

Flow field now influences both:
1. **Atmospheric scatter chains** — already used flow field, now uses `params.flowScale` instead of hardcoded 1.5
2. **Curve-based chains** — draping direction lerped toward flow field by `flowInfluence`

Key insight: `flowInfluence=0` at low coherence preserves backward compatibility.
At midpoint (`coherence=0.5`), influence is 0.15 — very subtle.
At max (`coherence=1.0`), influence is 0.35 with scale 0.5 — visible directional alignment.

### Observations
- Effect most visible at **low density + high fracture** (ghost params) where individual faces are large
- At high density, additive blending still washes out directional structure
- Prismatic palette reveals the effect well: aligned chains sample similar hue-field positions → color patches become coherent
- Max influence of 0.35 is conservative; could push to 0.5+ for more drama
- The effect gives coherence a genuine visual meaning it previously lacked

---

## Notable Configurations

See `_notable_configs.json` for machine-readable versions.

| Name | d | f | l | c | palette | Why it works |
|------|---|---|---|---|---------|-------------|
| ghost-prismatic | 0.14 | 0.86 | 0.50 | 0.50 | prismatic | Colorful shards, visible hue variation |
| prismatic-dark-sparse | 0.20 | 0.60 | 0.20 | 0.30 | prismatic | Jewel-toned, low lum preserves color |
| all-zero | 0.00 | 0.00 | 0.00 | 0.00 | violet-depth | Intimate, starlike |
| sparse-ghost | 0.14 | 0.86 | 0.50 | 0.50 | violet-depth | Angular, architectural |
| all-min-except-lum | 0.00 | 0.00 | 1.00 | 0.00 | violet-depth | Bright core + visible sparkles |

---

## Session 1 Summary (2026-02-27)

### What was done
1. Built `sampler.html` — standalone 8x8 parameter grid renderer for visual exploration
2. Rendered 4 grid slices (density×fracture, coherence×density, luminosity×fracture, coherence×fracture)
3. Rendered ~40 full-size captures at interesting parameter combinations and across palettes
4. Measured flow field coherence across scales (0.3–12.0)
5. Implemented flow field control: `flowScale` + `flowInfluence` derived from coherence
6. Verified flow field effect via coherence sweep renders at ghost/prismatic/midpoint params

### Key insight
The parameter space has a "legibility frontier" — a boundary in (density, fracture, luminosity) space below which individual geometric elements are distinguishable and above which additive blending washes them into indistinct glow. The most aesthetically interesting renders live near this frontier: dense enough for richness, sparse enough for structure. The current parameter ranges allow too much travel into the "washed out" zone.

### Files created
- `sampler.html` — parameter space exploration tool
- `sampler-captures/` — ~50 PNG renders + `_notable_configs.json` + this notes file

### Files modified
- `lib/types.ts` — added `flowScale`, `flowInfluence` to DerivedParams
- `lib/core/params.ts` — derived from coherence
- `lib/engine/demo/build-scene.ts` — flow field blended into curve chain orientation

---

## Session 2: v2 Parameter Adjustments (2026-02-27)

### Changes Applied (by separate session)

Three adjustments were applied to `lib/core/params.ts` and `lib/engine/demo/folding-chains.ts`:

1. **Luminosity tightening**: `lumScale = cl(c.luminosity, 0.65, 1.0, 1.5)` — narrower range, midpoint preserved.
2. **Density-aware opacity**:
   - `faceDensityAtten = cl(c.density, 0.90, 1.0, 2.5)` — divides backLightFactor, illuminationCap, frontLightFactor
   - `faceOpacityScale = cl(c.density, 1.0, 1.0, 0.45)` — applied in folding-chains.ts to face+edge opacity
   - `bloomDensityAtten = cl(c.density, 1.0, 1.0, 1.8)` — divides bloomStrength
3. **Stronger flow influence**: `flowInfluence = cl(c.coherence, 0.0, 0.18, 0.50)` (was 0.35 max)
4. **Wider tendril opacity**: `primary: cl(c.coherence, 0.01, 0.06, 0.14)`, `other: cl(c.coherence, 0.005, 0.03, 0.08)`

### v2 Verification Results

**Luminosity extremes** (d=0.5, f=0.5, c=0.5):
- `lum=0.0`: Structure clearly visible. lumScale=0.65 means 35% dimmer, not invisible. Rich, saturated colors.
- `lum=1.0`: Bright but NOT blown out. Face edges and structure visible around the core. lumScale=1.5 is restrained.
- **Assessment**: Usable range expanded from ~40% to ~80% of slider travel. The entire dark region (lum < 0.2) is now a viable creative space.

**Density opacity compensation** (l=0.5, f=0.5, c=0.5):
- `d=0.65 ("medium-readable")`: Face edges and sparkle dots visible through moderate density.
- `d=0.86 ("nebula-v2")`: Dual-lobe form with visible face structure despite 912 nodes. Major improvement.
- `d=1.0, l=1.0 ("worst-case")`: Was a solid white rectangle. Now shows visible structure with bright core and surrounding detail.
- `all-max`: Still bright with dual lobes but not a solid white rectangle. sparkle dots visible.
- **Assessment**: The legibility frontier has shifted significantly upward. Densities 0.5–0.8 that were previously indistinct glow now show readable structure.

**Coherence effect at 0.50 influence** (d=0.35, f=0.65, l=0.40):
- 5-step sweep (c=0.00, 0.25, 0.50, 0.75, 1.00) shows clear progressive change:
  - c=0.00: Sharp angular faces pointing all directions, scattered
  - c=0.25: Slightly more organized, faces beginning to align
  - c=0.50: More unified mass, smoother haze
  - c=0.75: Distinctly cohesive, rounded overall form
  - c=1.00: Most unified — blobby, chains aligned, coherent mass
- Biggest visual jumps at 0.0→0.25 and 0.50→0.75
- **Assessment**: Coherence now has genuine perceptual impact across its full range. No longer the "invisible" axis.

**Coherence × fracture interaction** (prismatic palette):
- At f=0.90 (high fracture), coherence c=0→1 creates dramatic change: scattered multi-directional shards → aligned color regions
- The aligned chains sample similar hue-field positions, creating coherent color patches
- At f=0.30 (low fracture), coherence effect is subtler (compact form, less room for alignment to manifest)
- **Assessment**: Coherence × fracture is now the most interesting interaction axis (was density × fracture before v2).

### v2 Grid Comparisons

Four 8×8 grids rendered with v2 params:

1. **coherence × density**: Coherence axis now shows visible shape change (left=scattered, right=unified). Previous grid showed < 10% variation. High density cells not blown out.
2. **density × fracture**: Top-right corner (high density, low fracture) no longer a white blob. Structure preserved throughout.
3. **coherence × fracture**: More variation across the grid than v1. Coherence effect visible at all fracture levels. High fracture + high coherence = aligned directional shards.
4. **luminosity × density**: Left column (lum=0) visible at all density levels. Right column (lum=1) not blown out. The full 2D space is now usable.

### New Parameter Regions Discovered

**"Dark mode" (lum=0)**:
The params `d=0.20, f=0.70, l=0.0, c=0.50` are universally flattering across ALL palettes:
- `dark-jewel` (prismatic): Rich saturated magenta/green/gold/purple. Individual faces and sparkle dots readable.
- `dark-warm` (warm-spectrum): Amber/gold, like looking into warm amber.
- `dark-teal` (teal-volumetric): Cool, icy, architectural. Face edges clearly visible.
- `dark-sapphire` (sapphire): Deep blue with purple undertones. Elegant.
- `dark-amethyst` (amethyst): Purple/rose tones. Classical.
- `dark-crystal` (crystal-lattice): Near-monochrome/grayscale. Uniquely stark wireframe feel.

Pre-v2, lum=0 was nearly invisible. The tightened range (lumScale=0.65 at min) creates enough light for rich, saturated rendering.

**"Stained glass" (d=0.10, f=1.0, l=0.10, c=0.60, prismatic)**:
Extreme fracture + minimal density + low lum = maximum color separation. Two distinct color centers (magenta left, gold right) with individually readable faces between them. The most color-separated render in the entire exploration.

**"Aurora" (d=0.30, f=0.50, l=0.35, c=1.0)**:
High coherence at medium params creates directional flow with dark geometric silhouettes in the foreground. Works beautifully on warm-spectrum (amber aurora) and teal-volumetric (icy aurora).

**"Pure coherence" (d=0.0, f=0.0, l=0.50, c=1.0)**:
Minimal geometry + maximum coherence = atmospheric nebula with visible tendrils. Sparkle dots scattered around a soft compact core. The flow influence gives structure to what would otherwise be an amorphous glow.

### Updated Control Assessment

| Control | v1 assessment | v2 assessment |
|---------|--------------|---------------|
| **density** | Dominant axis, blows out above 0.5 | Still dominant but usable across full range. faceOpacityScale preserves structure at high values. |
| **fracture** | Most coherently designed | Unchanged — still the most coherent axis. |
| **coherence** | Nearly invisible (~second-order) | **Genuinely visible** at 0.50 influence. Progressive change across full range. Creates color regionalization on prismatic. |
| **luminosity** | Useful range ~40% of slider | Useful range ~80%. lum=0 is viable ("dark mode"). lum=1 doesn't blow out. |
| **depth** | Pure camera/post-fx, no scene effect | Unchanged. |

### Remaining Observations

- Coherence effect strongest at low-to-medium density (d < 0.5). At high density, additive blending still dominates over alignment.
- The flow influence could potentially be pushed further (0.60–0.70) — the effect at 0.50 is clearly visible but not overwhelming.
- The color field (hue noise, scale=1.2) is still decorrelated from the flow field (scale=variable). Tracking them might strengthen the coherence→color regionalization effect.
- Crystal-lattice palette becomes achromatic at low luminosity — intentional? Creates a unique monochrome aesthetic.
- The "legibility frontier" has shifted upward by roughly +0.2 on the density axis and +0.3 on the luminosity axis.

### Files Created (Session 2)
- `sampler-captures/v2-grid-{coherence-density,density-fracture,coherence-fracture,luminosity-density}.png` — v2 comparison grids
- `sampler-captures/v2-{prism-aligned,prism-ghost-aligned,medium-readable,nebula-v2,allmax-v2}.png` — v2 full-size renders
- `sampler-captures/v2-frontier-{violet,prismatic,warm,teal,sapphire}.png` — legibility frontier across palettes
- `sampler-captures/v2-{sweet-coh0,sweet-coh1,dark-jewel,bright-structured,pure-coherence}.png` — extremes
- `sampler-captures/v2-{prism-chaos,prism-order,dense-chaotic,dense-aligned}.png` — coherence contrasts
- `sampler-captures/v2-dark-{warm,teal,sapphire,violet,amethyst,crystal}.png` — dark mode palette sweep
- `sampler-captures/v2-{stained-glass,aurora-warm,aurora-teal,constellation,constellation-aligned}.png` — new regions
- `sampler-captures/v2-coh-sweep-{0.00,0.25,0.50,0.75,1.00}.png` — 5-step coherence progression

---

## Ideas / Next Directions

### Done (from Session 1 list)
- ~~Retune parameter ranges~~ → Applied: luminosity tightened, density-aware opacity
- ~~Push flow influence harder~~ → Applied: 0.35 → 0.50
- ~~Density-aware opacity~~ → Applied: faceOpacityScale + faceDensityAtten + bloomDensityAtten

### Open
1. **Push flow influence to 0.60–0.70** — Current 0.50 is clearly visible but not overwhelming. More influence could create stronger directional "currents" in the geometry.
2. **Color field tracking** — Link hue noise scale to flowScale so aligned chains also produce coherent color patches. Currently decorrelated (flow=variable, hue=fixed 1.2). Would strengthen the coherence→color regionalization effect observed on prismatic.
3. **SDF-coupled flow** — Derive chain orientation from envelope gradient for geometric coherence (instead of random noise). Would create radial/tangential flow patterns tied to the form rather than arbitrary noise directions.
4. **Coherence × density compensation** — Coherence effect fades at high density due to additive blending. Could scale flow influence up with density to compensate.
5. **Sampler enhancements** — Brightness histogram per cell, auto-detect "interesting" regions, A/B comparison mode, animation preview (morph between cells)
6. **Explore depth axis** — Currently unexplored in this session. Camera distance + FOV + vignette change the framing significantly. Worth a dedicated depth sweep.
