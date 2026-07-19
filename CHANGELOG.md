# Changelog

## Unreleased

- Runtime setters for the remaining constructor options: setPalette,
  setBackground (including to and from transparent), setTooltip. Every
  option can now change without recreating the scene.
- groundColor option and setGroundColor: the floor disc takes any CSS
  color, so the range can read as turf instead of the dark theme.
- Options catalog: every option value as a still or GIF captured from
  identical fixture shots. Built by `npm run catalog` and committed:
  docs/CATALOG.md for the repo, docs/catalog/ for the page deployed
  with the demo. CI regenerates it as a PR artifact.

## 0.1.1 (2026-07-19)

- Expose ./package.json in the exports map. Tooling that reads package
  metadata (bundler plugins, version probes) no longer gets blocked by
  ERR_PACKAGE_PATH_NOT_EXPORTED.

## 0.1.0 (2026-07-19)

First release.

- Core ShotScene: measured-trajectory rendering with centripetal
  Catmull-Rom tracers, orbit camera with ground clamp, driving-range
  floor with distance arcs, hover tooltips, click selection.
- Studio and showcase modes. Replay reconstructs per-shot timing from
  ball speed and hang time (exponential speed decay).
- Volley and sequence playback, scrub, speed multiplier, loop.
- Bounce and rollout points clip at carry by default; rollout option.
- Camera presets: broadcast, behind, side, top, green.
- Color by club, session, or index; validated dark-mode palette;
  explicit per-shot color override.
- Meters and yards display units.
- captureFrame() for deterministic stills (drives the README media).
- TrackMan adapter at golf-shot-viz/trackman.
- React wrapper at golf-shot-viz/react.
