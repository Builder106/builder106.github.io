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
  uniform vec3 uTint;       // subtle cyan accent layered over the photo

  varying vec2 vUv;

  void main() {
    vec4 tex = texture2D(uTexture, vUv);
    vec3 baseCol = tex.rgb;
    float lum = dot(baseCol, vec3(0.299, 0.587, 0.114));

    // Backdrop mask: high-luminance pixels (the light grey studio
    // backdrop) fade toward zero so they stop painting a flat
    // rectangle behind the subject. Face mid-tones and dark features
    // pass through unchanged.
    float subjectMask = 1.0 - smoothstep(0.55, 0.78, lum);

    // Gentle cyan channel scale — preserves the photo's natural
    // hues (skin, hoodie, glasses) while pushing the whole image
    // toward the room's cyan palette. Not the heavy luminance-tint
    // monochrome of the previous pass.
    vec3 cyanTilted = baseCol * vec3(0.82, 1.05, 1.20);
    vec3 col = cyanTilted * subjectMask * 1.45;

    // Horizontal scan lines for CRT feel; slowly drift with uTime.
    float scan = 0.65 + 0.35 * sin(vUv.y * 220.0 + uTime * 1.4);
    col *= scan;

    // Elliptical vignette dissolves the rectangle's hard edges into
    // the dark scene. Aspect-biased because the source is portrait.
    vec2 p = (vUv - 0.5) * 2.0;
    vec2 elliptical = vec2(p.x * 1.15, p.y * 0.85);
    float edge = 1.0 - smoothstep(0.75, 1.05, length(elliptical));

    // Two-band flicker — slow swell + fast jitter — for "the
    // transmission is alive."
    float flicker = 0.85 + 0.10 * sin(uTime * 2.3)
                          + 0.05 * sin(uTime * 17.0);

    // Subtle cyan ambient added everywhere subject is visible, so
    // even the darkest features have a faint glow rather than
    // disappearing into the additive blend's zero contribution.
    col += uTint * subjectMask * 0.08;

    col *= edge * flicker;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export interface OperatorHoloUniforms {
  uTexture: { value: Texture | null };
  uTime: { value: number };
  uTint: { value: Color };
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
      uTint: { value: new Color("#1f8ca8") },
    },
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  return mat as ShaderMaterial & { uniforms: OperatorHoloUniforms };
}
