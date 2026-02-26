/**
 * Browser-side loop animation renderer.
 *
 * Renders morph transitions frame-by-frame, exposing control
 * functions for Playwright to orchestrate. The Node.js script
 * captures each frame via canvas.toDataURL() and stitches
 * into MP4 via ffmpeg.
 *
 * Also works standalone via the "Generate" button (saves PNGs).
 */

import {
    createRenderer, resetPalette,
    xmur3, mulberry32,
} from '../lib/index.js';
import type { Controls, PaletteKey, Renderer } from '../lib/types.js';

/* ── Constants ── */

const FPS = 60;
const TRANSITION_S = 3;
const FRAMES_PER_TRANSITION = FPS * TRANSITION_S;   // 180
const NUM_CONFIGS = 6;
const MASTER_SEED = 'geometric-loop-v1';

const BUILTIN_PALETTES: PaletteKey[] = [
    'violet-depth', 'warm-spectrum', 'teal-volumetric',
    'prismatic', 'crystal-lattice', 'sapphire', 'amethyst',
];

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

function easeInOutCubic(x: number): number {
    return x < 0.5
        ? 4 * x * x * x
        : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/* ── Random config generation ── */

interface ConfigEntry {
    seed: string;
    controls: Controls;
}

function randomConfig(rng: () => number, idx: number): ConfigEntry {
    return {
        seed: `loop-${idx}-${Math.floor(rng() * 1e9)}`,
        controls: {
            topology: 'flow-field',
            palette: BUILTIN_PALETTES[Math.floor(rng() * BUILTIN_PALETTES.length)],
            density:    0.03 + rng() * 0.22,
            luminosity: 0.30 + rng() * 0.50,
            fracture:   0.20 + rng() * 0.70,
            depth:      0.65 + rng() * 0.30,
            coherence:  0.50 + rng() * 0.45,
        },
    };
}

function generateConfigs(): ConfigEntry[] {
    const rng = mulberry32(xmur3(MASTER_SEED)());
    const configs: ConfigEntry[] = [];
    for (let i = 0; i < NUM_CONFIGS; i++) {
        configs.push(randomConfig(rng, i));
    }
    return configs;
}

/**
 * Build the ping-pong transition sequence.
 * Forward: A→B→C→D→E→F, Reverse: F→E→D→C→B→A
 * Returns array of [from, to] pairs (10 total).
 */
function buildTransitionPairs(configs: ConfigEntry[]): [ConfigEntry, ConfigEntry][] {
    const seq: ConfigEntry[] = [
        ...configs,                                    // A B C D E F
        ...configs.slice(1, -1).reverse(),             // E D C B
    ];
    const pairs: [ConfigEntry, ConfigEntry][] = [];
    for (let i = 0; i < seq.length; i++) {
        const next = (i + 1) % seq.length === 0 ? configs[0] : seq[i + 1];
        pairs.push([seq[i], next]);
    }
    return pairs;
}

/* ── Exposed API for Playwright ── */

interface LoopAPI {
    init(): { totalTransitions: number; framesPerTransition: number; totalFrames: number };
    prepareTransition(ti: number): void;
    renderFrame(f: number): string;  // returns data URL
    endTransition(): void;
    dispose(): void;
}

function createLoopAPI(): LoopAPI {
    const renderer = createRenderer(canvas, { dpr: 1 });
    renderer.resize(800, 520);
    log('Renderer created (800x520, dpr:1)');

    const configs = generateConfigs();
    log(`Generated ${configs.length} random configs:`);
    for (const c of configs) {
        log(`  ${c.seed} — ${c.controls.palette}, d=${c.controls.density.toFixed(2)}`);
    }

    const pairs = buildTransitionPairs(configs);
    const totalTransitions = pairs.length;
    const totalFrames = totalTransitions * FRAMES_PER_TRANSITION;
    log(`${totalTransitions} transitions, ${totalFrames} frames (${totalFrames / FPS}s @ ${FPS}fps)`);

    return {
        init() {
            return { totalTransitions, framesPerTransition: FRAMES_PER_TRANSITION, totalFrames };
        },

        prepareTransition(ti: number) {
            const [from, to] = pairs[ti];
            resetPalette(from.controls.palette);
            resetPalette(to.controls.palette);
            renderer.morphPrepare(from.seed, from.controls, to.seed, to.controls);
            log(`Transition ${ti + 1}: morphPrepare done`);
            setStatus(`Transition ${ti + 1}/${totalTransitions}`);
        },

        renderFrame(f: number): string {
            const rawT = f / FRAMES_PER_TRANSITION;
            const easedT = easeInOutCubic(rawT);
            renderer.morphUpdate(easedT);
            return canvas.toDataURL('image/png');
        },

        endTransition() {
            renderer.morphEnd();
        },

        dispose() {
            renderer.dispose();
        },
    };
}

/* ── Expose for Playwright ── */

(window as unknown as { createLoopAPI: typeof createLoopAPI }).createLoopAPI = createLoopAPI;

/* ── Standalone button handler ── */

elGenerateBtn.addEventListener('click', async () => {
    elGenerateBtn.disabled = true;
    try {
        const api = createLoopAPI();
        const { totalTransitions, framesPerTransition, totalFrames } = api.init();
        let globalFrame = 0;

        for (let ti = 0; ti < totalTransitions; ti++) {
            api.prepareTransition(ti);

            for (let f = 0; f < framesPerTransition; f++) {
                api.renderFrame(f);
                globalFrame++;
                setProgress(globalFrame / totalFrames);
                if ((f & 7) === 7) await new Promise(r => setTimeout(r, 0));
            }

            api.endTransition();
            log(`Transition ${ti + 1} complete (${globalFrame}/${totalFrames})`);
        }

        setStatus(`Done: rendered ${totalFrames} frames`);
        api.dispose();
    } catch (err) {
        log(`ERROR: ${(err as Error).message}`);
        setStatus(`Error: ${(err as Error).message}`);
    }
    elGenerateBtn.disabled = false;
});
