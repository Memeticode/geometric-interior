/**
 * Folding chain plane generation — connected triangles/quads with
 * dihedral folding along shared edges. Accumulates vertices into
 * batched arrays for single-draw-call rendering.
 */

import * as THREE from 'three';

/**
 * Create fresh accumulator objects for batched face + edge rendering.
 */
export function createAccumulators() {
    return {
        faceAccum: { pos: [], norm: [], uv: [], alpha: [], color: [], opacity: [], noiseScale: [], noiseStrength: [], crackExtend: [] },
        edgeAccum: { pos: [], alpha: [], color: [], opacity: [] },
    };
}

/**
 * Sum inverse-square light contributions from all dots at a world position.
 */
function computeIllumination(worldPos, lightPositions) {
    let total = 0;
    for (const lp of lightPositions) {
        const d2 = worldPos.distanceToSquared(lp.pos);
        total += lp.intensity / (1 + d2 * 10);
    }
    return Math.min(total, 3.0);
}

function computeFade(dist, decayRate) {
    return Math.exp(-decayRate * dist * dist);
}

/**
 * Per-vertex alpha for a world-space position (radial fade + illumination boost).
 */
function vertexAlpha(worldPos, lightPositions) {
    const d = worldPos.length();
    const radial = Math.exp(-1.5 * d * d);
    const illum = lightPositions ? computeIllumination(worldPos, lightPositions) : 0;
    return radial * (1.0 + illum * 2.5);
}

// Rotate a point around an axis through the origin
function rotateAround(point, axis, angle) {
    const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    return point.clone().applyQuaternion(q);
}

// Jitter a vertex slightly for organic irregularity
function jitterVec(v, amount, rng) {
    return v.clone().add(new THREE.Vector3(
        (rng() - 0.5) * amount,
        (rng() - 0.5) * amount,
        (rng() - 0.5) * amount
    ));
}

// Reflect a point across a line defined by (linePoint, lineDir)
function reflectAcrossEdge(point, linePoint, lineDir) {
    const toP = point.clone().sub(linePoint);
    const proj = lineDir.clone().multiplyScalar(toP.dot(lineDir));
    const perp = toP.clone().sub(proj);
    return linePoint.clone().add(proj).sub(perp);
}

/**
 * Accumulate face + edge vertex data into batch accumulators.
 */
function accumulatePlane(accum, geom, color, baseOpacity, edgeOpacity, alphas, noiseScale, noiseStrength, edgeColorOffset, worldQuat, worldOrigin) {
    const { faceAccum, edgeAccum } = accum;
    const fPos = geom.getAttribute('position');
    const fNorm = geom.getAttribute('normal');
    const fUv = geom.getAttribute('uv');
    const vertCount = fPos.count;
    const eColor = color.clone().offsetHSL(...edgeColorOffset);
    const tmpV = new THREE.Vector3();
    const tmpN = new THREE.Vector3();

    for (let i = 0; i < vertCount; i++) {
        tmpV.set(fPos.getX(i), fPos.getY(i), fPos.getZ(i));
        tmpN.set(fNorm.getX(i), fNorm.getY(i), fNorm.getZ(i));
        if (worldQuat) {
            tmpV.applyQuaternion(worldQuat);
            tmpN.applyQuaternion(worldQuat);
        }
        if (worldOrigin) tmpV.add(worldOrigin);

        faceAccum.pos.push(tmpV.x, tmpV.y, tmpV.z);
        faceAccum.norm.push(tmpN.x, tmpN.y, tmpN.z);
        faceAccum.uv.push(fUv.getX(i), fUv.getY(i));
        faceAccum.alpha.push(alphas ? alphas[i] : 1.0);
        faceAccum.color.push(color.r, color.g, color.b);
        faceAccum.opacity.push(baseOpacity);
        faceAccum.noiseScale.push(noiseScale);
        faceAccum.noiseStrength.push(noiseStrength);
        faceAccum.crackExtend.push(1.0);
    }

    // Edge extraction
    const edgeGeom = new THREE.EdgesGeometry(geom);
    const ePos = edgeGeom.getAttribute('position');
    for (let i = 0; i < ePos.count; i++) {
        tmpV.set(ePos.getX(i), ePos.getY(i), ePos.getZ(i));
        // Map alpha from closest face vertex
        let bestAlpha = 0, bestDist = Infinity;
        for (let j = 0; j < fPos.count; j++) {
            const dx = tmpV.x - fPos.getX(j), dy = tmpV.y - fPos.getY(j), dz = tmpV.z - fPos.getZ(j);
            const d = dx * dx + dy * dy + dz * dz;
            if (d < bestDist) { bestDist = d; bestAlpha = alphas ? alphas[j] : 1.0; }
        }
        if (worldQuat) tmpV.applyQuaternion(worldQuat);
        if (worldOrigin) tmpV.add(worldOrigin);

        edgeAccum.pos.push(tmpV.x, tmpV.y, tmpV.z);
        edgeAccum.alpha.push(bestAlpha);
        edgeAccum.color.push(eColor.r, eColor.g, eColor.b);
        edgeAccum.opacity.push(edgeOpacity);
    }
    edgeGeom.dispose();
}

