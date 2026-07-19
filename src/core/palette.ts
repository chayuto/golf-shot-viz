import type { ColorBy, LegendEntry, ShotInput } from '../types'

/**
 * Default categorical palette, validated for dark surfaces: worst
 * adjacent-pair CVD ΔE 8.4, worst normal-vision ΔE 19.3 (OKLab x100).
 * The order is the safety mechanism (it maximizes the minimum
 * adjacent-pair distance), so do not re-sort it.
 */
export const DEFAULT_PALETTE = [
  '#3987e5', // blue
  '#008300', // green
  '#d55181', // magenta
  '#c98500', // yellow
  '#199e70', // aqua
  '#d95926', // orange
  '#9085e9', // violet
  '#e66767', // red
]

/** Keys beyond the palette fold to gray instead of cycling. */
export const OVERFLOW_COLOR = '#8b93a1'

export function colorKey(shot: ShotInput, index: number, colorBy: ColorBy): string {
  if (colorBy === 'club') return shot.meta?.club ?? 'Unclassified'
  if (colorBy === 'session') return shot.meta?.session ?? 'Session'
  return String(index)
}

export interface ColorAssignment {
  colorOf(shot: ShotInput, index: number): string
  legend: LegendEntry[]
}

/**
 * Fixed-slot assignment: keys take palette slots in order of first
 * appearance and keep them, so filtering never repaints survivors.
 * An explicit shot.color always wins.
 */
export function assignColors(
  shots: ShotInput[],
  colorBy: ColorBy,
  palette: string[] = DEFAULT_PALETTE,
): ColorAssignment {
  const slots = new Map<string, string>()
  shots.forEach((shot, i) => {
    const key = colorKey(shot, i, colorBy)
    if (!slots.has(key)) {
      const slot = slots.size
      const color =
        colorBy === 'index'
          ? palette[slot % palette.length]
          : (palette[slot] ?? OVERFLOW_COLOR)
      slots.set(key, color)
    }
  })
  return {
    colorOf: (shot, i) => shot.color ?? slots.get(colorKey(shot, i, colorBy)) ?? OVERFLOW_COLOR,
    legend: [...slots.entries()].map(([key, color]) => ({ key, color })),
  }
}
