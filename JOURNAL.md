# JOURNAL — Olayinka Vaughan portfolio

> Dated log of decisions, pivots, incidents, and quotes. Add entries as
> things happen — retrospectives need this raw material to land.
> Reverse-chronological; one paragraph max per entry.
> Tags: #decision #pivot #incident #quote #feedback #milestone.

## 2026-06-12 — AI/ML wing on the front wall: 3 applied-LLM racks #milestone #decision

Added a fifth cluster, `ml`, with Enclave (privacy-measured clinical-doc
extraction), Helm (Gemini + MCP back-office co-pilot), and TradeTell (RAG
trading assistant) — the three AI/ML projects. The room's other four walls were
already taken (quant=back, swe+analyst=left, security=right), so the AI/ML wing
went on the empty front (−Y) wall. Rather than re-bake, I point-mirrored the
three quant back-wall racks across room centre (180° about Z, world origin) —
the exact trick the security wing used on the left wall — so each new rack reuses
the quant bake (`M_Bake_Rack_econos/-ocaml-lob/-qforge`) with UVs intact and
stays consistently lit. Forty-five objects (3× Rack + Screen + 12 LEDs + anchor)
duplicated, re-exported to a Draco GLB (+7 KB only, thanks to shared mesh data).
Both scene variants resolve to the one landscape GLB, so no portrait file to
touch. Code: new `ml` cluster type + "AI/ML" display label + violet wave colour
`#a06bff`, a front-wall case in `wallNormalFor` (returns `(0,0,−1)`), the 3 ids
appended to both `AISLE_ORDER` copies (the terminal's duplicate was *also* stale
— missing the whole security wing — so fixed that drift too), `slotIndexByKey`
order tuple + landscape `waveSlotCount` 4→5, and cluster-aware `ls`/`stats` in
the terminal. Live smoke test: scene loads clean (only the localhost Cloudflare
analytics CORS noise), all three racks render on the front wall with `// ai/ml`
callouts. Projects also flow into the SEO/screen-reader mirror, JSON-LD, and
build-time repo-stats.

## 2026-06-01 — Portrait ceiling fixtures: 3D troffers + glow pools #decision

The overhead aisle strips were flat unlit boxes seen face-on — they read as 2D
rectangles and (since the ceiling grid is an unlit shader) cast no light. Rebuilt
each as a recessed troffer (dark housing frame + bright inset panel) and added an
additive radial-gradient sprite as a pool of light on the ceiling grid above each
fixture. The bright-under-the-light / dark-between falloff is what sells the
overhead as real lit geometry; can't use actual point lights because the drei
Grid ceiling is shader-based and unlit, so the glow is faked with a sprite. One
shared CanvasTexture, fogged so the receding pools fade with the corridor.
Portrait-only.

## 2026-06-01 — Portrait "wires in the sky" + pitch-black ceiling #incident

The portrait view reuses the landscape scene but hides the room's walls/ceiling
and relocates the racks into the aisle. Two artifacts surfaced: the kept
`Cable_Ceil*` runs stayed pinned at their old ceiling height with nothing behind
them, reading as neon wires floating in the void; and with no ceiling geometry at
all, the area above the racks was the bare dark background ("pitch-black
ceiling"). Hid the ceiling cables in portrait (the floor + riser runs stay —
they read as grounded cabling near the entrance) and added a dim ceiling grid at
the fluorescent-strip height, mirroring the floor, so the corridor reads as an
enclosed data hall top and bottom. Both changes are portrait-gated; the landscape
composition (where the cables arc across an implied room and read fine) is
unchanged.

## 2026-06-01 — Aisle floor + center-line + fog still sized for the short aisle #incident

After extending the portrait aisle to 12 racks with the holo at z≈−30, three floor
elements still stopped short of the end: the cyan center-line strip (28u @ z=−10 →
ended at −24), the reflective floor (60×60 → edge at −30, right at the holo), and
the fog (near=24, which dimmed the deep aisle floor mid-scroll). Extended the
center-line to run from +4 to the terminus (−32) so the runway leads the eye to
the hologram, enlarged the floor to 60×80, and pushed fog near 24→32 so the aisle
reads to its end before fading. Center-line length now derives from
`AISLE_TERMINUS_Z`; landscape is unaffected (its room sits well within 24).

