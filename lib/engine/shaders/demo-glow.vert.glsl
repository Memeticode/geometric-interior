attribute float aSize;
attribute vec3 aPosTo;
attribute float aSizeTo;
attribute float aMatchFlag;
attribute float aFadeDir;

uniform float uMorphT;
uniform float uTime;

varying float vFadeDir;

void main() {
    vFadeDir = aFadeDir;
    vec3 pos = mix(position, aPosTo, uMorphT * aMatchFlag);
    float sz = mix(aSize, aSizeTo, uMorphT * aMatchFlag);
    if (aMatchFlag < 0.5) sz = aSize; // unmatched keep original size

    // Per-dot wobble: each dot has unique phase from position hash
    float phase = fract(sin(dot(position.xy, vec2(12.9898, 78.233))) * 43758.5453);
    float wobbleX = sin(uTime * 0.8 + phase * 6.283) * 0.008;
    float wobbleY = cos(uTime * 0.6 + phase * 6.283 + 1.57) * 0.006;
    float wobbleZ = sin(uTime * 0.5 + phase * 6.283 + 3.14) * 0.005;
    pos += vec3(wobbleX, wobbleY, wobbleZ);

    // Size pulse per dot
    float sizePulse = 1.0 + 0.03 * sin(uTime * 1.2 + phase * 6.283);
    sz *= sizePulse;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = sz * (350.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
}
