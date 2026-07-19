import { CanvasTexture, LinearFilter, Sprite, SpriteMaterial, SRGBColorSpace } from 'three'

/** Billboard text rendered to a canvas texture. No font dependencies. */
export function makeLabel(
  text: string,
  { color = '#8fa0b4', worldHeight = 5 }: { color?: string; worldHeight?: number } = {},
): Sprite {
  const font = '600 64px system-ui, -apple-system, sans-serif'
  const canvas = document.createElement('canvas')
  let ctx = canvas.getContext('2d')!
  ctx.font = font
  const width = Math.ceil(ctx.measureText(text).width) + 16
  const height = 80
  canvas.width = width
  canvas.height = height
  // Resizing resets canvas state, so reacquire and restyle.
  ctx = canvas.getContext('2d')!
  ctx.font = font
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 8, height / 2)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  const material = new SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
  const sprite = new Sprite(material)
  sprite.scale.set((worldHeight * width) / height, worldHeight, 1)
  return sprite
}
