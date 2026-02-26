/**
 * Folding chain plane generation — connected triangles/quads with
 * dihedral folding along shared edges.
 *
 * Performance-optimized: no per-plane BufferGeometry or EdgesGeometry creation.
 * All geometry is accumulated directly into flat arrays.
 */

import * as THREE from 'three';
import type { BatchAccumulators, DotPosition } from '../../types.js';

export function createAccumulators(): BatchAccumulators {
    return {
        faceAccum: { pos: [], norm: [], uv: [], alpha: [], color: [], opacity: [], noiseScale: [], noiseStrength: [], crackExtend: [], foldDelay: [], foldOrigin: [] },
        edgeAccum: { pos: [], alpha: [], color: [], opacity: [], foldDelay: [], foldOrigin: [] },
    };
}

function computeIllumination(worldPos: THREE.Vector3, lightPositions: DotPosition[]): number {
    let total = 0;
    for (const lp of lightPositions) {
        const d2 = worldPos.distanceToSquared(lp.pos);
        total += lp.intensity / (1 + d2 * 10);
    }
    return Math.min(total, 3.0);
}

function computeFade(dist: number, decayRate: number): number {
    return Math.exp(-decayRate * dist * dist);
}

// Reusable temporaries to reduce GC pressure in hot loops
const _wp = new THREE.Vector3();

function vertexAlpha(worldPos: THREE.Vector3, lightPositions: DotPosition[] | null): number {
    const d = worldPos.length();
    const radial = Math.exp(-1.5 * d * d);
    const illum = lightPositions ? computeIllumination(worldPos, lightPositions) : 0;
    return radial * (1.0 + illum * 2.5);
}

const _rotQ = new THREE.Quaternion();

function rotateAround(point: THREE.Vector3, axis: THREE.Vector3, angle: number): THREE.Vector3 {
    _rotQ.setFromAxisAngle(axis, angle);
    return point.clone().applyQuaternion(_rotQ);
}

function jitterVec(v: THREE.Vector3, amount: number, rng: () => number): THREE.Vector3 {
    return new THREE.Vector3(
        v.x + (rng() - 0.5) * amount,
        v.y + (rng() - 0.5) * amount,
        v.z + (rng() - 0.5) * amount,
    );
}

const _toP = new THREE.Vector3();
const _proj = new THREE.Vector3();
const _reflResult = new THREE.Vector3();

function reflectAcrossEdge(point: THREE.Vector3, linePoint: THREE.Vector3, lineDir: THREE.Vector3): THREE.Vector3 {
    _toP.copy(point).sub(linePoint);
    const dotVal = _toP.dot(lineDir);
    _proj.copy(lineDir).multiplyScalar(dotVal);
    // result = linePoint + proj - (toP - proj) = linePoint + 2*proj - toP
    _reflResult.copy(linePoint).add(_proj).add(_proj).sub(_toP).sub(linePoint).add(linePoint);
    // Simpler: result = linePoint + proj - perp where perp = toP - proj
    // result = linePoint + proj - toP + proj = linePoint + 2*proj - toP
    _reflResult.set(
        linePoint.x + 2 * _proj.x - _toP.x,
        linePoint.y + 2 * _proj.y - _toP.y,
        linePoint.z + 2 * _proj.z - _toP.z,
    );
    // But the original returned linePoint + proj - perp = linePoint + proj - (toP - proj) = linePoint + 2*proj - toP
    // Hmm wait. Let me re-derive.
    // toP = point - linePoint
    // proj = lineDir * dot(toP, lineDir)
    // perp = toP - proj
    // result = linePoint + proj - perp = linePoint + proj - toP + proj = linePoint + 2*proj - toP
    return _reflResult.clone();
}

// Reusable temp vectors for accumulatePlane/accumulateSkirt
const _tmpV = new THREE.Vector3();
const _tmpN = new THREE.Vector3();

/**
 * Triangle boundary edge pairs (vertex indices).
 * Triangle layout: v0, v1, v2 → all 3 edges are boundary.
 */
const TRI_EDGES: [number, number][] = [[0, 1], [1, 2], [2, 0]];

/**
 * Quad boundary edge pairs (vertex indices).
 * Quad layout: [A(0), B(1), C(2), A(3), D(4), B(5)] → 2 triangles sharing edge A-B.
 * Boundary edges: B-C, C-A, A-D, D-B.
 */
const QUAD_EDGES: [number, number][] = [[1, 2], [2, 0], [3, 4], [4, 5]];

