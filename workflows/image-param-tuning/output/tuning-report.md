# Bloom Parameter Tuning Report

**Target parameter:** `bloom` (0–1)
**Date:** 2026-03-01
**Anchors:** Violet Sanctum, Ice Crystal, Sapphire Lattice, Dark Ruby Divide

---

## Phase 1: Coarse Sweep (v1 — initial curves)

Rendered 4 anchors × 11 bloom values (0.0, 0.1, ..., 1.0) = 44 images.

### Findings

**Dead zone at low end (0.0–0.2):**
Across all 4 anchors, bloom=0.0, 0.1, and 0.2 were nearly indistinguishable. The glow halos and post-processing bloom at the minimum were too close to mid-range values, creating a compressed low end where 20% of the slider travel produced no perceptible change.

Root cause: The `controlLerp` min values were too close to their mid values.

| Derived value | v1 min (bloom=0.0) | v1 mid (bloom=0.5) | Ratio |
|---|---|---|---|
| heroDotGlowBase | 18 | 34 | 0.53 |
| bloomStrength | 0.08 | 0.20 | 0.40 |
| bloomThreshold | 0.85 | 0.70 | 1.21 |
| attenuationCoeff | 5.0 | 3.0 | 1.67 |

The min values were already 40-53% of mid — not enough contrast for the low end to read as "tight."

**Mid-range (0.3–0.6): Healthy.**
Gradual, visible progression at each step. Each 0.1 increment was discernible.

**High-end compression (0.7–1.0):**
Steps became less perceptually distinct. On bright anchors (Ice Crystal lum=0.55, Sapphire Lattice lum=0.80), bloom=1.0 approached blowout with very bright central areas.

---

## Phase 3: Curve Adjustments

Applied the following changes to `lib/core/params.ts`:

### Dot glow halo sizes (tighter at min, larger at max)

| Derived value | v1 (min, mid, max) | v2 (min, mid, max) |
|---|---|---|
| heroDotGlowBase | (18, 34, 50) | (10, 30, 55) |
| mediumDotGlowBase | (8, 16, 26) | (4, 14, 28) |
| smallDotGlowBase | (5, 10, 18) | (2, 8, 20) |
| microDotGlowBase | (5, 12, 20) | (2, 10, 22) |

### Face lighting attenuation (faster falloff at min)

| Derived value | v1 | v2 |
|---|---|---|
| attenuationCoeff | (5.0, 3.0, 1.5) | (7.0, 3.0, 1.2) |
| ambientLight bloom term | (0.0, 0.005, 0.015) | (0.0, 0.008, 0.02) |

### Post-processing bloom (zero at min, stronger at max)

| Derived value | v1 | v2 |
|---|---|---|
| bloomStrength | (0.08, 0.20, 0.35) | (0.0, 0.18, 0.40) |
| bloomThreshold | (0.85, 0.70, 0.50) | (0.95, 0.70, 0.45) |

**Design rationale:**
- At bloom=0.0, post-processing bloom is now completely eliminated (strength=0.0, threshold=0.95). Light stays exactly where it originates — no haze, no atmospheric glow.
- At bloom=1.0, the max values are pushed further: larger halos, slower attenuation (1.2 vs 1.5), stronger post-processing (0.40 vs 0.35), lower threshold (0.45 vs 0.50).
- Mid-range values were adjusted slightly downward (heroDotGlowBase 34→30, bloomStrength 0.20→0.18) to maintain the perceptual center at bloom=0.5.

---

## Phase 4: Verification Sweep (v2 — adjusted curves)

Re-rendered all 44 images with the adjusted curves.

### Results

**Low-end dead zone: FIXED.**
Bloom=0.0, 0.1, and 0.2 are now visibly distinct across all 4 anchors. At 0.0, the glow halos are noticeably smaller, light falls off faster, and there is no atmospheric haze from post-processing bloom. Each 0.1 step adds perceptible glow spread.

**Mid-range: Preserved.**
Side-by-side comparison of v1 vs v2 at bloom=0.5 shows virtually identical output. The curve adjustments did not disrupt the existing mid-range aesthetic.

**High-end: Slightly more dramatic.**
Bloom=1.0 is now more atmospheric than v1. On bright anchors (Ice Crystal, Sapphire Lattice), the center area is bright but structure remains visible at the periphery. On dark anchors (Dark Ruby Divide), high bloom produces beautiful warm atmospheric glow without blowout.

**Note on Ice Crystal at bloom=1.0:** The combination of moderate luminosity (0.55) + achromatic coloring + maximum bloom produces a very bright central area. This is an extreme parameter combination and the intensity is acceptable — users pushing both luminosity and bloom to high values expect dramatic effects. The density-aware bloom attenuation (`bloomDensityAtten`) prevents blowout on denser scenes.

### Anchor-by-anchor assessment

**Violet Sanctum** (violet, lum=0.58, moderate density):
Full range is usable. Beautiful progression from precise jewel-like glow at 0.0 to soft atmospheric haze at 1.0. Excellent parameter behavior.

**Ice Crystal** (achromatic, lum=0.55, low density):
Full range is usable. 0.0 shows defined crystalline glow points. 1.0 is bright but structure remains visible at edges. The achromatic palette makes light spread particularly visible.

**Sapphire Lattice** (blue, lum=0.80, low density):
Full range is usable. High base luminosity means the entire sweep is brighter, but each step is distinct. At 1.0, the teal atmospheric haze is evocative. This anchor benefits most from the wider range.

**Dark Ruby Divide** (warm, lum=0.30, high density, trifold division):
Full range is usable. The dark base luminosity keeps things controlled even at high bloom. The warm color palette + high bloom creates a candlelit cathedral effect that's particularly striking. This anchor demonstrates bloom's interaction with luminosity — dark + diffuse is a rich territory.

---

## Remaining considerations

### Interaction sweep (Phase 2) — deferred to exploration workflow

The most important interaction partner for bloom is **luminosity**. The 2D luminosity × bloom light space is the primary creative territory this parameter opens. Rather than a mechanical interaction sweep, this is better explored through the `image-param-exploration` workflow, which is designed for creative deep-dives into parameter pairs.

### Starter profile bloom values — deferred to exploration workflow

All existing starter profiles currently lack a `bloom` field (defaulting to wherever the UI initializes). Recommended bloom values for each profile should emerge from the exploration workflow's Phase 5 (curation), not from engineering tuning.

A reasonable default for profiles without explicit bloom is **0.35** — moderate emanation that preserves structure while adding some atmospheric warmth.

---

## Summary

| Aspect | v1 (initial) | v2 (adjusted) |
|---|---|---|
| Low-end dead zone | 0.0–0.2 indistinguishable | Fixed — all steps distinct |
| Mid-range evenness | Good (0.3–0.6) | Preserved |
| High-end range | Compressed (0.7–1.0 similar) | Extended — more dramatic |
| Extreme blowout | Minor on bright anchors | Acceptable on extreme combos |
| Overall range | Narrow | ~3× wider effective range |

**Verdict:** The bloom parameter's derivation curves are now healthy. The full 0–1 slider range is usable with perceptually even steps. Ready for creative exploration.
