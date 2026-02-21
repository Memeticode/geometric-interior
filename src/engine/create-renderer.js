/**
 * Three.js renderer facade with postprocessing.
 * createRenderer(canvas) → { renderWith, dispose, resize, syncSize, getCanvas }
 *
 * renderWith(seed, controls) clears the scene, derives params from controls,
 * builds geometry, renders through the EffectComposer, and returns metadata.
 */

import * as THREE from 'three';
import {
    EffectComposer,
    RenderPass,
    EffectPass,
    BloomEffect,
    ToneMappingEffect,
    ToneMappingMode,
    ChromaticAberrationEffect,
    VignetteEffect,
    BlendFunction,
} from 'postprocessing';
import { xmur3, mulberry32 } from '../core/prng.js';
import { deriveParams } from '../core/params.js';
import { generateTitle, generateAltText } from '../core/text.js';
import { buildScene } from './scene-builder.js';
import { createBackgroundMaterial } from './materials.js';

export function createRenderer(canvas) {
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false, // EffectComposer MSAA replaces this
        alpha: false,
        preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.autoClear = false;
    renderer.sortObjects = true;

    const scene = new THREE.Scene();
    const bgScene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(55, getAspect(), 0.1, 100);
    const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

    // --- Postprocessing ---
    const composer = new EffectComposer(renderer, {
        multisampling: Math.min(4, renderer.capabilities.maxSamples || 4),
        frameBufferType: THREE.HalfFloatType,
    });

    // Pass 1: background (opaque, clears buffer)
    const bgRenderPass = new RenderPass(bgScene, bgCamera);

    // Pass 2: shard scene (additive over background, no clear)
    const shardRenderPass = new RenderPass(scene, camera);
    shardRenderPass.clear = false;

    // Effects
    const bloomEffect = new BloomEffect({
        blendFunction: BlendFunction.SCREEN,
        luminanceThreshold: 0.15,
        luminanceSmoothing: 0.15,
        mipmapBlur: true,
        intensity: 1.5,
        radius: 0.85,
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

    // Tonemapping: Reinhard2 controls blowout while preserving color.
    // Bloom on bright dot sprites creates the luminous center glow.
    const toneMappingEffect = new ToneMappingEffect({
        mode: ToneMappingMode.REINHARD2,
    });

    const effectPass = new EffectPass(
        camera,
        bloomEffect,
        toneMappingEffect,
        chromaticAberrationEffect,
        vignetteEffect,
    );

    composer.addPass(bgRenderPass);
    composer.addPass(shardRenderPass);
    composer.addPass(effectPass);

    /**
     * Dispose all children of a scene (geometries + materials).
     */
    function clearScene(targetScene) {
        while (targetScene.children.length > 0) {
            const child = targetScene.children[0];
            targetScene.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }
    }

    function getAspect() {
        const w = canvas.width || 300;
        const h = canvas.height || 150;
        return w / h;
    }

    const _sizeVec = new THREE.Vector2();

    syncSize();

    /**
     * Sync the renderer + composer size to the canvas's CSS display dimensions.
     */
    function syncSize() {
        if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
            const displayW = canvas.clientWidth;
            const displayH = canvas.clientHeight;
            renderer.getSize(_sizeVec);
            if (_sizeVec.x !== displayW || _sizeVec.y !== displayH) {
                renderer.setSize(displayW, displayH, false);
                composer.setSize(displayW, displayH);
            }
        }
    }

    /**
     * Render a scene from seed + controls.
     */
    function renderWith(seed, controls) {
        syncSize();

        const hashFn = xmur3(seed);
        const rng = mulberry32(hashFn());
        const params = deriveParams(controls, rng);

        // --- Setup camera ---
        camera.fov = params.fov;
        camera.aspect = getAspect();
        camera.updateProjectionMatrix();
        camera.position.set(
            params.cameraOffsetX,
            params.cameraOffsetY,
            params.cameraDistance,
        );
        camera.lookAt(0, 0, 0);

        // --- Clear previous scene contents ---
        clearScene(scene);
        clearScene(bgScene);

        // --- Background ---
        const bgGeometry = new THREE.PlaneGeometry(2, 2);
        const bgMaterial = createBackgroundMaterial({
            bgColor: params.bgColor,
            fogColor: params.fogColor,
            lightness: params.backgroundLightness,
            centerX: 0.5 + params.cameraOffsetX * 0.02,
            centerY: 0.5 + params.cameraOffsetY * 0.02,
        });
        bgScene.add(new THREE.Mesh(bgGeometry, bgMaterial));

        // --- Build scene geometry ---
        const buildRng = mulberry32(xmur3(seed + ':build')());
        const result = buildScene(params, buildRng, scene, seed);

        // --- Update postprocessing from params ---
        bloomEffect.intensity = params.bloomStrength;
        bloomEffect.luminanceMaterial.threshold = params.bloomThreshold;

        const ca = params.chromaticAberration;
        chromaticAberrationEffect.offset.set(ca, ca);

        vignetteEffect.darkness = params.vignetteStrength;

        // --- Render through composer ---
        composer.render();

        // --- Generate metadata ---
        const titleRng = mulberry32(xmur3(seed + ':title')());
        const title = generateTitle(controls, titleRng);
        const altText = generateAltText(controls, result.nodeCount, title);

        return { title, altText, nodeCount: result.nodeCount };
    }

    function dispose() {
        clearScene(scene);
        clearScene(bgScene);
        composer.dispose();
        renderer.dispose();
    }

    function resize(width, height) {
        renderer.setSize(width, height, false);
        composer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

    return { renderWith, dispose, resize, syncSize, getCanvas: () => canvas };
}
