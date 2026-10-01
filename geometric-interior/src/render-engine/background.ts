/**
 * Background — full-screen radial gradient from a center color to black,
 * aspect-corrected so the falloff stays circular at any canvas size.
 *
 * Usage:
 *   const bg = new Background();
 *   scene.add(bg.mesh);              // once per scene rebuild
 *   bg.setCenterColor(fogColor);     // on render
 *   bg.update(camera);               // after every camera update
 */

import * as THREE from 'three';
import bgVertSrc from './shaders/background.vert.glsl?raw';
import bgFragSrc from './shaders/background.frag.glsl?raw';

export class Background {
    readonly mesh: THREE.Mesh;
    private readonly mat: THREE.ShaderMaterial;

    constructor() {
        this.mat = new THREE.ShaderMaterial({
            uniforms: {
                uCenterColor: { value: new THREE.Vector3() },
                uHalfFovTanX: { value: 0.5 },
                uHalfFovTanY: { value: 0.5 },
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
    }

    /** Sync the aspect ratio from the camera — call after every camera update. */
    update(camera: THREE.Camera): void {
        const cam = camera as THREE.PerspectiveCamera;
        if (cam.isPerspectiveCamera) {
            const tanY = Math.tan((cam.fov * Math.PI / 180) / 2);
            this.mat.uniforms.uHalfFovTanY.value = tanY;
            this.mat.uniforms.uHalfFovTanX.value = tanY * cam.aspect;
        }
    }

    setCenterColor(rgb: [number, number, number]): void {
        (this.mat.uniforms.uCenterColor.value as THREE.Vector3).set(...rgb);
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        this.mat.dispose();
    }
}
