// ============================================================
// Background fragment shader
//
// Gradient evaluated in world-space (camera-aware): the vertical
// gradient stays world-vertical as the camera orbits, so a sky/ground
// split remains correct at any camera angle.
//
// Texture is sampled from spherical world-space UVs, so it also
// rotates with the camera rather than staying fixed on screen.
// ============================================================

#define MAX_STOPS 8

// --- Camera ---
// Upper-left 3x3 of camera.matrixWorld: columns are RIGHT, UP, -FORWARD
uniform mat3  uViewRotation;
uniform float uHalfFovTanX;   // tan(fov/2) * aspect
uniform float uHalfFovTanY;   // tan(fov/2)

// --- Gradient ---
uniform int   uGradientType;           // 0=radial  1=vertical  2=diagonal
uniform int   uStopCount;              // 2–8
uniform float uStopT[MAX_STOPS];       // stop positions [0,1], ascending
uniform vec3  uStopColor[MAX_STOPS];   // stop RGB colors

// --- Texture ---
uniform int   uTexType;        // 0=none  1=noise  2=voronoi  3=flow-lines
uniform float uTexScale;       // 0–1 → 1–20 world-space scale
uniform float uTexStrength;    // 0–1 → blend amount

// --- Flow (modulates texture direction) ---
uniform int   uFlowType;       // 0=none  1=directional  2=orbital
uniform float uFlowAngle;      // radians (for directional)
uniform float uFlowStrength;   // 0–1

varying vec2 vUv;

// ============================================================
// GLSL utilities
// ============================================================

vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453123);
}

float hash1(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Value noise [0,1]
float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash1(i);
    float b = hash1(i + vec2(1.0, 0.0));
    float c = hash1(i + vec2(0.0, 1.0));
    float d = hash1(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Fractal noise (2 octaves) — more organic appearance
float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.6;
    for (int i = 0; i < 2; i++) {
        v += amp * noise2D(p);
        p = p * 2.1 + vec2(3.7, 1.3);
        amp *= 0.4;
    }
    return v;
}

// Voronoi — returns normalised cell distance [0,1]
float voronoi(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float minDist = 8.0;
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = hash2(i + neighbor);
            vec2 diff  = neighbor + point - f;
            minDist = min(minDist, length(diff));
        }
    }
    return clamp(minDist, 0.0, 1.0);
}

// Flow-lines — luminous filaments with Gaussian glow halo.
// Models light-emitting threads: magnetic field lines, bioluminescent currents, etc.
float flowLines(vec2 p, float angle) {
    float ca = cos(angle), sa = sin(angle);
    float proj = -sa * p.x + ca * p.y;
    // Normalised distance from nearest line centre: 0 at line, 1 at midpoint
    float s = abs(fract(proj + 0.5) - 0.5) * 2.0;
    float core = exp(-s * s * 40.0);        // sharp bright filament
    float halo = exp(-s * s * 4.0) * 0.25; // wide soft atmospheric glow
    return clamp(core + halo, 0.0, 1.0);
}

// ============================================================
// World-space ray from clip coords
// ============================================================

vec3 worldRay() {
    vec2 ndc = vUv * 2.0 - 1.0;
    vec3 local = vec3(ndc.x * uHalfFovTanX, ndc.y * uHalfFovTanY, -1.0);
    return normalize(uViewRotation * local);
}

// ============================================================
// Gradient evaluation
// ============================================================

// Piecewise-linear interpolation through n-stop gradient
vec3 evalGradient(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 result = uStopColor[0];
    for (int i = 0; i < MAX_STOPS - 1; i++) {
        if (i >= uStopCount - 1) break;
        float t0 = uStopT[i];
        float t1 = uStopT[i + 1];
        if (t >= t0 && t <= t1) {
            float localT = clamp((t - t0) / max(t1 - t0, 0.0001), 0.0, 1.0);
            result = mix(uStopColor[i], uStopColor[i + 1], localT);
        }
    }
    return result;
}

float gradientParam(vec3 ray) {
    if (uGradientType == 0) {
        // Radial — aspect-corrected circle in pixel space.
        // uHalfFovTanX / uHalfFovTanY == screen aspect ratio (tanY*aspect / tanY).
        float aspect = uHalfFovTanX / uHalfFovTanY;
        float d = length(vec2((vUv.x - 0.5) * aspect, vUv.y - 0.5)) * 2.0;
        return clamp(d * d, 0.0, 1.0);
    } else if (uGradientType == 1) {
        // Vertical — world-space Y (sky=1, ground=0)
        // ray.y is in roughly [-0.6, 0.6] for typical 60° FOV
        return clamp(ray.y * 0.8 + 0.5, 0.0, 1.0);
    } else {
        // Diagonal — screen-space upper-left → lower-right
        return clamp((vUv.x - vUv.y) * 0.5 + 0.5, 0.0, 1.0);
    }
}

// ============================================================
// Texture sampling
// ============================================================

// Spherical UV from world-space ray (longitude, latitude) → [0,1]²
// The seam at the back of the sphere is outside the typical view frustum.
const float PI = 3.14159265359;

vec2 sphereUv(vec3 ray) {
    float lon = atan(ray.z, ray.x) / (2.0 * PI) + 0.5;
    float lat = asin(clamp(ray.y, -1.0, 1.0)) / PI + 0.5;
    return vec2(lon, lat);
}

float sampleTexture(vec3 ray) {
    if (uTexType == 0) return 0.5;

    // World-scale factor: uTexScale in [0,1] maps to [1,20]
    float sc = 1.0 + uTexScale * 19.0;
    vec2 uv = sphereUv(ray) * sc;

    // Apply flow distortion to texture UV
    if (uFlowType == 1) {
        // Directional warp
        float ca = cos(uFlowAngle), sa = sin(uFlowAngle);
        uv += vec2(ca, sa) * fbm(uv * 0.4) * uFlowStrength * 0.5;
    } else if (uFlowType == 2) {
        // Orbital warp — rotate UV around its centre
        vec2 c = uv - floor(uv) - 0.5;
        float rot = uFlowStrength * 0.8;
        uv += vec2(-c.y, c.x) * rot * fbm(uv * 0.3);
    }

    if (uTexType == 1) {
        return fbm(uv);
    } else if (uTexType == 2) {
        return voronoi(uv);
    } else {
        // flow-lines
        float angle = uFlowAngle;
        if (uFlowType == 2) {
            // Orbital: rotate line angle around sphere centre
            angle += atan(ray.z, ray.x);
        }
        return flowLines(uv, angle);
    }
}

// ============================================================
// Main
// ============================================================

void main() {
    vec3 ray = worldRay();

    float t = gradientParam(ray);
    vec3 color = evalGradient(t);

    if (uTexType > 0 && uTexStrength > 0.001) {
        float texVal = sampleTexture(ray);
        if (uTexType == 3) {
            // Flow-lines: additive emission — filaments glow above the gradient.
            // texVal peaks at 1.0 at line centres, tapers via Gaussian halo.
            color = color + color * texVal * uTexStrength * 3.0;
        } else {
            // Noise / voronoi: symmetric brightness modulation centred at 0.5.
            // voronoi: 0 at cell centre → dark nodes, ~0.7 at edges → bright network.
            // noise: fbm averages ~0.5 → organic brightness variation.
            float mod = 1.0 + (texVal - 0.5) * uTexStrength * 2.0;
            color = color * mod;
        }
        color = clamp(color, vec3(0.0), vec3(1.0));
    }

    gl_FragColor = vec4(color, 1.0);
}
