# Portfolio Hero Demo — FIRST CUT

> First-cut spec for the portfolio hero demo. Winning angle: **story-journey ("Twelve builds, one room.")** — a first-person builder's walk through the React-Three-Fiber server room, grafted with the two verbatim engineering stat cards from the tech-credibility draft.

## ⚠️ This is an EDIT-BAY assembly, not the straight `demo:mux:eleven` single-take mux

The repo's `demo:mux:eleven` pipeline muxes narration onto **one** continuous Playwright take (`01-hero-master-tour.mp4`). This cut does **two** things the repo has no single script for:

1. **Concatenates** the rendered `scene-flythrough` Remotion opener ahead of the live master-tour take.
2. **Interleaves** two separately-rendered Remotion `stat-reveal` cards into the timeline after the EconOS rack beat.

So the editor must build a `concat`/assemble step (documented in the runbook) before the narration mux — do not expect `npm run demo:mux:eleven` alone to produce this cut. Every shot below still maps to a **real, renderable/recordable asset**: shots 2–9 are the exact authored steps of `e2e/demo/features/01-hero.feature` (verified line-for-line), the opener is the `scene-flythrough` composition (id confirmed, `server-room.glb` present at 381KB), and the stat cards are the `stat-reveal` composition with mandatory `--props` overrides (defaults are `142 ns`, a different project).

---

## 1. Concept

Twelve builds, laid out as one server room. A first-person builder's tour: open on a slow 3D flythrough of the room I rendered from a Blender export, then walk the live site the way a visitor would — let the idle wave sweep the racks so the cluster color-code reads, open one project's dossier, drop a hard engineering number against it, open the central console that runs the room's own live telemetry, and end at the contact uplink before the camera settles back on the full room. Warm, documentary register: it describes what I built and what happens on screen, not how it feels. Two stat cards inject the proof-density (18M orders/sec, 50k req/s) that a documentary tone otherwise leaves on the table.

---

## 2. Shot-by-shot

Total video ≈ **47s** (8s flythrough opener + ~39s live tour + 2 interleaved 3s stat cards minus overlap; see runbook for exact assembled length). Spoken-only ≈ 38s. The two silent close-panel beats (shots 5 and 7) plus the muxer's `adelay=3000` lead-in absorb the gap between spoken time and video length.

| # | Source (composition id OR Playwright beat) | Dur | On-screen | VO line |
|---|---|---|---|---|
| 1 | **Remotion `scene-flythrough`** (1920×1080, 240f/8s; `server-room.glb` dolly arc radius 16→10, height 8.5→4; `title` prop) | 8s | Camera arcs through the baked server room, racks resolving from the isometric vantage. Lower-left title "Twelve builds. One room." fades in ~frame 14–32. `github.com/Builder106` footer bottom-right. | "Twelve builds, one room. Every rack here is a project I shipped, and I built the room to hold them." |
| 2 | **Playwright beat:** `I wait for the idle wave to fire` (`01-hero.feature`; `ServerRoom.tsx` idle attractor, holds 22000ms) | 6s | The attractor wave sweeps the racks one slot at a time, surfacing per-cluster colors: cyan quant, pink SWE, gold analyst, emerald cybersec, violet AI/ML. | "Left idle, a wave sweeps through, one rack at a time. The colors are the clusters." |
| 3 | **Playwright beat:** `I click the "EconOS" project rack` → `I see the project card for "EconOS"` (PanelShell `// node.econos`, ProjectCard) | 7s | EconOS panel slides in over the room — readme blurb "MARL economy · live shared mainframe", repo activity, build status, stack chips. | "I open one and the dossier comes up — readme, repo activity, build status. This one's a learning-agent economy." |
| 4 | **Remotion `stat-reveal`** (90f/3s; `--props` label "ORDERS / SEC", value 18000000, **unit "" (clears the 142ns default)**, caption "OCaml limit-order book · p99 < 1µs") | 3s | Stat counts up to 18,000,000 under "ORDERS / SEC", caption "OCaml limit-order book · p99 < 1µs" on `#0d1117`. | "The order book matches around eighteen million orders a second." |
| 5 | **Playwright beat:** `I close the panel` → `no panel is open` (scoped to `.panel--open`, 800ms dwell) | 3s | EconOS panel slides out, camera settles back on the full room; silent breathing beat before the console. | *(silent)* |
| 6 | **Playwright beat:** `I click the trading terminal` → `I see the trading terminal` (callout `/^console$/`, `TradingTerminal.tsx`, PanelShell `// control_console`) | 8s | Central control_console panel: live session uptime, build SHA, repo activity/telemetry, audio state, command prompt, 4 CC-BY tracks. Widgets land during the slow dwell. | "The console in the middle is the room itself — uptime, the build it's on, repo telemetry, a few tracks on rotation." |
| 7 | **Playwright beat:** `I close the panel` → `no panel is open` (800ms dwell) | 3s | Console panel slides out, back to ambient room; silent beat before ping. | *(silent)* |
| 8 | **Playwright beat:** `I click the ping button` → `I see the contact form` (`HUD.tsx` onPing, `ContactPing.tsx`, PanelShell `// uplink`) | 5s | Uplink panel: email mailto, phone, copy buttons, github (Builder106) + linkedin (yinka-vaughan) chips, send-email and view-resume CTAs. | "Ping reaches me — email, the repos, the resume." |
| 9 | **Playwright beat:** `I close the panel` → `no panel is open` + `DEMO_TAIL_MS` hold-final-frame (`hooks.ts`) | 4s | Last panel closes; held final frame rests on the full room at ambient idle, color-coded racks visible. | "Five clusters, twelve builds, one room you can walk." |

