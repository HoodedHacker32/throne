/** 3D dice over the whole app. The library loads on first use (its own chunk), and the dice always land on
 *  results we already rolled with crypto randomness: the animation shows the roll, it never decides it. */
import type { RollResult } from './dice'

type Box = {
  initialize(): Promise<void>; roll(n: string): Promise<unknown>; clearDice(): void
  renderer?: { setPixelRatio(r: number): void }
  setDimensions?(d: { x: number; y: number }): void
  DiceFactory?: { get(type: string): { font: string } }
}
const DIE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']
let boxP: Promise<Box | null> | null = null
let clearTimer: number | undefined

const KEY = 'throne.dice3d'
export function dice3dEnabled(): boolean {
  try { const v = localStorage.getItem(KEY); if (v !== null) return v === '1' } catch { /* ignore */ }
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
export function setDice3d(on: boolean) { try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* ignore */ } }

const SOUND_KEY = 'throne.diceSound'
export const diceSoundOn = () => { try { return localStorage.getItem(SOUND_KEY) !== '0' } catch { return true } }
export function setDiceSound(on: boolean) { try { localStorage.setItem(SOUND_KEY, on ? '1' : '0') } catch { /* ignore */ }; boxP = null; document.getElementById('dice3d')?.remove() }

async function getBox(): Promise<Box | null> {
  if (!boxP) boxP = (async () => {
    try {
      let el = document.getElementById('dice3d')
      if (!el) { el = document.createElement('div'); el.id = 'dice3d'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el) }
      // Numerals in the brand's Pirata One; make sure the font is ready before faces are drawn.
      await document.fonts.load('64px "Pirata One"').catch(() => undefined)
      const { default: DiceBox } = await import('@3d-dice/dice-box-threejs')
      const box = new DiceBox('#dice3d', {
        assetPath: `${import.meta.env.BASE_URL}dice/`,
        sounds: diceSoundOn(), volume: 60,
        shadows: true, light_intensity: 0.9, color_spotlight: 0xfff1de,
        theme_surface: 'green-felt', gravity_multiplier: 450, strength: 1.3, baseScale: 90,
        theme_customColorset: {
          name: 'throne', foreground: '#efe6d2', background: '#ba0000', outline: '#14100e',
          texture: 'none', material: 'plastic', font: 'Pirata One',
        },
      }) as unknown as Box
      await box.initialize()
      // The library reads fonts from per-die definitions (default Arial): give every die our numerals.
      for (const t of DIE_TYPES) { try { const d = box.DiceFactory?.get(t); if (d) d.font = '"Pirata One"' } catch { /* older API */ } }
      // Sharp on Retina screens (capped for speed), and follow the window size.
      const fit = () => {
        box.renderer?.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        const host = document.getElementById('dice3d')
        if (host && box.setDimensions) box.setDimensions({ x: host.clientWidth, y: host.clientHeight })
      }
      fit(); window.addEventListener('resize', fit)
      ;(window as unknown as { __dice3d?: Box }).__dice3d = box
      return box
    } catch (e) {
      console.warn('3D dice unavailable', e)
      return null
    }
  })()
  return boxP
}

/** "1d20+2d6" + dice [14, 3, 5] -> "1d20+2d6@14,3,5". Advantage rolls two d20s; d100 is shown as a tens die
 *  (00-90) plus a units die (0-9), the way percentile is rolled at the table. Returns null when there is nothing to show. */
export function notation(r: Pick<RollResult, 'formula' | 'dice' | 'physical'>): string | null {
  if (r.physical) return null
  const groups = [...r.formula.matchAll(/(\d+)d(\d+)/g)].map(m => ({ n: Number(m[1]), sides: Number(m[2]) }))
  if (!groups.length) return null
  if (groups.reduce((t, g) => t + g.n, 0) === 1 && r.dice.length === 2 && groups[0].sides === 20) groups[0].n = 2
  if (groups.reduce((t, g) => t + g.n, 0) !== r.dice.length) return null
  if (groups.some(g => ![4, 6, 8, 10, 12, 20, 100].includes(g.sides))) return null
  if (r.dice.length > 12) return null // too many to read; the toast shows the result
  const parts: string[] = [], values: number[] = []
  let i = 0
  for (const g of groups) {
    const vals = r.dice.slice(i, i + g.n); i += g.n
    if (g.sides === 100) {
      // 41 -> tens 40 + units 1; 100 -> "00" + "0".
      const units = vals.map(v => v % 10), tens = vals.map(v => (v === 100 ? 0 : v - (v % 10)))
      parts.push(`${g.n}d100`, `${g.n}d10`); values.push(...tens, ...units)
    } else { parts.push(`${g.n}d${g.sides}`); values.push(...vals) }
  }
  return `${parts.join('+')}@${values.join(',')}`
}

/** Throw the dice and resolve when they settle (or after a timeout, so a slow device never blocks a result). */
export async function show(r: Pick<RollResult, 'formula' | 'dice' | 'physical'>): Promise<void> {
  if (!dice3dEnabled()) return
  const n = notation(r)
  if (!n) return
  const box = await Promise.race([getBox(), new Promise<null>(res => setTimeout(() => res(null), 4000))])
  if (!box) return
  window.clearTimeout(clearTimer)
  const el = document.getElementById('dice3d')
  el?.classList.add('show')
  try { box.clearDice() } catch { /* nothing to clear */ }
  const landed = await Promise.race([box.roll(n), new Promise(res => setTimeout(() => res(null), 6000))])
  ;(window as unknown as { __dice3dLast?: unknown }).__dice3dLast = { notation: n, landed }
  clearTimer = window.setTimeout(() => { el?.classList.remove('show'); window.setTimeout(() => { try { box.clearDice() } catch { /* ignore */ } }, 400) }, 1800)
}
