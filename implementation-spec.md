# Implementation Specification

## Overview

This document describes the technical architecture required to implement
the crystalline plane generative system in a web application
environment.

The implementation should prioritize:

-   deterministic generation
-   controlled distribution-driven randomness
-   depth fidelity
-   transparency coherence
-   scalable architecture

WebGL (via Three.js or raw WebGL2) is recommended.

------------------------------------------------------------------------

## System Architecture

The system should be divided into the following layers:

1.  Seed & Parameter System  
2.  Topology / Governing Field  
3.  Plane Generation Engine  
4.  Fractalization Modules  
5.  Rendering & Transparency Strategy  
6.  Postprocessing  
7.  Serialization & Reproducibility

------------------------------------------------------------------------

## 1. Seed & Parameter System

-   Single deterministic PRNG instance per scene.
-   All randomness derived from seed.
-   Distributions preferred over uniform randomness:
    -   log-normal (plane sizes)
    -   power-law (depth bias)
    -   gaussian (orientation jitter)
    -   Poisson-disk (optional spatial spacing)

Preset abstraction layer should expose semantic controls such as: -
tension - coherence - fracture - luminosity - density - palette

These map internally to numeric ranges.

------------------------------------------------------------------------

## 2. Topology / Governing Structure

A topology module defines positional bias and orientation frames.

Examples: - Möbius manifold - Icosahedral directional bias -
Multi-attractor field - Curl-noise vector field

Each topology should expose:

-   samplePosition(u, v)
-   sampleFrame(u, v)
-   densityInfluence(position)

Topologies bias generation but do not fully constrain geometry.

------------------------------------------------------------------------

## 3. Plane Generation Engine

Generate stratified layers:

-   Primary planes (large, compositional anchors)
-   Secondary planes (medium, intersection-biased)
-   Micro shards (small, limited count)

Each plane instance stores:

-   position (vec3)
-   orientation (quat or mat3)
-   size (vec2)
-   shape seed
-   opacity
-   emissive strength
-   depth bucket

Planes must not default to radial explosion patterns. Off-axis
composition is preferred.

------------------------------------------------------------------------

## 4. Fractalization Modules

### Edge Fractalization

-   Limited midpoint subdivision (1–3 iterations max).
-   Displacement scaled by plane size.
-   Optional micro-shard spawning at edges.

### Field Fractalization

-   fBm perturbation applied to orientation.
-   Low amplitude.
-   Coherent spatial noise (3–5 octaves max).

### Light Fractalization

-   fBm modulation of emissive intensity.
-   World-space noise sampling.
-   Optional subtle chromatic micro-variation within unified palette.

Fractal amplitude must be bounded. Avoid runaway recursion.

------------------------------------------------------------------------

## 5. Transparency & Depth Strategy

Recommended: Weighted Blended Order-Independent Transparency (OIT).

Alternatives: - Depth bucket sorting - Dithered alpha with accumulation

Depth fog should be applied to enhance spatial layering.

------------------------------------------------------------------------

## 6. Shading & Postprocessing

Shader features:

-   Fresnel-based edge brightening
-   Emissive core contribution
-   Depth attenuation
-   Optional UV noise distortion for refractive illusion

Postprocessing chain:

1.  Bright pass extraction
2.  Multi-scale bloom
3.  Subtle chromatic aberration
4.  Vignette
5.  Fine grain

Keep postprocessing controlled and restrained.

------------------------------------------------------------------------

## 7. Animation (Optional)

-   Micro camera orbit
-   Subtle noise phase drift
-   Emissive shimmer modulation

All animation should be slow and atmospheric.

------------------------------------------------------------------------

## Serialization

Scene should be fully reproducible via:

-   seed
-   preset name
-   resolved parameter snapshot

Export format: JSON

------------------------------------------------------------------------

## Non-Goals

-   Physical accuracy
-   Particle explosion aesthetics
-   Unbounded recursion
-   Uncontrolled randomness

------------------------------------------------------------------------

The implementation should produce compositions that feel deliberate,
structured, and psychologically immersive rather than chaotic.
