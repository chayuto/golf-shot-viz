# golf-shot-viz

3D golf shot visualizer for measured launch monitor trajectories.

[![npm](https://img.shields.io/npm/v/golf-shot-viz)](https://www.npmjs.com/package/golf-shot-viz)
[![CI](https://github.com/chayuto/golf-shot-viz/actions/workflows/ci.yml/badge.svg)](https://github.com/chayuto/golf-shot-viz/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/golf-shot-viz)](./LICENSE)

![Studio mode, 29 real range shots colored by club](https://raw.githubusercontent.com/chayuto/golf-shot-viz/main/docs/media/hero.png)

Feed it flight paths from a launch monitor and it renders them in an
interactive Three.js scene. Orbit camera, hover metadata, replay
playback with reconstructed timing. Every shot in these images is a
real measured trajectory, not a simulation.

**[Live demo](https://chayuto.github.io/golf-shot-viz)**

Reference consumer: [swing-stack](https://github.com/chayuto/swing-stack),
a launch monitor telemetry dashboard. This library was extracted from it
and powers its 3D shot view, installed from npm like any other dependency.

## Why this exists

Open source golf 3D projects are simulators. They take launch
parameters and compute physics. If you own launch monitor data, the
flight is already measured. This library draws the measured points and
skips physics entirely. That makes it small, and it makes the output
true to what actually happened.

## Replay

Every ball launches at once (volley) or staggered (sequence). Each
shot flies with its own reconstructed timing, so fast balls visibly
outpace slow ones and land in carry order.

![Volley replay, every shot launching at once](https://raw.githubusercontent.com/chayuto/golf-shot-viz/main/docs/media/volley.gif)

![Sequence replay of one club](https://raw.githubusercontent.com/chayuto/golf-shot-viz/main/docs/media/sequence.gif)

Trajectories carry no per-point timestamps, but two anchors are
measured: ball speed at launch and hang time. Playback models speed as
v(t) = v0 &middot; e^(-kt) and solves k so the distance integral over
the hang time equals the spline arc length. Shots missing either
anchor fall back to a mild ease-out.

## Views

| Top (dispersion) | Side (gapping and apex) |
| --- | --- |
| ![Top-down dispersion view](https://raw.githubusercontent.com/chayuto/golf-shot-viz/main/docs/media/top.png) | ![Side view](https://raw.githubusercontent.com/chayuto/golf-shot-viz/main/docs/media/side.png) |

## Install

```sh
npm install golf-shot-viz three
```

`three` is a peer dependency (>= 0.160). ESM only.

## Quick start

```ts
import { ShotScene } from 'golf-shot-viz'

const scene = new ShotScene(document.querySelector('#viz'), {
  mode: 'studio',
  colorBy: 'club',
})

scene.setShots([
  {
    id: 'shot-1',
    // [downrange, height, side] in meters, Y-up
    points: [[0, 0, 0], [50, 15, -1], [100, 25, -3], [154, 0, -6]],
    meta: { club: '7 Iron', carry: 154.2, ballSpeed: 55.2, hangTime: 5.5 },
  },
])

scene.play({ order: 'volley' })
```

The container just needs a size. Zero config renders a sensible scene;
every option is optional.

## TrackMan data

```ts
import { ShotScene } from 'golf-shot-viz'
import { fromTrackman } from 'golf-shot-viz/trackman'

const scene = new ShotScene(container)
scene.setShots(fromTrackman(reportJson))
```

`fromTrackman` reads a TrackMan report export (the JSON with
`StrokeGroups`). It extracts trajectories, ball metrics, and the static
loft club fingerprint. Exports carry no club names, so map loft to
labels yourself:

```ts
fromTrackman(reportJson, {
  club: (loftDeg) => (loftDeg === null ? undefined : myClubTable[loftDeg]),
})
```

The adapter never reads player fields. Names and emails in the export
stay out of the output by construction. Still, treat raw exports as
private data and keep them out of version control.

TrackMan is a trademark of TrackMan A/S. This project is not
affiliated with or endorsed by TrackMan.

## React

```tsx
import { useRef } from 'react'
import { GolfShotViz } from 'golf-shot-viz/react'
import type { GolfShotVizHandle } from 'golf-shot-viz/react'

function ShotPanel({ shots }) {
  const viz = useRef<GolfShotVizHandle>(null)
  return (
    <div style={{ height: 480 }}>
      <GolfShotViz ref={viz} shots={shots} colorBy="club" />
      <button onClick={() => viz.current?.scene?.play({ order: 'volley' })}>
        Replay
      </button>
    </div>
  )
}
```

Declarative props for shots and options, the ref handle for playback
commands. Client-side only (WebGL).

## Data format

```ts
interface ShotInput {
  id: string
  /** [downrange, height, side] in meters, Y-up */
  points: [number, number, number][]
  /** any CSS color; overrides colorBy assignment */
  color?: string
  meta?: {
    club?: string
    session?: string
    carry?: number         // meters
    totalDistance?: number // meters
    apex?: number          // meters
    ballSpeed?: number     // m/s, drives replay timing
    hangTime?: number      // seconds, drives replay timing
    launchAngle?: number   // degrees
    spinRate?: number      // rpm
  }
}
```

Adapters for other monitors (Garmin, Mevo, GCQuad) are one pure
function from an export to `ShotInput[]`. Contributions welcome, the
TrackMan adapter is the template.

## Options

| Option | Default | Values |
| --- | --- | --- |
| `mode` | `'studio'` | `'studio'` static view, `'showcase'` replay |
| `units` | `'meters'` | `'meters'`, `'yards'` (display only) |
| `colorBy` | `'club'` | `'club'`, `'session'`, `'index'` |
| `cameraPreset` | `'broadcast'` | `'broadcast'`, `'behind'`, `'side'`, `'top'`, `'green'` |
| `palette` | built-in | ordered CSS colors, CVD-validated default |
| `background` | `'#0b0e14'` | CSS color, or `null` for transparent |
| `tooltip` | `true` | built-in hover tooltip |
| `autoRotate` | `false` | slow idle orbit |
| `rollout` | `false` | render measured bounce and rollout past carry |

## API

```ts
scene.setShots(shots)
scene.play({ order: 'volley' | 'sequence', speed, loop, stagger })
scene.pause(); scene.resume(); scene.stop()
scene.seek(0.5)          // scrub the master timeline
scene.setSpeed(2)
scene.setMode('showcase')
scene.setUnits('yards')
scene.setColorBy('session')
scene.setCameraPreset('top')
scene.setRollout(true)
scene.select('shot-id')  // dim everything else
scene.legend             // [{ key, color }] for building a legend UI
scene.playback           // { playing, time, duration, progress }
scene.captureFrame()     // PNG data URL of the current view
scene.dispose()

const off = scene.on('hover', (shot) => {})
scene.on('select', (shot) => {})
scene.on('playback', (state) => {})
```

## Visual QA

The media in this README is generated, not hand-captured:

```sh
npm run visuals
```

drives the demo page headlessly (Playwright), seeks the scene to
deterministic states through the public API, and writes stills and
GIFs to `docs/media/`. Run it after any visual change and eyeball the
diff. CI uploads the same output as an artifact on every PR, so
rendering regressions show up in review.

## Development

```sh
npm run dev         # demo page with live reload
npm test            # unit tests (timing solver, adapter, palette, spline)
npm run lint
npm run typecheck
npm run build       # ESM + d.ts to dist/
npm run visuals     # regenerate README media
```

The demo fixtures are real TrackMan range sessions scrubbed to
trajectories, club labels, and numeric metrics only.

## License

MIT