## 2026-05-31 — Cybersec favicons: opaque, then bright (unlit logos lose to HDR racks) #incident

Made the 3 cybersec rack logos opaque (composited onto a dark `#0c1019` tile) on
request — but ClearHash and Quarry then washed out at full rack brightness,
readable only when hovering a *different* rack dimmed this one. Cause: the logo
planes are unlit `meshBasicMaterial` with `toneMapped={false}` — constant
brightness, no bloom pass — while the rack LEDs/screens are HDR-emissive; at full
intensity the bright rack out-shines a dark-tiled logo. Hover lerps this rack's
lights down but not the constant-brightness logo, so it reads "in shadow."
Halberd was fine because its tile is a bright blue gradient. Fix: rebuilt
ClearHash (full brand-gradient square + dark `#`) and Quarry (gold square + dark
concentric hexes) as bright full-bleed app-icons matching Halberd's luminosity,
so they hold contrast at every rack brightness. Lesson: a logo competing with
HDR-emissive geometry needs a luminous fill, not a dark one.

## 2026-05-31 — Cybersec rack mirror copies misaligned (a 2π quaternion-sync quirk) #incident

The 3 cybersec racks' right-side (mirror) copies landed at x≈0.8 instead of 1.6,
so the right rack row didn't line up with the rest of the aisle. The portrait
reparent mirrors each rack with `group.clone(true)` then `mirror.rotation.y =
leftAngle + π`. Cybersec is the only **right-wall** cluster (normal −X) →
leftAngle = π → the mirror angle is *exactly* 2π. clone() had copied the group's
`Ry(π)` quaternion, and assigning `rotation.y` to exactly 2π didn't re-sync the
quaternion off that value — the stale `Ry(π)` stuck, so the mirror kept a 180°
spin and the rack's −0.4 lateral offset flipped inward (1.2 − 0.4 = 0.8 instead
of 1.2 + 0.4 = 1.6). Diagnosed by logging each rack's post-layout world position
under a headless mobile viewport. Fix: normalise the mirror angle into [0, 2π)
(2π → 0) via `rotation.set()`, forcing the Euler→quaternion sync. Back/left-wall
racks are unaffected (their π and 3π/2 angles are unchanged). Cleaned up leftover
`[wave] reset by …` console spam in the same pass.

## 2026-05-31 — Portrait scroll capped before cybersec; holo moved to the aisle end #incident #decision

Two portrait/mobile fixes after the cybersec wing landed. (1) **Scroll cap:** the
aisle camera stopped at z=−16 — sized for the original 9 racks — so the 3 cybersec
racks (z −22.4 to −27.6) were unreachable. Extended `SCROLL_CAMERA_END` to −23
(target −30, and the label-opacity `camZ` in sync). Compounding it, the backwall
terminus was pinned at z=−22, so even on reaching them the wall *occluded* the
cybersec racks and everything beyond (the camera just saw a dark wall with the DOM
labels on top) — moved the terminus to behind the new corridor end, derived from
the rack count. (2) **Holo:** relocated the operator hologram + pedestal from the
front desk to the corridor end (z −30.2) facing +Z, as the walk's destination.
Gotcha: the portrait is a flat sheet (1.1×1.48) authored facing −Y (down) so the
*elevated* landscape orbit camera could read it; in the horizontal aisle that's
edge-on/invisible. Stood it upright with Rx(90°) (geometry normal +Y → +Z). The
LinkedIn click target still resolves — names preserved.

## 2026-05-31 — Mobile rack faces were murky: portrait moves racks off the fixed lights #incident

