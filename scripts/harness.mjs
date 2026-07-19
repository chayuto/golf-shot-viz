// Shared capture machinery for scripts/capture.mjs (README media) and
// scripts/catalog.mjs (options catalog). Boots the real demo page under
// a Vite dev server, drives it headlessly, and captures frames through
// ShotScene.captureFrame().
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { PNG } from 'pngjs'
import gifenc from 'gifenc'

const { GIFEncoder, quantize, applyPalette } = gifenc

/** Start the demo dev server and a headless browser. Call close() when done. */
export async function launchDemo() {
  const server = await createServer({ server: { port: 0 } })
  await server.listen()
  const port = server.httpServer.address().port
  const url = `http://localhost:${port}/?capture`

  const browser = await chromium.launch({
    // SwiftShader keeps CI runners (no GPU) rendering WebGL.
    args: process.env.CI ? ['--use-gl=angle', '--use-angle=swiftshader'] : [],
  })

  return {
    url,
    browser,
    async close() {
      await browser.close()
      await server.close()
    },
  }
}

/** Open the demo in a new page and wait for the capture hooks. */
export async function openDemo(browser, url, { viewport, deviceScaleFactor }) {
  const page = await browser.newPage({ viewport, deviceScaleFactor })
  page.on('pageerror', (err) => {
    throw new Error(`demo page error: ${err.message}`)
  })
  await page.goto(url)
  await page.waitForFunction(() => Boolean(window.__gsv))
  return page
}

/** Render one frame and return it as an image Buffer. */
export async function captureFrame(page, type = 'image/png', quality) {
  const dataUrl = await page.evaluate(
    ([t, q]) => window.__gsv.scene.captureFrame(t, q),
    [type, quality],
  )
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}

/** Master timeline length of the current playback plan, seconds. */
export async function masterDuration(page) {
  return page.evaluate(() => window.__gsv.scene.playback.duration)
}

/**
 * Record a GIF by seeking the paused scene frame by frame. Deterministic:
 * the same scene state always yields the same file. `seconds` sets the
 * GIF length; the full master timeline is always covered, so a shorter
 * `seconds` time-compresses the replay.
 */
export async function seekGif(page, { seconds, fps = 15 }) {
  const frameCount = Math.round(seconds * fps)
  const encoder = GIFEncoder()
  for (let i = 0; i <= frameCount; i++) {
    await page.evaluate((progress) => window.__gsv.scene.seek(progress), i / frameCount)
    addGifFrame(encoder, await captureFrame(page), { fps, first: i === 0 })
  }
  encoder.finish()
  return Buffer.from(encoder.bytes())
}

/**
 * Record a GIF of the live scene, one frame per wall-clock interval.
 * For motion that seek() cannot drive, like the autoRotate orbit.
 * Not frame-deterministic; use seekGif whenever playback state is
 * what moves.
 */
export async function realtimeGif(page, { seconds, fps = 15 }) {
  const frameCount = Math.round(seconds * fps)
  const encoder = GIFEncoder()
  for (let i = 0; i <= frameCount; i++) {
    addGifFrame(encoder, await captureFrame(page), { fps, first: i === 0 })
    await page.waitForTimeout(1000 / fps)
  }
  encoder.finish()
  return Buffer.from(encoder.bytes())
}

function addGifFrame(encoder, pngBuffer, { fps, first }) {
  const png = PNG.sync.read(pngBuffer)
  const data = new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength)
  const palette = quantize(data, 256)
  const index = applyPalette(data, palette)
  encoder.writeFrame(index, png.width, png.height, {
    palette,
    delay: Math.round(1000 / fps),
    ...(first ? { repeat: 0 } : {}),
  })
}
