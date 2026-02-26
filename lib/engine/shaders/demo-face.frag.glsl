#define MAX_LIGHTS 10

uniform vec3 uLightPositions[MAX_LIGHTS];
uniform float uLightIntensities[MAX_LIGHTS];
uniform int uLightCount;
uniform vec3 uCameraPos;
uniform float uFrontLightFactor;
uniform float uBackLightFactor;
uniform float uIlluminationCap;
uniform float uAmbientLight;
uniform float uEdgeFadeThreshold;
uniform float uMorphFade;
uniform float uTime;

varying float fAlpha;
varying float vFoldAlpha;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying vec3 vColor;
varying float vBaseOpacity;
varying float vNoiseScale;
varying float vNoiseStrength;
varying float vCrackExtend;

float hash(vec3 p) {
    p = fract(p * vec3(443.8975, 397.2973, 491.1871));
    p += dot(p, p.yxz + 19.19);
    return fract((p.x + p.y) * p.z);
}

float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash(i);
    float n100 = hash(i + vec3(1,0,0));
    float n010 = hash(i + vec3(0,1,0));
    float n110 = hash(i + vec3(1,1,0));
    float n001 = hash(i + vec3(0,0,1));
    float n101 = hash(i + vec3(1,0,1));
    float n011 = hash(i + vec3(0,1,1));
    float n111 = hash(i + vec3(1,1,1));
    return mix(
        mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
        mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
        f.z
    );
}

float voronoiEdge(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);
    float md1 = 8.0;
    float md2 = 8.0;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = vec2(
                hash(vec3(n + g, 0.0)),
                hash(vec3(n + g, 1.0))
            );
            vec2 r = g + o - f;
            float d = length(r);
            if (d < md1) {
                md2 = md1;
                md1 = d;
            } else if (d < md2) {
                md2 = d;
            }
        }
    }
    return md2 - md1;
}

float nebulaCracks(vec2 uv) {
    float e1 = voronoiEdge(uv * 2.5 + 3.7);
    float line1 = 1.0 - smoothstep(0.0, 0.04, e1);
    float e2 = voronoiEdge(uv * 5.5 + 11.3);
    float line2 = 1.0 - smoothstep(0.0, 0.03, e2);
    float e3 = voronoiEdge(uv * 11.0 + 27.1);
    float line3 = 1.0 - smoothstep(0.0, 0.025, e3);
    return line1 * 0.4 + line2 * 0.25 + line3 * 0.1;
}

float nebulaDust(vec2 uv, float time) {
    float drift = time * 0.02;
    float d = 0.0;
    d += noise3D(vec3(uv * 3.0 + drift * 0.3, drift * 0.1)) * 0.5;
    d += noise3D(vec3(uv * 6.5 + drift * 0.5, 3.0 + drift * 0.15)) * 0.3;
    d += noise3D(vec3(uv * 14.0 + drift * 0.8, 7.0 + drift * 0.2)) * 0.2;
    return d;
}

float starSparkle(vec2 p, float scale, float time) {
    p *= scale;
    vec2 cell = floor(p);
    vec2 f = fract(p);
    float sparkle = 0.0;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 cellId = cell + g;
            float brightness = hash(vec3(cellId, 30.0));
            if (brightness > 0.75) {
                vec2 starPos = vec2(
                    hash(vec3(cellId, 10.0)),
                    hash(vec3(cellId, 20.0))
                );
                float d = length(f - g - starPos);
                // Per-sparkle flicker: unique phase and rate from cell hash
                float phase = hash(vec3(cellId, 40.0)) * 6.283;
                float rate = 0.5 + hash(vec3(cellId, 50.0)) * 1.5;
                float flicker = 0.5 + 0.5 * sin(time * rate * 6.283 + phase);
                sparkle += smoothstep(0.07, 0.0, d) * (brightness - 0.75) * 4.0 * flicker;
            }
        }
    }
    return sparkle;
}

void main() {
    float n  = noise3D(vWorldPos * vNoiseScale);
    float n2 = noise3D(vWorldPos * vNoiseScale * 2.7 + 31.7);
    float noiseMix = n * 0.7 + n2 * 0.3;

    vec3 modColor = vColor * (1.0 + (noiseMix - 0.5) * vNoiseStrength);

    float illumination = 0.0;
    for (int i = 0; i < MAX_LIGHTS; i++) {
        if (i >= uLightCount) break;
        vec3 toLight = uLightPositions[i] - vWorldPos;
        float d2 = dot(toLight, toLight);
        vec3 lightDir = normalize(toLight);
        float attenuation = uLightIntensities[i] / (1.0 + d2 * 3.0);
        float NdotL = dot(vWorldNormal, lightDir);
        float frontLight = max(NdotL, 0.0) * uFrontLightFactor;
        float backLight = max(-NdotL, 0.0) * uBackLightFactor;
        illumination += (frontLight + backLight) * attenuation;
    }
    illumination = min(illumination, uIlluminationCap);

    float ambient = uAmbientLight;

    // Crack extension fade: 1.0 inside plane, fades to 0.0 in skirt
    float baseFade = vCrackExtend;           // base visuals follow boundary
    float crackFade = pow(vCrackExtend, 0.3); // cracks fade more slowly

    vec3 finalColor = modColor * (ambient + illumination) * baseFade;
    float finalAlpha = vBaseOpacity * fAlpha * (ambient + illumination)
                       * (1.0 + (noiseMix - 0.5) * vNoiseStrength * 0.5) * baseFade;

    vec2 patternCoord = vUv * 2.0 - 1.0;

    float cracks = nebulaCracks(patternCoord) * 0.6;
    float crackGlow = cracks * (ambient + illumination) * 0.7 * crackFade;
    finalColor += (modColor * crackGlow * 0.8 + vec3(crackGlow) * 0.2);

    float dust = nebulaDust(patternCoord, uTime) * 0.6 * baseFade;
    float dustGlow = dust * (ambient + illumination) * 0.1;
    finalColor += modColor * dustGlow;

    float sparkles = (starSparkle(patternCoord, 7.0, uTime)
                   + starSparkle(patternCoord, 13.0, uTime) * 0.5) * 0.6 * baseFade;
    float sparkleGlow = sparkles * (ambient + illumination) * 0.25;
    finalColor += vec3(sparkleGlow) * 0.5 + modColor * sparkleGlow * 0.5;

    finalAlpha += (cracks * 0.06 * crackFade + dust * 0.015 + sparkles * 0.045);

    // Fade planes that are edge-on to the viewer
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    float facing = abs(dot(normalize(vWorldNormal), viewDir));
    float edgeFade = smoothstep(0.0, uEdgeFadeThreshold, facing);
    finalAlpha *= edgeFade;
    finalColor *= edgeFade;

    finalAlpha *= vFoldAlpha;
    finalColor *= vFoldAlpha;
    gl_FragColor = vec4(finalColor * uMorphFade, max(finalAlpha, 0.0) * uMorphFade);
}
