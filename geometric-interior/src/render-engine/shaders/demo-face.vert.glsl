attribute float vAlpha;
attribute vec3 aColor;
attribute float aBaseOpacity;
attribute float aNoiseScale;
attribute float aNoiseStrength;
attribute float aCrackExtend;
attribute float aFoldDelay;
attribute vec3 aFoldOrigin;

uniform float uFoldProgress;

varying float fAlpha;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying vec3 vColor;
varying float vBaseOpacity;
varying float vNoiseScale;
varying float vNoiseStrength;
varying float vCrackExtend;
varying float vFoldAlpha;

void main() {
    fAlpha = vAlpha;
    vUv = uv;
    vColor = aColor;
    vBaseOpacity = aBaseOpacity;
    vNoiseScale = aNoiseScale;
    vNoiseStrength = aNoiseStrength;
    vCrackExtend = aCrackExtend;

    // Staggered fold: each vertex unfolds at its own time
    float delayStart = aFoldDelay * 0.7;
    float available = 1.0 - delayStart;
    float localT = clamp((uFoldProgress - delayStart) / max(available, 0.001), 0.0, 1.0);
    localT = localT * localT * (3.0 - 2.0 * localT); // smoothstep ease

    vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vec3 foldedPos = mix(aFoldOrigin, worldPos, localT);

    vFoldAlpha = localT;
    vWorldPos = foldedPos;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    gl_Position = projectionMatrix * viewMatrix * vec4(foldedPos, 1.0);
}
