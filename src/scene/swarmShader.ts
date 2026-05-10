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

  void main() {
    // Centered coords; widen X because the monitor is ultrawide.
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= 1.4;
    float r = length(p);

    // Slow swirl (rotation) of the sample space.
    float swirl = uTime * 0.10 + sin(uTime * 0.35) * 0.25;
    float ca = cos(swirl);
    float sa = sin(swirl);
    vec2 rot = vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y);

    // Domain-warp the FBM by another FBM for the swirling-data look.
    vec2 q = rot * 2.5;
    vec2 displ = vec2(
      fbm(q + vec2(uTime * 0.15)),
      fbm(q + vec2(5.2, 1.3) - vec2(uTime * 0.12))
    );
    q += (displ - 0.5) * 1.4;

    float density = fbm(q + vec2(uTime * 0.18));
    density = pow(density, 1.7);

    // Radial fade: bright in the centre of the monitor, dark at edges.
    float mask = smoothstep(0.95, 0.05, r);
    density *= mask;

    // Two thresholds — a sharp core and a softer halo around it. Gives
    // the impression of glowing particles instead of a smooth cloud.
    float core = smoothstep(0.30, 0.55, density);
    float halo = smoothstep(0.16, 0.42, density) * 0.55;

    // Base screen glow + swarm.
    vec3 col = uBaseColor * (0.45 + 0.55 * mask);
    col += uCoreColor * (core * 1.5 + halo * 0.7);

    // Hover boost / dim from the parent component's hover state.
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
      uCoreColor: { value: new Color("#bff7ff") },
      uBaseColor: { value: new Color("#0a3640") },
    },
    toneMapped: false,
  });
  return mat as ShaderMaterial & { uniforms: SwarmUniforms };
}