Racks read dark in the portrait/mobile aisle. Root cause was a layout↔lighting
interaction: the portrait pass relocates every rack into a long −Z corridor, but
the key ceiling-grid lights stay pinned at the landscape room's `z = ±3.5` (and
are skipped entirely on mobile for perf). So a rack deep in the corridor saw only
the uniform top-down directional — which grazes the *vertical, corridor-facing*
rack faces at ~90° (cosine ≈ 0). Compounded by the wave system nulling the racks'
baked emissive map, so at idle the body is pure base-colour-under-light. Fix: a
symmetric pair of near-horizontal directionals (rays travelling ∓X) that rake
both aisle walls' faces uniformly down the whole corridor — 2 lights, no falloff,
portrait-only. Pushed to intensity 6.0 because the rack base colour is near-black;
the emissive LEDs/screens are unaffected so they don't blow out.

## 2026-05-31 — Full-spectrum recolour of idle waves + per-project accents #decision

The four-cluster idle wave was cyan/magenta/cyan/green — analyst shared quant's
cyan, so two of four clusters were indistinguishable when the wave swept. Moved
to a full-spectrum palette: quant cyan `#36d4ff`, swe pink `#ff5cc8`, analyst
gold `#ffc24c`, security mint `#43f0a0` — one hue per cluster at consistent neon
luminance. Also retuned all 12 per-project accent colours (the floor-glow + LED
tints, distinct from the cluster wave): brightened the muddy darks (CapitolAlpha
`#cc0000`→`#ff3b5c`, DataFest blue, LinuxBenchHub), split the two duplicate
analyst reds by moving LinuxBenchHub to violet `#b06bff`, and kept brand hints
(OCaml amber, STAIJA emerald, Halberd gold, Quarry orange). Presented A/B swatch
options; picked B (full-spectrum) + full-accent scope. Verified in the lit scene
via headless Playwright before shipping.

## 2026-05-31 — Draco-compressed the glb + security rack logos #decision #milestone

Two follow-ups after the security wing shipped. (1) Rack logos: rasterized the
ClearHash + Halberd `favicon.svg` to 256² transparent PNGs and extracted Quarry's
concentric-hexagon mark from its banner SVG into a standalone logo; wired via the
existing `logo` field (runtime R3F textured planes, no Blender change). (2) Perf:
the glb was geometry-dominated (594 KB geometry vs 49 KB textures), so Draco — not
texture compression — was the lever. Re-exported with Draco mesh compression:
**856 KB → 367 KB (−57%)**. Self-hosted the decoder at `public/draco/` (not the
gstatic CDN) and pointed `useGLTF(url, "/draco/")` at it. Verified end-to-end with
headless Playwright (WebGL via SwiftShader): scene renders, zero Draco/GLTF errors,
glb + decoder both 200. Note: the desktop Lighthouse 0.60 is a known no-GPU CI
artifact (software WebGL blocks the main thread) and is `warn`-only by design —
the real gate is mobile (passing), and the glb loads lazily post-LCP, so Draco is a
real-user transfer/scene-ready win rather than a CI-score mover.

## 2026-05-31 — Security wing authored on the right wall via Blender MCP #milestone #decision

Built the three security racks (ClearHash/Halberd/Quarry) directly into
`server-room.blend` and re-exported the glb. Technique: mirror three left-wall
rack assemblies (Rack + Screen + 12 LEDs + anchor) across the room centre with a
180° Z-rotation baked into the mesh — handles the two vertex conventions in the
scene uniformly (racks carry a real loc transform; screens/LEDs have geometry
baked at world coords with identity transform), and a pure rotation keeps normals
outward (no mirror/flip). Landed them on the previously-empty **right wall (+X)**
at Y = −0.5 / 1.0 / 2.5, symmetric to the left wall — so security gets its own
wall in landscape (quant=back, swe+analyst=left, security=right) instead of
needing the invented "entry wall." glb went 226→268 meshes, 10→13 anchors; LEDs
auto-recolour from each project's `color`. Flipped the code on: removed
`inScene:false`, added all three to both `AISLE_ORDER` copies, added `security`
to the landscape `order` tuple, bumped landscape `waveSlotCount` 3→4.

## 2026-05-31 — Blender MCP venv was orphaned by a vanished uv-managed Python #incident

