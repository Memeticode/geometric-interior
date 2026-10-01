// Background: radial gradient from uCenterColor (center) to black (corners).

uniform vec3  uCenterColor;
// tan(fov/2) * aspect and tan(fov/2); their ratio is the screen aspect
uniform float uHalfFovTanX;
uniform float uHalfFovTanY;

varying vec2 vUv;

void main() {
    // Aspect-corrected circle in pixel space
    float aspect = uHalfFovTanX / uHalfFovTanY;
    float d = length(vec2((vUv.x - 0.5) * aspect, vUv.y - 0.5)) * 2.0;
    float t = clamp(d * d, 0.0, 1.0);

    gl_FragColor = vec4(mix(uCenterColor, vec3(0.0), t), 1.0);
}
