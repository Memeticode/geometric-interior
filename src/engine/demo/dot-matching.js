/**
 * Dot correspondence matching for morph transitions.
 *
 * Greedy nearest-neighbor matching (size-prioritized):
 * large prominent dots are matched first, then smaller ones.
 * Unmatched dots fade in/out during the morph.
 */

import * as THREE from 'three';

/**
 * Match dots between two scenes using greedy nearest-neighbor.
 *
 * @param {Array<{position: THREE.Vector3, size: number}>} fromDots
 * @param {Array<{position: THREE.Vector3, size: number}>} toDots
 * @param {number} [maxDist=3.0] - Maximum distance for a valid match
 * @returns {{ matched: Array<{fromIdx: number, toIdx: number}>, unmatchedFrom: number[], unmatchedTo: number[] }}
 */
export function matchDots(fromDots, toDots, maxDist = 3.0) {
    // Sort from-dots by size descending (match big dots first)
    const fromIndices = fromDots.map((_, i) => i);
    fromIndices.sort((a, b) => fromDots[b].size - fromDots[a].size);

    const usedTo = new Set();
    const matched = [];

    for (const fi of fromIndices) {
        const fp = fromDots[fi].position;
        let bestDist = maxDist;
        let bestTi = -1;

        for (let ti = 0; ti < toDots.length; ti++) {
            if (usedTo.has(ti)) continue;
            const d = fp.distanceTo(toDots[ti].position);
            if (d < bestDist) {
                bestDist = d;
                bestTi = ti;
            }
        }

        if (bestTi >= 0) {
            matched.push({ fromIdx: fi, toIdx: bestTi });
            usedTo.add(bestTi);
        }
    }

    const matchedFrom = new Set(matched.map(m => m.fromIdx));
    const unmatchedFrom = fromIndices.filter(i => !matchedFrom.has(i));
    const unmatchedTo = [];
    for (let i = 0; i < toDots.length; i++) {
        if (!usedTo.has(i)) unmatchedTo.push(i);
    }

    return { matched, unmatchedFrom, unmatchedTo };
}

/**
 * Build a single THREE.Points geometry for morph transitions.
 *
 * Buffer attributes:
 *   position(3)    - from position (or to position for spawning dots)
 *   aPosTo(3)      - target position (or same as position for dying/spawning)
 *   aSize(1)       - from size
 *   aSizeTo(1)     - target size
 *   aMatchFlag(1)  - 1.0 for matched dots, 0.0 for unmatched
 *   aFadeDir(1)    - 0.0 matched, -1.0 dying (fade out), +1.0 spawning (fade in)
 *
 * @param {Array<{position: THREE.Vector3, size: number}>} fromDots
 * @param {Array<{position: THREE.Vector3, size: number}>} toDots
 * @param {{ matched, unmatchedFrom, unmatchedTo }} matching
 * @returns {THREE.BufferGeometry}
 */
export function buildMorphGlowGeometry(fromDots, toDots, matching) {
    const total = matching.matched.length + matching.unmatchedFrom.length + matching.unmatchedTo.length;

    const pos = new Float32Array(total * 3);
    const posTo = new Float32Array(total * 3);
    const size = new Float32Array(total);
    const sizeTo = new Float32Array(total);
    const matchFlag = new Float32Array(total);
    const fadeDir = new Float32Array(total);

    let idx = 0;

    // Matched dots: interpolate from→to
    for (const { fromIdx, toIdx } of matching.matched) {
        const fp = fromDots[fromIdx].position;
        const tp = toDots[toIdx].position;
        pos[idx * 3] = fp.x;
        pos[idx * 3 + 1] = fp.y;
        pos[idx * 3 + 2] = fp.z;
        posTo[idx * 3] = tp.x;
        posTo[idx * 3 + 1] = tp.y;
        posTo[idx * 3 + 2] = tp.z;
        size[idx] = fromDots[fromIdx].size;
        sizeTo[idx] = toDots[toIdx].size;
        matchFlag[idx] = 1.0;
        fadeDir[idx] = 0.0;
        idx++;
    }

    // Unmatched from: fade out (dying)
    for (const fi of matching.unmatchedFrom) {
        const fp = fromDots[fi].position;
        pos[idx * 3] = fp.x;
        pos[idx * 3 + 1] = fp.y;
        pos[idx * 3 + 2] = fp.z;
        posTo[idx * 3] = fp.x;
        posTo[idx * 3 + 1] = fp.y;
        posTo[idx * 3 + 2] = fp.z;
        size[idx] = fromDots[fi].size;
        sizeTo[idx] = fromDots[fi].size;
        matchFlag[idx] = 0.0;
        fadeDir[idx] = -1.0;
        idx++;
    }

    // Unmatched to: fade in (spawning)
    for (const ti of matching.unmatchedTo) {
        const tp = toDots[ti].position;
        pos[idx * 3] = tp.x;
        pos[idx * 3 + 1] = tp.y;
        pos[idx * 3 + 2] = tp.z;
        posTo[idx * 3] = tp.x;
        posTo[idx * 3 + 1] = tp.y;
        posTo[idx * 3 + 2] = tp.z;
        size[idx] = toDots[ti].size;
        sizeTo[idx] = toDots[ti].size;
        matchFlag[idx] = 0.0;
        fadeDir[idx] = 1.0;
        idx++;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('aPosTo', new THREE.BufferAttribute(posTo, 3));
    geom.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geom.setAttribute('aSizeTo', new THREE.BufferAttribute(sizeTo, 1));
    geom.setAttribute('aMatchFlag', new THREE.BufferAttribute(matchFlag, 1));
    geom.setAttribute('aFadeDir', new THREE.BufferAttribute(fadeDir, 1));

    return geom;
}
