// Per-vertex (base quad corners)
attribute vec2 aQuadOffset;   // (-0.5,-0.5), (0.5,-0.5), (0.5,0.5), (-0.5,0.5)

// Per-instance
attribute vec3 aCenter;
attribute float aSize;

varying vec2 vUv;

// Reference resolution constants (SD = 540px height)
#define REF_HALF_HEIGHT 270.0
#define MAX_POINT_SIZE 1024.0
#define REF_HEIGHT 540.0

void main() {
    vUv = aQuadOffset + 0.5;  // [0,1] for texture sampling (replaces gl_PointCoord)

    // Per-dot offset and size jitter: each dot has a unique phase from a position hash
    float phase = fract(sin(dot(aCenter.xy, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 pos = aCenter + vec3(
        sin(phase * 6.283) * 0.008,
        cos(phase * 6.283 + 1.57) * 0.006,
        sin(phase * 6.283 + 3.14) * 0.005);
    float sz = aSize * (1.0 + 0.03 * sin(phase * 6.283));

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
