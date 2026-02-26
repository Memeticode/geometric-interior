attribute float aSize;
attribute vec3 aPosTo;
attribute float aSizeTo;
attribute float aMatchFlag;
attribute float aFadeDir;

uniform float uMorphT;

varying float vFadeDir;

void main() {
    vFadeDir = aFadeDir;
    vec3 pos = mix(position, aPosTo, uMorphT * aMatchFlag);
    float sz = mix(aSize, aSizeTo, uMorphT * aMatchFlag);
    if (aMatchFlag < 0.5) sz = aSize; // unmatched keep original size

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = sz * (350.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
}
