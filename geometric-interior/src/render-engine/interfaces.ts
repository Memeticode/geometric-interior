/**
 * Renderer public contract and scene output types.
 */

import type { ShaderMaterial, Mesh, InstancedMesh, MeshBasicMaterial } from 'three';
import type { Controls, RenderMeta } from '../core/image-models.js';
import type { Seed } from '../core/text-generation/seed-tags.js';
import type { GlowPointDatum, LightUniforms } from './models.js';

/** Renderer instance returned by createRenderer() */
export interface Renderer {
    renderWith(seed: Seed, controls: Controls): RenderMeta;
    morphPrepare(seedA: Seed, controlsA: Controls, seedB: Seed, controlsB: Controls): void;
    morphUpdate(t: number): void;
    morphEnd(): void;
    updateTime(seconds: number): void;
    renderFrame(): void;
    setAnimConfig(config: { sparkle?: number; drift?: number; wobble?: number }): void;
    setCameraState(zoom: number, orbitY: number, orbitX: number): void;
    clearCameraState(): void;
    setLiveParams(params: { twinkle?: number; dynamism?: number }): void;
    setFocusState(focalDepth: number, blurAmount: number): void;
    clearFocusState(): void;
    foldIn(): void;
    foldOut(): void;
    setFoldImmediate(v: number): void;
    isFoldComplete(): boolean;
    resize(width: number, height: number): void;
    syncSize(): void;
    setTargetResolution(w: number, h: number): void;
    clearTargetResolution(): void;
    setDPR(dpr: number): void;
    dispose(): void;
    getCanvas(): HTMLCanvasElement | OffscreenCanvas;
}

export interface RendererOptions {
    dpr?: number;
}

/** Scene build result refs for morph transitions */
export interface SceneRefs {
    glowPoints: Mesh | null;
    glowMat: ShaderMaterial | null;
    sphereInst: InstancedMesh | null;
    sphereMat: MeshBasicMaterial | null;
    faceMesh: Mesh | null;
    faceMat: ShaderMaterial | null;
    edgeLines: Mesh | null;
    edgeMat: ShaderMaterial | null;
    tendrilLines: Mesh | null;
    tendrilMat: ShaderMaterial | null;
    glowPointData: GlowPointDatum[];
    lightUniforms: LightUniforms;
}

export interface SceneBuildResult {
    nodeCount: number;
    faceCount: number;
    refs: SceneRefs;
}
