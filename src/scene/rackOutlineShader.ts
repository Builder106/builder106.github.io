import { AdditiveBlending, BackSide, Color, ShaderMaterial } from "three";

// Inverted-hull rim-light shader for the rack bodies. Each vertex is
// pushed along its model-space normal by uThickness; back-face-only
// rendering means the shell renders only outside the rack silhouette
// (occluded by the rack body inside it). Driven by the idle wave to
// spotlight one rack at a time independent of camera angle — the
// M_Screen plane is near-edge-on to the portrait camera at every
// scroll position, so screen-emissive pulse alone isn't reliable.
//
// Fresnel falloff in the fragment shader concentrates the glow at
// the silhouette edge (where the back-face is perpendicular to view)
// and fades it to zero where the back-face is parallel to view. The
// first version solid-filled every visible back-face and read as a
// chunky tint on the rack — the fresnel makes it read as a rim light
// tracing the silhouette, which is what "outline" suggests.

const vertexShader = /* glsl */ `
  uniform float uThickness;
  varying vec3 vViewNormal;
  void main() {
    vec3 displaced = position + normal * uThickness;
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vViewNormal;
  void main() {
    // Fresnel rim: peaks at 1.0 where viewNormal is perpendicular to
    // view (silhouette edge), drops to 0 where parallel (centre of
    // the shell, which would otherwise read as a flat tint). Squared
    // for a sharper falloff so the rim feels like a stroke rather
    // than a soft glow.
    float fresnel = 1.0 - abs(vViewNormal.z);
    fresnel = pow(fresnel, 2.0);
    float alpha = uOpacity * fresnel;
    gl_FragColor = vec4(uColor * alpha, alpha);
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
