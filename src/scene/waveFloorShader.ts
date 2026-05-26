import { AdditiveBlending, Color, DoubleSide, ShaderMaterial } from "three";

// Floor disc color-wash for the idle-attractor wave. A circular plane
// per slot, laid flat on the floor (rotated -π/2 around X by the
// consumer), centered under the rack pair for that slot. Renders as
// an additive radial gradient — bright at the centre, fading to
// transparent at the edge — so the reflective floor below picks the
// glow up via its real-time mirror reflection AND through the direct
// additive draw on top. Both pass over the same floor pixel during
// the slot's pulse; the doubling is what gives the "neon puddle"
// feel on the corridor floor when a rack pair hits.
//
// The disc sits ~2 cm above the reflective floor (y=0.02) to avoid
// z-fighting; depthWrite is off so the disc never occludes anything
// above it (rack bodies, etc.).

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    // CircleGeometry UVs run 0..1 across the disc bounding box; centre
    // sits at (0.5, 0.5). Remap to (-1..1) and take length for a
    // radial 0 at centre → 1 at edge.
    vec2 centered = (vUv - 0.5) * 2.0;
    float r = length(centered);
    // Radial gradient: peaks at centre, fades to 0 at edge, slight
    // ease-out so the brightest part is concentrated rather than
    // spread evenly across the disc.
    float radial = 1.0 - smoothstep(0.0, 1.0, r);
    radial = pow(radial, 1.5);
    float alpha = radial * uIntensity;
    gl_FragColor = vec4(uColor * alpha, alpha);
  }
`;

export interface WaveFloorUniforms {
  uColor: { value: Color };
  uIntensity: { value: number };
}

export function createWaveFloorMaterial(
  color: string,
): ShaderMaterial & { uniforms: WaveFloorUniforms } {
  const mat = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uColor: { value: new Color(color) },
      uIntensity: { value: 0 },
    },
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  return mat as ShaderMaterial & { uniforms: WaveFloorUniforms };
}
