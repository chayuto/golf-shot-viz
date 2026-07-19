import { describe, expect, it } from 'vitest'
import { assignColors, DEFAULT_PALETTE, OVERFLOW_COLOR } from '../src/core/palette'
import type { ShotInput } from '../src/types'

const shot = (id: string, club?: string, color?: string): ShotInput => ({
  id,
  points: [
    [0, 0, 0],
    [10, 2, 0],
  ],
  ...(color ? { color } : {}),
  meta: club ? { club } : {},
})

describe('assignColors', () => {
  it('assigns palette slots by first appearance and keeps them', () => {
    const shots = [shot('a', 'Driver'), shot('b', '7 Iron'), shot('c', 'Driver')]
    const { colorOf, legend } = assignColors(shots, 'club')
    expect(colorOf(shots[0], 0)).toBe(DEFAULT_PALETTE[0])
    expect(colorOf(shots[1], 1)).toBe(DEFAULT_PALETTE[1])
    expect(colorOf(shots[2], 2)).toBe(DEFAULT_PALETTE[0])
    expect(legend).toEqual([
      { key: 'Driver', color: DEFAULT_PALETTE[0] },
      { key: '7 Iron', color: DEFAULT_PALETTE[1] },
    ])
  })

  it('explicit shot.color always wins', () => {
    const shots = [shot('a', 'Driver', '#123456')]
    expect(assignColors(shots, 'club').colorOf(shots[0], 0)).toBe('#123456')
  })

  it('folds keys beyond the palette to gray instead of cycling', () => {
    const shots = Array.from({ length: DEFAULT_PALETTE.length + 2 }, (_, i) =>
      shot(`s${i}`, `Club ${i}`),
    )
    const { colorOf } = assignColors(shots, 'club')
    expect(colorOf(shots[DEFAULT_PALETTE.length], DEFAULT_PALETTE.length)).toBe(OVERFLOW_COLOR)
  })

  it('index mode gives every shot its own color and may cycle', () => {
    const shots = Array.from({ length: DEFAULT_PALETTE.length + 1 }, (_, i) => shot(`s${i}`))
    const { colorOf } = assignColors(shots, 'index')
    expect(colorOf(shots[0], 0)).toBe(DEFAULT_PALETTE[0])
    expect(colorOf(shots[DEFAULT_PALETTE.length], DEFAULT_PALETTE.length)).toBe(DEFAULT_PALETTE[0])
  })

  it('missing club folds into Unclassified', () => {
    const shots = [shot('a'), shot('b')]
    const { legend } = assignColors(shots, 'club')
    expect(legend).toEqual([{ key: 'Unclassified', color: DEFAULT_PALETTE[0] }])
  })
})
