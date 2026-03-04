varying vec2 vUv;

void main() {
    vUv = uv;
    // Clip-space quad — depth 0.9999 so it renders behind everything
    gl_Position = vec4(position.xy, 0.9999, 1.0);
}
