import { useEffect, useRef } from "react";

// Three-layer ambient bed for the data-centre aisle: a 60 Hz power
// hum, low-passed pink-ish noise (the "wind" of an air-handling
// system), and a slowly-modulated 280 Hz tone (cooling-fan whir).
// All synthesised via WebAudio — no asset to ship — and lazily
// instantiated on first user interaction to satisfy browser autoplay
// policies.

interface AudioGraph {
  ctx: AudioContext;
  master: GainNode;
}

const TARGET_VOLUME = 0.55;
const FADE_IN_SECONDS = 2.2;
const FADE_OUT_SECONDS = 0.4;

function buildGraph(): AudioGraph {
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  // Layer 1: 60 Hz power hum.
  const hum = ctx.createOscillator();
  hum.type = "sawtooth";
  hum.frequency.value = 60;
  const humGain = ctx.createGain();
  humGain.gain.value = 0.045;
  hum.connect(humGain).connect(master);
  hum.start();

  // Layer 2: filtered noise — air-handler "wind".
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const noiseData = noiseBuf.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = (Math.random() - 0.5);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 580;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.07;
  noise.connect(noiseFilter).connect(noiseGain).connect(master);
  noise.start();

  // Layer 3: cooling-fan whir at 280 Hz, slowly modulated.
  const fan = ctx.createOscillator();
  fan.type = "sine";
  fan.frequency.value = 280;
  const fanLFO = ctx.createOscillator();
  fanLFO.frequency.value = 0.35;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 7;
  fanLFO.connect(lfoGain).connect(fan.frequency);
  const fanGain = ctx.createGain();
  fanGain.gain.value = 0.014;
  fan.connect(fanGain).connect(master);
  fan.start();
  fanLFO.start();

  return { ctx, master };
}

export function useAisleAudio(enabled: boolean): void {
  const graphRef = useRef<AudioGraph | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Fade out if a graph already exists.
      const g = graphRef.current;
      if (g) {
        g.master.gain.cancelScheduledValues(g.ctx.currentTime);
        g.master.gain.linearRampToValueAtTime(0, g.ctx.currentTime + FADE_OUT_SECONDS);
      }
      return;
    }

    const fadeIn = (g: AudioGraph) => {
      g.master.gain.cancelScheduledValues(g.ctx.currentTime);
      g.master.gain.linearRampToValueAtTime(
        TARGET_VOLUME,
        g.ctx.currentTime + FADE_IN_SECONDS,
      );
    };

    // If graph already exists from a previous enable, just unmute.
    if (graphRef.current) {
      // The context may be suspended after browser autoplay-policy
      // freezes; resume if needed.
      if (graphRef.current.ctx.state === "suspended") {
        void graphRef.current.ctx.resume();
      }
      fadeIn(graphRef.current);
      return;
    }

    // First-time start needs a user gesture per browser policy.
    let cancelled = false;
    const start = () => {
      if (cancelled || graphRef.current) return;
      const g = buildGraph();
      graphRef.current = g;
      fadeIn(g);
      cleanup();
    };
    const cleanup = () => {
      document.removeEventListener("pointerdown", start);
      document.removeEventListener("touchstart", start);
      document.removeEventListener("keydown", start);
      document.removeEventListener("wheel", start);
    };
    document.addEventListener("pointerdown", start, { once: true });
    document.addEventListener("touchstart", start, { once: true });
    document.addEventListener("keydown", start, { once: true });
    document.addEventListener("wheel", start, { once: true });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [enabled]);
}