/**
 * Accumulate a plane's face and edge data directly from raw vertex data.
 * Replaces the old version that required BufferGeometry + EdgesGeometry.
 */
function accumulatePlane(
    accum: BatchAccumulators,
    positions: number[],      // flat [x,y,z, ...] — 3 or 6 vertices
    uvs: number[],            // flat [u,v, ...]
    nx: number, ny: number, nz: number,  // face normal
    vertCount: number,        // 3 (tri) or 6 (quad)
    color: THREE.Color,
    baseOpacity: number,
    edgeOpacity: number,
    alphas: number[],
    noiseScale: number,
    noiseStrength: number,
    edgeColorOffset: [number, number, number],
    worldQuat: THREE.Quaternion | null,
    worldOrigin: THREE.Vector3 | null,
    chainProgress: number,
    chainOriginWorld: THREE.Vector3,
): void {
    const { faceAccum, edgeAccum } = accum;
    const eColor = color.clone().offsetHSL(edgeColorOffset[0], edgeColorOffset[1], edgeColorOffset[2]);

    // Push face vertices
    for (let i = 0; i < vertCount; i++) {
        const off = i * 3;
        _tmpV.set(positions[off], positions[off + 1], positions[off + 2]);
        _tmpN.set(nx, ny, nz);
        if (worldQuat) {
            _tmpV.applyQuaternion(worldQuat);
            _tmpN.applyQuaternion(worldQuat);
        }
        if (worldOrigin) _tmpV.add(worldOrigin);

        faceAccum.pos.push(_tmpV.x, _tmpV.y, _tmpV.z);
        faceAccum.norm.push(_tmpN.x, _tmpN.y, _tmpN.z);
        faceAccum.uv.push(uvs[i * 2], uvs[i * 2 + 1]);
        faceAccum.alpha.push(alphas[i]);
        faceAccum.color.push(color.r, color.g, color.b);
        faceAccum.opacity.push(baseOpacity);
        faceAccum.noiseScale.push(noiseScale);
        faceAccum.noiseStrength.push(noiseStrength);
        faceAccum.crackExtend.push(1.0);
        faceAccum.foldDelay.push(chainProgress);
        faceAccum.foldOrigin.push(chainOriginWorld.x, chainOriginWorld.y, chainOriginWorld.z);
    }

    // Push edge line segments — computed directly from known topology
    const edgePairs = vertCount === 3 ? TRI_EDGES : QUAD_EDGES;
    for (const [a, b] of edgePairs) {
        // Vertex a
        _tmpV.set(positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2]);
        if (worldQuat) _tmpV.applyQuaternion(worldQuat);
        if (worldOrigin) _tmpV.add(worldOrigin);
        edgeAccum.pos.push(_tmpV.x, _tmpV.y, _tmpV.z);
        edgeAccum.alpha.push(alphas[a]);
        edgeAccum.color.push(eColor.r, eColor.g, eColor.b);
        edgeAccum.opacity.push(edgeOpacity);
        edgeAccum.foldDelay.push(chainProgress);
        edgeAccum.foldOrigin.push(chainOriginWorld.x, chainOriginWorld.y, chainOriginWorld.z);

        // Vertex b
        _tmpV.set(positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2]);
        if (worldQuat) _tmpV.applyQuaternion(worldQuat);
        if (worldOrigin) _tmpV.add(worldOrigin);
        edgeAccum.pos.push(_tmpV.x, _tmpV.y, _tmpV.z);
        edgeAccum.alpha.push(alphas[b]);
        edgeAccum.color.push(eColor.r, eColor.g, eColor.b);
        edgeAccum.opacity.push(edgeOpacity);
        edgeAccum.foldDelay.push(chainProgress);
        edgeAccum.foldOrigin.push(chainOriginWorld.x, chainOriginWorld.y, chainOriginWorld.z);
    }
}

/**
 * Accumulate skirt geometry around a plane's boundary.
 * Works with raw vertex data instead of BufferGeometry.
 */
