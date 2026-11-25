/** Spell slot tables (SRD 5.2 numbers). Index = spell level 1..9 (index 0 unused). */
import type { Ability } from './rules'

const FULL: number[][] = [
  [], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
]
const FULL_CASTERS = ['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Wizard']
const HALF_CASTERS = ['Paladin', 'Ranger']

export const CASTING_ABILITY: Record<string, Ability> = {
  Bard: 'cha', Cleric: 'wis', Druid: 'wis', Paladin: 'cha', Ranger: 'wis', Sorcerer: 'cha', Warlock: 'cha', Wizard: 'int',
}

/** Slot maxima for a class and level, as a 10-long array (index 0 unused). Warlock uses Pact Magic. */
export function slotsFor(cls: string, level: number): number[] {
  const out = Array(10).fill(0)
  const l = Math.max(1, Math.min(20, level))
  if (FULL_CASTERS.includes(cls)) FULL[l].forEach((n, i) => { out[i + 1] = n })
  else if (HALF_CASTERS.includes(cls)) FULL[Math.ceil(l / 2)].forEach((n, i) => { out[i + 1] = n })
  else if (cls === 'Warlock') {
    const count = l === 1 ? 1 : l <= 10 ? 2 : l <= 16 ? 3 : 4
    const slotLevel = Math.min(5, Math.ceil(l / 2))
    out[slotLevel] = count
  }
  return out
}

/** Pact Magic slots come back on a short rest. */
export const shortRestSlots = (cls: string | { name: string }[]) =>
  typeof cls === 'string' ? cls === 'Warlock' : cls.length > 0 && cls.every(k => k.name === 'Warlock')

export const LEVEL_NAME = ['Cantrips', '1st level', '2nd level', '3rd level', '4th level', '5th level', '6th level', '7th level', '8th level', '9th level']

/** "1A" -> "1 action", "1BA" -> "1 bonus action", "1R" -> "1 reaction". */
export function castingTime(t: string) {
  const m = t.trim().match(/^(\d+)\s*(BA|A|R|M|MIN|H|HR)$/i)
  if (!m) return t.trim()
  const unit = ({ ba: 'bonus action', a: 'action', r: 'reaction', m: 'minute', min: 'minute', h: 'hour', hr: 'hour' } as Record<string, string>)[m[2].toLowerCase()]
  return `${m[1]} ${unit}${Number(m[1]) > 1 ? 's' : ''}`
}

/** Slots for one or more classes. Multiclass: full-caster levels + half-caster levels / 2 (round up), on the full-caster
 *  table. Warlock Pact Magic is separate: when mixed with other casters it is not merged (track it as a resource). */
export function slotsForClasses(list: { name: string; level: number }[]): number[] {
  if (list.length === 1) return slotsFor(list[0].name, list[0].level)
  const casters = list.filter(k => FULL_CASTERS.includes(k.name) || HALF_CASTERS.includes(k.name))
  if (casters.length === 1) return slotsFor(casters[0].name, casters[0].level)
  if (casters.length === 0) { const w = list.find(k => k.name === 'Warlock'); return w ? slotsFor('Warlock', w.level) : Array(10).fill(0) }
  const lvl = casters.reduce((t, k) => t + (FULL_CASTERS.includes(k.name) ? k.level : Math.ceil(k.level / 2)), 0)
  const out = Array(10).fill(0)
  FULL[Math.min(20, lvl)].forEach((n, i) => { out[i + 1] = n })
  return out
}
/** Pact Magic for a Warlock that also has other caster classes (null when not applicable). */
export function separatePact(list: { name: string; level: number }[]) {
  const w = list.find(k => k.name === 'Warlock')
  if (!w || !list.some(k => FULL_CASTERS.includes(k.name) || HALF_CASTERS.includes(k.name))) return null
  const s = slotsFor('Warlock', w.level), level = s.findIndex(n => n > 0)
  return { level, count: s[level] }
}
