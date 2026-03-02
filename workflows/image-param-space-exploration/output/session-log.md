# Image Parameter Space Exploration — Session Log

> **For resuming after interruptions.** If you're a new Claude session picking this up, read this file top-to-bottom. It contains everything you need to continue seamlessly — what we've done, what we've decided, what we're thinking about, and what to do next.
>
> **UPDATE FREQUENTLY.** After every batch of renders, seed sweep, or replacement round, update this log immediately. Previous sessions lost work by not logging results before hitting rate limits.

## Project Context

Geometric Interior is a Three.js WebGL art project that renders luminous geometric compositions from a 12-dimensional parameter space (density, fracture, scale, division, faceting, luminosity, bloom, hue, spectrum, chroma, coherence, flow). Each parameter is a 0–1 continuous axis. A 3-slot seed tag system (`[arrangement, structure, detail]`) controls PRNG streams — parameters define the *statistics* of a composition; the seed controls the *realization*.

This workflow (`workflows/image-param-space-exploration/`) systematically explores the parameter space. The first run (artifacts in `sampler-captures/`) covered 11 dimensions and produced deep insights (legibility frontier, v2 parameter retuning, coherence becoming visible via flow influence). This second run adds bloom as the 12th dimension.

## Key Files

- `workflows/image-param-space-exploration/configs.json` — the 100 exploration configs (1-indexed in the array, 112 lines)
- `workflows/image-param-space-exploration/render.mjs` — Playwright batch renderer (reads configs.json, renders via sampler.html on port 5204, skips existing PNGs)
- `workflows/image-param-space-exploration/render-sweep.mjs` — Seed sweep renderer (reads seed-sweep.json, outputs to output/seed-sweeps/)
- `workflows/image-param-space-exploration/seed-sweep.json` — Seed variant configs for tuning (rewritten each batch)
- `workflows/image-param-space-exploration/output/renders/` — 100 rendered PNGs, named `{NNN}-{slug}.png`
- `workflows/image-param-space-exploration/output/seed-sweeps/` — Seed variant renders for comparison
- `workflows/image-param-space-exploration/output/exploration-notes.md` — per-group visual review observations
- `workflows/image-param-space-exploration/output/notable.json` — curated standouts (33 entries)
- `workflows/image-param-space-exploration/README.md` — workflow methodology (6 phases)
- `src/core/starter-profiles.json` — 83 existing starter profiles (the destination for the best configs)
- `docs/parameters.md` — parameter reference documentation
- `sampler-captures/_dimensional_geometry_exploration_notes.md` — session 1's deep findings

## Plan

See `C:\Users\thatc\.claude\plans\polished-nibbling-phoenix.md` for the full plan. In brief:

1. **Iteration 1**: Compile findings, fix 5 duds, write initial notables (clean foundation)
2. **Iteration 2**: Interleaved exploration + seed tuning — follow threads from standouts, replace forgettable configs, seed-tune everything we touch
3. **Iteration 3**: Sweep remaining untouched seeds, polish, write final deliverables

Seed tuning is **interleaved** with exploration (not a separate pass). Whenever we touch a config, we try 3–5 seed variants and pick the best.

## Current State

**Iteration**: 3 — **Systematic sweep IN PROGRESS**
**Status**: 50 configs seed-tuned. 24 forgettable configs replaced (8 R1, 6 R2, 10 R3). 33 notables. ~57 configs touched out of 100. ~50 configs still need seed-sweeping.

### What's been done

#### Iteration 1 (complete)
- [x] All 100 configs designed across 12 thematic categories
- [x] All 100 rendered (zero failures)
- [x] Full visual review of all 100 images
- [x] Findings written to `output/exploration-notes.md`
- [x] 5 duds replaced and re-rendered
- [x] Initial `output/notable.json` — 20 standouts

