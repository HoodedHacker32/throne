export const DICE = [4, 6, 8, 10, 12, 20, 100] as const

function randInt(max: number): number {
  const buf = new Uint32Array(1)
  const limit = Math.floor(0x100000000 / max) * max
  do crypto.getRandomValues(buf); while (buf[0] >= limit)
  return (buf[0] % max) + 1
}

export interface RollResult {
  label: string
  formula: string
  dice: number[]
  modifier: number
  total: number
  mode: 'normal' | 'advantage' | 'disadvantage'
  kept?: number
  physical?: boolean
  /** Who rolled: a character name, or empty for the table. */
  who?: string
}

/** Roll count dice of a given size. Advantage/disadvantage applies to a single d20. */
export function roll(sides: number, count = 1, modifier = 0, mode: RollResult['mode'] = 'normal', label = ''): RollResult {
  let dice = Array.from({ length: count }, () => randInt(sides))
  let kept: number | undefined
  if (sides === 20 && count === 1 && mode !== 'normal') {
    const two = [dice[0], randInt(20)]
    dice = two
    kept = mode === 'advantage' ? Math.max(...two) : Math.min(...two)
  }
  const base = kept ?? dice.reduce((a, b) => a + b, 0)
  const sign = modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : `${modifier}`
  return {
    label, formula: `${count}d${sides}${sign}`, dice, modifier, total: base + modifier, mode, kept,
  }
}

/** A physical roll typed in by the player. */
export function manualRoll(value: number, modifier: number, label = 'Physical roll'): RollResult {
  return { label, formula: `physical${modifier ? (modifier > 0 ? `+${modifier}` : modifier) : ''}`, dice: [value], modifier, total: value + modifier, mode: 'normal', physical: true }
}

/** Roll a mixed pool like {20: 1, 6: 2}. Advantage/disadvantage applies when the pool is a single d20. */
export function rollPool(pool: Record<number, number>, modifier = 0, mode: RollResult['mode'] = 'normal', label = ''): RollResult {
  const entries = Object.entries(pool).map(([s, n]) => [Number(s), n] as const).filter(([, n]) => n > 0).sort((a, b) => b[0] - a[0])
  if (entries.length === 1 && entries[0][0] === 20 && entries[0][1] === 1) return roll(20, 1, modifier, mode, label)
  const dice: number[] = []
  for (const [sides, n] of entries) for (let i = 0; i < n; i++) dice.push(roll(sides).total)
  const sign = modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : `${modifier}`
  const formula = entries.map(([s, n]) => `${n}d${s}`).join('+') + sign
  return { label, formula, dice, modifier, total: dice.reduce((a, b) => a + b, 0) + modifier, mode: 'normal' }
}

/** "1d20+6: [11] + 6 = 17", or with advantage "[11, 4] keep 11". */
export function describe(r: Pick<RollResult, 'dice' | 'modifier' | 'total' | 'kept'>): string {
  const d = r.kept !== undefined ? `[${r.dice.join(', ')}] keep ${r.kept}` : `[${r.dice.join(', ')}]`
  const m = r.modifier ? ` ${r.modifier > 0 ? '+' : '−'} ${Math.abs(r.modifier)}` : ''
  return `${d}${m} = ${r.total}`
}
