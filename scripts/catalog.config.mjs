// The catalog variant matrix. scripts/catalog.mjs walks this, captures
// one image per variant, and generates the catalog page from it. Add an
// entry here when an option gains a value and the page stays complete.
//
// Every variant starts from RESET, so within a group the only thing
// that changes is the option itself. Setups run in the demo page and
// go through the public ShotScene API only.

export const RESET = `
  window.__gsv.scene.setShots(window.__gsv.fixtures)
  window.__gsv.scene.setMode('studio')
  window.__gsv.scene.setCameraPreset('broadcast', false)
  window.__gsv.scene.setUnits('meters')
  window.__gsv.scene.setColorBy('club')
  window.__gsv.scene.setPalette(window.__gsv.defaultPalette)
  window.__gsv.scene.setBackground('#0b0e14')
  window.__gsv.scene.setRollout(false)
  window.__gsv.scene.setAutoRotate(false)
  window.__gsv.scene.select(null)
`

// Mid-volley: most balls airborne, tracer heads visible.
const MID_REPLAY = `
  window.__gsv.scene.play({ order: 'volley' })
  window.__gsv.scene.pause()
  window.__gsv.scene.seek(0.45)
`

export const GROUPS = [
  {
    option: 'mode',
    note: 'studio draws every full trajectory for analysis. showcase is the replay view; trajectories reveal over time. Shown mid volley replay.',
    variants: [
      { name: 'studio', isDefault: true, setup: '' },
      { name: 'showcase', setup: MID_REPLAY },
    ],
  },
  {
    option: 'cameraPreset',
    note: 'Framing presets sized to the data extent. Also settable at runtime with setCameraPreset, which flies the camera over.',
    variants: [
      { name: 'broadcast', isDefault: true, setup: '' },
      { name: 'behind', setup: `window.__gsv.scene.setCameraPreset('behind', false)` },
      { name: 'side', setup: `window.__gsv.scene.setCameraPreset('side', false)` },
      { name: 'top', setup: `window.__gsv.scene.setCameraPreset('top', false)` },
      { name: 'green', setup: `window.__gsv.scene.setCameraPreset('green', false)` },
    ],
  },
  {
    option: 'colorBy',
    note: 'How tracer colors are assigned when shots carry no explicit color. club and session take fixed palette slots in order of first appearance. index cycles the palette per shot.',
    variants: [
      { name: 'club', isDefault: true, setup: '' },
      { name: 'session', setup: `window.__gsv.scene.setColorBy('session')` },
      { name: 'index', setup: `window.__gsv.scene.setColorBy('index')` },
    ],
  },
  {
    option: 'palette',
    note: 'Ordered categorical colors, any CSS color. The default is CVD-validated for dark surfaces. Keys beyond the palette length render gray instead of cycling.',
    variants: [
      { name: 'default', isDefault: true, setup: '' },
      {
        name: 'custom',
        caption: 'a warm custom palette',
        setup: `window.__gsv.scene.setPalette(['#f2c14e', '#e4572e', '#76b041', '#17bebb', '#a882dd'])`,
      },
    ],
  },
  {
    option: 'background',
    note: 'Scene background as a CSS color, or null for a transparent canvas over whatever the page draws behind it. Fog matches the background color.',
    variants: [
      { name: 'default', isDefault: true, caption: `'#0b0e14'`, setup: '' },
      {
        name: 'light',
        caption: `'#eef2f7'`,
        setup: `window.__gsv.scene.setBackground('#eef2f7')`,
      },
      {
        name: 'transparent',
        caption: 'null, shown on a checkerboard',
        transparent: true,
        setup: `window.__gsv.scene.setBackground(null)`,
      },
    ],
  },
  {
    option: 'units',
    note: 'Display units for the ground distance arcs and tooltips. Data stays meters either way.',
    variants: [
      { name: 'meters', isDefault: true, setup: '' },
      { name: 'yards', setup: `window.__gsv.scene.setUnits('yards')` },
    ],
  },
  {
    option: 'rollout',
    note: 'Off clips each trajectory at the first touchdown, so what you see is carry. On renders the measured bounce and rollout points past it.',
    variants: [
      { name: 'false', isDefault: true, setup: '' },
      { name: 'true', setup: `window.__gsv.scene.setRollout(true)` },
    ],
  },
  {
    option: 'autoRotate',
    note: 'Slow idle orbit around the scene. Good for kiosk or hero placements.',
    variants: [
      {
        name: 'true',
        kind: 'gif-realtime',
        seconds: 5,
        caption: 'orbit speed as captured, not exact',
        setup: `window.__gsv.scene.setAutoRotate(true)`,
      },
    ],
  },
  {
    option: 'play order',
    api: `play({ order })`,
    note: 'volley launches every shot at once; fast balls visibly outpace slow ones. sequence staggers launches. Both GIFs are time-compressed.',
    variants: [
      {
        name: 'volley',
        isDefault: true,
        kind: 'gif-seek',
        seconds: 5,
        setup: `
          window.__gsv.scene.play({ order: 'volley' })
          window.__gsv.scene.pause()
        `,
      },
      {
        name: 'sequence',
        kind: 'gif-seek',
        seconds: 8,
        setup: `
          window.__gsv.scene.play({ order: 'sequence', stagger: 0.8 })
          window.__gsv.scene.pause()
        `,
      },
    ],
  },
  {
    option: 'select',
    api: `select(id)`,
    note: 'Selecting a shot dims the rest. Click a tracer or call select(id); select(null) clears.',
    variants: [
      {
        name: 'selected',
        caption: 'one shot selected',
        setup: `window.__gsv.scene.select(window.__gsv.scene.shots[8].id)`,
      },
    ],
  },
]

// Options with no useful still or GIF. Listed on the page so the
// catalog stays a complete map of the API surface.
export const NOT_PICTURED = [
  { option: 'tooltip', note: 'Built-in hover card with club, carry, apex, ball speed. A DOM overlay, so it only shows live. Try it in the demo.' },
  { option: 'speed', note: 'Playback rate multiplier. play({ speed }) or setSpeed().' },
  { option: 'loop', note: 'Restart the replay when it ends. play({ loop: true }).' },
  { option: 'stagger', note: 'Seconds between launches in sequence order. Default 1.2.' },
]