#### Iteration 2 (complete)
- [x] Seed sweep Round 1: 25 variants (5 seeds × 5 top standouts) — 4 changed, 1 kept
- [x] Round 1 replacements: 8 forgettable configs → thread-following experiments
- [x] Seed sweep Round 2: 25 variants (5 seeds × 5 new standouts) — 2 changed, 3 kept
- [x] Round 2 replacements: 6 more forgettable configs → dark bloom family completion, achromatic gallery, warm chaos/fog
- [x] **Dark bloom family completed** — 7 hues tested, all beautiful (MAJOR FINDING)
- [x] **Achromatic seed gallery** — 3 configs with identical parameters, different seeds, all distinct
- [x] **Standout seed-tuning Batches 1–3**: 75 variants (5 seeds × 15 standouts) — 11 changed, 4 kept
- [x] **Round 3 replacements**: 10 more forgettable configs → muted+bloom family, Night family expansion, material aesthetics, sparse experiments
- [x] Round 3 renders reviewed — 4 standouts, 4 solid, 2 middle tier, 0 duds
- [x] Notable.json updated (now 33 entries)
- [x] **R3 Seed Sweep (R3A + R3B)**: 50 variants (5 seeds × 10 R3 replacements) — 9 changed, 1 kept
- [x] **Batch 4 (Untuned notables)**: 25 variants (5 seeds × 5 Night/achromatic configs) — 3 changed, 2 kept
- [x] **Batch 5 (Signature Pieces)**: 25 variants (5 seeds × 5 flagship configs) — 4 changed, 1 kept
- [x] **Batch 6 (Thread configs)**: 25 variants (5 seeds × 5 R1/R2 thread configs) — 3 changed, 2 kept
- [x] All changed configs re-rendered (Batches 4-6: 10 configs)

#### Iteration 3 (in progress)
- [x] **Batch 7 (Bloom-dimension originals)**: 25 variants (5 seeds × 5 configs) — 5 changed, 0 kept. 100% improvement rate.
- [ ] Seed-sweep remaining ~50 untouched configs (systematic batches of 5)
- [ ] Replace any weak configs discovered during sweep
- [ ] Update notable.json with newly-tuned standouts
- [ ] Write final deliverables

### Seed Tuning Results (Round 1 — Top 5)

| Config | Original Seed | Winner | Changed? | Key Observation |
|--------|--------------|--------|----------|-----------------|
| #84 Meditation | [1,3,2] | [1,3,2] (a1) | No | Sparse configs are seed-stable — ~120 nodes gives less to rearrange |
| #88 Tempest | [17,13,8] | [0,13,8] (a0) | Yes | Wider horizontal sweep = more storm feeling |
| #19 Night Bloom | [5,5,9] | [13,5,9] (a13) | Yes | Asymmetric void creates the "night," bright rose creates the "bloom" |
| #67 Chartreuse Current | [1,5,11] | [5,5,11] (a5) | Yes | Asymmetric offset creates "current" movement, darkness makes green pop |
| #20 Shadow Lattice | [9,1,0] | [5,1,0] (a5) | Yes | Wide web of fine lines = truest "lattice" reading |

### Standout Seed-Tuning Batches 1–3 (15 configs, 75 variants)

**Batch 1** (3 changed, 2 kept):

| Config | Original Seed | Winner | Changed? | Key Observation |
|--------|--------------|--------|----------|-----------------|
| #10 Prismatic Fog | [8,8,8] | [0,8,8] (a0) | Yes | Widest prismatic spread — most genuinely rainbow fog |
| #12 Amber Lantern | [5,7,14] | [5,7,14] (a5) | No | Best structure through extreme bloom — lantern needs a source shape |
| #14 Dark Jewel Box | [0,3,4] | [0,3,4] (a0) | No | Dark angular shapes frame the jewel, scattered gem-like points |
| #17 Abyssal Green | [7,7,5] | [0,7,5] (a0) | Yes | Deepest "abyssal" framing — dark shapes create looking-into-depth |
| #34 Dense Orbital Teal | [12,4,4] | [0,4,4] (a0) | Yes | Widest orbital distribution — solves density legibility |

**Batch 2** (4 changed, 1 kept):

| Config | Original Seed | Winner | Changed? | Key Observation |
|--------|--------------|--------|----------|-----------------|
| #40 Chaotic Sapphire | [8,14,3] | [13,14,3] (a13) | Yes | Most dramatic — dark geometric shapes create depth and framing |
| #42 Turbulent Ember | [12,7,15] | [9,7,15] (a9) | Yes | Widest scatter/firefly effect — most kinetic energy |
| #58 Dusty Rose | [4,4,9] | [0,4,9] (a0) | Yes | Widest gossamer spread — most delicate, quiet quality |
| #61 Pewter | [1,3,2] | [5,3,2] (a5) | Yes | Widest metallic web — most "pewter vessel" texture |
| #66 Saffron Burst | [7,5,12] | [17,5,12] (a17) | Yes | Focused sparkle point radiating outward — strongest "burst" |

