/**
 * Demo scene builder — orchestrates envelope, guide curves, dots,
 * folding chains, tendrils, and batched geometry into a single scene.
 */

import * as THREE from 'three';
import { envelopeSDF } from './envelope.js';
import { generateAllGuideCurves, sampleAlongCurve, drapingDirection } from './guide-curves.js';
import { createAccumulators, createFoldingChain } from './folding-chains.js';
import { generateDots, createGlowTexture } from './dots.js';
import { compositeFlowField, colorFieldHue } from './flow-field.js';
import {
    createDemoFaceMaterial,
    createDemoEdgeMaterial,
    createDemoGlowMaterial,
} from '../materials.js';
import type { DerivedParams, SceneBuildResult, SceneRngStreams } from '../../types.js';

export function buildDemoScene(
    params: DerivedParams,
    rngOrStreams: (() => number) | SceneRngStreams,
    scene: THREE.Scene,
    glowTexture?: THREE.Texture,
): SceneBuildResult {
    // Normalize: accept either a single rng (legacy) or three independent streams
    const streams: SceneRngStreams = typeof rngOrStreams === 'function'
        ? {
            arrangementRng: rngOrStreams,
            structureRng: rngOrStreams,
            detailRng: rngOrStreams,
            arrangementBias: 0.5,
            structureBias: 0.5,
            detailBias: 0.5,
        }
        : rngOrStreams;

    const { arrangementRng, structureRng, detailRng } = streams;

    const envelopeRadii = new THREE.Vector3(...params.envelopeRadii);
    const div = params.divisionParams;

    // Arrangement bias → rotation offset for seed point placement
    const thetaOffset = streams.arrangementBias * Math.PI * 2;

    // 1. Generate guide curves (arrangement stream)
    const guideCurves = generateAllGuideCurves(params.curveConfig, arrangementRng, envelopeRadii, div, thetaOffset);

    // 2. Generate dots (arrangement stream — spatially tied to layout)
    const dotResult = generateDots(params.dotConfig, guideCurves, envelopeRadii, arrangementRng);
    const { sphereInstData, glowPointData, allDotPositions, lightUniforms } = dotResult;

    // 3. Build light sphere InstancedMesh
    let sphereInst: THREE.InstancedMesh | null = null;
    let sphereMat: THREE.MeshBasicMaterial | null = null;
    if (sphereInstData.length > 0) {
        const sphereGeo = new THREE.SphereGeometry(1, 16, 12);
        sphereMat = new THREE.MeshBasicMaterial({ depthWrite: false });
        sphereInst = new THREE.InstancedMesh(sphereGeo, sphereMat, sphereInstData.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < sphereInstData.length; i++) {
            dummy.position.copy(sphereInstData[i].position);
            dummy.scale.setScalar(sphereInstData[i].radius);
            dummy.updateMatrix();
            sphereInst.setMatrixAt(i, dummy.matrix);
            sphereInst.setColorAt(i, sphereInstData[i].color);
        }
        sphereInst.instanceMatrix.needsUpdate = true;
        sphereInst.instanceColor!.needsUpdate = true;
        sphereInst.renderOrder = 0;
        scene.add(sphereInst);
    }

    // 4. Build glow points
    if (!glowTexture) glowTexture = createGlowTexture();
    let glowPoints: THREE.Points | null = null;
    let glowMat: THREE.ShaderMaterial | null = null;
    if (glowPointData.length > 0) {
        const positions = new Float32Array(glowPointData.length * 3);
        const sizes = new Float32Array(glowPointData.length);
        for (let i = 0; i < glowPointData.length; i++) {
            positions[i * 3] = glowPointData[i].position.x;
            positions[i * 3 + 1] = glowPointData[i].position.y;
            positions[i * 3 + 2] = glowPointData[i].position.z;
            sizes[i] = glowPointData[i].size;
        }
        const glowGeom = new THREE.BufferGeometry();
        glowGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        glowGeom.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        glowMat = createDemoGlowMaterial(glowTexture);
        glowPoints = new THREE.Points(glowGeom, glowMat);
        glowPoints.frustumCulled = false;
        glowPoints.renderOrder = 0;
        scene.add(glowPoints);
    }

    // 5. Create folding chains along guide curves
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

    // 6. Build batched face mesh
    const { faceAccum, edgeAccum } = accum;
    let faceCount = 0;
    let faceMesh: THREE.Mesh | null = null;
    let faceMat: THREE.ShaderMaterial | null = null;

    if (faceAccum.pos.length > 0) {
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(faceAccum.pos), 3));
        geom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(faceAccum.norm), 3));
        geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(faceAccum.uv), 2));
        geom.setAttribute('vAlpha', new THREE.BufferAttribute(new Float32Array(faceAccum.alpha), 1));
        geom.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(faceAccum.color), 3));
        geom.setAttribute('aBaseOpacity', new THREE.BufferAttribute(new Float32Array(faceAccum.opacity), 1));
        geom.setAttribute('aNoiseScale', new THREE.BufferAttribute(new Float32Array(faceAccum.noiseScale), 1));
        geom.setAttribute('aNoiseStrength', new THREE.BufferAttribute(new Float32Array(faceAccum.noiseStrength), 1));
        geom.setAttribute('aCrackExtend', new THREE.BufferAttribute(new Float32Array(faceAccum.crackExtend), 1));
        geom.setAttribute('aFoldDelay', new THREE.BufferAttribute(new Float32Array(faceAccum.foldDelay), 1));
        geom.setAttribute('aFoldOrigin', new THREE.BufferAttribute(new Float32Array(faceAccum.foldOrigin), 3));

        faceMat = createDemoFaceMaterial(lightUniforms, params);
        faceMat.uniforms.uCameraPos.value.set(0, 0, params.cameraZ);

        faceMesh = new THREE.Mesh(geom, faceMat);
        faceMesh.frustumCulled = false;
        faceMesh.renderOrder = 1;
        scene.add(faceMesh);
        faceCount = faceAccum.pos.length / 9;
    }

    // 7. Build batched edge mesh
    let edgeLines: THREE.LineSegments | null = null;
    let edgeMat: THREE.ShaderMaterial | null = null;
    if (edgeAccum.pos.length > 0) {
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edgeAccum.pos), 3));
        geom.setAttribute('vAlpha', new THREE.BufferAttribute(new Float32Array(edgeAccum.alpha), 1));
        geom.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(edgeAccum.color), 3));
        geom.setAttribute('aOpacity', new THREE.BufferAttribute(new Float32Array(edgeAccum.opacity), 1));
        geom.setAttribute('aFoldDelay', new THREE.BufferAttribute(new Float32Array(edgeAccum.foldDelay), 1));
        geom.setAttribute('aFoldOrigin', new THREE.BufferAttribute(new Float32Array(edgeAccum.foldOrigin), 3));

        edgeMat = createDemoEdgeMaterial();
        edgeLines = new THREE.LineSegments(geom, edgeMat);
        edgeLines.frustumCulled = false;
        edgeLines.renderOrder = 1;
        scene.add(edgeLines);
    }

    // 8. Build tendril curves (detail stream for color)
    const tendrilPos: number[] = [];
    const tendrilCol: number[] = [];
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
            tendrilPos.push(a.x, a.y, a.z, b.x, b.y, b.z);
            const j = i * 3, k = (i + 1) * 3;
            tendrilCol.push(ptColors[j], ptColors[j + 1], ptColors[j + 2],
                ptColors[k], ptColors[k + 1], ptColors[k + 2]);
        }
    }
    let tendrilLines: THREE.LineSegments | null = null;
    let tendrilMat: THREE.LineBasicMaterial | null = null;
    if (tendrilPos.length > 0) {
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(tendrilPos, 3));
        geom.setAttribute('color', new THREE.Float32BufferAttribute(tendrilCol, 3));
        tendrilMat = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 1.0,
            blending: THREE.CustomBlending,
            blendSrc: THREE.OneFactor,
            blendDst: THREE.OneFactor,
            depthWrite: false,
        });
        tendrilLines = new THREE.LineSegments(geom, tendrilMat);
        tendrilLines.renderOrder = 1;
        scene.add(tendrilLines);
    }

    return {
        nodeCount: allDotPositions.length,
        faceCount,
        refs: {
            glowPoints,
            glowMat,
            sphereInst,
            sphereMat,
            faceMesh,
            faceMat,
            edgeLines,
            edgeMat,
            tendrilLines,
            tendrilMat,
            glowPointData,
            lightUniforms,
        },
    };
}

function gaussianRandom(rng: () => number, mean = 0, stdev = 1): number {
    const u = 1 - rng();
    const v = rng();
    return mean + stdev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
