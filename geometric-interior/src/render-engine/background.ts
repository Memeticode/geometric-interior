/**
 * Background — standalone, camera-aware background renderer.
 *
 * The gradient and texture are evaluated in world space so they respond
 * correctly to camera movement: a vertical sky/ground gradient stays
 * world-vertical as the camera orbits, and the texture tiles along the
 * sphere rather than being pinned to the screen.
 *
 * Usage:
 *   const bg = new Background(config);
 *   scene.add(bg.mesh);                    // once
 *   bg.setConfig(config);                  // on renderWith
 *   bg.update(camera);                     // after every camera update
 *   bg.lerpConfig(configA, configB, t);    // during morphUpdate
 */

import * as THREE from 'three';
import { lerp } from '../utils/math.js';
import bgVertSrc from './shaders/background.vert.glsl?raw';
import bgFragSrc from './shaders/background.frag.glsl?raw';

// ============================================================
// BgConfig — public type exported for use in models / params
// ============================================================

export interface BgGradientStop {
    /** Position along the gradient axis, 0–1 (ascending). */
    t: number;
    /** Linear RGB color at this stop. No range restriction — can be dark or bright. */
    rgb: [number, number, number];
}

export interface BgConfig {
    gradient: {
        /** Gradient axis in space.
         *  - `radial`   : vignette-like, distance from screen centre
         *  - `vertical` : world-space Y — sky=1 (top), ground=0 (bottom)
         *  - `diagonal` : screen-space upper-left → lower-right sweep
         */
        type: 'radial' | 'vertical' | 'diagonal';
        /** 2–8 colour stops, positions in ascending t order. */
        stops: BgGradientStop[];
    };
    texture: {
        /** Procedural texture overlaid on the gradient.
         *  - `none`       : plain gradient, no texture
         *  - `noise`      : fractal value noise — organic, cloudy
         *  - `voronoi`    : Voronoi cells — geometric tessellation
         *  - `flow-lines` : thin directional contour lines
         */
        type: 'none' | 'noise' | 'voronoi' | 'flow-lines';
        /** Texture fineness, 0–1 (0 = very fine, 1 = coarse/large cells). */
        scale: number;
        /** Blend amount, 0–1 (0 = invisible, 1 = full). */
        strength: number;
    };
    flow: {
        /** How the texture is distorted / oriented.
         *  - `none`        : no distortion
         *  - `directional` : all lines/cells sheared along `angle`
         *  - `orbital`     : cells/lines warp around the sphere centre
         */
        type: 'none' | 'directional' | 'orbital';
        /** Direction in radians (used by `directional` and `flow-lines`). */
        angle: number;
        /** Warp intensity, 0–1. */
        strength: number;
    };
}

// ============================================================
// Defaults
// ============================================================

/** Default config matches the old near-black radial gradient exactly. */
export function defaultBgConfig(): BgConfig {
    return {
        gradient: {
            type: 'radial',
            stops: [
                { t: 0.0, rgb: [0.003, 0.001, 0.006] },
                { t: 1.0, rgb: [0.0,   0.0,   0.0  ] },
            ],
        },
        texture: { type: 'none', scale: 0.5, strength: 0.0 },
        flow:    { type: 'none', angle: 0.0, strength: 0.0 },
    };
}

// ============================================================
// Gradient type enum (must match shader)
// ============================================================

const GRADIENT_TYPE: Record<BgConfig['gradient']['type'], number> = {
    radial:   0,
    vertical: 1,
    diagonal: 2,
};

const TEX_TYPE: Record<BgConfig['texture']['type'], number> = {
    none:         0,
    noise:        1,
    voronoi:      2,
    'flow-lines': 3,
};

const FLOW_TYPE: Record<BgConfig['flow']['type'], number> = {
    none:        0,
    directional: 1,
    orbital:     2,
};

const MAX_STOPS = 8;

// ============================================================
// Background class
// ============================================================

export class Background {
    readonly mesh: THREE.Mesh;
    private readonly mat: THREE.ShaderMaterial;

    // Reused each frame — avoids GC pressure
    private readonly _rotMat = new THREE.Matrix3();

    constructor(config: BgConfig) {
        // Pad stop arrays to MAX_STOPS
        const stopT     = new Array<number>(MAX_STOPS).fill(0);
        const stopColor = Array.from({ length: MAX_STOPS }, () => new THREE.Vector3());

        this.mat = new THREE.ShaderMaterial({
            uniforms: {
                // Camera
                uViewRotation: { value: new THREE.Matrix3() },
                uHalfFovTanX:  { value: 0.5 },
                uHalfFovTanY:  { value: 0.5 },

                // Gradient
                uGradientType: { value: GRADIENT_TYPE[config.gradient.type] },
                uStopCount:    { value: 2 },
                uStopT:        { value: stopT },
                uStopColor:    { value: stopColor },

                // Texture
                uTexType:      { value: TEX_TYPE[config.texture.type] },
                uTexScale:     { value: config.texture.scale },
                uTexStrength:  { value: config.texture.strength },

                // Flow
                uFlowType:     { value: FLOW_TYPE[config.flow.type] },
                uFlowAngle:    { value: config.flow.angle },
                uFlowStrength: { value: config.flow.strength },
            },
            vertexShader:   bgVertSrc,
            fragmentShader: bgFragSrc,
            depthWrite: false,
            depthTest:  false,
        });

        const geom = new THREE.PlaneGeometry(2, 2);
        this.mesh = new THREE.Mesh(geom, this.mat);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder   = -1;

        this.setConfig(config);
    }