**Batch 3** (4 changed, 1 kept):

| Config | Original Seed | Winner | Changed? | Key Observation |
|--------|--------------|--------|----------|-----------------|
| #54 Flow Transition (Amber) | [5,7,14] | [17,7,14] (a17) | Yes | Visible curving lines — flow=0.60 "transition" quality most readable |
| #78 Atmospheric Silk | [4,0,7] | [0,0,7] (a0) | Yes | Widest gossamer spread — scale=1.0 makes variants fairly similar |
| #79 Chaotic Blades | [8,17,8] | [0,17,8] (a0) | Yes | Most scattered — separated angular teal fragments in disorder |
| #81 Solitude | [0,2,5] | [0,2,5] (a0) | No | EXTREMELY seed-stable (~100 nodes, coh=0.92) — all 5 variants identical |
| #90 Dissolution | [15,13,12] | [0,13,12] (a0) | Yes | Two bright clusters splitting apart — strongest "falling apart" reading |

### R3 Seed Sweep (R3A: 5 configs, R3B: 5 configs — 50 variants total)

**R3A** (4 changed, 1 kept):

| Config | Original Seed | Winner | Changed? | Key Observation |
|--------|--------------|--------|----------|-----------------|
| #25 Dark Bloom Chaos | [9,13,8] | [0,13,8] (a0) | Yes | Widest scatter of luminous fragments in dark haze |
| #35 Night Trifold | [5,5,7] | [13,5,7] (a13) | Yes | Most visible trifold structure — three distinct spatial regions |
| #39 Night Coral | [7,5,14] | [13,5,14] (a13) | Yes | Visible geometric facets give warm coral glow structural interest |
| #59 Antique Bronze | [9,6,13] | [9,6,13] (a9) | No | Best patina quality — wide atmospheric fog with half-hidden forms |
| #80 Orbital Night Rose | [5,5,9] | [0,5,9] (a0) | Yes | Widest atmospheric spread with visible orbital ring structures |

**R3B** (5 changed, 0 kept):

| Config | Original Seed | Winner | Changed? | Key Observation |
|--------|--------------|--------|----------|-----------------|
| #37 Muted Rose Bloom | [5,4,9] | [13,4,9] (a13) | Yes | Best balance of spread, geometric structure, and scattered sparkle |
| #57 Sparse Prismatic | [5,3,8] | [9,3,8] (a9) | Yes | Best prismatic color separation (green/purple/white) |
| #62 Muted Sapphire Bloom | [5,4,5] | [9,4,5] (a9) | Yes | Cleanest sapphire with most elegant geometric planes |
| #73 Muted Turquoise Bloom | [5,4,3] | [13,4,3] (a13) | Yes | Dark angular framing differentiates from Sapphire Bloom |
| #74 Warm Silk | [5,0,14] | [0,0,14] (a0) | Yes | Widest silk-like spread with smooth warm haze |

### Batch 4: Untuned Notables + Night Family (5 configs, 25 variants)

| Config | Original Seed | Winner | Changed? | Key Observation |
|--------|--------------|--------|----------|-----------------|
| #24 Night Amber | [9,7,14] | [0,7,14] (a0) | Yes | Widest warm atmospheric spread with scattered sparkles |
| #27 Night Violet | [7,5,7] | [5,5,7] (a5) | Yes | Dark angular shapes frame the violet glow — "looking into" purple space |
| #46 Dark Crystal | [9,1,0] | [9,1,0] (a9) | No | Current is the strongest "vertical monolith" reading |
| #47 Turquoise Night | [3,5,3] | [17,5,3] (a17) | Yes | Widest spread with strongest angular geometric definition — "deep-sea architecture" |
| #51 Achromatic Veil | [17,1,0] | [17,1,0] (a17) | No | Current is the best "trailing angular lattice" — maximally distinct from Dark Crystal and Shadow Lattice |

**Key insight**: Dark Crystal + Achromatic Veil + Shadow Lattice use identical parameters — the achromatic-dark set supports 5 genuinely distinct artworks from 5 seeds. a0 and a13 are also beautiful but unused.

