import { useEffect, useRef } from "react";

// Ambient bed for the data-centre aisle. The catalogue below is the
// full "Sun Waves" release by Vermillion Gaze on archive.org, CC-BY 4.0
// — four slowave / techno / 80s-synth cuts that all share the same
// album vibe, same artist, same license, same CDN. The TradingTerminal
// audio pill exposes a cycler so the visitor can swap between them; the
// selection persists across sessions via localStorage (key set in
// App.tsx). The aisleAudio hook just renders whichever track is
// requested — App.tsx owns the state.
//
// Archive.org's CDN is Fastly-fronted with CORS open and range requests
// supported, so the browser streams instead of downloading the whole
// file before playback. No audio files are checked into public/.
//
// Attribution is surfaced in the audio pill's meta line and in the
// console's `credits` command.

export type TrackId =
  | "mechanical-sunsets"
  | "hymn-to-the-sun"
  | "vicissitudes"
  | "wavelength";

export interface Track {
  readonly id: TrackId;
  readonly url: string;
  readonly title: string;
  readonly artist: string;
  readonly album: string;
  readonly license: string;
  readonly source: string;
}

export const TRACKS: readonly Track[] = [
  {
    id: "mechanical-sunsets",
    url: "https://archive.org/download/SunWaves/MechanicalSunsets.mp3",
    title: "Mechanical Sunsets",
    artist: "Vermillion Gaze",
    album: "Sun Waves",
    license: "CC-BY 4.0",
    source: "archive.org/details/SunWaves",
  },
  {
    id: "hymn-to-the-sun",
    url: "https://archive.org/download/SunWaves/HymnToTheSun.mp3",
    title: "Hymn to the Sun",
    artist: "Vermillion Gaze",
    album: "Sun Waves",
    license: "CC-BY 4.0",
    source: "archive.org/details/SunWaves",
  },
  {
    id: "vicissitudes",
    url: "https://archive.org/download/SunWaves/VicissitudesOnTheTamagawa.mp3",
    title: "Vicissitudes on the Tamagawa",
    artist: "Vermillion Gaze",
    album: "Sun Waves",
    license: "CC-BY 4.0",
    source: "archive.org/details/SunWaves",
  },
  {
    id: "wavelength",
    url: "https://archive.org/download/SunWaves/Wavelength.mp3",
    title: "Wavelength",
    artist: "Vermillion Gaze",
    album: "Sun Waves",
    license: "CC-BY 4.0",
    source: "archive.org/details/SunWaves",
  },
];

export const DEFAULT_TRACK_ID: TrackId = "mechanical-sunsets";

export function getTrack(id: TrackId): Track {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0];
}

export function isTrackId(value: unknown): value is TrackId {
  return (
    typeof value === "string" && TRACKS.some((t) => t.id === value)
  );
}

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

export function useAisleAudio({
  enabled,
  trackId,
}: {
  enabled: boolean;
  trackId: TrackId;
}): void {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIdRef = useRef<number | null>(null);
  // Set to true once the first user gesture has reached the audio
  // element. After this point we can play() programmatically without
  // tripping autoplay restrictions, so track swaps and toggle-on
  // events can resume playback directly instead of re-attaching
  // gesture listeners.
  const hasGesturedRef = useRef(false);
  // Refs for the latest enabled/track values so the once-only setup
  // effect's gesture-listener closure can read them without going
  // stale. (Closing over the initial-render values would mean a user
  // who muted before their first click still gets played at on first
  // click — annoying.)
  const enabledRef = useRef(enabled);
  const trackUrl = getTrack(trackId).url;
  const trackUrlRef = useRef(trackUrl);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    trackUrlRef.current = trackUrl;
  }, [trackUrl]);

  // Effect 1 (run once): create the Audio element and attach the
  // first-gesture listeners. Browsers block programmatic play() until
  // a user has interacted with the page; after the first gesture,
  // hasGesturedRef flips and subsequent toggles can play directly.
  useEffect(() => {
    if (audioRef.current) return;

    const a = new Audio();
    a.src = trackUrlRef.current;
    a.loop = true;
    a.preload = "auto";
    a.crossOrigin = "anonymous";
    a.volume = 0;
    audioRef.current = a;

    const start = () => {
      hasGesturedRef.current = true;
      cleanup();
      const el = audioRef.current;
      if (!el) return;
      if (!enabledRef.current) return;
      void el.play().catch(() => {
        // Even after a gesture, the file might not have buffered
        // enough to start. Browsers will retry on the next gesture
        // and the canplay listener fires when buffering catches up.
      });
      if (fadeIdRef.current !== null) window.clearInterval(fadeIdRef.current);
      fadeIdRef.current = rampGain(a, TARGET_VOLUME, FADE_IN_SECONDS);
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

    return cleanup;
  }, []);

  // Effect 2: track changes. Swap the audio element's src in place;
  // if we're currently playing, restart playback on the new track
  // with a brief silence in between (no cross-fade — keeps the code
  // simple, and the existing fade-in covers the attack).
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.src === trackUrl) return;

    if (fadeIdRef.current !== null) {
      window.clearInterval(fadeIdRef.current);
      fadeIdRef.current = null;
    }
    a.pause();
    a.src = trackUrl;
    a.volume = 0;

    if (enabled && hasGesturedRef.current) {
      void a.play().catch(() => {});
      fadeIdRef.current = rampGain(a, TARGET_VOLUME, FADE_IN_SECONDS);
    }
  }, [trackUrl, enabled]);

  // Effect 3: enabled changes. Fade in on enable, fade out on disable.
  // Skipped while we're still waiting for the first gesture — the
  // gesture handler will fire the initial play().
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!hasGesturedRef.current) return;

    if (enabled && a.paused) {
      a.volume = 0;
      void a.play().catch(() => {});
      if (fadeIdRef.current !== null) window.clearInterval(fadeIdRef.current);
      fadeIdRef.current = rampGain(a, TARGET_VOLUME, FADE_IN_SECONDS);
    } else if (!enabled && !a.paused) {
      if (fadeIdRef.current !== null) window.clearInterval(fadeIdRef.current);
      fadeIdRef.current = rampGain(a, 0, FADE_OUT_SECONDS);
    }
  }, [enabled]);

  // Unmount cleanup. Stop the stream so the browser stops buffering
  // the remote file in the background.
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

