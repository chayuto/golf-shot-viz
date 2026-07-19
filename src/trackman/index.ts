import type { ShotInput, ShotMeta } from '../types'

/**
 * Adapter for TrackMan report exports (the JSON behind "multi group
 * report" downloads). Extracts trajectories, ball metrics, and the
 * static loft club fingerprint. It never reads player fields: names
 * and emails in the export stay out of the output by construction.
 *
 * TrackMan is a trademark of TrackMan A/S. This project is not
 * affiliated with or endorsed by TrackMan.
 */
export interface FromTrackmanOptions {
  /**
   * Map a stroke to a club label. Exports carry no club names; the
   * club's static loft in degrees is the only fingerprint.
   */
  club?: (staticLoftDeg: number | null, stroke: Record<string, unknown>) => string | undefined
  /** Label a stroke group. Default: the group date, else "Group N". */
  session?: (group: Record<string, unknown>, index: number) => string | undefined
}

export function fromTrackman(report: unknown, options: FromTrackmanOptions = {}): ShotInput[] {
  const root = asRecord(report)
  if (!root) {
    throw new TypeError('golf-shot-viz/trackman: expected a parsed TrackMan report object')
  }
  let groups = asArray(root.StrokeGroups)
  if (!groups && Array.isArray(root.Strokes)) groups = [root]
  if (!groups) {
    throw new TypeError(
      'golf-shot-viz/trackman: no StrokeGroups in payload. Expected a TrackMan report export.',
    )
  }

  const shots: ShotInput[] = []
  groups.forEach((groupRaw, groupIndex) => {
    const group = asRecord(groupRaw)
    if (!group) return
    const session =
      options.session?.(group, groupIndex) ?? defaultSessionLabel(group, groupIndex)

    for (const strokeRaw of asArray(group.Strokes) ?? []) {
      const stroke = asRecord(strokeRaw)
      if (!stroke) continue
      const measurement = asRecord(stroke.Measurement)
      const trajectory = asArray(measurement?.BallTrajectory)
      if (!measurement || !trajectory) continue

      const points: [number, number, number][] = []
      for (const pointRaw of trajectory) {
        const point = asRecord(pointRaw)
        const x = num(point?.X)
        const y = num(point?.Y)
        const z = num(point?.Z)
        if (x === undefined || y === undefined || z === undefined) continue
        points.push([x, y, z])
      }
      if (points.length < 2) continue

      const staticLoft = staticLoftDeg(stroke)
      const meta: ShotMeta = {}
      setIf(meta, 'ballSpeed', num(measurement.BallSpeed))
      setIf(meta, 'hangTime', num(measurement.HangTime))
      setIf(meta, 'carry', num(measurement.Carry))
      setIf(meta, 'totalDistance', num(measurement.Total))
      setIf(meta, 'apex', num(measurement.MaxHeight))
      setIf(meta, 'launchAngle', num(measurement.LaunchAngle))
      setIf(meta, 'spinRate', num(measurement.SpinRate))
      setIf(meta, 'curve', num(measurement.Curve))
      setIf(meta, 'staticLoft', staticLoft ?? undefined)
      setIf(meta, 'club', options.club?.(staticLoft, stroke))
      setIf(meta, 'session', session)

      shots.push({
        id: str(stroke.Id) ?? `shot-${shots.length + 1}`,
        points,
        meta,
      })
    }
  })
  return shots
}

/** The club's static loft, radians in the export, in degrees. */
function staticLoftDeg(stroke: Record<string, unknown>): number | null {
  const radians = num(
    asRecord(asRecord(asRecord(stroke.MeasurementDetails)?.ImpactLocation)?.ClubConfiguration)
      ?.StaticLoft,
  )
  if (radians === undefined) return null
  return Math.round(((radians * 180) / Math.PI) * 10) / 10
}

function defaultSessionLabel(group: Record<string, unknown>, index: number): string {
  const date = str(group.Date)
  return date ? date.slice(0, 10) : `Group ${index + 1}`
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function setIf<K extends keyof ShotMeta>(meta: ShotMeta, key: K, value: ShotMeta[K] | undefined): void {
  if (value !== undefined) meta[key] = value
}