### Batch 5: Signature Pieces (5 configs, 25 variants)

| Config | Original Seed | Winner | Changed? | Key Observation |
|--------|--------------|--------|----------|-----------------|
| #83 Aurora | [11,6,12] | [0,6,12] (a0) | Yes | Widest prismatic spread with best green-teal-blue color band separation |
| #85 Eruption | [13,12,17] | [13,12,17] (a13) | No | Best balance of wide explosive spread and warm amber intensity |
| #86 Symmetry Breaking | [2,6,7] | [13,6,7] (a13) | Yes | Dark angular shapes create strongest tension between order/disorder |
| #87 Reverie | [6,4,9] | [13,4,9] (a13) | Yes | Widest gossamer spread — barely-there geometric forms capture the dreamlike quality |
| #89 Genesis | [0,0,8] | [13,0,8] (a13) | Yes | Bright central crystal with radiating light beams — "structure emerging from void" |

**Key insight**: a13 won 3 of 5 signature pieces. For conceptually rich configs, a13 often provides the most dramatic/readable compositions. Different from the a0-dominance seen in Night family configs.

### Batch 6: Thread Configs from R1/R2 (5 configs, 25 variants)

| Config | Original Seed | Winner | Changed? | Key Observation |
|--------|--------------|--------|----------|-----------------|
| #49 Chartreuse Night | [5,5,11] | [9,5,11] (a9) | Yes | Best balance of deep emerald atmosphere and visible geometric structure |
| #52 Chartreuse Storm | [0,13,11] | [0,13,11] (a0) | No | Current has widest kinetic scatter of green shards |
| #53 Warm Fog | [7,6,13] | [13,6,13] (a13) | Yes | Dark angular framing adds depth — "looking through warm haze into hidden space" |
| #55 Night Sapphire | [9,5,5] | [9,5,5] (a9) | No | Dark shapes framing bright sapphire core = deepest "gem in a cave" quality |
| #56 Solitary Ember | [5,10,14] | [0,10,14] (a0) | Yes | Offset bright core in surrounding darkness best captures "lone presence" |

### Batch 7: Bloom-Dimension Originals (5 configs, 25 variants)

| Config | Original Seed | Winner | Changed? | Key Observation |
|--------|--------------|--------|----------|-----------------|
| #1 Violet Sanctum (Tight) | [7,6,7] | [13,6,7] (a13) | Yes | Widest spread with layered depth — multiple geometric planes create interesting structure |
| #5 Ember Nimbus | [0,7,14] | [17,7,14] (a17) | Yes | Dark silhouettes at bottom with light radiating up — strongest "firelight" quality |
| #6 Dark Ruby Glow | [9,9,14] | [13,9,14] (a13) | Yes | Widest spread with most visible trifold structure through ruby haze |
| #8 Rose Haze | [6,4,9] | [9,4,9] (a9) | Yes | Widest atmospheric spread with brightest crystalline center — rose bloom fills most of frame |
| #9 Teal Whisper | [7,6,4] | [0,6,4] (a0) | Yes | Widest atmospheric spread with the most "whisper" quality — delicate teal diffusion with geometric depth |

**Key insight**: 100% improvement rate — all 5 bloom-dimension configs benefited from seed tuning. These were the original Round 0 configs that were never touched. a13 won 2/5, consistent with the "a13 is strong for readable compositions" finding.

### Cumulative Seed Tuning Findings (expanded across 50 configs)

1. 39 out of 50 configs improved with different seeds — **78% improvement rate** (up from 75% at 45 configs)
2. **a0 still wins most often** but a13 is catching up — especially for conceptually rich configs where dramatic composition matters
3. **a13 dominates signature pieces** — 3/5 flagship configs chose a13. When the concept benefits from strong geometric framing, a13 delivers.
4. **Seed sensitivity spectrum confirmed** across 45 configs:
   - d=0.02, coh=0.92 → no variation at all (Solitude — all 5 identical)
   - d=0.03, coh=0.90 → minimal variation (Meditation)
   - d=0.06, coh=0.90, achromatic → **maximum variation** (Shadow Lattice)
   - d=0.08+, colorful → moderate variation (most configs)
   - d=0.12, scale=1.0 → near-stable (Atmospheric Silk — scale homogenizes)
   - d=0.30, flow=1.0 → moderate variation (Dense Orbital Teal)
