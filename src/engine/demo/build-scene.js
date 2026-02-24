/**
 * Demo scene builder — orchestrates envelope, guide curves, dots,
 * folding chains, tendrils, and batched geometry into a single scene.
 */

import * as THREE from 'three';
import { envelopeSDF } from './envelope.js';
import { generateAllGuideCurves, sampleAlongCurve, drapingDirection } from './guide-curves.js';
import { createAccumulators, createFoldingChain } from './folding-chains.js';
import { generateDots, createGlowTexture } from './dots.js';
import { flowFieldNormal, colorFieldHue } from './flow-field.js';
import {
    createDemoFaceMaterial,
    createDemoEdgeMaterial,
    createDemoGlowMaterial,
} from '../materials.js';

/**
 * Build the demo scene: envelope-confined crystalline interior.
 * @param {object} params - derived parameters from deriveParams()
 * @param {Function} rng - seeded random [0, 1)
 * @param {THREE.Scene} scene - target scene to populate
 * @returns {{ nodeCount: number, faceCount: number }}
 */
export function buildDemoScene(params, rng, scene) {
    const envelopeRadii = new THREE.Vector3(...params.envelopeRadii);

    // --- 1. Generate guide curves ---
    const guideCurves = generateAllGuideCurves(params.curveConfig, rng, envelopeRadii);

    // --- 2. Generate dots ---
    const dotResult = generateDots(params.dotConfig, guideCurves, envelopeRadii, rng);
    const { sphereInstData, glowPointData, allDotPositions, lightUniforms } = dotResult;

    // --- 3. Build light sphere InstancedMesh ---
    let sphereInst = null;
    let sphereMat = null;
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
        sphereInst.instanceColor.needsUpdate = true;
        sphereInst.renderOrder = 0;
        scene.add(sphereInst);
    }

    // --- 4. Build glow points ---
    const glowTexture = createGlowTexture();
    let glowPoints = null;
    let glowMat = null;
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

    // --- 5. Create folding chains along guide curves ---
    const accum = createAccumulators();

    // Color picker function parameterized by palette
    function pickColor(distFromCenter, decayRate, lightnessBoost, familyHue) {
        const fade = Math.exp(-decayRate * distFromCenter * distFromCenter);
        let baseHue;
        if (familyHue !== null && familyHue !== undefined) {
            baseHue = familyHue + (rng() - 0.5) * 35;
        } else {
            const centerHue = params.baseHue + 25 + rng() * 40;
            const edgeHue = params.baseHue - 50 + rng() * 40;
            baseHue = edgeHue + fade * (centerHue - edgeHue);
        }
        const saturation = Math.min(params.saturation * 0.75 + rng() * 0.25 + (1 - fade) * 0.05, 1.0);
        const lightness = Math.min(0.06 + rng() * 0.08 + fade * (0.22 + rng() * 0.22) + lightnessBoost, 0.60);
        return new THREE.Color().setHSL(baseHue / 360, saturation, lightness);
    }

    const chainConfig = {
        edgeColorOffset: params.edgeColorOffset,
        edgeOpacityBase: params.edgeOpacityBase,
        edgeOpacityFadeScale: params.edgeOpacityFadeScale,
        crackExtendScale: params.crackExtendScale,
    };

    // Build chain config per tier
    const tierChainConfig = {};
    for (const [tier, c] of Object.entries(params.chains)) {
        tierChainConfig[tier] = {
            chainLen: () => c.chainLenBase + Math.floor(rng() * c.chainLenRange),
            scale: () => c.scaleBase + rng() * c.scaleRange,
            spread: c.spread,
            dualProb: c.dualProb,
            spacing: c.spacing,
        };
    }

    // Drape chains along guide curves
    for (const curve of guideCurves) {
        const config = tierChainConfig[curve.tier];
        if (!config) continue;
        const samples = sampleAlongCurve(curve, config.spacing, envelopeRadii);

        for (const sample of samples) {
            const dir1 = drapingDirection(sample, config.spread, rng);
            const familyHue = colorFieldHue(sample.pos, 1.2, params.baseHue, params.hueRange)
                + (rng() - 0.5) * 30;
            const chainLen = config.chainLen();
            const planeScale = config.scale();

            createFoldingChain(accum, sample.pos, chainLen, planeScale,
                sample.pos.length(), allDotPositions, chainConfig, rng, pickColor,
                familyHue, dir1);

            // Dual-side: drape on opposite side of curve
            if (rng() < config.dualProb) {
                const flippedBinormal = sample.binormal.clone().negate();
                const flippedSample = { ...sample, binormal: flippedBinormal };
                const dir2 = drapingDirection(flippedSample, config.spread, rng);
                createFoldingChain(accum, sample.pos, chainLen, planeScale,
                    sample.pos.length(), allDotPositions, chainConfig, rng, pickColor,
                    familyHue + (rng() - 0.5) * 15, dir2);
            }
        }
    }

    // Atmospheric scatter: random interior chains for depth
    for (let i = 0; i < params.atmosphericCount; i++) {
        let pos;
        let attempts = 0;
        do {
            pos = new THREE.Vector3(
                gaussianRandom(rng, 0, 0.6),
                gaussianRandom(rng, 0, 0.4),
                gaussianRandom(rng, 0, 0.5)
            );
            attempts++;
        } while (envelopeSDF(pos, envelopeRadii) > -0.1 && attempts < 50);
        const flowNorm = flowFieldNormal(pos, 1.5);
        const familyHue = colorFieldHue(pos, 1.2, params.baseHue, params.hueRange)
            + (rng() - 0.5) * 40;
        const planeScale = 0.5 + rng() * 0.3;
        const chainLen = 3 + Math.floor(rng() * 2);
        createFoldingChain(accum, pos, chainLen, planeScale, pos.length(),
            allDotPositions, chainConfig, rng, pickColor, familyHue, flowNorm);
    }

    // --- 6. Build batched face mesh ---
    const { faceAccum, edgeAccum } = accum;
    let faceCount = 0;
    let faceMesh = null;
    let faceMat = null;

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

        faceMat = createDemoFaceMaterial(lightUniforms, params);
        faceMat.uniforms.uCameraPos.value.set(0, 0, params.cameraZ);

        faceMesh = new THREE.Mesh(geom, faceMat);
        faceMesh.frustumCulled = false;
        faceMesh.renderOrder = 1;
        scene.add(faceMesh);
        faceCount = faceAccum.pos.length / 9;
    }

    // --- 7. Build batched edge mesh ---
    let edgeLines = null;
    let edgeMat = null;
    if (edgeAccum.pos.length > 0) {
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edgeAccum.pos), 3));
        geom.setAttribute('vAlpha', new THREE.BufferAttribute(new Float32Array(edgeAccum.alpha), 1));
        geom.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(edgeAccum.color), 3));
        geom.setAttribute('aOpacity', new THREE.BufferAttribute(new Float32Array(edgeAccum.opacity), 1));

        edgeMat = createDemoEdgeMaterial();
        edgeLines = new THREE.LineSegments(geom, edgeMat);
        edgeLines.frustumCulled = false;
        edgeLines.renderOrder = 1;
        scene.add(edgeLines);
    }

    // --- 8. Build tendril curves ---
    const tendrilPos = [];
    const tendrilCol = [];
    for (const curve of guideCurves) {
        if (curve.length < 4) continue;
        const spline = new THREE.CatmullRomCurve3(curve);
        const pts = spline.getPoints(Math.max(16, curve.length * 2));

        const hue = (params.tendrilHueBase + rng() * params.tendrilHueRange) / 360;
        const sat = params.tendrilSatBase + rng() * params.tendrilSatRange;
        const opacity = curve.tier === 'primary'
            ? params.tendrilOpacity.primary
            : params.tendrilOpacity.other;

        const ptColors = [];
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
    let tendrilLines = null;
    let tendrilMat = null;
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

// --- Helper ---
function gaussianRandom(rng, mean = 0, stdev = 1) {
    const u = 1 - rng();
    const v = rng();
    return mean + stdev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
