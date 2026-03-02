# Workflow: Image Dialogue

A freeform conversation between you and the renderer. No predetermined structure — just render, look, talk, adjust, repeat. The output is a single image. The journey is the conversation itself.

---

## When to Use

- When you have a feeling, mood, or visual idea and want to find it in parameter space
- When you want to explore without a plan — let the image guide you
- When the process of getting there matters as much as the result

## Setup

1. Start a dev server: `npx vite --port 5204`
2. Load the shared context: read `workflows/shared/image-gen-context.md` into your session
3. Create `workflows/image-dialogue/output/` if it doesn't exist

## Process

There is no fixed process. The general loop is:

1. **Start somewhere** — a mood, a word, an existing config, or random parameters
2. **Render** — write a config JSON, run `node scripts/render-single.mjs`
3. **Look** — read the rendered PNG, describe what you see honestly
4. **Talk** — the user says what they feel, what to change, or where to go next
5. **Adjust** — translate the feedback into parameter changes (use the translation guide)
6. **Repeat** until the image is right

### Starting points

If the user provides a mood or intent, begin by designing 1–3 initial configs informed by the known recipes. If starting from nothing, pick something from the starter profiles or use mid-range defaults with a distinctive hue.

### When to seed-tune

Once the parameters feel right, try the 5-variant seed sweep before declaring the image final. The arrangement seed controls composition — where light falls, how forms frame each other.

## Output

```
workflows/image-dialogue/output/
├── {name}.png              ← the final image
├── {name}.json             ← the final config (seed + controls)
└── session-log.md          ← optional: resumption briefing if the session spans multiple conversations
```

The config JSON should be a complete, self-contained record:

```json
{
  "name": "Night Bloom",
  "seed": [13, 5, 9],
  "controls": {
    "topology": "flow-field",
    "density": 0.08,
    "luminosity": 0.12,
    "bloom": 0.80,
    "fracture": 0.45,
    "coherence": 0.82,
    "hue": 0.94,
    "spectrum": 0.25,
    "chroma": 0.55,
    "scale": 0.5,
    "division": 0.5,
    "faceting": 0.5,
    "flow": 0.28
  }
}
```

## Session Continuity

If a conversation is interrupted, write a brief `session-log.md` capturing:
- The current config (full JSON)
- What's been tried and why it was changed
- What the user wants to adjust next
- The name/intent of the image

A new session can read this file and the shared context to continue.

## Tips

- **Small moves**: Change one or two parameters at a time. Large jumps lose the thread.
- **Name things early**: Giving the image a working name creates intent, and intent guides parameter choices.
- **Describe before adjusting**: Articulate what you see before reaching for numbers. The description often reveals what to change.
- **Trust darkness**: Low luminosity + bloom is one of the richest territories. Don't default to bright.
- **The seed matters**: If the parameters feel right but the composition doesn't, try different seeds before changing parameters.
