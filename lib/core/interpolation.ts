/**
 * Seamless animation interpolation: Catmull-Rom splines, time-warp, cosine easing.
 */

import { clamp01, lerp } from './prng.js';
import type { Controls } from '../types.js';

export const TIME_WARP_STRENGTH = 0.78;

const NUMERIC_KEYS: (keyof Controls)[] = ['density', 'luminosity', 'fracture', 'depth', 'coherence'];
const DISCRETE_KEYS: (keyof Controls)[] = ['topology', 'palette'];

export function smootherstep(t: number): number {
    t = clamp01(t);
    return t * t * t * (t * (t * 6 - 15) + 10);
}

export function warpSegmentT(t: number, strength: number): number {
    const w = smootherstep(t);
    return lerp(t, w, clamp01(strength));
}

export function cosineEase(t: number): number {
    return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

export function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
        (2 * p1) +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
}

export function evalControlsAt(tNorm: number, landmarks: Array<{ controls: Controls }>): Controls | null {
    const n = landmarks.length;
    if (n < 2) return null;

    const nearestIdx = Math.round(tNorm * n) % n;
    const discrete: Partial<Controls> = {};
    for (const key of DISCRETE_KEYS) {
        (discrete as Record<string, unknown>)[key] = landmarks[nearestIdx].controls[key];
    }

    if (n === 2) {
        const c0 = landmarks[0].controls;
        const c1 = landmarks[1].controls;

        const phase = (tNorm < 0.5) ? (tNorm * 2) : (2 - tNorm * 2);
        const warped = warpSegmentT(phase, TIME_WARP_STRENGTH * 0.55);
        const u = cosineEase(warped);

        const result = { ...discrete } as Controls;
        for (const key of NUMERIC_KEYS) {
            (result as unknown as Record<string, unknown>)[key] = lerp(c0[key] as number, c1[key] as number, u);
        }
        return result;
    }

    const seg = tNorm * n;
    const i1 = Math.floor(seg) % n;
    const tLinear = seg - Math.floor(seg);

    const t = warpSegmentT(tLinear, TIME_WARP_STRENGTH);

    const i0 = (i1 - 1 + n) % n;
    const i2 = (i1 + 1) % n;
    const i3 = (i1 + 2) % n;

    const C0 = landmarks[i0].controls;
    const C1 = landmarks[i1].controls;
    const C2 = landmarks[i2].controls;
    const C3 = landmarks[i3].controls;

    const result = { ...discrete } as Controls;
    for (const key of NUMERIC_KEYS) {
        (result as unknown as Record<string, unknown>)[key] = clamp01(
            catmullRom(C0[key] as number, C1[key] as number, C2[key] as number, C3[key] as number, t)
        );
    }
    return result;
}

export const evalAspectsAt = evalControlsAt;
