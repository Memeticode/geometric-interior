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
    ChromaticAberrationEffect,
    VignetteEffect,
    BlendFunction,
} from 'postprocessing';
import { xmur3, mulberry32 } from '../core/prng.js';
import { deriveParams } from '../core/params.js';
import { generateTitle, generateAltText } from '../core/text.js';
import { buildDemoScene } from './demo/build-scene.js';

export function createRenderer(canvas, opts = {}) {
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false, // EffectComposer MSAA replaces this
        alpha: false,
        preserveDrawingBuffer: true,
    });
    const dpr = opts.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1);
    renderer.setPixelRatio(Math.min(dpr, 2));
    // Tone mapping on the renderer level (matches demo pipeline):
    // per-fragment compression happens during render, so bloom sees
    // already-compressed values and doesn't amplify HDR blowout.
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.sortObjects = true;

    const scene = new THREE.Scene();
    scene.background = null; // background handled by gradient quad (matches demo)

    const camera = new THREE.PerspectiveCamera(60, getAspect(), 0.1, 100);

    // --- Postprocessing ---
    // Single render pass (matching demo), default UnsignedByteType framebuffer.
    const composer = new EffectComposer(renderer, {
        multisampling: Math.min(4, renderer.capabilities.maxSamples || 4),
    });

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Effects
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
        camera.fov = params.cameraFov;
        camera.aspect = getAspect();
        camera.updateProjectionMatrix();
        camera.position.set(
            params.cameraOffsetX,
            params.cameraOffsetY,
            params.cameraZ,
        );
        camera.lookAt(0, 0, 0);

        // --- Clear previous scene contents ---
        clearScene(scene);

        // --- Background gradient quad (same scene, like demo) ---
        // Uses clip-space position so it renders at far plane, behind everything.
        const bgGeometry = new THREE.PlaneGeometry(2, 2);
        const bgMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uInnerColor: { value: new THREE.Color(...params.bgInnerColor) },
                uOuterColor: { value: new THREE.Color(...params.bgOuterColor) },
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position.xy, 0.9999, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uInnerColor;
                uniform vec3 uOuterColor;
                varying vec2 vUv;
                void main() {
                    float d = length(vUv - 0.5) * 2.0;
                    gl_FragColor = vec4(mix(uInnerColor, uOuterColor, d * d), 1.0);
                }
            `,
            depthWrite: false,
            depthTest: false,
        });
        const bgQuad = new THREE.Mesh(bgGeometry, bgMaterial);
        bgQuad.frustumCulled = false;
        bgQuad.renderOrder = -1;
        scene.add(bgQuad);

        // --- Build scene geometry ---
        const buildRng = mulberry32(xmur3(seed + ':build')());
        const result = buildDemoScene(params, buildRng, scene);

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
        composer.dispose();
        renderer.dispose();
    }

    function resize(width, height) {
        renderer.setSize(width, height, false);
        composer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

    function setDPR(newDpr) {
        renderer.setPixelRatio(Math.min(newDpr, 2));
    }

    return { renderWith, dispose, resize, syncSize, setDPR, getCanvas: () => canvas };
}
