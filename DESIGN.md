# Design notes

## Panels: the KVM drawer

Idea: every panel is the console drawer of the rack you clicked.
Metaphor: a rack-mount KVM console, the pull-out screen and switch that real server racks carry.
Signature: the 1U drawer front rolls out, then the screen hinges up on its lower edge.
Motion verb: slides out on rails, hinges up. Closing folds the screen and pulls the drawer back.
Structure: screen (content) over a hinge over a 1U drawer front. The front holds the label-maker tag (title), the KVM port keys (one per rack, LED in the rack's colour), prev/next keys and the eject key (close).
Escape hatch: the port keys and prev/next reach every rack; the mirrored HTML index under the canvas lists them all.

Assets: `blend/kvm_parts.py` renders the ears, handles, faceplate, bezel, hinge and keys in the racks' powder coat. Output goes to `public/img/kvm`. Rerender rather than drawing hardware in CSS.

Rules:
- Light comes from the screen (a faint backlight in the accent colour), never from a neon frame or glowing text.
- The OSD tag in the screen corner shows the port and wing; panels with no port leave it out.
- The room dims behind an open drawer; clicking the dim closes it.
- Phones: the drawer rises from the bottom edge, ears, handles and port keys drop out, prev/next and eject stay in thumb reach.
- Reduced motion: no slide, no hinge, opacity only.
