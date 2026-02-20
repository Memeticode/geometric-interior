/**
 * Flow field topology — planes align to a curl noise divergence-free vector field.
 * Creates organic, wind-like, streaming compositions.
 */

import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';

export function createFlowField({ rng, params }) {
    // Create seeded 3D noise function
    const noise3D = createNoise3D(rng);
    const freq = 0.25 + params.fieldFractalAmplitude * 0.5;
    const range = params.depthRange * 0.5;

    // Curl of vector potential field.
    // We use three "channels" of noise (offset in space) as the vector potential,
    // then take the curl to get a divergence-free vector field.
    function curlAt(x, y, z) {
        const eps = 0.01;
        const s = freq;

        // Channel offsets to create three independent scalar fields
        const OX = 100, OY = 200, OZ = 300;

        // ∂F3/∂y - ∂F2/∂z  (curl x-component)
        const dF3dy = (noise3D(x + OZ, (y + eps) * s, z * s) - noise3D(x + OZ, (y - eps) * s, z * s)) / (2 * eps);
        const dF2dz = (noise3D(x + OY, y * s, (z + eps) * s) - noise3D(x + OY, y * s, (z - eps) * s)) / (2 * eps);

        // ∂F1/∂z - ∂F3/∂x  (curl y-component)
        const dF1dz = (noise3D(x + OX, y * s, (z + eps) * s) - noise3D(x + OX, y * s, (z - eps) * s)) / (2 * eps);
        const dF3dx = (noise3D((x + eps) + OZ, y * s, z * s) - noise3D((x - eps) + OZ, y * s, z * s)) / (2 * eps);

        // ∂F2/∂x - ∂F1/∂y  (curl z-component)
        const dF2dx = (noise3D((x + eps) + OY, y * s, z * s) - noise3D((x - eps) + OY, y * s, z * s)) / (2 * eps);
        const dF1dy = (noise3D(x + OX, (y + eps) * s, z * s) - noise3D(x + OX, (y - eps) * s, z * s)) / (2 * eps);

        return new THREE.Vector3(
            dF3dy - dF2dz,
            dF1dz - dF3dx,
            dF2dx - dF1dy,
        );
    }

    return {
        samplePoint(rng) {
            return new THREE.Vector3(
                (rng() * 2 - 1) * range * 1.8,
                (rng() * 2 - 1) * range * 1.2,
                (rng() * 2 - 1) * range * 0.8,
            );
        },

        sampleFrame(position) {
            const curl = curlAt(position.x, position.y, position.z);
            const len = curl.length();
            const tangent = len > 1e-6 ? curl.normalize() : new THREE.Vector3(0, 0, 1);

            // Build orthonormal frame
            const up = new THREE.Vector3(0, 1, 0);
            if (Math.abs(tangent.dot(up)) > 0.99) up.set(1, 0, 0);
            const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();
            const normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();
            return { tangent, normal, binormal };
        },

        influence(position) {
            const curl = curlAt(position.x, position.y, position.z);
            return Math.min(1, curl.length() * 2);
        },
    };
}
