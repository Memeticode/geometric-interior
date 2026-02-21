/**
 * Scene builder — 3D starscape of brilliant white light dots.
 * 10–60 dots, most small, all very bright against pure darkness.
 */

import * as THREE from 'three';
import { pickShapeType, extractFaces } from './polyhedra.js';
import { createFaceGeometry } from './plane-geometry.js';
import { createShardMaterial } from './materials.js';

/**
 * HSL to RGB in 0–1 range (h in degrees, s and l in 0–1).
 */
function hslToRgb01(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r, g, b;
    if (h < 60)       { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else              { r = c; g = 0; b = x; }
    return [r + m, g + m, b + m];
}

/**
 * Solid white circle for the dot core.
 */
function createSpriteTexture() {
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = 64;
    spriteCanvas.height = 64;
    const ctx = spriteCanvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();
    return new THREE.CanvasTexture(spriteCanvas);
}

/**
 * Soft radial gradient for the glow halo.
 */
function createGlowTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0.6)');
    grad.addColorStop(0.15, 'rgba(255,255,255,0.35)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.10)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.02)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
}

/**
 * Add a dot (solid core + glow halo + optional point light) at a position.
 */
function addDot(scene, pos, dotSize, spriteTexture, glowTexture, white, lightIntensity) {
    // Solid core
    const coreMat = new THREE.SpriteMaterial({
        map: spriteTexture,
        color: white,
        transparent: true,
        opacity: 1.0,
        blending: THREE.NormalBlending,
        depthWrite: false,
    });
    const core = new THREE.Sprite(coreMat);
    core.scale.set(dotSize, dotSize, 1);
    core.position.copy(pos);
    core.renderOrder = 1;
    scene.add(core);

    // Glow halo — additive, larger than the core, intensity scales with size
    const glowScale = Math.max(dotSize * 3, dotSize * (4 + lightIntensity * 2));
    const glowMat = new THREE.SpriteMaterial({
        map: glowTexture,
        color: white,
        transparent: true,
        opacity: Math.min(1.0, Math.max(0.1, 0.3 + lightIntensity * 0.15)),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(glowScale, glowScale, 1);
    glow.position.copy(pos);
    glow.renderOrder = 0;
    scene.add(glow);

    // Point light — every dot emanates light, small dots get a faint one
    const li = Math.max(0.05, lightIntensity);
    const light = new THREE.PointLight(0xffffff, li, dotSize * 30 + 1.0, 1.5);
    light.position.copy(pos);
    scene.add(light);
}

/**
 * Build the scene: 10–60 brilliant white dots in 3D darkness.
 */
export function buildScene(params, rng, scene) {
    const spriteTexture = createSpriteTexture();
    const glowTexture = createGlowTexture();
    const white = new THREE.Color(1, 1, 1);

    const scatterRange = params.depthRange * 0.7;
    const fracture = params.fracture || 0;
    const luminosity = params.luminosity || 0.5;

    // --- Large anchor dots: 3–7, density=0 gives exactly 3 ---
    const largeDotCount = Math.round(3 + params.density * 4);
    const largeMin = 0.09 - fracture * 0.025;
    const largeRange = 0.15 - fracture * 0.05;

    const largeDotPositions = [];
    const largeDotIntensities = [];
    const largeDotSizes = [];

    for (let i = 0; i < largeDotCount; i++) {
        const sizeFactor = 0.4 + rng() * 0.6;
        const dotSize = largeMin + sizeFactor * largeRange;
        const spread = 0.4 + rng() * 0.4;
        const pos = new THREE.Vector3(
            (rng() * 2 - 1) * scatterRange * 1.5 * spread,
            (rng() * 2 - 1) * scatterRange * 1.1 * spread,
            (rng() * 2 - 1) * scatterRange * spread,
        );
        // Large dots get strong light, scaled by size and luminosity
        const lightIntensity = (1.0 + sizeFactor * 2.0) * luminosity;
        addDot(scene, pos, dotSize, spriteTexture, glowTexture, white, lightIntensity);

        largeDotPositions.push(pos.clone());
        largeDotIntensities.push(lightIntensity);
        largeDotSizes.push(dotSize);
    }

    // --- Small scattered dots: always ≥5× large count ---
    const smallDotCount = Math.round(15 + params.density * 45);
    const smallExponent = 1.5 + fracture * 2.0;
    const smallBase = 0.03 - fracture * 0.01;
    const smallRange = 0.12 - fracture * 0.04;
    const fractureSpread = 1 + fracture * 0.3;

    for (let i = 0; i < smallDotCount; i++) {
        const sizeFactor = Math.pow(rng(), smallExponent);
        const dotSize = smallBase + sizeFactor * smallRange;
        const pos = new THREE.Vector3(
            (rng() * 2 - 1) * scatterRange * 1.5 * fractureSpread,
            (rng() * 2 - 1) * scatterRange * 1.1 * fractureSpread,
            (rng() * 2 - 1) * scatterRange * fractureSpread,
        );
        // Small dots get faint light
        const lightIntensity = sizeFactor * 0.5 * luminosity;
        addDot(scene, pos, dotSize, spriteTexture, glowTexture, white, lightIntensity);
    }

    // --- Crystal planes: translucent faces illuminated by dot lights ---
    const unfoldAmount = params.unfoldAmount || 0;
    const lightFractalLevel = Math.max(0, Math.min(1, fracture * luminosity));

    let crystalFaceCount = 0;

    // Helper: create a crystal cluster at a position and add its faces to the scene
    function addCrystalCluster(clusterPos, scale, faces_max) {
        const shapeType = pickShapeType(rng, fracture);
        const orientation = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2),
        );
        const faces = extractFaces(shapeType, clusterPos, orientation, scale, rng, faces_max, unfoldAmount);

        const hue = params.baseHue + (rng() * 2 - 1) * (params.hueRange * 0.5);
        const baseColor = hslToRgb01(hue, params.saturation, params.lightness);

        // Planes are passive — lit by dots, not self-luminous.
        // Thin crisp edges, low emissive, light shines through.
        const material = createShardMaterial({
            baseColor,
            edgeColor: params.edgeColor,
            fogColor: params.fogColor,
            opacity: params.opacity,
            emissiveStrength: params.emissiveStrength * 0.3,
            fresnelPower: params.fresnelPower,
            edgeGlowStrength: params.edgeGlowStrength * 0.25,
            fogDensity: params.fogDensity,
            cameraDistance: params.cameraDistance,
            nodePositions: largeDotPositions,
            nodeIntensities: largeDotIntensities,
            nodeCount: Math.min(8, largeDotPositions.length),
            nodeBrightness: params.nodeBrightness * 0.25,
            nodeRadius: Math.min(params.nodeRadius, 2.5),
            causticStrength: params.causticStrength,
            iridescenceStrength: params.iridescenceStrength,
            lightFractalLevel,
            edgeThickness: 8.0,
            edgeBrightness: params.edgeBrightness * 0.35,
        });

        for (const face of faces) {
            const { geometry, position, quaternion } = createFaceGeometry(face);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
            mesh.quaternion.copy(quaternion);
            mesh.renderOrder = 2;
            scene.add(mesh);
        }
        crystalFaceCount += faces.length;
    }

    // --- Primary clusters: one per anchor dot, 3–5 faces each ---
    for (let i = 0; i < largeDotCount; i++) {
        const dotPos = largeDotPositions[i];
        const offDist = 0.5 + rng() * 0.8;
        const offTheta = rng() * Math.PI * 2;
        const offPhi = Math.acos(rng() * 2 - 1);
        const crystalPos = dotPos.clone().add(new THREE.Vector3(
            offDist * Math.sin(offPhi) * Math.cos(offTheta),
            offDist * Math.sin(offPhi) * Math.sin(offTheta),
            offDist * Math.cos(offPhi),
        ));
        const scale = 0.8 + rng() * 1.5;
        const maxFaces = 3 + Math.round(fracture * 2);
        addCrystalCluster(crystalPos, scale, maxFaces);
    }

    // --- Secondary planes: scattered throughout the volume ---
    const secondaryCount = Math.round(3 + params.density * 10);
    for (let i = 0; i < secondaryCount; i++) {
        const pos = new THREE.Vector3(
            (rng() * 2 - 1) * scatterRange * 1.4,
            (rng() * 2 - 1) * scatterRange * 1.0,
            (rng() * 2 - 1) * scatterRange * 0.8,
        );
        const scale = 0.5 + rng() * 1.2;
        const maxFaces = 2 + Math.round(fracture * 2);
        addCrystalCluster(pos, scale, maxFaces);
    }

    return { nodeCount: largeDotCount + smallDotCount, crystalFaceCount };
}
