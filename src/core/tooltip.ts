import type { ShotInput, Units } from '../types'
import * as fmt from './units'

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )
}

/** DOM overlay tooltip positioned inside the scene container. */
export class Tooltip {
  private el: HTMLDivElement

  constructor(private container: HTMLElement) {
    this.el = document.createElement('div')
    this.el.className = 'gsv-tooltip'
    Object.assign(this.el.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      zIndex: '10',
      display: 'none',
      pointerEvents: 'none',
      background: 'rgba(13, 17, 23, 0.92)',
      border: '1px solid rgba(140, 160, 180, 0.25)',
      borderRadius: '6px',
      padding: '8px 10px',
      font: '12px/1.5 system-ui, -apple-system, sans-serif',
      color: '#dbe4ee',
      whiteSpace: 'nowrap',
    } satisfies Partial<CSSStyleDeclaration>)
    container.appendChild(this.el)
  }

  show(shot: ShotInput, x: number, y: number, units: Units, swatch: string): void {
    const m = shot.meta ?? {}
    const rows: string[] = []
    const row = (label: string, value: string) =>
      rows.push(`<div><span style="color:#8b98a9">${label}</span> ${value}</div>`)
    if (m.carry != null) row('carry', fmt.distance(m.carry, units))
    if (m.totalDistance != null) row('total', fmt.distance(m.totalDistance, units))
    if (m.apex != null) row('apex', fmt.distance(m.apex, units))
    if (m.ballSpeed != null) row('ball speed', fmt.speed(m.ballSpeed, units))
    if (m.hangTime != null) row('hang time', fmt.seconds(m.hangTime))

    const title = escapeHtml([m.club, m.session].filter(Boolean).join(' · ') || shot.id)
    this.el.innerHTML =
      `<div style="display:flex;align-items:center;gap:6px;margin-bottom:${rows.length ? '4px' : '0'}">` +
      `<span style="width:10px;height:10px;border-radius:50%;background:${swatch}"></span>` +
      `<strong>${title}</strong></div>` +
      rows.join('')

    const rect = this.container.getBoundingClientRect()
    const flipX = x + 260 > rect.width
    const flipY = y + 160 > rect.height
    this.el.style.transform = `translate(${flipX ? 'calc(-100% - 12px)' : '12px'}, ${flipY ? 'calc(-100% - 12px)' : '12px'})`
    this.el.style.left = `${x}px`
    this.el.style.top = `${y}px`
    this.el.style.display = 'block'
  }

  hide(): void {
    this.el.style.display = 'none'
  }

  dispose(): void {
    this.el.remove()
  }
}
