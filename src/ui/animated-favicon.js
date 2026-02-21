/**
 * Animated favicon — mini version of the violet-depth-plane-cluster reference.
 * Dark background, overlapping translucent violet/pink crystal planes with
 * screen blending, and drifting white star dots.
 *
 * Usage:
 *   import { createFaviconAnimation } from './ui/animated-favicon.js';
 *   const fav = createFaviconAnimation();
 *   fav.start();
 *   fav.stop();
 */

const DEG2RAD = Math.PI / 180;
const SIZE = 32;
const HALF = SIZE / 2;
const FPS_INTERVAL = 100;          // ms between frames (~10 fps)
const ROTATION_PERIOD = 45_000;    // ms for a full 360° group rotation

/* Violet-pink hue keyframes (narrow band) */
const HUE_KEYS = [260, 280, 300, 315];
const HUE_DWELL = 6000;            // ms per keyframe
const HUE_CYCLE = HUE_DWELL * HUE_KEYS.length;

/* Three translucent crystal planes */
const RECTS = [
    { x: 2,  y: 8,  w: 20, h: 18, rx: 1, opacity: 0.30, angle: -15, cx: 12, cy: 17,
      wobbleAmp: 10, wobbleSpeed: 0.88, breathSpeed: 1.00, driftAx: 2.2, driftAy: 1.8, driftFx: 0.58, driftFy: 0.43, phase: 0.0, hueOffset: 0 },
    { x: 10, y: 4,  w: 20, h: 18, rx: 1, opacity: 0.35, angle:  10, cx: 20, cy: 13,
      wobbleAmp: 9,  wobbleSpeed: 0.70, breathSpeed: 0.82, driftAx: 1.8, driftAy: 2.0, driftFx: 0.48, driftFy: 0.65, phase: 2.1, hueOffset: 1 },
    { x: 6,  y: 6,  w: 18, h: 18, rx: 1, opacity: 0.45, angle:  -4, cx: 15, cy: 15,
      wobbleAmp: 7,  wobbleSpeed: 0.55, breathSpeed: 0.70, driftAx: 1.4, driftAy: 1.5, driftFx: 0.38, driftFy: 0.53, phase: 4.2, hueOffset: 2 },
];

/* Two white star dots on Lissajous orbits */
const STARS = [
    { ax: 8, ay: 6, fx: 0.41, fy: 0.29, px: 0.0, py: 1.2, radius: 2.5, alpha: 0.9 },
    { ax: 6, ay: 8, fx: 0.33, fy: 0.47, px: 3.1, py: 0.5, radius: 2.0, alpha: 0.75 },
];

/* ── Helpers ── */

function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

function smoothBreath(t, speed) {
    return (
        Math.sin(t * speed) * 0.6 +
        Math.sin(t * speed * 1.73 + 0.9) * 0.25 +
        Math.sin(t * speed * 0.51 + 2.1) * 0.15
    );
}

function lerpHue(a, b, t) {
    let diff = b - a;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return ((a + diff * t) % 360 + 360) % 360;
}

/** Get a hue from the violet-pink keyframes, offset by index for per-rect variation. */
function getHue(elapsedMs, offset) {
    const shifted = elapsedMs + offset * (HUE_CYCLE / HUE_KEYS.length);
    const t = (shifted % HUE_CYCLE) / HUE_DWELL;
    const idx = Math.floor(t) % HUE_KEYS.length;
    const frac = smoothstep(t - Math.floor(t));
    return lerpHue(HUE_KEYS[idx], HUE_KEYS[(idx + 1) % HUE_KEYS.length], frac);
}

function getGroupRotation(elapsedMs) {
    return (elapsedMs / ROTATION_PERIOD) * 360;
}

/* ── Drawing ── */

function drawFrame(ctx, elapsedMs, groupAngleDeg, tSec) {
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Crystal planes — screen blend for additive overlap brightening
    ctx.globalCompositeOperation = 'screen';

    for (const r of RECTS) {
        ctx.save();

        const tp = tSec + r.phase;
        const hue = getHue(elapsedMs, r.hueOffset);

        // Positional drift
        const driftX = Math.sin(tp * r.driftFx + r.phase) * r.driftAx;
        const driftY = Math.sin(tp * r.driftFy + r.phase * 0.7) * r.driftAy;

        // Group rotation around canvas center
        ctx.translate(HALF, HALF);
        ctx.rotate(groupAngleDeg * DEG2RAD);
        ctx.translate(-HALF, -HALF);

        // Positional drift offset
        ctx.translate(driftX, driftY);

        // Per-rectangle rotation with wobble
        const wobble = smoothBreath(tp, r.wobbleSpeed) * r.wobbleAmp;
        ctx.translate(r.cx, r.cy);
        ctx.rotate((r.angle + wobble) * DEG2RAD);

        // Scale breathing
        const scaleFactor = 1.0 + smoothBreath(tp, r.breathSpeed) * 0.07;
        ctx.scale(scaleFactor, scaleFactor);

        ctx.translate(-r.cx, -r.cy);

        // Opacity breathing
        const opacityPulse = r.opacity * (1.0 + smoothBreath(tp, r.breathSpeed * 0.8) * 0.18);
        ctx.globalAlpha = Math.min(opacityPulse, 1.0);
        ctx.fillStyle = `hsl(${hue}, 60%, 55%)`;
        ctx.beginPath();
        ctx.roundRect(r.x, r.y, r.w, r.h, r.rx);
        ctx.fill();

        ctx.restore();
    }

    // White star dots — screen blend, radial gradient
    ctx.globalCompositeOperation = 'screen';
    for (const s of STARS) {
        const x = HALF + Math.sin(tSec * s.fx + s.px) * s.ax;
        const y = HALF + Math.sin(tSec * s.fy + s.py) * s.ay;
        const pulse = 0.85 + smoothBreath(tSec, 0.6) * 0.15;
        const r = s.radius * pulse;

        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0.0, `rgba(255,255,255,${s.alpha * pulse})`);
        grad.addColorStop(0.4, `rgba(220,210,255,${s.alpha * pulse * 0.5})`);
        grad.addColorStop(1.0, 'rgba(180,160,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
}

/* ── Favicon update (blob URL to avoid memory growth) ── */

function updateFavicon(canvas, linkEl, state) {
    if (state.pending) return;
    state.pending = true;

    canvas.toBlob(blob => {
        state.pending = false;
        if (!blob) return;

        const newUrl = URL.createObjectURL(blob);
        const oldUrl = linkEl.href;
        linkEl.href = newUrl;

        if (oldUrl && oldUrl.startsWith('blob:')) {
            URL.revokeObjectURL(oldUrl);
        }
    }, 'image/png');
}

/* ── Public API ── */

export function createFaviconAnimation() {
    let intervalId = null;
    let canvas = null;
    let ctx = null;
    let startTime = 0;
    const blobState = { pending: false };

    function start() {
        if (intervalId) return;

        const linkEl = document.getElementById('favicon');
        if (!linkEl) return;

        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.width = SIZE;
            canvas.height = SIZE;
            ctx = canvas.getContext('2d');
        }

        startTime = performance.now();

        function tick() {
            const elapsed = performance.now() - startTime;
            const tSec = elapsed / 1000;
            drawFrame(ctx, elapsed, getGroupRotation(elapsed), tSec);
            updateFavicon(canvas, linkEl, blobState);
        }

        tick();
        intervalId = setInterval(tick, FPS_INTERVAL);
    }

    function stop() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    }

    return { start, stop };
}
