/**
 * Envelope system — ellipsoidal SDF boundary with groove + asymmetry noise.
 */

import { Vector3 } from 'three';

// Reusable temporaries for envelopeNormal (avoids 7 Vector3 allocations per call)
const _enp = new Vector3();
const _enGrad = new Vector3();

export function envelopeSDF(p: Vector3, radii: Vector3): number {
    const ex = p.x / radii.x;
    const ey = p.y / radii.y;
    const ez = p.z / radii.z;
    const ellipsoid = ex * ex + ey * ey + ez * ez - 1.0;
    const grooveDepth = 0.2;
    const grooveWidth = 0.18;
    const topBias = Math.max(0, p.y / radii.y);
    const groove = grooveDepth * Math.exp(-p.x * p.x / (grooveWidth * grooveWidth)) * topBias;
    const n = Math.sin(p.x * 1.1 + 7.3) * Math.sin(p.y * 1.3 + 2.1) * Math.sin(p.z * 0.9 + 5.7);
    return ellipsoid + groove + n * 0.06;
}

const _enEps = 0.01;

export function envelopeNormal(p: Vector3, radii: Vector3): Vector3 {
    _enp.set(p.x + _enEps, p.y, p.z);
    const dxp = envelopeSDF(_enp, radii);
    _enp.set(p.x - _enEps, p.y, p.z);
    const dxn = envelopeSDF(_enp, radii);
    _enp.set(p.x, p.y + _enEps, p.z);
    const dyp = envelopeSDF(_enp, radii);
    _enp.set(p.x, p.y - _enEps, p.z);
    const dyn = envelopeSDF(_enp, radii);
    _enp.set(p.x, p.y, p.z + _enEps);
    const dzp = envelopeSDF(_enp, radii);
    _enp.set(p.x, p.y, p.z - _enEps);
    const dzn = envelopeSDF(_enp, radii);
    return new Vector3(dxp - dxn, dyp - dyn, dzp - dzn).normalize();
}

export function projectToEnvelope(p: Vector3, radii: Vector3): Vector3 {
    const result = p.clone();
    for (let iter = 0; iter < 12; iter++) {
        const val = envelopeSDF(result, radii);
        if (Math.abs(val) < 0.001) break;
        const grad = envelopeNormal(result, radii);
        result.sub(grad.multiplyScalar(val));
    }
    return result;
}

export function generateSeedPoints(count: number, radii: Vector3): Vector3[] {
    const seeds: Vector3[] = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
        const y = 1 - (i / (count - 1)) * 2;
        const radius = Math.sqrt(1 - y * y);
        const theta = goldenAngle * i;
        const raw = new Vector3(
            Math.cos(theta) * radius * radii.x,
            y * radii.y,
            Math.sin(theta) * radius * radii.z
        );
        seeds.push(projectToEnvelope(raw, radii));
    }
    return seeds;
}
