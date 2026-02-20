// Shard fragment shader — translucent crystalline plane material
// Light emanates from energy node orbs and illuminates nearby crystal planes.
// Fresnel edge brightening, caustic texture, iridescence, depth fog.

uniform vec3 uBaseColor;
uniform vec3 uEdgeColor;
uniform vec3 uFogColor;
uniform float uOpacity;
uniform float uEmissiveStrength;
uniform float uFresnelPower;
uniform float uEdgeGlowStrength;
uniform float uFogDensity;
uniform float uCameraDistance;
uniform float uCausticStrength;
uniform float uIridescenceStrength;
uniform float uLightFractalLevel;

// Energy node light sources
uniform vec3 uNodePositions[8];
uniform float uNodeIntensities[8];
uniform int uNodeCount;
uniform float uNodeBrightness;
uniform float uNodeRadius;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec2 vUv;
varying float vFade;

// --- Noise utilities ---

float hash(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
}

float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
        mix(mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
            mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
        mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
            mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
        f.z
    );
}

float fbm(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 4; i++) {
        if (i >= octaves) break;
        value += amplitude * noise3D(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// --- Caustic internal texture ---

float causticPattern(vec2 uv, vec3 worldPos) {
    float n1 = noise3D(worldPos * 1.5);
    float n2 = noise3D(worldPos * 1.5 + vec3(5.2, 1.3, 0.0));
    vec2 warpedUV = uv + vec2(n1, n2) * 0.15;

    float c1 = noise3D(vec3(warpedUV * 4.0, worldPos.z * 0.5));
    float c2 = noise3D(vec3(warpedUV * 8.0, worldPos.z * 0.3 + 10.0));
    float caustic = c1 * 0.6 + c2 * 0.4;

    // Sharpen into bright lines
    caustic = pow(caustic, 0.6) * 1.5;
    return clamp(caustic, 0.0, 1.0);
}

// --- Iridescence (thin-film interference approximation) ---

vec3 iridescence(float NdotV, vec3 baseColor) {
    float shift = (1.0 - NdotV) * 6.2831;
    vec3 iriColor = vec3(
        0.5 + 0.5 * cos(shift),
        0.5 + 0.5 * cos(shift + 2.094),
        0.5 + 0.5 * cos(shift + 4.189)
    );
    return mix(baseColor, iriColor * length(baseColor), uIridescenceStrength);
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDir);

    if (!gl_FrontFacing) {
        normal = -normal;
    }

    // Fresnel edge brightening
    float NdotV = max(dot(normal, viewDir), 0.0);
    float fresnel = pow(1.0 - NdotV, uFresnelPower);

    // --- Node illumination: light from energy node orbs ---
    float nodeIllumination = 0.0;
    float radiusSq = uNodeRadius * uNodeRadius;
    for (int i = 0; i < 8; i++) {
        if (i >= uNodeCount) break;
        vec3 toNode = vWorldPos - uNodePositions[i];
        float distSq = dot(toNode, toNode);
        // Gaussian falloff from each node
        float att = uNodeIntensities[i] * exp(-distSq / (2.0 * radiusSq));
        // Directional factor: planes facing the node receive more light
        vec3 nodeDir = normalize(uNodePositions[i] - vWorldPos);
        float facing = 0.4 + 0.6 * max(abs(dot(normal, nodeDir)), 0.0);
        nodeIllumination += att * facing;
    }
    // Normalize by node count to prevent blowout with many nodes
    float nodeNorm = 1.0 / max(float(uNodeCount), 1.0);
    nodeIllumination *= uNodeBrightness * nodeNorm;

    // Ambient emissive core (from fracture/texture — NOT luminosity)
    float emissiveNoise = fbm(vWorldPos * 0.5, 3);
    float fractalDetail = fbm(vWorldPos * 2.0, 4) * uLightFractalLevel;
    float ambientEmissive = uEmissiveStrength * (0.3 + 0.7 * emissiveNoise + 0.3 * fractalDetail);

    // Total illumination: ambient self-emission + light received from nodes
    float totalLight = ambientEmissive + nodeIllumination;
    // Soft clamp: prevents individual faces from being extremely HDR.
    // With polyhedra, multiple faces overlap — bloom creates glow, not raw brightness.
    totalLight = totalLight / (1.0 + totalLight * 0.30);

    // Base color modulated by illumination
    vec3 color = uBaseColor * (0.9 + totalLight);

    // Caustic internal texture — stronger near light sources
    float caustic = causticPattern(vUv, vWorldPos);
    color += uBaseColor * caustic * uCausticStrength * (0.3 + nodeIllumination * 0.5 + ambientEmissive * 0.2);

    // Iridescence (chromatic micro-shift)
    color = iridescence(NdotV, color);

    // Fresnel edge glow — slightly boosted near nodes
    float edgeGlow = uEdgeGlowStrength * (1.0 + nodeIllumination * 0.3);
    color += uEdgeColor * fresnel * edgeGlow;

    // Depth fog — relative to camera distance for zoom consistency
    float viewDistance = length(vWorldPos - cameraPosition);
    float relativeDepth = viewDistance / max(uCameraDistance, 1.0);
    float fogFactor = 1.0 - exp(-uFogDensity * relativeDepth * 8.0);
    fogFactor = clamp(fogFactor, 0.0, 0.85);
    color = mix(color, uFogColor, fogFactor);

    // Final alpha — boosted by node illumination (brighter planes more opaque)
    // and by Fresnel (edges more visible as in real translucent crystal)
    float alpha = uOpacity * (1.0 + fresnel * 0.5 + nodeIllumination * 0.15);
    // Per-vertex fade gradient: planes fade non-uniformly across their surface
    alpha *= vFade;
    alpha *= (1.0 - fogFactor * 0.3);
    alpha = clamp(alpha, 0.0, 0.85); // never fully opaque

    gl_FragColor = vec4(color, alpha);
}
