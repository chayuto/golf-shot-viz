import { Vector3 } from 'three'
import type { CameraPreset } from '../types'

export interface SceneExtent {
  /** Furthest point radius in meters. */
  maxDistance: number
  /** Highest apex in meters. */
  maxHeight: number
}

export function presetView(
  preset: CameraPreset,
  extent: SceneExtent,
): { position: Vector3; target: Vector3 } {
  const d = Math.max(60, extent.maxDistance)
  const h = Math.max(15, extent.maxHeight)
  switch (preset) {
    case 'behind':
      return { position: new Vector3(-16, 7, 0), target: new Vector3(d * 0.55, h * 0.5, 0) }
    case 'side':
      return { position: new Vector3(d * 0.5, d * 0.28, d * 0.85), target: new Vector3(d * 0.5, 8, 0) }
    case 'top':
      return { position: new Vector3(d * 0.5, d * 1.15, 0.01), target: new Vector3(d * 0.5, 0, 0) }
    case 'green':
      return { position: new Vector3(d + 30, 12, 20), target: new Vector3(d * 0.3, 6, 0) }
    case 'broadcast':
    default:
      return { position: new Vector3(-26, 15, 34), target: new Vector3(d * 0.42, h * 0.32, 0) }
  }
}
