uniform sampler2D uGlowMap;
uniform float uMorphFade;
uniform float uMorphT;
uniform float uTime;
uniform float uFoldProgress;

varying float vFadeDir;

void main() {
    vec4 glow = texture2D(uGlowMap, gl_PointCoord);
    float fade = uMorphFade;
    if (vFadeDir < -0.5) fade *= (1.0 - uMorphT);   // dying: fade out
    else if (vFadeDir > 0.5) fade *= uMorphT;        // spawning: fade in

    // Fold: dots fade based on fold progress
    fade *= uFoldProgress;

    // Gentle brightness pulse
    float pulse = 1.0 + 0.05 * sin(uTime * 1.885);
    gl_FragColor = glow * fade * pulse;
}
