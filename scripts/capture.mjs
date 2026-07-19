// Generates the README media in docs/media/ and doubles as the visual
// QA pass: it drives the real demo page headlessly, seeks the scene to
// deterministic states through the public API, and captures frames via
// ShotScene.captureFrame(). Run with `npm run visuals` after any visual
// change, eyeball the output, and commit it. CI uploads the same output
// as an artifact on every PR.
import { mkdir, writeFile } from 'node:fs/promises'
import { launchDemo, openDemo, captureFrame, masterDuration, seekGif } from './harness.mjs'

const OUT_DIR = new URL('../docs/media/', import.meta.url)

const STILL_VIEWPORT = { width: 1280, height: 720 }
const GIF_VIEWPORT = { width: 640, height: 360 }

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const demo = await launchDemo()

  try {
    const stills = await openDemo(demo.browser, demo.url, {
      viewport: STILL_VIEWPORT,
      deviceScaleFactor: 2,
    })

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

    const gifs = await openDemo(demo.browser, demo.url, {
      viewport: GIF_VIEWPORT,
      deviceScaleFactor: 1,
    })

    // Volley replay: every shot launches at once, real reconstructed timing.
    await gifs.evaluate(`
      window.__gsv.scene.setCameraPreset('broadcast', false)
      window.__gsv.scene.play({ order: 'volley' })
      window.__gsv.scene.pause()
    `)
    await write('volley.gif', await seekGif(gifs, { seconds: await masterDuration(gifs) }))

    // Sequence replay of a single club, time-compressed for the loop.
    await gifs.evaluate(`
      window.__gsv.scene.setShots(
        window.__gsv.fixtures.filter((s) => s.meta && s.meta.club === '7 Iron'),
      )
      window.__gsv.scene.setCameraPreset('green', false)
      window.__gsv.scene.play({ order: 'sequence', stagger: 0.8 })
      window.__gsv.scene.pause()
    `)
    await write('sequence.gif', await seekGif(gifs, { seconds: 6 }))
    await gifs.close()
  } finally {
    await demo.close()
  }
}

async function still(page, name, setup) {
  await page.evaluate(setup)
  await write(name, await captureFrame(page))
}

async function write(name, buffer) {
  await writeFile(new URL(name, OUT_DIR), buffer)
  console.log(`docs/media/${name}  ${(buffer.length / 1024).toFixed(0)} kB`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
