import {
  CircleGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector2,
} from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import type { ShotPath } from './spline'

/** Invisible-to-camera layer holding the fat raycast tubes. */
export const PICK_LAYER = 3

const LINE_WIDTH = 2.5
const LINE_WIDTH_HOVER = 4.5
const FULL_OPACITY = 0.95
const DIM_OPACITY = 0.14

/**
 * Everything rendered for one shot: the Line2 tracer, a generous
 * raycast tube on the pick layer, the flying ball, and a landing dot.
 */
export class Tracer {
  readonly group = new Group()
  private line: Line2
  private lineMaterial: LineMaterial
  private ball: Mesh<SphereGeometry, MeshStandardMaterial>
  private landing: Mesh<CircleGeometry, MeshBasicMaterial>
  private pick: Mesh
  private segments: number

  constructor(
    readonly shotId: string,
    readonly path: ShotPath,
    color: string,
    resolution: Vector2,
  ) {
    const positions: number[] = []
    for (const p of path.sampled) positions.push(p.x, p.y, p.z)
    const geometry = new LineGeometry()
    geometry.setPositions(positions)
    this.segments = path.sampled.length - 1

    this.lineMaterial = new LineMaterial({
      color: new Color(color).getHex(),
      linewidth: LINE_WIDTH,
      worldUnits: false,
      transparent: true,
      opacity: FULL_OPACITY,
    })
    this.lineMaterial.resolution.copy(resolution)
    this.line = new Line2(geometry, this.lineMaterial)
    this.line.computeLineDistances()

    // Raycast target: a fat invisible tube so hover does not demand
    // pixel-perfect aim. Lives on PICK_LAYER, which the camera never
    // renders and the raycaster exclusively tests.
    this.pick = new Mesh(new TubeGeometry(path.curve, 48, 1.6, 6, false), new MeshBasicMaterial())
    this.pick.layers.set(PICK_LAYER)
    this.pick.userData.shotId = shotId

    this.ball = new Mesh(
      new SphereGeometry(0.6, 20, 14),
      new MeshStandardMaterial({
        color: new Color(color),
        emissive: new Color(color),
        emissiveIntensity: 0.4,
      }),
    )
    this.ball.visible = false

    this.landing = new Mesh(
      new CircleGeometry(1.1, 24),
      new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity: 0.8 }),
    )
    this.landing.rotation.x = -Math.PI / 2
    const end = path.sampled[path.sampled.length - 1]
    this.landing.position.set(end.x, 0.04, end.z)

    this.group.add(this.line, this.pick, this.ball, this.landing)
  }

  /** Studio: full tracer, landing dot, no ball. */
  showFull(): void {
    ;(this.line.geometry as LineGeometry).instanceCount = this.segments
    this.ball.visible = false
    this.landing.visible = true
  }

  /**
   * Showcase: tracer drawn up to arc fraction u with the ball at its
   * tip. The ball stays resting at the landing point once u reaches 1.
   */
  setProgress(u: number): void {
    const clamped = u < 0 ? 0 : u > 1 ? 1 : u
    ;(this.line.geometry as LineGeometry).instanceCount = Math.round(clamped * this.segments)
    this.landing.visible = false
    this.ball.visible = clamped > 0
    if (clamped > 0) {
      this.ball.position.copy(this.path.curve.getPointAt(clamped))
    }
  }

  setColor(color: string): void {
    const c = new Color(color)
    this.lineMaterial.color.set(c)
    this.ball.material.color.set(c)
    this.ball.material.emissive.set(c)
    this.landing.material.color.set(c)
  }

  setDimmed(dimmed: boolean): void {
    this.lineMaterial.opacity = dimmed ? DIM_OPACITY : FULL_OPACITY
    this.landing.material.opacity = dimmed ? DIM_OPACITY : 0.8
    this.ball.material.transparent = dimmed
    this.ball.material.opacity = dimmed ? DIM_OPACITY : 1
  }

  setHovered(hovered: boolean): void {
    this.lineMaterial.linewidth = hovered ? LINE_WIDTH_HOVER : LINE_WIDTH
  }

  setResolution(resolution: Vector2): void {
    this.lineMaterial.resolution.copy(resolution)
  }

  get pickObject(): Mesh {
    return this.pick
  }

  dispose(): void {
    this.line.geometry.dispose()
    this.lineMaterial.dispose()
    this.pick.geometry.dispose()
    ;(this.pick.material as MeshBasicMaterial).dispose()
    this.ball.geometry.dispose()
    this.ball.material.dispose()
    this.landing.geometry.dispose()
    this.landing.material.dispose()
    this.group.removeFromParent()
  }
}
