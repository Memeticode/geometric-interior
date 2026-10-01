/**
 * Custom ShaderMaterial factories.
 */

import * as THREE from 'three';
import demoFaceVertSrc from './shaders/demo-face.vert.glsl?raw';
import demoFaceFragSrc from './shaders/demo-face.frag.glsl?raw';
import demoGlowVertSrc from './shaders/demo-glow.vert.glsl?raw';
import demoGlowFragSrc from './shaders/demo-glow.frag.glsl?raw';
import type { LightUniforms, DerivedParams } from './models.js';

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
            uAttenuationCoeff: { value: config.attenuationCoeff },
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
 * Edge material for demo chain edges (instanced screen-space quads).
 */
export function createDemoEdgeMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        vertexShader: `
            // Per-vertex (base quad corners)
            attribute vec2 aLineCorner; // (along, side): along=0..1, side=-0.5..+0.5

            // Per-instance
            attribute vec3 aStartPos;
            attribute vec3 aEndPos;
            attribute float aStartAlpha;
            attribute float aEndAlpha;
            attribute vec3 aColor;
            attribute float aOpacity;

            varying float fAlpha;
            varying vec3 vEdgeColor;
            varying float vEdgeOpacity;

            // 1px at SD (540px height) in NDC
            #define LINE_WIDTH_NDC (2.0 / 540.0)

            void main() {
                float along = aLineCorner.x;
                float side = aLineCorner.y;

                // Interpolate per-vertex attributes along the line
                fAlpha = mix(aStartAlpha, aEndAlpha, along);
                vEdgeColor = aColor;
                vEdgeOpacity = aOpacity;

                // Project both endpoints to clip space
                vec3 worldA = (modelMatrix * vec4(aStartPos, 1.0)).xyz;
                vec3 worldB = (modelMatrix * vec4(aEndPos, 1.0)).xyz;
                vec4 clipA = projectionMatrix * viewMatrix * vec4(worldA, 1.0);
                vec4 clipB = projectionMatrix * viewMatrix * vec4(worldB, 1.0);

                // Select clip position for this vertex
                vec4 clip = mix(clipA, clipB, along);

                // Screen-space perpendicular for line width
                vec2 ndcA = clipA.xy / clipA.w;
                vec2 ndcB = clipB.xy / clipB.w;

                float aspect = projectionMatrix[1][1] / projectionMatrix[0][0];
                vec2 dir = ndcB - ndcA;
                dir.x *= aspect;
                float len = length(dir);
                if (len > 0.0001) {
                    dir /= len;
                } else {
                    dir = vec2(1.0, 0.0);
                }
                vec2 perp = vec2(-dir.y, dir.x);
                perp.x /= aspect;

                // Offset in clip space for resolution-independent line width
                clip.xy += perp * side * LINE_WIDTH_NDC * clip.w;

                gl_Position = clip;
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
 * Tendril material for guide curve lines (instanced screen-space quads).
 */
export function createDemoTendrilMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        vertexShader: `
            // Per-vertex (base quad corners)
            attribute vec2 aLineCorner; // (along, side)

            // Per-instance
            attribute vec3 aStartPos;
            attribute vec3 aEndPos;
            attribute vec3 aStartColor;
            attribute vec3 aEndColor;

            varying vec3 vColor;

            // 1px at SD (540px height) in NDC
            #define LINE_WIDTH_NDC (2.0 / 540.0)

            void main() {
                float along = aLineCorner.x;
                float side = aLineCorner.y;

                // Interpolate color along the line
                vColor = mix(aStartColor, aEndColor, along);

                // Project both endpoints to clip space
                vec4 clipA = projectionMatrix * modelViewMatrix * vec4(aStartPos, 1.0);
                vec4 clipB = projectionMatrix * modelViewMatrix * vec4(aEndPos, 1.0);

                // Select clip position for this vertex
                vec4 clip = mix(clipA, clipB, along);

                // Screen-space perpendicular for line width
                vec2 ndcA = clipA.xy / clipA.w;
                vec2 ndcB = clipB.xy / clipB.w;

                float aspect = projectionMatrix[1][1] / projectionMatrix[0][0];
                vec2 dir = ndcB - ndcA;
                dir.x *= aspect;
                float len = length(dir);
                if (len > 0.0001) {
                    dir /= len;
                } else {
                    dir = vec2(1.0, 0.0);
                }
                vec2 perp = vec2(-dir.y, dir.x);
                perp.x /= aspect;

                // Offset in clip space for resolution-independent line width
                clip.xy += perp * side * LINE_WIDTH_NDC * clip.w;

                gl_Position = clip;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            void main() {
                gl_FragColor = vec4(vColor, 1.0);
            }
        `,
        transparent: true,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        depthWrite: false,
    });
}

/**
 * Glow material for dot halos (instanced billboard quads).
 */
export function createDemoGlowMaterial(glowTexture: THREE.Texture): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        uniforms: {
            uGlowMap: { value: glowTexture },
        },
        vertexShader: demoGlowVertSrc,
        fragmentShader: demoGlowFragSrc,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
}
