# JOURNAL — Olayinka Vaughan portfolio

> Dated log of decisions, pivots, incidents, and quotes. Add entries as
> things happen — retrospectives need this raw material to land. Reverse
> chronological. Tags: #decision #pivot #incident #quote #feedback #milestone.

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
