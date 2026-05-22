// Discriminated union for "which panel is currently open." Lives in
// its own module (no three.js dependency) so App can import the type
// without pulling Vector3 + the rest of three into the initial bundle.
// Scene + CameraRig translate this into actual camera target vectors
// inside the lazy-loaded Scene chunk.
export type ActivePanel =
  | { kind: "none" }
  | { kind: "terminal" }
  | { kind: "project"; projectId: string }
  | { kind: "contact" };
