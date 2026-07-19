import { CatmullRomCurve3, Vector3 } from 'three'
import type { ShotInput } from '../types'

export interface ShotPath {
  curve: CatmullRomCurve3
  /** Arc length of the spline in meters. */
  length: number
  /** Points spaced evenly by arc length, for the tracer line. */
  sampled: Vector3[]
}

/**
 * Launch monitor trajectories often continue past the carry landing
 * with measured bounces and rollout. Clip at the first return to the
 * ground after real height so the default view shows flight only.
 */
export function clipToCarry(points: ShotInput['points']): ShotInput['points'] {
  let apexY = 0
  for (let i = 1; i < points.length; i++) {
    const y = points[i][1]
    if (y > apexY) apexY = y
    if (y <= 0.02 && apexY > 0.5) return points.slice(0, i + 1)
  }
  return points
}

/**
 * Fit a centripetal Catmull-Rom spline through the measured points.
 * Centripetal parameterization avoids overshoot on unevenly spaced
 * samples, which sparse reduced-accuracy shots have.
 */
export function buildPath(points: ShotInput['points'], samplesPerPoint = 8): ShotPath {
  if (points.length < 2) {
    throw new Error(`golf-shot-viz: a shot needs at least 2 trajectory points, got ${points.length}`)
  }
  const vectors = points.map(([x, y, z]) => new Vector3(x, y, z))
  const curve = new CatmullRomCurve3(vectors, false, 'centripetal')
  const count = Math.min(256, Math.max(64, points.length * samplesPerPoint))
  return { curve, length: curve.getLength(), sampled: curve.getSpacedPoints(count) }
}
