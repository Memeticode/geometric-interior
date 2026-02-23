attribute float vAlpha;
attribute vec3 aColor;
attribute float aBaseOpacity;
attribute float aNoiseScale;
attribute float aNoiseStrength;
attribute float aCrackExtend;

varying float fAlpha;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying vec3 vColor;
varying float vBaseOpacity;
varying float vNoiseScale;
varying float vNoiseStrength;
varying float vCrackExtend;

void main() {
    fAlpha = vAlpha;
    vUv = uv;
    vColor = aColor;
    vBaseOpacity = aBaseOpacity;
    vNoiseScale = aNoiseScale;
    vNoiseStrength = aNoiseStrength;
    vCrackExtend = aCrackExtend;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
