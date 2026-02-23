/**
 * Guide curve generation on the envelope surface.
 * Curves are generated in 3 tiers (primary/secondary/tertiary) with
 * inter-curve repulsion to prevent clustering.
 */

import * as THREE from 'three';
import { envelopeSDF, envelopeNormal, projectToEnvelope, generateSeedPoints } from './envelope.js';

/**
 * Generate a single guide curve along the envelope surface.
 * @param {THREE.Vector3} seed - starting point on envelope
 * @param {Array} existingCurves - previously generated curves (for repulsion)
 * @param {number} maxSteps - max marching steps
 * @param {number} stepSize - distance per step
 * @param {number} curvature - random turning amount
 * @param {Function} rng - seeded random [0, 1)
 * @param {THREE.Vector3} radii - envelope radii
 * @returns {THREE.Vector3[]} array of curve points
 */
export function generateGuideCurve(seed, existingCurves, maxSteps, stepSize, curvature, rng, radii) {
    const points = [seed.clone()];
    const normal = envelopeNormal(seed, radii);
    let tangent = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5);
    tangent.sub(normal.clone().multiplyScalar(tangent.dot(normal))).normalize();

    for (let step = 0; step < maxSteps; step++) {
        const current = points[points.length - 1];
        const currentNormal = envelopeNormal(current, radii);

        // Project tangent onto tangent plane
        tangent.sub(currentNormal.clone().multiplyScalar(tangent.dot(currentNormal))).normalize();

        // Random curvature
        const q = new THREE.Quaternion().setFromAxisAngle(currentNormal, (rng() - 0.5) * curvature);
        tangent.applyQuaternion(q);

        // Repulsion from other curves
        const repulsion = new THREE.Vector3();
        for (const other of existingCurves) {
            for (let i = 0; i < other.length; i += 3) {
                const d = current.distanceTo(other[i]);
                if (d < 0.35 && d > 0.01) {
                    const away = current.clone().sub(other[i]).normalize();
                    away.sub(currentNormal.clone().multiplyScalar(away.dot(currentNormal)));
                    repulsion.add(away.multiplyScalar(0.12 / (d * d)));
                }
            }
        }
        // Self-repulsion
        for (let i = 0; i < Math.max(0, points.length - 5); i += 2) {
            const d = current.distanceTo(points[i]);
            if (d < 0.25 && d > 0.01) {
                const away = current.clone().sub(points[i]).normalize();
                away.sub(currentNormal.clone().multiplyScalar(away.dot(currentNormal)));
                repulsion.add(away.multiplyScalar(0.06 / (d * d)));
            }
        }
        if (repulsion.length() > 0.001) {
            tangent.add(repulsion.normalize().multiplyScalar(0.3));
            tangent.sub(currentNormal.clone().multiplyScalar(tangent.dot(currentNormal))).normalize();
        }

        const next = current.clone().add(tangent.clone().multiplyScalar(stepSize));
        const projected = projectToEnvelope(next, radii);
        if (envelopeSDF(projected, radii) > 0.05 || projected.length() > 1.8) break;
        points.push(projected);
        tangent = projected.clone().sub(current).normalize();
    }
    return points;
}

/**
 * Sample positions along a curve at regular spacing, computing
 * tangent/normal/binormal frames at each sample.
 */
export function sampleAlongCurve(curvePoints, spacing, radii) {
    const samples = [];
    let accumulated = 0;
    for (let i = 1; i < curvePoints.length; i++) {
        accumulated += curvePoints[i].distanceTo(curvePoints[i - 1]);
        if (accumulated >= spacing) {
            accumulated -= spacing;
            const pos = curvePoints[i].clone();
            const prev = curvePoints[Math.max(0, i - 1)];
            const next = curvePoints[Math.min(curvePoints.length - 1, i + 1)];
            const tangent = next.clone().sub(prev).normalize();
            const normal = envelopeNormal(pos, radii);
            const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
            samples.push({ pos, tangent, normal, binormal });
        }
    }
    return samples;
}

/**
 * Compute a draping direction from a curve sample frame.
 */
export function drapingDirection(sample, spreadFactor, rng) {
    const dir = sample.normal.clone().multiplyScalar(1.0 - spreadFactor)
        .add(sample.binormal.clone().multiplyScalar(spreadFactor));
    dir.add(new THREE.Vector3(
        (rng() - 0.5) * 0.2,
        (rng() - 0.5) * 0.2,
        (rng() - 0.5) * 0.2
    ));
    return dir.normalize();
}

/**
 * Generate all guide curves in 3 tiers.
 * @param {object} config - { primary, secondary, tertiary } with seedCount, maxCount, maxSteps, stepSize, curvature, minLength
 * @param {Function} rng - seeded random
 * @param {THREE.Vector3} radii - envelope radii
 */
export function generateAllGuideCurves(config, rng, radii) {
    const allCurves = [];

    const tiers = [
        { tier: 'primary', ...config.primary },
        { tier: 'secondary', ...config.secondary },
        { tier: 'tertiary', ...config.tertiary },
    ];

    for (const { tier, seedCount, maxCount, maxSteps, stepSize, curvature, minLength } of tiers) {
        const seeds = generateSeedPoints(seedCount, radii);
        for (const seed of seeds) {
            const steps = maxSteps + Math.floor(rng() * (maxSteps * 0.5));
            const curve = generateGuideCurve(seed, allCurves, steps, stepSize, curvature, rng, radii);
            if (curve.length > minLength) {
                curve.tier = tier;
                allCurves.push(curve);
            }
            if (allCurves.filter(c => c.tier === tier).length >= maxCount) break;
        }
    }

    return allCurves;
}
