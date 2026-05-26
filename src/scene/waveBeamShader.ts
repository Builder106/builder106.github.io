import {
  AdditiveBlending,
  Color,
  DoubleSide,
  ShaderMaterial,
} from "three";

// Volumetric overhead beam for the idle-attractor wave. A cone mesh
// (apex at the ceiling, base at the floor) renders with this material;
// per slot, one beam fires during its window in the slot-staggered
// sweep down the aisle.
//
// The vertex shader passes a normalized depth (0 at apex, 1 at base)
// and a fresnel-like edge factor; the fragment shader fades brightness
// toward the floor and concentrates colour at the silhouette so the
// cone reads as a tapered light beam through haze rather than a flat
// tinted cylinder. DoubleSide + additive blend lets the front and
// back of the cone shell stack — that doubling is what sells the
// "looking through the beam" effect without an actual volumetric
// ray-march.

const vertexShader = /* glsl */ `
  uniform float uHeight;
  varying float vDepth;
  varying float vEdge;
  void main() {
    // ConeGeometry has apex at +height/2, base at -height/2.
    // Normalize to vDepth = 0 at apex, 1 at base.
    vDepth = 0.5 - position.y / uHeight;

    // Fresnel: peaks at silhouette where the cone face is perpendicular
    // to view, drops to 0 face-on. Powered for a tighter rim.
    vec3 viewNormal = normalize(normalMatrix * normal);
    vEdge = 1.0 - abs(viewNormal.z);
    vEdge = pow(vEdge, 1.5);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uFlash;
  varying float vDepth;
  varying float vEdge;
  void main() {
    // Vertical taper: bright at apex (light source), fading downward.
    // pow(_, 0.7) gives a softer falloff than linear — keeps the beam
    // legible at floor level instead of dying halfway down.
    float vertical = pow(1.0 - vDepth, 0.7);
    float alpha = vertical * vEdge * uIntensity;
    // Strobe attack: mix accent → white during the first ~150 ms of
    // each slot's pulse. The white flash gives each slot hit a
    // camera-shutter quality before settling into the accent colour.
    vec3 col = mix(uColor, vec3(1.0), uFlash);
    gl_FragColor = vec4(col * alpha, alpha);
  }
`;

export interface WaveBeamUniforms {
  uHeight: { value: number };
  uColor: { value: Color };
  uIntensity: { value: number };
  uFlash: { value: number };
}

export function createWaveBeamMaterial(
  color: string,
  height: number,
): ShaderMaterial & { uniforms: WaveBeamUniforms } {
  const mat = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uHeight: { value: height },
      uColor: { value: new Color(color) },
      uIntensity: { value: 0 },
      uFlash: { value: 0 },
    },
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  return mat as ShaderMaterial & { uniforms: WaveBeamUniforms };
}
