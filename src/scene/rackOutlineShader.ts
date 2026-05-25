import { AdditiveBlending, BackSide, Color, ShaderMaterial } from "three";

// Inverted-hull outline material for the rack bodies. Each vertex
// is pushed along its model-space normal by uThickness, then only
// the back faces render. The expanded shell's front is occluded by
// the rack body itself; the slivers that stick out past the rack
// silhouette form the visible "stroke." Driven by the idle wave to
// spotlight one rack at a time independent of camera angle — the
// M_Screen plane is near-edge-on to the portrait camera at every
// scroll position, so screen-emissive pulse alone isn't a reliable
// idle-attractor cue.
//
// Additive blending so the outline reads as a glow rather than a
// flat tinted band; uOpacity controls both the intensity of the
// add and the fade-in/out at slot boundaries.

const vertexShader = /* glsl */ `
  uniform float uThickness;
  void main() {
    vec3 displaced = position + normal * uThickness;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    gl_FragColor = vec4(uColor * uOpacity, uOpacity);
  }
`;

export interface RackOutlineUniforms {
  uThickness: { value: number };
  uColor: { value: Color };
  uOpacity: { value: number };
}

export function createRackOutlineMaterial(
  color: string,
): ShaderMaterial & { uniforms: RackOutlineUniforms } {
  const mat = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uThickness: { value: 0 },
      uColor: { value: new Color(color) },
      uOpacity: { value: 0 },
    },
    side: BackSide,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  return mat as ShaderMaterial & { uniforms: RackOutlineUniforms };
}
