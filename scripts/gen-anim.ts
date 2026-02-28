/**
 * Browser-side animation renderer with configurable parameter journeys.
 *
 * Renders morph transitions frame-by-frame using a journey config that
 * defines how each parameter evolves over time. Exposes control functions
 * for Playwright to orchestrate. The Node.js script captures each frame
 * via canvas.toDataURL() and stitches into MP4 via ffmpeg.
 *
 * Also works standalone via the "Generate" button (renders in-browser).
 */

import { createRenderer, clamp01 } from '../lib/index.js';
import type { Controls, Renderer } from '../lib/types.js';

/* ── Journey config types ── */

/** A single keypoint: [normalizedTime (0-1), value (0-1)] */
type Keypoint = [number, number];

/** Per-parameter journey: array of keypoints sorted by time */
type ParamJourney = Keypoint[];

type NumericControlKey =
    | 'density' | 'luminosity' | 'fracture' | 'coherence'
    | 'scale' | 'division' | 'faceting' | 'flow'
    | 'hue' | 'spectrum' | 'chroma';

/** Full animation journey configuration */
interface AnimJourney {
    label: string;
    durationS: number;
    fps: number;
    width: number;
    height: number;
    seed: string;
    segmentCount: number;
    topology: 'flow-field';
    /** Per-parameter journeys. Missing keys default to constant 0.5. */
    journeys: Partial<Record<NumericControlKey, ParamJourney>>;
}

/* ── Constants ── */

const NUMERIC_KEYS: NumericControlKey[] = [
    'density', 'luminosity', 'fracture', 'coherence',
    'scale', 'division', 'faceting', 'flow',
    'hue', 'spectrum', 'chroma',
];

/** Default preset: all parameters sweep linearly from 0 to 1 */
const SWEEP_ALL: AnimJourney = {
    label: 'sweep-all-0-to-1',
    durationS: 60,
    fps: 60,
    width: 3840,
    height: 2160,
    seed: 'geometric-anim-v1',
    segmentCount: 60,
    topology: 'flow-field',
    journeys: {
        density:    [[0, 0], [1, 1]],
        luminosity: [[0, 0], [1, 1]],
        fracture:   [[0, 0], [1, 1]],
        coherence:  [[0, 0], [1, 1]],
        scale:      [[0, 0], [1, 1]],
        division:   [[0, 0], [1, 1]],
        faceting:   [[0, 0], [1, 1]],
        flow:       [[0, 0], [1, 1]],
        hue:        [[0, 0], [1, 1]],
        spectrum:   [[0, 0], [1, 1]],
        chroma:     [[0, 0], [1, 1]],
    },
};

/* ── DOM refs ── */

const canvas = document.getElementById('c') as HTMLCanvasElement;
const elProgressFill = document.getElementById('progressFill') as HTMLDivElement;
const elStatus = document.getElementById('status') as HTMLDivElement;
const elLog = document.getElementById('log') as HTMLPreElement;
const elGenerateBtn = document.getElementById('generateBtn') as HTMLButtonElement;

/* ── Helpers ── */

function log(msg: string): void {
    const ts = new Date().toISOString().slice(11, 23);
    elLog.textContent += `[${ts}] ${msg}\n`;
    elLog.scrollTop = elLog.scrollHeight;
    console.log(msg);
}

function setProgress(fraction: number): void {
    elProgressFill.style.width = `${(fraction * 100).toFixed(1)}%`;
}

function setStatus(msg: string): void {
    elStatus.textContent = msg;
}

/* ── Journey evaluation ── */

/**
 * Evaluate a single parameter journey at normalized time t (0-1).
 * Piecewise linear interpolation between keypoints.
 */
function evalParamAt(journey: ParamJourney, t: number): number {
    if (journey.length === 0) return 0.5;
    if (journey.length === 1) return journey[0][1];
    if (t <= journey[0][0]) return journey[0][1];
    if (t >= journey[journey.length - 1][0]) return journey[journey.length - 1][1];

    for (let i = 0; i < journey.length - 1; i++) {
        const [t0, v0] = journey[i];
        const [t1, v1] = journey[i + 1];
        if (t >= t0 && t <= t1) {
            const segT = (t - t0) / (t1 - t0);
            return v0 + (v1 - v0) * segT;
        }
    }
    return journey[journey.length - 1][1];
}

