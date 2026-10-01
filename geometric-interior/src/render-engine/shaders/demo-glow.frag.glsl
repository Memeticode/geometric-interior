uniform sampler2D uGlowMap;

varying vec2 vUv;

void main() {
    gl_FragColor = texture2D(uGlowMap, vUv);
}
