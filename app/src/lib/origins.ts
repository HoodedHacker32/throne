/** Builder data from the free 2024 rules (SRD 5.2): names and numbers only, no book text. */
import type { Ability } from './rules'

export interface ClassDetail {
  skills: string[] | 'any'
  armor: string; weapons: string; tools?: string
  /** Ability order for "Suggest": highest score first. */
  priority: Ability[]
}
export const CLASS_DETAIL: Record<string, ClassDetail> = {
  Barbarian: { skills: ['animal', 'athletics', 'intimidation', 'nature', 'perception', 'survival'], armor: 'Light, Medium, Shields', weapons: 'Simple, Martial', priority: ['str', 'con', 'dex', 'wis', 'cha', 'int'] },
  Bard: { skills: 'any', armor: 'Light', weapons: 'Simple', tools: 'Three musical instruments', priority: ['cha', 'dex', 'con', 'wis', 'int', 'str'] },
  Cleric: { skills: ['history', 'insight', 'medicine', 'persuasion', 'religion'], armor: 'Light, Medium, Shields', weapons: 'Simple', priority: ['wis', 'con', 'str', 'dex', 'cha', 'int'] },
  Druid: { skills: ['arcana', 'animal', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'], armor: 'Light, Shields', weapons: 'Simple', tools: 'Herbalism Kit', priority: ['wis', 'con', 'dex', 'int', 'cha', 'str'] },
  Fighter: { skills: ['acrobatics', 'animal', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'persuasion', 'survival'], armor: 'Light, Medium, Heavy, Shields', weapons: 'Simple, Martial', priority: ['str', 'con', 'dex', 'wis', 'int', 'cha'] },
  Monk: { skills: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'], armor: 'None', weapons: 'Simple, Martial (Light)', tools: "One artisan's tool or musical instrument", priority: ['dex', 'wis', 'con', 'str', 'int', 'cha'] },
  Paladin: { skills: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'], armor: 'Light, Medium, Heavy, Shields', weapons: 'Simple, Martial', priority: ['str', 'cha', 'con', 'wis', 'dex', 'int'] },
  Ranger: { skills: ['animal', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'], armor: 'Light, Medium, Shields', weapons: 'Simple, Martial', priority: ['dex', 'wis', 'con', 'str', 'int', 'cha'] },
  Rogue: { skills: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'persuasion', 'sleight', 'stealth'], armor: 'Light', weapons: 'Simple, Martial (Finesse or Light)', tools: "Thieves' Tools", priority: ['dex', 'con', 'int', 'wis', 'cha', 'str'] },
  Sorcerer: { skills: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'], armor: 'None', weapons: 'Simple', priority: ['cha', 'con', 'dex', 'wis', 'int', 'str'] },
  Warlock: { skills: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'], armor: 'Light', weapons: 'Simple', priority: ['cha', 'con', 'dex', 'wis', 'int', 'str'] },
  Wizard: { skills: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'nature', 'religion'], armor: 'None', weapons: 'Simple', priority: ['int', 'con', 'dex', 'wis', 'cha', 'str'] },
}

export interface Background {
  name: string; abilities: [Ability, Ability, Ability]; skills: [string, string]; tool: string; feat: string
  items: [name: string, qty: number][]; gp: number
}
export const BACKGROUNDS: Background[] = [
  { name: 'Acolyte', abilities: ['int', 'wis', 'cha'], skills: ['insight', 'religion'], tool: "Calligrapher's Supplies", feat: 'Magic Initiate (Cleric)',
    items: [["Calligrapher's Supplies", 1], ['Book (prayers)', 1], ['Holy Symbol', 1], ['Parchment (sheet)', 10], ['Robe', 1]], gp: 8 },
  { name: 'Criminal', abilities: ['dex', 'con', 'int'], skills: ['sleight', 'stealth'], tool: "Thieves' Tools", feat: 'Alert',
    items: [['Dagger', 2], ["Thieves' Tools", 1], ['Crowbar', 1], ['Pouch', 2], ["Traveler's Clothes", 1]], gp: 16 },
  { name: 'Sage', abilities: ['con', 'int', 'wis'], skills: ['arcana', 'history'], tool: "Calligrapher's Supplies", feat: 'Magic Initiate (Wizard)',
    items: [['Quarterstaff', 1], ["Calligrapher's Supplies", 1], ['Book (history)', 1], ['Parchment (sheet)', 8], ['Robe', 1]], gp: 8 },
  { name: 'Soldier', abilities: ['str', 'dex', 'con'], skills: ['athletics', 'intimidation'], tool: 'Gaming Set (one kind)', feat: 'Savage Attacker',
    items: [['Spear', 1], ['Shortbow', 1], ['Arrows', 20], ['Gaming Set', 1], ["Healer's Kit", 1], ['Quiver', 1], ["Traveler's Clothes", 1]], gp: 14 },
]

export interface SpeciesInfo { name: string; size: string; speed: number; darkvision?: number; traits: string[]; extraSkill?: boolean; hpPerLevel?: number }
export const SPECIES_2024: SpeciesInfo[] = [
  { name: 'Dragonborn', size: 'Medium', speed: 30, darkvision: 60, traits: ['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance', 'Draconic Flight (level 5)'] },
  { name: 'Dwarf', size: 'Medium', speed: 30, darkvision: 120, traits: ['Dwarven Resilience', 'Dwarven Toughness (+1 HP per level)', 'Stonecunning'], hpPerLevel: 1 },
  { name: 'Elf', size: 'Medium', speed: 30, darkvision: 60, traits: ['Elven Lineage', 'Fey Ancestry', 'Keen Senses', 'Trance'] },
  { name: 'Gnome', size: 'Small', speed: 30, darkvision: 60, traits: ['Gnomish Cunning', 'Gnomish Lineage'] },
  { name: 'Goliath', size: 'Medium', speed: 35, traits: ['Giant Ancestry', 'Large Form (level 5)', 'Powerful Build'] },
  { name: 'Halfling', size: 'Small', speed: 30, traits: ['Brave', 'Halfling Nimbleness', 'Luck', 'Naturally Stealthy'] },
  { name: 'Human', size: 'Medium or Small', speed: 30, traits: ['Resourceful', 'Skillful (one extra skill)', 'Versatile (an Origin feat)'], extraSkill: true },
  { name: 'Orc', size: 'Medium', speed: 30, darkvision: 120, traits: ['Adrenaline Rush', 'Relentless Endurance'] },
  { name: 'Tiefling', size: 'Medium or Small', speed: 30, darkvision: 60, traits: ['Fiendish Legacy', 'Otherworldly Presence'] },
]