/**
 * Evaluate the full journey at normalized time t → Controls object.
 */
function evalJourneyAt(config: AnimJourney, tNorm: number): Controls {
    const controls = { topology: config.topology } as Controls;
    for (const key of NUMERIC_KEYS) {
        const kps = config.journeys[key];
        (controls as unknown as Record<string, number>)[key] = kps
            ? clamp01(evalParamAt(kps, tNorm))
            : 0.5;
    }
    return controls;
}

/**
 * Compute control snapshots at each segment boundary.
 * Returns segmentCount + 1 Controls objects.
 */
function computeSegmentControls(config: AnimJourney): Controls[] {
    const result: Controls[] = [];
    for (let s = 0; s <= config.segmentCount; s++) {
        result.push(evalJourneyAt(config, s / config.segmentCount));
    }
    return result;
}

/* ── Exposed API for Playwright ── */

interface AnimAPI {
    init(): {
        totalSegments: number;
        framesPerSegment: number;
        totalFrames: number;
        width: number;
        height: number;
    };
    prepareSegment(segIdx: number): void;
    renderFrame(frameWithinSegment: number): string;  // returns data URL
    endSegment(): void;
    dispose(): void;
}

function createAnimAPI(): AnimAPI {
    const journey = SWEEP_ALL;

    const renderer = createRenderer(canvas, { dpr: 1 });
    renderer.resize(journey.width, journey.height);
    log(`Renderer created (${journey.width}x${journey.height}, dpr:1)`);

    const totalFrames = journey.durationS * journey.fps;
    const framesPerSegment = Math.floor(totalFrames / journey.segmentCount);
    const segmentControls = computeSegmentControls(journey);

    log(`Journey: "${journey.label}"`);
    log(`${journey.segmentCount} segments, ${framesPerSegment} frames/seg, ${totalFrames} total frames`);
    log(`Duration: ${journey.durationS}s @ ${journey.fps}fps`);

    return {
        init() {
            return {
                totalSegments: journey.segmentCount,
                framesPerSegment,
                totalFrames,
                width: journey.width,
                height: journey.height,
            };
        },

        prepareSegment(segIdx: number) {
            const ctrlA = segmentControls[segIdx];
            const ctrlB = segmentControls[segIdx + 1];
            renderer.morphPrepare(journey.seed, ctrlA, journey.seed, ctrlB);
            log(`Segment ${segIdx + 1}/${journey.segmentCount}: morphPrepare done`);
            setStatus(`Segment ${segIdx + 1}/${journey.segmentCount}`);
        },

        renderFrame(frameWithinSegment: number): string {
            const t = frameWithinSegment / framesPerSegment;  // linear, no easing
            renderer.morphUpdate(t);
            return canvas.toDataURL('image/png');
        },

        endSegment() {
            renderer.morphEnd();
        },

        dispose() {
            renderer.dispose();
        },
    };
}

/* ── Expose for Playwright ── */

(window as unknown as { createAnimAPI: typeof createAnimAPI }).createAnimAPI = createAnimAPI;

/* ── Standalone button handler ── */

elGenerateBtn.addEventListener('click', async () => {
    elGenerateBtn.disabled = true;
    try {
        const api = createAnimAPI();
        const { totalSegments, framesPerSegment, totalFrames } = api.init();
        let globalFrame = 0;

        for (let si = 0; si < totalSegments; si++) {
            api.prepareSegment(si);

            for (let f = 0; f < framesPerSegment; f++) {
                if (globalFrame >= totalFrames) break;
                api.renderFrame(f);
                globalFrame++;
                setProgress(globalFrame / totalFrames);
                if ((f & 7) === 7) await new Promise(r => setTimeout(r, 0));
            }

            api.endSegment();
            log(`Segment ${si + 1} complete (${globalFrame}/${totalFrames})`);
        }

        setStatus(`Done: rendered ${totalFrames} frames`);
        api.dispose();
    } catch (err) {
        log(`ERROR: ${(err as Error).message}`);
        setStatus(`Error: ${(err as Error).message}`);
    }
    elGenerateBtn.disabled = false;
});
