# Workflow: Tarot Prediction

A ritualistic, card-by-card image generation process. Each card is drawn through a combination of code-generated randomness and intuitive interpretation. The output is a spread of images with readings — a visual oracle.

> **Input:** A prompt (text), spread size (integer, 1–10), language (`en` or `es`), resolution (`sd`, `hd`, `fhd`, or `4k`)
> **Output:** N rendered images, each with a code-generated title, code-generated alt text, and one line of model-generated interpretive text. All collected in `output/index.html`.

---

## When to Use

- When you want a ritualistic, non-analytical approach to image generation
- When the starting point is a question or liminal state rather than a visual goal
- When you want multiple images to use as starting points for the introspective journey workflow

---

## Setup

1. Start the render server: `npm run dev:render`
2. Read `workflows/shared/image-gen-context.md` into your session
3. Create `workflows/tarot-prediction/output/` and `workflows/tarot-prediction/output/renders/` if they do not exist
4. Ask the user for the four inputs if not already provided:
   - **prompt** — any text (a question, a mood, a word, a sentence)
   - **spread** — number of cards to draw (1–10)
   - **language** — `en` or `es`
   - **resolution** — `sd`, `hd`, `fhd`, or `4k`

   | Resolution | Dimensions |
   |------------|------------|
   | sd         | 800×520    |
   | hd         | 1280×832   |
   | fhd        | 1920×1248  |
   | 4k         | 3840×2496  |

5. Create `output/spread.json` with the session header:

   ```json
   {
     "prompt": "...",
     "spread": N,
     "language": "en",
     "resolution": "hd",
     "timestamp": "...",
     "cards": []
   }
   ```

---

## The Ritual

Perform the following steps once per card, from card 1 to card N. Do not rush. Each step has a purpose.

### Step 1 — Shuffle

Generate a random seed using the shuffle script:

```bash
node workflows/tarot-prediction/shuffle.mjs --locale en
```

The script outputs JSON:

```json
{"seed": [7, 3, 14], "label": "Shifting, fractured, radiant", "serial": "7.3.14"}
```

Record the seed, label, and serial. This is the card's identity.

### Step 2 — Bridge

Pause.

Re-read the original prompt silently. Then read the seed label aloud (to yourself, as text): *"Shifting, fractured, radiant."*

This is the moment of connection between intention and randomness. Like cutting a deck of cards. Nothing happens here externally. The pause is the step.

### Step 3 — Draw

Generate the image configuration. The rules for this step are strict:

- **The prompt MUST NOT influence the numeric values.** Do not think about what numbers would suit the prompt. The prompt has already done its work in Step 2.
- **Do not use any tool or code to generate the numbers.** Pick each of the 12 parameter values yourself, without analysis.
- **Do not overthink.** Assign each parameter a value between 0 and 1 quickly. Trust the first number that comes to mind. Think of this as an exercise in aligning with the flow of the universe, not the immediate prompt in front of you.
- `topology` is always `"flow-field"`.

Also choose a name for this card — a short evocative phrase. Again, don't let the prompt drive this. Let it come from whatever is present.

Write the config and append a new card entry to `output/spread.json`:

```json
{
  "position": 1,
  "name": "Scattered Light",
  "seed": [7, 3, 14],
  "seedLabel": "Shifting, fractured, radiant",
  "seedSerial": "7.3.14",
  "controls": {
    "topology": "flow-field",
    "hue": 0.63,
    "spectrum": 0.28,
    "chroma": 0.44,
    "density": 0.09,
    "fracture": 0.55,
    "coherence": 0.71,
    "luminosity": 0.14,
    "bloom": 0.76,
    "scale": 0.52,
    "division": 0.38,
    "faceting": 0.33,
    "flow": 0.47
  }
}
```

Do not add `title`, `altText`, `nodeCount`, `imageFile`, or `reading` yet.

### Step 4 — Render

Write the card config to a file and render the image.

Save the config as `output/card-NN.json` (this is kept as a permanent output):

```json
{
  "name": "Scattered Light",
  "seed": [7, 3, 14],
  "controls": { ... }
}
```

Render it (use the dimensions from the resolution table):

```bash
node workflows/tarot-prediction/render-card.mjs output/card-01.json \
  --output output/renders/ \
  --width 1280 --height 832 \
  --locale en
```

The script saves `output/renders/card-01.png` and prints metadata to stdout:

```json
{"title": "Flowing Sapphire Atmospheric", "altText": "...", "nodeCount": 482}
```

Add the metadata to the card entry in `spread.json`:

```json
"title": "Flowing Sapphire Atmospheric",
"altText": "...",
"nodeCount": 482,
"imageFile": "renders/card-01.png"
```

### Step 5 — Read

Read the rendered image using the Read tool.

Look at the image. Do not think about the prompt. Do not analyze parameters. Look only at what is in front of you: the light, the forms, the feeling.

Write one line — a poetic observation grounded purely in what you see. Not what the image "means" in relation to the prompt. Not a description of parameters. One sentence, felt rather than thought.

Add it to the card entry in `spread.json`:

```json
"reading": "Light that has forgotten how to move, waiting for permission."
```

---

Repeat Steps 1–5 for each card.

---

## After All Cards Are Drawn

Generate the index.html viewer:

```bash
node workflows/tarot-prediction/build-index.mjs
```

Open `output/index.html` to review the full spread.

Share the results with the user. Ask whether any card should become the starting point for a deeper exploration via the introspective journey workflow.

---

## Output

```
workflows/tarot-prediction/output/
├── spread.json          ← the canonical manifest (maintained throughout)
├── card-01.json         ← individual config files (seed + controls, usable with render-single.mjs)
├── card-02.json
├── ...
├── renders/
│   ├── card-01.png
│   ├── card-02.png
│   └── ...
└── index.html           ← generated viewer
```

---

## Connecting to the Introspective Journey Workflow

Any card's config file (`output/card-NN.json`) can seed the introspective journey directly:

1. Use the card's config JSON as the anchor config
2. Start the introspective journey workflow with that config as the starting point
3. Use the card's `reading` as the initial intent

The tarot reading reveals; the journey refines.

---

## Tips

- **Trust the Bridge step.** The pause between reading the prompt and drawing the card is where the ritual lives. Don't skip it.
- **The Draw step is not a translation.** Resist the urge to make parameters "match" the prompt. The images surprise precisely because they don't match.
- **Short readings are better.** One sentence. Less is more. The image has already said most of it.
- **The spread size affects the reading.** A 3-card spread creates a narrative arc; a 10-card spread creates a field. Smaller spreads invite more attention per card.
- **Keep the readings honest.** Write what you see, not what you wish the image said.
