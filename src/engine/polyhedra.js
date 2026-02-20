/**
 * Polyhedra generator — creates invisible 3D shapes and extracts faces as crystal planes.
 *
 * Instead of placing random individual planes, we generate polyhedra (tetrahedra,
 * octahedra, cubes, icosahedra) at topology-driven positions and extract their
 * triangular faces as the visible crystal planes. This naturally creates connected,
 * edge-sharing crystalline structures.
 */

import * as THREE from 'three';

// --- Shape definitions (vertices on unit sphere) ---

const PHI = (1 + Math.sqrt(5)) / 2;

const RAW_SHAPES = {
    tetrahedron: {
        verts: [
            [1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1],
        ],
        faces: [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]],
    },
    octahedron: {
        verts: [
            [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
        ],
        faces: [
            [0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2],
            [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5],
        ],
    },
    cube: {
        // Cube vertices normalized to unit sphere (radius = 1)
        verts: [
            [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
            [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
        ],
        // Each quad face split into 2 triangles
        faces: [
            [0, 2, 1], [0, 3, 2],   // back
            [4, 5, 6], [4, 6, 7],   // front
            [0, 1, 5], [0, 5, 4],   // bottom
            [2, 3, 7], [2, 7, 6],   // top
            [0, 4, 7], [0, 7, 3],   // left
            [1, 2, 6], [1, 6, 5],   // right
        ],
    },
    icosahedron: {
        verts: [
            [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
            [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
            [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
        ],
        faces: [
            [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
            [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
            [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
            [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
        ],
    },
};

// Precompute: normalize all vertices to unit sphere
const SHAPES = {};
for (const [name, shape] of Object.entries(RAW_SHAPES)) {
    SHAPES[name] = {
        verts: shape.verts.map(v => new THREE.Vector3(...v).normalize()),
        faces: shape.faces,
    };
}

/**
 * Pick a shape type based on fracture level.
 * Higher fracture → more complex shapes (icosahedra, octahedra).
 * Lower fracture → simpler shapes (tetrahedra, cubes).
 */
export function pickShapeType(rng, fracture) {
    const r = rng();
    if (fracture > 0.6) {
        if (r < 0.40) return 'icosahedron';
        if (r < 0.70) return 'octahedron';
        if (r < 0.85) return 'cube';
        return 'tetrahedron';
    } else if (fracture > 0.3) {
        if (r < 0.20) return 'icosahedron';
        if (r < 0.45) return 'octahedron';
        if (r < 0.70) return 'cube';
        return 'tetrahedron';
    } else {
        if (r < 0.10) return 'icosahedron';
        if (r < 0.30) return 'octahedron';
        if (r < 0.60) return 'cube';
        return 'tetrahedron';
    }
}

/**
 * Extract a limited number of visible faces from a polyhedron.
 * Only 2-3 faces are shown per shape, creating an open crystalline fracture effect
 * where light can diffuse through the gaps between visible faces.
 *
 * @param {string} type - Shape type ('tetrahedron', 'octahedron', 'cube', 'icosahedron')
 * @param {THREE.Vector3} position - World-space center of the polyhedron
 * @param {THREE.Quaternion} quaternion - Orientation quaternion
 * @param {number} scale - Radius of circumscribed sphere
 * @param {function} rng - Seeded random number generator
 * @param {number} maxFaces - Maximum number of faces to keep (typically 2-3)
 * @returns {Array<{vertices: THREE.Vector3[], normal: THREE.Vector3, centroid: THREE.Vector3, fadeValues: number[], area: number}>}
 */
export function extractFaces(type, position, quaternion, scale, rng, maxFaces) {
    const shape = SHAPES[type];
    if (!shape) return [];

    // Transform all vertices to world space
    const worldVerts = shape.verts.map(v =>
        v.clone().multiplyScalar(scale).applyQuaternion(quaternion).add(position)
    );

    // Build all candidate faces
    const allFaces = [];
    for (const [a, b, c] of shape.faces) {
        const v0 = worldVerts[a].clone();
        const v1 = worldVerts[b].clone();
        const v2 = worldVerts[c].clone();

        const centroid = v0.clone().add(v1).add(v2).divideScalar(3);

        const edge1 = v1.clone().sub(v0);
        const edge2 = v2.clone().sub(v0);
        const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

        const area = 0.5 * new THREE.Vector3().crossVectors(
            v1.clone().sub(v0), v2.clone().sub(v0)
        ).length();

        allFaces.push({ vertices: [v0, v1, v2], normal, centroid, area, indices: [a, b, c] });
    }

    // Fisher-Yates shuffle, then take the first maxFaces
    for (let i = allFaces.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [allFaces[i], allFaces[j]] = [allFaces[j], allFaces[i]];
    }

    const kept = allFaces.slice(0, Math.min(maxFaces, allFaces.length));

    // Add fade values to each kept face
    for (const face of kept) {
        const fadeType = rng();
        if (fadeType < 0.3) {
            face.fadeValues = [1.0, 1.0, 1.0];
        } else if (fadeType < 0.65) {
            const bright = Math.floor(rng() * 3);
            face.fadeValues = [
                0.25 + rng() * 0.4,
                0.25 + rng() * 0.4,
                0.25 + rng() * 0.4,
            ];
            face.fadeValues[bright] = 0.85 + rng() * 0.15;
        } else {
            const dim = Math.floor(rng() * 3);
            face.fadeValues = [
                0.8 + rng() * 0.2,
                0.8 + rng() * 0.2,
                0.8 + rng() * 0.2,
            ];
            face.fadeValues[dim] = 0.1 + rng() * 0.3;
        }
        delete face.indices;
    }

    return kept;
}
