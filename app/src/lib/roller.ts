import { db } from '../db'
import { roll, type RollResult } from './dice'
import { useUI } from '../state'
import { show } from './dice3d'

/** Log a roll to history and flash it on screen. */
export async function record(r: RollResult) {
  // Let the 3D dice land first (no-op when 3D is off), then reveal the number.
  await show(r).catch(() => undefined)
  await db.rolls.add({
    at: Date.now(), label: r.label, formula: r.formula, dice: r.dice, modifier: r.modifier,
    total: r.total, physical: !!r.physical, mode: r.mode, kept: r.kept, who: r.who,
  })
  useUI.getState().showRoll(r)
}

/** d20 check with the current advantage setting. */
export function check(label: string, bonus: number, who?: string) {
  return record({ ...roll(20, 1, bonus, useUI.getState().rollMode, label), who })
}

/** Roll damage like "1d6+4 piercing". Returns false when the text has no dice. */
export function rollDamage(label: string, text: string, who?: string) {
  const m = text.match(/(\d+)d(\d+)\s*([+-]\s*\d+)?/i)
  if (!m) return false
  record({ ...roll(Number(m[2]), Number(m[1]), m[3] ? Number(m[3].replace(/\s/g, '')) : 0, 'normal', label), who })
  return true
}
