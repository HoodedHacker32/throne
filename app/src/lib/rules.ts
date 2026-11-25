/** Core rules tables. Mechanics only (numbers and names), no book text. */
export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
export type Ability = (typeof ABILITIES)[number]
export const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
}

export const SKILLS: { key: string; name: string; ability: Ability }[] = [
  { key: 'acrobatics', name: 'Acrobatics', ability: 'dex' },
  { key: 'animal', name: 'Animal Handling', ability: 'wis' },
  { key: 'arcana', name: 'Arcana', ability: 'int' },
  { key: 'athletics', name: 'Athletics', ability: 'str' },
  { key: 'deception', name: 'Deception', ability: 'cha' },
  { key: 'history', name: 'History', ability: 'int' },
  { key: 'insight', name: 'Insight', ability: 'wis' },
  { key: 'intimidation', name: 'Intimidation', ability: 'cha' },
  { key: 'investigation', name: 'Investigation', ability: 'int' },
  { key: 'medicine', name: 'Medicine', ability: 'wis' },
  { key: 'nature', name: 'Nature', ability: 'int' },
  { key: 'perception', name: 'Perception', ability: 'wis' },
  { key: 'performance', name: 'Performance', ability: 'cha' },
  { key: 'persuasion', name: 'Persuasion', ability: 'cha' },
  { key: 'religion', name: 'Religion', ability: 'int' },
  { key: 'sleight', name: 'Sleight of Hand', ability: 'dex' },
  { key: 'stealth', name: 'Stealth', ability: 'dex' },
  { key: 'survival', name: 'Survival', ability: 'wis' },
]

export interface ClassInfo { name: string; hitDie: number; saves: [Ability, Ability]; primary: string; skillChoices: number }
export const CLASSES: ClassInfo[] = [
  { name: 'Barbarian', hitDie: 12, saves: ['str', 'con'], primary: 'Strength', skillChoices: 2 },
  { name: 'Bard', hitDie: 8, saves: ['dex', 'cha'], primary: 'Charisma', skillChoices: 3 },
  { name: 'Cleric', hitDie: 8, saves: ['wis', 'cha'], primary: 'Wisdom', skillChoices: 2 },
  { name: 'Druid', hitDie: 8, saves: ['int', 'wis'], primary: 'Wisdom', skillChoices: 2 },
  { name: 'Fighter', hitDie: 10, saves: ['str', 'con'], primary: 'Strength or Dexterity', skillChoices: 2 },
  { name: 'Monk', hitDie: 8, saves: ['str', 'dex'], primary: 'Dexterity and Wisdom', skillChoices: 2 },
  { name: 'Paladin', hitDie: 10, saves: ['wis', 'cha'], primary: 'Strength and Charisma', skillChoices: 2 },
  { name: 'Ranger', hitDie: 10, saves: ['str', 'dex'], primary: 'Dexterity and Wisdom', skillChoices: 3 },
  { name: 'Rogue', hitDie: 8, saves: ['dex', 'int'], primary: 'Dexterity', skillChoices: 4 },
  { name: 'Sorcerer', hitDie: 6, saves: ['con', 'cha'], primary: 'Charisma', skillChoices: 2 },
  { name: 'Warlock', hitDie: 8, saves: ['wis', 'cha'], primary: 'Charisma', skillChoices: 2 },
  { name: 'Wizard', hitDie: 6, saves: ['int', 'wis'], primary: 'Intelligence', skillChoices: 2 },
]

export const SPECIES: { name: string; speed: number; size: string }[] = [
  { name: 'Dragonborn', speed: 30, size: 'Medium' }, { name: 'Dwarf', speed: 25, size: 'Medium' },
  { name: 'Elf', speed: 30, size: 'Medium' }, { name: 'Gnome', speed: 25, size: 'Small' },
  { name: 'Half-Elf', speed: 30, size: 'Medium' }, { name: 'Half-Orc', speed: 30, size: 'Medium' },
  { name: 'Halfling', speed: 25, size: 'Small' }, { name: 'Human', speed: 30, size: 'Medium' },
  { name: 'Tiefling', speed: 30, size: 'Medium' },
]

export const ALIGNMENTS = ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil', 'Unaligned']
export const CONDITIONS = ['Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious', 'Exhaustion']

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]
export const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }

export const mod = (score: number) => Math.floor((score - 10) / 2)
export const profBonus = (level: number) => Math.ceil(level / 4) + 1
export const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

