/**
 * Custom ShaderMaterial factories.
 */

import * as THREE from 'three';
import shardVertSrc from './shaders/shard.vert.glsl?raw';
import shardFragSrc from './shaders/shard.frag.glsl?raw';
import bgVertSrc from './shaders/background.vert.glsl?raw';
import bgFragSrc from './shaders/background.frag.glsl?raw';
import demoFaceVertSrc from './shaders/demo-face.vert.glsl?raw';
import demoFaceFragSrc from './shaders/demo-face.frag.glsl?raw';
import demoGlowVertSrc from './shaders/demo-glow.vert.glsl?raw';
import demoGlowFragSrc from './shaders/demo-glow.frag.glsl?raw';

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

// --- Demo material factories ---

/**
 * Batched face material for demo folding-chain planes.
 * Uses per-vertex color, opacity, noise params, and shared light uniforms.
 */
export function createDemoFaceMaterial(lightUniforms, config) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uLightPositions: lightUniforms.uLightPositions,
            uLightIntensities: lightUniforms.uLightIntensities,
            uLightCount: lightUniforms.uLightCount,
            uCameraPos: { value: new THREE.Vector3(0, 0, 5) },
            uFrontLightFactor: { value: config.frontLightFactor },
            uBackLightFactor: { value: config.backLightFactor },
            uIlluminationCap: { value: config.illuminationCap },
            uAmbientLight: { value: config.ambientLight },
            uEdgeFadeThreshold: { value: config.edgeFadeThreshold },
        },
        vertexShader: demoFaceVertSrc,
        fragmentShader: demoFaceFragSrc,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
}

/**
 * Batched edge material for demo chain edge lines.
 */
export function createDemoEdgeMaterial() {
    return new THREE.ShaderMaterial({
        vertexShader: `
            attribute float vAlpha;
            attribute vec3 aColor;
            attribute float aOpacity;
            varying float fAlpha;
            varying vec3 vEdgeColor;
            varying float vEdgeOpacity;
            void main() {
                fAlpha = vAlpha;
                vEdgeColor = aColor;
                vEdgeOpacity = aOpacity;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying float fAlpha;
            varying vec3 vEdgeColor;
            varying float vEdgeOpacity;
            void main() {
                gl_FragColor = vec4(vEdgeColor, vEdgeOpacity * fAlpha);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
}

/**
 * Glow point material for dot halos (uses Points with gl_PointSize).
 */
export function createDemoGlowMaterial(glowTexture) {
    return new THREE.ShaderMaterial({
        uniforms: { uGlowMap: { value: glowTexture } },
        vertexShader: demoGlowVertSrc,
        fragmentShader: demoGlowFragSrc,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
}
