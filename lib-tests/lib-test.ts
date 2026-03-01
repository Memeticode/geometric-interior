/**
 * Library test harness — interactive + Playwright-automatable.
 *
 * Creates a renderer from the library, wires interactive controls,
 * and exposes window.testLib for automated testing.
 */

import {
    createRenderer, deriveParams as _deriveParams,
    resetPalette as _resetPalette, updatePalette as _updatePalette,
    getPalette as _getPalette, PALETTE_KEYS,
} from '../lib/index.js';
import type { Controls, PaletteKey, PaletteTweaks, RenderMeta, DerivedParams } from '../lib/types.js';
import starterProfiles from '../src/core/starter-profiles.json';

/* ── Renderer setup ── */

const canvas = document.getElementById('testCanvas') as HTMLCanvasElement;
const renderer = createRenderer(canvas, { dpr: 1 });
renderer.resize(800, 520);

/* ── Pixel helpers ── */

interface PixelData {
    width: number;
    height: number;
    data: number[];
}

function readPixels(): PixelData {
    const w = canvas.width;
    const h = canvas.height;
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const ctx = tmp.getContext('2d')!;
    ctx.drawImage(canvas, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h);
    return { width: w, height: h, data: Array.from(imageData.data) };
}

function comparePixels(
    a: PixelData,
    b: PixelData,
): { match: boolean; diffPercent: number; diffPixels: number; totalPixels: number } {
    if (a.width !== b.width || a.height !== b.height) {
        const total = Math.max(a.width * a.height, b.width * b.height);
        return { match: false, diffPercent: 100, diffPixels: total, totalPixels: total };
    }
    const total = a.width * a.height;
    let diffPixels = 0;
    for (let i = 0; i < total; i++) {
        const off = i * 4;
        if (a.data[off] !== b.data[off] ||
            a.data[off + 1] !== b.data[off + 1] ||
            a.data[off + 2] !== b.data[off + 2]) {
            diffPixels++;
        }
    }
    return {
        match: diffPixels === 0,
        diffPercent: (diffPixels / total) * 100,
        diffPixels,
        totalPixels: total,
    };
}

/* ── Test API ── */

function setupPalette(controls: Controls, paletteTweaks?: Record<string, PaletteTweaks>): void {
    _resetPalette(controls.palette as PaletteKey);
    if (paletteTweaks) {
        for (const [key, tweaks] of Object.entries(paletteTweaks)) {
            _updatePalette(key as PaletteKey, tweaks);
        }
    }
}

