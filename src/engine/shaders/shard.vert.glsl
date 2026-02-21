// Shard vertex shader — passes world position, normal, view dir, UV, fade, and barycentric to fragment
attribute float aFade;
attribute vec3 aBarycentric;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec2 vUv;
varying float vFade;
varying vec3 vBarycentric;

void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    // Transform normal to world space (correct for lighting calculations)
    vNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    vUv = uv;
    // aFade defaults to 0.0 when attribute not bound; treat as fully opaque
    vFade = aFade > 0.01 ? aFade : 1.0;
    // aBarycentric defaults to (0,0,0) when not bound; treat as (1,1,1) to disable edges
    vBarycentric = length(aBarycentric) > 0.01 ? aBarycentric : vec3(1.0, 1.0, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