Hit `ENOENT` spawning `blender-mcp` even though the script existed — its shebang
pointed at `~/.local/share/uv/python/cpython-3.12.11-.../python3.12`, and that
entire uv-managed Python store had been cleaned out, leaving a dangling
interpreter symlink (kernel reports a bad interpreter as ENOENT on the script).
The Blender addon socket on :9876 was healthy the whole time — only the MCP
bridge venv was broken. Fix: rebuilt the venv against Homebrew's `python@3.14`
(`rm -rf .venv && uv venv && uv pip install -e .`), which is far less likely to
get garbage-collected than a uv-managed toolchain. Lesson: don't build
long-lived tool venvs against `uv`-managed interpreters.

## 2026-05-31 — Security cluster joins the room #decision

Added the three Cybersecurity-folder projects — ClearHash (Rust supply-chain
gatekeeper), Halberd (Go MCP firewall), Quarry (TS/Yul MEV engine) — as a new
`security` cluster. Chose a dedicated cluster over reusing the unused `systems`
slot or distributing into quant/analyst, and grouped Quarry with security
despite its MEV/markets nature, to keep the folder's identity intact.

## 2026-05-27 — sudo make me a sandwich gets the ceremony it deserves #decision #quote

The hidden `sudo make me a sandwich` response was a single `okay.` line.
Feedback: "the terminal should do more than just respond okay." Replaced
with a 30-beat streamed ceremony — `[sudo] password` prompt, fake apt
prep + dependency lines, six `get:N pantry/stable <pkg> [ok]` install
rows, six `[████████████████] step 100%` assembly bars, an eight-line
ASCII layered sandwich rendered as `banner` entries (cyan, glow, no
wrap), and a final green `✓ sandwich ready. bon appétit.` Runs ~4.7 s
end to end. Implemented as `playSandwichCeremony()` — schedules each
beat with `setTimeout` into `setLog`, tracks timer ids in a ref so an
unmount mid-show doesn't setState on a torn-down component.

## 2026-05-25 — Wave idle outline: the probe was killing its own visibility test #incident #pivot

Twelve commits debugging "screens at world X=±4.5" before realising the
AGGRESSIVE PROBE's `obj.scale.set(5,5,5)` was the cause, not the symptom.
`M_Screen` meshes have Blender's "Apply Transforms" baked into vertices
(geometry at the rack-face world coords, node translation 0,0,0), so
scale=5 pushed vertices ~28 m past the mesh origin — outside the frustum.
`obj.getWorldPosition()` returns the mesh origin, *not* where pixels render;
the chase relied on the wrong mental model the entire time. Second pivot
once the math worked: the screen plane is 81° off-perpendicular to the
portrait camera at every scroll position, so the emissive pulse projects
to ~11 px and disappears into StatusLED glare. Replaced with an
inverted-hull rim-light outline on each `Rack_<id>` (fresnel falloff,
0.10 m thickness, additive blend, per-project accent) — silhouette-traced,
reads from any camera angle.

## 2026-05-23 — Wave reframed as a spotlight, not a ripple #decision

The idle-attractor was originally a soft synchronous pulse across all
racks. Switched to slot-staggered with `WAVE_DIM_MULTIPLIER=0.3` /
`WAVE_BRIGHT_MULTIPLIER=1.7`: non-pulsing racks visibly dim, the pulsing
one peaks above hover. The 5–6× spread between dim and bright is what
makes the moving spotlight read as *motion* rather than "everything got
a little brighter for a second."

## 2026-05-22 — Aisle traversal: virtual scroll, not page scroll #decision #pivot

iOS Safari momentum-scrolled the body and un-pinned the `position: fixed`
canvas wrapper, so the scene visibly slid up the screen during
deceleration. Independently reframed the UX problem: a real scrollbar
reads as "scrolling a tall page," but the design intent is "walking down
an aisle." `aisleScroll` now captures wheel + touchmove events and feeds
a virtual progress [0, 1]; the page itself stays `overflow: hidden`.
`AisleScrollRig` plays the captured input back into camera-pose lerps.

