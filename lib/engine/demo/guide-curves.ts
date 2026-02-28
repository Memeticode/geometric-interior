/**
 * Guide curve generation on the envelope surface.
 */

import { Vector3, Quaternion } from 'three';
import { envelopeSDF, envelopeNormal, projectToEnvelope, generateSeedPoints } from './envelope.js';
import type { CurveSample, DivisionParams, GuideCurve } from '../../types.js';

// Reusable temporaries to reduce GC pressure in guide curve generation
const _gcAway = new Vector3();
const _gcTmp = new Vector3();
const _gcQ = new Quaternion();
const _gcNext = new Vector3();

export function generateGuideCurve(
    seed: Vector3,
    existingCurves: Vector3[][],
    maxSteps: number,
    stepSize: number,
    curvature: number,
    rng: () => number,
    radii: Vector3,
    div?: DivisionParams,
): Vector3[] {
    const points: Vector3[] = [seed.clone()];
    const normal = envelopeNormal(seed, radii, div);
    let tangent = new Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5);
    _gcTmp.copy(normal).multiplyScalar(tangent.dot(normal));
    tangent.sub(_gcTmp).normalize();

    for (let step = 0; step < maxSteps; step++) {
        const current = points[points.length - 1];
        const currentNormal = envelopeNormal(current, radii, div);

        _gcTmp.copy(currentNormal).multiplyScalar(tangent.dot(currentNormal));
        tangent.sub(_gcTmp).normalize();

        _gcQ.setFromAxisAngle(currentNormal, (rng() - 0.5) * curvature);
        tangent.applyQuaternion(_gcQ);

        const repulsion = new Vector3(0, 0, 0);
        for (const other of existingCurves) {
            for (let i = 0; i < other.length; i += 3) {
                const d = current.distanceTo(other[i]);
                if (d < 0.35 && d > 0.01) {
                    _gcAway.copy(current).sub(other[i]).normalize();
                    _gcTmp.copy(currentNormal).multiplyScalar(_gcAway.dot(currentNormal));
                    _gcAway.sub(_gcTmp);
                    repulsion.addScaledVector(_gcAway, 0.12 / (d * d));
                }
            }
        }
        for (let i = 0; i < Math.max(0, points.length - 5); i += 2) {
            const d = current.distanceTo(points[i]);
            if (d < 0.25 && d > 0.01) {
                _gcAway.copy(current).sub(points[i]).normalize();
                _gcTmp.copy(currentNormal).multiplyScalar(_gcAway.dot(currentNormal));
                _gcAway.sub(_gcTmp);
                repulsion.addScaledVector(_gcAway, 0.06 / (d * d));
            }
        }
        if (repulsion.length() > 0.001) {
            tangent.addScaledVector(repulsion.normalize(), 0.3);
            _gcTmp.copy(currentNormal).multiplyScalar(tangent.dot(currentNormal));
            tangent.sub(_gcTmp).normalize();
        }

        _gcNext.copy(current).addScaledVector(tangent, stepSize);
        const projected = projectToEnvelope(_gcNext, radii, div);
        if (envelopeSDF(projected, radii, div) > 0.05 || projected.length() > 1.8) break;
        points.push(projected);
        tangent = projected.clone().sub(current).normalize();
    }
    return points;
}

export function sampleAlongCurve(curvePoints: Vector3[], spacing: number, radii: Vector3, div?: DivisionParams): CurveSample[] {
    const samples: CurveSample[] = [];
    let accumulated = 0;
    for (let i = 1; i < curvePoints.length; i++) {
        accumulated += curvePoints[i].distanceTo(curvePoints[i - 1]);
        if (accumulated >= spacing) {
            accumulated -= spacing;
            const pos = curvePoints[i].clone();
            const prev = curvePoints[Math.max(0, i - 1)];
            const next = curvePoints[Math.min(curvePoints.length - 1, i + 1)];
            const tangent = next.clone().sub(prev).normalize();
            const normal = envelopeNormal(pos, radii, div);
            const binormal = new Vector3().crossVectors(tangent, normal).normalize();
            samples.push({ pos, tangent, normal, binormal });
        }
    }
    return samples;
}

export function drapingDirection(sample: CurveSample, spreadFactor: number, rng: () => number): Vector3 {
    const dir = sample.normal.clone().multiplyScalar(1.0 - spreadFactor)
        .add(sample.binormal.clone().multiplyScalar(spreadFactor));
    dir.add(new Vector3(
        (rng() - 0.5) * 0.2,
        (rng() - 0.5) * 0.2,
        (rng() - 0.5) * 0.2
    ));
    return dir.normalize();
}

export function generateAllGuideCurves(
    config: { primary: { seedCount: number; maxCount: number; maxSteps: number; stepSize: number; curvature: number; minLength: number }; secondary: typeof config.primary; tertiary: typeof config.primary },
    rng: () => number,
    radii: Vector3,
    div?: DivisionParams,
): GuideCurve[] {
    const allCurves: GuideCurve[] = [];

    const tiers = [
        { tier: 'primary' as const, ...config.primary },
        { tier: 'secondary' as const, ...config.secondary },
        { tier: 'tertiary' as const, ...config.tertiary },
    ];

    for (const { tier, seedCount, maxCount, maxSteps, stepSize, curvature, minLength } of tiers) {
        const seeds = generateSeedPoints(seedCount, radii, div);
        for (const seed of seeds) {
            const steps = maxSteps + Math.floor(rng() * (maxSteps * 0.5));
            const curve = generateGuideCurve(seed, allCurves, steps, stepSize, curvature, rng, radii, div) as GuideCurve;
            if (curve.length > minLength) {
                curve.tier = tier;
                allCurves.push(curve);
            }
            if (allCurves.filter(c => c.tier === tier).length >= maxCount) break;
        }
    }

    return allCurves;
}
