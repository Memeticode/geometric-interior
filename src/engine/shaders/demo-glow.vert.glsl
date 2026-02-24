attribute float aSize;

void main() {
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (350.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
}
