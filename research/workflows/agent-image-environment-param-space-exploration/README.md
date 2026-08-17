# Workflow: Environment Parameter Space Exploration

A systematic survey of the `BgConfig` space — the background renderer's gradient, texture, and flow parameters. The focus is the background as a standalone visual environment, evaluated entirely in isolation before considering how it interacts with the geometric interior.

> **Input:** The `BgConfig` type and its shader semantics, 68 designed configs
> **Output:** One rendered image per config, notable configs, exploration notes

---

## What This Explores

The background renderer has three independent layers:

- **Gradient** — `radial` / `vertical` / `diagonal` type, 2–8 color stops, any RGB value
- **Texture** — `none` / `noise` / `voronoi` / `flow-lines`, with scale (0–1) and strength (0–1)
- **Flow** — `none` / `directional` / `orbital` distortion of the texture UV, with angle and strength

The full context for understanding this space is at `workflows/shared/environment-context.md`.

> **Camera note:** Camera movement is intentionally excluded from this workflow. The background is world-space aware (a vertical gradient stays world-vertical through any orbit), but this workflow evaluates backgrounds at the default camera position only.

> **Geometry note:** Geometry is rendered with `luminosity=0.02, bloom=0, chroma=0, density=0.01` — effectively invisible. The background is the only visual subject in every render.

---

## Config Groups (68 total)

| Group | Count | What it tests |
|-------|-------|--------------|
| `gradient-baseline` | 9 | All 3 gradient types × 3 brightness levels (void, dim-amber, dim-blue) |
| `dark-ambient` | 8 | Dark environments with spectral richness — deep space, cosmic fog, abyssal teal, etc. |
| `lit-environment` | 10 | Fully lit environments — stone halls, sky, ocean, cave, forest. The major new territory. |
| `texture-survey` | 9 | All 3 texture types × fine/medium/coarse scale. Baseline: dark amber. |
| `texture-strength` | 8 | Voronoi and noise at 4 strengths (0.10/0.30/0.55/0.80). How loud should texture be? |
| `flow-distortion` | 8 | Directional and orbital flow at 3 strengths, on voronoi and flow-lines. |
| `multi-stop` | 8 | 3–6 stop gradients: tricolor sunset, fire core, aurora, ocean column, rainbow veil, marble bands. |
| `environment-portraits` | 8 | Distinctive environments not covered above: teal crystal, arctic ice, violet vortex, rose, jade strata, brass patina, cobalt depth, phosphor field. |

---

## Methodology

### Note

Maintain a running document at `output/session-log.md` for resuming across sessions.

### Phase 1: Render All Configs

```bash
# Terminal 1: start the render server
cd vite-app && npm run dev:render

# Terminal 2: run the render script
node workflows/agent-image-environment-param-space-exploration/render.mjs
```

The script produces one PNG per config in `output/renders/`:
- `001-void-radial.png`
- `002-void-vertical.png`
- ...

Supports `--start=N` for resuming. Skips existing files.

### Phase 2: Visual Review

For each rendered image, assess:

- **Gradient**: Is the tonal progression clear? Any unexpected banding?
- **Texture**: Is the pattern at the right scale and strength? Does it read as the intended material?
- **Flow**: Does the distortion read correctly? Is it too strong / too subtle?
- **Character**: What environment does this evoke? Is it distinct and intentional?

Mark any configs that feel weak, muddled, or unintentional as duds.

### Phase 3: Refinement

For each dud:
1. Diagnose: is the background invisible? Too bright? Texture too harsh or too subtle?
2. Adjust the bgConfig (stop brightness, texture strength/scale, flow strength)
3. Re-render

The most common issues expected:
- **Texture invisible**: increase `strength` to 0.40+, or check that the gradient has enough tonal range for texture contrast to read.
- **Gradient too subtle**: multiply stop RGB values.
- **Flow distortion too strong**: reduce `flow.strength` below 0.50.
- **Lit environments too uniform**: add a mid-stop or increase the spread between min and max stops.

### Phase 4: Curation

Select notable configs for `output/notable.json`. Write findings to `output/exploration-notes.md`.

Key questions to answer:
1. Which texture type produces the most interesting standalone environments?
2. What brightness range feels "right" for the background as a primary visual element?
3. Which multi-stop gradients are most evocative?
4. What's the recommended texture strength range for subtlety vs presence?
5. Which configs have strong enough identity to anchor a seed mapping?

Write recommendations to `output/project-updates.md`:
- Which background configs merit use as presets or starter profiles?
- Should the BgConfig controls be exposed in the editor UI? Which parameters?
- Any parameter range adjustments needed?
- Seed mapping candidates: which configs map naturally to which character spectra?

---

## File Structure

```
workflows/agent-image-environment-param-space-exploration/
├── README.md                        ← this file
├── configs.json                     ← 68 background configs
├── render.mjs                       ← Playwright bg-only render script
└── output/
    ├── .gitkeep
    ├── renders/                     ← one image per config
    │   ├── 001-void-radial.png
    │   ├── 002-void-vertical.png
    │   └── ...
    ├── session-log.md               ← running briefing for resuming
    ├── notable.json                 ← curated standout configs
    ├── exploration-notes.md         ← findings per group
    └── project-updates.md           ← bg presets, UI recommendations, seed mapping candidates
```

---

## API Requirements

This workflow uses `window._renderer.setBgConfig(bgConfig)` (exposed on the render page's `_renderer` object):

```typescript
setBgConfig(config: BgConfig): void;
```

This method overrides the derived background (from `deriveParams`) with an explicit config, then `renderFrame()` is called to re-render. The geometry is rendered first with `renderWith(MINIMAL_SEED, MINIMAL_CONTROLS)` at effectively zero visibility.
