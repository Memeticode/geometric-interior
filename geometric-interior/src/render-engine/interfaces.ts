/**
 * Renderer public contract and scene output types.
 */

import type { CameraConfig, ImageConfig, RenderMeta } from '../core/schemas.js';

/** Renderer instance returned by createRenderer() */
export interface Renderer {
    /** Build the scene for `config` and render it. */
    render(config: ImageConfig, locale?: string): RenderMeta;
    /** Change only the camera and re-render the current scene without rebuilding it. */
    setCamera(camera: CameraConfig): void;
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
