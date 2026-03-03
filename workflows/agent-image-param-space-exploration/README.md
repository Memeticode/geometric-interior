# Workflow: Image Parameter Space Exploration

A systematic survey of the full N-dimensional parameter space. The goal is broad coverage -- render many configurations, identify gaps, fill them, and curate standout images. This is how the project's visual vocabulary expands.

The first run of this workflow produced 100 configurations across the 11-parameter space (artifacts in `sampler-captures/`). Future runs add the bloom dimension and any subsequent parameters.

> **Input:** Current parameter set semantics, existing configurations from prior runs, starter profiles
> **Output:** Full configuration set (`configs.json`), curated notable configs, exploration notes, and project update recommendations

---

## When to Use

- After a major parameter addition (e.g., bloom extends the space from 11D to 12D)
- Periodically, to fill coverage gaps discovered during creative work
- When starter profiles need refreshing or expanding

## Inputs

- The current parameter set and its semantics (`docs/parameters.md`)
- Existing configurations from prior runs (for gap analysis)
- The starter profiles (`src/core/starter-profiles.json`)

## Outputs (in `output/`)

- `output/renders/` -- All rendered images, named `{NNN}-{slug}.png`
- `output/configs.json` -- The full configuration set (all entries, not just new)
- `output/notable.json` -- Curated standout configurations
- `output/exploration-notes.md` -- Observations, gap analysis, per-group commentary
- `output/project-updates.md` -- Recommendations: new starter profiles, parameter adjustments, documentation updates

---

## Methodology

### Note:

Maintain a running document at workflows/agent-image-param-space-exploration/output/session-log.md that serves as a self-contained briefing for resuming after interruptions. The user can point a new session at this file to pick up where we left off.

### Phase 1: Gap Analysis

Review existing coverage across all parameter dimensions. For each parameter, identify ranges with zero or very few configurations.

Format as a table:

| Dimension | Gap | Existing coverage |
|-----------|-----|-------------------|
| Hue | Yellow 0.15-0.20 | 0 configs |
| Bloom | Entire range | New parameter, no coverage |
| Flow | Mid-range 0.25-0.45 | 2 configs |

### Phase 2: Config Design

Design new configurations targeting the identified gaps. Organize by theme group:

- **Gap fills**: Configurations placed directly in under-explored ranges
- **Interaction combos**: Configurations testing specific parameter interactions
- **Mood/aesthetic**: Configurations designed to evoke a particular feeling
- **Variants**: Twists on existing standout configs (change one parameter)
- **Stress tests**: Extreme values, pathological combinations

Each config should have a name, full controls object, and a brief note explaining what it's testing.

### Phase 3: Batch Render

Render all configurations using the Playwright render scripts.

- Skip already-cached renders (check output dir for existing files)
- Support `--start=N` for resuming after interruption
- Log node count per render for sanity checking

### Phase 4: Visual Review

Read each rendered image and assess:
- **Quality**: Is the image well-exposed? Any blowout or full-black?
- **Distinctiveness**: Does it look different from its neighbors?
- **Interest**: Does it evoke something? Would someone stop and look?

Mark duds for replacement.

### Phase 5: Refinement

For each dud:
1. Diagnose the issue (too dark? blown out? boring?)
2. Design a replacement config (adjust luminosity, bloom, density, etc.)
3. Re-render

Iterate until no duds remain.

### Phase 6: Curation

- Select the most notable configurations for `output/notable.json`
- Write `output/exploration-notes.md` with per-group observations
- Write `output/project-updates.md` with recommendations:
  - Which configs merit promotion to starter profiles?
  - Any parameter range issues discovered (feed back to param-tuning)?
  - Documentation updates for `docs/parameters.md`?

---

## Historical Reference

The first run of this workflow (before `workflows/` existed) produced:

- `sampler-captures/_100-configs.json` -- 100 configurations across the 11-parameter space
- `sampler-captures/_notable_configs.json` -- curated standouts
- `sampler-captures/_dimensional_geometry_exploration_notes.md` -- findings
- `sampler-captures/v3-50/` -- rendered images
- `sampler-captures/_render-100.mjs` -- batch render script

These remain in `sampler-captures/` as reference. New exploration runs produce output in `workflows/agent-image-param-space-exploration/output/`.

---

## Render Script

Adapt from `sampler-captures/_render-100.mjs`. The script should:

1. Read `configs.json` from the workflow directory
2. Navigate to `http://localhost:5204/scripts/render-page.html`
3. For each config, call `renderer.renderWith(seed, controls)` and capture the canvas
4. Save as `{NNN}-{slug}.png` in `output/renders/`
5. Skip existing files, support `--start=N`

---

## File Structure

```
workflows/agent-image-param-space-exploration/
├── README.md                    ← this file
├── configs.json                 ← full config set for this run
├── render.mjs                   ← Playwright batch render script
└── output/
    ├── .gitkeep
    ├── renders/                 ← all rendered images
    │   ├── 001-violet-sanctum.png
    │   ├── 002-sapphire-lattice.png
    │   └── ...
    ├── notable.json             ← curated standout configs
    ├── exploration-notes.md     ← observations and gap analysis
    └── project-updates.md       ← new portrait candidates, param adjustments
```
