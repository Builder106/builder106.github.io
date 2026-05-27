# Demo narration — Master tour (01-hero)

One-take voiceover for the ~45–50 s recording produced by
`e2e/demo/features/01-hero.feature` → `01-hero-master-tour.mp4`.

Per CLAUDE.md narration guidance:
- ~130–145 wpm. Target the lower end (demos pace slow with slowMo + dwells).
- Use contractions, vary sentence length, avoid superlatives.
- Don't open with the project name. Don't announce transitions.
- Documentation tone, not advertising.

Word budget: ~85 words at ~135 wpm ≈ 38 s of speech, which leaves
breathing room inside the ~48 s video. The TTS chooses its own pacing;
final alignment happens in the muxing pass.

## Act 1 VO

> Eight projects, laid out as a server room. Each rack is a build —
> quant, software engineering, analyst — colour-coded by cluster.
>
> After fifteen seconds of idle, a wave sweeps the room, one rack at a
> time.
>
> Click a rack and its dossier opens: readme, repo activity, build
> status.
>
> The central console is the room's control panel — audio, session
> uptime, repo telemetry, four CC-BY tracks on rotation.
>
> Tap ping for a contact card.
>
> Built in React Three Fiber, three.js, and Blender. The room is the
> portfolio.

## Timed beats (for editor alignment)

| Start | Line                                                                       | On-screen                                               |
| ----- | -------------------------------------------------------------------------- | ------------------------------------------------------- |
| 0:00  | "Eight projects, laid out as a server room…"                               | Boot finishes, scene reveals                            |
| 0:08  | "After fifteen seconds of idle, a wave sweeps the room…"                   | Wave begins firing on slot 0                            |
| 0:24  | "Click a rack and its dossier opens…"                                      | EconOS panel slides in                                  |
| 0:32  | "The central console is the room's control panel…"                         | Trading terminal panel + dashboard widgets              |
| 0:42  | "Tap ping for a contact card."                                             | Contact ping panel                                      |
| 0:46  | "Built in React Three Fiber, three.js, and Blender. The room is…"          | Hero scene, ambient idle                                |

## Voice direction

- **Voice:** understated, conversational. Documentation-narration energy
  — not promo-video energy.
- **Speed:** ~0.95× nominal. Demos already pace slow; matched speech
  reads as considered, not sluggish.
- **Chatterbox parameters:** `--exaggeration 0.4 --cfg-weight 0.6`
  (slightly understated emotion, slightly stricter adherence to text).
- **Voice clone reference:** `voice-samples/reference.wav` in
  `~/CS/content-pipeline` (Yinka's own voice).
