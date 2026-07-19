import type { Units } from '../types'

export const YD_PER_M = 1.0936133
const MPH_PER_MS = 2.2369363
const KMH_PER_MS = 3.6

export function distance(meters: number, units: Units): string {
  return units === 'yards' ? `${(meters * YD_PER_M).toFixed(1)} yd` : `${meters.toFixed(1)} m`
}

export function speed(ms: number, units: Units): string {
  return units === 'yards' ? `${(ms * MPH_PER_MS).toFixed(1)} mph` : `${(ms * KMH_PER_MS).toFixed(1)} km/h`
}

export function seconds(s: number): string {
  return `${s.toFixed(2)} s`
}