5. Dense configs (d=0.30) still show meaningful seed variation despite high node counts
6. Scale=1.0 configs are nearly seed-stable — the large scale homogenizes arrangement effects
7. **Achromatic-dark set supports 5 distinct artworks** from one parameter set — arrangement slot alone creates distinct compositions when color is removed

### Thread-Following Replacements (Round 1 — 8 configs)

| Old Config | New Config | Thread | Result |
|------------|-----------|--------|--------|
| #046 Partial Divide (Violet) | **Dark Crystal** | achromatic-dark | Vertical crystalline monolith — same params as Shadow Lattice, different seed = different artwork. **Top tier.** |
| #049 Emerging Trifold | **Chartreuse Night** | chartreuse + dark bloom | Green survives in darkness. Deep emerald atmospheric haze. **Standout.** |
| #052 Flow Transition (Violet) | **Chartreuse Storm** | chartreuse + chaos | Angular green shards with kinetic energy. **Standout.** |
| #064 Muted Prismatic | **Chartreuse Mist** | chartreuse + muted | Sage-green fog. Muted chartreuse = contemplative. Solid. |
| #055 Flow Transition (Sapphire) | **Night Sapphire** | dark bloom at blue | Deep blue-purple bloom against darkness. **Top tier.** |
| #038 Random Walk | **Ember Scatter** | warm chaos + sparse | Dying embers in darkness. Contemplative warmth. **Standout.** |
| #082 Congregation | **Night Garden** | dark bloom at green | Rich emerald with atmospheric bloom. **Standout.** |
| #030 Packed Sapphire | **Muted Saffron** | muted + new hues | Warm golden-gray fog. Old gold quality. Solid. |

### Thread-Following Replacements (Round 2 — 6 configs)

| Old Config | New Config | Thread | Result |
|------------|-----------|--------|--------|
| #024 Incandescent Teal | **Night Amber** | dark bloom at amber | Deep firelight in darkness. **Standout.** |
| #027 Bright Dense Coral | **Night Violet** | dark bloom at violet | Deep purple atmospheric field. **Standout.** |
| #053 Partial Divide (Teal) | **Turquoise Night** | dark bloom at turquoise | Bioluminescent deep-sea quality. **Standout.** |
| #057 Dense Partial Trifold | **Achromatic Veil** | achromatic seed gallery | Third seed variant. **Standout.** |
| #060 Flow Transition (Teal) | **Warm Fog** | muted + bloom | Faded gold in haze. **Solid.** |
| #063 Dense Mid-Flow | **Solitary Ember** | warm chaos + ultra-sparse | Single ember in darkness. **Standout.** |

### Thread-Following Replacements (Round 3 — 10 configs)

| Old Config | New Config | Thread | Result |
|------------|-----------|--------|--------|
| #025 Burning Violet | **Dark Bloom Chaos** | dark bloom + disorder | Teal-white fragments in dark haze. Chaos survives darkness. **Solid.** |
| #035 Filled Trifold | **Night Trifold** | dark bloom + division | Purple glow with three-way structure through haze. **Standout.** |
| #037 Scattered Violet | **Muted Rose Bloom** | muted + bloom at rose | Soft muted pink with gossamer bloom. Warm Fog's pink sibling. **Solid.** |
| #039 Soft Chaos | **Night Coral** | dark bloom + warm red | Deep warm golden-red glow. Fills warmest Night family corner. **Standout.** |
| #057 Bloom Mid-Flow | **Sparse Prismatic** | sparse + full spectrum | Scattered multi-color starpoints. Teal dominant. **Middle tier.** |
| #059 Muted Amber | **Antique Bronze** | material aesthetic | Sepia patina quality. Genuinely looks like aged metal. **Standout.** |
| #062 Pastel Spectrum | **Muted Sapphire Bloom** | muted + bloom at blue | Cool blue-purple frost haze. **Solid.** |
| #073 Dense Bright Teal | **Muted Turquoise Bloom** | muted + bloom at turquoise | Teal-green atmospheric haze. **Solid.** |
| #074 Smooth Orbital Panels | **Warm Silk** | material + gossamer | Amber glass with visible facets. Less silky than hoped. **Middle tier** — needs seed tuning. |
| #080 Orbital Trifold Bloom | **Orbital Night Rose** | dark bloom + orbital | Pink-purple spiraling in darkness. **Standout.** |