## 2026-05-22 — Portrait amphitheater glb retired #pivot

Portrait viewports originally loaded a separate tiered-amphitheater glb.
Read as a cramped column with overlapping racks and stacked labels — the
model exported fine but landed wrong in a narrow vertical frame. Switched
to loading the same landscape scene on both variants and reframing the
camera per viewport. `applyAisleLayout()` does the runtime reparenting
that turns the wall-mounted landscape composition into a single corridor
for portrait.

## 2026-05-20 — Demo suite built on Playwright BDD, fighting drei's re-portaling #decision #incident

Added the Gherkin demo recorder from the CLAUDE.md baseline — but two
drei-specific things broke the obvious approach. The rack-label CSS animation
never stops translating, so Playwright's actionability check on a clickable
element timed out forever; the hooks now freeze that animation pre-mount.
Worse, drei's `<Html>` re-portals on every animation frame, so `.click()` kept
hitting "element is detached." Worked around it by dispatching a synthetic
`MouseEvent` via `.evaluate()` instead of clicking. Shipped the demo suite
only (single worker, slowMo 1000, two warmup scenarios to absorb the known
0-byte-first-video bug); the QA suite can fold in later. The hero walkthrough
is a ~2-min recruiter path: boot → click a rack → close → open the terminal →
ping.

## 2026-05-19 — First docs baseline + the amphitheater portrait experiment #decision

Backfilled the repo storefront — MIT LICENSE at root (so GitHub's sidebar chip
detects it), README with the light/dark SVG banner, shields.io badges, and a
Mermaid sequence diagram of the click→panel flow; CONTRIBUTING with the glTF
export contract and perf budget as explicit guardrails. Same day, took a first
swing at narrow viewports: a separate tiered-amphitheater glb
(`server-room-portrait.glb`) with quant racks in front, swe behind rotated −90°
so the faces point camera-side, plus eight pulsing background tower
silhouettes. `useSceneVariant` watches `matchMedia` and loads the matching
scene. Both glbs share the same `anchor_<id>` / `Rack_<id>` naming so the click
resolver and camera rig don't care which one loaded. The amphitheater didn't
survive contact with a real phone — see the 2026-05-22 retirement.

## 2026-05-17 — Placeholder projects swapped for the real six builds #decision #milestone

The six rack slots had been carrying names from an early planning conversation
(imc-prosperity, capitol-alpha, naijatank…). Repointed them at the actual
completed projects in CS/Projects/Quant and SWE — EconOS, OCaml LOB, qforge on
the back wall; MicroMatch, STAIJA, StudySprint on the left — each with a working
live demo and verified repo link. Dropped gdrive-office-mcp because the user
filtered for "completed" only. The non-mechanical part was renaming every
per-project object inside `server-room.blend` (Rack_, Screen_, anchor_,
StatusLED_, the bake materials) via a Blender CLI script and re-exporting, so
the click resolver and anchor lookup kept resolving against the new ids without
any React change. SSR semantic content and the rack callout labels both rebuild
from `projects.ts`, so they picked up the new names for free.

## 2026-05-13 — Made the 3D scene legible to machines (SSR + a real OG card) #decision

The whole site was one WebGL canvas, which meant Googlebot, ChatGPT browsing,
Slack unfurls, and screen readers all saw essentially nothing. Fixed it in
layers: a screen-reader-only `<main>` carrying the full portfolio as semantic
HTML, a Person JSON-LD block in `index.html`, then SSR'd the lot at build time
via a Vite `transformIndexHtml` plugin (`semanticHtml.ts` is a pure string
generator off `projects.ts` + `experience.ts`) so JS-disabled crawlers get
everything at first byte — `dist/index.html` went 0.99 KB → 8.54 KB. Dropped
the client-side `<SemanticContent>` component to avoid a double-DOM/hydration
mismatch; the build-time injection is the single source. Also rendered the
first real OG card: a headless Blender script (`render_og.py`) opens the
.blend, shoots 1200×630 Eevee, and writes the social card — no more pointing
`og:image` at the favicon.

