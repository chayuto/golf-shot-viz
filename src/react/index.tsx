import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { CSSProperties } from 'react'
import { ShotScene } from '../core/ShotScene'
import type { PlaybackState, ShotInput, ShotSceneOptions } from '../types'

export interface GolfShotVizHandle {
  /** The underlying ShotScene, null until mounted. Use for play(), seek(), captureFrame(), etc. */
  readonly scene: ShotScene | null
}

export interface GolfShotVizProps extends ShotSceneOptions {
  shots: ShotInput[]
  className?: string
  /** The container must have a size; defaults fill the parent. */
  style?: CSSProperties
  onHover?: (shot: ShotInput | null) => void
  onSelect?: (shot: ShotInput | null) => void
  onPlayback?: (state: PlaybackState) => void
}

/**
 * Thin React wrapper around ShotScene. Declarative props for shots and
 * the reactive options; playback commands go through the ref handle.
 * Client-side only (WebGL).
 */
export const GolfShotViz = forwardRef<GolfShotVizHandle, GolfShotVizProps>(
  function GolfShotViz(props, ref) {
    const { shots, className, style, onHover, onSelect, onPlayback, ...options } = props
    const containerRef = useRef<HTMLDivElement>(null)
    const sceneRef = useRef<ShotScene | null>(null)
    const initialOptions = useRef(options)
    const callbacks = useRef({ onHover, onSelect, onPlayback })
    callbacks.current = { onHover, onSelect, onPlayback }

    useEffect(() => {
      const container = containerRef.current
      if (!container) return
      const scene = new ShotScene(container, initialOptions.current)
      sceneRef.current = scene
      const offs = [
        scene.on('hover', (shot) => callbacks.current.onHover?.(shot)),
        scene.on('select', (shot) => callbacks.current.onSelect?.(shot)),
        scene.on('playback', (state) => callbacks.current.onPlayback?.(state)),
      ]
      return () => {
        for (const off of offs) off()
        sceneRef.current = null
        scene.dispose()
      }
    }, [])

    useEffect(() => {
      sceneRef.current?.setShots(shots)
    }, [shots])
    useEffect(() => {
      if (options.mode) sceneRef.current?.setMode(options.mode)
    }, [options.mode])
    useEffect(() => {
      if (options.units) sceneRef.current?.setUnits(options.units)
    }, [options.units])
    useEffect(() => {
      if (options.colorBy) sceneRef.current?.setColorBy(options.colorBy)
    }, [options.colorBy])
    useEffect(() => {
      if (options.cameraPreset) sceneRef.current?.setCameraPreset(options.cameraPreset)
    }, [options.cameraPreset])
    useEffect(() => {
      if (options.autoRotate !== undefined) sceneRef.current?.setAutoRotate(options.autoRotate)
    }, [options.autoRotate])

    useImperativeHandle(ref, () => ({
      get scene() {
        return sceneRef.current
      },
    }), [])

    return (
      <div
        ref={containerRef}
        className={className}
        style={{ width: '100%', height: '100%', ...style }}
      />
    )
  },
)
