/**
 * Envelope system — ellipsoidal SDF boundary with groove + asymmetry noise.
 * All geometry is confined within this envelope surface.
 */

import * as THREE from 'three';

/**
 * Signed distance field for the envelope surface.
 * Negative = inside, positive = outside.
 * @param {THREE.Vector3} p - query point
 * @param {THREE.Vector3} radii - ellipsoid semi-axes [x, y, z]
 */
export function envelopeSDF(p, radii) {
    const ex = p.x / radii.x;
    const ey = p.y / radii.y;
    const ez = p.z / radii.z;
    const ellipsoid = ex * ex + ey * ey + ez * ez - 1.0;
    // Gentle medial groove
    const grooveDepth = 0.2;
    const grooveWidth = 0.18;
    const topBias = Math.max(0, p.y / radii.y);
    const groove = grooveDepth * Math.exp(-p.x * p.x / (grooveWidth * grooveWidth)) * topBias;
    // Asymmetry noise
    const n = Math.sin(p.x * 1.1 + 7.3) * Math.sin(p.y * 1.3 + 2.1) * Math.sin(p.z * 0.9 + 5.7);
    return ellipsoid + groove + n * 0.06;
}

/**
 * Gradient (normal direction) of the SDF via finite differences.
 */
export function envelopeNormal(p, radii) {
    const eps = 0.01;
    const dx = envelopeSDF(new THREE.Vector3(p.x + eps, p.y, p.z), radii)
             - envelopeSDF(new THREE.Vector3(p.x - eps, p.y, p.z), radii);
    const dy = envelopeSDF(new THREE.Vector3(p.x, p.y + eps, p.z), radii)
             - envelopeSDF(new THREE.Vector3(p.x, p.y - eps, p.z), radii);
    const dz = envelopeSDF(new THREE.Vector3(p.x, p.y, p.z + eps), radii)
             - envelopeSDF(new THREE.Vector3(p.x, p.y, p.z - eps), radii);
    return new THREE.Vector3(dx, dy, dz).normalize();
}

/**
 * Project a point onto the envelope surface via iterative gradient descent.
 */
export function projectToEnvelope(p, radii) {
    const result = p.clone();
    for (let iter = 0; iter < 12; iter++) {
        const val = envelopeSDF(result, radii);
        if (Math.abs(val) < 0.001) break;
        const grad = envelopeNormal(result, radii);
        result.sub(grad.multiplyScalar(val));
    }
    return result;
}

/**
 * Generate evenly-distributed seed points on the envelope surface
 * using a golden-angle Fibonacci sphere, then projecting to the envelope.
 */
export function generateSeedPoints(count, radii) {
    const seeds = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
        const y = 1 - (i / (count - 1)) * 2;
        const radius = Math.sqrt(1 - y * y);
        const theta = goldenAngle * i;
        const raw = new THREE.Vector3(
            Math.cos(theta) * radius * radii.x,
            y * radii.y,
            Math.sin(theta) * radius * radii.z
        );
        seeds.push(projectToEnvelope(raw, radii));
    }
    return seeds;
}
