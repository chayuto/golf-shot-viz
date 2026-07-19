import { describe, expect, it } from 'vitest'
import { fromTrackman } from '../src/trackman'
import report from './fixtures/report.json'

describe('fromTrackman', () => {
  it('extracts every stroke that has a trajectory', () => {
    const shots = fromTrackman(report)
    expect(shots.map((s) => s.id)).toEqual(['stroke-1', 'stroke-3', 'stroke-4'])
  })

  it('maps trajectory points as [downrange, height, side]', () => {
    const [first] = fromTrackman(report)
    expect(first.points[0]).toEqual([0, 0, 0])
    expect(first.points[3]).toEqual([154.2, 0, -6.1])
  })

  it('maps measurement fields into meta', () => {
    const [first] = fromTrackman(report)
    expect(first.meta).toMatchObject({
      ballSpeed: 55.2,
      hangTime: 5.5,
      carry: 154.2,
      totalDistance: 170.1,
      apex: 25.8,
      launchAngle: 16.2,
      spinRate: 6200,
      curve: -3.2,
      session: '2026-05-14',
    })
  })

  it('converts static loft radians to degrees', () => {
    const [first] = fromTrackman(report)
    expect(first.meta?.staticLoft).toBeCloseTo(30.5, 1)
  })

  it('labels sessions by group date, or group index without one', () => {
    const shots = fromTrackman(report)
    expect(shots[0].meta?.session).toBe('2026-05-14')
    expect(shots[2].meta?.session).toBe('Group 2')
  })

  it('supports a club mapping callback keyed on static loft', () => {
    const shots = fromTrackman(report, {
      club: (loft) => (loft !== null && loft > 30 ? 'Wedge-ish' : undefined),
    })
    expect(shots[0].meta?.club).toBe('Wedge-ish')
    expect(shots[1].meta?.club).toBeUndefined()
  })

  it('never extracts player data from the export', () => {
    const serialized = JSON.stringify(fromTrackman(report))
    expect(serialized).not.toContain('Private Person')
    expect(serialized).not.toContain('private@example.com')
    expect(serialized.toLowerCase()).not.toContain('email')
  })

  it('accepts a single-session payload with top-level Strokes', () => {
    const single = (report.StrokeGroups as unknown[])[0]
    const shots = fromTrackman(single)
    expect(shots.map((s) => s.id)).toEqual(['stroke-1', 'stroke-3'])
  })

  it('throws a clear error on payloads that are not TrackMan reports', () => {
    expect(() => fromTrackman(null)).toThrow(TypeError)
    expect(() => fromTrackman({ foo: 'bar' })).toThrow(/no StrokeGroups/)
  })
})
