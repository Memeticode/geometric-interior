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
import { matchDots, buildMorphGlowGeometry } from './demo/dot-matching.js';
import { createDemoGlowMaterial } from './materials.js';
import { createGlowTexture } from './demo/dots.js';

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

    // --- Morph transition support ---

    let morphState = null;

    function lerpVal(a, b, t) {
        return a + (b - a) * t;
    }

    /**
     * Set the uMorphFade uniform (or opacity) on all materials in a refs set.
     */
    function setMorphFade(refs, value) {
        if (refs.faceMat) refs.faceMat.uniforms.uMorphFade.value = value;
        if (refs.edgeMat) refs.edgeMat.uniforms.uMorphFade.value = value;
        if (refs.glowMat) refs.glowMat.uniforms.uMorphFade.value = value;
        if (refs.tendrilMat) refs.tendrilMat.opacity = value;
        if (refs.sphereMat) {
            refs.sphereMat.transparent = true;
            refs.sphereMat.opacity = value;
        }
    }

    /**
     * Remove and dispose all meshes in a refs set from the scene.
     */
    function disposeRefs(refs) {
        const objects = [refs.faceMesh, refs.edgeLines, refs.tendrilLines, refs.glowPoints, refs.sphereInst];
        for (const obj of objects) {
            if (obj) {
                scene.remove(obj);
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) obj.material.dispose();
            }
        }
    }

    /**
     * Build both scenes and set up morph geometry for a smooth transition.
     * Call this once at morph start, then call morphUpdate(t) per frame.
     */
    function morphPrepare(seedA, controlsA, seedB, controlsB) {
        syncSize();
        clearScene(scene);

        // Derive params for both states
        const rngA = mulberry32(xmur3(seedA)());
        const paramsA = deriveParams(controlsA, rngA);
        const rngB = mulberry32(xmur3(seedB)());
        const paramsB = deriveParams(controlsB, rngB);

        // Background quad (lerp colors during morph)
        const bgGeometry = new THREE.PlaneGeometry(2, 2);
        const bgMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uInnerColor: { value: new THREE.Color(...paramsA.bgInnerColor) },
                uOuterColor: { value: new THREE.Color(...paramsA.bgOuterColor) },
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

        // Build scene A
        const buildRngA = mulberry32(xmur3(seedA + ':build')());
        const resultA = buildDemoScene(paramsA, buildRngA, scene);

        // Build scene B (into same scene — both coexist during morph)
        const buildRngB = mulberry32(xmur3(seedB + ':build')());
        const resultB = buildDemoScene(paramsB, buildRngB, scene);

        // Initial fade: A fully visible, B hidden
        setMorphFade(resultA.refs, 1.0);
        setMorphFade(resultB.refs, 0.0);

        // Dot correspondence matching + morph glow geometry
        const glowDataA = resultA.refs.glowPointData || [];
        const glowDataB = resultB.refs.glowPointData || [];
        let morphGlow = null;
        let morphGlowMat = null;

        if (glowDataA.length > 0 || glowDataB.length > 0) {
            const matching = matchDots(glowDataA, glowDataB);
            const morphGlowGeom = buildMorphGlowGeometry(glowDataA, glowDataB, matching);
            const glowTex = createGlowTexture();
            morphGlowMat = createDemoGlowMaterial(glowTex);
            morphGlow = new THREE.Points(morphGlowGeom, morphGlowMat);
            morphGlow.frustumCulled = false;
            morphGlow.renderOrder = 0;
            scene.add(morphGlow);
        }

        // Hide both scenes' original glow points (morph glow replaces them)
        if (resultA.refs.glowPoints) resultA.refs.glowPoints.visible = false;
        if (resultB.refs.glowPoints) resultB.refs.glowPoints.visible = false;

        // Camera from A
        camera.fov = paramsA.cameraFov;
        camera.aspect = getAspect();
        camera.updateProjectionMatrix();
        camera.position.set(paramsA.cameraOffsetX, paramsA.cameraOffsetY, paramsA.cameraZ);
        camera.lookAt(0, 0, 0);

        // Postprocessing from A
        bloomEffect.intensity = paramsA.bloomStrength;
        bloomEffect.luminanceMaterial.threshold = paramsA.bloomThreshold;
        chromaticAberrationEffect.offset.set(paramsA.chromaticAberration, paramsA.chromaticAberration);
        vignetteEffect.darkness = paramsA.vignetteStrength;

        morphState = {
            refsA: resultA.refs,
            refsB: resultB.refs,
            paramsA,
            paramsB,
            morphGlow,
            morphGlowMat,
            bgMaterial,
        };

        // Render initial frame (state A)
        composer.render();
    }

    /**
     * Update morph at interpolation time t (cosine-eased, [0, 1]).
     * Only updates uniforms + attributes — no scene rebuilds.
     */
    function morphUpdate(t) {
        if (!morphState) return;

        const { refsA, refsB, paramsA, paramsB, morphGlowMat, bgMaterial: bgMat } = morphState;

        // Cross-fade all materials
        setMorphFade(refsA, 1.0 - t);
        setMorphFade(refsB, t);

        // Morph glow: interpolate dot positions on GPU
        if (morphGlowMat) {
            morphGlowMat.uniforms.uMorphT.value = t;
        }

        // Lerp camera
        camera.fov = lerpVal(paramsA.cameraFov, paramsB.cameraFov, t);
        camera.position.set(
            lerpVal(paramsA.cameraOffsetX, paramsB.cameraOffsetX, t),
            lerpVal(paramsA.cameraOffsetY, paramsB.cameraOffsetY, t),
            lerpVal(paramsA.cameraZ, paramsB.cameraZ, t),
        );
        camera.aspect = getAspect();
        camera.updateProjectionMatrix();
        camera.lookAt(0, 0, 0);

        // Lerp background colors
        const iA = paramsA.bgInnerColor, iB = paramsB.bgInnerColor;
        const oA = paramsA.bgOuterColor, oB = paramsB.bgOuterColor;
        bgMat.uniforms.uInnerColor.value.setRGB(
            lerpVal(iA[0], iB[0], t), lerpVal(iA[1], iB[1], t), lerpVal(iA[2], iB[2], t),
        );
        bgMat.uniforms.uOuterColor.value.setRGB(
            lerpVal(oA[0], oB[0], t), lerpVal(oA[1], oB[1], t), lerpVal(oA[2], oB[2], t),
        );

        // Lerp postprocessing
        bloomEffect.intensity = lerpVal(paramsA.bloomStrength, paramsB.bloomStrength, t);
        bloomEffect.luminanceMaterial.threshold = lerpVal(paramsA.bloomThreshold, paramsB.bloomThreshold, t);
        const caVal = lerpVal(paramsA.chromaticAberration, paramsB.chromaticAberration, t);
        chromaticAberrationEffect.offset.set(caVal, caVal);
        vignetteEffect.darkness = lerpVal(paramsA.vignetteStrength, paramsB.vignetteStrength, t);

        composer.render();
    }

    /**
     * End the morph: clean up from-scene, restore to-scene to normal state.
     */
    function morphEnd() {
        if (!morphState) return;

        const { refsA, refsB, morphGlow } = morphState;

        // Dispose from-scene (A) objects
        disposeRefs(refsA);

        // Remove morph glow
        if (morphGlow) {
            scene.remove(morphGlow);
            morphGlow.geometry.dispose();
            morphGlow.material.dispose();
        }

        // Restore B's original glow points
        if (refsB.glowPoints) refsB.glowPoints.visible = true;

        // Set B materials to full opacity, reset morph uniforms
        setMorphFade(refsB, 1.0);
        if (refsB.glowMat) {
            refsB.glowMat.uniforms.uMorphT.value = 0.0;
        }

        // Final render at target state
        composer.render();

        morphState = null;
    }

    return {
        renderWith, dispose, resize, syncSize, setDPR,
        morphPrepare, morphUpdate, morphEnd,
        getCanvas: () => canvas,
    };
}
