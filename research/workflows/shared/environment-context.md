# Environment Context — Background Parameter Space

You are exploring the visual parameter space of the **Background** renderer: a world-space gradient + optional procedural texture + optional flow distortion. This is independent of the geometric interior parameter space. Think in terms of atmosphere, environment, material — the space that the geometry inhabits.

---

## The BgConfig Space

Each background is defined by three orthogonal layers:

### 1. Gradient

```
gradient.type  : 'radial' | 'vertical' | 'diagonal'
gradient.stops : 2–8 stops, each { t: 0–1, rgb: [r, g, b] }
```

**Types:**
| Type | How it reads | Key use |
|------|-------------|---------|
| `radial` | Vignette: center → edge (distance from screen centre) | Interior lit from center, spotlight effect |
| `vertical` | World-space Y: sky=top, ground=bottom | Sky/ground split, stays correct as camera tilts |
| `diagonal` | Screen-space upper-left → lower-right | Dynamic light sweep, dramatic diagonal |

**Colors are unrestricted** — any RGB in [0, ∞). The framebuffer clamps to [0,1] after rendering. Practical range: near-black (0.001–0.008) for dark environments, 0.05–0.35 for dim ambient, 0.40–0.95 for lit environments.

**Multi-stop gradients** unlock complex tonal progressions:
- 2 stops: simple center-to-edge or sky-to-ground
- 3 stops: tricolor (sky → horizon → ground), adds a distinct band
- 4 stops: dramatic progressions (fire core, ocean column, aurora)
- 6–8 stops: rainbow veil, geological strata — use sparingly

### 2. Texture

```
texture.type     : 'none' | 'noise' | 'voronoi' | 'flow-lines'
texture.scale    : 0–1  (0 = fine/dense, 1 = coarse/large)
texture.strength : 0–1  (0 = invisible, 1 = full)
```

Texture is sampled in **spherical world space** from the world ray — it rotates correctly with the camera.

| Type | Character | Best for |
|------|-----------|----------|
| `none` | Plain gradient | Pure atmospheric, most elegant |
| `noise` | Organic, cloudy, fractal | Atmosphere, fog, haze, clouds |
| `voronoi` | Geometric cells, tessellation | Mineral, crystalline, cracked earth, the reference image aesthetic |
| `flow-lines` | Directional contour lines | Magnetic fields, ocean currents, topographic maps |

**Scale guidance:**
- 0.0–0.20: Fine — many tiny cells/lines, micro-detail
- 0.25–0.55: Medium — clearly readable pattern
- 0.60–1.0: Coarse — few large cells/bands, monumental scale

**Strength guidance:**
- 0.05–0.15: Whisper — texture is subliminal, adds depth without announcing itself
- 0.20–0.40: Subtle — visible on attention, enriches without dominating
- 0.45–0.65: Visible — texture has presence, clearly part of the composition
- 0.70–1.0: Dominant — texture competes with or leads the visual

### 3. Flow Distortion

```
flow.type     : 'none' | 'directional' | 'orbital'
flow.angle    : radians (used by directional)
flow.strength : 0–1
```

Flow warps the texture UV before sampling — it does not move the gradient.

| Type | Effect | Key use |
|------|--------|---------|
| `none` | No distortion | Default; gradient and texture unwarped |
| `directional` | Uniform shear along `angle` | Wind, current, light direction |
| `orbital` | Radial warp around sphere centre | Vortex, magnetic field, planetary atmosphere |

Flow is most meaningful on `voronoi` or `flow-lines` textures. On `noise`, it adds directional bias to the cloud shapes.

---

## Background × Geometric Interior (for future reference)

The geometric interior renders with **additive blending** on top of the background. When the combined exploration happens later:

- **Dark background + bright geo**: The original recipe — geo radiates against void.
- **Bright background + dark geo**: Additive blending means geo can only ADD light — it cannot darken the background. Dark geo on a bright background is nearly invisible.
- **Lit environments** (brightness > 0.15) require higher geo luminosity (0.45+) to remain visible.

This workflow evaluates backgrounds in isolation first. Combined bg+geo exploration is a separate future workflow.

---

## Translation Guide

When seeing a rendered environment and wanting to adjust:

| Observation | Adjustment |
|-------------|-----------|
| Background too dark overall | Increase stop RGB values by 2–4× |
| Background too bright, washing out geo | Reduce stop RGB values, or accept the lit-environment reading |
| Gradient feels abrupt, sharp transition | Add a mid-stop to soften the transition |
| Texture invisible | Increase `strength` to 0.40+ |
| Texture too harsh | Reduce `strength` to 0.15–0.25 |
| Texture cells too many/small | Increase `scale` toward 0.5–0.8 |
| Texture cells too few/large | Decrease `scale` toward 0.1–0.3 |
| Flow distortion too strong, breaks texture | Reduce `flow.strength` |
| Background reads as flat, uniform | Add texture or change gradient type |
| Background competes with geometry | Reduce texture strength, darken stops |

---

## Config Format

Each config in `configs.json` specifies the background; the render script handles the geometry.

```json
{
  "name": "Deep Space",
  "group": "dark-ambient",
  "bgNote": "Dark blue-violet radial — richer than void baseline, suggests interstellar medium.",
  "bgConfig": {
    "gradient": {
      "type": "radial",
      "stops": [
        { "t": 0.0, "rgb": [0.015, 0.020, 0.075] },
        { "t": 1.0, "rgb": [0.0, 0.0, 0.005] }
      ]
    },
    "texture": { "type": "none", "scale": 0.5, "strength": 0.0 },
    "flow": { "type": "none", "angle": 0.0, "strength": 0.0 }
  }
}
```

For Group 8 (geo interaction studies), configs additionally specify `controls` to override the reference canonical geometry:

```json
{
  "name": "Warm Bg Cold Geo",
  "group": "geo-interaction",
  "bgNote": "...",
  "bgConfig": { ... },
  "controls": {
    "topology": "flow-field", "density": 0.05, "fracture": 0.40,
    "scale": 0.55, "coherence": 0.80, "division": 0.20, "faceting": 0.35,
    "luminosity": 0.40, "bloom": 0.25, "hue": 0.51, "spectrum": 0.15,
    "chroma": 0.70, "flow": 0.50
  }
}
```

---

## Rendering

One render is produced per config — the background in isolation:

```bash
# Run the dev render server first:
npm run dev:render   # in vite-app/, port 5204

# Then run the render script:
node workflows/agent-image-environment-param-space-exploration/render.mjs [--start=N]
```

Output naming: `{NNN}-{slug}.png` — the background alone.

**Minimal geometry** (used for all renders):
- density=0.01, luminosity=0.02, bloom=0, chroma=0
- Geometry is effectively invisible — background is the only visual subject

---

## Image Reading Protocol

For each rendered background, assess:

1. **Gradient**: Is the tonal progression clear? Any unexpected banding?
2. **Texture**: Is the pattern at the right scale and strength? Does it read as the intended material?
3. **Flow**: Does the distortion read correctly? Is it too strong / too subtle?
4. **Character**: What environment does this evoke? Is it distinct and intentional?
5. **Verdict**: Strong / Weak / Dud — and if weak/dud, what specific adjustment would fix it?
