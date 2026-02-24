uniform sampler2D uGlowMap;

void main() {
    gl_FragColor = texture2D(uGlowMap, gl_PointCoord);
}
