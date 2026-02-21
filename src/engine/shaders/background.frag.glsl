// Background fragment shader — dark gradient with subtle radial light
uniform vec3 uBgColor;
uniform vec3 uFogColor;
uniform float uLightness;
uniform vec2 uCenter; // off-axis center for composition

varying vec2 vUv;

void main() {
    // Distance from off-axis center
    vec2 centered = vUv - uCenter;
    float dist = length(centered);

    // Radial gradient: lighter at center, darker at edges
    float radial = smoothstep(0.0, 0.85, dist);

    // Core glow
    vec3 coreColor = uFogColor * (1.0 + uLightness * 2.0);
    vec3 color = mix(coreColor, uBgColor, radial);

    // Subtle vignette darkening at edges
    float vignette = 1.0 - smoothstep(0.4, 1.0, dist) * 0.4;
    color *= vignette;

    gl_FragColor = vec4(color, 1.0);
}
