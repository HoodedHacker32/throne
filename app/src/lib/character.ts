import type { Character, ClassLevel } from '../db'
import { mod, profBonus, SKILLS, type Ability } from './rules'

export const abilityMod = (c: Character, a: Ability) => mod(c.abilities[a])
export const saveBonus = (c: Character, a: Ability) => abilityMod(c, a) + (c.saveProf.includes(a) ? profBonus(c.level) : 0)
export const skillBonus = (c: Character, key: string) => {
  const s = SKILLS.find(x => x.key === key)!
  return abilityMod(c, s.ability) + (c.skillProf[key] ?? 0) * profBonus(c.level)
}
export const passive = (c: Character, key: string) => 10 + skillBonus(c, key)
export const initiative = (c: Character) => abilityMod(c, 'dex') + c.initiativeBonus
/** The character's classes; single-class characters get a one-item list built from the top-level fields. */
export function classesOf(c: Character, includeBlank = false): ClassLevel[] {
  if (c.classes?.length) {
    const named = c.classes.filter(k => k.name.trim())
    return includeBlank || !named.length ? c.classes : named
  }
  return [{ name: c.className, subclass: c.subclass, level: c.level, hitDie: c.hitDie, used: Math.min(c.level, c.hitDiceUsed) }]
}
/** Patch that stores a class list and keeps the summary fields (first class, total level, dice used) in step. */
export function withClasses(list: ClassLevel[]): Partial<Character> {
  // Rows without a name stay in the list (being filled in) but do not count towards totals.
  const named = list.filter(k => k.name.trim())
  const clean = named.length ? named : list.slice(0, 1)
  const first = clean[0] ?? { name: '', subclass: '', level: 1, hitDie: 8, used: 0 }
  return {
    classes: list.length > 1 ? list : undefined,
    className: first.name, subclass: first.subclass, hitDie: first.hitDie,
    level: Math.max(1, clean.reduce((t, k) => t + k.level, 0)),
    hitDiceUsed: clean.reduce((t, k) => t + Math.min(k.used, k.level), 0),
  }
}
/** "Fighter (Champion) 3 / Wizard 2" or "Ranger" for one class. */
export function classLine(c: Character) {
  const list = classesOf(c)
  if (list.length === 1) return list[0].name ? `${list[0].name}${list[0].subclass ? ` (${list[0].subclass})` : ''}` : ''
  return list.map(k => `${k.name}${k.subclass ? ` (${k.subclass})` : ''} ${k.level}`).join(' / ')
}
export const hitDiceLeft = (c: Character) => classesOf(c).reduce((t, k) => t + Math.max(0, k.level - k.used), 0)
export const colorFor = (s: string) => {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360
  return `hsl(${h} 38% 36%)`
}
export const initials = (s: string) => s.replace(/^Sample:\s*/, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
