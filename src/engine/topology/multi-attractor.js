/**
 * Multi-attractor topology — planes cluster near energy attractors and bridge between them.
 * Creates concentrated, multi-core compositions with tension lines.
 */

import * as THREE from 'three';

export function createMultiAttractor({ rng, params }) {
    const range = params.depthRange * 0.55;
    const count = 3 + Math.floor(rng() * 5); // 3–7 attractors

    const attractors = [];
    for (let i = 0; i < count; i++) {
        attractors.push({
            position: new THREE.Vector3(
                (rng() * 2 - 1) * range * 1.6,
                (rng() * 2 - 1) * range * 1.1,
                (rng() * 2 - 1) * range * 0.8,
            ),
            strength: 0.5 + rng() * 0.5,
        });
    }

    // Precompute bridges between nearby attractor pairs
    const bridges = [];
    for (let i = 0; i < attractors.length; i++) {
        for (let j = i + 1; j < attractors.length; j++) {
            const dist = attractors[i].position.distanceTo(attractors[j].position);
            if (dist < range * 2.5) {
                bridges.push({ a: i, b: j, dist });
            }
        }
    }

    return {
        scaffoldPoints(count, rng) {
            const all = [];
            const ptsPerAttractor = Math.max(3, Math.ceil(count * 0.7 / attractors.length));
            const bridgePts = Math.max(2, count - ptsPerAttractor * attractors.length);

            // Concentric shells around each attractor
            for (const a of attractors) {
                const radii = [range * 0.1, range * 0.25, range * 0.45];
                const ptsPerShell = Math.ceil(ptsPerAttractor / radii.length);
                for (const r of radii) {
                    for (let k = 0; k < ptsPerShell; k++) {
                        const theta = (k / ptsPerShell) * Math.PI * 2 + rng() * 0.3;
                        const phi = Math.acos(2 * rng() - 1);
                        all.push(a.position.clone().add(new THREE.Vector3(
                            Math.sin(phi) * Math.cos(theta) * r,
                            Math.sin(phi) * Math.sin(theta) * r,
                            Math.cos(phi) * r * 0.7,
                        )));
                    }
                }
            }

            // Evenly-spaced bridge points
            if (bridges.length > 0) {
                const ptsPerBridge = Math.max(2, Math.ceil(bridgePts / bridges.length));
                for (const bridge of bridges) {
                    for (let k = 0; k < ptsPerBridge; k++) {
                        const t = (k + 0.5) / ptsPerBridge;
                        all.push(attractors[bridge.a].position.clone()
                            .lerp(attractors[bridge.b].position, t));
                    }
                }
            }

            for (let i = all.length - 1; i > 0; i--) {
                const j = Math.floor(rng() * (i + 1));
                [all[i], all[j]] = [all[j], all[i]];
            }
            return all.slice(0, count);
        },

        samplePoint(rng) {
            // 70%: cluster near an attractor; 30%: along a bridge
            if (rng() < 0.7 || bridges.length === 0) {
                const a = attractors[Math.floor(rng() * attractors.length)];
                const jitter = range * 0.65;
                return a.position.clone().add(new THREE.Vector3(
                    (rng() * 2 - 1) * jitter,
                    (rng() * 2 - 1) * jitter,
                    (rng() * 2 - 1) * jitter * 0.6,
                ));
            }

            const bridge = bridges[Math.floor(rng() * bridges.length)];
            const t = rng();
            const pos = attractors[bridge.a].position.clone()
                .lerp(attractors[bridge.b].position, t);
            const jitter = range * 0.15;
            pos.add(new THREE.Vector3(
                (rng() * 2 - 1) * jitter,
                (rng() * 2 - 1) * jitter,
                (rng() * 2 - 1) * jitter * 0.5,
            ));
            return pos;
        },

        sampleFrame(position) {
            // Orient toward nearest attractor
            let nearest = attractors[0], bestDist = Infinity;
            for (const a of attractors) {
                const d = position.distanceToSquared(a.position);
                if (d < bestDist) { bestDist = d; nearest = a; }
            }

            const toAttractor = nearest.position.clone().sub(position);
            const normal = toAttractor.length() > 1e-6
                ? toAttractor.normalize()
                : new THREE.Vector3(0, 0, 1);

            const up = new THREE.Vector3(0, 1, 0);
            if (Math.abs(normal.dot(up)) > 0.99) up.set(1, 0, 0);
            const tangent = new THREE.Vector3().crossVectors(up, normal).normalize();
            const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();
            return { tangent, normal, binormal };
        },

        influence(position) {
            let maxInfluence = 0;
            for (const a of attractors) {
                const dist = position.distanceTo(a.position);
                const inf = a.strength * Math.exp(-dist / (range * 0.5));
                maxInfluence = Math.max(maxInfluence, inf);
            }
            return Math.min(1, maxInfluence);
        },
    };
}
