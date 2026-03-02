# Workflows

Standalone processes for tuning, exploring, and surveying the image parameter space. Each workflow is designed to run in an isolated conversation or session, producing self-contained output that includes actionable recommendations for updating the project.

## Workflow Types

| Workflow | Purpose | When to run |
|----------|---------|-------------|
| [image-param-tuning/](image-param-tuning/) | Verify a parameter's derivation curves are usable and perceptually even | After implementing a new parameter |
| [image-param-exploration/](image-param-exploration/) | Creative deep-dive into a specific parameter or parameter pair | After tuning confirms curves are healthy |
| [image-param-space-exploration/](image-param-space-exploration/) | Broad survey of the full N-dimensional parameter space | After major parameter additions or periodically |

### Typical sequence for a new parameter

1. **Implement** the parameter in `lib/core/params.ts`, shaders, materials, HTML
2. **Tune** via `image-param-tuning` -- sweep the range, fix dead zones, adjust curves
3. **Explore** via `image-param-exploration` -- discover aesthetic territories, find starter profile values
4. **Survey** via `image-param-space-exploration` -- expand the configuration library across the full space

## Output Convention

Every workflow writes to its own `output/` directory:

```
workflows/{workflow-name}/
├── README.md               ← methodology, phases, when to use
├── output/
│   ├── renders/            ← rendered images
│   ├── findings.md         ← observations and prose
│   ├── configs.json        ← discovered configurations
│   └── project-updates.md  ← actionable recommendations for updating the project
└── {scripts, configs}      ← workflow-specific tooling
```

The `output/project-updates.md` file is key -- it translates findings into specific actions: "update starter-profiles.json with these bloom values", "adjust these derivation curves in params.ts", "add these configs as new portraits".

## Operational Scripts (in `scripts/`)

These are not workflows -- they're build tools that run when source data changes.

| Script | Purpose | Trigger |
|--------|---------|---------|
| `scripts/gen-thumbs.mjs` | Portrait carousel thumbnails -> `public/thumbs/` | Starter profiles change |
| `scripts/gen-fold-anims.mjs` | Fold animation sprites -> `public/thumbs/` | Starter profiles change |
| `scripts/gen-anim.*` | Full animation video (Playwright + ffmpeg) | On demand |
| `scripts/gen-loop.*` | Looping morph video (Playwright + ffmpeg) | On demand |

## Historical (in `sampler-captures/`)

The `sampler-captures/` folder contains artifacts from the first parameter-space exploration (11 parameters, 100 configurations). Key files:

- `_100-configs.json` -- 100 configurations from the 11-parameter survey
- `_notable_configs.json` -- curated standout configurations
- `_dimensional_geometry_exploration_notes.md` -- findings
- `_render-100.mjs` -- batch render script
- `_prompt-*.md` -- session prompts used to guide past explorations

These are retained as reference. New exploration work uses `workflows/image-param-space-exploration/`.

## Prerequisites

All Playwright-based workflows require a running dev server:

```bash
npx vite --port 5204
```

Render scripts navigate to `http://localhost:5204/sampler.html` and drive the renderer via browser automation.
