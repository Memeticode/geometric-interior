/**
 * Hash-based 3D noise fields for chain orientation and spatial hue variation.
 * These functions are position-deterministic (no RNG needed).
 */

import * as THREE from 'three';

/**
 * Deterministic 3D hash → vec3 in [0, 1).
 */
export function hashVec(p) {
    let x = Math.sin(p.x * 127.1 + p.y * 311.7 + p.z * 74.7) * 43758.5453;
    let y = Math.sin(p.x * 269.5 + p.y * 183.3 + p.z * 246.1) * 43758.5453;
    let z = Math.sin(p.x * 419.2 + p.y * 371.9 + p.z * 128.9) * 43758.5453;
    return new THREE.Vector3(x - Math.floor(x), y - Math.floor(y), z - Math.floor(z));
}

/**
 * 3D value noise returning a normalized direction vector.
 * Used for flow-field chain orientation.
 */
export function flowFieldNormal(pos, scale = 1.5) {
    const sp = pos.clone().multiplyScalar(scale);
    const i = new THREE.Vector3(Math.floor(sp.x), Math.floor(sp.y), Math.floor(sp.z));
    const f = new THREE.Vector3(sp.x - i.x, sp.y - i.y, sp.z - i.z);
    const s = f.clone();
    s.x = f.x * f.x * (3 - 2 * f.x);
    s.y = f.y * f.y * (3 - 2 * f.y);
    s.z = f.z * f.z * (3 - 2 * f.z);

    const h000 = hashVec(i);
    const h100 = hashVec(i.clone().add(new THREE.Vector3(1, 0, 0)));
    const h010 = hashVec(i.clone().add(new THREE.Vector3(0, 1, 0)));
    const h110 = hashVec(i.clone().add(new THREE.Vector3(1, 1, 0)));
    const h001 = hashVec(i.clone().add(new THREE.Vector3(0, 0, 1)));
    const h101 = hashVec(i.clone().add(new THREE.Vector3(1, 0, 1)));
    const h011 = hashVec(i.clone().add(new THREE.Vector3(0, 1, 1)));
    const h111 = hashVec(i.clone().add(new THREE.Vector3(1, 1, 1)));

    const lerp3 = (a, b, t) => a.clone().lerp(b, t);
    const c00 = lerp3(h000, h100, s.x);
    const c10 = lerp3(h010, h110, s.x);
    const c01 = lerp3(h001, h101, s.x);
    const c11 = lerp3(h011, h111, s.x);
    const c0 = lerp3(c00, c10, s.y);
    const c1 = lerp3(c01, c11, s.y);
    const result = lerp3(c0, c1, s.z);

    return result.subScalar(0.5).normalize();
}

/**
 * Position-dependent hue field. Returns a hue value in degrees
 * centered on baseHue with spread of hueRange.
 * @param {THREE.Vector3} pos - world position
 * @param {number} scale - noise scale (default 1.2)
 * @param {number} baseHue - center hue in degrees
 * @param {number} hueRange - hue spread in degrees
 */
export function colorFieldHue(pos, scale = 1.2, baseHue = 280, hueRange = 140) {
    const sp = pos.clone().multiplyScalar(scale);
    sp.x += 73.1; sp.y += 159.4; sp.z += 213.7;

    const i = new THREE.Vector3(Math.floor(sp.x), Math.floor(sp.y), Math.floor(sp.z));
    const f = new THREE.Vector3(sp.x - i.x, sp.y - i.y, sp.z - i.z);
    f.x = f.x * f.x * (3 - 2 * f.x);
    f.y = f.y * f.y * (3 - 2 * f.y);
    f.z = f.z * f.z * (3 - 2 * f.z);

    const h = (p) => hashVec(p).x;
    const h000 = h(i);
    const h100 = h(new THREE.Vector3(i.x + 1, i.y, i.z));
    const h010 = h(new THREE.Vector3(i.x, i.y + 1, i.z));
    const h110 = h(new THREE.Vector3(i.x + 1, i.y + 1, i.z));
    const h001 = h(new THREE.Vector3(i.x, i.y, i.z + 1));
    const h101 = h(new THREE.Vector3(i.x + 1, i.y, i.z + 1));
    const h011 = h(new THREE.Vector3(i.x, i.y + 1, i.z + 1));
    const h111 = h(new THREE.Vector3(i.x + 1, i.y + 1, i.z + 1));

    const c00 = h000 + (h100 - h000) * f.x;
    const c10 = h010 + (h110 - h010) * f.x;
    const c01 = h001 + (h101 - h001) * f.x;
    const c11 = h011 + (h111 - h011) * f.x;
    const c0 = c00 + (c10 - c00) * f.y;
    const c1 = c01 + (c11 - c01) * f.y;
    const val = c0 + (c1 - c0) * f.z;

    // Contrast-enhanced mapping
    const contrasty = val < 0.5
        ? 0.5 * Math.pow(2 * val, 1.6)
        : 1 - 0.5 * Math.pow(2 * (1 - val), 1.6);

    return baseHue - hueRange / 2 + contrasty * hueRange;
}
