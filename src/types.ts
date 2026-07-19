/** One measured shot. Points are [downrange, height, side] in meters, Y-up. */
export interface ShotInput {
  id: string
  points: [number, number, number][]
  /** Explicit tracer color (any CSS color). Overrides colorBy assignment. */
  color?: string
  meta?: ShotMeta
}

export interface ShotMeta {
  club?: string
  session?: string
  /** meters */
  carry?: number
  /** meters */
  totalDistance?: number
  /** meters, max height of the flight */
  apex?: number
  /** meters, signed side bend */
  curve?: number
  /** m/s at launch */
  ballSpeed?: number
  /** seconds of flight */
  hangTime?: number
  /** degrees */
  launchAngle?: number
  /** rpm */
  spinRate?: number
  /** degrees, the club's static loft (TrackMan's club fingerprint) */
  staticLoft?: number
  [key: string]: unknown
}

export type SceneMode = 'studio' | 'showcase'
export type Units = 'meters' | 'yards'
export type ColorBy = 'club' | 'session' | 'index'
export type CameraPreset = 'broadcast' | 'behind' | 'side' | 'top' | 'green'
export type PlayOrder = 'volley' | 'sequence'

export interface PlayOptions {
  /** 'volley' launches every shot at t=0. 'sequence' staggers launches. */
  order?: PlayOrder
  /** Playback rate. 1 is real time. */
  speed?: number
  loop?: boolean
  /** Seconds between launches in sequence order. Default 1.2. */
  stagger?: number
}

export interface PlaybackState {
  playing: boolean
  /** Seconds into the master timeline. */
  time: number
  /** Master timeline length in seconds. */
  duration: number
  /** 0..1 of the master timeline. */
  progress: number
}

export interface LegendEntry {
  key: string
  color: string
}

export type ShotSceneEvents = {
  hover: [shot: ShotInput | null]
  select: [shot: ShotInput | null]
  playback: [state: PlaybackState]
}

export interface ShotSceneOptions {
  /** 'studio' is the static analysis view, 'showcase' the replay view. Default 'studio'. */
  mode?: SceneMode
  /** Display units for labels and tooltips. Data stays meters. Default 'meters'. */
  units?: Units
  /** How tracer colors are assigned when shots carry no explicit color. Default 'club'. */
  colorBy?: ColorBy
  cameraPreset?: CameraPreset
  /** Ordered categorical palette. Keys beyond its length render gray. */
  palette?: string[]
  /** Scene background CSS color, or null for a transparent canvas. */
  background?: string | null
  /** Built-in hover tooltip. Default true. */
  tooltip?: boolean
  /** Slow idle orbit. Default false. */
  autoRotate?: boolean
  /**
   * Render measured bounce and rollout points past the carry landing.
   * Default false: trajectories clip at the first touch down.
   */
  rollout?: boolean
}
