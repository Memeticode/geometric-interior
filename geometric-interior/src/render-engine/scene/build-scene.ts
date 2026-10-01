/**
 * Scene builder — orchestrates envelope, guide curves, dots,
 * folding chains, tendrils, and batched geometry into a single scene.
 *
 * RNG streams are consumed in a fixed order (curves → dots → chains →
 * tendrils); mesh construction consumes none. Keep it that way or every
 * seed renders differently.
 */

import * as THREE from 'three';
import { gaussianRandom } from '../../utils/math.js';
import { envelopeSDF } from './envelope.js';
import { generateAllGuideCurves, sampleAlongCurve, drapingDirection } from './guide-curves.js';
import { createAccumulators, createFoldingChain } from './folding-chains.js';
import { generateDots } from './dots.js';
import { compositeFlowField, colorFieldHue } from './flow-field.js';
import {
    createFaceMaterial,
    createEdgeMaterial,
    createGlowMaterial,
    createTendrilMaterial,
} from '../materials.js';
import type { BatchAccumulators, DerivedParams, DotPosition, GlowPointDatum, GuideCurve, LightUniforms } from '../models.js';
import type { SceneBuildResult } from '../interfaces.js';
import type { SceneRngStreams } from '../../core/text-generation/seed-tags.js';

export function buildScene(
    params: DerivedParams,
    streams: SceneRngStreams,
    scene: THREE.Scene,
    glowTexture: THREE.Texture,
): SceneBuildResult {
    const envelopeRadii = new THREE.Vector3(...params.envelopeRadii);

    // 1. Guide curves + dots (arrangement stream). Arrangement bias rotates seed placement.
    const thetaOffset = streams.arrangementBias * Math.PI * 2;
    const guideCurves = generateAllGuideCurves(
        params.curveConfig, streams.arrangementRng, envelopeRadii, params.divisionParams, thetaOffset);
    const { sphereInstData, glowPointData, allDotPositions, lightUniforms } =
        generateDots(params.dotConfig, guideCurves, envelopeRadii, streams.arrangementRng);

    // 2. Folding chains (structure + detail streams)
    const { faceAccum, edgeAccum } = buildChains(params, streams, guideCurves, allDotPositions, envelopeRadii);

    // 3. Tendril segments (detail stream — must run after the chains)
    const tendrils = buildTendrilSegments(params, streams.detailRng, guideCurves);

    // 4. Meshes, added in render-tie order: spheres, glow, faces, edges, tendrils
    if (sphereInstData.length > 0) scene.add(createSphereMesh(sphereInstData));
    if (glowPointData.length > 0) scene.add(createGlowMesh(glowPointData, glowTexture));
    if (faceAccum.pos.length > 0) scene.add(createFaceMesh(faceAccum, lightUniforms, params));
    if (edgeAccum.pos.length > 0) {
        scene.add(createLineSegmentMesh(createEdgeMaterial(), {
            aStartPos:   [endpoint(edgeAccum.pos, 3, 0), 3],
            aEndPos:     [endpoint(edgeAccum.pos, 3, 1), 3],
            aStartAlpha: [endpoint(edgeAccum.alpha, 1, 0), 1],
            aEndAlpha:   [endpoint(edgeAccum.alpha, 1, 1), 1],
            aColor:      [endpoint(edgeAccum.color, 3, 0), 3],
            aOpacity:    [endpoint(edgeAccum.opacity, 1, 0), 1],
        }));
    }
    if (tendrils.pos.length > 0) {
        scene.add(createLineSegmentMesh(createTendrilMaterial(), {
            aStartPos:   [endpoint(tendrils.pos, 3, 0), 3],
            aEndPos:     [endpoint(tendrils.pos, 3, 1), 3],
            aStartColor: [endpoint(tendrils.color, 3, 0), 3],
            aEndColor:   [endpoint(tendrils.color, 3, 1), 3],
        }));
    }

    return {
        nodeCount: allDotPositions.length,
        faceCount: faceAccum.pos.length / 9,
    };
}

/* ── Geometry generation ── */

