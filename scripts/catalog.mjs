// Generates the options catalog: one captured image per variant in
// scripts/catalog.config.mjs, a static page that shows them, and a
// markdown twin for browsing in the repo. Output is committed, like
// the README media: images and page in docs/catalog/, markdown at
// docs/CATALOG.md. The Pages deploy copies docs/catalog next to the
// demo build. Run `npm run catalog` after any visual change, eyeball
// the diff, and commit it.
import { mkdir, rm, writeFile } from 'node:fs/promises'
import {
  launchDemo,
  openDemo,
  captureFrame,
  seekGif,
  realtimeGif,
} from './harness.mjs'
import { GROUPS, NOT_PICTURED, RESET } from './catalog.config.mjs'

const OUT_DIR = new URL('../docs/catalog/', import.meta.url)
const MD_PATH = new URL('../docs/CATALOG.md', import.meta.url)

const STILL_VIEWPORT = { width: 960, height: 540 }
const GIF_VIEWPORT = { width: 640, height: 360 }
const JPEG_QUALITY = 0.92

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(OUT_DIR, { recursive: true })

  const demo = await launchDemo()
  try {
    const stills = await openDemo(demo.browser, demo.url, {
      viewport: STILL_VIEWPORT,
      deviceScaleFactor: 2,
    })
    for (const { group, variant } of variants((v) => !v.kind)) {
      await stills.evaluate(RESET)
      if (variant.setup) await stills.evaluate(variant.setup)
      // JPEG keeps the page light; transparency needs PNG.
      const buffer = variant.transparent
        ? await captureFrame(stills)
        : await captureFrame(stills, 'image/jpeg', JPEG_QUALITY)
      await write(fileName(group, variant), buffer)
    }
    await stills.close()

    const gifs = await openDemo(demo.browser, demo.url, {
      viewport: GIF_VIEWPORT,
      deviceScaleFactor: 1,
    })
    for (const { group, variant } of variants((v) => v.kind)) {
      await gifs.evaluate(RESET)
      await gifs.evaluate(variant.setup)
      const record = variant.kind === 'gif-seek' ? seekGif : realtimeGif
      await write(fileName(group, variant), await record(gifs, { seconds: variant.seconds }))
    }
    await gifs.close()
  } finally {
    await demo.close()
  }

  await write('index.html', renderPage())
  await writeFile(MD_PATH, renderMarkdown())
  console.log('docs/CATALOG.md')
}

function* variants(filter) {
  for (const group of GROUPS) {
    for (const variant of group.variants) {
      if (filter(variant)) yield { group, variant }
    }
  }
}