/**
 * Accumulate "skirt" triangles extending beyond a plane's boundary for crack bleeding.
 */
function accumulateSkirt(accum, geom, color, baseOpacity, alphas, noiseScale, noiseStrength, crackExtendScale, worldQuat, worldOrigin) {
    const { faceAccum } = accum;
    const pos = geom.getAttribute('position');
    const uvAttr = geom.getAttribute('uv');
    const normAttr = geom.getAttribute('normal');
    const vertCount = pos.count;
    const scale = crackExtendScale;

    const verts = [], uvsList = [];
    for (let i = 0; i < vertCount; i++) {
        verts.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
        uvsList.push(new THREE.Vector2(uvAttr.getX(i), uvAttr.getY(i)));
    }
    const planeNormal = new THREE.Vector3(normAttr.getX(0), normAttr.getY(0), normAttr.getZ(0));

    // Extract boundary vertices in order
    let bVerts, bUvs, bAlphas;
    if (vertCount === 3) {
        bVerts = [verts[0], verts[1], verts[2]];
        bUvs = [uvsList[0], uvsList[1], uvsList[2]];
        bAlphas = [alphas[0], alphas[1], alphas[2]];
    } else {
        // Quad (6 verts = 2 tris): boundary order A → D → B → C
        bVerts = [verts[0], verts[4], verts[1], verts[2]];
        bUvs = [uvsList[0], uvsList[4], uvsList[1], uvsList[2]];
        bAlphas = [alphas[0], alphas[4], alphas[1], alphas[2]];
    }

    const n = bVerts.length;
    const centroid = new THREE.Vector3();
    const centroidUv = new THREE.Vector2();
    for (let i = 0; i < n; i++) {
        centroid.add(bVerts[i]);
        centroidUv.add(bUvs[i]);
    }
    centroid.divideScalar(n);
    centroidUv.divideScalar(n);

    const expanded = [], expandedUvs = [];
    for (let i = 0; i < n; i++) {
        expanded.push(centroid.clone().add(bVerts[i].clone().sub(centroid).multiplyScalar(scale)));
        expandedUvs.push(centroidUv.clone().add(bUvs[i].clone().sub(centroidUv).multiplyScalar(scale)));
    }

    const tmpV = new THREE.Vector3();
    const tmpN = new THREE.Vector3();

    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const triVerts = [
            bVerts[i], bVerts[j], expanded[j],
            bVerts[i], expanded[j], expanded[i]
        ];
        const triUvs = [
            bUvs[i], bUvs[j], expandedUvs[j],
            bUvs[i], expandedUvs[j], expandedUvs[i]
        ];
        const triAlphas = [
            bAlphas[i], bAlphas[j], bAlphas[j],
            bAlphas[i], bAlphas[j], bAlphas[i]
        ];
        const triCrackExtend = [1.0, 1.0, 0.0, 1.0, 0.0, 0.0];

        for (let k = 0; k < 6; k++) {
            tmpV.copy(triVerts[k]);
            tmpN.copy(planeNormal);
            if (worldQuat) { tmpV.applyQuaternion(worldQuat); tmpN.applyQuaternion(worldQuat); }
            if (worldOrigin) tmpV.add(worldOrigin);

            faceAccum.pos.push(tmpV.x, tmpV.y, tmpV.z);
            faceAccum.norm.push(tmpN.x, tmpN.y, tmpN.z);
            faceAccum.uv.push(triUvs[k].x, triUvs[k].y);
            faceAccum.alpha.push(triAlphas[k]);
            faceAccum.color.push(color.r, color.g, color.b);
            faceAccum.opacity.push(baseOpacity);
            faceAccum.noiseScale.push(noiseScale);
            faceAccum.noiseStrength.push(noiseStrength);
            faceAccum.crackExtend.push(triCrackExtend[k]);
        }
    }
}

