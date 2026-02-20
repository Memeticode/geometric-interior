/**
 * Scene builder — generates crystalline structures from invisible 3D polyhedra.
 *
 * Each polyhedron shows only 2-3 faces, creating open crystalline fractures
 * that let light diffuse through. Many polyhedra are placed via topology,
 * compensating for the sparse face count per shape.
 *
 * Light sources: a few large strategic star sprites at energy nodes,
 * plus many small scattered starfield dots throughout the scene.
 */

import * as THREE from 'three';
import { logNormal, gaussian } from '../core/distributions.js';
import { xmur3, mulberry32 } from '../core/prng.js';
import { createFaceGeometry } from './plane-geometry.js';
import { createShardMaterial } from './materials.js';
import { createTopology } from './topology/index.js';
import { pickShapeType, extractFaces } from './polyhedra.js';

/**
 * HSL to RGB conversion.
 */
function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r, g, b;
    if (h < 60)       { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else               { r = c; g = 0; b = x; }

    return [r + m, g + m, b + m];
}

/**
 * Generate energy nodes (attractor points / strategic light sources).
 */
function generateEnergyNodes(params, rng) {
    const nodes = [];
    const range = params.depthRange * 0.35;

    for (let i = 0; i < params.nodeCount; i++) {
        nodes.push({
            position: new THREE.Vector3(
                (rng() * 2 - 1) * range * 1.2,
                (rng() * 2 - 1) * range * 0.9,
                (rng() * 2 - 1) * range * 0.6,
            ),
            intensity: 0.5 + rng() * 0.5,
        });
    }
    return nodes;
}

/**
 * Build orientation quaternion from a topology frame + Gaussian jitter.
 */
function orientFromFrame(frame, jitterScale, rng) {
    const m = new THREE.Matrix4().makeBasis(frame.tangent, frame.binormal, frame.normal);
    const baseQuat = new THREE.Quaternion().setFromRotationMatrix(m);

    const jitterQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        gaussian(rng, 0, 0.8 * jitterScale),
        gaussian(rng, 0, 0.8 * jitterScale),
        gaussian(rng, 0, 0.4 * jitterScale),
    ));

    return baseQuat.multiply(jitterQuat);
}

/**
 * Create a shared soft-glow sprite texture (32x32 canvas).
 */
function createSpriteTexture() {
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = 32;
    spriteCanvas.height = 32;
    const ctx = spriteCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.15, 'rgba(255,255,255,0.8)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.2)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(spriteCanvas);
}

/**
 * Build the entire scene from params.
 */