function fileName(group, variant) {
  const slug = `${group.option} ${variant.name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
  const ext = variant.kind ? 'gif' : variant.transparent ? 'png' : 'jpg'
  return `${slug}.${ext}`
}

function renderPage() {
  const sections = GROUPS.map((group) => {
    const cards = group.variants
      .map((variant) => {
        const badge =
          variant.isDefault && variant.name !== 'default'
            ? '<span class="badge">default</span>'
            : ''
        const caption = variant.caption ? `<span class="dim">${variant.caption}</span>` : ''
        const size = variant.kind
          ? 'width="640" height="360"'
          : 'width="1920" height="1080"'
        return `
        <figure>
          <img src="${fileName(group, variant)}" alt="${group.option}: ${variant.name}"
            ${size} loading="lazy"${variant.transparent ? ' class="checker"' : ''} />
          <figcaption><code>${variant.name}</code> ${badge} ${caption}</figcaption>
        </figure>`
      })
      .join('\n')
    return `
    <section>
      <h2><code>${group.api ?? group.option}</code></h2>
      <p>${group.note}</p>
      <div class="cards">${cards}</div>
    </section>`
  }).join('\n')

  const notPictured = NOT_PICTURED.map(
    ({ option, note }) => `<li><code>${option}</code> ${note}</li>`,
  ).join('\n')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>golf-shot-viz — options catalog</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #0b0e14;
        color: #dbe4ee;
        font: 14px/1.5 system-ui, -apple-system, sans-serif;
      }
      header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 20px 10px;
      }
      header h1 { margin: 0; font-size: 20px; letter-spacing: 0.02em; }
      header p { margin: 2px 0 0; color: #8b98a9; font-size: 13px; }
      nav a { color: #6ea8e8; text-decoration: none; margin-left: 14px; }
      nav a:hover { text-decoration: underline; }
      main { max-width: 1480px; margin: 0 auto; padding: 8px 20px 40px; }
      section { margin-top: 28px; }
      h2 { margin: 0; font-size: 16px; }
      h2 code { color: #9ec3ef; }
      section > p { margin: 6px 0 12px; color: #aab6c6; max-width: 76ch; }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 14px;
      }
      figure { margin: 0; }
      figure img {
        width: 100%;
        height: auto;
        display: block;
        border-radius: 8px;
        border: 1px solid #202939;
      }
      figure img.checker {
        background: repeating-conic-gradient(#2a3242 0% 25%, #1a212e 0% 50%) 0 0 / 24px 24px;
      }
      figcaption { margin-top: 6px; font-size: 13px; color: #aab6c6; }
      figcaption code { color: #dbe4ee; }
      .badge {
        background: #2a4365;
        border: 1px solid #3f6499;
        border-radius: 999px;
        padding: 1px 8px;
        font-size: 11px;
        margin-left: 4px;
      }
      .dim { color: #8b98a9; margin-left: 4px; }
      ul { color: #aab6c6; max-width: 76ch; padding-left: 20px; }
      li { margin: 6px 0; }
      li code { color: #dbe4ee; }
      footer { padding: 24px 20px; color: #66748a; font-size: 12px; }
    </style>
  </head>
  <body>
    <header>
      <div>
        <h1>golf-shot-viz options catalog</h1>
        <p>
          Every visual option, captured from the same 29 fixture shots so only
          the option changes between images in a row.
        </p>
      </div>
      <nav>
        <a href="../">Live demo</a>
        <a href="https://github.com/chayuto/golf-shot-viz">GitHub</a>
        <a href="https://www.npmjs.com/package/golf-shot-viz">npm</a>
      </nav>
    </header>
    <main>
      ${sections}
      <section>
        <h2>Not pictured</h2>
        <ul>${notPictured}</ul>
      </section>
    </main>
    <footer>
      Generated by <code>npm run catalog</code> from scripts/catalog.config.mjs.
      Fixtures are real TrackMan range shots, scrubbed to trajectories and
      numbers only. TrackMan is a trademark of TrackMan A/S; this project is
      not affiliated with or endorsed by TrackMan.
    </footer>
  </body>
</html>
`
}

function renderMarkdown() {
  const sections = GROUPS.map((group) => {
    const rows = chunk(group.variants, 3)
      .map((variants) => {
        const heads = variants
          .map((v) => {
            const parts = [`\`${v.name}\``]
            if (v.isDefault && v.name !== 'default') parts.push('(default)')
            if (v.caption) parts.push(v.caption)
            return parts.join(' ')
          })
          .join(' | ')
        const cells = variants
          .map((v) => `![${group.option}: ${v.name}](catalog/${fileName(group, v)})`)
          .join(' | ')
        return `| ${heads} |\n| ${variants.map(() => '---').join(' | ')} |\n| ${cells} |`
      })
      .join('\n\n')
    return `## ${group.api ?? group.option}\n\n${group.note}\n\n${rows}`
  }).join('\n\n')

  const notPictured = NOT_PICTURED.map(({ option, note }) => `- \`${option}\` ${note}`).join('\n')

  return `# Options catalog

Every visual option, captured from the same fixture shots so only the
option changes between images in a group. Generated by
\`npm run catalog\` from scripts/catalog.config.mjs; do not edit by
hand. The same catalog is deployed next to the
[live demo](https://chayuto.github.io/golf-shot-viz/catalog/).

${sections}

## Not pictured

${notPictured}

---

Fixtures are real TrackMan range shots, scrubbed to trajectories and
numbers only. TrackMan is a trademark of TrackMan A/S; this project is
not affiliated with or endorsed by TrackMan.
`
}

function chunk(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

async function write(name, data) {
  await writeFile(new URL(name, OUT_DIR), data)
  const size = typeof data === 'string' ? Buffer.byteLength(data) : data.length
  console.log(`docs/catalog/${name}  ${(size / 1024).toFixed(0)} kB`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
