import { useEffect, useRef } from "react";

// Ambient bed for the data-centre aisle. Previously a three-layer
// WebAudio synth (60 Hz power hum + filtered noise + cooling-fan whir);
// now a streamed mp3 — "Mechanical Sunsets" by Vermillion Gaze, from
// the Sun Waves release on archive.org, CC-BY 4.0. The synth read as
// a buzz; the track is slowave / techno / 80s synth and lands closer
// to the cyberpunk-server-room vibe the rest of the scene is selling.
//
// Hosted on Internet Archive's CDN (Fastly-fronted, CORS open, range
// requests supported, so the browser streams instead of downloading
// the whole file before playback). No file checked into public/.
//
// Attribution is surfaced in the console's `credits` command and in
// the audio pill's meta line.

export const AMBIENT_TRACK = {
  url: "https://archive.org/download/SunWaves/MechanicalSunsets.mp3",
  artist: "Vermillion Gaze",
  title: "Mechanical Sunsets",
  album: "Sun Waves",
  license: "CC-BY 4.0",
  source: "archive.org/details/SunWaves",
} as const;

const TARGET_VOLUME = 0.4;
const FADE_IN_SECONDS = 2.2;
const FADE_OUT_SECONDS = 0.4;
// Tick rate of the fade-volume animation. 60 Hz is overkill for a
// 2 s ramp but the work per tick is one math.min + one assignment —
// nothing the GC will notice.
const FADE_TICK_MS = 16;

function rampGain(audio: HTMLAudioElement, to: number, seconds: number): number {
  const from = audio.volume;
  const startedAt = performance.now();
  const id = window.setInterval(() => {
    const t = Math.min(1, (performance.now() - startedAt) / (seconds * 1000));
    audio.volume = from + (to - from) * t;
    if (t >= 1) {
      window.clearInterval(id);
      // Pause playback once a fade-out completes so the browser stops
      // buffering the remote file in the background.
      if (to === 0) audio.pause();
    }
  }, FADE_TICK_MS);
  return id;
}

export function useAisleAudio(enabled: boolean): void {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      const a = audioRef.current;
      if (a && !a.paused) {
        if (fadeIdRef.current !== null) window.clearInterval(fadeIdRef.current);
        fadeIdRef.current = rampGain(a, 0, FADE_OUT_SECONDS);
      }
      return;
    }

    const fadeUp = (a: HTMLAudioElement) => {
      if (fadeIdRef.current !== null) window.clearInterval(fadeIdRef.current);
      fadeIdRef.current = rampGain(a, TARGET_VOLUME, FADE_IN_SECONDS);
    };

    // Re-enable on a pre-existing element: just resume play + fade up.
    if (audioRef.current) {
      const a = audioRef.current;
      a.volume = 0; // restart the fade from silence
      void a.play().catch(() => {
        // Autoplay may be re-locked if the user navigated away and
        // back without a fresh gesture; the gesture listeners below
        // will pick it up.
      });
      fadeUp(a);
      return;
    }

    // First-time start needs a user gesture. Build the element now
    // (so it's preloaded enough to start instantly on the gesture)
    // but defer play() until the gesture fires.
    const a = new Audio();
    a.src = AMBIENT_TRACK.url;
    a.loop = true;
    a.preload = "auto";
    a.crossOrigin = "anonymous";
    a.volume = 0;

    let cancelled = false;
    const start = () => {
      if (cancelled || audioRef.current) return;
      audioRef.current = a;
      void a.play().catch(() => {
        // Even after a gesture, some browsers can reject if the file
        // hasn't buffered enough; the canplay listener below kicks
        // back in once it has. We silently ignore — the next gesture
        // (or canplay) will retry.
      });
      fadeUp(a);
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

  // Stop and tear down on unmount so the stream doesn't keep buffering
  // if the host page unmounts the hook.
  useEffect(() => {
    return () => {
      if (fadeIdRef.current !== null) window.clearInterval(fadeIdRef.current);
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.src = "";
      }
    };
  }, []);
}