const testLib = {
    /* ── Rendering ── */

    renderStill(
        seed: string,
        controls: Controls,
        paletteTweaks?: Record<string, PaletteTweaks>,
    ): { meta: RenderMeta; elapsedMs: number } {
        setupPalette(controls, paletteTweaks);
        const t0 = performance.now();
        const meta = renderer.renderWith(seed, controls);
        const elapsedMs = performance.now() - t0;
        return { meta, elapsedMs };
    },

    getPixels(): PixelData {
        return readPixels();
    },

    getDataURL(): string {
        return canvas.toDataURL('image/png');
    },

    comparePixels,

    /* ── Palette ── */

    resetPalette(key: string): void {
        _resetPalette(key as PaletteKey);
    },

    updatePalette(key: string, tweaks: PaletteTweaks): void {
        _updatePalette(key as PaletteKey, tweaks);
    },

    getPalette(key: string) {
        return _getPalette(key as PaletteKey);
    },

    /* ── Params ── */

    deriveParams(controls: Controls): DerivedParams {
        return _deriveParams(controls);
    },

    /* ── Morph ── */

    morphPrepare(
        seedA: string, controlsA: Controls,
        seedB: string, controlsB: Controls,
        paletteTweaksA?: Record<string, PaletteTweaks>,
        paletteTweaksB?: Record<string, PaletteTweaks>,
    ): void {
        _resetPalette(controlsA.palette as PaletteKey);
        _resetPalette(controlsB.palette as PaletteKey);
        renderer.morphPrepare(seedA, controlsA, seedB, controlsB, paletteTweaksA, paletteTweaksB);
    },

    morphStep(t: number): void {
        renderer.morphUpdate(t);
    },

    morphEnd(): void {
        renderer.morphEnd();
    },

    morphFilmstrip(
        seedA: string, controlsA: Controls,
        seedB: string, controlsB: Controls,
        frameCount: number,
        paletteTweaksA?: Record<string, PaletteTweaks>,
        paletteTweaksB?: Record<string, PaletteTweaks>,
    ): string[] {
        this.morphPrepare(seedA, controlsA, seedB, controlsB, paletteTweaksA, paletteTweaksB);
        const urls: string[] = [];
        for (let i = 0; i < frameCount; i++) {
            const t = frameCount <= 1 ? 0 : i / (frameCount - 1);
            renderer.morphUpdate(t);
            urls.push(canvas.toDataURL('image/png'));
        }
        renderer.morphEnd();
        return urls;
    },

    morphSmoothness(
        seedA: string, controlsA: Controls,
        seedB: string, controlsB: Controls,
        frameCount: number,
        paletteTweaksA?: Record<string, PaletteTweaks>,
        paletteTweaksB?: Record<string, PaletteTweaks>,
    ): { meanDelta: number; maxDelta: number; stddev: number; frames: number } {
        this.morphPrepare(seedA, controlsA, seedB, controlsB, paletteTweaksA, paletteTweaksB);
        const snapshots: PixelData[] = [];
        for (let i = 0; i < frameCount; i++) {
            const t = frameCount <= 1 ? 0 : i / (frameCount - 1);
            renderer.morphUpdate(t);
            snapshots.push(readPixels());
        }
        renderer.morphEnd();

        const deltas: number[] = [];
        for (let i = 1; i < snapshots.length; i++) {
            const result = comparePixels(snapshots[i - 1], snapshots[i]);
            deltas.push(result.diffPercent);
        }

        const mean = deltas.reduce((s, v) => s + v, 0) / deltas.length;
        const maxDelta = Math.max(...deltas);
        const variance = deltas.reduce((s, v) => s + (v - mean) ** 2, 0) / deltas.length;

        return { meanDelta: mean, maxDelta, stddev: Math.sqrt(variance), frames: frameCount };
    },

    /* ── Filmstrip helpers ── */

    seedFilmstrip(seeds: string[], controls: Controls): string[] {
        return seeds.map(seed => {
            this.renderStill(seed, controls);
            return canvas.toDataURL('image/png');
        });
    },

    controlFilmstrip(seed: string, controlSets: Controls[]): string[] {
        return controlSets.map(controls => {
            this.renderStill(seed, controls);
            return canvas.toDataURL('image/png');
        });
    },

    /* ── Lifecycle ── */

    resize(width: number, height: number): void {
        // Set CSS dimensions so syncSize() inside renderWith() doesn't override
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        renderer.resize(width, height);
    },

    dispose(): void {
        renderer.dispose();
    },

    getInfo(): { canvasWidth: number; canvasHeight: number; initialized: boolean } {
        return { canvasWidth: canvas.width, canvasHeight: canvas.height, initialized: true };
    },
};

(window as unknown as { testLib: typeof testLib }).testLib = testLib;

/* ═══════════════════════════════════════════════
   Interactive UI — Morph Transition Viewer
   ═══════════════════════════════════════════════ */

const STORAGE_KEY = 'geo_self_portrait_profiles_v3';

interface ProfileEntry {
    name: string;
    seed: string;
    controls: Controls;
    paletteTweaks?: { baseHue: number; hueRange: number; saturation: number };
}

function loadAllProfiles(): { starters: ProfileEntry[]; saved: ProfileEntry[] } {
    const starters: ProfileEntry[] = Object.entries(starterProfiles).map(([name, p]) => ({
        name,
        seed: p.seed,
        controls: p.controls as Controls,
        paletteTweaks: p.paletteTweaks,
    }));

    const saved: ProfileEntry[] = [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            for (const [name, p] of Object.entries(parsed)) {
                const prof = p as Record<string, unknown>;
                saved.push({
                    name,
                    seed: (prof.seed || prof.note || name) as string,
                    controls: prof.controls as Controls,
                    paletteTweaks: prof.paletteTweaks as ProfileEntry['paletteTweaks'],
                });
            }
        }
    } catch { /* ignore corrupt localStorage */ }

    return { starters, saved };
}

