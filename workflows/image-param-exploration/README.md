# Workflow: Image Parameter Exploration

A creative research process for discovering evocative configurations along a specific parameter axis or parameter pair. The goal is not coverage but resonance -- finding images that say something, naming the aesthetic territories they inhabit, and refining seeds to hone each mood.

This runs *after* param-tuning has verified the parameter's derivation curves are healthy. Param-tuning is engineering; this is art.

Each run of this workflow focuses on one parameter or parameter pair. The first instance will be **bloom** (the luminosity x bloom light space). Future instances might explore new parameters as they're added.

---

## When to Use

- A new parameter has been tuned and is ready for creative discovery
- You want to understand what aesthetic territories a parameter (or parameter pair) opens up
- You need to determine the right parameter values for starter profiles

## Inputs

- A working, tuned parameter implementation
- The existing starter profiles (as anchor points)
- `docs/parameters.md` for parameter semantics

## Outputs (in `output/`)

- `output/renders/` -- Rendered images organized by exploration phase
- `output/configs.json` -- Curated configurations discovered during exploration
- `output/findings.md` -- Aesthetic territories, notable images, interaction observations. Written to be read and enjoyed.
- `output/project-updates.md` -- Actionable recommendations: starter profile values, new portrait candidates, parameter interaction notes for `docs/parameters.md`

---

## Methodology

### Phase 1: Map the Space

Fix geometry and color to 4 known anchor configurations. For each, render a grid across the target parameter(s).

**For a single parameter**: Sweep at 5-7 values across 4 anchors = 20-28 images.

**For a parameter pair** (e.g., luminosity x bloom): Render a 5x5 grid for each anchor = 4 x 25 = 100 images.

**The question is not "which looks best" but "what moods exist here that didn't exist before?"**

Review the grid. Where are the images that stop you? What's happening at each position? Write initial observations.

### Phase 2: Name the Territories

From the Phase 1 grid, identify 4-6 distinct aesthetic territories. Give each a name that captures its character. These are not parameter ranges -- they're moods.

Write a paragraph for each territory describing what it feels like, what it evokes, why it works.

### Phase 3: Cross-Parameter Interactions

For the most promising territories, explore how the target parameter interacts with other axes. Each interaction is a hypothesis to test with targeted renders.

Render targeted batches (5-10 images per hypothesis). Document what you find.

### Phase 4: Seed Refinement

For the most evocative configurations from Phases 2-3, sweep seed tags to find the crystalline arrangements that best embody each mood.

Two configurations with identical parameters but different seeds can feel completely different -- one might be balanced and serene, another asymmetric and dynamic.

For each target:
1. Render 10-15 random seeds
2. Select the 2-3 most compelling
3. Fine-tune: vary one seed slot at a time

### Phase 5: Curation and Writing

Select the final curated configurations. Write `output/findings.md` -- not a technical report, but a document that captures the experience of discovering these images.

For each curated configuration:
- What territory does it belong to?
- What does the image evoke?
- How do the parameters interact to create its character?
- What seed arrangement makes it work?

Write `output/project-updates.md` with specific recommendations:
- Bloom values for each starter profile in `src/core/starter-profiles.json`
- New portrait candidates worth adding
- Interaction notes to add to `docs/parameters.md`

---

## Example: Bloom Exploration

The first instance of this workflow explores the **luminosity x bloom** 2D light space.

**Phase 1 anchors**: Violet Sanctum, Sapphire Lattice, Crystal Lattice, Warm Spectrum. Each gets a 5x5 luminosity x bloom grid.

**Hypothetical territories** (to be discovered, not assumed):
- *The Dark Jewel* -- low luminosity, low bloom. Precise, intimate.
- *The Cathedral* -- low luminosity, high bloom. Faint forms in luminous haze.
- *The Architect* -- high luminosity, low bloom. Bright, crystalline, precise.
- *The Aureole* -- high luminosity, high bloom. Radiant, engulfing light.

**Phase 3 hypotheses**:
- Does high bloom + high fracture scatter light across the shards?
- Does bloom interact with spectrum? Prismatic vs monochrome diffusion?
- Does high bloom + high coherence channel the bloom directionally?
- Does bloom x flow create rings of diffused light?

**Starter profile recommendations** (example format):
- "Violet Sanctum at bloom=0.35 preserves the jewel-like precision while softening edges."
- "Crystal Lattice at bloom=0.15 -- achromatic structure is most powerful when light stays tight."

---

## Render Script

Adapt from `sampler-captures/_render-100.mjs` or the param-tuning sweep script. The script reads a JSON config listing renders to produce. Each entry specifies full controls + seed + output filename.

For Phase 1 grids, generate the config programmatically. For later phases, configs are hand-crafted based on findings.

---

## File Structure

```
workflows/image-param-exploration/
├── README.md                ← this file
├── render.mjs               ← Playwright batch render script
├── phase1-config.json       ← grid sweep render config
├── phase3-config.json       ← interaction hypothesis render config
└── output/
    ├── .gitkeep
    ├── renders/
    │   ├── phase1/          ← grid sweep images
    │   ├── phase3/          ← interaction hypothesis images
    │   └── phase4/          ← seed refinement images
    ├── configs.json         ← curated final configurations
    ├── findings.md          ← aesthetic territories and prose
    └── project-updates.md   ← starter profile values, new portrait candidates
```
