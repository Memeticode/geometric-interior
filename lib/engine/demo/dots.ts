/**
 * Multi-tiered light dot generation.
 */

import * as THREE from 'three';
import { envelopeSDF } from './envelope.js';
import type { DotConfig, GuideCurve, DotGenerationResult, SphereInstDatum, GlowPointDatum, DotPosition } from '../../types.js';

function gaussianRandom(rng: () => number, mean = 0, stdev = 1): number {
    const u = 1 - rng();
    const v = rng();
    return mean + stdev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function computeFade(dist: number, decayRate: number): number {
    return Math.exp(-decayRate * dist * dist);
}

export function createGlowTexture(): THREE.CanvasTexture {
    const size = 128;
    const canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(size, size)
        : (() => { const c = document.createElement('canvas'); c.width = size; c.height = size; return c; })();
    const ctx = canvas.getContext('2d')! as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    const half = size / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    gradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.25)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.10)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.03)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas as HTMLCanvasElement);
}

export function generateDots(
    config: DotConfig,
    guideCurves: GuideCurve[],
    envelopeRadii: THREE.Vector3,
    rng: () => number,
): DotGenerationResult {
    const sphereInstData: SphereInstDatum[] = [];
    const glowPointData: GlowPointDatum[] = [];
    const allDotPositions: DotPosition[] = [];

    function registerLightSphere(position: THREE.Vector3, radius: number, color: THREE.Color, glowScale: number): void {
        sphereInstData.push({ position: position.clone(), radius, color: color.clone() });
        if (glowScale > 0) {
            glowPointData.push({ position: position.clone(), size: radius * glowScale });
        }
    }

    // Hero dots
    for (let i = 0; i < config.heroDotCount; i++) {
        const pos = new THREE.Vector3(
            gaussianRandom(rng, 0, config.heroDotSpread[0]),
            gaussianRandom(rng, 0, config.heroDotSpread[1]),
            gaussianRandom(rng, 0, config.heroDotSpread[2])
        );
        const radius = (config.heroDotRadiusBase + rng() * config.heroDotRadiusRange) * 0.3;
        registerLightSphere(pos, radius, new THREE.Color(1, 1, 1),
            config.heroDotGlowBase + rng() * config.heroDotGlowRange);
        allDotPositions.push({ pos: pos.clone(), tier: 'hero', intensity: 1.0 });
    }

    // Medium dots along primary curves
    let medCount = 0;
    for (const curve of guideCurves.filter(c => c.tier === 'primary')) {
        if (medCount >= config.mediumDotCount) break;
        const idx = Math.floor(curve.length * (0.3 + rng() * 0.4));
        if (idx < curve.length) {
            const pos = curve[idx].clone().add(new THREE.Vector3(
                gaussianRandom(rng, 0, config.mediumDotJitter),
                gaussianRandom(rng, 0, config.mediumDotJitter),
                gaussianRandom(rng, 0, config.mediumDotJitter)
            ));
            const dist = pos.length();
            const fade = computeFade(dist, 0.4);
            const radius = (config.mediumDotRadiusBase + rng() * config.mediumDotRadiusRange + fade * 0.010) * 0.3;
            registerLightSphere(pos, radius, new THREE.Color(1, 1, 1),
                config.mediumDotGlowBase + rng() * config.mediumDotGlowRange);
            allDotPositions.push({ pos: pos.clone(), tier: 'medium', intensity: 0.5 });
            medCount++;
        }
    }

    // Small dots along all curves
    for (const curve of guideCurves) {
        const density = config.smallDotDensity[curve.tier] || 0.05;
        for (let i = 0; i < curve.length; i++) {
            if (rng() < density) {
                const pos = curve[i].clone().add(new THREE.Vector3(
                    gaussianRandom(rng, 0, 0.03),
                    gaussianRandom(rng, 0, 0.03),
                    gaussianRandom(rng, 0, 0.03)
                ));
                const dist = pos.length();
                const radius = (config.smallDotRadiusBase + rng() * config.smallDotRadiusRange) * 0.3;
                const dotFade = Math.exp(-0.3 * dist * dist);
                const edgeness = Math.pow(1.0 - dotFade, 0.6);
                const dotHue = (config.dotBaseHue + edgeness * 60 + rng() * 25) / 360;
                const dotSat = edgeness * 0.90 + 0.08;
                const dotLightness = config.smallDotLightnessBase + dotFade * config.smallDotLightnessRange;
                const dotColor = new THREE.Color().setHSL(dotHue, dotSat, dotLightness);
                registerLightSphere(pos, radius, dotColor,
                    config.smallDotGlowBase + dotFade * 6 + edgeness * 5 + rng() * 4);
                allDotPositions.push({ pos: pos.clone(), intensity: 0.15 });
            }
        }
    }

    // Interior volume dots
    for (let i = 0; i < config.interiorDotCount; i++) {
        let pos: THREE.Vector3;
        let attempts = 0;
        do {
            pos = new THREE.Vector3(
                gaussianRandom(rng, 0, config.interiorDotSpread[0]),
                gaussianRandom(rng, 0, config.interiorDotSpread[1]),
                gaussianRandom(rng, 0, config.interiorDotSpread[2])
            );
            attempts++;
        } while (envelopeSDF(pos, envelopeRadii) > -0.05 && attempts < 50);
        const dist = pos.length();
        const radius = (config.smallDotRadiusBase + rng() * config.smallDotRadiusRange) * 0.3;
        const dotFade = Math.exp(-0.3 * dist * dist);
        const edgeness = Math.pow(1.0 - dotFade, 0.6);
        const dotHue = (config.dotBaseHue + edgeness * 60 + rng() * 25) / 360;
        const dotSat = edgeness * 0.90 + 0.08;
        const dotLightness = config.smallDotLightnessBase + dotFade * config.smallDotLightnessRange;
        const dotColor = new THREE.Color().setHSL(dotHue, dotSat, dotLightness);
        registerLightSphere(pos, radius, dotColor,
            config.smallDotGlowBase + dotFade * 6 + edgeness * 5 + rng() * 4);
        allDotPositions.push({ pos: pos.clone(), intensity: 0.15 });
    }

    // Micro-dot scatter
    for (let i = 0; i < config.microDotCount; i++) {
        let pos: THREE.Vector3;
        let attempts = 0;
        do {
            pos = new THREE.Vector3(
                gaussianRandom(rng, 0, config.microDotSpread[0]),
                gaussianRandom(rng, 0, config.microDotSpread[1]),
                gaussianRandom(rng, 0, config.microDotSpread[2])
            );
            attempts++;
        } while (envelopeSDF(pos, envelopeRadii) > 0.05 && attempts < 50);
        const dist = pos.length();
        const dotFade = Math.exp(-0.25 * dist * dist);
        const radius = (config.microDotRadiusBase + rng() * config.microDotRadiusRange) * 0.3;
        const edgeness = Math.pow(1.0 - dotFade, 0.6);
        const dotHue = (config.microDotBaseHue + edgeness * 70 + rng() * 30) / 360;
        const dotSat = edgeness * 0.85 + 0.12;
        const dotLightness = config.microDotLightnessBase + dotFade * config.microDotLightnessRange;
        const dotColor = new THREE.Color().setHSL(dotHue, dotSat, dotLightness);
        registerLightSphere(pos, radius, dotColor,
            config.microDotGlowBase + dotFade * 5 + edgeness * 6 + rng() * 4);
        allDotPositions.push({ pos: pos.clone(), intensity: 0.05 });
    }

    const significantLights = allDotPositions.filter(d => d.tier === 'hero' || d.tier === 'medium');
    const MAX_LIGHTS = 10;
    const lightPosArray: THREE.Vector3[] = [];
    const lightIntensityArray: number[] = [];
    for (let i = 0; i < MAX_LIGHTS; i++) {
        if (i < significantLights.length) {
            lightPosArray.push(significantLights[i].pos.clone());
            lightIntensityArray.push(significantLights[i].intensity);
        } else {
            lightPosArray.push(new THREE.Vector3());
            lightIntensityArray.push(0);
        }
    }

    return {
        sphereInstData,
        glowPointData,
        allDotPositions,
        lightUniforms: {
            uLightPositions: { value: lightPosArray },
            uLightIntensities: { value: lightIntensityArray },
            uLightCount: { value: Math.min(significantLights.length, MAX_LIGHTS) },
        },
    };
}
