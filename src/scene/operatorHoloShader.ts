import {
  AdditiveBlending,
  Color,
  DoubleSide,
  ShaderMaterial,
  type Texture,
} from "three";

// Operator-holo material: applied to the OperatorHolo plane (above the
// desk keyboard, parented to Desk in Blender) at scene-load time. Same
// pattern as the Monitor swarm shader — the GLB ships with a
// placeholder material, the React layer swaps it for this one and
// drives `uTime` per frame.
//
// Visual: the photo desaturated to greyscale and tinted cyan, then
// projected additively so it reads as a translucent light beam
// rather than a flat photo pinned to the air. Scan lines + a vignette
// fade + a slow flicker push the read further toward "console booted
// the operator's ID" and away from "framed picture above the desk."

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uTexture;
  uniform float uTime;
  uniform vec3 uTint;       // cyan ambient
  uniform vec3 uCoreTint;   // brighter highlight tint (for face peaks)

  varying vec2 vUv;

  void main() {
    vec4 tex = texture2D(uTexture, vUv);
    // Luminance for cyan re-tint. Dark regions of the source stay
    // dark in the additive layer; bright regions (skin highlights)
    // light up the cyan core.
    float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));

    // Contrast push: knock the mid-grey studio backdrop down toward
    // black so it stops painting a flat cyan rectangle behind the
    // face. Face highlights still hit 1.0.
    float keyed = clamp((lum - 0.30) * 1.55, 0.0, 1.0);

    // Tint ramp: ambient tint at low luminance → core tint at peak.
    vec3 col = mix(uTint, uCoreTint, keyed) * keyed;

    // Horizontal scan lines for CRT feel. Density tuned so they read
    // as fine but distinct against the face.
    float scan = 0.65 + 0.35 * sin(vUv.y * 220.0 + uTime * 1.4);
    col *= scan;

    // Vignette: fade toward the plane edges so the rectangle's
    // borders dissolve instead of hard-cutting against the dark
    // scene. Elliptical because the source is a portrait (taller
    // than wide).
    vec2 p = (vUv - 0.5) * 2.0;
    vec2 elliptical = vec2(p.x * 1.15, p.y * 0.85);
    float edge = 1.0 - smoothstep(0.75, 1.05, length(elliptical));

    // Slow flicker — bigger swings on a low-frequency sin, plus a
    // smaller, faster jitter for the "transmission is alive" feel.
    float flicker = 0.85 + 0.10 * sin(uTime * 2.3)
                          + 0.05 * sin(uTime * 17.0);

    col *= edge * flicker;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export interface OperatorHoloUniforms {
  uTexture: { value: Texture | null };
  uTime: { value: number };
  uTint: { value: Color };
  uCoreTint: { value: Color };
}

export function createOperatorHoloMaterial(
  texture: Texture,
): ShaderMaterial & { uniforms: OperatorHoloUniforms } {
  const mat = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTexture: { value: texture },
      uTime: { value: 0 },
      uTint: { value: new Color("#1f8ca8") },      // dim cyan base
      uCoreTint: { value: new Color("#d4faff") },  // bright cyan highlight
    },
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  return mat as ShaderMaterial & { uniforms: OperatorHoloUniforms };
}