function buildChains(
    params: DerivedParams,
    streams: SceneRngStreams,
    guideCurves: GuideCurve[],
    allDotPositions: DotPosition[],
    envelopeRadii: THREE.Vector3,
): BatchAccumulators {
    const { structureRng, detailRng } = streams;
    const div = params.divisionParams;
    const accum = createAccumulators();

    // Detail bias → hue warmth shift (−10° to +10°)
    const warmthShift = (streams.detailBias - 0.5) * 20;

    function pickColor(distFromCenter: number, decayRate: number, lightnessBoost: number, familyHue: number | null): THREE.Color {
        const fade = Math.exp(-decayRate * distFromCenter * distFromCenter);
        let baseHue: number;
        if (familyHue !== null && familyHue !== undefined) {
            baseHue = familyHue + (detailRng() - 0.5) * 35 + warmthShift;
        } else {
            const centerHue = params.baseHue + 25 + detailRng() * 40 + warmthShift;
            const edgeHue = params.baseHue - 50 + detailRng() * 40 + warmthShift;
            baseHue = edgeHue + fade * (centerHue - edgeHue);
        }
        const saturation = Math.min(params.saturation * 0.75 + detailRng() * 0.25 + (1 - fade) * 0.05, 1.0);
        const lightness = Math.min(0.06 + detailRng() * 0.08 + fade * (0.22 + detailRng() * 0.22) + lightnessBoost, 0.60);
        return new THREE.Color().setHSL(baseHue / 360, saturation, lightness);
    }

    // Structure bias → nudge chain geometry parameters
    const structBias = streams.structureBias;
    const chainConfig = {
        edgeColorOffset: params.edgeColorOffset,
        edgeOpacityBase: params.edgeOpacityBase,
        edgeOpacityFadeScale: params.edgeOpacityFadeScale,
        crackExtendScale: params.crackExtendScale,
        faceOpacityScale: params.faceOpacityScale,
        quadProbability: params.facetingParams.quadProbability + (structBias - 0.5) * 0.1,
        dihedralBase: params.facetingParams.dihedralBase * (0.9 + structBias * 0.2),
        dihedralRange: params.facetingParams.dihedralRange,
        contractionBase: params.facetingParams.contractionBase,
        contractionRange: params.facetingParams.contractionRange,
    };

    const tierChainConfig: Record<string, { chainLen: () => number; scale: () => number; spread: number; dualProb: number; spacing: number }> = {};
    for (const [tier, c] of Object.entries(params.chains)) {
        tierChainConfig[tier] = {
            chainLen: () => c.chainLenBase + Math.floor(structureRng() * c.chainLenRange),
            scale: () => c.scaleBase + structureRng() * c.scaleRange,
            spread: c.spread,
            dualProb: c.dualProb,
            spacing: c.spacing,
        };
    }

    // Chains draped along each guide curve
    for (const curve of guideCurves) {
        const config = tierChainConfig[curve.tier];
        if (!config) continue;
        const samples = sampleAlongCurve(curve, config.spacing, envelopeRadii, div);

        for (const sample of samples) {
            let dir1 = drapingDirection(sample, config.spread, structureRng);
            if (params.flowInfluence > 0) {
                const flow = compositeFlowField(sample.pos, params.flowScale, params.flowType);
                dir1.lerp(flow, params.flowInfluence).normalize();
            }
            const familyHue = colorFieldHue(sample.pos, params.colorFieldScale, params.baseHue, params.hueRange)
                + (detailRng() - 0.5) * 30;
            const chainLen = config.chainLen();
            const planeScale = config.scale();

            createFoldingChain(accum, sample.pos, chainLen, planeScale,
                sample.pos.length(), allDotPositions, chainConfig, structureRng, pickColor,
                familyHue, dir1);

            if (structureRng() < config.dualProb) {
                const flippedBinormal = sample.binormal.clone().negate();
                const flippedSample = { ...sample, binormal: flippedBinormal };
                let dir2 = drapingDirection(flippedSample, config.spread, structureRng);
                if (params.flowInfluence > 0) {
                    const flow = compositeFlowField(sample.pos, params.flowScale, params.flowType);
                    dir2.lerp(flow, params.flowInfluence).normalize();
                }
                createFoldingChain(accum, sample.pos, chainLen, planeScale,
                    sample.pos.length(), allDotPositions, chainConfig, structureRng, pickColor,
                    familyHue + (detailRng() - 0.5) * 15, dir2);
            }
        }
    }

    // Atmospheric scatter
    for (let i = 0; i < params.atmosphericCount; i++) {
        let pos: THREE.Vector3;
        let attempts = 0;
        do {
            pos = new THREE.Vector3(
                gaussianRandom(structureRng, 0, 0.6),
                gaussianRandom(structureRng, 0, 0.4),
                gaussianRandom(structureRng, 0, 0.5)
            );
            attempts++;
        } while (envelopeSDF(pos, envelopeRadii, div) > -0.1 && attempts < 50);
        const flowNorm = compositeFlowField(pos, params.flowScale, params.flowType);
        const familyHue = colorFieldHue(pos, params.colorFieldScale, params.baseHue, params.hueRange)
            + (detailRng() - 0.5) * 40;
        const planeScale = 0.5 + structureRng() * 0.3;
        const chainLen = 3 + Math.floor(structureRng() * 2);
        createFoldingChain(accum, pos, chainLen, planeScale, pos.length(),
            allDotPositions, chainConfig, structureRng, pickColor, familyHue, flowNorm);
    }

    return accum;
}

