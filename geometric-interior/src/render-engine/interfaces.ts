/**
 * Renderer public contract and scene output types.
 */

import type { Controls, RenderMeta } from '../core/schemas.js';
import type { Seed } from '../core/text-generation/seed-tags.js';

/** Renderer instance returned by createRenderer() */
export interface Renderer {
    renderWith(seed: Seed, controls: Controls, locale?: string): RenderMeta;
    /** Re-render the current scene (e.g. after a camera change) without rebuilding it. */
    renderFrame(): void;
    setCameraState(zoom: number, orbitY: number, orbitX: number): void;
    clearCameraState(): void;
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

export interface SceneBuildResult {
    nodeCount: number;
    faceCount: number;
}
