/**
 * Morph transition demo — standalone page for visual debugging.
 * Renders two random images and morphs between them.
 * Uses createRenderer directly on the main thread (no worker).
 */

import { createRenderer } from './engine/create-renderer.js';
import { PALETTE_KEYS, updatePalette, resetPalette } from './core/palettes.js';

const SLIDER_KEYS = ['density', 'luminosity', 'fracture', 'depth', 'coherence'];
const MORPH_FRAMES = 72;
const MORPH_FRAME_MS = 1000 / 24; // ~41.67ms → 24fps

// DOM
const thumbA = document.getElementById('thumbA');
const thumbB = document.getElementById('thumbB');
const mainCanvas = document.getElementById('mainCanvas');
const playBtn = document.getElementById('playBtn');
const randomizeBtn = document.getElementById('randomizeBtn');
const status = document.getElementById('status');
const timebarFill = document.getElementById('timebarFill');

// Renderers (main thread, one per canvas)
let rendererA = null;
let rendererB = null;
let mainRenderer = null;
let stateA = null;
let stateB = null;
let morphPlaying = false;

function randomState() {
    const palette = PALETTE_KEYS[Math.floor(Math.random() * (PALETTE_KEYS.length - 1))]; // skip 'custom'
    const seed = 'demo-' + Math.random().toString(36).slice(2, 10);
    const controls = { topology: 'flow-field', palette };
    for (const key of SLIDER_KEYS) {
        controls[key] = Math.random();
    }
    const paletteTweaks = {
        baseHue: Math.floor(Math.random() * 360),
        hueRange: Math.floor(20 + Math.random() * 140),
        saturation: +(0.3 + Math.random() * 0.5).toFixed(2),
    };
    return { seed, controls, paletteTweaks };
}

function renderStatic(renderer, state) {
    resetPalette(state.controls.palette);
    updatePalette(state.controls.palette, state.paletteTweaks);
    renderer.renderWith(state.seed, state.controls);
}

function renderThumbs() {
    stateA = randomState();
    stateB = randomState();

    status.textContent = 'Rendering A...';
    renderStatic(rendererA, stateA);

    status.textContent = 'Rendering B...';
    renderStatic(rendererB, stateB);

    // Show image A on the main canvas as initial state
    status.textContent = 'Rendering main (A)...';
    renderStatic(mainRenderer, stateA);

    status.textContent = 'Ready';
    playBtn.disabled = false;
    timebarFill.style.width = '0%';
}

function playMorph() {
    if (!stateA || !stateB || morphPlaying) return;
    morphPlaying = true;
    playBtn.disabled = true;
    randomizeBtn.disabled = true;
    timebarFill.style.width = '0%';

    status.textContent = 'Preparing morph...';

    // Sync palette for both states
    resetPalette(stateA.controls.palette);
    updatePalette(stateA.controls.palette, stateA.paletteTweaks);
    resetPalette(stateB.controls.palette);
    updatePalette(stateB.controls.palette, stateB.paletteTweaks);

    mainRenderer.morphPrepare(
        stateA.seed, stateA.controls,
        stateB.seed, stateB.controls
    );

    status.textContent = 'Morphing...';

    let frame = 0;
    function tick() {
        if (frame >= MORPH_FRAMES) {
            mainRenderer.morphEnd();
            timebarFill.style.width = '100%';
            status.textContent = 'Complete';
            morphPlaying = false;
            playBtn.disabled = false;
            randomizeBtn.disabled = false;
            return;
        }
        const tRaw = frame / (MORPH_FRAMES - 1);
        const t = 0.5 * (1 - Math.cos(Math.PI * tRaw)); // cosine ease
        mainRenderer.morphUpdate(t);
        timebarFill.style.width = (t * 100) + '%';
        frame++;
        setTimeout(tick, MORPH_FRAME_MS);
    }
    tick();
}

// Init
try {
    rendererA = createRenderer(thumbA);
    rendererA.resize(thumbA.width, thumbA.height);

    rendererB = createRenderer(thumbB);
    rendererB.resize(thumbB.width, thumbB.height);

    mainRenderer = createRenderer(mainCanvas);
    mainRenderer.resize(mainCanvas.width, mainCanvas.height);

    renderThumbs();
} catch (err) {
    status.textContent = 'Error: ' + err.message;
    console.error(err);
}

playBtn.addEventListener('click', playMorph);
randomizeBtn.addEventListener('click', () => {
    if (morphPlaying) return;
    renderThumbs();
});
