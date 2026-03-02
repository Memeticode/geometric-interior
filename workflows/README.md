# Workflows

Standalone processes for tuning, exploring, and surveying the image parameter space. Each workflow is designed to run in an isolated conversation or session, producing self-contained output that includes actionable recommendations for updating the project.

## Workflow Types

| Workflow | Purpose | When to run |
|----------|---------|-------------|
| [agent-image-param-exploration/](agent-image-param-exploration/) | Verify a parameter's derivation curves are usable and perceptually even | After implementing a new parameter |
| [agent-image-param-space-exploration/](agent-image-param-space-exploration/) | Broad survey of the full N-dimensional parameter space | After major parameter additions or periodically |
| [image-dialogue/](image-dialogue/) | Freeform conversation with the renderer to create a single image | When you want to explore without a plan |
| [agent-introspective-journey-image-generation/](agent-introspective-journey-image-generation/) | Guided multi-phase convergence to a single image | When you want a structured path to a specific image |

### Image generation workflows

The dialogue and journey workflows both depend on the shared context library at [shared/image-gen-context.md](shared/image-gen-context.md). Load this into your session before starting either workflow — it contains the parameter vocabulary, known recipes, translation guide, and rendering protocol.

### Typical sequence for a new parameter

1. **Implement** the parameter in `lib/core/params.ts`, shaders, materials, HTML
2. **Tune** via `agent-image-param-exploration` -- sweep the range, fix dead zones, adjust curves
3. **Survey** via `agent-image-param-space-exploration` -- expand the configuration library across the full space

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
| `scripts/render-single.mjs` | Render one or more configs to PNG (used by dialogue + journey workflows) | On demand |
| `scripts/gen-starter-profile-images.mjs` | Portrait thumbnails -> `public/static/images/portraits/` | Starter profiles change |
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

These are retained as reference. New exploration work uses `workflows/agent-image-param-space-exploration/`.

## Prerequisites

All Playwright-based workflows require a running dev server:

```bash
npx vite --port 5204
```

Render scripts navigate to `http://localhost:5204/sampler.html` and drive the renderer via browser automation.
