/**
 * Scene builder — 3D starscape of brilliant white light dots.
 * 10–60 dots, most small, all very bright against pure darkness.
 */

import * as THREE from 'three';

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
    const glowScale = dotSize * (4 + lightIntensity * 2);
    const glowMat = new THREE.SpriteMaterial({
        map: glowTexture,
        color: white,
        transparent: true,
        opacity: Math.min(1.0, 0.3 + lightIntensity * 0.15),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(glowScale, glowScale, 1);
    glow.position.copy(pos);
    glow.renderOrder = 0;
    scene.add(glow);

    // Point light — for illuminating future geometry
    if (lightIntensity > 0.1) {
        const light = new THREE.PointLight(0xffffff, lightIntensity, dotSize * 30, 1.5);
        light.position.copy(pos);
        scene.add(light);
    }
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

    return { nodeCount: largeDotCount + smallDotCount };
}