function accumulateSkirt(
    accum: BatchAccumulators,
    positions: number[],        // flat [x,y,z, ...]
    uvs: number[],              // flat [u,v, ...]
    nx: number, ny: number, nz: number,  // face normal
    vertCount: number,          // 3 or 6
    boundaryIndices: number[],  // indices of boundary vertices (3 or 4)
    color: THREE.Color,
    baseOpacity: number,
    alphas: number[],
    noiseScale: number,
    noiseStrength: number,
    crackExtendScale: number,
    worldQuat: THREE.Quaternion | null,
    worldOrigin: THREE.Vector3 | null,
    chainProgress: number,
    chainOriginWorld: THREE.Vector3,
    chainLength: number,
): void {
    const { faceAccum } = accum;
    const scale = crackExtendScale;
    const n = boundaryIndices.length;

    // Compute centroid of boundary vertices
    let cx = 0, cy = 0, cz = 0, cu = 0, cv = 0;
    for (let i = 0; i < n; i++) {
        const idx = boundaryIndices[i];
        cx += positions[idx * 3];
        cy += positions[idx * 3 + 1];
        cz += positions[idx * 3 + 2];
        cu += uvs[idx * 2];
        cv += uvs[idx * 2 + 1];
    }
    cx /= n; cy /= n; cz /= n; cu /= n; cv /= n;

    // Compute expanded (scaled) positions and UVs for each boundary vertex
    const expPos: number[] = new Array(n * 3);
    const expUvs: number[] = new Array(n * 2);
    for (let i = 0; i < n; i++) {
        const idx = boundaryIndices[i];
        const px = positions[idx * 3], py = positions[idx * 3 + 1], pz = positions[idx * 3 + 2];
        expPos[i * 3] = cx + (px - cx) * scale;
        expPos[i * 3 + 1] = cy + (py - cy) * scale;
        expPos[i * 3 + 2] = cz + (pz - cz) * scale;
        const pu = uvs[idx * 2], ppv = uvs[idx * 2 + 1];
        expUvs[i * 2] = cu + (pu - cu) * scale;
        expUvs[i * 2 + 1] = cv + (ppv - cv) * scale;
    }

    // Emit skirt triangles between boundary and expanded vertices
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const idxI = boundaryIndices[i];
        const idxJ = boundaryIndices[j];

        // Two triangles per edge: (bI, bJ, eJ) and (bI, eJ, eI)
        const triVerts = [
            positions[idxI * 3], positions[idxI * 3 + 1], positions[idxI * 3 + 2],
            positions[idxJ * 3], positions[idxJ * 3 + 1], positions[idxJ * 3 + 2],
            expPos[j * 3], expPos[j * 3 + 1], expPos[j * 3 + 2],
            positions[idxI * 3], positions[idxI * 3 + 1], positions[idxI * 3 + 2],
            expPos[j * 3], expPos[j * 3 + 1], expPos[j * 3 + 2],
            expPos[i * 3], expPos[i * 3 + 1], expPos[i * 3 + 2],
        ];
        const triUvs = [
            uvs[idxI * 2], uvs[idxI * 2 + 1],
            uvs[idxJ * 2], uvs[idxJ * 2 + 1],
            expUvs[j * 2], expUvs[j * 2 + 1],
            uvs[idxI * 2], uvs[idxI * 2 + 1],
            expUvs[j * 2], expUvs[j * 2 + 1],
            expUvs[i * 2], expUvs[i * 2 + 1],
        ];
        const triAlphas = [alphas[idxI], alphas[idxJ], alphas[idxJ], alphas[idxI], alphas[idxJ], alphas[idxI]];
        const triCrackExtend = [1.0, 1.0, 0.0, 1.0, 0.0, 0.0];

        for (let k = 0; k < 6; k++) {
            _tmpV.set(triVerts[k * 3], triVerts[k * 3 + 1], triVerts[k * 3 + 2]);
            _tmpN.set(nx, ny, nz);
            if (worldQuat) { _tmpV.applyQuaternion(worldQuat); _tmpN.applyQuaternion(worldQuat); }
            if (worldOrigin) _tmpV.add(worldOrigin);

            faceAccum.pos.push(_tmpV.x, _tmpV.y, _tmpV.z);
            faceAccum.norm.push(_tmpN.x, _tmpN.y, _tmpN.z);
            faceAccum.uv.push(triUvs[k * 2], triUvs[k * 2 + 1]);
            faceAccum.alpha.push(triAlphas[k]);
            faceAccum.color.push(color.r, color.g, color.b);
            faceAccum.opacity.push(baseOpacity);
            faceAccum.noiseScale.push(noiseScale);
            faceAccum.noiseStrength.push(noiseStrength);
            faceAccum.crackExtend.push(triCrackExtend[k]);
            // Skirt outer vertices get slightly higher fold delay
            const isOuter = triCrackExtend[k] < 0.5;
            faceAccum.foldDelay.push(isOuter ? chainProgress + 0.3 / Math.max(chainLength, 1) : chainProgress);
            faceAccum.foldOrigin.push(chainOriginWorld.x, chainOriginWorld.y, chainOriginWorld.z);
        }
    }
}

