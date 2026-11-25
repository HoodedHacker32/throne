/** Encounter building numbers (2024 rules, SRD 5.2): XP budget per character by level, XP by challenge rating. Numbers only. */
export const BUDGET: Record<number, [low: number, moderate: number, high: number]> = {
  1: [50, 75, 100], 2: [100, 150, 200], 3: [150, 225, 400], 4: [250, 375, 500], 5: [500, 750, 1100],
  6: [600, 1000, 1400], 7: [750, 1300, 1700], 8: [1000, 1700, 2100], 9: [1300, 2000, 2600], 10: [1600, 2300, 3100],
  11: [1900, 2900, 4100], 12: [2200, 3700, 4700], 13: [2600, 4200, 5400], 14: [2900, 4900, 6200], 15: [3300, 5400, 7800],
  16: [3800, 6100, 9800], 17: [4500, 7200, 11700], 18: [5000, 8700, 14200], 19: [5500, 10700, 17200], 20: [6400, 13200, 22000],
}

export const CR_XP: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900,
  '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000,
  '17': 18000, '18': 20000, '19': 22000, '20': 25000, '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000,
  '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000,
}
export const CRS = Object.keys(CR_XP)

export type Rating = 'none' | 'trivial' | 'low' | 'moderate' | 'high' | 'over'

export function budgetFor(levels: number[]) {
  const sum = (i: 0 | 1 | 2) => levels.reduce((t, l) => t + (BUDGET[Math.max(1, Math.min(20, l))]?.[i] ?? 0), 0)
  return { low: sum(0), moderate: sum(1), high: sum(2) }
}

export function rate(xp: number, b: { low: number; moderate: number; high: number }): Rating {
  if (!xp) return 'none'
  if (xp < b.low) return 'trivial'
  if (xp <= b.moderate) return xp < b.moderate ? 'low' : 'moderate'
  if (xp <= b.high) return xp < b.high ? 'moderate' : 'high'
  return 'over'
}
