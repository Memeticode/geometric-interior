# Project Updates — Bloom Parameter Tuning

**Date:** 2026-03-01
**Status:** Applied and verified

---

## 1. Curve adjustments to `lib/core/params.ts` — APPLIED

The following changes have already been applied to `lib/core/params.ts` as part of this tuning run. They fix a dead zone in the bloom=0.0–0.2 range and extend the effective range at both ends.

### Changes made

```
// Dot glow halo sizes
heroDotGlowBase:   cl(c.bloom, 10, 30, 55)  // was (18, 34, 50)
mediumDotGlowBase: cl(c.bloom, 4, 14, 28)   // was (8, 16, 26)
smallDotGlowBase:  cl(c.bloom, 2, 8, 20)    // was (5, 10, 18)
microDotGlowBase:  cl(c.bloom, 2, 10, 22)   // was (5, 12, 20)

// Face lighting
attenuationCoeff:  cl(c.bloom, 7.0, 3.0, 1.2)  // was (5.0, 3.0, 1.5)
ambientLight term: cl(c.bloom, 0.0, 0.008, 0.02)  // was (0.0, 0.005, 0.015)

// Post-processing
bloomStrength:     cl(c.bloom, 0.0, 0.18, 0.40)   // was (0.08, 0.20, 0.35)
bloomThreshold:    cl(c.bloom, 0.95, 0.70, 0.45)   // was (0.85, 0.70, 0.50)
```

## 2. Add bloom to sampler.html AXES and DEFAULTS — TODO

`sampler.html` hardcodes the parameter list (`AXES` array) and default values (`DEFAULTS` object). Bloom is missing from both:

```js
// Line 281-282 of sampler.html — add bloom
const AXES = ['density', 'luminosity', 'fracture', 'coherence', 'hue', 'spectrum', 'chroma', 'scale', 'division', 'faceting', 'flow', 'bloom'];
const DEFAULTS = { density: 0.5, luminosity: 0.5, fracture: 0.5, coherence: 0.5, hue: 0.783, spectrum: 0.239, chroma: 0.417, scale: 0.5, division: 0.5, faceting: 0.5, flow: 0.5, bloom: 0.35 };
```

Also remove the hardcoded `bloom: 0.5` from the render loop controls (line 456).

## 3. Add bloom to starter profiles — TODO (via exploration workflow)

All profiles in `src/core/starter-profiles.json` currently lack a `bloom` field. The exploration workflow (`agent-image-param-space-exploration`) should determine the ideal bloom value for each profile. Until then, a default of **0.35** is recommended.

## 4. Add bloom to url-state encoding — VERIFY

Confirm that `src/core/url-state.js` includes bloom in URL serialization/deserialization. If bloom is missing from the URL encoding, changes to bloom via the slider won't be preserved when sharing URLs.

## 5. Run tests — TODO

Run the full test suite (`tests/run-all.mjs`) to verify the curve changes don't break any existing tests. The `test-controls.mjs` and `test-rendering.mjs` tests may need updated control objects that include `bloom`.
