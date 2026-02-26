uniform sampler2D uGlowMap;
uniform float uMorphFade;
uniform float uMorphT;

varying float vFadeDir;

void main() {
    vec4 glow = texture2D(uGlowMap, gl_PointCoord);
    float fade = uMorphFade;
    if (vFadeDir < -0.5) fade *= (1.0 - uMorphT);   // dying: fade out
    else if (vFadeDir > 0.5) fade *= uMorphT;        // spawning: fade in
    gl_FragColor = glow * fade;
}
