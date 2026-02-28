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
- What does the flow field look like at different scales? (currently invisible)
- Does the color field (scale 1.2) need to track the flow field, or is decorrelation good?

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

## Ideas / Next Directions

1. **Flow field as a control** — Expose scale, strength, and possibly type as user parameters
2. **Retune parameter ranges** — Tighten luminosity, give coherence more perceptual range
3. **Density-aware opacity** — Scale per-element opacity more aggressively with density to preserve legibility
4. **SDF-coupled flow** — Derive chain orientation from envelope gradient for more geometric coherence
5. **Sampler enhancements** — Add brightness histogram per cell, auto-find "interesting" parameter regions
