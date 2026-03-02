Geometric Interior's visual output is shaped by parameters across six groups: **geometry**, **light**, **color**, **space**, **seed**, and **camera**. The first eleven are continuous 0–1 axes that define the composition. The seed controls the specific geometric arrangement. Camera parameters frame the view. In animation mode, additional **animation** parameters modulate the scene over time.

---

## Geometry

### density

**Abundance** — how populated the space is.

Controls the total number of geometric elements across all tiers: guide curves, folding chains, hero dots, medium dots, interior scatter, and micro particles. Higher density produces richer, more complex compositions but increases the risk of additive blowout. A density-aware opacity system compensates by scaling face opacity down at high counts.

- **0.0**: Sparse. Individual geometric elements are clearly readable. Starlike.
- **0.5**: Balanced. Rich structure without losing legibility.
- **1.0**: Dense. Abundant geometry — atmospheric, nebular.

### fracture

**Fragmentation** — how shattered or whole the geometry is.

Controls the degree of geometric scatter across all subsystems simultaneously: envelope radii, guide curve curvature, chain spread, dot scatter radius, and chromatic aberration. Every subsystem answers "how broken?" in the same perceptual direction.

- **0.0**: Compact and whole. Tight clustering, gentle curves, minimal scatter. Crystalline.
- **0.5**: Moderate fragmentation. Visible structure with some dispersion.
- **1.0**: Highly fractured. Scattered shards, wide spread, angular geometry. Explosive.

### scale

**Granularity** — the size distribution of geometric elements.

Controls the balance between tiers without changing the total element count. At low values, primary chains and hero dots dominate — a few bold geometric forms. At high values, tertiary chains and micro particles dominate — a cloud of fine particles. Independent of density.

- **0.0**: Monumental. Few large, bold geometric slabs. Architectural presence.
- **0.5**: Balanced mix of primary, secondary, and tertiary elements.
- **1.0**: Atmospheric. Many small particles and fine chains. Nebular, diffuse.

### division

**Topology** — the form's large-scale shape.

Controls the envelope's symmetry breaking through groove depth and count. The envelope is a perturbed ellipsoid; grooves carved into it create distinct lobes.

- **0.0**: Single lobe. Unified, centered, spherical.
- **0.5**: Two lobes. Bifurcated — the characteristic dual-core structure.
- **1.0**: Three lobes. Trifurcated — a triangular arrangement of luminous cores.

### faceting

**Crystal character** — the quality of individual geometric faces.

Controls the local geometry of each folding chain link: the ratio of broad quads to sharp triangles, the dihedral fold angle, and the contraction rate. These properties determine whether individual shards read as smooth panels or angular crystals.

- **0.0**: Broad, flat panels. Mostly quads, gentle folds. Open, planar.
- **0.5**: Mixed character. Moderate dihedral angles.
- **1.0**: Sharp, angular shards. Mostly triangles, aggressive folds. Tight spiraling crystals.

---

## Light

### luminosity

**Energy** — the overall brightness and glow intensity.

Controls per-element glow strength, lighting factors, and bloom post-processing. A density-aware attenuation system prevents high-density scenes from blowing out. The full 0–1 range is usable: at 0, scenes are dim but clearly visible; at 1, scenes are bright but not blown white.

- **0.0**: Dark. Subdued glow, rich saturated colors. Moody, intimate.
- **0.5**: Moderate energy. Balanced brightness.
- **1.0**: Bright. Strong glow and bloom. Radiant, luminous.

---

## Color

Color is an integral part of the continuous parameter space. Three axes define the color identity of the emitted light. Fog and background colors are derived automatically.

### hue

**Color identity** — the dominant wavelength of the emitted light.

Maps linearly to the hue circle: `baseHue = hue × 360°`. The hue determines the overall color character of the scene and tints the fog and background.

- **0.06** (22°): Warm amber/gold
- **0.51** (185°): Cool teal
- **0.63** (225°): Sapphire blue
- **0.78** (282°): Violet — the classic look
- **0.87** (312°): Amethyst/magenta

### spectrum

**Color range** — the width of hue variation from monochrome to prismatic.

Controls how much the colors of individual elements vary around the dominant hue. Mapped quadratically for perceptual evenness.

- **0.0**: Near-monochrome. All elements share the dominant hue.
- **0.24**: Moderate range. Subtle variation — the classic violet-depth look.
- **1.0**: Full prismatic. Every hue present. Rainbow.

### chroma

**Color intensity** — how vivid the colors are.

Controls color saturation from nearly achromatic to fully vivid. Also affects fog tinting: at low chroma, the fog is neutral; at high chroma, the fog takes on the dominant hue. Chroma doesn't just change the elements — it changes the space itself.

- **0.0**: Achromatic. Near-grayscale geometry, neutral fog. Pure structure.
- **0.5**: Moderate saturation. Color present but not dominant.
- **1.0**: Fully vivid. Intense, saturated color.

---

## Space

### coherence

**Organization** — how strongly elements follow the flow pattern.

Controls the flow field's influence on chain orientation and the noise scale of the flow field. Coherence also affects chromatic organization: high coherence creates both geometric and chromatic patches.

- **0.0**: Chaotic. Chains orient randomly. No directional structure.
- **0.5**: Moderate organization. Subtle alignment.
- **1.0**: Highly organized. Strong directional alignment. Visible flow patterns.

### flow

**Spatial pattern** — the shape of the directional field.

Controls what spatial pattern the flow field takes. Flow defines the shape of organization; coherence defines its strength. At low coherence, flow is irrelevant — chains orient randomly regardless.

