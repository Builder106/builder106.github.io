# Demo narration — Master tour (01-hero)

One-take voiceover for the recording produced by
`e2e/demo/features/01-hero.feature` → `01-hero-master-tour.mp4`.

Word budget: ~210 words at ~135 wpm ≈ 95 s of speech. Video recording
will need to match this length.

## Act 1 VO

> Most portfolios are just websites.
>
> I decided to build a server room instead.
>
> What you're looking at is a fully interactive 3D data center running right in the browser. Inside are 15 projects across 5 different domains, and every one of them is something I've actually built and shipped.
>
> You can walk around, explore the space, and interact with the racks. Each rack represents a project. Click one and it opens up everything you'd want to see: the reed-me, live GitHub activity, demos, and the details behind how it was built.
>
> If you leave the room idle for a bit, you'll notice it doesn't just sit there. The environment reacts, waves move through the servers, and the whole space feels alive.
>
> At the center is a control console that runs the room itself. It tracks uptime, handles audio, displays live telemetry, and even lets you ping the system to pull up my contact information.
>
> The entire thing was built with React Three Fiber, Three.js, and Blender. Every model, animation, and detail was created specifically for this experience.
>
> I wanted something that felt more like stepping into my work than scrolling through a list of projects. So I built a server room and put everything I've made inside it.

**Note:** "reed-me" is a phonetic spelling of README — do not correct it back to "README" or the TTS will mispronounce it.

## Timed beats (for editor alignment)

| Start | Line                                                             | On-screen                         |
| ----- | ---------------------------------------------------------------- | --------------------------------- |
| 0:00  | "Most portfolios are just websites."                             | Boot finishes, scene reveals      |
| 0:04  | "I decided to build a server room instead."                      | Wide scene establishes            |
| 0:08  | "What you're looking at is a fully interactive 3D data center…" | Camera sweeps the room            |
| 0:22  | "You can walk around, explore the space…"                        | Rack interaction demo begins      |
| 0:42  | "If you leave the room idle for a bit…"                          | Wave fires through the room       |
| 0:58  | "At the center is a control console…"                            | Console panel visible             |
| 1:14  | "The entire thing was built with React Three Fiber…"             | Hero scene, ambient idle          |
| 1:26  | "I wanted something that felt more like stepping into my work…"  | Final wide shot                   |

## Voice direction

- **Voice:** confident, promotional — showing off, not documenting.
- **Speed:** 1.05x. Energised, not rushed.
- **ElevenLabs settings:** `--stability 0.4 --style 0.5 --speed 1.05`

## Render paths

- **ElevenLabs (most faithful)** — `npm run demo:voiceover:eleven`.
  Voice: `LFYP0IuVPVdjvBSuqXL1` (Yinka PVC, retrained 2026-06-26).
  See [scripts/tts/render-elevenlabs.mjs](../../scripts/tts/render-elevenlabs.mjs).
- **Replicate Chatterbox (cheap, zero-shot)** — `npm run demo:voiceover`.
  See [scripts/tts/render-remote.mjs](../../scripts/tts/render-remote.mjs).
- **Local CPU fallback** — `~/CS/content-pipeline/scripts/tts/render.py --device cpu`.
  Avoid `--device mps` (hangs at step 3/1000).

After any path produces `e2e/demo/output/narration*.{wav,mp3}`:

    npm run demo:mux         # WAV input (Chatterbox local + Replicate)
    npm run demo:mux:eleven  # MP3 input (ElevenLabs)
