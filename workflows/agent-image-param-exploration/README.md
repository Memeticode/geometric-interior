# Workflow: Image Parameter Tuning

Verify that a newly implemented parameter produces a usable, perceptually even range across its full 0-1 slider travel. This is engineering work -- systematic sweeps, identifying dead zones, adjusting derivation curves, re-rendering to confirm.

Run this immediately after implementing a new parameter's rendering logic, before creative exploration.

---

## When to Use

- A new parameter has been added to `Controls` and wired through `deriveParams()`
- The derivation curves are initial guesses and need empirical tuning
- You suspect a parameter has dead zones, blowout, or perceptual unevenness

## Inputs

- **Target parameter**: Which parameter to sweep (e.g., `bloom`)
- **Anchor configs**: 3-5 known-good configurations spanning different aesthetic territories

## Outputs (in `output/`)

- `output/renders/` -- Rendered images organized by sweep
- `output/tuning-report.md` -- Findings, curve shapes, before/after comparisons
- `output/project-updates.md` -- Specific recommended changes to `lib/core/params.ts` derivation curves

---

## Methodology

### Phase 1: Coarse Sweep

For each anchor config, render the target parameter at 11 values: `0.0, 0.1, 0.2, ..., 1.0`. All other parameters held fixed at the anchor's values.

Good anchor defaults:
- **Violet Sanctum** -- the classic look (violet, moderate everything)
- **Sapphire Lattice** -- vivid blue, high chroma
- **Crystal Lattice** -- achromatic, pure structure
- **Warm Spectrum** -- amber/gold, high chroma

This produces 4 anchors x 11 steps = 44 images.

**Questions to answer:**
- Is every step visibly different from its neighbors?
- Are there dead zones where multiple steps look identical?
- Does the progression feel perceptually even?
- Do extreme values (0.0 and 1.0) produce usable images?
- Does the parameter behave consistently across different anchor configs?

### Phase 2: Interaction Sweeps

For the most important interaction partners, render a 2D grid: target parameter x partner parameter, each at 5 values (0.0, 0.25, 0.5, 0.75, 1.0).

This produces 25 images per interaction pair.

**Questions to answer:**
- Do the parameters interact smoothly, or are there cliff edges?
- Are there pathological combinations that produce broken output?
- Does the interaction create genuinely distinct aesthetic territories?

### Phase 3: Curve Adjustment

Based on findings, adjust the derivation curves in `lib/core/params.ts`.

Common fixes:
- **Dead zone at low end**: The `controlLerp` min value is too close to mid. Widen the range.
- **Dead zone at high end**: The max value saturates too early. May need sublinear mapping (e.g., `param^2`).
- **Perceptual unevenness**: Adjust the mid-point value in `controlLerp(param, min, mid, max)`.
- **Blowout at extremes**: Cap the max derived value or add density-aware attenuation.
- **Inconsistency across anchors**: The parameter may need to interact with other derived values.

### Phase 4: Verification

Re-render the Phase 1 coarse sweep with adjusted curves. Confirm:
- All 11 steps are visibly distinct
- No dead zones remain
- Extreme values are usable
- Progression is perceptually even

If issues remain, iterate Phase 3-4.

Write `output/project-updates.md` with the final curve recommendations, ready to apply to the codebase.

---

## Render Script

The render script should:

1. Read a sweep config JSON specifying the target parameter, values, and anchor configs
2. For each anchor x value combination, render and save as `{anchor}-{param}-{value}.png`
3. Support `--start` flag for resuming interrupted runs

Template sweep config:

```json
{
  "targetParam": "bloom",
  "values": [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  "anchors": [
    { "name": "violet-sanctum", "seed": [5, 8, 12], "controls": { "density": 0.08, "fracture": 0.50, "scale": 0.50, "division": 0.50, "faceting": 0.50, "luminosity": 0.50, "bloom": 0.50, "hue": 0.783, "spectrum": 0.24, "chroma": 0.42, "coherence": 0.50, "flow": 0.50 }},
    { "name": "crystal-lattice", "seed": [9, 3, 6], "controls": { "density": 0.08, "fracture": 0.50, "scale": 0.50, "division": 0.50, "faceting": 0.50, "luminosity": 0.50, "bloom": 0.50, "hue": 0.586, "spectrum": 0.0, "chroma": 0.0, "coherence": 0.50, "flow": 0.50 }}
  ]
}
```

---

## File Structure

```
workflows/agent-image-param-exploration/
├── README.md                ← this file
├── sweep-config.json        ← target param, anchors, values
├── render-sweep.mjs         ← Playwright batch render script
└── output/
    ├── .gitkeep
    ├── renders/             ← sweep images
    │   ├── violet-sanctum-bloom-0.0.png
    │   ├── violet-sanctum-bloom-0.1.png
    │   └── ...
    ├── tuning-report.md     ← findings and curve analysis
    └── project-updates.md   ← recommended params.ts changes
```
