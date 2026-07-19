# Changelog

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
