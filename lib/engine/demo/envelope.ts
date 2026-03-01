/**
 * Envelope system — ellipsoidal SDF boundary with groove + asymmetry noise.
 */

import { Vector3 } from 'three';
import type { DivisionParams } from '../../types.js';

// Reusable temporaries for envelopeNormal (avoids 7 Vector3 allocations per call)
const _enp = new Vector3();
const _enGrad = new Vector3();

const DEFAULT_DIV: DivisionParams = {
    grooveDepth: 0.2,
    grooveWidth: 0.18,
    secondaryGrooveDepth: 0.0,
    secondaryGrooveAngle: 2.094,  // 120° in radians
    noiseAmplitude: 0.06,
};

export function envelopeSDF(p: Vector3, radii: Vector3, div: DivisionParams = DEFAULT_DIV): number {
    const ex = p.x / radii.x;
    const ey = p.y / radii.y;
    const ez = p.z / radii.z;
    const ellipsoid = ex * ex + ey * ey + ez * ez - 1.0;
    const topBias = Math.max(0, p.y / radii.y);
    // Primary groove (along x=0 plane)
    const groove = div.grooveDepth * Math.exp(-p.x * p.x / (div.grooveWidth * div.grooveWidth)) * topBias;
    // Secondary groove (rotated by secondaryGrooveAngle around y-axis)
    let secondaryGroove = 0;
    if (div.secondaryGrooveDepth > 0.001) {
        const cosA = Math.cos(div.secondaryGrooveAngle);
        const sinA = Math.sin(div.secondaryGrooveAngle);
        const rx = p.x * cosA + p.z * sinA;
        secondaryGroove = div.secondaryGrooveDepth * Math.exp(-rx * rx / (div.grooveWidth * div.grooveWidth)) * topBias;
    }
    const n = Math.sin(p.x * 1.1 + 7.3) * Math.sin(p.y * 1.3 + 2.1) * Math.sin(p.z * 0.9 + 5.7);
    return ellipsoid + groove + secondaryGroove + n * div.noiseAmplitude;
}

const _enEps = 0.01;

export function envelopeNormal(p: Vector3, radii: Vector3, div: DivisionParams = DEFAULT_DIV): Vector3 {
    _enp.set(p.x + _enEps, p.y, p.z);
    const dxp = envelopeSDF(_enp, radii, div);
    _enp.set(p.x - _enEps, p.y, p.z);
    const dxn = envelopeSDF(_enp, radii, div);
    _enp.set(p.x, p.y + _enEps, p.z);
    const dyp = envelopeSDF(_enp, radii, div);
    _enp.set(p.x, p.y - _enEps, p.z);
    const dyn = envelopeSDF(_enp, radii, div);
    _enp.set(p.x, p.y, p.z + _enEps);
    const dzp = envelopeSDF(_enp, radii, div);
    _enp.set(p.x, p.y, p.z - _enEps);
    const dzn = envelopeSDF(_enp, radii, div);
    return new Vector3(dxp - dxn, dyp - dyn, dzp - dzn).normalize();
}

export function projectToEnvelope(p: Vector3, radii: Vector3, div: DivisionParams = DEFAULT_DIV): Vector3 {
    const result = p.clone();
    for (let iter = 0; iter < 12; iter++) {
        const val = envelopeSDF(result, radii, div);
        if (Math.abs(val) < 0.001) break;
        const grad = envelopeNormal(result, radii, div);
        result.sub(grad.multiplyScalar(val));
    }
    return result;
}

export function generateSeedPoints(count: number, radii: Vector3, div: DivisionParams = DEFAULT_DIV, thetaOffset: number = 0): Vector3[] {
    const seeds: Vector3[] = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
        const y = 1 - (i / (count - 1)) * 2;
        const radius = Math.sqrt(1 - y * y);
        const theta = goldenAngle * i + thetaOffset;
        const raw = new Vector3(
            Math.cos(theta) * radius * radii.x,
            y * radii.y,
            Math.sin(theta) * radius * radii.z
        );
        seeds.push(projectToEnvelope(raw, radii, div));
    }
    return seeds;
}
