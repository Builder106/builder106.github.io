import { Color, ShaderMaterial } from "three";

// Custom ShaderMaterial for the central curved monitor — paints a
// time-animated "data swarm" using FBM noise + radial mask + threshold,
// then composites it over a dim cyan screen base. Drives uHover / uDim
// uniforms from the React-side hover state so the swarm boosts when
// the monitor is hovered and dims when a rack panel is open.
//
// Pure fragment-shader effect: no real particles, just sampled density.
// Cheap (one mesh, ~5 octaves of value noise) and scales with monitor
// resolution rather than particle count.

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform float uHover;       // 0 idle, 1 monitor hovered
  uniform float uDim;         // 0 idle, 1 a different panel is active
  uniform vec3 uCoreColor;    // bright peak color
  uniform vec3 uBaseColor;    // dim screen background

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p *= 2.1;
      a *= 0.5;
    }
    return v;
  }

  // 2D Worley / cellular noise. Returns the distance to the nearest
  // jittered cell point in a unit grid, plus the cell's hash for
  // per-cell randomization (twinkle).
  vec2 worley(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float minDist = 1.0;
    float cellHash = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 n = vec2(float(x), float(y));
        vec2 cellOrigin = i + n;
        vec2 jitter = vec2(
          hash(cellOrigin),
          hash(cellOrigin + vec2(17.3, 31.7))
        );
        float d = length(n + jitter - f);
        if (d < minDist) {
          minDist = d;
          cellHash = hash(cellOrigin + vec2(91.1));
        }
      }
    }
    return vec2(minDist, cellHash);
  }

  void main() {
    // Centered coords. Normalize to an ellipse so the radial mask
    // covers the whole monitor face evenly regardless of aspect.
    vec2 p = vUv * 2.0 - 1.0;
    vec2 elliptical = vec2(p.x * 0.72, p.y);
    float r = length(elliptical);

    // Sample space is widened so detail reads at a sensible scale on
    // the ultrawide monitor.
    vec2 sp = p * vec2(1.4, 1.0);

    // Slow rightward drift + a tiny vertical bob — suggests data
    // streaming horizontally, with subtle motion.
    vec2 drift = vec2(uTime * 0.18, sin(uTime * 0.4) * 0.06);

    // Cellular-noise particle field. Lower scale = bigger cells.
    vec2 cell = worley((sp + drift) * 5.0);
    float dotSize = mix(0.10, 0.30, cell.y);  // per-cell size variation
    float dot = 1.0 - smoothstep(0.0, dotSize, cell.x);

    // FBM-driven cluster mask: areas of high density vs sparse, drifts
    // independently so the swarm shifts shape over time. Loose
    // thresholds so most of the screen always has *some* activity.
    float clusters = fbm(sp * 1.4 + vec2(uTime * 0.12));
    float clusterMask = smoothstep(0.20, 0.55, clusters);

    // Per-cell twinkle: each particle's brightness pulses on its own
    // phase based on the cell's hash.
    float twinklePhase = cell.y * 6.2831 + uTime * 1.6;
    float twinkle = 0.55 + 0.45 * sin(twinklePhase);

    float particles = dot * clusterMask * twinkle;

    // Soft FBM "field glow" beneath the discrete dots so the surface
    // reads as an active screen even between particles.
    float fieldGlow = pow(clusters, 1.4) * 0.55;

    // Faint horizontal scan lines so the screen reads as a terminal
    // surface even in idle frames.
    float scanlines = 0.5 + 0.5 * sin(vUv.y * 220.0);
    scanlines = mix(1.0, scanlines, 0.10);

    // Edge fade.
    float edgeFade = smoothstep(1.05, 0.20, r);
    particles *= edgeFade;

    // Base screen glow + soft field + discrete particles.
    vec3 col = uBaseColor * (0.85 + 0.15 * edgeFade) * scanlines;
    col += uBaseColor * fieldGlow * edgeFade * 0.9;
    col += uCoreColor * particles * 2.2;

    // Hover boost / dim.
    col *= 1.0 + uHover * 0.45;
    col *= 1.0 - uDim * 0.65;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export interface SwarmUniforms {
  uTime: { value: number };
  uHover: { value: number };
  uDim: { value: number };
  uCoreColor: { value: Color };
  uBaseColor: { value: Color };
}

export function createSwarmMaterial(): ShaderMaterial & { uniforms: SwarmUniforms } {
  const mat = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uHover: { value: 0 },
      uDim: { value: 0 },
      uCoreColor: { value: new Color("#d4faff") },
      uBaseColor: { value: new Color("#1f8ca8") },
    },
    toneMapped: false,
  });
  return mat as ShaderMaterial & { uniforms: SwarmUniforms };
}