/**
 * Create a chain of connected faces (triangles and quads) sharing edges,
 * accumulating all geometry into batch accumulators.
 *
 * @param {object} accum - from createAccumulators()
 * @param {THREE.Vector3} origin - chain attachment point
 * @param {number} chainLength - number of faces in the chain
 * @param {number} planeScale - base size of each face
 * @param {number} distFromCenter - distance of origin from world origin
 * @param {Array} lightPositions - dot positions with .pos and .intensity
 * @param {object} config - { edgeColorOffset, edgeOpacityBase, edgeOpacityFadeScale, crackExtendScale }
 * @param {Function} rng - seeded random
 * @param {Function} pickColorFn - (distFromCenter, decayRate, lightnessBoost, familyHue) → THREE.Color
 * @param {number|null} familyHue - spatial hue from colorFieldHue
 * @param {THREE.Vector3|null} tendrilDir - optional alignment direction
 */
export function createFoldingChain(accum, origin, chainLength, planeScale, distFromCenter, lightPositions, config, rng, pickColorFn, familyHue, tendrilDir) {
    const decayRate = 0.15 + rng() * 0.45;
    const jitterAmt = planeScale * 0.015;

    // Align chain to veil layer normal (tendrilDir) with organic variation
    let groupQuat;
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

    // Generate first triangle's 3 vertices in local space
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

        // Compute face centroid in world space for illumination
        const localCenter = vA.clone().add(vB).add(vC).divideScalar(3);
        const worldCenter = localCenter.clone().applyQuaternion(groupQuat).add(origin);
        const illum = lightPositions ? computeIllumination(worldCenter, lightPositions) : 0;

        const color = pickColorFn(distFromCenter + p * 0.1, decayRate, illum * 0.15, familyHue);
        const baseOpacity = (0.008 + thisFade * 0.04) * (0.4 + rng() * 0.6);
        const edgeFade = thisFade * thisFade;
        const baseEdgeOpacity = (config.edgeOpacityBase + edgeFade * config.edgeOpacityFadeScale) * (0.3 + rng() * 0.7);

        // Per-vertex alpha helper
        const vAlphaFn = (localV) => {
            const wp = localV.clone().applyQuaternion(groupQuat).add(origin);
            return vertexAlpha(wp, lightPositions);
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
            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                jA.x, jA.y, jA.z, jB.x, jB.y, jB.z, jC.x, jC.y, jC.z,
                jA.x, jA.y, jA.z, jD.x, jD.y, jD.z, jB.x, jB.y, jB.z
            ]), 3));
            geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
                0, 0.5, 1, 0.5, 0.5, 1,
                0, 0.5, 0.5, 0, 1, 0.5
            ]), 2));
            geom.computeVertexNormals();
            const avgAlpha = (aA + aB + aC + aD) / 4;
            const quadAlphas = [aA, aB, aC, aA, aD, aB];
            accumulatePlane(accum, geom, color, baseOpacity, baseEdgeOpacity * avgAlpha, quadAlphas, ns, nst, config.edgeColorOffset, groupQuat, origin);
            accumulateSkirt(accum, geom, color, baseOpacity, quadAlphas, ns, nst, config.crackExtendScale, groupQuat, origin);
            geom.dispose();
        } else {
            const jA = jitterVec(vA, jitterAmt, rng);
            const jB = jitterVec(vB, jitterAmt, rng);
            const jC = jitterVec(vC, jitterAmt, rng);

            const aA = vAlphaFn(jA), aB = vAlphaFn(jB), aC = vAlphaFn(jC);
            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                jA.x, jA.y, jA.z, jB.x, jB.y, jB.z, jC.x, jC.y, jC.z
            ]), 3));
            geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
                0, 0, 1, 0, 0.5, 1
            ]), 2));
            geom.computeVertexNormals();
            const avgAlpha = (aA + aB + aC) / 3;
            const triAlphas = [aA, aB, aC];
            accumulatePlane(accum, geom, color, baseOpacity, baseEdgeOpacity * avgAlpha, triAlphas, ns, nst, config.edgeColorOffset, groupQuat, origin);
            accumulateSkirt(accum, geom, color, baseOpacity, triAlphas, ns, nst, config.crackExtendScale, groupQuat, origin);
            geom.dispose();
        }

        // Advance to next face — pick hinge edge
        const edgeChoice = rng();
        let sharedA, sharedB, oldFree;
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

        // Dihedral fold — gentle angles for sheet-like veils
        const dihedral = (0.02 + rng() * 0.08) * (rng() < 0.5 ? 1 : -1);
        const newFree = midpoint.clone().add(
            rotateAround(reflected.clone().sub(midpoint), edgeVec, dihedral)
        );

        // Scale variation: faces shrink slightly along the chain
        const scaleFactor = 0.92 + rng() * 0.12;
        const center = sharedA.clone().add(sharedB).add(newFree).divideScalar(3);
        const scaleFrom = (v) => center.clone().add(v.clone().sub(center).multiplyScalar(scaleFactor));

        vA = scaleFrom(sharedA);
        vB = scaleFrom(sharedB);
        vC = scaleFrom(newFree);
    }
}