**Grafts applied:** stat cards (shots 4 + the second stat card may be dropped into the timeline as a B-card — see note) and the verbatim numbers come from Draft A; the clipped opener "Twelve builds, one room." reads as the on-screen title hit while the fuller line continues (Draft C compression instinct). The second stat card (REQUESTS / SEC, 50,000, "Halberd MCP firewall · p50 ≤ 200µs") is held as an **optional B-card** — drop it in after shot 6 (console) if the editor wants a second hard number; it is rendered by the same runbook command and is unscripted (no VO) so it slots into a silent beat without rewriting narration.

---

## 3. Clean narration script (TTS-ready — fed to the ElevenLabs clone)

> Paragraph-per-beat, blank-line separated, so `render-elevenlabs.mjs` (splits on `\n\s*\n`) renders one request per beat and the clone re-anchors each paragraph instead of drifting robotic past ~15–20s. No stage directions. Silent beats (shots 5, 7) carry no paragraph.

```
Twelve builds, one room. Every rack here is a project I shipped, and I built the room to hold them.

Left idle, a wave sweeps through, one rack at a time. The colors are the clusters.

I open one and the dossier comes up — readme, repo activity, build status. This one's a learning-agent economy.

The order book matches around eighteen million orders a second.

The console in the middle is the room itself — uptime, the build it's on, repo telemetry, a few tracks on rotation.

Ping reaches me — email, the repos, the resume.

Five clusters, twelve builds, one room you can walk.
```

