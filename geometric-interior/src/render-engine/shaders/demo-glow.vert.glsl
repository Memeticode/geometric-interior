// Per-vertex (base quad corners)
attribute vec2 aQuadOffset;   // (-0.5,-0.5), (0.5,-0.5), (0.5,0.5), (-0.5,0.5)

// Per-instance
attribute vec3 aCenter;
attribute float aSize;
attribute vec3 aCenterTo;
attribute float aSizeTo;
attribute float aMatchFlag;
attribute float aFadeDir;

uniform float uMorphT;
uniform float uTime;
uniform float uWobbleAmp;

varying float vFadeDir;
varying vec2 vUv;

// Reference resolution constants (SD = 540px height)
#define REF_HALF_HEIGHT 270.0
#define MAX_POINT_SIZE 1024.0
#define REF_HEIGHT 540.0

void main() {
    vFadeDir = aFadeDir;
    vUv = aQuadOffset + 0.5;  // [0,1] for texture sampling (replaces gl_PointCoord)

    // Morph position/size blending (same logic as before)
    vec3 pos = mix(aCenter, aCenterTo, uMorphT * aMatchFlag);
    float sz = mix(aSize, aSizeTo, uMorphT * aMatchFlag);
    if (aMatchFlag < 0.5) sz = aSize;

    // Per-dot wobble: each dot has unique phase from position hash
    float phase = fract(sin(dot(aCenter.xy, vec2(12.9898, 78.233))) * 43758.5453);
    float wobbleX = sin(uTime * 0.8 + phase * 6.283) * 0.008 * uWobbleAmp;
    float wobbleY = cos(uTime * 0.6 + phase * 6.283 + 1.57) * 0.006 * uWobbleAmp;
    float wobbleZ = sin(uTime * 0.5 + phase * 6.283 + 3.14) * 0.005 * uWobbleAmp;
    pos += vec3(wobbleX, wobbleY, wobbleZ);

    // Size pulse per dot
    float sizePulse = 1.0 + 0.03 * uWobbleAmp * sin(uTime * 1.2 + phase * 6.283);
    sz *= sizePulse;

    // Transform dot center to view space
    vec4 mvCenter = modelViewMatrix * vec4(pos, 1.0);

    // Reference-resolution pixel size with explicit clamp
    float refPointSize = sz * REF_HALF_HEIGHT / -mvCenter.z;
    float clampedSize = min(refPointSize, MAX_POINT_SIZE);

    // View-space billboard extent (resolution-independent)
    float billboardSize = clampedSize * 2.0 * (-mvCenter.z)
                        / (REF_HEIGHT * projectionMatrix[1][1]);

    // Offset quad corners in view space (camera-facing billboard)
    mvCenter.xy += aQuadOffset * billboardSize;

    gl_Position = projectionMatrix * mvCenter;
}
