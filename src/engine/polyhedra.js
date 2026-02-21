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

// Precompute adjacency graph: for each shape, which faces share an edge (2+ shared vertices)
const ADJACENCY = {};
for (const [name, shape] of Object.entries(RAW_SHAPES)) {
    const adj = [];
    for (let i = 0; i < shape.faces.length; i++) {
        adj[i] = [];
        for (let j = 0; j < shape.faces.length; j++) {
            if (i === j) continue;
            const shared = shape.faces[i].filter(v => shape.faces[j].includes(v));
            if (shared.length >= 2) {
                adj[i].push({ faceIndex: j, sharedEdge: [shared[0], shared[1]] });
            }
        }
    }
    ADJACENCY[name] = adj;
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
 * Apply hinge rotation to unfold an adjacent face around the shared edge with its parent.
 * The shared edge vertices snap to match the parent's positions (for cascading unfolds),
 * then non-shared vertices rotate around the edge axis toward coplanarity.
 */
function applyUnfold(adjFace, parentFace, sharedEdge, unfoldAmount) {
    // Build parent vertex lookup: original index → current position
    const parentVertMap = {};
    for (let i = 0; i < parentFace.indices.length; i++) {
        parentVertMap[parentFace.indices[i]] = parentFace.vertices[i];
    }

    const eA = parentVertMap[sharedEdge[0]];
    const eB = parentVertMap[sharedEdge[1]];
    if (!eA || !eB) return; // shared edge vertex not in parent face

    const edgeDir = eB.clone().sub(eA).normalize();

    // Snap adjacent face's shared vertices to parent's positions
    for (let i = 0; i < adjFace.indices.length; i++) {
        if (adjFace.indices[i] === sharedEdge[0]) {
            adjFace.vertices[i] = eA.clone();
        } else if (adjFace.indices[i] === sharedEdge[1]) {
            adjFace.vertices[i] = eB.clone();
        }
    }

    // Recompute adjacent face normal from (possibly snapped) vertices
    const ae1 = adjFace.vertices[1].clone().sub(adjFace.vertices[0]);
    const ae2 = adjFace.vertices[2].clone().sub(adjFace.vertices[0]);
    adjFace.normal = new THREE.Vector3().crossVectors(ae1, ae2).normalize();

    // Project both normals onto the plane perpendicular to the edge
    const np = parentFace.normal.clone();
    const na = adjFace.normal.clone();
    const npPerp = np.clone().sub(edgeDir.clone().multiplyScalar(np.dot(edgeDir)));
    const naPerp = na.clone().sub(edgeDir.clone().multiplyScalar(na.dot(edgeDir)));

    if (npPerp.length() < 0.001 || naPerp.length() < 0.001) return;
    npPerp.normalize();
    naPerp.normalize();

    // Signed angle from adjacent normal projection to parent normal projection (around edge)
    const cosA = Math.max(-1, Math.min(1, naPerp.dot(npPerp)));
    const cross = new THREE.Vector3().crossVectors(naPerp, npPerp);
    const sinA = cross.dot(edgeDir);
    const angleToFlat = Math.atan2(sinA, cosA);

    const rotAngle = angleToFlat * unfoldAmount;
    if (Math.abs(rotAngle) < 0.001) return;

    const rotQuat = new THREE.Quaternion().setFromAxisAngle(edgeDir, rotAngle);

    // Rotate non-shared vertices around the shared edge
    for (let i = 0; i < adjFace.vertices.length; i++) {
        if (adjFace.indices[i] === sharedEdge[0] || adjFace.indices[i] === sharedEdge[1]) continue;
        const offset = adjFace.vertices[i].clone().sub(eA);
        offset.applyQuaternion(rotQuat);
        adjFace.vertices[i] = offset.add(eA);
    }

    // Recompute centroid, normal, area after rotation
    const v0 = adjFace.vertices[0], v1 = adjFace.vertices[1], v2 = adjFace.vertices[2];
    adjFace.centroid = v0.clone().add(v1).add(v2).divideScalar(3);
    const fe1 = v1.clone().sub(v0);
    const fe2 = v2.clone().sub(v0);
    adjFace.normal = new THREE.Vector3().crossVectors(fe1, fe2).normalize();
    adjFace.area = 0.5 * new THREE.Vector3().crossVectors(fe1, fe2).length();
}

/**
 * Extract adjacent faces from a polyhedron via BFS walk, with optional hinge unfolding.
 *
 * Instead of random face selection, faces are chosen by adjacency (sharing an edge),
 * creating connected clusters. When unfoldAmount > 0, faces hinge open around shared
 * edges like unfolding cardboard.
 *
 * @param {string} type - Shape type ('tetrahedron', 'octahedron', 'cube', 'icosahedron')
 * @param {THREE.Vector3} position - World-space center of the polyhedron
 * @param {THREE.Quaternion} quaternion - Orientation quaternion
 * @param {number} scale - Radius of circumscribed sphere
 * @param {function} rng - Seeded random number generator
 * @param {number} maxFaces - Maximum number of faces to keep (typically 2-4)
 * @param {number} unfoldAmount - Hinge rotation amount (0 = closed, 0.8 = nearly flat)
 * @returns {Array<{vertices: THREE.Vector3[], normal: THREE.Vector3, centroid: THREE.Vector3, fadeValues: number[], area: number}>}
 */
export function extractFaces(type, position, quaternion, scale, rng, maxFaces, unfoldAmount = 0) {
    const shape = SHAPES[type];
    if (!shape) return [];

    // Transform all vertices to world space
    const worldVerts = shape.verts.map(v =>
        v.clone().multiplyScalar(scale).applyQuaternion(quaternion).add(position)
    );

    // Build all candidate faces (each with its own cloned vertices)
    const allFaces = [];
    for (let fi = 0; fi < shape.faces.length; fi++) {
        const [a, b, c] = shape.faces[fi];
        const v0 = worldVerts[a].clone();
        const v1 = worldVerts[b].clone();
        const v2 = worldVerts[c].clone();

        const centroid = v0.clone().add(v1).add(v2).divideScalar(3);
        const edge1 = v1.clone().sub(v0);
        const edge2 = v2.clone().sub(v0);
        const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
        const area = 0.5 * new THREE.Vector3().crossVectors(edge1, edge2).length();

        allFaces.push({
            vertices: [v0, v1, v2], normal, centroid, area,
            indices: [a, b, c], faceIndex: fi,
        });
    }

    // --- BFS adjacency walk: pick seed face, then collect neighbors ---
    const adjacency = ADJACENCY[type];
    const seedIdx = Math.floor(rng() * allFaces.length);
    const kept = [allFaces[seedIdx]];
    const visited = new Set([seedIdx]);
    const queue = [seedIdx];

    while (kept.length < maxFaces && queue.length > 0) {
        const currentIdx = queue.shift();
        const neighbors = adjacency[currentIdx] || [];

        // Shuffle neighbors for variety
        const shuffled = [...neighbors];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        for (const neighbor of shuffled) {
            if (kept.length >= maxFaces) break;
            if (visited.has(neighbor.faceIndex)) continue;

            visited.add(neighbor.faceIndex);
            const adjFace = allFaces[neighbor.faceIndex];

            // Apply hinge rotation (unfolding) around the shared edge
            if (unfoldAmount > 0.01) {
                applyUnfold(adjFace, allFaces[currentIdx], neighbor.sharedEdge, unfoldAmount);
            }

            kept.push(adjFace);
            queue.push(neighbor.faceIndex);
        }
    }

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
        delete face.faceIndex;
    }

    return kept;
}
