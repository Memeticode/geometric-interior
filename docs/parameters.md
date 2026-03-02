# Parameter Reference

Geometric Interior's visual output is controlled by 12 continuous parameters, each a 0–1 scaling axis. Together they define a 12-dimensional creative space where every point produces a unique composition of luminous geometric forms.

The parameters fall into four groups: **geometry** (5), **light** (2), **color** (3), and **space** (2).

---

## Geometry

### density
**Abundance** — how populated the space is.

Controls the total number of geometric elements across all tiers: guide curves, folding chains, hero dots, medium dots, interior scatter, and micro particles. At 0, the scene contains roughly 100 elements — a sparse, intimate composition where individual forms are distinct. At 1, over 1000 elements fill the space.

Higher density produces richer, more complex compositions but increases the risk of additive blowout (elements overlapping until structure becomes indistinguishable glow). A density-aware opacity system compensates by scaling face opacity down at high counts.

- **0.0**: Sparse. Individual geometric elements are clearly readable. Starlike.
- **0.5**: Balanced. Rich structure without losing legibility.
- **1.0**: Dense. Abundant geometry — atmospheric, nebular.

### fracture
**Fragmentation** — how shattered or whole the geometry is.

Controls the degree of geometric scatter across all subsystems simultaneously: envelope radii (how elongated the form is), guide curve curvature, chain spread, dot scatter radius, and chromatic aberration. This is the most coherently designed parameter — every subsystem answers "how broken?" in the same perceptual direction.

- **0.0**: Compact and whole. Tight clustering, gentle curves, minimal scatter. Intimate, crystalline.
- **0.5**: Moderate fragmentation. Visible structure with some dispersion.
- **1.0**: Highly fractured. Scattered shards, wide spread, angular geometry. Explosive, architectural.

### scale
**Granularity** — the size distribution of geometric elements.

Controls the balance between tiers without changing the total element count (which is governed by density). At low values, primary chains and hero dots dominate — a few bold geometric forms. At high values, tertiary chains and micro particles dominate — a cloud of fine particles.

This parameter is independent of density: you can have a dense scene of large forms (high density, low scale) or a sparse cloud of tiny particles (low density, high scale).

- **0.0**: Monumental. Few large, bold geometric slabs. Architectural presence.
- **0.5**: Balanced mix of primary, secondary, and tertiary elements.
- **1.0**: Atmospheric. Many small particles and fine chains. Nebular, diffuse.

### division
**Topology** — the form's large-scale shape.

Controls the envelope's symmetry breaking through groove depth and count. The envelope is a perturbed ellipsoid; grooves carved into it create distinct lobes. At low values, the form is a single unified mass. At the midpoint, a primary groove bifurcates it into two lobes (the default dual-core look). At high values, a secondary groove at 120° creates three lobes.

- **0.0**: Single lobe. Unified, centered, spherical.
- **0.5**: Two lobes. Bifurcated — the characteristic dual-core structure.
- **1.0**: Three lobes. Trifurcated — a triangular arrangement of luminous cores.

### faceting
**Crystal character** — the quality of individual geometric faces.

Controls the local geometry of each folding chain link: the ratio of broad quads to sharp triangles, the dihedral fold angle between successive faces, and the contraction rate (how much each link shrinks relative to the previous). These properties determine whether individual shards read as smooth panels or angular crystals.

- **0.0**: Broad, flat panels. Mostly quads, gentle folds, minimal contraction. Open, planar.
- **0.5**: Mixed character. Current default — 70% quads, moderate dihedral angles.
- **1.0**: Sharp, angular shards. Mostly triangles, aggressive folds, strong contraction. Tight spiraling crystals.

---

## Light

### luminosity
**Energy** — the overall brightness and glow intensity.

Controls the scene's illumination budget: per-element glow strength, lighting factors (back-light, front-light, ambient), and fog/background brightness. A density-aware attenuation system prevents high-density scenes from blowing out at high luminosity.

The luminosity range has been tuned so that the full 0–1 range is usable. At 0, scenes are dim but clearly visible — a "dark mode" that preserves color saturation and structural legibility. At 1, scenes are bright but not blown white.

- **0.0**: Dark. Subdued glow, rich saturated colors, structure clearly visible. Moody, intimate.
- **0.5**: Moderate energy. Balanced brightness.
- **1.0**: Bright. Strong illumination. Radiant, luminous.

### bloom
**Emanation** — how far light reaches beyond its sources.

Controls the spatial spread of illumination: the size of glow halos around dots, the post-processing bloom threshold and radius, and the rate at which light falls off with distance. At 0, light stays tight to its sources — precise pools of illumination with defined edges. At 1, light bleeds outward, wrapping forms in soft aureoles until the atmosphere itself begins to glow.

Bloom is independent of luminosity. Luminosity controls how much light exists; bloom controls how the light behaves in space. This creates a 2D light character space:

- **Low luminosity + low bloom**: Dark, precise, intimate. The "dark jewel" — dim but sharp.
- **Low luminosity + high bloom**: Dark, ethereal, mystical. Faint forms shrouded in soft glow.
- **High luminosity + low bloom**: Bright, crisp, architectural. Crystalline forms with defined edges.
- **High luminosity + high bloom**: Bright, radiant, luminous. Forms engulfed in aureoles of light.

Technically, bloom modulates:
- Dot glow halo sizes (all 5 tiers)
- Post-processing bloom strength and threshold
- Light attenuation coefficient (how fast illumination falls off with distance)
- Ambient-to-directional light ratio (high bloom shifts toward more fill light)

