# Workflow: Introspective Image Generation Journey

A structured convergence from broad exploration to a single image. Four phases funnel from initial attempts through variation and directed search to a final, seed-tuned result. The output is one image — but the journey through parameter space is the point.

---

## When to Use

- When you want a guided, multi-phase process rather than freeform conversation
- When you have a general direction but want to discover the specific image through exploration
- When you want to see variants and comparisons before committing

## Setup

1. Start a dev server: `npx vite --port 5204`
2. Load the shared context: read `workflows/shared/image-gen-context.md` into your session
3. Create `workflows/agent-introspective-journey-image-generation/output/` if it doesn't exist

---

## Phases

### Phase 1: Initial Attempts

**Goal**: Get 3–5 starting points into parameter space.

From the user's intent (a mood, word, visual idea, or reference), design 3–5 initial configs. Use the known recipes as starting points — the Night recipe, material recipe, atmospheric silk, etc. — and adapt them toward the stated intent.

Render all configs. Read each image and describe it: composition, color, mood, energy, what works.

Ask the user: *Which of these is closest to what you're looking for? What would you change?*

The user picks one (or describes a blend). This becomes the **anchor config**.

### Phase 2: Variants

**Goal**: Explore the neighborhood around the anchor.

Generate 5–8 variants of the anchor config:
- **Parameter jitter**: Nudge 1–2 parameters by ±0.10–0.15 per variant (different parameters each time)
- **Seed variation**: Try 2–3 different arrangement seeds on the anchor
- **Recipe blend**: If the anchor is close to a known recipe, try pushing it further into that recipe's territory

Render all variants. Read and describe each. Present the set to the user.

The user picks the best variant (or gives feedback to adjust further). Repeat this phase if needed — sometimes one round of variants isn't enough. This becomes the **refined config**.

### Phase 3: Directed Grid Search

**Goal**: Find the sweet spot for the 2 most impactful axes.

Based on the conversation so far, identify the 2 parameters that matter most for this image's character. Common candidates:
- luminosity × bloom (light character)
- density × scale (spatial feeling)
- coherence × flow (structural pattern)
- fracture × faceting (geometric character)
- hue × chroma (color identity)

Render a small grid: 5 values along each axis = 25 images. Use the refined config as the center point, with the grid spanning ±0.15–0.20 around it on each axis.

Read the grid. Identify the sweet spot — the region where the image best serves its intent.

### Phase 4: Final Selection + Seed Tuning

**Goal**: Lock in the final image.

Take the grid's best point and run the 5-variant seed sweep (arrangement slots 0, 5, 9, 13, 17). Render all 5. Pick the winner based on composition serving intent.

This is the final image.

---

## Output

```
workflows/agent-introspective-journey-image-generation/output/
├── {name}.png              ← the final image
├── {name}.json             ← the final config (seed + controls)
├── session-log.md          ← resumption briefing
└── renders/                ← all intermediate renders (optional, for the record)
    ├── phase1/
    ├── phase2/
    ├── phase3-grid/
    └── phase4-seeds/
```

### Session Log

Maintain `output/session-log.md` throughout the journey:

```markdown
## Current State
Phase: 2 — Variants
Anchor: { ...config JSON... }
Intent: "a sense of distant light in fog, cool and still"

## Phase 1 Summary
- Designed 4 initial configs: fog-silver, deep-mist, cold-glow, faded-blue
- User picked fog-silver as closest, wanted "more diffuse, less structure"

## Phase 2 Progress
- Round 1: 6 variants, user liked variant with bloom=0.65 but wanted cooler hue
- Round 2: ...
```

This allows a new session to pick up exactly where the last one left off.

---

## Pacing

- **Phase 1**: 1 render batch (3–5 images). Quick — establish direction.
- **Phase 2**: 1–3 render batches (5–8 images each). Take time here — this is where the image's character emerges.
- **Phase 3**: 1 grid render (25 images). Systematic — find the exact sweet spot.
- **Phase 4**: 1 seed sweep (5 images). Final — lock in composition.

Total: roughly 40–60 renders across the journey. The whole process can happen in one session or span multiple.

---

## Tips

- **Don't skip Phase 2**: It's tempting to jump from initial attempts to grid search. The variant phase is where intuition shapes the image — the grid search refines what the variants discover.
- **Let the user guide axis selection for Phase 3**: They know which dimensions matter most for their vision, even if they describe it in perceptual terms rather than parameter names.
- **Phase 3 grid doesn't have to be 5×5**: A 3×3 grid (9 images) works for quick convergence. 7×7 (49 images) works if the user wants exhaustive coverage. Scale to the situation.
- **The final image might not be the grid center**: The best point often surprises. That's the value of the grid — it reveals what you didn't know you were looking for.