const allProfiles = loadAllProfiles();
const profileMap = new Map<string, ProfileEntry>();
for (const p of [...allProfiles.starters, ...allProfiles.saved]) {
    profileMap.set(p.name, p);
}

/* ── DOM refs ── */

const elBaseSelect = document.getElementById('baseProfile') as HTMLSelectElement;
const elTargetSelect = document.getElementById('targetProfile') as HTMLSelectElement;
const elBaseImg = document.getElementById('baseImg') as HTMLImageElement;
const elTargetImg = document.getElementById('targetImg') as HTMLImageElement;
const elMorphBtn = document.getElementById('morphBtn') as HTMLButtonElement;
const elParamFps = document.getElementById('paramFps') as HTMLInputElement;
const elParamDuration = document.getElementById('paramDuration') as HTMLInputElement;
const elFrameInfo = document.getElementById('frameInfo') as HTMLSpanElement;
const elFramesSection = document.getElementById('framesSection') as HTMLDetailsElement;
const elFramesSummary = document.getElementById('framesSummary') as HTMLElement;
const elFilmstrip = document.getElementById('filmstrip') as HTMLDivElement;
const elAnimSection = document.getElementById('animSection') as HTMLDetailsElement;
const elAnimSummary = document.getElementById('animSummary') as HTMLElement;
const elAnimPlayerRow = document.getElementById('animPlayerRow') as HTMLDivElement;
const elAnimCanvasHost = document.getElementById('animCanvasHost') as HTMLDivElement;
const elAnimPlayBtn = document.getElementById('animPlayBtn') as HTMLButtonElement;
const elAnimStopBtn = document.getElementById('animStopBtn') as HTMLButtonElement;
const elAnimStatus = document.getElementById('animStatus') as HTMLSpanElement;
const elAnimLoop = document.getElementById('animLoop') as HTMLInputElement;
const elAnimPingPong = document.getElementById('animPingPong') as HTMLInputElement;
const elFramesProgress = document.getElementById('framesProgress') as HTMLDivElement;
const elAnimProgress = document.getElementById('animProgress') as HTMLDivElement;
const elMetrics = document.getElementById('metrics') as HTMLDivElement;
const elLog = document.getElementById('log') as HTMLPreElement;

/* ── Populate selects ── */

function populateSelect(select: HTMLSelectElement, defaultName: string): void {
    select.innerHTML = '';

    const starterGroup = document.createElement('optgroup');
    starterGroup.label = 'Portraits';
    for (const p of allProfiles.starters) {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name;
        starterGroup.appendChild(opt);
    }
    select.appendChild(starterGroup);

    if (allProfiles.saved.length > 0) {
        const savedGroup = document.createElement('optgroup');
        savedGroup.label = 'Saved';
        for (const p of allProfiles.saved) {
            const opt = document.createElement('option');
            opt.value = p.name;
            opt.textContent = p.name;
            savedGroup.appendChild(opt);
        }
        select.appendChild(savedGroup);
    }

    select.value = defaultName;
}

/* ── Demo QoL: remember selected profiles across reloads ── */

const VIEWER_PREFS_KEY = 'lib_test_viewer_prefs';

