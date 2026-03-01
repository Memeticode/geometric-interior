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
    DepthOfFieldEffect,
    BlendFunction,
} from 'postprocessing';
import { xmur3, mulberry32 } from '../core/prng.js';
import { deriveParams } from '../core/params.js';
import { parseSeed, createTagStreams, seedToString } from '../core/seed-tags.js';
import { generateTitle, generateAltText } from '../core/text.js';
import { buildDemoScene } from './demo/build-scene.js';
import { matchDots, buildMorphGlowGeometry } from './demo/dot-matching.js';
import { createDemoGlowMaterial } from './materials.js';
import { createGlowTexture } from './demo/dots.js';
import type { Controls, Renderer, RendererOptions, RenderMeta, SceneRefs, DerivedParams, Seed } from '../types.js';

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

    const dofEffect = new DepthOfFieldEffect(camera, {
        focusDistance: 0.0,
        focalLength: 0.05,
        bokehScale: 2.0,
    });
    const dofPass = new EffectPass(camera, dofEffect);
    dofPass.enabled = false; // disabled by default — zero overhead

    const effectPass = new EffectPass(
        camera,
        bloomEffect,
        chromaticAberrationEffect,
        vignetteEffect,
    );

    composer.addPass(dofPass);  // DOF blur before bloom/CA/vignette
    composer.addPass(effectPass);

    // --- Cached reusable objects ---

    const bgGeometry = new THREE.PlaneGeometry(2, 2);
    const bgMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uInnerColor: { value: new THREE.Color() },
            uOuterColor: { value: new THREE.Color() },
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

    const cachedGlowTexture = createGlowTexture();

    function clearScene(targetScene: THREE.Scene): void {
        while (targetScene.children.length > 0) {
            const child = targetScene.children[0];
            if (child === bgQuad) {
                targetScene.remove(child);
                continue;
            }
            targetScene.remove(child);
            if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
            if ((child as THREE.Mesh).material) ((child as THREE.Mesh).material as THREE.Material).dispose();
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

    // --- Persistent scene state for render loop ---
    let currentRefs: SceneRefs | null = null;
    let currentParams: DerivedParams | null = null;
    const baseCameraPos = new THREE.Vector3();

    // --- Fold animation state ---
    let foldProgress = 1.0;
    let foldTarget = 1.0;
    const FOLD_IN_SPEED = 1.25;  // 0→1 in ~800ms
    const FOLD_OUT_SPEED = 1.67; // 1→0 in ~600ms
    let lastUpdateTime = 0;

    function renderWith(seed: Seed, controls: Controls, locale: string = 'en'): RenderMeta {
        syncSize();

        const tag = parseSeed(seed);
        const streams = createTagStreams(tag);
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

        currentRefs = null;
        clearScene(scene);

        bgMaterial.uniforms.uInnerColor.value.setRGB(...params.bgInnerColor);
        bgMaterial.uniforms.uOuterColor.value.setRGB(...params.bgOuterColor);
        scene.add(bgQuad);

        const result = buildDemoScene(params, streams, scene, cachedGlowTexture);

        // Store refs for persistent render loop
        currentRefs = result.refs;
        currentParams = params;

        // Apply current fold state to new scene
        if (currentRefs.faceMat) currentRefs.faceMat.uniforms.uFoldProgress.value = foldProgress;
        if (currentRefs.edgeMat) currentRefs.edgeMat.uniforms.uFoldProgress.value = foldProgress;
        if (currentRefs.glowMat) currentRefs.glowMat.uniforms.uFoldProgress.value = foldProgress;
        if (currentRefs.tendrilMat) { currentRefs.tendrilMat.opacity = foldProgress; currentRefs.tendrilMat.transparent = true; }
        if (currentRefs.sphereMat) { currentRefs.sphereMat.opacity = foldProgress; currentRefs.sphereMat.transparent = true; }

        // Apply current animation config to new materials
        applyAnimConfig();

        bloomEffect.intensity = params.bloomStrength;
        bloomEffect.luminanceMaterial.threshold = params.bloomThreshold;

        const ca = params.chromaticAberration;
        chromaticAberrationEffect.offset.set(ca, ca);

        vignetteEffect.darkness = params.vignetteStrength;

        composer.render();

        const titleRng = mulberry32(xmur3('title-' + tag[0] + '-' + tag[1] + '-' + tag[2])());
        const title = generateTitle(controls, titleRng, locale);
        const altText = generateAltText(controls, result.nodeCount, title, locale);

        return { title, altText, nodeCount: result.nodeCount };
    }

    function dispose(): void {
        clearScene(scene);
        bgGeometry.dispose();
        bgMaterial.dispose();
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

    // --- Morph transition support ---

    let morphState: {
        refsA: SceneRefs;
        refsB: SceneRefs;
        paramsA: ReturnType<typeof deriveParams>;
        paramsB: ReturnType<typeof deriveParams>;
        morphGlow: THREE.Points | null;
        morphGlowMat: THREE.ShaderMaterial | null;
    } | null = null;

    function lerpVal(a: number, b: number, t: number): number {
        return a + (b - a) * t;
    }

    function setMorphFade(refs: SceneRefs, value: number): void {
        if (refs.faceMat) refs.faceMat.uniforms.uMorphFade.value = value;
        if (refs.edgeMat) refs.edgeMat.uniforms.uMorphFade.value = value;
        if (refs.glowMat) refs.glowMat.uniforms.uMorphFade.value = value;
        if (refs.tendrilMat) refs.tendrilMat.opacity = value;
        if (refs.sphereMat) refs.sphereMat.opacity = value;
    }

    /** Mark sphere materials as transparent (call once in morphPrepare, not per frame). */
    function prepareMorphRefs(refs: SceneRefs): void {
        if (refs.sphereMat) refs.sphereMat.transparent = true;
    }

    function disposeRefs(refs: SceneRefs): void {
        const objects = [refs.faceMesh, refs.edgeLines, refs.tendrilLines, refs.glowPoints, refs.sphereInst];
        for (const obj of objects) {
            if (obj) {
                scene.remove(obj);
                if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
                if ((obj as THREE.Mesh).material) ((obj as THREE.Mesh).material as THREE.Material).dispose();
            }
        }
    }

    function morphPrepare(
        seedA: Seed, controlsA: Controls, seedB: Seed, controlsB: Controls,
    ): void {
        syncSize();
        clearScene(scene);

        const paramsA = deriveParams(controlsA);
        const paramsB = deriveParams(controlsB);

        bgMaterial.uniforms.uInnerColor.value.setRGB(...paramsA.bgInnerColor);
        bgMaterial.uniforms.uOuterColor.value.setRGB(...paramsA.bgOuterColor);
        scene.add(bgQuad);

        const streamsA = createTagStreams(parseSeed(seedA));
        const resultA = buildDemoScene(paramsA, streamsA, scene, cachedGlowTexture);

        const streamsB = createTagStreams(parseSeed(seedB));
        const resultB = buildDemoScene(paramsB, streamsB, scene, cachedGlowTexture);

        prepareMorphRefs(resultA.refs);
        prepareMorphRefs(resultB.refs);
        setMorphFade(resultA.refs, 1.0);
        setMorphFade(resultB.refs, 0.0);

        const glowDataA = resultA.refs.glowPointData || [];
        const glowDataB = resultB.refs.glowPointData || [];
        let morphGlow: THREE.Points | null = null;
        let morphGlowMat: THREE.ShaderMaterial | null = null;

        if (glowDataA.length > 0 || glowDataB.length > 0) {
            const matching = matchDots(glowDataA, glowDataB);
            const morphGlowGeom = buildMorphGlowGeometry(glowDataA, glowDataB, matching);
            morphGlowMat = createDemoGlowMaterial(cachedGlowTexture);
            morphGlow = new THREE.Points(morphGlowGeom, morphGlowMat);
            morphGlow.frustumCulled = false;
            morphGlow.renderOrder = 0;
            scene.add(morphGlow);
        }

        if (resultA.refs.glowPoints) resultA.refs.glowPoints.visible = false;
        if (resultB.refs.glowPoints) resultB.refs.glowPoints.visible = false;

        camera.fov = paramsA.cameraFov;
        camera.aspect = getAspect();
        camera.updateProjectionMatrix();
        camera.position.set(paramsA.cameraOffsetX, paramsA.cameraOffsetY, paramsA.cameraZ);
        camera.lookAt(0, 0, 0);

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
        };

        composer.render();
    }

    function morphUpdate(t: number): void {
        if (!morphState) return;

        const { refsA, refsB, paramsA, paramsB, morphGlowMat: mGlowMat } = morphState;

        setMorphFade(refsA, 1.0 - t);
        setMorphFade(refsB, t);

        if (mGlowMat) {
            mGlowMat.uniforms.uMorphT.value = t;
        }

        camera.fov = lerpVal(paramsA.cameraFov, paramsB.cameraFov, t);
        camera.position.set(
            lerpVal(paramsA.cameraOffsetX, paramsB.cameraOffsetX, t),
            lerpVal(paramsA.cameraOffsetY, paramsB.cameraOffsetY, t),
            lerpVal(paramsA.cameraZ, paramsB.cameraZ, t),
        );
        camera.aspect = getAspect();
        camera.updateProjectionMatrix();
        camera.lookAt(0, 0, 0);

        const iA = paramsA.bgInnerColor, iB = paramsB.bgInnerColor;
        const oA = paramsA.bgOuterColor, oB = paramsB.bgOuterColor;
        bgMaterial.uniforms.uInnerColor.value.setRGB(
            lerpVal(iA[0], iB[0], t), lerpVal(iA[1], iB[1], t), lerpVal(iA[2], iB[2], t),
        );
        bgMaterial.uniforms.uOuterColor.value.setRGB(
            lerpVal(oA[0], oB[0], t), lerpVal(oA[1], oB[1], t), lerpVal(oA[2], oB[2], t),
        );

        bloomEffect.intensity = lerpVal(paramsA.bloomStrength, paramsB.bloomStrength, t);
        bloomEffect.luminanceMaterial.threshold = lerpVal(paramsA.bloomThreshold, paramsB.bloomThreshold, t);
        const caVal = lerpVal(paramsA.chromaticAberration, paramsB.chromaticAberration, t);
        chromaticAberrationEffect.offset.set(caVal, caVal);
        vignetteEffect.darkness = lerpVal(paramsA.vignetteStrength, paramsB.vignetteStrength, t);

        applyCameraOverride();
        composer.render();
    }

    function morphEnd(): void {
        if (!morphState) return;

        const { refsA, refsB, morphGlow, paramsB } = morphState;

        disposeRefs(refsA);

        if (morphGlow) {
            scene.remove(morphGlow);
            morphGlow.geometry.dispose();
            (morphGlow.material as THREE.Material).dispose();
        }

        if (refsB.glowPoints) refsB.glowPoints.visible = true;

        setMorphFade(refsB, 1.0);
        if (refsB.glowMat) {
            refsB.glowMat.uniforms.uMorphT.value = 0.0;
        }

        // Persist scene B as the current scene for render loop
        currentRefs = refsB;
        currentParams = paramsB;
        baseCameraPos.set(paramsB.cameraOffsetX, paramsB.cameraOffsetY, paramsB.cameraZ);

        composer.render();

        morphState = null;
    }

    // --- Camera override (Phase 3: animation camera moves) ---
    let cameraOverrideZoom = 1.0;
    let cameraOverrideOrbitY = 0;  // degrees
    let cameraOverrideOrbitX = 0;  // degrees

    /**
     * Apply camera zoom/orbit override to the current camera position.
     * Call right before each render (after the base camera has been set by
     * renderWith/morphUpdate). Modifies camera.position in place.
     */
    function applyCameraOverride(): void {
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

    function setCameraState(zoom: number, orbitY: number, orbitX: number): void {
        cameraOverrideZoom = zoom;
        cameraOverrideOrbitY = orbitY;
        cameraOverrideOrbitX = orbitX;
    }

    function clearCameraState(): void {
        cameraOverrideZoom = 1.0;
        cameraOverrideOrbitY = 0;
        cameraOverrideOrbitX = 0;
    }

    // --- Animation config ---
    let animConfig = { sparkle: 1.0, drift: 1.0, wobble: 1.0 };

    function applyAnimConfig(): void {
        if (currentRefs?.faceMat) {
            currentRefs.faceMat.uniforms.uSparkleIntensity.value = animConfig.sparkle;
            currentRefs.faceMat.uniforms.uDriftSpeed.value = animConfig.drift;
        }
        if (currentRefs?.glowMat) {
            currentRefs.glowMat.uniforms.uWobbleAmp.value = animConfig.wobble;
        }
    }

    function setAnimConfig(config: { sparkle?: number; drift?: number; wobble?: number }): void {
        if (config.sparkle !== undefined) animConfig.sparkle = config.sparkle;
        if (config.drift !== undefined) animConfig.drift = config.drift;
        if (config.wobble !== undefined) animConfig.wobble = config.wobble;
        applyAnimConfig();
    }

    /**
     * Set live animatable parameters from the timeline system.
     * twinkle → sparkle (face) + wobble (glow dot position/size oscillation)
     * dynamism → drift (face micro-animation)
     */
    function setLiveParams(params: { twinkle?: number; dynamism?: number }): void {
        if (params.twinkle !== undefined) {
            animConfig.sparkle = params.twinkle;
            animConfig.wobble = params.twinkle;
        }
        if (params.dynamism !== undefined) {
            animConfig.drift = params.dynamism;
        }
        applyAnimConfig();
    }

    // --- Depth-of-field / focus control ---

    function setFocusState(focalDepth: number, blurAmount: number): void {
        if (blurAmount <= 0.001) {
            dofPass.enabled = false;
            return;
        }
        dofPass.enabled = true;
        // focalDepth 0-1 maps to normalized focus distance (near → far)
        dofEffect.cocMaterial.focusDistance = focalDepth;
        dofEffect.bokehScale = blurAmount * 5; // scale 0-1 → 0-5 bokeh
    }

    function clearFocusState(): void {
        dofPass.enabled = false;
    }

    // --- Render loop methods ---

    /** Reusable Object3D for InstancedMesh matrix updates */
    const _dummyObj = new THREE.Object3D();

    function updateTime(seconds: number): void {
        const dt = seconds - lastUpdateTime;
        lastUpdateTime = seconds;

        if (!currentRefs) return;

        // Update uTime on all materials
        if (currentRefs.faceMat) currentRefs.faceMat.uniforms.uTime.value = seconds;
        if (currentRefs.edgeMat) currentRefs.edgeMat.uniforms.uTime.value = seconds;
        if (currentRefs.glowMat) currentRefs.glowMat.uniforms.uTime.value = seconds;

        // Light sphere wobble — update InstancedMesh matrices + light uniforms
        // (matches shader wobble so sphere positions stay in sync with glow dots)
        if (currentRefs.sphereInst && currentRefs.glowPointData) {
            const lightPositions = currentRefs.lightUniforms.uLightPositions.value;
            const sphereData = currentRefs.glowPointData;
            const count = Math.min(sphereData.length, currentRefs.sphereInst.count);
            const wAmp = animConfig.wobble;
            for (let i = 0; i < count; i++) {
                const bp = sphereData[i];
                const phase = bp.position.x * 12.9898 + bp.position.y * 78.233;
                const wx = Math.sin(seconds * 0.8 + phase) * 0.008 * wAmp;
                const wy = Math.cos(seconds * 0.6 + phase + 1.57) * 0.006 * wAmp;
                const wz = Math.sin(seconds * 0.5 + phase + 3.14) * 0.005 * wAmp;
                _dummyObj.position.set(bp.position.x + wx, bp.position.y + wy, bp.position.z + wz);
                _dummyObj.scale.setScalar(bp.size * 0.015);
                _dummyObj.updateMatrix();
                currentRefs.sphereInst.setMatrixAt(i, _dummyObj.matrix);
                if (i < lightPositions.length) {
                    lightPositions[i].set(bp.position.x + wx, bp.position.y + wy, bp.position.z + wz);
                }
            }
            currentRefs.sphereInst.instanceMatrix.needsUpdate = true;
        }

        // Fold animation
        updateFold(dt);
    }

    function updateFold(dt: number): void {
        if (foldProgress === foldTarget || dt <= 0) return;
        const speed = foldTarget > foldProgress ? FOLD_IN_SPEED : FOLD_OUT_SPEED;
        const dir = foldTarget > foldProgress ? 1 : -1;
        foldProgress = Math.max(0, Math.min(1, foldProgress + dir * speed * dt));
        // Snap to target if close enough
        if (Math.abs(foldProgress - foldTarget) < 0.001) foldProgress = foldTarget;
        if (currentRefs?.faceMat) currentRefs.faceMat.uniforms.uFoldProgress.value = foldProgress;
        if (currentRefs?.edgeMat) currentRefs.edgeMat.uniforms.uFoldProgress.value = foldProgress;
        if (currentRefs?.glowMat) currentRefs.glowMat.uniforms.uFoldProgress.value = foldProgress;
        if (currentRefs?.tendrilMat) { currentRefs.tendrilMat.opacity = foldProgress; currentRefs.tendrilMat.transparent = true; }
        if (currentRefs?.sphereMat) { currentRefs.sphereMat.opacity = foldProgress; currentRefs.sphereMat.transparent = true; }
    }

    function renderFrame(): void {
        applyCameraOverride();
        composer.render();
    }

    function foldIn(): void { foldTarget = 1.0; }
    function foldOut(): void { foldTarget = 0.0; }
    function setFoldImmediate(v: number): void {
        foldProgress = v;
        foldTarget = v;
        if (currentRefs?.faceMat) currentRefs.faceMat.uniforms.uFoldProgress.value = v;
        if (currentRefs?.edgeMat) currentRefs.edgeMat.uniforms.uFoldProgress.value = v;
        if (currentRefs?.glowMat) currentRefs.glowMat.uniforms.uFoldProgress.value = v;
        if (currentRefs?.tendrilMat) { currentRefs.tendrilMat.opacity = v; currentRefs.tendrilMat.transparent = true; }
        if (currentRefs?.sphereMat) { currentRefs.sphereMat.opacity = v; currentRefs.sphereMat.transparent = true; }
    }
    function isFoldComplete(): boolean { return foldProgress === foldTarget; }

    return {
        renderWith, dispose, resize, syncSize, setDPR,
        setTargetResolution, clearTargetResolution,
        morphPrepare, morphUpdate, morphEnd,
        updateTime, renderFrame, setAnimConfig,
        setCameraState, clearCameraState,
        setLiveParams,
        setFocusState, clearFocusState,
        foldIn, foldOut, setFoldImmediate, isFoldComplete,
        getCanvas: () => canvas,
    };
}