export function buildScene(params, rng, scene, seed) {
    const nodes = generateEnergyNodes(params, rng);

    // Collect node data for passing to shard materials (light sources)
    const nodeData = {
        positions: nodes.map(n => n.position),
        intensities: nodes.map(n => n.intensity),
        count: nodes.length,
    };

    // Create topology with its own isolated RNG stream
    const topoRng = seed
        ? mulberry32(xmur3(seed + ':topology')())
        : rng;
    const topology = createTopology(params.topologyMode, { rng: topoRng, params });

    const jitterScale = 1 - params.topologyCoherence * 0.7;

    // Max faces per polyhedron: only 2-3 sides visible per shape.
    // This creates open crystalline fractures that let light through.
    const maxFacesPerShape = rng() < 0.5 ? 2 : 3;

    // Helper: position a polyhedron using topology + very gentle node attraction
    function samplePosition() {
        let pos = topology.samplePoint(rng);

        // Very gentle attraction toward a random energy node
        if (nodes.length > 0) {
            const node = nodes[Math.floor(rng() * nodes.length)];
            const attraction = 0.05 + 0.12 * params.topologyCoherence;
            pos.lerp(node.position, attraction * (0.2 + rng() * 0.6));
        }

        return pos;
    }

    /**
     * Generate polyhedra and extract 2-3 faces each as crystal planes.
     */
    function makePolyhedra(sizeScale, sizeMin, sizeMax, hueRangeScale, count) {
        for (let i = 0; i < count; i++) {
            const rawSize = logNormal(rng, params.planeSizeMu + sizeScale, params.planeSizeSigma);
            const scale = Math.max(sizeMin, Math.min(sizeMax, rawSize));

            const pos = samplePosition();
            const frame = topology.sampleFrame(pos);
            const orientation = orientFromFrame(frame, jitterScale, rng);
            const influence = topology.influence(pos);

            const shapeType = pickShapeType(rng, params.edgeFractalLevel);

            // Per-shape face count: 2 or 3
            const maxFaces = rng() < 0.4 ? 2 : 3;
            const faces = extractFaces(shapeType, pos, orientation, scale, rng, maxFaces);

            for (const face of faces) {
                const { geometry, position: meshPos, quaternion: meshQuat } = createFaceGeometry(face);

                const hue = (params.baseHue + (rng() * 2 - 1) * params.hueRange * hueRangeScale + 360) % 360;
                const sat = params.saturation * (0.8 + rng() * 0.4);
                const lit = params.lightness * (0.7 + rng() * 0.6);
                const baseColor = hslToRgb(hue, sat, lit);

                const infBoost = 1 + (influence || 0) * 0.2;
                const sizeOpacityScale = Math.min(1.0, 1.5 / (1 + face.area * 0.3));

                const material = createShardMaterial({
                    baseColor,
                    edgeColor: params.edgeColor,
                    fogColor: params.fogColor,
                    opacity: params.opacity * (0.7 + rng() * 0.6) * infBoost * sizeOpacityScale,
                    emissiveStrength: params.emissiveStrength * (0.5 + rng() * 1.0) * infBoost,
                    fresnelPower: params.fresnelPower,
                    edgeGlowStrength: params.edgeGlowStrength * (0.6 + rng() * 0.8),
                    fogDensity: params.fogDensity,
                    cameraDistance: params.cameraDistance,
                    causticStrength: params.causticStrength,
                    iridescenceStrength: params.iridescenceStrength,
                    lightFractalLevel: params.lightFractalLevel,
                    nodePositions: nodeData.positions,
                    nodeIntensities: nodeData.intensities,
                    nodeCount: nodeData.count,
                    nodeBrightness: params.nodeBrightness,
                    nodeRadius: params.nodeRadius,
                });

                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.copy(meshPos);
                mesh.quaternion.copy(meshQuat);
                scene.add(mesh);
            }
        }
    }

    // With only 2-3 faces per polyhedron, we need more polyhedra to fill the scene.
    // Divide plane counts by ~2.5 (average visible faces per shape).
    const primaryCount = Math.max(3, Math.round(params.planeCountPrimary / 2.5));
    const secondaryCount = Math.max(5, Math.round(params.planeCountSecondary / 2.5));
    const microCount = Math.max(3, Math.round(params.planeCountMicro / 2.5));

    // --- Primary polyhedra: few, very large ---
    makePolyhedra(1.2, 1.5, 6.0, 0.3, primaryCount);

    // --- Secondary polyhedra: medium, create crystal structure ---
    makePolyhedra(0.5, 0.5, 3.5, 0.5, secondaryCount);

    // --- Micro polyhedra: small, add detail ---
    makePolyhedra(-0.3, 0.08, 0.8, 0.7, microCount);

    // --- Star highlights: strategic large stars + scattered starfield ---
    const spriteTexture = createSpriteTexture();

    // 1. Strategic large stars at energy node positions (3-10 nodes)
    for (const node of nodes) {
        const starColor = hslToRgb(params.baseHue, params.saturation * 0.3, 0.96);
        const starMat = new THREE.SpriteMaterial({
            map: spriteTexture,
            color: new THREE.Color(...starColor),
            transparent: true,
            opacity: 0.20 + params.nodeBrightness * 0.06 * node.intensity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const star = new THREE.Sprite(starMat);
        const starSize = (0.4 + params.nodeBrightness * 0.15) * node.intensity;
        star.scale.set(starSize, starSize, 1);
        star.position.copy(node.position);
        scene.add(star);
    }

    // 2. Scattered starfield: many small, dim dots spread across the scene
    const starfieldCount = Math.round(60 + params.density * 120); // 60-180 stars
    const scatterRange = params.depthRange * 0.6;
    for (let i = 0; i < starfieldCount; i++) {
        const starHue = (params.baseHue + (rng() * 2 - 1) * params.hueRange * 0.5 + 360) % 360;
        const starColor = hslToRgb(starHue, params.saturation * 0.4, 0.9 + rng() * 0.1);
        const dimness = rng(); // 0 = brightest small star, 1 = dimmest
        const starMat = new THREE.SpriteMaterial({
            map: spriteTexture,
            color: new THREE.Color(...starColor),
            transparent: true,
            opacity: 0.03 + (1 - dimness) * 0.14, // range: 0.03–0.17
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const star = new THREE.Sprite(starMat);
        const starSize = 0.03 + (1 - dimness) * 0.18; // range: 0.03–0.21
        star.scale.set(starSize, starSize, 1);
        star.position.set(
            (rng() * 2 - 1) * scatterRange * 1.8,
            (rng() * 2 - 1) * scatterRange * 1.2,
            (rng() * 2 - 1) * scatterRange,
        );
        scene.add(star);
    }

    // 3. Tendrils: very thin light rays from each strategic star
    for (const node of nodes) {
        const tendrilCount = 3 + Math.floor(rng() * 4);
        for (let t = 0; t < tendrilCount; t++) {
            const phi = rng() * Math.PI * 2;
            const cosTheta = rng() * 2 - 1;
            const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
            const dir = new THREE.Vector3(
                sinTheta * Math.cos(phi),
                sinTheta * Math.sin(phi),
                cosTheta,
            );

            const tendrilLength = (0.3 + rng() * 0.8) * node.intensity;
            const tendrilWidth = 0.01 + rng() * 0.02;

            const tendrilGeo = new THREE.PlaneGeometry(tendrilWidth, tendrilLength);
            const fadeArr = new Float32Array(tendrilGeo.attributes.position.count).fill(1.0);
            tendrilGeo.setAttribute('aFade', new THREE.Float32BufferAttribute(fadeArr, 1));

            const tendrilHue = (params.baseHue + (rng() * 2 - 1) * params.hueRange * 0.2 + 360) % 360;
            const tendrilColor = hslToRgb(tendrilHue, params.saturation * 0.4, 0.92);
            const tendrilMat = createShardMaterial({
                baseColor: tendrilColor,
                edgeColor: params.edgeColor,
                fogColor: params.fogColor,
                opacity: 0.04 + params.nodeBrightness * 0.015 * node.intensity,
                emissiveStrength: params.emissiveStrength * 1.5,
                fresnelPower: params.fresnelPower,
                edgeGlowStrength: params.edgeGlowStrength,
                fogDensity: params.fogDensity,
                cameraDistance: params.cameraDistance,
                causticStrength: 0,
                iridescenceStrength: 0,
                lightFractalLevel: 0,
                nodePositions: nodeData.positions,
                nodeIntensities: nodeData.intensities,
                nodeCount: nodeData.count,
                nodeBrightness: params.nodeBrightness,
                nodeRadius: params.nodeRadius,
            });

            tendrilMat.blending = THREE.AdditiveBlending;

            const tendrilMesh = new THREE.Mesh(tendrilGeo, tendrilMat);
            tendrilMesh.position.copy(node.position).addScaledVector(dir, tendrilLength * 0.5);
            tendrilMesh.lookAt(node.position.clone().add(dir));
            scene.add(tendrilMesh);
        }
    }

    return { nodeCount: nodes.length };
}