    // -------------------------------------------------------
    // Camera sync — call after every camera matrix update
    // -------------------------------------------------------

    update(camera: THREE.Camera): void {
        // Ensure matrixWorld reflects the latest position/rotation before sampling it.
        camera.updateMatrixWorld();
        // Extract world rotation (upper-left 3×3 of camera.matrixWorld)
        this._rotMat.setFromMatrix4(camera.matrixWorld);
        this.mat.uniforms.uViewRotation.value.copy(this._rotMat);

        // FOV projection factors
        const cam = camera as THREE.PerspectiveCamera;
        if (cam.isPerspectiveCamera) {
            const tanY = Math.tan((cam.fov * Math.PI / 180) / 2);
            this.mat.uniforms.uHalfFovTanY.value = tanY;
            this.mat.uniforms.uHalfFovTanX.value = tanY * cam.aspect;
        }
    }

    // -------------------------------------------------------
    // Config application
    // -------------------------------------------------------

    setConfig(config: BgConfig): void {
        const u = this.mat.uniforms;

        u.uGradientType.value = GRADIENT_TYPE[config.gradient.type];

        const stops = config.gradient.stops;
        const count = Math.min(stops.length, MAX_STOPS);
        u.uStopCount.value = count;

        const stopT     = u.uStopT.value    as number[];
        const stopColor = u.uStopColor.value as THREE.Vector3[];
        for (let i = 0; i < MAX_STOPS; i++) {
            if (i < count) {
                stopT[i] = stops[i].t;
                stopColor[i].set(...stops[i].rgb);
            } else {
                // Pad with last stop
                stopT[i] = 1.0;
                stopColor[i].copy(stopColor[Math.max(0, count - 1)]);
            }
        }

        u.uTexType.value     = TEX_TYPE[config.texture.type];
        u.uTexScale.value    = config.texture.scale;
        u.uTexStrength.value = config.texture.strength;

        u.uFlowType.value     = FLOW_TYPE[config.flow.type];
        u.uFlowAngle.value    = config.flow.angle;
        u.uFlowStrength.value = config.flow.strength;
    }

    /**
     * Linearly interpolate between two configs for morph transitions.
     *
     * Assumes both configs have the same gradient type, stop count, and
     * stop positions — only the stop colors, texture, and flow values are
     * lerped. If structures differ, config `a` is applied without lerping.
     */
    lerpConfig(a: BgConfig, b: BgConfig, t: number): void {
        const u = this.mat.uniforms;
        const stopsA = a.gradient.stops;
        const stopsB = b.gradient.stops;

        if (
            a.gradient.type !== b.gradient.type ||
            stopsA.length !== stopsB.length
        ) {
            this.setConfig(a);
            return;
        }

        u.uGradientType.value = GRADIENT_TYPE[a.gradient.type];

        const count = Math.min(stopsA.length, MAX_STOPS);
        u.uStopCount.value = count;

        const stopT     = u.uStopT.value    as number[];
        const stopColor = u.uStopColor.value as THREE.Vector3[];
        for (let i = 0; i < MAX_STOPS; i++) {
            if (i < count) {
                stopT[i] = lerp(stopsA[i].t, stopsB[i].t, t);
                stopColor[i].set(
                    lerp(stopsA[i].rgb[0], stopsB[i].rgb[0], t),
                    lerp(stopsA[i].rgb[1], stopsB[i].rgb[1], t),
                    lerp(stopsA[i].rgb[2], stopsB[i].rgb[2], t),
                );
            } else {
                stopT[i] = 1.0;
                stopColor[i].copy(stopColor[Math.max(0, count - 1)]);
            }
        }

        // Lerp texture
        u.uTexType.value     = TEX_TYPE[t < 0.5 ? a.texture.type : b.texture.type];
        u.uTexScale.value    = lerp(a.texture.scale,    b.texture.scale,    t);
        u.uTexStrength.value = lerp(a.texture.strength, b.texture.strength, t);

        // Lerp flow
        u.uFlowType.value     = FLOW_TYPE[t < 0.5 ? a.flow.type : b.flow.type];
        u.uFlowAngle.value    = lerp(a.flow.angle,    b.flow.angle,    t);
        u.uFlowStrength.value = lerp(a.flow.strength, b.flow.strength, t);
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        this.mat.dispose();
    }
}