### Duds (5 configs that lost geometric structure — all fixed in Iteration 1)

| # | Name | Problem | Root Cause | Status |
|---|------|---------|------------|--------|
| 021 | Solar Flare → Solar Corona | Was total blowout | lum 1.0→0.88, bloom 0.75→0.50, scale 0.20→0.35 | **replaced** |
| 036 | Hyper Dense → Dense Atmosphere | Was muddy mass | d 0.65→0.55, scale 0.5→0.85, lum 0.25→0.22 | **replaced** |
| 077 | Dark Dense Monolith → Dark Monolith | Was white orb | scale 0.0→0.15, d 0.30→0.20, lum 0.15→0.12 | **replaced** |
| 089 | Genesis | Was blown-out center | lum 0.50→0.38, scale 0.30→0.45, d 0.15→0.10 | **replaced** |
| 091 | Miniature Violet | Was hot core | scale 0.0→0.10, lum 0.50→0.38, bloom 0.35→0.20 | **replaced** |

### Standouts (33 configs)

See `output/notable.json` for full list with reasoning. Top tier (7):
- Night Bloom, Shadow Lattice, Chartreuse Current, Meditation, Tempest (seed-tuned)
- Dark Crystal, Night Sapphire (from thread exploration)

New from Round 3: Night Trifold, Night Coral, Antique Bronze, Orbital Night Rose

## Decisions Made

1. **Seed tuning is interleaved**, not a separate pass. Whenever we touch a config, try 3–5 seed variants.
2. **The exploration itself matters** — not just the deliverables. Follow threads. Notice the intangible.
3. **100 seed-tuned configs** is the end goal, but getting there should produce understanding, not just images.
4. **Replace forgettable configs** with adventurous experiments following threads from discoveries.
5. **a0 wins most often** — when seed-tuning, a0 (widest spread) is the most common winner. Start there.
6. **Update this log after every batch** — don't wait until the end of a round.

## Working Observations

*These are emerging thoughts about the parameter space. They may be wrong. They get refined as we explore.*

### What makes a standout?
The best configs all share: **readable geometric structure AND emotional character**. The duds lost structure to blowout. But there's a middle tier — technically fine but they don't stop you. The difference between "works" and "makes you feel something" seems tied to:
- **Restraint in at least one axis** — the standouts don't push everything. Meditation is sparse AND muted AND achromatic. Night Bloom is dark but blooming. Tempest is chaotic but has scale.
- **A tension between order and disorder** — not full chaos, not full order, but a specific balance that creates visual interest.
- **Name-image resonance** — the configs where the name perfectly matches the feeling feel stronger, suggesting *intent* matters for evaluating a config.

### Bloom's character
Bloom doesn't just soften — it transforms mood. Zero bloom = precise, architectural, present. High bloom = ethereal, atmospheric, remembered. The most interesting bloom territory is the interaction with *darkness* — Night Bloom (#019, lum=0.12 + bloom=0.80) was the most atmospheric config in the entire set.

