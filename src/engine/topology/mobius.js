/**
 * Möbius manifold topology — planes spawn along a half-twisted parametric ribbon.
 * Creates flowing, continuous, layered compositions.
 */

import * as THREE from 'three';

export function createMobius({ rng, params }) {
    const scale = params.depthRange * 0.3;
    const halfWidth = 0.7;

    function evaluate(u, v) {
        const cu = Math.cos(u), su = Math.sin(u);
        const cu2 = Math.cos(u / 2), su2 = Math.sin(u / 2);
        return new THREE.Vector3(
            (1 + v * 0.5 * cu2) * cu * scale,
            (1 + v * 0.5 * cu2) * su * scale,
            v * 0.5 * su2 * scale,
        );
    }

    function centerline(u) {
        return evaluate(u, 0);
    }

    function frenetFrame(u) {
        const eps = 0.001;
        const p0 = centerline(u - eps);
        const p1 = centerline(u + eps);
        const tangent = p1.clone().sub(p0).normalize();

        // Second derivative for normal
        const p2 = centerline(u - 2 * eps);
        const p3 = centerline(u + 2 * eps);
        const accel = p3.clone().sub(p1.clone().multiplyScalar(2)).add(p0);
        const normal = accel.clone()
            .sub(tangent.clone().multiplyScalar(tangent.dot(accel)))
            .normalize();

        // Handle degenerate case
        if (normal.lengthSq() < 0.01) {
            const up = new THREE.Vector3(0, 1, 0);
            if (Math.abs(tangent.dot(up)) > 0.99) up.set(1, 0, 0);
            normal.crossVectors(tangent, up).normalize();
        }

        const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
        return { tangent, normal, binormal };
    }

    // Precompute centerline samples for fast closest-point lookup
    const SAMPLES = 64;
    const centerlineSamples = [];
    for (let i = 0; i < SAMPLES; i++) {
        const u = (i / SAMPLES) * Math.PI * 2;
        centerlineSamples.push({ u, pos: centerline(u) });
    }

    function closestU(position) {
        let bestU = 0, bestDist = Infinity;
        for (const s of centerlineSamples) {
            const d = position.distanceToSquared(s.pos);
            if (d < bestDist) { bestDist = d; bestU = s.u; }
        }
        return bestU;
    }

    return {
        samplePoint(rng) {
            const u = rng() * Math.PI * 2;
            const v = (rng() * 2 - 1) * halfWidth;
            return evaluate(u, v);
        },

        sampleFrame(position) {
            return frenetFrame(closestU(position));
        },

        influence(position) {
            const u = closestU(position);
            const center = centerline(u);
            const dist = position.distanceTo(center);
            return Math.exp(-dist / (scale * 0.5));
        },
    };
}
