# Image Generation Context

You are guiding a visual creative process — generating images of luminous geometric forms rendered in a dark space. Think in terms of light, space, mood, and energy. Describe what you see before adjusting parameters. Trust perceptual responses over numerical analysis.

---

## The Parameter Space

12 continuous axes (0–1) + a 3-slot seed tag. Every point in this space produces a unique composition.

### Geometry

| Parameter | What it controls | Low (0) | Mid (0.5) | High (1) |
|-----------|-----------------|---------|-----------|----------|
| **density** | Population — how many elements | ~100 elements. Sparse, intimate, individual forms readable | Balanced richness | 1000+ elements. Dense, nebular, atmospheric |
| **fracture** | Fragmentation — how shattered | Compact, tight, crystalline | Moderate scatter | Explosive shards, wide spread, architectural |
| **scale** | Size distribution — big forms vs fine particles | Monumental. Few bold slabs | Balanced mix | Atmospheric. Many small particles, diffuse |
| **division** | Topology — lobe structure | Single unified mass | Two lobes (bifurcated) | Three lobes (trifurcated) |
| **faceting** | Crystal character — face quality | Broad, flat, smooth panels | Mixed (70% quads) | Sharp angular crystals, tight spirals |

### Light

| Parameter | What it controls | Low (0) | Mid (0.5) | High (1) |
|-----------|-----------------|---------|-----------|----------|
| **luminosity** | Energy — overall brightness | Dark. Subdued, rich saturated colors. Moody, intimate | Moderate energy | Bright. Radiant, luminous |
| **bloom** | Emanation — how far light spreads | Tight pools, defined edges. Precise, architectural | Visible halos, structure legible | Diffuse atmosphere, soft aureoles. Ethereal |

The luminosity × bloom interaction is the richest in the space:
- **Dark + tight bloom**: Dark jewel. Dim but sharp.
- **Dark + high bloom**: Ethereal, mystical. Faint forms in soft glow.
- **Bright + tight bloom**: Crisp, architectural. Crystal edges.
- **Bright + high bloom**: Radiant aureoles. Luminous atmosphere.

### Color

| Parameter | What it controls | Low (0) | Mid (0.5) | High (1) |
|-----------|-----------------|---------|-----------|----------|
| **hue** | Dominant wavelength | Red (0°) | Teal (180°) | Wraps back to red (360°) |
| **spectrum** | Color range — mono to prismatic | Near-monochrome, unified identity | Moderate variation (~30°) | Full rainbow, every hue present |
| **chroma** | Saturation — gray to vivid | Achromatic. Crystal-lattice, pure structure | Moderate color | Fully vivid. Intense, saturated |

Key hue landmarks: 0.02 red, 0.06 amber/gold, 0.09 orange, 0.11 saffron, 0.16 yellow, 0.26-0.30 chartreuse/lime, 0.375 emerald, 0.45 turquoise, 0.51 teal, 0.56 cyan, 0.625 sapphire, 0.70 indigo, 0.744 violet, 0.867 amethyst, 0.94 rose/pink.

### Space

| Parameter | What it controls | Low (0) | Mid (0.5) | High (1) |
|-----------|-----------------|---------|-----------|----------|
| **coherence** | Organization — flow alignment | Chaotic. Random orientation, high-frequency noise | Moderate alignment | Highly organized. Visible directional structure |
| **flow** | Spatial pattern — field shape | Radial starburst from center | Perlin noise (organic) | Orbital bands wrapping around form |

At low coherence, flow is irrelevant — everything is random. At high coherence, flow dramatically shapes the composition.

### Seed

`[arrangement, structure, detail]` — three integers 0–17 indexing independent PRNG streams.

- **Arrangement** (slot 0): Where geometric planes are placed, how they frame each other, where bright/dark regions fall. This is the most impactful slot — changing it creates a completely different composition from identical parameters.
- **Structure** (slot 1): Folding chain geometry, draping patterns.
- **Detail** (slot 2): Color jitter, fine variation.

---

## Known Recipes

These are proven parameter combinations that produce specific aesthetics.

### Night recipe
`luminosity: 0.10, bloom: 0.70–0.80`
Works at every hue. Produces atmospheric beauty — forms emerging from darkness with soft bloom halos. The most significant territory discovered in the exploration. Combine with any hue for a "Night {Color}" variant.

### Material / patina
`chroma: 0.12–0.20` at warm hues (0.06–0.10)
Very low saturation at amber creates aged metal, bronze, pewter qualities. The geometry reads as a material surface rather than colored light.

### Atmospheric silk
`scale: 1.0, faceting: 0.0, bloom: 0.50–0.60`
Vast smooth gossamer forms. Wide atmospheric spread. Smooth surfaces + large scale + bloom diffusion.

### Sharp radial burst
`faceting: 1.0, flow: 0.0, coherence: 0.85+`
Crystal starburst emanating from center. Maximum angular sharpness in radial alignment.

### Contemplative sparse
`density: 0.02–0.03, coherence: 0.85+`
Scattered starlike points in vast darkness. Nearly seed-stable — changing the seed barely changes the image. Meditative stillness.

