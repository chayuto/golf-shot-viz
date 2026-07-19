import { describe, expect, it } from 'vitest'
import { buildTimeline, estimateHangTime, solveDecayRate } from '../src/core/timing'

describe('solveDecayRate', () => {
  it('solves k so the distance integral matches the path length', () => {
    const v0 = 55
    const T = 5.5
    const L = 170
    const k = solveDecayRate(v0, T, L)
    expect(k).not.toBeNull()
    const travelled = (v0 / k!) * (1 - Math.exp(-k! * T))
    expect(Math.abs(travelled - L) / L).toBeLessThan(1e-3)
  })

  it('returns null when the anchors cannot decay (v0*T <= L)', () => {
    expect(solveDecayRate(10, 5, 60)).toBeNull()
    expect(solveDecayRate(10, 5, 50)).toBeNull()
  })

  it('returns null on nonsense input', () => {
    expect(solveDecayRate(0, 5, 50)).toBeNull()
    expect(solveDecayRate(50, -1, 50)).toBeNull()
    expect(solveDecayRate(50, 5, 0)).toBeNull()
  })
})

describe('buildTimeline', () => {
  it('uses measured hang time as the duration', () => {
    const timeline = buildTimeline(170, { ballSpeed: 55, hangTime: 5.5 })
    expect(timeline.duration).toBe(5.5)
  })

  it('starts at 0 and ends at 1', () => {
    const timeline = buildTimeline(170, { ballSpeed: 55, hangTime: 5.5 })
    expect(timeline.progressAt(-1)).toBe(0)
    expect(timeline.progressAt(0)).toBe(0)
    expect(timeline.progressAt(5.5)).toBe(1)
    expect(timeline.progressAt(99)).toBe(1)
  })

  it('is monotonic', () => {
    const timeline = buildTimeline(170, { ballSpeed: 55, hangTime: 5.5 })
    let prev = 0
    for (let i = 0; i <= 100; i++) {
      const u = timeline.progressAt((i / 100) * 5.5)
      expect(u).toBeGreaterThanOrEqual(prev)
      prev = u
    }
  })

  it('covers more path early than late (decaying speed)', () => {
    const timeline = buildTimeline(170, { ballSpeed: 55, hangTime: 5.5 })
    const firstQuarter = timeline.progressAt(5.5 * 0.25)
    const lastQuarter = 1 - timeline.progressAt(5.5 * 0.75)
    expect(firstQuarter).toBeGreaterThan(lastQuarter)
  })

  it('falls back to an eased profile without anchors', () => {
    const timeline = buildTimeline(120)
    expect(timeline.duration).toBe(estimateHangTime(120))
    expect(timeline.progressAt(0)).toBe(0)
    expect(timeline.progressAt(timeline.duration)).toBe(1)
    const mid = timeline.progressAt(timeline.duration / 2)
    expect(mid).toBeGreaterThan(0.5) // still front-loaded
  })

  it('falls back when ball speed cannot cover the path in time', () => {
    // 10 m/s for 5 s cannot cover 170 m; must not produce NaN.
    const timeline = buildTimeline(170, { ballSpeed: 10, hangTime: 5 })
    expect(timeline.progressAt(2.5)).toBeGreaterThan(0)
    expect(timeline.progressAt(5)).toBe(1)
  })

  it('clamps the estimated hang time to a sane range', () => {
    expect(estimateHangTime(5)).toBe(2)
    expect(estimateHangTime(1000)).toBe(7)
  })
})