function loadViewerPrefs(): { base: string; target: string } {
    try {
        const raw = localStorage.getItem(VIEWER_PREFS_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { base: '', target: '' };
}

function saveViewerPrefs(base: string, target: string): void {
    try {
        localStorage.setItem(VIEWER_PREFS_KEY, JSON.stringify({ base, target }));
    } catch { /* ignore */ }
}

function resolveProfileName(saved: string, otherName: string): string {
    if (saved && profileMap.has(saved)) return saved;
    const fallback = allProfiles.starters.find(p => p.name !== otherName);
    return fallback ? fallback.name : allProfiles.starters[0]?.name ?? '';
}

const viewerPrefs = loadViewerPrefs();
const resolvedBase = resolveProfileName(viewerPrefs.base, viewerPrefs.target);
const resolvedTarget = resolveProfileName(viewerPrefs.target, resolvedBase);

populateSelect(elBaseSelect, resolvedBase);
populateSelect(elTargetSelect, resolvedTarget);

/* ── Rendering helpers ── */

function renderProfileToDataURL(profile: ProfileEntry): { url: string; meta: RenderMeta; elapsedMs: number } {
    const tweaks = profile.paletteTweaks
        ? { custom: profile.paletteTweaks }
        : undefined;
    const result = testLib.renderStill(profile.seed, profile.controls, tweaks);
    return { url: canvas.toDataURL('image/png'), ...result };
}

function renderAndDisplay(select: HTMLSelectElement, img: HTMLImageElement): void {
    const profile = profileMap.get(select.value);
    if (!profile) return;
    const { url, meta, elapsedMs } = renderProfileToDataURL(profile);
    img.src = url;
    log(`Rendered "${profile.name}" — ${meta.nodeCount} nodes, ${elapsedMs.toFixed(0)}ms`);
}

function log(msg: string): void {
    elLog.textContent += msg + '\n';
    elLog.scrollTop = elLog.scrollHeight;
}

/* ── Helpers ── */

function readFps(): number { return Math.max(1, Math.min(60, parseInt(elParamFps.value) || 24)); }
function readDuration(): number { return Math.max(0.5, Math.min(30, parseFloat(elParamDuration.value) || 3)); }
function computeFrameCount(): number { return Math.round(readFps() * readDuration()); }

function updateFrameInfo(): void {
    elFrameInfo.textContent = `(${computeFrameCount()} frames)`;
}

/* ── Cached-frame playback (2D canvas — no WebGL re-render) ── */

const playbackCanvas = document.createElement('canvas');
playbackCanvas.width = 800;
playbackCanvas.height = 520;
const playbackCtx = playbackCanvas.getContext('2d')!;
elAnimCanvasHost.appendChild(playbackCanvas);

/* ── Easing ── */

/** Smooth ease-in-out (cubic) — avoids abrupt start/stop for polished feel. */
function easeInOutCubic(x: number): number {
    return x < 0.5
        ? 4 * x * x * x
        : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/* ── State ── */

let morphReady = false;
let rafId: number | null = null;
let playStartTime = 0;
let generating = false;
let frameBitmaps: ImageBitmap[] = [];
let lastHighlightedIdx = -1;

/* ── Eager morphPrepare ── */

let preparedKey: string | null = null;

function getPrepKey(): string {
    return `${elBaseSelect.value}|${elTargetSelect.value}`;
}

function getTweaks(p: ProfileEntry) {
    return p.paletteTweaks ? { custom: p.paletteTweaks } : undefined;
}

function eagerPrepare(): void {
    if (generating) return;
    const key = getPrepKey();
    if (key === preparedKey) return;

    const baseProfile = profileMap.get(elBaseSelect.value);
    const targetProfile = profileMap.get(elTargetSelect.value);
    if (!baseProfile || !targetProfile) return;

    // Clean up previous morph state
    if (morphReady) {
        testLib.morphEnd();
        morphReady = false;
    }

    const t0 = performance.now();
    testLib.morphPrepare(
        baseProfile.seed, baseProfile.controls,
        targetProfile.seed, targetProfile.controls,
        getTweaks(baseProfile), getTweaks(targetProfile),
    );
    morphReady = true;
    preparedKey = key;
    log(`  Eager prep: ${(performance.now() - t0).toFixed(0)}ms`);
}

function stopPlayback(): void {
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    elAnimPlayBtn.disabled = frameBitmaps.length === 0;
    elAnimStopBtn.disabled = true;
}

function invalidateTransition(): void {
    stopPlayback();
    if (morphReady) {
        testLib.morphEnd();
        morphReady = false;
    }
    preparedKey = null;
    for (const bm of frameBitmaps) bm.close();
    frameBitmaps = [];
    lastHighlightedIdx = -1;
    elFilmstrip.innerHTML = '';
    elFramesSummary.textContent = 'Transition Images';
    elAnimSummary.textContent = 'Transition Animation';
    elAnimPlayerRow.style.display = 'none';
    elAnimPlayBtn.disabled = true;
    elAnimStatus.textContent = '';
}

/* ── Busy state ── */

const interactiveEls = [elBaseSelect, elTargetSelect, elMorphBtn, elParamFps, elParamDuration, elAnimPlayBtn, elAnimStopBtn];

function setUIBusy(busy: boolean): void {
    generating = busy;
    for (const el of interactiveEls) el.disabled = busy;
    elMorphBtn.textContent = busy ? 'Generating...' : 'Generate Transition';
}

function setProgress(bar: HTMLDivElement, fraction: number): void {
    bar.hidden = false;
    (bar.firstElementChild as HTMLElement).style.width = `${(fraction * 100).toFixed(1)}%`;
}

function hideProgress(bar: HTMLDivElement): void {
    bar.hidden = true;
    (bar.firstElementChild as HTMLElement).style.width = '0%';
}

function yieldFrame(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}

/* ── Filmstrip click-to-jump ── */

function highlightFilmstripFrame(index: number): void {
    if (index === lastHighlightedIdx) return;
    const imgs = elFilmstrip.children;
    if (lastHighlightedIdx >= 0 && lastHighlightedIdx < imgs.length) {
        imgs[lastHighlightedIdx].classList.remove('active-frame');
    }
    if (index >= 0 && index < imgs.length) {
        imgs[index].classList.add('active-frame');
    }
    lastHighlightedIdx = index;
}

function jumpToFrame(index: number): void {
    if (frameBitmaps.length === 0 || index < 0 || index >= frameBitmaps.length) return;
    playbackCtx.drawImage(frameBitmaps[index], 0, 0);
    elAnimStatus.textContent = `Frame ${index + 1}/${frameBitmaps.length}`;
    elAnimSection.open = true;
    elAnimPlayerRow.style.display = '';
    highlightFilmstripFrame(index);
}

/* ── Event handlers ── */

elBaseSelect.addEventListener('change', () => {
    renderAndDisplay(elBaseSelect, elBaseImg);
    saveViewerPrefs(elBaseSelect.value, elTargetSelect.value);
    invalidateTransition();
    setTimeout(eagerPrepare, 0);
});
elTargetSelect.addEventListener('change', () => {
    renderAndDisplay(elTargetSelect, elTargetImg);
    saveViewerPrefs(elBaseSelect.value, elTargetSelect.value);
    invalidateTransition();
    setTimeout(eagerPrepare, 0);
});

elParamFps.addEventListener('input', updateFrameInfo);
elParamDuration.addEventListener('input', updateFrameInfo);
updateFrameInfo();

// Generate transition — morphPrepare + keyframe thumbnails
elMorphBtn.addEventListener('click', async () => {
    if (generating) return;
    const baseProfile = profileMap.get(elBaseSelect.value);
    const targetProfile = profileMap.get(elTargetSelect.value);
    if (!baseProfile || !targetProfile) return;

    const dur = readDuration();
    const frameCount = computeFrameCount();

    setUIBusy(true);
    // Clear cached frames but keep morph state if prep matches
    stopPlayback();
    for (const bm of frameBitmaps) bm.close();
    frameBitmaps = [];
    lastHighlightedIdx = -1;
    elFilmstrip.innerHTML = '';
    elAnimPlayerRow.style.display = 'none';
    elAnimPlayBtn.disabled = true;
    elAnimStatus.textContent = '';

    elFramesSection.open = true;
    elAnimSection.open = true;

    log(`Preparing transition: "${baseProfile.name}" → "${targetProfile.name}"...`);

    const t0 = performance.now();
    let prepMs: number;

    const key = getPrepKey();
    if (preparedKey === key && morphReady) {
        prepMs = 0;
        log(`  morphPrepare: skipped (eager prep hit)`);
    } else {
        // Eager prep missed or stale — prepare now
        if (morphReady) {
            testLib.morphEnd();
            morphReady = false;
        }
        testLib.morphPrepare(
            baseProfile.seed, baseProfile.controls,
            targetProfile.seed, targetProfile.controls,
            getTweaks(baseProfile), getTweaks(targetProfile),
        );
        morphReady = true;
        preparedKey = key;
        prepMs = performance.now() - t0;
        log(`  morphPrepare: ${prepMs.toFixed(0)}ms`);
    }

    // Generate frames: render each, cache bitmap
    const bitmaps: ImageBitmap[] = [];
    for (let i = 0; i < frameCount; i++) {
        const t = frameCount <= 1 ? 0 : i / (frameCount - 1);
        testLib.morphStep(t);
        bitmaps.push(await createImageBitmap(canvas));
        setProgress(elFramesProgress, (i + 1) / frameCount);
        if (i % 8 === 0) await yieldFrame();
    }

    // Release WebGL morph resources — playback uses cached bitmaps
    testLib.morphEnd();
    morphReady = false;

    const elapsed = performance.now() - t0;
    frameBitmaps = bitmaps;
    hideProgress(elFramesProgress);

    elFramesSummary.textContent = `Transition Frames (${frameCount})`;
    elAnimSummary.textContent = `Transition Animation (${dur}s)`;

    // Show first cached frame on playback canvas
    playbackCtx.drawImage(frameBitmaps[0], 0, 0);
    elAnimPlayerRow.style.display = '';
    elAnimStatus.textContent = 'Ready — click Play for cached animation';

    setUIBusy(false);
    elAnimPlayBtn.disabled = false;
    log(`  Done: ${frameCount} frames in ${elapsed.toFixed(0)}ms (prep: ${prepMs.toFixed(0)}ms)`);
    elMetrics.innerHTML = `<div>${baseProfile.name} → ${targetProfile.name} — prep ${prepMs.toFixed(0)}ms, frames ${(elapsed - prepMs).toFixed(0)}ms</div>`;
});

// Play animation — real-time requestAnimationFrame loop
elAnimPlayBtn.addEventListener('click', () => {
    if (frameBitmaps.length === 0) return;

    const duration = readDuration();
    const loop = elAnimLoop.checked;
    const pingPong = elAnimPingPong.checked;
    // Full cycle: forward only = duration, ping-pong = 2×duration
    const cycleDuration = pingPong ? duration * 2 : duration;
    const totalFrames = frameBitmaps.length;

    playStartTime = performance.now();
    elAnimPlayBtn.disabled = true;
    elAnimStopBtn.disabled = false;
    elAnimSection.open = true;
    elAnimPlayerRow.style.display = '';

    function tick(): void {
        const elapsed = (performance.now() - playStartTime) / 1000;
        const cycleElapsed = loop
            ? elapsed % cycleDuration
            : Math.min(elapsed, cycleDuration);

        // Map cycle position to linear 0→1 (forward) or 1→0 (reverse)
        let tLinear: number;
        if (pingPong) {
            const half = duration;
            if (cycleElapsed <= half) {
                tLinear = cycleElapsed / half;
            } else {
                tLinear = 1.0 - (cycleElapsed - half) / half;
            }
        } else {
            tLinear = cycleElapsed / duration;
        }
        tLinear = Math.max(0, Math.min(1, tLinear));
        const t = easeInOutCubic(tLinear);

        // Draw cached bitmap instead of re-rendering via WebGL
        const frameIdx = Math.min(Math.round(t * (totalFrames - 1)), totalFrames - 1);
        playbackCtx.drawImage(frameBitmaps[frameIdx], 0, 0);
        highlightFilmstripFrame(frameIdx);

        const currentLoop = Math.floor(elapsed / cycleDuration);
        const loopLabel = loop ? ` (loop ${currentLoop + 1})` : '';
        elAnimStatus.textContent = `${Math.min(elapsed, cycleDuration).toFixed(1)}s / ${cycleDuration.toFixed(1)}s${loopLabel}`;

        if (loop || elapsed < cycleDuration) {
            rafId = requestAnimationFrame(tick);
        } else {
            rafId = null;
            elAnimPlayBtn.disabled = false;
            elAnimStopBtn.disabled = true;
            elAnimStatus.textContent = `Done (${cycleDuration.toFixed(1)}s)`;
        }
    }

    rafId = requestAnimationFrame(tick);
});

// Stop animation
elAnimStopBtn.addEventListener('click', () => {
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    elAnimPlayBtn.disabled = frameBitmaps.length === 0;
    elAnimStopBtn.disabled = true;
    elAnimStatus.textContent = 'Stopped';
});

/* ── Initial render ── */

log('Morph Transition Viewer ready.');
renderAndDisplay(elBaseSelect, elBaseImg);
renderAndDisplay(elTargetSelect, elTargetImg);
setTimeout(eagerPrepare, 0);
