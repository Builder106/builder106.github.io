# Coverage Boundary

The Vitest 100% gate covers deterministic data and scene-state modules: project
metadata, generated repository statistics, panel state types, aisle scrolling,
and click resolution.

The WebGL scene graph, Three.js materials, canvas bootstrap, and DOM lifecycle
components are integration-test scope. They require a browser and a rendering
context, so they are validated by the Playwright E2E suites rather than the
unit-coverage gate.
