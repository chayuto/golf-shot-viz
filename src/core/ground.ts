import {
  BufferGeometry,
  CircleGeometry,
  Color,
  EllipseCurve,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Vector3,
} from 'three'
import type { Units } from '../types'
import { YD_PER_M } from './units'
import { makeLabel } from './labels'

export interface GroundOptions {
  /** Furthest point radius in meters. */
  maxDistance: number
  units: Units
  /** Floor disc CSS color. */
  color: string
}

export const DEFAULT_GROUND_COLOR = '#131a24'

const ARC_HALF_ANGLE = Math.PI / 5 // ±36° around the target line
const MINOR_COLOR = new Color('#2a3a4e')
const MAJOR_COLOR = new Color('#3f5878')

/**
 * Driving-range floor: dark disc, distance arcs every 25 display units
 * (labels every 50), a dashed target line, and a tee ring. Rebuilt when
 * units change so arcs sit on round numbers in the active unit.
 */
export function buildGround({ maxDistance, units, color }: GroundOptions): Group {
  const group = new Group()
  group.name = 'gsv-ground'
  const step = units === 'yards' ? 25 / YD_PER_M : 25
  const suffix = units === 'yards' ? 'yd' : 'm'
  const radius = Math.max(80, maxDistance * 1.15 + 20)

  const floor = new Mesh(
    new CircleGeometry(radius, 96),
    new MeshBasicMaterial({ color: new Color(color) }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.05
  group.add(floor)

  for (let i = 1; i * step < radius; i++) {
    const r = i * step
    const major = i % 2 === 0
    const arc = new EllipseCurve(0, 0, r, r, -ARC_HALF_ANGLE, ARC_HALF_ANGLE)
    const points = arc.getPoints(72).map((p) => new Vector3(p.x, 0.02, p.y))
    const line = new Line(
      new BufferGeometry().setFromPoints(points),
      new LineBasicMaterial({ color: major ? MAJOR_COLOR : MINOR_COLOR }),
    )
    group.add(line)
    if (major) {
      const text = i === 2 ? `${i * 25} ${suffix}` : String(i * 25)
      const label = makeLabel(text, { color: '#5f6f85', worldHeight: 3 })
      label.position.set(
        r * Math.cos(ARC_HALF_ANGLE),
        1.6,
        r * Math.sin(ARC_HALF_ANGLE) + 4,
      )
      group.add(label)
    }
  }

  const target = new Line(
    new BufferGeometry().setFromPoints([new Vector3(0, 0.02, 0), new Vector3(radius, 0.02, 0)]),
    new LineDashedMaterial({ color: new Color('#3a4f6b'), dashSize: 2, gapSize: 3 }),
  )
  target.computeLineDistances()
  group.add(target)

  const tee = new Mesh(
    new RingGeometry(0.8, 1.6, 32),
    new MeshBasicMaterial({ color: new Color('#c8d4e0') }),
  )
  tee.rotation.x = -Math.PI / 2
  tee.position.y = 0.03
  group.add(tee)

  return group
}