### Turbulent storm
`density: 0.20–0.25, coherence: 0.10–0.15, flow: 0.85`
Angular fragments swept by orbital flow. Low coherence scatters; high flow gives directional energy. Kinetic, explosive.

### Muted fog
`chroma: 0.20–0.30, bloom: 0.55–0.65`
Desaturated forms in atmospheric haze. Quiet, understated. Works across hues — muted rose, jade fog, pewter, washed indigo.

---

## Translation Guide

When receiving perceptual feedback, map it to parameter adjustments:

| Feedback | Primary adjustment | Secondary |
|----------|-------------------|-----------|
| "Too bright" | luminosity -0.10 to -0.20 | |
| "Too dark" | luminosity +0.10 to +0.20 | |
| "Too chaotic / messy" | coherence +0.15 to +0.30 | fracture -0.10 |
| "Too static / rigid" | coherence -0.15 to -0.30 | fracture +0.10 |
| "Feels flat" | bloom +0.15 | or fracture +0.10 |
| "Too blurry / soft" | bloom -0.15 to -0.25 | faceting +0.15 |
| "Needs more drama" | fracture +0.15, or coherence -0.15 | bloom +0.10 |
| "Too monochrome" | spectrum +0.15 to +0.30 | |
| "Too colorful / busy" | spectrum -0.15, or chroma -0.15 | |
| "Feels cold" | hue → 0.02–0.08 range | chroma +0.10 |
| "Feels warm (too warm)" | hue → 0.50–0.65 range | |
| "Feels muddy" | chroma +0.15, or density -0.05 | bloom -0.10 |
| "Too crowded" | density -0.05 to -0.10 | scale +0.10 |
| "Too sparse / empty" | density +0.05 to +0.10 | scale -0.10 |
| "Needs more presence" | scale -0.15 (bigger forms) | density +0.03 |
| "Needs more atmosphere" | scale +0.15, bloom +0.10 | |
| "Needs sharper edges" | faceting +0.20 | bloom -0.10 |
| "Needs smoother forms" | faceting -0.20 | bloom +0.10 |

Adjustments are cumulative and approximate — trust your judgment. Small changes (0.05) for fine-tuning, larger changes (0.15–0.30) for directional shifts.

---

## Seed Tuning Protocol

When a config's parameters feel right but the composition could be better, tune the arrangement seed:

1. Take the current config and create 5 variants, changing only the arrangement slot (index 0) to: 0, 5, 9, 13, 17
2. Render all 5
3. Pick the winner based on which composition best serves the image's intent

**When to seed-tune**: After parameters are settled, before declaring an image final. Expected improvement rate: ~86%. Only skip for ultra-sparse configs (density < 0.03) or ultra-coherent configs (coherence > 0.90) which are nearly seed-stable.

**Winner tendencies**: a13 wins most often for dramatic/conceptual pieces. a0 wins for wide atmospheric spreads. a17 for radial/monumental compositions. All five have value.

---

## Rendering

Render images using the terminal script:

```bash
# Single config
node scripts/render-single.mjs config.json --output output/

# Config file format (single):
{ "name": "My Image", "seed": [5, 3, 2], "controls": { "topology": "flow-field", "density": 0.08, ... } }

# Config file format (batch):
[
  { "name": "Variant A", "seed": [0, 3, 2], "controls": { ... } },
  { "name": "Variant B", "seed": [5, 3, 2], "controls": { ... } }
]
```

**Prerequisites**: Render server running on port 5204 (`npm run dev:render`).

Output PNGs are named from the config name (lowercased, hyphenated). Read rendered images with the Read tool to see the result.

---

## Image Reading Protocol

When describing a rendered image, cover:

1. **Composition** — Where is the light? How are forms distributed? Is there a focal point? Symmetry?
2. **Color** — Dominant hue, warmth/coolness, saturation level, any secondary colors
3. **Mood** — What feeling does it evoke? What does it remind you of?
4. **Energy** — Still or dynamic? Concentrated or diffuse? Intimate or vast?
5. **What works** — What makes this image compelling (or not)?
6. **What to adjust** — Based on the intent, what parameter changes would improve it?

Be specific and honest. "This is beautiful" is less useful than "the bloom creates a soft haze that makes the geometry feel dreamlike, but the composition is too centered — a different seed might create more dynamic framing."

---

## Parameter Boundaries

Ranges to be cautious with:

- **luminosity > 0.90 + bloom > 0.50**: Blowout zone. Structure becomes indistinguishable glow.
- **density > 0.50**: Fog-of-particles territory. Loses individual element readability.
- **scale = 0.0 + density > 0.15**: Concentration danger zone. All elements at minimum size in one spot. Reduce luminosity below 0.40 to compensate.
- **luminosity = 1.0**: Only viable with bloom < 0.30 and low density.

Safe creative sweet spots:
- **density 0.05–0.12**: Readable geometry with atmospheric space
- **luminosity 0.35–0.55**: The versatile middle range
- **bloom 0.30–0.60**: Atmospheric without losing structure
- **coherence 0.70–0.90**: Organized enough to see flow patterns, not rigidly aligned