### Dark bloom is hue-universal — THE major discovery
The dark+bloom recipe (lum~0.10, bloom~0.70-0.80) produces atmospheric beauty at **every hue in the spectrum**:
- Night Bloom (#19, rose, hue=0.94) — dreamy moonlit flower
- Night Amber (#24, amber, hue=0.06) — deep firelight, warm aureole
- Night Violet (#27, violet, hue=0.744) — deep purple atmospheric field
- Night Coral (#39, coral, hue=0.02) — deep warm golden-red glow
- Turquoise Night (#47, turquoise, hue=0.45) — bioluminescent deep-sea
- Chartreuse Night (#49, lime, hue=0.30) — emerald atmospheric haze
- Night Sapphire (#55, blue, hue=0.625) — mysterious blue-purple gem
- Night Garden (#82, green, hue=0.375) — lush verdant glow
- Night Trifold (#35, violet + division) — structural atmosphere
- Orbital Night Rose (#80, rose + orbital) — spiraling rose petals in darkness

**Why it works**: Low luminosity preserves color saturation (no blowout) while high bloom diffuses light into atmospheric haze. Geometry becomes half-seen — suggested rather than stated.

**Now confirmed**: Dark bloom also survives structural variation (trifold division, orbital flow, chaos). Night Trifold and Orbital Night Rose prove the recipe is robust beyond just hue changes. Dark Bloom Chaos shows it even works with low coherence, though the result is more scattered/fragmentary.

### The muted+bloom family is real (NEW from Round 3)
The muted+bloom recipe (chroma~0.25, bloom~0.60-0.70) creates consistent "looking through colored fog" across hues:
- Warm Fog (#53, amber) — faded gold haze
- Muted Rose Bloom (#37, rose) — soft pink gossamer
- Muted Sapphire Bloom (#62, sapphire) — cool frost window
- Muted Turquoise Bloom (#73, turquoise) — teal-green atmospheric

All four share a gentle, contemplative quality distinct from both the sharp muted configs (Pewter, Dusty Rose) and the Night family (dark+bloom). This is a third mood territory: neither bright nor dark, just *foggy*.

### Material aesthetics are achievable (NEW from Round 3)
Antique Bronze (hue=0.08, chroma=0.18) genuinely evokes aged metal rather than colored light. Combined with earlier observations about Pewter and Muted Saffron, there's a confirmed "material" territory at very low chroma where the renderer stops producing "glowing lights" and starts producing "textured surfaces."

### The Chartreuse family is real
hue=0.30 supports at least 4 distinct aesthetics:
- **Chartreuse Current** — vivid, electric, fresh (the breakthrough)
- **Chartreuse Night** — deep emerald atmospheric (dark bloom)
- **Chartreuse Storm** — kinetic angular shards (chaos)
- **Chartreuse Mist** — sage-green fog (muted)

### Seed sensitivity spectrum (EXPANDED from Batch 3)
Quantified across 25 configs now:
- d=0.02, coh=0.92 → **no variation** (Solitude — all 5 identical)
- d=0.03, coh=0.90 → minimal variation (Meditation)
- d=0.06, coh=0.90, achromatic → **maximum variation** (Shadow Lattice)
- d=0.08+, colorful → moderate variation (most configs)
- d=0.12, scale=1.0 → near-stable (Atmospheric Silk — scale homogenizes)
- d=0.30, flow=1.0 → moderate variation (Dense Orbital Teal — orbital distributes differently)

**New insight**: Scale=1.0 is nearly as stabilizing as ultra-sparse density. When elements fill the frame uniformly, rearranging them doesn't change the overall character much.

### Muted + unusual hues = material aesthetics
Low chroma transforms hues into material qualities rather than light qualities:
- Muted saffron (hue=0.11, chroma=0.20) → antique brass, old gold
- Muted chartreuse (hue=0.30, chroma=0.22) → sage, weathered patina
- Pewter (hue=0.56, chroma=0.12) → silvery metal
- **Antique Bronze (hue=0.08, chroma=0.18) → aged metal, patina** (NEW)

### Hue space has unexplored richness
The existing profiles cluster around violet (0.74), teal (0.51), amber (0.06), sapphire (0.625), and rose (0.94). The gaps at 0.15–0.35 (yellow-green) and 0.44–0.50 (turquoise-aquamarine) are rich.

### The blowout boundary
Session 1 identified the "legibility frontier." This session's duds map the frontier for the bloom dimension: scale=0.0 + density>0.15 = danger zone. lum=1.0 + bloom>0.50 = danger zone.

## Configs Changed So Far (Summary)

**Seeds updated from original (cumulative):**
- Round 1 top 5: #19 Night Bloom, #20 Shadow Lattice, #38 Ember Scatter, #67 Chartreuse Current, #82 Night Garden, #88 Tempest
- Batch 1: #10 Prismatic Fog, #17 Abyssal Green, #34 Dense Orbital Teal
- Batch 2: #40 Chaotic Sapphire, #42 Turbulent Ember, #58 Dusty Rose, #61 Pewter, #66 Saffron Burst
- Batch 3: #54 Flow Trans Amber, #78 Atmospheric Silk, #79 Chaotic Blades, #90 Dissolution
- R3 sweep: #25 Dark Bloom Chaos, #35 Night Trifold, #37 Muted Rose Bloom, #39 Night Coral, #57 Sparse Prismatic, #62 Muted Sapphire Bloom, #73 Muted Turquoise Bloom, #74 Warm Silk, #80 Orbital Night Rose
- Batch 4: #24 Night Amber, #27 Night Violet, #47 Turquoise Night
- Batch 5: #83 Aurora, #86 Symmetry Breaking, #87 Reverie, #89 Genesis
- Batch 6: #49 Chartreuse Night, #53 Warm Fog, #56 Solitary Ember
- Batch 7: #1 Violet Sanctum (Tight), #5 Ember Nimbus, #6 Dark Ruby Glow, #8 Rose Haze, #9 Teal Whisper

**Duds replaced (5)**: #21 Solar Corona, #36 Dense Atmosphere, #77 Dark Monolith, #89 Genesis, #91 Miniature Violet
**Round 1 replacements (8)**: #30→Muted Saffron, #38→Ember Scatter, #46→Dark Crystal, #49→Chartreuse Night, #52→Chartreuse Storm, #55→Night Sapphire, #64→Chartreuse Mist, #82→Night Garden
**Round 2 replacements (6)**: #24→Night Amber, #27→Night Violet, #47→Turquoise Night, #51→Achromatic Veil, #53→Warm Fog, #56→Solitary Ember
**Round 3 replacements (10)**: #25→Dark Bloom Chaos, #35→Night Trifold, #37→Muted Rose Bloom, #39→Night Coral, #57→Sparse Prismatic, #59→Antique Bronze, #62→Muted Sapphire Bloom, #73→Muted Turquoise Bloom, #74→Warm Silk, #80→Orbital Night Rose

**Total configs touched**: ~57 out of 100
**Configs seed-tuned**: 50 (via formal 5-variant sweeps)
**Configs needing seed tuning**: ~50 (untouched originals + unsweept replacements #30 Muted Saffron, #64 Chartreuse Mist + duds #21, #36, #77, #91)

## Open Threads

### Active (ready to follow)
- **Systematic seed sweep** — ~55 configs still not seed-tuned. Work through in batches of 5, prioritizing categories: bloom-dimension, darklands, dense-territories, chaos-theory, etc.
- **Unsweept replacements** — #30 Muted Saffron and #64 Chartreuse Mist were R1 replacements never seed-swept.
- **Unsweept duds** — #21 Solar Corona, #36 Dense Atmosphere, #77 Dark Monolith, #91 Miniature Violet were parameter-fixed but never seed-swept.
- **Update notable.json** — many newly-tuned configs may deserve standout status. Review after systematic sweep is complete.

### Discovered but not yet followed
- Chaos + warmth has 3 members now (Turbulent Ember, Ember Scatter, Solitary Ember) — is there room for a 4th?
- What about Night Bloom at extreme bloom (0.95+)? Pure atmosphere?
- Structure slot experiments — does changing the structure slot matter as much as arrangement?
- The achromatic seed gallery could extend to more seeds — confirmed 5 distinct artworks from one parameter set.

### Closed (answered)
- Does chartreuse work in darkness? **Yes** — Chartreuse Night
- Does chartreuse work desaturated? **Yes** — becomes sage-green
- Does dark bloom work at other hues? **Yes** — tested at ALL 7+ hues. Hue-universal.
- Does the achromatic-dark seed gallery concept work? **Yes** — 3 configs proven, 5 possible
- What makes one seed better than another? **Composition serving intent**
- Is seed tuning consistently worthwhile? **Yes** — 75% improvement rate across 45 configs
- Does dark bloom survive structural variation? **Yes** — works with trifold, orbital, and chaos
- Does the muted+bloom recipe work across hues? **Yes** — tested at amber, rose, sapphire, turquoise. All produce gentle fog quality.
- Can very low chroma create material aesthetics? **Yes** — Antique Bronze genuinely evokes aged metal.
- Does a0 (arrangement slot 0) tend to win? **Yes** — most common winner overall, but a13 dominates signature/conceptual pieces.
- Does Warm Silk improve with seed tuning? **Yes** — a0 fixed the compact composition issue, now has wide silk-like spread.

---

*Last updated: Session 6, Batch 7 complete. 50 configs seed-tuned. 24 forgettables replaced across 3 rounds. 33 notables. ~57/100 configs touched. Next: continue systematic sweep (Batch 8+) of remaining ~50 configs.*
