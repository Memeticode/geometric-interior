/**
 * Geometry generators for crystalline planes.
 * - createPlaneGeometry: irregular convex polygons (legacy, standalone planes)
 * - createFaceGeometry: geometry from polyhedron face vertices with fade attribute
 */

import * as THREE from 'three';

/**
 * Create an irregular convex polygon geometry.
 * @param {number} sides - Number of sides (3–7)
 * @param {number} width - Width of the plane
 * @param {number} height - Height of the plane
 * @param {function} rng - Random number generator
 * @param {number} wobble - Vertex displacement amount (0–1)
 * @returns {THREE.BufferGeometry}
 */
export function createPlaneGeometry(sides, width, height, rng, wobble = 0.15) {
    sides = Math.max(3, Math.min(7, sides));

    const vertices = [];
    const uvs = [];

    // Generate irregular polygon vertices
    const points = [];
    for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
        const radiusX = (width / 2) * (1 + (rng() * 2 - 1) * wobble);
        const radiusY = (height / 2) * (1 + (rng() * 2 - 1) * wobble);
        points.push({
            x: Math.cos(angle) * radiusX,
            y: Math.sin(angle) * radiusY,
        });
    }

    // Fan triangulation from centroid
    const cx = points.reduce((s, p) => s + p.x, 0) / sides;
    const cy = points.reduce((s, p) => s + p.y, 0) / sides;

    for (let i = 0; i < sides; i++) {
        const p0 = points[i];
        const p1 = points[(i + 1) % sides];

        // Triangle: centroid → p0 → p1
        vertices.push(cx, cy, 0);
        vertices.push(p0.x, p0.y, 0);
        vertices.push(p1.x, p1.y, 0);

        // UVs mapped from local coords
        uvs.push(0.5 + cx / width, 0.5 + cy / height);
        uvs.push(0.5 + p0.x / width, 0.5 + p0.y / height);
        uvs.push(0.5 + p1.x / width, 0.5 + p1.y / height);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();

    return geometry;
}

/**
 * Create geometry from a polyhedron face's world-space vertices.
 * The geometry is built in local space (centered at face centroid, normal along +Z)
 * so that Three.js modelMatrix/normalMatrix handle the transform correctly.
 *
 * @param {object} face - { vertices: [v0, v1, v2], fadeValues: [f0, f1, f2], centroid, normal }
 * @returns {{ geometry: THREE.BufferGeometry, position: THREE.Vector3, quaternion: THREE.Quaternion }}
 */
export function createFaceGeometry(face) {
    const { vertices, fadeValues, centroid } = face;

    // Compute face normal from vertices
    const e1 = vertices[1].clone().sub(vertices[0]);
    const e2 = vertices[2].clone().sub(vertices[0]);
    const faceNormal = new THREE.Vector3().crossVectors(e1, e2).normalize();

    // Build quaternion that maps face normal → +Z (local space)
    const toLocalQuat = new THREE.Quaternion().setFromUnitVectors(
        faceNormal, new THREE.Vector3(0, 0, 1),
    );
    // Inverse: maps +Z back → face normal (for mesh placement)
    const toWorldQuat = toLocalQuat.clone().invert();

    // Transform vertices to local space (centered at centroid, normal along +Z)
    const localVerts = vertices.map(v => {
        const local = v.clone().sub(centroid);
        local.applyQuaternion(toLocalQuat);
        return local;
    });

    const positions = [];
    const uvs = [];
    const fades = [];

    for (let i = 0; i < 3; i++) {
        positions.push(localVerts[i].x, localVerts[i].y, localVerts[i].z);
    }

    // UV mapping: normalize local XY coordinates to [0, 1]
    const xs = localVerts.map(v => v.x);
    const ys = localVerts.map(v => v.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    for (let i = 0; i < 3; i++) {
        uvs.push(
            (localVerts[i].x - minX) / rangeX,
            (localVerts[i].y - minY) / rangeY,
        );
    }

    fades.push(fadeValues[0], fadeValues[1], fadeValues[2]);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('aFade', new THREE.Float32BufferAttribute(fades, 1));
    geometry.computeVertexNormals();

    return { geometry, position: centroid.clone(), quaternion: toWorldQuat };
}
