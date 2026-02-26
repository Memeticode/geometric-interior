/**
 * Dot correspondence matching for morph transitions.
 */

import * as THREE from 'three';
import type { GlowPointDatum, DotMatching } from '../../types.js';

export function matchDots(fromDots: GlowPointDatum[], toDots: GlowPointDatum[], maxDist = 3.0): DotMatching {
    const fromIndices = fromDots.map((_, i) => i);
    fromIndices.sort((a, b) => fromDots[b].size - fromDots[a].size);

    const usedTo = new Set<number>();
    const matched: Array<{ fromIdx: number; toIdx: number }> = [];

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
    const unmatchedTo: number[] = [];
    for (let i = 0; i < toDots.length; i++) {
        if (!usedTo.has(i)) unmatchedTo.push(i);
    }

    return { matched, unmatchedFrom, unmatchedTo };
}

export function buildMorphGlowGeometry(
    fromDots: GlowPointDatum[],
    toDots: GlowPointDatum[],
    matching: DotMatching,
): THREE.BufferGeometry {
    const total = matching.matched.length + matching.unmatchedFrom.length + matching.unmatchedTo.length;

    const pos = new Float32Array(total * 3);
    const posTo = new Float32Array(total * 3);
    const size = new Float32Array(total);
    const sizeTo = new Float32Array(total);
    const matchFlag = new Float32Array(total);
    const fadeDir = new Float32Array(total);

    let idx = 0;

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
