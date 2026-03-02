# Exploration Notes — Session 2 (Bloom Dimension)

Session started 2026-02-28. 100 configs across 12 thematic categories exploring the 12D parameter space (bloom is new). All rendered via Playwright against `sampler.html`.

---

## Per-Group Visual Review

### Bloom Dimension (001–012)

**What it tests**: Bloom parameter from 0.0 to 1.0 across different color identities.

**Findings**: Bloom is a *mood* axis, not just a sharpness axis. Zero bloom gives precise, architectural, crystalline forms. High bloom transforms the same geometry into ethereal, atmospheric, remembered-looking images. The pair that demonstrates this best: Violet Sanctum Tight (#001, bloom=0.0) vs Violet Sanctum Aureole (#002, bloom=1.0) — same seed, same parameters, completely different emotional register.

**Per-config notes**:
- **001 Violet Sanctum (Tight)**: Defined purple crystalline structure, sharp light points. Architectural. Good.
- **002 Violet Sanctum (Aureole)**: Same seed at max bloom — soft purple haze. Beautiful. Clear demonstration of bloom's character.
- **003 Sapphire Cathedral**: Bright blue-teal with strong luminous glow. Beautiful.
- **004 Ice Precision**: Achromatic + zero bloom. Very defined crystal structure, white-blue. Sharp faceted edges. Excellent.
- **005 Ember Nimbus**: Warm amber/gold spreading through bloom. Firelight. Nice.
- **006 Dark Ruby Glow**: Atmospheric warm depth with trifold division.
- **007 Emerald Mist**: Beautiful green depth with bloom diffusion.
- **008 Rose Haze**: Pink tones with bloom creating romantic feel. Lovely.
- **009 Teal Whisper**: Teal at subtle bloom=0.20. Barely perceptible glow. Nice restraint.
- **010 Prismatic Fog** ★: Rainbow haze — full spectrum + max bloom creates ghost colors dispersing. Standout.
- **011 Crystal Bloom**: Ghostly achromatic quality. Low chroma + moderate bloom = spectral.
- **012 Amber Lantern** ★: Warm light with extreme bloom. Lantern-in-fog. Standout.

**Group verdict**: Strong across the board. Every config is visually distinct. The group succeeds in demonstrating bloom's range.

---

### Darklands (013–020)

**What it tests**: Near-zero luminosity (0.05–0.12) with varying bloom, color, and structure.

**Findings**: The dark territory is rich. Session 1 discovered "dark mode" was viable after v2 retuning. This group shows it's not just viable — it's one of the most atmospheric regions in the space. Low luminosity preserves color saturation while creating a sense of depth and mystery that brighter settings can't achieve.

**Per-config notes**:
- **013 Obsidian Mirror**: Brighter than expected for lum=0.05 — violet structure clearly visible. Not quite living up to the "obsidian" name but still interesting.
- **014 Dark Jewel Box** ★: Beautiful blue-teal with tight bloom. Deep-sea luminescence. Small scale creates intimacy. Very nice.
- **015 Midnight Cathedral**: Faint gossamer structures — high bloom at low luminosity. Atmospheric.
- **016 Cinder**: Warm ember glow. Amber and gold tones suit the name perfectly.
- **017 Abyssal Green** ★: Vivid green even at lum=0.08. Excellent depth. How does it hold color at this luminosity?
- **018 Void Prism**: Striking — full-spectrum colors (green, yellow, pink, blue) emerging from near-blackness. The high spectrum + low luminosity combination creates prismatic ghosts.
- **019 Night Bloom** ★★: Pink/rose with atmospheric bloom against darkness. Dreamy moonlit flower effect. Name matches perfectly. One of the best in the entire set. This is the dark+bloom corner that session 1 said was "previously unreachable."
- **020 Shadow Lattice** ★★: Stark achromatic crystal emerging from darkness. Orbital flow at low faceting creates smooth forms. Elegant and powerful.

**Group verdict**: Excellent. Contains three standouts and no duds. Dark + bloom is the richest new interaction space discovered in this session.

---

### Blinding Light (021–027)

**What it tests**: Very high luminosity (0.85–1.0) with varying bloom and color.

**Findings**: This group maps the upper blowout boundary. The legibility frontier is steeper here than expected — the jump from lum=0.88 to lum=1.0 loses structure rapidly when bloom is also high. But moderate-bloom configs at high luminosity retain good structure.

**Per-config notes**:
- **021 Solar Flare** ✗: DUD. Almost entirely golden blowout. Structure barely visible. lum=1.0 + bloom=0.75 is past the frontier.
- **022 White Blaze**: Max luminosity but low bloom — retains structure. Pure white radiance.
- **023 Blazing Emerald**: Very high lum + moderate bloom — green structure visible. Good.
- **024 Incandescent Teal**: Bright teal with electric glow. Moderate bloom + orbital flow. Decent.
- **025 Burning Violet**: High lum + high bloom — purple fire. On the edge but readable.
- **026 Supernova Bloom**: Interesting dual bright centers from high density. Dense + low lum offset.
- **027 Bright Dense Coral**: Warm coral approaching blowout but structure holds. On the edge.

**Group verdict**: One definite dud (#021). Others map the frontier well. The lesson: at lum>0.90, bloom must stay below ~0.50 to preserve structure.

---

### Dense Territories (028–036)

**What it tests**: Density from 0.25 to 0.65, exploring how population affects legibility.

**Findings**: The density-aware opacity system (from v2) keeps things readable up to about density=0.50. Above that, additive blending starts winning — structure becomes indistinct glow regardless of luminosity compensation.

**Per-config notes**:
- **028 Crowded Sanctum**: d=0.30 violet — denser, more overlapping. Interesting territory.
- **029 Dense Emerald Field**: d=0.35 green — rich overlapping structures. Good.
- **030 Packed Sapphire**: d=0.40 blue — getting dense, slightly muddy. Borderline.
- **031 Swarm**: d=0.50 with atmospheric scale — 472 nodes but still somewhat readable. Solid stress test.
- **032 Dense Monolith**: Bright center approaching blowout. Small scale + density concentrates.
- **033 Dense Chaos**: d=0.35 + low coherence. Teeming disorder. Works because chaos disperses the density.
- **034 Dense Orbital Teal** ★: d=0.30 + orbital flow + bloom. Icy crystalline cluster. Beautiful.
- **035 Filled Trifold**: Hot center from density + trifold concentration. Borderline.
- **036 Hyper Dense** ✗: DUD. d=0.65 — 623 nodes creates warm muddy cloud. No readable structure.

**Group verdict**: One dud (#036). Dense Orbital Teal is the standout — flow helps distribute density. Lesson: density>0.50 needs counterbalancing from either chaos (low coherence) or wide scale to stay readable.

---

### Chaos Theory (037–045)

**What it tests**: Low coherence (0.0–0.25), exploring disorder and scatter.

**Findings**: Low coherence doesn't mean uninteresting. Chaos creates a different *kind* of beauty — fragments, scattered sparks, things falling apart. The best chaos configs work because they have one strong organizing principle despite the disorder (a vivid color, a clear density, a specific emotional word).

**Per-config notes**:
- **037 Scattered Violet**: Nice gentle purple disorganization.
- **038 Random Walk**: Pure noise field at coh=0.0. Interesting texture.
- **039 Soft Chaos**: Gentle purple scatter — low fracture softens the chaos.
- **040 Chaotic Sapphire** ★: Beautiful dark blue fragments floating in darkness. The vivid chroma gives chaos a jewel-like quality.
- **041 Disordered Trifold**: The trifold structure survives some chaos — interesting finding. Division shape is robust.
- **042 Turbulent Ember** ★: Warm scattered amber sparks. Great firefly quality. Name matches perfectly.
- **043 Chaotic Bloom**: Purple/pink with high bloom softening the chaos. Interesting interaction — bloom mellows chaos.
- **044 Scattered Crystal**: Sharp angular fragments from high faceting + low coherence. Distinctive.
- **045 Entropy**: Scattered teal/green at max disorder. d=0.20 + coh=0.05.

**Group verdict**: Strong group. Chaotic Sapphire and Turbulent Ember are standouts. Key insight: bloom + chaos creates soft atmospheric scatter; faceting + chaos creates sharp angular scatter. These are very different moods.

---

### Transitional Division (046–051)

**What it tests**: Division parameter in the 0.60–0.75 range — the transition zone between two-lobe and three-lobe forms.

**Findings**: The transitional region is subtler than expected. The division parameter needs to reach ~0.70 before the third lobe becomes visible. Below that, it mainly affects the depth/shape of the primary groove.

**Per-config notes**:
- **046 Partial Divide (Violet)**: div=0.65. The dual-to-trifold transition is subtle.
- **047 Partial Divide (Teal)**: div=0.70. Third lobe beginning to emerge.
- **048 Partial Divide (Amber)**: Beautiful warm gold with visible geometric structure. Good.
- **049 Emerging Trifold**: div=0.60. Just beginning to split — subtle.
- **050 Deep Bifurcation** ★: Lovely purple form with visible three-way splitting at div=0.72.
- **051 Dense Partial Trifold**: Dense teal transitional form. Interesting.

**Group verdict**: Solid but not thrilling. Deep Bifurcation is the standout. The transitional zone is more of an intellectual curiosity than a visually rich region — the configs are "correct" but few make you stop.

---

### Flow Continuum (052–057)

**What it tests**: Flow parameter in the 0.60–0.75 range — between noise-driven and orbital patterns.

**Findings**: Similar to transitional-division, this group explores a middle range. The flow transition is gradual and color is the main differentiator between configs.

**Per-config notes**:
- **052 Flow Transition (Violet)**: flow=0.65. Purple with emerging orbital structure.
- **053 Flow Transition (Teal)**: flow=0.70. Teal-blue. Good.
- **054 Flow Transition (Amber)** ★: Beautiful warm golden tones. The warmth + flow creates an inviting quality.
- **055 Flow Transition (Sapphire)**: flow=0.75 + high faceting. Blue-teal.
- **056 Dense Mid-Flow**: Crystalline purple-violet with density. Nice.
- **057 Bloom Mid-Flow**: flow=0.70 + high bloom. Diffuse light follows the emerging orbital pattern.

**Group verdict**: Solid coverage but most follow the same structural pattern with color as the differentiator. Flow Transition Amber stands out because warmth + flow is a compelling combination. This group might benefit from more adventurous parameter combos in future iterations.

---

### Muted Worlds (058–064)

**What it tests**: Low chroma (0.15–0.30) — desaturated aesthetics.

**Findings**: Desaturation is its own aesthetic world. These configs have a quiet, understated beauty that contrasts with the vivid-color groups. The muted palette creates a sense of age, distance, memory. Low chroma + moderate bloom = fog, old photographs, half-remembered dreams.

**Per-config notes**:
- **058 Dusty Rose** ★: Perfect understated pink. Quiet, delicate beauty. One of the best "mood" configs.
- **059 Muted Amber**: A bit bright for "muted" but still good warm-gray-gold.
- **060 Fog Jade**: Green + low chroma + bloom. Jade through fog. Nice.
- **061 Pewter** ★: Elegant silvery neutrality. Very low chroma creates metallic quality.
- **062 Pastel Spectrum**: Subtle multi-color diffusion. High spectrum + low chroma = ghost rainbow.
- **063 Washed Indigo**: Subtle dark blue-purple. True to name.
- **064 Muted Prismatic**: High spectrum + low chroma creates multiple muted colors. Ghost rainbow effect.

**Group verdict**: Beautiful group. The aesthetic consistency is remarkable — every config feels like it belongs to the same quiet world. Dusty Rose and Pewter are standouts. This territory deserves deeper exploration.

---

### Unexplored Hues (065–072)

**What it tests**: Hue regions with zero or minimal coverage in existing starter profiles — yellow, chartreuse, turquoise, orange, aquamarine.

**Findings**: Breakthrough group. The starter profiles cluster around violet, teal, amber, sapphire, and rose. The gaps at hue=0.15–0.35 (yellow-green) and 0.44–0.50 (turquoise-aquamarine) contain genuinely fresh-looking configurations. These don't just fill gaps — they expand what the project can look like.

**Per-config notes**:
- **065 Pure Yellow**: hue=0.16. Yellow-gold tones — sunshine geometry. New territory.
- **066 Saffron Burst** ★: hue=0.11. Deeper gold/amber. Beautiful warm saffron quality. Slightly higher spectrum adds depth.
- **067 Chartreuse Current** ★★: hue=0.30. Vibrant lime green. Completely new color for the project. Fresh, electric. Breakthrough.
- **068 Turquoise Pool**: hue=0.45. Lovely teal-cyan, clean tropical feel.
- **069 Canary Scatter**: Bright yellow-green + high fracture. Shattered sunlight quality.
- **070 Aquamarine Orbital**: hue=0.48 + orbital flow. Rings of sea-glass. Beautiful.
- **071 Lime Trifold**: hue=0.26 + trifold. Acid-green three-way split.
- **072 Deep Orange**: hue=0.09. Warm amber-gold with nice depth.

**Group verdict**: Outstanding. Chartreuse Current is one of the most exciting configs in the whole set — a completely new visual identity for the project. Saffron Burst has rich warmth. This group strongly suggests the hue gaps should be filled in the starter profiles.

---

### Extreme Interactions (073–080)

**What it tests**: Complex multi-parameter combinations — deliberate stress tests of parameter interactions.

**Findings**: Mixed results, which is exactly what stress testing should produce. The failures are informative (blowout boundary mapping), and the successes reveal unexpected beauty.

**Per-config notes**:
- **073 Dense Bright Teal**: d=0.25 + lum=0.75. Blowout resistance test. Structure holds but barely.
- **074 Smooth Orbital Panels**: faceting=0.05 + flow=0.90. Silk ribbons in orbit. Decent.
- **075 Sharp Radial Burst**: faceting=1.0 + flow=0.0. Crystal starburst. Blue-teal with sharp edges.
- **076 Bright Vivid Coral**: lum=0.85 + chroma=0.90. Good blowout resistance — structure visible.
- **077 Dark Dense Monolith** ✗: DUD. Massive white orb. scale=0.0 + density=0.30 concentrates too much light.
- **078 Atmospheric Silk** ★: scale=1.0 + faceting=0.0 + bloom. Vast smooth gossamer purple. Lovely wide forms.
- **079 Chaotic Blades** ★: coh=0.10 + faceting=1.0. Sharp angular teal fragments in disorder. Distinctive.
- **080 Orbital Trifold Bloom**: flow=1.0 + div=0.90 + bloom=0.70. Bright center but structure reads through.

**Group verdict**: One definite dud (#077). Atmospheric Silk and Chaotic Blades are standouts — opposite aesthetic poles (smooth/wide vs sharp/scattered) both producing beauty. Key finding: extreme faceting + low coherence = "chaotic blades" is a repeatable aesthetic.

---

### Signature Pieces (081–090)

**What it tests**: Thematic "emotional" configurations — each designed to evoke a specific feeling.

**Findings**: The strongest group overall. When parameters are chosen to serve an *intent* rather than explore a range, the results are more likely to transcend. This group has the highest standout density — roughly half the configs are notable. The names matter: Meditation, Tempest, Solitude, Dissolution — these feel like art titles, and the images match.

**Per-config notes**:
- **081 Solitude** ★: d=0.02, sparse, tight bloom, singular presence. Beautiful — one form in vast darkness.
- **082 Congregation**: d=0.30, many elements. Community feeling. Good but not transcendent.
- **083 Aurora**: Prismatic + bloom + orbital. Green-gold northern lights quality. Beautiful.
- **084 Meditation** ★★: Low density, muted, achromatic, scattered starlike dots. Genuine contemplative stillness. Exquisite.
- **085 Eruption**: Dense warm chaos. Volcanic energy. Good name match.
- **086 Symmetry Breaking**: div=0.60 + coh=0.55. The moment order begins to split. Conceptually interesting.
- **087 Reverie**: Soft muted purple with bloom. Dreamy quality. Nice.
- **088 Tempest** ★★: Scattered angular teal-green fragments with orbital flow. Low coherence + high flow + density = turbulent energy. One of the best.
- **089 Genesis** ✗: DUD. Blown-out teal center. The "beginning of structure" idea is good but the execution concentrates too much.
- **090 Dissolution** ★: Structure falling apart — teal-green fragments scattering from two bright points. Great conceptual opposite to Genesis.

**Group verdict**: Strongest group. 5 standouts out of 10. The intent-driven approach works — designing for a feeling produces better results than designing for a parameter range. Genesis needs replacing but the concept is worth saving with better parameters.

---

### Scale and Texture (091–100)

**What it tests**: Scale parameter extremes (0.0 to 1.0) and faceting extremes (0.0 to 1.0).

**Findings**: Scale and faceting have strong textural effects. Small scale creates concentrated monumental forms; large scale creates atmospheric particle fields. Smooth faceting (0.0) vs sharp faceting (1.0) is a dramatic character axis. The group successfully demonstrates this range but has one dud where small scale + moderate density creates excessive concentration.

**Per-config notes**:
- **091 Miniature Violet** ✗: DUD. scale=0.0 creates bright concentrated core. Too much energy in too small a space.
- **092 Vast Teal Expanse**: scale=1.0. Wide atmospheric teal field with scattered dots. Good.
- **093 Tiny Dense Cluster**: scale=0.05 + d=0.30. Tightly packed small warm forms. Interesting.
- **094 Liquid Sapphire**: faceting=0.0. Perfectly smooth blue surfaces. Nice flowing quality.
- **095 Crystalline Fracture**: faceting=1.0 + fracture=0.85. Maximum angular sharpness. Distinctive.
- **096 Polished Obsidian**: faceting=0.0 + dark + tight bloom. Smooth dark mirror surfaces. Elegant.
- **097 Grand Cathedral**: scale=0.90 + high faceting + bloom. Vast crystalline architecture. Good.
- **098 Fractured Bloom**: fracture=0.95 + bloom=0.80. Shattered light with atmospheric diffusion.
- **099 Smooth Orbital Rose**: faceting=0.05 + flow=1.0 + rose. Silk ribbons spiraling. Lovely soft pink quality.
- **100 Monumental Ember**: scale=0.85 + warm + dense. Towering amber presence. Warm and earthy.

**Group verdict**: One dud (#091). The rest cover the textural range well. Polished Obsidian and Smooth Orbital Rose have distinctive smooth-surface aesthetics. Crystalline Fracture is the angular extreme. No single transcendent standout, but the group demonstrates important textural dimensions.

---

## Cross-Group Observations

### The "dark bloom" corner
Night Bloom (#019), Midnight Cathedral (#015), and Abyssal Green (#017) all occupy the low-luminosity + high-bloom region. This is arguably the most exciting new territory opened by the bloom parameter. Session 1's v2 retuning made dark mode viable; bloom makes it *atmospheric*.

### Chaos has beauty
The chaos-theory group and several extreme-interactions configs show that low coherence creates genuine visual interest — not just noise, but scattered fragments with their own character. The key: give chaos something to work with (vivid color, high faceting, specific hue identity).

### Restraint creates impact
Meditation (sparse, muted, achromatic), Solitude (d=0.02, tight bloom), Shadow Lattice (achromatic, dark, orbital) — the most powerful emotional responses come from configs that exercise restraint. Pulling *back* on parameters creates space for feeling.

### Hue diversity matters
The project's visual vocabulary has been dominated by violet, teal, and amber. Chartreuse, saffron, turquoise, and muted-world colors expand what it can express. These should be represented in starter profiles.

### Intent-driven > range-driven design
The signature-pieces group (designed around feelings) produced more standouts per config than any range-exploration group. When parameters serve an emotional concept, the results are stronger.

---

*Living document — will be updated as exploration continues.*
