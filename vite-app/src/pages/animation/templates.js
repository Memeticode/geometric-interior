/**
 * Animation template definitions.
 *
 * Templates are pre-filled Animation structures with placeholder
 * profile slots. Users select profiles to fill each slot, then
 * the template generates a complete event list + overlay tracks.
 */

/**
 * @typedef {{
 *   key: string,
 *   name: string,
 *   description: string,
 *   profileSlots: number,
 *   build: (profiles: Array<{seed, controls, camera}>) => {events, cameraMoves, paramTracks, focusTracks}
 * }} TemplateDefinition
 */

/** @type {TemplateDefinition[]} */
const TEMPLATES = [
    {
        key: 'gentle-reveal',
        name: 'Gentle Reveal',
        description: 'Fade in, hold, fade out',
        profileSlots: 1,
        build(profiles) {
            const p = profiles[0];
            return {
                events: [
                    { type: 'expand', duration: 3, easing: 'ease-out', config: p.controls, seed: p.seed, camera: p.camera, _displayName: p.name, _thumbUrl: p.thumbUrl, _seedLabel: p.seedLabel },
                    { type: 'pause', duration: 8, easing: 'linear' },
                    { type: 'collapse', duration: 3, easing: 'ease-in' },
                ],
                cameraMoves: [
                    { type: 'zoom', startTime: 0, endTime: 14, easing: 'ease-in-out', from: { zoom: 1.0 }, to: { zoom: 0.85 } },
                ],
                paramTracks: [
                    { param: 'twinkle', startTime: 3, endTime: 11, easing: 'ease-in', from: 0, to: 0.6 },
                ],
                focusTracks: [],
            };
        },
    },
    {
        key: 'morph-journey',
        name: 'Morph Journey',
        description: 'Two-profile morph with orbit',
        profileSlots: 3,
        build(profiles) {
            const [p1, p2, p3] = profiles;
            return {
                events: [
                    { type: 'expand', duration: 3, easing: 'ease-out', config: p1.controls, seed: p1.seed, camera: p1.camera, _displayName: p1.name, _thumbUrl: p1.thumbUrl, _seedLabel: p1.seedLabel },
                    { type: 'transition', duration: 4, easing: 'ease-in-out', config: p2.controls, seed: p2.seed, camera: p2.camera, _displayName: p2.name, _thumbUrl: p2.thumbUrl, _seedLabel: p2.seedLabel },
                    { type: 'pause', duration: 5, easing: 'linear' },
                    { type: 'transition', duration: 4, easing: 'ease-in-out', config: p3.controls, seed: p3.seed, camera: p3.camera, _displayName: p3.name, _thumbUrl: p3.thumbUrl, _seedLabel: p3.seedLabel },
                    { type: 'pause', duration: 5, easing: 'linear' },
                    { type: 'collapse', duration: 3, easing: 'ease-in' },
                ],
                cameraMoves: [
                    { type: 'rotate', startTime: 0, endTime: 24, easing: 'linear', from: { orbitY: 0 }, to: { orbitY: 60 } },
                ],
                paramTracks: [
                    { param: 'twinkle', startTime: 0, endTime: 24, easing: 'linear', from: 0.4, to: 0.4 },
                    { param: 'dynamism', startTime: 3, endTime: 21, easing: 'ease-in', from: 0.1, to: 0.5 },
                ],
                focusTracks: [],
            };
        },
    },
    {
        key: 'orbital-showcase',
        name: 'Orbital Showcase',
        description: 'Full 360\u00B0 orbit around a single scene',
        profileSlots: 1,
        build(profiles) {
            const p = profiles[0];
            return {
                events: [
                    { type: 'expand', duration: 3, easing: 'ease-out', config: p.controls, seed: p.seed, camera: p.camera, _displayName: p.name, _thumbUrl: p.thumbUrl, _seedLabel: p.seedLabel },
                    { type: 'pause', duration: 20, easing: 'linear' },
                    { type: 'collapse', duration: 3, easing: 'ease-in' },
                ],
                cameraMoves: [
                    { type: 'rotate', startTime: 3, endTime: 23, easing: 'linear', from: { orbitY: 0 }, to: { orbitY: 360 } },
                ],
                paramTracks: [
                    { param: 'twinkle', startTime: 0, endTime: 26, easing: 'linear', from: 0.5, to: 0.5 },
                    { param: 'dynamism', startTime: 0, endTime: 26, easing: 'linear', from: 0.3, to: 0.3 },
                ],
                focusTracks: [],
            };
        },
    },
    {
        key: 'quick-morph',
        name: 'Quick Morph',
        description: 'Fast two-scene transition',
        profileSlots: 2,
        build(profiles) {
            const [p1, p2] = profiles;
            return {
                events: [
                    { type: 'expand', duration: 2, easing: 'ease-out', config: p1.controls, seed: p1.seed, camera: p1.camera, _displayName: p1.name, _thumbUrl: p1.thumbUrl, _seedLabel: p1.seedLabel },
                    { type: 'transition', duration: 3, easing: 'ease-in-out', config: p2.controls, seed: p2.seed, camera: p2.camera, _displayName: p2.name, _thumbUrl: p2.thumbUrl, _seedLabel: p2.seedLabel },
                    { type: 'collapse', duration: 2, easing: 'ease-in' },
                ],
                cameraMoves: [
                    { type: 'zoom', startTime: 2, endTime: 5, easing: 'ease-in-out', from: { zoom: 1.0 }, to: { zoom: 0.7 } },
                ],
                paramTracks: [],
                focusTracks: [],
            };
        },
    },
    {
        key: 'contemplative',
        name: 'Contemplative',
        description: 'Slow, meditative single scene',
        profileSlots: 1,
        build(profiles) {
            const p = profiles[0];
            return {
                events: [
                    { type: 'expand', duration: 4, easing: 'ease-out', config: p.controls, seed: p.seed, camera: p.camera, _displayName: p.name, _thumbUrl: p.thumbUrl, _seedLabel: p.seedLabel },
                    { type: 'pause', duration: 15, easing: 'linear' },
                    { type: 'collapse', duration: 4, easing: 'ease-in' },
                ],
                cameraMoves: [
                    { type: 'zoom', startTime: 0, endTime: 23, easing: 'ease-in-out', from: { zoom: 1.0 }, to: { zoom: 0.9 } },
                ],
                paramTracks: [
                    { param: 'twinkle', startTime: 0, endTime: 23, easing: 'linear', from: 0.2, to: 0.2 },
                ],
                focusTracks: [],
            };
        },
    },
    {
        key: 'rack-focus',
        name: 'Rack Focus',
        description: 'Near-to-far focus sweep',
        profileSlots: 1,
        build(profiles) {
            const p = profiles[0];
            return {
                events: [
                    { type: 'expand', duration: 3, easing: 'ease-out', config: p.controls, seed: p.seed, camera: p.camera, _displayName: p.name, _thumbUrl: p.thumbUrl, _seedLabel: p.seedLabel },
                    { type: 'pause', duration: 10, easing: 'linear' },
                    { type: 'collapse', duration: 3, easing: 'ease-in' },
                ],
                cameraMoves: [],
                paramTracks: [],
                focusTracks: [
                    { startTime: 3, endTime: 8, easing: 'ease-in-out', from: { focalDepth: 0, blurAmount: 0.4 }, to: { focalDepth: 1, blurAmount: 0.4 } },
                    { startTime: 8, endTime: 13, easing: 'ease-in-out', from: { focalDepth: 1, blurAmount: 0.4 }, to: { focalDepth: 0, blurAmount: 0 } },
                ],
            };
        },
    },
];

/**
 * Get all available templates.
 * @returns {TemplateDefinition[]}
 */
export function getTemplates() {
    return TEMPLATES;
}

/**
 * Apply a template with the given profiles.
 * @param {TemplateDefinition} template
 * @param {Array<{name, seed, controls, camera, thumbUrl, seedLabel}>} profiles
 * @returns {{events, cameraMoves, paramTracks, focusTracks}}
 */
export function applyTemplate(template, profiles) {
    if (profiles.length < template.profileSlots) {
        throw new Error(`Template "${template.name}" requires ${template.profileSlots} profile(s), got ${profiles.length}`);
    }
    return template.build(profiles);
}