**Word count: 95 words.** Over the ~44s of spoken-bearing video that works out to **~129.5 wpm** — at the floor of the CLAUDE.md 130–145 band, biased low exactly as the rules demand (slowMo + dwells stretch the visuals; underwrite, don't overwrite). Spoken-only runtime is ~38s (≈150 wpm) because the two 3s close-panel beats are silent and the muxer pushes the first word ~3s past the start.

---

## 4. EXECUTABLE RUNBOOK

Two repos are involved. Render the Remotion shots in **content-pipeline**, do everything else in **Builder106.github.io**. Run from each repo's root.

### A. Render the Remotion shots (content-pipeline) — safe to run autonomously

```
cd "/Users/yinkavaughan/My Drive (yvaughan@wesleyan.edu)/CS/content-pipeline"
npx remotion render media/compositions/Root.tsx scene-flythrough out/scene-flythrough.mp4 --gl=angle --props='{"title":"Twelve builds. One room."}'
npx remotion render media/compositions/Root.tsx stat-reveal out/stat-orders.mp4 --props='{"label":"ORDERS / SEC","value":18000000,"unit":"","caption":"OCaml limit-order book · p99 < 1µs"}'
npx remotion render media/compositions/Root.tsx stat-reveal out/stat-requests.mp4 --props='{"label":"REQUESTS / SEC","value":50000,"unit":"","caption":"Halberd MCP firewall · p50 ≤ 200µs"}'
```

| Command | Produces |
|---|---|
| `remotion render … scene-flythrough` | `content-pipeline/out/scene-flythrough.mp4` (shot 1 opener; needs `--gl=angle` for WebGL + the present `server-room.glb`) |
| `remotion render … stat-reveal --props ORDERS/SEC` | `content-pipeline/out/stat-orders.mp4` (shot 4; `--props` mandatory — must set `value` **and** `unit:""`, else the `142`/`ns` defaults print "…ns" on an orders count — verified: caught and fixed during render) |
| `remotion render … stat-reveal --props REQUESTS/SEC` | `content-pipeline/out/stat-requests.mp4` (optional B-card after shot 6) |

### B. Write the narration text (Builder106.github.io) — safe

`demo:voiceover:eleven` reads `e2e/demo/output/narration.txt` (the `DEFAULT_TEXT` path). Save the §3 script there verbatim (paragraph-per-beat, blank lines preserved).

| Action | Produces |
|---|---|
| Write §3 script | `e2e/demo/output/narration.txt` |

### C. Assemble the edit-bay cut (Builder106.github.io) — safe (no credits, no dev server)

After §D produces `01-hero-master-tour.mp4`, copy the rendered Remotion shots in and concat. Concat needs uniform encoding, so re-encode each segment, then concat-demux:

```
cd "/Users/yinkavaughan/My Drive (yvaughan@wesleyan.edu)/CS/Projects/Builder106.github.io"
cp "/Users/yinkavaughan/My Drive (yvaughan@wesleyan.edu)/CS/content-pipeline/out/scene-flythrough.mp4" e2e/demo/output/scene-flythrough.mp4
cp "/Users/yinkavaughan/My Drive (yvaughan@wesleyan.edu)/CS/content-pipeline/out/stat-orders.mp4" e2e/demo/output/stat-orders.mp4
ffmpeg -y -i e2e/demo/output/scene-flythrough.mp4 -c:v libx264 -preset veryfast -pix_fmt yuv420p -r 30 -s 1920x1080 -an e2e/demo/output/seg-01.mp4
ffmpeg -y -i e2e/demo/output/01-hero-master-tour.mp4 -c:v libx264 -preset veryfast -pix_fmt yuv420p -r 30 -s 1920x1080 -an e2e/demo/output/seg-02.mp4
printf "file 'seg-01.mp4'\nfile 'seg-02.mp4'\n" > e2e/demo/output/concat.txt
ffmpeg -y -f concat -safe 0 -i e2e/demo/output/concat.txt -c copy e2e/demo/output/01-hero-master-tour-assembled.mp4
```

> Note: the §E mux reads the file named `01-hero-master-tour.mp4`. Either (a) point the mux at `…-assembled.mp4`, or (b) `mv 01-hero-master-tour.mp4 01-hero-master-tour-raw.mp4 && mv 01-hero-master-tour-assembled.mp4 01-hero-master-tour.mp4` so the unmodified `demo:mux:eleven` command picks up the assembled cut. The stat-card interleave (dropping `stat-orders.mp4` at the EconOS beat rather than appending) is a manual NLE/ffmpeg insert — the flythrough-front concat above is the only fully scripted assembly; insert the stat card by splitting `seg-02` at the EconOS-close timestamp and listing the stat segment between the halves in `concat.txt`.

| Command | Produces |
|---|---|
| `ffmpeg … concat seg-01 + seg-02` | `e2e/demo/output/01-hero-master-tour-assembled.mp4` (flythrough + live tour, video-only, ready for mux) |

### D. Record the live-site tour — ⚠️ GATED (see §5)

### E. Generate narration — ⚠️ GATED (spends ElevenLabs credits, see §5)

### F. Mux narration onto the assembled cut (Builder106.github.io) — safe once D + E are done

```
npm run demo:mux:eleven
```

Verbatim command (from `package.json` line 20):

```
ffmpeg -y -hide_banner -loglevel error -i e2e/demo/output/01-hero-master-tour.mp4 -i e2e/demo/output/narration-eleven.mp3 -filter_complex "[1:a]silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB,adelay=3000,apad[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest e2e/demo/output/01-hero-master-tour-narrated.mp4 && cp e2e/demo/output/01-hero-master-tour-narrated.mp4 public/demo.mp4
```

| Command | Produces |
|---|---|
| `npm run demo:mux:eleven` | `e2e/demo/output/01-hero-master-tour-narrated.mp4` **and** `public/demo.mp4` (the og:video) |

---

## 5. GATED — needs your go-ahead

An assistant must **not** run these autonomously. Each spends money or requires a running dev server.

### Gate 1 — One-time voice setup (spends ElevenLabs credits, only if the clone doesn't exist yet)

```
npm run voice:eleven:create
```
- **What it is:** `node scripts/tts/render-elevenlabs.mjs --create-voice` — creates the cloned voice and prints `ELEVENLABS_VOICE_ID`.
- **Cost/requires:** ElevenLabs API key + a voice-clone slot; consumes account quota. Run once; skip if `ELEVENLABS_VOICE_ID` is already set.

### Gate 2 — Generate narration MP3 (spends ElevenLabs credits)

```
npm run demo:voiceover:eleven
```
- **What it is:** `node scripts/tts/render-elevenlabs.mjs` — reads `e2e/demo/output/narration.txt`, renders paragraph-by-paragraph (re-anchoring the clone, 0.5s silence between segments), writes `e2e/demo/output/narration-eleven.mp3`.
- **Cost/requires:** ElevenLabs API key + character credits (Starter-tier `mp3_44100_128` ceiling). 95 words ≈ ~560 characters of quota per full run; re-runs re-bill.

### Gate 3 — Record the live-site tour (needs the dev server running)

```
npm run dev          # terminal 1 — must be up first
npm run demo:record  # terminal 2
```
- **What it is:** `npm run demo:record` = `DEMO=1 playwright test --config=playwright.demo.config.ts` — drives `01-hero.feature` headless at slowMo 1000ms, single-worker, records 1920×1080 webm; `reporter.ts` converts webm→mp4, drops the two `00-warmup-` videos and any 0-byte sentinels.
- **Cost/requires:** the Vite dev server live on its expected port; no API spend, but it launches a browser and writes `e2e/demo/output/01-hero-master-tour.mp4`. Fails or records a blank page if `npm run dev` isn't up.

---

## 6. ElevenLabs voice settings + audio-alignment notes

### Voice settings (`render-elevenlabs.mjs` defaults — keep them)

| Setting | Value |
|---|---|
| `model` | `eleven_multilingual_v2` |
| `stability` | `0.7` (high — anchored timbre; high variability adds the theatrical inflection we're avoiding) |
| `similarityBoost` | `0.85` (close to the reference clone) |
| `style` | `0.0` (no style exaggeration) |
| `useSpeakerBoost` | `true` |
| `speed` | `1.0` |
| `outputFormat` | `mp3_44100_128` (Starter-tier ceiling) |

CLI overrides if needed: `--stability` / `--similarity` / `--style` / `--speed` / `--model`. CLAUDE.md delivery direction agrees with these defaults (understated/conversational, bias to stability). If you want the ~0.95× "considered" pacing, pass `--speed 0.95`.

### Audio alignment (implemented by the mux filter chain on `[1:a]`)

- **Trim leading silence:** `silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB` cuts the 200–500ms of ambient noise TTS adds at the head, below −50dB.
- **First-word offset:** `adelay=3000` pushes the first word **3000ms (3s)** past the start so the page/flythrough registers before narration begins. *Editorial note:* the CLAUDE.md guidance recommends ~500ms; the repo's actual mux uses **3000ms** — this longer lead-in is intentional here because the cut opens on the 8s silent flythrough, so 3s of room before the first word reads correctly. Keep 3000 unless you re-cut the opener shorter.
- **Tail pad:** `apad` pads the audio tail so it isn't cut before the trailing `DEMO_TAIL_MS` visual dwell on shot 9.
- **Truncate:** `-shortest` ends the output at the shorter of video/audio.
- **Inter-paragraph silence:** a separate **0.5s** `anullsrc` gap is inserted between paragraphs at render time inside the MP3 (independent of the mux `adelay`).
