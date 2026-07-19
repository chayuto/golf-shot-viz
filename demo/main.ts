import { ShotScene, assignColors } from 'golf-shot-viz'
import type {
  CameraPreset,
  ColorBy,
  SceneMode,
  ShotInput,
  Units,
} from 'golf-shot-viz'
import shotsJson from './fixtures/shots.json'
import './style.css'

const fixtures = shotsJson as unknown as ShotInput[]

// Stable colors: assign from the full set once, then pass explicit
// colors, so filtering clubs never repaints the survivors.
const fullAssignment = assignColors(fixtures, 'club')
const clubs = fullAssignment.legend

const query = new URLSearchParams(location.search)
const capture = query.has('capture')
if (capture) document.body.classList.add('capture')

const $ = <T extends HTMLElement>(selector: string): T => {
  const el = document.querySelector<T>(selector)
  if (!el) throw new Error(`demo: missing ${selector}`)
  return el
}

const scene = new ShotScene($('#viz'), {
  mode: 'studio',
  colorBy: 'club',
  cameraPreset: 'broadcast',
})

const activeClubs = new Set(clubs.map((c) => c.key))
let colorBy: ColorBy = 'club'

function currentShots(): ShotInput[] {
  const filtered = fixtures.filter((s) => activeClubs.has(s.meta?.club ?? 'Unclassified'))
  if (colorBy !== 'club') return filtered
  // Explicit colors from the full-set assignment keep club colors stable.
  return filtered.map((s, i) => ({ ...s, color: fullAssignment.colorOf(s, i) }))
}

function refreshShots(): void {
  const shots = currentShots()
  scene.setShots(shots)
  $('#status').textContent = `${shots.length} shots · ${clubs.length} clubs · 2 sessions`
}

// Mode
const modeButtons = [...document.querySelectorAll<HTMLButtonElement>('#mode-group button')]
function setMode(mode: SceneMode): void {
  scene.setMode(mode)
  for (const b of modeButtons) b.classList.toggle('active', b.dataset.mode === mode)
}
for (const b of modeButtons) {
  b.addEventListener('click', () => setMode(b.dataset.mode as SceneMode))
}
scene.on('playback', (state) => {
  scrub.value = String(Math.round(state.progress * 1000))
  pauseButton.textContent = state.playing ? 'Pause' : 'Resume'
})

// Playback
const scrub = $<HTMLInputElement>('#scrub')
const pauseButton = $<HTMLButtonElement>('#pause')
$('#play-volley').addEventListener('click', () => {
  setMode('showcase')
  scene.play({ order: 'volley', speed: currentSpeed() })
})
$('#play-sequence').addEventListener('click', () => {
  setMode('showcase')
  scene.play({ order: 'sequence', speed: currentSpeed() })
})
pauseButton.addEventListener('click', () => {
  if (scene.playback.playing) scene.pause()
  else scene.resume()
})
const speedSelect = $<HTMLSelectElement>('#speed')
const currentSpeed = (): number => Number(speedSelect.value)
speedSelect.addEventListener('change', () => scene.setSpeed(currentSpeed()))
scrub.addEventListener('input', () => {
  scene.pause()
  scene.seek(Number(scrub.value) / 1000)
  for (const b of modeButtons) b.classList.toggle('active', b.dataset.mode === 'showcase')
})

// View
$<HTMLSelectElement>('#camera').addEventListener('change', (e) => {
  scene.setCameraPreset((e.target as HTMLSelectElement).value as CameraPreset)
})
$<HTMLSelectElement>('#color-by').addEventListener('change', (e) => {
  colorBy = (e.target as HTMLSelectElement).value as ColorBy
  scene.setColorBy(colorBy)
  refreshShots()
})
$<HTMLSelectElement>('#units').addEventListener('change', (e) => {
  scene.setUnits((e.target as HTMLSelectElement).value as Units)
})
$<HTMLInputElement>('#rollout').addEventListener('change', (e) => {
  scene.setRollout((e.target as HTMLInputElement).checked)
})

// Club chips
const clubsEl = $('#clubs')
for (const club of clubs) {
  const chip = document.createElement('button')
  chip.className = 'chip'
  chip.innerHTML = `<span class="dot" style="background:${club.color}"></span>${club.key}`
  chip.addEventListener('click', () => {
    if (activeClubs.has(club.key)) activeClubs.delete(club.key)
    else activeClubs.add(club.key)
    if (activeClubs.size === 0) for (const c of clubs) activeClubs.add(c.key)
    chip.classList.toggle('off', !activeClubs.has(club.key))
    refreshShots()
  })
  clubsEl.appendChild(chip)
}

refreshShots()

// Hooks for the scripted capture pipeline (scripts/capture.mjs) and
// for poking around from the console.
declare global {
  interface Window {
    __gsv?: {
      scene: ShotScene
      fixtures: ShotInput[]
      setMode: (mode: SceneMode) => void
      refreshShots: () => void
    }
  }
}
window.__gsv = { scene, fixtures, setMode, refreshShots }