/** Starting equipment options per class (SRD 5.2 / 2024 rules). Item names and numbers only. Check your book. */
export interface Kit { label: string; items: [name: string, qty: number][]; gp: number }
export const STARTING_EQUIPMENT: Record<string, Kit[]> = {
  Barbarian: [{ label: 'A', items: [['Greataxe', 1], ['Handaxe', 4], ["Explorer's Pack", 1]], gp: 15 }, { label: 'B', items: [], gp: 75 }],
  Bard: [{ label: 'A', items: [['Leather Armor', 1], ['Dagger', 2], ['Musical Instrument', 1], ["Entertainer's Pack", 1]], gp: 19 }, { label: 'B', items: [], gp: 90 }],
  Cleric: [{ label: 'A', items: [['Chain Shirt', 1], ['Shield', 1], ['Mace', 1], ['Holy Symbol', 1], ["Priest's Pack", 1]], gp: 7 }, { label: 'B', items: [], gp: 110 }],
  Druid: [{ label: 'A', items: [['Leather Armor', 1], ['Shield', 1], ['Sickle', 1], ['Druidic Focus (Quarterstaff)', 1], ["Explorer's Pack", 1], ['Herbalism Kit', 1]], gp: 9 }, { label: 'B', items: [], gp: 50 }],
  Fighter: [
    { label: 'A', items: [['Chain Mail', 1], ['Greatsword', 1], ['Flail', 1], ['Javelin', 8], ["Dungeoneer's Pack", 1]], gp: 4 },
    { label: 'B', items: [['Studded Leather Armor', 1], ['Scimitar', 1], ['Shortsword', 1], ['Longbow', 1], ['Arrows', 20], ['Quiver', 1], ["Dungeoneer's Pack", 1]], gp: 11 },
    { label: 'C', items: [], gp: 155 },
  ],
  Monk: [{ label: 'A', items: [['Spear', 1], ['Dagger', 5], ["Artisan's Tools or Musical Instrument", 1], ["Explorer's Pack", 1]], gp: 11 }, { label: 'B', items: [], gp: 50 }],
  Paladin: [{ label: 'A', items: [['Chain Mail', 1], ['Shield', 1], ['Longsword', 1], ['Javelin', 6], ['Holy Symbol', 1], ["Priest's Pack", 1]], gp: 9 }, { label: 'B', items: [], gp: 150 }],
  Ranger: [{ label: 'A', items: [['Studded Leather Armor', 1], ['Scimitar', 1], ['Shortsword', 1], ['Longbow', 1], ['Arrows', 20], ['Quiver', 1], ['Druidic Focus (sprig of mistletoe)', 1], ["Explorer's Pack", 1]], gp: 7 }, { label: 'B', items: [], gp: 150 }],
  Rogue: [{ label: 'A', items: [['Leather Armor', 1], ['Dagger', 2], ['Shortsword', 1], ['Shortbow', 1], ['Arrows', 20], ['Quiver', 1], ["Thieves' Tools", 1], ["Burglar's Pack", 1]], gp: 8 }, { label: 'B', items: [], gp: 100 }],
  Sorcerer: [{ label: 'A', items: [['Spear', 1], ['Dagger', 2], ['Arcane Focus (crystal)', 1], ["Dungeoneer's Pack", 1]], gp: 28 }, { label: 'B', items: [], gp: 50 }],
  Warlock: [{ label: 'A', items: [['Leather Armor', 1], ['Sickle', 1], ['Dagger', 2], ['Arcane Focus (orb)', 1], ['Book (occult lore)', 1], ["Scholar's Pack", 1]], gp: 15 }, { label: 'B', items: [], gp: 100 }],
  Wizard: [{ label: 'A', items: [['Dagger', 2], ['Arcane Focus (Quarterstaff)', 1], ['Robe', 1], ['Spellbook', 1], ["Scholar's Pack", 1]], gp: 5 }, { label: 'B', items: [], gp: 55 }],
}

/** Weight in lb. for common weapons and armour (per item). Unknown items default to 0 and can be edited on the sheet. */
export const ITEM_WEIGHT: Record<string, number> = {
  Greataxe: 7, Handaxe: 2, 'Leather Armor': 10, Dagger: 1, 'Chain Shirt': 20, Shield: 6, Mace: 4, Sickle: 2, 'Chain Mail': 55,
  Greatsword: 6, Flail: 2, Javelin: 2, 'Studded Leather Armor': 13, Scimitar: 3, Shortsword: 2, Longbow: 2, Shortbow: 2,
  Arrows: 0.05, Quiver: 1, Spear: 3, Longsword: 3, 'Druidic Focus (Quarterstaff)': 4, 'Arcane Focus (Quarterstaff)': 4, Robe: 4, Spellbook: 3,
}

/** Armour for AC: base, whether Dex applies, and the Dex cap. */
export const ARMOR: Record<string, { base: number; dex: boolean; cap?: number }> = {
  'Leather Armor': { base: 11, dex: true }, 'Studded Leather Armor': { base: 12, dex: true },
  'Chain Shirt': { base: 13, dex: true, cap: 2 }, 'Chain Mail': { base: 16, dex: false },
}

/** AC from the items carried, with Barbarian and Monk unarmoured defence. */
export function armorClass(items: string[], dexMod: number, cls: string, conMod: number, wisMod: number) {
  const armor = items.map(i => ARMOR[i]).filter(Boolean).sort((a, b) => b.base - a.base)[0]
  const shield = items.includes('Shield') ? 2 : 0
  if (armor) return armor.base + (armor.dex ? Math.min(dexMod, armor.cap ?? 99) : 0) + shield
  if (cls === 'Barbarian') return 10 + dexMod + conMod + shield
  if (cls === 'Monk' && !shield) return 10 + dexMod + wisMod
  return 10 + dexMod + shield
}
