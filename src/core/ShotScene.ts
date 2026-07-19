import {
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Material,
  Mesh,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Sprite,
  Vector2,
  Vector3,
  WebGLRenderer,
  SRGBColorSpace,
  Line,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type {
  CameraPreset,
  ColorBy,
  LegendEntry,
  PlaybackState,
  PlayOptions,
  SceneMode,
  ShotInput,
  ShotSceneEvents,
  ShotSceneOptions,
  Units,
} from '../types'
import { Emitter } from './emitter'
import { assignColors, DEFAULT_PALETTE, type ColorAssignment } from './palette'
import { buildGround } from './ground'
import { buildPath, clipToCarry } from './spline'
import { buildTimeline, type Timeline } from './timing'
import { presetView, type SceneExtent } from './camera'
import { Tracer, PICK_LAYER } from './tracer'
import { Tooltip } from './tooltip'

interface Entry {
  shot: ShotInput
  index: number
  tracer: Tracer
  timeline: Timeline
  /** Launch offset on the master timeline, seconds. */
  start: number
}

interface CameraFlight {
  fromPosition: Vector3
  toPosition: Vector3
  fromTarget: Vector3
  toTarget: Vector3
  elapsed: number
  duration: number
}

interface ResolvedOptions {
  mode: SceneMode
  units: Units
  colorBy: ColorBy
  cameraPreset: CameraPreset
  palette: string[]
  background: string | null
  tooltip: boolean
  autoRotate: boolean
  rollout: boolean
}

const DEFAULT_OPTIONS: ResolvedOptions = {
  mode: 'studio',
  units: 'meters',
  colorBy: 'club',
  cameraPreset: 'broadcast',
  palette: DEFAULT_PALETTE,
  background: '#0b0e14',
  tooltip: true,
  autoRotate: false,
  rollout: false,
}

const DEFAULT_STAGGER = 1.2
const CLICK_SLOP_PX = 5

/**
 * The 3D scene. Attach to a sized container, feed it ShotInput[], and
 * it renders measured trajectories with an orbit camera, hover
 * metadata, and replay playback. Framework free; see ./react for the
 * React wrapper.
 */
export class ShotScene {
  private container: HTMLElement
  private options: ResolvedOptions
  private renderer: WebGLRenderer
  private scene: Scene
  private camera: PerspectiveCamera
  private controls: OrbitControls
  private raycaster: Raycaster
  private tooltip: Tooltip | null
  private emitter = new Emitter<ShotSceneEvents>()
  private lastTick = performance.now()
  private resizeObserver: ResizeObserver
  private resolution = new Vector2(1, 1)

  private entries: Entry[] = []
  private lastInputs: ShotInput[] = []
  private assignment: ColorAssignment = { colorOf: () => '#8b93a1', legend: [] }
  private extent: SceneExtent = { maxDistance: 100, maxHeight: 30 }
  private shotsGroup = new Group()
  private ground: Group | null = null

  private playing = false
  private time = 0
  private duration = 0
  private speed = 1
  private loop = false
  private playOrder: Required<PlayOptions>['order'] = 'volley'
  private stagger = DEFAULT_STAGGER

  private hoveredId: string | null = null
  private selectedId: string | null = null
  private pointer = new Vector2()
  private pointerDirty = false
  private pointerDownAt: { x: number; y: number; time: number } | null = null
  private lastPointerEvent: { x: number; y: number } | null = null

  private cameraFlight: CameraFlight | null = null
  private raf = 0
  private disposed = false

  constructor(container: HTMLElement, options: ShotSceneOptions = {}) {
    this.container = container
    this.options = { ...DEFAULT_OPTIONS, ...options }

    // Alpha stays on so setBackground(null) can go transparent later.
    // With a background color set the scene paints every pixel anyway.
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = SRGBColorSpace
    const canvas = this.renderer.domElement
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative'
    }
    container.appendChild(canvas)

    this.scene = new Scene()
    this.applyBackground()
    this.scene.add(new HemisphereLight(0x94b8dc, 0x141a21, 1.1))
    const sun = new DirectionalLight(0xffffff, 1.4)
    sun.position.set(80, 140, 60)
    this.scene.add(sun)
    this.scene.add(this.shotsGroup)

    this.camera = new PerspectiveCamera(55, 1, 0.5, 2500)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04 // the camera never goes under the ground
    this.controls.minDistance = 6
    this.controls.maxDistance = 600
    this.controls.autoRotate = this.options.autoRotate
    this.controls.autoRotateSpeed = 0.5

    this.raycaster = new Raycaster()
    this.raycaster.layers.set(PICK_LAYER)
    this.tooltip = this.options.tooltip ? new Tooltip(container) : null

    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointerleave', this.onPointerLeave)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
    this.applyCameraPreset(this.options.cameraPreset, false)
    this.raf = requestAnimationFrame(this.tick)
  }

  // ------------------------------------------------------------------ shots

  setShots(shots: ShotInput[]): void {
    this.lastInputs = shots
    const usable = shots.filter((s) => s.points.length >= 2)
    if (usable.length < shots.length) {
      console.warn(
        `golf-shot-viz: skipped ${shots.length - usable.length} shot(s) with fewer than 2 trajectory points`,
      )
    }

    for (const entry of this.entries) entry.tracer.dispose()
    this.entries = []
    this.hoveredId = null
    this.selectedId = null
    this.tooltip?.hide()

    this.assignment = assignColors(usable, this.options.colorBy, this.options.palette)
    let maxDistance = 0
    let maxHeight = 0
    this.entries = usable.map((shot, index) => {
      const path = buildPath(this.options.rollout ? shot.points : clipToCarry(shot.points))
      for (const p of path.sampled) {
        maxDistance = Math.max(maxDistance, Math.hypot(p.x, p.z))
        maxHeight = Math.max(maxHeight, p.y)
      }
      const tracer = new Tracer(shot.id, path, this.assignment.colorOf(shot, index), this.resolution)
      this.shotsGroup.add(tracer.group)
      return {
        shot,
        index,
        tracer,
        timeline: buildTimeline(path.length, shot.meta),
        start: 0,
      }
    })
    this.extent = {
      maxDistance: Math.max(60, maxDistance),
      maxHeight: Math.max(15, maxHeight),
    }

    this.rebuildGround()
    this.planPlayback()
    this.applyCameraPreset(this.options.cameraPreset, false)

    if (this.options.mode === 'studio') {
      this.applyStudio()
    } else {
      this.time = 0
      this.playing = this.entries.length > 0
      this.applyPlaybackFrame()
    }
    this.emitPlayback()
  }

  get shots(): ShotInput[] {
    return this.entries.map((e) => e.shot)
  }

  get legend(): LegendEntry[] {
    return this.assignment.legend
  }

  // --------------------------------------------------------------- playback

  play(options: PlayOptions = {}): void {
    if (this.options.mode !== 'showcase') this.setModeInternal('showcase', false)
    if (options.order !== undefined) this.playOrder = options.order
    if (options.speed !== undefined) this.speed = options.speed
    if (options.loop !== undefined) this.loop = options.loop
    if (options.stagger !== undefined) this.stagger = options.stagger
    this.planPlayback()
    this.time = 0
    this.playing = this.entries.length > 0
    this.applyPlaybackFrame()
    this.emitPlayback()
  }

  pause(): void {
    if (!this.playing) return
    this.playing = false
    this.emitPlayback()
  }

  resume(): void {
    if (this.playing || this.options.mode !== 'showcase') return
    if (this.time >= this.duration) this.time = 0
    this.playing = this.entries.length > 0
    this.emitPlayback()
  }

  stop(): void {
    this.playing = false
    this.time = 0
    if (this.options.mode === 'showcase') this.applyPlaybackFrame()
    this.emitPlayback()
  }

  /** Scrub to a fraction [0,1] of the master timeline. Works while paused. */
  seek(progress: number): void {
    if (this.options.mode !== 'showcase') this.setModeInternal('showcase', false)
    this.time = Math.min(1, Math.max(0, progress)) * this.duration
    this.applyPlaybackFrame()
    this.emitPlayback()
  }

  setSpeed(speed: number): void {
    this.speed = speed
  }

  get playback(): PlaybackState {
    return {
      playing: this.playing,
      time: this.time,
      duration: this.duration,
      progress: this.duration > 0 ? this.time / this.duration : 0,
    }
  }

  private planPlayback(): void {
    this.entries.forEach((entry, i) => {
      entry.start = this.playOrder === 'volley' ? 0 : i * this.stagger
    })
    this.duration = this.entries.reduce(
      (max, e) => Math.max(max, e.start + e.timeline.duration),
      0,
    )
  }

  private applyPlaybackFrame(): void {
    for (const entry of this.entries) {
      entry.tracer.setProgress(entry.timeline.progressAt(this.time - entry.start))
    }
  }

  private applyStudio(): void {
    this.playing = false
    for (const entry of this.entries) entry.tracer.showFull()
  }

  // ---------------------------------------------------------------- options

  setMode(mode: SceneMode): void {
    this.setModeInternal(mode, true)
  }

  private setModeInternal(mode: SceneMode, autoplay: boolean): void {
    if (mode === this.options.mode) return
    this.options.mode = mode
    if (mode === 'studio') {
      this.applyStudio()
    } else {
      this.time = 0
      this.playing = autoplay && this.entries.length > 0
      this.applyPlaybackFrame()
    }
    this.emitPlayback()
  }

  get mode(): SceneMode {
    return this.options.mode
  }

  setUnits(units: Units): void {
    if (units === this.options.units) return
    this.options.units = units
    this.rebuildGround()
  }

  setColorBy(colorBy: ColorBy): void {
    if (colorBy === this.options.colorBy) return
    this.options.colorBy = colorBy
    this.recolor()
  }

  setPalette(palette: string[]): void {
    this.options.palette = palette
    this.recolor()
  }

  setBackground(background: string | null): void {
    if (background === this.options.background) return
    this.options.background = background
    this.applyBackground()
  }

  /** Toggle the built-in hover tooltip. */
  setTooltip(tooltip: boolean): void {
    if (tooltip === Boolean(this.tooltip)) return
    if (tooltip) {
      this.tooltip = new Tooltip(this.container)
    } else {
      this.tooltip?.dispose()
      this.tooltip = null
    }
    this.options.tooltip = tooltip
  }

  private recolor(): void {
    this.assignment = assignColors(
      this.entries.map((e) => e.shot),
      this.options.colorBy,
      this.options.palette,
    )
    for (const entry of this.entries) {
      entry.tracer.setColor(this.assignment.colorOf(entry.shot, entry.index))
    }
  }

  setCameraPreset(preset: CameraPreset, animate = true): void {
    this.options.cameraPreset = preset
    this.applyCameraPreset(preset, animate)
  }

  setAutoRotate(autoRotate: boolean): void {
    this.options.autoRotate = autoRotate
    this.controls.autoRotate = autoRotate
  }

  /** Toggle measured bounce and rollout past the carry landing. */
  setRollout(rollout: boolean): void {
    if (rollout === this.options.rollout) return
    this.options.rollout = rollout
    this.setShots(this.lastInputs)
  }

  select(id: string | null): void {
    if (id === this.selectedId) return
    this.selectedId = id
    for (const entry of this.entries) {
      entry.tracer.setDimmed(id !== null && entry.shot.id !== id)
    }
    const selected = this.entries.find((e) => e.shot.id === id)
    this.emitter.emit('select', selected ? selected.shot : null)
  }

  get selected(): string | null {
    return this.selectedId
  }

  // ----------------------------------------------------------------- events

  on<K extends keyof ShotSceneEvents>(
    event: K,
    fn: (...args: ShotSceneEvents[K]) => void,
  ): () => void {
    return this.emitter.on(event, fn)
  }

  off<K extends keyof ShotSceneEvents>(
    event: K,
    fn: (...args: ShotSceneEvents[K]) => void,
  ): void {
    this.emitter.off(event, fn)
  }

  private emitPlayback(): void {
    this.emitter.emit('playback', this.playback)
  }

  // ---------------------------------------------------------------- capture

  /**
   * Render one frame and return it as a data URL. Deterministic when
   * combined with seek(), which is how the repo's README media and
   * visual QA captures are produced.
   */
  captureFrame(type = 'image/png', quality?: number): string {
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
    return this.renderer.domElement.toDataURL(type, quality)
  }

  // --------------------------------------------------------------- internal

  private applyBackground(): void {
    if (this.options.background === null) {
      this.scene.background = null
      this.scene.fog = null
      return
    }
    const bg = new Color(this.options.background)
    this.scene.background = bg
    this.scene.fog = new Fog(bg, 300, 1000)
  }

  private rebuildGround(): void {
    if (this.ground) {
      this.scene.remove(this.ground)
      disposeDeep(this.ground)
    }
    this.ground = buildGround({ maxDistance: this.extent.maxDistance, units: this.options.units })
    this.scene.add(this.ground)
  }

  private applyCameraPreset(preset: CameraPreset, animate: boolean): void {
    const view = presetView(preset, this.extent)
    if (!animate) {
      this.cameraFlight = null
      this.camera.position.copy(view.position)
      this.controls.target.copy(view.target)
      this.controls.update()
      return
    }
    this.cameraFlight = {
      fromPosition: this.camera.position.clone(),
      toPosition: view.position,
      fromTarget: this.controls.target.clone(),
      toTarget: view.target,
      elapsed: 0,
      duration: 0.8,
    }
  }

  private resize(): void {
    const width = this.container.clientWidth || 1
    const height = this.container.clientHeight || 1
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.resolution.set(width, height)
    for (const entry of this.entries) entry.tracer.setResolution(this.resolution)
  }

  private tick = (): void => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.tick)
    const now = performance.now()
    // Clamp so a background tab does not fast-forward the replay.
    const dt = Math.min(0.1, (now - this.lastTick) / 1000)
    this.lastTick = now

    if (this.cameraFlight) {
      const flight = this.cameraFlight
      flight.elapsed += dt
      const raw = Math.min(1, flight.elapsed / flight.duration)
      const eased = raw * raw * (3 - 2 * raw)
      this.camera.position.lerpVectors(flight.fromPosition, flight.toPosition, eased)
      this.controls.target.lerpVectors(flight.fromTarget, flight.toTarget, eased)
      if (raw >= 1) this.cameraFlight = null
    }
    this.controls.update()

    if (this.playing) {
      this.time += dt * this.speed
      if (this.time >= this.duration) {
        if (this.loop) {
          this.time = 0
        } else {
          this.time = this.duration
          this.playing = false
        }
      }
      this.applyPlaybackFrame()
      this.emitPlayback()
    }

    if (this.pointerDirty) {
      this.pointerDirty = false
      this.updateHover()
    }

    this.renderer.render(this.scene, this.camera)
  }

  private updateHover(): void {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(
      this.entries.map((e) => e.tracer.pickObject),
      false,
    )
    const hitId = hits.length > 0 ? (hits[0].object.userData.shotId as string) : null
    if (hitId !== this.hoveredId) {
      this.hoveredId = hitId
      for (const entry of this.entries) {
        entry.tracer.setHovered(entry.shot.id === hitId)
      }
      this.renderer.domElement.style.cursor = hitId ? 'pointer' : ''
      const entry = this.entries.find((e) => e.shot.id === hitId)
      this.emitter.emit('hover', entry ? entry.shot : null)
    }
    if (this.tooltip && this.lastPointerEvent) {
      const entry = this.entries.find((e) => e.shot.id === this.hoveredId)
      if (entry) {
        this.tooltip.show(
          entry.shot,
          this.lastPointerEvent.x,
          this.lastPointerEvent.y,
          this.options.units,
          this.assignment.colorOf(entry.shot, entry.index),
        )
      } else {
        this.tooltip.hide()
      }
    }
  }

  private onPointerMove = (event: PointerEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    this.pointer.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1)
    this.lastPointerEvent = { x, y }
    this.pointerDirty = true
  }

  private onPointerDown = (event: PointerEvent): void => {
    this.pointerDownAt = { x: event.clientX, y: event.clientY, time: performance.now() }
  }

  private onPointerUp = (event: PointerEvent): void => {
    const down = this.pointerDownAt
    this.pointerDownAt = null
    if (!down) return
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y)
    if (moved > CLICK_SLOP_PX || performance.now() - down.time > 500) return
    this.select(this.hoveredId)
  }

  private onPointerLeave = (): void => {
    this.lastPointerEvent = null
    this.tooltip?.hide()
    if (this.hoveredId !== null) {
      this.hoveredId = null
      for (const entry of this.entries) entry.tracer.setHovered(false)
      this.emitter.emit('hover', null)
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointermove', this.onPointerMove)
    canvas.removeEventListener('pointerdown', this.onPointerDown)
    canvas.removeEventListener('pointerup', this.onPointerUp)
    canvas.removeEventListener('pointerleave', this.onPointerLeave)
    this.controls.dispose()
    for (const entry of this.entries) entry.tracer.dispose()
    this.entries = []
    if (this.ground) disposeDeep(this.ground)
    this.tooltip?.dispose()
    this.emitter.clear()
    this.renderer.dispose()
    canvas.remove()
  }
}

/** Dispose every geometry, material, and texture under an object. */
function disposeDeep(root: Group): void {
  root.traverse((obj) => {
    if (obj instanceof Mesh || obj instanceof Line) {
      obj.geometry.dispose()
      const material = obj.material as Material | Material[]
      for (const m of Array.isArray(material) ? material : [material]) m.dispose()
    }
    if (obj instanceof Sprite) {
      obj.material.map?.dispose()
      obj.material.dispose()
    }
  })
  root.removeFromParent()
}
