/**
 * Custom ShaderMaterial for crystalline translucent planes.
 */

import * as THREE from 'three';
import shardVertSrc from './shaders/shard.vert.glsl?raw';
import shardFragSrc from './shaders/shard.frag.glsl?raw';
import bgVertSrc from './shaders/background.vert.glsl?raw';
import bgFragSrc from './shaders/background.frag.glsl?raw';

/**
 * Create a shard material for a translucent crystalline plane.
 * @param {object} opts - { baseColor, edgeColor, fogColor, opacity, emissiveStrength, fresnelPower, edgeGlowStrength, fogDensity, cameraDistance, nodePositions, nodeIntensities, nodeCount, nodeBrightness, nodeRadius }
 */
export function createShardMaterial(opts) {
    // Pad node arrays to 8 elements (shader expects fixed-size arrays)
    const nodePositions = [];
    const nodeIntensities = [];
    const count = opts.nodeCount || 0;
    for (let i = 0; i < 8; i++) {
        if (i < count && opts.nodePositions) {
            nodePositions.push(opts.nodePositions[i].clone());
            nodeIntensities.push(opts.nodeIntensities?.[i] ?? 0.5);
        } else {
            nodePositions.push(new THREE.Vector3(0, 0, 0));
            nodeIntensities.push(0);
        }
    }

    return new THREE.ShaderMaterial({
        vertexShader: shardVertSrc,
        fragmentShader: shardFragSrc,
        uniforms: {
            uBaseColor: { value: new THREE.Color(...opts.baseColor) },
            uEdgeColor: { value: new THREE.Color(...opts.edgeColor) },
            uFogColor: { value: new THREE.Color(...opts.fogColor) },
            uOpacity: { value: opts.opacity },
            uEmissiveStrength: { value: opts.emissiveStrength },
            uFresnelPower: { value: opts.fresnelPower },
            uEdgeGlowStrength: { value: opts.edgeGlowStrength },
            uFogDensity: { value: opts.fogDensity },
            uCameraDistance: { value: opts.cameraDistance },
            uCausticStrength: { value: opts.causticStrength ?? 0 },
            uIridescenceStrength: { value: opts.iridescenceStrength ?? 0 },
            uLightFractalLevel: { value: opts.lightFractalLevel ?? 0 },
            uEdgeThickness: { value: opts.edgeThickness ?? 30.0 },
            uEdgeBrightness: { value: opts.edgeBrightness ?? 1.5 },
            uNodePositions: { value: nodePositions },
            uNodeIntensities: { value: nodeIntensities },
            uNodeCount: { value: count },
            uNodeBrightness: { value: opts.nodeBrightness ?? 1.0 },
            uNodeRadius: { value: opts.nodeRadius ?? 3.0 },
        },
        extensions: { derivatives: true },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
    });
}

/**
 * Create background material — dark gradient fullscreen quad.
 */
export function createBackgroundMaterial(opts) {
    return new THREE.ShaderMaterial({
        vertexShader: bgVertSrc,
        fragmentShader: bgFragSrc,
        uniforms: {
            uBgColor: { value: new THREE.Color(...opts.bgColor) },
            uFogColor: { value: new THREE.Color(...opts.fogColor) },
            uLightness: { value: opts.lightness },
            uCenter: { value: new THREE.Vector2(opts.centerX, opts.centerY) },
        },
        depthWrite: false,
        depthTest: false,
    });
}
