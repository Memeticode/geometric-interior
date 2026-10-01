/**
 * Three.js renderer facade with postprocessing.
 */

import * as THREE from 'three';
import {
    EffectComposer,
    RenderPass,
    EffectPass,
    BloomEffect,
    ChromaticAberrationEffect,
    VignetteEffect,
    BlendFunction,
} from 'postprocessing';
import { xmur3, mulberry32 } from '../utils/prng.js';
import { deriveParams } from '../core/params.js';
import { createTagStreams } from '../core/text-generation/seed-tags.js';
import { generateTitle } from '../core/text-generation/title-text.js';
import { generateAltText } from '../core/text-generation/alt-text.js';
import { buildScene } from './scene/build-scene.js';
import { createGlowTexture } from './scene/dots.js';
import type { CameraConfig, ImageConfig, RenderMeta } from '../core/schemas.js';
import type { Renderer, RendererOptions } from './interfaces.js';
import { Background } from './background.js';

export function createRenderer(canvas: HTMLCanvasElement | OffscreenCanvas, opts: RendererOptions = {}): Renderer {
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas as HTMLCanvasElement,
        antialias: false,
        alpha: false,
        preserveDrawingBuffer: true,
    });
    const dpr = opts.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1);
    renderer.setPixelRatio(Math.min(dpr, 2));
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.sortObjects = true;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(60, getAspect(), 0.1, 100);

    const composer = new EffectComposer(renderer, {
        multisampling: Math.min(2, renderer.capabilities.maxSamples || 2),
    });

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomEffect = new BloomEffect({
        blendFunction: BlendFunction.SCREEN,
        luminanceThreshold: 0.70,
        luminanceSmoothing: 0.20,
        mipmapBlur: true,
        intensity: 0.25,
        radius: 0.50,
    });

    const chromaticAberrationEffect = new ChromaticAberrationEffect({
        offset: new THREE.Vector2(0.002, 0.002),
        radialModulation: true,
        modulationOffset: 0.15,
    });

    const vignetteEffect = new VignetteEffect({
        offset: 0.5,
        darkness: 0.5,
    });

    const effectPass = new EffectPass(
        camera,
        bloomEffect,
        chromaticAberrationEffect,
        vignetteEffect,
    );
    composer.addPass(effectPass);

    // --- Cached reusable objects ---

    const bg = new Background();

    const cachedGlowTexture = createGlowTexture();

    /** Release an object's GPU resources (geometry, material, instance buffers). */
    function disposeObject(obj: THREE.Object3D): void {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
        if ((obj as THREE.Mesh).material) ((obj as THREE.Mesh).material as THREE.Material).dispose();
        // geometry.dispose() does not free instanceMatrix/instanceColor buffers
        if ((obj as THREE.InstancedMesh).isInstancedMesh) (obj as THREE.InstancedMesh).dispose();
    }

    function clearScene(targetScene: THREE.Scene): void {
        while (targetScene.children.length > 0) {
            const child = targetScene.children[0];
            targetScene.remove(child);
            if (child !== bg.mesh) disposeObject(child);
        }
    }

    function getAspect(): number {
        const w = canvas.width || 300;
        const h = canvas.height || 150;
        return w / h;
    }

    const _sizeVec = new THREE.Vector2();

    // Target resolution override (0 = use clientWidth/clientHeight)
    let targetW = 0, targetH = 0;

    syncSize();

    function syncSize(): void {
        if (targetW > 0 && targetH > 0) {
            renderer.getSize(_sizeVec);
            if (_sizeVec.x !== targetW || _sizeVec.y !== targetH) {
                resize(targetW, targetH);
            }
            return;
        }
        if ((canvas as HTMLCanvasElement).clientWidth > 0 && (canvas as HTMLCanvasElement).clientHeight > 0) {
            const displayW = (canvas as HTMLCanvasElement).clientWidth;
            const displayH = (canvas as HTMLCanvasElement).clientHeight;
            renderer.getSize(_sizeVec);
            if (_sizeVec.x !== displayW || _sizeVec.y !== displayH) {
                renderer.setSize(displayW, displayH, false);
                composer.setSize(displayW, displayH);
            }
        }
    }

    function setTargetResolution(w: number, h: number): void {
        targetW = w;
        targetH = h;
        resize(w, h);
    }

    function clearTargetResolution(): void {
        targetW = 0;
        targetH = 0;
    }

    /** Camera position before the zoom/orbit override is applied. */
    const baseCameraPos = new THREE.Vector3();

    let hasScene = false;

    /** Build the scene for `config` and render it. */
    function render(config: ImageConfig, locale: string = 'en'): RenderMeta {
        syncSize();

        const { seed, controls } = config;
        const streams = createTagStreams(seed);
        const params = deriveParams(controls);

        camera.fov = params.cameraFov;
        camera.aspect = getAspect();
        camera.updateProjectionMatrix();
        camera.position.set(
            params.cameraOffsetX,
            params.cameraOffsetY,
            params.cameraZ,
        );
        camera.lookAt(0, 0, 0);
        baseCameraPos.set(params.cameraOffsetX, params.cameraOffsetY, params.cameraZ);

        clearScene(scene);

        bg.setCenterColor(params.fogColor);
        scene.add(bg.mesh);

        const result = buildScene(params, streams, scene, cachedGlowTexture);

        bloomEffect.intensity = params.bloomStrength;
        bloomEffect.luminanceMaterial.threshold = params.bloomThreshold;
        chromaticAberrationEffect.offset.set(params.chromaticAberration, params.chromaticAberration);
        vignetteEffect.darkness = params.vignetteStrength;

        hasScene = true;
        applyCamera(config.camera);
        renderFrame();

        const titleRng = mulberry32(xmur3('title-' + seed[0] + '-' + seed[1] + '-' + seed[2])());
        const title = generateTitle(controls, titleRng, locale);
        const altText = generateAltText(controls, result.nodeCount, title, locale, seed);

        return { title, altText, nodeCount: result.nodeCount };
    }

    function dispose(): void {
        clearScene(scene);
        bg.dispose();
        cachedGlowTexture.dispose();
        composer.dispose();
        renderer.dispose();
    }

    function resize(width: number, height: number): void {
        renderer.setSize(width, height, false);
        composer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

    function setDPR(newDpr: number): void {
        renderer.setPixelRatio(Math.min(newDpr, 2));
    }

    // --- Camera (zoom / orbit around the origin) ---
    let cameraOverrideZoom = 1.0;
    let cameraOverrideOrbitY = 0;  // degrees
    let cameraOverrideOrbitX = 0;  // degrees

    /**
     * Apply camera zoom/orbit override to the base camera position.
     * Modifies camera.position in place.
     */
    function applyCameraOverride(): void {
        camera.position.copy(baseCameraPos);
        if (cameraOverrideZoom === 1 && cameraOverrideOrbitY === 0 && cameraOverrideOrbitX === 0) return;

        const pos = camera.position;

        // Zoom: scale camera distance from origin
        if (cameraOverrideZoom !== 1) {
            pos.multiplyScalar(cameraOverrideZoom);
        }

        // Y-axis orbit: rotate position around Y axis
        if (cameraOverrideOrbitY !== 0) {
            const yRad = cameraOverrideOrbitY * Math.PI / 180;
            const cosY = Math.cos(yRad);
            const sinY = Math.sin(yRad);
            const x = pos.x;
            const z = pos.z;
            pos.x = x * cosY + z * sinY;
            pos.z = -x * sinY + z * cosY;
        }

        // X-axis tilt: rotate position around X axis
        if (cameraOverrideOrbitX !== 0) {
            const xRad = cameraOverrideOrbitX * Math.PI / 180;
            const cosX = Math.cos(xRad);
            const sinX = Math.sin(xRad);
            const y = pos.y;
            const z = pos.z;
            pos.y = y * cosX - z * sinX;
            pos.z = y * sinX + z * cosX;
        }

        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
    }

    function applyCamera(cam: CameraConfig): void {
        // zoom 0..1 → distance multiplier; written so the default 0.375 maps to exactly 1
        cameraOverrideZoom = Math.pow(3, 1.6 * (0.375 - cam.zoom));
        cameraOverrideOrbitY = cam.rotation;
        cameraOverrideOrbitX = cam.elevation;
    }

    /** Change only the camera and re-render the current scene without rebuilding it. */
    function setCamera(cam: CameraConfig): void {
        applyCamera(cam);
        if (hasScene) renderFrame();
    }

    function renderFrame(): void {
        applyCameraOverride();
        bg.update(camera);
        composer.render();
    }

    return {
        render, setCamera,
        dispose, resize, syncSize, setDPR,
        setTargetResolution, clearTargetResolution,
        getCanvas: () => canvas,
    };
}
