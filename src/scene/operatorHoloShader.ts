import {
  AdditiveBlending,
  Color,
  DoubleSide,
  ShaderMaterial,
  type Texture,
} from "three";

// Operator-holo material: applied to the OperatorHolo plane (above the
// HoloPedestal stand beside the desk, parented to Desk in Blender) at
// scene-load time. Same pattern as the Monitor swarm shader — the GLB
// ships with a placeholder material, the React layer swaps it for this
// one and drives `uTime` per frame.
//
// Visual: the photo is masked into a pointy-top hexagon, framed with a
// glowing cyan rim, and surrounded by L-shaped corner brackets pinned to
// the plane's outer corners. A slow vertical sweep traces a thin scan
// line across the bracketed frame, intensifying as it crosses the hex.
// The bracket / hex chrome is what carries the "operator dossier" read;
// the rectangular bounds of the plane are no longer visible as a frame.

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
  uniform vec3 uTint;

  varying vec2 vUv;

  // Pointy-top hex SDF — returns an L∞-style distance from centre, where
  // d < apo means inside the hex with apothem apo. Used both to mask
  // the photo into a hex and to draw the rim ring around its edge.
  float hexDist(vec2 p) {
    p = abs(p);
    return max(dot(p, vec2(0.5, 0.866025)), p.x);
  }

  void main() {
    vec2 uv = vUv;
    vec2 centered = uv - 0.5;

    // Hex geometry (UV space). apo = perpendicular distance to side.
    // 0.38 leaves comfortable margin on the 1.1×1.48 plane for the
    // corner-bracket chrome to sit outside the hex.
    float apo = 0.38;
    float feather = 0.006;
    float ringHalf = 0.010;

    float hexD = hexDist(centered);
    float hexInner = smoothstep(apo + feather, apo - feather, hexD);
    float hexRing  = smoothstep(apo + ringHalf, apo, hexD)
                   - smoothstep(apo, apo - ringHalf, hexD);

    // Photo sampled with the plane's native UV; the hex mask clips its
    // corners. The photo is already framed face-centred, so no UV
    // re-scaling is needed — the hex sits over the face naturally.
    vec4 tex = texture2D(uTexture, uv);
    vec3 baseCol = tex.rgb;

    // Backdrop mask: high-luminance pixels (the light grey studio
    // backdrop) fade toward zero so they stop painting a flat rectangle
    // behind the subject inside the hex. Face mid-tones and dark
    // features pass through unchanged.
    float lum = dot(baseCol, vec3(0.299, 0.587, 0.114));
    float subjectMask = 1.0 - smoothstep(0.55, 0.78, lum);

    // Gentle cyan channel tilt — preserves the photo's natural hues
    // (skin, hoodie, glasses) while pushing the whole image toward the
    // room's cyan palette.
    vec3 cyanTilted = baseCol * vec3(0.82, 1.05, 1.20);
    vec3 photo = cyanTilted * subjectMask * 1.20;
    photo += uTint * subjectMask * 0.08;

    // Horizontal scan lines (CRT feel), drift with uTime.
    float scan = 0.88 + 0.12 * sin(uv.y * 140.0 + uTime * 1.4);
    photo *= scan;

    vec3 col = photo * hexInner;

    // Glowing rim around the hex edge — the load-bearing element that
    // sells "the photo is a hologram inside a frame," not "the photo is
    // a hexagon-shaped sticker."
    col += uTint * hexRing * 1.6;

    // Corner brackets — L-shaped marks pinned to the plane's four outer
    // corners. They sit clear of the hex (which only extends to ~0.12
    // UV in from each edge), so they read as targeting reticles framing
    // the dossier rather than competing with the portrait.
    float thick = 0.010;
    float legLen = 0.11;
    float dl = uv.x;
    float dr = 1.0 - uv.x;
    float db = uv.y;
    float dt = 1.0 - uv.y;
    float br = 0.0;
    // TL: vertical leg + horizontal leg
    br += step(dl, thick) * step(dt, legLen);
    br += step(dt, thick) * step(dl, legLen);
    // TR
    br += step(dr, thick) * step(dt, legLen);
    br += step(dt, thick) * step(dr, legLen);
    // BL
    br += step(dl, thick) * step(db, legLen);
    br += step(db, thick) * step(dl, legLen);
    // BR
    br += step(dr, thick) * step(db, legLen);
    br += step(db, thick) * step(dr, legLen);
    br = clamp(br, 0.0, 1.0);
    col += uTint * br * 1.5;

    // Vertical scan sweep — a soft horizontal band that travels top to
    // bottom once every ~3 s. Brighter where it crosses the bracketed
    // margin (no photo to compete with), so it reads as a unified line
    // crossing the whole frame even though the hex partially absorbs it.
    float sweepY = 1.0 - fract(uTime * 0.33);
    float sweepD = uv.y - sweepY;
    float sweep = exp(-180.0 * sweepD * sweepD);
    col += uTint * sweep * 0.30 * hexInner;
    col += uTint * sweep * 0.65 * (1.0 - hexInner);

    // Two-band flicker — slow swell + fast jitter — for "the
    // transmission is alive."
    float flicker = 0.85 + 0.10 * sin(uTime * 2.3)
                          + 0.05 * sin(uTime * 17.0);
    col *= flicker;

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
