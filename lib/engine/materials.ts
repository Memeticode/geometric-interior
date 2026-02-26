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
            uTime: { value: 0.0 },
            uFoldProgress: { value: 1.0 },
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
            uTime: { value: 0.0 },
            uFoldProgress: { value: 1.0 },
        },
        vertexShader: `
            attribute float vAlpha;
            attribute vec3 aColor;
            attribute float aOpacity;
            attribute float aFoldDelay;
            attribute vec3 aFoldOrigin;
            uniform float uFoldProgress;
            varying float fAlpha;
            varying vec3 vEdgeColor;
            varying float vEdgeOpacity;
            varying float vFoldAlpha;
            void main() {
                float delayStart = aFoldDelay * 0.7;
                float available = 1.0 - delayStart;
                float localT = clamp((uFoldProgress - delayStart) / max(available, 0.001), 0.0, 1.0);
                localT = localT * localT * (3.0 - 2.0 * localT);
                vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
                vec3 foldedPos = mix(aFoldOrigin, worldPos, localT);
                vFoldAlpha = localT;
                fAlpha = vAlpha;
                vEdgeColor = aColor;
                vEdgeOpacity = aOpacity;
                gl_Position = projectionMatrix * viewMatrix * vec4(foldedPos, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uMorphFade;
            varying float fAlpha;
            varying vec3 vEdgeColor;
            varying float vEdgeOpacity;
            varying float vFoldAlpha;
            void main() {
                gl_FragColor = vec4(vEdgeColor * uMorphFade, vEdgeOpacity * fAlpha * uMorphFade * vFoldAlpha);
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
            uTime: { value: 0.0 },
            uFoldProgress: { value: 1.0 },
        },
        vertexShader: demoGlowVertSrc,
        fragmentShader: demoGlowFragSrc,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
}
