import { Color, ShaderMaterial } from "three";

// Custom ShaderMaterial for the central curved monitor. Renders a
// "control panel" HUD: faint background grid, dual oscilloscope
// waveforms in the upper band, an animated bar graph in the lower
// band, pulsing status indicators along the top edge, a slow vertical
// scan beam sweeping across, and CRT scanlines pinned over the whole
// surface.
//
// Replaces the earlier data-swarm look. The swarm read as "decorative
// noise"; this layout reads as "control panel" — discrete UI elements
// that imply the monitor is actively driving the room.
//
// Cheap by construction: only trig + arithmetic + a couple of step()
// calls per fragment, no FBM / noise loops. Mobile gets the full
// shader without a quality fallback.

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
  uniform vec3 uCoreColor;    // bright peak / element colour
  uniform vec3 uBaseColor;    // dim screen background

  void main() {
    vec2 uv = vUv;

    // === Background grid =================================================
    // 32×18 cell grid for the fine lattice, plus a brighter section grid
    // every 4 cells. Gives the panel a "digital readout" base layer.
    vec2 fineFrac = abs(fract(uv * vec2(32.0, 18.0)) - 0.5);
    float fineLine = min(fineFrac.x, fineFrac.y);
    float fine = (1.0 - smoothstep(0.0, 0.05, fineLine)) * 0.12;

    vec2 sectFrac = abs(fract(uv * vec2(8.0, 4.5)) - 0.5);
    float sectLine = min(sectFrac.x, sectFrac.y);
    float section = (1.0 - smoothstep(0.0, 0.02, sectLine)) * 0.22;

    float grid = fine + section;

    // === Oscilloscope waveforms — upper band (y ∈ [0.50, 0.90]) =========
    // Two traces at different frequencies for a "two-channel scope" feel.
    float bandUpper = step(0.50, uv.y) * step(uv.y, 0.90);
    float w1 = 0.72 + 0.08 * sin(uv.x * 18.0 - uTime * 2.2)
                     * cos(uv.x * 5.0 + uTime * 0.7);
    float w1Dist = abs(uv.y - w1);
    float w1Line = 1.0 - smoothstep(0.0, 0.011, w1Dist);

    float w2 = 0.62 + 0.05 * sin(uv.x * 12.0 + uTime * 1.5);
    float w2Dist = abs(uv.y - w2);
    float w2Line = (1.0 - smoothstep(0.0, 0.008, w2Dist)) * 0.55;

    float scope = (w1Line + w2Line) * bandUpper;

    // === Bar graph — lower band (y ∈ [0.10, 0.42]) ======================
    // 7 vertical bars across x ∈ [0.06, 0.94]. Each bar's height is a
    // sin of its index + time, with a small gap between adjacent bars
    // so they read as discrete columns.
    float bandLower = step(0.10, uv.y) * step(uv.y, 0.42);
    float barX = (uv.x - 0.06) / (0.94 - 0.06);
    float barIdx = floor(barX * 7.0);
    float barIdxValid = step(0.0, barIdx) * step(barIdx, 6.0);
    float barHeight = 0.55 + 0.40 * sin(uTime * 1.2 + barIdx * 0.7);
    float barTop = 0.10 + barHeight * 0.32;
    float barFill = step(uv.y, barTop) * step(0.10, uv.y);
    float barFrac = fract(barX * 7.0);
    float barGap = step(0.12, barFrac) * step(barFrac, 0.88);
    float bars = barFill * barGap * barIdxValid * bandLower;

    // === Status indicators — top edge (y > 0.93) ========================
    // 5 small dots spaced across the top, each pulsing on its own phase.
    float bandTop = step(0.93, uv.y);
    float dotIdx = floor(uv.x * 5.0);
    float dotPulse = 0.30 + 0.70 * sin(dotIdx * 0.6 + uTime * 2.4);
    vec2 dotCenter = vec2(0.10 + dotIdx * 0.20, 0.965);
    float dotDist = length(uv - dotCenter);
    float dots = (1.0 - smoothstep(0.0, 0.012, dotDist)) * dotPulse * bandTop;

    // === Vertical scan beam ============================================
    // Sweeps left to right slowly. Adds the "active scanning" feel.
    float scanX = mod(uTime * 0.11, 1.0);
    float scanDist = abs(uv.x - scanX);
    float scan = (1.0 - smoothstep(0.0, 0.009, scanDist)) * 0.45;

    // === Horizontal CRT scanlines ======================================
    float scanlines = 0.5 + 0.5 * sin(uv.y * 200.0);
    scanlines = mix(1.0, scanlines, 0.10);

    // === Edge fade — ellipse-clipped so the panel content tapers near
    // the curved monitor edges =========================================
    vec2 p = uv * 2.0 - 1.0;
    vec2 elliptical = vec2(p.x * 0.72, p.y);
    float r = length(elliptical);
    float edgeFade = smoothstep(1.05, 0.30, r);

    // === Compose =======================================================
    vec3 col = uBaseColor * 0.30 * scanlines;
    col += uCoreColor * grid * 0.55;
    col += uCoreColor * scope * 1.6;
    col += uCoreColor * bars * 1.2;
    col += uCoreColor * dots * 1.5;
    col += uCoreColor * scan * 0.8;
    col *= edgeFade;

    // Hover boost / dim.
    col *= 1.0 + uHover * 0.45;
    col *= 1.0 - uDim * 0.65;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export interface ConsoleUniforms {
  uTime: { value: number };
  uHover: { value: number };
  uDim: { value: number };
  uCoreColor: { value: Color };
  uBaseColor: { value: Color };
}

export function createConsoleMaterial(
  _isMobile: boolean = false,
): ShaderMaterial & { uniforms: ConsoleUniforms } {
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
  return mat as ShaderMaterial & { uniforms: ConsoleUniforms };
}
