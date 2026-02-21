/**
 * Topology factory — routes topology mode to implementation.
 *
 * Each topology implements:
 *   scaffoldPoints(count, rng) → THREE.Vector3[]   (structured placement points)
 *   samplePoint(rng)           → THREE.Vector3      (random fallback)
 *   sampleFrame(position)      → { tangent, normal, binormal }
 *   influence(position)        → number [0,1]
 */

import { createIcosahedral } from './icosahedral.js';
import { createMobius } from './mobius.js';
import { createFlowField } from './flow-field.js';
import { createMultiAttractor } from './multi-attractor.js';

const BUILDERS = {
    'icosahedral': createIcosahedral,
    'mobius': createMobius,
    'flow-field': createFlowField,
    'multi-attractor': createMultiAttractor,
};

export function createTopology(mode, opts) {
    const builder = BUILDERS[mode] || BUILDERS['flow-field'];
    return builder(opts);
}
