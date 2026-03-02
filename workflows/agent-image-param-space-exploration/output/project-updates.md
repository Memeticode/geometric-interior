# Project Updates — Image Parameter Space Exploration (Session 2)

Final deliverable from the 12D parameter space exploration. 100 configs designed, rendered, reviewed, seed-tuned, and curated across 8 sessions.

---

## Starter Profile Promotion Candidates

The following configs from this exploration merit consideration for promotion to `src/core/starter-profiles.json`. They are organized by tier.

### Top Tier (7 configs) — Strongest recommendations

These are distinctive, evocative, and would genuinely expand the starter profile palette.

| # | Name | Why promote | Key params |
|---|------|-----------|------------|
| 19 | Night Bloom | Most atmospheric config in the entire set. Rose bloom in darkness — the dark+bloom recipe at its finest. | lum=0.10, bloom=0.80, hue=0.94 |
| 20 | Shadow Lattice | Wide web of silvery lines against darkness. Unique achromatic dark aesthetic. Most seed-sensitive config discovered. | lum=0.10, bloom=0.15, chroma=0.12, flow=1.0 |
| 46 | Dark Crystal | Vertical crystalline monolith. Same params as Shadow Lattice, different seed — proves arrangement slot as artistic variable. | Same as Shadow Lattice, seed [9,1,0] |
| 55 | Night Sapphire | Deep blue-purple gem in darkness. More mysterious than Night Bloom. The dark bloom recipe's coolest expression. | lum=0.10, bloom=0.75, hue=0.625 |
| 67 | Chartreuse Current | Breakthrough vivid lime green. Electric, fresh, unlike anything in existing profiles. | hue=0.30, chroma=0.78, flow=0.0 |
| 84 | Meditation | Genuine contemplative stillness. Sparse, achromatic, scattered starpoints. Ultra-seed-stable. | d=0.03, coh=0.90, chroma=0.20 |
| 88 | Tempest | Turbulent teal storm sweeping horizontally. Most kinetic config — explosive orbital energy. | d=0.25, coh=0.15, flow=0.85 |

### Standout Tier (31 configs) — Strong candidates

These are all visually compelling and would work well as starter profiles. Prioritize based on how much they diversify the existing collection.

**Dark bloom family** (fills the "dark + atmospheric" gap entirely):
- #24 Night Amber, #27 Night Violet, #35 Night Trifold, #39 Night Coral, #47 Turquoise Night, #49 Chartreuse Night, #80 Orbital Night Rose, #82 Night Garden

**Extreme interactions** (push the space to its edges):
- #75 Sharp Radial Burst, #76 Bright Vivid Coral, #78 Atmospheric Silk, #79 Chaotic Blades

**Scale and texture** (new aesthetic territory):
- #97 Grand Cathedral, #98 Fractured Bloom, #99 Smooth Orbital Rose

**Muted/material worlds** (subtle, contemplative):
- #58 Dusty Rose, #59 Antique Bronze, #61 Pewter

**Other strong configs**:
- #10 Prismatic Fog, #12 Amber Lantern, #14 Dark Jewel Box, #17 Abyssal Green, #34 Dense Orbital Teal, #38 Ember Scatter, #40 Chaotic Sapphire, #42 Turbulent Ember, #51 Achromatic Veil, #52 Chartreuse Storm, #54 Flow Transition (Amber), #66 Saffron Burst, #81 Solitude, #90 Dissolution

---

## Parameter Range Findings

### Bloom (new parameter)
- **Full range viable** from 0.0 to 1.0
- **Bloom is a mood axis**: 0.0 = precise/architectural, 1.0 = ethereal/atmospheric
- **Sweet spot for atmosphere**: bloom 0.60-0.80 combined with low luminosity (0.08-0.12)
- **Interaction with darkness is the major discovery**: lum=0.10 + bloom=0.70-0.80 = "Night" recipe, works at every hue

### Hue gaps filled
- **Yellow (0.14-0.16)**: Pure Yellow, Canary Scatter — sunshine geometry works
- **Chartreuse (0.26-0.30)**: 4 configs, all distinct aesthetics — electric/dark/chaotic/muted
- **Turquoise (0.45-0.48)**: Turquoise Pool, Aquamarine Orbital, Turquoise Night — tropical water to deep-sea
- **Orange (0.09)**: Deep Orange — warm autumn amber