- **0.0**: Tight. Light pools close to their sources. Crystal-sharp illumination edges. Precise.
- **0.5**: Moderate emanation. Visible halos with structure still legible.
- **1.0**: Diffuse. Light spreads far. Soft halos fill the space. Atmospheric, ethereal.

---

## Color

Color is an integral part of the continuous parameter space — there is no discrete palette selector. Three axes define the color identity of the emitted light. Fog and background colors are derived automatically from these parameters.

### hue
**Color identity** — the dominant wavelength of the emitted light.

Maps linearly to the hue circle: `baseHue = hue × 360°`. The hue determines the overall color character of the scene and tints the fog and background.

- **0.06** (22°): Warm amber/gold
- **0.51** (185°): Cool teal
- **0.63** (225°): Sapphire blue
- **0.78** (282°): Violet (the classic look)
- **0.87** (312°): Amethyst/magenta

### spectrum
**Color range** — the width of hue variation from monochrome to prismatic.

Controls how much the colors of individual elements vary around the dominant hue. Mapped quadratically for perceptual evenness: `hueRange = 10 + 350 × spectrum²`. This means most of the slider travel covers the useful 10–100° range, with only the extreme top reaching full-spectrum prismatic.

- **0.0**: Near-monochrome. All elements share the dominant hue. Unified color identity.
- **0.24**: Moderate range (~30°). Subtle variation around the dominant hue. The classic violet-depth look.
- **1.0**: Full prismatic (360°). Every hue present. Rainbow.

### chroma
**Color intensity** — how vivid the colors are.

Controls color saturation from nearly achromatic to fully vivid. Also affects fog tinting: at low chroma, the fog is neutral/gray; at high chroma, the fog takes on the dominant hue. This means chroma doesn't just change the elements — it changes the *space itself*.

- **0.0**: Achromatic. Near-grayscale geometry, neutral fog. The crystal-lattice look — pure structure, no color.
- **0.5**: Moderate saturation (~0.65). Color present but not dominant.
- **1.0**: Fully vivid. Intense, saturated color. The sapphire or warm-spectrum look.

---

## Space

### coherence
**Organization** — how strongly elements follow the flow pattern.

Controls two things: the flow field's influence on chain orientation, and the noise scale of the flow field (which determines the spatial frequency of directional changes). At low coherence, chains orient randomly regardless of the flow pattern. At high coherence, chains align strongly to the flow field, creating visible directional structure.

Coherence also affects chromatic organization: the color noise field tracks the flow field scale, so high coherence creates both geometric *and* chromatic patches (nearby aligned chains sample similar colors).

- **0.0**: Chaotic. Chains orient randomly. High-frequency noise field. No directional structure.
- **0.5**: Moderate organization. Subtle alignment, moderate noise scale.
- **1.0**: Highly organized. Strong directional alignment, large coherent regions. Visible flow patterns.

### flow
**Spatial pattern** — the shape of the directional field.

Controls what spatial pattern the flow field takes: a radial starburst emanating from the center, chaotic Perlin noise (the default), or orbital bands wrapping around the form. Flow defines the *shape* of organization; coherence defines its *strength*.

At low coherence, flow is irrelevant — chains orient randomly regardless. At high coherence, flow dramatically changes the spatial structure of the composition.

- **0.0**: Radial. Divergent — chains emanate outward from the core like rays of light or crystal needles. Starburst.
- **0.5**: Noise. Entropic — the current default Perlin-noise field. Organic, no preferred direction.
- **1.0**: Orbital. Convergent — chains wrap tangentially around the form like planetary rings or atmospheric bands.

---

## Parameter Interactions

While each parameter is independently controllable, certain pairs create especially rich interaction spaces:

**coherence × flow**: The defining spatial interaction. Coherence controls alignment strength; flow controls what you're aligning *to*. The combination space spans from chaotic noise (low coherence, any flow) through radial starbursts (high coherence, low flow) to orbital ring structures (high coherence, high flow).

**density × scale**: Together these define "what fills the space." Density controls total population; scale controls the size distribution. High density + low scale = a few massive structures packed tightly. Low density + high scale = a sparse cloud of tiny particles.

**fracture × faceting**: Both affect geometric character but at different scales. Fracture controls the *global* scatter pattern (how far apart elements are). Faceting controls the *local* face quality (how each individual shard looks). You can have tightly clustered sharp shards (low fracture, high faceting) or widely scattered smooth panels (high fracture, low faceting).

**luminosity × bloom**: The 2D light character space. Luminosity controls brightness magnitude; bloom controls spatial spread. Dark + tight = the dark jewel. Dark + diffuse = candlelit cathedral. Bright + tight = architectural crystal. Bright + diffuse = radiant aureole. This is the richest new interaction — the bottom-right corner (dark + high bloom) was previously unreachable.

**luminosity × chroma**: Together these define the quality of colored light. Low luminosity + high chroma = deep, richly saturated colors (the "dark jewel" aesthetic). High luminosity + low chroma = bright white glow with minimal color. The "dark mode" (luminosity=0) is a viable creative space that preserves structural legibility and color saturation.

**spectrum × chroma**: The color character space. Low spectrum + low chroma = achromatic (crystal-lattice). Low spectrum + high chroma = vivid monochrome (sapphire). High spectrum + low chroma = pastel rainbow. High spectrum + high chroma = vivid prismatic.

---
