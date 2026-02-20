// Shard vertex shader — passes world position, normal, view dir, UV, and fade to fragment
attribute float aFade;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec2 vUv;
varying float vFade;

void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    // Transform normal to world space (correct for lighting calculations)
    vNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    vUv = uv;
    // aFade defaults to 0.0 when attribute not bound; treat as fully opaque
    vFade = aFade > 0.01 ? aFade : 1.0;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
