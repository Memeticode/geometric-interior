/**
 * Icosahedral topology — planes orient to the 20 face normals of a regular icosahedron.
 * Creates angular, faceted, architectural compositions.
 */

import * as THREE from 'three';

// 12 vertices of a regular icosahedron (unit sphere)
const PHI = (1 + Math.sqrt(5)) / 2;
const RAW_VERTS = [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
];
const VERTS = RAW_VERTS.map(v => new THREE.Vector3(...v).normalize());

// 20 triangular faces
const FACES = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

const FACE_NORMALS = FACES.map(([a, b, c]) =>
    VERTS[a].clone().add(VERTS[b]).add(VERTS[c]).divideScalar(3).normalize()
);

export function createIcosahedral({ rng, params }) {
    const range = params.depthRange * 0.9;

    return {
        samplePoint(rng) {
            // Spherical distribution within range, stretched to fill frame
            const theta = rng() * Math.PI * 2;
            const cosPhi = 2 * rng() - 1;
            const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
            const radius = range * Math.cbrt(rng()); // volume-uniform in sphere
            return new THREE.Vector3(
                Math.cos(theta) * sinPhi * radius * 1.8,
                Math.sin(theta) * sinPhi * radius * 1.2,
                cosPhi * radius * 0.8,
            );
        },

        sampleFrame(position) {
            // Find nearest icosahedral face normal
            const dir = position.lengthSq() > 1e-6
                ? position.clone().normalize()
                : new THREE.Vector3(0, 0, 1);

            let bestDot = -Infinity;
            let bestNormal = FACE_NORMALS[0];
            for (const fn of FACE_NORMALS) {
                const d = dir.dot(fn);
                if (d > bestDot) { bestDot = d; bestNormal = fn; }
            }

            // Build orthonormal frame from face normal
            const normal = bestNormal.clone();
            const up = new THREE.Vector3(0, 1, 0);
            if (Math.abs(normal.dot(up)) > 0.99) up.set(1, 0, 0);
            const tangent = new THREE.Vector3().crossVectors(up, normal).normalize();
            const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();
            return { tangent, normal, binormal };
        },

        influence(position) {
            if (position.lengthSq() < 1e-6) return 1;
            const dir = position.clone().normalize();
            let maxDot = 0;
            for (const fn of FACE_NORMALS) {
                maxDot = Math.max(maxDot, Math.abs(dir.dot(fn)));
            }
            return maxDot;
        },
    };
}