### Density boundaries clarified
- **d < 0.03**: Nearly seed-stable, very sparse, meditative
- **d = 0.05-0.12**: The sweet spot — readable geometry with atmospheric space
- **d = 0.20-0.35**: Dense but still readable with proper luminosity/bloom balance
- **d > 0.50**: Fog-of-particles territory — loses individual element readability

### Scale interactions
- **scale=0.0-0.10**: Concentrated core, risk of blowout without luminosity reduction
- **scale=1.0**: Nearly seed-stable (wide scale homogenizes arrangement effects)
- **scale=0.0 + density>0.15**: Danger zone — requires luminosity < 0.40 to avoid blowout

### Coherence spectrum
- **coh < 0.15**: Maximum chaos — shards, fragments, disorder
- **coh = 0.55**: "Symmetry breaking" territory — tension between order and disorder
- **coh > 0.85**: Ordered, architectural, monumental
- **coh = 0.92 + d = 0.02**: Functionally identical across all seeds

---

## Seed Tuning Findings

### Summary statistics
- **100/100 configs seed-tuned** via 5-variant sweeps (arrangement slots 0, 5, 9, 13, 17)
- **86% improvement rate** — 86 configs benefited from a different seed
- **14 configs kept original seed** — mostly ultra-sparse or ultra-coherent configs

### Winner distribution
- **a13**: Most common winner overall (~30%), especially for conceptually rich configs where dramatic geometric framing enhances the intent
- **a0**: Second most common (~25%), tends to produce widest atmospheric spreads
- **a17**: Third (~20%), strong for burst/radial/monumental compositions
- **a9**: Fourth (~15%), good for focused/concentrated compositions
- **a5**: Fifth (~10%), good for structured/layered compositions

### Seed sensitivity spectrum
| Condition | Sensitivity | Example |
|-----------|------------|---------|
| d=0.02, coh=0.92 | None (all identical) | Solitude |
| d=0.03, coh=0.90 | Minimal | Meditation |
| d=0.06, coh=0.90, achromatic | Maximum | Shadow Lattice |
| d=0.08+, colorful | Moderate | Most configs |
| scale=1.0 | Near-stable | Atmospheric Silk, Vast Teal Expanse |
| d=0.30, flow=1.0 | Moderate | Dense Orbital Teal |

### Key insight
**Seed tuning is always worthwhile for configs with d > 0.05.** The arrangement slot primarily affects the spatial composition — where geometric planes are placed, how they frame each other, where the bright/dark regions fall. For configs where compositional drama matters (most configs), trying 5 seeds takes ~5 minutes and improves the result 86% of the time.

---

## Documentation Updates

### For `docs/parameters.md`
Consider adding:
1. **Bloom**: "Not just softness — bloom transforms mood. Zero bloom = precise, architectural. High bloom = ethereal, atmospheric. The interaction with luminosity is critical: low lum + high bloom = the 'Night' aesthetic."
2. **The dark bloom recipe**: lum~0.10, bloom~0.70-0.80 produces atmospheric beauty at every hue. This is the most significant new territory discovered.
3. **Seed sensitivity note**: "Configs with density < 0.03 or coherence > 0.90 are nearly seed-stable. Achromatic configs at moderate density show maximum seed sensitivity."

### For the project generally
1. **The "Night" family** is a major aesthetic discovery — 10+ configs all using the same recipe (lum~0.10, bloom~0.70-0.80) at different hues, all beautiful. This could become a curated collection.
2. **Material aesthetics** are achievable at very low chroma (< 0.20) — Antique Bronze, Pewter, and Muted Saffron evoke metal/material rather than colored light.
3. **The achromatic seed gallery** proves that arrangement alone (with color removed) can create 5+ completely distinct artworks from identical parameters.

---

## What's Left Unexplored

These threads were discovered but not followed during this exploration:

1. **Structure slot experiments** — Does changing the structure slot (index 1) matter as much as arrangement? Untested.
2. **Night Bloom at extreme bloom** (0.95+) — Pure atmosphere beyond the current 0.70-0.80 range
3. **Warm chaos 4th member** — Turbulent Ember, Ember Scatter, Solitary Ember exist. Room for more?
4. **Achromatic seed gallery extension** — Confirmed 3 configs (5 artworks possible) from one parameter set. Could extend further.
5. **Topology dimension** — All 100 configs use "flow-field". Other topologies untested in this run.
