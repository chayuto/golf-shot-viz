import { describe, expect, it } from 'vitest'
import { buildPath, clipToCarry } from '../src/core/spline'

const arc: [number, number, number][] = [
  [0, 0, 0],
  [50, 15, -1],
  [100, 25, -3],
  [154, 0, -6],
]

describe('buildPath', () => {
  it('throws on fewer than 2 points', () => {
    expect(() => buildPath([[0, 0, 0]])).toThrow(/at least 2/)
  })

  it('spline length is at least the straight-line distance', () => {
    const path = buildPath(arc)
    const straight = Math.hypot(154, 0, -6)
    expect(path.length).toBeGreaterThan(straight)
  })

  it('passes through the endpoints', () => {
    const path = buildPath(arc)
    const first = path.sampled[0]
    const last = path.sampled[path.sampled.length - 1]
    expect(first.x).toBeCloseTo(0, 5)
    expect(first.y).toBeCloseTo(0, 5)
    expect(last.x).toBeCloseTo(154, 1)
    expect(last.z).toBeCloseTo(-6, 1)
  })

  it('samples within bounds', () => {
    expect(buildPath(arc).sampled.length).toBeGreaterThanOrEqual(64)
    const many = Array.from({ length: 60 }, (_, i) => [i, i, 0] as [number, number, number])
    expect(buildPath(many).sampled.length).toBeLessThanOrEqual(257)
  })
})

describe('clipToCarry', () => {
  const p = (x: number, y: number): [number, number, number] => [x, y, 0]

  it('cuts measured bounce and rollout after the first landing', () => {
    const points = [p(0, 0), p(50, 20), p(100, 10), p(120, 0), p(125, 0.4), p(130, 0), p(150, 0)]
    expect(clipToCarry(points)).toEqual(points.slice(0, 4))
  })

  it('keeps a flight that never returns to the ground', () => {
    const points = [p(0, 0), p(50, 20), p(100, 12)]
    expect(clipToCarry(points)).toEqual(points)
  })

  it('does not clip at the tee before the ball has height', () => {
    const points = [p(0, 0), p(1, 0.01), p(50, 20), p(120, 0)]
    expect(clipToCarry(points)).toEqual(points)
  })
})
