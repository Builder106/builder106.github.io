# JOURNAL — Olayinka Vaughan portfolio

> Dated log of decisions, pivots, incidents, and quotes. Add entries as
> things happen — retrospectives need this raw material to land. Reverse
> chronological. Tags: #decision #pivot #incident #quote #feedback #milestone.

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

<!-- Add new entries above this line. Older entries (initial scaffolding,
     first 3D scene, terminal rebuild, etc.) can be backfilled here when
     human-context worth capturing surfaces. -->