## 2026-05-09 — The click chain didn't work because Three.js strips dots from node names #incident

Racks were unclickable and the camera never flew. Root cause: GLTFLoader strips
`.` from node names because it reserves dots for animation property paths
(`THREE.PropertyBinding`), so Blender's `anchor.imc-prosperity` arrived in the
browser as `anchorimc-prosperity`. The `anchor.` prefix match returned an empty
Map and the `^(Rack|Screen)\.(.+)$` regex never fired — only `Monitor` worked,
because it has no separator. Switched the whole naming convention from dot to
underscore (`Rack_foo`, `anchor_foo`), renamed the objects in the .blend in
place, and wrote the gotcha into `docs/blender-contract.md` so a future export
doesn't regress it. This is the commit where the portfolio first became
navigable: `clickResolver` walks up to the nearest meaningful ancestor and
`CameraRig` lerps the camera to the anchor while orbit is locked.

## 2026-05-09 — First real Blender geometry + keeping cyan cyan under ACES #decision #milestone

Replaced the procedural stand-in racks with the first real `server-room.glb`
(21 KB) modeled through the Blender Lab MCP — floor, central terminal desk with
a tilted monitor, three racks on the back wall and three on the left, each
carrying an emissive screen and an `anchor_<id>` Empty. The .blend stays on
disk (binary, gitignored); only the exported glb is committed. Hit the first
real rendering gotcha immediately: the emissive screens rendered pastel because
Filmic/ACES tonemapping desaturates strong chroma even at strength 1.0. Rather
than reach for a postprocessing pass, set `toneMapped = false` on just the
`M_Screen` / `M_Monitor` materials after load — ACES keeps its cinematic grip on
the rack bodies and floor, while the screens display their literal `#4cf2ff`.
Smallest possible fix. (The curved monitor's GLSL data-swarm shader landed the
same day — a 5-octave domain-warped FBM particle field, also `toneMapped:
false` so the peaks survive.)

## 2026-05-09 — Tore down the static site and rebuilt as a 3D server room #pivot #decision

Archived the entire 2024 static portfolio under `archive/` and scaffolded a
Vite + React 18 + R3F rebuild — the "High-Frequency Server Room" concept, where
the whole site is a single 3D scene framed by a terminal boot loader and a HUD,
and each rack is a project. The key early decision was to exercise the Blender
export pipeline end-to-end before any .glb existed: the stand-in geometry
already carried `anchor.<id>` Empties matching `Project.anchor`, and
`docs/blender-contract.md` pinned the export contract (anchor naming, axis
convention, lighting bake, geometry budget) up front. Kept the CNAME, favicon,
and resume at the root so the live domain didn't blink during the rewrite.

## 2025-08-28 — Last update to the static site: STAIJA experience #milestone

Added a STAIJA work-experience section to the old static portfolio, refreshed
project images, and tuned the responsive/hover CSS. This turned out to be the
final commit to the carousel-based site — eight months later it got archived
for the 3D rebuild. Worth noting the long quiet stretch on either side: the
static site was effectively "done" and only got touched when something real
changed (a new role, a project link).

## 2025-06-10 — Domain switched from naijatank.me to yinkavaughan.me #decision

The site originally shipped on `naijatank.me` (the handle behind the early
projects). Deleted that CNAME in May, then re-pointed at `yinkavaughan.me` —
moving the personal site under the actual name rather than a project handle.
The domain has survived every rebuild since; the 2026 R3F scaffold deliberately
kept the CNAME at the root so the switch never had to happen twice.

## 2024-12-13 — The original static portfolio #milestone

First version of the site: a hand-written HTML/CSS/vanilla-JS portfolio titled
"Olayinka's Portfolio." Over its first two days it grew a project carousel
(tags linked to project sections), a dark-mode toggle with hue-rotated SVG
icons, social/contact links with clipboard-copy, and a favicon. A clean,
conventional developer portfolio — and the baseline the 2026 server-room
concept was a deliberate reaction against.