/**
 * Compute face normal from first triangle's vertices via cross product.
 * Returns [nx, ny, nz] (normalized).
 */
function computeNormal(positions: number[]): [number, number, number] {
    const e1x = positions[3] - positions[0];
    const e1y = positions[4] - positions[1];
    const e1z = positions[5] - positions[2];
    const e2x = positions[6] - positions[0];
    const e2y = positions[7] - positions[1];
    const e2z = positions[8] - positions[2];
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 0) { nx /= len; ny /= len; nz /= len; }
    return [nx, ny, nz];
}

interface ChainConfig {
    edgeColorOffset: [number, number, number];
    edgeOpacityBase: number;
    edgeOpacityFadeScale: number;
    crackExtendScale: number;
}

// Triangle UVs (constant)
const TRI_UVS = [0, 0, 1, 0, 0.5, 1];
// Quad UVs (constant) — 2 triangles
const QUAD_UVS = [0, 0.5, 1, 0.5, 0.5, 1, 0, 0.5, 0.5, 0, 1, 0.5];
// Boundary vertex indices for skirt
const TRI_BOUNDARY = [0, 1, 2];
const QUAD_BOUNDARY = [0, 4, 1, 2]; // A, D, B, C

export function createFoldingChain(
    accum: BatchAccumulators,
    origin: THREE.Vector3,
    chainLength: number,
    planeScale: number,
    distFromCenter: number,
    lightPositions: DotPosition[],
    config: ChainConfig,
    rng: () => number,
    pickColorFn: (distFromCenter: number, decayRate: number, lightnessBoost: number, familyHue: number | null) => THREE.Color,
    familyHue: number | null,
    tendrilDir: THREE.Vector3 | null,
): void {
    const decayRate = 0.15 + rng() * 0.45;
    const jitterAmt = planeScale * 0.015;

    let groupQuat: THREE.Quaternion;
    if (tendrilDir) {
        const forward = tendrilDir.clone().normalize();
        const up = Math.abs(forward.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
        const mat = new THREE.Matrix4().lookAt(new THREE.Vector3(), forward, up);
        groupQuat = new THREE.Quaternion().setFromRotationMatrix(mat);
        const twist = new THREE.Quaternion().setFromAxisAngle(forward, (rng() - 0.5) * Math.PI * 0.5);
        groupQuat.premultiply(twist);
        const wobbleAxis = up.clone().cross(forward).normalize();
        const wobble = new THREE.Quaternion().setFromAxisAngle(wobbleAxis, (rng() - 0.5) * Math.PI * 0.18);
        groupQuat.premultiply(wobble);
    } else {
        groupQuat = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2));
    }

    const randVec = () => new THREE.Vector3(
        (rng() - 0.5), (rng() - 0.5), (rng() - 0.5)
    ).normalize().multiplyScalar(planeScale * (0.3 + rng() * 0.4));

    let vA = randVec();
    let vB = randVec();
    let vC = randVec();

    for (let p = 0; p < chainLength; p++) {
        const chainProgress = p / Math.max(chainLength - 1, 1);
        const progressFade = 1.0 - chainProgress * 0.7;
        const thisFade = computeFade(distFromCenter, decayRate) * progressFade;

        // Compute world center for illumination
        _wp.set(
            (vA.x + vB.x + vC.x) / 3,
            (vA.y + vB.y + vC.y) / 3,
            (vA.z + vB.z + vC.z) / 3,
        ).applyQuaternion(groupQuat).add(origin);
        const illum = lightPositions ? computeIllumination(_wp, lightPositions) : 0;

        const color = pickColorFn(distFromCenter + p * 0.1, decayRate, illum * 0.15, familyHue);
        const baseOpacity = (0.008 + thisFade * 0.04) * (0.4 + rng() * 0.6);
        const edgeFade = thisFade * thisFade;
        const baseEdgeOpacity = (config.edgeOpacityBase + edgeFade * config.edgeOpacityFadeScale) * (0.3 + rng() * 0.7);

        // Compute vertex alpha using world-space position
        const vAlphaFn = (lv: THREE.Vector3): number => {
            _wp.copy(lv).applyQuaternion(groupQuat).add(origin);
            return vertexAlpha(_wp, lightPositions);
        };

        const makeQuad = rng() < 0.7;
        const ns = 6 + rng() * 8;
        const nst = 0.15 + rng() * 0.35;

        if (makeQuad) {
            const edgeVec = vB.clone().sub(vA).normalize();
            const mid = vA.clone().add(vB).multiplyScalar(0.5);
            const vD = jitterVec(reflectAcrossEdge(vC, mid, edgeVec), jitterAmt, rng);
            const jA = jitterVec(vA, jitterAmt * 0.3, rng);
            const jB = jitterVec(vB, jitterAmt * 0.3, rng);
            const jC = jitterVec(vC, jitterAmt, rng);
            const jD = jitterVec(vD, jitterAmt, rng);

            const aA = vAlphaFn(jA), aB = vAlphaFn(jB), aC = vAlphaFn(jC), aD = vAlphaFn(jD);

            // Quad: 2 triangles — [A, B, C, A, D, B]
            const positions = [
                jA.x, jA.y, jA.z, jB.x, jB.y, jB.z, jC.x, jC.y, jC.z,
                jA.x, jA.y, jA.z, jD.x, jD.y, jD.z, jB.x, jB.y, jB.z,
            ];
            const [nx, ny, nz] = computeNormal(positions);
            const avgAlpha = (aA + aB + aC + aD) / 4;
            const quadAlphas = [aA, aB, aC, aA, aD, aB];

            accumulatePlane(accum, positions, QUAD_UVS, nx, ny, nz, 6, color,
                baseOpacity, baseEdgeOpacity * avgAlpha, quadAlphas, ns, nst,
                config.edgeColorOffset, groupQuat, origin, chainProgress, origin);
            accumulateSkirt(accum, positions, QUAD_UVS, nx, ny, nz, 6,
                QUAD_BOUNDARY, color, baseOpacity, quadAlphas, ns, nst,
                config.crackExtendScale, groupQuat, origin, chainProgress, origin, chainLength);
        } else {
            const jA = jitterVec(vA, jitterAmt, rng);
            const jB = jitterVec(vB, jitterAmt, rng);
            const jC = jitterVec(vC, jitterAmt, rng);

            const aA = vAlphaFn(jA), aB = vAlphaFn(jB), aC = vAlphaFn(jC);

            const positions = [jA.x, jA.y, jA.z, jB.x, jB.y, jB.z, jC.x, jC.y, jC.z];
            const [nx, ny, nz] = computeNormal(positions);
            const avgAlpha = (aA + aB + aC) / 3;
            const triAlphas = [aA, aB, aC];

            accumulatePlane(accum, positions, TRI_UVS, nx, ny, nz, 3, color,
                baseOpacity, baseEdgeOpacity * avgAlpha, triAlphas, ns, nst,
                config.edgeColorOffset, groupQuat, origin, chainProgress, origin);
            accumulateSkirt(accum, positions, TRI_UVS, nx, ny, nz, 3,
                TRI_BOUNDARY, color, baseOpacity, triAlphas, ns, nst,
                config.crackExtendScale, groupQuat, origin, chainProgress, origin, chainLength);
        }

        const edgeChoice = rng();
        let sharedA: THREE.Vector3, sharedB: THREE.Vector3, oldFree: THREE.Vector3;
        if (edgeChoice < 0.4) {
            sharedA = vB; sharedB = vC; oldFree = vA;
        } else if (edgeChoice < 0.8) {
            sharedA = vA; sharedB = vC; oldFree = vB;
        } else {
            sharedA = vA; sharedB = vB; oldFree = vC;
        }

        const edgeVec = sharedB.clone().sub(sharedA).normalize();
        const midpoint = sharedA.clone().add(sharedB).multiplyScalar(0.5);
        const reflected = reflectAcrossEdge(oldFree, midpoint, edgeVec);

        const dihedral = (0.02 + rng() * 0.08) * (rng() < 0.5 ? 1 : -1);
        const newFree = midpoint.clone().add(
            rotateAround(reflected.clone().sub(midpoint), edgeVec, dihedral)
        );

        const scaleFactor = 0.92 + rng() * 0.12;
        const center = sharedA.clone().add(sharedB).add(newFree).divideScalar(3);
        const scaleFrom = (v: THREE.Vector3) => center.clone().add(v.clone().sub(center).multiplyScalar(scaleFactor));

        vA = scaleFrom(sharedA);
        vB = scaleFrom(sharedB);
        vC = scaleFrom(newFree);
    }
}