/** Tendril line segments along each guide curve, as [start, end] pairs. */
function buildTendrilSegments(
    params: DerivedParams,
    detailRng: () => number,
    guideCurves: GuideCurve[],
): { pos: number[]; color: number[] } {
    const pos: number[] = [];
    const color: number[] = [];
    for (const curve of guideCurves) {
        if (curve.length < 4) continue;
        const spline = new THREE.CatmullRomCurve3(curve);
        const pts = spline.getPoints(Math.max(16, curve.length * 2));

        const hue = (params.tendrilHueBase + detailRng() * params.tendrilHueRange) / 360;
        const sat = params.tendrilSatBase + detailRng() * params.tendrilSatRange;
        const opacity = curve.tier === 'primary'
            ? params.tendrilOpacity.primary
            : params.tendrilOpacity.other;

        const ptColors: number[] = [];
        for (const pt of pts) {
            const d = pt.length();
            const f = Math.exp(-1.5 * d * d);
            const c = new THREE.Color().setHSL(hue, sat, 0.04 + f * 0.20);
            ptColors.push(c.r * opacity, c.g * opacity, c.b * opacity);
        }

        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i], b = pts[i + 1];
            pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
            const j = i * 3, k = (i + 1) * 3;
            color.push(ptColors[j], ptColors[j + 1], ptColors[j + 2],
                ptColors[k], ptColors[k + 1], ptColors[k + 2]);
        }
    }
    return { pos, color };
}

/* ── Mesh construction ── */

/** Light spheres at the larger dots. */
function createSphereMesh(data: { position: THREE.Vector3; radius: number; color: THREE.Color }[]): THREE.InstancedMesh {
    const material = new THREE.MeshBasicMaterial({ depthWrite: false, transparent: true });
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), material, data.length);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < data.length; i++) {
        dummy.position.copy(data[i].position);
        dummy.scale.setScalar(data[i].radius);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, data[i].color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
    mesh.renderOrder = 0;
    return mesh;
}

/** Glow billboards (instanced quads — resolution-independent). */
function createGlowMesh(data: GlowPointDatum[], glowTexture: THREE.Texture): THREE.Mesh {
    const count = data.length;
    const centers = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        centers[i * 3]     = data[i].position.x;
        centers[i * 3 + 1] = data[i].position.y;
        centers[i * 3 + 2] = data[i].position.z;
        sizes[i]           = data[i].size;
    }

    const geom = new THREE.InstancedBufferGeometry();
    // Per-vertex: quad corner offsets
    geom.setAttribute('aQuadOffset',
        new THREE.BufferAttribute(new Float32Array([-0.5, -0.5,  0.5, -0.5,  0.5, 0.5,  -0.5, 0.5]), 2));
    geom.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1));
    // Per-instance: dot data
    geom.setAttribute('aCenter', new THREE.InstancedBufferAttribute(centers, 3));
    geom.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 1));

    const mesh = new THREE.Mesh(geom, createGlowMaterial(glowTexture));
    mesh.frustumCulled = false;
    mesh.renderOrder = 0;
    return mesh;
}

/** All chain planes batched into one mesh. */
function createFaceMesh(faceAccum: BatchAccumulators['faceAccum'], lightUniforms: LightUniforms, params: DerivedParams): THREE.Mesh {
    const geom = new THREE.BufferGeometry();
    const attr = (data: number[], size: number) => new THREE.BufferAttribute(new Float32Array(data), size);
    geom.setAttribute('position', attr(faceAccum.pos, 3));
    geom.setAttribute('normal', attr(faceAccum.norm, 3));
    geom.setAttribute('uv', attr(faceAccum.uv, 2));
    geom.setAttribute('vAlpha', attr(faceAccum.alpha, 1));
    geom.setAttribute('aColor', attr(faceAccum.color, 3));
    geom.setAttribute('aBaseOpacity', attr(faceAccum.opacity, 1));
    geom.setAttribute('aNoiseScale', attr(faceAccum.noiseScale, 1));
    geom.setAttribute('aNoiseStrength', attr(faceAccum.noiseStrength, 1));
    geom.setAttribute('aCrackExtend', attr(faceAccum.crackExtend, 1));

    const material = createFaceMaterial(lightUniforms, params);
    material.uniforms.uCameraPos.value.set(0, 0, params.cameraZ);

    const mesh = new THREE.Mesh(geom, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    return mesh;
}

/**
 * Instanced screen-space line segments (edges, tendrils): one quad per
 * segment, expanded to a fixed pixel width in the vertex shader.
 */
function createLineSegmentMesh(
    material: THREE.ShaderMaterial,
    perSegment: Record<string, [Float32Array, number]>,
): THREE.Mesh {
    const geom = new THREE.InstancedBufferGeometry();
    // Per-vertex: quad corners (along, side)
    geom.setAttribute('aLineCorner', new THREE.BufferAttribute(
        new Float32Array([0, -0.5,  1, -0.5,  1, 0.5,  0, 0.5]), 2));
    geom.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1));
    for (const [name, [data, size]] of Object.entries(perSegment)) {
        geom.setAttribute(name, new THREE.InstancedBufferAttribute(data, size));
    }

    const mesh = new THREE.Mesh(geom, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    return mesh;
}

/**
 * Pick one endpoint from per-segment [start, end] pairs of `size` floats
 * each (0 = start, 1 = end).
 */
function endpoint(pairs: number[], size: number, which: 0 | 1): Float32Array {
    const count = pairs.length / (size * 2);
    const out = new Float32Array(count * size);
    for (let i = 0; i < count; i++) {
        for (let k = 0; k < size; k++) out[i * size + k] = pairs[(i * 2 + which) * size + k];
    }
    return out;
}
