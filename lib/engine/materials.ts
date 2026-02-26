/**
 * Custom ShaderMaterial factories.
 */

import * as THREE from 'three';
import demoFaceVertSrc from './shaders/demo-face.vert.glsl?raw';
import demoFaceFragSrc from './shaders/demo-face.frag.glsl?raw';
import demoGlowVertSrc from './shaders/demo-glow.vert.glsl?raw';
import demoGlowFragSrc from './shaders/demo-glow.frag.glsl?raw';
import type { LightUniforms, DerivedParams } from '../types.js';

/**
 * Batched face material for demo folding-chain planes.
 */
export function createDemoFaceMaterial(lightUniforms: LightUniforms, config: DerivedParams): THREE.ShaderMaterial {
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
            uMorphFade: { value: 1.0 },
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
export function createDemoEdgeMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        uniforms: {
            uMorphFade: { value: 1.0 },
        },
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
            uniform float uMorphFade;
            varying float fAlpha;
            varying vec3 vEdgeColor;
            varying float vEdgeOpacity;
            void main() {
                gl_FragColor = vec4(vEdgeColor * uMorphFade, vEdgeOpacity * fAlpha * uMorphFade);
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
export function createDemoGlowMaterial(glowTexture: THREE.Texture): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        uniforms: {
            uGlowMap: { value: glowTexture },
            uMorphFade: { value: 1.0 },
            uMorphT: { value: 0.0 },
        },
        vertexShader: demoGlowVertSrc,
        fragmentShader: demoGlowFragSrc,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
}