- **0.0**: Radial. Chains emanate outward from the core. Starburst.
- **0.5**: Noise. Perlin-noise field. Organic, no preferred direction.
- **1.0**: Orbital. Chains wrap tangentially around the form. Atmospheric bands.

---

## Seed

The seed determines the specific geometric arrangement within the parameter space. Two compositions with the same control parameters but different seeds produce visually related images — same mood, palette, and structure — but with distinct element placement.

The seed is a three-slot tag: **[arrangement, structure, detail]**. Each slot is a number (0–17) that maps to a word on a perceptual spectrum. The three slots control independent aspects of the scene's randomness.

### arrangement

**Spatial layout** — how elements are distributed in space.

Controls the placement of guide curves and light points. Words range from still to turbulent: *anchored, poised, centered, settled, resting, balanced, drifting, leaning, shifting, flowing, turning, arcing, swirling, rushing, scattering, diverging, spiraling, turbulent*.

Nearby values produce similar spatial layouts. Distant values produce noticeably different compositions.

### structure

**Geometric form** — how chains drape and fold.

Controls chain draping direction, fold angles, and geometry construction. Words range from smooth to jagged: *silken, draped, smooth, folded, layered, woven, creased, pleated, angular, faceted, carved, fractured, splintered, shattered, crystalline, serrated, bristling, jagged*.

### detail

**Fine variation** — color jitter and atmospheric scatter.

Controls per-element color variation and the placement of atmospheric elements. Words range from frozen to burning: *frozen, glacial, still, cool, misty, dim, dusky, neutral, mild, warm, glowing, bright, vivid, radiant, blazing, molten, incandescent, burning*.

Each slot contributes both a subtle **bias** (the slot's position on the spectrum nudges the output in a consistent direction) and an independent **random stream** (fine-grained variation). This means seeds with shared slots produce visibly related results, and the degree of visual difference scales with numerical distance between slot values.

---

## Camera

Camera parameters frame the composition. These apply to both static images and animations. In animation mode, camera values can be animated over time across events.

### zoom

**Proximity** — how close the camera is to the scene.

A multiplier on the default camera distance. Values below 1.0 bring the camera closer (magnifying the center); values above 1.0 pull it back (showing more of the periphery).

- **0.5**: Close. Fills the frame with the luminous core.
- **1.0**: Default. The standard framing.
- **2.0**: Distant. The full form visible with surrounding dark space.

### rotation

**Orbit** — the camera's angular position around the scene.

Rotates the camera around the vertical axis of the scene. Useful for finding the most compelling angle on asymmetric compositions (especially at non-zero division).

- **0°**: Default front view.
- **90°**: Side view — reveals depth and layering.
- **180°**: Rear view — the form seen from behind.

In animation, rotation can be swept continuously to create orbiting camera movements.

---

## Animation

Animation parameters modulate the existing scene in real-time. Unlike the eleven control parameters (which define the geometry and require a scene rebuild to change), animation parameters are applied as shader-level modulations — they're continuous, lightweight, and can vary frame-by-frame.

### twinkle

**Light play** — how much the glow points dance.

Controls the oscillation and pulse of the luminous dots. At zero, the dots are perfectly still. As twinkle increases, the dots wobble in position, pulse in size, and their surface sparkle flickers with time-based variation. The effect is organic and alive — like light refracting through moving water.

- **0.0**: Static. Dots are fixed points of light. Serene, crystalline.
- **0.5**: Gentle pulse. Subtle breathing quality.
- **1.0**: Full oscillation. Dancing, flickering light points.

### dynamism

**Surface life** — how much the geometric faces shift and evolve.

Controls the speed of surface pattern animation on the folding chain faces — the crack textures, dust patterns, and surface detail that give each face its character. At zero, surfaces are frozen in time. As dynamism increases, these patterns drift and evolve, giving the geometry a sense of slow geological movement.

- **0.0**: Frozen. Surfaces are fixed. Still, timeless.
- **0.5**: Gentle drift. Subtle surface evolution.
- **1.0**: Active movement. Visible pattern flow across faces.

---

## Parameter Interactions

While each parameter is independently controllable, certain pairs create especially rich interaction spaces:

**coherence × flow** — The defining spatial interaction. Coherence controls alignment strength; flow controls what you're aligning to. The combination spans from chaotic noise through radial starbursts to orbital ring structures.

**density × scale** — Together these define what fills the space. High density + low scale = massive structures packed tightly. Low density + high scale = a sparse cloud of tiny particles.

**fracture × faceting** — Both affect geometric character but at different scales. Fracture controls the global scatter pattern. Faceting controls the local face quality. You can have tightly clustered sharp shards or widely scattered smooth panels.

**luminosity × chroma** — Together these define the quality of light. Low luminosity + high chroma = deep, richly saturated colors. High luminosity + low chroma = bright white glow. The dark mode (luminosity=0) is a viable creative space.

**spectrum × chroma** — The color character space. Low spectrum + low chroma = achromatic crystal-lattice. Low spectrum + high chroma = vivid monochrome. High spectrum + high chroma = vivid prismatic.

**seed × controls** — The seed and controls operate on different axes entirely. Controls define the visual character; the seed defines the specific realization. Exploring seeds at fixed controls reveals the space of possible arrangements within a single aesthetic.

**twinkle × dynamism** — In animation, these together define the scene's vitality. Low twinkle + low dynamism = still, contemplative. High twinkle + low dynamism = sparkling but stable. High both = full kinetic energy.
