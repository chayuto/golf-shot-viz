// Generates the README media in docs/media/ and doubles as the visual
// QA pass: it drives the real demo page headlessly, seeks the scene to
// deterministic states through the public API, and captures frames via
// ShotScene.captureFrame(). Run with `npm run visuals` after any visual
// change, eyeball the output, and commit it. CI uploads the same output
// as an artifact on every PR.
import { mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { PNG } from 'pngjs'
import gifenc from 'gifenc'

const { GIFEncoder, quantize, applyPalette } = gifenc

const OUT_DIR = new URL('../docs/media/', import.meta.url)

const STILL_VIEWPORT = { width: 1280, height: 720 }
const GIF_VIEWPORT = { width: 640, height: 360 }
const GIF_FPS = 15

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const server = await createServer({ server: { port: 0 } })
  await server.listen()
  const port = server.httpServer.address().port
  const url = `http://localhost:${port}/?capture`

  const browser = await chromium.launch({
    // SwiftShader keeps CI runners (no GPU) rendering WebGL.
    args: process.env.CI ? ['--use-gl=angle', '--use-angle=swiftshader'] : [],
  })

  try {
    const stills = await browser.newPage({
      viewport: STILL_VIEWPORT,
      deviceScaleFactor: 2,
    })
    await openDemo(stills, url)

    await still(stills, 'hero.png', `
      window.__gsv.scene.setMode('studio')
      window.__gsv.scene.setCameraPreset('broadcast', false)
    `)
    await still(stills, 'top.png', `
      window.__gsv.scene.setMode('studio')
      window.__gsv.scene.setCameraPreset('top', false)
    `)
    await still(stills, 'side.png', `
      window.__gsv.scene.setMode('studio')
      window.__gsv.scene.setCameraPreset('side', false)
    `)
    await stills.close()

    const gifs = await browser.newPage({
      viewport: GIF_VIEWPORT,
      deviceScaleFactor: 1,
    })
    await openDemo(gifs, url)

    // Volley replay: every shot launches at once, real reconstructed timing.
    await gif(gifs, 'volley.gif', {
      setup: `
        window.__gsv.scene.setCameraPreset('broadcast', false)
        window.__gsv.scene.play({ order: 'volley' })
        window.__gsv.scene.pause()
      `,
      playbackSeconds: null, // full master timeline
      gifSeconds: null, // real time
    })

    // Sequence replay of a single club, time-compressed for the loop.
    await gif(gifs, 'sequence.gif', {
      setup: `
        window.__gsv.scene.setShots(
          window.__gsv.fixtures.filter((s) => s.meta && s.meta.club === '7 Iron'),
        )
        window.__gsv.scene.setCameraPreset('green', false)
        window.__gsv.scene.play({ order: 'sequence', stagger: 0.8 })
        window.__gsv.scene.pause()
      `,
      playbackSeconds: null,
      gifSeconds: 6,
    })
    await gifs.close()
  } finally {
    await browser.close()
    await server.close()
  }
}

async function openDemo(page, url) {
  page.on('pageerror', (err) => {
    throw new Error(`demo page error: ${err.message}`)
  })
  await page.goto(url)
  await page.waitForFunction(() => Boolean(window.__gsv))
}

async function capturePng(page) {
  const dataUrl = await page.evaluate(() => window.__gsv.scene.captureFrame())
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}

async function still(page, name, setup) {
  await page.evaluate(setup)
  const buffer = await capturePng(page)
  await write(name, buffer)
}

async function gif(page, name, { setup, gifSeconds }) {
  await page.evaluate(setup)
  const duration = await page.evaluate(() => window.__gsv.scene.playback.duration)
  // gifSeconds compresses long timelines; null keeps real time.
  const playSeconds = gifSeconds ?? duration
  const frameCount = Math.round(playSeconds * GIF_FPS)
  const delay = Math.round(1000 / GIF_FPS)

  const encoder = GIFEncoder()
  for (let i = 0; i <= frameCount; i++) {
    await page.evaluate(
      (progress) => window.__gsv.scene.seek(progress),
      i / frameCount,
    )
    const png = PNG.sync.read(await capturePng(page))
    const data = new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength)
    const palette = quantize(data, 256)
    const index = applyPalette(data, palette)
    encoder.writeFrame(index, png.width, png.height, {
      palette,
      delay,
      ...(i === 0 ? { repeat: 0 } : {}),
    })
  }
  encoder.finish()
  await write(name, Buffer.from(encoder.bytes()))
}

async function write(name, buffer) {
  const path = new URL(name, OUT_DIR)
  await writeFile(path, buffer)
  console.log(`docs/media/${name}  ${(buffer.length / 1024).toFixed(0)} kB`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
